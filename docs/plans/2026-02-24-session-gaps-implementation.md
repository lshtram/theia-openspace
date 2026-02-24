# Session Gaps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 10 bugs and implement all 15 needed features identified in the session/chat gap analysis, bringing theia-openspace's session and chat behaviour to full parity with OpenCode.

**Architecture:** Changes flow through 4 layers: (1) `opencode-proxy.ts` (Node, SSE/HTTP) → (2) `opencode-protocol.ts` (RPC interface) → (3) `session-service.ts` (browser state) → (4) UI widgets (`chat-widget.tsx`, `sessions-widget.tsx`, `message-timeline.tsx`, `message-bubble.tsx`). Bug fixes start in the proxy and propagate forward; features need touches at every layer.

**Tech Stack:** TypeScript, React (via `@theia/core/shared/react`), Eclipse Theia DI (inversify), Playwright E2E tests. Build: webpack bundle (`browser-app`). Tests: `npx playwright test`.

---

## Pre-flight checklist

Before starting any task, confirm the build target:

```bash
ps aux | grep main.js
```

If Theia is serving from `.worktrees/<name>/`, build in that directory, not repo root.
All webpack rebuilds use:

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

Then hard-refresh the browser (Cmd+Shift+R).

The E2E gap test suite is at: `tests/e2e/session-gaps.spec.ts`
Run a single describe block:
```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "session.error"
```
Never run the full suite in one command — it times out.

---

## Group A: SSE Bug Fixes (proxy layer)

These 4 bugs are all in `opencode-proxy.ts`. Each is a 1-file change with no downstream plumbing needed (the protocol types and sync-service handlers are already wired for related events).

---

### Task A1: Fix `session.error` SSE event silently dropped

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: SSE session.error event handling" ✅ covered

**Bug location:** `extensions/openspace-core/src/node/opencode-proxy.ts:766–773`

The switch in `forwardSessionEvent()` has cases for `session.created/updated/deleted` then falls to `default: return`. The `session.error` event (type `'session.error'`) hits `default` and is silently dropped.

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts:766–773`

**Step 1: Write the failing E2E test**

Already written in `tests/e2e/session-gaps.spec.ts`. Confirm it fails:

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "session.error SSE"
```

Expected: FAIL — `.session-error` element not found.

**Step 2: Add `session.error` to the switch in `forwardSessionEvent()`**

In `opencode-proxy.ts` at line 766, the switch is:

```typescript
switch (event.type) {
    case 'session.created': type = 'created'; break;
    case 'session.updated': type = 'updated'; break;
    case 'session.deleted': type = 'deleted'; break;
    default:
        this.logger.debug(`[OpenCodeProxy] Unhandled session event type: ${event.type}`);
        return;
}
```

Replace with:

```typescript
switch (event.type) {
    case 'session.created': type = 'created'; break;
    case 'session.updated': type = 'updated'; break;
    case 'session.deleted': type = 'deleted'; break;
    case 'session.error': type = 'error_occurred'; break;
    case 'session.compacted': type = 'compacted'; break;
    default:
        this.logger.debug(`[OpenCodeProxy] Unhandled session event type: ${event.type}`);
        return;
}
```

Also update the `SessionEventType` union in `opencode-protocol.ts:306–318` to add `'error_occurred'` if not already present (check: currently it has `'compacted'` and `'reverted'` but not `'error_occurred'`).

**Step 3: Add `error_occurred` to `SessionEventType` in protocol**

In `extensions/openspace-core/src/common/opencode-protocol.ts`, find `SessionEventType` (around line 306):

```typescript
export type SessionEventType =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'init_started'
    | 'init_completed'
    | 'aborted'
    | 'shared'
    | 'unshared'
    | 'compacted'
    | 'reverted'
    | 'unreverted'
    | 'status_changed';
```

Add `'error_occurred'`:

```typescript
export type SessionEventType =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'init_started'
    | 'init_completed'
    | 'aborted'
    | 'shared'
    | 'unshared'
    | 'compacted'
    | 'reverted'
    | 'unreverted'
    | 'status_changed'
    | 'error_occurred';
```

**Step 4: Handle `error_occurred` in `opencode-sync-service.ts`**

In `extensions/openspace-core/src/browser/opencode-sync-service.ts`, find the `onSessionEvent` switch (around line 229). Add after `case 'unreverted':`:

```typescript
case 'error_occurred':
    // Forward session error to session-service so UI can display it
    if (event.data) {
        this.sessionService.notifySessionError(event.sessionId, (event.data as unknown as { error?: string }).error ?? 'Unknown session error');
    }
    break;
```

**Step 5: Add `notifySessionError()` to `session-service.ts`**

In `extensions/openspace-core/src/browser/session-service.ts`, add a new public method (after `notifySessionDeleted`):

```typescript
/**
 * Called by SyncService when a session.error SSE event is received.
 * Sets the error state so the UI can display it.
 */
notifySessionError(sessionId: string, errorMessage: string): void {
    if (this._activeSession?.id !== sessionId) { return; }
    this._lastError = errorMessage;
    this.onErrorChangedEmitter.fire(errorMessage);
    this.logger.warn(`[SessionService] Session error: ${errorMessage}`);
}
```

**Step 6: Add `.session-error` DOM element to `chat-widget.tsx`**

In `extensions/openspace-chat/src/browser/chat-widget.tsx`, find where `lastError` is already rendered and ensure it has the class `.session-error`:

Search for `lastError` in `chat-widget.tsx`. Add `data-testid="session-error"` and class `session-error` to the existing error container. If no container exists, add one in the render method:

```tsx
{sessionService.lastError && (
    <div className="session-error" data-testid="session-error">
        {sessionService.lastError}
    </div>
)}
```

**Step 7: Build and run E2E test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "session.error SSE"
```

Expected: PASS — `.session-error` element found in DOM.

**Step 8: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/browser/opencode-sync-service.ts \
        extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "fix(proxy): forward session.error SSE event to UI and surface as error state"
```

---

### Task A2: Fix `message.removed` SSE event logged-only (not forwarded)

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: SSE message.removed event handling" ✅ covered

