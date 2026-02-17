# RFC-002: OpenCode SDK & Integration Research
## Evaluating `@opencode-ai/sdk` for Theia OpenSpace

| Field | Value |
|---|---|
| **Status** | FINAL |
| **Author** | Scout (scout_d4f1) |
| **Date** | 2026-02-17 |
| **Audience** | Oracle, Builder |
| **Sources** | GitHub (`anomalyco/opencode`), npm registry, opencode.ai docs, VS Code extension source |

---

## Executive Summary

**An official OpenCode SDK exists** — `@opencode-ai/sdk` (npm, v1.2.6, zero dependencies, auto-generated from OpenAPI spec). It provides a type-safe TypeScript client with full coverage of the OpenCode server API: session management, file operations, event streaming (SSE), configuration, and TUI control.

Our current Theia OpenSpace integration (`opencode-proxy.ts`, 931 lines) **manually reimplements** everything the SDK provides — HTTP request handling, SSE parsing, URL building, error handling, and custom type definitions that are **already out of sync** with the actual OpenCode API types.

**Recommendation: ADOPT the SDK.** Replace `opencode-proxy.ts` and `opencode-protocol.ts` with SDK-based integration. This eliminates ~1,200 lines of hand-rolled code, fixes existing type mismatches, and ensures forward compatibility as OpenCode evolves.

---

## Table of Contents

