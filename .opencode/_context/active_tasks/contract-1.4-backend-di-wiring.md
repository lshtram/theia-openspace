# Contract: Phase 1 Task 1.4 — Backend DI Module Wiring

**Task ID:** 1.4  
**Phase:** Phase 1 (Core Connection + Hub)  
**Agent:** Builder  
**Status:** PENDING  
**Created:** 2026-02-16  
**Dependencies:** 1.2 (OpenCodeProxy), 1.3 (SSE Event Forwarding)

---

## Objective

Wire the backend dependency injection module to expose `OpenCodeService` via JSON-RPC, enabling the frontend to call the OpenCodeProxy methods. Additionally, refactor the current `Object.create()` workaround to use Theia's idiomatic `@postConstruct()` pattern (identified in external review as technical debt).

---

## Context

### Current State
- **OpenCodeProxy** (`openspace-core/src/node/opencode-proxy.ts`): ✅ Complete
  - Implements all 23 REST API methods
  - SSE event forwarding with exponential backoff
  - Uses `@inject` decorators for DI
  - Has `@postConstruct()` init method
  
- **Backend Module** (`openspace-core/src/node/openspace-core-backend-module.ts`): ⚠️ Partial
  - Binds `OpenCodeProxy` to `OpenCodeService` symbol
  - Uses fragile `Object.create()` workaround to bypass InversifyJS constructor
  - Manually sets protected properties with `Object.defineProperty()`
  - **No RPC connection handler registered yet**

### What's Missing
1. **JSON-RPC exposure**: Frontend cannot call backend yet (no `ConnectionHandler` registered)
2. **DI workaround refactoring**: Should use standard InversifyJS pattern with `@postConstruct()`
3. **Client connection setup**: Backend needs to call `setClient()` when frontend connects

---

## Requirements

### Functional Requirements

#### FR1: JSON-RPC Connection Handler
- **Register** `JsonRpcConnectionHandler` for `OpenCodeService` at path `/services/opencode`
- **Path constant** already defined in `opencode-protocol.ts` as `openCodeServicePath`
- **Handler** must connect `OpenCodeService` (backend) to `OpenCodeClient` (frontend callbacks)
- **Lifecycle**: When frontend connects → call `proxy.setClient(client)`; when disconnects → call `proxy.setClient(undefined)`

#### FR2: Refactor DI Binding (External Review Item #3)
- **Remove** `Object.create()` workaround in backend module
- **Use** standard InversifyJS `.to()` binding with `@injectable()` decorator
- **Rely on** `@inject` decorators in OpenCodeProxy constructor (already present)
- **Ensure** `@postConstruct()` init method is called automatically by InversifyJS

#### FR3: Backend Initialization Logging
- **Log** when backend module loads
- **Log** when RPC connection handler is registered
- **Log** when frontend client connects/disconnects (via setClient callbacks)

### Non-Functional Requirements

#### NFR1: Type Safety
- All RPC types must match between `OpenCodeService` and `OpenCodeClient` interfaces
- TypeScript compilation must succeed without errors or warnings

#### NFR2: Idiomatic Theia Patterns
- Use `ConnectionContainerModule` or standard Theia RPC setup pattern
- Follow Theia's DI conventions (no `Object.create()` hacks)

#### NFR3: Resource Cleanup
- When frontend disconnects, backend must call `disconnectSSE()` to close SSE connection
- Prevent resource leaks (open HTTP connections, timers)

---

## Acceptance Criteria

### AC1: RPC Connection Works
- ✅ Backend exposes `OpenCodeService` at `/services/opencode`
- ✅ Frontend can obtain RPC proxy (will be tested in Task 1.6, but backend must be ready)
- ✅ TypeScript build succeeds

### AC2: DI Workaround Removed
- ✅ Backend module uses `.to(OpenCodeProxy).inSingletonScope()` binding
- ✅ No `Object.create()` or `Object.defineProperty()` in backend module
- ✅ InversifyJS handles injection automatically

### AC3: Client Connection Lifecycle
- ✅ When frontend connects → `proxy.setClient(client)` is called → backend logs "Client connected"
- ✅ When frontend disconnects → `proxy.setClient(undefined)` is called → backend logs "Client disconnected"
- ✅ SSE connection cleanup happens on disconnect

