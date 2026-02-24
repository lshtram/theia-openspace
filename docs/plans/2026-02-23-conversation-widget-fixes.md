# Conversation Widget Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 9 verified bugs proven by failing regression tests, plus 2 architectural issues (dual-level response separation, triple timer system), and 2 additional findings (H3 subscription churn, H4 shell output ordering).

**Architecture:** Tasks are ordered dependency-first: targeted fixes (independent components) come first, then the architectural rewrites (message-bubble + message-timeline) which are interdependent. Each task is self-contained and commits independently. The 18 regression tests in `bug-regression.spec.ts` serve as the acceptance criteria — all 18 must pass when done.

**Tech Stack:** React 18 (JSX via `@theia/core/shared/react`), TypeScript, DOMPurify (`@theia/core/shared/dompurify`), markdown-it, mocha/chai/sinon for tests.

**Test command:**
```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings 'extensions/openspace-chat/src/browser/__tests__/*.spec.ts'
```

**Build command:**
```bash
cd /Users/Shared/dev/theia-openspace && npx tsc -p extensions/openspace-chat/tsconfig.json --noEmit
```

---

## Task 1: Fix clipboard `.catch()` in markdown-renderer (M1)

**Findings:** M1 — `navigator.clipboard.writeText().then()` without `.catch()` in CodeBlock (line 276) and AnsiBlock (line 226).

**Files:**
- Modify: `extensions/openspace-chat/src/browser/markdown-renderer.tsx:225-229, 275-279`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group G)

**Step 1: Fix AnsiBlock copy handler**

In `markdown-renderer.tsx`, replace the `copy` function inside `AnsiBlock` (lines 225-229):

```tsx
// BEFORE (line 225-229):
const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    });
};

// AFTER:
const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
        // Clipboard write failed (e.g. permissions denied, non-secure context)
        // Silently fail — button stays in "Copy" state
    });
};
```

**Step 2: Fix CodeBlock copy handler**

In `markdown-renderer.tsx`, replace the `copy` function inside `CodeBlock` (lines 275-279):

```tsx
// BEFORE (line 275-279):
const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    });
};

// AFTER:
const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
        // Clipboard write failed (e.g. permissions denied, non-secure context)
    });
};
```

**Step 3: Run tests to verify Group G passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group G" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: Both Group G tests PASS.

**Step 4: Run full test suite**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings 'extensions/openspace-chat/src/browser/__tests__/*.spec.ts'
```

Expected: All existing tests still pass. Group G tests now pass (2 more green).

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/markdown-renderer.tsx
git commit -m "fix(markdown): add .catch() to clipboard copy handlers (M1)"
```

---

## Task 2: Fix linkifyFilePaths inside `<code>` blocks (M2)

**Findings:** M2 — `linkifyFilePaths` processes text inside inline `<code>` elements because it only splits on raw HTML tags but doesn't track whether a text segment is inside a `<code>` element.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/markdown-renderer.tsx:343-361`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group C)

**Step 1: Update linkifyFilePaths to skip code elements**

Replace the `linkifyFilePaths` function (lines 343-361) with a version that tracks whether we're inside `<code>` or `<pre>` tags:

```tsx
function linkifyFilePaths(html: string): string {
    const FILE_PATH_RE = /(?<!["\\'=])((?:\/[^\s/<>"']+){2,}|(?:[A-Za-z]:[/\\][^\s<>"']+[/\\][^\s<>"']+))/g;

    // Split on HTML tags so we never touch attribute values or tag contents.
    // Odd-indexed parts are tags; even-indexed parts are text between tags.
    const parts = html.split(/(<[^>]*>)/);
    let insideCode = 0; // nesting depth for <code> and <pre> elements

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) {
            // This is a tag — track <code>/<pre> nesting
            const tag = parts[i];
            if (/^<(code|pre)[\s>]/i.test(tag)) {
                insideCode++;
            } else if (/^<\/(code|pre)>/i.test(tag)) {
                insideCode = Math.max(0, insideCode - 1);
            }
        } else if (insideCode === 0) {
            // Even index = text content between tags, and NOT inside <code>/<pre>
            parts[i] = parts[i].replace(FILE_PATH_RE, (path) => {
                const encoded = path.replace(/&amp;/g, '&').split('').map(c =>
                    encodeURIComponent(c).replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%5C/g, '\\')
                ).join('');
                return `<a href="file://${encoded}" class="md-file-link">${path}</a>`;
            });
        }
        // If insideCode > 0 and even index, skip — don't linkify inside code
    }
    return parts.join('');
}
```

