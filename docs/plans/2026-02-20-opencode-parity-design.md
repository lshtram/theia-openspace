# OpenCode Web Client Parity — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve full feature parity between the Theia OpenSpace chat widget and the OpenCode web client (SolidJS reference implementation).

**Architecture:** The Theia chat is a React-based widget in a Theia IDE extension. Data flows from the OpenCode server via SSE → Node backend proxy → JSON-RPC → browser sync service → React state → DOM. The reference client is a SolidJS app with direct SSE → store → fine-grained reactivity.

**Tech Stack:** React 18, TypeScript, Theia framework, CSS custom properties, contenteditable prompt input.

---

## Complete Feature Gap Inventory

### TIER 1 — Critical (App-breaking / Blocking)

#### G1: Smooth Streaming (message.part.delta)
**Problem:** Theia only handles `message.part.updated` (full part replacement) and `message.updated`. The `message.part.delta` SSE event type — which delivers per-token text increments — is completely missing. Result: text arrives in large chunks instead of smooth per-token streaming.

**OpenCode approach:** SSE delivers `message.part.delta` with `{ messageID, partID, field, delta }`. The event reducer does a surgical in-place string append: `part[field] += delta`. UI throttle is leading+trailing at 100ms (fires immediately on first update, then rate-limits).

**Theia current:** Only `message.part.updated` arrives (infrequent, full object). Trailing-only 100ms throttle adds additional delay. Full `[...messages]` array copy on every update.

**Fix required:**
- Add `EventMessagePartDelta` type to SDK types
- Handle `message.part.delta` in proxy → sync service → session service
- Change throttle to leading+trailing edge
- Append delta text to existing part instead of replacing entire message

**Files:** `opencode-sdk-types.ts`, `opencode-protocol.ts`, `opencode-proxy.ts`, `opencode-sync-service.ts`, `session-service.ts`, `chat-widget.tsx`

---

#### G2: Question Rendering & Interaction
**Problem:** When the AI calls the `question` tool, it blocks waiting for a user answer. Theia has no question UI — the tool hangs forever.

**OpenCode approach:** `question.asked` SSE event → store → QuestionDock component in prompt area. Shows option buttons with labels and descriptions, custom text input, multi-question tabs, dismiss button. Blocks normal prompt input until answered. Answer submitted via `POST /question/:requestID/reply`.

**Theia current:** No question event handling, no UI, no API integration.

**Fix required:**
- Parse `question.asked`, `question.replied`, `question.rejected` SSE events
- Add question state to session service
- Build QuestionDock React component with option buttons, custom input, dismiss
- Add answer submission API call
- Block prompt input when question is pending

**Files:** New `question-dock.tsx`, modified `opencode-proxy.ts`, `opencode-sync-service.ts`, `session-service.ts`, `chat-widget.tsx`, `opencode-protocol.ts`, `opencode-sdk-types.ts`

---

#### G3: Per-Tool Card Rendering (Remove "Steps Completed")
**Problem:** All non-text parts are lumped into "N steps completed" collapsible. Individual tools are not visible. Users can't see what the AI is doing at a glance.

**OpenCode approach:** Each tool renders as its own collapsible card: icon (per tool type) + tool name + description/args + collapse chevron. Running tools show animation. Cards are NOT grouped.

**Theia current:** `StepsContainer` groups all tools/reasoning/steps into single "N steps completed" line.

**Fix required:**
- Remove `StepsContainer`, `segmentParts()`, `countSteps()` 
- Render each tool part as individual `ToolCard` component
- Each card: icon + tool name + description + expand/collapse + state indicator
- Tool-specific icons: bash=console, read=glasses, grep=magnifying-glass, edit=code-lines, task=task, question=bubble, etc.
- Running: spinner/shimmer on card, Completed: subtle checkmark, Error: warning icon

**Files:** `message-bubble.tsx`, `chat-widget.css`

---

#### G4: Subtask/Subagent Rendering
**Problem:** When AI dispatches subagents (task tool), `subtask` part falls through to default (shows "subtask" as dim text). No child session loading, no nested tool display.