### AC4: Build Validation
- ✅ `yarn build` succeeds for all extensions
- ✅ No TypeScript errors in `openspace-core`
- ✅ Backend module loads without runtime errors (verified in later tasks)

---

## Implementation Guidance

### Step 1: Refactor Backend Module Binding

**Current code** (lines 14-31 in `openspace-core-backend-module.ts`):
```typescript
bind<OpenCodeService>(OpenCodeService).toDynamicValue((ctx: interfaces.Context) => {
  const logger = ctx.container.get<ILogger>(ILogger);
  const requestService = ctx.container.get<RequestService>(RequestService);
  const serverUrl = ctx.container.get<string>(OpenCodeServerUrl);

  const proxy = Object.create(OpenCodeProxy.prototype);
  Object.defineProperty(proxy, 'logger', { value: logger, writable: true });
  Object.defineProperty(proxy, 'requestService', { value: requestService, writable: true });
  Object.defineProperty(proxy, 'serverUrl', { value: serverUrl, writable: true });
  Object.defineProperty(proxy, '_client', { value: undefined, writable: true });

  (proxy as OpenCodeProxy).init();

  return proxy as OpenCodeProxy;
}).inSingletonScope();
```

**Refactored code** (idiomatic InversifyJS):
```typescript
// Simply bind to the class - InversifyJS will handle injection
bind<OpenCodeService>(OpenCodeService).to(OpenCodeProxy).inSingletonScope();
```

**Why this works:**
- `OpenCodeProxy` already has `@injectable()` decorator (line 48)
- `OpenCodeProxy` already has `@inject` decorators for dependencies (lines 51-58)
- `@postConstruct()` init method (line 73) will be called automatically by InversifyJS

### Step 2: Register JSON-RPC Connection Handler

**Add this import**:
```typescript
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging';
import { openCodeServicePath, OpenCodeClient } from '../common/opencode-protocol';
```

**Add this binding** (after the OpenCodeService binding):
```typescript
bind(ConnectionHandler).toDynamicValue(ctx => {
  return new JsonRpcConnectionHandler<OpenCodeClient>(
    openCodeServicePath,
    client => {
      const service = ctx.container.get<OpenCodeService>(OpenCodeService);
      service.setClient(client);
      return service;
    }
  );
}).inSingletonScope();
```

**Explanation:**
- `openCodeServicePath` = `/services/opencode` (from protocol file)
- `JsonRpcConnectionHandler` creates bidirectional RPC connection
- `setClient(client)` connects frontend callbacks to backend proxy
- When frontend disconnects, handler calls `dispose()` → SSE cleanup happens

### Step 3: Enhanced Logging

**Update setClient method** in `opencode-proxy.ts` (lines 81-84):
```typescript
setClient(client: OpenCodeClient | undefined): void {
  const wasConnected = this._client !== undefined;
  this._client = client ?? undefined;
  
  if (client) {
    this.logger.info(`[OpenCodeProxy] Frontend client connected`);
  } else {
    this.logger.info(`[OpenCodeProxy] Frontend client disconnected`);
    if (wasConnected) {
      // Clean up SSE connection when frontend disconnects
      this.disconnectSSE();
    }
  }
}
```

**Update backend module** logging:
```typescript
console.log('[OpenSpaceCore] Backend module loaded - OpenCodeService exposed at /services/opencode');
```

---

## File Changes

### Files to Modify

1. **`extensions/openspace-core/src/node/openspace-core-backend-module.ts`**
   - Refactor DI binding (remove Object.create workaround)
   - Register JsonRpcConnectionHandler
   - Update logging

2. **`extensions/openspace-core/src/node/opencode-proxy.ts`**
   - Update `setClient()` method to call `disconnectSSE()` on disconnect
   - Enhanced logging

### Files to Reference

- `extensions/openspace-core/src/common/opencode-protocol.ts` — RPC interfaces and path constant
- External review document: `.opencode/context/01_memory/external-review-2026-02-16.md` — Item #3 (DI workaround)

---

## Testing Strategy

### Unit Tests
- **Not feasible** for DI wiring (requires full Theia container initialization)
- **Manual verification** sufficient for this task

