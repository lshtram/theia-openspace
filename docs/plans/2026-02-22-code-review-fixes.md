# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all critical and high-priority issues from the 2026-02-22 full codebase review so the repository is releasable with trustworthy CI and security boundaries.

**Architecture:** Apply targeted hardening at trust boundaries first (origin checks, path confinement, CI quality gates), then address reliability hotspots (timeouts, bounded search, lifecycle cleanup), then close test coverage gaps. Keep changes small, test-driven, and isolated by subsystem to reduce regression risk.

**Tech Stack:** TypeScript, Node.js, React/TSX, Theia, Express, Mocha, Playwright, Yarn workspaces

**Review Reference:** `docs/reviews/CODE-REVIEW-2026-02-22.md`

---

## Phase 1: Critical Fixes

### Task 1: Harden origin validation in hub server

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts`
- Test: `extensions/openspace-core/src/node/__tests__/hub.spec.ts` (create/expand)

**Steps:**
1. Write failing tests for crafted origins (`localhost.evil.tld`) and empty `Origin`.
2. Replace prefix matching with strict parsed origin comparison.
3. Ensure aliases (`/manifest`, `/state`) use equivalent protections.
4. Run tests and confirm pass.
5. Commit.

### Task 2: Enforce symlink-safe workspace confinement

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`
- Modify: `extensions/openspace-core/src/node/artifact-store.ts`
- Modify: `extensions/openspace-core/src/node/patch-engine.ts`
- Test: relevant `__tests__` under `extensions/openspace-core/src/node/__tests__/`

**Steps:**
1. Write failing tests for symlink-outside-workspace scenarios.
2. Implement `realpath`-based containment helper shared across these files.
3. Apply helper uniformly to read/write/patch flows.
4. Run targeted tests, then full core node test suite.
5. Commit.

### Task 3: Make CI fail on quality-gate failures

**Files:**
- Modify: `.github/workflows/ci.yml`

**Steps:**
1. Remove `|| echo ...` failure suppression for typecheck/lint/test steps.
2. Add script-existence guards only if truly needed.
3. Validate workflow syntax locally.
4. Commit.

---

## Phase 2: Important Fixes

### Task 4: Bound MCP file search and reduce DoS risk

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`
- Test: `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts`

**Steps:**
1. Add failing tests for pathological regex and oversized trees/files.
2. Add limits (depth/file count/file size/time budget).
3. Replace fully synchronous traversal with bounded async behavior where practical.
4. Return deterministic truncation/limit metadata.
5. Run tests and commit.

### Task 5: Add timeout/abort handling to non-SSE proxy requests

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts`
- Test: `extensions/openspace-core/src/node/__tests__/opencode-proxy.spec.ts` (create/expand)

**Steps:**
1. Add failing test for hung upstream request.
2. Implement timeout + `AbortController` for non-SSE calls.
3. Return clear timeout errors to callers.
4. Verify existing SSE behavior remains unchanged.
5. Commit.

### Task 6: Restrict shell execution cwd to workspace

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts`
- Test: chat/core tests around shell command execution

**Steps:**
1. Add failing tests for missing workspace root and out-of-root cwd requests.
2. Remove `/` fallback in UI flow.
3. Enforce backend cwd policy check.
4. Return actionable error when cwd is invalid.
5. Commit.

### Task 7: Add stream error handling in voice file serving

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-hub-contribution.ts`
- Test: voice route tests (create if absent)

**Steps:**
1. Add failing test for stream read error path.
2. Add `readStream.on('error', ...)` handling with controlled HTTP response.
3. Verify success-path streaming unchanged.
4. Commit.

### Task 8: Include package-level tests in root validation

**Files:**
- Modify: `.mocharc.json` and/or `.github/workflows/ci.yml`

**Steps:**
1. Decide single strategy: broaden root spec glob or add explicit package test step.
2. Implement chosen strategy for `packages/voice-core` coverage.
3. Run root test command and package test command to verify.
4. Commit.

### Task 9: Separate dependency install from build script

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml` (if needed)

**Steps:**
1. Remove `yarn install` from build script chain.
2. Ensure install is performed once in CI before build.
3. Run build locally to confirm no regressions.
4. Commit.

### Task 10: Add Playwright global teardown for process lifecycle

**Files:**
- Modify: `playwright.config.ts`
- Modify/Create: `scripts/global-teardown-opencode.ts`
- Modify: `scripts/global-setup-opencode.ts` (PID handoff if needed)

**Steps:**
1. Add failing/diagnostic test path for leaked process behavior.
2. Implement teardown to stop spawned server reliably.
3. Ensure setup/teardown ownership is explicit and singular.
4. Validate repeated Playwright runs do not leak ports.
5. Commit.

---

## Phase 3: Minor Hardening and Hygiene

### Task 11: Patch-engine queue lifecycle cleanup

**Files:**
- Modify: `extensions/openspace-core/src/node/patch-engine.ts`

**Steps:**
1. Add test asserting queue entries are removed after completion.
2. Implement safe queue-map eviction.
3. Run patch-engine tests and commit.

### Task 12: Validate and clamp voice sample-rate input

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-hub-contribution.ts`
- Test: voice route/provider tests

**Steps:**
1. Add tests for invalid/NaN/out-of-range headers.
2. Enforce finite numeric range and defaults.
3. Run tests and commit.

### Task 13: Standardize lockfile policy

**Files:**
- Modify: repository lockfiles and CI checks

**Steps:**
1. Choose canonical package manager (Yarn, based on current workspace usage).
2. Remove non-canonical lockfile.
3. Add CI guard to prevent reintroduction.
4. Commit.

### Task 14: Replace routine SIGKILL-first process shutdown

**Files:**
- Modify: `scripts/servers.sh`

**Steps:**
1. Add graceful stop attempt with bounded wait.
2. Keep SIGKILL only as explicit fallback.
3. Improve logging around fallback usage.
4. Commit.

---

## Verification Checklist

- Run: `yarn typecheck`
- Run: `yarn lint`
- Run: `yarn test`
- Run: `yarn test:e2e` (or targeted Playwright smoke)
- Confirm CI workflow has no failure suppression for quality gates
- Confirm hub origin tests and symlink confinement tests are present and passing

---

## Delivery Order

1. Phase 1 in one branch segment (or 3 small PRs).
2. Phase 2 in focused PRs by subsystem (core node, chat/proxy, voice, CI/build, e2e infra).
3. Phase 3 as cleanup PR(s) after release blockers are closed.

---

Plan complete and saved to `docs/plans/2026-02-22-code-review-fixes.md`. Two execution options:

1. Subagent-Driven (this session) - dispatch a fresh subagent per task with review between tasks.
2. Parallel Session (separate) - execute via `superpowers:executing-plans` in a new session.