**Step 2: Run tests to verify Group C passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group C" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: All 3 Group C tests PASS (including the previously failing "should NOT linkify file paths inside inline code" test).

**Step 3: Run full test suite**

Expected: All tests pass. 1 more green in Group C.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/markdown-renderer.tsx
git commit -m "fix(markdown): skip linkifyFilePaths inside <code>/<pre> elements (M2)"
```

---

## Task 3: Fix XSS in prompt-input history innerHTML (C1)

**Findings:** C1 — Lines 361-362, 385, and 396 in `prompt-input.tsx` set `editorRef.current.innerHTML` from history/draft data without sanitization.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx:355-405`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group D)

**Step 1: Add DOMPurify import to prompt-input.tsx**

At the top of `prompt-input.tsx`, find the existing imports and add DOMPurify. It's already available as a shared dependency:

```tsx
// Add near the top imports:
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('@theia/core/shared/dompurify');
```

**Step 2: Create a sanitization helper**

Add a helper function near the top of the file (after imports, before the component):

```tsx
/**
 * Sanitize HTML content from prompt history before restoring it into the editor.
 * Allows structural elements (spans for pills, div for structure) but strips
 * scripts, event handlers, and other XSS vectors.
 */
function sanitizeEditorHTML(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['span', 'div', 'br', 'img'],
        ALLOWED_ATTR: ['class', 'data-type', 'data-value', 'data-display', 'contenteditable', 'title', 'alt', 'src'],
        ALLOW_DATA_ATTR: true,
    });
}
```

**Step 3: Apply sanitization at line 362**

Replace `editorRef.current.innerHTML = entry.html;` (line 362) with:

```tsx
editorRef.current.innerHTML = sanitizeEditorHTML(entry.html);
```

**Step 4: Apply sanitization at line 385**

Replace `editorRef.current.innerHTML = savedDraft;` (line 385) with:

```tsx
editorRef.current.innerHTML = sanitizeEditorHTML(savedDraft);
```

**Step 5: Apply sanitization at line 396**

Replace `editorRef.current.innerHTML = entry.html;` (line 396) with:

```tsx
editorRef.current.innerHTML = sanitizeEditorHTML(entry.html);
```

**Step 6: Run tests to verify Group D passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group D" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: All 3 Group D tests PASS.

**Step 7: Run full test suite**

Expected: All tests pass. 3 more green in Group D.

**Step 8: Commit**

```bash
git add extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "fix(prompt-input): sanitize innerHTML on history restore to prevent XSS (C1)"
```

---

## Task 4: Fix QuestionDock empty submit guard (H2)

**Findings:** H2 — Submit button on confirm tab has no `disabled` guard. Users can submit with zero answers.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/question-dock.tsx:419-425`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group E)

**Step 1: Add disabled guard to Submit button**

In `question-dock.tsx`, replace the Submit button (lines 419-425):

```tsx
// BEFORE:
<button
    type="button"
    className="qdock-btn-accent"
    onClick={handleSubmit}
>
    Submit
</button>

// AFTER:
<button
    type="button"
    className="qdock-btn-accent"
    onClick={handleSubmit}
    disabled={answers.every(a => a.length === 0)}
>
    Submit
</button>
```

The `answers` variable is the state `answers: string[][]` — one array per question. `answers.every(a => a.length === 0)` is true when no question has any selected answer.

**Step 2: Run tests to verify Group E passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group E" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: Both Group E tests PASS.

**Step 3: Run full test suite**

Expected: All tests pass. 1 more green in Group E.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/question-dock.tsx
git commit -m "fix(question-dock): disable submit when no answers selected (H2)"
```

---

## Task 5: Add keyboard navigation to ModelSelector (H1)

