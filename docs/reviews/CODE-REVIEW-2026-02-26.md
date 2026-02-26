# Architectural Code Review: theia-openspace
*Focus: architecture, modularity, replaceability · 2026-02-26*

---

## A. Architecture Assessment

### Frontend / Backend / Protocol Split

The three-layer split is structurally sound and follows Theia conventions correctly:

1. **Backend** (`openspace-core/src/node/`): `OpenCodeProxy` implements `OpenCodeService`, holding SSE connections and HTTP client calls against the external opencode REST API.
2. **Protocol** (`openspace-core/src/common/opencode-protocol.ts`): defines `OpenCodeService` (RPC service) and `OpenCodeClient` (callback interface) for Theia's `JsonRpcConnectionHandler` machinery.
3. **Frontend** (`openspace-core/src/browser/`): `SessionService` (application state), `OpenCodeSyncService` (RPC callback handler), and the React widgets in `openspace-chat`.

`openspace-core-backend-module.ts` wires it cleanly: one proxy, one RPC handler, one Hub.

**One flaw with significant downstream consequences:** the `OpenCodeService` interface in `opencode-protocol.ts` has a `projectId` parameter on virtually every method (lines 197–276), but the implementation in `opencode-proxy.ts` silently ignores it on every single call (parameters are prefixed `_projectId` throughout). The opencode REST API is session-global, not project-scoped, so `projectId` carries no information and could be removed. Instead it is copied everywhere, adding noise to every call site and creating the false appearance of project isolation where there is none.

### DI Structure

The DI wiring is appropriate for Theia but carries three notable workarounds:

**Circular dependency between `SessionService` and `OpenCodeSyncService`** is the most significant. The cycle is:
```
OpenCodeSyncService → SessionService → OpenCodeService → OpenCodeClient → OpenCodeSyncService
```
Broken by wiring imperatively via a setter called from `BridgeContribution.onStart()`. This requires an event queue (`_pendingEvents` in `opencode-sync-service.ts:94`) to buffer events that arrive before wiring completes.

**`SessionNotificationService`** is wired by a second anonymous `FrontendApplicationContribution` in `openspace-core-frontend-module.ts:75–81`, calling `sessionService.setNotificationService()` during `onStart`.

**`SessionServiceWiring` symbol** (`openspace-core-frontend-module.ts:39, 70`) exists solely to document an intent that was never executed — it binds `null`. Dead infrastructure.

### Module Boundaries

`openspace-core` is doing the right things. `openspace-chat`, `openspace-voice`, `openspace-languages`, `openspace-viewers`, and `openspace-settings` are separate packages with separate DI modules. Chat depends on core but not vice versa — correct direction. The voice extension's internal coupling is the main exception (see §B).

---

## B. Modularity Analysis

### Well-encapsulated modules ✅

- **`openspace-core/src/node/hub.ts`**: Self-contained Hub. Owns its Express routes, rate limiter, and MCP bridge. Exposes only `setClientCallback()` and `configure()`. `RateLimiter` correctly exported for testing.
- **`packages/voice-core/`**: Notably well-structured. `SttProvider` and `TtsProvider` are clean interfaces in `src/providers/`. FSMs isolated in `src/fsm/`, adapters in `src/adapters/`. No Theia dependency — genuinely portable.
- **`opencode-protocol.ts`**: Clean protocol file. Events are typed, notifications are specific. `OpenCodeService` (service) / `OpenCodeClient` (callback) split is idiomatic Theia RPC.
- **`SessionNotificationService`** (`notification-service.ts`): Small, single-purpose, 96 lines — a model for what other services should look like.

### God objects ❌

**`SessionServiceImpl`** is the primary god object. At ~2,100 lines and 50+ public interface members, it owns:
- Active project/session/model state
- Message list management
- Streaming state machines (three overlapping ones — see §D)
- SSE reconnect fallback timers
- Optimistic update logic and rollback
- Hub readiness polling
- MCP config file reading (`getMcpConfig` — reads filesystem in a browser-side service)
- Streaming status computation (tool-name-to-category mapping)
- Pending question/permission management
- Todo list management
- Session pagination state
- `localStorage` persistence

**`ChatComponent` in `chat-widget.tsx`** is the second major concentration. At ~600 lines of React function body (lines 544–1244), it manages all session operation handlers, permission reply, file open, shell command execution, message queuing with drain logic, throttled streaming updates, model preference reading, and the full render tree.

### Coupling hotspots ⚠️

1. **`opencode-proxy.ts` leaks streaming protocol knowledge**: The proxy tracks `lastStreamingPartMessageId` (line 90), `userMessageIds` (line 99), and performs message role detection and streaming-stub ID correlation (lines 941–962). This is routing logic that belongs in the sync layer, not the transport layer.

2. **`OpenCodeSyncService` private field access via casting** (`opencode-sync-service.ts:353–354`): Casts `SessionService` to a structural type to reach `_notificationService`. A coupling violation — reaching into private implementation because no public API exists.

