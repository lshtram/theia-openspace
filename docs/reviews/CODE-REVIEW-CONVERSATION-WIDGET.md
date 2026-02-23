# Conversation Widget & Prompt Input — Code Review

**Date:** 2026-02-23
**Branch:** `master`
**Scope:** `extensions/openspace-chat/src/browser/` — conversation rendering, prompt input, model selector, question dock, markdown renderer, diff utilities
**Method:** Full file reads of all 14 source files, root-cause analysis of 3 user-reported bugs, cross-reference against SRS requirements and OpenCode reference implementation
**Verdict:** NEEDS WORK — architectural rewrite required for message rendering pipeline; targeted fixes for remaining components

---

## Executive Summary

The conversation widget has **3 user-reported bugs** that share a common architectural root cause: the message rendering pipeline separates "thinking steps" from "response text" at **two independent levels** (MessageTimeline and MessageBubble), causing content to appear in wrong sections or render twice. Additionally, three independent timer systems create stalling/reset behavior.

Beyond the user-reported bugs, this review found **1 critical security issue** (XSS via history innerHTML), **4 high-severity** correctness/accessibility gaps, **7 medium** reliability and architecture issues, and **5 low** maintainability concerns.

### Recommended Approach

| Component | Action |
|-----------|--------|
| `message-bubble.tsx` | **Rewrite** — consolidate dual-level separation, merge 3 timer systems |
| `message-timeline.tsx` | **Rewrite** — remove response extraction, fix shell output ordering |
| `prompt-input.tsx` | **Targeted fix** — sanitize history innerHTML restore |
| `markdown-renderer.tsx` | **Targeted fix** — clipboard error handling, linkify guard |
| `model-selector.tsx` | **Targeted fix** — add keyboard navigation for dropdown items |
| `question-dock.tsx` | **Targeted fix** — validation on confirm submit |

---

## User-Reported Bugs — Root Cause Analysis

### UB1. Thinking/internal processes leak into response area

**Symptom:** Content that should appear under the "thinking" (intermediate steps) section instead shows in the final response area.

**Root cause — Dual-level response separation:**
- **Level 1 (MessageTimeline, lines 374–463):** Groups consecutive assistant messages into an "assistant-run". For the last message in a run, it finds the last text part (`responsePartIndex`), filters it OUT of the parts array, and renders it separately below as the `turn-response` div.
- **Level 2 (MessageBubble, lines 1029–1147):** When NOT marked `isIntermediateStep`, MessageBubble runs its OWN inner separation logic (`hasIntermediateParts`, `lastTextPartIndex`, `intermediateParts`, `finalTextPartWithIndex`) and renders its own inner TurnGroup.
- **Conflict:** When the timeline-level code designates a message as the "response" (not intermediate), MessageBubble's inner logic re-separates the parts, potentially pulling thinking content into the response rendering path. The two levels have different heuristics for what counts as "intermediate" vs "final".

**Fix direction:** Single source of truth for part classification. One level decides which parts are steps vs response; the other level just renders what it's told.

### UB2. Duplicate messages in thinking section

**Symptom:** The same content appears twice — once in thinking and once elsewhere.

**Root cause — Same dual-level separation.** A part can be rendered both by the outer TurnGroup (timeline level, when it passes all non-response parts) AND by the inner TurnGroup (bubble level, when MessageBubble re-classifies the same parts).

**Fix direction:** Same as UB1 — eliminate the second level of separation.

### UB3. Timer stalling / resetting during streaming

**Symptom:** The elapsed-time counter freezes or jumps back to 0:00 mid-stream.

**Root cause — Three independent timer systems:**
1. **TurnGroup timer** (`message-bubble.tsx:806–815`): Resets `streamStartRef.current = Date.now()` and starts a new `setInterval` each time `isStreaming` toggles. Between tool-call rounds, `isStreaming` can flicker (despite `useLatchedBool` with 600ms delay at line 821), causing a timer reset.
2. **MessageBubble per-message timer** (`message-bubble.tsx:1002–1010`): Runs independently based on `timerShouldRun = !isUser && !!createdMs && !completedMs && isStreaming`.
3. **TurnGroup total duration** (`message-timeline.tsx:364–372`): Computed from server-side `createdAt`/`completedAt` timestamps — a different time source than the client-side `Date.now()` used by timers 1 and 2.

**Fix direction:** Single timer per assistant turn, driven by server timestamps when available, with client-side fallback only while actively streaming.

---

## Confirmed Findings

### Critical

**C1. History innerHTML restore is an XSS vector**
- **Files:** `prompt-input.tsx:361–362, 385, 396`
- **Evidence:** When restoring prompt history entries, raw `innerHTML` from prior inputs is re-injected into the contenteditable div without sanitization. If a user pastes malicious HTML that gets stored in history, navigating back to that history entry executes it.
- **Impact:** Stored XSS in the editor — script execution in the Theia webview context.
- **Fix:** Sanitize innerHTML before restore (e.g., strip `<script>`, event handlers) or store history as plain text / structured data instead of raw HTML.

### High