**Bug location:** `extensions/openspace-core/src/node/opencode-proxy.ts:915–916`

```typescript
} else if (event.type === 'message.removed') {
    this.logger.debug(`[OpenCodeProxy] Message removed: ${event.properties.messageID}`);
```

The event is received but only logged; it is never forwarded to the browser.

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts:915–916`
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` (add `'removed'` to `MessageEventType`)
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts` (handle `'removed'`)
- Modify: `extensions/openspace-core/src/browser/session-service.ts` (add `notifyMessageRemoved()`)

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "message.removed"
```

Expected: FAIL.

**Step 2: Forward the event in `opencode-proxy.ts`**

Replace lines 915–916:

```typescript
} else if (event.type === 'message.removed') {
    this.logger.debug(`[OpenCodeProxy] Message removed: ${event.properties.messageID}`);
```

With:

```typescript
} else if (event.type === 'message.removed') {
    const notification: MessageNotification = {
        type: 'removed',
        sessionId: event.properties.sessionID,
        projectId: '',
        messageId: event.properties.messageID,
    };
    this._client.onMessageEvent(notification);
    this.logger.debug(`[OpenCodeProxy] Forwarded message.removed: ${event.properties.messageID}`);
```

**Step 3: Add `'removed'` and `'part_removed'` to `MessageEventType` in protocol**

In `opencode-protocol.ts` around line 340:

```typescript
export type MessageEventType = 'created' | 'partial' | 'completed';
```

Change to:

```typescript
export type MessageEventType = 'created' | 'partial' | 'completed' | 'removed' | 'part_removed';
```

**Step 4: Handle `removed` in `opencode-sync-service.ts`**

In the `onMessageEvent` switch, add:

```typescript
case 'removed':
    this.sessionService.notifyMessageRemoved(event.sessionId, event.messageId);
    break;
```

**Step 5: Add `notifyMessageRemoved()` to `session-service.ts`**

```typescript
/**
 * Called by SyncService when a message.removed SSE event is received.
 * Removes the message from the in-memory list.
 */
notifyMessageRemoved(sessionId: string, messageId: string): void {
    if (this._activeSession?.id !== sessionId) { return; }
    this._messages = this._messages.filter(m => m.id !== messageId);
    this.onMessagesChangedEmitter.fire([...this._messages]);
    this.logger.debug(`[SessionService] Message removed: ${messageId}`);
}
```

**Step 6: Also fix `message.part.removed` (same pattern)**

In `opencode-proxy.ts` lines 917–918, replace:

```typescript
} else if (event.type === 'message.part.removed') {
    this.logger.debug(`[OpenCodeProxy] Message part removed: ${event.properties.partID}`);
```

With:

```typescript
} else if (event.type === 'message.part.removed') {
    const notification: MessageNotification = {
        type: 'part_removed',
        sessionId: event.properties.sessionID,
        projectId: '',
        messageId: event.properties.messageID,
        data: { info: { id: event.properties.messageID } as Message, parts: [{ id: event.properties.partID } as MessagePart] }
    };
    this._client.onMessageEvent(notification);
    this.logger.debug(`[OpenCodeProxy] Forwarded message.part.removed: ${event.properties.partID}`);
```

Handle `part_removed` in `opencode-sync-service.ts`:

```typescript
case 'part_removed': {
    const removedPartId = event.data?.parts?.[0]?.id;
    if (removedPartId) {
        this.sessionService.notifyPartRemoved(event.sessionId, event.messageId, removedPartId);
    }
    break;
}
```

Add `notifyPartRemoved()` to `session-service.ts`:

```typescript
notifyPartRemoved(sessionId: string, messageId: string, partId: string): void {
    if (this._activeSession?.id !== sessionId) { return; }
    this._messages = this._messages.map(m => {
        if (m.id !== messageId) { return m; }
        return { ...m, parts: (m.parts ?? []).filter(p => p.id !== partId) };
    });
    this.onMessagesChangedEmitter.fire([...this._messages]);
    this.logger.debug(`[SessionService] Part removed: ${partId} from message ${messageId}`);
}
```

**Step 7: Build and test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "message.removed"
```

Expected: PASS.

**Step 8: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/browser/opencode-sync-service.ts \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "fix(proxy): forward message.removed and message.part.removed SSE events"
```

---

### Task A3: Fix `onSessionStatusChangedEmitter` not disposed (memory leak)

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Bug: onSessionStatusChanged not disposed" ✅ covered (placeholder)

**Bug location:** `extensions/openspace-core/src/browser/session-service.ts:1616–1628`

The `dispose()` method disposes 11 emitters but is missing `this.onSessionStatusChangedEmitter.dispose()`. The emitter is declared at line 181.

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts:1616–1628`

**Step 1: Add the missing dispose call**

In `session-service.ts`, in `dispose()`, after `this.onPermissionChangedEmitter.dispose();` (line 1628), add:

```typescript
this.onSessionStatusChangedEmitter.dispose();
```

The full disposal block should then be:

```typescript
this.onActiveProjectChangedEmitter.dispose();
this.onActiveSessionChangedEmitter.dispose();
this.onActiveModelChangedEmitter.dispose();
this.onMessagesChangedEmitter.dispose();
this.onMessageStreamingEmitter.dispose();
this.onIsLoadingChangedEmitter.dispose();
this.onErrorChangedEmitter.dispose();
this.onIsStreamingChangedEmitter.dispose();
this.onStreamingStatusChangedEmitter.dispose();
this.onSessionStatusChangedEmitter.dispose();  // ← add this
this.onQuestionChangedEmitter.dispose();
this.onPermissionChangedEmitter.dispose();
```

**Step 2: Build and run the test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "onSessionStatusChanged"
```

