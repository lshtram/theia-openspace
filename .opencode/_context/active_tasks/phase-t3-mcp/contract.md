---
id: PHASE-T3-MCP-CONTRACT
author: oracle
status: ACTIVE
date: 2026-02-18
phase: T3
---

# Builder Contract: Phase T3 — MCP Agent Control System

## Context

The `%%OS{...}%%` stream interceptor is retired. All agent→IDE commands now travel
exclusively via MCP tools. This contract implements the full Phase T3 spec from WORKPLAN.md.

**Architecture after T3:**
```
Agent (opencode) → MCP tool call → Hub MCP Server → CommandRegistry → Theia widget
```

---

## Deliverables

### T3.1 — Add MCP server to Hub

**File:** `extensions/openspace-core/src/node/hub-mcp.ts` (NEW)  
**Also modify:** `extensions/openspace-core/src/node/hub.ts`  
**Also modify:** `extensions/openspace-core/package.json` (add `@modelcontextprotocol/sdk`)

**Package to add:**
```json
"@modelcontextprotocol/sdk": "1.26.0"
```

**Note:** SDK v1.26.0 has BOTH ESM and CJS exports (unlike `@opencode-ai/sdk`).  
Use: `require('@modelcontextprotocol/sdk/server')` — maps to `dist/cjs/server/index.js` ✅

**`hub-mcp.ts` must:**
1. Create an MCP `Server` instance with name `openspace-hub-mcp`, version `0.1.0`
2. Register `ListToolsRequestSchema` handler → returns all tool definitions (see T3.2)
3. Register `CallToolRequestSchema` handler → routes to per-tool implementations
4. Export `class HubMcpServer` with:
   - Constructor takes a reference to `OpenSpaceHub` (for state access)
   - `startHttpSse(app: Application): void` — attaches two Express routes:
     - `GET /openspace/mcp/sse` — SSE endpoint for MCP transport
     - `POST /openspace/mcp/messages` — message endpoint for MCP transport
   - Uses `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js`

**Transport rationale:** HTTP/SSE transport (not stdio) because:
- opencode supports both stdio and HTTP-based MCP servers
- Hub MCP server is embedded in Theia backend (not a separate process)
- HTTP/SSE allows long-lived MCP connection without spawning extra process

**`hub.ts` changes:**
- Import `HubMcpServer`
- In `configure(app: Application)`: instantiate `HubMcpServer` and call `startHttpSse(app)`
- Expose getter `getState(): MutableHubState` for `HubMcpServer` to read pane state + manifest

**Acceptance criteria:**
- `GET /openspace/mcp/sse` establishes SSE stream (HTTP 200, `text/event-stream`)
- `POST /openspace/mcp/messages` with `{"jsonrpc":"2.0","method":"tools/list","id":1}` returns tool list
- `POST /openspace/mcp/messages` with `{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"pane.list","arguments":{}}}` returns pane state JSON

---

### T3.2 — MCP tool catalog: pane + editor + terminal + file (17 tools)

**File:** `extensions/openspace-core/src/node/hub-mcp.ts` (extended)

The tool handlers call the Theia `CommandRegistry` via the **frontend RPC bridge**.  
Specifically: Hub MCP server needs to execute frontend commands. The bridge is:

```
HubMcpServer (backend) → Hub.executeFrontendCommand(cmd, args) 
  → OpenSpaceHub stores pending command
  → BridgeContribution polls (or is pushed via RPC) 
  → CommandRegistry.executeCommand()
  → result returned via Hub POST /openspace/command-results endpoint (already exists)
```

