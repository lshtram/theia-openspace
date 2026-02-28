# Software Requirements Specification: Conversation Widget & Prompt Input

**Document ID:** SRS-CONVERSATION-WIDGET  
**Version:** 1.0  
**Date:** 2026-02-23  
**Status:** DRAFT  
**Supersedes:** REQ-MULTI-PART-PROMPT (partial), REQ-MESSAGE-TIMELINE (partial)

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the complete behavioral requirements for the Conversation Widget (chat panel) and Prompt Input components of Theia OpenSpace. It covers all user-facing behavior from composing messages to viewing streaming responses, and is intended to serve as the single source of truth for:

- Implementation correctness verification
- Test case derivation
- Bug triage (is it a bug or a feature gap?)

### 1.2 Scope

**In scope:**
- Prompt input: text entry, keyboard shortcuts, @mentions, /commands, !shell mode, history, paste, drag-drop, image attachments
- Message timeline: message rendering, streaming display, auto-scroll, tool call cards, turn grouping
- Message bubbles: markdown rendering, code blocks, diffs, tool blocks, permission cards, retry banners
- Session management UI: session status, model selector, session list
- Question dock: server-initiated questions
- Error handling: network errors, streaming failures, retry behavior

**Out of scope:**
- Backend (opencode server) behavior
- Session CRUD API
- Agent/MCP tool implementation
- Presentation/whiteboard modalities
- Electron-specific behavior
- Theming (colors, fonts) — covered in separate spec

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| **Prompt** | Array of `ContentPart` representing user's composed message before sending |
| **Pill** | Non-editable inline `<span>` in the contenteditable editor representing a file or agent mention |
| **Turn** | A user message + the complete assistant response (including all tool calls) |
| **TurnGroup** | Visual grouping of intermediate assistant steps (tool calls, thinking) between user message and final answer |
| **Streaming** | Real-time display of assistant response tokens as they arrive via SSE |
| **Latched boolean** | A boolean that stays `true` for a minimum duration after the source goes `false`, preventing flicker |
| **Session active** | The opencode server is processing a request for the current session (streaming or awaiting tool results) |

### 1.4 References

- OpenCode client reference: `/Users/Shared/dev/opencode/packages/app/src/`
- Cross-tool research: `docs/research/ai-coding-agent-conversation-ui-research.md`
- Manual test plan: `docs/test-input-prompt.md`
- Implementation: `extensions/openspace-chat/src/browser/`

---

## 2. Prompt Input

### 2.1 Editor

**REQ-PI-001: ContentEditable editor**  
The prompt input MUST use a `<div contenteditable="true">` element (not a `<textarea>`) to support inline pill rendering for @mentions and file references.

**REQ-PI-002: Plain text normalization**  
The editor MUST normalize its DOM to contain only:
- Text nodes (plain text)
- `<span contenteditable="false">` elements (pills) with `data-type` and `data-*` attributes
- `<br>` elements (line breaks)
- Zero-width space characters (`\u200B`) for caret positioning adjacent to pills

**REQ-PI-003: Auto-grow**  
The editor MUST auto-grow vertically as the user types, up to a maximum height of 200px (approximately 40% of typical panel height). Beyond this height, the editor MUST scroll internally.

**REQ-PI-004: Placeholder text**  
When the editor is empty, it MUST display placeholder text: "Message OpenCode..." (or similar). The placeholder MUST disappear when the editor receives focus and contains content.

**REQ-PI-005: Focus behavior**  
The editor MUST receive focus automatically when:
- The chat widget becomes visible
- A message is successfully sent (editor cleared)
- The user switches sessions
- The user closes a question dock

**REQ-PI-006: IME composition**  
The editor MUST correctly handle IME (Input Method Editor) composition for CJK languages. During composition (`compositionstart` → `compositionend`), key events MUST NOT trigger submit, slash commands, or @mention popups.

### 2.2 Keyboard Shortcuts

**REQ-KB-001: Enter to submit**  
Pressing `Enter` (without modifiers) MUST submit the message, provided:
- No typeahead/popover is open (if open, Enter selects the active item)
- IME composition is not in progress
- The editor is not empty (whitespace-only counts as empty)

