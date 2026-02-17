---
id: REQ-AGENT-IDE-CONTROL
author: oracle_c4e8
status: APPROVED
date: 2026-02-17
updated: 2026-02-17
task_id: Phase-3-Agent-IDE-Control
---

# Requirements: Phase 3 — Agent IDE Control

> **Purpose:** Complete requirements specification for Phase 3 (Agent IDE Control) of Theia Openspace.  
> **Status:** APPROVED — All BLOCKING and RECOMMENDED gaps integrated into requirements. OPTIONAL gaps deferred as technical debt.  
> **References:** TECHSPEC-THEIA-OPENSPACE.md §6, WORKPLAN.md Phase 3, REQ-OPENSPACE.md [FEAT-AGENT-001 through FEAT-AGENT-010]

---

## Executive Summary

### What Is Phase 3?

Phase 3 gives the agent **equal control** of the IDE alongside the user. The agent can:

- Open files, scroll to lines, highlight code regions
- Create and manage panes (split, resize, focus)
- Create terminals, send commands, read output
- Read and write files within the workspace
- All through `%%OS{...}%%` blocks embedded in response streams

The agent goes through the **same CommandRegistry** as the user — there are no special "agent tools" or MCP indirection layers.

### Architecture (B1 — RPC Path)

```
Agent emits %%OS{...}%% in response stream
    |
    v
OpenCodeProxy (stream interceptor)
    |
    +---> Clean text --> Chat Widget (user sees clean text)
    |
    +---> onAgentCommand() RPC callback --> SyncService
                                               |
                                               v
                                         CommandRegistry
                                               |
                                               v
                                     IDE Action (editor, terminal, pane...)
```

### Scope

| Category | Count | Commands |
|----------|-------|----------|
| **Infrastructure** | 2 tasks | PaneService, stream interceptor hardening |
| **Commands** | 4 tasks | Pane (5), Editor (6), Terminal (5), File (4) = **20 commands** |
| **Discovery** | 3 tasks | Manifest auto-generation, system prompt, pane state publishing |
| **Validation** | 1 task | End-to-end agent control test |
| **Feedback Loop** | 1 task | Command result feedback mechanism |

**Total: 11 tasks, 20 commands**

### Success Criteria

1. All 20 Phase 3 commands executable from command palette
2. Stream interceptor passes all 8+ test cases (including chunk boundary splitting)
3. `GET /openspace/instructions` includes full command inventory with argument schemas
4. Adding a new command auto-updates system prompt
5. Pane state reflected in instructions
6. Command failures fed back to agent in next system prompt
7. E2E test: agent controls IDE via `%%OS{...}%%` pattern
8. Build passes, 80%+ test coverage, E2E tests pass

---

## 1. User Stories

### US-3.1: Agent Opens File at Line
**As a** user  
**I want** the agent to open a file and scroll to a specific line  
**So that** I can immediately see the code the agent is referencing  

**Acceptance Criteria:**
- AC-3.1.1: Agent emits `%%OS{"cmd":"openspace.editor.open","args":{"path":"src/index.ts","line":42}}%%`
- AC-3.1.2: User sees clean text in chat (no `%%OS{...}%%` visible)
- AC-3.1.3: Monaco editor opens `src/index.ts` and scrolls to line 42
- AC-3.1.4: If file doesn't exist, command fails gracefully and agent is informed

### US-3.2: Agent Highlights Code Region
**As a** user  
**I want** the agent to highlight code regions it's discussing  
**So that** I can visually identify the relevant code without searching  

**Acceptance Criteria:**
- AC-3.2.1: Agent emits `%%OS{"cmd":"openspace.editor.highlight","args":{"path":"src/index.ts","ranges":[{"startLine":42,"endLine":50}],"highlightId":"fix-1"}}%%`
- AC-3.2.2: Lines 42-50 in `src/index.ts` are highlighted with a distinct background color
- AC-3.2.3: Highlight persists until explicitly cleared or user presses Escape
- AC-3.2.4: Multiple highlights can coexist with different IDs

### US-3.3: Agent Creates Terminal and Runs Command
**As a** user  
**I want** the agent to create a terminal and execute commands  
**So that** the agent can run tests, build tools, or diagnostic commands  

**Acceptance Criteria:**
- AC-3.3.1: Agent emits `%%OS{"cmd":"openspace.terminal.create","args":{"title":"test-runner"}}%%`
- AC-3.3.2: New terminal widget appears in bottom panel with title "test-runner"
- AC-3.3.3: Agent emits `%%OS{"cmd":"openspace.terminal.send","args":{"terminalId":"test-runner","text":"npm test\n"}}%%`
- AC-3.3.4: Terminal executes `npm test`
- AC-3.3.5: Agent can read output via `openspace.terminal.read_output`

### US-3.4: Agent Creates Presentation and Opens It
**As a** user  
**I want** the agent to create a presentation and navigate slides  
**So that** the agent can explain concepts visually  

**Note:** This US is **Phase 4** scope, but included here for completeness.

