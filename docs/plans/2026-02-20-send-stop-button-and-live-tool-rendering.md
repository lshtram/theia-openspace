# Send/Stop Button & Live Tool Block Rendering — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two UI bugs: (1) the send button must transform to a stop button while the agent is working, reverting to send only when the user types; (2) tool/bash blocks must appear in the conversation as they are received over SSE, not only after a page refresh.

**Architecture:**
Issue 1 is a pure React prop-threading change — `PromptInput` gains `isStreaming` + `onStop` props and tracks editor emptiness via `onInput`. Issue 2 requires the sync-service to stop discarding tool parts and instead route them through a new `SessionService` method that upserts parts into the live message and fires `onMessagesChanged`.

**Tech Stack:** TypeScript, React (Theia shared), CSS custom properties, SSE/event-emitter pattern already in place.

---

## Task 1: Add `isStreaming` and `onStop` props to `PromptInputProps`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/types.ts:97-101`

**Step 1: Add two new props to the interface**

In `types.ts`, replace:
```typescript
export interface PromptInputProps {
    onSend: (parts: MessagePart[]) => void | Promise<void>;
    disabled?: boolean;
    placeholder?: string;
    workspaceRoot?: string;
}
```

With:
```typescript
export interface PromptInputProps {
    onSend: (parts: MessagePart[]) => void | Promise<void>;
    onStop?: () => void;
    isStreaming?: boolean;
    disabled?: boolean;
    placeholder?: string;
    workspaceRoot?: string;
}
```

**Step 2: Verify TypeScript compiles (no tests yet — just type check)**

```bash
cd /Users/Shared/dev/theia-openspace
npx tsc --noEmit -p extensions/openspace-chat/tsconfig.json 2>&1 | head -30
```
Expected: no new errors.

**Step 3: Commit**

```bash
git add extensions/openspace-chat/src/browser/prompt-input/types.ts
git commit -m "feat(chat): add isStreaming and onStop props to PromptInputProps"
```

---

## Task 2: Implement send/stop toggle logic in `PromptInput`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx:37-667`

**Step 1: Destructure new props and add `hasContent` state**

Change the component signature at line 37 from:
```typescript
export const PromptInput: React.FC<PromptInputProps> = ({
    onSend,
    disabled = false,
    placeholder = 'Type your message, @mention files/agents, or attach images...',
    workspaceRoot: workspaceRootProp
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imageAttachments, setImageAttachments] = React.useState<ImagePart[]>([]);
    const [fileAttachments, setFileAttachments] = React.useState<FilePart[]>([]);
```

To:
```typescript
export const PromptInput: React.FC<PromptInputProps> = ({
    onSend,
    onStop,
    isStreaming = false,
    disabled = false,
    placeholder = 'Type your message, @mention files/agents, or attach images...',
    workspaceRoot: workspaceRootProp
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imageAttachments, setImageAttachments] = React.useState<ImagePart[]>([]);
    const [fileAttachments, setFileAttachments] = React.useState<FilePart[]>([]);
    const [hasContent, setHasContent] = React.useState(false);
```

**Step 2: Add `handleEditorInput` callback**

Add this function after the `clearEditor` function (around line 78):
```typescript
/**
 * Track whether the editor has any content.
 * Called on every input event on the contenteditable div.
 */
const handleEditorInput = React.useCallback(() => {
    if (!editorRef.current) {
        setHasContent(false);
        return;
    }
    const text = editorRef.current.textContent ?? '';
    const hasAttachments = imageAttachments.length > 0 || fileAttachments.length > 0;
    setHasContent(text.trim().length > 0 || hasAttachments);
}, [imageAttachments, fileAttachments]);
```

**Step 3: Reset `hasContent` in `clearEditor`**

The existing `clearEditor` function clears the editor and resets attachments. Find it (around line 70) and add `setHasContent(false)` at the end:
```typescript
const clearEditor = React.useCallback(() => {
    if (editorRef.current) {
        editorRef.current.innerHTML = '';
    }
    setImageAttachments([]);
    setFileAttachments([]);
    setHasContent(false);  // ← add this line
}, []);
```

**Step 4: Update `handleSendClick` to handle stop**

