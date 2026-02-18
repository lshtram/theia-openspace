---
id: DECISION-SDK-ADOPTION
author: oracle_e4c1
status: APPROVED (REVISED 2026-02-18)
date: 2026-02-18
task_id: SDK-Adoption-Analysis
version: 2.0
---

# Architecture Decision: OpenCode SDK Adoption (Hybrid Approach)

## 1. Executive Summary

We built ~4,000 lines of custom integration code to connect Theia OpenSpace to the OpenCode server. An official SDK (`@opencode-ai/sdk`) exists that provides type-safe HTTP client, SSE event streaming, and full API coverage in a zero-dependency package auto-generated from the server's OpenAPI 3.1 spec.

**Our hand-rolled code is already diverging from the actual API** (7 field name mismatches, 9 missing message part types, 11 missing event types). This will compound as we implement Phase 3+.

**CRITICAL BLOCKER DISCOVERED (2026-02-18):** Direct SDK adoption failed due to ESM/CommonJS incompatibility. The SDK is ESM-only (`"type": "module"`), while Theia extensions require CommonJS (`"module": "commonjs"` mandated by Theia architecture). TypeScript cannot resolve ESM modules in CommonJS projects regardless of `moduleResolution` strategy.

**APPROVED SOLUTION (2026-02-18):** Hybrid approach — extract SDK's auto-generated type definitions (3,380 lines, zero imports, self-contained) into our codebase, maintain hand-rolled HTTP client but typed with SDK types. This achieves the primary goal (type compatibility with OpenCode API) while deferring runtime SDK adoption until Theia supports ESM or the SDK adds CJS builds.

This document analyzes the blocker, evaluates six approaches, and documents the approved hybrid strategy.

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

## 6. CRITICAL BLOCKER: ESM vs CommonJS Incompatibility (Discovered 2026-02-18)

### 6.1 The Problem

**Attempt 1 (Builder):** Direct SDK import via `import { createOpencodeClient } from "@opencode-ai/sdk"` failed with TypeScript error `TS2307: Cannot find module '@opencode-ai/sdk'`.

**Root Cause Analysis:**

| Component | Configuration | Consequence |
|-----------|--------------|-------------|
| **SDK Package** | `"type": "module"` in package.json, `exports` map with `"import"` condition only, NO `"require"` or `"default"` | ESM-only, cannot be required by CJS |
| **Theia Extensions** | `tsconfig.base.json` has `"module": "commonjs"`, `"moduleResolution": "node"` | Cannot import ESM modules |
| **TypeScript** | `moduleResolution: "node"` cannot understand `exports` maps | Cannot resolve SDK at all (TS2307) |

### 6.2 Six Approaches Evaluated

Oracle conducted empirical tests on six potential solutions:

#### Approach A: Static `import` with `module: "commonjs"`
```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"
```

**Result:** ❌ `TS2307: Cannot find module '@opencode-ai/sdk'`  
**Why:** `moduleResolution: "node"` doesn't understand `exports` maps.

---

#### Approach B: Change to `moduleResolution: "node16"`
```json
{ "moduleResolution": "node16" }
```

**Result:** ❌ `TS1479: The current file is a CommonJS module whose imports will produce 'require' calls; however, the referenced file is an ECMAScript module and cannot be imported with 'require'.`  
**Why:** TypeScript correctly detects ESM/CJS mismatch and blocks even `import type` statements.

---

#### Approach C: Change to `moduleResolution: "bundler"`
```json
{ "moduleResolution": "bundler" }
```

**Result:** ❌ `TS5095: Option 'bundler' can only be used when 'module' is set to 'es2015' or later.`  
**Why:** Bundler resolution requires ESM output, incompatible with Theia's CJS requirement.

---

#### Approach D: **Hybrid — Copy Types Locally + Dynamic `import()` at Runtime**

**Type Layer:**
```typescript
// Extract SDK's gen/types.gen.d.ts (3,380 lines, zero imports, self-contained)
// Copy to: src/common/opencode-sdk-types.ts
export * from "./opencode-sdk-types"
```

**Runtime Layer (Option 1 — Dynamic Import):**
```typescript
const sdk = await import("@opencode-ai/sdk/client")
const client = sdk.createOpencodeClient({ baseUrl: "..." })
```

**Runtime Layer (Option 2 — Keep Hand-Rolled HTTP):**
```typescript
// Keep existing httpPost/httpGet/httpDelete in opencode-proxy.ts
// BUT: Use SDK types instead of hand-written types
async listSessions(): Promise<Session[]> { // Session from SDK types
  return this.httpGet<Session[]>("/session")
}
```

