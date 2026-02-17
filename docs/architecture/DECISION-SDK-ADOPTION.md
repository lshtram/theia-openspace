---
id: DECISION-SDK-ADOPTION
author: oracle_7f3a
status: DRAFT
date: 2026-02-17
task_id: SDK-Adoption-Analysis
---

# Architecture Decision: OpenCode SDK Adoption

## 1. Executive Summary

We built ~4,000 lines of custom integration code to connect Theia OpenSpace to the OpenCode server. An official SDK (`@opencode-ai/sdk`) exists that provides the **exact same functionality** — type-safe HTTP client, SSE event streaming, full API coverage — in zero-dependency package auto-generated from the server's OpenAPI 3.1 spec.

**Our hand-rolled code is already diverging from the actual API** (7 field name mismatches, 9 missing message part types, 11 missing event types). This will compound as we implement Phase 3+.

This document analyzes three strategic options and recommends a path forward.

---

## 2. What We Built (Current State)

### 2.1 Inventory

| Component | File | LOC | Purpose |
|-----------|------|-----|---------|
| HTTP Client | `opencode-proxy.ts` | 931 | 24 REST API calls + SSE client + stream interceptor |
| Type Definitions | `opencode-protocol.ts` | 313 | Hand-written interfaces for Session, Message, etc. |
| SSE Event Types | `session-protocol.ts` | 135 | Event type definitions |
| Command Types | `command-manifest.ts` | 138 | AgentCommand, HubState types |
| RPC Sync | `opencode-sync-service.ts` | 555 | RPC callback handler, command validation |
| Session State | `session-service.ts` | 856 | Frontend state management |
| Hub Server | `hub.ts` | 211 | Express endpoints for instructions/manifest |
| Bridge | `bridge-contribution.ts` | 150 | Publishes manifest to Hub |
| DI Wiring | backend/frontend modules | 95 | Dependency injection configuration |
| Permission UI | permission-dialog-*.ts | 413 | Permission request handling |
| Chat Agent | `chat-agent.ts` | 43 | Theia AI integration |
| Pane Types | `pane-protocol.ts` | 201 | PaneService interface |
| **TOTAL** | **14 files** | **~4,027** | |

### 2.2 Transport Complexity

```
User Action ──→ ChatAgent ──→ SessionService ──→ RPC Proxy ──→ Theia JSON-RPC ──→ OpenCodeProxy ──→ HTTP POST ──→ OpenCode Server
                                                                                                                        │
Response   ←── UI Events ←── SessionService ←── SyncService ←── Theia JSON-RPC ←── OpenCodeProxy ←── SSE Stream ←──────┘
```

**6 abstraction layers** each direction. **4 transport mechanisms** (HTTP REST, SSE, JSON-RPC over WebSocket, HTTP fetch from browser).

### 2.3 Known Type Drift

| Our Type | SDK Type | Issue |
|----------|----------|-------|
| `Session.projectId` | `Session.projectID` | Case mismatch |
| `Message.sessionId` | `Message.sessionID` | Case mismatch |
| `MessagePart` = 3 variants | `Part` = 12 variants | Missing 9 part types |
| `Provider.models` = `{id, name}[]` | Full model with `limit, attachment, reasoning, streaming, cost` | Missing model capabilities |
| SSE events: 4 categories | 13+ event types | Missing 11 event types |
| SSE endpoint: `/session/:id/events` | `/event` or `/global/event` | **Wrong endpoint** |

---

## 3. What the SDK Provides

### 3.1 Package: `@opencode-ai/sdk`

| Property | Value |
|----------|-------|
| npm | `@opencode-ai/sdk` |
| Dependencies | **Zero** |
| Source | Auto-generated from OpenAPI 3.1 spec via `@hey-api/openapi-ts` |
| License | MIT |
| Versions published | ~3,798 (daily releases, actively maintained) |

### 3.2 Client API (excerpt)

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"
const client = createOpencodeClient({ baseUrl: "http://localhost:4096" })

