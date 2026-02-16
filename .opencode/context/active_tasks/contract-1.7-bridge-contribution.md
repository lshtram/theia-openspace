# Contract: Phase 1 Task 1.7 — BridgeContribution (Frontend)

**Task ID:** 1.7  
**Phase:** Phase 1 (Core Connection + Hub)  
**Agent:** Builder  
**Status:** PENDING  
**Created:** 2026-02-16  
**Dependencies:** 1.5 (Hub implementation), 1.6 (SessionService — needed for state updates)

---

## Objective

Implement the OpenSpaceBridgeContribution — a frontend service that bridges the Theia CommandRegistry with the OpenSpace Hub. On startup, it collects all `openspace.*` commands from CommandRegistry, builds a manifest, and POSTs it to the Hub. It then opens an SSE connection to listen for `AGENT_COMMAND` events from the Hub and dispatches them to CommandRegistry for execution.

---

## Context

### System Architecture (§2.1 from TECHSPEC)

```
┌─────────────────────────────────────────────────────────────┐
│                    Theia Frontend                           │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │         Theia CommandRegistry                    │      │
│  │  (openspace.pane.open, openspace.editor.scroll)  │      │
│  └────────────────────┬─────────────────────────────┘      │
│                       │                                     │
│                       │ Command Discovery                   │
│                       │ Command Execution                   │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────────┐      │
│  │  OpenSpaceBridgeContribution (THIS TASK)        │      │
│  │  • Startup: collect commands → POST manifest     │      │
│  │  • SSE: listen for AGENT_COMMAND events          │      │
│  │  • Dispatch: execute commands via Registry       │      │
│  │  • State: POST pane state updates to Hub         │      │
│  └────────────────────┬─────────────────────────────┘      │
│                       │ HTTP + SSE                          │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────────┐
│              OpenSpace Hub (Backend)                        │
│  ┌────────────────────▼─────────────────────────────┐      │
│  │  POST /openspace/manifest ← manifest             │      │
│  │  GET  /openspace/events   → SSE AGENT_COMMAND    │      │
│  │  POST /openspace/state    ← pane state           │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**BridgeContribution Role:**
1. **Command Discovery** — On startup, scan CommandRegistry for `openspace.*` commands
2. **Manifest Publishing** — Build CommandManifest and POST to Hub
3. **SSE Connection** — Open EventSource to Hub `/events` endpoint
4. **Command Dispatch** — Listen for AGENT_COMMAND events, execute via CommandRegistry
5. **State Publishing** — Send pane/editor state updates to Hub (for system prompt generation)

---

## Requirements

### Functional Requirements

#### FR1: Command Discovery and Manifest Publishing

##### FR1.1: Startup Sequence
**When:** `onStart()` method (FrontendApplicationContribution lifecycle hook)

**Steps:**
1. Wait for CommandRegistry to be ready (inject via DI)
2. Get all command IDs via `commandRegistry.commands`
3. Filter for commands starting with `openspace.`
4. For each command, extract:
   - `id` (string)
   - `label` (from command.label or id)
   - `category` (from command.category if exists)
5. Build `CommandManifest`:
   ```typescript
   {
     version: '1.0',
     commands: [...],
     lastUpdated: new Date().toISOString()
   }
   ```
6. POST manifest to Hub: `http://localhost:3001/openspace/manifest`
7. Log success: `[BridgeContribution] Published manifest: N commands`

##### FR1.2: Manifest Structure
```typescript
interface CommandManifest {
  version: string;
  commands: CommandDefinition[];
  lastUpdated: string;
}

interface CommandDefinition {
  id: string;              // e.g., 'openspace.pane.open'
  name: string;            // e.g., 'Open Pane'
  description: string;     // e.g., 'Open a new pane in the IDE'
  category?: string;       // e.g., 'Pane Management'
  arguments_schema?: CommandArgumentSchema;  // Optional JSON schema
  handler?: string;        // Optional handler name
}
```

**Note:** For MVP (Task 1.7), `arguments_schema` can be omitted. Commands will be registered but schema extraction is deferred to Phase 2.

##### FR1.3: Error Handling
- If Hub is unreachable (ECONNREFUSED), log warning and continue: `[BridgeContribution] Warning: Hub not available, manifest not published`
- If HTTP error (4xx/5xx), log error but don't crash: `[BridgeContribution] Error publishing manifest: ${status}`
- Service must continue to function even if manifest publishing fails

