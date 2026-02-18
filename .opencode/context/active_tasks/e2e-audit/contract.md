---
id: TASK-E2E-REWRITE
author: oracle_e3f7
date: 2026-02-18
status: OPEN
assignee: Builder
---

# Builder Contract: E2E Test Suite Rewrite

## Context

The existing E2E test suite for `theia-openspace` is essentially fake — 30 of 36 tests verify tautological JS conditions or regex patterns written *inside the test file*, not production code. This contract directs a complete rewrite using real application behavior.

**Working directory:** `/Users/Shared/dev/theia-openspace`

**Full gap analysis:** `.opencode/context/active_tasks/e2e-audit/gap-analysis.md`

**Root cause of fake tests:** `page.route()` browser-mocks cannot intercept Architecture B1's backend-side RPC calls. The browser never makes direct HTTP calls to OpenCode.

**Gold standard pattern:** `tests/e2e/permission-dialog.spec.ts` — uses `window.__openspace_test__.injectPermissionEvent()`. Replicate this pattern everywhere.

---

## Architecture Reference

```
Browser (Playwright) → JSON-RPC WebSocket → Node.js Backend → HTTP → OpenCode Server (localhost:7890)
```

**Test Tiers:**
- **Tier 1** — Only Theia running at `localhost:3000`. Tests UI structure, static elements.
- **Tier 2** — Theia running. Uses `window.__openspace_test__` injection hooks. No OpenCode needed.
- **Tier 3** — Theia + OpenCode at `localhost:7890`. Real session CRUD, real message flow. Tests MUST use `test.skip()` if OpenCode is not reachable.

---

## Deliverables

### 1. NEW FILE: `tests/e2e/app-load.spec.ts` (Tier 1)

**Purpose:** Smoke tests — verify app loads correctly, core UI elements present, unwanted panels absent.

**Tests to implement (all Tier 1):**

```
test('App loads and Theia shell is visible')
  - navigate to http://localhost:3000
  - wait for .theia-preload to be hidden
  - wait for #theia-app-shell to be present
  - assert #theia-app-shell is visible

test('Window title is "Theia Openspace"')
  - navigate to http://localhost:3000
  - assert page.title() === 'Theia Openspace'  ← use strict equality, NOT just toBeTruthy()

test('Chat widget is accessible from sidebar')
  - navigate to http://localhost:3000
  - wait for Theia shell
  - assert element with class .openspace-chat-widget exists in DOM OR
    assert sidebar button with aria-label containing "Chat" is visible
  - (do NOT require the widget to be open, just accessible)

test('Hub manifest endpoint returns valid JSON')
  - HTTP GET http://localhost:3000/api/hub/manifest
  - assert response.status === 200
  - parse JSON, assert it has a 'commands' array (not just status 200)
  - assert commands.length > 0

test('Hub instructions endpoint returns non-empty string containing %%OS')
  - HTTP GET http://localhost:3000/api/hub/instructions
  - assert response.status === 200
  - assert response text includes '%%OS'  ← content verification, not just status
```

**Selector notes:**
- Theia preloader: `.theia-preload`
- App shell: `#theia-app-shell`
- Chat widget class: `.openspace-chat-widget` (from `ChatWidget` constructor: `this.addClass('openspace-chat-widget')`)
- Session header: `.session-header`
- Session dropdown button: `.session-dropdown-button`

---

### 2. REWRITE: `tests/e2e/session-management.spec.ts`

**Purpose:** Replace 6 fake tests with real Tier 1 + Tier 3 tests. Delete ALL existing tests.

**Tests to implement:**

**Tier 1 (always run):**
```
test('Session selector UI is present in chat widget')
  - navigate, wait for Theia
  - open chat widget (click sidebar tab if needed)
  - assert .session-selector is visible
  - assert .session-dropdown-button is visible

test('Empty state shows correct elements when no active session')
  - navigate, wait for Theia
  - open chat widget
  - assert .chat-no-session OR .chat-empty-state is present in DOM
    (note: may not be visible if a session is active — use existence check not visibility)
```

**Tier 3 (skip if OpenCode not available):**

```
// At top of file, add helper:
async function isOpenCodeAvailable(): Promise<boolean> {
  try {
    const resp = await fetch('http://localhost:7890/health');  // or any endpoint
    return resp.ok;
  } catch { return false; }
}

// Or use: read projectId from tests/e2e/.e2e-project-id — if file doesn't exist, skip Tier 3

test('Can create a new session')
  - skip if no OpenCode
  - open chat widget
  - click .new-session-button or button[aria-label="New session"]
  - wait for session to appear in dropdown
  - assert sessions dropdown has at least 1 entry (data-test-sessions-count >= 1)

test('Sessions list loads from server')
  - skip if no OpenCode
  - open chat widget  
  - wait for data-test-sessions-count attribute to be >= 0 (loaded, not loading state)
  - assert no error state visible (.session-load-error absent)

test('Can switch between sessions')
  - skip if no OpenCode (requires 2 sessions to exist)
  - depends on previous test creating sessions
  - click dropdown, select a different session from list
  - assert active session ID changes (read from data attribute or DOM)
```

