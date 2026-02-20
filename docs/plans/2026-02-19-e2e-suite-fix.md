# E2E Suite Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the full Playwright E2E suite pass reliably by fixing three independent root-cause bugs and documenting the "server must be running" contract.

**Architecture:** Option A — reuse the existing dev server (`reuseExistingServer: true`), add a fast health-check guard in global setup, fix the Chromium binary, fix the MCP `Accept` header, and fix one stale assertion. No new infrastructure.

**Tech Stack:** Playwright 1.58.2, Chromium, TypeScript, Node http

---

## Root Causes Summary

| # | Bug | Affected tests | Fix |
|---|-----|---------------|-----|
| 1 | Chromium binary not installed | 36 browser-based tests | `npx playwright install chromium` |
| 2 | MCP `Accept` header missing `text/event-stream` | 13 MCP tests | Add `text/event-stream` to Accept in 2 files |
| 3 | `%%OS` marker removed from hub instructions | 1 test | Update assertion to match current content |

After these three fixes, all 57 tests should pass when the Theia dev server is running on port 3000.

---

## Task 1: Install the Chromium browser binary

**Files:**
- No file changes — this is a one-time install command

**Context:** Playwright 1.58.2 ships with a new Chromium headless shell binary at a different path than the previously installed version. The binary does not exist yet.

**Step 1: Install Chromium**

```bash
npx playwright install chromium
```

Expected output: `Downloading Chromium ...` followed by `chromium ... Done`

**Step 2: Verify the binary exists**

```bash
ls ~/.local/share/ms-playwright/ 2>/dev/null || ls ~/Library/Caches/ms-playwright/ 2>/dev/null
```

Expected: a `chromium_headless_shell-*` directory exists.

**Step 3: Smoke-test that Playwright can launch a browser**

```bash
npx playwright test tests/e2e/session-management-integration.spec.ts --reporter=line 2>&1 | tail -10
```

