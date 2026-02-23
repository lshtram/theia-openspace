# Conversation Flow Bugs v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two root-cause conversation flow bugs: (A) send/stop button flickers during multi-step agent turns, (B) duplicate assistant messages from dual-channel message creation (SSE + RPC race).

**Architecture:** Bug A is fixed by using the server-authoritative `sessionBusy` flag (already available via SSE `session.status` events) to control the send/stop button, instead of the per-message `isStreaming` flag that toggles between tool rounds. Bug B is fixed by making SSE the single authoritative channel for assistant message delivery, removing the competing direct push from `sendMessage()` and using the RPC result only as a timeout-based fallback.

**Tech Stack:** TypeScript, React, Theia DI/RPC, OpenCode SSE events

---

## Context & Key Files

| File | Purpose |
|------|---------|
| `extensions/openspace-core/src/browser/session-service.ts` | Streaming state management, `sendMessage()`, `appendMessage()` |
| `extensions/openspace-core/src/browser/opencode-sync-service.ts` | SSE event routing, message stub creation, streaming trackers |
| `extensions/openspace-chat/src/browser/chat-widget.tsx` | React state wiring, passes `isStreaming` to PromptInput |
| `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx` | Send/stop button toggle logic |
| `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts` | Unit tests |

### Build commands
```bash
# Full rebuild:
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app build

# Restart server:
lsof -ti :3000 | xargs kill -9
yarn --cwd browser-app start &>/tmp/theia-server.log &

# Unit tests:
node_modules/.bin/mocha --timeout 10000 --exit
```

---

## Prior Art (already on master)

These fixes are already applied and should NOT be reverted:

| Fix | What it did | Why it's insufficient |
|-----|-------------|----------------------|
| `sendMessage()` finally block guard | Only clears `_isStreaming` if no SSE timer/message is active | Doesn't prevent flicker from the 500ms hysteresis timer firing between intermediate messages |
| `appendMessage()` dedup guard | Skips messages with duplicate IDs | Doesn't fix the root cause (dual-channel creation) and can't catch the streaming-ID ≠ final-ID case |
| TurnGroup rendering | All assistant messages in one TurnGroup | Correct; no changes needed |

---

## Bug A: Root Cause Analysis — Button Flicker

### The problem

The send/stop button in `PromptInput` (prompt-input.tsx:829) shows "stop" when `isStreaming && !hasContent`. The `isStreaming` prop comes from `SessionService._isStreaming`, which toggles on a **per-message** basis:

1. Message streaming starts → `_isStreaming = true`
2. `message.completed` fires → `updateStreamingMessage(id, '', true)` starts a **500ms** hysteresis timer
3. If the next message's `message.part.delta` doesn't arrive within 500ms → timer fires → `_isStreaming = false` → **button flips to arrow**
4. Next message starts → `applyPartDelta()` sets `_isStreaming = true` → **button flips back to stop**

This produces visible flicker during any multi-step turn where there's a >500ms gap between tool rounds (common during model thinking/planning).

### Why the existing fix is insufficient

The `sendMessage()` finally block guard only prevents the RPC resolution from killing streaming. The 500ms hysteresis timer in `updateStreamingMessage(isDone=true)` (session-service.ts:1082-1096) still fires `_isStreaming = false` between intermediate messages.

### The MessageTimeline already has the right solution

`MessageTimeline` (message-timeline.tsx:158-162) already solved this for the TurnGroup:

```typescript
const sessionActive = isStreaming || sessionBusy;
const sessionActiveLatch = useLatchedBool(sessionActive, 600);
```

`sessionBusy` comes from the server-authoritative `session.status` SSE event, which stays `true` for the **entire** agent turn (including gaps between tool rounds). But `PromptInput` receives only `isStreaming` (chat-widget.tsx:900), not `sessionBusy`.

### The fix

Pass `isStreaming || sessionBusy` to `PromptInput` instead of just `isStreaming`. This is a one-line change in `chat-widget.tsx`. The server-authoritative `sessionBusy` flag is the right signal for "should the stop button be shown" because it spans the entire turn without gaps.

