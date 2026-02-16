# Contract: Task 1.8 — Implement SyncService (Frontend)

**Task ID:** 1.8  
**Owner:** Builder  
**Status:** 🔄 In Progress  
**Created:** 2026-02-16  
**Dependencies:** Task 1.6 (SessionService)

---

## 1. Objective

Create `openspace-core/src/browser/opencode-sync-service.ts` that implements the `OpenCodeClient` interface (the RPC callback interface). This service receives SSE events forwarded from the backend (OpenCodeProxy → RPC callbacks) and updates SessionService state accordingly.

**Acceptance Criteria:**
- Events from opencode server (new messages, session changes, file changes, permissions) are reflected in SessionService state within 200ms
- All four `OpenCodeClient` callback methods are implemented
- Message streaming updates (partial message events) are correctly handled
- Service integrates with SessionService via DI
- Comprehensive error handling and logging
- Type-safe event handling with proper type guards

---

## 2. Architecture Context

### 2.1 Event Flow

```
OpenCode Server ──SSE──→ Backend (OpenCodeProxy) ──RPC callback──→ Frontend (SyncService)
                                                                           │
                                                                           ▼
                                                              Updates SessionService state
                                                                           │
                                                                           ▼
                                                              SessionService fires events
                                                                           │
                                                                           ▼
                                                              UI widgets re-render (ChatWidget, etc.)
```

### 2.2 Role in System

**SyncService** is the glue between:
- **Backend event stream** (OpenCodeProxy forwarding SSE events via RPC callbacks)
- **Frontend state** (SessionService managing active session/messages)

It implements the `OpenCodeClient` interface, which means it receives 4 types of events:
1. `onSessionEvent` — session created/updated/deleted/init/abort/etc.
2. `onMessageEvent` — message created/partial/completed (streaming)
3. `onFileEvent` — file changed/saved/reset
4. `onPermissionEvent` — permission requested/granted/denied

### 2.3 Message Streaming Protocol

When agent responds to a user message, events flow in this sequence:

1. **`message.created`** (type: 'created') — Initial message stub with ID
2. **`message.partial`** (type: 'partial') — Multiple events with incremental text deltas
3. **`message.completed`** (type: 'completed') — Final complete message

**SyncService responsibilities:**
- Track in-progress streaming messages (by messageId)
- Accumulate text deltas and emit `StreamingUpdate` events to SessionService
- Replace streaming message with final complete message when done

---

## 3. Interface Requirements

### 3.1 OpenCodeClient Interface (from opencode-protocol.ts)

```typescript
export interface OpenCodeClient {
    onSessionEvent(event: SessionNotification): void;
    onMessageEvent(event: MessageNotification): void;
    onFileEvent(event: FileNotification): void;
    onPermissionEvent(event: PermissionNotification): void;
}
```

### 3.2 Event Type Definitions (from opencode-protocol.ts)

```typescript
// Session Events
export interface SessionNotification {
    readonly type: SessionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly data?: Session;
}

export type SessionEventType =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'init_started'
    | 'init_completed'
    | 'aborted'
    | 'shared'
    | 'unshared'
    | 'compacted'
    | 'reverted'
    | 'unreverted';

// Message Events
export interface MessageNotification {
    readonly type: MessageEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly messageId: string;
    readonly data?: MessageWithParts;
}

export type MessageEventType = 'created' | 'partial' | 'completed';

// File Events
export interface FileNotification {
    readonly type: FileEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly path?: string;
}

export type FileEventType = 'changed' | 'saved' | 'reset';

// Permission Events
export interface PermissionNotification {
    readonly type: PermissionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly permissionId?: string;
    readonly permission?: Permission;
}

export type PermissionEventType = 'requested' | 'granted' | 'denied';
```

### 3.3 SessionService Interface (for updates)

SyncService needs to interact with SessionService to update state. Relevant methods/properties:

```typescript
export interface SessionService {
    // State (readonly — SyncService should NOT mutate directly)
    readonly activeProject: Project | undefined;
    readonly activeSession: Session | undefined;
    readonly messages: Message[];
    
    // Events (SyncService should fire these emitters)
    // NOTE: SyncService will need access to internal emitters, not just public event properties
    
    // Operations (SyncService should call these when needed)
    // For Phase 1 (Task 1.8), SyncService will directly update SessionService internal state
    // In future phases, SessionService may expose explicit update methods
}
```

**IMPORTANT:** SyncService will need access to **internal emitters** and **internal state** of SessionService to update it. This requires either:
1. **Approach A (Phase 1):** Add public update methods to SessionService that SyncService can call
2. **Approach B (Phase 1):** Make SyncService a friend class with access to SessionService internals (via `@inject`)

