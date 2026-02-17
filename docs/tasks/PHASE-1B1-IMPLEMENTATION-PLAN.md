# Phase 1B1 Implementation Plan: Architecture C → B1 Refactoring

**Author:** analyst_{{agent_id}}  
**Date:** 2026-02-17  
**Status:** DRAFT  
**Duration Estimate:** 1 session (focused)  
**Prerequisites:** Phase 1 complete (tasks 1.1–1.15 all ✅)

---

## Overview

### The Problem
Current implementation (Phase 1) follows **Architecture C** (parallel system — ignores Theia AI, uses Hub SSE relay for agent commands), but the TECHSPEC describes **Architecture B1** (hybrid — ChatAgent registered in Theia AI, custom ChatWidget, agent commands via RPC callback).

### The Solution
Refactor 6 files across 8 tasks to align code with TECHSPEC Architecture B1:
1. Wire `ChatAgent` to `SessionService` (not echo)
2. Add `onAgentCommand` RPC callback to `OpenCodeClient`
3. Integrate stream interceptor into `OpenCodeProxy`
4. Extend `SyncService` to dispatch agent commands to `CommandRegistry`
5. Simplify Hub (remove `/commands`, `/events`, SSE client management)
6. Simplify BridgeContribution (remove SSE listener)
7. Fix Hub URL prefix mismatch
8. Integration verification

### Key Architectural Changes

| Aspect | Before (Architecture C) | After (Architecture B1) |
|--------|-------------------------|-------------------------|
| **ChatAgent** | Echo stub | Delegates to SessionService |
| **Agent commands** | Hub SSE relay (5 hops: interceptor → POST /commands → Hub → SSE /events → BridgeContribution → CommandRegistry) | RPC callback (3 hops: interceptor → RPC onAgentCommand → SyncService → CommandRegistry) |
| **Stream interceptor** | Separate file, posts to Hub | Integrated in OpenCodeProxy, dispatches via RPC |
| **Hub endpoints** | 5 (manifest, state, instructions, commands, events) | 3 (manifest, state, instructions) |
| **BridgeContribution** | Manifest + SSE listener + command dispatch | Manifest + pane state only |
| **SyncService** | SSE event forwarding only | SSE events + agent command dispatch + command queue |

---

## Current State Analysis

### What Works (Keep — No Changes)

| Component | File | Status |
|-----------|------|--------|
| **OpenCodeProxy REST API methods** | `openspace-core/src/node/opencode-proxy.ts` | ✅ All 23 methods working |
| **OpenCodeProxy SSE forwarding** | Same file | ✅ Events forwarded to frontend |
| **SessionService** | `openspace-core/src/browser/session-service.ts` | ✅ State management working |
| **ChatWidget** | `openspace-chat/src/browser/chat-widget.tsx` | ✅ Uses SessionService directly |
| **Hub manifest storage** | `openspace-core/src/node/hub.ts` | ✅ Receives and caches manifest |
| **Hub instructions generation** | Same file | ✅ `GET /openspace/instructions` working |
| **BridgeContribution manifest publishing** | `openspace-core/src/browser/bridge-contribution.ts` | ✅ Collects and posts manifest |

### What Changes (Refactor — 6 Files)

| # | Component | File | Lines Changed | What Changes |
|---|-----------|------|---------------|--------------|
| **1** | ChatAgent | `openspace-chat/src/browser/chat-agent.ts` | ~30 lines | Replace echo logic with SessionService delegation |
| **2** | OpenCodeClient RPC interface | `openspace-core/src/common/opencode-protocol.ts` | ~4 lines | Add `onAgentCommand(command: AgentCommand): void` |
| **3** | OpenCodeProxy | `openspace-core/src/node/opencode-proxy.ts` | ~150 lines | Add stream interceptor logic (scan for `%%OS{...}%%`, strip, dispatch via RPC callback) |
| **4** | SyncService | `openspace-core/src/browser/opencode-sync-service.ts` | ~60 lines | Add `onAgentCommand()` method, inject CommandRegistry, implement command queue |
| **5** | Hub | `openspace-core/src/node/hub.ts` | ~50 lines removed | Remove `/commands`, `/events`, SSE client management, ping interval |
| **6** | BridgeContribution | `openspace-core/src/browser/bridge-contribution.ts` | ~40 lines removed | Remove SSE connection, event handling, command dispatch |