3. **Voice extension hardcodes DOM class name**: `openspace-voice-frontend-module.ts:34` queries `document.querySelector('.prompt-input-editor')` to inject text. The voice extension is coupled to the CSS class name of the chat widget's input element. Silent failure if the class name changes.

---

## C. Replaceability Assessment

### Replace the AI backend (swap opencode for another)
**Moderately hard.** `OpenCodeService`/`OpenCodeProxy` is the right boundary, but the interface is shaped entirely around opencode's REST API surface (`replyPermission`, `forkSession`, `revertSession`, `unrevertSession`, etc.). The `Message` type is an intersection with opencode SDK types. The `projectId` fiction must be reconciled. A different backend would require either a heavy adapter layer or a protocol rewrite.

### Replace the chat UI framework
**Very hard.** `ChatWidget` extends Theia's `ReactWidget`, which mandates Theia-bundled React. The React component tree (`ChatComponent`, `MessageTimeline`, `MessageBubble`) has no custom framework dependency, but lives inside Theia's widget system. Swap requires replacing the widget base class.

### Replace SSE transport (use WebSocket)
**Moderate.** SSE is entirely in `opencode-proxy.ts` inside `establishSSEConnection()` (lines 655–767) and `handleSSEEvent()` (lines 805–845). `eventsource-parser` is the only SSE-specific library. Self-contained change inside the proxy. The streaming stub state (`lastStreamingPartMessageId`, `userMessageIds`) would still need to exist because it compensates for opencode backend protocol quirks, not the transport choice.

### Replace the voice engine
**Easy for the core, harder for the integration.** `SttProvider`/`TtsProvider` interfaces are genuinely abstract — adding a new adapter means implementing 3 methods. But the DI module wires adapters via hardcoded HTTP endpoints (`/openspace/voice/stt`, `/openspace/voice/narrate`) and constructs FSMs directly with closures rather than through a `VoiceService` abstraction.

### Missing interfaces that would help

- No `MessageStore`/`MessageRepository` interface — message management is embedded in `SessionService`
- No `StreamingCoordinator` interface — streaming state machine is split across `SessionService` and `OpenCodeSyncService`
- No `AIBackend`/`ConversationService` interface above `OpenCodeService` — the RPC proxy is the lowest abstraction
- No `EventBus`/`NotificationBus` — all routing goes directly from `SyncService` into concrete `SessionService` methods
- No `ChatInputService` — voice couples to DOM class names instead of a DI-injectable input abstraction

---

## D. Development Velocity Risks

### 1. `SessionService` will continue growing
Every new backend feature requires adding to the 50+ member interface, the 2,100-line implementation, and threading through `OpenCodeSyncService`. This is the primary growth bottleneck.

### 2. Streaming state machine is split across three sites
Three overlapping streaming update paths:
- `updateStreamingMessage()` — legacy `message.part.updated` events
- `applyPartDelta()` — newer `message.part.delta` per-token path
- `updateStreamingMessageParts()` — for tool parts

All three independently manage `_isStreaming`, `_streamingMessageId`, and `_streamingDoneTimer`. Any streaming behavior change requires understanding and coordinating all three.

### 3. The SSE fallback dual-delivery adds hidden complexity
`sendMessage()` starts a 5-second timer to insert the message if SSE hasn't delivered it. `appendMessage()` and `applyPartDelta()` each cancel this timer independently. `fetchAndInsertFallbackMessage()` then fetches the full message via RPC. Three layers of delivery guarantee for one conceptual operation. Regressions manifest as duplicate-message bugs that are hard to trace.

### 4. `as unknown as` casts expose undeclared SDK fields
At least 14 `as unknown as` casts in `chat-widget.tsx` alone — accessing `parentID`, `revert`, `share.url` fields that exist on opencode SDK types but are not declared in the protocol types. When the opencode SDK changes these fields, the casts silently produce `undefined` at runtime with no TypeScript error.

### 5. `localStorage` calls are scattered
`window.localStorage` appears at 7+ locations across `SessionService` and `SessionNotificationService` with no persistence abstraction. Cannot test `SessionService` in isolation without mocking `window`, and cannot swap storage backends without touching `SessionService` directly.

### 6. Voice injects via deprecated `document.execCommand`
`openspace-voice-frontend-module.ts:48`: `document.execCommand('insertText', ...)` is deprecated. If `PromptInput` switches from contentEditable to controlled React input or `<textarea>`, voice injection silently fails.

---

## E. Specific Findings with Implementation Proposals

---

### 🔴 Critical

---

#### E1. `renameSession` declared twice in `OpenCodeService` interface

**Finding:** `opencode-protocol.ts:211 and :222` both declare `renameSession(projectId, sessionId, title): Promise<Session>`. TypeScript silently allows duplicate interface members. Find-all-usages and go-to-definition produce ambiguous results.

