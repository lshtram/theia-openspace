---
id: REQ-AGENT-IDE-CONTROL
author: oracle_c4e8
status: APPROVED
date: 2026-02-17
updated: 2026-02-18
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
- All through MCP tool calls (`openspace.*` tools via Hub MCP server)

The agent goes through the **same CommandRegistry** as the user — all MCP tool calls route via `CommandBridge` → `CommandRegistry` → IDE action.

### Architecture (B1 + MCP)

```
Agent (opencode)
    │
    │  MCP tool call: openspace.editor.open({ path: "src/index.ts", line: 42 })
    ▼
Hub MCP Server  (OpenSpaceMcpServer, @modelcontextprotocol/sdk)
    │
    │  routes tool name → handler → CommandBridge
    ▼
Theia CommandRegistry
    │
    │  dispatches to frontend via Theia IPC
    ▼
IDE Action (editor, terminal, pane...)
    │
    ▼
Result returned up call stack → MCP tool response → Agent
```

### Scope

| Category | Count | Commands |
|----------|-------|----------|
| **Infrastructure** | 2 tasks | PaneService, Hub MCP server |
| **Commands** | 4 tasks | Pane (5), Editor (6), Terminal (5), File (4) = **20 commands** |
| **Discovery** | 3 tasks | MCP introspection, system prompt, pane state publishing |
| **Validation** | 1 task | End-to-end agent control test |
| **Feedback Loop** | 1 task | Command result feedback mechanism |

**Total: 11 tasks, 20 commands**

### Success Criteria

1. All 20 Phase 3 commands executable from command palette
2. All MCP tools discoverable via `tools/list` and callable
3. `GET /openspace/instructions` describes MCP tool usage and includes current IDE state
4. Adding a new command auto-updates the Hub MCP server tool registry
5. Pane state reflected in instructions
6. Command failures returned synchronously to agent via MCP tool response
7. E2E test: agent controls IDE via MCP tool calls
8. Build passes, 80%+ test coverage, E2E tests pass

---

## 1. User Stories

### US-3.1: Agent Opens File at Line
**As a** user  
**I want** the agent to open a file and scroll to a specific line  
**So that** I can immediately see the code the agent is referencing  

**Acceptance Criteria:**
- AC-3.1.1: Agent calls MCP tool `openspace.editor.open` with `{ path: "src/index.ts", line: 42 }`
- AC-3.1.2: Monaco editor opens `src/index.ts` and scrolls to line 42
- AC-3.1.3: If file doesn't exist, MCP tool returns `{ success: false, error: "file not found" }` and agent is informed inline

### US-3.2: Agent Highlights Code Region
**As a** user  
**I want** the agent to highlight code regions it's discussing  
**So that** I can visually identify the relevant code without searching  

**Acceptance Criteria:**
- AC-3.2.1: Agent calls MCP tool `openspace.editor.highlight` with `{ path: "src/index.ts", ranges: [{ startLine: 42, endLine: 50 }], highlightId: "fix-1" }`
- AC-3.2.2: Lines 42-50 in `src/index.ts` are highlighted with a distinct background color
- AC-3.2.3: Highlight persists until explicitly cleared or user presses Escape
- AC-3.2.4: Multiple highlights can coexist with different IDs

### US-3.3: Agent Creates Terminal and Runs Command
**As a** user  
**I want** the agent to create a terminal and execute commands  
**So that** the agent can run tests, build tools, or diagnostic commands  

**Acceptance Criteria:**
- AC-3.3.1: Agent calls MCP tool `openspace.terminal.create` with `{ title: "test-runner" }`
- AC-3.3.2: New terminal widget appears in bottom panel with title "test-runner"
- AC-3.3.3: Agent calls MCP tool `openspace.terminal.send` with `{ terminalId: "test-runner", text: "npm test\n" }`
- AC-3.3.4: Terminal executes `npm test`
- AC-3.3.5: Agent can read output via MCP tool `openspace.terminal.read_output`