---

## Bug B: Root Cause Analysis — Duplicate Messages

### The problem

The system has a **dual-channel race**: the same assistant message arrives via two independent, concurrent channels:

| Channel | Code path | When it fires |
|---------|-----------|---------------|
| **SSE** (streaming) | `onMessagePartDelta` / `handleMessagePartial` → `appendMessage()` | Immediately as tokens stream |
| **RPC** (request/response) | `sendMessage()` → `this._messages.push()` at line 767 | When the entire turn completes |

Both try to insert the assistant message. Worse, the **IDs can differ** — the proxy tracks `lastStreamingPartMessageId` (opencode-proxy.ts:89) because the backend uses a different message ID during streaming vs. the final completed message. So even with the existing `appendMessage` dedup guard (which checks by ID), the SSE stub has ID `msg-A` while the RPC result has ID `msg-B`, **bypassing the dedup check**.

### Timeline of the race

```
t=0    sendMessage() fires createMessage RPC (blocks until turn ends)
t=1    SSE: message.part.delta(id=msg-A) → appendMessage({id: msg-A}) → stub created
t=2    SSE: message.part.delta(id=msg-A) → applyPartDelta → content builds up
t=3    SSE: message.completed(id=msg-B, previousMessageId=msg-A) →
         replaceMessage(msg-A, {id: msg-B, ...}) → msg-A slot now holds msg-B's content
t=4    RPC returns {id: msg-B} → sendMessage checks _messages.some(m.id === 'msg-B')
         → With replaceMessage, msg-A's array slot now has id=msg-B → finds it? DEPENDS.
```

The race outcome depends on whether `replaceMessage` has already run when the RPC check at line 752 executes. If `replaceMessage` ran first, the check finds `msg-B` and skips. If not, it pushes a duplicate.

### Why dedup at `appendMessage()` is insufficient

1. **Different IDs**: The streaming stub uses streaming ID, the RPC result uses the final ID. Dedup by ID can't catch this.
2. **Direct push**: `sendMessage()` at line 767 does `this._messages.push()` directly — it doesn't go through `appendMessage()` at all, so the dedup guard never runs for this path.
3. **Symptom vs cause**: Even if dedup catches some cases, the system is still doing redundant work (creating messages from two sources) and relying on a coincidence (same ID) to prevent visible duplicates.

### The fix

Make SSE the **single authoritative channel** for assistant message creation. `sendMessage()` should NOT push the assistant message from the RPC result. Instead:

1. Remove the direct `_messages.push()` in `sendMessage()` (lines 747-771)
2. Use the RPC result only as a **timeout-based fallback**: if SSE hasn't delivered the message within 5 seconds after the RPC resolves, then (and only then) use `appendMessage()` to insert it
3. Keep the existing `appendMessage()` dedup guard as a safety net (last line of defense)

This eliminates the race entirely because there's only one channel creating messages.

---

## Task 1 — Bug A: Use sessionBusy for send/stop button

**Problem:** `PromptInput` receives only `isStreaming` (per-message flag, flickers between tool rounds) instead of the turn-level `sessionBusy` flag.

**Root cause:** `chat-widget.tsx:900` passes `isStreaming={isStreaming}` to PromptInput. The `sessionBusy` state (line 386) is available in the same component but isn't used for the button.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx:900`

### Step 1: Change the isStreaming prop passed to PromptInput

In `chat-widget.tsx`, find line 900 where `PromptInput` receives its props:

```tsx
isStreaming={isStreaming}
```

Replace with:

```tsx
isStreaming={isStreaming || sessionBusy}
```

This uses the same `sessionBusy` state already declared at line 386 and updated via `sessionService.onSessionStatusChanged` at lines 545-547. The server holds the session in "busy" status for the entire agent turn, so `sessionBusy` stays `true` across tool rounds without gaps.

### Step 2: Also guard the streaming cleanup in onIsStreamingChanged