**Proposal — trivial fix:**
```typescript
// opencode-protocol.ts — remove the second declaration at line 222
// Keep only one (line 211):
renameSession(projectId: string, sessionId: string, title: string): Promise<Session>;
```
The proxy implementation (`opencode-proxy.ts`) only has one implementation, so the duplicate is purely in the interface. Delete one line.

**Effort:** 5 minutes. **Risk:** None.

---

#### E2. `getMcpConfig()` calls `fs.readFileSync` inside a browser-side service

**Finding:** `session-service.ts:322–352` reads `opencode.json` from the filesystem using `fs` inside a browser bundle, guarded by a fragile runtime check. Config reading belongs on the backend.

**Proposal — move to backend, pass through `connectToProject`:**

1. **`opencode-proxy.ts`** — add `getMcpConfig()` that reads and returns the config:
   ```typescript
   async getMcpConfig(directory: string): Promise<McpConfig | undefined> {
     const configPath = path.join(directory, 'opencode.json');
     try {
       const raw = fs.readFileSync(configPath, 'utf-8');
       return JSON.parse(raw) as McpConfig;
     } catch {
       return undefined;
     }
   }
   ```

2. **`opencode-protocol.ts`** — add to `OpenCodeService`:
   ```typescript
   getMcpConfig(directory: string): Promise<McpConfig | undefined>;
   ```

3. **`session-service.ts`** — replace the inline `getMcpConfig()` method body with an RPC call:
   ```typescript
   private async getMcpConfig(): Promise<McpConfig | undefined> {
     if (!this._activeProject) return undefined;
     return this.openCodeService.getMcpConfig(this._activeProject.directory);
   }
   ```
   Delete the entire `fs`-based implementation and the `import * as fs` statement.

4. **Tests:** The existing `getMcpConfig` unit tests in `session-service` can be replaced with a test that verifies the RPC call is made with the correct directory.

**Effort:** 2–3 hours. **Risk:** Low — same data, different transport.

---

#### E3. `OpenCodeSyncService` reaches into `SessionService`'s private field via a cast

**Finding:** `opencode-sync-service.ts:353–354` casts `SessionService` to reach `_notificationService`. Silent no-op if the field is renamed.

**Proposal — add a one-line public method:**

```typescript
// session-service.ts interface (public API):
incrementUnseenForSession(sessionId: string): void;

// SessionServiceImpl:
incrementUnseenForSession(sessionId: string): void {
  this._notificationService?.incrementUnseen(sessionId);
}
```

```typescript
// opencode-sync-service.ts — replace the cast:
// Before:
(this.sessionService as { _notificationService?: ... })._notificationService?.incrementUnseen(...)
// After:
this.sessionService.incrementUnseenForSession(event.sessionId);
```

**Effort:** 15 minutes. **Risk:** None.

---

#### E4. `ChatComponent` calls `openCodeService` directly, bypassing `SessionService`

**Finding:** `chat-widget.tsx:990` (`openCodeService.sessionCommand`) and `:1012` (`openCodeService.compactSession`) bypass `SessionService` state tracking. The `/compact` slash command does not trigger `SessionService.compactSession()`, so `reloadMessages()` is never called and the UI does not refresh.

**Proposal — route everything through `SessionService`:**

1. Verify `SessionService` has a `runCommand(command: string)` or equivalent that wraps `openCodeService.sessionCommand`. If not, add it:
   ```typescript
   // session-service.ts interface:
   runCommand(command: string, args?: string[]): Promise<void>;

   // SessionServiceImpl:
   async runCommand(command: string, args?: string[]): Promise<void> {
     if (!this._activeSession || !this._activeProject) return;
     await this.openCodeService.sessionCommand(
       this._activeProject.id, this._activeSession.id, command, args
     );
   }
   ```

2. In `chat-widget.tsx`, replace the two direct calls:
   ```typescript
   // Before (line 990):
   await openCodeService.sessionCommand(projectId, sessionId, cmd, args);
   // After:
   await sessionService.runCommand(cmd, args);

   // Before (line 1012):
   await openCodeService.compactSession(projectId, sessionId);
   // After:
   await sessionService.compactSession();  // already exists, just use it
   ```

3. Write a test confirming that the slash command `/compact` results in `sessionService.compactSession()` being called, and that `reloadMessages()` is subsequently triggered via the SSE event.

**Effort:** 2–3 hours. **Risk:** Low — behaviour should be identical, adds missing state tracking.

---

### 🟡 Major

---

#### E5. `projectId` parameter present everywhere but ignored everywhere

**Finding:** Every `OpenCodeService` method carries `projectId` as first argument. Every proxy implementation prefixes it `_projectId` and ignores it. The opencode backend is session-global.

**Proposal — remove in two stages:**