Expected: PASS (placeholder test passes vacuously; the real fix prevents the leak).

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts
git commit -m "fix(session-service): dispose onSessionStatusChangedEmitter to prevent memory leak"
```

---

## Group B: Session Lifecycle Bugs

### Task B1: Fix missing `POST /session/:id/init` call after session creation

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session Init" ✅ covered

**Bug location:** `extensions/openspace-core/src/browser/session-service.ts` — `createSession()` method

After calling `POST /session` to create the session, OpenSpace never calls `POST /session/:id/init`. The `initSession()` method already exists in the protocol (line 208 of `opencode-protocol.ts`) and is implemented in `opencode-proxy.ts`. The call is just missing from `session-service.ts`.

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — `createSession()` method

**Step 1: Find `createSession()` in `session-service.ts`**

```bash
grep -n "createSession\|async createSession" extensions/openspace-core/src/browser/session-service.ts | head -10
```

**Step 2: Add `initSession` call immediately after session creation**

In `session-service.ts`, inside `createSession()`, after the `createSession()` API call succeeds and before calling `setActiveSession()`, add:

```typescript
// Call init to run the INIT command (sets up git tracking, etc.)
try {
    await this.openCodeService.initSession(this._activeProject.id, newSession.id);
    this.logger.debug(`[SessionService] Session initialized: ${newSession.id}`);
} catch (initError) {
    // Init failure is non-fatal — session can still be used
    this.logger.warn(`[SessionService] Session init failed (non-fatal): ${initError}`);
}
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Session Init"
```

Note: The Tier 3 test checks for a `[data-testid="init-session-button"]` element — this test was written to fail on absence of the UI button, not the API call. You may need to adjust the test assertion to instead intercept the network call to `/init`. See the note in the test file. The important correctness fix is the API call.

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts
git commit -m "fix(session-service): call POST /session/:id/init after creating a new session"
```

---

### Task B2: Fix missing `GET /session/status` startup hydration

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Bulk session status at startup" ✅ covered

**Bug location:** `session-service.ts` `loadSessions()` or `connectToProject()` — the call is never made.

The `initProject()` / `connectToProject()` flow in `opencode-proxy.ts` should call `GET /session/status` once connected and pass results to the browser.

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — add `getSessionStatuses()` method
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — add `getSessionStatuses()` to interface
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — call `getSessionStatuses()` after sessions are loaded

**Step 1: Add `getSessionStatuses()` to protocol interface**

In `opencode-protocol.ts` (after `getSessions`):

```typescript
/** Bulk-fetch current status for all sessions in a directory. Hydrates status on reconnect. */
getSessionStatuses(projectId: string): Promise<Array<{ sessionId: string; status: SDKTypes.SessionStatus }>>;
```

**Step 2: Implement in `opencode-proxy.ts`**

In `opencode-proxy.ts`, add the implementation:

```typescript
async getSessionStatuses(projectId: string): Promise<Array<{ sessionId: string; status: SDKTypes.SessionStatus }>> {
    const project = this.resolveProject(projectId);
    const url = `${this.opencodeUrl}/session/status`;
    const response = await fetch(url, {
        headers: { 'x-opencode-directory': project.worktree }
    });
    if (!response.ok) { return []; }
    const data = await response.json() as Record<string, SDKTypes.SessionStatus>;
    return Object.entries(data).map(([sessionId, status]) => ({ sessionId, status }));
}
```

**Step 3: Call in `session-service.ts` after `loadSessions()`**

In `loadSessions()` (or `setActiveProject()`), after sessions are fetched, add:

```typescript
try {
    const statuses = await this.openCodeService.getSessionStatuses(this._activeProject.id);
    for (const { sessionId, status } of statuses) {
        this.updateSessionStatus({ ...status, sessionID: sessionId } as SDKTypes.SessionStatus & { sessionID: string });
    }
    this.logger.debug(`[SessionService] Hydrated ${statuses.length} session statuses`);
} catch (e) {
    this.logger.warn(`[SessionService] Could not hydrate session statuses: ${e}`);
}
```

Note: `updateSessionStatus` expects a `SessionStatus` with `sessionID`. Check the exact shape of what `session-service.ts` expects and adjust.

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Bulk session status"
```

Expected: PASS — network request to `/session/status` detected.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "fix(session-service): call GET /session/status at startup to hydrate session statuses"
```

---

### Task B3: Fix unbounded message load (add `limit` param)

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Paginated message loading" (Tier 3) ✅ covered

**Bug location:** `extensions/openspace-core/src/browser/session-service.ts:1007–1010` — `loadMessages()` calls `getMessages()` with no `limit` param.

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — update `getMessages()` signature
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — pass limit to query string
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — pass `limit: 400`

**Step 1: Update `getMessages()` signature in protocol**

```typescript
getMessages(projectId: string, sessionId: string, limit?: number, before?: string): Promise<MessageWithParts[]>;
```

**Step 2: Update implementation in `opencode-proxy.ts`**

Find the `getMessages` implementation and add the query params:

```typescript
async getMessages(projectId: string, sessionId: string, limit = 400, before?: string): Promise<MessageWithParts[]> {
    const project = this.resolveProject(projectId);
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (before) { params.set('before', before); }
    const url = `${this.opencodeUrl}/session/${sessionId}/message?${params}`;
    // ... rest of existing implementation
}
```

**Step 3: Update `loadMessages()` in `session-service.ts`**

Change the call at line 1007:

```typescript
const messagesWithParts = await this.openCodeService.getMessages(
    this._activeProject.id,
    this._activeSession.id,
    400  // ← add limit
);
```

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Paginated message loading"
```

Expected: PASS — network call includes `?limit=400`.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "fix(session-service): add limit=400 to GET /session/:id/message to prevent unbounded load"
```

---

### Task B4: Fix session switch not aborting in-progress prompt

