# Bug Fixes Round 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 bugs and 2 enhancements found during manual testing of the OpenCode parity implementation.

**Architecture:** All changes are in the `extensions/openspace-chat` (React UI) and `extensions/openspace-core` (services) packages. No new dependencies needed.

**Tech Stack:** React, TypeScript, CSS custom properties (Theia theme vars), contenteditable DOM API

**Build command (run after every task):**
```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build && rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && yarn --cwd browser-app build
```

---

## Bug Reference

| ID | Description |
|----|-------------|
| B1 | Tool cards not grouped — all intermediate steps should be wrapped in a collapsible "turn group" with a vertical sidebar. Expanded while streaming, collapsed to "Show steps · Xs" when done |
| B3/B4 | Slash (`/`) and `@` mention popups invisible — menus render in DOM but parent has `overflow: hidden` clipping them |
| B5 | Stop button doesn't fully reset streaming state — animation/timer keeps running after abort |
| B6 | Question rendering not working — pipeline seems correct; needs debugging + possible session ID mismatch fix |
| B7 | Syntax highlighting uses hard-coded dark colors — needs light-theme-aware CSS variables |
| B8 | Session status spinner has no `@keyframes oc-spin` defined — spinner is invisible |
| E1 | File paths in tool cards should be clickable links that open in Theia editor |
| E3 | Ctrl+U should clear the prompt input |

---

## Task 1: Fix slash/@ popup clipping (B3/B4)

**Root cause:** The `showSlashMenu` and `showTypeahead` popup divs are rendered as children of `.prompt-input-container` which has `overflow: hidden`. They are positioned `absolute` with negative `top` (opening upward), so they're clipped at the top of the container.

**Fix:** Move the popup render out of the clipped inner element. The popup should be a direct child of the **outermost** `.prompt-input-wrap` div (which does not have overflow hidden), positioned relative to it.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx`
- Modify: `extensions/openspace-chat/src/browser/style/prompt-input.css`

**Step 1: Understand the current JSX structure**

Read `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx` lines 700–930 to understand the JSX tree. The structure is roughly:

```
<div className="prompt-input-wrap">           ← outermost, position:relative (or position:static)
  <div className="prompt-input-container">    ← overflow: hidden ← THIS CLIPS
    <div className="prompt-input-editor" />
    {showTypeahead && <div className="prompt-input-typeahead">}   ← clipped!
    {showSlashMenu && <div className="prompt-input-typeahead">}   ← clipped!
    <div className="prompt-input-toolbar" />
  </div>
</div>
```

**Step 2: Move the popup portals to outer wrapper**

Move **both** typeahead render blocks (the `{showTypeahead && ...}` and `{showSlashMenu && ...}` JSX) so they are siblings of `.prompt-input-container`, not children of it. They must be direct children of the outermost wrapper div.

Result structure:
```jsx
<div className="prompt-input-wrap">
  {showTypeahead && filteredTypeahead.length > 0 && (
    <div className="prompt-input-typeahead" ...>...</div>
  )}
  {showSlashMenu && filteredSlashCommands.length > 0 && (
    <div className="prompt-input-typeahead" ...>...</div>
  )}
  <div className="prompt-input-container">
    <div className="prompt-input-editor" ... />
    <div className="prompt-input-toolbar" />
  </div>
</div>
```

**Step 3: Fix CSS positioning**

In `prompt-input.css`, find the `.prompt-input-typeahead` rule and ensure:
- `position: absolute`
- `bottom: 100%` (opens upward above the prompt)
- `left: 0`
- `right: 0` (or a fixed max-width)
- `z-index: 500` (above everything)
- Remove any `top: ...` override

Also ensure the **outer wrapper** `.prompt-input-wrap` has `position: relative` so the absolute popup is anchored to it.

Read the current CSS first:
```bash
grep -n "prompt-input-wrap\|prompt-input-typeahead\|prompt-input-container" extensions/openspace-chat/src/browser/style/prompt-input.css
```

Make the minimal changes needed to the CSS.

**Step 4: Build and verify**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && yarn --cwd browser-app build
```

Kill and restart the server:
```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null; sleep 1; yarn --cwd browser-app start &>/tmp/theia-server.log &
```

Wait 10 seconds, then open http://localhost:3000, click the chat input, type `/`, and confirm a popup appears above the input with the slash commands list.

Type `@` and confirm a popup appears.

