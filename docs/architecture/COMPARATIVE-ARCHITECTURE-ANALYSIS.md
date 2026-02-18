---
id: COMPARATIVE-ARCHITECTURE-ANALYSIS
author: oracle_a7e2
status: FINAL — UPDATED 2026-02-18
date: 2026-02-18
task_id: ArchitectureComparison
---

# Comparative Architecture Analysis: theia-openspace vs openspace

> **Purpose:** Deep comparative analysis of the two OpenSpace attempts — theia-openspace (Theia-based)
> and openspace (React/Hub-based) — toward designing the optimal unified architecture for a
> client IDE with full agentic control over the environment and multiple modalities.  
> **Audience:** Oracle, technical leads, decision makers
>
> **Architecture Decision (2026-02-18):** The `%%OS{...}%%` stream interceptor has been **retired**
> in theia-openspace. **MCP is the sole agent→IDE command path.** The "dual-path" analysis in §5.2
> documents the options considered; §5.2.1 records the final decision and rationale.

---

## 1. Executive Summary

Both projects attempt the same goal: **a client IDE where an AI agent has full, equal control
over the environment — opening panes, navigating code, creating diagrams, running terminals,
presenting — with multiple modalities beyond chat.** They reach this goal via dramatically
different strategies.

| Dimension | theia-openspace (Theia) | openspace (React/Hub) |
|---|---|---|
| **Foundation** | Eclipse Theia (full IDE framework) | Vite + React SPA + Express Hub |
| **Maturity** | Phase 4 complete (🔶 DONE-NOT-VALIDATED), T3–T6 in planning | All modalities working, production-quality |
| **Agent→UI pathway** | **MCP tools → Hub McpServer → CommandBridge → CommandRegistry** (stream interceptor retired 2026-02-18) | MCP tools → POST /commands → SSE → PaneContext |
| **Completeness** | 412 unit tests, 38 E2E, modality UIs done-not-validated | 602+ unit tests, 104 E2E, modalities fully functional |
| **Complexity** | Very high (Theia DI, webpack, multi-extension, ESM/CJS) | Medium (standard React SPA + separate Node server) |
| **Innovation** | CommandRegistry as universal control plane + MCP tool surface | Canonical artifact model + versioned patch engine |
| **Biggest strength** | Real IDE capabilities (Monaco, terminal, keybindings, file tree) | Speed of iteration, modality richness, voice, MCP |
| **Biggest weakness** | Modalities done-not-validated (T3 MCP integration needed); Theia complexity tax | Not a real IDE (no Monaco editing, no terminal, limited file tree) |

---

## 2. Architecture Deep-Dive: theia-openspace

### 2.1 System Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Theia Application (Browser/Electron)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Frontend Extensions (DI)                    │   │
│  │  ChatWidget  EditorWidget  PresentationWidget  WhiteboardWidget│   │
│  │               ↕ CommandRegistry (universal control plane)     │   │
│  │  SessionService  SyncService  PaneService  BridgeContribution  │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                              │ JSON-RPC over WebSocket               │
│  ┌──────────────────────────┴───────────────────────────────────┐   │
│  │                      Backend (Node.js)                        │   │
│  │  OpenCodeProxy (HTTP + SSE, no stream interceptor)           │   │
│  │  Hub (MCP server + state cache + instructions endpoint)      │   │
│  └──────────────────────────┬─────────────────────────────────-─┘   │
└─────────────────────────────┼────────────────────────────────────────┘
                              │ REST + SSE          ▲ MCP tool calls
                   ┌──────────▼──────────┐          │
                   │  OpenCode Server    │──────────┘
                   │  (unmodified Go)    │
                   └─────────────────────┘