**REQ-KB-002: Shift+Enter for newline**  
Pressing `Shift+Enter` MUST insert a newline (`<br>`) without submitting. This MUST work even during IME composition.

**REQ-KB-003: Ctrl+U to clear**  
Pressing `Ctrl+U` MUST clear all content from the editor (text, pills, everything).

**REQ-KB-004: Escape behavior**  
Pressing `Escape` MUST:
- If a typeahead popover is open: close the popover
- If shell mode is active: exit shell mode (remove `!` prefix, restore normal styling)
- Otherwise: no action

**REQ-KB-005: ArrowUp for history (empty editor)**  
Pressing `ArrowUp` when the editor is empty (or cursor is at position 0 in a single-line editor) MUST navigate to the previous prompt in history. See §2.7 History.

**REQ-KB-006: ArrowDown for history**  
Pressing `ArrowDown` while navigating history MUST move forward through history. Reaching the end MUST restore the draft that was being composed before entering history mode.

### 2.3 @Mention Typeahead

**REQ-AT-001: Trigger**  
Typing `@` MUST open a typeahead popover showing available mention targets. The `@` character itself is consumed by the typeahead and not displayed as literal text.

**REQ-AT-002: Categories**  
The typeahead popover MUST show items in two categories:
1. **Agents** — all non-hidden agents from the opencode server (`GET /project/:id/agent`), excluding the primary agent
2. **Files** — workspace files matching the typed query (fuzzy search)

Agents MUST appear above files in the list.

**REQ-AT-003: Fuzzy filtering**  
As the user types after `@`, the list MUST filter using case-insensitive fuzzy matching. Example: `@pk` matches `package.json`.

**REQ-AT-004: File search debounce**  
File search queries MUST be debounced (minimum 250ms after last keystroke) to avoid excessive filesystem operations.

**REQ-AT-005: Keyboard navigation**  
- `ArrowUp` / `ArrowDown` MUST navigate the highlighted item
- `Enter` or `Tab` MUST select the highlighted item
- `Escape` MUST close the popover without selecting

**REQ-AT-006: Selection inserts pill**  
Selecting an item MUST:
1. Remove the `@` trigger and any typed query text from the editor
2. Insert a non-editable pill `<span>` at the cursor position with appropriate `data-type` ("agent" or "file") and `data-name`/`data-path` attributes
3. Position the cursor after the pill
4. Close the popover

**REQ-AT-007: Pill visual distinction**  
Agent pills MUST be visually distinct from file pills (different background color or icon).

**REQ-AT-008: Pill deletion**  
- Pressing `Backspace` with the cursor immediately after a pill MUST delete the pill
- When a pill is at position 0 (first element in editor), `Backspace` MUST still be able to delete it
- Clicking the pill (optional): may open the referenced file or show agent info

**REQ-AT-009: Complete agent listing**  
The agent list MUST include ALL agents available from the opencode server, not just a hardcoded subset. The list MUST be fetched from the server and cached.

**REQ-AT-010: Complete file listing**  
The file list MUST search across ALL files in the workspace (not just open files). Recent files SHOULD appear at the top of the list.

### 2.4 Slash Commands

**REQ-SC-001: Trigger**  
Typing `/` as the FIRST character in the editor (position 0) MUST open a slash command popover.

**REQ-SC-002: Command sources**  
The slash command list MUST include commands from ALL of these sources:
1. **Local client commands** — commands handled locally without sending to the model (e.g., `/clear`, `/compact`, `/model`)
2. **Server-side commands** — commands from the opencode server (e.g., `/connect`, `/models`, prompts from MCP servers)
3. **MCP prompt commands** — commands exposed by MCP servers in the format `/mcp__<server>__<prompt>`

**REQ-SC-003: Fuzzy filtering**  
As the user types after `/`, the list MUST filter using case-insensitive fuzzy matching.

**REQ-SC-004: Keyboard navigation**  
Same as REQ-AT-005: ArrowUp/Down to navigate, Enter/Tab to select, Escape to dismiss.

**REQ-SC-005: Command execution**  
Selecting a slash command MUST:
- For local commands: execute the command immediately (e.g., `/clear` clears the chat) without sending to the model
- For server commands: send the command text to the opencode server as a message
- For MCP prompts: send as a message with the MCP prompt format