**Acceptance Criteria:**
- AC-3.4.1: Agent emits `%%OS{"cmd":"openspace.presentation.create","args":{"deckPath":"arch.deck.md","title":"Architecture Overview"}}%%`
- AC-3.4.2: File `arch.deck.md` is created with template structure
- AC-3.4.3: Agent emits `%%OS{"cmd":"openspace.presentation.open","args":{"deckPath":"arch.deck.md"}}%%`
- AC-3.4.4: Presentation widget opens showing slide 1

### US-3.5: Agent Manages Pane Layout
**As a** user  
**I want** the agent to arrange panes for optimal context  
**So that** I can view multiple files/terminals/whiteboards simultaneously  

**Acceptance Criteria:**
- AC-3.5.1: Agent emits `%%OS{"cmd":"openspace.pane.open","args":{"type":"editor","contentId":"src/auth.ts","splitDirection":"vertical"}}%%`
- AC-3.5.2: New pane opens to the right with `src/auth.ts`
- AC-3.5.3: Agent emits `%%OS{"cmd":"openspace.pane.list","args":{}}%%`
- AC-3.5.4: Command returns current layout including pane IDs and geometry

### US-3.6: Agent Self-Corrects on Command Failure
**As a** user  
**I want** the agent to learn from failed commands  
**So that** it doesn't repeat the same mistakes in subsequent responses  

**Acceptance Criteria:**
- AC-3.6.1: Agent emits `%%OS{"cmd":"openspace.editor.open","args":{"path":"missing.ts"}}%%`
- AC-3.6.2: Command fails (file not found)
- AC-3.6.3: Next `GET /openspace/instructions` includes failure message: "Recent: openspace.editor.open → FAILED: file not found"
- AC-3.6.4: Agent can reference this failure in its next response

---

## 2. Functional Requirements

### FR-3.1: PaneService Implementation

**ID:** FEAT-AGENT-001  
**Priority:** P0  
**Phase:** 3.1  
**Owner:** Builder

**Description:**  
Implement `openspace-core/src/browser/pane-service.ts` — a service that wraps Theia's `ApplicationShell` for programmatic pane control.

**Requirements:**

1. **FR-3.1.1:** `openContent(args: PaneOpenArgs): Promise<void>` — Opens content in a pane (editor, terminal, presentation, whiteboard). Maps to `ApplicationShell.addWidget()` with correct `WidgetOptions`.

2. **FR-3.1.2:** `closeContent(args: PaneCloseArgs): Promise<void>` — Closes a pane by ID. Confirms closure or throws if pane doesn't exist.

3. **FR-3.1.3:** `focusContent(args: PaneFocusArgs): Promise<void>` — Focuses a pane by ID, bringing it to the front and setting keyboard focus.

4. **FR-3.1.4:** `listPanes(): Promise<PaneInfo[]>` — Traverses the DockPanel layout tree and returns a list of panes with geometry (percentages), tab info, and active tab.

5. **FR-3.1.5:** `resizePane(args: PaneResizeArgs): Promise<void>` — Resizes a pane to specified dimensions (percentage-based).

6. **FR-3.1.6:** `onPaneLayoutChanged: Event<PaneStateSnapshot>` — Emits whenever layout changes (pane opened, closed, resized, focused).

**Acceptance Criteria:**
- AC-3.1.1: Unit tests confirm all pane operations
- AC-3.1.2: `listPanes()` returns accurate layout including geometry (percentages)
- AC-3.1.3: Layout change events fire correctly
- AC-3.1.4: Service is injectable via Theia DI

**Dependencies:** Phase 1 complete

---

### FR-3.2: Pane Commands Registration

**ID:** FEAT-AGENT-002  
**Priority:** P0  
**Phase:** 3.2  
**Owner:** Builder

**Description:**  
Create `openspace-core/src/browser/pane-command-contribution.ts` and register 5 pane commands in Theia's `CommandRegistry`.

**Requirements:**

| Command ID | Arguments | Returns | Maps to |
|---|---|---|---|
| `openspace.pane.open` | `{ type: "editor"\|"terminal"\|"presentation"\|"whiteboard", contentId: string, splitDirection?: "horizontal"\|"vertical" }` | `{ success: boolean, paneId?: string }` | `PaneService.openContent()` |
| `openspace.pane.close` | `{ paneId: string }` | `{ success: boolean }` | `PaneService.closeContent()` |
| `openspace.pane.focus` | `{ paneId: string }` | `{ success: boolean }` | `PaneService.focusContent()` |
| `openspace.pane.list` | `{}` | `{ panes: PaneInfo[] }` | `PaneService.listPanes()` |
| `openspace.pane.resize` | `{ paneId: string, width?: number, height?: number }` | `{ success: boolean }` | `PaneService.resizePane()` |

**Acceptance Criteria:**
- AC-3.2.1: Commands executable from Theia command palette
- AC-3.2.2: `openspace.pane.list` returns correct layout
- AC-3.2.3: All commands include argument schemas for manifest auto-generation
- AC-3.2.4: Commands registered in DI module as `CommandContribution`

**Dependencies:** FR-3.1

---

### FR-3.3: Editor Commands Registration

**ID:** FEAT-AGENT-003  
**Priority:** P0  
**Phase:** 3.3  
**Owner:** Builder