### What's Removed (Delete — With Justification)

| Component | Location | Reason for Removal |
|-----------|----------|-------------------|
| **Hub `/commands` endpoint** | `hub.ts:127-161` | Agent commands now travel via RPC, not HTTP POST |
| **Hub `/events` SSE endpoint** | `hub.ts:189-213` | No SSE relay needed — RPC callback is direct |
| **Hub SSE client set** | `hub.ts:44-45, 198-213, 296-333` | No clients to manage |
| **Hub SSE ping interval** | `hub.ts:45, 67, 315-319` | No SSE connections to keep alive |
| **BridgeContribution SSE connection** | `bridge-contribution.ts:48-51, 163-181` | Commands arrive via SyncService RPC callback |
| **BridgeContribution SSE event handler** | `bridge-contribution.ts:206-225` | No SSE events to handle |
| **BridgeContribution command executor** | `bridge-contribution.ts:241-260` | SyncService handles command dispatch |
| **BridgeContribution reconnect logic** | `bridge-contribution.ts:274-324` | No SSE to reconnect |

---

## Task Breakdown (8 Tasks)

### Task 1B1.1: Wire ChatAgent to SessionService

**File:** `extensions/openspace-chat/src/browser/chat-agent.ts`

**Current State:**
- Lines 19-34: `invoke()` method echoes user input
- No SessionService injection
- No streaming support

**Target State:**
- `SessionService` injected via `@inject`
- `invoke()` extracts text from `request.request?.text`
- Calls `this.sessionService.sendMessage(parts)`
- Subscribes to `this.sessionService.onMessageStreaming` to push deltas into `request.response.response.addContent()`
- Completes response with `request.response.complete()` when streaming done

**Changes Required:**
```typescript
// Add injection
@inject(SessionService)
private sessionService: SessionService;

// Replace invoke() body (lines 19-34)
async invoke(request: MutableChatRequestModel): Promise<void> {
  // Extract text
  let userMessage = request.request?.text || '';
  userMessage = userMessage.replace(/^@\w+\s*/i, '').trim();
  
  // Send via SessionService
  const parts: MessagePart[] = [{ type: 'text', text: userMessage }];
  await this.sessionService.sendMessage(parts);
  
  // Subscribe to streaming updates
  const disposable = this.sessionService.onMessageStreaming(update => {
    request.response.response.addContent(new TextChatResponseContentImpl(update.delta));
    if (update.isDone) {
      request.response.complete();
      disposable.dispose();
    }
  });
}
```

**Files to Modify:**
- `extensions/openspace-chat/src/browser/chat-agent.ts` (30 lines)

**Dependencies:** None (SessionService already exists)

**Testing:**
- Type `@Openspace hello` in Theia's built-in chat panel
- Verify message sent to opencode server
- Verify response streams back into Theia chat UI

**Risks:** 
- SessionService event signature mismatch (check `onMessageStreaming` event type)
- Need to import `MessagePart` from `opencode-protocol.ts`

---

### Task 1B1.2: Add `onAgentCommand` to OpenCodeClient RPC Interface

**File:** `extensions/openspace-core/src/common/opencode-protocol.ts`

**Current State:**
- Lines 209-214: `OpenCodeClient` interface has 4 callback methods
- No `onAgentCommand` method

**Target State:**
- Add `onAgentCommand(command: AgentCommand): void;` to interface (line ~215)

**Changes Required:**
```typescript
// In OpenCodeClient interface (after line 214)
export interface OpenCodeClient {
    onSessionEvent(event: SessionNotification): void;
    onMessageEvent(event: MessageNotification): void;
    onFileEvent(event: FileNotification): void;
    onPermissionEvent(event: PermissionNotification): void;
    onAgentCommand(command: AgentCommand): void; // ADD THIS
}
```

**Also Need:**
- Import `AgentCommand` from `command-manifest.ts` (line ~21)

**Files to Modify:**
- `extensions/openspace-core/src/common/opencode-protocol.ts` (4 lines)