**DECISION FOR TASK 1.8:** Use **Approach A** — Add public update methods to SessionService:
- `updateMessages(messages: Message[]): void` — Replace entire message array
- `appendMessage(message: Message): void` — Add a new message
- `updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void` — Update streaming message
- `notifySessionChanged(session: Session): void` — Notify session updated from external event
- `notifySessionDeleted(sessionId: string): void` — Notify session deleted from external event

These methods will be added to SessionService by Builder during Task 1.8 implementation.

---

## 4. Implementation Requirements

### 4.1 File Location

**Path:** `extensions/openspace-core/src/browser/opencode-sync-service.ts`

### 4.2 Class Structure

```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import { OpenCodeClient, SessionNotification, MessageNotification, FileNotification, PermissionNotification } from '../common/opencode-protocol';
import { SessionService } from './session-service';

export const OpenCodeSyncService = Symbol('OpenCodeSyncService');

export interface OpenCodeSyncService extends OpenCodeClient {
    // No additional public methods needed beyond OpenCodeClient interface
    // This service is purely reactive (receives events, updates state)
}

@injectable()
export class OpenCodeSyncServiceImpl implements OpenCodeSyncService {
    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    // Internal state for tracking streaming messages
    private streamingMessages = new Map<string, { text: string }>();

    // Implement OpenCodeClient interface
    onSessionEvent(event: SessionNotification): void { /* ... */ }
    onMessageEvent(event: MessageNotification): void { /* ... */ }
    onFileEvent(event: FileNotification): void { /* ... */ }
    onPermissionEvent(event: PermissionNotification): void { /* ... */ }
}
```

### 4.3 Dependency Injection

- **Inject:** `SessionService` (to update frontend state)
- **Symbol:** Export `OpenCodeSyncService` symbol for DI binding
- **Decorator:** Use `@injectable()` on the implementation class

### 4.4 Method: `onSessionEvent(event: SessionNotification)`

**Purpose:** Handle session lifecycle events (created/updated/deleted/init/abort/etc.)

**Logic:**

1. **Log event:** `console.debug('[SyncService] Session event:', event.type, event.sessionId)`

2. **Ignore events for non-active sessions:**
   ```typescript
   // Only process events for the currently active session
   if (this.sessionService.activeSession?.id !== event.sessionId) {
       console.debug('[SyncService] Ignoring event for non-active session');
       return;
   }
   ```

3. **Handle event types:**
   - **`created`**: If `event.data` exists, call `sessionService.notifySessionChanged(event.data)`
   - **`updated`**: If `event.data` exists, call `sessionService.notifySessionChanged(event.data)`
   - **`deleted`**: Call `sessionService.notifySessionDeleted(event.sessionId)`
   - **`init_started`**: Log (no state change needed)
   - **`init_completed`**: If `event.data` exists, call `sessionService.notifySessionChanged(event.data)`
   - **`aborted`**: If `event.data` exists, call `sessionService.notifySessionChanged(event.data)` + set `isStreaming = false`
   - **`shared`/`unshared`/`compacted`/`reverted`/`unreverted`**: If `event.data` exists, call `sessionService.notifySessionChanged(event.data)`

4. **Error handling:** Wrap entire method in try-catch, log errors without throwing (to prevent RPC connection breakage)

### 4.5 Method: `onMessageEvent(event: MessageNotification)`

**Purpose:** Handle message events (created/partial/completed) — implements streaming message protocol

**Logic:**

1. **Log event:** `console.debug('[SyncService] Message event:', event.type, event.messageId)`

2. **Ignore events for non-active sessions:**
   ```typescript
   if (this.sessionService.activeSession?.id !== event.sessionId) {
       console.debug('[SyncService] Ignoring event for non-active session');
       return;
   }
   ```

3. **Handle event types:**

   **Type: `created`**
   - Initial message stub with ID
   - If `event.data` exists:
     - Call `sessionService.appendMessage(event.data.info)`
     - Initialize streaming state: `streamingMessages.set(event.messageId, { text: '' })`
   
   **Type: `partial`**
   - Incremental text delta for streaming message
   - Extract text delta from `event.data.parts` (find `TextMessagePart`, accumulate text)
   - Get existing streaming message: `const stream = streamingMessages.get(event.messageId)`
   - If stream exists:
     - Append delta: `stream.text += delta`
     - Call `sessionService.updateStreamingMessage(event.messageId, delta, false)`
   - If stream doesn't exist (shouldn't happen), log warning
   
   **Type: `completed`**
   - Final complete message
   - If `event.data` exists:
     - Call `sessionService.updateStreamingMessage(event.messageId, '', true)` (signal completion)
     - Update full message in SessionService by replacing the streaming stub
     - Find message in `sessionService.messages` by ID, replace with `event.data.info`
     - Clean up streaming state: `streamingMessages.delete(event.messageId)`