**Description:**  
Create `openspace-core/src/browser/editor-command-contribution.ts` and register 6 editor commands with highlight support.

**Requirements:**

| Command ID | Arguments | Returns | Maps to |
|---|---|---|---|
| `openspace.editor.open` | `{ path: string, line?: number, column?: number, highlight?: boolean }` | `{ success: boolean, editorId?: string }` | `EditorManager.open()` with `selection` option |
| `openspace.editor.scroll_to` | `{ path: string, line: number }` | `{ success: boolean }` | `MonacoEditor.revealLineInCenter()` |
| `openspace.editor.highlight` | `{ path: string, ranges: Range[], highlightId?: string, color?: string }` | `{ success: boolean, highlightId: string }` | `MonacoEditor.deltaDecorations()` |
| `openspace.editor.clear_highlight` | `{ highlightId: string }` | `{ success: boolean }` | `MonacoEditor.deltaDecorations([...], [])` |
| `openspace.editor.read_file` | `{ path: string }` | `{ success: boolean, content?: string }` | `FileService.read()` |
| `openspace.editor.close` | `{ path: string }` | `{ success: boolean }` | `Widget.close()` via `EditorManager` |

**Where:**
```typescript
interface Range {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}
```

**Acceptance Criteria:**
- AC-3.3.1: Agent can open file at line 42
- AC-3.3.2: Agent can highlight lines 42-50 with green background
- AC-3.3.3: Agent can clear highlights by ID
- AC-3.3.4: Highlight IDs tracked for cleanup
- AC-3.3.5: Navigation history stack for undo (optional, Phase 3.5+)

**Dependencies:** Phase 1 complete

---

### FR-3.4: Terminal Commands Registration

**ID:** FEAT-AGENT-004  
**Priority:** P0  
**Phase:** 3.4  
**Owner:** Builder

**Description:**  
Create terminal command contribution and register 5 terminal commands with output ring buffer.

**Requirements:**

| Command ID | Arguments | Returns | Maps to |
|---|---|---|---|
| `openspace.terminal.create` | `{ title?: string, cwd?: string, shellPath?: string }` | `{ success: boolean, terminalId: string }` | `TerminalService.newTerminal()` |
| `openspace.terminal.send` | `{ terminalId: string, text: string }` | `{ success: boolean }` | `Terminal.sendText()` |
| `openspace.terminal.read_output` | `{ terminalId: string, lines?: number }` | `{ success: boolean, output: string[] }` | Ring buffer (hook into xterm.js `onData`) |
| `openspace.terminal.list` | `{}` | `{ terminals: TerminalInfo[] }` | `TerminalService.all` |
| `openspace.terminal.close` | `{ terminalId: string }` | `{ success: boolean }` | `Terminal.dispose()` |

**Ring Buffer Implementation:**
- Hook into xterm.js `onData` event
- Maintain a circular buffer of last 10,000 lines per terminal
- `read_output` returns the last N lines (default: 100)

**Acceptance Criteria:**
- AC-3.4.1: Can create a terminal
- AC-3.4.2: Can send `echo hello` and read back "hello" from output buffer
- AC-3.4.3: Ring buffer prevents memory exhaustion
- AC-3.4.4: Terminal IDs are stable and referenceable

**Dependencies:** Phase 1 complete

---

### FR-3.5: File Commands Registration

**ID:** FEAT-AGENT-005  
**Priority:** P0  
**Phase:** 3.5  
**Owner:** Builder

**Description:**  
Register 4 file commands wrapping Theia's `FileService` and `WorkspaceService`. Enforce workspace-root constraint for safety.

**Requirements:**

| Command ID | Arguments | Returns | Maps to |
|---|---|---|---|
| `openspace.file.read` | `{ path: string }` | `{ success: boolean, content?: string }` | `FileService.read()` |
| `openspace.file.write` | `{ path: string, content: string }` | `{ success: boolean }` | `FileService.write()` |
| `openspace.file.list` | `{ path: string }` | `{ success: boolean, files: FileInfo[] }` | `FileService.resolve()` |
| `openspace.file.search` | `{ query: string, includePattern?: string, excludePattern?: string }` | `{ success: boolean, results: string[] }` | `FileSearchService.find()` |

**Security Constraints:**
1. **SC-3.5.1:** All file paths MUST be validated against workspace root. Reject paths containing `..` or absolute paths outside workspace.
2. **SC-3.5.2:** `openspace.file.write` MUST reject attempts to overwrite critical files (`.git/`, `node_modules/`, etc.).
3. **SC-3.5.3:** `openspace.file.search` respects workspace `.gitignore` by default.

**Acceptance Criteria:**
- AC-3.5.1: Commands work for files within workspace
- AC-3.5.2: Cannot read/write outside workspace root (throws error)
- AC-3.5.3: File search returns relevant results
- AC-3.5.4: Write operations are atomic (no partial writes)

**Dependencies:** Phase 1 complete

---

### FR-3.6: Stream Interceptor Hardening

**ID:** FEAT-AGENT-006  
**Priority:** P0 (CRITICAL)  
**Phase:** 3.6  
**Owner:** Builder

**Description:**  
**Note (Architecture B1):** The stream interceptor is integrated directly into `OpenCodeProxy` (no separate file). This task covers **full test coverage and production hardening** of the interceptor.

