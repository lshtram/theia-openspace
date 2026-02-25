# Chat Feature Parity: theia-openspace vs opencode
*Code-level analysis · 2026-02-25*

---

## 1. Architecture Comparison

### theia-openspace chat stack
```
ChatWidget (Theia ReactWidget)
  └─ ChatComponent (React functional, ~1053 lines)
       ├─ ChatHeaderBar           (session dropdown, model selector, action menu)
       ├─ MessageTimeline         (scroll container, auto-scroll, grouping)
       │    └─ MessageBubble      (per-message renderer)
       │         ├─ TurnGroup     (collapsible intermediate steps)
       │         ├─ ToolBlock     (collapsible tool call card)
       │         ├─ TaskToolBlock (always-expanded, polling child session)
       │         ├─ ContextToolGroup (grouped read/grep/glob)
       │         └─ ReasoningBlock
       ├─ QuestionDock            (single / multi-question flow)
       ├─ TodoPanel               (read-only todo list)
       ├─ PromptInput             (contenteditable + pills + @mention)
       └─ ChatFooter              (status bar)

SessionService (openspace-core) — single source of truth
  └─ SessionServiceImpl — state + SSE subscriptions
```

### opencode chat stack (Solid.js)
```
SessionPage (session.tsx ~65 KB)
  ├─ MessageTimeline             (scroll spy, turn navigation, header)
  │    └─ SessionTurn (ui pkg)   (per user-message renderer)
  │         ├─ AssistantMessages → MessagePart components
  │         │    ├─ BasicTool   (collapsible generic tool card)
  │         │    ├─ ContextToolGroup
  │         │    ├─ ReasoningPart
  │         │    └─ DiagnosticsPart (LSP diagnostics)
  │         └─ UserMessage       (expand/collapse, copy)
  ├─ SessionPromptDock           (prompt + permission + question)
  │    └─ PromptInput            (contenteditable + pills + context items)
  │         └─ PromptContextItems (file selections with line ranges + comments)
  ├─ ReviewTab                   (standalone diff panel, line comments)
  └─ TerminalPanel               (per-session terminal state)

SyncContext — optimistic message store (binary search)
LayoutContext — panel widths, scroll state, diff style
PromptContext — per-session prompt autosave
CommentsContext — per-session line comments
NotificationContext — turn-complete / error notifications
```

---

## 2. Gap Analysis (Code Level)

### 2.1 Session Management

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Inline title editing | `session.tsx:title{draft,editing,saving}` + `saveTitleEditor()` + `InlineInput` component | **absent** | ❌ Full subsystem missing |
| Session archiving | `archiveSession()` in session.tsx | `SessionService.archiveSession()` in `session-service.ts`, `sessions-widget.tsx` archive button | ✅ Already implemented |
| Parent/child nav | `parentID` back-button + indentation in list | `sessions-widget.tsx` has `parentID` indentation | ⚠️ Indentation exists, back-button absent |
| Session cost/summary in header | `info.summary.{additions,deletions,files}` | **absent** | ❌ Missing |
| Session diff summary on message | `UserMessage.summary.{title,body,diffs[]}` | has `renderPatchPart()` for patch-type parts, not `summary` field | ⚠️ Partial |
| Session revert | `revertSession()` / `unrevertSession()` | `ChatHeaderBar` has Revert/Unrevert menu item, `SessionService.revertSession()` | ✅ Already implemented |
| Session forking | `newSessionWorktree` state → fork dialog | `ChatHeaderBar` has Fork action, `SessionService.forkSession()` | ✅ Already implemented |

