# Contract: Phase 1 Task 1.6 — SessionService (Frontend)

**Task ID:** 1.6  
**Phase:** Phase 1 (Core Connection + Hub)  
**Agent:** Builder  
**Status:** PENDING  
**Created:** 2026-02-16  
**Dependencies:** 1.4 (Backend DI wiring — RPC proxy available)

---

## Objective

Implement the SessionService — a frontend state management service that tracks active projects, sessions, and messages. It coordinates between UI widgets (ChatWidget, session UI) and the backend OpenCodeProxy via RPC, handles optimistic updates for message sending, and emits events for reactive UI consumption.

---

## Context

### System Architecture (§3.2 from TECHSPEC)

```
┌────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                      │
│                                                            │
│  ┌──────────────┐         ┌─────────────────┐            │
│  │  ChatWidget  │         │  Session UI     │            │
│  │  (1.10)      │         │  (1.11)         │            │
│  └──────┬───────┘         └────────┬────────┘            │
│         │                          │                      │
│         │ sendMessage()            │ createSession()      │
│         │ subscribe events         │ setActiveSession()   │
│         ▼                          ▼                      │
│  ┌────────────────────────────────────────────┐           │
│  │        SessionService (THIS TASK)          │           │
│  │  • Tracks activeProject, activeSession     │           │
│  │  • Maintains messages[] with optimistic    │           │
│  │    updates                                 │           │
│  │  • Emits events for UI reactivity          │           │
│  │  • Calls OpenCodeService via RPC proxy     │           │
│  └─────────────────┬──────────────────────────┘           │
│                    │ JSON-RPC                             │
└────────────────────┼──────────────────────────────────────┘
                     │
┌────────────────────┼──────────────────────────────────────┐
│                    │ Backend (Node.js)                    │
│  ┌─────────────────▼──────────────────────────┐           │
│  │        OpenCodeProxy                       │           │
│  │  • REST API client to opencode server      │           │
│  │  • SSE event forwarding                    │           │
│  └────────────────────────────────────────────┘           │
└───────────────────────────────────────────────────────────┘
```

**SessionService Role:**
1. **State Management** — single source of truth for active project/session/messages
2. **RPC Coordination** — calls backend OpenCodeService methods (getProjects, sendMessage, etc.)
3. **Event Emission** — notifies subscribers (UI widgets) of state changes
4. **Optimistic Updates** — shows user's message immediately, syncs when server responds
5. **Loading/Error State** — tracks operation status for UI indicators

---

## Requirements

### Functional Requirements

#### FR1: State Management

##### FR1.1: Active Project Tracking
- **Property:** `readonly activeProject: Project | undefined`
- **Behavior:**
  - Initially `undefined` (no project selected)
  - Set via `setActiveProject(projectId: string)`
  - Persists in localStorage as `openspace.activeProjectId`
  - On startup, restore from localStorage if valid project ID exists
  - Emit `onActiveProjectChanged` event when changed

##### FR1.2: Active Session Tracking
- **Property:** `readonly activeSession: Session | undefined`
- **Behavior:**
  - Initially `undefined` (no session selected)
  - Set via `setActiveSession(sessionId: string)`
  - Persists in localStorage as `openspace.activeSessionId`
  - On startup, restore from localStorage if valid session ID exists
  - Automatically clear if active project changes to a different project
  - Emit `onActiveSessionChanged` event when changed

##### FR1.3: Message List Management
- **Property:** `readonly messages: Message[]`
- **Behavior:**
  - Empty array initially
  - Loads messages via `getMessages()` when active session changes
  - Optimistic updates: user message appears immediately in UI
  - Streaming updates: assistant message updates incrementally
  - Clear messages when active session changes
  - Emit `onMessagesChanged` event when array changes

##### FR1.4: Loading State
- **Property:** `readonly isLoading: boolean`
- **Behavior:**
  - `true` during async operations (setActiveProject, setActiveSession, sendMessage)
  - `false` when idle or operation completes
  - Emit `onIsLoadingChanged` event when changed

##### FR1.5: Error State
- **Property:** `readonly lastError: string | undefined`
- **Behavior:**
  - `undefined` when no error
  - Set to error message when operation fails
  - Clear when new operation starts
  - Emit `onErrorChanged` event when changed

##### FR1.6: Streaming State
- **Property:** `readonly isStreaming: boolean`
- **Behavior:**
  - `true` when receiving streaming message from agent
  - `false` when no active stream
  - Emit `onIsStreamingChanged` event when changed

#### FR2: Core Operations

