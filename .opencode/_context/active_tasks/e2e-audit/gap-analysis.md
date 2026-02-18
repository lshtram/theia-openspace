---
id: E2E-GAP-ANALYSIS
author: oracle_e3f7
date: 2026-02-18
status: COMPLETE
---

# E2E Test Gap Analysis — Theia Openspace

## Executive Summary

**All 5 existing E2E spec files are essentially fake.** They pass reliably but verify almost nothing about the actual application. The core problem: the test suite was written with `page.route()` browser-level mocks, but the architecture uses **backend-side RPC** (Frontend → JSON-RPC WebSocket → Node.js → HTTP → OpenCode). Browser mocks cannot intercept server-side HTTP calls.

**Result:** 35 of 36 E2E tests pass, but ~30 of them test either:
- JavaScript constants (`typeof window !== 'undefined'`)
- Regex patterns written *inside the test file* — not production code
- HTTP status codes for static endpoints (no UI behavior)
- UI empty states that are visible even when the app is broken

---

## Infrastructure Gap (Root Cause)

**Architecture B1 data flow:**
```
Browser (Playwright) → JSON-RPC WebSocket → Node.js Backend → HTTP → OpenCode Server
```

**Why `page.route()` fails:**  
`page.route()` intercepts browser-originated XHR/fetch requests. Architecture B1 moves ALL business-logic HTTP calls to the Node.js backend. The browser never makes direct HTTP calls to OpenCode. Therefore:
- `page.route('**/projects/**/sessions', ...)` — **never fires** during normal app operation
- `page.route('**/hub/projects', ...)` — **never fires** (hub is same-origin, server-side)

**Correct E2E strategy:**
| Tier | Requires | Test type |
|------|----------|-----------|
| Tier 1 | Just Theia running | App loads, branding, UI structure, empty states |
| Tier 2 | Theia + real backend | `window.__openspace_test__` injection, Hub HTTP endpoints, command palette |
| Tier 3 | Theia + OpenCode server at `localhost:7890` | Full session CRUD, message send/receive, SSE streaming |

---

## Feature-by-Feature Gap Analysis

### Phase 0: Scaffold & Build

| Feature | WORKPLAN Task | Current Coverage | Quality | Gap |
|---------|--------------|-----------------|---------|-----|
| App loads without crash | 0.4 | `session-management-integration.spec.ts` Scenario 1 (HTTP GET /) | 🟡 Partial | Only checks HTTP 200, not actual Theia UI rendering |
| Window title "Theia Openspace" | 0.6 | `session-management.spec.ts` Scenario 1 (checks `page.title()`) | 🟡 Partial | `expect(title).toBeTruthy()` — passes even if title is "undefined" |
| Chat panel visible | 0.7 | None | ❌ None | No test verifies chat widget is actually visible |
| Debug/SCM/Notebook removed | 0.5 | None | ❌ None | No test verifies filtered panels are absent |
| `bundle.js` served | 0.8 | `session-management-integration.spec.ts` Scenario 1 | 🟡 Partial | Checks HTTP 200 for bundle.js only |

### Phase 1: Core Connection + Hub

| Feature | WORKPLAN Task | Current Coverage | Quality | Gap |
|---------|--------------|-----------------|---------|-----|
| RPC round-trip verified | 1.2, 1.3 | None | ❌ None | No test for backend↔frontend RPC |
| SSE connection established | 1.3 | None | ❌ None | Critical — this was the source of the 9 critical bugs |
| Hub manifest endpoint | 1.7 | `session-management-integration.spec.ts` Scenario 2 | 🟡 Partial | HTTP 200 only, no manifest content verification |
| Hub instructions endpoint | 1.5, 1.12 | `session-management-integration.spec.ts` Scenario 3 | 🟡 Partial | HTTP 200 only, no instruction content verification |
| Session create | 1.11 | `session-management.spec.ts` Scenario 2 | ❌ Fake | Mocks wrong endpoint, clicks button but can't verify server state |
| Session list | 1.11 | `session-management.spec.ts` Scenario 4 | ❌ Fake | Checks `.session-selector` visible — trivially passes even if broken |
| Session switch | 1.11 | None | ❌ None | — |
| Session delete | 1.11 | `session-management.spec.ts` Scenario 5 | ❌ Fake | Just checks button visibility — not that delete actually works |
| Send message → response streams | 1.10, 1.13 | None | ❌ None | Zero coverage of actual message flow |
| Permission dialog shows | 1.14 | `permission-dialog.spec.ts` E2E-1 through E2E-8 | ✅ Real | 8 tests use `window.__openspace_test__` injection correctly |
| Model/provider display | 1.15 | None | ❌ None | No test verifies provider badge appears |

**Critical Note:** The 9 critical bugs fixed in the previous session (SSE connection, DI wiring, event parsing, type mismatches, MessageBubble rendering, delta accumulation, send body format) have **zero E2E test coverage**. They were fixed but no regression tests were added.

