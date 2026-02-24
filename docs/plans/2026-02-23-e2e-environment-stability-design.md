# E2E Environment Stability Design

Date: 2026-02-23
Status: approved
Owner: OpenSpace test hardening stream

## Problem Statement

E2E runs are unstable and expensive to debug due to environment-level nondeterminism.

Observed root causes in this session:

1. Stale or incorrect server process reuse: port 3000 responds but required OpenSpace routes are missing (`/mcp` returns 404), causing widespread false failures.
2. OpenCode health checks are too weak and can pass against an HTML shell response instead of JSON API readiness.
3. Excessive local parallelism (`workers=4`) increases frontend startup contention and produces repeated preload hangs.

## Goals

1. Make E2E startup deterministic and self-healing.
2. Fail fast on invalid environment states before Playwright test execution.
3. Prefer robustness over startup speed.
4. Reduce flaky failures caused by infra mismatch rather than product behavior.

## Non-Goals

1. Rewriting all E2E specs.
2. Removing retries entirely.
3. Solving product-level failures unrelated to environment health.

## Chosen Approach (Max Stability)

### 1) Strict service validation (not just port checks)

Precheck must verify behavior-level readiness:

- Theia UI responds (`GET /` => HTML).
- Hub route is alive (`POST /mcp` with JSON-RPC payload returns non-404 protocol response).
- Hub instructions route is alive (`GET /openspace/instructions` returns 200 text).
- OpenCode API is alive with JSON response on known API route.

If any of these fail, treat server as unhealthy regardless of open ports.

### 2) Deterministic restart and rebuild path

When unhealthy:

- Stop stale Theia process on target port.
- Rebuild required artifacts (extensions + browser app).
- Start Theia with fresh runtime directory.
- Re-run strict readiness probes before continuing.

### 3) Stable execution concurrency

Set Playwright workers to 1 by default for local + CI during hardening to remove startup race amplification.

### 4) Stronger global setup validation

Global setup must validate OpenCode API responses as JSON where expected.
If API endpoints return HTML shell unexpectedly, treat as invalid environment and fail setup (or restart path), rather than silently proceeding.

### 5) Better diagnostics

When precheck fails, print actionable diagnostics:

- which probe failed,
- last response status/content-type preview,
- where logs are located,
- which restart/rebuild action was attempted.

## Trade-offs

- Slower startup due to stricter checks and potential rebuilds.
- Higher determinism and dramatically less wasted time debugging false negatives.

Given user priority, this trade-off is intentional.

## Verification Strategy

1. Run `yarn test:e2e` from a dirty/stale environment and verify precheck self-recovers.
2. Run `yarn test:e2e` twice back-to-back and compare failure profile.
3. Confirm route checks explicitly reject stale 3000 servers lacking Hub routes.
4. Confirm full suite starts only after all strict probes pass.

## Rollout

1. Update precheck and Playwright config first.
2. Update global setup helpers second.
3. Validate with full E2E runs and capture baseline pass/fail/skip numbers.
4. Document remaining true product failures separately from infra failures.