**Findings:** H1 — `handleKeyDown` only handles Escape and Enter/Space. No ArrowDown/ArrowUp for navigating dropdown items. WCAG 2.1 violation.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/model-selector.tsx:170-197`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group F)

**Step 1: Add focusedIndex state**

Add a new state variable for tracking the focused option index. Find the state declarations near the top of the component and add:

```tsx
const [focusedIndex, setFocusedIndex] = React.useState(-1);
```

**Step 2: Build a flat list of all selectable model IDs**

Add a memo that computes a flat list of selectable model IDs (needed for ArrowDown/ArrowUp):

```tsx
// Flat ordered list of model IDs for keyboard navigation
const flatModelIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const provider of providers) {
        for (const modelId of Object.keys(provider.models)) {
            ids.push(`${provider.id}/${modelId}`);
        }
    }
    return ids;
}, [providers]);
```

**Step 3: Reset focusedIndex when dropdown opens/closes**

In the existing `handleOpen` and `handleClose` callbacks, add a reset:

```tsx
// In handleOpen, add:
setFocusedIndex(-1);

// In handleClose, add:
setFocusedIndex(-1);
```

**Step 4: Replace handleKeyDown with full arrow key support**

Replace the `handleKeyDown` callback (lines 184-197):

```tsx
const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
        }
        return;
    }

    switch (e.key) {
        case 'Escape':
            e.preventDefault();
            handleClose();
            break;
        case 'ArrowDown':
            e.preventDefault();
            setFocusedIndex(prev => {
                const next = prev + 1;
                return next < flatModelIds.length ? next : prev;
            });
            break;
        case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex(prev => {
                const next = prev - 1;
                return next >= 0 ? next : prev;
            });
            break;
        case 'Home':
            e.preventDefault();
            setFocusedIndex(0);
            break;
        case 'End':
            e.preventDefault();
            setFocusedIndex(flatModelIds.length - 1);
            break;
        case 'Enter':
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < flatModelIds.length) {
                handleSelect(flatModelIds[focusedIndex]);
            }
            break;
    }
}, [isOpen, handleOpen, handleClose, handleSelect, flatModelIds, focusedIndex]);
```

**Step 5: Apply focused class to model options**

In the dropdown rendering, where model options are rendered (likely as `<li>` or `<div>` with className `model-option`), add a `focused` class when the option's index matches `focusedIndex`. The exact implementation depends on how model options are rendered — find the model option element and add:

```tsx
className={`model-option${flatModelIds.indexOf(`${provider.id}/${modelId}`) === focusedIndex ? ' focused' : ''}`}
```

Also add ARIA attribute `aria-activedescendant` to the pill button when an option is focused.

**Step 6: Run tests to verify Group F passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group F" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: All 3 Group F tests PASS.

**Step 7: Run full test suite**

Expected: All tests pass. 3 more green in Group F.

**Step 8: Commit**

```bash
git add extensions/openspace-chat/src/browser/model-selector.tsx
git commit -m "fix(model-selector): add ArrowDown/ArrowUp keyboard navigation for dropdown (H1)"
```

---

## Task 6: Fix groupParts indexOf bug (M9)

**Findings:** M9 — `groupParts` at lines 943 and 956 uses `parts.indexOf(contextBuffer[0])` instead of tracking the loop index.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx:928-963`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group A)

**Step 1: Fix groupParts to track indices correctly**

Replace the `groupParts` function (lines 928-963):

```tsx
function groupParts(parts: MessagePart[]): Array<{ type: 'single'; part: MessagePart; index: number } | { type: 'context-group'; parts: MessagePart[] }> {
    const result: Array<{ type: 'single'; part: MessagePart; index: number } | { type: 'context-group'; parts: MessagePart[] }> = [];
    let contextBuffer: Array<{ part: MessagePart; index: number }> = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isContextTool = part.type === 'tool' && CONTEXT_TOOL_NAMES.test((part as any).tool || '');

        if (isContextTool) {
            contextBuffer.push({ part, index: i });
        } else {
            // Flush any accumulated context tools
            if (contextBuffer.length > 0) {
                if (contextBuffer.length === 1) {
                    // Single context tool — render normally, using tracked index
                    result.push({ type: 'single', part: contextBuffer[0].part, index: contextBuffer[0].index });
                } else {
                    result.push({ type: 'context-group', parts: contextBuffer.map(b => b.part) });
                }
                contextBuffer = [];
            }
            result.push({ type: 'single', part, index: i });
        }
    }

    // Flush remaining
    if (contextBuffer.length > 0) {
        if (contextBuffer.length === 1) {
            result.push({ type: 'single', part: contextBuffer[0].part, index: contextBuffer[0].index });
        } else {
            result.push({ type: 'context-group', parts: contextBuffer.map(b => b.part) });
        }
    }

    return result;
}
```