**Stage 1 (safe, can be done now):** Add a lint rule or comment block at the top of `opencode-protocol.ts`:
```typescript
/**
 * NOTE: projectId parameters are carried for forward-compatibility only.
 * The opencode REST API is currently session-global (not project-scoped).
 * All proxy implementations ignore this parameter (_projectId prefix).
 * Do NOT add new per-project logic relying on projectId until the opencode
 * backend exposes per-project endpoints.
 */
```
This prevents contributors from being confused or from building new logic on the wrong assumption.

**Stage 2 (cleanup sprint):** Once the parity phases are complete, do a single PR that removes `projectId` from every method signature and every call site. The change is mechanical (global search-and-replace) and purely cosmetic — zero behaviour change. This is a good "new contributor" task since it's safe and teaches the whole protocol surface.

**Effort:** 5 min (Stage 1) + 2–3 hours (Stage 2). **Risk:** Stage 2 is pure rename — no logic change.

---

#### E6. `SessionService` interface exposes internal mutation methods as public API

**Finding:** `appendMessage`, `updateStreamingMessage`, `replaceMessage`, `applyPartDelta`, and similar methods are on the public `SessionService` interface. A UI widget calling `appendMessage` would corrupt streaming state.

**Proposal — split the interface:**

Create a second, narrower interface for the mutations that only `SyncService` receives:

```typescript
// session-service.ts — new interface alongside existing SessionService:
export const SessionMutator = Symbol('SessionMutator');

export interface SessionMutator {
  appendMessage(message: Message): void;
  replaceMessage(messageId: string, message: Message): void;
  updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void;
  updateStreamingMessageParts(messageId: string, toolParts: ToolPart[]): void;
  applyPartDelta(messageId: string, partIndex: number, delta: string, isDone: boolean): void;
  clearStreamingPartText(messageId: string): void;
  notifySessionChanged(session: Session): void;
  notifySessionDeleted(sessionId: string): void;
  incrementUnseenForSession(sessionId: string): void;
}
```

`SessionServiceImpl` implements both `SessionService` and `SessionMutator`.

```typescript
// openspace-core-frontend-module.ts — add binding:
bind(SessionMutator).toService(SessionService);

// opencode-sync-service.ts — change injection:
@inject(SessionMutator)
protected readonly sessionMutator!: SessionMutator;
// Use sessionMutator for all mutation calls, sessionService for reads
```

**Result:** `ChatWidget`, `SessionsWidget`, and other UI consumers inject `SessionService` and can only call read/command methods. `SyncService` injects `SessionMutator` and can only call mutation methods. TypeScript enforces the boundary at compile time.

**Effort:** 1 day (interface split + DI rebind + all injection points updated). **Risk:** Medium — touches many files but no logic changes.

---

#### E7. `toolNameToCategory` streaming status mapping embedded in `SessionService`

**Finding:** `session-service.ts:1892–1901` contains a regex-based mapping from tool names to display categories. Display logic in the state service; needs updating for every new tool.

**Proposal — extract to a pure utility:**

```typescript
// New file: extensions/openspace-chat/src/browser/streaming-status.ts
export type StreamingCategory = 'bash' | 'task' | 'todo' | 'search' | 'web' | 'edit' | 'mcp' | 'thinking';

const CATEGORY_PATTERNS: Array<[RegExp, StreamingCategory]> = [
  [/bash|shell|terminal|exec/i,          'bash'],
  [/task|agent|spawn/i,                  'task'],
  [/todo/i,                              'todo'],
  [/search|grep|glob|find/i,            'search'],
  [/webfetch|browser|url/i,             'web'],
  [/edit|write|patch|create.*file/i,    'edit'],
  [/mcp/i,                               'mcp'],
  [/think|reason/i,                     'thinking'],
];

export function toolNameToCategory(toolName: string): StreamingCategory | undefined {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(toolName)) return category;
  }
  return undefined;
}
```

- Move `toolNameToCategory` call sites in `session-service.ts` to import from this file.
- The function is now a pure function with no dependencies — trivially testable.
- Adding support for a new tool is a one-line addition to `CATEGORY_PATTERNS` with no `SessionService` changes.
- Move the file to `openspace-chat` (not `openspace-core`) since it is display categorisation, not core state logic.

**Effort:** 2 hours. **Risk:** None — pure refactor with no behaviour change.

---

#### E8. `OpenCodeProxy` accumulates streaming correlation state

**Finding:** `opencode-proxy.ts:89–99` tracks `lastStreamingPartMessageId` and `userMessageIds` — streaming protocol correlation state that belongs in `SyncService`.

**Proposal — move correlation into `OpenCodeSyncService`:**

The proxy should forward raw SSE events. `SyncService` should interpret them.

1. **`opencode-proxy.ts`** — remove `lastStreamingPartMessageId`, `userMessageIds`, and the correlation logic in `handleSSEEvent`. Forward the raw event fields as-is.

2. **`opencode-sync-service.ts`** — add the correlation state that was in the proxy:
   ```typescript
   private _lastStreamingPartMessageId: string | undefined;
   private readonly _userMessageIds = new Set<string>();
   ```
   The existing `handleSSEEvent` dispatch logic moves here verbatim. The proxy is reduced to a pure transport.