**REQ-SC-006: Command descriptions**  
Each command in the popover MUST show both the command name and a brief description.

### 2.5 Shell Mode

**REQ-SH-001: Activation**  
Typing `!` as the FIRST character in the editor MUST activate shell mode.

**REQ-SH-002: Visual indicator**  
When shell mode is active, the editor MUST show a visual indicator:
- Monospace font
- Different background color or border
- A label or icon indicating "Shell mode"

**REQ-SH-003: Exit**  
Shell mode MUST deactivate when:
- The user presses `Escape` (clears the `!` prefix)
- The user presses `Backspace` to delete the `!` prefix
- The message is submitted

**REQ-SH-004: Shell execution**  
When a shell mode message is submitted, it MUST be sent as a shell command execution (NOT as a chat message to the AI model). The command (without the `!` prefix) MUST be executed directly via the opencode server's shell/terminal interface.

### 2.6 Paste and Drag-Drop

**REQ-PD-001: Plain text paste**  
Pasting text MUST strip all HTML formatting and insert only plain text. Rich text from web pages, Word documents, etc. MUST be reduced to plain text.

**REQ-PD-002: Image paste**  
Pasting an image from the clipboard MUST:
1. Detect the image in `clipboardData.items`
2. Read it as a data URL
3. Add it as an image attachment (displayed as a thumbnail above the editor)
4. Supported formats: PNG, JPEG, GIF, WebP

**REQ-PD-003: Image attachment display**  
Image attachments MUST be displayed as thumbnails (max 64x64px) in a horizontal row above the editor. Each thumbnail MUST have:
- The filename (or "image.png" for pasted images)
- An X button to remove the attachment

**REQ-PD-004: Image size limit**  
Images exceeding 10 MB MUST be rejected with a user-visible error message.

**REQ-PD-005: File drag-drop**  
Dragging a file from the Theia file tree into the editor MUST:
1. Show a visual drop zone overlay while dragging
2. On drop, add the file as an inline pill (same as @mention selection)

**REQ-PD-006: Image drag-drop**  
Dragging an image file into the editor MUST add it as an image attachment (same as image paste).

### 2.7 Prompt History

**REQ-PH-001: History storage**  
The prompt input MUST maintain a history of sent messages, up to 100 entries per session.

**REQ-PH-002: Navigate back**  
Pressing `ArrowUp` in an empty editor MUST show the most recently sent message. Pressing `ArrowUp` again MUST show progressively older messages.

**REQ-PH-003: Navigate forward**  
Pressing `ArrowDown` while viewing history MUST move to more recent messages. Reaching the newest entry and pressing `ArrowDown` MUST restore the draft.

**REQ-PH-004: Draft preservation**  
Before entering history mode, the current editor content MUST be saved as a draft. Returning from history MUST restore this draft exactly.

**REQ-PH-005: Pill preservation in history**  
History entries MUST preserve pills (not just their text content). When navigating to a historical entry that contained @mentions, the pills MUST render as pills, not as raw text. Implementation: store both the text content and the editor innerHTML for each history entry.

**REQ-PH-006: Separate shell history**  
Shell mode (`!` prefix) SHOULD maintain a separate history from normal chat messages.

### 2.8 Message Sending

**REQ-MS-001: Submit flow**  
When the user submits a message:
1. Parse the editor DOM into a `Prompt` (array of `ContentPart`)
2. Convert the `Prompt` to `MessagePart[]` via `buildRequestParts()`
3. Add the message to history
4. Clear the editor
5. Call `SessionService.sendMessage(parts)` to send to the opencode server
6. Scroll the timeline to the bottom

**REQ-MS-002: Optimistic message display**  
The user's message MUST appear in the timeline immediately after submission (optimistic update), before the server acknowledges receipt.

**REQ-MS-003: Queue during streaming**  
If the user submits a message while the assistant is streaming a response, the message MUST be queued. Queued messages MUST be sent sequentially after the current streaming response completes.

**REQ-MS-004: Input during streaming**  
The prompt input MUST remain enabled and editable while the assistant is streaming. The user MUST be able to compose their next message during streaming.