4. **Error handling:** Wrap entire method in try-catch, log errors without throwing

### 4.6 Method: `onFileEvent(event: FileNotification)`

**Purpose:** Handle file change events (changed/saved/reset)

**Logic:**

1. **Log event:** `console.debug('[SyncService] File event:', event.type, event.path)`

2. **Ignore events for non-active sessions:**
   ```typescript
   if (this.sessionService.activeSession?.id !== event.sessionId) {
       console.debug('[SyncService] Ignoring event for non-active session');
       return;
   }
   ```

3. **Handle event types:**
   - **`changed`**: Log (no immediate action — file status will be queried when needed)
   - **`saved`**: Log (no immediate action)
   - **`reset`**: Log (may trigger full message reload in future — for now, just log)

4. **Error handling:** Wrap entire method in try-catch, log errors without throwing

**Note:** File event handling is minimal in Phase 1. Future phases will integrate with FileService for automatic editor syncing.

### 4.7 Method: `onPermissionEvent(event: PermissionNotification)`

**Purpose:** Handle permission request events (requested/granted/denied)

**Logic:**

1. **Log event:** `console.debug('[SyncService] Permission event:', event.type, event.permissionId)`

2. **Ignore events for non-active sessions:**
   ```typescript
   if (this.sessionService.activeSession?.id !== event.sessionId) {
       console.debug('[SyncService] Ignoring event for non-active session');
       return;
   }
   ```

3. **Handle event types:**
   - **`requested`**: Log (Phase 1 — no UI for permissions yet, Task 1.14 will add it)
   - **`granted`**: Log
   - **`denied`**: Log

4. **Error handling:** Wrap entire method in try-catch, log errors without throwing

**Note:** Permission handling is minimal in Phase 1 (Task 1.8). Task 1.14 will implement full permission UI and state management.

---

## 5. SessionService Updates (Required for Task 1.8)

To enable SyncService to update SessionService state, add these public methods to `SessionServiceImpl`:

### 5.1 Method: `appendMessage(message: Message): void`

**Purpose:** Add a new message to the messages array (for `message.created` events)

**Implementation:**
```typescript
appendMessage(message: Message): void {
    console.debug(`[SessionService] Appending message: ${message.id}`);
    
    // Check if message already exists (prevent duplicates)
    const exists = this._messages.some(m => m.id === message.id);
    if (exists) {
        console.warn(`[SessionService] Message already exists: ${message.id}`);
        return;
    }
    
    this._messages.push(message);
    this.onMessagesChangedEmitter.fire([...this._messages]);
}
```

### 5.2 Method: `updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void`

**Purpose:** Update a streaming message with incremental text delta

**Implementation:**
```typescript
updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void {
    console.debug(`[SessionService] Streaming update: ${messageId}, isDone=${isDone}`);
    
    // Fire streaming event for incremental updates
    if (!isDone) {
        this.onMessageStreamingEmitter.fire({ messageId, delta, isDone });
    }
    
    // Find message in array
    const index = this._messages.findIndex(m => m.id === messageId);
    if (index < 0) {
        console.warn(`[SessionService] Streaming message not found: ${messageId}`);
        return;
    }
    
    // Append delta to the last text part
    const message = this._messages[index];
    const parts = [...message.parts];
    
    if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
        // Append to existing text part
        const lastPart = parts[parts.length - 1] as TextMessagePart;
        parts[parts.length - 1] = { type: 'text', text: lastPart.text + delta };
    } else {
        // Create new text part
        parts.push({ type: 'text', text: delta });
    }
    
    // Update message with new parts
    this._messages[index] = { ...message, parts };
    this.onMessagesChangedEmitter.fire([...this._messages]);
    
    // Fire completion event
    if (isDone) {
        this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: true });
        this._isStreaming = false;
        this.onIsStreamingChangedEmitter.fire(false);
    }
}
```

### 5.3 Method: `notifySessionChanged(session: Session): void`

**Purpose:** Update active session from external event (backend SSE)

**Implementation:**
```typescript
notifySessionChanged(session: Session): void {
    console.debug(`[SessionService] External session update: ${session.id}`);
    
    // Only update if this is the active session
    if (this._activeSession?.id !== session.id) {
        console.debug('[SessionService] Ignoring update for non-active session');
        return;
    }
    
    this._activeSession = session;
    this.onActiveSessionChangedEmitter.fire(session);
}
```