### Phase 1B1: Architecture Refactoring

| Feature | WORKPLAN Task | Current Coverage | Quality | Gap |
|---------|--------------|-----------------|---------|-----|
| `@Openspace` mention routes to ChatAgent | 1B1.1 | None | ❌ None | — |
| `onAgentCommand` RPC callback | 1B1.2 | `agent-control.spec.ts` T1–T5 | ❌ Fake | `typeof window !== 'undefined'` — always true |
| Stream interceptor strips `%%OS{...}%%` | 1B1.3 | `agent-control.spec.ts` T6, T8, T9 | ❌ Fake | Tests regex patterns *written in the test file*, not production code |
| Malformed JSON discarded | 1B1.3 | `agent-control.spec.ts` T7 | ❌ Fake | Tests a try/catch written *in the test file* |
| SyncService dispatches commands | 1B1.4 | None | ❌ None | — |
| Hub simplified (3 endpoints only) | 1B1.5 | Partial | 🟡 Partial | Integration test checks endpoints exist, not simplification |
| Chunk-boundary splitting | 1B1.3 | `agent-control.spec.ts` T8 | ❌ Fake | Tests string concatenation in test file, not production interceptor |

### Phase 2: Chat & Prompt System

| Feature | WORKPLAN Task | Current Coverage | Quality | Gap |
|---------|--------------|-----------------|---------|-----|
| Session list auto-loads on widget open | 2.0 | `session-list-autoload.spec.ts` Test 4 | 🟡 Partial | Only tests empty state — not the actual race condition fix |
| Multi-part prompt (text + file + @mention) | 2.2 | None | ❌ None | — |
| Message streaming display | 2.3 | None | ❌ None | — |
| Auto-scroll behavior | 2.3 | None | ❌ None | — |
| Session sidebar | 2.7 | None | ❌ None | — |

### Phase 3: Agent IDE Control

| Feature | WORKPLAN Task | Current Coverage | Quality | Gap |
|---------|--------------|-----------------|---------|-----|
| `openspace.editor.open` command works | 3.3 | `agent-control.spec.ts` T1 | ❌ Fake | Dispatches `window.dispatchEvent` (custom event, not real RPC), checks `return true` |
| `openspace.terminal.create` command works | 3.4 | `agent-control.spec.ts` T3 | ❌ Fake | `typeof window !== 'undefined'` |
| `openspace.pane.open` command works | 3.2 | `agent-control.spec.ts` T5 | ❌ Fake | `typeof window !== 'undefined'` |
| Security: path traversal blocked | 3.5 | `agent-control.spec.ts` T11 | ❌ Fake | Tests regex written IN THE TEST FILE |
| Security: sensitive files blocked | 3.5 | `agent-control.spec.ts` T12 | ❌ Fake | Tests regex written IN THE TEST FILE |
| Commands appear in system prompt | 3.7, 3.8 | `session-management-integration.spec.ts` Scenario 3 | 🟡 Partial | Checks HTTP 200, no content verification |
| Full agent control pipeline | 3.9 | `agent-control.spec.ts` Full Pipeline | ❌ Fake | `expect(theiaReady || hasChatInterface).toBe(true)` — trivially true |

### Phase 4: Modality Surfaces

| Feature | WORKPLAN Task | Current Coverage | Quality | Gap |
|---------|--------------|-----------------|---------|-----|
| `.deck.md` opens as presentation | 4.2 | None | ❌ None | — |
| Presentation navigation (arrows) | 4.1 | None | ❌ None | — |
| `.whiteboard.json` opens as whiteboard | 4.5 | None | ❌ None | — |
| Whiteboard drawing | 4.4 | None | ❌ None | — |

---

## Test File Assessment

### `permission-dialog.spec.ts` ✅ REAL (Keep, Enhance)
- **8 tests** using `window.__openspace_test__.injectPermissionEvent()`
- Tests real dialog show/hide, grant/deny, queue ordering, keyboard shortcuts, timeout
- **Action:** Keep as-is. Add test for concurrent permission + session switch.

### `session-list-autoload.spec.ts` 🟡 PARTIAL (Fix Test 4)
- **Test 4:** Checks empty state UI renders — legitimate but narrow
- **Test 5:** Skipped (memory leak — requires manual profiling)
- **Action:** Expand Test 4 to also verify loading state and error state. Add Test 6 for "sessions appear after project loads" (the actual race condition regression test).

### `session-management-integration.spec.ts` 🟡 PARTIAL (Enhance)
- **Scenarios 1–7:** HTTP integration tests — check status codes
- **Good:** Tests that server endpoints exist and respond
- **Bad:** No content verification, no UI behavior
- **Action:** Add content assertions. Verify instructions contain command inventory. Verify manifest structure.