**Step 5: Commit**
```bash
git add extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx extensions/openspace-chat/src/browser/style/prompt-input.css
git commit -m "fix(chat): move slash/@ popup out of overflow:hidden parent"
```

---

## Task 2: Fix `@keyframes oc-spin` missing (B8)

**Root cause:** The session status spinner uses `className="session-status-spinner oc-spin"` but no `@keyframes oc-spin` is defined anywhere in `chat-widget.css`. The `spin` keyframe exists (used in `.spinner`) and `sessions-spin` exists, but not `oc-spin`.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/style/chat-widget.css`

**Step 1: Add the `@keyframes oc-spin` animation**

Find the `@keyframes sessions-spin` block in `chat-widget.css` (around line 1295) and add `oc-spin` right before or after it:

```css
@keyframes oc-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}

.openspace-chat-widget .oc-spin {
    animation: oc-spin 1s linear infinite;
}
```

**Step 2: Also improve the spinner appearance**

The current `.session-status-spinner` has no animation style directly. Ensure it gets the spin. The `.oc-spin` class selector above handles it, but verify by reading lines 147–156 of `chat-widget.css`. If the spinner `color` is set to a dim gray, change it to the accent color `var(--oc-accent, #007acc)` for better visibility.

**Step 3: Build and verify**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && yarn --cwd browser-app build
```

Open the app, start a chat session that causes streaming, open the session dropdown and confirm the active session shows a rotating spinner.

**Step 4: Commit**
```bash
git add extensions/openspace-chat/src/browser/style/chat-widget.css
git commit -m "fix(chat): add missing oc-spin keyframe for session status spinner"
```

---

## Task 3: Fix syntax highlighting for light theme (B7)

**Root cause:** The code block CSS uses hard-coded dark colors (`background: #1e1e1e`, `background: #111`) and all token colors are VS Code Dark+ palette. In Theia's light theme these are unreadable (dark text on dark background).

**Fix:** Replace hard-coded colors with CSS custom properties that adapt to light/dark. Use Theia's own variables (`--theia-editor-background`, `--theia-editor-foreground`, `--theia-descriptionForeground`) where available, with fallbacks that work in light mode.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/style/chat-widget.css`

**Step 1: Read the current code block CSS**

Read lines 929–1090 of `chat-widget.css`. The sections to change are:
1. `.md-code-block` — border
2. `.md-code-header` — `background: #111` → replace
3. `.md-code-body` — `background: #1e1e1e`, `color: var(--oc-text, #ccc)` → replace
4. All `.hljs-*` token color rules — replace dark-only colors with adaptive ones

**Step 2: Replace code block container backgrounds**

Replace:
```css
.message-bubble .md-code-header {
    ...
    background: #111;
    border-bottom: 1px solid var(--oc-border, #333);
    ...
    color: var(--oc-text-dim, #858585);
}

.message-bubble .md-code-body {
    ...
    background: #1e1e1e;
    ...
    color: var(--oc-text, #ccc);
    ...
}
```

With:
```css
.message-bubble .md-code-header {
    ...
    background: var(--theia-editorGroupHeader-tabsBackground, var(--theia-sideBar-background, #f3f3f3));
    border-bottom: 1px solid var(--theia-widget-border, var(--theia-contrastBorder, #e0e0e0));
    ...
    color: var(--theia-descriptionForeground, #616161);
}

.message-bubble .md-code-body {
    ...
    background: var(--theia-textCodeBlock-background, var(--theia-editor-background, #f5f5f5));
    ...
    color: var(--theia-editor-foreground, #333333);
    ...
}
```

**Step 3: Replace all hljs token colors with adaptive values**

The token colors need to work in **both** light and dark themes. Use CSS custom properties with light-mode fallbacks. Replace the entire `/* Syntax highlighting */` block (lines 966–1090 approximately) with this adaptive version:

```css
/* ─── Syntax highlighting (highlight.js token classes) ───────── */
/* Token colors use Theia CSS vars with VS Code Light+ fallbacks  */
.message-bubble .md-code-body .hljs {
    color: var(--theia-editor-foreground, #333333);
    background: transparent;
}

.message-bubble .md-code-body .hljs-comment,
.message-bubble .md-code-body .hljs-quote {
    color: var(--theia-editorInlayHint-foreground, #008000);
    font-style: italic;
}

.message-bubble .md-code-body .hljs-keyword,
.message-bubble .md-code-body .hljs-selector-tag {
    color: var(--theia-symbolIcon-keywordForeground, #0000ff);
}

.message-bubble .md-code-body .hljs-built_in,
.message-bubble .md-code-body .hljs-type {
    color: var(--theia-symbolIcon-classForeground, #267f99);
}

.message-bubble .md-code-body .hljs-literal,
.message-bubble .md-code-body .hljs-symbol,
.message-bubble .md-code-body .hljs-bullet {
    color: var(--theia-symbolIcon-constantForeground, #0070c1);
}

.message-bubble .md-code-body .hljs-number {
    color: var(--theia-symbolIcon-numberForeground, #09885a);
}

.message-bubble .md-code-body .hljs-string,
.message-bubble .md-code-body .hljs-regexp {
    color: var(--theia-symbolIcon-stringForeground, #a31515);
}

.message-bubble .md-code-body .hljs-title,
.message-bubble .md-code-body .hljs-section {
    color: var(--theia-symbolIcon-functionForeground, #795e26);
}

.message-bubble .md-code-body .hljs-class .hljs-title,
.message-bubble .md-code-body .hljs-title.class_ {
    color: var(--theia-symbolIcon-classForeground, #267f99);
}

.message-bubble .md-code-body .hljs-function .hljs-title,
.message-bubble .md-code-body .hljs-title.function_ {
    color: var(--theia-symbolIcon-functionForeground, #795e26);
}

.message-bubble .md-code-body .hljs-params {
    color: var(--theia-symbolIcon-variableForeground, #001080);
}

.message-bubble .md-code-body .hljs-attr,
.message-bubble .md-code-body .hljs-attribute {
    color: var(--theia-symbolIcon-variableForeground, #001080);
}

.message-bubble .md-code-body .hljs-variable,
.message-bubble .md-code-body .hljs-template-variable {
    color: var(--theia-symbolIcon-variableForeground, #001080);
}

.message-bubble .md-code-body .hljs-tag {
    color: var(--theia-editor-foreground, #800000);
}

.message-bubble .md-code-body .hljs-name {
    color: var(--theia-symbolIcon-keywordForeground, #800000);
}

.message-bubble .md-code-body .hljs-selector-id,
.message-bubble .md-code-body .hljs-selector-class {
    color: var(--theia-symbolIcon-colorForeground, #800000);
}

.message-bubble .md-code-body .hljs-meta,
.message-bubble .md-code-body .hljs-meta-keyword {
    color: var(--theia-symbolIcon-keywordForeground, #0000ff);
}

.message-bubble .md-code-body .hljs-meta-string {
    color: var(--theia-symbolIcon-stringForeground, #a31515);
}

.message-bubble .md-code-body .hljs-deletion {
    color: var(--theia-gitDecoration-deletedResourceForeground, #a31515);
    background: rgba(215, 58, 73, 0.1);
}

.message-bubble .md-code-body .hljs-addition {
    color: var(--theia-gitDecoration-addedResourceForeground, #28a745);
    background: rgba(40, 167, 69, 0.1);
}

.message-bubble .md-code-body .hljs-emphasis {
    font-style: italic;
}

.message-bubble .md-code-body .hljs-strong {
    font-weight: bold;
}

.message-bubble .md-code-body .hljs-link {
    color: var(--theia-textLink-foreground, #0070c1);
    text-decoration: underline;
}

.message-bubble .md-code-body .hljs-subst,
.message-bubble .md-code-body .hljs-operator,
.message-bubble .md-code-body .hljs-punctuation {
    color: var(--theia-editor-foreground, #333333);
}

.message-bubble .md-code-body .hljs-property {
    color: var(--theia-symbolIcon-variableForeground, #001080);
}
```

**Step 4: Build and verify**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && yarn --cwd browser-app build
```

Restart server, ask the agent for Python/TypeScript/JSON code blocks and confirm: light background, readable token colors (no dark-on-dark).

**Step 5: Commit**
```bash
git add extensions/openspace-chat/src/browser/style/chat-widget.css
git commit -m "fix(chat): use adaptive CSS vars for syntax highlighting in light theme"
```

---

## Task 4: Fix stop button not resetting streaming state (B5)

**Root cause:** `session-service.ts`'s `abort()` method already calls `this.onIsStreamingChangedEmitter.fire(false)` and `this.resetStreamingStatus()`. But the `chat-widget.tsx` subscribed handler may race-condition against a pending timer, and the elapsed-time `intervalRef` in the `ChatWidget` component is not cleared on abort.

**Fix:** In `chat-widget.tsx`, when the streaming subscription fires `false`, explicitly clear the timer ref. Also ensure `message-bubble.tsx`'s tool card "in-progress" animation class is driven purely by `isStreaming` prop, not by internal state that survives the abort.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`

**Step 1: Find the elapsed-time timer**

Run:
```bash
grep -n "intervalRef\|elapsed\|setElapsed\|clearInterval\|setInterval" extensions/openspace-chat/src/browser/chat-widget.tsx
```

The elapsed time is tracked in the assistant message header. It uses a `setInterval` that increments a counter. Find where this interval is started and where it's cleared.

**Step 2: Ensure interval is cleared when isStreaming becomes false**

In the `useEffect` that subscribes to `sessionService.onIsStreamingChanged`, add a call to clear the timer when streaming stops:

```tsx
const streamingStateDisposable = sessionService.onIsStreamingChanged(streaming => {
    setIsStreaming(streaming);
    if (!streaming) {
        // Clear elapsed timer when streaming stops (handles both natural end and abort)
        if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current);
            elapsedIntervalRef.current = undefined;
        }
    }
});
```

**Step 3: Confirm abort clears streaming status text**

In `session-service.ts`, the `abort()` finally block already calls `this.resetStreamingStatus()`. Verify `resetStreamingStatus()` fires `onStreamingStatusChangedEmitter` with `''`. Read lines 1189–1200 of `session-service.ts` to confirm.

**Step 4: Verify the "Thinking" animation stops**

The "Thinking..." pulsing animation in tool cards is driven by the CSS class `.part-thinking-active`. Search for where this class is applied:

```bash
grep -n "part-thinking-active\|thinking.*active" extensions/openspace-chat/src/browser/message-bubble.tsx
```

Confirm it's gated on a prop that responds to `isStreaming`. If it's gated on a local `isStreaming` prop passed from `ChatWidget`, the fix in Step 2 is sufficient.

**Step 5: Build and verify**

Build and restart server. Start a long-running query, press Stop, and confirm:
- The thinking animation disappears immediately
- The status line shows "Ready" (not "Thinking")
- The elapsed timer in the message header stops

**Step 6: Commit**
```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "fix(chat): clear elapsed timer and streaming state on abort"
```

---

## Task 5: Fix question rendering (B6)

**Root cause to verify:** The question pipeline is: SSE `question.asked` → `opencode-proxy.ts:forwardQuestionEvent()` → RPC `onQuestionEvent()` → `opencode-sync-service.ts:onQuestionEvent()` → session ID filter → `sessionService.addPendingQuestion()` → React state → `QuestionDock`.

The most likely failure point is the **session ID filter** in `opencode-sync-service.ts` line 550: `this.sessionService.activeSession?.id !== event.sessionId`. The `event.sessionId` comes from `q.sessionID` in the question event. We need to verify these IDs match.

**Files:**
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts` (add debug logging)
- Possibly modify: `extensions/openspace-core/src/node/opencode-proxy.ts`

**Step 1: Add temporary debug logging**

In `opencode-sync-service.ts`, in the `onQuestionEvent` handler, add:

```typescript
onQuestionEvent(event: QuestionNotification): void {
    try {
        this.logger.info(`[SyncService] Question event: type=${event.type}, requestId=${event.requestId}, sessionId=${event.sessionId}`);
        this.logger.info(`[SyncService] Active session ID: ${this.sessionService.activeSession?.id}`);

        if (this.sessionService.activeSession?.id !== event.sessionId) {
            this.logger.warn(`[SyncService] DROPPING question: event.sessionId=${event.sessionId} !== activeSession.id=${this.sessionService.activeSession?.id}`);
            return;
        }
        // ... rest of handler
```

**Step 2: Build, trigger a question, check logs**

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build && yarn --cwd browser-app build
```

Restart server. Ask the agent a question that will trigger it to ask back (e.g. "I need you to ask me what programming language to use before you proceed"). Watch `cat /tmp/theia-server.log | grep -i question` to see the log output.

**Step 3: Fix if session ID mismatch found**

If the log shows a mismatch, it means the proxy is sending the wrong `sessionId`. Check `opencode-proxy.ts` `forwardQuestionEvent()`:

```typescript
const notification: QuestionNotification = {
    type: 'asked',
    sessionId: q.sessionID,   // ← is this the right field?
    projectId: '',
    requestId: q.id,
    question: q
};
```

Cross-check `QuestionRequest.sessionID` value with what `activeSession.id` returns. Both should be the OpenCode session ID string (not the project ID). If the proxy is sending `projectId` in the `sessionId` field or vice versa, fix it.

**Step 4: Remove debug logging once confirmed working**

Remove the extra `logger.info` lines added in Step 1 (keep only the existing debug level log).

**Step 5: Build and verify**

Ask the agent something that causes it to ask a question. The `QuestionDock` should appear above the prompt input with the question text and answer options.

**Step 6: Commit**
```bash
git add extensions/openspace-core/src/browser/opencode-sync-service.ts extensions/openspace-core/src/node/opencode-proxy.ts
git commit -m "fix(chat): debug and fix question event session ID routing"
```

---

## Task 6: Implement turn grouping — collapse intermediate steps (B1)

This is the most significant UI change. During streaming, everything stays flat (current behavior). Once `isStreaming` becomes false, all "intermediate" parts of a turn (thinking + tool calls) are visually grouped under a collapsible `TurnGroup` component with a vertical left sidebar, and a header showing "Show steps · Xs".

**Design:**
- A "turn" = everything the assistant did between a user message and its final text response
- "Intermediate" parts = all `ToolBlock`, `ThinkingBlock` parts
- "Final" part = the last `text` part rendered as markdown
- While streaming: render flat as now (no change)
- After streaming ends: wrap all intermediate parts in a `<TurnGroup>` component, collapsed by default
- `TurnGroup` header: `> Show steps · 12.4s` where the time is the elapsed time locked at completion
- Clicking the header expands/collapses
- The vertical sidebar line runs the full height of the group when expanded

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`
- Modify: `extensions/openspace-chat/src/browser/style/chat-widget.css`

**Step 1: Find where message parts are rendered**

Read `message-bubble.tsx` lines 1–100 to understand the component structure. Find where `ToolBlock` and thinking parts are rendered. Look for the section that iterates `message.parts`.

Run:
```bash
grep -n "ToolBlock\|ThinkingBlock\|part-thinking\|isStreaming.*prop\|isStreaming.*message" extensions/openspace-chat/src/browser/message-bubble.tsx | head -30
```

**Step 2: Understand how elapsed time is currently tracked**

The message header shows elapsed time during streaming. After streaming ends it shows the final elapsed time. Find where `elapsedSecs` or equivalent is tracked in `message-bubble.tsx`:

```bash
grep -n "elapsed\|timer\|seconds\|duration" extensions/openspace-chat/src/browser/message-bubble.tsx | head -20
```

This value needs to be passed into `TurnGroup` as the locked duration.

**Step 3: Add `TurnGroup` component**

Add this component near the top of `message-bubble.tsx` (before the main `MessageBubble` export):

```tsx
interface TurnGroupProps {
    isStreaming: boolean;
    durationSecs: number;
    children: React.ReactNode;
}

const TurnGroup: React.FC<TurnGroupProps> = ({ isStreaming, durationSecs, children }) => {
    const [expanded, setExpanded] = React.useState(false);

    // While streaming, always show expanded (no collapse)
    if (isStreaming) {
        return (
            <div className="turn-group turn-group-streaming">
                <div className="turn-group-sidebar" />
                <div className="turn-group-body">{children}</div>
            </div>
        );
    }

    // After completion, show collapsed header with toggle
    return (
        <div className={`turn-group ${expanded ? 'turn-group-open' : 'turn-group-closed'}`}>
            <button
                type="button"
                className="turn-group-header"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
            >
                <svg
                    className={`turn-group-chevron ${expanded ? 'expanded' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    width="12" height="12" aria-hidden="true"
                >
                    <path d="m9 18 6-6-6-6"/>
                </svg>
                <span className="turn-group-label">Show steps</span>
                {durationSecs > 0 && (
                    <span className="turn-group-duration">· {durationSecs}s</span>
                )}
            </button>
            {expanded && (
                <div className="turn-group-sidebar-wrap">
                    <div className="turn-group-sidebar" />
                    <div className="turn-group-body">{children}</div>
                </div>
            )}
        </div>
    );
};
```

**Step 4: Separate intermediate parts from final text**

In the part of `MessageBubble` that renders the parts array, change the logic to:

1. Classify each part as "intermediate" or "final":
   - Intermediate: `tool` parts (all tool calls), `thinking` parts
   - Final: the last `text` part (if it has content)
   - If there's ONLY text parts (no tools/thinking), render them all directly without grouping

2. Wrap intermediate parts in `<TurnGroup>`:

```tsx
// Separate parts into intermediate (tools/thinking) and final text
const intermediateParts = parts.filter(p => p.type === 'tool' || p.type === 'thinking' /* etc */);
const finalTextPart = parts.filter(p => p.type === 'text').at(-1);

return (
    <div className="message-bubble assistant">
        {/* Header */}
        {intermediateParts.length > 0 && (
            <TurnGroup isStreaming={isStreaming} durationSecs={elapsedSecs}>
                {intermediateParts.map(part => renderPart(part))}
            </TurnGroup>
        )}
        {finalTextPart && renderFinalText(finalTextPart)}
    </div>
);
```

You'll need to look carefully at the actual part type names and existing render logic to map this correctly. The exact field names may differ — read the actual code first.

**Step 5: Add CSS for TurnGroup**

In `chat-widget.css`, add after the existing tool card CSS:

```css
/* ─── Turn Group (intermediate steps wrapper) ─────────────────── */
.openspace-chat-widget .turn-group {
    position: relative;
    margin: 4px 0 8px 0;
}

.openspace-chat-widget .turn-group-streaming {
    display: flex;
    gap: 0;
}

.openspace-chat-widget .turn-group-streaming .turn-group-sidebar {
    width: 2px;
    background: var(--theia-focusBorder, var(--oc-accent, #007acc));
    opacity: 0.35;
    border-radius: 1px;
    flex-shrink: 0;
    margin-right: 10px;
    align-self: stretch;
}

.openspace-chat-widget .turn-group-streaming .turn-group-body {
    flex: 1;
    min-width: 0;
}

.openspace-chat-widget .turn-group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theia-descriptionForeground, var(--oc-text-dim, #858585));
    font-size: 11px;
    font-family: inherit;
    text-align: left;
    border-radius: 3px;
    width: 100%;
}

.openspace-chat-widget .turn-group-header:hover {
    color: var(--theia-foreground, var(--oc-text, #ccc));
}

.openspace-chat-widget .turn-group-chevron {
    flex-shrink: 0;
    transition: transform 0.15s ease;
}

.openspace-chat-widget .turn-group-chevron.expanded {
    transform: rotate(90deg);
}

.openspace-chat-widget .turn-group-label {
    font-weight: 500;
}

.openspace-chat-widget .turn-group-duration {
    color: var(--theia-descriptionForeground, var(--oc-text-dim, #858585));
}

.openspace-chat-widget .turn-group-sidebar-wrap {
    display: flex;
    gap: 0;
    margin-top: 4px;
}

.openspace-chat-widget .turn-group-sidebar-wrap .turn-group-sidebar {
    width: 2px;
    background: var(--theia-focusBorder, var(--oc-accent, #007acc));
    opacity: 0.35;
    border-radius: 1px;
    flex-shrink: 0;
    margin-right: 10px;
}

.openspace-chat-widget .turn-group-sidebar-wrap .turn-group-body {
    flex: 1;
    min-width: 0;
}
```

**Step 6: Build and verify**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && yarn --cwd browser-app build
```

Restart server. Send a message. While streaming, confirm tool cards appear flat with sidebar line. After completion, confirm they collapse to "Show steps · Xs". Click to expand and confirm the sidebar line and all cards reappear.

**Step 7: Commit**
```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx extensions/openspace-chat/src/browser/style/chat-widget.css
git commit -m "feat(chat): collapse intermediate steps into turn group after streaming"
```

---

## Task 7: File paths as clickable links (E1)

**Goal:** File path subtitles in tool cards (e.g. "Read · /path/to/file.ts") open the file in the Theia editor when clicked.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`

**Step 1: Find how file paths are currently rendered in tool cards**

Run:
```bash
grep -n "subtitle\|filePath\|file.*path\|part-tool-subtitle\|getToolInfo" extensions/openspace-chat/src/browser/message-bubble.tsx | head -30
```

Find the `getToolInfo()` function and how it returns the subtitle (file path). Find where `ToolBlock` renders the subtitle.

**Step 2: Add `onOpenFile` callback prop to MessageBubble/ToolBlock**

`ToolBlock` needs an `onOpenFile: (filePath: string) => void` prop. Trace where `MessageBubble` is called from to understand the prop chain.

**Step 3: Pass `openerService` or a callback from ChatWidget**

In `chat-widget.tsx`, find where `openerService` is injected (search for `@inject(OpenerService)` or `OpenerService`). If it's already injected, create a callback:

```typescript
const handleOpenFile = React.useCallback((filePath: string) => {
    try {
        const uri = new URI(filePath);
        openerService.open(uri);
    } catch (e) {
        console.error('[ChatWidget] Failed to open file:', filePath, e);
    }
}, [openerService]);
```

If `openerService` is not injected, add it:
- In the class body: `@inject(OpenerService) protected readonly openerService: OpenerService;`
- Add the import: `import { OpenerService } from '@theia/core/lib/browser';`

**Step 4: Render subtitle as a button**

In `ToolBlock` (or wherever the subtitle is rendered), change:
```tsx
<span className="part-tool-subtitle">{subtitle}</span>
```
to:
```tsx
{onOpenFile && isFilePath(subtitle) ? (
    <button
        type="button"
        className="part-tool-subtitle part-tool-file-link"
        onClick={e => { e.stopPropagation(); onOpenFile(subtitle); }}
        title={`Open ${subtitle}`}
    >
        {subtitle}
    </button>
) : (
    <span className="part-tool-subtitle">{subtitle}</span>
)}
```

Where `isFilePath` is a simple helper:
```typescript
const isFilePath = (s: string): boolean => s.startsWith('/') || /^[A-Za-z]:\\/.test(s);
```

**Step 5: Add CSS for the file link**

In `chat-widget.css`:
```css
.openspace-chat-widget .part-tool-file-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    opacity: 0.75;
}

.openspace-chat-widget .part-tool-file-link:hover {
    text-decoration: underline;
    opacity: 1;
    color: var(--theia-textLink-foreground, var(--oc-accent, #007acc));
}
```

**Step 6: Build and verify**

Build and restart. Ask agent to read a file. Hover over the file path in the tool card subtitle — it should show a pointer cursor. Click it — the file should open in the main editor.

**Step 7: Commit**
```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx extensions/openspace-chat/src/browser/chat-widget.tsx extensions/openspace-chat/src/browser/style/chat-widget.css
git commit -m "feat(chat): file paths in tool cards open file in editor on click"
```

---

## Task 8: Add Ctrl+U to clear prompt (E3)

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx`

**Step 1: Find the keydown handler**

Run:
```bash
grep -n "handleKeyDown\|onKeyDown\|keydown\|ArrowUp\|ArrowDown" extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx | head -20
```

Find the `handleKeyDown` function.

**Step 2: Add Ctrl+U binding**

In `handleKeyDown`, before the existing key handling logic, add:

```typescript
// Ctrl+U — clear the prompt
if (e.key === 'u' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    clearEditor();
    return;
}
```

Note: `clearEditor` already exists in the component — it resets the editor, attachments, and typeahead state.

**Step 3: Build and verify**

Build and restart. Click the prompt, type some text, press Ctrl+U, and confirm the input is cleared.

**Step 4: Commit**
```bash
git add extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "feat(chat): add Ctrl+U keyboard shortcut to clear prompt"
```

---

## Task 9: Update test plan document

**Files:**
- Modify: `docs/test-input-prompt.md`

**Step 1: Update results and add missing tests**

Update `docs/test-input-prompt.md` to:
1. Mark passing tests as PASS
2. Mark fixed bugs as ready for re-test
3. Add missing test T30 for question rendering:

```markdown
### T30 — Question rendering (QuestionDock)
Ask the agent something that will cause it to ask you a question back
(e.g. "Before you do anything, ask me what programming language to use").
**Expect:** A QuestionDock appears above the prompt input showing the
question text and answer options as buttons. Selecting an option
sends the reply and the dock disappears.
**Result:**
```

**Step 2: Commit**
```bash
git add docs/test-input-prompt.md
git commit -m "docs: update test plan with fixes and add T30 question rendering"
```

---

## Final: Full build verification

After all tasks, run the complete build one more time to confirm everything compiles:

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build && \
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && \
yarn --cwd browser-app build
```

Expected: all three compile with 0 errors, webpack completes with 0 errors.