### US-3.4: Agent Creates Presentation and Opens It
**As a** user  
**I want** the agent to create a presentation and navigate slides  
**So that** the agent can explain concepts visually  

**Note:** This US is **Phase 4** scope, but included here for completeness.

**Acceptance Criteria:**
- AC-3.4.1: Agent calls MCP tool `openspace.presentation.create` with `{ deckPath: "arch.deck.md", title: "Architecture Overview" }`
- AC-3.4.2: File `arch.deck.md` is created with template structure
- AC-3.4.3: Agent calls MCP tool `openspace.presentation.open` with `{ deckPath: "arch.deck.md" }`
- AC-3.4.4: Presentation widget opens showing slide 1

### US-3.5: Agent Manages Pane Layout
**As a** user  
**I want** the agent to arrange panes for optimal context  
**So that** I can view multiple files/terminals/whiteboards simultaneously  

**Acceptance Criteria:**
- AC-3.5.1: Agent calls MCP tool `openspace.pane.open` with `{ type: "editor", contentId: "src/auth.ts", splitDirection: "vertical" }`
- AC-3.5.2: New pane opens to the right with `src/auth.ts`
- AC-3.5.3: Agent calls MCP tool `openspace.pane.list` with `{}`
- AC-3.5.4: Tool returns current layout including pane IDs and geometry

### US-3.6: Agent Self-Corrects on Command Failure
**As a** user  
**I want** the agent to learn from failed commands  
**So that** it doesn't repeat the same mistakes in subsequent responses  

**Acceptance Criteria:**
- AC-3.6.1: Agent calls MCP tool `openspace.editor.open` with `{ path: "missing.ts" }`
- AC-3.6.2: MCP tool returns `{ success: false, error: "file not found" }` synchronously
- AC-3.6.3: Agent receives error inline before continuing its response and can reason about recovery
- AC-3.6.4: Agent can reference this failure in its next reasoning step

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
- AC-3.2.3: All commands include argument schemas for MCP tool registration
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

### FR-3.6: MCP Tool Catalog (Phase T3 — COMPLETE)

**ID:** FEAT-AGENT-006  
**Priority:** P0  
**Phase:** 3.6  
**Status:** ✅ COMPLETE  
**Owner:** Builder

**Description:**  
The Hub MCP server (`OpenSpaceMcpServer` class in `hub-mcp.ts`) exposes all Phase 3 commands as MCP tools. The `%%OS{...}%%` stream interceptor has been retired; MCP is the sole agent→IDE command path.

Every tool follows the naming convention `openspace.<modality>.<action>`. All inputs are validated via JSON Schema in the MCP `inputSchema` field before execution. Results are returned synchronously as MCP tool responses.

**Phase 3 MCP Tool Catalog:**

**Pane tools:**

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.pane.open` | `{ type, contentId, title?, splitDirection? }` | `{ paneId }` |
| `openspace.pane.close` | `{ paneId }` | `{ success }` |
| `openspace.pane.focus` | `{ paneId }` | `{ success }` |
| `openspace.pane.list` | `{}` | `{ panes: PaneInfo[] }` |
| `openspace.pane.resize` | `{ paneId, width?, height? }` | `{ success }` |

**Editor tools:**

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.editor.open` | `{ path, line?, column?, highlight? }` | `{ success }` |
| `openspace.editor.read_file` | `{ path, startLine?, endLine? }` | `{ content: string }` |
| `openspace.editor.close` | `{ path }` | `{ success }` |
| `openspace.editor.scroll_to` | `{ path, line }` | `{ success }` |
| `openspace.editor.highlight` | `{ path, ranges[], highlightId? }` | `{ highlightId: string }` |
| `openspace.editor.clear_highlight` | `{ highlightId }` | `{ success }` |