// Session management
const sessions = await client.session.list()
const session = await client.session.create({ body: { title: "..." } })
const result = await client.session.prompt({
  path: { id: session.id },
  body: { parts: [{ type: "text", text: "Hello!" }] }
})

// SSE Events (async iterable — handles reconnection)
const events = await client.event.subscribe()
for await (const event of events.stream) {
  switch (event.type) {
    case "session.updated": ...
    case "message.updated": ...
    case "session.idle": ...
  }
}

// File operations, search, config — all type-safe
const files = await client.find.files({ query: { query: "*.ts" } })
const content = await client.file.read({ query: { path: "src/index.ts" } })
```

### 3.3 What the SDK Does NOT Provide

The SDK is a **client library only**. It does not provide:

1. ❌ Theia DI integration (we still need wrapper classes)
2. ❌ JSON-RPC bridge (Theia's frontend ↔ backend communication)
3. ❌ Stream interceptor for `%%OS{...}%%` agent commands
4. ❌ Hub server (instructions/manifest endpoints)
5. ❌ Frontend state management (optimistic updates, event routing)
6. ❌ Command validation / security allowlisting
7. ❌ Permission dialog UI

These are **our unique value-add** — the parts that make this a Theia integration rather than a generic OpenCode client.

---

## 4. The VS Code Extension — Can We Use It?

### 4.1 What It Is

The official VS Code extension (`sdks/vscode/`) is a **thin terminal wrapper**:
- Spawns `opencode` in an integrated terminal
- `Cmd+Esc` to open/focus the terminal
- `Cmd+Alt+K` to send file references (`@filepath#L37-42`)
- Uses raw `fetch()` calls — doesn't even use the SDK
- Does NOT render chat UI, manage sessions, or handle agent commands

### 4.2 Can We Reuse It?

**No, it's not useful as a base.** Our integration is fundamentally deeper:

| Feature | VS Code Extension | Theia OpenSpace |
|---------|-------------------|-----------------|
| Chat UI | Terminal (TUI) | Custom React widget |
| Session management | None | Full CRUD + state |
| Agent commands | None | 20 IDE commands (Phase 3) |
| Permission UI | None | Custom dialog |
| File/editor control | Send reference only | Full read/write/navigate |
| Streaming | None (TUI handles it) | SSE + stream interception |

The VS Code extension validates that **our approach is correct** — we're building something far beyond what the official IDE integration provides. The VS Code extension is a remote control for the TUI. We're building a native IDE experience.

---

## 5. The Plugin System — An Alternative Path?

### 5.1 Package: `@opencode-ai/plugin`

OpenCode has a plugin system that can:
- Subscribe to **all events** (session, message, file, permission, tool execution, shell)
- Define **custom tools** the agent can call
- Intercept **tool execution** (before/after hooks)
- Inject **environment variables** into shell commands
- Customize **compaction behavior**

### 5.2 Relevance to Phase 3

Our Phase 3 "Agent IDE Control" uses `%%OS{...}%%` markers in the AI response stream to send commands to the IDE. This is a **custom protocol we invented** because we needed the agent to control the IDE.

The plugin system offers an alternative: **register custom tools** that the agent calls directly through OpenCode's tool system, rather than embedding commands in the response text.

```typescript
// Instead of %%OS{"command":"editor.open","args":{"path":"foo.ts"}}%%
// The agent would call a tool:
plugin.tool("openEditor", {
  description: "Open a file in the IDE editor",
  args: { path: tool.schema.string() },
  async execute(args, ctx) {
    // Somehow communicate back to Theia...
    return `Opened ${args.path}`
  }
})
```

### 5.3 Plugin System Assessment