**REQ-MS-005: Empty message prevention**  
Messages that contain only whitespace (no text, no pills, no images) MUST NOT be sent. The submit action MUST be a no-op for empty messages.

---

## 3. Message Timeline

### 3.1 Layout

**REQ-TL-001: Vertical message list**  
Messages MUST be displayed in a vertical scrollable list, ordered chronologically (oldest at top, newest at bottom).

**REQ-TL-002: Role distinction**  
User messages and assistant messages MUST be visually distinct through different styling (background color, alignment, or border).

**REQ-TL-003: Turn grouping**  
Consecutive assistant messages (including tool calls, thinking steps, and the final response) MUST be grouped into a single "turn" with:
- A collapsible "Show steps" / "Hide steps" toggle for intermediate steps
- The final assistant text response shown prominently outside the collapsed group
- The number of steps shown in the toggle label (e.g., "5 steps")

**REQ-TL-004: Turn group content**  
A turn group MUST include ALL of the following between a user message and the next user message:
- Thinking/reasoning blocks
- Tool call cards (file reads, bash commands, file writes, etc.)
- Intermediate assistant text (not the final response)
The final assistant text response is the LAST text message before the next user message.

**REQ-TL-005: Empty state**  
When no messages exist in the current session, the timeline MUST show an empty state with a welcome message or prompt suggestions.

### 3.2 Streaming Display

**REQ-SD-001: Token streaming**  
Assistant responses MUST be displayed token-by-token as they arrive via SSE events. There MUST NOT be visible chunking (large blocks appearing at once).

**REQ-SD-002: Streaming throttle**  
DOM updates during streaming MUST be throttled (recommended: 100ms interval, leading+trailing edge) to prevent excessive re-renders while maintaining visual smoothness.

**REQ-SD-003: Streaming cursor**  
During streaming, a blinking cursor (▋) or equivalent visual indicator MUST appear at the end of the streaming text to indicate ongoing generation.

**REQ-SD-004: Markdown during streaming**  
Markdown MUST be rendered progressively during streaming. The renderer MUST handle incomplete markdown gracefully:
- Unclosed code blocks MUST display as open code blocks (not raw backticks)
- Unclosed bold/italic MUST not corrupt subsequent text
- Incomplete links MUST display as partial text

**REQ-SD-005: Status text**  
During streaming, a status line MUST display the current agent activity:
- "Thinking..." — during reasoning/thinking
- "Reading files" — during file read tool calls
- "Running commands" — during bash/terminal tool calls
- "Making edits" — during file write tool calls
- "Ready" — when idle

The status text MUST be throttled (recommended: 2.5 seconds minimum between changes) to prevent rapid flickering.

**REQ-SD-006: Session active latching**  
The "session active" state MUST use a latched boolean (recommended: 600ms hold time) to prevent the UI from flickering between "streaming" and "idle" states during gaps between SSE chunks.

**REQ-SD-007: Elapsed time**  
During streaming, an elapsed time indicator SHOULD be displayed showing how long the current response has been generating.

### 3.3 Auto-Scroll

**REQ-AS-001: Auto-scroll when at bottom**  
When the user is at or near the bottom of the timeline (within 50px threshold), new streaming content MUST automatically scroll the view to keep the latest content visible.

**REQ-AS-002: Pause on user scroll-up**  
When the user scrolls up (away from the bottom beyond the threshold), auto-scroll MUST pause. New content MUST NOT cause the view to jump.

**REQ-AS-003: User scroll detection**  
The system MUST distinguish between user-initiated scrolls (mouse wheel, trackpad, scroll bar drag) and programmatic scrolls (auto-scroll). Only user-initiated scrolls MUST trigger auto-scroll pause.

**REQ-AS-004: Scroll-to-bottom button**  
When the user is scrolled away from the bottom and new content is arriving, a floating "scroll to bottom" button MUST appear. Clicking this button MUST:
1. Scroll to the bottom of the timeline
2. Re-enable auto-scroll
3. Hide the button

**REQ-AS-005: Submit scrolls to bottom**  
When the user submits a message, the timeline MUST always scroll to the bottom regardless of the current scroll position.

**REQ-AS-006: ResizeObserver for streaming**  
During streaming, a `ResizeObserver` MUST be used to detect content height changes and trigger auto-scroll (if enabled). This handles cases where content grows without discrete scroll events.