### 2.2 Message Rendering

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Copy response button | `SessionTurn` – copies last text part to clipboard, 2s toast | **absent** | ❌ Missing |
| Message expand/collapse toggle | `expanded: Record<string,boolean>` store + `onToggleExpanded()` | Tool blocks collapse; no per-message toggle | ⚠️ Partial (tool-level only) |
| Token / cost display | `AssistantMessage.{cost, tokens.{input,output,reasoning,cache}}` + context usage popover | **absent** | ❌ Missing entirely |
| Duration display | `SessionTurn` live elapsed + Luxon formatting | `TurnGroup` has live elapsed timer (seconds) | ✅ Implemented |
| Reasoning parts | `ReasoningPart` component | `renderReasoningPart()` → `ReasoningBlock` | ✅ Implemented |
| Compaction display | Divider with auto/manual label | `renderCompactionPart()` | ✅ Implemented |
| Retry countdown | `RetryPart` + 1s update timer | `retryStatus` state + countdown banner in `message-bubble.tsx:995` | ✅ Implemented |
| LSP diagnostics in tool parts | `DiagnosticsPart` – shows `severity=1` errors | **absent** | ❌ Missing |
| SubtaskPart type | `SubtaskPart {type:"subtask", prompt, description, agent, model, command}` | Maps to `TaskToolBlock` via `TASK_TOOL_NAMES` regex | ⚠️ Mapped but type string differs – verify SDK alignment |
| Snapshot parts | `SnapshotPart {type:"snapshot", snapshot}` | `renderSnapshotPart()` – icon + short ID | ✅ Implemented |
| Patch parts | `PatchPart {type:"patch", hash, files[]}` | `renderPatchPart()` – file list | ✅ Implemented |
| UserMessage summary diffs | `UserMessage.summary.diffs[]` | **absent** | ❌ Missing |

### 2.3 Prompt Input

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| File attachment with line range | `FileContextItem {path, selection:{startLine,endLine,startChar,endChar}}` | `FilePart {type:'file', path}` – no line range | ❌ No line selection |
| Context items panel | `PromptContextItems` – shows files+line ranges+comments below input | **absent** | ❌ Missing subsystem |
| Line comment on context item | `FileContextItem.{comment, commentID, commentOrigin}` | **absent** | ❌ Missing |
| Per-session prompt autosave | `PromptContext` – persists `(directory, sessionID)` → Prompt, max 20 LRU | **absent** (prompt clears on navigate) | ❌ Missing |
| Image drag-and-drop overlay | `PromptDragOverlay` component | implemented in `prompt-input.tsx` | ✅ Implemented |
| Agent @mention | `AgentPart` + popover | `AgentPart` + `@mention` typeahead | ✅ Implemented |
| Slash command popover | `SlashCommand` popover with builtins + MCP + skills | `prompt-input.tsx` slash command menu | ✅ Implemented |
| History navigation (↑↓) | `navigatePromptHistory()` | up/down history (up to 100 entries) | ✅ Implemented |
| Shell mode (`!` prefix) | no shell prefix – uses `/bash` tool | `!` prefix → `onShellCommand` | ⚠️ Theia-specific, not in opencode |

### 2.4 Scroll Behaviour

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Auto-scroll on new message | `createAutoScroll()` hook, pauses on user interaction | ResizeObserver + `userScrolledUpRef` | ✅ Functionally equivalent |
| Scroll-to-bottom button | floating button when `scroll.overflow && !scroll.bottom` | `scroll-to-bottom-btn` when `isScrolledUp` | ✅ Implemented |
| New messages indicator | `new-messages-indicator` | `new-messages-indicator` | ✅ Implemented |
| Touch gesture scroll tracking | `onTouchStart/Move/End` delta tracking | **absent** | ⚠️ Minor gap (desktop-first) |
| Scroll-spy (track visible message) | `onScrollSpyScroll` + `onRegisterMessage/onUnregisterMessage` | **absent** | ❌ Missing (needed for msg navigation) |
| Message anchor/navigate | `navigateMessageByOffset(offset)` uses scroll-spy | **absent** | ❌ Missing |

### 2.5 Diff / Review

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Unified diff in tool block | via `SessionReview` + diff display | `computeSimpleDiff()` LCS in `ToolBlock` | ✅ Implemented |
| Split (side-by-side) diff | `diffStyle: "unified" | "split"` in `LayoutContext` | **absent** | ❌ Missing |
| Standalone review panel | `SessionReviewTab` component + `review.panelOpened` layout state | **absent** | ❌ Full panel missing |
| Line comments on diff | `CommentsContext {add,remove,list,setFocus}`, `LineComment {id,file,selection,comment,time}` | **absent** | ❌ Full subsystem missing |
| File-level diff navigation | `pendingDiff`, `activeDiff` in tree state | **absent** | ❌ Missing |
| Diff scope toggle (session/turn) | `changes: "session" | "turn"` | **absent** | ❌ Missing |