| Aspect | Pro | Con |
|--------|-----|-----|
| **No stream parsing** | Eliminates `%%OS{...}%%` brace-counting state machine | — |
| **Type-safe** | Tool parameters validated by Zod schemas | — |
| **Official protocol** | Uses OpenCode's native tool calling | — |
| **Bidirectional** | — | Plugin runs server-side; needs a way to reach Theia browser. We'd need **another IPC channel** between the plugin process and Theia backend |
| **Coupling** | — | Our IDE control becomes a dependency of the OpenCode plugin system, not standalone |
| **Debugging** | — | Harder to debug — tool execution happens inside OpenCode, not in our code |
| **Deployment** | — | Plugin must be installed in the OpenCode environment separately |

**Verdict:** The plugin system is interesting for **future consideration** but would require a deeper architectural change than SDK adoption. It doesn't eliminate complexity — it moves it. The `%%OS{...}%%` approach, while custom, keeps all logic in our codebase where we control it. A plugin approach would split our logic across two systems.

---

## 6. Three Strategic Options

### Option A: Adopt SDK (Replace HTTP/Types Only)

**What changes:**
- Replace `opencode-proxy.ts` HTTP calls with SDK client methods
- Replace `opencode-protocol.ts` custom types with SDK type imports
- Replace `eventsource-parser` SSE handling with SDK's `client.event.subscribe()`
- Keep: Theia DI wrappers, JSON-RPC bridge, stream interceptor, Hub, sync service, session service, permission UI

**What stays the same:**
- Architecture B1 (unchanged)
- Frontend ↔ Backend JSON-RPC protocol (unchanged)
- `%%OS{...}%%` stream interceptor (unchanged — operates on raw event data before SDK parsing)
- Hub endpoints (unchanged)
- All security/validation code (unchanged)

**Effort:** 12-18 hours
**Risk:** Low-Medium
**Code reduction:** ~1,200-1,450 lines eliminated (from ~4,027 to ~2,600)

### Option B: Adopt SDK + Expose SDK Client Directly to Frontend

**What changes:**
- Everything from Option A, plus:
- Instead of JSON-RPC bridge (our proxy), run SDK client **in the browser** (since it uses `fetch()` internally)
- Eliminate the entire backend proxy layer

**What stays the same:**
- Hub (still needed for instructions endpoint)
- Stream interceptor (moved to browser)
- Session service, sync service (simplified)

**Implications:**
- The SDK uses `fetch()` which works in browsers
- CORS: OpenCode server supports `--cors` flag
- BUT: SSE connections from browser have limitations (max 6 per domain in HTTP/1.1)
- AND: We lose Theia backend's ability to intercept/transform the stream before it reaches the UI
- AND: All API traffic goes browser → OpenCode server directly, bypassing Theia

**Effort:** 30-40 hours (significant rearchitecture)
**Risk:** High
**Code reduction:** ~2,000 lines eliminated but ~500 lines of new browser-side code

### Option C: Full Plugin System Migration

**What changes:**
- Adopt SDK for session/message management
- Replace `%%OS{...}%%` with OpenCode plugin custom tools
- Agent calls tools instead of emitting markers
- Plugin communicates with Theia backend via WebSocket/HTTP