3. **Why this helps:** SSE transport bugs and streaming protocol bugs are now in different files. A future WebSocket implementation would not need to re-implement correlation. Tests for correlation logic can mock the proxy as a dumb event forwarder.

**Effort:** 1 day (move state + update tests). **Risk:** Medium — touches the streaming critical path; requires careful integration testing.

---

#### E9. Session list loading duplicated between `SessionsWidget` and `ChatWidget`

**Finding:** Both widgets subscribe to the same events and independently call `loadSessions()`. May produce visual inconsistency.

**Proposal — expose a single `onSessionListChanged` event from `SessionService`:**

```typescript
// session-service.ts interface — add:
readonly onSessionListChanged: Event<Session[]>;
```

`SessionServiceImpl` fires this whenever the session list is mutated (after create, delete, archive, fork, load-more). Both `SessionsWidget` and `ChatWidget` subscribe to `onSessionListChanged` instead of deriving list changes from `onActiveSessionChanged`.

The practical steps:
1. Add `onSessionListChangedEmitter = new Emitter<Session[]>()` to `SessionServiceImpl`.
2. Call `this.onSessionListChangedEmitter.fire(this._sessions)` in `_setSessions()` (the single internal setter already used by load paths).
3. In `SessionsWidget`: subscribe to `onSessionListChanged` instead of manually triggering reload on every session switch.
4. In `ChatWidget`'s `ChatHeaderBar`: same.
5. Delete the duplicated `loadSessions()` call logic from both widgets.

**Effort:** 3–4 hours. **Risk:** Low — additive change, the load paths still work, the event just makes the output observable.

---

#### E10. Voice DI module swallows errors silently

**Finding:** FSM bindings in `openspace-voice-frontend-module.ts` use `try/catch` inside `toDynamicValue` factories. If `VoiceCommandContribution` fails to bind, the catch silently returns a no-op closure.

**Proposal — use `postConstruct` lifecycle hook instead of `try/catch` in factory:**

```typescript
// Instead of try/catch in toDynamicValue, use a VoiceOrchestrator service
// that wires the FSMs in @postConstruct() where DI is fully resolved:

@injectable()
class VoiceOrchestrator implements FrontendApplicationContribution {
  @inject(AudioFsm) private readonly audioFsm!: AudioFsm;
  @inject(NarrationFsm) private readonly narrationFsm!: NarrationFsm;
  @inject(VoiceCommandContribution) private readonly commands!: VoiceCommandContribution;

  @postConstruct()
  protected init(): void {
    // Wire FSMs to command contribution here — DI guarantees all are resolved
    this.commands.setFsms(this.audioFsm, this.narrationFsm);
  }

  async onStart(): Promise<void> {
    // Start FSMs
  }
}
```

This eliminates the `try/catch` pattern entirely. If `VoiceCommandContribution` fails to bind, the DI container throws at resolution time with a clear error, not at runtime with a silent no-op.

**Effort:** 3–4 hours. **Risk:** Low — the FSM wiring logic is the same, just moved to a lifecycle hook.

---

### 🔵 Minor

---

#### E11. Hardcoded Hub port `localhost:3000`

**Finding:** `session-service.ts:176`: `HUB_MCP_URL = 'http://localhost:3000/mcp'`. Hub port varies with Theia port.

**Proposal:**
```typescript
// Replace:
private readonly HUB_MCP_URL = 'http://localhost:3000/mcp';
// With:
private readonly HUB_MCP_URL = `${window.location.origin}/mcp`;
```
This matches how `bridge-contribution.ts:67` already constructs Hub URLs. One line.

**Effort:** 5 minutes. **Risk:** None.

---

#### E12. `SessionServiceWiring` symbol is dead

**Finding:** `openspace-core-frontend-module.ts:39, 70` binds `SessionServiceWiring` to `null`. Nothing injects it.

**Proposal:** Delete the symbol declaration, the `bind(SessionServiceWiring).toConstantValue(null)` line, and the export in `openspace-core-frontend-module.ts`. Remove the import wherever it appears.

**Effort:** 5 minutes. **Risk:** None.

---

#### E13. `console.log` in production paths in `opencode-proxy.ts`

**Finding:** `requestJson` unconditionally logs `FETCH_START/FAIL/SUCCESS` via `console.log` for every HTTP call.

**Proposal:**
```typescript
// Replace three console.log calls with:
this.logger.debug(`[OpenCodeProxy] ${FETCH_START} ${method} ${path}`);
this.logger.debug(`[OpenCodeProxy] ${FETCH_SUCCESS} ${method} ${path}`);
this.logger.warn(`[OpenCodeProxy] ${FETCH_FAIL} ${method} ${path}: ${err}`);
```
Theia's logger respects the configured log level — debug messages are suppressed in production by default.

**Effort:** 10 minutes. **Risk:** None.

---