### 5.4 Method: `notifySessionDeleted(sessionId: string): void`

**Purpose:** Clear active session if it was deleted externally

**Implementation:**
```typescript
notifySessionDeleted(sessionId: string): void {
    console.debug(`[SessionService] External session deletion: ${sessionId}`);
    
    // Only clear if this is the active session
    if (this._activeSession?.id !== sessionId) {
        console.debug('[SessionService] Ignoring deletion of non-active session');
        return;
    }
    
    this._activeSession = undefined;
    this._messages = [];
    window.localStorage.removeItem('openspace.activeSessionId');
    this.onActiveSessionChangedEmitter.fire(undefined);
    this.onMessagesChangedEmitter.fire([]);
}
```

### 5.5 Method: `replaceMessage(messageId: string, message: Message): void`

**Purpose:** Replace an existing message (for `message.completed` events)

**Implementation:**
```typescript
replaceMessage(messageId: string, message: Message): void {
    console.debug(`[SessionService] Replacing message: ${messageId}`);
    
    const index = this._messages.findIndex(m => m.id === messageId);
    if (index < 0) {
        console.warn(`[SessionService] Message not found for replacement: ${messageId}`);
        return;
    }
    
    this._messages[index] = message;
    this.onMessagesChangedEmitter.fire([...this._messages]);
}
```

---

## 6. Error Handling Requirements

