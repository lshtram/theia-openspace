---
id: CONTRACT-DEBUG-CHAT-CRITICAL
author: oracle_a7f3
status: DRAFT
date: 2026-02-18
task_id: debug-chat-critical-bugs
---

# Builder Contract: Fix 8 Critical Chat Bugs

## Context
The chat system has 8 critical bugs that make it non-functional when connected to a real opencode server. All 412 unit tests and 21 E2E tests pass, but the system is broken end-to-end. Root cause analysis is complete for all bugs.

## Working Directory
`/Users/Shared/dev/theia-openspace`

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.** (Exception: when a test already covers the change OR the change is purely a type/wiring fix that existing tests validate.)

## Bug Fixes Required

### Bug #2: SessionServiceWiring DI Binding Never Resolved (HIGHEST PRIORITY — fix first)

**Root Cause:** In `openspace-core-frontend-module.ts` (line 59-69), `SessionServiceWiring` is bound via `toDynamicValue` + `queueMicrotask`, but **nothing ever calls `container.get(SessionServiceWiring)`**. The factory function never executes, so `OpenCodeSyncServiceImpl._sessionService` is always `undefined`, and ALL RPC callbacks throw "SessionService not initialized".

**Fix:** In `bridge-contribution.ts`, have the `BridgeContribution.onStart()` method resolve `SessionServiceWiring` from the container. Add `@inject(SessionServiceWiring) protected readonly _wiring: unknown;` as a field injection. This forces the container to evaluate the dynamic binding on app start.