**Terminal tools:**

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.terminal.create` | `{ title?, cwd?, shellPath? }` | `{ terminalId: string }` |
| `openspace.terminal.send` | `{ terminalId, text }` | `{ success }` |
| `openspace.terminal.read_output` | `{ terminalId, lines? }` | `{ output: string[] }` |
| `openspace.terminal.list` | `{}` | `{ terminals: TerminalInfo[] }` |
| `openspace.terminal.close` | `{ terminalId }` | `{ success }` |

**File tools:**

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.file.read` | `{ path, startLine?, endLine? }` | `{ content: string }` |
| `openspace.file.write` | `{ path, content }` | `{ success }` |
| `openspace.file.list` | `{ path?, recursive? }` | `{ files: FileInfo[] }` |
| `openspace.file.search` | `{ query, path? }` | `{ matches: SearchMatch[] }` |

**Implementation:** `OpenSpaceMcpServer` class in `hub-mcp.ts`. Each tool handler calls `CommandBridge.execute(commandId, args)` which routes to Theia's `CommandRegistry` via the existing backend→frontend IPC channel.

**Acceptance Criteria:**
- AC-3.6.1: All 20 Phase 3 tools discoverable via MCP `tools/list`
- AC-3.6.2: All tools callable and return structured results
- AC-3.6.3: Invalid inputs rejected by JSON Schema validation before execution
- AC-3.6.4: Tool errors returned as structured `{ success: false, error: string }` responses
- AC-3.6.5: No performance regression: tool round-trip latency <100ms for simple operations

**Dependencies:** FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5

---

### FR-3.7: BridgeContribution and Pane State Publishing

**ID:** FEAT-AGENT-007  
**Priority:** P0  
**Phase:** 3.7  
**Owner:** Builder

**Description:**  
`BridgeContribution` (`openspace-core/src/browser/bridge-contribution.ts`) is a `FrontendApplicationContribution` with two responsibilities:

1. Register the frontend as the `CommandBridge` receiver for the Hub MCP server (so MCP tool calls can reach the frontend `CommandRegistry`).
2. Publish pane state snapshots to Hub for system prompt generation.

MCP tools are introspectable directly via `tools/list` — no text-based command manifest is generated or posted to the Hub. Manifest-based discovery is replaced by MCP introspection.

**Requirements:**

1. **FR-3.7.1:** On `FrontendApplication.onStart()`, POST to `POST /openspace/register-bridge` to register the frontend as the `CommandBridge` receiver.

2. **FR-3.7.2:** Subscribe to `PaneService.onPaneLayoutChanged`. On each event, build a `PaneStateSnapshot` and POST to `POST /openspace/state`.

3. **FR-3.7.3:** Throttle state updates — max 1 POST per second to avoid flooding Hub.

4. **FR-3.7.4:** On receiving a `CommandBridge.execute(commandId, args)` request from the Hub, call `CommandRegistry.executeCommand(commandId, args)` and return the result.

**Acceptance Criteria:**
- AC-3.7.1: Hub receives pane state updates when layout changes
- AC-3.7.2: `GET /openspace/instructions` reflects current pane state
- AC-3.7.3: State updates throttled (no more than 1/sec)
- AC-3.7.4: CommandBridge round-trip executes commands in frontend `CommandRegistry`

**Dependencies:** FR-3.1

---

### FR-3.8: System Prompt Generation

**ID:** FEAT-AGENT-008  
**Priority:** P0  
**Phase:** 3.8  
**Owner:** Builder

**Description:**  
Implement system prompt template in Hub's `GET /openspace/instructions` handler. The prompt teaches the LLM how to use IDE commands via MCP tool calls. The prompt no longer enumerates command schemas — the agent discovers tools via MCP `tools/list` at runtime.

**Requirements:**