### 2.6 Notifications & Feedback

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Toast / notification system | `NotificationContext {TurnCompleteNotification, ErrorNotification}` | **absent** | ❌ Missing entirely |
| Turn-complete notification | `type:"turn-complete"` + OS `Platform.notify()` + sound | **absent** | ❌ Missing |
| Error notification | `type:"error"` + sound | **absent** | ❌ Missing |
| Context usage warning toast | fired when approaching token limit | **absent** | ❌ Missing |
| Sound system | `sounds` config, `Platform.notify()` | **absent** | ❌ Missing |
| Copy-to-clipboard feedback | 2s "Copied" state on copy button | **absent** | ❌ Missing (no copy button) |

### 2.7 Model Selector

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Model search | filter by name/id/provider | ✅ `searchQuery` state in `model-selector.tsx` | ✅ Implemented |
| Provider grouping | grouped sections per provider | ✅ `groupedModels` | ✅ Implemented |
| Recent models (max 5) | tracked in localStorage | ✅ `recentModels` state | ✅ Implemented |
| Model favorites | star/favourite marking | **absent** | ❌ Missing |
| Cost / pricing display | `input/output` price per token | **absent** | ❌ Missing |
| Free model indicator | tag on free models | **absent** | ❌ Missing |
| "Latest" model indicator | tag on newest model | **absent** | ❌ Missing |
| Model detail tooltip | hover tooltip with capabilities | **absent** | ❌ Missing |
| Provider connection status | provider connected/disconnected indicator | **absent** | ❌ Missing |

### 2.8 State Persistence

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Prompt autosave per session | `PromptContext` – 20-session LRU | **absent** | ❌ Missing |
| Scroll position per session | `SessionView.scroll` debounced 250ms, restored on mount | **absent** | ❌ Missing |
| File tabs per session | `LayoutContext.sessionTabs` with `normalizeTab()` | **absent** | ❌ Missing |
| Comment state per session | `CommentsContext` – 20-session LRU | **absent** | ❌ Missing |
| Review open state per session | `SessionView.reviewOpen[]` | **absent** | ❌ Missing |

---

## 3. Prioritised Implementation Plan

### Priority 1 — High Impact, Self-Contained (Sprint 1)

---

#### P1-A: Copy Response Button
**Effort:** Small (1–2 hours)

**What:** Add a "Copy" button to the last assistant text part in each turn.

**Where to implement:**
- `message-bubble.tsx` — inside `TurnGroup` or `MessageBubbleInner`, detect last text part
- Add `copy-btn` element at bottom-right of response text area
- Use `navigator.clipboard.writeText()`
- 2-second `copied` boolean state for feedback ("Copied ✓")

**Data needed:** `message.parts` already available; filter for `type === 'text'`, take last.

---

#### P1-B: Inline Session Title Editing
**Effort:** Medium (3–4 hours)

**What:** Click the session name in `ChatHeaderBar` to edit it inline.

**Where to implement:**
- `chat-widget.tsx` — Add `title: {draft: string, editing: boolean, saving: boolean}` state to `ChatComponent`
- `ChatHeaderBar` — replace static session name `<span>` with conditional `<input>` or `contenteditable`
- On blur or Enter: call `sessionService.renameSession(id, draft)` (needs new method)
- `opencode-protocol.ts` — add `renameSession(sessionId, title): Promise<void>` to `OpenCodeService`
- `openspace-core/node/opencode-proxy.ts` — forward to SDK `Session.setTitle()`

**State flow:**
```
ChatHeaderBar
  titleEditing: boolean
  titleDraft: string
  titleSaving: boolean
  onStartEdit → set editing=true
  onTitleChange → update draft
  onSave → call openCodeService.renameSession() → set saving/editing
```

---

#### P1-C: Prompt Autosave Per Session
**Effort:** Medium (2–3 hours)

**What:** Persist the current prompt text (and attachments) when switching sessions; restore on return.

**Where to implement:**
- New file: `openspace-chat/src/browser/prompt-session-store.ts`
  ```typescript
  interface PromptSnapshot { text: string; /* serialized contenteditable HTML */ }
  class PromptSessionStore {
    // Map<sessionId, PromptSnapshot>, max 20 LRU
    save(sessionId: string, snapshot: PromptSnapshot): void
    restore(sessionId: string): PromptSnapshot | undefined
  }
  ```
