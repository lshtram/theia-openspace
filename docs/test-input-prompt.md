# Manual Test Plan — OpenCode Parity

Test URL: http://localhost:3000  
Branch: `feat/opencode-parity`

Mark each test as **PASS**, **FAIL**, or **PARTIAL** with notes.

---

## Phase 1 — Streaming & Tool Cards

### T01 — Smooth per-token streaming
Send a message that prompts a long response (e.g. "explain how HTTP works in detail").  
**Expect:** Text appears token-by-token smoothly, not in large chunks.  
**Result:**

### T02 — Tool cards are separate collapsible cards
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Send a message that triggers file reads or tool use (e.g. "read the package.json file").  
**Expect:** Each tool call appears as its own collapsible card (not grouped under "N steps completed"). Intermediate tool steps are grouped in a collapsible TurnGroup with a "Show steps" toggle.  
**Result:**

### T03 — Tool card collapse/expand
Click the chevron on a tool card.  
**Expect:** Card body toggles open/closed. Chevron rotates.  
**Result:**

### T04 — Tool card icons and labels
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Observe tool cards after a multi-tool response.  
**Expect:** Each card shows a relevant icon (e.g. folder icon for file reads, terminal icon for bash) and a descriptive label (e.g. filename for reads, command preview for bash). File paths in tool cards are clickable links that open the file in the editor.  
**Result:**

---

## Phase 2 — Questions, Subtasks, Permissions

### T05 — Permission prompt (inline)
Trigger an action that requires permission (e.g. ask the agent to run a bash command or write a file).  
**Expect:** An inline permission card appears below the relevant tool card with three buttons: **Deny**, **Allow Once**, **Allow Always**.  
**Result:**

### T06 — Permission deny
Click **Deny** on the permission prompt.  
**Expect:** The action is blocked; the permission card disappears; the agent receives a rejection.  
**Result:**

### T07 — Permission allow once
Click **Allow Once** on the permission prompt.  
**Expect:** The action proceeds; permission is not remembered for the next run.  
**Result:**

### T08 — Permission allow always
Click **Allow Always** on the permission prompt.  
**Expect:** The action proceeds and subsequent similar requests are auto-approved.  
**Result:**

---

## Phase 3 — Diff Viewer & Status Line

Agent is here

### T09 — Dynamic status line during streaming
While the agent is responding, observe the status text below the chat (above the prompt).  
**Expect:** Status changes contextually: "Thinking…", "Reading files", "Running commands", "Making edits", etc. depending on what the agent is doing.  
**Result:**

### T10 — Diff viewer for file edits
Ask the agent to edit a file (e.g. "add a comment to the top of package.json").  
**Expect:** The tool card body shows a side-by-side or unified diff with red (removed) and green (added) lines, a filename header, and a +N / -N badge.  
**Result:**

### T11 — Diff viewer for new file writes
Ask the agent to create a new file.  
**Expect:** The tool card body shows all lines as additions (green), no red lines.  
**Result:**

---

## Phase 4 — Prompt Input Features

### T12 — Slash commands popup
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Type `/` in the prompt input.  
**Expect:** A popup appears listing available slash commands (e.g. `/clear`, `/model`, `/help`).  
**Result:**

### T13 — Slash commands fuzzy search
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Type `/cl` in the prompt input.  
**Expect:** The list filters to commands matching "cl" (e.g. `/clear`).  
**Result:**

### T14 — Slash commands keyboard navigation
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Type `/` then use arrow keys Up/Down and press Enter.  
**Expect:** Arrow keys move the selection; Enter executes the selected command.  
**Result:**

### T15 — @ mentions popup
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Type `@` in the prompt input.  
**Expect:** A popup appears with agents and/or file suggestions.  
**Result:**

### T16 — @ mentions fuzzy search
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Type `@pack` in the prompt input.  
**Expect:** The list filters to entries matching "pack" (e.g. package.json).  
**Result:**