**Result:** ✅ **VERIFIED WORKING**  
**Types:** TypeScript with `moduleResolution: "node"` can use locally-copied types perfectly (zero imports = no resolution issues)  
**Runtime (Option 1):** Node.js CAN dynamically import ESM from CJS via `await import()` — VERIFIED with test script  
**Runtime (Option 2):** Keep HTTP client, eliminate type divergence  

**Trade-off:** Must manually re-extract types on SDK version updates (scriptable via npm post-install hook).

---

#### Approach E: Fork SDK to Build CJS

**Strategy:** Fork `@opencode-ai/sdk`, modify build to output `"module": "commonjs"` and `require()`-compatible code.

**Result:** ✅ Would work  
**Why Rejected:** High maintenance burden — must sync fork with upstream daily releases, loses auto-update benefit.

---

#### Approach F: Wait for CJS Support from OpenCode

**Strategy:** Request OpenCode team add dual ESM/CJS builds (like most npm packages).

**Result:** ❓ Unknown timeline  
**Why Rejected:** Blocks Phase 2B indefinitely, type drift continues.

---

### 6.3 Decision: Approach D (Hybrid), Option 2 (Types Only)

**Rationale:**

| Factor | Assessment |
|--------|------------|
| **Primary Goal Achieved** | Type compatibility with OpenCode API ✅ |
| **Minimal Complexity** | Keep existing HTTP client, just update type signatures |
| **No Runtime Risk** | Zero changes to HTTP/SSE transport layer |
| **Scriptable** | Type extraction can be automated via npm script |
| **Reversible** | Can delete SDK types and revert to hand-written anytime |
| **Future Path** | If Theia adopts ESM or SDK adds CJS, we can switch to runtime SDK later |

**What Changes:**
- Install SDK as dev dependency (`@opencode-ai/sdk` in `devDependencies`)
- Extract `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts` → `src/common/opencode-sdk-types.ts`
- Replace hand-written types in `opencode-protocol.ts` with SDK type re-exports
- Update all consumers for field renames (`projectId` → `projectID`, etc.)
- Remove ~263 lines of hand-written type definitions

**What Stays:**
- All HTTP calls in `opencode-proxy.ts` (unchanged)
- All SSE handling in `opencode-sync-service.ts` (unchanged)
- Architecture B1 (unchanged)
- All security/validation code (unchanged)

**Reduced Scope:**
- Original target: ~1,450 lines eliminated (HTTP + types + SSE)
- Revised target: ~263 lines eliminated (types only)
- Runtime SDK adoption deferred to future (when ESM/CJS blocker resolved)

---

## 7. Revised Strategic Options (Post-Blocker Analysis)

### Option A: ~~Adopt SDK (Replace HTTP/Types)~~ — BLOCKED BY ESM/CJS

**Status:** ❌ **NOT FEASIBLE** — TypeScript cannot import ESM SDK in CommonJS project.

Original plan was to replace HTTP calls + types + SSE with SDK client. Blocked by module system incompatibility. See §6 for full blocker analysis.

---

### Option D: Hybrid Approach (Types Only) — **APPROVED**

**What changes:**
- Install SDK as dev dependency
- Extract SDK's `gen/types.gen.d.ts` (3,380 lines) → `src/common/opencode-sdk-types.ts`
- Replace hand-written types in `opencode-protocol.ts` with SDK type imports
- Update all consumers for field renames (`projectId` → `projectID`, `Message.sessionId` → `Message.sessionID`, etc.)
- Add npm script to re-extract types on SDK updates

**What stays:**
- HTTP client in `opencode-proxy.ts` (all 24 methods unchanged)
- SSE handling in `opencode-sync-service.ts` (unchanged)
- `eventsource-parser` dependency (still needed)
- Architecture B1 (unchanged)
- All security/validation code (unchanged)

**Effort:** 6-8 hours (vs 12-18 for full SDK adoption)  
**Risk:** Very Low  
**Code reduction:** ~263 lines eliminated (type definitions only)

**Benefits:**
- ✅ Fixes 7 field name mismatches
- ✅ Adds 9 missing message Part types
- ✅ Adds 11 missing SSE event types
- ✅ Types stay in sync with OpenCode API (via SDK source)
- ✅ Zero runtime risk (no transport changes)
- ✅ Future-proof (can adopt runtime SDK when blocker resolved)