```

### 2.2 Agent→UI Command Pipeline

> **Architecture Decision (2026-02-18):** Stream interceptor retired. MCP is the sole path.

**Path (current):** `Agent → MCP tool call (e.g. openspace.pane.open) → Hub McpServer → CommandBridge → CommandRegistry.executeCommand() → IDE action; result returned to agent`

**Key insight:** Every modality action is a **Theia Command** AND an **MCP tool**. The MCP tool handler calls the CommandRegistry; user keybindings, menus, and agent tool calls all reach the same command handler. MCP gives the agent structured return values and protocol introspection. CommandRegistry gives universal discoverability and keybinding parity.

### 2.3 Extension Architecture

Six Theia extensions, each with DI modules:
- `openspace-core` — protocols, session management, Hub (MCP server + state cache), OpenCodeProxy
- `openspace-chat` — ChatWidget, PromptInput, MessageTimeline, ChatAgent (Theia AI)
- `openspace-presentation` — Reveal.js widget, presentation commands + MCP tools
- `openspace-whiteboard` — tldraw widget, whiteboard commands + MCP tools
- `openspace-layout` — ApplicationShell customization, theming
- `openspace-settings` — settings widgets
- `openspace-voice` *(planned — Phase T6)* — Voice modality (3-FSM pipeline)

### 2.4 Current State (Feb 2026)

- ✅ Phase 0: Scaffold (all 8 tasks)
- ✅ Phase 1: Core connection + Hub (14 tasks)
- ✅ Phase 1B1: Architecture refactor C→B1 (8 tasks)
- ✅ Phase 2B: SDK types adoption (hybrid approach — ESM/CJS blocker)
- ✅ Phase 3: Agent IDE control (11 tasks — 20 commands, security)
- ✅ Phase 1C: Code hardening (54 issues fixed)
- ✅ E2E suite: 38 pass, 1 skip, 0 fail
- 🔶 Phase 4: Modality surfaces (presentation/whiteboard widgets code-complete, NOT integrated/validated)
- ⬜ Phase T3: MCP Agent Control System (planned — replaces stream interceptor)
- ⬜ Phase T4: PatchEngine (planned — versioned file mutations)
- ⬜ Phase T5: ArtifactStore (planned — atomic writes, audit log)
- ⬜ Phase T6: Voice modality (planned — 3-FSM pipeline from openspace)
- 🔴 Phase 5: Polish & Desktop (blocked on T3+T4+T5)

---

## 3. Architecture Deep-Dive: openspace

### 3.1 System Topology

```
┌─────────────────────────────────────────────────────────────┐
│              React SPA (Vite, Port 5173)                     │
│  9 Context Providers + TanStack React Query                  │
│  Binary Tree Pane System + 5 Modalities                      │
│                                                              │
│  useArtifact()  useAgentCommands()  usePaneStateReporter()   │
└───────────────┬────────────────────────┬─────────────────────┘
                │ HTTP + SSE             │ HTTP + SSE
   ┌────────────▼────────┐   ┌───────────▼──────────────────┐
   │  OpenCode Server    │   │  Runtime Hub (Express 5)     │
   │  (Go, :3000)        │   │  (:3001)                     │
   │  Sessions/Messages  │   │  ArtifactStore + PatchEngine │
   │  Model routing      │   │  VoiceOrchestrator (3 FSMs)  │
   └─────────────────────┘   │  SSE EventEmitter            │
                              └──────────────┬───────────────┘
                                             │ stdio
                                   ┌─────────▼──────────────┐
                                   │  MCP Server (21 tools) │
                                   │  whiteboard.* drawing.*│
                                   │  presentation.* pane.* │
                                   │  editor.*              │
                                   └────────────────────────┘
```

### 3.2 Agent→UI Command Pipeline

**Path:** `Agent LLM → MCP tool call (e.g. pane.open) → opencode stdio → MCP Server → POST /commands → Hub → SSE PANE_COMMAND → Client useAgentCommands → PaneContext dispatch`

**5-hop pipeline.** More explicit and tool-native (agent uses `pane.open` intentionally, not
inline text smuggling). MCP tools are typed, validated with Zod schemas, return structured responses.

### 3.3 Artifact Architecture

**Key innovation:** Canonical artifact model with versioned patch engine.

```
User or Agent action
    ↓
Validation (schema → semantic → policy)
    ↓
PatchEngine (operation-based, baseVersion OCC)
    ↓
ArtifactStore (atomic write → backup → audit log)
    ↓
SSE FILE_CHANGED event
    ↓
useArtifact hook (all modalities use same pattern)
    ↓