**H1. Missing keyboard navigation in ModelSelector dropdown**
- **File:** `model-selector.tsx:184–197`
- **Evidence:** The dropdown renders a list of `<li>` items with `onClick` handlers but no `onKeyDown` handling for ArrowUp/ArrowDown/Enter navigation. The container has `role="listbox"` (line 170) but individual items lack `aria-selected` and keyboard focus management.
- **Impact:** Keyboard-only users cannot navigate the model list. Accessibility violation (WCAG 2.1 AA).
- **Fix:** Add `onKeyDown` handler with ArrowUp/Down to move `aria-activedescendant`, Enter to select, Escape to close.

**H2. Empty answer submit in QuestionDock confirm tab**
- **File:** `question-dock.tsx:419–425`
- **Evidence:** The "Submit" button for confirm-type questions has no `disabled` guard. Users can click Submit with zero checkboxes selected, sending an empty answer array.
- **Impact:** Agent receives meaningless empty response, potentially causing logic errors downstream.
- **Fix:** Disable Submit button when `answers.length === 0` for confirm questions.

**H3. Unstable `loadSessions` causing subscription churn**
- **File:** `chat-widget.tsx:477–601`
- **Evidence:** `loadSessions` is a function defined inside the component and included in the dependency array of the main `useEffect` (line 601). Every time `loadSessions` is recreated (every render), the effect tears down and re-creates 8 disposables (SSE subscription, message handler, streaming handler, etc.).
- **Impact:** Excessive teardown/recreation of event subscriptions on every render. Potential for missed events during teardown gaps. Performance cost.
- **Fix:** Wrap `loadSessions` in `useCallback` with proper deps, or move it inside the effect, or use a ref.

**H4. Shell outputs rendered at wrong position**
- **File:** `message-timeline.tsx:466–469`
- **Evidence:** Shell output entries carry an `afterMessageIndex` field, but the rendering code always places them at the bottom of the timeline regardless of their `afterMessageIndex` value.
- **Impact:** Shell command output appears out of chronological order relative to the conversation flow.
- **Fix:** Interleave shell outputs into the message list based on `afterMessageIndex`.

### Medium

**M1. Missing clipboard `.catch()` in copy handlers**
- **File:** `markdown-renderer.tsx:226–229, 275–279`
- **Evidence:** `navigator.clipboard.writeText(...)` calls in CodeBlock and AnsiBlock copy handlers lack `.catch()`. Clipboard API can fail (permissions, non-secure context).
- **Impact:** Unhandled promise rejection on clipboard failure. Button state stuck on "Copy" with no error feedback.
- **Fix:** Add `.catch()` with user-visible error state (e.g., reset button text).

**M2. `linkifyFilePaths` processes content inside code spans**
- **File:** `markdown-renderer.tsx:343–361`
- **Evidence:** The `linkifyFilePaths` function is applied to all text content including text inside inline `<code>` elements. File paths in code examples get incorrectly converted to clickable links.
- **Impact:** Code examples with file-path-like strings render with unexpected link elements, breaking code formatting.
- **Fix:** Skip linkification when the text node is inside a `<code>` or `<pre>` ancestor.

**M3. No model validation — any string accepted**
- **File:** `model-selector.tsx` (setActiveModel calls)
- **Evidence:** `setActiveModel` accepts any string value. There is no validation against the available models list.
- **Impact:** Invalid model IDs can be set, leading to API errors on next message send.
- **Fix:** Validate against `availableModels` before setting.