#### E14. `onFileEvent` has been a stub since Phase 1

**Finding:** Every case in `opencode-sync-service.ts:657–677` logs "no action in Phase 1."

**Proposal:** Either implement or formally defer with a GitHub issue.

**Minimal useful implementation:**
```typescript
// opencode-sync-service.ts — replace the stub switch with:
case 'file.write':
case 'file.delete':
case 'file.move': {
  // Notify Theia's file service so open editors auto-refresh
  const uri = new URI(event.path).withScheme('file');
  this.fileService.fireFilesChanged({
    changes: [{ uri, type: FileChangeType.UPDATED }]
  });
  break;
}
```
This requires injecting `FileService` from `@theia/filesystem`. The practical benefit: files edited by the agent will refresh in open editors without the user manually closing and reopening.

**Effort:** 3–4 hours including tests. **Risk:** Low.

---

#### E15. `Session.title` used without null guard

**Finding:** `session.title` used in display contexts where it may be `undefined`.

**Proposal:** Apply a consistent display fallback everywhere:
```typescript
// Create a one-line utility in session-service.ts or a utils file:
export function sessionDisplayTitle(session: Session): string {
  return session.title?.trim() || `Session ${session.id.slice(0, 8)}`;
}
```
Replace all bare `session.title` usages in `sessions-widget.tsx`, `chat-widget.tsx`, and `message-timeline.tsx` with `sessionDisplayTitle(session)`.

**Effort:** 1 hour. **Risk:** None.

---

## F. Summary Scorecard

| Dimension | Rating | Notes |
|---|---|---|
| Frontend/backend split | ✅ Good | Correct Theia layering |
| Protocol design | ⚠️ Acceptable | `projectId` fiction; missing higher-level abstractions |
| DI structure | ⚠️ Acceptable | Circular dep workarounds functional but fragile |
| Module separation | ⚠️ Mixed | `voice-core` excellent; `SessionService` is a god object |
| Replaceability | ❌ Weak | No AI backend / streaming / message store abstractions |
| Streaming subsystem | ❌ Weak | Three overlapping state machines; fallback complexity |
| Type safety | ⚠️ Mixed | Protocol types good; `as unknown as` casts undermine chat |
| Testability | ⚠️ Mixed | Core services tested; `SessionService` hard to unit-test in isolation |
| Development velocity | ⚠️ Declining | `SessionService` growth will slow future feature work |

---

## G. Target Architecture: What "Great" Looks Like

Before the phased plan, here is the target state — the architecture that emerges after the refactors are complete.

```
openspace-core/src/browser/
  ├─ session-service.ts           (≤600 lines)
  │    Responsibility: WHICH session/project/model is active.
  │    Session CRUD commands (create, delete, archive, fork, revert, compact).
  │    Event hub: onSessionListChanged, onActiveSessionChanged, onSessionStatusChanged.
  │    Does NOT own messages, streaming state, or persistence.
  │
  ├─ message-store.ts             (new, ~200 lines)
  │    Responsibility: WHAT messages exist for the active session.
  │    append(), replace(), getAll(), getById().
  │    Fires onMessagesChanged.
  │    Separately injectable and independently testable.
  │
  ├─ streaming-coordinator.ts     (new, ~300 lines)
  │    Responsibility: HOW streaming tokens arrive and assemble into messages.
  │    Owns: _isStreaming, _streamingMessageId, _streamingDoneTimer.
  │    Owns: all three streaming update paths (unified into one).
  │    Owns: the 5s SSE fallback timer.
  │    Fires onStreamingStateChanged.
  │
  ├─ pending-operations.ts        (new, ~150 lines)
  │    Responsibility: in-flight questions and permissions.
  │    Queue of PendingQuestion[], PendingPermission[].
  │    add(), remove(), getAll(), reply().
  │
  ├─ session-persistence.ts       (new, ~100 lines)
  │    Responsibility: localStorage reads/writes.
  │    save(key, value), load(key), clear(key).
  │    Mockable in tests — no window.localStorage calls outside this file.
  │
  ├─ notification-service.ts      (existing — already correct)
  │
  ├─ session-mutator.ts           (new interface, ~20 lines)
  │    Interface implemented by SessionServiceImpl + MessageStore + StreamingCoordinator.
  │    Only injected by OpenCodeSyncService.
  │
  └─ streaming-status.ts          (moved from session-service.ts)
       Pure function toolNameToCategory(). No dependencies. Testable.

openspace-core/src/node/
  ├─ opencode-proxy.ts            (≤600 lines — pure transport)
  │    No streaming correlation state.
  │    Forwards raw SSE events, makes HTTP calls, that's it.
  │
  └─ hub.ts                       (already correct)

openspace-chat/src/browser/
  ├─ chat-widget.tsx              (≤300 lines React function body)
  │    Uses custom hooks, delegates to SessionService for all operations.
  │    Never calls openCodeService directly.
  │
  ├─ hooks/
  │    ├─ use-session-operations.ts   (handlers: new, delete, fork, rename, etc.)
  │    ├─ use-message-queue.ts        (drain/throttle during streaming)
  │    └─ use-streaming-state.ts      (subscribes to StreamingCoordinator events)
  │
  └─ chat-input-service.ts        (new, ~30 lines)
       Interface: insertText(text: string): void
       Registered by ChatWidget, injected by openspace-voice.
       Eliminates DOM class-name coupling for voice text injection.
```