1. **FR-3.8.1:** Prompt structure:
   ```
   # System Instructions: Theia OpenSpace IDE Control

   You are operating inside Theia OpenSpace IDE.
   You have access to MCP tools prefixed with "openspace." to control the IDE.
   Call tools/list to see all available tools and their schemas.

   ## Current IDE State
   [Generated from pane state — open panes, active tabs, terminals]

   ## Examples
   [2-3 concrete examples of MCP tool usage]
   ```

2. **FR-3.8.2:** IDE state section dynamically generated from latest pane state snapshot. Include:
   - Main area: list of open editors and active file
   - Right panel: chat status
   - Bottom panel: list of terminals
   - Active pane indicator

3. **FR-3.8.3:** Examples section includes 2-3 concrete use cases:
   - Opening a file at a specific line
   - Creating a terminal and running a command
   - Creating a presentation and navigating slides

4. **FR-3.8.4:** Prompt updates automatically when pane state changes (file opened, terminal created).

5. **FR-3.8.5:** Prompt is concise — the agent discovers tool schemas via `tools/list`, so the prompt does NOT enumerate all command arguments.

**Acceptance Criteria:**
- AC-3.8.1: `GET /openspace/instructions` returns well-formatted prompt
- AC-3.8.2: Prompt describes MCP tool usage (not `%%OS{...}%%` syntax)
- AC-3.8.3: Prompt includes current IDE state
- AC-3.8.4: Prompt updates when pane state changes
- AC-3.8.5: Prompt is clear, concise, and actionable (tested with LLM)

**Dependencies:** FR-3.7

---

### FR-3.9: End-to-End Agent Control Test

**ID:** FEAT-AGENT-010  
**Priority:** P0  
**Phase:** 3.9  
**Owner:** Builder

**Description:**  
Full integration test verifying the entire agent control pipeline from MCP tool call to IDE action.

**Requirements:**

1. **FR-3.9.1:** Test covers the full MCP path:
   - Agent issues MCP tool call (`openspace.*`)
   - Hub MCP server receives and validates tool input
   - CommandBridge routes call to Theia backend
   - `CommandRegistry.executeCommand()` dispatches to frontend
   - IDE action is performed (file opens, terminal creates, etc.)
   - Result returned synchronously to agent as MCP tool response

2. **FR-3.9.2:** Test scenarios:
   - Open file at line 42
   - Highlight lines 42-50
   - Create terminal and send command
   - Read terminal output
   - Create presentation (Phase 4)
   - Navigate presentation slides (Phase 4)

3. **FR-3.9.3:** Verification:
   - MCP tool calls return structured results (success/error)
   - IDE state changes as expected
   - Error cases return structured error responses

**Acceptance Criteria:**
- AC-3.9.1: Agent successfully controls IDE via MCP tool calls
- AC-3.9.2: MCP tools return structured results (not fire-and-forget)
- AC-3.9.3: Full CommandBridge path verified
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
With MCP, command results are returned **synchronously** as MCP tool responses. The agent receives success or failure inline before continuing its response — no deferred result log or Hub polling is required.

**Requirements:**

1. **FR-3.11.1:** Every MCP tool call MUST return a structured result:
   ```typescript
   interface CommandResult {
     success: boolean;
     output?: string;
     error?: string;
     data?: unknown;
   }
   ```

2. **FR-3.11.2:** `CommandBridge.execute()` captures the return value from `CommandRegistry.executeCommand()` and propagates it back to the MCP tool handler, which serializes it as the MCP tool response.

3. **FR-3.11.3:** On failure, the MCP response includes a human-readable `error` string. The agent can immediately reason about recovery without waiting for a future system prompt update.

4. **FR-3.11.4:** Hub MAY maintain an optional per-session ring buffer (last 20 results) for diagnostic purposes, but this is NOT required for the agent feedback loop (results are synchronous).

5. **FR-3.11.5:** Only persistent failures (e.g. repeated file-not-found) need to surface in `GET /openspace/instructions`. Transient failures are handled inline by the agent.

