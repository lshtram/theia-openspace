# Test Suite Hardening (Unit-First) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make test validation strongly unit-first and architecture-aligned so a passing suite gives high confidence in product quality, while limiting E2E to stable sanity and must-do end-to-end paths.

**Architecture:** This plan treats MCP/B1 as the canonical runtime path and removes stale stream-interceptor assumptions from test expectations. The plan uses a strict test pyramid (unit-heavy), upgrades assertion quality, rebuilds E2E infrastructure only for stable must-do scenarios, and adds CI gating that prioritizes deterministic unit checks.

**Tech Stack:** TypeScript, Mocha/Chai/Sinon unit tests, Playwright E2E, Theia/OpenCode MCP integration, GitHub Actions CI.

---

## Current State Inventory (as of 2026-02-23)

This section captures the actual state of the test suite to ground the plan in reality.

### Test File Counts

| Type | Files | Framework |
|------|-------|-----------|
| Unit tests (extensions + packages) | 60 | Mocha + Chai + Sinon |
| E2E tests | 11 | Playwright |
| **Total** | **71** | |

### Unit Tests by Extension

| Extension/Package | Count |
|-------------------|-------|
| openspace-core (browser) | 17 |
| openspace-core (node) | 4 |
| openspace-core (common) | 1 |
| openspace-chat | 7 |
| openspace-voice | 9 |
| openspace-presentation | 4 |
| openspace-whiteboard | 4 |
| openspace-settings | 2 |
| openspace-viewers | 2 |
| openspace-languages | 1 |
| voice-core (package) | 7 |
| **openspace-layout** | **0 (gap)** |

### Key Observations

1. **Ratio is already ~82% unit by file count** (60/71), but assertion quality varies -- many unit tests are structural (checking source patterns) rather than behavioral (exercising runtime paths).

2. **Zero shared test utilities.** No `test-utils/` directory exists. Each E2E file duplicates helpers: `waitForTheiaReady()` (6 files), `dismissWorkspaceTrustDialog()` (5 files), `openChatWidget()` (5 files), `isOpenCodeAvailable()` (2 files), tier-skip logic (multiple files). Only `tests/e2e/helpers/mcp.ts` is shared.

3. **E2E tier system is ad-hoc.** Tests use Tier 1/2/3 labels in comments but skip logic is copy-pasted, not centralized. 16 tests are skipped across 5 files, mostly due to B1 architecture making `page.route()` mocks ineffective.

4. **CI runs everything serially.** `.github/workflows/ci.yml` runs `yarn test` = `test:unit && test:e2e`. No separate lanes, no parallelism, no smoke/nightly distinction.

5. **Coverage tooling exists but is not enforced.** `nyc` is installed, `test:coverage` script exists, but no `.nycrc`, no thresholds, no CI gate.

6. **Assertion style is inconsistent.** `packages/voice-core/` uses Node.js `assert` module; everything else uses `chai`. This creates maintenance burden and cognitive friction.

7. **`whiteboard-diagrams.spec.ts` is disproportionately large.** 25+ E2E tests for 21 diagram types and 3 themes. This should be nightly-only; a single diagram-creates sanity check is sufficient for PR smoke.

8. **`test-setup.js` silences console output.** `console.log/info/debug/warn` are suppressed unless `DEBUG` is set. `console.error` is preserved. This can mask failures -- consider buffering and dumping on test failure.

9. **`openspace-layout` has zero test coverage.** Not mentioned in original plan.

10. **E2E test ordering dependencies exist.** `presentation-tools.spec.ts` skips `read`/`update_slide` tests if the deck file doesn't exist, meaning they depend on `create` running first.

11. **No flaky test markers or quarantine system.** The Playwright retry config (1 local, 2 CI) suggests transient failures are expected but not tracked.

12. **Legacy `tests/e2e/global-setup.ts` exists** but is not referenced by `playwright.config.ts`. Active setup/teardown is in `scripts/global-setup-opencode.ts` and `scripts/global-teardown-opencode.ts`.

---

## Constraints and Targets

- Unit-first ratio target:
  - `75-85%` of all test cases: unit tests
  - `10-20%`: integration/contract tests
  - `<=10%`: E2E tests