Modality re-render (tldraw, Reveal.js, Monaco, etc.)
```

**Every modality** uses the same `useArtifact<T>` hook for loading, live sync (SSE), multi-tab
(BroadcastChannel), auto-save (debounced PUT). This is elegant and uniform.

### 3.4 Current State (Feb 2026)

- ✅ Whiteboard modality (tldraw, sequence diagrams, IDiagram canonical model)
- ✅ Presentation modality (Reveal.js, markdown-based slides)
- ✅ Drawing modality (tldraw, versioned patch engine)
- ✅ Editor modality (Monaco, file open/read, Shiki syntax highlight)
- ✅ Voice modality (Whisper STT + OpenAI TTS, 3-FSM orchestration)
- ✅ Binary tree pane system with drag/drop, splits, tabs
- ✅ Agent→UI control (21 MCP tools, SSE pipeline)
- ✅ Full test suite: 602+ unit, 104 E2E
- 🔴 NOT a real IDE: No terminal, no file editing, no LSP, no real file tree
- 🔴 NOT desktop-capable: Browser SPA only
- 🔴 ESM/CJS gap with SDK (not yet resolved)

---

## 4. Comparative Analysis

### 4.1 What theia-openspace Does Better

#### 4.1.1 Real IDE Capabilities
Theia provides out-of-the-box: Monaco Editor with full LSP, an actual terminal (xterm.js), a real
file tree with proper workspace semantics, keyboard shortcut system, menu system, command palette,
debug adapter, source control integration. These would take **months** to replicate from scratch.

The openspace project's "editor" is Monaco embedded in a React div reading a file over HTTP —
not a full LSP-integrated editing experience.

#### 4.1.2 CommandRegistry as Universal Control Plane
This is theia-openspace's most important architectural innovation. **Every action in the IDE is a
Theia Command.** The same `commandService.executeCommand('openspace.pane.open', {...})` is
called by:
- User keyboard shortcuts
- Menu items
- Agent (via SyncService after stream interception)
- Tests

This means the agent's capabilities are the SAME as the user's capabilities. The agent cannot
do anything the user cannot do, and can do everything the user can. Zero divergence.

The **automatic discovery** consequence is powerful: add a new Theia command → BridgeContribution
picks it up → manifest auto-updates → Hub regenerates system prompt → agent learns the new
capability. **Zero prompt engineering.**

#### 4.1.3 Theia AI Integration (Architecture B1)
Registering `OpenspaceChatAgent` in Theia's AI registry provides ecosystem integration: @mentions
in built-in chat, settings panel, future Theia AI features. This is forward-looking.

#### 4.1.4 Security Model
The stream interceptor approach (`%%OS{...}%%` in text) has a **security advantage** over MCP:
- Commands come from the agent's own output stream (same auth as the session)
- No separate network endpoint for command injection
- 3-tier command allowlist validated at the point of execution
- Prompt injection protection (ignore `%%OS{...}%%` in code fences)
- Dangerous command confirmation (rm, sudo, etc.)
- Sensitive file denylist (.env, .git/, id_rsa)

#### 4.1.5 Electron Desktop Path
Theia natively supports Electron packaging. theia-openspace has planned Phase 5 for this.
The openspace project would require substantial work to become a desktop app.

#### 4.1.6 Extension Ecosystem
Theia supports VS Code plugins. theia-openspace can leverage the entire VS Code extension
marketplace for language support, themes, and tools — without building them.

---

### 4.2 What openspace Does Better

#### 4.2.1 Working Modalities
The most significant practical difference: **openspace has working modalities today.**
- Whiteboard: tldraw with IDiagram canonical model, bidirectional mapping
- Diagrams: 5 types (sequence, UML class, ER, C4, Gantt) with agent control
- Presentation: Reveal.js with Markdown slides, agent navigation
- Voice: 3-FSM pipeline (Whisper STT + TTS), narrates active context
- All modalities use `useArtifact` — a uniform live sync pattern

theia-openspace has stub extensions for presentation and whiteboard but they are not functional.

#### 4.2.2 MCP as Agent Tool Surface
Using Model Context Protocol (MCP) to expose agent UI-control tools is **architecturally
cleaner** than inline text smuggling:
- Tools are explicitly typed with Zod schemas
- Agent makes intentional `pane.open(...)` calls, not hidden `%%OS{...}%%` annotations
- Tool responses provide structured feedback (commandId, success, errors)
- Tools are discoverable via MCP protocol introspection (not just system prompt)
- MCP is an industry-standard protocol with growing support

#### 4.2.3 Canonical Artifact + Versioned Patch Engine
The `PatchEngine` with `baseVersion` OCC (optimistic concurrency control) is production-grade:
- Operation-based mutations (addNode, updateEdge, addSlide...)
- Conflict detection on version mismatch
- Deterministic reproducibility (same baseVersion + ops = same result)
- Rolling backups (20 versions) in ArtifactStore
- Audit log (NDJSON) for all artifact changes

theia-openspace does not have an equivalent — its whiteboard and presentation services are
designed but not implemented with this rigor.

#### 4.2.4 Iteration Speed
React + Vite is dramatically faster to iterate on than Theia + yarn workspaces + webpack:
- Vite HMR: <100ms
- Theia rebuild: 30-60 seconds for full TypeScript + webpack
- Test feedback: vitest in <1s vs Mocha in several seconds
- Onboarding: standard React developer vs Theia DI/contribution system specialist

#### 4.2.5 useArtifact — Elegant Universal Pattern
Every modality in openspace uses the same hook:
```typescript
const { data, setData } = useArtifact<IDiagram>(path, { parse, serialize, onRemoteChange })
```
Initial load, live SSE sync, multi-tab BroadcastChannel, auto-save debounce, error handling —
all handled uniformly. This is a pattern theia-openspace should adopt.

#### 4.2.6 Voice Modality
openspace has a working voice pipeline with 3 coordinated FSMs (SessionFSM, AudioFSM,
NarrationFSM), Whisper integration for STT, and OpenAI TTS for narration of active context.
theia-openspace has no voice modality.

#### 4.2.7 Test Maturity
openspace: 602+ unit tests, 104 E2E tests, batched execution protocol, phantom fix detection.
theia-openspace: 412 unit tests, 38 E2E (recently fixed from fake tests), but E2E infrastructure
was fragile until 2026-02-18.

---

### 4.3 Shared Architectural Weaknesses

#### 4.3.1 ESM/CJS Impedance
**theia-openspace:** The `@opencode-ai/sdk` is ESM-only; Theia requires CJS. The hybrid approach
(types-only extraction) works but blocks direct SDK client usage. Full resolution requires
Theia's own ESM migration or SDK CJS builds.

**openspace:** Same SDK exists; similar blocker would apply if trying to use SDK directly in
hub (Node.js CJS context).

#### 4.3.2 Single-Client Architecture
Both projects are designed for a single connected browser client. Neither has real multi-user
or multi-tab coordination beyond basic SSE broadcast. Conflict resolution is "last write wins."

#### 4.3.3 No Authentication/Authorization
Both assume localhost trusted environment. Neither has auth between components. Suitable for
local development, but a blocker for any future cloud/remote deployment.

#### 4.3.4 Agent Command Feedback Loop
In both architectures, the agent sends a command and gets a success/failure response — but
there is **no rich feedback loop** back to the agent showing the actual state after the command
executed (e.g., "the file opened successfully in pane X, and the visible code region is lines
1-50"). The agent is essentially operating blind after each command.

---

## 5. The Optimal Architecture (Recommendations)

### 5.1 Strategic Verdict: Converge, Don't Replace

Neither project should be abandoned. They are **complementary, not competing.**

**Recommendation:** Use theia-openspace as the primary development target (it becomes the
full IDE), and **migrate openspace's best patterns and working implementations** into it.

The convergence strategy:

| From openspace | Into theia-openspace | Priority |
|---|---|---|
| MCP as primary agent tool surface | Add alongside stream interceptor | HIGH |
| Canonical artifact + PatchEngine | Adopt for whiteboard/presentation backend | HIGH |
| useArtifact pattern | Implement in Theia React widgets | HIGH |
| Voice modality (3 FSMs) | Port to openspace-voice extension | MEDIUM |
| Working whiteboard (tldraw + IDiagram) | Replace stub in openspace-whiteboard | HIGH |
| Working presentation (Reveal.js) | Replace stub in openspace-presentation | HIGH |
| Drawing modality | Add as new extension | MEDIUM |
| Binary tree pane system UX patterns | Inform Theia ApplicationShell config | LOW |

---

### 5.2 Agent Command Architecture Options: Dual-Path Analysis

The two approaches to agent→UI commands were analyzed as candidates:

```
┌──────────────────────────────────────────────────────────────────┐
│                Agent Command Architecture Options                  │
│                                                                   │
│  Option A: Stream Interceptor (retired)                           │
│  ─────────────────────────────────────────────────────           │
│  Agent response text → %%OS{...}%% blocks → StreamInterceptor    │
│  → RPC callback → SyncService → CommandRegistry                  │
│                                                                   │
│  ✅ Best for: Inline, contextual, ad-hoc commands                │
│  ✅ Best for: Commands that emerge from reasoning/narration       │
│  ❌ One-way: agent gets no result from commands                   │
│  ❌ Fragile: stateful streaming parser, chunk boundary bugs       │
│  ❌ Silent failures: agent cannot know if a command failed        │
│  ❌ Stream pollution: %%OS{...}%% must be stripped from text      │
│                                                                   │
│  Option B: MCP Tools (selected)                                   │
│  ─────────────────────────────────────────────────────           │
│  Agent → explicit tool call → Hub McpServer → CommandBridge      │
│  → CommandRegistry → IDE action; result returned to agent        │
│                                                                   │
│  ✅ Structured return values (agent gets results inline)          │
│  ✅ Type-safe: JSON Schema validation on every call               │
│  ✅ Introspectable: agent calls tools/list to discover tools      │
│  ✅ No stream parsing: no chunk boundary state machine            │
│  ✅ Rich feedback: errors returned synchronously                  │
│  ✅ Standard protocol: MCP is the emerging agent tool standard    │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.2.1 Architecture Decision: MCP-Only (Recorded 2026-02-18)