Key change: `contextBuffer` now stores `{ part, index: i }` pairs instead of bare parts, and uses `contextBuffer[0].index` instead of `parts.indexOf(contextBuffer[0])`.

**Step 2: Run tests to verify Group A passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group A" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: Both Group A tests PASS.

**Step 3: Run full test suite + type check**

```bash
cd /Users/Shared/dev/theia-openspace && npx tsc -p extensions/openspace-chat/tsconfig.json --noEmit
```

Expected: No type errors.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx
git commit -m "fix(message-bubble): use loop index in groupParts instead of indexOf (M9)"
```

---

## Task 7: Eliminate dual-level response separation (M7/UB1/UB2)

**Findings:** M7 — Response/steps separation exists at TWO levels (MessageTimeline lines 374-463 AND MessageBubble lines 1029-1147). This causes duplicate rendering and thinking content leaking into the response area.

**Architecture decision:** Keep the separation at the **MessageTimeline level** (outer) and **remove it from MessageBubble** (inner). Rationale: MessageTimeline has the full run context (all messages in the assistant run) and can correctly identify the final response. MessageBubble should just render what it's given.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx:1029-1147`
- Test: `extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts` (Group B)

**Step 1: Remove inner separation logic from MessageBubbleInner**

In `message-bubble.tsx`, replace the entire section from line 1029 (`const hasIntermediateParts = ...`) through the end of the render function. The new `MessageBubbleInner` render body should be simpler — it always renders all parts flat (using `groupParts` for context-tool grouping), with no inner TurnGroup:

Remove these useMemo blocks (lines 1029-1065):
- `hasIntermediateParts`
- `lastTextPartIndex`
- `intermediateParts`
- `finalTextPartWithIndex`
- `groupedIntermediateParts`
- `groupedAllParts`

Replace the content section (inside `<div className="message-bubble-content">`, lines 1114-1144) with:

```tsx
<div className="message-bubble-content">
    {groupParts(parts).map((group, gi) => {
        if (group.type === 'context-group') {
            return <ContextToolGroup key={`ctx-group-${gi}`} parts={group.parts} />;
        }
        return renderPart(group.part, group.index, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile);
    })}
    {retryInfo && <RetryBanner retryInfo={retryInfo} />}
    {isStreaming && <span className="message-streaming-cursor" aria-hidden="true">&#x258B;</span>}
</div>
```

This makes MessageBubble a pure renderer: it renders whatever parts it receives, with context-tool grouping. No separation logic. The separation is handled exclusively by MessageTimeline (which filters parts before passing them to MessageBubble).

**Step 2: Also simplify the isIntermediateStep path**

The `isIntermediateStep` block (lines 1069-1081) can stay as-is — it also does pure flat rendering, which is correct.

**Step 3: Run tests to verify Group B passes**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings --grep "Group B" 'extensions/openspace-chat/src/browser/__tests__/bug-regression.spec.ts'
```

Expected: All 3 Group B tests PASS (no duplicates, no inner TurnGroup in intermediate mode).

**Step 4: Run full test suite + type check**

```bash
cd /Users/Shared/dev/theia-openspace && npx tsc -p extensions/openspace-chat/tsconfig.json --noEmit
```

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx
git commit -m "fix(message-bubble): remove inner response separation — single source of truth in timeline (M7/UB1/UB2)"
```

---

## Task 8: Consolidate timer systems (M8/UB3)

**Findings:** M8 — Three independent timer systems: TurnGroup timer (line 806-815), MessageBubble timer (line 1002-1010), and MessageTimeline duration computation (line 364-372). The TurnGroup timer resets when `isStreaming` flickers.

**Architecture decision:** 
- **Keep** the MessageTimeline server-timestamp duration computation (lines 364-372) — this is correct and used for the TurnGroup `durationSecs` prop.
- **Keep** the MessageBubble per-message timer (lines 1002-1010) — this is the header elapsed time for individual bubbles and is server-timestamp driven.
- **Remove** the TurnGroup's independent `streamStartRef + setInterval` timer (lines 806-815). Instead, have TurnGroup receive its elapsed time as a prop during streaming.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx:764-870` (TurnGroup component)
- Modify: `extensions/openspace-chat/src/browser/message-timeline.tsx:352-442` (pass elapsed prop)