- `prompt-input/prompt-input.tsx` — on unmount: serialize contenteditable → save; on mount: restore if snapshot exists
- `chat-widget.tsx` / `ChatComponent` — inject `PromptSessionStore`, pass `sessionId` to PromptInput

---

#### P1-D: Token / Cost Display
**Effort:** Medium (3–4 hours)

**What:** Show total tokens used and cost after each assistant turn.

**Where to implement:**
- `message-bubble.tsx` — in `TurnGroup` footer, after streaming ends show token/cost summary
- `opencode-protocol.ts` — `AssistantMessage` already has `tokens?` and `cost?` fields from SDK; verify they're populated
- Add `TurnCostBar` sub-component:
  ```tsx
  interface TurnCostBarProps {
    tokens: { input: number; output: number; cache?: { read: number; write: number } };
    cost: number;
  }
  ```
- Display format: `↑{input} ↓{output} · $0.0042`
- Only show when `cost > 0` (hide for free/unknown models)

**Data flow:** `message.parts` → find `step-finish` parts (which carry `cost`, `tokens`, `cache`) → aggregate across turn.

---

#### P1-E: Context Usage Indicator
**Effort:** Small (1–2 hours)

**What:** Show a small token-usage bar or counter in `ChatFooter`.

**Where to implement:**
- `chat-widget.tsx:ChatFooter` — add optional `tokenUsage?: {used: number, limit: number}` prop
- `message-bubble.tsx` or `ChatComponent` — compute from last `step-finish` part's `tokens.total`
- Simple `<span>` showing e.g. "42k / 200k tokens"
- Threshold highlight when > 80% used

---

### Priority 2 — Medium Impact (Sprint 2)

---

#### P2-A: File Attachment Line Range Selection
**Effort:** Large (1–2 days)

**What:** When attaching a file via @mention or drag-drop, allow specifying a line range (e.g. `file.ts:10-25`).

**Where to implement:**

1. **`prompt-input/types.ts`** — extend `FilePart`:
   ```typescript
   interface FilePart {
     type: 'file';
     path: string;
     content: string;
     start: number;
     end: number;
     selection?: { startLine: number; endLine: number };  // ADD
   }
   ```

2. **`prompt-input/prompt-input.tsx`** — after file pill inserted, show inline range picker:
   - Small popover attached to file pill: `[lines 10-25 ▼]`
   - Input: two number fields, or a range string `10-25`

3. **`prompt-input/build-request-parts.ts`** — include `selection` in outgoing `FileMessagePart`

4. **`opencode-protocol.ts`** — verify `FileMessagePart` carries selection through to SDK

5. **`PromptContextItems` sub-component** (new):
   - Rendered below pill area, above text input
   - Shows file path + line range + remove `×` button
   - Mirrors opencode's `PromptContextItems`

---

#### P2-B: Prompt Context Items Panel
**Effort:** Medium (4–6 hours)

**What:** Show currently attached files and their selections in a visible panel below the pills.

**Where to implement:**
- New: `prompt-input/prompt-context-items.tsx`
  ```tsx
  interface ContextItem {
    key: string;
    type: 'file';
    path: string;
    selection?: { startLine: number; endLine: number };
  }
  interface PromptContextItemsProps {
    items: ContextItem[];
    onRemove: (key: string) => void;
  }
  ```
- `prompt-input.tsx` — render `<PromptContextItems>` above input when `items.length > 0`
- CSS: small pill-row with file icon, path abbreviation, range badge, `×` button

---

#### P2-C: Toast / Notification System
**Effort:** Medium (4–6 hours)

**What:** Add a lightweight toast stack for turn-complete, errors, and file operation feedback.

**Where to implement:**

1. New: `openspace-chat/src/browser/toast-service.ts`
   ```typescript
   interface Toast { id: string; type: 'info'|'success'|'error'|'warning'; message: string; ttl?: number; }
   class ToastService {
     toasts: Toast[];
     show(toast: Omit<Toast,'id'>): void;
     dismiss(id: string): void;
   }
   ```