**Requirements:**

1. **FR-3.6.1:** Implement stateful parser with state machine: `PASSTHROUGH`, `MAYBE_DELIM`, `IN_DELIM`, `IN_BLOCK`, `MAYBE_CLOSE`.

2. **FR-3.6.2:** Handle chunk boundary splitting — a `%%OS{...}%%` block split across multiple SSE chunks MUST be correctly reassembled.

3. **FR-3.6.3:** JSON validation — malformed JSON blocks are discarded with warning log (not shown to user).

4. **FR-3.6.4:** Nested braces — track brace depth to handle JSON strings containing `}` characters.

5. **FR-3.6.5:** Timeout guard — if `%%OS{` is detected but no closing `}%%` within 5 seconds, discard buffer and log warning.

6. **FR-3.6.6:** Error recovery — one bad block does not corrupt subsequent blocks or visible text.

7. **FR-3.6.7:** Zero overhead — responses with no `%%OS{...}%%` blocks pass through unchanged with minimal performance impact.

8. **FR-3.6.8:** Logging — all interceptor activity logged at DEBUG level with clear messages.

**Test Matrix (Minimum 8 Cases):**

| Test Case | Input | Expected Output |
|---|---|---|
| Clean single block | `text %%OS{"cmd":"x","args":{}}%% more text` | User sees `text  more text`, command dispatched |
| Block split across 2 chunks | Chunk 1: `text %%OS{"cmd":"x","a` / Chunk 2: `rgs":{}}%% more` | Same as above |
| Block split at delimiter | Chunk 1: `text %` / Chunk 2: `%OS{"cmd":"x","args":{}}%% more` | Same as above |
| Malformed JSON | `%%OS{not json}%%` | Discarded, warning logged, text continues |
| Unclosed block | `%%OS{"cmd":"x"` (no close for 5s) | Timeout, buffer discarded, passthrough resumes |
| Nested braces in JSON | `%%OS{"cmd":"x","args":{"data":"{}"}}%%` | Correctly parsed despite `}` in string |
| Multiple blocks | `a %%OS{...}%% b %%OS{...}%% c` | Both commands dispatched, user sees `a  b  c` |
| No blocks | `plain response text` | Passed through unchanged, zero overhead |
| False positive `%%` | `100%% increase` | Passed through unchanged (no `OS{` after `%%`) |

**Acceptance Criteria:**
- AC-3.6.1: All 8+ test cases pass
- AC-3.6.2: Edge-case tests pass (back-to-back blocks, Unicode in args)
- AC-3.6.3: No regressions in message forwarding
- AC-3.6.4: Performance: <5ms overhead per message on average
- AC-3.6.5: Interceptor hardened for production use

**Dependencies:** Phase 1B1 task 1B1.3 (interceptor skeleton implemented)

---

### FR-3.7: Command Manifest Auto-Generation

**ID:** FEAT-AGENT-007  
**Priority:** P0  
**Phase:** 3.7  
**Owner:** Builder

**Description:**  
Upgrade `BridgeContribution` to build a rich manifest from all registered `openspace.*` commands and publish to Hub.

**Requirements:**

1. **FR-3.7.1:** On `FrontendApplication.onStart()`, enumerate all commands in `CommandRegistry` where `id.startsWith('openspace.')`.

2. **FR-3.7.2:** Extract metadata for each command:
   - `id` (string)
   - `label` (string)
   - `description` (string, from command metadata)
   - `category` (string, optional)
   - `arguments_schema` (JSON Schema, from command metadata)
   - `handler` (string, for debugging)

3. **FR-3.7.3:** Serialize to `CommandManifest` format (see `command-manifest.ts`).

4. **FR-3.7.4:** POST manifest to Hub at `POST /openspace/manifest`.

5. **FR-3.7.5:** Re-publish manifest whenever a new extension loads (handles lazy-loaded extensions).

**Manifest Format:**
```typescript
interface CommandManifest {
  version: string;
  commands: CommandDefinition[];
  lastUpdated: string; // ISO 8601
}

interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  category?: string;
  arguments_schema?: CommandArgumentSchema; // JSON Schema
  handler?: string;
}
```

**Acceptance Criteria:**
- AC-3.7.1: Hub's manifest cache contains all openspace commands with full argument schemas
- AC-3.7.2: Adding a new command and restarting Theia → manifest updates automatically
- AC-3.7.3: Manifest includes all 20 Phase 3 commands after Phase 3 completion
- AC-3.7.4: Manifest includes presentation/whiteboard commands after Phase 4

**Dependencies:** FR-3.2, FR-3.3, FR-3.4, FR-3.5

---

### FR-3.8: System Prompt Generation

**ID:** FEAT-AGENT-008  
**Priority:** P0  
**Phase:** 3.8  
**Owner:** Builder

**Description:**  
Implement system prompt template in Hub's `GET /openspace/instructions` handler. The prompt teaches the LLM how to use IDE commands via `%%OS{...}%%` blocks.

**Requirements:**