#### FR2: SSE Connection and Agent Command Dispatch

##### FR2.1: SSE Connection Setup
**When:** After manifest publishing completes (in `onStart()`)

**Steps:**
1. Create EventSource: `new EventSource('http://localhost:3001/openspace/events')`
2. Register `message` event listener
3. Register `error` event listener
4. Log connection: `[BridgeContribution] SSE connection established`

##### FR2.2: Event Handling
**Event Format:**
```json
{
  "type": "AGENT_COMMAND",
  "data": {
    "cmd": "openspace.pane.open",
    "args": { "type": "editor", "uri": "file:///path/to/file" }
  }
}
```

**Processing Steps:**
1. Parse event data (JSON.parse)
2. Validate: check `type === 'AGENT_COMMAND'`
3. Extract `cmd` and `args` from `data`
4. Log: `[BridgeContribution] Received command: ${cmd}`
5. Execute: `commandRegistry.executeCommand(cmd, ...args)`
6. Log result: `[BridgeContribution] Command executed: ${cmd}`

##### FR2.3: Error Handling
- **Parse error:** Log and skip: `[BridgeContribution] Invalid event data: ${error}`
- **Command not found:** Log warning: `[BridgeContribution] Unknown command: ${cmd}`
- **Execution error:** Log error but don't crash: `[BridgeContribution] Command execution failed: ${error}`
- **SSE disconnect:** Attempt reconnection (exponential backoff: 1s, 2s, 4s, 8s, max 30s)

##### FR2.4: SSE Reconnection
- On `error` event: log `[BridgeContribution] SSE disconnected, reconnecting...`
- Use exponential backoff (similar to Task 1.3 pattern)
- Max backoff: 30 seconds
- Republish manifest after successful reconnection

#### FR3: Pane State Publishing

##### FR3.1: State Updates (Deferred to Phase 2)
**Note:** For Task 1.7 MVP, pane state publishing is a stub. The method exists but doesn't send real data.

**Stub Implementation:**
```typescript
private publishPaneState(): void {
  console.debug('[BridgeContribution] publishPaneState() called (stub)');
  // TODO: Phase 2 — collect pane state from ApplicationShell
  // TODO: POST to http://localhost:3001/openspace/state
}
```

**Rationale:** Pane state requires PaneService (not yet implemented). Hub accepts state updates but doesn't require them for MVP.

---

## Non-Functional Requirements

### NFR1: Performance
- **P1.1:** Manifest publishing must complete within 5 seconds
- **P1.2:** Command execution latency < 100ms from event receipt to CommandRegistry call
- **P1.3:** SSE reconnection must not block UI thread

### NFR2: Reliability
- **R2.1:** Service must continue functioning if Hub is unavailable (degrade gracefully)
- **R2.2:** SSE reconnection must be automatic and transparent
- **R2.3:** Invalid commands must not crash the service

### NFR3: Observability
- **O3.1:** Log all manifest publishing attempts (INFO level)
- **O3.2:** Log all received agent commands (INFO level)
- **O3.3:** Log all command execution results (DEBUG level)
- **O3.4:** Log all errors (ERROR level)

---

## Interface Definition

### Location
- **File:** `extensions/openspace-core/src/browser/bridge-contribution.ts`
- **Class:** `OpenSpaceBridgeContribution implements FrontendApplicationContribution`