**OpenCode approach:** Task tool card shows description as clickable link to child session. Expands to show child session's tool activity inline (compact list: icon + title + subtitle per child tool). Surfaces child permission requests.

**Theia current:** Nothing rendered for subtask parts or task tool calls.

**Fix required:**
- Register task tool as special renderer in tool card system
- Load child session data via session service
- Show child tools as compact list inside parent task card
- Surface child permission requests inline
- Clickable link to navigate to child session

**Files:** `message-bubble.tsx`, `session-service.ts`, `chat-widget.css`

---

### TIER 2 — Major UX Gaps

#### G5: Tool Card Design Polish
**Problem:** Current ToolBlock shows tool name + state badge but lacks per-tool icons, description/args in header, and the clean BasicTool layout.

**OpenCode approach:** `BasicTool` wraps tools in Kobalte `Collapsible`. Trigger shows: small icon + tool name (bold) + subtitle (description/filename/args) + action icon (optional) + collapse arrow. Collapse arrow on right side. Hover highlights.

**Fix required:**
- Per-tool icon mapping (bash→console, read→glasses, glob/grep→magnifying-glass, edit/write→code-lines, webfetch→window, task→task, question→bubble, mcp→mcp)
- Show description/args in subtitle (bash: description, read: filename, grep: pattern, edit: filename + diff count)
- Collapse chevron on right, rotates on expand
- Compact single-line trigger when collapsed

---

#### G6: Bash Tool — Show Description
**Problem:** Bash tool shows command + output but not the description (e.g., "Rebuild openspace-chat extension").

**OpenCode approach:** Bash card trigger shows: console icon + "Shell" + description text. Expands to command + output code blocks. ANSI sequences stripped.

**Fix:** Show description in tool card header. Strip ANSI from output.

---

#### G7: Edit/Write Tool — Diff Viewer
**Problem:** Edit and write tools render as generic tool cards with no diff view.

**OpenCode approach:** Edit shows filename + directory + DiffChanges badge (green/red numbers). Expands to inline diff viewer. Write shows filename, expands to code viewer.

**Fix:** Build inline diff component for edit tools. Show filename + change counts in header.

---

#### G8: Dynamic Status Text During Streaming
**Problem:** Theia shows "Thinking" shimmer then "Generating...". No contextual status per tool type.

**OpenCode approach:** Status text derived from current part type: "Thinking" (reasoning), "Searching codebase" (grep/glob/read), "Making edits" (edit/write/apply_patch), "Running commands" (bash), "Delegating" (task), "Planning" (todowrite), "Gathering context" (read), "Searching web" (webfetch). Throttled to change max every 2500ms.

**Fix:** Map current tool type → status text. Throttle status changes. Show in assistant header area.

---

#### G9: Inline Permission UI
**Problem:** Permission requests show as modal dialogs, not inline in chat.

**OpenCode approach:** Permission buttons (Deny / Allow Always / Allow Once) shown directly under the tool card that needs permission. Also in prompt dock.

**Fix:** Show permission buttons inline under tool cards. Keep modal as fallback.

---