---

## H. Good-to-Great Roadmap

Organised into four phases. Each phase is independently deliverable and leaves the codebase in a better state than before.

---

### Phase R1 — Hygiene (1–2 days, zero risk, can be done by one agent)

All changes are purely additive or purely deletive. No logic changes.

| Item | File | Change | Effort |
|---|---|---|---|
| E1 | `opencode-protocol.ts` | Delete duplicate `renameSession` declaration | 5 min |
| E3 | `session-service.ts`, `opencode-sync-service.ts` | Add `incrementUnseenForSession()` public method; remove cast | 15 min |
| E11 | `session-service.ts` | Replace `localhost:3000` with `window.location.origin` | 5 min |
| E12 | `openspace-core-frontend-module.ts` | Delete `SessionServiceWiring` symbol and binding | 5 min |
| E13 | `opencode-proxy.ts` | Replace 3× `console.log` with `this.logger.debug/warn` | 10 min |
| E15 | `sessions-widget.tsx`, `chat-widget.tsx` | Add `sessionDisplayTitle()` utility; replace bare `.title` | 1 hour |
| E5 Stage 1 | `opencode-protocol.ts` | Add warning comment about `projectId` fiction | 5 min |

**Total: ~3 hours. Zero behaviour change. Safe to merge without feature testing.**

---

### Phase R2 — Boundary Fixes (3–5 days, low risk)

Fix the four places where code crosses module boundaries it shouldn't.

| Item | Files | Change | Effort |
|---|---|---|---|
| E4 | `chat-widget.tsx`, `session-service.ts` | Route slash-command calls through `SessionService` | 3 hours |
| E6 | `session-service.ts`, `opencode-sync-service.ts`, `openspace-core-frontend-module.ts` | Split `SessionService` / `SessionMutator` interfaces | 1 day |
| E7 | `session-service.ts`, new `streaming-status.ts` | Extract `toolNameToCategory` to pure utility in `openspace-chat` | 2 hours |
| E9 | `session-service.ts`, `sessions-widget.tsx`, `chat-widget.tsx` | Add `onSessionListChanged` event; remove duplicated load subscriptions | 4 hours |
| E14 | `opencode-sync-service.ts` | Implement file-event handler using `FileService` | 4 hours |
| D4 | `opencode-protocol.ts`, `session-service.ts`, `chat-widget.tsx` | Declare the 14 undeclared SDK fields on protocol types; remove `as unknown as` casts | 1 day |

**Total: ~4 days. Each item is independently PR-able. Tests updated but no new test infrastructure needed.**

---

### Phase R3 — SessionService Decomposition (5–7 days, medium risk)

The structural improvement that removes the god object and enables independent testing. Do this as a single focused sprint.

**Step 1: Extract `SessionPersistence` (½ day)**
```typescript
// New: openspace-core/src/browser/session-persistence.ts
export const SessionPersistence = Symbol('SessionPersistence');
export interface SessionPersistence {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}
@injectable()
export class LocalSessionPersistence implements SessionPersistence { ... }
```
Wire in DI module. Replace all `window.localStorage` calls in `SessionServiceImpl` with injected `SessionPersistence`. `SessionNotificationService` gets the same treatment. Now `SessionServiceImpl` is testable without mocking `window`.

**Step 2: Extract `PendingOperationsQueue` (1 day)**
```typescript
// New: openspace-core/src/browser/pending-operations.ts
export const PendingOperationsQueue = Symbol('PendingOperationsQueue');
export interface PendingOperationsQueue {
  readonly pendingQuestions: PendingQuestion[];
  readonly pendingPermissions: PendingPermission[];
  addQuestion(q: PendingQuestion): void;
  removeQuestion(callID: string): void;
  addPermission(p: PendingPermission): void;
  removePermission(callID: string): void;
  readonly onChanged: Event<void>;
}
```
Delete the question/permission state from `SessionServiceImpl`. Update `ChatComponent` to inject `PendingOperationsQueue` directly for the permission/question UI sections. SessionService becomes ~300 lines shorter.

**Step 3: Extract `MessageStore` (1 day)**
```typescript
// New: openspace-core/src/browser/message-store.ts
export const MessageStore = Symbol('MessageStore');
export interface MessageStore {
  readonly messages: Message[];
  append(message: Message): void;
  replace(messageId: string, message: Message): void;
  setAll(messages: Message[]): void;
  clear(): void;
  readonly onMessagesChanged: Event<Message[]>;
}
```
`MessageTimeline` and `MessageBubble` inject `MessageStore` directly rather than receiving messages via props from `ChatComponent`. `ChatComponent` no longer manages the message list. `OpenCodeSyncService` injects `MessageStore` for mutation calls (via `SessionMutator`).