**Decision:** MCP replaces stream interceptor entirely. No dual-path. The stream interceptor (`%%OS{...}%%`) is **retired**.

**Rationale:**

1. **Structured return values win.** The stream interceptor is fundamentally one-way — the agent emits a command and never knows if it succeeded. MCP tool calls return `{ success, data, error }` before the agent continues reasoning. This is the single most valuable improvement.

2. **No stream parsing complexity.** The stream interceptor required a 5-state parser with chunk-boundary handling, brace-depth tracking, timeout guards, and a comprehensive test matrix for edge cases. MCP eliminates all of this.

3. **Silent failure elimination.** With `%%OS{...}%%`, failed commands were silently dropped. The workaround was a deferred command-result log injected into the next system prompt. With MCP, the agent gets the error immediately and can reason about recovery.

4. **Dual-path was not simpler.** Running both paths in parallel would require maintaining two dispatch systems, two test matrices, and two failure modes — doubling surface area for bugs. A single canonical path is strictly better.

5. **MCP is already in opencode.** opencode has native MCP client support. Adding the Hub as an MCP server requires zero opencode modification — just a new entry in `opencode.json`.

**Components removed:**
- `OpenCodeProxy.interceptStream()` and all `%%OS{...}%%` parsing
- `OpenCodeClient.onAgentCommand()` RPC callback
- `SyncService.onAgentCommand()` handler and `CommandQueue`
- System prompt `%%OS{...}%%` instructions