**Dependencies:** None (AgentCommand type already exists)

**Testing:**
- Build passes (TypeScript compilation)
- No runtime errors on startup

**Risks:** None (pure type change)

---

### Task 1B1.3: Integrate Stream Interceptor into OpenCodeProxy

**File:** `extensions/openspace-core/src/node/opencode-proxy.ts`

**Current State:**
- Lines 72-80: SSE connection state variables exist
- No stream interceptor logic
- `forwardMessageEvent()` method likely exists (need to find it in lines 250+)

**Target State:**
- Add `interceptStream(parts: MessagePart[]): { cleanParts: MessagePart[], commands: AgentCommand[] }` method
- Modify message event forwarding to call interceptor before sending to client
- Dispatch extracted commands via `this._client?.onAgentCommand(command)`

**Interceptor Logic (State Machine):**
```typescript
private interceptStream(parts: MessagePart[]): { cleanParts: MessagePart[], commands: AgentCommand[] } {
  const commands: AgentCommand[] = [];
  const cleanParts: MessagePart[] = [];
  
  for (const part of parts) {
    if (part.type !== 'text') {
      cleanParts.push(part);
      continue;
    }
    
    // Extract %%OS{...}%% blocks from text
    const textPart = part as TextMessagePart;
    const regex = /%%OS(\{[^}]*\})%%/g;
    let cleanText = textPart.text;
    let match;
    
    while ((match = regex.exec(textPart.text)) !== null) {
      try {
        const command = JSON.parse(match[1]) as AgentCommand;
        commands.push(command);
        // Strip from visible text
        cleanText = cleanText.replace(match[0], '');
      } catch (error) {
        this.logger.warn(`[Interceptor] Malformed JSON in block: ${match[1]}`, error);
        // Discard malformed block (don't show to user)
        cleanText = cleanText.replace(match[0], '');
      }
    }
    
    // Add cleaned text part
    if (cleanText) {
      cleanParts.push({ type: 'text', text: cleanText });
    }
  }
  
  return { cleanParts, commands };
}
```

**Where to Call:**
- Find message event forwarding method (likely around lines 400-500)
- Before calling `this._client?.onMessageEvent(event)`, intercept parts
- Dispatch extracted commands via `this._client?.onAgentCommand(command)`

**Files to Modify:**
- `extensions/openspace-core/src/node/opencode-proxy.ts` (~150 lines)

**Dependencies:** Task 1B1.2 (onAgentCommand interface exists)

**Testing (8 Test Cases from TECHSPEC §6.5.1):**
1. Basic extraction: `text %%OS{"cmd":"x","args":{}}%% more` → command dispatched, user sees `text  more`
2. Mid-sentence: `Let me %%OS{"cmd":"x"}%% do that` → command stripped
3. Multiple blocks: two commands in one message → both dispatched
4. Split across chunks: NOT APPLICABLE in Phase 1B1 (single event chunks only)
5. Nested braces: `%%OS{"cmd":"x","args":{"name":"foo{bar}"}}%%` → handles correctly
6. Malformed JSON: `%%OS{"cmd":"x"` → warning logged, block discarded
7. Timeout guard: DEFERRED to Phase 3 (stateful parser needed)
8. Empty args: `%%OS{"cmd":"x","args":{}}%%` → valid