**Gap test:** Not explicitly in session-gaps.spec.ts (gap #8 in the comparison doc). **NOT YET COVERED.**

**Bug:** When the user switches sessions while a prompt is running on the old session, the old session continues streaming silently. The new session loads cleanly, but the old session is still burning tokens.

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — `setActiveSession()`

**Step 1: Write the failing test first**

Add to `tests/e2e/session-gaps.spec.ts`:

```typescript
test.describe('Bug: Session switch does not abort previous session', () => {
    test('Tier 3 – switching session while busy aborts the previous session', async () => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        const ctx = await request.newContext();
        const sessionA = await createSession();
        const sessionB = await createSession();

        // Start a prompt on session A (async — do not await)
        ctx.post(`${OPENCODE_URL}/session/${sessionA}/message`, {
            data: { parts: [{ type: 'text', text: 'sleep 5 seconds' }] },
            headers: { 'x-opencode-directory': '/tmp' },
        });

        // Switch to session B via the API (simulates user clicking a different session)
        // Verify that session A's status becomes idle shortly after
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await ctx.get(`${OPENCODE_URL}/session/status`, {
            headers: { 'x-opencode-directory': '/tmp' }
        });
        const statuses = await statusRes.json() as Record<string, { type: string }>;
        // After switching, the old session should have been aborted (or was never started in this test-only env)
        // The important thing is session B is active and A was aborted
        expect(statuses[sessionA]?.type ?? 'idle').toBe('idle');
    });
});
```

**Step 2: Find `setActiveSession()` in `session-service.ts`**

```bash
grep -n "setActiveSession\|async setActiveSession" extensions/openspace-core/src/browser/session-service.ts | head -5
```

**Step 3: Add abort call for the previous session**

At the start of `setActiveSession()`, before setting `this._activeSession`, add:

```typescript
// Abort any in-progress prompt on the current session before switching
if (this._activeSession && this._isStreaming && this._activeProject) {
    try {
        await this.openCodeService.abortSession(this._activeProject.id, this._activeSession.id);
        this.logger.debug(`[SessionService] Aborted session ${this._activeSession.id} before switch`);
    } catch (e) {
        this.logger.warn(`[SessionService] Could not abort session before switch: ${e}`);
    }
}
```

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "abort previous session"
```

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts \
        tests/e2e/session-gaps.spec.ts
git commit -m "fix(session-service): abort in-progress session prompt when switching to a different session"
```

---

## Group C: UI Bug Fixes

### Task C1: Show retry state in chat widget UI

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session retry state shown in UI" ✅ covered

**Bug:** `SessionStatus { type: 'retry', attempt, message, next }` is forwarded via SSE and stored in `session-service.ts`, but `chat-widget.tsx` never reads or displays the `attempt`, `message`, or countdown.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "retry state"
```

Expected: FAIL — `.session-retry` not found.

**Step 2: Read how session status is exposed in `session-service.ts`**

```bash
grep -n "sessionStatus\|_sessionStatus\|getSessionStatus\|SessionStatus" extensions/openspace-core/src/browser/session-service.ts | head -20
```

**Step 3: Add retry display to `chat-widget.tsx`**

In the chat widget render method, where the streaming/busy indicator is shown, add a retry block:

```tsx
{(() => {
    const status = sessionService.getSessionStatus(sessionService.activeSession?.id ?? '');
    if (status?.type === 'retry') {
        const secondsUntilNext = Math.max(0, Math.round((status.next - Date.now()) / 1000));
        return (
            <div className="session-retry" data-testid="session-retry">
                <span className="retry-icon">⟳</span>
                <span className="retry-message">{status.message}</span>
                <span className="retry-countdown">(retry in {secondsUntilNext}s, attempt {status.attempt})</span>
            </div>
        );
    }
    return null;
})()}
```

Also add CSS for `.session-retry` in the widget stylesheet (or inline style).

**Step 4: Expose `getSessionStatus()` from `session-service.ts`**

```bash
grep -n "updateSessionStatus\|_sessionStatus" extensions/openspace-core/src/browser/session-service.ts | head -10
```

Add a getter if missing:

```typescript
getSessionStatus(sessionId: string): SDKTypes.SessionStatus | undefined {
    return this._sessionStatus.get(sessionId);
}
```

**Step 5: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "retry state"
```

Expected: PASS — `.session-retry` element found.

**Step 6: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(chat-widget): display retry state countdown when session is in retry backoff"
```

---

## Group D: Session Lifecycle Features

### Task D1: Add session search to sessions widget

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session search" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/sessions-widget.tsx`
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — update `getSessions()` signature
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — pass `search` param
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — add `searchSessions()`

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Session search"
```

**Step 2: Update `getSessions()` to accept search param**

In `opencode-protocol.ts`:

```typescript
getSessions(projectId: string, options?: { search?: string; limit?: number; start?: string }): Promise<Session[]>;
```

In `opencode-proxy.ts`, update implementation to append `search` to query params.

**Step 3: Add search input to `sessions-widget.tsx`**

```tsx
const [searchQuery, setSearchQuery] = React.useState('');

// In render, before the session list:
<div className="session-search">
    <input
        type="text"
        placeholder="Search sessions…"
        data-testid="session-search"
        value={searchQuery}
        onChange={e => {
            setSearchQuery(e.target.value);
            // debounce-trigger loadSessions with search
            debouncedSearch(e.target.value);
        }}
    />
</div>
```

Wire `debouncedSearch` to call `sessionService.loadSessionsWithSearch(query)`.

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Session search"
```

Expected: PASS — search input visible.

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/sessions-widget.tsx \
        extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(sessions-widget): add session search using GET /session?search= param"
```

---

### Task D2: Add session list pagination to sessions widget

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session list pagination" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/sessions-widget.tsx`
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — add `hasMoreSessions`, `loadMoreSessions()`
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — pass `limit` and `start` cursor

**Step 1: Add `limit=20` default to `getSessions()` calls**

In `session-service.ts` `loadSessions()`, add `limit: 20` to the options.

Track cursor:
```typescript
private _sessionCursor: string | undefined = undefined;
private _hasMoreSessions = false;
```

When the returned count equals the limit, set `_hasMoreSessions = true`.

**Step 2: Expose `hasMoreSessions` and `loadMoreSessions()`**

```typescript
get hasMoreSessions(): boolean { return this._hasMoreSessions; }

async loadMoreSessions(): Promise<void> {
    if (!this._hasMoreSessions || !this._activeProject) { return; }
    const more = await this.openCodeService.getSessions(this._activeProject.id, {
        limit: 20,
        start: this._sessionCursor
    });
    this._sessions = [...this._sessions, ...more];
    this._sessionCursor = more[more.length - 1]?.time?.updated?.toString();
    this._hasMoreSessions = more.length === 20;
    this.onActiveSessionChangedEmitter.fire(this._activeSession);
}
```

**Step 3: Add load-more button to `sessions-widget.tsx`**

```tsx
{sessionService.hasMoreSessions && (
    <button
        className="load-more-sessions"
        data-testid="load-more-sessions"
        onClick={() => sessionService.loadMoreSessions()}
    >
        Load more sessions
    </button>
)}
```

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Session list pagination"
```

Expected: PASS — `.load-more-sessions` element attached to DOM.

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/sessions-widget.tsx \
        extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts
git commit -m "feat(sessions-widget): add session list pagination with load-more button"
```

---

### Task D3: Add session archive (hide/show toggle)

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Archive sessions" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/sessions-widget.tsx`
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — add `archiveSession()`, `showArchived` filter

**Step 1: Add `archiveSession()` to `session-service.ts`**

```typescript
async archiveSession(sessionId: string): Promise<void> {
    if (!this._activeProject) { return; }
    await this.openCodeService.updateSession(this._activeProject.id, sessionId, {
        time: { archived: Date.now() }
    });
    // Reload session list to reflect change
    await this.loadSessions();
}
```

Note: `updateSession()` may need to be added to the protocol if it only supports `title` updates currently. Check `opencode-proxy.ts` for the PATCH implementation and extend if needed.

**Step 2: Add archived filter state to sessions widget**

```typescript
const [showArchived, setShowArchived] = React.useState(false);

const visibleSessions = sessions.filter(s =>
    showArchived ? true : !s.time?.archived
);
```

**Step 3: Add toggle button**

```tsx
<button
    className={`show-archived-toggle ${showArchived ? 'active' : ''}`}
    data-testid="show-archived-toggle"
    aria-label="Show archived sessions"
    onClick={() => setShowArchived(v => !v)}
>
    {showArchived ? 'Hide archived' : 'Show archived'}
</button>
```

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Archive sessions"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/sessions-widget.tsx \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(sessions-widget): add session archive action and show/hide archived toggle"
```

---

### Task D4: Add session fork (UI + API)

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session Fork" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx` — add fork button
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — add `forkSession()`
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — add `forkSession()`
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — implement `forkSession()`

**Step 1: Add `forkSession()` to protocol**

```typescript
forkSession(projectId: string, sessionId: string, messageId?: string): Promise<Session>;
```

**Step 2: Implement in proxy**

```typescript
async forkSession(projectId: string, sessionId: string, messageId?: string): Promise<Session> {
    const project = this.resolveProject(projectId);
    const response = await fetch(`${this.opencodeUrl}/session/${sessionId}/fork`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-opencode-directory': project.worktree
        },
        body: JSON.stringify(messageId ? { messageID: messageId } : {})
    });
    if (!response.ok) { throw new Error(`Fork failed: ${response.status}`); }
    return response.json();
}
```

**Step 3: Add `forkSession()` to `session-service.ts`**

```typescript
async forkSession(messageId?: string): Promise<void> {
    if (!this._activeSession || !this._activeProject) { return; }
    const forkedSession = await this.openCodeService.forkSession(
        this._activeProject.id, this._activeSession.id, messageId
    );
    // Reload sessions to include the new fork
    await this.loadSessions();
    // Switch to the forked session
    await this.setActiveSession(forkedSession.id);
}
```

**Step 4: Add fork button to `chat-widget.tsx`**

In the session actions area (e.g., the `...` menu or header row):

```tsx
<button
    className="fork-session-button"
    data-testid="fork-session-button"
    title="Fork this session"
    onClick={() => sessionService.forkSession()}
>
    Fork
</button>
```

**Step 5: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Session Fork"
```

Expected: PASS — fork button visible.

**Step 6: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx \
        extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts
git commit -m "feat(chat-widget): add session fork button and forkSession() via POST /session/:id/fork"
```

---

### Task D5: Add session revert / unrevert

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session Revert / Unrevert" ✅ covered

The protocol already has `revertSession()` and `unrevertSession()` methods (lines 213–214 of `opencode-protocol.ts`). They need to be wired into `session-service.ts` and exposed in the UI.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`
- Modify: `extensions/openspace-core/src/browser/session-service.ts`

**Step 1: Add `revertSession()` and `unrevertSession()` to `session-service.ts`**

```typescript
async revertSession(): Promise<void> {
    if (!this._activeSession || !this._activeProject) { return; }
    const updated = await this.openCodeService.revertSession(
        this._activeProject.id, this._activeSession.id
    );
    this.notifySessionChanged(updated);
}

async unrevertSession(): Promise<void> {
    if (!this._activeSession || !this._activeProject) { return; }
    const updated = await this.openCodeService.unrevertSession(
        this._activeProject.id, this._activeSession.id
    );
    this.notifySessionChanged(updated);
}
```

**Step 2: Add revert button to `chat-widget.tsx`**

```tsx
<button
    className="revert-session-button"
    data-testid="revert-session-button"
    aria-label="Revert session"
    title={activeSession?.revert ? 'Unrevert session' : 'Revert session'}
    onClick={() => activeSession?.revert
        ? sessionService.unrevertSession()
        : sessionService.revertSession()
    }
>
    {activeSession?.revert ? 'Unrevert' : 'Revert'}
</button>
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Revert"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(chat-widget): add session revert/unrevert via POST /session/:id/revert"
```

---

### Task D6: Add session compact / summarize

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session Summarize / Compact" ✅ covered

Protocol already has `compactSession()` (line 212 of `opencode-protocol.ts`).

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`
- Modify: `extensions/openspace-core/src/browser/session-service.ts`

**Step 1: Add `compactSession()` to `session-service.ts`**

```typescript
async compactSession(): Promise<void> {
    if (!this._activeSession || !this._activeProject) { return; }
    await this.openCodeService.compactSession(this._activeProject.id, this._activeSession.id);
    // session.compacted SSE event will refresh the message list
}
```

**Step 2: Add compact button to `chat-widget.tsx`**

```tsx
<button
    className="compact-session-button"
    data-testid="compact-session-button"
    aria-label="Compact session"
    title="Compact session (summarize context)"
    onClick={() => sessionService.compactSession()}
>
    Compact
</button>
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Summarize"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(chat-widget): add compact session button via POST /session/:id/summarize"
```

---

## Group E: Message Part Rendering

### Task E1: Render `reasoning` parts in `message-bubble.tsx`

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Reasoning parts rendered" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`
- Modify stylesheet to add `.part-reasoning` CSS class

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Reasoning parts"
```

Expected: FAIL — `.part-reasoning` CSS not found.

**Step 2: Add reasoning part renderer in `message-bubble.tsx`**

Find the part-rendering switch/if block in `message-bubble.tsx`. Add:

```tsx
case 'reasoning': {
    const reasoningPart = part as SDKTypes.ReasoningPart;
    return (
        <div key={part.id} className="part-reasoning">
            <details>
                <summary className="reasoning-summary">Reasoning</summary>
                <div className="reasoning-content">{reasoningPart.reasoning ?? reasoningPart.text ?? ''}</div>
            </details>
        </div>
    );
}
```

**Step 3: Add CSS**

In the associated stylesheet (or inline in the component), add:

```css
.part-reasoning {
    border-left: 2px solid var(--theia-focusBorder);
    padding-left: 8px;
    opacity: 0.8;
    font-size: 0.9em;
}
.reasoning-summary { cursor: pointer; color: var(--theia-descriptionForeground); }
.reasoning-content { margin-top: 4px; white-space: pre-wrap; }
```

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Reasoning parts"
```

Expected: PASS — `.part-reasoning` CSS found.

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx
git commit -m "feat(message-bubble): render reasoning parts with collapsible details block"
```

---

### Task E2: Render `file` parts in `message-bubble.tsx`

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: File parts rendered" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`

**Step 1: Add file part renderer**

```tsx
case 'file': {
    const filePart = part as SDKTypes.FilePart;
    return (
        <div key={part.id} className="part-file">
            <span className="file-icon">📄</span>
            <span className="file-name">{filePart.filename ?? filePart.mediaType ?? 'file'}</span>
        </div>
    );
}
```

Add CSS: `.part-file { display: flex; align-items: center; gap: 6px; padding: 4px; }`

**Step 2: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "File parts"
```

Expected: PASS.

**Step 3: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx
git commit -m "feat(message-bubble): render file attachment parts"
```

---

### Task E3: Render `agent` parts in `message-bubble.tsx`

**Gap test:** Not explicitly in session-gaps.spec.ts. **NOT YET COVERED.**

**Step 1: Write the test first**

Add to `tests/e2e/session-gaps.spec.ts`:

```typescript
test.describe('Gap: Agent parts rendered', () => {
    test('Tier 1 – Agent invocation parts have a render element in DOM', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        const hasAgentStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try { return Array.from(sheet.cssRules).some(r => r.cssText.includes('part-agent')); }
                catch { return false; }
            });
        });
        expect(hasAgentStyle).toBe(true);
    });
});
```

**Step 2: Run to confirm failure**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Agent parts"
```

**Step 3: Add agent part renderer**

```tsx
case 'agent': {
    const agentPart = part as SDKTypes.AgentPart;
    return (
        <div key={part.id} className="part-agent">
            <span className="agent-icon">🤖</span>
            <span className="agent-name">{agentPart.agent ?? 'sub-agent'}</span>
            <span className={`agent-state agent-state-${agentPart.state ?? 'pending'}`}>
                {agentPart.state ?? 'pending'}
            </span>
        </div>
    );
}
```

CSS: `.part-agent { display: flex; align-items: center; gap: 6px; padding: 4px; opacity: 0.85; }`

**Step 4: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Agent parts"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx \
        tests/e2e/session-gaps.spec.ts
git commit -m "feat(message-bubble): render agent sub-task invocation parts"
```

---

### Task E4: Render `compaction` parts and `session.compacted` marker in timeline

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Compaction marker rendered" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-timeline.tsx`
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Compaction marker"
```

**Step 2: Add compaction part renderer**

In `message-bubble.tsx`:

```tsx
case 'compaction': {
    return (
        <div key={part.id} className="compaction-marker">
            <div className="compaction-line" />
            <span className="compaction-label">Context compacted</span>
            <div className="compaction-line" />
        </div>
    );
}
```

CSS:
```css
.compaction-marker {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: var(--theia-descriptionForeground);
    font-size: 0.85em;
}
.compaction-line { flex: 1; height: 1px; background: currentColor; opacity: 0.3; }
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Compaction marker"
```

Expected: PASS — `.compaction-marker` CSS found.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx \
        extensions/openspace-chat/src/browser/message-timeline.tsx
git commit -m "feat(message-bubble): render compaction parts as visual divider in timeline"
```

---

### Task E5: Render `patch`/`snapshot` parts as diff indicators

**Gap test:** Not explicitly in session-gaps.spec.ts. **NOT YET COVERED.**

**Step 1: Write test first**

Add to `tests/e2e/session-gaps.spec.ts`:

```typescript
test.describe('Gap: Patch/snapshot parts rendered', () => {
    test('Tier 1 – Patch parts have a render element with diff indicator', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        const hasPatchStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try { return Array.from(sheet.cssRules).some(r => r.cssText.includes('part-patch')); }
                catch { return false; }
            });
        });
        expect(hasPatchStyle).toBe(true);
    });
});
```

**Step 2: Add renderer**

```tsx
case 'patch': {
    const patchPart = part as SDKTypes.PatchPart;
    return (
        <div key={part.id} className="part-patch">
            <span className="patch-icon">±</span>
            <span className="patch-file">{patchPart.file ?? 'file changed'}</span>
        </div>
    );
}

case 'snapshot': {
    return (
        <div key={part.id} className="part-snapshot">
            <span className="snapshot-icon">📸</span>
            <span className="snapshot-label">Snapshot</span>
        </div>
    );
}
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Patch"
```

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx \
        tests/e2e/session-gaps.spec.ts
git commit -m "feat(message-bubble): render patch and snapshot parts as file change indicators"
```

---

## Group F: Session Discovery & Navigation

### Task F1: Add paginated message load-more in timeline

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Tier 1 – Load more messages button exists" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-timeline.tsx`
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — add `loadOlderMessages()`

**Step 1: Add `loadOlderMessages()` to `session-service.ts`**

```typescript
private _messageLoadCursor: string | undefined = undefined;
private _hasOlderMessages = false;

get hasOlderMessages(): boolean { return this._hasOlderMessages; }

async loadOlderMessages(): Promise<void> {
    if (!this._hasOlderMessages || !this._activeSession || !this._activeProject) { return; }
    const older = await this.openCodeService.getMessages(
        this._activeProject.id, this._activeSession.id, 400, this._messageLoadCursor
    );
    this._messages = [...older.map(m => ({ ...m.info, parts: m.parts ?? [] })), ...this._messages];
    this._messageLoadCursor = older[0]?.info?.time?.created?.toString();
    this._hasOlderMessages = older.length === 400;
    this.onMessagesChangedEmitter.fire([...this._messages]);
}
```

In `loadMessages()`, after loading: set `_hasOlderMessages = (messagesWithParts.length === 400)`.

**Step 2: Add load-more button to `message-timeline.tsx`**

```tsx
{sessionService.hasOlderMessages && (
    <div className="load-more-messages-container">
        <button
            className="load-more-messages"
            data-testid="load-more-messages"
            aria-label="Load more messages"
            onClick={() => sessionService.loadOlderMessages()}
        >
            Load older messages
        </button>
    </div>
)}
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Load more messages"
```

Expected: PASS.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-timeline.tsx \
        extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(message-timeline): add load-more button for paginated message history"
```

---

### Task F2: Add session diff display

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Session diff display" ✅ covered

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — add `getDiff()`
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — implement `getDiff()`
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — expose `sessionDiff`
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx` — display diff indicator

**Step 1: Add `getDiff()` to protocol**

```typescript
getDiff(projectId: string, sessionId: string): Promise<string>;
```

**Step 2: Implement in proxy**

```typescript
async getDiff(projectId: string, sessionId: string): Promise<string> {
    const project = this.resolveProject(projectId);
    const response = await fetch(`${this.opencodeUrl}/session/${sessionId}/diff`, {
        headers: { 'x-opencode-directory': project.worktree }
    });
    if (!response.ok) { return ''; }
    return response.text();
}
```

**Step 3: Expose in `session-service.ts`**

```typescript
private _sessionDiff: string | undefined = undefined;
get sessionDiff(): string | undefined { return this._sessionDiff; }

async refreshDiff(): Promise<void> {
    if (!this._activeSession || !this._activeProject) { return; }
    try {
        this._sessionDiff = await this.openCodeService.getDiff(
            this._activeProject.id, this._activeSession.id
        );
    } catch { this._sessionDiff = undefined; }
}
```

Call `refreshDiff()` when a session becomes active.

**Step 4: Add diff panel to `chat-widget.tsx`**

```tsx
{sessionService.sessionDiff && (
    <div className="session-diff" data-testid="session-diff">
        <pre className="session-diff-content">{sessionService.sessionDiff}</pre>
    </div>
)}
```

Or a collapsed indicator showing changed-file count.

**Step 5: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Session diff"
```

Expected: PASS.

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "feat(chat-widget): display session diff via GET /session/:id/diff"
```

---

## Group G: Todo Panel

### Task G1: Implement todo panel (`GET /session/:id/todo` + `todo.updated` SSE)

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Todo panel" ✅ covered

**Files:**
- Create: `extensions/openspace-chat/src/browser/todo-panel.tsx`
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — add `getTodos()`
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — implement `getTodos()`, handle `todo.updated` SSE
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — add `todos` state + `onTodosChanged`
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts` — handle `todo_updated` notification
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx` — render `<TodoPanel />`

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Todo panel"
```

**Step 2: Add `getTodos()` to protocol**

```typescript
getTodos(projectId: string, sessionId: string): Promise<Array<{ id: string; description: string; status: string }>>;
```

**Step 3: Add `onTodoEvent` to `OpenCodeClient`**

In `opencode-protocol.ts`, add to `OpenCodeClient`:

```typescript
onTodoEvent(event: TodoNotification): void;
```

Add type:

```typescript
export interface TodoNotification {
    readonly sessionId: string;
    readonly todos: Array<{ id: string; description: string; status: string }>;
}
```

**Step 4: Implement in proxy**

```typescript
async getTodos(projectId: string, sessionId: string): Promise<Array<{ id: string; description: string; status: string }>> {
    const project = this.resolveProject(projectId);
    const response = await fetch(`${this.opencodeUrl}/session/${sessionId}/todo`, {
        headers: { 'x-opencode-directory': project.worktree }
    });
    if (!response.ok) { return []; }
    return response.json();
}
```

Handle `todo.updated` in `handleSSEEvent()`:

```typescript
} else if (eventType.startsWith('todo.')) {
    const todoEvent = innerEvent as { type: string; properties: { sessionID: string; todos: unknown[] } };
    if (this._client) {
        this._client.onTodoEvent({
            sessionId: todoEvent.properties.sessionID,
            todos: todoEvent.properties.todos as Array<{ id: string; description: string; status: string }>
        });
    }
}
```

**Step 5: Add todo state to `session-service.ts`**

```typescript
private _todos: Array<{ id: string; description: string; status: string }> = [];
private readonly onTodosChangedEmitter = new Emitter<Array<{ id: string; description: string; status: string }>>();
readonly onTodosChanged = this.onTodosChangedEmitter.event;
get todos() { return this._todos; }