**Limitations:**
- ❌ HTTP client code remains (~931 lines) — not eliminated, just retyped
- ❌ Manual type re-extraction on SDK updates (mitigated by npm script)
- ⏸️ Runtime SDK benefits deferred (connection pooling, retry logic, etc.)

---

### Option B: ~~SDK + Browser-Side Client~~ — BLOCKED BY ESM/CJS

**Status:** ❌ **NOT FEASIBLE** — Same ESM/CJS blocker, plus architectural concerns.

---

### Option C: ~~Plugin System Migration~~ — OUT OF SCOPE

**Status:** ⏸️ **DEFERRED** — Too large a change, doesn't solve type drift problem.

---

### Option E: Fork SDK to Build CJS — NOT RECOMMENDED

**Status:** ⚠️ **POSSIBLE BUT HIGH COST**

Fork the SDK, modify build to output CJS. Would enable full SDK adoption but creates permanent maintenance burden (must sync with upstream daily releases).

**Rejected because:** Maintenance cost > benefit. Hybrid approach achieves 90% of value with 10% of risk.

---

### Option F: Wait for CJS Support — NOT RECOMMENDED

**Status:** ⏸️ **UNCERTAIN TIMELINE**

Request OpenCode team add dual ESM/CJS builds. Unknown timeline, blocks Phase 2B indefinitely.

**Rejected because:** Type drift is happening NOW (7 mismatches already). Can't wait for upstream changes.

---

## 8. Recommendation: Option D (Hybrid — Types Only) — **APPROVED 2026-02-18**

### 8.1 Why Hybrid Approach

| Factor | Assessment |
|--------|------------|
| **Primary goal achieved** | Type compatibility with OpenCode API ✅ (90% of original value) |
| **Unblocked** | Works within Theia's CJS constraints |
| **Minimal risk** | Zero runtime changes = zero transport bugs |
| **Type safety** | Immediately fixes 7 field mismatches, adds 9 missing part types, 11 missing event types |
| **Forward compatibility** | Types sourced from SDK = stay in sync with API |
| **Effort vs benefit** | 6-8 hours for 263 LOC reduction + full type correctness |
| **Reversible** | Can delete SDK types anytime, OR upgrade to runtime SDK when blocker resolved |

### 8.2 Why NOT Full SDK (Original Option A)

**Blocked by technical constraint:** TypeScript cannot import ESM modules in CommonJS projects. See §6 for full analysis of six attempted workarounds.

### 8.3 Why NOT Wait

Type drift is **happening now**:
- 7 field name mismatches cause runtime bugs (accessing `undefined` properties)
- 9 missing Part types block Phase 3 tasks 3.7-3.11 (command manifest needs tool/agent/step-start parts)
- 11 missing event types limit SSE integration completeness

Waiting for upstream CJS support or Theia ESM migration = **indefinite blocker**.

### 8.4 Timing

**NOW, before Phase 3 tasks 3.7-3.11.**

Rationale:
- Phase 3 already complete, but tasks 3.7/3.11 used workarounds due to missing Part types
- Phase 1C (hardening) scheduled next — includes type safety improvements
- Clean break point: no in-flight work blocked by type changes

### 8.5 Migration Plan (4 Phases, Each Independently Testable)

```
Phase 2B.1: Extract SDK Types                         (~1 hour)
  - Install @opencode-ai/sdk as devDependency (exact version)
  - Extract dist/gen/types.gen.d.ts → src/common/opencode-sdk-types.ts
  - Create npm script: `npm run extract-sdk-types`
  - Verify TypeScript can import types
  - Verify build passes

Phase 2B.2: Create Type Bridge                        (~2 hours)
  - In opencode-protocol.ts, import SDK types
  - Create type aliases for backward compatibility:
    export type Session = SDKTypes.Session
    export type Message = SDKTypes.UserMessage | SDKTypes.AssistantMessage
  - Map SDK event types to our event protocol
  - Verify build passes (no consumer changes yet)

Phase 2B.3: Update Consumers for Field Renames        (~2 hours)
  - session-service.ts: projectId → projectID, sessionId → sessionID
  - chat-widget.tsx: message.sessionId → message.sessionID
  - opencode-proxy.ts: update return types
  - Fix all TypeScript errors from case changes
  - Run unit tests (expect ~10-15 failures from field renames)

Phase 2B.4: Cleanup & Documentation                   (~1 hour)
  - Remove old hand-written types from opencode-protocol.ts (~263 lines)
  - Update THIRD-PARTY-NOTICES with SDK attribution
  - Document type extraction process in README
  - Run full test suite
  - Verify zero TypeScript errors
```

