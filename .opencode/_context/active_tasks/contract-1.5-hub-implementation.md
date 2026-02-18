# Contract: Phase 1 Task 1.5 — Hub Implementation (Backend)

**Task ID:** 1.5  
**Phase:** Phase 1 (Core Connection + Hub)  
**Agent:** Builder  
**Status:** PENDING  
**Created:** 2026-02-16  
**Dependencies:** 1.4 (Backend DI wiring)

---

## Objective

Implement the OpenSpace Hub — a lightweight HTTP + SSE server that bridges the Theia frontend (BridgeContribution) with the opencode AI agent. The Hub manages the command manifest, generates dynamic system prompts for the agent, and relays agent commands back to the frontend for execution.

---

## Context

### System Architecture (§6.4 from TECHSPEC)

```
┌─────────────────┐        ┌──────────────┐        ┌────────────────┐
│ Theia Frontend  │  SSE   │              │  HTTP  │ opencode agent │
│ (Bridge)        │───────▶│     HUB      │◀───────│ (external)     │
│                 │  POST  │              │  GET   │                │
│ CommandRegistry │───────▶│  Express     │        │ LLM-powered    │
└─────────────────┘        │  + SSE       │        │ AI assistant   │
                            └──────────────┘        └────────────────┘
                                   │
                                   │ Instructions URL
                                   ▼
                            GET /openspace/instructions
                            (dynamic system prompt)
```

**Hub Role:**
1. **Command Manifest Storage** — receives manifest from BridgeContribution on startup
2. **System Prompt Generation** — builds instructions for opencode agent from manifest + live state
3. **Agent Command Relay** — receives `%%OS{...}%%` blocks from stream interceptor, broadcasts to BridgeContribution
4. **State Tracking** — receives pane/editor state updates from frontend

---

## Requirements

### Functional Requirements

#### FR1: HTTP Endpoints

##### FR1.1: POST /manifest
- **Purpose:** Receive command manifest from BridgeContribution (Task 1.7)
- **Request Body:** 
  ```typescript
  {
    commands: CommandDefinition[];  // Array of openspace.* commands
    timestamp: string;
  }
  ```
- **Response:** `200 OK` with `{ success: true }`
- **Behavior:**
  - Store manifest in memory (singleton state)
  - Replace any previous manifest (BridgeContribution sends full manifest on startup)
  - Log manifest update: `[Hub] Manifest updated: {N} commands registered`

##### FR1.2: GET /openspace/instructions
- **Purpose:** Generate system prompt for opencode agent
- **Query Params:** None
- **Response:** Plain text (markdown format)
- **Content:**
  ```
  # OpenSpace IDE Control Instructions
  
  You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting
  `%%OS{...}%%` blocks in your response. These are invisible to the user.
  
  ## Available Commands
  
  {for each command in manifest}
  - **{command.id}**: {command.description}
    - Arguments: `{JSON schema}`
    - Example: `%%OS{"cmd":"{command.id}","args":{...}}%%`
  {end for}
  
  ## Current IDE State
  
  {if pane state exists}
  - Main area: [{list of open tabs}]
  - Right panel: [{list of panels}]
  - Bottom panel: [{list of terminals/panels}]
  {else}
  (No state available yet)
  {end if}
  
  ## Command Format
  
  Commands must be emitted as: `%%OS{"cmd":"command.id","args":{...}}%%`
  Multiple commands can appear in a single response.
  Commands are executed sequentially in order of appearance.
  ```

##### FR1.3: POST /commands
- **Purpose:** Receive `%%OS{...}%%` command blocks from stream interceptor
- **Request Body:**
  ```typescript
  {
    cmd: string;         // Command ID (e.g., "openspace.pane.open")
    args: unknown;       // Command arguments
    sessionId?: string;  // Optional session tracking
  }
  ```
- **Response:** `202 Accepted` (command queued for broadcast)
- **Behavior:**
  - Validate `cmd` exists in manifest
  - Broadcast as SSE event to all connected BridgeContribution clients
  - Log: `[Hub] Command received: {cmd} with args {JSON.stringify(args)}`

##### FR1.4: POST /state
- **Purpose:** Receive IDE state updates from BridgeContribution
- **Request Body:**
  ```typescript
  {
    panes: PaneInfo[];      // From PaneService.listPanes()
    activeContent?: string;
    timestamp: string;
  }
  ```