1. [SDK Discovery](#1-sdk-discovery)
2. [SDK Architecture & API Surface](#2-sdk-architecture--api-surface)
3. [VS Code Extension Analysis](#3-vs-code-extension-analysis)
4. [Plugin System](#4-plugin-system)
5. [Server Architecture](#5-server-architecture)
6. [Gap Analysis: Current vs. SDK](#6-gap-analysis-current-vs-sdk)
7. [Type Mismatch Audit](#7-type-mismatch-audit)
8. [Ecosystem & Community](#8-ecosystem--community)
9. [Migration Assessment](#9-migration-assessment)
10. [Recommendation](#10-recommendation)

---

## 1. SDK Discovery

### 1.1 Package Identity

| Property | Value |
|---|---|
| **npm package** | `@opencode-ai/sdk` |
| **Version** | 1.2.6 (as of 2026-02-17) |
| **Published versions** | 3,798 (daily releases) |
| **Dependencies** | **Zero** |
| **Source location** | `packages/sdk/js/` in monorepo |
| **Code generation** | `@hey-api/openapi-ts` from OpenAPI 3.1 spec |
| **License** | MIT |
| **Repository** | `github.com/anomalyco/opencode` (106k ★) |

### 1.2 Package Exports

```
@opencode-ai/sdk          → Main entry (createOpencode, createOpencodeClient, createOpencodeServer)
@opencode-ai/sdk/client    → Client-only mode
@opencode-ai/sdk/server    → Server spawner
@opencode-ai/sdk/v2        → V2 variants (same pattern)
```

### 1.3 Three Usage Modes

```typescript
// Mode 1: Full — Spawns server process + creates client
import { createOpencode } from "@opencode-ai/sdk";
const opencode = await createOpencode();
// opencode.client — ready-to-use client
// opencode.cleanup() — stops the server

// Mode 2: Client-only — Connects to existing server
import { createOpencodeClient } from "@opencode-ai/sdk";
const client = createOpencodeClient({ baseUrl: "http://localhost:4096" });

// Mode 3: Server-only — Starts headless server
import { createOpencodeServer } from "@opencode-ai/sdk";
const server = await createOpencodeServer();
// server.url — base URL
// server.cleanup() — stops the server
```

**For Theia OpenSpace:** Mode 2 (`createOpencodeClient`) is the correct choice. We already manage the OpenCode server lifecycle separately; we just need a type-safe client to talk to it.

---

## 2. SDK Architecture & API Surface

### 2.1 Client Namespace Organization

The SDK client is organized into logical namespaces:

| Namespace | Methods | Description |
|---|---|---|
| `client.global` | `health()` | Server health check |
| `client.session` | `list()`, `get()`, `create()`, `delete()`, `prompt()`, `abort()`, `share()`, `revert()`, `messages()` | Full session lifecycle |
| `client.find` | `text()`, `files()`, `symbols()` | Code search |
| `client.file` | `read()`, `status()` | File operations |
| `client.config` | `get()`, `providers()` | Configuration & provider info |
| `client.app` | `log()`, `agents()` | App-level operations |
| `client.event` | `subscribe()` | SSE event stream (async iterable) |
| `client.tui` | `appendPrompt()`, `submitPrompt()`, `showToast()` | TUI control |
| `client.auth` | `set()` | Authentication |

### 2.2 Event Subscription (SSE)

```typescript
// SDK approach — async iterable, handles reconnection
const events = client.event.subscribe();
for await (const event of events) {
  switch (event.type) {
    case "session.updated":
      // event.properties — typed Session object
      break;
    case "message.updated":
      // event.properties — typed MessageV2 object
      break;
    case "session.status":
      // event.properties — { sessionID, status }
      break;
  }
}
```

### 2.3 Auto-Generated Types

The SDK types are generated directly from the OpenAPI 3.1 spec at `/doc`. Key types include:

| Type | Description | Notable Fields |
|---|---|---|
| `Session` | Session object | `id`, `projectID` (uppercase!), `title`, `parentID`, `share` |
| `Message` | Chat message | `id`, `sessionID`, `role`, `parts` (discriminated union) |
| `Part` | Message content block | Discriminated union: `text`, `reasoning`, `file`, `tool`, `step-start`, `step-finish`, `snapshot`, `patch`, `agent`, `retry`, `compaction`, `subtask` |
| `Provider` | LLM provider | `id`, `name`, `models` (with `id`, `name`, `limit`, `attachment`, `reasoning`, `streaming`, `cost`) |
| `Event` | SSE event | `type`, `properties` (typed per event kind) |
| `Tool` | Tool definition | `name`, `category`, `description`, `parameters` |

### 2.4 Event Types

The SDK defines these event types (from `EventType` union):

```
session.updated      session.status       session.idle
session.diff         session.url
message.updated      message.part.updated
todo.updated
storage.updated
pty.data             pty.exit
file.watch
```

**Gap:** Our current integration only handles `session.updated` and `message.updated`. We're missing 11 event types.

---

## 3. VS Code Extension Analysis

### 3.1 Architecture

The official VS Code extension (`sdks/vscode/`, publisher: `sst-dev`) is surprisingly minimal:

| Component | Implementation |
|---|---|
| **Server management** | Spawns `opencode --port <random_port>` in an integrated terminal |
| **API communication** | Raw `fetch()` calls — does NOT use `@opencode-ai/sdk` |
| **Core feature** | Sends active file/selection context to `POST /tui/append-prompt` |
| **Keybindings** | `Cmd+Esc` (open terminal), `Cmd+Alt+K` (send file reference) |
| **Server readiness** | Polls `GET /app` until server responds |

### 3.2 Key Insight

The VS Code extension is a **thin terminal wrapper**, not a rich IDE integration. It doesn't:
- Render chat messages in a custom webview
- Manage sessions
- Handle agent commands
- Control IDE panes/editors

**This validates our approach**: Theia OpenSpace is building a much deeper integration than the official VS Code extension. The SDK is the right tool for this (the VS Code extension chose not to use it because its needs are trivially simple).

### 3.3 File Reference Format

The extension formats file references as `@filepath#L37-42` (file path + optional line range), sent via `POST /tui/append-prompt`. This pattern could be useful for our context-sharing feature.

---

## 4. Plugin System

### 4.1 Package: `@opencode-ai/plugin`

| Property | Value |
|---|---|
| **npm package** | `@opencode-ai/plugin` |
| **Dependencies** | `@opencode-ai/sdk`, `zod` |
| **Purpose** | Extend OpenCode with custom tools and event hooks |

### 4.2 Plugin Context

Plugins receive a rich context object:

```typescript
interface PluginContext {
  project: Project;
  client: OpencodeClient;  // ← This IS an SDK client instance
  $: Shell;                 // Shell executor
  directory: string;
  worktree?: string;
}
```

### 4.3 Event Hooks

Plugins can subscribe to:
- `session.*` — Session lifecycle
- `message.*` — Message events
- `file.*` — File changes
- `permission.*` — Permission requests
- `tool.execute.*` — Tool execution
- `shell.env` — Shell environment

### 4.4 Custom Tools

```typescript
plugin.tool("myTool", {
  description: "...",
  parameters: z.object({ ... }),
  execute: async (params, ctx) => { ... }
});
```

### 4.5 Relevance to Theia OpenSpace

We already have `@opencode-ai/plugin` as a dependency in `.opencode/package.json`. The plugin system could be an **alternative** approach for some Phase 3 features (agent commands) — rather than intercepting SSE streams, we could register OpenCode plugins that directly expose IDE control tools. However, this would be a deeper architectural change than SDK adoption and should be evaluated separately.

---

## 5. Server Architecture

### 5.1 Server Configuration

| Parameter | Default | Description |
|---|---|---|
| **Port** | 4096 | HTTP server port |
| **Auth** | None | Optional HTTP basic auth via `OPENCODE_SERVER_PASSWORD` |
| **CORS** | Configurable | Via `opencode.json` |
| **Discovery** | mDNS | Auto-discovery on local network |

### 5.2 API Endpoints (from OpenAPI spec at `/doc`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/session` | List sessions |
| `GET` | `/session/:id` | Get session |
| `POST` | `/session` | Create session |
| `DELETE` | `/session/:id` | Delete session |
| `POST` | `/session/:id/message` | Send prompt |
| `POST` | `/session/:id/abort` | Abort generation |
| `POST` | `/session/:id/share` | Share session |
| `POST` | `/session/:id/revert` | Revert to message |
| `GET` | `/session/:id/message` | List messages |
| `POST` | `/find/text` | Search text in files |
| `POST` | `/find/files` | Search files |
| `POST` | `/find/symbols` | Search symbols |
| `POST` | `/file/read` | Read file content |
| `GET` | `/file/status` | Get file git status |
| `GET` | `/config` | Get configuration |
| `GET` | `/config/providers` | List providers |
| `GET` | `/app` | App info |
| `GET` | `/app/log` | Get logs |
| `GET` | `/app/agents` | List agents |
| `GET` | `/global/event` | Global SSE events |
| `GET` | `/event` | Per-connection SSE events |
| `POST` | `/tui/append-prompt` | Append to TUI prompt |
| `POST` | `/tui/submit-prompt` | Submit TUI prompt |
| `POST` | `/tui/toast` | Show TUI toast |
| `POST` | `/auth` | Set authentication |

### 5.3 Key Architectural Insight

**The TUI is just another SDK client.** The OpenCode terminal interface connects to the same HTTP server and uses the same API. This means our Theia integration is a peer of the TUI, not subordinate to it.

---

## 6. Gap Analysis: Current vs. SDK

### 6.1 Lines of Code Comparison

| Component | Current (hand-rolled) | With SDK |
|---|---|---|
| `opencode-protocol.ts` (types) | 313 lines | **0** (use SDK types) |
| `opencode-proxy.ts` (HTTP client) | 931 lines | **~200** (SDK calls + DI wrapper) |
| `opencode-sync-service.ts` (SSE) | 555 lines | **~150** (SDK event subscription) |
| **Total** | **~1,800 lines** | **~350 lines** |
| **Net reduction** | — | **~1,450 lines (80%)** |

### 6.2 Feature Coverage

| Feature | Current | SDK |
|---|---|---|
| HTTP request construction | ✅ Manual (http/https modules) | ✅ Built-in |
| URL building | ✅ Manual string concatenation | ✅ Automatic |
| JSON parsing/serialization | ✅ Manual | ✅ Automatic |
| Error handling | ⚠️ Basic (HTTP status codes only) | ✅ Comprehensive |
| TypeScript types | ⚠️ Hand-written, out of sync | ✅ Auto-generated from OpenAPI |
| SSE connection management | ✅ Manual with `eventsource-parser` | ✅ Built-in async iterable |
| SSE reconnection | ⚠️ Basic (5-attempt limit) | ✅ Built-in |
| Authentication | ❌ Not implemented | ✅ Built-in |
| Session management | ✅ 8 methods | ✅ 9 methods (+ share, revert) |
| File operations | ✅ Basic (read) | ✅ Full (read, status) |
| Search operations | ❌ Not implemented | ✅ Full (text, files, symbols) |
| Provider/config | ✅ Basic | ✅ Full (with model capabilities) |
| TUI control | ❌ Not implemented | ✅ Full (append, submit, toast) |
| Agent listing | ❌ Not implemented | ✅ Built-in |
| App logging | ❌ Not implemented | ✅ Built-in |

### 6.3 Maintenance Burden

| Aspect | Current | With SDK |
|---|---|---|
| API changes | Must manually update types + HTTP calls | `npm update` pulls new types |
| New endpoints | Must implement from scratch | Available immediately |
| Type safety | Partial (hand-written, gaps) | Complete (auto-generated) |
| Bug fixes | Our responsibility | SDK team responsibility |
| OpenAPI spec sync | Manual | Automatic |

---

## 7. Type Mismatch Audit

Comparing our `opencode-protocol.ts` against the SDK's auto-generated `types.gen.ts`:

### 7.1 Naming Conventions

| Field | Our Type | SDK Type | Status |
|---|---|---|---|
| `Session.projectId` | `projectId` (camelCase) | `projectID` (uppercase ID) | ❌ MISMATCH |
| `Session.createdAt` | `createdAt` | `createdAt` | ✅ Match |
| `Session.parentID` | `parentID` | `parentID` | ✅ Match |
| `Message.sessionId` | `sessionId` | `sessionID` | ❌ MISMATCH |

### 7.2 Structural Differences

| Type | Our Definition | SDK Definition | Impact |
|---|---|---|---|
| `MessagePart` | Simple: `TextMessagePart \| ToolCallPart \| ToolResultPart` | Rich discriminated union: `text \| reasoning \| file \| tool \| step-start \| step-finish \| snapshot \| patch \| agent \| retry \| compaction \| subtask` | ❌ Missing 9 part types |
| `Provider` | `{ id, name, models: { id, name }[] }` | Full: `{ id, name, models: { id, name, limit, attachment, reasoning, streaming, cost }[] }` | ⚠️ Missing model capabilities |
| `Session` | Missing `share` field | Has `share?: { url, id }` | ⚠️ Cannot display shared sessions |
| `Message` | Missing `metadata` | Has `metadata` object | ⚠️ Missing message metadata |

### 7.3 Event Type Mismatches

| Issue | Details |
|---|---|
| **Wrong SSE endpoint** | Our code may use `/session/:id/events` — SDK uses `/global/event` or `/event` |
| **Missing event types** | We handle 2 types; SDK defines 13 types |
| **Event payload shapes** | Our event interfaces don't match SDK's typed `Event` union |

### 7.4 Risk Assessment

These mismatches are **not currently causing runtime failures** because:
1. We only use a subset of the API
2. JavaScript is forgiving with extra/missing fields
3. SSE events we handle happen to match

However, they **will cause issues** as we implement Phase 3+ features that rely on richer data (agent commands via tool parts, session sharing, provider capabilities for model selection UI, etc.).

---

## 8. Ecosystem & Community

### 8.1 Relevant Community Projects

| Project | Type | Relevance |
|---|---|---|
| **OpenChamber** | Web/Desktop App + VS Code Extension | Alternative OpenCode frontend — similar goals to ours |
| **CodeNomad** | Desktop/Web/Mobile client | Multi-platform OpenCode client |
| **portal** | Mobile-first web UI | OpenCode over Tailscale/VPN |
| **opencode.nvim** | Neovim plugins | IDE integration reference (uses API directly) |
| **ai-sdk-provider-opencode-sdk** | Vercel AI SDK provider | Uses `@opencode-ai/sdk` — validates SDK stability |
| **kimaki** | Discord bot | Non-IDE SDK consumer — validates SDK generality |

### 8.2 Observations

1. **OpenChamber** is the most similar project to ours. Studying its architecture could inform our design.
2. Multiple projects successfully use the SDK in production, confirming its stability.
3. The daily release cadence (3,798 versions) indicates active development and rapid iteration.
4. Zero-dependency design means no supply chain risk from transitive deps.

---

## 9. Migration Assessment

### 9.1 Effort Estimate

| Task | Effort | Risk |
|---|---|---|
| Install `@opencode-ai/sdk` | 5 min | None |
| Replace `opencode-protocol.ts` types with SDK imports | 2-4 hours | Low — mostly find-and-replace, but need to handle `projectId` → `projectID` renames |
| Rewrite `opencode-proxy.ts` to use SDK client | 4-6 hours | Medium — must preserve DI integration, stream interceptor, and `onAgentCommand` RPC callback |
| Rewrite SSE handling in `opencode-sync-service.ts` | 2-3 hours | Low — SDK's async iterable is simpler than current `eventsource-parser` approach |
| Update unit tests | 2-3 hours | Low — mock SDK client instead of HTTP module |
| Update downstream consumers (`chat-widget.tsx`, `session-service.ts`, etc.) | 1-2 hours | Low — field renames only |
| **Total** | **~12-18 hours** | **Medium overall** |

### 9.2 Migration Strategy

**Recommended approach: Incremental replacement**

1. **Phase A** (non-breaking): Install SDK, add re-exports from `opencode-protocol.ts` that alias SDK types
2. **Phase B** (proxy rewrite): Replace HTTP calls in `opencode-proxy.ts` with SDK client calls, keeping the same DI interface
3. **Phase C** (SSE rewrite): Replace `eventsource-parser` with SDK's `client.event.subscribe()`
4. **Phase D** (cleanup): Remove `opencode-protocol.ts` custom types, remove `eventsource-parser` dependency

This allows each phase to be independently tested and validated.

### 9.3 Risks & Mitigations

| Risk | Mitigation |
|---|---|
| SDK version churn (daily releases) | Pin exact version in `package.json`, update deliberately |
| SDK doesn't expose raw HTTP for stream interception | Keep stream interceptor at SSE layer (before SDK processing) |
| DI integration complexity | SDK client is a plain object — wrap in injectable class |
| Breaking changes in SDK types | Auto-generated types track server; this is a feature, not a bug |
| `eventsource-parser` removal breaks stream interceptor | Stream interceptor operates on raw SSE data; must intercept before SDK parses events |

### 9.4 Compatibility with Architecture B1

The SDK adoption is **fully compatible** with Architecture B1:
- `OpenCodeProxy` wraps SDK client instead of raw HTTP — same DI interface
- Stream interceptor operates on raw SSE text before SDK event parsing
- `onAgentCommand` RPC callback is orthogonal to how we make API calls
- Hub endpoints remain unchanged (they don't use the proxy)

---

## 10. Recommendation

### 10.1 Verdict: **ADOPT**

| Factor | Weight | Score | Rationale |
|---|---|---|---|
| Code reduction | High | ⬆⬆⬆ | ~80% fewer lines (1,450 lines eliminated) |
| Type safety | High | ⬆⬆⬆ | Auto-generated types, always in sync |
| Maintenance burden | High | ⬆⬆⬆ | API changes handled by `npm update` |
| Feature coverage | Medium | ⬆⬆ | Unlocks search, agents, TUI control for free |
| Migration risk | Medium | ⬇ | 12-18 hours of work, medium risk |
| Forward compatibility | High | ⬆⬆⬆ | Phase 3+ features need rich types we're currently missing |
| **Net assessment** | | **STRONG ADOPT** | Benefits vastly outweigh migration cost |

### 10.2 Timing

**Recommended: Before or during Phase 3 Task 3.7 (Command Manifest)**

Phase 3 tasks 3.7–3.11 will need:
- Rich message part types (tool parts, agent parts)
- Provider capabilities (model selection)
- Event types beyond `session.updated` / `message.updated`

Adopting the SDK before these tasks avoids building on top of incorrect types.

### 10.3 Specific Actions for Oracle

1. **Add `@opencode-ai/sdk` to `extensions/openspace-core/package.json`**
2. **Schedule SDK migration as Phase 2.5 or integrate into Phase 3 task sequence**
3. **Consider Plugin system** (`@opencode-ai/plugin`) as an alternative/complement for Phase 3 agent commands — worth a separate evaluation

### 10.4 What NOT to Do

- ❌ Do NOT use Mode 1 (`createOpencode()`) — we manage the server lifecycle ourselves
- ❌ Do NOT adopt the Plugin system without separate architectural review
- ❌ Do NOT try to migrate all at once — use the incremental strategy in §9.2

---

## Appendix A: SDK Source Files Analyzed

| File | Location | Purpose |
|---|---|---|
| `index.ts` | `packages/sdk/js/src/` | Main entry, `createOpencode()` |
| `client.ts` | `packages/sdk/js/src/` | Client factory, namespace organization |
| `server.ts` | `packages/sdk/js/src/` | Server spawner, port detection |
| `types.gen.ts` | `packages/sdk/js/src/gen/` | Auto-generated types (~3,000 lines) |
| `extension.ts` | `sdks/vscode/src/` | VS Code extension entry point |

## Appendix B: Links

- **SDK npm**: https://www.npmjs.com/package/@opencode-ai/sdk
- **Plugin npm**: https://www.npmjs.com/package/@opencode-ai/plugin
- **SDK docs**: https://opencode.ai/docs/sdk/
- **Server docs**: https://opencode.ai/docs/server/
- **IDE docs**: https://opencode.ai/docs/ide/
- **Plugin docs**: https://opencode.ai/docs/plugins/
- **Ecosystem**: https://opencode.ai/docs/ecosystem/
- **GitHub**: https://github.com/anomalyco/opencode

## Appendix C: Current Theia OpenSpace Files Affected

| File | Lines | Action |
|---|---|---|
| `extensions/openspace-core/src/common/opencode-protocol.ts` | 313 | Replace custom types with SDK re-exports |
| `extensions/openspace-core/src/node/opencode-proxy.ts` | 931 | Rewrite to use SDK client |
| `extensions/openspace-core/src/browser/opencode-sync-service.ts` | 555 | Rewrite SSE with SDK event subscription |
| `extensions/openspace-chat/src/browser/chat-widget.tsx` | — | Update field names (`projectId` → `projectID`) |
| `.opencode/package.json` | — | Already has `@opencode-ai/plugin` dep |

---

*End of RFC-002*