**Step 1: Remove TurnGroup's internal timer**

In `message-bubble.tsx`, modify the TurnGroup component to remove its own timer and use `durationSecs` for both streaming and completed states. Remove the `streamStartRef`, `elapsed` state, and the timer effect (lines 791-815).

Replace the TurnGroup component:

```tsx
export const TurnGroup: React.FC<TurnGroupProps> = ({ isStreaming, durationSecs, streamingStatus, children }) => {
    const [showExpanded, setShowExpanded] = React.useState(isStreaming);
    const wasStreamingRef = React.useRef(isStreaming);

    React.useEffect(() => {
        if (isStreaming) {
            wasStreamingRef.current = true;
            setShowExpanded(true);
        } else if (wasStreamingRef.current) {
            wasStreamingRef.current = false;
            setShowExpanded(false);
        }
    }, [isStreaming]);

    // While streaming: always show expanded with trigger bar
    if (isStreaming) {
        return (
            <div className="turn-group turn-group-streaming">
                <div className="turn-group-trigger-bar">
                    <svg className="turn-group-chevron-indicator" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        width="10" height="10" aria-hidden="true">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                    <span className="turn-group-status">{streamingStatus || 'Thinking'}</span>
                    {durationSecs > 0 && (
                        <span className="turn-group-duration">· {formatElapsed(durationSecs)}</span>
                    )}
                </div>
                <div className="turn-group-streaming-content">
                    <div className="turn-group-sidebar" />
                    <div className="turn-group-body">{children}</div>
                </div>
            </div>
        );
    }

    // After completion: collapsed header with toggle
    return (
        <div className={`turn-group ${showExpanded ? 'turn-group-open' : 'turn-group-closed'}`}>
            <button
                type="button"
                className="turn-group-header"
                onClick={() => setShowExpanded(v => !v)}
                aria-expanded={showExpanded}
            >
                <svg
                    className={`turn-group-chevron ${showExpanded ? 'expanded' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    width="12" height="12" aria-hidden="true"
                >
                    <path d="m9 18 6-6-6-6"/>
                </svg>
                <span className="turn-group-label">{showExpanded ? 'Hide steps' : 'Show steps'}</span>
                {durationSecs > 0 && (
                    <span className="turn-group-duration">· {formatElapsed(durationSecs)}</span>
                )}
            </button>
            {showExpanded && (
                <div className="turn-group-sidebar-wrap">
                    <div className="turn-group-sidebar" />
                    <div className="turn-group-body">{children}</div>
                </div>
            )}
        </div>
    );
};
```

**Step 2: Add live elapsed computation to MessageTimeline**

In `message-timeline.tsx`, the `totalDurationSecs` computation (lines 364-372) only works with completed messages (it needs `time.completed`). During streaming, we need a live counter. Add a live timer inside the assistant-run rendering:

After line 372 (the `totalDurationSecs` computation), add a live elapsed calculation for streaming runs:

```tsx
// For streaming runs, compute live elapsed from the first message's createdAt
const firstCreatedAt = (() => {
    for (const idx of indices) {
        const c = messages[idx].time?.created;
        if (c) return typeof c === 'number' ? c : new Date(c).getTime();
    }
    return 0;
})();
```

Then in the component, add a `now` state driven by a single timer (shared across all runs). The simplest approach: add a `now` state + effect at the top of `MessageTimeline`:

```tsx
// Live timer for streaming duration
const [now, setNow] = React.useState(Date.now());
React.useEffect(() => {
    if (!sessionActiveLatch) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
}, [sessionActiveLatch]);
```

Then the `durationSecs` passed to TurnGroup becomes:

```tsx
const liveDurationSecs = isRunStreaming && firstCreatedAt
    ? Math.max(0, Math.floor((now - firstCreatedAt) / 1000))
    : totalDurationSecs;