**IMPORTANT:** The Hub cannot directly call frontend `CommandRegistry` (it's in the browser). 
The existing mechanism (SyncService's command queue, fed by `onAgentCommand` RPC) is being 
removed. We need a new mechanism for T3.2.

**New mechanism for T3.2 — Command Relay:**

1. Hub MCP tool handler: when called, adds command to `Hub.pendingCommands` queue
2. New Hub endpoint: `GET /openspace/commands/next` — returns next pending command (long-poll or immediate)
3. `BridgeContribution` in frontend: polls `GET /openspace/commands/next` on interval (500ms) 
   OR subscribe once SyncService is updated
4. `BridgeContribution` calls `CommandRegistry.executeCommand(cmd, args)`, posts result to 
   `POST /openspace/command-results`
5. MCP tool handler awaits the result (with 10s timeout)

**Alternative (simpler, recommended):** 
Keep the existing `onAgentCommand` RPC callback path **temporarily** during T3.2.  
Hub MCP handler calls `client.onAgentCommand(cmd)` (the existing wired path).  
Remove `onAgentCommand` only in T3.4 AFTER confirming MCP command relay works.

The **simpler approach**: 
- T3.2 tools for **read-only operations** (pane.list, file.read, etc.) call directly into the 
  Hub state (already available — Hub has `paneState` from BridgeContribution POST)
- T3.2 tools for **write operations** (pane.open, editor.open, terminal.create, etc.) use 
  a NEW Hub endpoint `GET /openspace/commands/pending` + BridgeContribution polling

**Implementation plan for T3.2:**

Add to `hub.ts`:
```typescript
// Pending command queue for MCP tool→frontend dispatch
private pendingCommandQueue: Array<{
  id: string;
  cmd: string;
  args: unknown;
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}> = [];

// Called by HubMcpServer to dispatch a command to the frontend
async dispatchCommand(cmd: string, args: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => {
      this.pendingCommandQueue = this.pendingCommandQueue.filter(c => c.id !== id);
      reject(new Error(`Command ${cmd} timed out after 10s`));
    }, 10000);
    this.pendingCommandQueue.push({ id, cmd, args, resolve, reject, timeout });
  });
}

// Express endpoint: GET /openspace/commands/pending
// BridgeContribution polls this
private handleGetPendingCommand(req: Request, res: Response): void {
  const next = this.pendingCommandQueue.shift();
  if (!next) {
    res.json({ id: null, cmd: null, args: null });
    return;
  }
  // Store the promise callbacks keyed by id for result collection
  this.pendingCommandCallbacks.set(next.id, { resolve: next.resolve, reject: next.reject });
  clearTimeout(next.timeout);
  res.json({ id: next.id, cmd: next.cmd, args: next.args });
}

// Express endpoint: POST /openspace/commands/result  
// BridgeContribution posts result here
private handleCommandResult(req: Request, res: Response): void {
  const { id, success, output, error } = req.body;
  const cb = this.pendingCommandCallbacks.get(id);
  if (cb) {
    this.pendingCommandCallbacks.delete(id);
    if (success) cb.resolve(output);
    else cb.reject(new Error(error || 'Command failed'));
  }
  res.json({ ok: true });
}
```

Add to `BridgeContribution`:
```typescript
// Poll Hub every 500ms for pending commands
private startCommandPolling(): void {
  this.commandPollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${this.hubUrl}/openspace/commands/pending`);
      const { id, cmd, args } = await response.json();
      if (!id || !cmd) return;
      let success = true;
      let output: unknown = null;
      let error: string | undefined;
      try {
        output = await this.commandRegistry.executeCommand(cmd, args);
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
      }
      await fetch(`${this.hubUrl}/openspace/commands/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, success, output, error }),
      });
    } catch {
      // Ignore polling errors
    }
  }, 500);
}
```

**Tool definitions (17 tools):**

**Pane tools (4):**
- `pane.list` — returns `Hub.paneState` as JSON text (no command dispatch needed)
- `pane.open` — `dispatchCommand('openspace.pane.open', args)`
- `pane.close` — `dispatchCommand('openspace.pane.close', args)`
- `pane.focus` — `dispatchCommand('openspace.pane.focus', args)`

**Editor tools (3):**
- `editor.open` — `dispatchCommand('openspace.editor.open', args)`
- `editor.read_file` — reads file via `fs.readFile` (backend can do this directly, no dispatch needed)
- `editor.close` — `dispatchCommand('openspace.editor.close', args)`

**Terminal tools (5):**
- `terminal.create` — `dispatchCommand('openspace.terminal.create', args)`
- `terminal.send` — `dispatchCommand('openspace.terminal.send', args)`
- `terminal.read_output` — `dispatchCommand('openspace.terminal.read_output', args)` (returns ring buffer)
- `terminal.list` — `dispatchCommand('openspace.terminal.list', args)`
- `terminal.close` — `dispatchCommand('openspace.terminal.close', args)`

**File tools (4):** (backend can handle these directly via `fs`)
- `file.read` — `fs.readFile` with workspace-root constraint
- `file.write` — `fs.writeFile` with workspace-root constraint  
- `file.list` — `fs.readdir` with workspace-root constraint
- `file.search` — `fs.readdir` recursive + content search with workspace-root constraint

**Workspace-root constraint for file tools:**
```typescript
const WORKSPACE_ROOT = process.env.THEIA_WORKSPACE || process.cwd();
function validatePath(p: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, p);
  if (!resolved.startsWith(path.resolve(WORKSPACE_ROOT))) {
    throw new Error(`Path ${p} is outside workspace root`);
  }
  return resolved;
}
```

**All tools return:**
```typescript
{ content: [{ type: 'text', text: string }], isError?: boolean }
```

---

### T3.3 — MCP tool catalog: presentation + whiteboard (11 tools)

**File:** `extensions/openspace-core/src/node/hub-mcp.ts` (extended)

These tools delegate to the Phase 4 services via `dispatchCommand()`:

**Presentation tools (7):**
- `presentation.list` — reads `design/deck/` directory, returns `.deck.md` file list
- `presentation.read` — reads `.deck.md` file content
- `presentation.create` — `file.write` to create new `.deck.md`
- `presentation.update_slide` — reads deck, modifies slide at index, writes back
- `presentation.open` — `dispatchCommand('openspace.presentation.open', args)`
- `presentation.navigate` — `dispatchCommand('openspace.presentation.navigate', args)`
- `presentation.current_slide` — returns from Hub pane state (if tracked)

**Whiteboard tools (4):**
- `whiteboard.list` — reads `design/` directory, returns `.whiteboard.json` file list
- `whiteboard.read` — reads `.whiteboard.json` file content
- `whiteboard.update` — `file.write` to update `.whiteboard.json`
- `whiteboard.create` — `file.write` to create new `.whiteboard.json`

---

### T3.4 — Remove stream interceptor

**Files to modify:**
1. `extensions/openspace-core/src/node/opencode-proxy.ts`
   - Remove `import { StreamInterceptor }` 
   - Remove `protected readonly streamInterceptor: StreamInterceptor`
   - Remove all `streamInterceptor.interceptLine()` calls in SSE handler
   - Remove `client.onAgentCommand()` calls
2. `extensions/openspace-core/src/node/stream-interceptor.ts` — **DELETE this file**
3. `extensions/openspace-core/src/common/opencode-protocol.ts`
   - Remove `onAgentCommand(command: AgentCommand): void` from `OpenCodeClient` interface
4. `extensions/openspace-core/src/browser/opencode-sync-service.ts`
   - Remove `onAgentCommand()` method implementation
   - Remove `commandQueue` and queue processing logic
   - Remove `50ms inter-command delay` logic
   - Remove `CommandRegistry` injection (if only used for command dispatch)
5. `extensions/openspace-core/src/node/openspace-core-backend-module.ts`
   - Remove `onAgentCommand` callback binding from the RPC connection handler

**Acceptance:**
- `grep -r "%%OS"` returns zero results
- `grep -r "onAgentCommand"` returns zero results
- `grep -r "streamInterceptor\|StreamInterceptor"` returns zero results
- `yarn build` passes

---

### T3.5 — Configure opencode.json for MCP

**File:** `opencode.json` (project root — user config, already exists)

Add `mcpServers` block:
```json
{
  "mcpServers": {
    "openspace-hub": {
      "type": "sse",
      "url": "http://localhost:3000/openspace/mcp/sse"
    }
  },
  "instructions": ["http://localhost:3000/openspace/instructions"]
}
```

**Also:** Update `docs/development/SETUP.md` with MCP configuration section.

---

### T3.6 — Update system prompt (`GET /openspace/instructions`)

**File:** `extensions/openspace-core/src/node/hub.ts`

Remove all references to `%%OS{...}%%` pattern from the instructions template.

New instructions template:
```
You are the OpenSpace agent, integrated into a Theia-based IDE via MCP tools.

## Available Tools
MCP tools are available for IDE control. Use `tools/list` to discover all available tools.
Key capabilities:
- `pane.*` — manage IDE panes (open, close, focus, list)  
- `editor.*` — open/read/close files in the editor
- `terminal.*` — create and control terminals
- `file.*` — read, write, list, search files in the workspace
- `presentation.*` — create and navigate presentation decks
- `whiteboard.*` — create and update whiteboard diagrams

## Current IDE State
[dynamically generated from pane state]

## Guidelines
- Use MCP tools to control the IDE. Tool calls return structured results.
- On error: `isError: true` with a human-readable message in `content[0].text`.
```

---

## Test Requirements

### Unit tests (must pass — 412 baseline)
- Add unit tests for `HubMcpServer` in `extensions/openspace-core/src/node/__tests__/`
  - `hub-mcp.spec.ts`: test tool list, test `pane.list` returns pane state, test `file.read` reads file, test workspace-root constraint, test error response format

### E2E tests (baseline: 37 pass, 2 skip, 0 fail — must not regress)
- Existing agent-control tests (`agent-control.spec.ts`) test via `window.__openspace_test__` hooks
- After T3.4 removes the stream interceptor, `agent-control.spec.ts` tests using `triggerAgentCommand` will need updating
- **NEW** E2E test: `tests/e2e/mcp-tools.spec.ts` — verify MCP endpoint is live, `tools/list` returns expected tools

### Build
- `yarn build` must pass (0 errors)

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `extensions/openspace-core/src/node/hub-mcp.ts` |
| MODIFY | `extensions/openspace-core/src/node/hub.ts` |
| MODIFY | `extensions/openspace-core/src/node/opencode-proxy.ts` |
| DELETE | `extensions/openspace-core/src/node/stream-interceptor.ts` |
| MODIFY | `extensions/openspace-core/src/common/opencode-protocol.ts` |
| MODIFY | `extensions/openspace-core/src/browser/opencode-sync-service.ts` |
| MODIFY | `extensions/openspace-core/src/browser/bridge-contribution.ts` |
| MODIFY | `extensions/openspace-core/src/node/openspace-core-backend-module.ts` |
| MODIFY | `extensions/openspace-core/package.json` |
| MODIFY | `opencode.json` |
| MODIFY | `docs/development/SETUP.md` |
| CREATE | `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts` |
| CREATE | `tests/e2e/mcp-tools.spec.ts` |

---

## Implementation Order

1. **T3.1**: Install MCP SDK, create `hub-mcp.ts` skeleton with SSE transport, wire into `hub.ts`
2. **T3.2**: Implement all 17 core tool handlers; add command relay endpoints to Hub; add BridgeContribution polling
3. **T3.3**: Add 11 presentation + whiteboard tool handlers
4. **T3.4**: Remove stream interceptor (only after T3.1–T3.3 confirmed working)
5. **T3.5**: Update `opencode.json` + docs
6. **T3.6**: Rewrite instructions template

**After each step: `yarn build` must pass.**

---

## Key References

- Reference MCP impl: `/Users/Shared/dev/openspace/runtime-hub/src/mcp/modality-mcp.ts`
- MCP SDK CJS path: `@modelcontextprotocol/sdk/server` (CJS), `@modelcontextprotocol/sdk/server/sse` (SSE transport)
- Current hub: `extensions/openspace-core/src/node/hub.ts`
- E2E baseline: 37 pass, 2 skip, 0 fail (from last commit `cce9459`)