- **Response:** `200 OK`
- **Behavior:**
  - Store latest state in memory (replaces previous state)
  - Used by FR1.2 to generate "Current IDE State" section

##### FR1.5: GET /events
- **Purpose:** SSE endpoint for BridgeContribution to receive agent commands
- **Response:** `text/event-stream`
- **Event Format:**
  ```
  event: AGENT_COMMAND
  data: {"cmd":"openspace.pane.open","args":{"type":"editor","contentId":"src/index.ts"}}
  
  event: ping
  data: {"timestamp":"2026-02-16T10:00:00Z"}
  ```
- **Behavior:**
  - Keep connection alive with periodic ping events (every 30s)
  - Broadcast commands received via POST /commands as `AGENT_COMMAND` events
  - Handle client disconnect gracefully (remove from subscriber list)

#### FR2: State Management

##### FR2.1: Manifest Storage
- **Structure:**
  ```typescript
  interface HubState {
    manifest: CommandManifest | null;
    paneState: PaneLayout | null;
    lastManifestUpdate: string | null;
    lastStateUpdate: string | null;
  }
  ```
- **Initialization:** All fields start as `null`
- **Thread safety:** Not required for MVP (single-threaded Node.js)

##### FR2.2: SSE Client Management
- **Track active EventSource connections** for broadcasting
- **Remove stale connections** when client disconnects
- **Limit concurrent connections** (max 10, configurable)

#### FR3: Error Handling

##### FR3.1: Invalid Command
- **Scenario:** POST /commands with `cmd` not in manifest
- **Response:** `400 Bad Request` with `{ error: "Unknown command: {cmd}" }`
- **Behavior:** Log warning, do NOT broadcast

##### FR3.2: Malformed JSON
- **Scenario:** POST /manifest or /commands with invalid JSON body
- **Response:** `400 Bad Request` with `{ error: "Invalid JSON" }`
- **Behavior:** Log error, reject request

##### FR3.3: Missing Manifest
- **Scenario:** POST /commands before POST /manifest
- **Response:** `503 Service Unavailable` with `{ error: "Manifest not initialized" }`
- **Behavior:** Commands cannot be validated without manifest

---

### Non-Functional Requirements

#### NFR1: Performance
- **GET /openspace/instructions** must respond in <100ms
- **POST /commands → SSE broadcast** latency <50ms
- **SSE ping interval** 30 seconds (prevents proxy timeout)

#### NFR2: Reliability
- **Hub must start with Theia backend** (co-located, not standalone)
- **No persistent storage required** (all state in memory, rebuilt on restart)
- **Graceful shutdown** (close all SSE connections on process exit)

#### NFR3: Observability
- **Log all endpoint hits** at DEBUG level
- **Log errors** at ERROR level with full stack trace
- **Structured logging** (JSON format for easy parsing)

---

## Acceptance Criteria

### AC1: HTTP Endpoints Functional
- ✅ All 5 endpoints respond with correct status codes
- ✅ POST /manifest updates stored manifest
- ✅ GET /openspace/instructions generates valid markdown
- ✅ POST /commands broadcasts SSE events
- ✅ POST /state updates stored pane layout
- ✅ GET /events establishes SSE connection

### AC2: SSE Event Relay Works
- ✅ POST /commands → SSE AGENT_COMMAND received by connected clients
- ✅ Multiple clients receive same event (broadcast)
- ✅ Ping events keep connection alive

### AC3: Error Handling
- ✅ Invalid command → 400 Bad Request
- ✅ Malformed JSON → 400 Bad Request
- ✅ Missing manifest → 503 Service Unavailable

### AC4: Integration with Theia
- ✅ Hub starts when Theia backend starts (BackendApplicationContribution)
- ✅ Hub binds to port 3001 (configurable)
- ✅ Hub logs startup: `[Hub] OpenSpace Hub listening on http://localhost:3001`

### AC5: Manual Testing
- ✅ `curl -X POST http://localhost:3001/manifest -d '{"commands":[]}'` → 200 OK
- ✅ `curl http://localhost:3001/openspace/instructions` → returns markdown
- ✅ `curl -X POST http://localhost:3001/commands -d '{"cmd":"test","args":{}}'` → 202 Accepted
- ✅ `curl -N http://localhost:3001/events` → SSE stream (receives ping)