### 3.4 Stop/Cancel

**REQ-SC-001: Stop button**  
During streaming, a stop button MUST be displayed (replacing or alongside the send button). The stop button MUST:
- Have a clear visual indicator (e.g., square stop icon)
- Be keyboard-accessible

**REQ-SC-002: Stop behavior**  
Clicking the stop button MUST:
1. Send an abort/cancel request to the opencode server
2. Immediately hide the stop button and show the send button
3. Stop any streaming animation, elapsed timer, and status text
4. Preserve the partial response that was received (do NOT discard it)
5. Reset the session active state so the UI is fully interactive

**REQ-SC-003: Stop state cleanup**  
After stopping, ALL streaming-related state MUST be fully reset:
- No stuck spinners
- No lingering status text
- No frozen elapsed timer
- Input is enabled
- Send button is shown (not stop button)

---

## 4. Message Bubbles

### 4.1 Markdown Rendering

**REQ-MR-001: Standard markdown**  
Assistant messages MUST render standard markdown including:
- Headings (h1-h6)
- Bold, italic, strikethrough
- Ordered and unordered lists
- Links (clickable, open in new tab or Theia browser)
- Inline code
- Block quotes
- Horizontal rules
- Tables

**REQ-MR-002: Code blocks**  
Fenced code blocks (`` ``` ``) MUST:
- Display with syntax highlighting appropriate to the declared language
- Show a language label in the header
- Provide a "Copy" button that copies the code content to clipboard
- Use a monospace font
- Support all common languages (TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, SQL, Bash, JSON, YAML, HTML, CSS, etc.)

**REQ-MR-003: Code block themes**  
Syntax highlighting MUST adapt to the current Theia theme (dark or light).

**REQ-MR-004: Math rendering**  
LaTeX math expressions MUST be rendered:
- Inline: `$...$` → inline math
- Block: `$$...$$` → display math

**REQ-MR-005: Mermaid diagrams**  
Mermaid diagram code blocks (`` ```mermaid ``) MUST be rendered as SVG diagrams.

**REQ-MR-006: ANSI escape codes**  
Terminal output containing ANSI escape codes MUST be rendered with appropriate colors (for tool call output display).

**REQ-MR-007: XSS protection**  
All rendered markdown MUST be sanitized to prevent XSS attacks. User-provided HTML within markdown MUST be escaped or stripped.

**REQ-MR-008: File path links**  
File paths in assistant responses matching the pattern `file:line` or `file:line:column` MUST be rendered as clickable links that open the file at the referenced line in Theia's editor.

### 4.2 Tool Call Cards

**REQ-TC-001: Individual cards**  
Each tool call MUST be rendered as its own collapsible card within the turn group. Cards MUST NOT be grouped under a single "N steps completed" summary.

**REQ-TC-002: Card anatomy**  
Each tool card MUST show:
- An icon appropriate to the tool type (file icon for reads, terminal icon for bash, edit icon for writes)
- A descriptive label (filename for file operations, command preview for bash)
- Collapse/expand chevron
- Duration (how long the tool call took)
- Status indicator (pending/running/complete/error)

**REQ-TC-003: Card body**  
When expanded, a tool card MUST show:
- **File reads**: the file content (or relevant portion) with syntax highlighting
- **Bash commands**: the command and its output (with ANSI rendering)
- **File writes**: a diff view showing changes (see §4.3)
- **Other tools**: appropriate content based on tool type

**REQ-TC-004: Clickable file paths**  
File paths displayed in tool card headers MUST be clickable links that open the file in Theia's editor.

**REQ-TC-005: Collapse state**  
- Completed tool calls SHOULD default to collapsed
- In-progress tool calls MUST be expanded
- The user MUST be able to toggle collapse state by clicking the header or chevron

### 4.3 Diff Viewer

**REQ-DV-001: Diff display for file writes**  
File write tool calls MUST show a diff view comparing the before and after states of the file.

**REQ-DV-002: Diff styling**  
Diffs MUST use color-coded styling:
- Added lines: green background with `+` prefix
- Removed lines: red background with `-` prefix
- Context lines: neutral background