```

And pass `liveDurationSecs` to TurnGroup instead of `totalDurationSecs`.

**Step 3: Run full test suite + type check**

```bash
cd /Users/Shared/dev/theia-openspace && npx tsc -p extensions/openspace-chat/tsconfig.json --noEmit && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings 'extensions/openspace-chat/src/browser/__tests__/*.spec.ts'
```

Expected: All tests pass. The `useLatchedBool` tests in `message-timeline.spec.ts` still pass (TurnGroup timer tests may need adjustment if they existed — check).

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx extensions/openspace-chat/src/browser/message-timeline.tsx
git commit -m "fix(timer): consolidate to single timer source — remove TurnGroup internal timer (M8/UB3)"
```

---

## Task 9: Fix loadSessions subscription churn (H3)

**Findings:** H3 — `loadSessions` is in the dependency array of the main useEffect (line 601) but is recreated on every render (defined inside the component without useCallback wrapping with the right deps).

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx:420-445, 601`

**Step 1: Check current loadSessions definition**

`loadSessions` (around line 420-445) is wrapped in `useCallback` with `[sessionService]` deps. The problem is it's listed in the main useEffect deps (line 601) which also lists `sessionService` — so when `sessionService` changes, both `loadSessions` AND the effect fire, causing double teardown.

Fix: remove `loadSessions` from the effect's dependency array. Since `loadSessions` is only called inside the effect as an initial load and from the subscription callbacks, and the effect already depends on `sessionService` (which is the only dep of `loadSessions`), removing it is safe.

**Step 2: Remove loadSessions from useEffect deps**

In `chat-widget.tsx` line 601:

```tsx
// BEFORE:
}, [sessionService, loadSessions]);

// AFTER:
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionService]);
```

The `loadSessions` ref is stable when `sessionService` doesn't change (it's wrapped in useCallback with `[sessionService]`). When `sessionService` changes, the effect already re-runs because `sessionService` is in deps.

**Step 3: Run full test suite**

Expected: All tests pass. The `chat-widget.spec.ts` tests for session loading still pass.

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "fix(chat-widget): remove loadSessions from useEffect deps to prevent subscription churn (H3)"
```

---

## Task 10: Fix shell output ordering (H4)

**Findings:** H4 — Shell outputs always rendered at the bottom of the timeline regardless of their `afterMessageIndex`.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-timeline.tsx:466-469`

**Step 1: Interleave shell outputs into the render plan**

Currently shell outputs are rendered after all messages (lines 466-469). Instead, integrate them into the renderPlan by inserting them after the message at `afterMessageIndex`.

Add shell output entries as a new RenderItem kind:

```tsx
type RenderItem =
    | { kind: 'user'; index: number }
    | { kind: 'assistant-run'; indices: number[] }
    | { kind: 'shell-output'; output: ShellOutput };
```

In the `renderPlan` useMemo, after building the message plan, insert shell outputs:

```tsx
const renderPlan = React.useMemo<RenderItem[]>(() => {
    const plan: RenderItem[] = [];
    let i = 0;
    while (i < messages.length) {
        if (messages[i].role !== 'assistant') {
            plan.push({ kind: 'user', index: i });
            i++;
        } else {
            const run: number[] = [];
            while (i < messages.length && messages[i].role === 'assistant') {
                run.push(i);
                i++;
            }
            plan.push({ kind: 'assistant-run', indices: run });
        }
    }

    // Interleave shell outputs based on afterMessageIndex
    // Insert each shell output after the plan item that contains its afterMessageIndex
    if (shellOutputs.length > 0) {
        // Sort shell outputs by afterMessageIndex (ascending) for stable insertion
        const sorted = [...shellOutputs].sort((a, b) => (a.afterMessageIndex ?? Infinity) - (b.afterMessageIndex ?? Infinity));
        // Insert in reverse order to maintain correct indices
        for (let si = sorted.length - 1; si >= 0; si--) {
            const so = sorted[si];
            const afterIdx = so.afterMessageIndex ?? Infinity;
            // Find the plan item that contains this message index
            let insertPos = plan.length; // default: append at end
            for (let pi = 0; pi < plan.length; pi++) {
                const item = plan[pi];
                const maxIdx = item.kind === 'user' ? item.index
                    : item.kind === 'assistant-run' ? item.indices[item.indices.length - 1]
                    : -1;
                if (maxIdx >= afterIdx) {
                    insertPos = pi + 1;
                    break;
                }
            }
            plan.splice(insertPos, 0, { kind: 'shell-output', output: so });
        }
    }

    return plan;
}, [messages, shellOutputs]);
```

Then in the render, add handling for `shell-output`:

```tsx
if (item.kind === 'shell-output') {
    return <ShellOutputBlock key={item.output.id} output={item.output} />;
}
```

And remove the standalone shell outputs block (lines 466-469).

**Step 2: Run full test suite + type check**

```bash
cd /Users/Shared/dev/theia-openspace && npx tsc -p extensions/openspace-chat/tsconfig.json --noEmit && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings 'extensions/openspace-chat/src/browser/__tests__/*.spec.ts'
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-timeline.tsx
git commit -m "fix(timeline): interleave shell outputs by afterMessageIndex instead of appending at bottom (H4)"
```

---

## Task 11: Add error boundary around message rendering (M10)

**Findings:** M10 — No error boundary around MessageBubble. A single malformed part crashes the entire conversation UI.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx` (add ErrorBoundary)
- Modify: `extensions/openspace-chat/src/browser/message-timeline.tsx` (wrap MessageBubble)

