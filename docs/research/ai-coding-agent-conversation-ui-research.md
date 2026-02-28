# AI Coding Agent Conversation UI: Cross-Tool Research Report

**Date:** 2026-02-23  
**Context:** theia-openspace — Theia IDE with AI agent chat  
**Objective:** Synthesize conversation UI patterns from 6 leading AI coding tools to inform our implementation  

---

## Tools Studied

| Tool | Platform | UI Framework |
|------|----------|-------------|
| Claude Code | Terminal | React + Ink |
| OpenAI Codex CLI | Terminal | Rust TUI |
| Cursor AI | VS Code fork | Electron/Web |
| Continue.dev | VS Code/JetBrains extension | Webview |
| Aider | Terminal | Python prompt-toolkit |
| Cline/Roo Code | VS Code extension | Webview |

---

## A. Input Prompt Behavior

### Findings by Tool

| Tool | Submit | Newline | Multi-line | Max Height | History Nav |
|------|--------|---------|-----------|------------|-------------|
| **Claude Code** | Enter | `\` + Enter, Shift+Enter (terminal-dependent), Ctrl+J, Option+Enter | Paste auto-detects | N/A (terminal) | Up/Down arrows, Ctrl+R reverse search |
| **Codex CLI** | Enter | Standard terminal input | Full-screen TUI composer | N/A (terminal) | Up/Down for drafts |
| **Cursor** | Enter | Shift+Enter | Standard textarea | Auto-grows | N/A (web chat) |
| **Continue.dev** | Enter | Cmd/Ctrl+L sends code | Selected code injection | Sidebar panel | N/A |
| **Aider** | Enter (configurable) | Meta+Enter, `{`/`}` delimiters | `/multiline-mode` swaps Enter/Meta+Enter, `/editor` opens external editor, Ctrl+X Ctrl+E | N/A (terminal) | Ctrl+Up/Down, Ctrl+P/N, Ctrl+R |
| **Cline/Roo** | Enter | Standard webview textarea | Webview input | Auto-grows | N/A |

### Best Practices

1. **Enter = Submit is universal.** Every tool uses Enter to send. Do not deviate.
2. **Shift+Enter = newline is the web standard** (Cursor, webview tools). Terminal tools can't reliably detect Shift+Enter, so they use alternatives (`\` + Enter, Meta+Enter, Ctrl+J).
3. **External editor escape hatch.** Both Aider (`/editor`, Ctrl+X Ctrl+E) and Codex CLI (Ctrl+G → `$VISUAL`/`$EDITOR`) provide a way to compose longer prompts in a real editor. This is a power-user feature worth having.
4. **Auto-grow input area** up to a max height (e.g., 30-40% of viewport), then scroll internally. Cursor and webview-based tools do this.
5. **History navigation** is expected in terminal UIs (Up/Down arrows). Web UIs generally lack this but could benefit from it.
6. **Paste detection**: Claude Code auto-detects pasted multi-line content. This prevents accidental submission of multi-line pastes.
7. **Behavior during streaming**: Both Claude Code and Codex CLI allow pressing Enter during streaming to inject new instructions. Cursor allows queueing follow-up messages. Input should remain active during streaming.

### Recommendation for Theia

Since we're a web-based IDE (Theia), follow the web standard:
- **Enter** submits
- **Shift+Enter** inserts newline
- Auto-grow textarea up to ~200px, then internal scroll
- Keep input enabled during streaming (queue or inject)
- Consider history navigation via Up arrow when input is empty

---

## B. Message Streaming Display

### Findings by Tool

| Tool | Streaming Method | Markdown Rendering | Flicker Prevention |
|------|-----------------|-------------------|-------------------|
| **Claude Code** | Token-by-token via React/Ink | Rendered after completion (terminal limitations) | Ink's reconciliation |
| **Codex CLI** | Token streaming to terminal | Post-completion rendering | Rust TUI buffering |
| **Cursor** | Real-time streaming | Progressive rendering during stream | Context management + summarization |
| **Continue.dev** | Async iterators, token-by-token | Progressive rendering in sidebar | Promise-based buffering |
| **Aider** | `--stream` default, `--no-stream` available | Post-stream rendering | Streaming can be disabled for cache stats |
| **Cline/Roo** | Task streaming | Progressive rendering in webview | Duplicate text prevention fix (v3.58) |

### Best Practices

1. **Stream tokens as they arrive.** All tools stream by default. Users expect to see partial responses immediately.
2. **Render markdown progressively** but carefully. The challenge is that incomplete markdown (e.g., a backtick without its pair) causes rendering artifacts.
   - **Strategy A**: Render markdown on each chunk but use a "markdown recovery" pass that closes unclosed blocks.
   - **Strategy B**: Render plaintext during streaming, switch to markdown on completion (Claude Code's approach in terminal).
   - **Strategy C**: Buffer a few tokens before rendering to avoid mid-token artifacts (Continue.dev's approach).
3. **Code blocks need special handling.** Detect `` ``` `` opening/closing and render the code block container immediately but stream content into it.
4. **Prevent duplicate text.** Cline had a bug (fixed v3.58) where streamed text appeared twice. Guard against re-rendering already-displayed tokens.
5. **Use `requestAnimationFrame`** or equivalent batching to coalesce rapid DOM updates. Don't update DOM on every single token.

