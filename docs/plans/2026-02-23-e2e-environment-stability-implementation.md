# E2E Environment Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make E2E execution deterministic and robust by validating real route readiness, self-healing stale servers, and reducing startup race conditions.

**Architecture:** Harden the precheck path so it verifies behavior-level readiness (`/mcp`, `/openspace/instructions`, OpenCode JSON APIs) instead of raw port liveness, then enforce a clean rebuild/restart path when checks fail. Tighten Playwright runtime defaults for reliability-first execution and align global setup health checks with API-level expectations.

**Tech Stack:** Bash, Playwright, TypeScript, Node.js, Theia/OpenSpace backend routes.

---

### Task 1: Add strict readiness probes to precheck script

**Files:**
- Modify: `scripts/e2e-precheck.sh`
- Test: `scripts/e2e-precheck.sh` (manual command checks)

**Step 1: Write failing validation check behavior (manual red step)**

Define target behavior in script comments and probe functions:
- `GET /` indicates Theia HTTP service is up.
- `POST /mcp` with JSON-RPC payload must not return 404.
- `GET /openspace/instructions` must return 200.
- OpenCode API endpoint must return JSON content-type.

**Step 2: Run existing precheck status to show insufficient checks**

Run: `bash scripts/e2e-precheck.sh --status`
Expected: currently reports healthy from port checks only.

**Step 3: Implement minimal strict probe functions**

In `scripts/e2e-precheck.sh`, add dedicated probe helpers:
- `probe_theia_root`
- `probe_hub_mcp`
- `probe_hub_instructions`
- `probe_opencode_api`

Each probe should capture status code/content-type and return non-zero on mismatch.

**Step 4: Wire strict probes into readiness flow**

Replace `server_ready` success criteria in startup/status paths with strict probe aggregate checks. Keep clear diagnostics for which probe failed.

**Step 5: Verify strict probes fail on bad route states and pass on healthy states**

Run: `bash scripts/e2e-precheck.sh --status`
Expected: status output includes route-level health details, not just port liveness.

**Step 6: Commit**

```bash
git add scripts/e2e-precheck.sh
git commit -m "test(e2e): enforce strict hub and API readiness probes"
```

### Task 2: Add deterministic rebuild+restart self-healing in precheck

**Files:**
- Modify: `scripts/e2e-precheck.sh`
- Test: `scripts/e2e-precheck.sh` (runtime verification)

**Step 1: Write failing scenario definition (manual red step)**

Document expected behavior: if port 3000 responds but `/mcp` or `/openspace/instructions` fails, precheck must rebuild/restart instead of continuing.

**Step 2: Implement Theia process detection and controlled restart**

Add logic to:
- identify listener PID on `THEIA_PORT`,
- stop stale Theia process when strict probes fail,
- rebuild artifacts (`build:extensions`, `build:browser`),
- restart Theia,
- re-run strict probes.

**Step 3: Harden OpenCode validation path**

If OpenCode port is up but API probe fails (HTML shell or non-JSON), restart OpenCode and re-verify.

**Step 4: Add actionable diagnostics**

Print:
- failed probe name,
- observed status/content-type summary,
- log file path,
- attempted recovery action.

**Step 5: Verify self-healing path**

Run: `bash scripts/e2e-precheck.sh`
Expected: precheck recovers stale state automatically or exits 1 with precise diagnostics.

**Step 6: Commit**

```bash
git add scripts/e2e-precheck.sh
git commit -m "test(e2e): self-heal stale theia and opencode processes"
```

### Task 3: Make Playwright execution reliability-first

**Files:**
- Modify: `playwright.config.ts`
- Test: `yarn test:e2e --grep "App Load Smoke Tests"`

**Step 1: Write expected reliability defaults (manual red step)**

Define expected defaults in config comments:
- workers set to 1 for local and CI during hardening,
- no unsafe reuse assumptions for stale server sessions.

**Step 2: Implement minimal configuration change**

Update `playwright.config.ts`:
- set `workers: 1`.
- keep retries but avoid settings that encourage stale process reuse.

**Step 3: Verify with smoke subset**

Run: `playwright test tests/e2e/app-load.spec.ts`
Expected: stable startup behavior under serialized execution.

**Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): default to single-worker reliable execution"
```

### Task 4: Align global setup OpenCode checks with API readiness

**Files:**
- Modify: `tests/e2e/global-setup.ts`
- Modify: `scripts/global-setup-opencode.ts`
- Test: `yarn test:e2e --grep "MCP Tools Smoke Tests"`

**Step 1: Write failing setup expectation (manual red step)**

Define behavior: setup must not silently continue when `/project/init` returns HTML shell; it must detect invalid API mode and trigger fail/recovery.

**Step 2: Implement strict JSON response guards**

In `tests/e2e/global-setup.ts`:
- require JSON content-type for OpenCode API calls,
- provide clear error if non-JSON response appears,
- avoid silent skip for required setup paths.

In `scripts/global-setup-opencode.ts`:
- strengthen health probe to validate API endpoint responses.

**Step 3: Verify setup behavior**

Run: `playwright test tests/e2e/mcp-tools.spec.ts`
Expected: setup fails fast on invalid OpenCode API mode or proceeds with valid API responses.

**Step 4: Commit**

```bash
git add tests/e2e/global-setup.ts scripts/global-setup-opencode.ts
git commit -m "test(e2e): fail fast on invalid opencode api responses"
```

### Task 5: End-to-end verification and documentation

**Files:**
- Modify: `docs/testing/TEST-COVERAGE-GAPS.md`
- Modify: `docs/testing/REQUIREMENTS-TEST-MATRIX.md`
- Test: full E2E + unit

**Step 1: Run complete E2E suite**

Run: `yarn test:e2e`
Expected: precheck gates startup; failures (if any) are product-level, not environment bootstrap ambiguity.

**Step 2: Run complete unit suite**

Run: `yarn test:unit`
Expected: no regressions.

**Step 3: Update docs with infra stability status**

Record:
- what was stabilized,
- what remains flaky and why,
- any spec families still intentionally constrained.

**Step 4: Commit**

```bash
git add docs/testing/TEST-COVERAGE-GAPS.md docs/testing/REQUIREMENTS-TEST-MATRIX.md
git commit -m "docs(testing): record e2e environment hardening outcomes"
```
