# Chat Streaming UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all message parts (text, tool blocks, reasoning) render in real-time during SSE streaming, suppress step-start/step-finish noise, add an elapsed-time timer to the assistant header, and collapse intermediate parts under a "Show steps" toggle when streaming completes.

**Architecture:** Four independent concerns, tackled in order: (1) fix message-stub auto-creation so tool parts are never dropped; (2) fix `streamingMessageId` so any actively-streamed message is flagged as streaming; (3) suppress step-start/step-finish parts; (4) add elapsed timer; (5) add "Show steps" collapsible that appears after streaming completes.

**Tech Stack:** TypeScript, React hooks (no new deps), Theia ReactWidget, plain CSS variables.

---

## Task 1: Fix message-stub auto-creation for tool-only partial events

**Files:**
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts:305-342`

**Problem:** When a `message.partial` SSE event arrives carrying tool parts but the message stub hasn't been added yet (either `message.created` was not fired or arrived out of order), `updateStreamingMessageParts` logs a warning and silently drops the parts. Tool blocks never appear.

**Step 1: Write the failing test (manual observation only — no unit test harness yet)**

The existing E2E test hook already lets us inject events. To confirm the bug before fixing: in browser DevTools, run:
```js
window.__openspace_test__.injectMessageEvent({
  type: 'partial',
  messageId: 'test-tool-1',
  sessionId: window.__openspace_test__.getLastDispatchedCommand?.()?.args?.[0] ?? '<active-session-id>',
  data: {
    info: { id: 'test-tool-1', role: 'assistant', sessionID: '<id>', time: { created: Date.now() }, parts: [] },
    parts: [{ type: 'tool', id: 'tp-1', tool: 'bash', state: 'running' }]
  }
});
```
Expected: Warning in console "updateStreamingMessageParts: message not found". No tool block visible.

**Step 2: Locate the gap**

In `opencode-sync-service.ts:handleMessagePartial` (line 305–342):
- Lines 307–310: tool parts are extracted and routed to `updateStreamingMessageParts`.
- Lines 322–333: if stream tracker not found, a stub is auto-created for **text** paths only — but this guard runs **after** the tool-part routing at line 309.

The fix: ensure the message stub exists in `_messages` **before** calling `updateStreamingMessageParts`.

**Step 3: Implement the fix**

In `opencode-sync-service.ts`, modify `handleMessagePartial` to auto-create the message stub (just like lines 323–332 already do for text) but move/duplicate that guard to run **before** the tool-part routing:

Replace lines 305–342 with:

```typescript
private handleMessagePartial(event: MessageNotification): void {
    if (!event.data) {
        this.logger.warn('[SyncService] message.partial event missing data');
        return;
    }

    // Ensure streaming tracker and message stub exist before routing any parts.
    // message.created may arrive after the first partial in some race conditions.
    if (!this.streamingMessages.has(event.messageId)) {
        this.logger.debug(`[SyncService] Auto-initializing streaming tracker for: ${event.messageId}`);
        this.streamingMessages.set(event.messageId, { text: '' });
        if (event.data.info) {
            this.sessionService.appendMessage(event.data.info);
        }
    }

    // Route tool parts to live update (these carry no text delta)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolParts = (event.data.parts || []).filter((p: any) => p.type === 'tool');
    if (toolParts.length > 0) {
        this.sessionService.updateStreamingMessageParts(event.messageId, toolParts);
    }

    // Prefer the explicit delta field from the SDK event (set by opencode-proxy from message.part.updated).
    // Fall back to extracting text from parts for backward compatibility.
    const delta = event.delta || this.extractTextDelta(event.data.parts);

    if (!delta) {
        this.logger.debug('[SyncService] No text delta in partial event');
        return;
    }

    const stream = this.streamingMessages.get(event.messageId)!;

    // Append delta to accumulated text
    stream.text += delta;

    // Update SessionService with delta
    this.sessionService.updateStreamingMessage(event.messageId, delta, false);

    this.logger.debug(`[SyncService] Message partial: ${event.messageId}, delta=${delta.length} chars`);
}
```

**Step 4: Verify (manual)**

Repeat the DevTools injection from Step 1. Expected: no warning, tool block appears.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/opencode-sync-service.ts
git commit -m "fix(core): auto-create message stub before routing tool parts in handleMessagePartial"
```

---