##### FR2.1: Set Active Project
```typescript
async setActiveProject(projectId: string): Promise<void>
```
- **Behavior:**
  1. Set `isLoading = true`
  2. Call `openCodeService.getProjects()` to verify project exists
  3. If found: update `activeProject`, emit event, persist to localStorage
  4. If not found: throw error `Project not found: ${projectId}`
  5. Clear `activeSession` if it belonged to a different project
  6. Set `isLoading = false`

##### FR2.2: Set Active Session
```typescript
async setActiveSession(sessionId: string): Promise<void>
```
- **Behavior:**
  1. Require `activeProject` to be set (throw error if undefined)
  2. Set `isLoading = true`
  3. Call `openCodeService.getSession(projectId, sessionId)` to verify session exists
  4. If found: update `activeSession`, emit event, persist to localStorage
  5. If not found: throw error `Session not found: ${sessionId}`
  6. Load messages via `loadMessages()`
  7. Set `isLoading = false`

##### FR2.3: Create Session
```typescript
async createSession(title?: string): Promise<Session>
```
- **Behavior:**
  1. Require `activeProject` to be set (throw error if undefined)
  2. Set `isLoading = true`
  3. Call `openCodeService.createSession(projectId, { title })`
  4. If successful: set as active session via `setActiveSession(newSession.id)`
  5. Return new session
  6. Set `isLoading = false`

##### FR2.4: Send Message
```typescript
async sendMessage(parts: MessagePart[]): Promise<void>
```
- **Behavior:**
  1. Require `activeProject` and `activeSession` to be set
  2. Create optimistic message:
     ```typescript
     const optimisticMsg: Message = {
       id: `temp-${Date.now()}`,
       sessionId: activeSession.id,
       role: 'user',
       parts,
       metadata: { optimistic: true }
     };
     ```
  3. Add optimistic message to `messages[]`, emit `onMessagesChanged`
  4. Set `isStreaming = true`
  5. Call `openCodeService.createMessage(projectId, sessionId, { parts })`
  6. On success: replace optimistic message with server response
  7. On error: remove optimistic message, set `lastError`
  8. Set `isStreaming = false`

##### FR2.5: Abort Message
```typescript
async abort(): Promise<void>
```
- **Behavior:**
  1. Require `activeProject` and `activeSession` to be set
  2. Call `openCodeService.abortSession(projectId, sessionId)`
  3. Set `isStreaming = false`

##### FR2.6: Load Messages
```typescript
private async loadMessages(): Promise<void>
```
- **Behavior:**
  1. Require `activeSession` to be set
  2. Set `isLoading = true`
  3. Call `openCodeService.getMessages(projectId, sessionId)`
  4. Convert `MessageWithParts[]` to `Message[]` (flatten structure)
  5. Update `messages` array, emit `onMessagesChanged`
  6. Set `isLoading = false`

#### FR3: Event Emission

##### FR3.1: Event Types
```typescript
readonly onActiveProjectChanged: Event<Project | undefined>;
readonly onActiveSessionChanged: Event<Session | undefined>;
readonly onMessagesChanged: Event<Message[]>;
readonly onMessageStreaming: Event<StreamingUpdate>;
readonly onIsLoadingChanged: Event<boolean>;
readonly onErrorChanged: Event<string | undefined>;
readonly onIsStreamingChanged: Event<boolean>;
```

##### FR3.2: StreamingUpdate Interface
```typescript
export interface StreamingUpdate {
  messageId: string;
  delta: string;  // New text chunk
  isDone: boolean;
}
```

##### FR3.3: Event Firing Rules
- Fire events **after** state changes, not before
- Use Theia's `Emitter` from `@theia/core/lib/common/event`
- Dispose emitters in `dispose()` method

#### FR4: Lifecycle Management