**Acceptance Criteria:**
- AC-3.11.1: Every MCP tool call returns a structured result synchronously
- AC-3.11.2: Failed tool calls return `{ success: false, error: "..." }` before agent continues
- AC-3.11.3: Agent can reference failure and recover in same response turn
- AC-3.11.4: No fire-and-forget tool calls (all results acknowledged)
- AC-3.11.5: Feedback loop improves agent behavior over multiple turns

**Dependencies:** FR-3.9

---

## 3. Non-Functional Requirements

### NFR-3.1: Security

**NFR-3.1.1:** All MCP tool calls MUST pass 3-tier validation:
1. Schema validation (input matches MCP `inputSchema` JSON Schema)
2. Namespace validation (only `openspace.*` tools accepted by Hub MCP server)
3. Argument validation (semantic checks — path safety, command existence)

**NFR-3.1.2:** File commands MUST enforce workspace-root constraint. Reject:
- Paths containing `..` (directory traversal)
- Absolute paths outside workspace
- Attempts to modify `.git/`, `node_modules/`, system directories

**NFR-3.1.3:** Terminal output MUST be sanitized to prevent:
- ANSI escape injection
- Control character injection

**NFR-3.1.4:** MCP tool call rate MUST be bounded:
- Max concurrent tool calls: 10
- Max tool calls per agent turn: 50
- Max queue depth warning at 50

### NFR-3.2: Performance

**NFR-3.2.1:** MCP tool call round-trip latency: <100ms for simple commands (open file, highlight), <500ms for complex commands (list panes, search files)

**NFR-3.2.2:** Hub MCP server startup: tools registered and ready <200ms after backend start

**NFR-3.2.3:** System prompt generation: <50ms per request

### NFR-3.3: Reliability

**NFR-3.3.1:** MCP tool calls MUST return structured results — no fire-and-forget

**NFR-3.3.2:** Command dispatch MUST be sequential and FIFO when called in sequence by the agent (agent awaits each result before next call)

**NFR-3.3.3:** Failed commands MUST NOT crash the system (graceful degradation — return error result)

### NFR-3.4: Maintainability

**NFR-3.4.1:** Code coverage: 80%+ for all Phase 3 code

**NFR-3.4.2:** All public methods MUST have JSDoc comments

**NFR-3.4.3:** All MCP tools MUST include JSON Schema `inputSchema` definitions for introspection and validation

**NFR-3.4.4:** Logging MUST be comprehensive (DEBUG level) for troubleshooting

### NFR-3.5: Usability

**NFR-3.5.1:** Command failures MUST be returned as structured MCP tool errors (not silent failures or unformatted strings)

**NFR-3.5.2:** System prompt MUST describe MCP tool usage clearly and be actionable for LLM (tested with GPT-4, Claude)

---

## 4. Technical Constraints

### TC-3.1: Architecture

**TC-3.1.1:** MUST follow Architecture B1 + MCP (RPC path via Hub MCP server, not Hub SSE relay)

**TC-3.1.2:** Agent MUST use MCP tool calls (`openspace.*`) for IDE control — no stream injection, no custom out-of-band channels

**TC-3.1.3:** All commands MUST go through Theia's `CommandRegistry` (no direct service calls from agent or Hub)

**TC-3.1.4:** Tool schemas MUST be validated by Hub MCP server before execution

**TC-3.1.5:** Tool results MUST be returned synchronously before agent continues

### TC-3.2: Dependencies

**TC-3.2.1:** Phase 1 MUST be complete before Phase 3 begins

**TC-3.2.2:** Phase 3 does NOT depend on Phase 2 (parallel development possible)

### TC-3.3: Testing

**TC-3.3.1:** Unit tests MUST cover all command implementations (80%+ coverage)

**TC-3.3.2:** MCP tool calls MUST return structured results (verified by integration tests — not fire-and-forget)