## Task 2: Fix `streamingMessageId` to track any actively-streamed message

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx:607`

**Problem:** `streamingMessageId` is derived from `streamingData.keys().next().value`. `streamingData` only has entries for messages that received text deltas (via `onMessageStreaming`). A message that only has tool parts (no text yet) is never in `streamingData`, so `isMessageStreaming` in `MessageTimeline` is false for it — the streaming cursor never shows, and tool blocks don't get the animated state.

**Step 1: Add a `streamingMessageId` state to `ChatComponent`**

We need a way to track "which message ID is currently being streamed" independent of text accumulation. The sync service already tracks `streamingMessages` internally, but we need to surface it to the UI.

The simplest approach with zero new RPC/events: **fire `onMessageStreaming` with an empty delta on tool-part updates so the streaming data map gets the message ID**.

In `session-service.ts:updateStreamingMessageParts` (lines 881–913), add one line after the parts are updated to fire a streaming event with empty delta:

```typescript
// Notify streaming subscribers so MessageTimeline knows which message is active
this.onMessageStreamingEmitter.fire({ messageId, delta: '', isDone: false });
```

This means `streamingData` will have the message ID → `''` when tool parts arrive, making `streamingData.keys().next().value` return the correct message ID.

**Step 2: Implement the change**

In `session-service.ts`, at the end of `updateStreamingMessageParts` (just before the logger.debug line, around line 911):

```typescript
// Notify streaming subscribers so streamingMessageId in ChatComponent reflects tool-only messages
this.onMessageStreamingEmitter.fire({ messageId, delta: '', isDone: false });
```

**Step 3: Build and verify**

```bash
yarn build
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts
git commit -m "fix(core): fire streaming event on tool-part updates so streamingMessageId stays accurate"
```

---

## Task 3: Suppress `step-start` and `step-finish` parts

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx:53-56`

**Problem:** `renderStepStartPart` renders a `> Step` breadcrumb and `renderStepFinishPart` renders a `✓ done` line. These are noise — the OpenCode reference app suppresses them entirely (no renderer registered).

**Step 1: Implement**

In `message-bubble.tsx`, replace the `renderPart` switch cases for `step-start` and `step-finish`:

```typescript
case 'step-start':
    return null;
case 'step-finish':
    return null;
```

Also remove the now-unused `renderStepStartPart` and `renderStepFinishPart` functions (lines 211–233).

**Step 2: Build**

```bash
yarn build
```

Expected: 0 errors (the functions are only called from the switch, so removing them is safe).

**Step 3: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx
git commit -m "feat(chat): suppress step-start and step-finish parts (render nothing)"
```

---

## Task 4: Elapsed-time timer in assistant message header

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`

**Goal:** While `isStreaming=true`, show elapsed seconds (`0:03`) in the assistant header instead of the wall-clock timestamp. When streaming completes (`isStreaming` flips false), freeze at the final elapsed value.

**Design:**
- `useRef` to store the start time (set once when `isStreaming` first becomes true).
- `useState(0)` for elapsed seconds.
- `useEffect` with `setInterval(1000)` that only runs while `isStreaming`.
- Format: `m:ss` (e.g. `0:03`, `1:02`).
- When `isStreaming` goes false: interval clears, `elapsedSecs` state stays at last value.
- When component remounts (new message): refs/state reset.

**Step 1: Add the timer hook inside `MessageBubble`**

In `message-bubble.tsx`, modify the `MessageBubble` component (around line 271):

```tsx
export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isUser,
    isStreaming = false,
    streamingText = '',
    isFirstInGroup = true,
    isLastInGroup = true,
}) => {
    const parts = message.parts || [];
    const timestamp = message.time?.created ? formatTimestamp(message.time.created) : '';

    // ── Elapsed timer ──────────────────────────────────────────────────
    const [elapsedSecs, setElapsedSecs] = React.useState(0);
    const streamStartRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (!isStreaming) return;
        // Record start time on first streaming tick
        if (streamStartRef.current === null) {
            streamStartRef.current = Date.now();
        }
        const id = setInterval(() => {
            const elapsed = Math.floor((Date.now() - streamStartRef.current!) / 1000);
            setElapsedSecs(elapsed);
        }, 1000);
        return () => clearInterval(id);
    }, [isStreaming]);

    // Reset timer when a new message starts (message.id changes)
    const prevMessageIdRef = React.useRef(message.id);
    React.useEffect(() => {
        if (prevMessageIdRef.current !== message.id) {
            prevMessageIdRef.current = message.id;
            streamStartRef.current = null;
            setElapsedSecs(0);
        }
    }, [message.id]);

    const formatElapsed = (secs: number): string => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };
    // ─────────────────────────────────────────────────────────────────

    const hasParts = parts.length > 0;
    // ...
```

In the header JSX, replace the timestamp span:

```tsx
{/* Show elapsed timer while streaming; show wall-clock timestamp otherwise */}
{(isStreaming || elapsedSecs > 0) ? (
    <span className="message-bubble-timestamp message-bubble-elapsed">
        {formatElapsed(elapsedSecs)}
    </span>
) : (
    timestamp && <span className="message-bubble-timestamp">{timestamp}</span>
)}
```

**Step 2: Add CSS for elapsed timer (optional — reuse `.message-bubble-timestamp`)**

No new CSS required; `.message-bubble-timestamp` already exists in the chat stylesheet. Add `.message-bubble-elapsed` in `style/chat.css` if a distinct color is desired:

```css
.message-bubble-elapsed {
    font-variant-numeric: tabular-nums;
    color: var(--oc-accent, #007acc);
}
```

**Step 3: Build**