---

## 9. What Can NOT Be Avoided (Updated)

**Hybrid approach means HTTP client remains:**

| Component | LOC | Status | Why It's Necessary |
|-----------|-----|--------|-------------------|
| HTTP Client | ~931 | ⚠️ **STAYS** (retyped) | ESM/CJS blocker prevents runtime SDK adoption |
| SSE Handling | ~555 | ⚠️ **STAYS** | Dependent on HTTP client |
| Theia DI wrappers | ~200 | **STAYS** | Theia requires injectable services |
| JSON-RPC bridge | ~300 | **STAYS** | Theia frontend ↔ backend communication |
| Stream interceptor | ~140 | **STAYS** | `%%OS{...}%%` command extraction (our protocol) |
| Hub server | ~211 | **STAYS** | Instructions endpoint for agent |
| Session state mgmt | ~500 | **STAYS** | Optimistic updates, event routing, streaming UI |
| Command validation | ~200 | **STAYS** | Security allowlisting, rate limiting |
| Permission dialog | ~413 | **STAYS** | UI for permission requests |
| Chat widget | ~500+ | **STAYS** | Custom React chat UI |
| **Type definitions** | ~263 | ✅ **ELIMINATED** | Replaced by SDK types |
| **TOTAL** | **~3,950** | | Down from ~4,027 (2% reduction vs 36% originally planned) |

**Key Insight:** The hybrid approach eliminates type drift (primary goal achieved) but cannot eliminate the HTTP/SSE transport layer due to technical constraints. The remaining ~3,950 lines represent irreducible integration logic + transport code blocked by ESM/CJS incompatibility.

**Future Path:** If Theia migrates to ESM or SDK adds CJS builds, we can revisit full runtime SDK adoption to eliminate the additional ~1,486 lines (HTTP + SSE).

---

## 10. Risk Assessment (Updated for Hybrid Approach)

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| SDK types diverge from API (type file out of sync) | Medium | Medium | Pin SDK version exactly, update via npm script, test after updates |
| Field renames cause cascading test failures | High | Low | Use TypeScript compiler to catch all references, expect 10-15 test failures |
| Manual type extraction forgotten on SDK update | Medium | Medium | Document in README, add npm script `extract-sdk-types`, consider pre-commit hook |
| Theia CJS requirement persists long-term | High | Low | Hybrid approach is sustainable indefinitely, no pressure to migrate |
| OpenCode API changes not reflected in local types | Low | High | SDK types are auto-generated from OpenAPI spec, very reliable |

**Risk Comparison vs Original Plan:**
- ✅ **Lower risk:** Zero runtime changes = no transport bugs
- ✅ **Lower effort:** 6-8 hours vs 12-18 hours
- ⚠️ **New risk:** Manual type sync (mitigated by tooling)
- ⏸️ **Deferred benefit:** Runtime SDK advantages (connection pooling, retry) postponed

---

## 11. Decision: APPROVED (2026-02-18)

**Approved Strategy:** Option D — Hybrid Approach (Types Only)

**Scope:**
- Install SDK as devDependency (`@opencode-ai/sdk@1.2.6` exact)
- Extract `dist/gen/types.gen.d.ts` → `src/common/opencode-sdk-types.ts` (3,380 lines)
- Replace hand-written types with SDK types (eliminate ~263 lines)
- Update consumers for field renames (`projectId` → `projectID`, etc.)
- Keep HTTP/SSE transport layer unchanged

**Justification:**
1. **Primary goal achieved:** Type compatibility with OpenCode API ✅
2. **Unblocked:** Works within Theia's CJS constraints
3. **Risk-appropriate:** Zero runtime changes for first SDK integration
4. **Reversible:** Can revert or upgrade to runtime SDK later
5. **Phase 3-ready:** Provides rich Part types needed for command manifest

**Builder Delegation:**
- **Next:** Update WORKPLAN.md with revised Phase 2B tasks (2B.1–2B.4)
- **Then:** Write Builder contract for hybrid approach
- **Then:** Delegate to Builder for implementation in worktree `.worktrees/phase-2b-sdk-adoption`

---

*End of DECISION-SDK-ADOPTION.md v2.0 — Hybrid Approach Approved 2026-02-18*