### Integration Testing (Deferred to Task 1.6+)
When SessionService (frontend) is implemented:
1. Frontend obtains RPC proxy via `@inject(OpenCodeService)`
2. Call `proxy.getProjects()` → should reach backend → HTTP call to opencode server
3. Verify backend logs show "Frontend client connected"
4. Close frontend → verify backend logs show "Frontend client disconnected"

### Build Validation
```bash
cd extensions/openspace-core && yarn build
```
Must exit 0 with no TypeScript errors.

---

## Edge Cases

### EC1: Multiple Frontend Connections
- **Scenario**: Multiple browser tabs open Theia simultaneously
- **Expected**: Each connection gets its own RPC client instance, but backend `OpenCodeService` is singleton
- **Behavior**: Only the last connected client receives SSE events (since `setClient()` overwrites)
- **Mitigation**: Not needed for MVP (single-user assumption). Phase 6 can add multi-client support.

### EC2: Frontend Reconnection
- **Scenario**: Frontend loses WebSocket connection, then reconnects
- **Expected**: New RPC connection established → `setClient()` called again → SSE reconnects
- **Behavior**: SSE connection re-established automatically (exponential backoff already implemented)
- **Validation**: Deferred to Phase 1.13 (integration test)

### EC3: Backend Restart
- **Scenario**: Theia backend process restarts (e.g., code reload)
- **Expected**: Frontend WebSocket disconnects → user sees connection error
- **Behavior**: Frontend must re-establish RPC connection manually (or Theia handles auto-reconnect)
- **Mitigation**: Not in scope for Phase 1. Phase 5 can add reconnection UI.

---

## Success Metrics

- ✅ TypeScript build passes
- ✅ Backend module loads without runtime errors
- ✅ RPC connection handler registered at correct path
- ✅ No `Object.create()` or `Object.defineProperty()` in backend module
- ✅ Enhanced logging shows client connect/disconnect events
- ✅ External review item #3 resolved

---

## Dependencies

### Input Dependencies (Ready)
- ✅ Task 1.1: RPC protocol types defined
- ✅ Task 1.2: OpenCodeProxy implemented
- ✅ Task 1.3: SSE event forwarding implemented

### Output Dependencies (Unblocked by this task)
- ⬜ Task 1.5: Hub implementation (backend contribution)
- ⬜ Task 1.6: SessionService (frontend RPC client)
- ⬜ Task 1.9: Frontend DI module wiring

---

## Known Constraints

### C1: Single Client Assumption
- Backend `OpenCodeProxy` maintains only one `_client` reference
- Multi-tab support requires architecture change (Phase 6 scope)

### C2: No Connection Status API
- Backend doesn't expose "is connected to opencode server" status yet
- Will be added in Phase 1.6 when building SessionService

### C3: Hardcoded Server URL
- `DEFAULT_OPENCODE_URL = 'http://localhost:8080'` still hardcoded
- External review item #6: defer to Phase 5.2 (settings UI) or add preference in this task if convenient

---

## References

- **TECHSPEC §3.1.1**: OpenCode Proxy Service
- **TECHSPEC §6.1**: Backend DI Module Structure
- **WORKPLAN Task 1.4**: Backend DI module wiring
- **External Review**: `.opencode/context/01_memory/external-review-2026-02-16.md` — Item #3 (DI workaround)
- **Theia Documentation**: [JSON-RPC Protocol](https://theia-ide.org/docs/json_rpc/)

---

## Deliverables

1. **Modified `openspace-core-backend-module.ts`**: Refactored DI binding + RPC handler
2. **Modified `opencode-proxy.ts`**: Enhanced `setClient()` with cleanup
3. **Result document**: `result-1.4-backend-di-wiring.md` with:
   - Implementation summary
   - Code changes explanation
   - Build verification results
   - Manual verification steps for Task 1.6+
4. **Build verification**: Evidence that `yarn build` succeeds

---

## Builder Instructions

1. **Read this contract thoroughly**
2. **Review external review item #3**: `.opencode/context/01_memory/external-review-2026-02-16.md`
3. **Reference Theia JSON-RPC examples**: Check how other Theia extensions register ConnectionHandler
4. **Implement changes** following Step 1-3 guidance above
5. **Verify build** passes
6. **Document** implementation in result document
7. **Flag** any issues or questions for Oracle

**Ready to proceed!**