**Alternatively (if `@inject` doesn't work because the symbol is bound to `null`):** Have `BridgeContribution.onStart()` explicitly call:
```typescript
// Force SessionServiceWiring resolution
const container = ... // get container reference
container.get(SessionServiceWiring);
```

**The simplest approach:** Change the `SessionServiceWiring` binding to use `onActivation` or similar. OR: Move the wiring logic directly into `BridgeContribution.onStart()`:
```typescript
// In BridgeContribution.onStart():
const syncService = /* injected */ OpenCodeSyncService as OpenCodeSyncServiceImpl;
const sessionService = /* injected */ SessionService;
syncService.setSessionService(sessionService);
```

**Files:** `openspace-core/src/browser/bridge-contribution.ts`, `openspace-core/src/browser/openspace-core-frontend-module.ts`

### Bug #1: SSE Connection Never Started + Wrong Endpoint

**Root Cause:** `OpenCodeProxy.connectSSE()` exists (line 394) but nobody calls it. The SSE endpoint is wrong: proxy uses `/session/:id/events` but the opencode server uses `GET /event?directory=...` (global event stream per SDK `EventSubscribeParams`).

**Fix:**
1. Change `establishSSEConnection()` endpoint from `/session/${sessionId}/events` to `/event?directory=${encodeURIComponent(directory)}` where `directory` is the project's `worktree` path.
2. Change `connectSSE(projectId, sessionId)` signature to `connectSSE(directory: string)` — the SSE stream is project-scoped (by directory), not session-scoped.
3. Remove `currentSessionId` from SSE state — SSE is per-project/directory.
4. Auto-call `connectSSE()` when the `setClient()` method is called (or add a new RPC method `startSSE(directory: string)` that the frontend calls after setting the active project).
5. Have `SessionService.setActiveProject()` trigger SSE connection by calling the backend. Add a new RPC method to `OpenCodeService`: `connectToProject(directory: string): Promise<void>` that calls `this.connectSSE(directory)`.

**Files:** `openspace-core/src/node/opencode-proxy.ts`, `openspace-core/src/common/opencode-protocol.ts`, `openspace-core/src/browser/session-service.ts`

### Bug #3+#4: SSE Event Format Mismatch + Wrong Types

**Root Cause:** The SSE events from opencode server are wrapped in `GlobalEvent: { directory: string, payload: Event }`. The `Event` payload has a `type` field like `"session.updated"` and a `properties` object. But `handleSSEEvent()` treats the event's `event` field (SSE protocol) as the type, and `data` as the raw payload. Also `session-protocol.ts` types (`SessionEvent`, `MessageEvent`, etc.) have `sessionId`, `projectId`, `timestamp` fields that don't exist on the actual SDK events.

**Fix:**
1. In `establishSSEConnection()`, parse the SSE `data` field as `GlobalEvent`:
   ```typescript
   const globalEvent = JSON.parse(event.data) as SDKTypes.GlobalEvent;
   const innerEvent = globalEvent.payload;  // This is the actual Event
   const eventType = innerEvent.type;       // e.g., "session.updated"
   ```
2. Route based on `innerEvent.type` prefix: `session.*`, `message.*`, `file.*`, `permission.*`
3. Rewrite `forwardSessionEvent()` to extract data from `innerEvent.properties`:
   - `session.updated` → properties is `{ info: Session }` → forward as `SessionNotification { type: 'updated', sessionId: info.id, projectId: info.projectID, data: info }`
   - `session.created` → same pattern
   - `session.deleted` → same pattern
4. Rewrite `forwardMessageEvent()`:
   - `message.updated` → properties is `{ info: Message }` → forward as `MessageNotification { type: 'completed', ... }`
   - `message.part.updated` → properties is `{ part: Part, delta?: string }` → forward as `MessageNotification { type: 'partial', ... }` with the delta
   - `message.removed` → properties is `{ sessionID, messageID }` → log/ignore for now
5. Rewrite `forwardPermissionEvent()`:
   - `permission.updated` → properties is `Permission` → forward as `PermissionNotification { type: 'requested', ... }`
   - `permission.replied` → properties is `{ sessionID, permissionID, response }` → forward as `PermissionNotification { type: 'granted' or 'denied', ... }`
6. Rewrite `forwardFileEvent()`:
   - `file.edited` → properties is `{ file: string }` → forward as `FileNotification { type: 'changed', path: file }`
7. Remove or deprecate `session-protocol.ts` — its types are wrong. Use SDK types + Notification types from `opencode-protocol.ts` directly.

**IMPORTANT: The SSE stream uses raw JSON lines, NOT the standard SSE format with `event:` and `data:` prefixes.** Verify this by checking the actual opencode server behavior. If it IS standard SSE, the `eventsource-parser` handles it correctly and we just need to fix the data parsing. If it's raw JSON lines, we need a different parser.

Based on the SDK source (`EventSubscribeParams` → `GET /event`), it likely uses standard SSE format where each event's `data` is a JSON-encoded `GlobalEvent`.

**Files:** `openspace-core/src/node/opencode-proxy.ts`, `openspace-core/src/common/opencode-protocol.ts`, `openspace-core/src/common/session-protocol.ts`

### Bug #5: Project Type Mismatch

**Root Cause:** Local `Project` interface has `{ id, name, path }` but SDK `Project` has `{ id, worktree, vcsDir?, vcs?, time }`. The `name` and `path` fields don't exist on SDK Project.

**Fix:**
1. Update the `Project` interface in `opencode-protocol.ts` to match SDK:
   ```typescript
   export type Project = SDKTypes.Project;
   ```
   This gives us: `{ id, worktree, vcsDir?, vcs?, time }`
2. Update ALL references to `project.name` → use `project.id` or derive name from `project.worktree` (e.g., last path segment)
3. Update ALL references to `project.path` → `project.worktree`
4. Update `autoSelectProjectByWorkspace()` in `session-service.ts` to use `project.worktree` directly (remove `(p as any).worktree || (p as any).path` hack)
5. Update `setActiveProject()` — line 247 references `project.name` which doesn't exist
6. Update `getAvailableModels()` if it uses `this._activeProject?.path`
7. In `opencode-proxy.ts` `getProjects()`, the REST API returns SDK Project objects — no mapping needed, just return them with correct type.

**Files:** `openspace-core/src/common/opencode-protocol.ts`, `openspace-core/src/browser/session-service.ts`, `openspace-core/src/node/opencode-proxy.ts`

### Bug #8: Message Send Uses Wrong API Shape

**Root Cause:** `SessionService.sendMessage()` constructs `{ parts: parts as any }` as the message body. But the opencode API `POST /session/{id}/message` expects `{ parts: Array<PartInput>, model?, agent?, system?, tools? }` at the top level. The `parts` from the chat UI are local `MessagePart` types (text/file/image) but SDK expects `TextPartInput | FilePartInput`.

**Fix:**
1. In `session-service.ts sendMessage()`, construct the message body properly:
   ```typescript
   const body = {
     parts: parts.map(convertToSDKPartInput),
     ...(model ? { model: { providerID: model.providerID, modelID: model.modelID } } : {})
   };
   ```
2. In `opencode-proxy.ts createMessage()`, pass the body directly to `POST /session/{sessionId}/message`
3. The `convertToSDKPartInput` function maps:
   - `{ type: 'text', text: '...' }` → `{ type: 'text', text: '...' }` (same!)
   - `{ type: 'file', path: '...' }` → `{ type: 'file', filename: '...' }` (SDK uses `filename` not `path` — VERIFY THIS from SDK types)
4. Verify the actual SDK input types: Check `MessageCreateParams` or similar in `opencode-sdk-types.ts`

**Files:** `openspace-core/src/browser/session-service.ts`, `openspace-core/src/node/opencode-proxy.ts`, `openspace-chat/src/browser/prompt-input/build-request-parts.ts`

### Bug #7: Streaming Delta Accumulation Broken

**Root Cause:** `SyncService.extractTextDelta()` (line 326) concatenates ALL text parts — not just the delta. The SDK sends `message.part.updated` with a `delta` field for incremental text, but the current code reads all parts instead of using the delta.

**Fix:**
1. When handling `message.part.updated` events, use the `delta` field directly:
   ```typescript
   // In the new event handler for message.part.updated:
   const { part, delta } = innerEvent.properties;
   if (delta) {
     // Use delta directly — it's the incremental text
     sessionService.updateStreamingMessage(part.messageID, delta, false);
   }
   ```
2. For `message.updated` events (full message update), replace the entire message — don't try to extract deltas.
3. Remove or modify `extractTextDelta()` — it's no longer needed if we use the `delta` field from the event.

**Files:** `openspace-core/src/browser/opencode-sync-service.ts`

### Bug #6: Only Plain Text Rendered

**Root Cause:** `MessageBubble` only handles `type === 'text'` parts via `extractTextFromParts()`. All 11 other part types are silently dropped. No markdown rendering.

**Fix (MVP — minimum viable for demo):**
1. Render text parts with basic markdown support (code blocks, bold, italic, links) using a simple regex-based renderer or raw HTML. **Do NOT add a heavy markdown library** — use a minimal approach.
2. Render `tool` parts as collapsible blocks showing tool name and input/output.
3. Render `reasoning` parts as italic/dimmed blocks (thinking indicator).
4. Render `step-start`/`step-finish` as progress indicators.
5. Render `file` parts as file path links.
6. All other parts (`agent`, `snapshot`, `patch`, `retry`, `compaction`, `subtask`): render as small info badges or hide them.

**Keep it simple — this is MVP. Just don't DROP the parts silently.**

**Files:** `openspace-chat/src/browser/message-bubble.tsx`, `openspace-chat/src/browser/style/chat-widget.css`

### Bug #9: Session List Race Condition

**Root Cause:** ChatWidget calls `loadSessions()` on mount before `SessionService.init()` finishes async project restoration. Sessions don't appear until manual refresh.

**Fix:** In `chat-widget.tsx`, subscribe to `SessionService.onActiveProjectChanged` and reload sessions when the project changes. The subscription may already partially exist — verify and ensure it triggers a full session reload.

**Files:** `openspace-chat/src/browser/chat-widget.tsx`

## Exit Criteria

1. **Build:** `yarn build` passes with 0 errors
2. **TypeScript:** 0 type errors
3. **Unit Tests:** All existing tests still pass (412+), no regressions
4. **Functional (manual verification):**
   - SSE connection establishes to `/event?directory=...` endpoint on project selection
   - SSE events are parsed as `GlobalEvent { directory, payload: Event }` format
   - RPC callbacks (`onSessionEvent`, `onMessageEvent`, etc.) fire correctly
   - Message sending constructs correct API body
   - Project type uses SDK fields (`worktree` not `path`)
   - Message bubble renders text + tool + reasoning parts
   - Session list loads correctly without race condition

## Priority Order
Fix in this order (each fix enables testing the next):
1. Bug #2 (SessionServiceWiring) — unblocks all RPC callbacks
2. Bug #5 (Project type) — unblocks project selection
3. Bug #1 (SSE connection) — unblocks event flow
4. Bug #3+#4 (Event format) — unblocks event processing
5. Bug #8 (Message send) — unblocks user→server messaging
6. Bug #7 (Streaming delta) — unblocks streaming UI
7. Bug #6 (Message rendering) — unblocks readable output
8. Bug #9 (Session list race) — unblocks startup UX

## Test Strategy
- Existing unit tests MUST continue passing
- Add/update unit tests for:
  - SSE event parsing (GlobalEvent format)
  - Project type compatibility
  - Message send body construction
  - MessageBubble rendering different part types
- After all fixes, run `yarn build` and verify 0 errors