**Risks:**
- **High:** Regex-based parser is simple but fragile (doesn't handle chunk boundaries or nested braces perfectly)
- **Mitigation:** Phase 1B1 uses regex for speed. Phase 3 task 3.6 will harden with stateful parser
- **Fallback:** Malformed blocks are discarded with warning (graceful degradation)

---

### Task 1B1.4: Extend SyncService to Dispatch Agent Commands

**File:** `extensions/openspace-core/src/browser/opencode-sync-service.ts`

**Current State:**
- Lines 69-92: Service implements `OpenCodeClient` with 4 callback methods
- No `CommandRegistry` injection
- No `onAgentCommand` method

**Target State:**
- Inject `CommandRegistry` via `@inject`
- Implement `onAgentCommand(command: AgentCommand): void` method
- Add sequential command queue (TECHSPEC §6.7):
  - Queue commands to prevent race conditions
  - 50ms inter-command delay
  - Max depth 50 (warn if exceeded)
  - Execute via `commandRegistry.executeCommand(command.cmd, command.args)`

**Changes Required:**

```typescript
// Add injection (after line 78)
@inject(CommandRegistry)
private commandRegistry: CommandRegistry;

// Add queue state (after line 98)
private commandQueue: AgentCommand[] = [];
private isProcessingQueue = false;

// Implement onAgentCommand (after line 405)
onAgentCommand(command: AgentCommand): void {
  try {
    console.debug(`[SyncService] Agent command received: ${command.cmd}`);
    
    // Add to queue
    this.commandQueue.push(command);
    
    // Warn if queue depth exceeds limit
    if (this.commandQueue.length > 50) {
      console.warn(`[SyncService] Command queue depth exceeded 50: ${this.commandQueue.length}`);
    }
    
    // Start processing if not already running
    if (!this.isProcessingQueue) {
      this.processCommandQueue();
    }
  } catch (error) {
    console.error('[SyncService] Error in onAgentCommand:', error);
    // Never throw from RPC callback
  }
}

// Process queue sequentially (new method)
private async processCommandQueue(): Promise<void> {
  this.isProcessingQueue = true;
  
  while (this.commandQueue.length > 0) {
    const command = this.commandQueue.shift()!;
    
    try {
      // Check if command exists
      if (!this.commandRegistry.getCommand(command.cmd)) {
        console.warn(`[SyncService] Unknown command: ${command.cmd}`);
        continue;
      }
      
      // Execute command
      const argsArray = command.args ? (Array.isArray(command.args) ? command.args : [command.args]) : [];
      await this.commandRegistry.executeCommand(command.cmd, ...argsArray);
      
      console.debug(`[SyncService] Command executed: ${command.cmd}`);
      
      // 50ms delay between commands
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`[SyncService] Command execution failed: ${command.cmd}`, error);
      // Continue with next command (don't block queue)
    }
  }
  
  this.isProcessingQueue = false;
}
```

**Files to Modify:**
- `extensions/openspace-core/src/browser/opencode-sync-service.ts` (~60 lines added)

**Also Need:**
- Import `CommandRegistry` from `@theia/core/lib/common/command`
- Import `AgentCommand` from `../common/command-manifest`

**Dependencies:** 
- Task 1B1.2 (onAgentCommand in interface)
- Task 1B1.3 (OpenCodeProxy dispatches commands)

**Testing:**
- Multiple rapid commands → execute sequentially with 50ms delay
- Unknown command → warning logged, skipped
- Command execution error → logged, queue continues

**Risks:**
- CommandRegistry injection might fail if not bound (check frontend module)
- Need to verify SessionService circular DI doesn't break with CommandRegistry addition

---

### Task 1B1.5: Simplify Hub (Remove /commands, /events, SSE)

**File:** `extensions/openspace-core/src/node/hub.ts`

**Current State:**
- Lines 44-45: `sseClients` Set and `pingInterval` timer
- Lines 57-58: `POST /commands` endpoint registration
- Lines 64: `GET /events` endpoint registration
- Lines 67: `startPingInterval()` call
- Lines 75-79: `onStop()` cleanup with `closeAllSSEConnections()`
- Lines 126-161: `handleCommands()` method
- Lines 188-213: `handleEvents()` SSE endpoint handler
- Lines 296-310: `broadcastSSE()` method
- Lines 315-319: `startPingInterval()` method
- Lines 324-333: `closeAllSSEConnections()` method

**Target State:**
- Only 3 endpoints: `POST /manifest`, `POST /state`, `GET /openspace/instructions`
- No SSE client management
- No command relay
- Simplified `onStop()` (no SSE cleanup)

**Lines to Delete:**
1. Line 44: `private sseClients: Set<Response> = new Set();`
2. Line 45: `private pingInterval: NodeJS.Timeout | undefined;`
3. Lines 57-58: `/commands` route registration
4. Line 64: `/events` route registration
5. Line 67: `startPingInterval()` call
6. Lines 77-79: SSE cleanup in `onStop()`
7. Lines 126-161: `handleCommands()` method (entire method)
8. Lines 188-213: `handleEvents()` method (entire method)
9. Lines 296-310: `broadcastSSE()` method (entire method)
10. Lines 315-319: `startPingInterval()` method (entire method)
11. Lines 324-333: `closeAllSSEConnections()` method (entire method)

**New `onStop()` (replace lines 75-81):**
```typescript
onStop(): void {
    // Hub is stateless cache — no cleanup needed
    this.logger.info('[Hub] OpenSpace Hub stopped');
}
```

**Files to Modify:**
- `extensions/openspace-core/src/node/hub.ts` (~90 lines removed, file shrinks to ~200 lines)

**Dependencies:** None (independent of other tasks)

**Testing:**
- Hub starts without errors
- `POST /openspace/manifest` still works
- `POST /openspace/state` still works
- `GET /openspace/instructions` still works
- `POST /commands` returns 404 (expected)
- `GET /events` returns 404 (expected)

**Risks:** None (pure deletion)

---

### Task 1B1.6: Simplify BridgeContribution (Remove SSE Listener)

**File:** `extensions/openspace-core/src/browser/bridge-contribution.ts`

**Current State:**
- Lines 48-51: EventSource and reconnection state variables
- Lines 52: `hubBaseUrl` constant (keep — still needed for manifest POST)
- Lines 65: `connectSSE()` call in `onStart()`
- Lines 73-75: `disconnectSSE()` call in `onStop()`
- Lines 163-181: `connectSSE()` method (entire method)
- Lines 206-225: `handleSSEEvent()` method (entire method)
- Lines 241-260: `executeCommand()` method (entire method — now handled by SyncService)
- Lines 274-285: `disconnectSSE()` method (entire method)
- Lines 310-324: `reconnectSSE()` method (entire method)

**Target State:**
- Only publishes manifest (keep `publishManifest()`)
- Future: will publish pane state (Phase 3.10)
- No SSE connection
- No command dispatch

**Lines to Delete:**
1. Lines 48-51: EventSource, reconnect state variables
2. Line 65: `connectSSE()` call
3. Lines 73-75: `disconnectSSE()` call
4. Lines 163-181: `connectSSE()` method
5. Lines 206-225: `handleSSEEvent()` method
6. Lines 241-260: `executeCommand()` method
7. Lines 274-285: `disconnectSSE()` method
8. Lines 310-324: `reconnectSSE()` method

**New `onStart()` (replace lines 58-66):**
```typescript
async onStart(): Promise<void> {
    console.info('[BridgeContribution] Starting...');
    
    // Publish command manifest
    await this.publishManifest();
    
    // NOTE: Pane state publishing deferred to Phase 3.10
}
```

**New `onStop()` (replace lines 72-75):**
```typescript
onStop(): void {
    console.info('[BridgeContribution] Stopping...');
    // No resources to clean up
}
```

**Files to Modify:**
- `extensions/openspace-core/src/browser/bridge-contribution.ts` (~110 lines removed, file shrinks to ~150 lines)

**Dependencies:** Task 1B1.4 (SyncService handles command dispatch)

**Testing:**
- BridgeContribution starts without errors
- Manifest published on startup
- No SSE connection attempts in console
- No SSE reconnection logs

**Risks:** None (pure deletion)

---

### Task 1B1.7: Fix Hub URL Prefix Mismatch

**Files:**
- `extensions/openspace-core/src/node/hub.ts` (lines 52-65)
- `extensions/openspace-core/src/browser/bridge-contribution.ts` (lines 99, 52)

**Current State:**
- **Hub routes** (hub.ts:52-65): `/manifest`, `/openspace/instructions`, `/commands`, `/state`, `/events` (mixed prefixes)
- **BridgeContribution URLs** (bridge-contribution.ts:99): `http://localhost:3001/openspace/manifest`
- **Mismatch:** BridgeContribution POSTs to `/openspace/manifest` but Hub expects `/manifest` → 404 error

**Target State:**
- **Hub routes:** All use `/openspace/` prefix: `/openspace/manifest`, `/openspace/instructions`, `/openspace/state`
- **BridgeContribution URLs:** Match Hub routes exactly
- **Port:** BridgeContribution should use Theia backend port (not hardcoded 3001)

**Changes Required:**

**hub.ts (lines 52-61) — Add `/openspace/` prefix:**
```typescript
configure(app: Application): void {
    // POST /openspace/manifest - Receive command manifest from frontend
    app.post('/openspace/manifest', (req, res) => this.handleManifest(req, res));

    // GET /openspace/instructions - Generate system prompt
    app.get('/openspace/instructions', (req, res) => this.handleInstructions(req, res));

    // POST /openspace/state - Receive IDE state updates from frontend
    app.post('/openspace/state', (req, res) => this.handleState(req, res));

    this.logger.info('[Hub] OpenSpace Hub configured');
}
```

**bridge-contribution.ts (lines 52, 99) — Fix port and verify prefix:**
```typescript
// Line 52: Replace hardcoded port with dynamic backend URL
private readonly hubBaseUrl = window.location.origin; // Uses same port as Theia backend

// Line 99: Verify full URL (already correct if Hub routes fixed)
const response = await fetch(`${this.hubBaseUrl}/openspace/manifest`, {
```

**Files to Modify:**
- `extensions/openspace-core/src/node/hub.ts` (3 route registrations)
- `extensions/openspace-core/src/browser/bridge-contribution.ts` (1 URL constant)

**Dependencies:** None (independent fix)

**Testing:**
- BridgeContribution successfully POSTs manifest on startup (no 404)
- Console logs: `[BridgeContribution] Published manifest: N commands`
- Hub logs: `[Hub] Manifest updated: N commands registered`

**Risks:**
- `window.location.origin` might not work in Electron (need to test)
- **Mitigation:** If Electron fails, use `http://localhost:${backendPort}` with injected port config

---

### Task 1B1.8: Architecture B1 Integration Verification

**Goal:** End-to-end verification that all Architecture B1 changes work together.

**Verification Steps:**

#### 1. Build Verification
```bash
cd /Users/Shared/dev/theia-openspace
yarn build
# Expected: Zero errors, all 6 extensions compile
```

#### 2. Startup Verification
```bash
yarn start:browser
# Expected: Theia opens at http://localhost:3000
# Check console for:
# - "[Hub] OpenSpace Hub configured"
# - "[BridgeContribution] Published manifest: N commands"
# - "[Hub] Manifest updated: N commands registered"
# - No SSE connection logs from BridgeContribution
# - No "/commands" or "/events" route registration logs
```

#### 3. ChatAgent Delegation Test
```
1. Open Theia built-in chat panel
2. Type: @Openspace hello, can you help me?
3. Expected: 
   - Message sent to opencode server (check SyncService logs)
   - Response streams back into Theia chat UI
   - NOT echo response
```

#### 4. Hub Endpoints Test
```bash
# Test manifest endpoint (should work)
curl -X POST http://localhost:3000/openspace/manifest \
  -H "Content-Type: application/json" \
  -d '{"commands":[],"timestamp":"2026-02-17T12:00:00Z"}'
# Expected: 200 OK

# Test state endpoint (should work)
curl -X POST http://localhost:3000/openspace/state \
  -H "Content-Type: application/json" \
  -d '{"panes":[],"timestamp":"2026-02-17T12:00:00Z"}'
# Expected: 200 OK

# Test instructions endpoint (should work)
curl http://localhost:3000/openspace/instructions
# Expected: 200 OK with system prompt text

# Test commands endpoint (should NOT exist)
curl -X POST http://localhost:3000/openspace/commands -d '{}'
# Expected: 404 Not Found

# Test events endpoint (should NOT exist)
curl http://localhost:3000/openspace/events
# Expected: 404 Not Found
```

#### 5. RPC Callback Path Test (Manual)
Since stream interceptor won't be triggered without a real agent response containing `%%OS{...}%%`, this test verifies the plumbing is in place:

```
1. Add debug log in SyncService.onAgentCommand() (temporary):
   console.log('[TEST] onAgentCommand called with:', command);
   
2. Add test call in OpenCodeProxy (temporary, after SSE connect):
   this._client?.onAgentCommand({ cmd: 'test.command', args: {} });
   
3. Start Theia, check console for:
   - "[TEST] onAgentCommand called with: {cmd: 'test.command', args: {}}"
   - Proves RPC callback path works
   
4. Remove test code
```

#### 6. Phase 1.13 Regression Test
Re-run the Phase 1 integration test to verify no regressions:
- Start Theia → connect to opencode server
- Create session → send message → receive streamed response
- Verify message appears in custom ChatWidget
- Verify permission dialog still works (if opencode requests permission)

**Exit Criteria:**
- ✅ All 6 build tests pass
- ✅ All startup logs correct (no SSE, Hub simplified)
- ✅ ChatAgent delegates to SessionService (not echo)
- ✅ Hub endpoints return correct status codes (3 work, 2 return 404)
- ✅ RPC callback path verified
- ✅ Phase 1.13 regression test passes

**Files to Modify:** None (verification only)

**Dependencies:** Tasks 1B1.1–1B1.7 complete

**Risks:**
- Integration failures may require debugging across multiple components
- **Mitigation:** Verify each component individually before full integration test

---

## Critical Path

**Sequential Execution Required:**
```
1B1.2 (RPC interface)
  ↓
1B1.3 (Stream interceptor) ← depends on 1B1.2
  ↓
1B1.4 (SyncService dispatch) ← depends on 1B1.2, 1B1.3
  ↓
1B1.6 (BridgeContribution simplify) ← depends on 1B1.4
  ↓
1B1.8 (Integration verification) ← depends on all above

Parallel Execution Allowed:
- 1B1.1 (ChatAgent) can run anytime
- 1B1.5 (Hub simplify) can run anytime
- 1B1.7 (URL fix) can run anytime
```

**Recommended Execution Order:**
1. **1B1.2** (RPC interface) — 5 min — Foundation for all other tasks
2. **1B1.7** (URL fix) — 5 min — Quick win, fixes manifest publishing
3. **1B1.1** (ChatAgent) — 15 min — Independent, testable immediately
4. **1B1.5** (Hub simplify) — 10 min — Pure deletion, low risk
5. **1B1.3** (Stream interceptor) — 30 min — Complex, needs careful implementation
6. **1B1.4** (SyncService dispatch) — 20 min — Depends on 1B1.2, 1B1.3
7. **1B1.6** (BridgeContribution simplify) — 10 min — Depends on 1B1.4
8. **1B1.8** (Integration verification) — 20 min — Full system test

**Total Estimated Time:** ~2 hours (focused session)

---

## Testing Strategy

### Per-Task Testing (During Implementation)
| Task | Test Method | Expected Result |
|------|-------------|-----------------|
| 1B1.1 | Type `@Openspace hello` in Theia chat | Message sent via SessionService |
| 1B1.2 | `yarn build` | TypeScript compilation passes |
| 1B1.3 | Unit test with sample `%%OS{...}%%` text | Commands extracted, text cleaned |
| 1B1.4 | Dispatch 3 rapid commands | Execute sequentially with 50ms delay |
| 1B1.5 | `curl` Hub endpoints | `/commands` and `/events` return 404 |
| 1B1.6 | Check console on startup | No SSE connection logs |
| 1B1.7 | Check console on startup | `[BridgeContribution] Published manifest` log appears |
| 1B1.8 | Full integration test (6 steps) | All steps pass |

### Build Verification (After Each Task)
```bash
yarn build
# Must pass with zero errors after each task
```

### Integration Test (Task 1B1.8)
See detailed 6-step verification above.

---

## Rollback Plan

### If Integration Test Fails

**Symptom → Diagnosis → Rollback Action:**

| Symptom | Root Cause | Rollback Action |
|---------|------------|-----------------|
| ChatAgent still echoes | 1B1.1 incomplete | Revert `chat-agent.ts` to Phase 1 version |
| TypeScript errors on build | 1B1.2 interface mismatch | Check all files implement `onAgentCommand` correctly |
| Stream interceptor crashes | 1B1.3 regex bug | Add try-catch around regex, log errors, fallback to no interception |
| Commands not dispatching | 1B1.4 queue not running | Add logs in `processCommandQueue()`, verify CommandRegistry injection |
| Hub crashes on startup | 1B1.5 missing method | Check `configure()` only registers 3 routes |
| BridgeContribution errors | 1B1.6 incomplete deletion | Verify all SSE code removed, no references to `eventSource` |
| Manifest POST fails | 1B1.7 URL mismatch | Check Hub route matches BridgeContribution URL exactly |

### Git Rollback
```bash
# If entire Phase 1B1 needs to be reverted:
git log --oneline -20
# Find last commit before Phase 1B1
git revert <commit-hash>
```

### Safe Rollback Order
1. Revert 1B1.8 (verification only, no code changes)
2. Revert 1B1.6 (BridgeContribution)
3. Revert 1B1.4 (SyncService)
4. Revert 1B1.3 (Stream interceptor)
5. Revert 1B1.5 (Hub)
6. Revert 1B1.1 (ChatAgent)
7. Revert 1B1.2 (RPC interface)
8. Revert 1B1.7 (URL fix)

---

## Appendix A: File Change Summary

| File | Lines Before | Lines After | Change |
|------|--------------|-------------|--------|
| `chat-agent.ts` | 36 | 50 | +14 (SessionService delegation) |
| `opencode-protocol.ts` | 286 | 290 | +4 (onAgentCommand interface) |
| `opencode-proxy.ts` | ~600 | ~750 | +150 (stream interceptor) |
| `opencode-sync-service.ts` | 407 | ~470 | +63 (command queue) |
| `hub.ts` | 335 | ~200 | -135 (SSE removal) |
| `bridge-contribution.ts` | 333 | ~150 | -183 (SSE removal) |
| **Total** | ~2000 | ~1910 | -90 (net reduction) |

---

## Appendix B: Architecture B1 Data Flow

### Before (Architecture C — 5 Hops)
```
Agent Response with %%OS{...}%%
  ↓
OpenCodeProxy SSE handler (receives event)
  ↓
(No stream interceptor — blocks passed through)
  ↓
SyncService.onMessageEvent() (forwards to SessionService)
  ↓
ChatWidget displays text with %%OS{...}%% visible (BUG!)

(Separate imagined flow that was never implemented:)
Stream Interceptor (separate file, never existed)
  ↓
POST to Hub /commands
  ↓
Hub receives, broadcasts via SSE
  ↓
BridgeContribution listens to Hub SSE /events
  ↓
BridgeContribution.executeCommand()
  ↓
CommandRegistry.executeCommand()
```

### After (Architecture B1 — 3 Hops)
```
Agent Response with %%OS{...}%%
  ↓
OpenCodeProxy.interceptStream() (integrated)
  ├─ Strips %%OS{...}%% from text
  ├─ Parses command JSON
  ├─ Dispatches via RPC: this._client.onAgentCommand(command)
  └─ Forwards clean text via RPC: this._client.onMessageEvent(cleanEvent)
  ↓
SyncService.onAgentCommand() (receives command)
  ├─ Adds to command queue
  └─ Calls processCommandQueue()
  ↓
CommandRegistry.executeCommand(cmd, args)
  ↓
PaneService / EditorService / etc. (IDE action)
```

**Key Improvement:** 5 hops → 3 hops, SSE relay eliminated, RPC callback is direct.

---

## Appendix C: Known Issues and Limitations

### Phase 1B1 Scope
| Feature | Status | Deferred To |
|---------|--------|-------------|
| **Stateful stream interceptor** | ❌ Uses regex (fragile) | Phase 3 task 3.6 |
| **Chunk boundary handling** | ❌ Not implemented | Phase 3 task 3.6 |
| **Timeout guard** | ❌ Not implemented | Phase 3 task 3.6 |
| **Pane state publishing** | ❌ Not implemented | Phase 3 task 3.10 |
| **Command result feedback** | ❌ Not implemented | Phase 3 task 3.11 |

### Acceptable Technical Debt (Phase 1B1)
1. **Regex-based interceptor** — Fragile but sufficient for well-formed `%%OS{...}%%` blocks. Phase 3 will add state machine parser.
2. **Hardcoded 50ms delay** — Not configurable. Future: add to preferences (Phase 5).
3. **No command result tracking** — Commands execute but agent doesn't see success/failure. Phase 3 task 3.11 adds feedback loop.

---

**End of Implementation Plan**