### `session-management.spec.ts` ❌ FAKE (Rewrite)
- **All 6 tests:** Use wrong mock endpoints (`**/hub/projects`), check trivially-passing conditions
- **Root cause:** Written for Architecture C (browser HTTP), but Architecture B1 uses Node.js RPC
- **Action:** Rewrite using real Theia app. Tier 1 tests (no backend needed) verify UI structure. Tier 3 tests (with OpenCode at `localhost:7890`) verify actual session CRUD.

### `agent-control.spec.ts` ❌ FAKE (Rewrite)
- **T1–T5:** `typeof window !== 'undefined'` — always true
- **T6, T9, T10, T11, T12:** Test regex/string patterns written in test file — not production code
- **T7:** Tests try/catch written in test file
- **T8:** Tests string concatenation in test file
- **Action:** Delete all tests. Rewrite from scratch. Use `window.__openspace_test__` hooks to inject agent commands and verify the actual CommandRegistry executes them.

---

## Recommended Test Architecture

### Tier 1: Static / UI Structure (No Backend Required)
These run against `http://localhost:3000` with no mocking needed.

```typescript
// app-load.spec.ts
test('App loads and shows Theia shell', ...)
test('Window title is "Theia Openspace"', ...)
test('Chat widget is accessible from sidebar', ...)
test('Debug/SCM/Notebook panels are hidden', ...)
test('Hub manifest endpoint returns 200', ...)
test('Hub instructions endpoint returns 200', ...)
```

### Tier 2: Test Hooks (Requires Theia, No OpenCode)
These use `window.__openspace_test__` to inject events.

```typescript
// permission-dialog.spec.ts (already exists and works ✅)
// session-state.spec.ts
test('Empty state shows when no sessions', ...)
test('Loading state shows during session fetch', ...)
test('Error state shows with retry button on RPC failure', ...)

// agent-commands.spec.ts
test('openspace.editor.open executes in CommandRegistry', ...)
test('openspace.terminal.create executes in CommandRegistry', ...)
test('Path traversal blocked in production file-command-contribution.ts', ...)
test('Sensitive file blocked in production file-command-contribution.ts', ...)
```

### Tier 3: Full Stack (Requires Theia + OpenCode at localhost:7890)
These use the real OpenCode server (already set up in `global-setup.ts`).

```typescript
// session-crud.spec.ts
test('Can create a new session', ...)
test('Sessions appear in list after creation', ...)
test('Can switch between sessions', ...)
test('Can delete a session', ...)

// message-flow.spec.ts
test('Can send a message and receive streaming response', ...)
test('SSE events update chat widget in real time', ...)

// stream-interceptor.spec.ts
test('%%OS{...}%% blocks stripped from chat display', ...)
test('Agent command dispatched to CommandRegistry via RPC', ...)
```

---

## Priority Order for Implementation

1. **HIGH — Tier 1 smoke tests** (`app-load.spec.ts`): Verifies basic app health. Quick to write, high value.
2. **HIGH — Tier 2 agent command tests** (`agent-commands.spec.ts`): Replaces 13 fake tests with real ones using `window.__openspace_test__`.
3. **HIGH — Tier 3 session CRUD tests** (`session-crud.spec.ts`): The original `session-management.spec.ts` intent, now done correctly.
4. **MEDIUM — Tier 3 message flow tests** (`message-flow.spec.ts`): Regression coverage for the 9 critical bugs just fixed.
5. **MEDIUM — Hub content verification** (enhance `session-management-integration.spec.ts`): Add content assertions to existing status-code tests.
6. **LOW — Modality tests** (Phase 4): Presentation and whiteboard E2E tests.

---

## Files to Create / Modify

| Action | File | Priority |
|--------|------|----------|
| ✏️ Rewrite | `tests/e2e/session-management.spec.ts` | HIGH |
| ✏️ Rewrite | `tests/e2e/agent-control.spec.ts` | HIGH |
| ➕ Create | `tests/e2e/app-load.spec.ts` | HIGH |
| ✏️ Enhance | `tests/e2e/session-list-autoload.spec.ts` | MEDIUM |
| ✏️ Enhance | `tests/e2e/session-management-integration.spec.ts` | MEDIUM |
| ✅ Keep | `tests/e2e/permission-dialog.spec.ts` | — |
| ✅ Keep | `tests/e2e/global-setup.ts` | — |
| ✅ Keep | `tests/e2e/helpers/` | — |

---

## Notes on `window.__openspace_test__` Test Hooks

The permission dialog already uses `window.__openspace_test__.injectPermissionEvent()`. This pattern should be extended to support agent command testing. The test hook must:
1. Expose `window.__openspace_test__.injectAgentCommand(cmd, args)` — calls SyncService.onAgentCommand directly
2. Expose `window.__openspace_test__.getLastCommandResult()` — returns the last command dispatch result
3. Only exposed when `process.env.NODE_ENV === 'test'` (already enforced for permission dialog)

**Important:** Phase 1C item T1-C.1 flagged removing test hooks from production. The correct approach is NOT to remove them, but to gate them behind a build-time flag (already done). Keep the `window.__openspace_test__` pattern — it's the correct architecture for testability.
