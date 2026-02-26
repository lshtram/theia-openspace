# God Object Decomposition — Architecture Design

**Goal:** Decompose all 4 god objects (files >900 lines) into focused modules with a <400 line target per file, improving modularity and maintainability.

**Scope:** 7 files across 2 extensions, producing ~30 new modules.

**Pattern:** Sub-directory per god object. Original file becomes a thin facade. No barrel files. Direct imports (matches existing project convention).

---

## 1. Overall Patterns

### Backend (DI-bound services)

Each extracted module is an `@injectable()` singleton with a focused interface. The facade class injects sub-services and delegates. Event emitters stay on the sub-service that owns the data.

```
src/node/opencode-proxy/
├── opencode-proxy.ts          ← facade (keeps existing class name + RPC interface)
├── http-client.ts             ← HttpClient service
├── rest-api.ts                ← RestApiFacade (thin REST wrappers)
├── sse-connection.ts          ← SseConnectionManager
├── sse-event-router.ts        ← SseEventRouter
└── node-utils.ts              ← validatePath, executeShellCommand
```

DI module binds each sub-service as a singleton. Facade injects them via `@inject()`. Circular refs (if any) use setter injection + `queueMicrotask` (existing pattern from `openspace-core-frontend-module.ts`).

### Frontend (React components)

Each extracted module is a custom hook or sub-component in its own file. The main component composes hooks and renders sub-components. No DI involved.

```
src/browser/chat-widget/
├── chat-widget.tsx            ← main ChatComponent (~250 lines)
├── chat-header-bar.tsx        ← ChatHeaderBar sub-component
├── use-session-subscriptions.ts
├── use-session-actions.ts
├── use-message-queue.ts
├── use-shell-execution.ts
└── use-model-preference.ts
```

### Hub MCP (registration pattern)

Each tool group exports a `register(server, deps)` function. The facade calls each during mount.

```
src/node/hub-mcp/
├── hub-mcp.ts                 ← core infra, mount, bridge resolution
├── file-tools.ts              ← 7 file tools (needs workspaceRoot, artifactStore, patchEngine)
├── whiteboard-tools.ts        ← 13 whiteboard tools (bridge-forwarding)
├── presentation-tools.ts      ← 10 presentation tools (bridge-forwarding)
├── editor-tools.ts            ← 6 editor tools (bridge-forwarding)
├── terminal-tools.ts          ← 5 terminal tools (bridge-forwarding)
├── pane-tools.ts              ← 4 pane tools (bridge-forwarding)
└── voice-tools.ts             ← 1 voice tool (bridge-forwarding)
```

---

## 2. Module Breakdown

### 2.1 `session-service/` (from ~2,119 lines)

| Module | File | Responsibility | Est. Lines |
|---|---|---|---|
| StreamingStateService | `streaming-state.ts` | Token buffering, stream lifecycle, `onDidUpdateStreaming` | ~280 |
| MessageStoreService | `message-store.ts` | Message CRUD, array management, `onDidUpdateMessages` | ~200 |
| SessionLifecycleService | `session-lifecycle.ts` | Create/switch/delete sessions, session list mgmt | ~450 |
| InteractionService | `interaction-handlers.ts` | Question/permission/todo handlers | ~140 |
| ModelService | `model-preference.ts` | Model selection, `onDidChangeModel` | ~40 |
| **SessionService** (facade) | `session-service.ts` | Orchestrates sub-services, `sendMessage` flow | ~300 |

**Coupling resolution:**
- StreamingState and MessageStore share a per-token hot path. MessageStore exposes `appendToContent(msgId, delta)` and `setToolState(msgId, state)`. StreamingState calls these methods instead of mutating arrays directly.
- SessionLifecycle calls `messageStore.clear()` and `streamingState.reset()` on session switch.
- The facade's `sendMessage` method orchestrates across StreamingState, MessageStore, and SessionLifecycle.
- All 5 sub-services are `@injectable()` singletons. SessionService (facade) injects them via constructor.

### 2.2 `opencode-proxy/` (from ~1,330 lines)

| Module | File | Responsibility | Est. Lines |
|---|---|---|---|
| HttpClient | `http-client.ts` | buildUrl, rawRequest, requestJson, get/post/patch/delete | ~165 |
| RestApiFacade | `rest-api.ts` | 33 thin REST wrappers (sessions, messages, models, etc.) | ~295 |
| SseConnectionManager | `sse-connection.ts` | connect/disconnect/reconnect, backoff logic | ~200 |
| SseEventRouter | `sse-event-router.ts` | handleSSEEvent, 7 forwarder methods, streaming state | ~405 |
| NodeUtils | `node-utils.ts` | validatePath, executeShellCommand | ~105 |
| **OpenCodeProxy** (facade) | `opencode-proxy.ts` | Wires sub-modules, implements RPC interface | ~160 |

**Cleanup during extraction:** Normalize HttpClient — `delete()` currently bypasses `requestJson`, `getDiff()` bypasses both. All methods should go through the unified request pipeline.

### 2.3 `hub-mcp/` (from ~956 lines, 46 tools)