#### G10: Message Spacing
**Problem:** 8px gap between messages is too tight. Too much space between "1 step completed" containers (as shown in user's screenshot).

**OpenCode approach:** 48px (`gap-12`) between turns. Minimal gaps between tool cards within a turn.

**Fix:** Increase between-turn spacing. Decrease within-message tool card gaps. Remove excessive margins on tool/reasoning parts.

---

### TIER 3 — Prompt Input Gaps

#### G11: @ Mentions — Dynamic Agents + File Search
**Problem:** Agent list is hardcoded (4 agents). File search returns empty array.

**OpenCode approach:** Agents loaded from server. File search via workspace file service with recently-opened files pinned.

**Fix:** Fetch agents from opencode server. Integrate file search with Theia workspace or opencode API.

---

#### G12: / Commands — Keyboard Nav + Dynamic Commands
**Problem:** No keyboard navigation for slash menu. Commands hardcoded. Wrong regex (triggers mid-sentence).

**OpenCode approach:** Full keyboard nav (ArrowUp/Down/Enter). Commands from server. Regex: `/^\/(\S*)$/` (only at start of entire input).

**Fix:** Add keyboard nav state and handlers. Fix regex. Fetch commands from server.

---

#### G13: ! Shell Mode
**Problem:** Not implemented at all.

**OpenCode approach:** Typing `!` at position 0 enters shell mode. Monospace font, console icon, "Shell" label. Escape exits. Separate shell history.

**Fix:** Add mode state, `!` detection, shell mode UI, separate history.

---

#### G14: Prompt History (Up/Down Arrows)
**Problem:** No prompt history. Up/down arrows only work for typeahead.

**OpenCode approach:** 100-entry history per mode (normal/shell). ArrowUp/Down at cursor boundaries navigates history. Current prompt saved and restored.

**Fix:** Add history array, index tracking, cursor boundary detection, save/restore.

---

#### G15: Paste Handling
**Problem:** Pasting text can inject HTML into contenteditable. Only image paste handled.

**OpenCode approach:** Always `preventDefault` on paste. Use `execCommand('insertText')` for plain text.

**Fix:** Intercept all paste events, extract plain text, use insertText.

---

### TIER 4 — Polish & Nice-to-Have

#### G16: TodoWrite Rendering
Show checklist with completion count (e.g. "3/5"). Checkbox items rendered inline.

#### G17: Retry Part Rendering
Show error message, countdown timer, attempt number.

#### G18: Scroll-to-Bottom Button
Floating arrow button when scrolled up from bottom.

#### G19: Syntax Highlighting in Code Blocks
Add highlight.js or Prism for code block syntax highlighting in markdown renderer.

#### G20: Session Status Indicators
Spinner (working), yellow dot (permissions), red dot (error), blue dot (unseen) in session list.

---

## Implementation Priority Order

### Phase 1: Foundation (streaming + tool cards)
1. **G1** — Smooth streaming (message.part.delta)
2. **G3** — Per-tool card rendering (remove steps container)
3. **G5** — Tool card design polish (icons, descriptions)
4. **G10** — Message spacing fix

### Phase 2: Interactivity (questions + subagents + permissions)
5. **G2** — Question rendering & interaction
6. **G4** — Subtask/subagent rendering
7. **G9** — Inline permission UI

### Phase 3: Tool-specific renderers
8. **G6** — Bash tool description
9. **G7** — Edit/Write tool diff viewer
10. **G8** — Dynamic status text

### Phase 4: Prompt input
11. **G12** — / commands keyboard nav + dynamic commands
12. **G11** — @ mentions dynamic agents + file search
13. **G14** — Prompt history (up/down)
14. **G13** — ! Shell mode
15. **G15** — Paste handling fix

### Phase 5: Polish
16. **G16** — TodoWrite rendering
17. **G17** — Retry part rendering
18. **G18** — Scroll-to-bottom button
19. **G19** — Syntax highlighting
20. **G20** — Session status indicators

---

## Key Architecture Decisions

1. **Keep React architecture** — Don't try to replicate SolidJS fine-grained reactivity. Instead, use React.memo, useMemo, and granular state to minimize re-renders.

2. **Delta accumulation in session service** — Append deltas to a per-part text accumulator in session service, fire a separate `onPartDeltaChanged` event that the chat widget can subscribe to for efficient re-renders.

3. **Tool card registry pattern** — Like opencode's `ToolRegistry`, create a mapping of tool name → renderer component, with a `GenericTool` fallback.

4. **Question state as top-level** — Questions are NOT message parts. They're standalone events. Track them separately in session service, show QuestionDock in prompt area when pending.

5. **Permission inline + modal** — Show inline permission buttons under tool cards for the primary UX, keep the existing modal dialog as fallback for edge cases.

6. **Prompt input incremental fixes** — Fix each prompt input feature independently. Don't rewrite the whole component.