**REQ-DV-003: Diff statistics**  
Each diff MUST show summary statistics: `+N / -M` lines.

**REQ-DV-004: New file diffs**  
For new file creation, ALL lines MUST be shown as additions (green).

### 4.4 Permission Cards

**REQ-PC-001: Inline permission prompts**  
When the opencode server requests permission for an action, an inline permission card MUST appear in the timeline (NOT as a modal dialog).

**REQ-PC-002: Permission card content**  
The permission card MUST show:
- What action is being requested (e.g., "Run bash command: npm test")
- Three buttons: **Deny**, **Allow Once**, **Allow Always**
- A preview of the action (diff for file writes, command text for bash)

**REQ-PC-003: Permission card behavior**  
- **Deny**: blocks the action, sends rejection to server, removes the card
- **Allow Once**: permits the action this time only, sends approval to server
- **Allow Always**: permits the action and remembers the permission for future requests of the same type

**REQ-PC-004: Permission visibility**  
Permission cards MUST be visually prominent (distinct border, background, or badge) to ensure the user notices that the agent is waiting for approval.

### 4.5 Todo Tool Rendering

**REQ-TD-001: TodoWrite display**  
When the assistant uses the TodoWrite tool, a todo card MUST render showing:
- Each item with its status (pending, in_progress, completed)
- Completed items with strikethrough text
- In-progress items with a distinct indicator (spinner or highlight)
- Priority level (high/medium/low) if provided

### 4.6 Retry Banner

**REQ-RB-001: Error display**  
When a streaming response fails (network error, API error, rate limit), a retry banner MUST appear showing:
- The error description
- Retry countdown: "Retrying in Xs (attempt N/M)..."
- A manual retry button

**REQ-RB-002: Auto-retry**  
The system SHOULD auto-retry with exponential backoff (recommended: up to 5 attempts, starting at 2 seconds).

**REQ-RB-003: Preserved input**  
On error, the user's message MUST NOT be lost. It MUST either remain in the timeline with a retry option, or be restored to the input editor.

---

## 5. Question Dock

**REQ-QD-001: Question display**  
When the opencode server sends a question event (asking the user to choose an option or provide input), a question dock MUST appear between the timeline and the prompt input.

**REQ-QD-002: Question types**  
The question dock MUST support:
- **Multiple choice**: show buttons for each option
- **Text input**: show a text field for free-form answers

**REQ-QD-003: Answer submission**  
Selecting an option or submitting text MUST:
1. Send the answer to the opencode server
2. Dismiss the question dock
3. Return focus to the prompt input

**REQ-QD-004: Multiple questions**  
If multiple questions arrive (e.g., during parallel tool calls), they MUST be displayed in a queue, showing one at a time or stacked.

---

## 6. Session UI

### 6.1 Session Status

**REQ-SS-001: Active indicator**  
While the agent is processing (session is active), the session selector in the header MUST show an animated spinner or pulsing indicator. The animation MUST be smooth and sustained throughout the entire streaming duration — not a brief flash.

**REQ-SS-002: Idle indicator**  
When the session is idle (no active streaming), the session selector MUST show a neutral idle indicator (dim dash, checkmark, or simply no spinner).

**REQ-SS-003: Status consistency**  
The session status indicator MUST be consistent with the streaming state. It MUST NOT flicker between active and idle states during normal streaming (use the latched boolean from REQ-SD-006).

### 6.2 Model Selector

**REQ-MO-001: Model display**  
The current model name MUST be displayed in the chat header.

**REQ-MO-002: Model switching**  
The user MUST be able to switch models via a dropdown. The available models MUST be fetched from the opencode server.

---

## 7. Non-Functional Requirements

### 7.1 Performance

**REQ-PF-001: Streaming smoothness**  
The timeline MUST maintain 60fps during streaming. DOM updates MUST be batched/throttled to prevent jank.

**REQ-PF-002: Large conversation handling**  
The timeline MUST handle conversations with 200+ messages without noticeable lag. Virtual scrolling or lazy rendering MAY be implemented for very large conversations.

**REQ-PF-003: Typeahead responsiveness**  
@mention and /command typeahead results MUST appear within 300ms of the user stopping typing (after debounce).