**Step 4: Extract `StreamingCoordinator` (2 days)**
```typescript
// New: openspace-core/src/browser/streaming-coordinator.ts
export const StreamingCoordinator = Symbol('StreamingCoordinator');
export interface StreamingCoordinator {
  readonly isStreaming: boolean;
  readonly streamingMessageId: string | undefined;
  applyDelta(messageId: string, partIndex: number, delta: string, isDone: boolean): void;
  applyPartialUpdate(messageId: string, delta: string, isDone: boolean): void;
  applyToolParts(messageId: string, parts: ToolPart[]): void;
  clearText(messageId: string): void;
  readonly onStreamingChanged: Event<{ isStreaming: boolean; messageId?: string }>;
}
```
Merge the three overlapping streaming paths into one coherent implementation. The `_streamingDoneTimer` and the 5s fallback timer both live here. `StreamingCoordinator` depends on `MessageStore` for mutations.

**Result after Phase R3:**
- `SessionServiceImpl`: ~500 lines (down from 2,100) — session CRUD, active state, event hub
- `MessageStore`: ~150 lines
- `StreamingCoordinator`: ~300 lines
- `PendingOperationsQueue`: ~120 lines
- `SessionPersistence`: ~60 lines
- Each service independently injectable, independently testable, independently replaceable

---

### Phase R4 — Replaceability Abstractions (3–4 days, low risk, post-R3)

Add the missing interfaces that make large-scale swaps tractable.

**`ChatInputService` — eliminate voice DOM coupling (½ day)**
```typescript
// New: openspace-chat/src/browser/chat-input-service.ts
export const ChatInputService = Symbol('ChatInputService');
export interface ChatInputService {
  insertText(text: string): void;
  focus(): void;
}
```
`PromptInput` registers itself as `ChatInputService` when mounted (via a callback passed from `ChatWidget`, which holds the DI reference). Voice module injects `ChatInputService` and calls `insertText()`. No DOM queries, no CSS class coupling, no `execCommand`.

**`onFileEvent` full implementation (½ day)**
Implement the file event handler using `FileService` as described in E14. Theia open editors refresh automatically when the agent edits files.

**`projectId` removal — Stage 2 (½ day)**
Global rename: remove `projectId` from every `OpenCodeService` method signature and every call site. Zero behaviour change, significant noise reduction.

**Protocol type completeness (1 day)**
After removing `as unknown as` casts (Phase R2 D4), verify the declared protocol types match the SDK types for all fields actually used. Add a script to `package.json` that compares the protocol types against the opencode SDK types and fails CI if undeclared fields are accessed.

---

## I. Quick Reference: Finding → Phase

| Finding | Phase | Effort |
|---|---|---|
| E1 duplicate renameSession | R1 | 5 min |
| E2 getMcpConfig in browser | R2 | 3 hours |
| E3 private field cast | R1 | 15 min |
| E4 ChatComponent bypasses SessionService | R2 | 3 hours |
| E5 projectId fiction (comment) | R1 | 5 min |
| E5 projectId fiction (removal) | R4 | ½ day |
| E6 mutation methods on public interface | R2 | 1 day |
| E7 toolNameToCategory in SessionService | R2 | 2 hours |
| E8 streaming state in Proxy | R3 (StreamingCoordinator) | part of R3 |
| E9 duplicated session list loading | R2 | 4 hours |
| E10 voice DI swallows errors | R2 | 3–4 hours |
| E11 hardcoded port | R1 | 5 min |
| E12 dead symbol | R1 | 5 min |
| E13 console.log in production | R1 | 10 min |
| E14 file event stubs | R4 | ½ day |
| E15 session.title null guard | R1 | 1 hour |
| D2 three streaming state machines | R3 (StreamingCoordinator) | 2 days |
| D3 SSE fallback complexity | R3 (StreamingCoordinator) | part of R3 |
| D4 as unknown as casts | R2 | 1 day |
| D5 scattered localStorage | R3 (SessionPersistence) | ½ day |
| D6 voice execCommand deprecated | R4 (ChatInputService) | ½ day |
| Missing MessageStore | R3 | 1 day |
| Missing StreamingCoordinator | R3 | 2 days |
| Missing PendingOperationsQueue | R3 | 1 day |
| Missing ChatInputService | R4 | ½ day |

**Total estimated effort: R1 ≈ 3h · R2 ≈ 4 days · R3 ≈ 7 days · R4 ≈ 3 days**

R1 and R2 can run in parallel with the parity feature phases (2.6–2.8). R3 should be a dedicated sprint — it touches core infrastructure and should not be interleaved with feature work. R4 can be done incrementally alongside Phase 5 (Polish & Desktop).
