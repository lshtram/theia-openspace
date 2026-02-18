# Contract: Task 1.9 — Frontend DI Module Wiring

**Task ID:** 1.9  
**Owner:** Builder  
**Status:** 🔄 In Progress  
**Created:** 2026-02-16  
**Dependencies:** Tasks 1.6 (SessionService), 1.7 (BridgeContribution), 1.8 (SyncService)

---

## 1. Objective

Wire `openspace-core/src/browser/openspace-core-frontend-module.ts` with all frontend bindings: SessionService, SyncService, BridgeContribution, and register RPC proxy for OpenCodeService. This task integrates all frontend services into Theia's DI container.

**Acceptance Criteria:**
- Frontend module loads without errors
- All services are injectable via `@inject()` decorators
- RPC proxy for OpenCodeService is properly configured
- SyncService is registered as OpenCodeClient implementation (for RPC callbacks)
- BridgeContribution is registered as FrontendApplicationContribution
- No runtime errors during initialization

---

## 2. Architecture Context

### 2.1 DI Container Structure

```
Frontend DI Container
  ├─ SessionService → SessionServiceImpl (singleton)
  ├─ OpenCodeSyncService → OpenCodeSyncServiceImpl (singleton)
  ├─ BridgeContribution → OpenSpaceBridgeContribution (singleton, FrontendApplicationContribution)
  ├─ OpenCodeService → RPC Proxy (to backend)
  └─ OpenCodeClient → Alias to OpenCodeSyncService (for RPC callbacks)
```

### 2.2 RPC Connection

```
Frontend                                Backend
┌─────────────────────────────┐        ┌─────────────────────────────┐
│ OpenCodeService (proxy)     │──RPC──→│ OpenCodeProxy (impl)        │
│   .getProjects()            │        │   .getProjects()            │
│   .createMessage()          │        │   .createMessage()          │
│   ...                       │        │   ...                       │
└─────────────────────────────┘        └─────────────────────────────┘
                                                     │
                                                     │ SSE events
                                                     ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│ OpenCodeClient (impl)       │◀──RPC──│ OpenCodeProxy.setClient()   │
│   = OpenCodeSyncService     │        │   fires callbacks           │
│   .onSessionEvent()         │        │                             │
│   .onMessageEvent()         │        │                             │
│   ...                       │        │                             │
└─────────────────────────────┘        └─────────────────────────────┘
```

---

## 3. Implementation Requirements

### 3.1 File Location

**Path:** `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts`

### 3.2 Required Imports

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { FilterContribution } from '@theia/core/lib/common/contribution-filter';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';

// Existing
import { OpenSpaceFilterContribution } from './filter-contribution';

// Protocol
import { 
    OpenCodeService, 
    OpenCodeClient, 
    openCodeServicePath 
} from '../common/opencode-protocol';