| Module | File | Responsibility | Est. Lines |
|---|---|---|---|
| FileToolHandlers | `file-tools.ts` | 7 file tools (Hub-direct fs I/O) | ~290 |
| WhiteboardToolHandlers | `whiteboard-tools.ts` | 13 whiteboard tools (bridge-forwarding) | ~160 |
| PresentationToolHandlers | `presentation-tools.ts` | 10 presentation tools (bridge-forwarding) | ~93 |
| EditorToolHandlers | `editor-tools.ts` | 6 editor tools (bridge-forwarding) | ~66 |
| TerminalToolHandlers | `terminal-tools.ts` | 5 terminal tools (bridge-forwarding) | ~48 |
| PaneToolHandlers | `pane-tools.ts` | 4 pane tools (bridge-forwarding) | ~42 |
| VoiceToolHandlers | `voice-tools.ts` | 1 voice tool (bridge-forwarding) | ~18 |
| **HubMcpServer** (facade) | `hub-mcp.ts` | Core infra, mount, bridge resolution, registers all handlers | ~120 |

**Bridge-forwarding handler pattern:**
```typescript
// Each handler module exports a register function
export function registerWhiteboardTools(
  server: McpServer,
  executeViaBridge: (cmd: string, args: Record<string, unknown>) => Promise<unknown>
): void {
  server.tool('openspace.whiteboard.create', ...schema, async (args) => {
    return executeViaBridge('whiteboard.create', args);
  });
  // ... more tools
}
```

Only `file-tools.ts` needs additional deps (workspaceRoot, artifactStore, patchEngine).

### 2.4 `chat-widget/` (from ~1,280 lines)

| Module | File | Est. Lines |
|---|---|---|
| ChatHeaderBar | `chat-header-bar.tsx` | ~367 |
| useSessionSubscriptions | `use-session-subscriptions.ts` | ~180 |
| useSessionActions | `use-session-actions.ts` | ~140 |
| useMessageQueue | `use-message-queue.ts` | ~80 |
| useShellExecution | `use-shell-execution.ts` | ~40 |
| useModelPreference | `use-model-preference.ts` | ~40 |
| **ChatComponent** | `chat-widget.tsx` | ~250 |

### 2.5 `message-bubble/` (from ~1,455 lines — largest file)

| Module | File | Est. Lines |
|---|---|---|
| ToolCallRenderer | `tool-call-renderer.tsx` | ~350 |
| ContentPartRenderer | `content-part-renderer.tsx` | ~250 |
| MessageActions | `message-actions.tsx` | ~150 |
| CopyButton | `copy-button.tsx` | ~80 |
| **MessageBubble** | `message-bubble.tsx` | ~400 |

### 2.6 `prompt-input/` (already a directory, main file ~1,229 lines)

| Module | File | Est. Lines |
|---|---|---|
| useTypeahead | `use-typeahead.ts` | ~200 |
| useInputHistory | `use-input-history.ts` | ~150 |
| AttachmentBar | `attachment-bar.tsx` | ~180 |
| ShellModeToggle | `shell-mode-toggle.tsx` | ~100 |
| **PromptInput** | `prompt-input.tsx` | ~400 |

---

## 3. Extraction Order

1. **hub-mcp/** — Easiest. 39/46 tools are pure bridge-forwarding. Near-zero coupling risk. Establishes the sub-directory pattern.
2. **opencode-proxy/** — Clear boundaries. HttpClient extraction normalizes inconsistent patterns.
3. **session-service/** — Hardest backend. StreamingState <-> MessageStore coupling is the trickiest seam.
4. **Chat frontend** (message-bubble/, chat-widget/, prompt-input/) — Independent from backend. Sequenced internally: message-bubble first (largest), then chat-widget, then prompt-input.

---

## 4. Constraints

- **<400 lines per file** — hard target
- **No barrel files** — direct imports only (matches project convention)
- **No public API changes** — facade classes keep existing method signatures
- **All work in a dedicated worktree** — easy to contain and review
- **Existing tests must pass** after each extraction (incremental, not big-bang)
- **Not in scope:** `opencode-sdk-types.ts` (3,436 lines, auto-generated types) or `message-timeline.tsx` (713 lines, moderate size)

---

## 5. DI Module Impact

### Frontend module changes

`openspace-core-frontend-module.ts` gains 5 new bindings (StreamingStateService, MessageStoreService, SessionLifecycleService, InteractionService, ModelService). SessionService binding stays, now injects sub-services.

### Backend module changes

`openspace-core-backend-module.ts` gains 5 new bindings (HttpClient, RestApiFacade, SseConnectionManager, SseEventRouter, NodeUtils). OpenCodeProxy binding stays, now injects sub-services.

No DI changes for hub-mcp (not DI-managed, it's Express middleware). No DI changes for chat frontend (React components, not DI-managed).

### Chat module changes

`openspace-chat-frontend-module.ts` — no changes. Chat components are imported by the widget, not DI-bound.

---

## 6. Import Path Updates

When `session-service.ts` moves to `session-service/session-service.ts`, all existing imports change:

```typescript
// Before
import { SessionService } from './session-service';
// After
import { SessionService } from './session-service/session-service';
```

Same pattern for all other moved files. The DI modules and any direct importers need path updates.