1. **FR-3.8.1:** Prompt structure:
   ```
   # System Instructions: Theia OpenSpace IDE Control
   
   You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting
   %%OS{...}%% blocks in your response. These are invisible to the user.
   
   ## Available Commands
   [Generated from manifest — full command list with argument schemas]
   
   ## Current IDE State
   [Generated from pane state — open panes, active tabs, terminals]
   
   ## Examples
   [2-3 concrete examples of %%OS{...}%% usage]
   ```

2. **FR-3.8.2:** Command inventory section dynamically generated from manifest. Include:
   - Command ID
   - Description
   - Argument schema (human-readable)
   - Example usage

3. **FR-3.8.3:** IDE state section dynamically generated from latest pane state snapshot. Include:
   - Main area: list of open editors and active file
   - Right panel: chat status
   - Bottom panel: list of terminals
   - Active pane indicator

4. **FR-3.8.4:** Examples section includes 2-3 concrete use cases:
   - Opening a file at a specific line
   - Creating a terminal and running a command
   - Creating a presentation and navigating slides

5. **FR-3.8.5:** Prompt updates automatically when:
   - Manifest changes (new command registered)
   - Pane state changes (file opened, terminal created)

**Acceptance Criteria:**
- AC-3.8.1: `GET /openspace/instructions` returns well-formatted prompt
- AC-3.8.2: Prompt includes all available commands
- AC-3.8.3: Prompt includes current IDE state
- AC-3.8.4: Prompt updates when manifest or state changes
- AC-3.8.5: Prompt is clear, concise, and actionable (tested with LLM)

**Dependencies:** FR-3.7

---

### FR-3.9: End-to-End Agent Control Test

**ID:** FEAT-AGENT-010  
**Priority:** P0  
**Phase:** 3.9  
**Owner:** Builder

**Description:**  
Full integration test verifying the entire agent control pipeline from `%%OS{...}%%` emission to IDE action.

**Requirements:**

1. **FR-3.9.1:** Test covers:
   - Agent emits `%%OS{...}%%` blocks in response stream
   - Stream interceptor strips blocks from visible text
   - `onAgentCommand` RPC callback fires
   - SyncService dispatches to CommandRegistry
   - IDE action is performed (file opens, terminal creates, etc.)

2. **FR-3.9.2:** Test scenarios:
   - Open file at line 42
   - Highlight lines 42-50
   - Create terminal and send command
   - Read terminal output
   - Create presentation (Phase 4)
   - Navigate presentation slides (Phase 4)

3. **FR-3.9.3:** Verification:
   - User sees clean text (no `%%OS{...}%%` visible in chat)
   - IDE state changes as expected
   - Command results logged to Hub

**Acceptance Criteria:**
- AC-3.9.1: Agent successfully controls IDE via `%%OS{...}%%` pattern
- AC-3.9.2: Clean text shown to user
- AC-3.9.3: Full RPC callback path verified
- AC-3.9.4: All test scenarios pass
- AC-3.9.5: E2E test is automated and runs in CI

**Dependencies:** FR-3.6, FR-3.7, FR-3.8

---

### FR-3.10: Pane State Publishing

**ID:** FEAT-AGENT-009  
**Priority:** P1 (Nice-to-have for Phase 3, required for Phase 4)  
**Phase:** 3.10  
**Owner:** Builder

**Description:**  
BridgeContribution subscribes to `PaneService.onPaneLayoutChanged` and POSTs updated state to Hub.

**Requirements:**

1. **FR-3.10.1:** On pane layout change, build `PaneStateSnapshot`:
   ```typescript
   interface PaneStateSnapshot {
     panes: PaneInfo[];
     activePane?: string;
     timestamp: string;
   }
   ```

2. **FR-3.10.2:** POST snapshot to Hub at `POST /openspace/state`.

3. **FR-3.10.3:** Hub stores latest snapshot and includes it in `GET /openspace/instructions` response.

4. **FR-3.10.4:** Throttle updates — max 1 POST per second to avoid flooding Hub.

**Acceptance Criteria:**
- AC-3.10.1: Open a file → `/openspace/instructions` includes that file in "Current IDE state"
- AC-3.10.2: Close file → it disappears from instructions
- AC-3.10.3: Create terminal → instructions reflect new terminal
- AC-3.10.4: State updates are throttled (no more than 1/sec)

**Dependencies:** FR-3.1, FR-3.7

---

### FR-3.11: Command Result Feedback Mechanism

**ID:** FEAT-AGENT-011 (NEW)  
**Priority:** P0  
**Phase:** 3.11  
**Owner:** Builder

**Description:**  
Implement command result feedback loop so the agent can learn from failed commands.

**Requirements:**

1. **FR-3.11.1:** After `SyncService` dispatches a command via `CommandRegistry.executeCommand()`, capture the result:
   ```typescript
   interface CommandResult {
     success: boolean;
     output?: string;
     error?: string;
     data?: unknown;
     executionTime?: number;
   }
   ```

2. **FR-3.11.2:** POST result to Hub at `POST /openspace/command-results` with:
   ```typescript
   {
     sessionId: string;
     commandId: string;
     result: CommandResult;
     timestamp: string;
   }
   ```

3. **FR-3.11.3:** Hub maintains a per-session ring buffer (last 20 results).