**TC-3.3.3:** E2E tests MUST cover full agent control pipeline (MCP call → CommandBridge → CommandRegistry → IDE action → result)

**TC-3.3.4:** All tests MUST run in CI

---

## 5. Risks & Mitigations

| Risk ID | Risk | Impact | Probability | Mitigation |
|---------|------|--------|-------------|------------|
| R-3.1 | CommandBridge IPC latency exceeds SLA | MEDIUM | LOW | Benchmark early; optimize Theia RPC channel if needed |
| R-3.2 | Runaway MCP tool calls flood CommandRegistry | HIGH | LOW | Per-turn tool call limit (50) + concurrent call cap (10) |
| R-3.3 | File commands escape workspace | CRITICAL | LOW | Workspace-root validation with path traversal detection + symlink resolution |
| R-3.4 | Terminal output too large crashes browser | MEDIUM | MEDIUM | Ring buffer (10K lines max) + pagination |
| R-3.5 | MCP schema validation too strict — blocks valid calls | LOW | MEDIUM | Use permissive schemas with semantic validation in handler |
| R-3.6 | Hub MCP server unreachable from opencode | MEDIUM | LOW | Health check endpoint + circuit breaker fallback |
| R-3.7 | New tools not discoverable (agent uses stale `tools/list`) | MEDIUM | LOW | MCP introspection is per-session; agent calls `tools/list` on each new session |
| R-3.8 | System prompt too long (>10K tokens) | LOW | LOW | Prompt describes MCP usage only; tool schemas are discovered via `tools/list`, not embedded in prompt |

---

## 6. Dependencies

### External Dependencies

- Theia 1.68.2 (ApplicationShell, CommandRegistry, EditorManager, TerminalService, FileService)
- `@modelcontextprotocol/sdk` (McpServer, StreamableHTTPServerTransport)
- opencode server (for session management and MCP provider config)
- Monaco editor (for decorations/highlights)
- xterm.js (for terminal output capture)

### Internal Dependencies

| Phase 3 Task | Depends On |
|--------------|------------|
| 3.2 (pane commands) | 3.1 (PaneService) |
| 3.6 (Hub MCP tool catalog) | 3.2, 3.3, 3.4, 3.5 (all commands registered) |
| 3.7 (BridgeContribution + state) | 3.1 |
| 3.8 (system prompt) | 3.7 (pane state publishing) |
| 3.9 (E2E test) | 3.6, 3.7, 3.8 |
| 3.10 (pane state) | 3.1, 3.7 |
| 3.11 (result feedback) | 3.9 |

### Parallelizable Tasks

Tasks 3.2, 3.3, 3.4, 3.5 are fully parallelizable (different command groups, no interdependencies).

---

## 7. Acceptance Criteria (Phase 3 Exit Criteria)

Phase 3 is **COMPLETE** when:

1. ✅ All 20 Phase 3 commands executable from command palette: `openspace.pane.*`, `openspace.editor.*`, `openspace.terminal.*`, `openspace.file.*`
2. ✅ All MCP tools discoverable via `tools/list` and callable
3. ✅ `GET /openspace/instructions` describes MCP tool usage and includes current IDE state
4. ✅ Adding a new command → Hub MCP server updated → agent discovers it on next `tools/list`
5. ✅ Pane state reflected in instructions (open file → instructions show it)
6. ✅ Command failures returned synchronously to agent via MCP tool response
7. ✅ E2E test passes: agent controls IDE via MCP tool calls
8. ✅ Build passes: `yarn build` exits 0
9. ✅ Unit tests pass: 80%+ coverage, 100% pass rate
10. ✅ E2E tests pass: All agent control scenarios work
11. ✅ CodeReviewer approves with 80%+ confidence
12. ✅ No regressions in Phase 1 functionality

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