**REQ-PF-004: Message memoization**  
Completed message bubbles MUST be memoized to prevent re-rendering when new messages are added or streaming updates occur on other messages.

### 7.2 Accessibility

**REQ-AX-001: Keyboard navigation**  
All interactive elements MUST be keyboard-accessible. The user MUST be able to compose, send, and navigate messages without a mouse.

**REQ-AX-002: ARIA annotations**  
- Editor: `role="textbox"`, `aria-multiline="true"`
- Typeahead popover: `role="listbox"` with `aria-activedescendant`
- Tool cards: appropriate ARIA roles for collapsible sections
- Pills: `aria-label` with descriptive text

**REQ-AX-003: Screen reader support**  
New messages MUST be announced to screen readers. Pills MUST be readable.

### 7.3 Error Handling

**REQ-EH-001: Network status**  
The chat widget MUST show a connection status indicator when the SSE connection to the backend is lost. Reconnection MUST be automatic.

**REQ-EH-002: Graceful degradation**  
If the opencode server is unreachable, the chat widget MUST show a clear error message and allow the user to retry connecting. The prompt input MUST remain functional for composing (but sending will fail with an error).

**REQ-EH-003: Streaming recovery**  
If a streaming response is interrupted (network error mid-stream), the partial response MUST be preserved. A retry/reconnect option MUST be shown.

### 7.4 Security

**REQ-SE-001: XSS prevention**  
All user-provided content and server-provided content rendered in the timeline MUST be sanitized against XSS attacks. This includes markdown, code blocks, tool call outputs, and file contents.

**REQ-SE-002: File path safety**  
File paths used in @mentions and tool calls MUST be validated to prevent directory traversal attacks.

---

## 8. Test Requirements

### 8.1 Required Unit Tests

The following behaviors MUST have automated unit tests:

| ID | Component | Behavior |
|----|-----------|----------|
| UT-01 | PromptInput | Enter submits message |
| UT-02 | PromptInput | Shift+Enter inserts newline |
| UT-03 | PromptInput | Ctrl+U clears editor |
| UT-04 | PromptInput | Empty message not submitted |
| UT-05 | PromptInput | @mention typeahead opens on @ |
| UT-06 | PromptInput | @mention fuzzy filtering |
| UT-07 | PromptInput | @mention selection inserts pill |
| UT-08 | PromptInput | /command popover opens at position 0 |
| UT-09 | PromptInput | /command fuzzy filtering |
| UT-10 | PromptInput | /command selection executes command |
| UT-11 | PromptInput | Shell mode activates on ! at position 0 |
| UT-12 | PromptInput | Shell mode exits on Escape |
| UT-13 | PromptInput | History navigation ArrowUp/Down |
| UT-14 | PromptInput | History preserves pills (innerHTML) |
| UT-15 | PromptInput | Image paste creates attachment |
| UT-16 | PromptInput | Plain text paste strips HTML |
| UT-17 | PromptInput | Pill deletion via Backspace |
| UT-18 | PromptInput | IME composition does not trigger submit |
| UT-19 | parseFromDOM | Parses text + pills + line breaks correctly |
| UT-20 | buildRequestParts | Converts Prompt to MessagePart[] correctly |
| UT-21 | MessageTimeline | Auto-scroll when at bottom |
| UT-22 | MessageTimeline | Auto-scroll pauses on user scroll-up |
| UT-23 | MessageTimeline | Scroll-to-bottom button appears when scrolled away |
| UT-24 | MessageTimeline | Turn grouping creates correct groups |
| UT-25 | MessageTimeline | Streaming throttle at 100ms |
| UT-26 | MessageBubble | Markdown renders correctly |
| UT-27 | MessageBubble | Code blocks have syntax highlighting |
| UT-28 | MessageBubble | Tool cards are collapsible |
| UT-29 | MessageBubble | Diff viewer renders add/remove lines |
| UT-30 | MessageBubble | XSS content is sanitized |
| UT-31 | QuestionDock | Displays question with options |
| UT-32 | QuestionDock | Answer submission sends to server |
| UT-33 | useLatchedBool | Holds true for minimum duration |
| UT-34 | ChatWidget | Send message flow (submit → clear → scroll) |
| UT-35 | ChatWidget | Stop button resets all streaming state |
| UT-36 | ChatWidget | Message queue during streaming |