```bash
yarn build
```

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx \
        extensions/openspace-chat/src/browser/style/chat.css
git commit -m "feat(chat): add elapsed-time timer to assistant message header during streaming"
```

---

## Task 5: "Show steps" collapsible after streaming completes

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`
- Modify: `extensions/openspace-chat/src/browser/style/chat.css`

**Goal:** While streaming, show all parts inline (tool blocks, reasoning, text). When streaming completes (`isStreaming` was true, now false), wrap all non-final-text parts in a collapsed `<details>`-style toggle labelled "Show steps". Only the last `text` part stays visible outside the toggle.

**Design:**
- Track `wasStreaming` with a `useRef` — set to `true` when `isStreaming` becomes true, cleared on `message.id` change.
- "Steps" = all parts **except** the last `text` part. The last `text` part is always shown outside.
- While streaming: render all parts inline, no toggle.
- After streaming (`!isStreaming && wasStreaming`): show collapsed `<details>` for step parts, then final text below.
- `wasStreaming` persists across re-renders (ref, not state) so the toggle remains after streaming ends.

**Step 1: Implement in `MessageBubble`**

Add `wasStreamingRef` and `showStepsOpen` state inside `MessageBubble`, after the timer code:

```tsx
// ── Show Steps collapsible ─────────────────────────────────────
const wasStreamingRef = React.useRef(false);
const [showStepsOpen, setShowStepsOpen] = React.useState(false);

React.useEffect(() => {
    if (isStreaming) {
        wasStreamingRef.current = true;
    }
}, [isStreaming]);
// ─────────────────────────────────────────────────────────────────
```

Modify the content rendering inside `<div className="message-bubble-content">`:

```tsx
<div className="message-bubble-content">
    {(() => {
        if (!hasParts) {
            return (
                <>
                    {'\u00A0'}
                    {streamingText && <div className="part-text">{streamingText}</div>}
                    {isStreaming && <span className="message-streaming-cursor" aria-hidden="true">&#x258B;</span>}
                </>
            );
        }

        // Find the last text part index
        const lastTextIdx = parts.reduce((acc, p, i) => p.type === 'text' ? i : acc, -1);
        const stepParts = lastTextIdx >= 0 ? parts.slice(0, lastTextIdx) : parts;
        const finalTextPart = lastTextIdx >= 0 ? parts[lastTextIdx] : null;

        // During streaming: show everything inline
        if (isStreaming || !wasStreamingRef.current) {
            return (
                <>
                    {parts.map((part, i) => renderPart(part, i))}
                    {streamingText && <div className="part-text">{streamingText}</div>}
                    {isStreaming && <span className="message-streaming-cursor" aria-hidden="true">&#x258B;</span>}
                </>
            );
        }

        // After streaming: collapse step parts, show only final text
        const hasSteps = stepParts.length > 0;
        return (
            <>
                {hasSteps && (
                    <div className="show-steps-toggle">
                        <button
                            type="button"
                            className="show-steps-button"
                            onClick={() => setShowStepsOpen(o => !o)}
                            aria-expanded={showStepsOpen}
                        >
                            <svg
                                className={`show-steps-chevron ${showStepsOpen ? 'open' : ''}`}
                                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                width="10" height="10" aria-hidden="true"
                            >
                                <path d="m9 18 6-6-6-6"/>
                            </svg>
                            {showStepsOpen ? 'Hide steps' : 'Show steps'}
                        </button>
                        {showStepsOpen && (
                            <div className="show-steps-content">
                                {stepParts.map((part, i) => renderPart(part, i))}
                            </div>
                        )}
                    </div>
                )}
                {finalTextPart && renderPart(finalTextPart, lastTextIdx)}
                {streamingText && <div className="part-text">{streamingText}</div>}
            </>
        );
    })()}
</div>
```

**Step 2: Add CSS**

In `extensions/openspace-chat/src/browser/style/chat.css`, add:

```css
/* ── Show Steps toggle ────────────────────────────────────────── */
.show-steps-toggle {
    margin-bottom: 8px;
}

.show-steps-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theia-descriptionForeground, var(--oc-text-dim));
    font-size: 11px;
    font-family: var(--theia-ui-font-family);
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.1s, background 0.1s;
}

.show-steps-button:hover {
    color: var(--theia-foreground, var(--oc-text));
    background: rgba(255,255,255,0.06);
}

.show-steps-chevron {
    transition: transform 0.15s ease;
    transform: rotate(0deg);
}

.show-steps-chevron.open {
    transform: rotate(90deg);
}

.show-steps-content {
    margin-top: 6px;
    padding-left: 4px;
    border-left: 2px solid rgba(255,255,255,0.08);
}
```

**Step 3: Build**

```bash
yarn build
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx \
        extensions/openspace-chat/src/browser/style/chat.css
git commit -m "feat(chat): add Show Steps collapsible for intermediate parts after streaming completes"
```

---

## Final check

After all tasks are committed, do a full build to confirm no regressions:

```bash
yarn build
```

Expected: exits 0 with no TypeScript errors.