4. **FR-3.11.4:** Include recent command results in `GET /openspace/instructions` response:
   ```
   ## Recent Command Results
   - openspace.editor.open → SUCCESS (42ms)
   - openspace.editor.open → FAILED: file not found (5ms)
   - openspace.terminal.send → SUCCESS (12ms)
   ```

5. **FR-3.11.5:** Only include failures and slow commands (>500ms) in prompt to reduce noise.

**Acceptance Criteria:**
- AC-3.11.1: Failed command → result logged in Hub
- AC-3.11.2: Next `GET /openspace/instructions` includes failure message
- AC-3.11.3: Agent can reference failures in subsequent responses
- AC-3.11.4: Ring buffer prevents unbounded memory growth
- AC-3.11.5: Feedback loop improves agent behavior over multiple turns

**Dependencies:** FR-3.9

---

## 3. Non-Functional Requirements

### NFR-3.1: Security

**NFR-3.1.1:** All agent commands MUST pass 3-tier validation:
1. Structure validation (command object has `cmd` and `args` fields)
2. Namespace validation (only `openspace.*` commands accepted)
3. Argument validation (args match command schema)

**NFR-3.1.2:** File commands MUST enforce workspace-root constraint. Reject:
- Paths containing `..` (directory traversal)
- Absolute paths outside workspace
- Attempts to modify `.git/`, `node_modules/`, system directories

**NFR-3.1.3:** Terminal output MUST be sanitized to prevent:
- ANSI escape injection
- Control character injection

**NFR-3.1.4:** Command queue MUST enforce:
- Max queue depth: 50 commands
- Inter-command delay: 50ms (rate limiting)
- Max depth warning at 50

### NFR-3.2: Performance

**NFR-3.2.1:** Stream interceptor overhead: <5ms per message on average

**NFR-3.2.2:** Command execution: <100ms for simple commands (open file, highlight), <500ms for complex commands (list panes, search files)

**NFR-3.2.3:** Manifest generation: <200ms on startup

**NFR-3.2.4:** System prompt generation: <50ms per request

### NFR-3.3: Reliability

**NFR-3.3.1:** Stream interceptor MUST handle chunk boundary splitting with 100% reliability (all test cases pass)

**NFR-3.3.2:** Command dispatch MUST be sequential and FIFO (no race conditions)

**NFR-3.3.3:** Failed commands MUST NOT crash the system (graceful degradation)

**NFR-3.3.4:** Malformed `%%OS{...}%%` blocks MUST NOT corrupt visible text

### NFR-3.4: Maintainability

**NFR-3.4.1:** Code coverage: 80%+ for all Phase 3 code

**NFR-3.4.2:** All public methods MUST have JSDoc comments

**NFR-3.4.3:** All commands MUST include argument schemas for auto-documentation

**NFR-3.4.4:** Logging MUST be comprehensive (DEBUG level) for troubleshooting

### NFR-3.5: Usability

**NFR-3.5.1:** Agent commands MUST be invisible to user (no `%%OS{...}%%` visible in chat)

**NFR-3.5.2:** Command failures MUST be logged but not shown as errors to user (unless catastrophic)

**NFR-3.5.3:** System prompt MUST be clear and actionable for LLM (tested with GPT-4, Claude)

---

## 4. Technical Constraints

### TC-3.1: Architecture

**TC-3.1.1:** MUST follow Architecture B1 (RPC path, not Hub SSE relay)

**TC-3.1.2:** Stream interceptor MUST be integrated into `OpenCodeProxy` (not separate file)

**TC-3.1.3:** All commands MUST go through Theia's `CommandRegistry` (no direct service calls from agent)

### TC-3.2: Dependencies

**TC-3.2.1:** Phase 1 and Phase 1B1 MUST be complete before Phase 3 begins

**TC-3.2.2:** Phase 3 does NOT depend on Phase 2 (parallel development possible)

### TC-3.3: Testing

**TC-3.3.1:** Unit tests MUST cover all command implementations (80%+ coverage)

**TC-3.3.2:** Integration tests MUST cover stream interceptor (all 8+ test cases)

**TC-3.3.3:** E2E tests MUST cover full agent control pipeline

**TC-3.3.4:** All tests MUST run in CI

---

## 5. Risks & Mitigations

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|------------|
| R-3.1 | Chunk boundary splitting not handled correctly | HIGH | MEDIUM | Implement stateful parser with comprehensive test matrix (8+ cases) |
| R-3.2 | Runaway command floods freeze UI | HIGH | LOW | Queue depth limit (50) + inter-command delay (50ms) |
| R-3.3 | File commands escape workspace | CRITICAL | LOW | Workspace-root validation with path traversal detection |
| R-3.4 | Terminal output too large crashes browser | MEDIUM | MEDIUM | Ring buffer (10K lines max) + pagination |
| R-3.5 | LLM emits malformed JSON | LOW | HIGH | Parse error handling + warning logs + discard block |
| R-3.6 | Command execution race conditions | MEDIUM | MEDIUM | Sequential queue (FIFO) + 50ms inter-command delay |
| R-3.7 | Manifest auto-generation misses commands | MEDIUM | LOW | Enumerate all `openspace.*` commands on startup + re-scan on extension load |
| R-3.8 | System prompt too long (>10K tokens) | LOW | LOW | Paginate command list or summarize less-used commands |