### T17 — @ mentions pill rendering
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Select an @ mention from the popup.  
**Expect:** The mention appears as a styled pill/chip in the input (not raw text).  
**Result:**

### T18 — Prompt history — navigate back
Send 2-3 messages. Then press **Up arrow** in an empty prompt.  
**Expect:** The previous message is restored in the input. Press Up again to go further back.  
**Result:**

### T19 — Prompt history — navigate forward
After navigating back, press **Down arrow**.  
**Expect:** Moves forward through history. Reaching the end restores an empty input (or the draft you were typing).  
**Result:**

### T20 — Shell mode activation
Type `!` as the first character in the prompt input.  
**Expect:** The input changes to a monospace/shell style with a visual indicator that shell mode is active.  
**Result:**

### T21 — Shell mode exit
While in shell mode, press **Escape**.  
**Expect:** Shell mode deactivates; input returns to normal style and clears the `!` prefix.  
**Result:**

### T22 — Paste plain text
Copy some rich text (e.g. from a web page) and paste it into the prompt with Cmd+V.  
**Expect:** Only plain text is pasted (no HTML formatting, no images).  
**Result:**

### T22b — Clear prompt with Ctrl+U
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Type some text into the prompt input. Then press **Ctrl+U**.  
**Expect:** The prompt input is cleared entirely.  
**Result:**

---

## Phase 5 — Polish

### T23 — TodoWrite tool rendering
Ask the agent to create a todo list or plan (e.g. "plan the steps to build a REST API").  
**Expect:** A TodoWrite tool card appears with a checklist UI showing each item, its status (pending/in_progress/completed) with strikethrough on completed items.  
**Result:**

### T24 — Retry banner (if applicable)
Trigger or observe a rate-limit or network error during a session.  
**Expect:** A retry banner appears below the last message showing the error and a countdown ("Retrying in Xs (#N)").  
**Result:**

### T25 — Scroll-to-bottom button
Scroll up in a long chat session so you are no longer at the bottom. Then send a message or let streaming continue.  
**Expect:** A floating "scroll to bottom" button appears. Clicking it scrolls back to the bottom and the button disappears.  
**Result:**

### T26 — Syntax highlighting in code blocks
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Ask the agent to show code (e.g. "write a hello world in Python").  
**Expect:** The code block in the response has syntax highlighting (keywords, strings, etc. in different colors). Highlighting adapts correctly to both light and dark theme.  
**Result:**

### T27 — Syntax highlighting — multiple languages
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
Ask for code in TypeScript, JSON, Bash, and SQL.  
**Expect:** All four blocks are highlighted correctly with appropriate language colors.  
**Result:**

### T28 — Session status indicator — streaming
*(Fixed in Bug Fixes Round 1 — re-test needed)*  
While the agent is actively streaming a response, look at the session dropdown/selector in the header.  
**Expect:** The active session shows an animated spinner (pulsing or rotating).  
**Result:**

### T29 — Session status indicator — idle
After the agent finishes responding, look at the session selector.  
**Expect:** The spinner is gone; a dim dash or idle indicator is shown.  
**Result:**

---

## Phase 6 — Bug Fixes Round 1 (new tests)

### T30 — Question rendering (QuestionDock)
*(Added for Bug Fixes Round 1)*  
Ask the agent something that will cause it to ask you a question back
(e.g. "Before you do anything, ask me what programming language to use").

**Expect:** A QuestionDock appears above the prompt input showing the
question text and answer options as buttons. Selecting an option
sends the reply and the dock disappears.

**Result:**

### T31 — Stop button fully resets streaming state
*(Added for Bug Fixes Round 1)*  
Start a long streaming response, then click the **Stop** button mid-stream.

**Expect:** Streaming halts immediately. The stop button disappears and is
replaced by the send button. Any streaming animation and elapsed-time timer
stop. The UI is fully interactive again (no stuck spinner or timer).

**Result:**

---

## Bugs Found

| # | Test | Description | Severity |
|---|------|-------------|----------|
|   |      |             |          |