**Components added:**
- `Hub.McpServer` — `@modelcontextprotocol/sdk` MCP server at `/mcp`
- `CommandBridge` — internal adapter: MCP handler → Theia RPC → CommandRegistry
- `opencode.json` `mcp` block — registers Hub as MCP provider
- 21+ `openspace.*` MCP tools (see TECHSPEC §6.5)

---

### 5.3 Artifact Architecture Recommendations

**theia-openspace should adopt the PatchEngine pattern from openspace:**

1. **ArtifactStore equivalent:** The current Hub stores manifest/state. Extend it to store
   modality artifacts (diagrams, decks) with atomic writes, rolling backups, audit log.

2. **PatchEngine equivalent:** The current whiteboard/presentation services should accept
   `{ baseVersion, operations }` patches, not blind full-document rewrites.

3. **useArtifact equivalent in Theia:** Each modality widget should have a service that:
   - Loads artifact from Hub on widget open
   - Subscribes to SSE FILE_CHANGED events (or RPC callbacks from backend)
   - Auto-saves with debounce
   - Reports to backend on remote change (for widget re-render)

---

### 5.4 The 7 Architectural Improvements for theia-openspace

> **Status update (2026-02-18):** T1 and T2 are `🔶 DONE-NOT-VALIDATED` (code exists, awaiting T3 integration). T3 description updated to reflect the MCP-only decision.