The existing `handleSendClick` at line 265 only sends. Update it so that when the editor is empty and streaming, it calls `onStop`:
```typescript
const handleSendClick = () => {
    // If agent is working and no content typed, treat click as Stop
    if (isStreaming && !hasContent) {
        onStop?.();
        return;
    }

    if (disabled) return;

    const prompt = getCurrentPrompt();
    
    const hasText = prompt.some(p => p.type === 'text' && p.content.trim().length > 0);
    const hasAttachments = prompt.some(p => p.type === 'file' || p.type === 'agent' || p.type === 'image');

    if (!hasText && !hasAttachments) return;

    const workspaceRoot = workspaceRootProp ?? '';
    const parts = buildRequestParts(prompt, workspaceRoot);

    onSend(parts);
    clearEditor();
};
```

**Step 5: Wire `onInput` to the contenteditable div**

Find the `contenteditable` div in the JSX (search for `contentEditable`). Add the `onInput` handler to it:
```tsx
<div
    ref={editorRef}
    contentEditable
    suppressContentEditableWarning
    className="prompt-input-editor"
    onInput={handleEditorInput}
    onKeyDown={handleKeyDown}
    ...
```

**Step 6: Replace the send button JSX (lines 652–662) with a conditional send/stop button**

Replace:
```tsx
<button
    type="button"
    className="prompt-input-send-button"
    onClick={handleSendClick}
    disabled={disabled}
    title="Send message (Enter)"
>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
</button>
```

With:
```tsx
{(() => {
    const showStop = isStreaming && !hasContent;
    return (
        <button
            type="button"
            className={showStop ? 'prompt-input-send-button prompt-input-stop-button' : 'prompt-input-send-button'}
            onClick={handleSendClick}
            disabled={disabled && !showStop}
            title={showStop ? 'Stop generation' : 'Send message (Enter)'}
            aria-label={showStop ? 'Stop generation' : 'Send message'}
        >
            {showStop ? (
                // Stop icon — filled square
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
            ) : (
                // Send icon — arrow up
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
            )}
        </button>
    );
})()}
```

**Step 7: Verify TypeScript**

```bash
npx tsc --noEmit -p extensions/openspace-chat/tsconfig.json 2>&1 | head -30
```
Expected: no new errors.

**Step 8: Commit**

```bash
git add extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "feat(chat): implement send/stop toggle in PromptInput based on streaming + content state"
```

---

## Task 3: Add stop button CSS

**Files:**
- Modify: `extensions/openspace-chat/src/browser/style/prompt-input.css`

**Step 1: Add `.prompt-input-stop-button` override rule**

After the existing `.prompt-input-send-button:disabled` rule (around line 193), add:
```css
/* ─── Stop button (shown while agent is working and input is empty) ─── */
.prompt-input-stop-button {
    background: var(--oc-red, #c0392b);
}

.prompt-input-stop-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--oc-red, #c0392b) 80%, black);
}
```

**Step 2: Commit**

```bash
git add extensions/openspace-chat/src/browser/style/prompt-input.css
git commit -m "feat(chat): add stop button CSS (red variant of send button)"
```

---

## Task 4: Wire `isStreaming` and `onStop` props in `ChatComponent`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx:594-599`

**Step 1: Pass `isStreaming` and `onStop` to `<PromptInput>`**

Find the `<PromptInput>` render at line 594 and update it from:
```tsx
<PromptInput
    onSend={handleSend}
    disabled={false}
    placeholder={queuedCount > 0 ? `${queuedCount} message${queuedCount > 1 ? 's' : ''} queued — send more...` : 'Type your message, @mention files/agents, or attach images...'}
    workspaceRoot={workspaceRoot}
/>
```

To:
```tsx
<PromptInput
    onSend={handleSend}
    onStop={() => sessionService.abort()}
    isStreaming={isStreaming}
    disabled={false}
    placeholder={queuedCount > 0 ? `${queuedCount} message${queuedCount > 1 ? 's' : ''} queued — send more...` : 'Type your message, @mention files/agents, or attach images...'}
    workspaceRoot={workspaceRoot}
/>
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit -p extensions/openspace-chat/tsconfig.json 2>&1 | head -30
```
Expected: no new errors.

**Step 3: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "feat(chat): wire isStreaming and onStop to PromptInput in ChatComponent"
```

---

## Task 5: Add `updateStreamingMessageParts` to `SessionService`

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts`

**Step 1: Add the new method after `updateStreamingMessage` (around line 868)**

The method needs to upsert tool parts into the message's `parts` array by part `id` and fire `onMessagesChangedEmitter`:

```typescript
/**
 * Upsert tool parts into a streaming message's parts array.
 * Called when message.part.updated SSE events carry tool parts (not text deltas).
 * Fires onMessagesChanged to trigger React re-render.
 *
 * @param messageId - ID of the message to update
 * @param toolParts - Array of tool parts to upsert (matched by part.id)
 */
updateStreamingMessageParts(messageId: string, toolParts: any[]): void {
    if (!toolParts || toolParts.length === 0) return;

    const index = this._messages.findIndex(m => m.id === messageId);
    if (index < 0) {
        this.logger.warn(`[SessionService] updateStreamingMessageParts: message not found: ${messageId}`);
        return;
    }

    const message = this._messages[index];
    const parts = [...(message.parts || [])];

    for (const incoming of toolParts) {
        const existingIndex = parts.findIndex(p => (p as any).id === incoming.id);
        if (existingIndex >= 0) {
            // Replace existing part with updated state
            parts[existingIndex] = incoming;
        } else {
            // Insert tool part before the last text part (if any), otherwise append
            const lastTextIndex = parts.reduce((acc, p, i) => p.type === 'text' ? i : acc, -1);
            if (lastTextIndex >= 0) {
                parts.splice(lastTextIndex, 0, incoming);
            } else {
                parts.push(incoming);
            }
        }
    }

    this._messages[index] = { ...message, parts };
    this.onMessagesChangedEmitter.fire([...this._messages]);
    this.logger.debug(`[SessionService] Tool parts upserted for message: ${messageId}, count=${toolParts.length}`);
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p extensions/openspace-core/tsconfig.json 2>&1 | head -30
```
Expected: no new errors.

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts
git commit -m "feat(core): add updateStreamingMessageParts to SessionService for live tool block rendering"
```

---

## Task 6: Route tool parts in `OpenCodeSyncService.handleMessagePartial`

**Files:**
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts:298-334`

**Step 1: Update `handleMessagePartial` to also handle tool parts**

The current early-return at line 308 discards all events without a text delta, including tool-part updates. Replace the body of `handleMessagePartial` as follows:

```typescript
private handleMessagePartial(event: MessageNotification): void {
    if (!event.data) {
        this.logger.warn('[SyncService] message.partial event missing data');
        return;
    }

    // Route tool parts to live update (these carry no text delta)
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

    // Get or create streaming message tracker
    let stream = this.streamingMessages.get(event.messageId);
    if (!stream) {
        // Received partial before created — auto-initialize tracking
        this.logger.debug(`[SyncService] Auto-initializing streaming tracker for: ${event.messageId}`);
        stream = { text: '' };
        this.streamingMessages.set(event.messageId, stream);

        // Also ensure the message exists in SessionService (append a stub if missing)
        if (event.data.info) {
            this.sessionService.appendMessage(event.data.info);
        }
    }

    // Append delta to accumulated text
    stream.text += delta;

    // Update SessionService with delta
    this.sessionService.updateStreamingMessage(event.messageId, delta, false);

    this.logger.debug(`[SyncService] Message partial: ${event.messageId}, delta=${delta.length} chars`);
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit -p extensions/openspace-core/tsconfig.json 2>&1 | head -30
```
Expected: no new errors.

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/browser/opencode-sync-service.ts
git commit -m "feat(core): route tool parts from SSE into live message state for real-time tool block rendering"
```

---

## Task 7: Manual verification

**Step 1: Build and run the app**

```bash
cd /Users/Shared/dev/theia-openspace
yarn build 2>&1 | tail -20
```

**Step 2: Verify Send/Stop button**

1. Open the chat widget.
2. Start a prompt that triggers agent work (e.g., "list all files in the current directory").
3. While the agent is working: confirm the button shows a **red square (stop)**.
4. Type any character in the input: confirm the button reverts to **blue arrow (send)**.
5. Delete what you typed: confirm the button returns to **red square (stop)**.
6. Click the stop button: confirm the agent stops (status bar shows "Ready", streaming stops).
7. After agent finishes: confirm the button shows the **blue arrow (send)** again.

**Step 3: Verify live tool block rendering**

1. Send a prompt that uses bash: e.g., "run `pwd` in the shell".
2. **Without refreshing**, confirm the bash block appears in the conversation as the agent executes the command — the `>_` header and command output should be visible while streaming.
3. Confirm the shimmer animation is visible on the tool name while the tool is running (`.oc-shimmer` class from `message-bubble.tsx:145`).
4. After the agent finishes, confirm the bash block shows the final output correctly.
5. Reload the page (Cmd+Shift+R) — confirm the rendered output matches what was shown live.

**Step 4: Commit if any cleanup was needed**

```bash
git add -A
git commit -m "fix(chat): post-verification cleanup"
```