**Important:** Use `test.skip(condition, 'reason')` or `test.fixme()` for Tier 3 when OpenCode unavailable — do NOT just comment them out.

---

### 3. REWRITE: `tests/e2e/agent-control.spec.ts`

**Purpose:** Replace 13 fake tests with real Tier 2 tests using `window.__openspace_test__` hooks. Delete ALL existing tests.

**First: Add test hooks to SyncService** (source file edit required)

In `extensions/openspace-core/src/browser/opencode-sync-service.ts`, inside the `setSessionService()` method (after wiring), add a test hook block analogous to `permission-dialog-contribution.ts`:

```typescript
// At the bottom of setSessionService():
if (typeof process !== 'undefined' && (process as any).env?.NODE_ENV !== 'production') {
    // Extend existing test API (permission dialog may have already set it)
    (window as any).__openspace_test__ = (window as any).__openspace_test__ || {};
    (window as any).__openspace_test__.triggerAgentCommand = (cmd: AgentCommand) => {
        this.processAgentCommand(cmd);
    };
    (window as any).__openspace_test__.getLastDispatchedCommand = () => {
        return this._lastDispatchedCommand || null;
    };
    console.debug('[SyncService] Test helpers exposed: triggerAgentCommand, getLastDispatchedCommand');
}
```

Also add `private _lastDispatchedCommand: AgentCommand | null = null;` field, and in `processAgentCommand()` method, set `this._lastDispatchedCommand = cmd;` before dispatching.

**Tests to implement:**

```
test('Stream interceptor: %%OS{...}%% block is NOT displayed in chat UI')
  - This is a Tier 2 test that requires Theia to be running with the chat widget open
  - The SyncService processMessageEvent strips %%OS{...}%% blocks before updating SessionService
  - Strategy: use window.__openspace_test__ to inject a fake message event that contains %%OS{...}%%
  - Then assert the rendered chat DOM does NOT contain '%%OS' text
  - NOTE: This test requires exposing a way to inject message events. 
    Add: window.__openspace_test__.injectMessageEvent(event: MessageNotification) → calls this.onMessageEvent(event)
  - Inject event: { type: 'part', sessionId: activeSessionId, messageId: 'test-msg', part: { type: 'text', text: 'Hello %%OS{"cmd":"test"}%% World' } }
  - Assert: chat renders 'Hello  World' (stripped) and NOT '%%OS'

test('Stream interceptor: plain text passes through unchanged')
  - Same mechanism as above
  - Inject text-only message event
  - Assert chat renders text exactly as sent

test('Security: path traversal is blocked by production file-command-contribution.ts')
  - Navigate to Theia, wait for Theia shell
  - Use window.__openspace_test__.triggerAgentCommand({ id: 'openspace.file.read', args: { path: '../../../etc/passwd' } })
  - The production FileCommandContribution.execute() should reject this
  - Assert: window.__openspace_test__.getLastDispatchedCommand() shows the command was attempted
  - Assert: no file content containing 'root:' appears in the page DOM
  - NOTE: This test verifies the PRODUCTION guard in file-command-contribution.ts,
    NOT a regex written in the test file.

test('Security: sensitive file is blocked by production file-command-contribution.ts')
  - Same as above with path: '/Users/opencode/.ssh/id_rsa' or '~/.ssh/id_rsa'
  - Assert: rejected / no content rendered

test('openspace.editor.open command dispatches to CommandRegistry')
  - Navigate, wait for Theia
  - Use window.__openspace_test__.triggerAgentCommand({ id: 'openspace.editor.open', args: { path: '/tmp/test.txt' } })
  - Assert: command was dispatched (no JS error thrown)
  - Assert: window.__openspace_test__.getLastDispatchedCommand().id === 'openspace.editor.open'
  - NOTE: The file may not open (test project doesn't have /tmp/test.txt) — that's OK.
    We only verify the CommandRegistry was invoked, not the side effect.
```

**CRITICAL NOTE on test hooks architecture:**
The `window.__openspace_test__` object is initialized by `PermissionDialogContribution.onStart()`. The SyncService hook MUST extend (not overwrite) it: `Object.assign((window as any).__openspace_test__, { ... })`. Do not set it to a new object.

---

### 4. ENHANCE: `tests/e2e/session-list-autoload.spec.ts`