**Effort:** 60-80 hours (major rearchitecture, two systems to maintain)
**Risk:** Very High
**Code reduction:** Minimal net reduction (complexity moves, doesn't disappear)

---

## 7. Recommendation: Option A (SDK Adoption — HTTP/Types Only)

### 7.1 Why Option A

| Factor | Assessment |
|--------|------------|
| **Maximum benefit per effort** | 80% code reduction in the HTTP layer for 12-18 hours of work |
| **Minimal disruption** | Architecture B1 is unchanged; no new abstractions introduced |
| **Type safety** | Immediately fixes 7 field mismatches, adds 9 missing part types, 11 missing event types |
| **Forward compatibility** | Future OpenCode API changes arrive via `npm update` instead of manual sync |
| **Phase 3 readiness** | Rich Part types (tool, agent, step-start, etc.) needed for tasks 3.7-3.11 |
| **Reversibility** | Low risk — we can always revert to hand-rolled HTTP if SDK has issues |

### 7.2 Why NOT Option B

- Browser-side SDK means CORS configuration complexity
- Loses backend stream interception (critical for `%%OS{...}%%`)
- SSE connection limits in browsers
- Breaks Theia's architectural pattern (backend services mediate external connections)
- Much higher effort and risk

### 7.3 Why NOT Option C

- Plugin system moves complexity, doesn't reduce it
- Creates dependency on OpenCode's plugin runtime
- Need IPC between plugin process and Theia — adding complexity
- The `%%OS{...}%%` approach works and is well-tested (12 unit tests)
- Premature optimization — revisit after Phase 3 is complete

### 7.4 Timing

**Recommended: NOW, before Phase 3 tasks 3.7-3.11.**

Rationale:
- Tasks 3.7 (Command Manifest) and 3.11 (Command Result Feedback) need rich Part types
- Building on incorrect types now means rework later
- The SDK adoption is isolated — it doesn't change architecture, just the HTTP/type layer
- Clean break point: tasks 3.1-3.6 are done, 3.7 hasn't started

### 7.5 Migration Plan (4 phases, each independently testable)

```
Phase A: Install SDK, create type aliases          (~2 hours)
  - npm install @opencode-ai/sdk
  - Create bridge types in opencode-protocol.ts (alias SDK types)
  - Verify build still passes

Phase B: Replace HTTP calls in OpenCodeProxy       (~6 hours)  
  - Initialize SDK client in OpenCodeProxy constructor
  - Replace each httpGet/httpPost/httpDelete with SDK method
  - Keep same DI interface (OpenCodeService)
  - Run existing tests

Phase C: Replace SSE handling                      (~4 hours)
  - Replace eventsource-parser with SDK event.subscribe()
  - Stream interceptor operates on event data (preserved)
  - Update event type mappings

Phase D: Cleanup                                   (~4 hours)
  - Remove custom type definitions from opencode-protocol.ts
  - Remove eventsource-parser dependency
  - Update all downstream consumers for field renames
  - Update unit tests
```

---

## 8. What Can NOT Be Avoided

Regardless of SDK adoption, these components are **irreducible** — they represent our unique integration logic that no SDK/extension can provide:

| Component | LOC | Why It's Necessary |
|-----------|-----|-------------------|
| Theia DI wrappers | ~200 | Theia requires injectable services |
| JSON-RPC bridge | ~300 | Theia frontend ↔ backend communication |
| Stream interceptor | ~140 | `%%OS{...}%%` command extraction (our protocol) |
| Hub server | ~211 | Instructions endpoint for agent |
| Session state mgmt | ~500 | Optimistic updates, event routing, streaming UI |
| Command validation | ~200 | Security allowlisting, rate limiting |
| Permission dialog | ~413 | UI for permission requests |
| Chat widget | ~500+ | Custom React chat UI |
| **TOTAL** | **~2,464** | Minimum viable integration |

The SDK reduces our total from ~4,027 to ~2,600 lines. The remaining ~2,600 lines are the parts that **make this a Theia integration**, not a generic client. Those cannot be avoided.

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| SDK daily release breaks API | Low | Medium | Pin version, test before upgrading |
| SDK doesn't expose raw SSE data for stream interceptor | Low | High | Intercept at fetch level before SDK processes |
| SDK uses browser-incompatible APIs in Node.js | Very Low | Low | SDK is used in Node.js by design (TUI uses it) |
| Field renames cause cascading changes | Medium | Low | Use TypeScript compiler to catch all references |
| SDK event model differs from our SSE mapping | Medium | Medium | Phase C handles this explicitly |

---

## 10. Decision Required

**Question for you:** Should we proceed with Option A (SDK adoption) before continuing Phase 3?

- **YES**: Builder implements the 4-phase migration plan (~12-18 hours) as a new task
- **NO**: Continue Phase 3 with current code, accept type drift risk
- **DEFER**: Complete Phase 3 first, then migrate (higher rework cost but no interruption)
- **OPTION B/C**: Choose a different strategic option (requires further architecture work)

---

*End of DECISION-SDK-ADOPTION.md*