In `chat-widget.tsx`, find lines 519-534 where the `onIsStreamingChanged` subscription clears streaming state:

```typescript
const streamingStateDisposable = sessionService.onIsStreamingChanged(streaming => {
    setIsStreaming(streaming);
    if (!streaming) {
        // Flush any pending throttled messages
        if (messageThrottleTimer) {
            clearTimeout(messageThrottleTimer);
            messageThrottleTimer = null;
        }
        if (pendingMessages) {
            setMessages(pendingMessages);
            pendingMessages = null;
        }
        setStreamingMessageId(undefined);
        setStreamingStatus('');
    }
});
```

The `setStreamingMessageId(undefined)` and `setStreamingStatus('')` should NOT fire when `sessionBusy` is still true — clearing them mid-turn can cause the TurnGroup to lose its streaming indicator briefly.

However, since `sessionBusy` is React state, we can't read it reliably inside this callback (closure would capture stale value). Instead, read the service directly:

Replace with:

```typescript
const streamingStateDisposable = sessionService.onIsStreamingChanged(streaming => {
    setIsStreaming(streaming);
    if (!streaming) {
        // Flush any pending throttled messages
        if (messageThrottleTimer) {
            clearTimeout(messageThrottleTimer);
            messageThrottleTimer = null;
        }
        if (pendingMessages) {
            setMessages(pendingMessages);
            pendingMessages = null;
        }
        // Only clear streaming UI state if the server also considers the turn done.
        // sessionStatus.type becomes 'idle' when the entire turn finishes.
        const serverIdle = sessionService.sessionStatus?.type === 'idle';
        if (serverIdle) {
            setStreamingMessageId(undefined);
            setStreamingStatus('');
        }
    }
});
```

### Step 3: Run unit tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit`
Expected: All tests pass.

### Step 4: Build chat extension

Run:
```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
```
Expected: No TypeScript errors.

### Step 5: Commit

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "fix(chat): use sessionBusy for send/stop button to prevent mid-turn flicker"
```

---

## Task 2 — Bug B: Make SSE the single source of truth for messages

**Problem:** `sendMessage()` pushes the assistant message from the RPC result (lines 747-771), racing with SSE event handlers that also create the message. The IDs can differ between streaming and final messages, bypassing the existing dedup guard.

**Root cause:** Two independent channels (SSE + RPC) both create the same assistant message. The fix is to designate SSE as the single authoritative channel and use the RPC result only as a fallback.

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts` (the `sendMessage` method, lines 747-771)
- Test: `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`

### Step 1: Write a test for the new fallback behavior

In `session-service.spec.ts`, add a test at the end of the file that verifies `sendMessage()` does NOT immediately push the assistant message, and only uses it as a fallback after a timeout:

