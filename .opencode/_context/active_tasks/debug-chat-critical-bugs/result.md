# Debug Chat Critical Bugs — Result

**Task:** Fix 8 critical bugs making the chat system non-functional with a real opencode server.  
**Status:** COMPLETE  
**Builder:** builder_7e3f  
**Date:** 2026-02-18  

## Summary

All 8 bugs fixed. Build passes with 0 errors. All 412 unit tests pass. All 35 E2E tests pass (1 skipped, pre-existing).

## Bugs Fixed (in priority order)

### Bug #2: SessionServiceWiring — COMPLETE
- **File:** `extensions/openspace-core/src/browser/bridge-contribution.ts`
- **Fix:** Added `@inject(OpenCodeSyncService)` and `@inject(SessionService)` to `BridgeContribution`. Added `this.syncService.setSessionService(this.sessionService)` in `onStart()` to wire the lazy dependency.

### Bug #5: Project Type Mismatch — COMPLETE
- **Files:** `extensions/openspace-core/src/common/opencode-protocol.ts`, `extensions/openspace-core/src/browser/session-service.ts`, `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`
- **Fix:** Changed `Project` type to `SDKTypes.Project` (uses `worktree` instead of `name`/`path`). Updated all references: `project.name` → `project.worktree`, `project.path` → `project.worktree`. Updated test mocks to match SDK type shape. Added `connectToProject` stub to test mock.

### Bug #1: SSE Connection — COMPLETE
- **Files:** `extensions/openspace-core/src/common/opencode-protocol.ts`, `extensions/openspace-core/src/node/opencode-proxy.ts`, `extensions/openspace-core/src/browser/session-service.ts`
- **Fix:** Added `connectToProject(directory: string): Promise<void>` to `OpenCodeService` interface. Changed SSE endpoint from `/session/:id/events` to `/event?directory=...`. Replaced `currentProjectId`/`currentSessionId` state with `currentDirectory`. Added `connectToProject` call in `setActiveProject()`.

### Bugs #3+#4: SSE Event Parsing — COMPLETE
- **File:** `extensions/openspace-core/src/node/opencode-proxy.ts`
- **Fix:** Removed wrong `session-protocol.ts` type imports. Added `import * as SDKTypes from '../common/opencode-sdk-types'`. Completely rewrote `handleSSEEvent()` to parse `GlobalEvent { directory, payload: Event }` and route by `payload.type` prefix. Rewrote all four `forward*Event()` methods to correctly map SDK event types to our notification types. Re-added `extractAgentCommands()` private method for stream interception. Removed unused `ParsedBlock` import.

### Bug #8: Message Send API Shape — COMPLETE
- **File:** `extensions/openspace-core/src/node/opencode-proxy.ts`
- **Fix:** Changed `createMessage()` from spreading `Partial<Message>` (which could include SDK fields like `id`, `sessionID`, `role`, `time`) to explicitly building `{ parts, model? }` body. Only the fields the API expects are sent.

### Bug #7: Streaming Delta Accumulation — COMPLETE
- **Files:** `extensions/openspace-core/src/common/opencode-protocol.ts`, `extensions/openspace-core/src/browser/opencode-sync-service.ts`
- **Fix:** Added `delta?: string` field to `MessageNotification` interface. Updated `handleMessagePartial()` to prefer `event.delta` (set by proxy from `message.part.updated` events) over extracting text from parts. Added auto-initialization of streaming tracker for out-of-order events.

### Bug #6: Only Plain Text Rendered — COMPLETE
- **Files:** `extensions/openspace-chat/src/browser/message-bubble.tsx`, `extensions/openspace-chat/src/browser/style/chat-widget.css`
- **Fix:** Rewrote `MessageBubble` to render all SDK Part types:
  - **text**: pre-wrap text rendering
  - **tool**: collapsible `<details>` block with tool name, input, output
  - **reasoning**: italic/dimmed block with "Thinking" label
  - **step-start/step-finish**: progress indicator badges
  - **file**: file path reference with icon
  - **all others**: small info badge showing part type (never silently dropped)
- Added CSS styles for all new part types using Theia CSS variables.

### Bug #9: Session List Race Condition — ALREADY FIXED
- **File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`
- **Status:** Already had the subscription to `sessionService.onActiveProjectChanged()` → `loadSessions()` at line 322-325. No additional changes needed.

## Verification

| Check | Result |
|---|---|
| `yarn build` | 0 errors, completed in 28.7s |
| `yarn test:unit` | 412 passing (358ms) |
| `yarn test` (E2E) | 35 passed, 1 skipped (40.8s) |
| TypeScript (openspace-core) | 0 errors |
| TypeScript (openspace-chat) | 0 errors |

## Files Modified

| File | Bugs |
|---|---|
| `extensions/openspace-core/src/browser/bridge-contribution.ts` | #2 |
| `extensions/openspace-core/src/common/opencode-protocol.ts` | #5, #1, #7 |
| `extensions/openspace-core/src/browser/session-service.ts` | #5, #1 |
| `extensions/openspace-core/src/node/opencode-proxy.ts` | #1, #3, #4, #8 |
| `extensions/openspace-core/src/browser/opencode-sync-service.ts` | #7 |
| `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts` | #5 (test fix) |
| `extensions/openspace-chat/src/browser/message-bubble.tsx` | #6 |
| `extensions/openspace-chat/src/browser/style/chat-widget.css` | #6 |