- Coverage thresholds (enforced in CI):
  - Statement coverage: `70%` minimum (ramp to `80%` over 3 months)
  - Branch coverage: `60%` minimum (ramp to `70%` over 3 months)
  - E2E tests excluded from coverage metrics
- Runtime target in CI:
  - PR fast lane (unit + contract): `< 5 min`
  - PR full lane (+ E2E smoke): `< 12 min`
  - Nightly exhaustive lane: no strict cap, flake monitored
- Quality target:
  - Critical requirements covered by at least one behavioral test (not structural-only)
  - Zero critical architecture mismatches (`%%OS` assumptions in active tests)
  - `openspace-layout` must have at least basic coverage
- CI server lifecycle:
  - Unit tests: **no server required** (they already run serverless)
  - E2E smoke: server startup via `e2e-precheck.sh` in same job, must be idempotent
  - E2E full (nightly): dedicated workflow with robust server lifecycle and cleanup

---

### Task 1: Create Shared Test Utilities and Normalize Assertion Style

> **Rationale:** This is the highest-leverage task. Every subsequent task benefits from shared utilities. Do this first.

**Files:**
- Create: `extensions/openspace-core/src/test-utils/fake-clock.ts`
- Create: `extensions/openspace-core/src/test-utils/fixture-builders.ts`
- Create: `extensions/openspace-core/src/test-utils/assertions.ts`
- Modify: selected `*.spec.ts` files to use helpers
- Modify: `packages/voice-core/src/**/*.spec.ts` (normalize to `chai`)

**Step 1: Write failing helper adoption test in one target suite**

Pick one suite with timing flakiness and assert deterministic clock usage.

**Step 2: Implement helper modules**

Provide:
- fake timer wrapper (Sinon fake timers with ergonomic API)
- standard fixture builders for projects/sessions/messages/permissions
- structured result assertions (success/error payload shape validation)
- re-export `chai` expect for consistent imports

**Step 3: Normalize `packages/voice-core/` from `assert` to `chai`**

The 7 spec files in `packages/voice-core/` use Node.js `assert` module. Migrate to `chai` `expect()` to match the rest of the codebase. This is a mechanical change -- no logic changes.

**Step 4: Migrate first 3 core specs to shared utilities**

Priority:
- `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`
- `extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts`
- `extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts`

**Step 5: Run targeted unit tests**