### Recommendation for Theia

- Stream tokens into a buffer, flush to DOM on `requestAnimationFrame`
- Use a markdown renderer that handles incomplete input gracefully (e.g., `marked` with a custom tokenizer that auto-closes open blocks)
- Render code blocks as containers immediately upon detecting `` ``` ``
- Show a blinking cursor or typing indicator at the end of streaming content

---

## C. Auto-Scroll Behavior

### Findings

This is a **universal pain point**. Users across ALL tools report frustration with auto-scroll behavior.

| Tool | Auto-scroll | User scroll detection | Scroll-to-bottom button |
|------|-------------|----------------------|------------------------|
| **Claude Code** | Terminal handles natively | N/A (terminal) | N/A |
| **Cursor** | Yes, during streaming | Known bug: Shift+Enter triggers unwanted auto-scroll | Not documented |
| **Continue.dev** | Yes, follows output | Sidebar scroll behavior | Not documented |
| **Cline/Roo** | Yes, webview | Webview scroll management | Not documented |

### Best Practices (synthesized from all tools + web chat conventions)

1. **Track `isUserScrolledAway` state.** When the user scrolls up from the bottom, set a flag to pause auto-scroll.
2. **"Near bottom" threshold.** Consider the user "at bottom" if `scrollTop + clientHeight >= scrollHeight - 50px`. This prevents tiny sub-pixel differences from breaking auto-scroll.
3. **Resume auto-scroll** only when the user scrolls back to the bottom.
4. **Show a "Scroll to bottom" floating button** when the user is scrolled away during streaming. Badge it with new message count if applicable.
5. **Use `requestAnimationFrame`** for scroll updates during streaming. Don't call `scrollIntoView` on every token.
6. **New message from user always scrolls to bottom** (they just submitted, they want to see the response).
7. **Don't auto-scroll on tool call expansions.** If the user is reading a previous message and a collapsible tool call expands, don't yank them to the bottom.

### Recommendation for Theia

```typescript
// Pseudocode for auto-scroll logic
const SCROLL_THRESHOLD = 50;

function isNearBottom(container: HTMLElement): boolean {
  return container.scrollHeight - container.scrollTop - container.clientHeight < SCROLL_THRESHOLD;
}