```typescript
describe('sendMessage() SSE-first message delivery', () => {
    it('does not immediately push the assistant message from RPC result', async () => {
        // Setup: active project + session
        const mockOpenCodeService = (sessionService as any).openCodeService;
        (sessionService as any)._activeProject = { id: 'proj-1' };
        (sessionService as any)._activeSession = { id: 'sess-1' };

        // Mock createMessage to return a result with an assistant message
        mockOpenCodeService.createMessage = sinon.stub().resolves({
            info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
            parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
        });

        await sessionService.sendMessage([{ type: 'text', text: 'hi' }]);

        // The assistant message should NOT be in _messages immediately after sendMessage resolves.
        // Only the optimistic user message should be there (SSE is responsible for delivering
        // the assistant message, and the RPC fallback timer hasn't fired yet).
        const assistantMessages = sessionService.messages.filter(m => m.role === 'assistant');
        expect(assistantMessages.length).to.equal(0);
    });

    it('uses RPC result as fallback if SSE has not delivered the message after timeout', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const mockOpenCodeService = (sessionService as any).openCodeService;
            (sessionService as any)._activeProject = { id: 'proj-1' };
            (sessionService as any)._activeSession = { id: 'sess-1' };

            mockOpenCodeService.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });

            await sessionService.sendMessage([{ type: 'text', text: 'hi' }]);

            // No assistant message yet
            let assistantMessages = sessionService.messages.filter(m => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(0);

            // Advance past the fallback timeout (5 seconds)
            clock.tick(5100);

            // Now the fallback should have inserted the message
            assistantMessages = sessionService.messages.filter(m => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
            expect(assistantMessages[0].id).to.equal('msg-final');
        } finally {
            clock.restore();
        }
    });

    it('does NOT use RPC fallback if SSE already delivered the message', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const mockOpenCodeService = (sessionService as any).openCodeService;
            (sessionService as any)._activeProject = { id: 'proj-1' };
            (sessionService as any)._activeSession = { id: 'sess-1' };

            mockOpenCodeService.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });

            await sessionService.sendMessage([{ type: 'text', text: 'hi' }]);

            // Simulate SSE delivering the message before the fallback fires
            sessionService.appendMessage({
                id: 'msg-final',
                sessionID: 'sess-1',
                role: 'assistant',
                time: { created: Date.now() },
                parts: [{ type: 'text', text: 'hello from SSE' }]
            } as any);

            // Advance past the fallback timeout
            clock.tick(5100);

            // Should still be exactly one assistant message (the SSE one)
            const assistantMessages = sessionService.messages.filter(m => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
        } finally {
            clock.restore();
        }
    });
});
```

### Step 2: Run test to verify it fails

Run: `node_modules/.bin/mocha --timeout 10000 --exit`
Expected: The first test fails because `sendMessage()` currently pushes the assistant message immediately.

### Step 3: Add a constant for the fallback timeout

In `session-service.ts`, near line 163 (after `STREAMING_DONE_DELAY_MS`), add:

```typescript
private readonly RPC_FALLBACK_DELAY_MS = 5000;
private _rpcFallbackTimer: ReturnType<typeof setTimeout> | undefined;
```

### Step 4: Rewrite the RPC result handling in sendMessage()

In `session-service.ts`, replace lines 743-771 (the entire block from `// The RPC call returns...` through the `else` push block):

**Current code (lines 743-771):**
```typescript
            // The RPC call returns the final assistant message (info + parts).
            // SSE events (message.part.updated → partial, message.updated → completed) may have
            // already added/updated this message via appendMessage() / replaceMessage().
            // To avoid duplicates we only push the assistant message if it isn't in the array yet.
            const assistantMessage: Message = {
                ...result.info,
                parts: result.parts || []
            };

            const assistantExists = this._messages.some(m => m.id === assistantMessage.id);
            if (assistantExists) {
                // SSE already handled this message (streamed parts via message.part.updated
                // and completed via message.updated). The RPC result typically has parts: []
                // because parts arrive via SSE, not the REST response. Only replace if the
                // RPC result actually carries parts; otherwise we'd wipe SSE-streamed content.
                const rpcHasParts = (result.parts || []).length > 0;
                if (rpcHasParts) {
                    this.replaceMessage(assistantMessage.id, assistantMessage);
                    this.logger.debug(`[SessionService] Updated existing assistant message via RPC result: ${assistantMessage.id} (${result.parts!.length} parts)`);
                } else {
                    this.logger.debug(`[SessionService] Skipping replaceMessage for ${assistantMessage.id}: RPC result has empty parts, SSE already populated content`);
                }
            } else {
                // SSE hasn't arrived yet (or was very fast) — append the assistant message
                this._messages.push(assistantMessage);
                this.onMessagesChangedEmitter.fire([...this._messages]);
                const partsCount = assistantMessage.parts?.length || 0;
                this.logger.debug(`[SessionService] Added assistant message from RPC: ${assistantMessage.id} with ${partsCount} parts`);
            }
```