##### FR4.1: Initialization
```typescript
@postConstruct()
protected init(): void
```
- **Behavior:**
  1. Restore `activeProjectId` from localStorage
  2. If found, call `setActiveProject(activeProjectId)` silently (don't throw on error)
  3. Restore `activeSessionId` from localStorage
  4. If found, call `setActiveSession(activeSessionId)` silently (don't throw on error)
  5. Log initialization: `[SessionService] Initialized with project=${projectId}, session=${sessionId}`

##### FR4.2: Disposal
```typescript
dispose(): void
```
- **Behavior:**
  1. Dispose all emitters
  2. Clear state (set everything to `undefined` or empty)
  3. Log disposal: `[SessionService] Disposed`

---

## Non-Functional Requirements

### NFR1: Performance
- **P1.1:** State updates must complete within 50ms (excluding RPC calls)
- **P1.2:** Event emission must be synchronous (no async delays)
- **P1.3:** localStorage operations must not block UI thread

### NFR2: Reliability
- **R2.1:** Handle RPC call failures gracefully (set `lastError`, don't crash)
- **R2.2:** Validate project/session IDs before operations (fail fast)
- **R2.3:** Rollback optimistic updates on error (remove temp messages)

### NFR3: Observability
- **O3.1:** Log all state transitions (DEBUG level): `[SessionService] State: project=${id}, session=${id}, messages=${count}`
- **O3.2:** Log all errors (ERROR level): `[SessionService] Error: ${message}`
- **O3.3:** Log all operations (INFO level): `[SessionService] Operation: ${name}(${args})`

---

## Interface Definition

### Location
- **File:** `extensions/openspace-core/src/browser/session-service.ts`
- **Export Symbol:** `SessionService` (already defined in `opencode-protocol.ts`)

### Full Interface
```typescript
export const SessionService = Symbol('SessionService');

export interface SessionService {
  // State (readonly properties)
  readonly activeProject: Project | undefined;
  readonly activeSession: Session | undefined;
  readonly messages: Message[];
  readonly isLoading: boolean;
  readonly lastError: string | undefined;
  readonly isStreaming: boolean;

  // Events
  readonly onActiveProjectChanged: Event<Project | undefined>;
  readonly onActiveSessionChanged: Event<Session | undefined>;
  readonly onMessagesChanged: Event<Message[]>;
  readonly onMessageStreaming: Event<StreamingUpdate>;
  readonly onIsLoadingChanged: Event<boolean>;
  readonly onErrorChanged: Event<string | undefined>;
  readonly onIsStreamingChanged: Event<boolean>;

  // Operations
  setActiveProject(projectId: string): Promise<void>;
  setActiveSession(sessionId: string): Promise<void>;
  createSession(title?: string): Promise<Session>;
  sendMessage(parts: MessagePart[]): Promise<void>;
  abort(): Promise<void>;
}

export interface StreamingUpdate {
  messageId: string;
  delta: string;
  isDone: boolean;
}
```

### Implementation Class
```typescript
@injectable()
export class SessionServiceImpl implements SessionService {
  @inject(OpenCodeService)
  protected readonly openCodeService: OpenCodeService;

  // Private state
  private _activeProject: Project | undefined;
  private _activeSession: Session | undefined;
  private _messages: Message[] = [];
  private _isLoading = false;
  private _lastError: string | undefined;
  private _isStreaming = false;

  // Emitters
  private readonly onActiveProjectChangedEmitter = new Emitter<Project | undefined>();
  private readonly onActiveSessionChangedEmitter = new Emitter<Session | undefined>();
  private readonly onMessagesChangedEmitter = new Emitter<Message[]>();
  private readonly onMessageStreamingEmitter = new Emitter<StreamingUpdate>();
  private readonly onIsLoadingChangedEmitter = new Emitter<boolean>();
  private readonly onErrorChangedEmitter = new Emitter<string | undefined>();
  private readonly onIsStreamingChangedEmitter = new Emitter<boolean>();

  // Public event properties
  readonly onActiveProjectChanged = this.onActiveProjectChangedEmitter.event;
  readonly onActiveSessionChanged = this.onActiveSessionChangedEmitter.event;
  readonly onMessagesChanged = this.onMessagesChangedEmitter.event;
  readonly onMessageStreaming = this.onMessageStreamingEmitter.event;
  readonly onIsLoadingChanged = this.onIsLoadingChangedEmitter.event;
  readonly onErrorChanged = this.onErrorChangedEmitter.event;
  readonly onIsStreamingChanged = this.onIsStreamingChangedEmitter.event;

  // Getters for readonly properties
  get activeProject(): Project | undefined { return this._activeProject; }
  get activeSession(): Session | undefined { return this._activeSession; }
  get messages(): Message[] { return this._messages; }
  get isLoading(): boolean { return this._isLoading; }
  get lastError(): string | undefined { return this._lastError; }
  get isStreaming(): boolean { return this._isStreaming; }

  @postConstruct()
  protected init(): void {
    // Restore from localStorage
  }

  async setActiveProject(projectId: string): Promise<void> {
    // Implementation per FR2.1
  }

  async setActiveSession(sessionId: string): Promise<void> {
    // Implementation per FR2.2
  }

  async createSession(title?: string): Promise<Session> {
    // Implementation per FR2.3
  }

  async sendMessage(parts: MessagePart[]): Promise<void> {
    // Implementation per FR2.4
  }

  async abort(): Promise<void> {
    // Implementation per FR2.5
  }

  private async loadMessages(): Promise<void> {
    // Implementation per FR2.6
  }

  dispose(): void {
    // Dispose all emitters
    this.onActiveProjectChangedEmitter.dispose();
    this.onActiveSessionChangedEmitter.dispose();
    this.onMessagesChangedEmitter.dispose();
    this.onMessageStreamingEmitter.dispose();
    this.onIsLoadingChangedEmitter.dispose();
    this.onErrorChangedEmitter.dispose();
    this.onIsStreamingChangedEmitter.dispose();
  }
}
```

---

## Dependencies

### Required Imports
```typescript
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { Disposable } from '@theia/core/lib/common/disposable';
import {
  OpenCodeService,
  Project,
  Session,
  Message,
  MessagePart,
  MessageWithParts
} from '../common/opencode-protocol';
```

### Required Services (via DI)
- `OpenCodeService` — RPC proxy to backend (already bound in Task 1.4)

### Browser APIs
- `localStorage` — for persistence (window.localStorage)

---

## Implementation Constraints

### IC1: No UI Code
- SessionService MUST NOT import or use any UI framework (React, Angular, etc.)
- SessionService MUST NOT render anything
- All UI interaction is via event subscription (observer pattern)

### IC2: No Direct HTTP Calls
- SessionService MUST use OpenCodeService RPC proxy for all backend communication
- MUST NOT use `fetch`, `axios`, or any HTTP library directly

### IC3: Thread Safety
- All state mutations must be synchronous (within same tick)
- RPC calls are async, but state updates before/after must be atomic
- Use `await` properly to avoid race conditions

### IC4: Error Handling
- All async methods must have try/catch blocks
- Errors must be logged AND set in `lastError` property
- Failed operations must not leave service in inconsistent state

---

## Acceptance Criteria

### AC1: State Management ✅
- **Given:** SessionService is initialized
- **When:** `setActiveProject(projectId)` is called with valid ID
- **Then:** 
  - `activeProject` property updates
  - `onActiveProjectChanged` event fires
  - Project ID persists to localStorage
  - `isLoading` is `false` after operation completes

### AC2: Session Switching ✅
- **Given:** Active project is set
- **When:** `setActiveSession(sessionId)` is called with valid ID
- **Then:**
  - `activeSession` property updates
  - `onActiveSessionChanged` event fires
  - Messages load automatically via `loadMessages()`
  - `onMessagesChanged` event fires with loaded messages
  - Session ID persists to localStorage

### AC3: Optimistic Message Updates ✅
- **Given:** Active project and session are set
- **When:** `sendMessage([{ type: 'text', text: 'Hello' }])` is called
- **Then:**
  - User message appears in `messages[]` immediately (optimistic)
  - `onMessagesChanged` event fires immediately
  - `isStreaming` becomes `true`
  - RPC call to backend is made
  - When server responds, optimistic message is replaced with server message
  - `onMessagesChanged` event fires again with final message
  - `isStreaming` becomes `false`

### AC4: Error Handling ✅
- **Given:** Active project is NOT set
- **When:** `setActiveSession(sessionId)` is called
- **Then:**
  - Operation throws error: "No active project"
  - `lastError` is set to error message
  - `onErrorChanged` event fires
  - `isLoading` is `false`
  - Service state is unchanged (no partial updates)

### AC5: Persistence ✅
- **Given:** Active project and session are set
- **When:** Browser page is refreshed (service re-initializes)
- **Then:**
  - Service restores `activeProjectId` from localStorage
  - Service calls `setActiveProject()` automatically
  - Service restores `activeSessionId` from localStorage
  - Service calls `setActiveSession()` automatically
  - Messages reload automatically

### AC6: Event Emission ✅
- **Given:** A subscriber is listening to `onMessagesChanged`
- **When:** `sendMessage()` is called
- **Then:**
  - Subscriber receives event with optimistic message
  - Subscriber receives event again with final message
  - Events fire in correct order (optimistic → final)

### AC7: Lifecycle ✅
- **Given:** SessionService is bound in DI container
- **When:** Service is disposed
- **Then:**
  - All emitters are disposed
  - No memory leaks (all event listeners cleaned up)
  - State is cleared

### AC8: Build Verification ✅
- **Given:** Implementation is complete
- **When:** `npm run build` is executed in `extensions/openspace-core`
- **Then:**
  - TypeScript compilation succeeds
  - No type errors
  - Generated `.js` and `.d.ts` files exist in `lib/browser/`

---

## Testing Strategy

### Unit Tests (Deferred to Task 1.13)
- Mock `OpenCodeService` with fake RPC responses
- Test each operation (setActiveProject, sendMessage, etc.)
- Verify event emissions
- Test error handling
- Test optimistic updates and rollback

### Integration Tests (Deferred to Task 1.13)
- Test with real RPC proxy to backend
- Verify localStorage persistence
- Test full message round-trip (send → server → receive)

### Manual Testing (Task 1.6 Validation)
1. **Setup:** Start Theia with opencode server running
2. **Test 1:** Open browser console, get SessionService via DI
3. **Test 2:** Call `setActiveProject('test-project')`
4. **Test 3:** Verify `activeProject` property updates
5. **Test 4:** Verify localStorage contains `openspace.activeProjectId`
6. **Test 5:** Call `createSession('Test Session')`
7. **Test 6:** Verify `activeSession` property updates
8. **Test 7:** Call `sendMessage([{ type: 'text', text: 'Hello' }])`
9. **Test 8:** Verify message appears in `messages[]` immediately
10. **Test 9:** Refresh browser, verify session restores

---

## Out of Scope

### Explicitly NOT included in Task 1.6:
1. **SyncService** — Task 1.8 (handles backend SSE events → SessionService updates)
2. **ChatWidget** — Task 1.10 (consumes SessionService for UI rendering)
3. **Session CRUD UI** — Task 1.11 (buttons for create/delete/switch sessions)
4. **Frontend DI Wiring** — Task 1.9 (binding SessionService in frontend module)
5. **Permission Handling** — Task 1.14 (permission UI and state)
6. **File Tracking** — Phase 2 (session files state)
7. **Advanced Operations** — Phase 3 (fork, revert, compact session)

---

## Success Criteria

### Definition of Done
- ✅ `session-service.ts` file created with `SessionServiceImpl` class
- ✅ All interface methods implemented (setActiveProject, sendMessage, etc.)
- ✅ All events defined and emitted correctly
- ✅ localStorage persistence working (save/restore)
- ✅ Error handling implemented for all operations
- ✅ TypeScript compilation passes (`npm run build`)
- ✅ Logging added at INFO, DEBUG, ERROR levels
- ✅ Implementation documented in `result-1.6-session-service.md`

### Quality Gates
- **Code Quality:** Follows NSO coding standards (see `.opencode/docs/standards/CODING_STANDARDS.md`)
- **Type Safety:** No `any` types, all properties strongly typed
- **Error Handling:** No unhandled promise rejections
- **Memory Safety:** All emitters disposed, no event listener leaks
- **Observability:** All operations logged with context

---

## Notes for Builder

### Implementation Order
1. **Read contract thoroughly** (this file)
2. **Review opencode-protocol.ts** — understand `OpenCodeService` interface
3. **Create session-service.ts skeleton** — class definition, imports, DI decorators
4. **Implement state properties** — private state + public getters
5. **Implement emitters** — create, expose as readonly events
6. **Implement init()** — localStorage restoration
7. **Implement setActiveProject()** — state update, persistence, events
8. **Implement setActiveSession()** — state update, loadMessages(), persistence
9. **Implement createSession()** — RPC call, set as active
10. **Implement sendMessage()** — optimistic update, RPC call, sync
11. **Implement abort()** — RPC call, streaming state update
12. **Implement loadMessages()** — RPC call, message transformation
13. **Implement dispose()** — emitter cleanup
14. **Add logging** — DEBUG, INFO, ERROR levels
15. **Build verification** — `npm run build`
16. **Create result.md** — document implementation details

### Key Challenges
1. **Optimistic Updates:** Must handle race conditions (user sends while streaming)
2. **State Consistency:** Session change must clear old messages before loading new ones
3. **Error Recovery:** Failed RPC calls must not corrupt state
4. **localStorage Keys:** Use `openspace.activeProjectId`, `openspace.activeSessionId` (consistent naming)

### Testing During Development
- Use browser console to inject service and call methods
- Use `console.log()` liberally during development (remove in final version)
- Test error paths (invalid IDs, network failures, etc.)

---

## Related Documents

- **TECHSPEC §3.2** — SessionService architecture
- **WORKPLAN Task 1.6** — High-level task description
- **opencode-protocol.ts** — Interface definitions (OpenCodeService, Project, Session, Message)
- **Task 1.4 Result** — Backend RPC wiring (OpenCodeService is available)
- **Task 1.8 Contract** — SyncService will consume SessionService to update state from SSE events

---

**Contract Status:** READY FOR IMPLEMENTATION  
**Next Step:** Delegate to Builder agent for implementation