---

## 6. Dependencies

### External Dependencies

- Theia 1.68.2 (ApplicationShell, CommandRegistry, EditorManager, TerminalService, FileService)
- OpenCode server (for `%%OS{...}%%` stream)
- Monaco editor (for decorations/highlights)
- xterm.js (for terminal output capture)

### Internal Dependencies

| Phase 3 Task | Depends On |
|--------------|------------|
| 3.2 (pane commands) | 3.1 (PaneService) |
| 3.6 (interceptor hardening) | 1B1.3 (interceptor skeleton) |
| 3.7 (manifest auto-gen) | 3.2, 3.3, 3.4, 3.5 (all commands registered) |
| 3.8 (system prompt) | 3.7 (manifest) |
| 3.9 (E2E test) | 3.6, 3.7, 3.8 |
| 3.10 (pane state) | 3.1, 3.7 |
| 3.11 (result feedback) | 3.9 |

### Parallelizable Tasks

Tasks 3.2, 3.3, 3.4, 3.5 are fully parallelizable (different command groups, no interdependencies).

---

## 7. Acceptance Criteria (Phase 3 Exit Criteria)

Phase 3 is **COMPLETE** when:

1. ✅ All 20 Phase 3 commands executable from command palette: `openspace.pane.*`, `openspace.editor.*`, `openspace.terminal.*`, `openspace.file.*`
2. ✅ Stream interceptor passes all 8+ test cases (including chunk boundary splitting)
3. ✅ Chunk boundary splitting works (blocks split across SSE events correctly reassembled)
4. ✅ `GET /openspace/instructions` includes full command inventory with argument schemas
5. ✅ Adding a new command → manifest regenerates → system prompt updates automatically
6. ✅ Pane state reflected in instructions (open file → instructions show it)
7. ✅ Command failures fed back to agent (failed command appears in next system prompt)
8. ✅ E2E test passes: agent controls IDE via `%%OS{...}%%` pattern
9. ✅ Build passes: `yarn build` exits 0
10. ✅ Unit tests pass: 80%+ coverage, 100% pass rate
11. ✅ E2E tests pass: All agent control scenarios work
12. ✅ CodeReviewer approves with 80%+ confidence
13. ✅ No regressions in Phase 1 functionality

---

## 8. Out of Scope (Phase 4)

The following are **NOT** part of Phase 3:

- Presentation commands (`openspace.presentation.*`) — Phase 4
- Whiteboard commands (`openspace.whiteboard.*`) — Phase 4
- Custom tldraw shapes (UML diagrams) — Phase 4
- reveal.js integration — Phase 4
- tldraw integration — Phase 4

---

## 9. References

- **TECHSPEC:** `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` §6 (Agent Control System)
- **WORKPLAN:** `docs/architecture/WORKPLAN.md` Phase 3 (tasks 3.1–3.11)
- **REQ-OPENSPACE:** `docs/requirements/REQ-OPENSPACE.md` (FEAT-AGENT-001 through FEAT-AGENT-010)
- **Presentation:** `design/deck/phase-3-requirements-review.deck.md`

---

## 10. Multi-Perspective Audit

**Status:** ✅ COMPLETE — Audit performed 2026-02-17 by oracle_c4e8

### Audit Summary

The requirements were reviewed from four stakeholder perspectives:

1. ✅ **User (End-User Experience)** — Usability, discoverability, undo mechanisms
2. ✅ **Security Engineer** — Attack surface, path traversal, command injection, data exfiltration
3. ✅ **SRE (Site Reliability)** — Observability, failure modes, resource leaks, metrics
4. ✅ **Legal/Compliance** — Data privacy, consent, audit trail, terms of service

### Critical Gaps Identified

#### High-Priority Additions (MUST HAVE for Phase 3)

| ID | Gap | Perspective | Recommendation | Status |
|----|-----|-------------|----------------|--------|
| GAP-1 | Symlink path traversal | Security | Add symlink resolution check in file commands | 🔴 BLOCKING |
| GAP-2 | Prompt injection via code blocks | Security | Interceptor ignores `%%OS{...}%%` inside markdown code fences | 🔴 BLOCKING |
| GAP-3 | Silent failures hidden from user | SRE | Add configurable notifications for command failures | 🟡 RECOMMENDED |
| GAP-4 | No resource cleanup on session end | SRE | Close all agent-created terminals/panes when session ends | 🔴 BLOCKING |
| GAP-5 | No user consent for agent control | Legal | Add first-run consent dialog | 🟡 RECOMMENDED |

#### Medium-Priority Additions (SHOULD HAVE for Phase 3 or Phase 3.5)