// On user scroll: update tracking state
// On new streaming content: only scroll if isNearBottom was true before the update
// On user submit: always scroll to bottom
// Show floating button when scrolled away during active streaming
```

---

## D. Tool Call Display

### Findings by Tool

| Tool | Display Style | File Operations | Diff Display | Grouping |
|------|-------------|----------------|-------------|----------|
| **Claude Code** | Inline with permission dialogs | Shows file paths + diffs | Inline diffs in dialog | Sequential |
| **Codex CLI** | Terminal output with approval | File read/write with sandbox | Terminal diff output | Sequential |
| **Cursor** | Inline in chat | File changes shown in editor | Editor diff view | Per-task |
| **Continue.dev** | Code blocks with action buttons | "Apply to file", "Insert at cursor", "Copy" | Editor diff on apply | Per-response |
| **Aider** | Multiple edit formats (whole, diff, unified) | Auto-applies, `/undo` to revert | `/diff` command, configurable format | Per-edit |
| **Cline/Roo** | Collapsible sections (v3.16+) | Per-step approval GUI | Inline webview diffs | Low-stakes grouped, high-stakes individual |

### Best Practices

1. **Differentiate low-stakes and high-stakes tool calls.**
   - Low-stakes (file read, search, list): Collapse into a summary line (e.g., "Read 3 files" → expandable).
   - High-stakes (file write, command execution): Show prominently with full details.
2. **Cline's grouping innovation (v3.16)** is worth adopting: group consecutive low-stakes tool calls into a single collapsible section to reduce visual clutter.
3. **Show diffs for file changes**, not full file contents. Use a familiar diff format (red/green, +/- lines).
4. **Action buttons on code blocks**: "Apply", "Copy", "Insert at cursor" (Continue.dev pattern).
5. **Progress indicators**: Show which tool is currently executing, especially for long-running operations.
6. **Collapsible by default** for completed tool calls, expanded for in-progress ones.

### Recommendation for Theia

- Use collapsible `<details>`-style components for tool calls
- Group consecutive read/search operations
- File write tool calls show inline diffs with syntax highlighting
- Terminal command tool calls show command + truncated output (expandable)
- Each tool call shows: icon, name, duration, status (pending/running/complete/error)

---

## E. Approval / Permission Flow

### Findings by Tool

| Tool | Model | Granularity | UI |
|------|-------|-------------|------|
| **Claude Code** | 3 modes: Normal, Plan, Auto-Accept (Shift+Tab / Alt+M toggle) | Per-action | Terminal dialog with Yes/No/Edit, left/right arrow for tabs |
| **Codex CLI** | 3 levels: Auto, Read-only, Full Access | Per-session | `--ask-for-approval` flag, `--full-auto` shortcut |
| **Cursor** | YOLO mode with allow/deny lists | Per-action-type | Settings toggle, command filtering |
| **Continue.dev** | Inline approval | Per-suggestion | "Apply" button on code blocks |
| **Aider** | Auto-commit by default, `/undo` to revert | Per-commit | Implicit trust model with easy rollback |
| **Cline/Roo** | Per-step approval, auto-approve toggle | Per-action with granular settings | Webview dialog, Plan & Act mode |

### Best Practices

1. **Three-tier model is the consensus**: Fully manual → Selective auto-approve → Full auto. Both Claude Code and Codex CLI independently arrived at this.
2. **Granular auto-approve by action type** (Cursor's YOLO + Cline's granular settings): let users auto-approve reads but require approval for writes and commands.
3. **Allow/deny lists for commands**: Auto-approve `npm test` and `npm run build` but always ask for `rm`, `git push`, etc.
4. **The approval UI must not block streaming.** Show the approval request inline in the chat flow, not as a modal that blocks the entire UI.
5. **Easy rollback is as important as approval.** Aider's `/undo` and git integration show that trust + rollback can substitute for pre-approval.
6. **Visual status**: Clear indicators for what's waiting for approval (Cline uses colored badges).

### Recommendation for Theia

- Implement three modes: **Ask** (default), **Auto-approve reads**, **Full auto**
- Inline approval widget in chat (not a modal)
- Action-type filtering: separate toggles for file reads, file writes, terminal commands
- Always show what will happen before approval (diff preview for writes, command preview for terminal)
- `/undo` support backed by git

---

## F. Slash Commands and @Mentions

### Findings by Tool

| Tool | Slash Commands | @Mentions | Autocomplete |
|------|---------------|-----------|-------------|
| **Claude Code** | Extensive: `/clear`, `/compact`, `/config`, `/cost`, `/model`, `/permissions`, `/plan`, etc. MCP prompts as `/mcp__<server>__<prompt>` | `@` for fuzzy file search | Tab completion |
| **Codex CLI** | `/review`, `/fork`, `/permissions`, `/mode`, `/approval`, `/status` | `@` for fuzzy file search | Tab/Enter to insert |
| **Cursor** | `/` triggers list, custom commands via `.cursor/commands/*.md` | `@` for context providers (files, docs, code) | Popover list |
| **Continue.dev** | `/` in chat, defined as Markdown files with `invokable: true` frontmatter | `@` context providers | Popover list |
| **Aider** | Most extensive: `/add`, `/drop`, `/ask`, `/code`, `/architect`, `/diff`, `/undo`, `/commit`, `/git`, `/run`, `/test`, `/lint`, `/web`, `/voice`, `/model`, `/editor`, `/paste`, `/clear`, `/tokens`, etc. | File paths via `/add` | prompt-toolkit completion |
| **Cline/Roo** | Workflow invocation via `/[workflow-name.md]`, defined in `.clinerules/workflows/` | N/A | Workflow file completion |

### Best Practices

1. **`/` at the start of input triggers command palette.** Universal pattern.
2. **`@` anywhere in input triggers context mention.** Both Claude Code and Codex CLI use this for file search, Cursor and Continue.dev extend it to docs, code symbols, etc.
3. **Autocomplete popover**: Show filtered list as user types, navigate with Up/Down, select with Tab/Enter.
4. **Custom commands via markdown files** (Cursor's `.cursor/commands/`, Continue.dev's frontmatter pattern, Cline's `.clinerules/workflows/`). This is a strong pattern — user-defined commands as markdown templates.
5. **Fuzzy matching** for file paths (both `@` mentions and `/add` style commands).
6. **Categorize @mentions**: `@file`, `@symbol`, `@docs`, `@web` — different trigger contexts.
7. **Show command descriptions** in the autocomplete list, not just names.

### Recommendation for Theia

- `/` at position 0 → slash command popover with fuzzy filter
- `@` anywhere → context mention popover (files, symbols, docs)
- Support custom commands as `.md` files in project directory
- Popover: Up/Down to navigate, Tab/Enter to select, Esc to dismiss
- Show description + shortcut in popover items

---

## G. Message Queue / Interruption

### Findings by Tool

| Tool | Queue Messages | Cancel/Abort | Inject During Stream | Status UI |
|------|---------------|-------------|---------------------|-----------|
| **Claude Code** | Tab to queue follow-up | Escape (NOT Ctrl+C) | Enter during streaming | Streaming indicator in status bar |
| **Codex CLI** | Tab to queue follow-up | Ctrl+C or `/exit` | Enter during streaming | Terminal streaming display |
| **Cursor** | Enter to queue, Cmd/Ctrl+Enter sends immediately | Cancel button | Queue system with drag-to-reorder | Streaming indicator |
| **Continue.dev** | Not documented | Stop button | Not documented | Streaming indicator in sidebar |
| **Aider** | Not supported | Ctrl+C (always safe, partial response preserved) | Not supported | `--stream` output |
| **Cline/Roo** | Not documented | Cancel button | Not documented | Task progress indicator |

### Best Practices

1. **Cancel must be discoverable and safe.** Aider's "Ctrl+C is always safe" philosophy is ideal. Partial responses should be preserved, not discarded.
2. **Message queuing is a differentiator.** Cursor's queue with drag-to-reorder is the most advanced. Claude Code and Codex CLI's Tab-to-queue is simpler but effective.
3. **Inject vs. Queue distinction matters:**
   - **Inject** (Claude Code/Codex CLI: Enter during streaming): Interrupts current generation with new context.
   - **Queue** (Cursor: Enter during streaming): Waits for current response to complete, then sends.
   - Both are useful. Inject for corrections ("actually, use TypeScript not JavaScript"), queue for follow-ups.
4. **Visual streaming status**: Show clearly whether the agent is thinking, streaming, or waiting for approval. Use a spinner/animation.
5. **Background tasks** (Claude Code's Ctrl+B for bash commands): Allow long-running operations to continue while the user keeps chatting.

### Recommendation for Theia

- **Escape** or Stop button to cancel streaming (preserve partial response)
- **Enter during streaming** queues a follow-up message (displayed in a "queued" state)
- Show streaming status: spinner + "Generating..." text
- Consider "inject" capability for advanced users (Cmd+Enter to interrupt)
- Queued messages shown with visual indicator, reorderable via drag

---

## H. Error Handling

### Findings by Tool

| Tool | API Errors | Retry | Rate Limiting | Timeout |
|------|-----------|-------|--------------|---------|
| **Claude Code** | "API Error: Request timed out. Retrying in X seconds (attempt X/10)" | Auto-retry with backoff, up to 10 attempts | Displayed inline | Configurable timeout |
| **Codex CLI** | Sandbox error handling, graceful degradation | Session resume (`codex resume`) | Not documented | Sandbox modes |
| **Cursor** | Rate limit notification with 3 options | Exponential backoff on 429s | "Switch model / Upgrade / Enable usage-based" options | Timeout handling |
| **Continue.dev** | Error display in sidebar | Not documented | Provider-dependent | Provider-dependent |
| **Aider** | Terminal error output | `--cache-prompts` with keepalive pings | Prompt caching to reduce calls | Configurable |
| **Cline/Roo** | Improved retry UI (v3.16+) | Auto-retry with progress indication | API retry feedback | Memory leak fix for long sessions (v3.16) |

### Best Practices

1. **Auto-retry with exponential backoff** is the minimum. Claude Code's "attempt X/10" pattern gives users visibility.
2. **Show retry countdown.** "Retrying in 3 seconds..." is better than a silent pause.
3. **Actionable error messages.** Cursor's 3-option response to rate limits (switch model, upgrade, enable usage-based pricing) is excellent — give users choices, not just error text.
4. **Preserve context on error.** If a request fails, don't lose the user's message. Keep it in the input or show a retry button on the failed message.
5. **Session recovery.** Codex CLI's `codex resume` and session picker prevent work loss on crashes.
6. **Memory management for long sessions.** Cline's v3.16 memory leak fix highlights that long conversations can cause performance degradation. Implement conversation compaction.
7. **Network status indicator.** Show connection status (connected/reconnecting/disconnected) for SSE/WebSocket connections.

### Recommendation for Theia

- Auto-retry with exponential backoff (max 5 attempts)
- Show retry countdown inline: "Retrying in X seconds (attempt N/5)..."
- Rate limit: offer model switching as alternative
- Failed messages show inline retry button (re-sends the same message)
- Network status indicator in status bar
- Conversation compaction for long sessions (`/compact` equivalent)

---

## Cross-Cutting Patterns

### 1. Three Things Every Tool Has
- **Streaming** (all 6 tools stream by default)
- **Cancel/interrupt** (all 6 provide a way to stop generation)
- **Slash commands** (all 6 have some form of `/command`)

### 2. Emerging Consensus (4+ tools)
- `@` for file/context mentions (Claude Code, Codex CLI, Cursor, Continue.dev)
- Auto-approve modes with granularity (Claude Code, Codex CLI, Cursor, Cline)
- Message queue/follow-up during streaming (Claude Code, Codex CLI, Cursor)
- Custom commands as markdown files (Cursor, Continue.dev, Cline)

### 3. Differentiators (unique to 1-2 tools)
- **Claude Code**: Ghost text suggestions from git history, PR status in footer, Ctrl+B background tasks
- **Codex CLI**: Sandbox modes (read-only, workspace-write), session resume picker
- **Cursor**: Message queue with drag-to-reorder, chat export as markdown/shareable links
- **Continue.dev**: Cross-IDE support (VS Code + JetBrains)
- **Aider**: Vi/Emacs keybinding modes, `/undo` backed by git auto-commits, voice input
- **Cline/Roo**: Modular agent modes (Architect/Code/Debug/Ask), Plan & Act workflow

---

## Priority Matrix for Theia Implementation

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0 — Must have** | Enter submit, Shift+Enter newline | Universal standard |
| **P0** | Token streaming with progressive display | All tools do this |
| **P0** | Cancel/stop generation | User safety |
| **P0** | Basic auto-scroll (pause on scroll-up) | Universal pain point |
| **P0** | Inline tool call display | Core agent UX |
| **P1 — Should have** | Slash commands with autocomplete popover | All tools have this |
| **P1** | `@` file mentions with fuzzy search | 4/6 tools have this |
| **P1** | Three-tier approval (ask/selective/auto) | Consensus pattern |
| **P1** | Auto-retry with backoff + countdown | Standard error handling |
| **P1** | Scroll-to-bottom floating button | Solves universal complaint |
| **P2 — Nice to have** | Message queue during streaming | 3/6 tools, Cursor leads |
| **P2** | Collapsible/grouped tool calls | Cline innovation |
| **P2** | Custom commands as markdown files | Emerging pattern |
| **P2** | Input history (Up arrow) | Terminal UIs have this |
| **P2** | Chat export | Cursor feature |
| **P3 — Future** | Ghost text suggestions | Claude Code unique |
| **P3** | Inject during streaming | Power user feature |
| **P3** | Agent modes (Architect/Code/Debug) | Roo Code pattern |
| **P3** | Voice input | Aider feature |
| **P3** | Background tasks | Claude Code feature |

---

## References

- Claude Code: [docs.anthropic.com/en/docs/claude-code](https://docs.anthropic.com/en/docs/claude-code), React/Ink terminal UI
- OpenAI Codex CLI: [github.com/openai/codex](https://github.com/openai/codex), Rust-based TUI
- Cursor AI: [docs.cursor.com](https://docs.cursor.com), VS Code fork with AI chat
- Continue.dev: [docs.continue.dev](https://docs.continue.dev), open-source AI IDE extension
- Aider: [aider.chat](https://aider.chat), Python terminal-based AI pair programming
- Cline/Roo Code: VS Code extension with human-in-the-loop webview, [github.com/cline/cline](https://github.com/cline/cline)