// Services
import { SessionService, SessionServiceImpl } from './session-service';
import { OpenCodeSyncService, OpenCodeSyncServiceImpl } from './opencode-sync-service';
import { OpenSpaceBridgeContribution } from './bridge-contribution';
```

### 3.3 Module Structure

```typescript
export default new ContainerModule((bind, unbind, isBound, rebind) => {
    // 1. Filter contribution (already exists)
    bind(FilterContribution).to(OpenSpaceFilterContribution).inSingletonScope();

    // 2. Core frontend services
    bind(SessionService).to(SessionServiceImpl).inSingletonScope();
    bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();

    // 3. RPC client implementation (callback handler)
    bind(OpenCodeClient).toService(OpenCodeSyncService);

    // 4. RPC proxy to backend
    bind(OpenCodeService).toDynamicValue(ctx => {
        const provider = ctx.container.get(ServiceConnectionProvider);
        return provider.createProxy<OpenCodeService>(openCodeServicePath, ctx.container.get(OpenCodeClient));
    }).inSingletonScope();

    // 5. Application contributions
    bind(FrontendApplicationContribution).to(OpenSpaceBridgeContribution).inSingletonScope();

    console.log('[OpenSpaceCore] Frontend module loaded');
});
```

---

## 4. Binding Details

### 4.1 SessionService Binding

```typescript
bind(SessionService).to(SessionServiceImpl).inSingletonScope();
```

**Purpose:** Register SessionService as singleton so all frontend components share same state.

**Why:** SessionService manages global state (active project, session, messages) that must be consistent across all widgets.

### 4.2 OpenCodeSyncService Binding

```typescript
bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();
```

**Purpose:** Register SyncService as singleton to handle all incoming SSE events.

**Why:** Only one instance should receive RPC callbacks from backend.

### 4.3 OpenCodeClient Binding (Alias)

```typescript
bind(OpenCodeClient).toService(OpenCodeSyncService);
```

**Purpose:** Bind OpenCodeClient symbol to OpenCodeSyncService implementation.

**Why:** The RPC system expects an `OpenCodeClient` binding to know where to send callbacks. `toService()` creates an alias binding that resolves to the same instance as OpenCodeSyncService.

**Important:** This must come AFTER the OpenCodeSyncService binding.

### 4.4 OpenCodeService Binding (RPC Proxy)

```typescript
bind(OpenCodeService).toDynamicValue(ctx => {
    const provider = ctx.container.get(ServiceConnectionProvider);
    return provider.createProxy<OpenCodeService>(openCodeServicePath, ctx.container.get(OpenCodeClient));
}).inSingletonScope();
```

**Purpose:** Create RPC proxy that forwards method calls to backend OpenCodeProxy.

**Parameters:**
- `openCodeServicePath` — RPC endpoint path (`'/services/opencode'`)
- Second argument — OpenCodeClient instance (for receiving callbacks)

**Why dynamic value:**
- Need access to DI container to get ServiceConnectionProvider
- Need to pass OpenCodeClient instance as callback target
- Proxy is created once and cached (singleton scope)

**RPC Flow:**
1. Frontend calls `openCodeService.getProjects()`
2. Proxy serializes call → sends to backend via JSON-RPC
3. Backend OpenCodeProxy.getProjects() executes
4. Response serialized → sent back to frontend
5. Proxy deserializes → returns result

**Callback Flow:**
1. Backend receives SSE event from opencode server
2. Backend calls `client.onMessageEvent(event)` (RPC callback)
3. RPC system looks up OpenCodeClient binding
4. Finds OpenCodeSyncService instance (via alias)
5. Calls `syncService.onMessageEvent(event)`

### 4.5 BridgeContribution Binding

```typescript
bind(FrontendApplicationContribution).to(OpenSpaceBridgeContribution).inSingletonScope();
```

**Purpose:** Register BridgeContribution as a FrontendApplicationContribution so it runs on startup.

**Why:** BridgeContribution needs to:
- Collect commands from CommandRegistry on startup
- Publish manifest to Hub
- Connect to Hub SSE endpoint
- Dispatch agent commands

**Lifecycle:** Theia automatically calls `onStart()` on all FrontendApplicationContribution instances during app initialization.

---

## 5. Initialization Order

When frontend loads, Theia will:

1. **Load module** — Execute `ContainerModule` callback, register all bindings
2. **Instantiate singletons** (on first injection):
   - SessionService (via `@postConstruct` → restores from localStorage)
   - OpenCodeSyncService (no initialization needed)
   - BridgeContribution (constructed but not started yet)
3. **Create RPC proxy** — ServiceConnectionProvider connects to backend WebSocket
4. **Backend registers client** — OpenCodeProxy.setClient(syncService) via RPC
5. **Start contributions** — Theia calls `bridgeContribution.onStart()`:
   - Collects commands from CommandRegistry
   - POSTs manifest to Hub
   - Connects to Hub SSE endpoint
6. **System ready** — Frontend can now send/receive messages

---

## 6. Error Handling Requirements

1. **Module load errors:** If any binding fails, log error with `console.error('[OpenSpaceCore] ...')`
2. **RPC connection errors:** ServiceConnectionProvider handles reconnection automatically
3. **Service initialization errors:** If SessionService or SyncService fail to construct, app should log error but continue (graceful degradation)

**Note:** Theia's DI system will throw if bindings are malformed. Ensure all imports are correct.

---

## 7. Testing Strategy

### 7.1 Verification (Manual)

After implementation:

1. **Build:** `yarn build:browser` — should succeed with no errors
2. **Start:** `yarn start:browser` — should launch without errors
3. **Check console:** Should see `[OpenSpaceCore] Frontend module loaded`
4. **No runtime errors:** Browser console should not show DI resolution errors

### 7.2 Injection Test

Add temporary test in BridgeContribution.onStart():

```typescript
console.debug('[BridgeContribution] SessionService injected:', !!this.sessionService);
console.debug('[BridgeContribution] OpenCodeService injected:', !!this.openCodeService);
```

Expected output:
```
[BridgeContribution] SessionService injected: true
[BridgeContribution] OpenCodeService injected: true
```

### 7.3 RPC Test

Add temporary test in BridgeContribution.onStart():

```typescript
const projects = await this.openCodeService.getProjects();
console.debug('[BridgeContribution] RPC test: projects =', projects);
```

**Expected:**
- If opencode server running: Returns array of projects
- If opencode server NOT running: Connection error (logged, no crash)

**Important:** Remove test logging after verification.

---

## 8. Common Pitfalls to Avoid

### 8.1 Wrong Binding Order

❌ **WRONG:**
```typescript
bind(OpenCodeClient).toService(OpenCodeSyncService);
bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();
// ↑ toService() called before target binding exists
```

✅ **CORRECT:**
```typescript
bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();
bind(OpenCodeClient).toService(OpenCodeSyncService);
// ↑ toService() called after target binding exists
```

### 8.2 Missing Callback Target in Proxy Creation

❌ **WRONG:**
```typescript
provider.createProxy<OpenCodeService>(openCodeServicePath)
// ↑ No callback target — backend callbacks will fail
```

✅ **CORRECT:**
```typescript
provider.createProxy<OpenCodeService>(openCodeServicePath, ctx.container.get(OpenCodeClient))
// ↑ Passes OpenCodeClient (SyncService) as callback target
```

### 8.3 Forgetting Singleton Scope

❌ **WRONG:**
```typescript
bind(SessionService).to(SessionServiceImpl);
// ↑ Creates new instance on every injection — state is not shared
```

✅ **CORRECT:**
```typescript
bind(SessionService).to(SessionServiceImpl).inSingletonScope();
// ↑ Single instance shared across all injections
```

---

## 9. Dependencies Verification

Before implementing, verify these files exist:

- ✅ `extensions/openspace-core/src/browser/session-service.ts` (Task 1.6)
- ✅ `extensions/openspace-core/src/browser/opencode-sync-service.ts` (Task 1.8)
- ✅ `extensions/openspace-core/src/browser/bridge-contribution.ts` (Task 1.7)
- ✅ `extensions/openspace-core/src/common/opencode-protocol.ts` (Task 1.1)
- ✅ `extensions/openspace-core/src/browser/filter-contribution.ts` (Phase 0)

---

## 10. Acceptance Checklist

- [ ] All imports added correctly
- [ ] SessionService bound as singleton
- [ ] OpenCodeSyncService bound as singleton
- [ ] OpenCodeClient bound as alias to OpenCodeSyncService
- [ ] OpenCodeService bound as RPC proxy with callback target
- [ ] BridgeContribution bound as FrontendApplicationContribution
- [ ] Module loads without errors (`yarn build:browser` succeeds)
- [ ] App starts without errors (`yarn start:browser` succeeds)
- [ ] Console shows `[OpenSpaceCore] Frontend module loaded`
- [ ] No DI resolution errors in browser console

---

## 11. Future Enhancements (Post-Phase 1)

1. **PaneService binding** — Task 2.x will add PaneService for agent-controlled layout
2. **PermissionService binding** — Task 1.14 will add permission request handling
3. **Multiple project support** — Future phases may need ProjectManager service

---

## 12. Contract Approval

**Oracle:** Approved for Builder implementation  
**Builder:** Ready to implement  
**Janitor:** Contract review pending  
**CodeReviewer:** Contract review pending

---

## 13. References

- **WORKPLAN:** `docs/architecture/WORKPLAN.md` — Task 1.9 (lines 196-202)
- **TECHSPEC:** `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` — §3.1.1 RPC Protocols
- **Theia Docs:** ServiceConnectionProvider API
- **SessionService:** `extensions/openspace-core/src/browser/session-service.ts`
- **SyncService:** `extensions/openspace-core/src/browser/opencode-sync-service.ts`
- **BridgeContribution:** `extensions/openspace-core/src/browser/bridge-contribution.ts`

---

**END OF CONTRACT**