| ID | Gap | Perspective | Recommendation | Status |
|----|-----|-------------|----------------|--------|
| GAP-6 | Per-message command limit | User | Max 10 commands per agent response | 🟡 RECOMMENDED |
| GAP-7 | Undo mechanism | User | "Undo Last Agent Action" command | 🟢 OPTIONAL (Phase 4) |
| GAP-8 | Dangerous command confirmation | Security | Confirm terminal commands with `rm`, `sudo`, etc. | 🟡 RECOMMENDED |
| GAP-9 | Sensitive file denylist | Security | Block `.env`, `.git/`, `id_rsa`, etc. from `openspace.file.read` | 🟡 RECOMMENDED |
| GAP-10 | Metrics/telemetry | SRE | Prometheus metrics for command execution | 🟢 OPTIONAL (Phase 4) |
| GAP-11 | Comprehensive audit log | Legal | Log all commands to Hub with 90-day retention | 🟢 OPTIONAL (Phase 4) |

#### Low-Priority Additions (NICE TO HAVE for Phase 4+)

| ID | Gap | Perspective | Recommendation | Status |
|----|-----|-------------|----------------|--------|
| GAP-12 | User documentation | User | Document agent capabilities in help system | 🟢 OPTIONAL |
| GAP-13 | Circuit breaker for Hub | SRE | Fall back to cached manifest if Hub unreachable | 🟢 OPTIONAL |
| GAP-14 | Sensitive data scrubber | Legal | Detect and redact secrets in terminal output | 🟢 OPTIONAL |
| GAP-15 | ToS/EULA | Legal | Add Terms of Service for agent control | 🟢 OPTIONAL |

### Updated Requirements Based on Audit

The following requirements are **ADDED** to Phase 3 based on audit findings:

#### NFR-3.6: Security Enhancements (NEW)

**NFR-3.6.1 (GAP-1):** All file commands MUST resolve symlinks and validate that the resolved path is within workspace root. Reject symlinks pointing outside workspace.

**NFR-3.6.2 (GAP-2):** Stream interceptor MUST NOT extract `%%OS{...}%%` blocks that appear inside markdown code fences (` ``` ` delimited blocks). This prevents prompt injection via code examples.

**NFR-3.6.3 (GAP-8):** Terminal commands containing dangerous patterns (`rm -rf`, `sudo`, `chmod 777`, `dd if=`, `:(){ :|:& };:`) MUST trigger a confirmation dialog before execution (configurable via settings).

**NFR-3.6.4 (GAP-9):** `openspace.file.read` MUST enforce a sensitive file denylist:
- `.env`, `.env.*`
- `.git/` (all files)
- `id_rsa`, `id_dsa`, `*.pem`, `*.key`
- `credentials.json`, `secrets.*`
- User-configurable denylist in settings

#### NFR-3.7: Resource Management (NEW)

**NFR-3.7.1 (GAP-4):** On session end or disconnect, automatically close all agent-created resources:
- Terminals created via `openspace.terminal.create`
- Highlights created via `openspace.editor.highlight`
- Panes opened via `openspace.pane.open` (unless pinned by user)

**NFR-3.7.2 (GAP-6):** Enforce per-message command limit: max 10 commands per agent response. If exceeded, log warning and ignore excess commands.

#### NFR-3.8: User Experience (NEW)

**NFR-3.8.1 (GAP-3):** Command failures MAY trigger optional toast notifications (configurable in settings):
- Severity: ERROR → always show toast
- Severity: WARNING → show toast if setting enabled
- Severity: INFO → never show toast (logged only)

**NFR-3.8.2 (GAP-5):** On first use of agent IDE control, show consent dialog:
```
The AI agent can now control your IDE (open files, run terminals, etc.).
Commands are validated and sandboxed to your workspace.

[ ] Don't show this again
[Cancel] [Allow]
```

### Audit Conclusion

**User Decision (2026-02-17):** Integrate **GAP-1 through GAP-9** (all BLOCKING and RECOMMENDED gaps) into Phase 3 requirements NOW. Defer **GAP-7, GAP-10-15** (OPTIONAL) as technical debt to post-Phase 3 work.

**Implementation Strategy:**
- All BLOCKING and RECOMMENDED gaps are now part of Phase 3 functional and non-functional requirements
- OPTIONAL gaps documented in `docs/technical-debt/PHASE-3-OPTIONAL-GAPS.md` for future consideration
- Phase 3 implementation will include security hardening from day one

---

## 11. Approval

**Status:** ✅ APPROVED (2026-02-17)

**Audit Status:**
- [x] User perspective (usability, value) — ✅ COMPLETE
- [x] Security Engineer perspective (attack surface, vulnerabilities) — ✅ COMPLETE
- [x] SRE perspective (reliability, observability, failure modes) — ✅ COMPLETE
- [x] Legal/Compliance perspective (data privacy, terms of service) — ✅ COMPLETE

**Approval History:**
1. ~~Run multi-perspective audit~~ — ✅ COMPLETE (2026-02-17)
2. ~~User review: Accept REQ document and audit findings~~ — ✅ COMPLETE (2026-02-17)
3. ~~User decision: Implement blocking gaps now (GAP-1, GAP-2, GAP-4) or defer?~~ — ✅ DECISION: Integrate all BLOCKING + RECOMMENDED gaps into requirements
4. ~~User approval to proceed to implementation~~ — ✅ APPROVED (2026-02-17)
5. **Next:** Begin Phase 3 implementation in `.worktrees/phase-3-agent-control`

---

**End of Requirements Document**