2. New: `openspace-chat/src/browser/toast-stack.tsx` — fixed-position stack rendering toasts (bottom-right), auto-dismiss after TTL

3. `chat-widget.tsx` — inject `ToastService`, render `<ToastStack>` inside `chat-container`

4. Wire up in `ChatComponent`:
   - On streaming end → `toastService.show({type:'success', message:'Turn complete'})`
   - On `sessionError` → `toastService.show({type:'error', message: sessionError})`
   - On delete/fork/revert → `toastService.show({type:'info', ...})`

---

#### P2-D: Split Diff View Toggle
**Effort:** Medium (4–6 hours)

**What:** Add toggle between unified (current) and split (side-by-side) diff in `ToolBlock`.

**Where to implement:**

1. **`diff-utils.ts`** — extend to produce structured side-by-side output:
   ```typescript
   interface SplitDiffLine {
     left?: { type: 'del'|'ctx', text: string; lineNo: number };
     right?: { type: 'add'|'ctx', text: string; lineNo: number };
   }
   function computeSplitDiff(oldText: string, newText: string): SplitDiffLine[]
   ```

2. **`message-bubble.tsx:ToolBlock`** — add toggle button `[Unified | Split]` in diff header

3. New: `diff-split-view.tsx` — two-column table layout, line numbers, syntax-aware coloring

4. Persist preference (unified/split) in `openspace-settings` or `localStorage`

---

#### P2-E: Session Summary in Header
**Effort:** Small (2 hours)

**What:** Show `+N -M files` summary badge in `ChatHeaderBar` next to session name.

**Where to implement:**
- `opencode-protocol.ts` — `Session` type should already have `summary?: {additions, deletions, files}` from SDK; verify
- `ChatHeaderBar` props — add `sessionSummary?: {additions: number, deletions: number, files: number}`
- `ChatComponent` — extract from `sessionService.activeSession.summary`
- Render in `ChatHeaderBar` as small `+42 -7` badge

---

### Priority 3 — Larger Subsystems (Sprint 3+)

---

#### P3-A: Standalone Review Panel
**Effort:** Large (3–5 days)

**What:** A dedicated right-panel view showing file diffs from the current session, matching `SessionReviewTab`.

**Architecture:**

1. New extension or sub-module: `openspace-chat/src/browser/review-panel/`

2. `review-panel-widget.tsx` — `ReactWidget` rendering:
   - File list sidebar (changed files)
   - Diff view for selected file (unified or split)
   - Toggle button: `Cmd+Shift+R` keybind

3. `review-panel-contribution.ts` — registers as secondary view in right panel

4. `opencode-protocol.ts` — already has `getDiff(sessionId): Promise<FileDiff[]>`

5. Layout store — add `reviewPanelOpen: boolean` to `SessionService` state or Theia layout

---

#### P3-B: Line Comments on Diffs
**Effort:** Large (3–5 days)

**What:** Allow adding comments to specific lines in the review panel, with comments persisted per session.

**Architecture:**

1. New: `openspace-core/src/browser/comments-service.ts`
   ```typescript
   interface LineComment {
     id: string;
     file: string;
     selection: { startLine: number; endLine: number };
     comment: string;
     time: number;
   }
   interface CommentsService {
     add(input: Omit<LineComment,'id'|'time'>): LineComment;
     remove(file: string, id: string): void;
     list(file: string): LineComment[];
     all(): LineComment[];
     onCommentsChanged: Event<void>;
   }
   ```

2. `CommentsServiceImpl` — localStorage per session, max 20 LRU (mirrors `CommentsContext` in opencode)

3. `review-panel-widget.tsx` — `onLineComment` handler, shows `CommentsOverlay` on diff lines

4. `PromptInput` — `PromptContextItems` shows comments from `CommentsService`, enables sending comment as context

---

#### P3-C: Scroll-Spy + Message Navigation
**Effort:** Medium (1 day)

**What:** Track which message is visible, enable `navigateMessageByOffset()` keyboard shortcut.

**Where to implement:**

1. `message-timeline.tsx` — `onRegisterMessage(el, id)` / `onUnregisterMessage(id)` pattern using `IntersectionObserver`

2. `ChatComponent` — `visibleMessageId` state; keyboard shortcuts `Alt+↑` / `Alt+↓` call `scrollToMessage(id)`