---

## Implementation Guidance

### Step 1: Create Hub Service

**File:** `extensions/openspace-core/src/node/hub.ts`

**Structure:**
```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application } from 'express';
import { ILogger } from '@theia/core/lib/common/logger';
import * as express from 'express';
import { CommandManifest, HubState, AgentCommand } from '../common/command-manifest';

@injectable()
export class OpenSpaceHub implements BackendApplicationContribution {
    @inject(ILogger) protected readonly logger!: ILogger;
    
    private state: HubState = {
        manifest: null,
        paneState: null,
        lastManifestUpdate: null,
        lastStateUpdate: null
    };
    
    private sseClients: Set<express.Response> = new Set();
    private pingInterval: NodeJS.Timeout | undefined;
    
    configure(app: Application): void {
        // Middleware
        app.use(express.json());
        
        // Endpoints
        app.post('/manifest', this.handleManifest.bind(this));
        app.get('/openspace/instructions', this.handleInstructions.bind(this));
        app.post('/commands', this.handleCommands.bind(this));
        app.post('/state', this.handleState.bind(this));
        app.get('/events', this.handleEvents.bind(this));
        
        // Start ping interval
        this.startPingInterval();
        
        this.logger.info('[Hub] OpenSpace Hub configured');
    }
    
    onStop(): void {
        // Cleanup
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.closeAllSSEConnections();
    }
    
    private handleManifest(req: express.Request, res: express.Response): void {
        // Implementation...
    }
    
    private handleInstructions(req: express.Request, res: express.Response): void {
        // Implementation...
    }
    
    private handleCommands(req: express.Request, res: express.Response): void {
        // Implementation...
    }
    
    private handleState(req: express.Request, res: express.Response): void {
        // Implementation...
    }
    
    private handleEvents(req: express.Request, res: express.Response): void {
        // SSE setup...
    }
    
    private broadcastSSE(event: string, data: unknown): void {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        this.sseClients.forEach(client => {
            try {
                client.write(message);
            } catch (err) {
                this.logger.error('[Hub] Failed to write to SSE client:', err);
                this.sseClients.delete(client);
            }
        });
    }
    
    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            this.broadcastSSE('ping', { timestamp: new Date().toISOString() });
        }, 30000); // 30 seconds
    }
    
    private closeAllSSEConnections(): void {
        this.sseClients.forEach(client => {
            try {
                client.end();
            } catch (err) {
                // Ignore
            }
        });
        this.sseClients.clear();
    }
}
```

### Step 2: Generate System Prompt

**Key logic for GET /openspace/instructions:**

```typescript
private generateInstructions(): string {
    let instructions = `# OpenSpace IDE Control Instructions\n\n`;
    
    instructions += `You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting\n`;
    instructions += `\`%%OS{...}%%\` blocks in your response. These are invisible to the user.\n\n`;
    
    if (this.state.manifest && this.state.manifest.commands.length > 0) {
        instructions += `## Available Commands\n\n`;
        
        for (const cmd of this.state.manifest.commands) {
            instructions += `- **${cmd.id}**: ${cmd.description || 'No description'}\n`;
            if (cmd.arguments && cmd.arguments.length > 0) {
                instructions += `  - Arguments:\n`;
                for (const arg of cmd.arguments) {
                    const required = arg.required ? 'required' : 'optional';
                    instructions += `    - \`${arg.name}\` (${arg.type}, ${required}): ${arg.description || ''}\n`;
                }
            }
            instructions += `  - Example: \`%%OS{"cmd":"${cmd.id}","args":{...}}%%\`\n\n`;
        }
    } else {
        instructions += `## Available Commands\n\n`;
        instructions += `(No commands registered yet. The IDE is still initializing.)\n\n`;
    }
    
    if (this.state.paneState && this.state.paneState.panes.length > 0) {
        instructions += `## Current IDE State\n\n`;
        
        const mainPane = this.state.paneState.panes.find(p => p.area === 'main');
        if (mainPane && mainPane.tabs.length > 0) {
            const tabList = mainPane.tabs.map(t => `${t.type}: ${t.title}${t.isDirty ? ' *' : ''}`).join(', ');
            instructions += `- Main area: [${tabList}]\n`;
        }
        
        const rightPane = this.state.paneState.panes.find(p => p.area === 'right');
        if (rightPane && rightPane.tabs.length > 0) {
            const tabList = rightPane.tabs.map(t => t.title).join(', ');
            instructions += `- Right panel: [${tabList}]\n`;
        }
        
        const bottomPane = this.state.paneState.panes.find(p => p.area === 'bottom');
        if (bottomPane && bottomPane.tabs.length > 0) {
            const tabList = bottomPane.tabs.map(t => t.title).join(', ');
            instructions += `- Bottom panel: [${tabList}]\n`;
        }
        
        instructions += `\n`;
    } else {
        instructions += `## Current IDE State\n\n`;
        instructions += `(No state available yet.)\n\n`;
    }
    
    instructions += `## Command Format\n\n`;
    instructions += `Commands must be emitted as: \`%%OS{"cmd":"command.id","args":{...}}%%\`\n`;
    instructions += `Multiple commands can appear in a single response.\n`;
    instructions += `Commands are executed sequentially in order of appearance.\n`;
    
    return instructions;
}
```

### Step 3: Wire Hub into Backend Module

**File:** `extensions/openspace-core/src/node/openspace-core-backend-module.ts`

**Add binding:**
```typescript
import { OpenSpaceHub } from './hub';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';