1. **Never throw exceptions from callback methods** — RPC callbacks should never break the connection
2. **Log all errors** with `console.error('[SyncService] ...')`
3. **Graceful degradation** — If an event fails to process, log it and continue (don't block future events)
4. **Validate event data** — Check for required fields before accessing (e.g., `event.data?.info`)

---

## 7. Logging Requirements

All log statements must use this format:

```typescript
console.debug('[SyncService] <operation>: <details>');
console.info('[SyncService] <milestone>');
console.warn('[SyncService] <unexpected condition>');
console.error('[SyncService] <error>: <error details>');
```

**Example log statements:**

```typescript
console.debug('[SyncService] Session event: created, sessionId=abc123');
console.debug('[SyncService] Message event: partial, messageId=msg456, delta=15 chars');
console.debug('[SyncService] Ignoring event for non-active session');
console.warn('[SyncService] Streaming message not found: msg789');
console.error('[SyncService] Error in onMessageEvent:', error);
```

---

## 8. Testing Considerations

### 8.1 Manual Testing (Task 1.13 — Integration Test)

After Task 1.9 (DI wiring) and Task 1.10 (Chat Widget), full round-trip testing will be possible:

1. Send message from ChatWidget
2. OpenCodeProxy forwards to opencode server
3. Server responds via SSE
4. OpenCodeProxy calls `client.onMessageEvent()`
5. SyncService receives event
6. SyncService updates SessionService
7. ChatWidget re-renders with new message

Expected latency: < 200ms from SSE event received to UI update.

### 8.2 Unit Testing (Future)

Mock SessionService and verify:
- `onSessionEvent('created')` → calls `sessionService.notifySessionChanged()`
- `onMessageEvent('partial')` → calls `sessionService.updateStreamingMessage()`
- `onMessageEvent('completed')` → calls `sessionService.replaceMessage()`
- Events for non-active sessions are ignored

---

## 9. Dependencies

### 9.1 Required Imports

```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import {
    OpenCodeClient,
    SessionNotification,
    MessageNotification,
    FileNotification,
    PermissionNotification,
    Message,
    MessageWithParts,
    TextMessagePart,
    Session
} from '../common/opencode-protocol';
import { SessionService } from './session-service';
```

### 9.2 DI Binding (Task 1.9)

In `openspace-core-frontend-module.ts`:

```typescript
import { OpenCodeSyncService, OpenCodeSyncServiceImpl } from './opencode-sync-service';

bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();
```

**IMPORTANT:** SyncService must also be registered as the `OpenCodeClient` implementation for RPC callbacks:

```typescript
import { OpenCodeClient } from '../common/opencode-protocol';

// Bind SyncService as OpenCodeClient (the RPC callback handler)
bind(OpenCodeClient).toService(OpenCodeSyncService);
```

This tells the RPC system to call SyncService methods when backend emits callbacks.

---

## 10. Performance Requirements

1. **Event processing latency:** < 50ms per event (internal processing, not including RPC/SSE latency)
2. **Memory overhead:** Streaming message map should be bounded (clear entries after completion)
3. **UI update latency:** Total time from SSE event received to UI update < 200ms

---

## 11. Acceptance Checklist

### 11.1 File Creation
- [ ] Created `extensions/openspace-core/src/browser/opencode-sync-service.ts`
- [ ] Exported `OpenCodeSyncService` symbol
- [ ] Exported `OpenCodeSyncServiceImpl` class with `@injectable()` decorator

### 11.2 Interface Implementation
- [ ] Implements `OpenCodeClient` interface (all 4 methods)
- [ ] Injects `SessionService` via `@inject()`
- [ ] All methods have try-catch error handling
- [ ] All methods log received events

### 11.3 Event Handling
- [ ] `onSessionEvent()` handles all 11 session event types
- [ ] `onMessageEvent()` handles created/partial/completed flow
- [ ] `onFileEvent()` logs events (minimal Phase 1 implementation)
- [ ] `onPermissionEvent()` logs events (minimal Phase 1 implementation)
- [ ] All handlers ignore events for non-active sessions

### 11.4 Message Streaming
- [ ] Maintains `streamingMessages` Map to track in-progress messages
- [ ] Accumulates text deltas correctly
- [ ] Cleans up streaming state on message completion
- [ ] Fires `StreamingUpdate` events via SessionService

### 11.5 SessionService Integration
- [ ] Added `appendMessage()` method to SessionService
- [ ] Added `updateStreamingMessage()` method to SessionService
- [ ] Added `replaceMessage()` method to SessionService
- [ ] Added `notifySessionChanged()` method to SessionService
- [ ] Added `notifySessionDeleted()` method to SessionService

### 11.6 Error Handling
- [ ] No exceptions thrown from callback methods
- [ ] All errors logged with `console.error('[SyncService] ...')`
- [ ] Graceful degradation on malformed events

### 11.7 Code Quality
- [ ] All methods have JSDoc comments
- [ ] Consistent logging format (`[SyncService] <operation>: <details>`)
- [ ] TypeScript strict mode compliance
- [ ] No `any` types (use proper type guards)

---

## 12. Known Edge Cases

### 12.1 Race Condition: Session Switch During Streaming

**Scenario:** User sends message in Session A, then switches to Session B while message is still streaming.

**Expected behavior:** 
- Events for Session A should be ignored (non-active session check)
- Streaming state should be cleaned up when session changes
- No UI updates should occur for Session A messages

**Implementation:** Add check in SessionService.setActiveSession():
```typescript
// Clear streaming state when session changes
this.streamingMessages.clear();
```

### 12.2 Duplicate Event Handling

**Scenario:** Backend sends duplicate `message.created` event (network retry, etc.)

**Expected behavior:**
- `appendMessage()` should check for existing message ID and skip if already exists
- Log warning: `Message already exists: {messageId}`

**Implementation:** Already covered in `appendMessage()` method spec (section 5.1).

### 12.3 Out-of-Order Events

**Scenario:** `message.partial` event arrives before `message.created` event (network jitter)

**Expected behavior:**
- `onMessageEvent('partial')` should log warning if streaming state doesn't exist
- When `message.created` arrives later, initialize streaming state
- Next `partial` event will work correctly

**Implementation:** Check for streaming state existence before updating:
```typescript
const stream = this.streamingMessages.get(event.messageId);
if (!stream) {
    console.warn('[SyncService] Received partial event before created:', event.messageId);
    return; // Ignore out-of-order event
}
```

---

## 13. Future Enhancements (Post-Phase 1)

1. **Task 1.14 (Permission Handling):** Full permission UI — SyncService will update PermissionService state
2. **File Synchronization:** Integrate with Theia FileService to auto-refresh editors when files change
3. **Session List Updates:** When `session.created` event is received for ANY session (not just active), update a global session list
4. **Offline Handling:** Queue events received while offline, replay when connection restored

---

## 14. Contract Approval

**Oracle:** Approved for Builder implementation  
**Builder:** Ready to implement  
**Janitor:** Contract review pending (will validate post-implementation)  
**CodeReviewer:** Contract review pending (will audit post-implementation)

---

## 15. References

- **WORKPLAN:** `docs/architecture/WORKPLAN.md` — Task 1.8 (lines 188-194)
- **TECHSPEC:** `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` — §3.1.2 SSE Event Stream, §8.1 Message Flow
- **Protocol:** `extensions/openspace-core/src/common/opencode-protocol.ts` — OpenCodeClient interface
- **SessionService:** `extensions/openspace-core/src/browser/session-service.ts` — State management
- **OpenCodeProxy:** `extensions/openspace-core/src/node/opencode-proxy.ts` — Backend SSE forwarding

---

**END OF CONTRACT**