### Full Interface
```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { CommandManifest, CommandDefinition, AgentCommand } from '../common/command-manifest';

@injectable()
export class OpenSpaceBridgeContribution implements FrontendApplicationContribution {
  @inject(CommandRegistry)
  protected readonly commandRegistry: CommandRegistry;

  private eventSource?: EventSource;
  private reconnectAttempts = 0;
  private reconnectTimer?: number;
  private readonly maxReconnectDelay = 30000; // 30 seconds
  private readonly hubBaseUrl = 'http://localhost:3001'; // TODO: make configurable

  /**
   * Called when the frontend application starts.
   * Publishes command manifest and establishes SSE connection.
   */
  async onStart(): Promise<void> {
    console.info('[BridgeContribution] Starting...');
    
    // Publish command manifest
    await this.publishManifest();
    
    // Establish SSE connection
    this.connectSSE();
  }

  /**
   * Called when the frontend application stops.
   * Closes SSE connection.
   */
  onStop(): void {
    console.info('[BridgeContribution] Stopping...');
    this.disconnectSSE();
  }

  /**
   * Collect all openspace.* commands from CommandRegistry and publish to Hub.
   */
  private async publishManifest(): Promise<void> {
    try {
      // Collect commands
      const commands = this.collectCommands();
      console.debug(`[BridgeContribution] Collected ${commands.length} commands`);

      // Build manifest
      const manifest: CommandManifest = {
        version: '1.0',
        commands,
        lastUpdated: new Date().toISOString()
      };

      // POST to Hub
      const response = await fetch(`${this.hubBaseUrl}/openspace/manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.info(`[BridgeContribution] Published manifest: ${commands.length} commands`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
        console.warn('[BridgeContribution] Warning: Hub not available, manifest not published');
      } else {
        console.error('[BridgeContribution] Error publishing manifest:', error);
      }
    }
  }

  /**
   * Collect all openspace.* commands from CommandRegistry.
   */
  private collectCommands(): CommandDefinition[] {
    const commands: CommandDefinition[] = [];
    
    for (const commandId of this.commandRegistry.commands) {
      if (commandId.startsWith('openspace.')) {
        const command = this.commandRegistry.getCommand(commandId);
        if (command) {
          commands.push({
            id: commandId,
            name: command.label || commandId,
            description: command.label || commandId, // TODO: improve description
            category: command.category
          });
        }
      }
    }
    
    return commands;
  }

  /**
   * Establish SSE connection to Hub.
   */
  private connectSSE(): void {
    console.info('[BridgeContribution] Connecting to Hub SSE...');
    
    this.eventSource = new EventSource(`${this.hubBaseUrl}/openspace/events`);
    
    this.eventSource.onopen = () => {
      console.info('[BridgeContribution] SSE connection established');
      this.reconnectAttempts = 0; // Reset reconnect counter
    };
    
    this.eventSource.onmessage = (event: MessageEvent) => {
      this.handleSSEEvent(event);
    };
    
    this.eventSource.onerror = () => {
      console.warn('[BridgeContribution] SSE disconnected, reconnecting...');
      this.reconnectSSE();
    };
  }

  /**
   * Handle incoming SSE events.
   */
  private handleSSEEvent(event: MessageEvent): void {
    try {
      const parsedEvent = JSON.parse(event.data);
      
      if (parsedEvent.type === 'AGENT_COMMAND') {
        const agentCommand: AgentCommand = parsedEvent.data;
        console.info(`[BridgeContribution] Received command: ${agentCommand.cmd}`);
        
        // Execute command via CommandRegistry
        this.executeCommand(agentCommand);
      } else if (parsedEvent.type === 'ping') {
        // Ignore keepalive pings
        console.debug('[BridgeContribution] Received ping');
      } else {
        console.warn(`[BridgeContribution] Unknown event type: ${parsedEvent.type}`);
      }
    } catch (error: any) {
      console.error('[BridgeContribution] Invalid event data:', error);
    }
  }

  /**
   * Execute agent command via CommandRegistry.
   */
  private async executeCommand(agentCommand: AgentCommand): Promise<void> {
    try {
      const { cmd, args } = agentCommand;
      
      // Check if command exists
      if (!this.commandRegistry.getCommand(cmd)) {
        console.warn(`[BridgeContribution] Unknown command: ${cmd}`);
        return;
      }
      
      // Execute command
      const argsArray = args ? (Array.isArray(args) ? args : [args]) : [];
      await this.commandRegistry.executeCommand(cmd, ...argsArray);
      
      console.debug(`[BridgeContribution] Command executed: ${cmd}`);
    } catch (error: any) {
      console.error(`[BridgeContribution] Command execution failed:`, error);
    }
  }

  /**
   * Disconnect SSE connection.
   */
  private disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
      console.debug('[BridgeContribution] SSE connection closed');
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Reconnect SSE with exponential backoff.
   */
  private reconnectSSE(): void {
    this.disconnectSSE();
    
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    console.debug(`[BridgeContribution] Reconnecting in ${delay}ms...`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connectSSE();
    }, delay);
  }

  /**
   * Publish pane state to Hub (stub for MVP).
   */
  private publishPaneState(): void {
    console.debug('[BridgeContribution] publishPaneState() called (stub)');
    // TODO: Phase 2 — collect pane state and POST to Hub
  }
}
```

---

## Dependencies

### Required Imports
```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { CommandManifest, CommandDefinition, AgentCommand } from '../common/command-manifest';
```

### Required Services (via DI)
- `CommandRegistry` — Theia's command registry (already available in frontend)

### Browser APIs
- `fetch` — for HTTP POST to Hub
- `EventSource` — for SSE connection
- `window.setTimeout` / `window.clearTimeout` — for reconnection logic

---

## Implementation Constraints

### IC1: No Hub Dependency
- BridgeContribution MUST function even if Hub is unavailable
- Failed manifest publishing must not prevent Theia from starting
- SSE connection failures must not crash the service

### IC2: No Blocking Operations
- All HTTP requests must be async (use `fetch` with await)
- SSE reconnection must use timers (don't block main thread)
- Command execution must be async

### IC3: Graceful Degradation
- If CommandRegistry has no `openspace.*` commands, publish empty manifest
- If Hub returns error, log and continue
- If command execution fails, log and continue (don't block subsequent commands)

### IC4: URL Configuration (Deferred)
- For Task 1.7 MVP, Hub URL is hardcoded: `http://localhost:3001`
- TODO: Phase 5.2 — make configurable via preferences

