# Contract: Task 1.3 — Implement SSE Event Forwarding (backend)

## Contract ID
`contract-1.3-sse-forwarding`

## Task
**WORKPLAN.md Task 1.3** — Implement SSE event forwarding (backend)

## Source of Truth
- WORKPLAN.md §1.3
- TECHSPEC-THEIA-OPENSPACE.md §3.1.3 (SSE Event Forwarding)
- Task 1.1 types: `session-protocol.ts`
- Task 1.2: OpenCodeProxy

## Deliverable

Extend `extensions/openspace-core/src/node/opencode-proxy.ts` to add SSE event forwarding.

### What to Add

1. **SSE Connection Management**
   - Connect to opencode server's SSE endpoint (`/events` or as documented)
   - Handle reconnection with exponential backoff
   - Clean disconnect on dispose

2. **Event Parsing**
   - Parse SSE events from opencode server
   - Map to typed event objects (SessionEvent, MessageEvent, FileEvent, PermissionEvent)
   - Use types from Task 1.1 (`session-protocol.ts`)

3. **Forward to Frontend**
   - Use `OpenCodeClient` callbacks to forward events
   - `client.onSessionEvent(event)` for session events
   - `client.onMessageEvent(event)` for message events
   - `client.onFileEvent(event)` for file events
   - `client.onPermissionEvent(event)` for permission events

4. **Event Types to Handle**
   - `session.created`, `session.updated`, `session.deleted`
   - `session.init_started`, `session.init_completed`, `session.init_failed`
   - `message.created`, `message.updated`, `message.part_added`, `message.streaming`
   - `file.changed`, `file.created`, `file.deleted`
   - `permission.request`

### Implementation Details

```typescript
// Extend OpenCodeProxy class with:

// SSE connection
protected sseConnection: EventSource | undefined;
protected reconnectAttempts: number = 0;
protected maxReconnectAttempts: number = 5;
protected reconnectDelay: number = 1000; // ms

// Start SSE connection
async connectSSE(): Promise<void>;

// Stop SSE connection
disconnectSSE(): void;

// Handle incoming SSE event
protected handleSSEEvent(event: MessageEvent): void;

// Parse event data
protected parseEventData(data: string): SessionEvent | MessageEvent | FileEvent | PermissionEvent;

// Reconnection with exponential backoff
protected scheduleReconnect(): void;
```

### Constraints

1. **Extend existing file** — Modify `opencode-proxy.ts`, don't create new file
2. **Type-safe** — Use types from Task 1.1
3. **Error handling** — Handle SSE connection failures gracefully
4. **Cleanup** — Properly dispose SSE connection

## Validation

After implementation:
```bash
cd /Users/Shared/dev/theia-openspace && yarn build
```

Must compile without errors in YOUR code.

## Notes

- The opencode server SSE endpoint is typically `/events` or `/sse`
- Use browser's `EventSource` API or a Node-compatible alternative
- Reconnection logic: exponential backoff starting at 1s, max 5 attempts
- Log all events at DEBUG level