**Keep Test 4** (empty state check). **Add:**

```
test('Loading state visible during session fetch')
  - Navigate, open chat widget quickly  
  - Assert .chat-loading or [data-loading="true"] exists in DOM OR
    button with disabled state visible (indicates fetch in progress)
  - This tests that loading state is shown before sessions arrive
  - May need to throttle network or run immediately after navigation before load completes

test('Session list renders after project initializes (race condition regression)')
  - Navigate, wait for FULL Theia initialization (wait for #theia-app-shell + 2s)
  - Open chat widget
  - Wait for data-test-sessions-count attribute to be present (up to 5s)
  - Assert no error state
  - NOTE: This is the regression test for the race condition fixed in session-service.ts
    where sessions loaded before widget was mounted were lost.
```

---

### 5. ENHANCE: `tests/e2e/session-management-integration.spec.ts`

**Keep all existing Scenarios 1–7**. Add content assertions to Scenarios 2 and 3:

```typescript
// In Scenario 2 (hub manifest), AFTER checking status 200, add:
const manifestJson = await manifestResponse.json();
expect(manifestJson).toHaveProperty('commands');
expect(Array.isArray(manifestJson.commands)).toBe(true);
expect(manifestJson.commands.length).toBeGreaterThan(0);
// Each command should have id and description
const firstCmd = manifestJson.commands[0];
expect(firstCmd).toHaveProperty('id');
expect(firstCmd).toHaveProperty('description');

// In Scenario 3 (hub instructions), AFTER checking status 200, add:
const instructionsText = await instructionsResponse.text();
expect(instructionsText.length).toBeGreaterThan(100); // non-trivial content
expect(instructionsText).toContain('%%OS'); // must contain OpenSpace command syntax
```

---

### 6. DO NOT MODIFY: `tests/e2e/permission-dialog.spec.ts`

This file is the gold standard. Do not change it.

---

### 7. DO NOT MODIFY: `tests/e2e/global-setup.ts`

Do not change global setup.

---

## Source File Changes Required

### `extensions/openspace-core/src/browser/opencode-sync-service.ts`

1. Add private field: `private _lastDispatchedCommand: AgentCommand | null = null;`
2. In `processAgentCommand()` (wherever it dispatches to CommandRegistry), add `this._lastDispatchedCommand = cmd;` before dispatch
3. In `setSessionService()`, after the existing subscription code, add the `window.__openspace_test__` extension block (dev-only, guarded by `!== 'production'`)
4. Add `injectMessageEvent` hook: exposes `this.onMessageEvent(event)` for testing

### Find `processAgentCommand` first — it may be named differently. Search the file for where `commandRegistry.executeCommand` is called.

---

## Success Criteria

After your changes, running `yarn test:e2e` (with Theia running at `localhost:3000`) MUST:

1. **`app-load.spec.ts`**: All 5 tests pass ✅
2. **`session-management.spec.ts`**: Tier 1 tests (≥2) pass. Tier 3 tests skip cleanly if no OpenCode. ✅
3. **`agent-control.spec.ts`**: Tests that use `window.__openspace_test__` hooks pass. Security tests pass against PRODUCTION code. ✅
4. **`session-list-autoload.spec.ts`**: Test 4 still passes. New tests pass or skip cleanly. ✅
5. **`session-management-integration.spec.ts`**: All existing tests pass + new content assertions pass. ✅
6. **`permission-dialog.spec.ts`**: Unchanged — all 8 tests still pass. ✅

**Zero regression from existing passing tests.**

---

## Build & Test Commands

```bash
# Build after source changes
yarn build

# Run E2E tests (requires Theia at localhost:3000)
yarn test:e2e

# Run just the new/modified specs
npx playwright test tests/e2e/app-load.spec.ts
npx playwright test tests/e2e/agent-control.spec.ts
npx playwright test tests/e2e/session-management.spec.ts
```

---

## Important Constraints

1. **DO NOT** use `page.route()` to mock OpenCode API calls — they will never fire (Architecture B1).
2. **DO NOT** write regex or logic *inside the test file* and test that — test PRODUCTION code.
3. **DO NOT** use `expect(typeof window !== 'undefined').toBe(true)` or equivalent tautologies.
4. **DO** use `window.__openspace_test__` injection for Tier 2 tests.
5. **DO** use `test.skip()` for Tier 3 tests when OpenCode is unavailable.
6. **DO** use strict assertions: `toBe('exact value')` not `toBeTruthy()`.
7. **FOLLOW** `docs/standards/CODING_STANDARDS.md`.
8. **RUN** `yarn build` before running E2E tests.
9. **REPORT** exact `yarn test:e2e` output as evidence.