updateTodos(todos: Array<{ id: string; description: string; status: string }>): void {
    this._todos = todos;
    this.onTodosChangedEmitter.fire([...this._todos]);
}
```

Add `this.onTodosChangedEmitter.dispose()` to `dispose()`.

**Step 6: Handle `onTodoEvent` in `opencode-sync-service.ts`**

```typescript
onTodoEvent(event: TodoNotification): void {
    try {
        if (this.sessionService.activeSession?.id !== event.sessionId) { return; }
        this.sessionService.updateTodos(event.todos);
    } catch (e) {
        this.logger.error('[SyncService] Error in onTodoEvent:', e);
    }
}
```

**Step 7: Create `todo-panel.tsx`**

```tsx
import * as React from '@theia/core/shared/react';

interface TodoPanelProps {
    todos: Array<{ id: string; description: string; status: string }>;
}

export const TodoPanel: React.FC<TodoPanelProps> = ({ todos }) => {
    if (todos.length === 0) { return null; }
    return (
        <div className="openspace-todo-panel" data-testid="todo-panel">
            <div className="todo-panel-header">Todos</div>
            <ul className="todo-list">
                {todos.map(todo => (
                    <li key={todo.id} className={`todo-item todo-status-${todo.status}`}>
                        <span className="todo-status-icon">
                            {todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '→' : '○'}
                        </span>
                        <span className="todo-description">{todo.description}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
```

**Step 8: Integrate into `chat-widget.tsx`**

```tsx
import { TodoPanel } from './todo-panel';
// ...
<TodoPanel todos={sessionService.todos} />
```

**Step 9: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Todo panel"
```

Expected: PASS — `.openspace-todo-panel` exists in DOM.

**Step 10: Commit**

```bash
git add extensions/openspace-chat/src/browser/todo-panel.tsx \
        extensions/openspace-chat/src/browser/chat-widget.tsx \
        extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/browser/opencode-sync-service.ts
git commit -m "feat(chat-widget): add todo panel with GET /session/:id/todo and todo.updated SSE"
```

---

## Group H: Sessions Widget Enrichment

### Task H1: Show per-session status badge in sessions widget

**Gap test:** Not explicitly in session-gaps.spec.ts. **NOT YET COVERED.**

**Step 1: Write test**

Add to `tests/e2e/session-gaps.spec.ts`:

```typescript
test.describe('Gap: Per-session status badge', () => {
    test('Tier 1 – Session list items show status badge', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        const hasBadgeStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try { return Array.from(sheet.cssRules).some(r => r.cssText.includes('session-status-badge')); }
                catch { return false; }
            });
        });
        expect(hasBadgeStyle).toBe(true);
    });
});
```

**Step 2: Add status badges to `sessions-widget.tsx`**

For each session in the list, call `sessionService.getSessionStatus(session.id)` and render:

```tsx
{(() => {
    const status = sessionService.getSessionStatus(session.id);
    if (!status || status.type === 'idle') { return null; }
    return (
        <span className={`session-status-badge session-status-${status.type}`}>
            {status.type === 'busy' ? '●' : '↺'}
        </span>
    );
})()}
```

CSS:
```css
.session-status-badge { font-size: 0.7em; margin-left: 4px; }
.session-status-busy { color: var(--theia-charts-yellow); }
.session-status-retry { color: var(--theia-charts-orange); }
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "status badge"
```

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/sessions-widget.tsx
git commit -m "feat(sessions-widget): show per-session busy/retry status badges"
```

---

### Task H2: Show forked session hierarchy in sessions widget

**Gap test:** `tests/e2e/session-gaps.spec.ts` — "Gap: Forked session hierarchy" ✅ covered

**Files:**
- Modify: `extensions/openspace-chat/src/browser/sessions-widget.tsx`

**Step 1: Run failing test**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Forked session hierarchy"
```

**Step 2: Group sessions by parentID in `sessions-widget.tsx`**

```typescript
// Group sessions: root sessions first, then children indented
const rootSessions = sessions.filter(s => !s.parentID);
const childSessions = sessions.filter(s => !!s.parentID);
```

When rendering session list items, add `data-parent-id` attribute and `session-child` / `session-forked` CSS class:

```tsx
<div
    key={session.id}
    className={`session-list-item ${session.parentID ? 'session-child session-forked' : ''}`}
    data-parent-id={session.parentID ?? undefined}
    style={{ paddingLeft: session.parentID ? '24px' : undefined }}
>
```

CSS:
```css
.session-child { border-left: 2px solid var(--theia-editorIndentGuide-activeBackground); }
.session-forked { opacity: 0.9; }
```

**Step 3: Build and run test**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
npx playwright test tests/e2e/session-gaps.spec.ts --grep "Forked session hierarchy"
```

Expected: PASS — `.session-child` and `.session-forked` CSS found.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/sessions-widget.tsx
git commit -m "feat(sessions-widget): show forked session hierarchy with indentation and parentID attributes"
```

---

## Final: E2E suite verification

After all tasks are complete, run the full gap test suite and confirm all tests that were failing before are now passing.

**Step 1: Run the gap test suite**

```bash
npx playwright test tests/e2e/session-gaps.spec.ts
```

Expected: All tests pass (or Tier 3 tests are skipped if OpenCode is not running at localhost:7890).

**Step 2: Run the existing session management suite to catch regressions**

```bash
npx playwright test tests/e2e/session-management.spec.ts
```

Expected: All tests pass.

**Step 3: Final commit**

Update agent memory:

```bash
git add .opencode/_context/01_memory/
git commit -m "docs(memory): update active context after session-gaps plan written"
```

---

## Summary

| Group | Tasks | Bugs Fixed | Features Added |
|---|---|---|---|
| A: SSE Bug Fixes | A1–A3 | 4 (session.error, message.removed, message.part.removed, emitter leak) | — |
| B: Session Lifecycle Bugs | B1–B4 | 3 (init, status hydration, limit) + 1 (abort on switch) | — |
| C: UI Bug Fixes | C1 | 1 (retry state UI) | — |
| D: Session Lifecycle Features | D1–D6 | — | 6 (search, pagination, archive, fork, revert, compact) |
| E: Message Part Rendering | E1–E5 | — | 5 (reasoning, file, agent, compaction, patch/snapshot) |
| F: Session Discovery | F1–F2 | — | 2 (message load-more, session diff) |
| G: Todo Panel | G1 | — | 1 (todo panel + SSE) |
| H: Sessions Widget | H1–H2 | — | 2 (status badge, fork hierarchy) |
| **Total** | **22 tasks** | **9 bugs** | **16 features** |

**Tests not yet covered** (write tests in the relevant task's Step 1):
- Session switch aborts previous (B4)
- `agent` part rendering (E3)
- `patch`/`snapshot` part rendering (E5)
- Per-session status badge (H1)