---

## Acceptance Criteria

### AC1: Manifest Publishing ✅
- **Given:** Theia starts with no `openspace.*` commands registered
- **When:** `onStart()` is called
- **Then:** 
  - Manifest is POSTed to Hub with empty commands array
  - Log message: "Published manifest: 0 commands"
  - No errors thrown

### AC2: Command Discovery ✅
- **Given:** Theia has 3 commands registered: `openspace.pane.open`, `openspace.editor.scroll`, `file.save`
- **When:** `collectCommands()` is called
- **Then:**
  - Returns array with 2 items (only `openspace.*` commands)
  - Each item has `id`, `name`, `description`, `category` (if exists)

### AC3: SSE Connection ✅
- **Given:** Hub is running on localhost:3001
- **When:** `connectSSE()` is called
- **Then:**
  - EventSource created successfully
  - Log message: "SSE connection established"
  - No errors thrown

### AC4: Agent Command Execution ✅
- **Given:** SSE connection is active
- **When:** Hub sends AGENT_COMMAND event:
  ```json
  {
    "type": "AGENT_COMMAND",
    "data": { "cmd": "openspace.pane.open", "args": {} }
  }
  ```
- **Then:**
  - Event is parsed successfully
  - Command is executed via `commandRegistry.executeCommand()`
  - Log message: "Received command: openspace.pane.open"
  - Log message: "Command executed: openspace.pane.open"

### AC5: Error Handling — Hub Unavailable ✅
- **Given:** Hub is NOT running
- **When:** `onStart()` is called
- **Then:**
  - Warning logged: "Hub not available, manifest not published"
  - Service continues to function
  - No errors thrown

### AC6: Error Handling — Unknown Command ✅
- **Given:** Hub sends command `openspace.unknown.command`
- **When:** Command is received via SSE
- **Then:**
  - Warning logged: "Unknown command: openspace.unknown.command"
  - Command is not executed
  - Service continues to function

### AC7: SSE Reconnection ✅
- **Given:** SSE connection is active
- **When:** Hub server restarts (connection drops)
- **Then:**
  - Error logged: "SSE disconnected, reconnecting..."
  - Reconnection attempted after 1 second
  - Second attempt after 2 seconds (exponential backoff)
  - Max delay: 30 seconds

### AC8: Build Verification ✅
- **Given:** Implementation is complete
- **When:** `npm run build` is executed in `extensions/openspace-core`
- **Then:**
  - TypeScript compilation succeeds
  - No type errors
  - Generated files exist: `lib/browser/bridge-contribution.js`, `.d.ts`

---

## Testing Strategy

### Manual Testing (Task 1.7 Validation)

1. **Test 1: Startup with Hub running**
   - Start Hub: `cd extensions/openspace-core && npm run build && node lib/node/hub.js` (or via Theia backend)
   - Start Theia
   - Check browser console: "Published manifest: N commands"
   - Check Hub logs: Manifest received

2. **Test 2: Startup with Hub NOT running**
   - Stop Hub
   - Start Theia
   - Check browser console: "Hub not available, manifest not published"
   - Verify Theia still starts successfully