### 8.2 Required E2E Tests

| ID | Scenario |
|----|----------|
| E2E-01 | Send a text message and receive a streaming response |
| E2E-02 | @mention an agent and verify pill in sent message |
| E2E-03 | Navigate prompt history with ArrowUp/Down |
| E2E-04 | Scroll up during streaming, verify auto-scroll pauses |
| E2E-05 | Stop streaming and verify UI fully resets |
| E2E-06 | Session switch preserves separate message histories |

---

## 9. Known Issues (from Manual Testing)

These are documented bugs from `docs/test-input-prompt.md` that this SRS defines the correct behavior for:

| Bug | Violated Requirement | Expected Fix |
|-----|---------------------|-------------|
| T05: Permission prompts not appearing | REQ-PC-001 | Inline permission cards must render when server requests permission |
| T09: Status text flickers to "Ready" | REQ-SD-005, REQ-SD-006 | Status text must be throttled; latched bool must prevent flicker |
| T12: Only 3 slash commands shown | REQ-SC-002 | Must include server-side and MCP commands |
| T15: Missing file/agent listing | REQ-AT-009, REQ-AT-010 | Must fetch complete agent list from server; must search workspace files |
| T17: Pill at position 0 hard to delete | REQ-AT-008 | Backspace must work on pills at any position |
| T18: History loses pills | REQ-PH-005 | History must store and restore innerHTML |
| T21: Shell mode doesn't execute shell | REQ-SH-004 | Shell commands must execute directly, not go to AI model |
| T28: Session spinner flashes briefly | REQ-SS-001 | Spinner must be sustained animation during entire streaming |
| T29: No idle indicator | REQ-SS-002 | Must show idle state after streaming completes |
| T31: Stop button flow broken | REQ-SC-002, REQ-SC-003 | Stop must fully reset all streaming state |

---

## 10. Traceability Matrix

| Requirement | Implementation File | Test File |
|-------------|-------------------|-----------|
| REQ-PI-001..006 | `prompt-input/prompt-input.tsx` | `prompt-input-logic.spec.ts` (partial) |
| REQ-KB-001..006 | `prompt-input/prompt-input.tsx` | `prompt-input-logic.spec.ts` (partial) |
| REQ-AT-001..010 | `prompt-input/prompt-input.tsx` | NONE — **gap** |
| REQ-SC-001..006 | `prompt-input/prompt-input.tsx` | NONE — **gap** |
| REQ-SH-001..004 | `prompt-input/prompt-input.tsx` | NONE — **gap** |
| REQ-PD-001..006 | `prompt-input/prompt-input.tsx` | NONE — **gap** |
| REQ-PH-001..006 | `prompt-input/prompt-input.tsx` | NONE — **gap** |
| REQ-MS-001..005 | `chat-widget.tsx` | `chat-widget.spec.ts` (partial) |
| REQ-TL-001..005 | `message-timeline.tsx` | `message-timeline.spec.ts` (partial) |
| REQ-SD-001..007 | `message-timeline.tsx`, `chat-widget.tsx` | NONE — **gap** |
| REQ-AS-001..006 | `message-timeline.tsx` | `message-timeline.spec.ts` (partial) |
| REQ-MR-001..008 | `markdown-renderer.tsx` | `markdown-renderer.spec.ts`, `markdown-renderer-xss.spec.ts` |
| REQ-TC-001..005 | `message-bubble.tsx` | NONE — **gap** |
| REQ-DV-001..004 | `message-bubble.tsx`, `diff-utils.ts` | `diff-utils.spec.ts` |
| REQ-PC-001..004 | `message-bubble.tsx` | NONE — **gap** |
| REQ-TD-001 | `message-bubble.tsx` | NONE — **gap** |
| REQ-RB-001..003 | `message-bubble.tsx` | NONE — **gap** |
| REQ-QD-001..004 | `question-dock.tsx` | NONE — **gap** |
| REQ-SS-001..003 | `chat-widget.tsx` | NONE — **gap** |
| REQ-MO-001..002 | `model-selector.tsx` | `model-selector.spec.ts` |

---

**End of SRS**