**Replace with:**
```typescript
            // SSE is the single authoritative channel for assistant message delivery.
            // The RPC result is used only as a timeout-based fallback in case SSE fails
            // to deliver the message (e.g. SSE disconnected during the turn).
            const assistantMessage: Message = {
                ...result.info,
                parts: result.parts || []
            };

            // Cancel any previous fallback timer (shouldn't exist, but be safe)
            if (this._rpcFallbackTimer) {
                clearTimeout(this._rpcFallbackTimer);
                this._rpcFallbackTimer = undefined;
            }

            // Start a fallback timer: if SSE hasn't delivered this message within
            // RPC_FALLBACK_DELAY_MS, insert it from the RPC result.
            this._rpcFallbackTimer = setTimeout(() => {
                this._rpcFallbackTimer = undefined;
                const alreadyExists = this._messages.some(m => m.id === assistantMessage.id);
                if (!alreadyExists) {
                    this.logger.info(`[SessionService] SSE fallback: inserting assistant message from RPC result: ${assistantMessage.id}`);
                    this.appendMessage(assistantMessage);
                } else {
                    this.logger.debug(`[SessionService] SSE fallback: message already delivered by SSE: ${assistantMessage.id}`);
                }
            }, this.RPC_FALLBACK_DELAY_MS);

            this.logger.debug(`[SessionService] RPC returned assistant message ${assistantMessage.id}, waiting for SSE delivery (fallback in ${this.RPC_FALLBACK_DELAY_MS}ms)`);
```

### Step 5: Clean up the fallback timer in abort() and dispose()

In `session-service.ts`, in the `abort()` method's `finally` block (around line 841), add cleanup for the fallback timer. Find:

```typescript
} finally {
    this._streamingMessageId = undefined;
```

Replace with:

```typescript
} finally {
    // Cancel RPC fallback timer on abort
    if (this._rpcFallbackTimer) {
        clearTimeout(this._rpcFallbackTimer);
        this._rpcFallbackTimer = undefined;
    }
    this._streamingMessageId = undefined;
```

In the `dispose()` method (around line 1489), add the same cleanup. Find where `_streamingDoneTimer` is cleared in dispose and add nearby:

```typescript
if (this._rpcFallbackTimer) {
    clearTimeout(this._rpcFallbackTimer);
    this._rpcFallbackTimer = undefined;
}
```

### Step 6: Run tests to verify they pass

Run: `node_modules/.bin/mocha --timeout 10000 --exit`
Expected: All tests pass, including the new ones from Step 1.

### Step 7: Build core extension

Run:
```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
```
Expected: No TypeScript errors.

### Step 8: Commit

```bash
git add extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
git commit -m "fix(core): make SSE the single source of truth for assistant messages, RPC as fallback only"
```

---

## Task 3 — Restore handleMessageCompleted guard for SSE replays

**Problem:** The branch removed a guard in `handleMessageCompleted` that prevented replayed SSE events (on reconnect) from firing `isDone:true` for historical messages. This guard is important because the opencode SSE stream replays all past `message.updated` events on reconnect, which would trigger spurious `updateStreamingMessage(id, '', true)` calls and restart the 500ms hysteresis timer for every old message.

**Root cause:** The guard was removed during debugging, but it serves a real purpose.

**Files:**
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts` (the `handleMessageCompleted` method, lines 362-409)

### Step 1: Re-add the streamingMessages guard

In `opencode-sync-service.ts`, find the `handleMessageCompleted` method (line 362). After the `streamingStubId` assignment (line 378), add back the guard:

**Current code (lines 378-381):**
```typescript
        const streamingStubId = event.previousMessageId || event.messageId;

        // Signal streaming completion on the stub that was being streamed
        this.sessionService.updateStreamingMessage(streamingStubId, '', true);