3. **Test 3: Agent command execution**
   - Start Hub and Theia
   - Use curl to send command to Hub:
     ```bash
     curl -X POST http://localhost:3001/openspace/commands \
       -H "Content-Type: application/json" \
       -d '{"cmd":"openspace.test.command","args":{}}'
     ```
   - Check browser console: "Received command: openspace.test.command"

4. **Test 4: SSE reconnection**
   - Start Hub and Theia
   - Stop Hub
   - Check browser console: "SSE disconnected, reconnecting..."
   - Restart Hub
   - Verify reconnection: "SSE connection established"

### Unit Tests (Deferred to Task 1.13)
- Mock CommandRegistry with fake commands
- Mock fetch to simulate Hub responses
- Mock EventSource to simulate SSE events
- Test each method in isolation

---

## Out of Scope

### Explicitly NOT included in Task 1.7:
1. **Pane State Publishing** — Stub only, full implementation in Phase 2
2. **Command Argument Schemas** — Deferred to Phase 2 (manifest accepts but doesn't require)
3. **Command Result Reporting** — Deferred to Phase 2 (no feedback to Hub about execution results)
4. **Command Queue** — Commands execute immediately, no queuing
5. **Permission Handling** — Task 1.14 (commands execute without permission checks for now)
6. **Hub URL Configuration** — Hardcoded, Phase 5.2 will add preferences
7. **PaneService Integration** — Task 1.9/Phase 2

---

## Success Criteria

### Definition of Done
- ✅ `bridge-contribution.ts` file created with OpenSpaceBridgeContribution class
- ✅ Implements FrontendApplicationContribution interface
- ✅ `onStart()` publishes manifest and connects SSE
- ✅ `onStop()` disconnects SSE cleanly
- ✅ Command discovery filters for `openspace.*` commands
- ✅ Agent commands are executed via CommandRegistry
- ✅ SSE reconnection with exponential backoff
- ✅ Error handling for all failure scenarios
- ✅ TypeScript compilation passes (`npm run build`)
- ✅ Logging at INFO, DEBUG, WARN, ERROR levels
- ✅ Implementation documented in `result-1.7-bridge-contribution.md`

### Quality Gates
- **Code Quality:** Follows NSO coding standards
- **Type Safety:** No `any` types (except in error handling)
- **Error Handling:** All async operations have try/catch
- **Memory Safety:** EventSource properly closed, timers cleared
- **Observability:** All operations logged with context

---

## Notes for Builder

### Implementation Order
1. **Read contract thoroughly** (this file)
2. **Review command-manifest.ts** — understand interfaces
3. **Create bridge-contribution.ts skeleton** — class, imports, DI decorators
4. **Implement onStart()** — manifest publishing + SSE connection
5. **Implement collectCommands()** — filter CommandRegistry
6. **Implement publishManifest()** — build manifest, POST to Hub
7. **Implement connectSSE()** — EventSource setup
8. **Implement handleSSEEvent()** — parse events
9. **Implement executeCommand()** — call CommandRegistry
10. **Implement reconnectSSE()** — exponential backoff
11. **Implement onStop()** — cleanup
12. **Add error handling** — try/catch blocks, logging
13. **Build verification** — `npm run build`
14. **Create result.md** — document implementation

### Key Challenges
1. **Command Discovery:** CommandRegistry.commands returns iterator, not array
2. **SSE Reconnection:** Must clear timers and close old EventSource before reconnecting
3. **Error Handling:** Must handle Hub unavailable, invalid events, unknown commands
4. **Async Coordination:** onStart() must complete manifest publishing before SSE connection

### Testing During Development
- Start Hub separately (or stub it with a simple Express server)
- Use browser console to inspect logs
- Use curl to manually send commands to Hub
- Test with Hub running and not running

---

## Related Documents

- **TECHSPEC §2.1** — BridgeContribution architecture
- **TECHSPEC §2.1.2** — Automatic discovery mechanism
- **WORKPLAN Task 1.7** — High-level task description
- **command-manifest.ts** — Interface definitions
- **Task 1.5 Result** — Hub implementation (manifest and SSE endpoints)

---

**Contract Status:** READY FOR IMPLEMENTATION  
**Next Step:** Delegate to Builder agent for implementation