| # | Improvement | Rationale | Effort | Status |
|---|---|---|---|---|
| **T1** | Working whiteboard widget (openspace's tldraw patterns) | The stub needs to become functional. openspace solved this completely. | 2-3 days | 🔶 Done-Not-Validated |
| **T2** | Working presentation widget (openspace's Reveal.js patterns) | Same situation. openspace has 5 presentation tools and navigation. | 1-2 days | 🔶 Done-Not-Validated |
| **T3** | **Replace** stream interceptor with MCP server (sole path) | MCP provides structured return values, typed tool calls, introspection, no stream parsing. **Decision: MCP-only, stream interceptor retired.** | 2-3 days | ⬜ Planned |
| **T4** | Adopt PatchEngine for whiteboard/presentation artifact mutations | Versioned, conflict-safe, deterministic. Essential for agent-controlled artifacts. | 1-2 days | ⬜ Planned |
| **T5** | Add ArtifactStore (atomic writes, backups, audit log) | Hub currently only stores pane state. Need artifact persistence. | 1 day | ⬜ Planned |
| **T6** | Port Voice modality from openspace (3-FSM pipeline) | openspace has a complete, tested implementation. Port rather than rebuild. | 2-3 days | ⬜ Planned |
| **T7** | Rich agent feedback loop | After each command, collect actual state (which pane opened, which file is visible, cursor location) and inject into the next agent context. Partially addressed by MCP return values; full state injection still needed. | 3-5 days | ⬜ Future |

---

### 5.5 The 5 Architectural Improvements for openspace

| # | Improvement | Rationale | Effort |
|---|---|---|---|
| **O1** | ~~Add stream interceptor as secondary command path~~ — **Not recommended** | Decision: MCP is superior for all command use cases. Dual-path adds complexity without benefit. | N/A |
| **O2** | Integrate actual Monaco editor via iframe or monaco-editor directly | Current "editor" is read-only viewer. For real coding, need LSP + write + formatting. | 1 week |
| **O3** | Add real terminal via xterm.js | No terminal at all currently. Agent needs a terminal to run code. | 2-3 days |
| **O4** | Reduce 5-hop agent command latency | Agent → opencode → MCP → Hub → SSE → Client is high latency. Consider direct WebSocket from Hub to client with command ACK. | 2 days |
| **O5** | Electron packaging | React app in Electron (electron-vite) for desktop experience. Needed for native file access, notifications, system tray. | 3-4 days |

---

### 5.6 The Perfect Architecture (Unified Target)

If building from scratch with lessons from both projects:

```
┌──────────────────────────────────────────────────────────────────────┐
│                   OpenSpace IDE (Perfect Architecture)               │
│                                                                      │
│   Foundation: Theia (IDE skeleton) or Electron + custom shell        │
│   UI: React (for modality widgets) within Theia or as Electron app   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Modality Surface Layer                         │  │
│  │  ChatWidget  Monaco(edit)  Whiteboard  Presentation  Terminal  │  │
│  │  Drawing     Voice        DiffReview  Browser       Diagram    │  │
│  └──────────────────────┬─────────────────────────────────────────┘  │
│                         │                                            │
│  ┌──────────────────────▼─────────────────────────────────────────┐  │
│  │               Universal Control Plane                           │  │
│  │  CommandRegistry — user keybinds, menus, agent, tests all here  │  │
│  │  ArtifactStore  — atomic writes, backups, audit, versioning     │  │
│  │  PatchEngine    — versioned operation-based mutations            │  │
│  │  useArtifact    — uniform live sync pattern for all modalities   │  │
│  └──────────────────────┬─────────────────────────────────────────┘  │
│                         │                                            │
│  ┌──────────────────────▼─────────────────────────────────────────┐  │
│  │               Agent Integration Layer (MCP-Only)                │  │
│  │                                                                 │  │
│  │  MCP Tools (21+ tools across modalities)                        │  │
│  │    Explicit agent tool calls → JSON Schema validated            │  │
│  │    → Hub McpServer → CommandBridge → CommandRegistry            │  │
│  │    → result returned synchronously to agent                     │  │
│  │                                                                 │  │
│  │  Automatic Discovery: agent calls tools/list → all tools        │  │
│  │  Rich Feedback: every tool returns { success, data, error }     │  │
│  └──────────────────────┬─────────────────────────────────────────┘  │
│                         │                                            │
│  ┌──────────────────────▼─────────────────────────────────────────┐  │
│  │               Infrastructure Layer                              │  │
│  │  OpenCodeProxy (HTTP + SSE — no stream interceptor)             │  │
│  │  Hub (MCP server + artifacts + pane state + instructions)       │  │
│  │  VoiceOrchestrator (3 FSMs: Session, Audio, Narration)          │  │
│  └──────────────────────┬─────────────────────────────────────────┘  │
│                         │                                            │
└─────────────────────────┼────────────────────────────────────────────┘
                          │ REST + SSE               ▲ MCP tool calls
                ┌─────────▼─────────────────────────┘
                │   OpenCode Server                  │
                │   (Go, unmodified)                 │
                │   configured with Hub as MCP server│
                └────────────────────────────────────┘
```

**Key differentiators from both current implementations:**

1. **MCP-only command path** — typed tool calls, structured return values, introspection (theia-openspace's current T3 direction)
2. **Universal control plane** — everything goes through CommandRegistry (Theia's insight)
3. **Canonical artifact model** — PatchEngine + ArtifactStore for all modalities (openspace's insight)
4. **`useArtifact` pattern** — all modality widgets use same live sync hook (openspace's insight)
5. **Rich feedback loop** — agent gets actual state after each MCP tool call (MCP's native capability)
6. **Automatic discovery** — new tool → MCP `tools/list` → agent learns on next session (MCP's introspection)
7. **All modalities working** — no stubs, all feature-complete (openspace's execution quality)
8. **Real IDE skeleton** — Monaco with LSP, terminal, file tree (Theia's foundation)

---

## 6. Priority Action Plan

### For theia-openspace (Current Focus)

**In progress / next up (Phase T3–T6):**
1. **T3 — MCP Agent Control System:** Replace stream interceptor with Hub MCP server. Expose all `openspace.*` commands as MCP tools. Wire `opencode.json`. Remove `%%OS{...}%%` infrastructure.
2. **T4 — PatchEngine:** Versioned operation-based file mutations with OCC. Powers `openspace.file.patch` MCP tool.
3. **T5 — ArtifactStore:** Atomic writes, rolling snapshots (last 20), NDJSON audit log. Wired into file MCP tools.
4. **T6 — Voice modality:** Port openspace's 3-FSM pipeline into `openspace-voice` extension.

**After T3–T6 complete:**
5. **Phase 5 — Polish & Desktop:** Electron packaging, themes, performance.
6. **T7 — Rich agent feedback loop:** Full IDE state (active file, cursor, visible lines) injected into agent context after each command.

### For openspace (Parallel Maintenance)

Only if openspace continues as a separate track:
1. Add real Monaco editor with write support (O2)
2. Add xterm.js terminal (O3)
3. Electron packaging (O5)

---

## 7. Conclusion

**theia-openspace** has the **right foundation** (a real IDE) and the **right agent architecture**
(CommandRegistry as universal control plane, MCP as the agent tool surface, automatic discovery
via `tools/list`). Phase 4 modality surfaces are code-complete but not yet integrated. The
stream interceptor has been retired in favor of MCP.

**openspace** has **working modalities** and **better artifact architecture** (PatchEngine, ArtifactStore,
useArtifact). It is missing a real IDE foundation.

The ideal path forward is: **theia-openspace as the primary vehicle, with openspace's modality
implementations ported in.** This gives you the IDE foundation from Theia and the modality
richness from openspace — the best of both.

The most impactful single improvement to make right now is: **implement Phase T3 (MCP Agent
Control System)** — which validates Phase 4 (modality widgets), establishes the canonical agent
command path, and unblocks T4, T5, and Phase 5.

---

*Document generated: 2026-02-18*  
*Author: Oracle (ID: oracle_a7e2)*  
*Last updated: 2026-02-18 — MCP-only decision recorded; stream interceptor retired*  
*Cross-reference: `/Users/Shared/dev/theia-openspace` and `/Users/Shared/dev/openspace`*