// ... existing bindings ...

// Bind Hub as BackendApplicationContribution
bind(OpenSpaceHub).toSelf().inSingletonScope();
bind(BackendApplicationContribution).toService(OpenSpaceHub);
```

### Step 4: Update Types

**File:** `extensions/openspace-core/src/common/command-manifest.ts`

**Add HubState type:**
```typescript
export interface HubState {
    manifest: CommandManifest | null;
    paneState: PaneLayout | null;
    lastManifestUpdate: string | null;
    lastStateUpdate: string | null;
}
```

---

## File Changes

### Files to Create

1. **`extensions/openspace-core/src/node/hub.ts`**
   - Main Hub implementation (BackendApplicationContribution)
   - All 5 HTTP endpoint handlers
   - SSE broadcast logic
   - System prompt generation

### Files to Modify

1. **`extensions/openspace-core/src/node/openspace-core-backend-module.ts`**
   - Add Hub binding as BackendApplicationContribution

2. **`extensions/openspace-core/src/common/command-manifest.ts`**
   - Add HubState interface
   - Add PaneLayout import (from pane-protocol.ts)

### Files to Reference

- `extensions/openspace-core/src/common/command-manifest.ts` — CommandManifest, CommandDefinition types
- `extensions/openspace-core/src/common/pane-protocol.ts` — PaneLayout, PaneInfo types
- `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` — §6.4 (Hub architecture)
- `docs/architecture/WORKPLAN.md` — Task 1.5 specification

---

## Testing Strategy

### Manual Testing (Immediate)

**Test 1: Hub Startup**
```bash
# Start Theia backend
yarn start:browser

# Verify logs
# Expected: "[Hub] OpenSpace Hub configured"
```

**Test 2: Manifest Endpoint**
```bash
curl -X POST http://localhost:3001/manifest \
  -H "Content-Type: application/json" \
  -d '{"commands":[{"id":"test.cmd","description":"Test command"}],"timestamp":"2026-02-16T10:00:00Z"}'

# Expected: {"success":true}
```

**Test 3: Instructions Endpoint**
```bash
curl http://localhost:3001/openspace/instructions

# Expected: Markdown text with command list
```

**Test 4: SSE Connection**
```bash
curl -N http://localhost:3001/events

# Expected: SSE stream with periodic ping events
# event: ping
# data: {"timestamp":"..."}
```

**Test 5: Command Relay**
```bash
# In terminal 1: Listen to SSE
curl -N http://localhost:3001/events

# In terminal 2: Send command
curl -X POST http://localhost:3001/commands \
  -H "Content-Type: application/json" \
  -d '{"cmd":"openspace.pane.open","args":{"type":"editor","contentId":"test.ts"}}'