```

**Replace with:**
```typescript
        const streamingStubId = event.previousMessageId || event.messageId;

        // Only signal streaming completion if this message is actually being actively streamed.
        // The opencode SSE stream replays all past message.updated events on reconnect,
        // which would fire isDone:true for every historical message. Guard with streamingMessages.
        if (!this.streamingMessages.has(streamingStubId) && !this.streamingMessages.has(event.messageId)) {
            this.logger.debug(`[SyncService] Skipping isDone signal for non-streaming message: ${streamingStubId}`);
            // Still replace the message in case the SSE replay brings updated content.
            const incomingPartsEarly = event.data.parts || [];
            const existingMsgEarly = this.sessionService.messages.find(m => m.id === streamingStubId);
            if (existingMsgEarly && incomingPartsEarly.length > 0) {
                const finalMsgEarly = { ...event.data.info, parts: incomingPartsEarly };
                this.sessionService.replaceMessage(streamingStubId, finalMsgEarly);
            }
            return;
        }

        // Clean up streaming state BEFORE firing isDone.
        // The opencode backend sends multiple message.updated(status=completed) events for the
        // same message during a single response. By removing from streamingMessages first, any
        // subsequent handleMessageCompleted calls for this ID will be blocked by the guard above,
        // ensuring isDone:true fires exactly once per message.
        this.streamingMessages.delete(streamingStubId);
        if (streamingStubId !== event.messageId) {
            this.streamingMessages.delete(event.messageId);
        }

        // Signal streaming completion on the stub that was being streamed
        this.sessionService.updateStreamingMessage(streamingStubId, '', true);
```

And remove the duplicate cleanup block that's currently at the end of the method (lines 402-406):

**Remove:**
```typescript
        // Clean up streaming state
        this.streamingMessages.delete(streamingStubId);
        if (streamingStubId !== event.messageId) {
            this.streamingMessages.delete(event.messageId);
        }
```

### Step 2: Run unit tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit`
Expected: All tests pass.

### Step 3: Build core extension

Run:
```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
```
Expected: No TypeScript errors.

### Step 4: Commit

```bash
git add extensions/openspace-core/src/browser/opencode-sync-service.ts
git commit -m "fix(sync): restore handleMessageCompleted guard to prevent replayed SSE events from firing isDone"
```

---

## Task 4 — Full build and manual verification

### Step 1: Full build

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app build
```

### Step 2: Run all unit tests

```bash
node_modules/.bin/mocha --timeout 10000 --exit
```
Expected: All tests pass.

### Step 3: Restart and manual test

```bash
lsof -ti :3000 | xargs kill -9
yarn --cwd browser-app start &>/tmp/theia-server.log &
```

Manual verification checklist:
- [ ] Send a message that triggers tool use (multi-step turn). The stop button should NOT flicker between steps.
- [ ] Send a short message (quick response). Button should transition cleanly from stop → send after the turn ends.
- [ ] No duplicate assistant messages in the timeline.
- [ ] Streaming text appears correctly during the turn.
- [ ] After the turn completes, the TurnGroup collapses normally and the response shows below it.

### Step 4: Commit (if any build fixes needed)

```bash
git add -A
git commit -m "fix: address build issues from conversation flow bug fixes"
```

---

## Summary

| Task | Bug | Root Cause Fix | Files |
|------|-----|---------------|-------|
| 1 | A | Use `sessionBusy` for send/stop button (turn-level signal) | chat-widget.tsx |
| 2 | B | SSE as single source of truth, RPC as timeout fallback | session-service.ts, tests |
| 3 | — | Restore SSE replay guard in handleMessageCompleted | opencode-sync-service.ts |
| 4 | — | Full build + manual verification | — |

### Why these are root-cause fixes

**Bug A (old approach):** Tried to make the 500ms hysteresis timer "smarter" — but the timer IS working correctly per-message. The problem is that per-message streaming state is the wrong signal for a turn-level UI control (stop button). **New approach:** Use the server-authoritative turn-level signal (`sessionBusy`) that already exists and is already used by the TurnGroup.

**Bug B (old approach):** Added dedup at `appendMessage()` — but the race has TWO channels creating messages with potentially different IDs, and one channel (`sendMessage`) doesn't even go through `appendMessage()`. **New approach:** Eliminate the dual-channel race entirely by making SSE the single source of truth. The RPC result becomes a safety-net fallback that fires only if SSE fails to deliver within 5 seconds.