Run:
```bash
yarn test -- extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
yarn test -- extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts
yarn test -- extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts
yarn test -- packages/voice-core/
```
Expected: all pass, voice-core uses chai, timing sensitivity reduced.

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/test-utils packages/voice-core/src extensions/openspace-core/src/browser/__tests__/session-service.spec.ts extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts
git commit -m "test: add shared test utilities, normalize assertion style, migrate critical specs"
```

---

### Task 2: Consolidate E2E Helpers and Rebuild Infrastructure

> **Rationale:** Stop the bleeding on E2E duplication before touching any E2E test logic.

**Files:**
- Create: `tests/e2e/helpers/theia.ts` (consolidated Theia helpers)
- Create: `tests/e2e/helpers/test-data.ts` (deterministic fixtures)
- Modify: `tests/e2e/global-setup.ts` (make it the active setup)
- Create: `tests/e2e/global-teardown.ts`
- Modify: `playwright.config.ts`
- Modify: all 11 `tests/e2e/*.spec.ts` files (use shared helpers)
- Modify: `docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md`

**Step 1: Extract shared E2E helpers into `tests/e2e/helpers/theia.ts`**

Consolidate these duplicated functions into a single module:
- `waitForTheiaReady(page)` -- single canonical implementation
- `dismissWorkspaceTrustDialog(page)` -- single canonical implementation
- `openChatWidget(page)` -- single canonical implementation
- `isOpenCodeAvailable()` -- single canonical implementation
- `skipUnlessTier(tier, page)` -- centralized tier-skip logic replacing ad-hoc `test.skip()` patterns
- `ensureTestHooks(page)` -- centralized check for `window.__openspace_test__`

**Step 2: Implement deterministic service lifecycle**

Setup/teardown:
- Reconcile `tests/e2e/global-setup.ts` (legacy, unused) with `scripts/global-setup-opencode.ts` (active) -- choose one canonical path
- Start/check required services with health checks
- Seed deterministic project/session fixtures via `test-data.ts`
- Ensure cleanup even on failure (SIGTERM then SIGKILL, PID file cleanup)
- Point `playwright.config.ts` at the canonical setup/teardown

**Step 3: Migrate all E2E spec files to use shared helpers**

Replace inline helper definitions in all 11 spec files with imports from `tests/e2e/helpers/theia.ts`. This is a mechanical refactor -- no test logic changes.

**Step 4: Remove browser-route mock dependency from critical tests**

Keep `page.route()` interception only for true browser-only paths. Tests that relied on route mocking for B1 backend calls should either use real backend or be converted to unit/contract tests.

**Step 5: Validate smoke reliability (repeat runs)**

Run:
```bash
yarn test:e2e --grep "smoke"
yarn test:e2e --grep "smoke"
yarn test:e2e --grep "smoke"
```
Expected: stable pass across repeated runs.

**Step 6: Commit**

```bash
git add tests/e2e/helpers/ tests/e2e/global-setup.ts tests/e2e/global-teardown.ts playwright.config.ts tests/e2e/*.spec.ts docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md
git commit -m "test(e2e): consolidate helpers, align harness with B1, deterministic fixtures"
```

---

### Task 3: Establish Doc Baseline, Traceability Matrix, and Test Strategy

> **Rationale:** Consolidated from original Tasks 1-3. Documentation work is important but should not block code improvements. Keep it concise -- one strategy doc, one matrix, one gaps file.

**Files:**
- Create: `docs/testing/UNIT-FIRST-TEST-STRATEGY.md` (single strategy doc, max 2 pages)
- Create: `docs/testing/REQUIREMENTS-TEST-MATRIX.md`
- Create: `docs/testing/TEST-COVERAGE-GAPS.md`
- Modify: `docs/requirements/REQ-MODALITY-PLATFORM-V2.md`
- Modify: `docs/requirements/REQ-OPENSPACE.md`
- Modify: `.github/workflows/ci.yml`

**Step 1: Run drift verification**

Run:
```bash
rg "%%OS|stream interceptor|AGENT_COMMAND" docs/requirements docs/testing
```
Expected: identify stale references.

**Step 2: Update docs to canonical MCP/B1 language**

- In `REQ-MODALITY-PLATFORM-V2.md`, mark `%%OS` command channel sections as historical/superseded.
- In `REQ-OPENSPACE.md`, normalize test references for MCP path.

**Step 3: Write concise test strategy document**

`UNIT-FIRST-TEST-STRATEGY.md` must include (max 2 pages):
- Test pyramid policy and ratio targets
- E2E admission criteria (must verify true cross-process behavior that cannot be unit-tested)
- Flake policy: quarantine with linked issue, max 2 weeks in quarantine before fix-or-delete
- Console output policy: silence in passing tests, dump buffer on failure
- Canonical architecture sources: `TECHSPEC-THEIA-OPENSPACE.md`, `WORKPLAN.md`, `REQ-AGENT-IDE-CONTROL.md`

**Step 4: Build requirements-to-tests traceability matrix**

Write `REQUIREMENTS-TEST-MATRIX.md` with columns:
- Requirement group (Agent IDE control, Session/chat UX, Modality contracts, Security/safety)
- Requirement ID
- Test file path
- Type (`unit`, `integration`, `e2e`)
- Strength (`structural`, `contract`, `behavioral`, `user-visible`)
- Gap severity (`critical`, `high`, `medium`, `low`)

Populate `TEST-COVERAGE-GAPS.md` with top 15 missing/weak scenarios. Must include:
- `openspace-layout` zero-coverage gap (severity: `medium`)
- Any requirement with only structural coverage (severity: `high`)

**Step 5: Add CI lanes in workflow**

Implement jobs in `.github/workflows/ci.yml`:
- `unit-fast` (always on PR, no server needed)
- `integration-contract` (always on PR, no server needed)
- `e2e-smoke` (always on PR, starts server via `e2e-precheck.sh`)
- `e2e-full` (nightly/scheduled only, separate workflow or cron trigger)

Hard gates:
- Fail PR if `unit-fast` fails
- Fail PR if `integration-contract` fails
- Fail PR if `e2e-smoke` fails
- Warn (not fail) for `@quarantine` tests with linked issue

**Step 6: Re-run drift verification**

Run:
```bash
rg "%%OS|stream interceptor|AGENT_COMMAND" docs/requirements docs/testing
```
Expected: only explicitly historical sections remain.

**Step 7: Commit**

```bash
git add docs/testing/ docs/requirements/REQ-MODALITY-PLATFORM-V2.md docs/requirements/REQ-OPENSPACE.md .github/workflows/ci.yml
git commit -m "docs+ci: test strategy, traceability matrix, CI lanes with unit-first gates"
```

---

### Task 4: Upgrade Core Unit Tests from Structural to Behavioral

**Files:**
- Modify: `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts`
- Modify: `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`
- Modify: `extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts`

**Step 1: Add failing tests that assert runtime behavior, not source string checks**

Replace/augment tests that parse source files for patterns with behavior assertions.

**Step 2: Implement behavioral assertions**

Examples:
- MCP handler returns structured error/success payloads
- model ID parsing verified through function behavior
- delete confirmation uses service pathway through observable effect

**Step 3: Remove or downgrade brittle source-inspection tests**

Keep only where runtime path is truly inaccessible and document rationale inline.

**Step 4: Run suite-level tests**

Run:
```bash
yarn test -- extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts
yarn test -- extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
yarn test -- extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts
```

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts extensions/openspace-core/src/browser/__tests__/session-service.spec.ts extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts
git commit -m "test: strengthen core behavioral assertions and reduce structural checks"
```

---

### Task 5: Expand Security-Focused Unit Regression Pack

**Files:**
- Modify: `extensions/openspace-core/src/browser/__tests__/path-validator.spec.ts`
- Modify: `extensions/openspace-core/src/common/__tests__/sensitive-files.spec.ts`
- Modify: `extensions/openspace-chat/src/browser/__tests__/markdown-renderer-xss.spec.ts`
- Create: `extensions/openspace-core/src/browser/__tests__/dangerous-terminal-policy.spec.ts`

**Step 1: Add failing tests for threat cases explicitly listed in requirements**

Cover:
- symlink traversal edge cases
- sensitive denylist false positives/negatives
- markdown/svg/ansi payload variants
- dangerous terminal command confirmation policy

**Step 2: Implement minimal test scaffolding/mocks**

No app behavior changes unless tests expose real defects.

**Step 3: Run targeted security tests**

Run:
```bash
yarn test -- extensions/openspace-core/src/browser/__tests__/path-validator.spec.ts
yarn test -- extensions/openspace-core/src/common/__tests__/sensitive-files.spec.ts
yarn test -- extensions/openspace-chat/src/browser/__tests__/markdown-renderer-xss.spec.ts
yarn test -- extensions/openspace-core/src/browser/__tests__/dangerous-terminal-policy.spec.ts
```

**Step 4: Add security mapping entries to matrix**

Update `docs/testing/REQUIREMENTS-TEST-MATRIX.md`.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/__tests__/path-validator.spec.ts extensions/openspace-core/src/common/__tests__/sensitive-files.spec.ts extensions/openspace-chat/src/browser/__tests__/markdown-renderer-xss.spec.ts extensions/openspace-core/src/browser/__tests__/dangerous-terminal-policy.spec.ts docs/testing/REQUIREMENTS-TEST-MATRIX.md
git commit -m "test: expand security unit regressions for path, secrets, xss, and terminal policy"
```

---

### Task 6: Add Contract Tests for MCP Tool Catalog and Semantics

**Files:**
- Modify: `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts`
- Create: `extensions/openspace-core/src/node/__tests__/mcp-tool-contracts.spec.ts`

**Step 1: Add failing contract tests from requirement IDs**

Test each required tool family:
- discovery (`tools/list`)
- schema validation failure path
- structured success/error return payload
- command bridge routing semantics

**Step 2: Implement shared contract fixture generation**

Generate expected command IDs from one canonical constant to reduce drift.

**Step 3: Validate all tool groups**

Pane, editor, terminal, file, presentation, whiteboard, artifact tools.

**Step 4: Run MCP contract tests**

Run:
```bash
yarn test -- extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts
yarn test -- extensions/openspace-core/src/node/__tests__/mcp-tool-contracts.spec.ts
```

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts extensions/openspace-core/src/node/__tests__/mcp-tool-contracts.spec.ts
git commit -m "test: add MCP tool contract coverage for schema and result semantics"
```

---

### Task 7: Stabilize Chat/Session Unit Tests and Reduce E2E Dependence

**Files:**
- Modify: `extensions/openspace-chat/src/browser/__tests__/chat-widget-session-load.spec.ts`
- Modify: `extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts`
- Modify: `extensions/openspace-chat/src/browser/__tests__/message-timeline.spec.ts` (expand existing rather than create new)
- Modify: `extensions/openspace-chat/src/browser/__tests__/model-selector.spec.ts` (expand existing rather than create new)

> **Note:** The original plan created new `message-timeline-scroll.spec.ts` and `model-selection.spec.ts` files. Review found that `message-timeline.spec.ts` and `model-selector.spec.ts` already exist. Expand these instead of creating near-duplicates.

**Step 1: Add failing unit tests for phase-2 critical UX behavior**

Cover:
- loading/empty/error/retry differentiation
- project/session change-driven reloads
- auto-scroll pause/resume behavior
- model selection persistence semantics

**Step 2: Use deterministic timers and event simulation**

Use the shared fake-clock utility from Task 1. Avoid sleeping-based waits.

**Step 3: Keep tests component-level with mocked services**

No E2E needed for these details.

**Step 4: Run chat unit suite**

Run:
```bash
yarn test -- extensions/openspace-chat/src/browser/__tests__/chat-widget-session-load.spec.ts
yarn test -- extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts
yarn test -- extensions/openspace-chat/src/browser/__tests__/message-timeline.spec.ts
yarn test -- extensions/openspace-chat/src/browser/__tests__/model-selector.spec.ts
```

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/__tests__/chat-widget-session-load.spec.ts extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts extensions/openspace-chat/src/browser/__tests__/message-timeline.spec.ts extensions/openspace-chat/src/browser/__tests__/model-selector.spec.ts
git commit -m "test: strengthen chat/session unit coverage for core UX behaviors"
```

---

### Task 8: Reduce E2E Scope to Must-Do Sanity Set

**Files:**
- Create: `docs/testing/E2E-MINIMAL-SANITY-SUITE.md`
- Modify: `tests/e2e/*.spec.ts` (tagging and scope reduction)

**Step 1: Define must-do E2E suite (no more than 8-12 tests)**

Required scenarios:
- app boots and chat widget loads
- create/switch/delete session basic path
- one MCP command roundtrip that changes visible IDE state
- permission dialog grant/deny happy path
- one presentation open+navigate sanity
- one whiteboard create-diagram sanity (single diagram type, not 21)
- one critical negative security flow (outside-workspace rejection)

**Step 2: Tag tests by tier**

Tags:
- `@smoke` (PR required)
- `@full` (nightly)
- `@quarantine` (excluded from PR, linked issue required)

Specific decisions:
- `whiteboard-diagrams.spec.ts` (25+ tests): **move entirely to `@full` nightly**. Keep only a single "create one diagram" test as `@smoke`.
- `presentation-tools.spec.ts` (12 tests): move bulk to `@full`, keep only "create + read" as `@smoke`.
- `verify-bugs.spec.ts`: move to `@full` unless a regression is actively recent.
- E2E tests with ordering dependencies (`presentation-tools.spec.ts` read/update depending on create): fix ordering dependency by seeding fixture in `beforeAll`, or accept `@full`-only.

**Step 3: Move nonessential flaky tests out of PR lane**

Document why each moved test is nonessential for PR gate.

**Step 4: Run smoke lane locally**

Run:
```bash
yarn test:e2e --grep "@smoke"
```

**Step 5: Commit**

```bash
git add docs/testing/E2E-MINIMAL-SANITY-SUITE.md tests/e2e
git commit -m "test(e2e): enforce minimal sanity suite and tiered tagging"
```

---

### Task 9: Add Coverage Gates and Lane Scripts

**Files:**
- Create: `.nycrc.json` (coverage config -- currently missing)
- Modify: `package.json` (test scripts)
- Create: `docs/testing/COVERAGE-GATES.md`
- Modify: `.github/workflows/ci.yml`

**Step 1: Create `.nycrc.json` with explicit thresholds**

```json
{
  "check-coverage": true,
  "statements": 70,
  "branches": 60,
  "functions": 65,
  "lines": 70,
  "include": [
    "extensions/*/src/**/*.ts"
  ],
  "exclude": [
    "**/__tests__/**",
    "**/test-utils/**",
    "**/node_modules/**"
  ],
  "reporter": ["text-summary", "html", "lcov"]
}
```

Initial thresholds (ramp schedule):
- Month 1: statements 70%, branches 60%, functions 65%, lines 70%
- Month 2: statements 75%, branches 65%, functions 70%, lines 75%
- Month 3: statements 80%, branches 70%, functions 75%, lines 80%

**Step 2: Add scripts for lane-specific execution**

Scripts in root `package.json`:
- `test:unit:core` -- runs only `extensions/*/src/**/__tests__/*.spec.ts`
- `test:unit:packages` -- runs only `packages/*/src/**/*.spec.ts`
- `test:integration:contracts` -- runs only `**/mcp-tool-contracts.spec.ts` and similar
- `test:e2e:smoke` -- `bash scripts/e2e-precheck.sh && playwright test --grep @smoke`
- `test:e2e:full` -- `bash scripts/e2e-precheck.sh && playwright test`
- `test:coverage` -- `nyc mocha` (already exists, now uses `.nycrc.json`)

**Step 3: Integrate threshold checks in CI**

PR gates enforce unit+contract coverage floors. E2E tests excluded from coverage.

**Step 4: Consider test parallelism**

If unit test count grows significantly, enable Mocha `--parallel` with appropriate worker count. Document the decision in `COVERAGE-GATES.md`:
- Current suite: parallelism not needed (runs in 1-2 min)
- If suite exceeds 5 min: enable `--parallel --jobs 4`
- If suite exceeds 10 min: evaluate runner migration

**Step 5: Run lane scripts and verify outputs**

Run:
```bash
yarn test:unit:core
yarn test:integration:contracts
yarn test:coverage
```

**Step 6: Commit**

```bash
git add .nycrc.json package.json docs/testing/COVERAGE-GATES.md .github/workflows/ci.yml
git commit -m "ci(test): add coverage config, lane scripts, unit-first coverage gates"
```

---

### Task 10: Add `openspace-layout` Baseline Coverage

> **Rationale:** This extension has zero tests. Even minimal structural tests are better than nothing and ensure regressions are caught.

**Files:**
- Create: `extensions/openspace-layout/src/browser/__tests__/` directory
- Create: at least 1 spec file covering layout contribution basics

**Step 1: Identify testable surface area**

Review `extensions/openspace-layout/src/` for exported classes, contribution bindings, and command registrations.

**Step 2: Write baseline unit tests**

At minimum:
- Contribution module exports expected bindings
- Any layout commands are registered correctly
- Any widget factories produce valid widgets

**Step 3: Run tests**

Run:
```bash
yarn test -- extensions/openspace-layout/src/browser/__tests__/
```

**Step 4: Update traceability matrix**

Mark `openspace-layout` as having baseline coverage in `docs/testing/REQUIREMENTS-TEST-MATRIX.md`.

**Step 5: Commit**

```bash
git add extensions/openspace-layout/src/browser/__tests__/ docs/testing/REQUIREMENTS-TEST-MATRIX.md
git commit -m "test: add baseline unit coverage for openspace-layout"
```

---

### Task 11: Final Validation and Handoff

**Files:**
- Create: `docs/testing/TEST-SUITE-HARDENING-REPORT.md`
- Modify: `docs/testing/REQUIREMENTS-TEST-MATRIX.md`
- Modify: `docs/testing/TEST-COVERAGE-GAPS.md`

**Step 1: Generate before/after metrics**

Include:
- unit/integration/e2e counts (before: 60/0/11, after: expected totals)
- flake rate trend (before/after quarantine system)
- critical requirement coverage status
- coverage percentages vs. thresholds

**Step 2: Update unresolved gaps and explicit deferrals**

Each deferral must include owner, issue link, and target date.

**Step 3: Verify all plan acceptance criteria**

Checklist:
- docs aligned to MCP/B1
- unit-first ratio achieved
- assertion style normalized (chai everywhere)
- E2E helpers consolidated (no duplicated functions)
- smoke E2E stable (3 consecutive runs pass)
- CI gates active (lanes, coverage thresholds)
- `openspace-layout` has baseline coverage
- console-on-failure strategy documented

**Step 4: Run final verification commands**

Run:
```bash
yarn build
yarn test:unit:core
yarn test:integration:contracts
yarn test:coverage
yarn test:e2e --grep "@smoke"
```

**Step 5: Commit**

```bash
git add docs/testing/TEST-SUITE-HARDENING-REPORT.md docs/testing/REQUIREMENTS-TEST-MATRIX.md docs/testing/TEST-COVERAGE-GAPS.md
git commit -m "docs(test): publish test hardening report and remaining gaps"
```

---

## Minimal E2E Suite Definition (Strict)

Only keep the following in required PR smoke:

1. App boot + chat panel render
2. Session CRUD basic path
3. MCP command roundtrip (single representative command per PR lane)
4. Permission dialog grant and deny
5. One presentation open sanity
6. One whiteboard create-diagram sanity (single diagram type, not full matrix)
7. One security rejection sanity (path outside workspace)

Everything else:
- move to `@full` nightly, or
- convert to unit/contract tests if possible.

Specific moves:
- `whiteboard-diagrams.spec.ts` (25+ tests for 21 types, 3 themes) -> `@full` nightly, single create-sanity to `@smoke`
- `presentation-tools.spec.ts` bulk -> `@full` nightly
- `verify-bugs.spec.ts` -> `@full` nightly
- `session-management-integration.spec.ts` (HTTP API tests) -> convert to contract tests if possible

---

## Implementation Order

1. **Task 1** -- Shared test utilities + assertion normalization (unblocks everything)
2. **Task 2** -- E2E helper consolidation + infra (stops duplication bleeding)
3. **Task 3** -- Docs baseline + strategy + CI lanes (now informed by Tasks 1-2)
4. **Tasks 4-7** -- Behavioral upgrades, security, MCP contracts, chat/session
5. **Task 8** -- E2E scope reduction and tagging
6. **Tasks 9-10** -- Coverage gates + layout baseline
7. **Task 11** -- Final validation and report

---

## Risks and Mitigations

- **Risk:** E2E harness setup complexity delays progress
  - Mitigation: keep PR smoke suite tiny; defer broad E2E to nightly

- **Risk:** Unit test rewrites uncover real defects and expand scope
  - Mitigation: enforce small batch commits and defect triage labels; real defects get their own issues, not inline fixes

- **Risk:** Doc drift returns over time
  - Mitigation: add CI drift check (`rg "%%OS|stream interceptor|AGENT_COMMAND" docs/`) as a lint step

- **Risk:** Coverage thresholds set too high initially, blocking all PRs
  - Mitigation: start at 70%/60% (statement/branch) and ramp over 3 months with documented schedule

- **Risk:** E2E server startup unreliable on CI
  - Mitigation: unit tests run without any server; E2E smoke uses idempotent `e2e-precheck.sh` with health checks and retry; nightly workflow has dedicated server lifecycle

- **Risk:** Mocha test parallelism needed as suite grows
  - Mitigation: document threshold triggers (>5 min -> enable `--parallel`); keep as future option, not immediate requirement

- **Risk:** Console silencing masks real failures
  - Mitigation: document strategy in test-strategy doc; consider implementing buffer-and-dump-on-failure in `test-setup.js`

---

## Definition of Done

- Unit-first ratio target achieved (75-85% unit tests)
- Critical requirements mapped to behavioral tests in matrix
- Assertion style normalized to `chai` across all packages
- E2E helpers consolidated into `tests/e2e/helpers/theia.ts` (zero duplicated functions)
- PR pipeline depends primarily on unit/contract tests (lanes separated)
- E2E limited to stable sanity (`@smoke` tag, max 8-12 tests)
- Coverage thresholds configured and enforced in CI (`.nycrc.json`)
- `openspace-layout` has baseline test coverage
- Known remaining gaps documented with owners and timelines
- Smoke E2E passes 3 consecutive local runs without flakes