3. `chat-view-contribution.ts` — register keybindings

---

#### P3-D: Per-Session Scroll Position Persistence
**Effort:** Small (2–3 hours)

**What:** Restore scroll position when returning to a session.

**Where to implement:**
- `message-timeline.tsx` — save `containerRef.scrollTop` on scroll (250ms debounce)
- New: `openspace-chat/src/browser/scroll-position-store.ts` — Map<sessionId, scrollTop>, 50 LRU
- `MessageTimeline` — on `sessionId` prop change: restore from store after next paint

---

#### P3-E: Model Detail Tooltip + Pricing
**Effort:** Medium (4–6 hours)

**What:** Show model capabilities (context window, pricing) in a tooltip from the model selector.

**Where to implement:**
- `model-selector.tsx:ModelOption` — add hover popover `ModelTooltip`
- `opencode-protocol.ts` — model type should include `contextLength?`, `inputPrice?`, `outputPrice?`; verify SDK
- Display: "128k context · $3/1M in · $15/1M out"
- Add "free" and "latest" badges to `ModelOption`

---

## 4. Summary Table

| ID | Feature | Files Affected | Effort | Priority |
|---|---|---|---|---|
| P1-A | Copy response button | `message-bubble.tsx` | S | 🔴 P1 |
| P1-B | Inline session title editing | `chat-widget.tsx`, `opencode-protocol.ts`, `opencode-proxy.ts` | M | 🔴 P1 |
| P1-C | Prompt autosave per session | new `prompt-session-store.ts`, `prompt-input.tsx` | M | 🔴 P1 |
| P1-D | Token / cost display per turn | `message-bubble.tsx` | M | 🔴 P1 |
| P1-E | Context usage indicator in footer | `chat-widget.tsx:ChatFooter` | S | 🔴 P1 |
| P2-A | File attachment with line range | `types.ts`, `prompt-input.tsx`, `build-request-parts.ts` | L | 🟡 P2 |
| P2-B | Prompt context items panel | new `prompt-context-items.tsx` | M | 🟡 P2 |
| P2-C | Toast / notification system | new `toast-service.ts`, `toast-stack.tsx`, `chat-widget.tsx` | M | 🟡 P2 |
| P2-D | Split diff view toggle | `diff-utils.ts`, `message-bubble.tsx`, new `diff-split-view.tsx` | M | 🟡 P2 |
| P2-E | Session summary badge in header | `chat-widget.tsx:ChatHeaderBar` | S | 🟡 P2 |
| P3-A | Standalone review panel | new `review-panel/` | L | 🟢 P3 |
| P3-B | Line comments on diffs | new `comments-service.ts`, `review-panel/` | L | 🟢 P3 |
| P3-C | Scroll-spy + message navigation | `message-timeline.tsx`, `chat-view-contribution.ts` | M | 🟢 P3 |
| P3-D | Per-session scroll persistence | new `scroll-position-store.ts`, `message-timeline.tsx` | S | 🟢 P3 |
| P3-E | Model detail tooltip + pricing | `model-selector.tsx` | M | 🟢 P3 |

*S = small (<4h), M = medium (4–8h), L = large (1–3 days)*

---

## 5. Already Implemented (No Action Needed)

The following opencode features are already correctly implemented in theia-openspace:

- Streaming with throttled updates + TurnGroup collapsible steps
- Session archiving, forking, reverting, compacting
- Permission request inline prompts (matched by callID)
- Reasoning parts (`ReasoningBlock`)
- Compaction display divider
- Snapshot and patch parts
- Retry countdown banner
- Scroll-to-bottom button + new-messages indicator
- Load older messages pagination
- Session search + pagination
- Context tool grouping (read/grep/glob → "Gathered context")
- Task tool polling child session every 2s
- Multi-question dock (single + multi-tab flow)
- @mention typeahead for files + agents
- Image paste/drag-drop
- Prompt history ↑↓ navigation (100 entries)
- Slash commands (`/clear`, `/compact`, `/help`)
- Model selector with search, recent models, provider grouping
- Live elapsed timer in TurnGroup streaming bar
- Mermaid diagram rendering
- KaTeX math rendering
- ANSI escape sequence rendering in bash output
- File path linkification in markdown