# Expected in terminal 1:
# event: AGENT_COMMAND
# data: {"cmd":"openspace.pane.open","args":{"type":"editor","contentId":"test.ts"}}
```

### Integration Testing (Deferred to Task 1.7+)
- BridgeContribution connects to /events SSE endpoint
- BridgeContribution POSTs manifest on startup
- Commands flow end-to-end: POST /commands → SSE → BridgeContribution → CommandRegistry

---

## Edge Cases

### EC1: Multiple SSE Clients
- **Scenario**: Multiple browser tabs open Theia simultaneously
- **Expected**: All clients receive broadcast commands
- **Verification**: Test with 2 `curl -N /events` in parallel

### EC2: SSE Client Disconnect
- **Scenario**: Client closes connection (tab close, network error)
- **Expected**: Hub detects disconnect, removes client from subscriber list
- **Verification**: Close curl connection, send command, verify no error logs

### EC3: Empty Manifest
- **Scenario**: GET /openspace/instructions before POST /manifest
- **Expected**: Returns valid instructions with "(No commands registered yet)"
- **Verification**: Curl instructions endpoint before sending manifest

### EC4: State Update Before Manifest
- **Scenario**: POST /state before POST /manifest
- **Expected**: State stored, but instructions show "no commands"
- **Verification**: Order requests backwards, verify instructions still work

### EC5: Malformed Command
- **Scenario**: POST /commands with `cmd` not in manifest
- **Expected**: 400 Bad Request, no SSE broadcast
- **Verification**: Send unknown command, verify error response

---

## Success Metrics

- ✅ Hub starts with Theia backend (logs visible)
- ✅ All 5 endpoints respond correctly to curl tests
- ✅ SSE connection stays open with ping events
- ✅ Commands broadcast to all connected clients
- ✅ Instructions generate valid markdown
- ✅ Build passes without errors

---

## Dependencies

### Input Dependencies (Ready)
- ✅ Task 1.1: Command manifest types defined
- ✅ Task 1.4: Backend DI wiring (BackendApplicationContribution can be bound)

### Output Dependencies (Unblocked by this task)
- ⬜ Task 1.7: BridgeContribution (frontend will connect to Hub)
- ⬜ Task 1.12: Configure opencode.json with instructions URL

---

## Known Constraints

### C1: Port Hardcoded
- Hub listens on port 3001 (hardcoded)
- External review item #6: add preference/env-var override later (Phase 5.2)

### C2: No Authentication
- Hub endpoints are open (no auth required)
- Acceptable for localhost-only development
- Phase 6 can add token-based auth for remote deployments

### C3: No Stream Interceptor Yet
- POST /commands endpoint exists but stream interceptor not implemented until later
- Commands can be manually POSTed via curl for testing
- Stream interceptor is separate component (TECHSPEC §6.5, not this task)

### C4: No Command Queue Yet
- Commands broadcast immediately (no throttling)
- TECHSPEC §6.7 (command queue) is Phase 2 scope
- MVP assumes reasonable command frequency

---

## References

- **TECHSPEC §6.4**: OpenSpace Hub architecture
- **TECHSPEC §6.2-6.3**: Command registration and BridgeContribution
- **WORKPLAN Task 1.5**: Hub implementation specification
- **Express.js Docs**: [SSE with Express](https://expressjs.com/en/api.html)
- **Theia Backend Contribution**: `@theia/core/lib/node/backend-application`

---

## Deliverables

1. **`extensions/openspace-core/src/node/hub.ts`**: Full Hub implementation
2. **Modified `openspace-core-backend-module.ts`**: Hub binding
3. **Modified `command-manifest.ts`**: HubState type
4. **Result document**: `result-1.5-hub-implementation.md` with:
   - Implementation summary
   - Manual test results (all 5 curl tests)
   - Build verification
   - Known limitations
5. **Build verification**: Evidence that `yarn build` succeeds

---

## Builder Instructions

1. **Read this contract thoroughly**
2. **Review TECHSPEC §6.4**: Hub architecture and endpoint specifications
3. **Implement Hub service**: All 5 endpoints + SSE broadcast + ping interval
4. **Wire into backend module**: Add BackendApplicationContribution binding
5. **Manual testing**: Run all 5 curl tests, document results
6. **Verify build** passes
7. **Document** implementation in result document
8. **Flag** any issues or questions for Oracle

**Important Notes:**
- **Do NOT implement stream interceptor** (separate component, later task)
- **Do NOT implement BridgeContribution** (Task 1.7, frontend)
- **Do NOT implement command queue** (Phase 2 scope)
- **Focus on HTTP + SSE relay only**

**Ready to proceed!**