- **TECHSPEC:** `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` §6 (Agent Control System — MCP Tool Protocol)
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
| GAP-2 | Prompt injection via code blocks | Security | Hub MCP server is the sole entry point for agent IDE commands — MCP is a structured side channel, never parsed from the response stream | 🔴 BLOCKING |
| GAP-3 | Silent failures hidden from user | SRE | Add configurable notifications for command failures | 🟡 RECOMMENDED |
| GAP-4 | No resource cleanup on session end | SRE | Close all agent-created terminals/panes when session ends | 🔴 BLOCKING |
| GAP-5 | No user consent for agent control | Legal | Add first-run consent dialog | 🟡 RECOMMENDED |

#### Medium-Priority Additions (SHOULD HAVE for Phase 3 or Phase 3.5)

| ID | Gap | Perspective | Recommendation | Status |
|----|-----|-------------|----------------|--------|
| GAP-6 | Per-turn tool call limit | User | Max 50 MCP tool calls per agent turn | 🟡 RECOMMENDED |
| GAP-7 | Undo mechanism | User | "Undo Last Agent Action" command | 🟢 OPTIONAL (Phase 4) |
| GAP-8 | Dangerous command confirmation | Security | Confirm terminal commands with `rm`, `sudo`, etc. | 🟡 RECOMMENDED |
| GAP-9 | Sensitive file denylist | Security | Block `.env`, `.git/`, `id_rsa`, etc. from `openspace.file.read` | 🟡 RECOMMENDED |
| GAP-10 | Metrics/telemetry | SRE | Prometheus metrics for MCP tool execution | 🟢 OPTIONAL (Phase 4) |
| GAP-11 | Comprehensive audit log | Legal | Log all MCP tool calls with 90-day retention | 🟢 OPTIONAL (Phase 4) |

#### Low-Priority Additions (NICE TO HAVE for Phase 4+)

| ID | Gap | Perspective | Recommendation | Status |
|----|-----|-------------|----------------|--------|
| GAP-12 | User documentation | User | Document agent capabilities in help system | 🟢 OPTIONAL |
| GAP-13 | Circuit breaker for Hub | SRE | Fall back gracefully if Hub MCP server unreachable | 🟢 OPTIONAL |
| GAP-14 | Sensitive data scrubber | Legal | Detect and redact secrets in terminal output | 🟢 OPTIONAL |
| GAP-15 | ToS/EULA | Legal | Add Terms of Service for agent control | 🟢 OPTIONAL |

### Updated Requirements Based on Audit

The following requirements are **ADDED** to Phase 3 based on audit findings:

#### NFR-3.6: Security Enhancements (NEW)

**NFR-3.6.1 (GAP-1):** All file commands MUST resolve symlinks and validate that the resolved path is within workspace root. Reject symlinks pointing outside workspace.

**NFR-3.6.2 (GAP-2):** The Hub MCP server is the sole entry point for agent IDE commands. MCP tool calls are a structured side channel — they are never parsed from the agent's text response stream. This eliminates prompt injection via code examples entirely.

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

**NFR-3.7.2 (GAP-6):** Enforce per-turn tool call limit: max 50 MCP tool calls per agent response turn. If exceeded, return an error tool response and log warning.

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
- Phase 3 implementation includes security hardening from day one

---

## 11. Approval

**Status:** ✅ APPROVED (2026-02-17) — Updated for MCP architecture 2026-02-18

**Architecture Change (2026-02-18):**  
The `%%OS{...}%%` stream interceptor has been retired and replaced by MCP (Model Context Protocol) as the sole agent→IDE command path. FR-3.6 has been rewritten to document the Hub MCP tool catalog. The `onAgentCommand()` RPC callback, `SyncService` command queue, and stream interceptor parser have all been removed. All Phase 3 command implementations (3.1–3.5, 3.7, 3.8, 3.10, 3.11) remain valid — only the transport layer changed.

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
5. ~~Update requirements for MCP architecture~~ — ✅ COMPLETE (2026-02-18)

---

**End of Requirements Document**