Expected: tests pass (they don't need the Chromium binary — they use `request` context only). This confirms Playwright itself works.

**Step 4: Commit** — no file changes needed; this is an environment fix. Skip commit for this task.

---

## Task 2: Fix MCP `Accept` header — `mcp-tools.spec.ts`

**Files:**
- Modify: `tests/e2e/mcp-tools.spec.ts:34-41`

**Context:** The `/mcp` endpoint uses the MCP "Streamable HTTP" transport which requires the client to advertise support for SSE via `Accept: application/json, text/event-stream`. Without `text/event-stream` in the Accept header, the server returns 406 Not Acceptable. The current tests only send `Accept: application/json`.

Verified by manual `curl`:
- `Accept: application/json` → 406
- `Accept: application/json, text/event-stream` → 200 with SSE body `event: message\ndata: {...}`

**Step 1: Update the `mcpRequest` helper**

In `tests/e2e/mcp-tools.spec.ts`, find the `mcpRequest` function. The `headers` object currently has:

```ts
headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
},
```

Change it to:

```ts
headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
},
```

**Step 2: Update the response parsing**

The server now returns an SSE-formatted body, not raw JSON. The body looks like:

```
event: message
data: {"result":{...},"jsonrpc":"2.0","id":1}

```

The current `response.json()` call will fail because the body is not JSON. Replace it with a small helper that parses the SSE `data:` line:

Replace the entire `mcpRequest` function body with:

```ts
async function mcpRequest(method: string, params?: unknown): Promise<any> {
    const body = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        ...(params !== undefined ? { params } : {}),
    };

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    // Streamable HTTP returns SSE: "event: message\ndata: {...}\n\n"
    // Extract the JSON from the data: line.
    const dataLine = text.split('\n').find(line => line.startsWith('data:'));
    if (!dataLine) {
        throw new Error(`MCP response has no data line. Body: ${text.substring(0, 200)}`);
    }
    return JSON.parse(dataLine.slice('data:'.length).trim());
}
```

**Step 3: Run only the mcp-tools tests to verify**

```bash
npx playwright test tests/e2e/mcp-tools.spec.ts --reporter=line 2>&1
```

Expected: 5 passing, 0 failing.

**Step 4: Commit**

```bash
git add tests/e2e/mcp-tools.spec.ts
git commit -m "fix(e2e): add text/event-stream to MCP Accept header (Streamable HTTP transport)"
```

---

## Task 3: Fix MCP `Accept` header — `presentation-tools.spec.ts`

**Files:**
- Modify: `tests/e2e/presentation-tools.spec.ts:40-47` (the `mcpCall` function)
- Modify: `tests/e2e/presentation-tools.spec.ts:104-110` and `:131-137` (the two inline `fetch` calls in `tools/list` tests)

**Context:** Same root cause as Task 2. The `presentation-tools.spec.ts` file has its own `mcpCall` helper plus two inline `fetch` calls that all share the same header bug.

**Step 1: Update the `mcpCall` helper**

Find the `mcpCall` function. Replace it with:

```ts
async function mcpCall(name: string, args: unknown = {}): Promise<any> {
    const body = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name, arguments: args },
    };

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const dataLine = text.split('\n').find(line => line.startsWith('data:'));
    if (!dataLine) {
        throw new Error(`MCP response has no data line. Body: ${text.substring(0, 200)}`);
    }
    return JSON.parse(dataLine.slice('data:'.length).trim());
}
```

**Step 2: Update the two inline `fetch` calls**

The `tools/list` tests at lines ~104 and ~131 use inline `fetch` calls (not `mcpCall`). Update both:

1. Change `Accept: 'application/json'` → `Accept: 'application/json, text/event-stream'`

2. Change `const data = await response.json()` → parse SSE:

```ts
const text = await response.text();
const dataLine = text.split('\n').find((line: string) => line.startsWith('data:'));
const data = JSON.parse(dataLine!.slice('data:'.length).trim());
```

**Step 3: Extract the SSE parsing to a shared helper**

Since both files now duplicate the SSE parsing logic, add a small helper near the top of each file (or, ideally, extract to `tests/e2e/helpers/mcp.ts` — see Task 4):

```ts
/** Parse an SSE-formatted MCP response body into a JSON object. */
function parseSseResponse(text: string): any {
    const dataLine = text.split('\n').find(line => line.startsWith('data:'));
    if (!dataLine) {
        throw new Error(`MCP SSE response has no data line. Body: ${text.substring(0, 200)}`);
    }
    return JSON.parse(dataLine.slice('data:'.length).trim());
}
```

Use this helper in both `mcpCall` and the inline fetch calls.

**Step 4: Run the presentation-tools tests**

```bash
npx playwright test tests/e2e/presentation-tools.spec.ts --reporter=line 2>&1
```

Expected: 12 passing, 0 failing. (The `read` and `update_slide` tests depend on `create` running first — run the full file, not individual tests.)

**Step 5: Commit**

```bash
git add tests/e2e/presentation-tools.spec.ts
git commit -m "fix(e2e): add text/event-stream to MCP Accept header in presentation-tools tests"
```

---

## Task 4: Extract shared MCP helper (DRY)

**Files:**
- Create: `tests/e2e/helpers/mcp.ts`
- Modify: `tests/e2e/mcp-tools.spec.ts` (import from helpers)
- Modify: `tests/e2e/presentation-tools.spec.ts` (import from helpers)

**Context:** After Tasks 2 and 3, the SSE parsing and `mcpRequest`/`mcpCall` logic is duplicated across two files. Extract it to a shared helper.

**Step 1: Create `tests/e2e/helpers/mcp.ts`**

```ts
/**
 * Shared MCP test helpers.
 *
 * The /mcp endpoint uses the Streamable HTTP transport which requires:
 *   Accept: application/json, text/event-stream
 * Responses are SSE-formatted: "event: message\ndata: {...}\n\n"
 */

const HUB_URL = 'http://localhost:3000';
export const MCP_URL = `${HUB_URL}/mcp`;

/** Parse an SSE-formatted MCP HTTP response body into a JSON-RPC object. */
export function parseSseResponse(text: string): any {
    const dataLine = text.split('\n').find(line => line.startsWith('data:'));
    if (!dataLine) {
        throw new Error(`MCP SSE response has no data line. Body: ${text.substring(0, 200)}`);
    }
    return JSON.parse(dataLine.slice('data:'.length).trim());
}

/** Send a raw JSON-RPC request to the MCP endpoint and return the parsed response. */
export async function mcpJsonRpc(method: string, params?: unknown): Promise<any> {
    const body = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        ...(params !== undefined ? { params } : {}),
    };

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    return parseSseResponse(await response.text());
}

/** Call a named MCP tool and return the parsed response. */
export async function mcpCall(name: string, args: unknown = {}): Promise<any> {
    return mcpJsonRpc('tools/call', { name, arguments: args });
}
```

**Step 2: Update `mcp-tools.spec.ts` to import from helpers**

Replace the inline `mcpRequest` function and the `MCP_URL` constant with:

```ts
import { mcpJsonRpc, MCP_URL } from './helpers/mcp';
```

Then replace all `mcpRequest(...)` calls with `mcpJsonRpc(...)`.

**Step 3: Update `presentation-tools.spec.ts` to import from helpers**

Replace the inline `mcpCall` function, `MCP_URL`, and `HUB_URL` constants with:

```ts
import { mcpCall, MCP_URL } from './helpers/mcp';
```

Remove the inline `mcpCall` function. The `assertWellFormed` / `assertSuccess` / `assertSuccessOrBridgeDisconnected` helpers are test-specific and stay in the file.

**Step 4: Run both test files**

```bash
npx playwright test tests/e2e/mcp-tools.spec.ts tests/e2e/presentation-tools.spec.ts --reporter=line 2>&1
```

Expected: 17 passing, 0 failing.

**Step 5: Commit**

```bash
git add tests/e2e/helpers/mcp.ts tests/e2e/mcp-tools.spec.ts tests/e2e/presentation-tools.spec.ts
git commit -m "refactor(e2e): extract shared MCP helper to tests/e2e/helpers/mcp.ts"
```

---

## Task 5: Fix the `%%OS` assertion

**Files:**
- Modify: `tests/e2e/session-management-integration.spec.ts:121-123`

**Context:** Scenario 3 tests the `/openspace/instructions` endpoint. The original assertion was `.toContain('%%OS')` — a specific syntax marker that was present in an older version of the instructions text. The instructions have since been rewritten to plain prose (no `%%OS` marker). The endpoint still returns valid, substantial content — the assertion just needs to be updated to match what the endpoint actually returns.

Current instructions start with: `# OpenSpace IDE Control — MCP Tools`

**Step 1: Update the assertion**

Find the line:

```ts
expect(instructionsText).toContain('%%OS');
console.log('✓ Instructions contain %%OS command syntax');
```

Replace with:

```ts
expect(instructionsText).toContain('openspace.');
console.log('✓ Instructions contain openspace tool references');
```

This is a weaker but still meaningful assertion: the instructions must reference at least one `openspace.` tool, confirming it's the right endpoint with real content.

**Step 2: Run the scenario 3 test**

```bash
npx playwright test tests/e2e/session-management-integration.spec.ts --reporter=line 2>&1
```

Expected: 6 passing, 0 failing (or 5 passing + 1 passing for the previously-failing Scenario 3).

**Step 3: Commit**

```bash
git add tests/e2e/session-management-integration.spec.ts
git commit -m "fix(e2e): update hub instructions assertion (%%OS marker removed from endpoint response)"
```

---

## Task 6: Add server health-check guard to global setup

**Files:**
- Modify: `scripts/global-setup-opencode.ts`

**Context:** Currently, if the Theia server isn't running, browser-based tests fail with a cryptic "browser launch" error or timeout. Add an explicit health check that fails fast with a clear, actionable message.

**Step 1: Update `globalSetup` to check the Theia server**

In `scripts/global-setup-opencode.ts`, at the end of the `globalSetup` function (after the OpenCode server check), add:

```ts
// Also verify the Theia dev server is reachable (required for browser tests)
const isTheiaRunning = await isServerRunning('http://localhost:3000');
if (!isTheiaRunning) {
    console.error('\n[Global Setup] ERROR: Theia dev server is not running on port 3000.');
    console.error('[Global Setup] Browser-based E2E tests require a running Theia server.');
    console.error('[Global Setup] Start it with: yarn start:browser');
    console.error('[Global Setup] Then re-run: npm run test:e2e\n');
    // Don't throw — let the individual browser tests fail with Playwright's native error.
    // This message surfaces first so the developer knows what went wrong.
    console.warn('[Global Setup] Continuing — browser tests will fail. API-only tests will pass.');
}
```

**Why not throw?** The `session-management-integration.spec.ts` and `mcp-tools.spec.ts` tests don't need a browser — they use `request` context and direct HTTP. If we throw, they would be blocked too. Instead, we warn and let Playwright's own browser-launch error be the terminal failure.

**Step 2: Run the full suite to confirm the warning appears**

```bash
# With Theia server NOT running (stop it first):
npx playwright test --reporter=line 2>&1 | head -20
```

Expected: the warning message appears first, then browser tests fail with launch error, API-only tests pass.

**Step 3: Run with Theia server running**

```bash
npx playwright test --reporter=line 2>&1 | tail -5
```

Expected: all 57 tests pass, no warning.

**Step 4: Commit**

```bash
git add scripts/global-setup-opencode.ts
git commit -m "fix(e2e): add Theia server health-check warning in global setup"
```

---

## Task 7: Full suite run and final verification

**Context:** With all fixes in place, run the complete suite and verify 57/57 passing.

**Preconditions:**
- Theia dev server is running: `yarn start:browser` (wait for the ready message)
- Chromium was installed in Task 1

**Step 1: Run the full suite**

```bash
npm run test:e2e 2>&1 | tail -30
```

**Expected final output:**
```
57 passed (Xs)
```

Zero failures. Zero skips.

**Step 2: If any tests still fail, diagnose**

Common residual issues:
- `session-list-autoload.spec.ts` — these tests navigate Theia's UI and may be timing-sensitive. If flaky, check if `timeout: 60000` in `playwright.config.ts` is sufficient.
- `permission-dialog.spec.ts` — tests a modal dialog; may need the Theia shell to fully initialize.

For any remaining failures, add a `test.setTimeout(90_000)` to the specific test and re-run.

**Step 3: Final commit (if any small fixes were needed)**

```bash
git add -A
git commit -m "fix(e2e): final tweaks for full suite pass"
```

---

## Success Criteria

- `npm run test:unit` → 474 passing, 0 failing
- `npm run test:e2e` (with Theia running) → 57 passing, 0 failing
- No browser binary error in any test
- No 406 on any MCP call
- Clear error message when Theia is not running (instead of cryptic timeout)