**Step 1: Create a MessageErrorBoundary component**

Add to the top of `message-bubble.tsx` (after imports, before other components):

```tsx
/**
 * Error boundary that catches render errors in individual message bubbles.
 * Shows a fallback UI instead of crashing the entire conversation.
 */
class MessageErrorBoundary extends React.Component<
    { messageId?: string; children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { messageId?: string; children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error(`[MessageBubble] Render error in message ${this.props.messageId}:`, error, info);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="message-bubble-error">
                    <span>Failed to render message</span>
                </div>
            );
        }
        return this.props.children;
    }
}
```

Export it: `export { MessageErrorBoundary };`

**Step 2: Wrap MessageBubble usage in MessageTimeline**

In `message-timeline.tsx`, import `MessageErrorBoundary` and wrap each `<MessageBubble>` call:

```tsx
<MessageErrorBoundary messageId={message.id}>
    <MessageBubble ... />
</MessageErrorBoundary>
```

**Step 3: Run full test suite + type check**

**Step 4: Commit**

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx extensions/openspace-chat/src/browser/message-timeline.tsx
git commit -m "feat(message-bubble): add error boundary to prevent single message crash (M10)"
```

---

## Task 12: Final verification — all 18 regression tests pass

**Step 1: Rebuild compiled output**

The bug-regression tests load from compiled `lib/` for React component tests. After all changes, rebuild:

```bash
cd /Users/Shared/dev/theia-openspace/extensions/openspace-chat && npx tsc -p tsconfig.json
```

**Step 2: Run full test suite**

```bash
cd /Users/Shared/dev/theia-openspace && npx mocha --no-config --require ./test-setup.js --require ts-node/register/transpile-only --extension ts,tsx --timeout 10000 --exit --color --reporter spec --node-option no-warnings 'extensions/openspace-chat/src/browser/__tests__/*.spec.ts'
```

Expected: **ALL tests pass** — including all 18 regression tests and all 131 existing tests. Zero failures.

**Step 3: Run type check on the full extension**

```bash
cd /Users/Shared/dev/theia-openspace && npx tsc -p extensions/openspace-chat/tsconfig.json --noEmit
```

Expected: Zero errors.

**Step 4: Final commit (if any cleanup needed)**

---

## Summary

| Task | Finding | File | Tests |
|------|---------|------|-------|
| 1 | M1 | markdown-renderer.tsx | Group G (2 tests) |
| 2 | M2 | markdown-renderer.tsx | Group C (1 test) |
| 3 | C1 | prompt-input.tsx | Group D (3 tests) |
| 4 | H2 | question-dock.tsx | Group E (1 test) |
| 5 | H1 | model-selector.tsx | Group F (3 tests) |
| 6 | M9 | message-bubble.tsx | Group A (1 test) |
| 7 | M7/UB1/UB2 | message-bubble.tsx | Group B (3 tests) |
| 8 | M8/UB3 | message-bubble.tsx + message-timeline.tsx | Existing timer tests |
| 9 | H3 | chat-widget.tsx | Existing subscription tests |
| 10 | H4 | message-timeline.tsx | — |
| 11 | M10 | message-bubble.tsx + message-timeline.tsx | — |
| 12 | — | All | Full suite: 149+ tests, 0 failures |