**M4. TurnGroup timer cleanup race**
- **File:** `message-bubble.tsx:806–815`
- **Evidence:** The `isStreaming` effect starts a `setInterval` and returns a cleanup function. If the component unmounts while `isStreaming` is true, the cleanup runs — but if `isStreaming` toggles rapidly before unmount, multiple intervals may exist simultaneously (each new toggle clears the previous, but there's a race window).
- **Impact:** Timer display shows incorrect elapsed time or multiple intervals tick simultaneously.
- **Fix:** Use a single ref-based timer with explicit start/stop, not effect-driven intervals.

**M6. LCS diff uses O(n*m) memory**
- **File:** `diff-utils.ts:63`
- **Evidence:** The LCS implementation allocates a full `(n+1) x (m+1)` matrix. Although there's a 1000-line guard (line 50), inputs up to 1000 lines can still allocate ~1M entries.
- **Impact:** Memory spike on large diffs. Low practical risk due to the guard.
- **Fix:** Consider Hirschberg's algorithm for O(n) space, or accept current behavior with the guard.

**M7. Dual-level response separation (architectural)**
- **Files:** `message-timeline.tsx:374–463`, `message-bubble.tsx:1029–1147`
- **Evidence:** See UB1/UB2 root cause analysis above.
- **Impact:** Root cause of user-reported bugs 1 and 2.
- **Fix:** Rewrite to single-level part classification.

**M8. Three timer systems (architectural)**
- **Files:** `message-bubble.tsx:806–815, 1002–1010`, `message-timeline.tsx:364–372`
- **Evidence:** See UB3 root cause analysis above.
- **Impact:** Root cause of user-reported bug 3.
- **Fix:** Consolidate to single timer per assistant turn.

**M9. `groupParts` uses `indexOf()` for index lookup — potential mismatch**
- **File:** `message-bubble.tsx:943, 956`
- **Evidence:** `groupParts` calls `parts.indexOf(part)` to find a part's index. If two parts have identical object identity (unlikely but possible with array mutations), `indexOf` returns the first match, causing wrong index assignment.
- **Impact:** Incorrect part indexing in edge cases — parts rendered in wrong order or with wrong metadata.
- **Fix:** Use the iteration index instead of `indexOf`.

**M10. No error boundary around message rendering**
- **Files:** `message-timeline.tsx`, `message-bubble.tsx`
- **Evidence:** Neither MessageTimeline nor MessageBubble is wrapped in a React error boundary. A single malformed part (e.g., unexpected type, null content) crashes the entire chat view.
- **Impact:** One bad message destroys the entire conversation UI with no recovery path.
- **Fix:** Add error boundary wrapping individual message bubbles, with fallback UI showing "failed to render message".

### Low

**L1. `getMessageGroupInfo` called per-message without memoization**
- **File:** `message-timeline.tsx:263–272`
- **Evidence:** Called inside the render loop for every message. For N messages, this does O(N) work per message = O(N^2) total.
- **Impact:** Sluggish rendering on long conversations (100+ messages).
- **Fix:** Pre-compute group info for all messages once per render pass.

**L2. `renderPlan` useMemo deps only check `[messages]` by reference**
- **File:** `message-timeline.tsx` (renderPlan useMemo)
- **Evidence:** The memoization depends on the `messages` array reference. If messages are mutated in-place (rather than replaced with a new array), the memo returns stale output.
- **Impact:** Stale plan rendering if message mutations don't create new array references. Low risk if state management always creates new arrays.

**L3. ContextToolGroup doesn't pass `onOpenFile`**
- **File:** `message-bubble.tsx` (ContextToolGroup component)
- **Evidence:** The ContextToolGroup component renders file context items but doesn't pass the `onOpenFile` callback to nested tool items, making file links non-functional.
- **Impact:** Clicking file links in context tool groups does nothing.

**L4. `formatTimestamp` returns empty string for falsy dates**
- **File:** Various timestamp formatting calls
- **Evidence:** When `createdAt` or `completedAt` is undefined/null/0, `formatTimestamp` returns `""` rather than a meaningful fallback like "—" or "unknown".
- **Impact:** Empty timestamp renders as blank space — confusing but not broken.

**L5. `handleSend` has `sessionService` in deps but doesn't use it directly**
- **File:** `chat-widget.tsx` (handleSend useCallback deps)
- **Evidence:** `sessionService` is listed in the dependency array of `handleSend` but the function body uses `sendPartsNow` (which itself captures `sessionService`). This causes unnecessary re-creation of `handleSend` when `sessionService` reference changes.
- **Impact:** Minor unnecessary re-renders. No correctness issue.

---

## Test Coverage Assessment

| Area | SRS Requirements | Tests Covering | Coverage |
|------|-----------------|----------------|----------|
| Prompt Input (text, submit, clear) | ~12 | 26 tests | Good |
| Message Timeline (rendering, grouping) | ~10 | 10 tests | Partial |
| Markdown Rendering | ~8 | 24 tests | Good |
| Model Selector | ~6 | 13 tests | Good |
| Chat Widget (sessions, state) | ~12 | 32 tests | Partial |
| Diff Utils | ~5 | 14 tests | Good |
| @Mention Typeahead | ~6 | 0 tests | **None** |
| Slash Commands | ~4 | 0 tests | **None** |
| Shell Mode | ~4 | 0 tests | **None** |
| Paste / Drag-Drop | ~4 | 0 tests | **None** |
| Prompt History | ~4 | 0 tests | **None** |
| Auto-Scroll | ~3 | 0 tests | **None** |
| Keyboard Shortcuts | ~4 | 0 tests | **None** |
| Question Dock | ~5 | 0 tests | **None** |
| Tool Call Cards | ~3 | 0 tests | **None** |
| Permission Cards | ~3 | 0 tests | **None** |
| **Total** | **~88** | **~29 covered** | **~33%** |

---

## Appendix: Files in Scope

| File | Lines | Verdict |
|------|-------|---------|
| `chat-widget.tsx` | 934 | Fix — H3, L5 |
| `message-timeline.tsx` | 515 | **Rewrite** — M7, H4, L1, L2 |
| `message-bubble.tsx` | 1187 | **Rewrite** — M7, M8, M4, M9, L3 |
| `markdown-renderer.tsx` | 473 | Fix — M1, M2 |
| `model-selector.tsx` | 411 | Fix — H1, M3 |
| `question-dock.tsx` | 432 | Fix — H2 |
| `prompt-input.tsx` | 1103 | Fix — C1 |
| `diff-utils.ts` | 79 | Accept or minor fix — M6 |
| `sessions-widget.tsx` | 208 | OK |
| `parse-from-dom.ts` | 136 | OK |
| `build-request-parts.ts` | 135 | OK |
| `types.ts` | 121 | OK |
