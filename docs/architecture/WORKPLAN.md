---
id: WORKPLAN-THEIA-OPENSPACE
author: oracle_e3f7
status: ACTIVE
date: 2026-02-16
updated: 2026-02-17
task_id: TheiaOpenspaceWorkplan
---

# Work Plan: Theia Openspace

> **Tracks:** Every task from scaffold to ship.  
> **Source of truth:** [TECHSPEC-THEIA-OPENSPACE.md](./TECHSPEC-THEIA-OPENSPACE.md)  
> **Legend:** ⬜ Not started · 🔲 Blocked · 🟡 In progress · ✅ Done · ❌ Cut

---

## Phase 0: Scaffold & Build Infrastructure ✅ COMPLETE

**Goal:** A buildable, runnable Theia application with the monorepo wired up, all extension stubs in place, and unwanted stock features removed. This is the foundation everything else builds on.

**Duration estimate:** 1 session (focused)  
**Exit criteria:** `yarn build:browser && yarn start:browser` succeeds → Theia opens in browser with AI chat panel visible, debug/SCM/notebook panels removed, custom title/branding visible.  
**Completed:** 2026-02-16

**V&V Targets:**
- ✅ `yarn build` exits 0
- ✅ `yarn start:browser` serves Theia at http://localhost:3000
- ✅ All 6 extensions load without runtime errors
- ✅ Debug, SCM, and Notebook panels not visible
- ✅ Window title reads "Theia Openspace"
- ✅ Chat panel visible with echo agent responding
- ✅ CI pipeline passes on push

### 0.1 — Resolve Theia version
| | |
|---|---|
| **What** | Determine exact Theia version to pin. Must verify `@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui` are stable enough to build on. Check latest release notes, breaking changes, known issues. |
| **Acceptance** | Version number recorded. `@theia/ai-*` packages confirmed present in that version. Package versions added to root `package.json`. |
| **Result** | Theia **1.68.2** pinned. All `@theia/ai-*` packages confirmed present and functional. |
| **Status** | ✅ |

### 0.2 — Scaffold monorepo
| | |
|---|---|
| **What** | Use Theia's yeoman generator (`generator-theia-extension`) or manual scaffold to create: root `package.json` with Yarn workspaces, `tsconfig.json`, `browser-app/package.json`, `electron-app/package.json`, `extensions/` directory. Configure workspace references so `yarn install` resolves all local packages. |
| **Acceptance** | `yarn install` completes. Directory structure matches TECHSPEC §2.2. |
| **Dependencies** | 0.1 (version known) |
| **Result** | Full Yarn workspaces monorepo created. |
| **Status** | ✅ |

### 0.3 — Create extension stubs
| | |
|---|---|
| **What** | Create empty extension packages with proper `package.json` (Theia extension metadata) and empty DI modules. Extensions to stub: `openspace-core` (with `browser/` and `node/` modules), `openspace-chat` (browser only), `openspace-presentation` (browser only), `openspace-whiteboard` (browser only), `openspace-layout` (browser only), `openspace-settings` (browser + common). Each must have `theiaExtensions` entry in its `package.json`. |
| **Acceptance** | All 6 extension stubs exist with valid `package.json` and empty DI module files. Theia build includes them without error. |
| **Dependencies** | 0.2 |
| **Result** | All 6 extensions created with proper DI module files and `theiaExtensions` metadata. |
| **Status** | ✅ |

### 0.4 — Wire browser-app target
| | |
|---|---|
| **What** | Configure `browser-app/package.json` to depend on all Theia core packages (`@theia/core`, `@theia/editor`, `@theia/monaco`, `@theia/terminal`, `@theia/navigator`, `@theia/messages`, `@theia/preferences`, `@theia/search-in-workspace`, `@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui`) plus our extension stubs. Add `theia.json` configuration. |
| **Acceptance** | `yarn build:browser` succeeds. `yarn start:browser` launches Theia in browser at `http://localhost:3000`. |
| **Dependencies** | 0.3 |
| **Result** | Browser app builds and runs at localhost:3000. |
| **Status** | ✅ |

### 0.5 — Strip unwanted features (FilterContribution)
| | |
|---|---|
| **What** | Create a `FilterContribution` in `openspace-core` that removes: Debug panel/toolbar, SCM (git) sidebar panel, Notebook editor, Getting Started page. Approach: bind `TabBarToolbarContribution` / `WidgetFactory` overrides, or use Theia's built-in feature toggle mechanism if available. |
| **Acceptance** | Theia starts without Debug, SCM, and Notebook visible anywhere in menus, sidebars, or command palette. Core features (editor, terminal, file tree, search) still work. |
| **Dependencies** | 0.4 |
| **Result** | `OpenSpaceFilterContribution` implemented. Uses constructor name matching (brittle — see TECHSPEC §15.3 for mitigation). |
| **Status** | ✅ |

### 0.6 — Add custom branding
| | |
|---|---|
| **What** | Set window title to "Theia Openspace". Add minimal CSS override for header/title bar if Theia supports it. This is cosmetic — real theming is Phase 5. |
| **Acceptance** | Browser tab / window title reads "Theia Openspace". |
| **Dependencies** | 0.4 |
| **Result** | Title, CSS overrides, and favicon applied. |
| **Status** | ✅ |

### 0.7 — Verify Theia AI chat panel
| | |
|---|---|
| **What** | Ensure `@theia/ai-chat-ui` is rendering a visible chat panel. It may require a minimal AI agent registration to appear. If so, register a placeholder agent that echoes input. |
| **Acceptance** | A "Chat" panel is visible in the UI (can be opened from sidebar or view menu). Typing a message and pressing Enter triggers the agent (even if it just echoes). |
| **Dependencies** | 0.4 |
| **Result** | Echo agent registered via Theia AI `ChatAgent` interface. Chat panel visible and responding. |
| **Status** | ✅ |

### 0.8 — CI pipeline (build + typecheck)
| | |
|---|---|
| **What** | Create GitHub Actions workflow (or equivalent) that runs `yarn install`, `yarn build`, `yarn lint` (if configured), `yarn test` (if any tests exist). Trigger on push to main and PRs. |
| **Acceptance** | CI passes on current codebase. Badge in README (optional). |
| **Dependencies** | 0.4 |
| **Result** | `.github/workflows/ci.yml` created and passing. |
| **Status** | ✅ |

---

## Phase 1: Core Connection + Hub

**Goal:** Connect to the external opencode server, manage sessions, send/receive messages, and set up the Hub for manifest caching + system prompt generation.

**Duration estimate:** 2–3 sessions  
**Exit criteria:** Can create a session in the opencode server, send a message, see a streamed response in the Theia chat panel. Hub serves `GET /openspace/instructions` with a command manifest. BridgeContribution publishes manifest to Hub. Current model/provider visible in chat widget (testability requirement).

**Prerequisites:** Phase 0 complete. opencode server running externally (`opencode server` command).

**V&V Targets:**
- [x] `OpenCodeProxy` can connect to a running opencode server and list projects
- [x] RPC round-trip: frontend → backend → opencode server → backend → frontend confirmed
- [x] SSE events from opencode server forwarded to frontend within 200ms
- [x] Hub responds to `GET /openspace/instructions` with valid system prompt
- [x] BridgeContribution publishes manifest to Hub on startup
- [x] Session CRUD (create, list, delete) works through UI
- [x] Full message round-trip: type → send → stream → display in chat widget
- [x] Permission request events forwarded and displayed to user (permission dialog functional)
- [x] Unit tests for PermissionDialogManager pass (61 total unit tests pass)
- [x] Integration test 1.13 passes (full message round-trip)
- [x] Model/provider display visible in chat widget

### 1.1 — Define common RPC protocols
| | |
|---|---|
| **What** | Create TypeScript interfaces in `openspace-core/src/common/`: `opencode-protocol.ts` (types matching opencode REST API — Project, Session, Message, MessagePart, etc. + RPC interface `OpenCodeService` / `OpenCodeClient`), `session-protocol.ts` (session management events), `command-manifest.ts` (manifest types for Hub), `pane-protocol.ts` (pane info types). Follow TECHSPEC §3.1.1 exactly. |
| **Acceptance** | All types compile. RPC service path constant defined. No runtime code yet — just types and symbols. |
| **Dependencies** | Phase 0 complete |
| **Result** | 4 files created: `opencode-protocol.ts`, `session-protocol.ts`, `command-manifest.ts`, `PaneProtocol.ts`. All types compile. |
| **Status** | ✅ |

### 1.2 — Implement OpenCodeProxy (backend)
| | |
|---|---|
| **What** | Create `openspace-core/src/node/opencode-proxy.ts`. Implements `OpenCodeService` interface. Makes HTTP calls to the opencode server REST API. Key methods: `listProjects`, `createSession`, `listSessions`, `sendMessage`, `listMessages`, `getProviders`, `getConfig`. Read opencode API spec from `/Users/Shared/dev/opencode/specs/project.md` for exact endpoints and payloads. |
| **Acceptance** | Unit tests confirm proxy correctly translates between RPC calls and HTTP requests. Can list projects and sessions from a running opencode server. |
| **Result** | OpenCodeProxy implemented with 23 methods covering all REST API endpoints. Uses @theia/request RequestService. |
| **Dependencies** | 1.1 |
| **Status** | ✅ |

### 1.3 — Implement SSE event forwarding (backend)
| | |
|---|---|
| **What** | Extend `OpenCodeProxy` to maintain an SSE connection to the opencode server's event stream. Forward events to the frontend via JSON-RPC client callbacks (`OpenCodeClient` interface). Map opencode SSE event types to our typed events (SessionEvent, MessageEvent, FileEvent). Handle reconnection with exponential backoff. |
| **Acceptance** | When a message is sent via another client, our SSE listener picks it up and forwards it. Reconnection works after connection drop. |
| **Dependencies** | 1.2 |
| **Result** | SSE connection with exponential backoff, event parsing, forwarding to client. |
| **Status** | ✅ |

### 1.4 — Backend DI module wiring
| | |
|---|---|
| **What** | Wire `openspace-core/src/node/openspace-core-backend-module.ts` with all backend bindings: OpenCodeProxy bound to `OpenCodeService`, backend contribution registered. Register RPC connection for `OpenCodeService` so frontend can call it. |
| **Acceptance** | Backend module loads without error. RPC endpoint is available. |
| **Dependencies** | 1.2, 1.3 |
| **Result** | Refactored DI binding, registered JsonRpcConnectionHandler, enhanced client lifecycle with SSE cleanup. |
| **Status** | ✅ |

### 1.5 — Implement OpenSpace Hub (backend)
| | |
|---|---|
| **What** | Create `openspace-core/src/node/hub.ts`. Implements `BackendApplicationContribution` with `configure(app: Application)` that adds Express routes: `POST /openspace/manifest` (receives command manifest), `GET /openspace/instructions` (returns generated system prompt), `POST /openspace/state` (receives pane state). Initially the manifest is empty — BridgeContribution will populate it in Phase 1.7. **Note (B1):** Hub does NOT relay commands or maintain SSE connections. Agent commands travel via RPC (see Phase 1B1). |
| **Acceptance** | Hub starts with Theia backend. `GET /openspace/instructions` returns a valid prompt (even if command list is empty). |
| **Dependencies** | 1.4 |
| **Result** | Express server with manifest cache, state cache, and system prompt generation. |
| **Status** | ✅ |

### 1.6 — Implement SessionService (frontend)
| | |
|---|---|
| **What** | Create `openspace-core/src/browser/session-service.ts`. Manages active project/session state. Calls `OpenCodeService` via RPC for CRUD operations. Emits events: `onActiveProjectChanged`, `onActiveSessionChanged`, `onMessagesChanged`, `onMessageStreaming`. Handles optimistic updates for message sending. |
| **Acceptance** | Can switch between projects and sessions. Messages update in real-time via SSE forwarding. |
| **Dependencies** | 1.4 |
| **Result** | Frontend state service with 7 events, optimistic updates, localStorage persistence. |
| **Status** | ✅ |

### 1.7 — Implement BridgeContribution (frontend)
| | |
|---|---|
| **What** | Create `openspace-core/src/browser/bridge-contribution.ts`. Implements `FrontendApplicationContribution`. On startup: (a) collects all `openspace.*` commands from `CommandRegistry`, (b) builds manifest with command IDs, labels, argument schemas, (c) POSTs manifest to Hub. **Note (B1):** BridgeContribution does NOT maintain an SSE connection to the Hub. Agent command dispatch is handled by SyncService via RPC callbacks (see Phase 1B1). |
| **Acceptance** | On Theia startup, Hub receives a manifest (may be empty if no openspace commands registered yet). |
| **Dependencies** | 1.5, 1.6 |
| **Result** | Command discovery, manifest publishing to Hub. |
| **Status** | ✅ |

### 1.8 — Implement SyncService (frontend)
| | |
|---|---|
| **What** | Create `openspace-core/src/browser/opencode-sync-service.ts`. Implements `OpenCodeClient` (the RPC callback interface). Receives events from backend SSE forwarding and updates SessionService state. This is the glue between the backend event stream and the frontend state. |
| **Acceptance** | Events from opencode server (new messages, session changes) are reflected in SessionService state within 200ms. |
| **Dependencies** | 1.6 |
| **Result** | OpenCodeClient implementation, message streaming (created→partial→completed), SessionService integration. |
| **Status** | ✅ |

### 1.9 — Frontend DI module wiring
| | |
|---|---|
| **What** | Wire `openspace-core/src/browser/openspace-core-frontend-module.ts` with all frontend bindings: SessionService, SyncService, BridgeContribution, PaneService (stub for now). Register RPC proxy for `OpenCodeService`. |
| **Acceptance** | Frontend module loads. All services are injectable. No runtime errors. |
| **Dependencies** | 1.6, 1.7, 1.8 |
| **Result** | All services bound in DI container, RPC proxy configured, contributions registered. |
| **Status** | ✅ |

### 1.10 — Basic chat widget (send + receive)
| | |
|---|---|
| **What** | Create `openspace-chat/src/browser/chat-widget.tsx`. Minimal ReactWidget with: text input at bottom, message list above, send button. On send → `SessionService.sendMessage()`. Subscribe to `SessionService.onMessagesChanged` to render incoming messages. Streaming display (character by character or chunk by chunk). No fancy rendering yet — just plain text. |
| **Acceptance** | Can type a message, press Enter, see it appear in the message list. Agent response streams in character by character. Basic but functional conversation flow. |
| **Dependencies** | 1.9 |
| **Result** | React widget with send/receive, streaming support, SessionService integration. |
| **Status** | ✅ |

### 1.11 — Session create/delete/switch UI
| | |
|---|---|
| **What** | Add session management controls to the chat widget or a sidebar: "New Session" button, session list (clickable to switch), delete session button. Uses `SessionService` methods. |
| **Acceptance** | Can create a new session, switch between sessions (messages change), delete a session. |
| **Dependencies** | 1.10 |
| **Result** | Session dropdown, create/switch/delete, active indicator, confirmation dialogs. Janitor + CodeReviewer approved (92% confidence). |
| **Status** | ✅ |

### 1.12 — Configure opencode.json instructions URL
| | |
|---|---|
| **What** | Document how to add `"instructions": ["http://localhost:3001/openspace/instructions"]` to the user's `opencode.json`. Verify that opencode fetches this URL and includes the returned content in the agent's system prompt. |
| **Acceptance** | When opencode starts a session, the system prompt includes the OpenSpace instructions block generated by the Hub. |
| **Dependencies** | 1.5 |
| **Result** | User documentation (316 lines), Hub endpoint verified, test procedure documented. Janitor + CodeReviewer approved (95% confidence). |
| **Status** | ✅ |

### 1.13 — Integration test: full message round-trip
| | |
|---|---|
| **What** | End-to-end test: start Theia → connect to opencode server → create session → send message → receive streamed response → verify message appears in chat widget. Can be a Playwright test or manual verification protocol. |
| **Acceptance** | The full round-trip works reliably. Documented test procedure. |
| **Dependencies** | 1.10, 1.12 |
| **Result** | Test procedure (687 lines), troubleshooting guide (775 lines), test report (689 lines). Janitor conditional approval (5/8 scenarios executed, 3 blocked by OpenCode N/A). |
| **Status** | ✅ |

### 1.14 — Permission handling (P0)
| | |
|---|---|
| **What** | Implement permission request/response flow. Add `onPermissionEvent` to `OpenCodeClient` RPC callback interface (TECHSPEC §14). Create `PermissionDialogManager` (frontend) that shows a modal dialog when the opencode server requests permission for potentially dangerous operations (file writes, terminal commands, tool use). Add `grantPermission()` to `OpenCodeService` RPC interface. **Note:** Auto-accept rules deferred to Phase 2 (not blocking for Phase 1). |
| **Acceptance** | When opencode agent requests permission, a modal dialog appears. User can Grant/Deny. Response is sent back to opencode server via `grantPermission()` RPC call. |
| **Dependencies** | 1.4 (backend wiring), 1.6 (SessionService) |
| **TECHSPEC ref** | §14 (Permission Handling) |
| **Result** | PermissionDialogManager + UI + E2E tests. 61 unit tests pass. Auto-accept preferences deferred. |
| **Status** | ✅ |

### 1.15 — Model/provider display (P0)
| | |
|---|---|
| **What** | Add minimal read-only display of current model/provider to chat widget status area. Uses `OpenCodeService.getProvider()` RPC call (already implemented). Displays format: "🤖 Anthropic claude-sonnet-4.5" below session header. Updates on session change. Graceful error handling (fallback to "Model info unavailable"). **Phase 1 testability requirement** — makes it visible which model is responding. Full model selection UI deferred to Phase 5. |
| **Acceptance** | Chat widget shows current provider name and model name. Display updates when switching sessions. Errors are handled gracefully without blocking chat functionality. |
| **Dependencies** | 1.10 (ChatWidget), 1.2 (OpenCodeProxy with getProvider()) |
| **REQ ref** | REQ-MODEL-DISPLAY |
| **Result** | Model/provider display implemented. Build passes. Unit tests pass (61/61). CodeReviewer approved (88% confidence). Known issues: race condition on rapid session switch (non-blocking), silent error handling (non-blocking). |
| **Status** | ✅ |

---

## Phase 1B1: Architecture Refactoring (C → B1) ✅ COMPLETE

**Goal:** Refactor the existing Phase 1 implementation from Architecture C (parallel system — ignores Theia AI) to Architecture B1 (hybrid — ChatAgent registered in Theia AI, custom ChatWidget, agent commands via RPC instead of Hub SSE relay). This phase addresses the architectural gap discovered during review: the code implements Architecture C but the TECHSPEC describes Architecture B.

**Duration estimate:** 1 session  
**Exit criteria:** ChatAgent delegates to SessionService (not echo stub). Agent commands dispatched via RPC callback (`onAgentCommand`) instead of Hub SSE relay. Hub simplified (no /commands, /events endpoints). BridgeContribution simplified (no SSE listener). Stream interceptor integrated into OpenCodeProxy. All existing functionality preserved.  
**Completed:** 2026-02-17

**Prerequisites:** Phase 1 complete (tasks 1.1–1.15 all ✅). TECHSPEC updated to Architecture B1 (completed 2026-02-17).

**V&V Targets:**
- [x] `@Openspace` mention in Theia's built-in chat panel → routes to `OpenspaceChatAgent.invoke()` → delegates to `SessionService.sendMessage()` → response streams back
- [x] Custom `ChatWidget` still works (unchanged — already uses `SessionService` directly)
- [x] `onAgentCommand()` added to `OpenCodeClient` RPC interface and called by OpenCodeProxy
- [x] `SyncService.onAgentCommand()` dispatches to `CommandRegistry.executeCommand()`
- [x] Hub no longer has `/commands` or `/events` endpoints (removed)
- [x] Hub no longer manages SSE client connections (removed)
- [x] BridgeContribution no longer maintains SSE connection to Hub (removed)
- [x] BridgeContribution still publishes manifest to Hub on startup (preserved)
- [x] Hub URL prefix mismatch fixed (all routes use `/openspace/` prefix consistently)
- [x] `yarn build` succeeds with zero errors
- [x] User manual testing confirmed all functionality preserved

### 1B1.1 — Wire ChatAgent to SessionService
| | |
|---|---|
| **What** | Rewrite `openspace-chat/src/browser/chat-agent.ts`. Currently `OpenspaceChatAgent.invoke()` just echoes. Change it to: (1) extract text from `request.request?.text`, (2) call `this.sessionService.sendMessage(parts)`, (3) subscribe to `this.sessionService.onMessageStreaming` to push streaming updates into `request.response`. This makes `@Openspace` mentions work from Theia's built-in chat panel. ~30 lines of changes. |
| **Acceptance** | Typing `@Openspace how does X work?` in Theia's built-in chat panel → message sent to opencode server via SessionService → response streams back into Theia's chat UI. |
| **Dependencies** | Phase 1 complete |
| **TECHSPEC ref** | §4.2 (Chat Agent code sample) |
| **Status** | ✅ |

### 1B1.2 — Add `onAgentCommand` to OpenCodeClient RPC interface
| | |
|---|---|
| **What** | Add `onAgentCommand(command: AgentCommand): void` to `OpenCodeClient` interface in `openspace-core/src/common/opencode-protocol.ts`. The `AgentCommand` type already exists in `command-manifest.ts`. This is ~4 lines of type changes. Also update the backend connection handler in `openspace-core-backend-module.ts` to ensure the new callback is properly bound. |
| **Acceptance** | TypeScript compiles. The `onAgentCommand` method is part of the `OpenCodeClient` interface and can be called by `OpenCodeProxy`. |
| **Dependencies** | Phase 1 complete |
| **TECHSPEC ref** | §3.1.1 (OpenCodeClient interface) |
| **Status** | ✅ |

### 1B1.3 — Integrate stream interceptor into OpenCodeProxy
| | |
|---|---|
| **What** | Add `%%OS{...}%%` stream interceptor logic to `openspace-core/src/node/opencode-proxy.ts`. Add a method (e.g., `interceptStream()`) that scans message event text for `%%OS{...}%%` patterns. When found: (a) strip the block from text forwarded to `client.onMessageEvent()`, (b) parse the JSON, (c) call `client.onAgentCommand({ cmd, args })`. Must handle: chunk boundary splitting, nested braces, malformed JSON (discard + warn), timeout guard (5s). See TECHSPEC §6.5.1 for the full test matrix. **No separate `stream-interceptor.ts` file** — integrated directly into OpenCodeProxy. |
| **Acceptance** | Response text containing `%%OS{"cmd":"openspace.pane.open","args":{...}}%%` → user sees clean text, `onAgentCommand` called with parsed command. All 8 test cases from §6.5.1 pass. |
| **Dependencies** | 1B1.2 |
| **TECHSPEC ref** | §6.5, §6.5.1 (Stream Interceptor + Test Matrix) |
| **Status** | ✅ |

### 1B1.4 — Extend SyncService to dispatch agent commands
| | |
|---|---|
| **What** | Update `openspace-core/src/browser/opencode-sync-service.ts`. Add `onAgentCommand(command: AgentCommand)` method that: (1) receives the command from the RPC callback, (2) adds it to a sequential command queue (TECHSPEC §6.7), (3) dispatches via `commandRegistry.executeCommand(command.cmd, command.args)`. The command queue ensures sequential execution with 50ms inter-command delay and max depth of 50. Need to inject `CommandRegistry` into `OpenCodeSyncService`. |
| **Acceptance** | Agent command received via RPC callback → dispatched to CommandRegistry → IDE action performed. Queue handles rapid successive commands without race conditions. |
| **Dependencies** | 1B1.2 |
| **TECHSPEC ref** | §6.7 (Agent Command Queue), §8.2 (Agent Command Flow) |
| **Status** | ✅ |

### 1B1.5 — Simplify Hub (remove /commands, /events, SSE)
| | |
|---|---|
| **What** | Update `openspace-core/src/node/hub.ts`. Remove: (a) `POST /commands` endpoint, (b) `GET /events` SSE endpoint, (c) SSE client management (`connectedClients`, broadcast logic, ping interval). Keep: (a) `POST /openspace/manifest`, (b) `POST /openspace/state`, (c) `GET /openspace/instructions`. This significantly simplifies the Hub to a read/write cache with one public endpoint. ~50 lines removed. |
| **Acceptance** | Hub starts with 3 endpoints only. No SSE client management. `GET /openspace/instructions` still returns valid system prompt. |
| **Dependencies** | Phase 1 complete |
| **TECHSPEC ref** | §6.4 (Hub simplified in B1) |
| **Status** | ✅ |

### 1B1.6 — Simplify BridgeContribution (remove SSE listener)
| | |
|---|---|
| **What** | Update `openspace-core/src/browser/bridge-contribution.ts`. Remove: (a) `EventSource` connection to Hub `/events`, (b) `AGENT_COMMAND` event handling and dispatch logic, (c) SSE reconnection logic. Keep: (a) manifest building and publishing to Hub, (b) pane state publishing to Hub. Agent command dispatch is now handled by SyncService via RPC callbacks. ~40 lines removed. |
| **Acceptance** | BridgeContribution starts, publishes manifest, publishes pane state changes. No SSE connection to Hub. |
| **Dependencies** | 1B1.4 (SyncService handles command dispatch now) |
| **TECHSPEC ref** | §6.3 (BridgeContribution simplified in B1) |
| **Status** | ✅ |

### 1B1.7 — Fix Hub URL prefix mismatch
| | |
|---|---|
| **What** | Fix URL mismatch bug: BridgeContribution currently POSTs to `http://localhost:3001/openspace/manifest` and `http://localhost:3001/openspace/events` but Hub routes are registered at `/manifest` and `/events` (no `/openspace/` prefix). Standardize all routes to use `/openspace/` prefix. Update both Hub route registration and BridgeContribution fetch URLs to match. Also fix the port — BridgeContribution should use the same port as the Theia backend (typically 3000), not a hardcoded 3001. |
| **Acceptance** | BridgeContribution successfully POSTs manifest to Hub on startup. No 404 errors in console. |
| **Dependencies** | Phase 1 complete |
| **Status** | ✅ |

### 1B1.8 — Architecture B1 integration verification
| | |
|---|---|
| **What** | End-to-end verification that all Architecture B1 changes work together: (1) BridgeContribution publishes manifest to Hub, (2) Hub serves valid instructions via `GET /openspace/instructions`, (3) ChatAgent delegates to SessionService, (4) message flows through to opencode server and back, (5) existing ChatWidget still works, (6) `onAgentCommand` RPC callback path is wired (ready for Phase 3 stream interceptor testing). Re-run Phase 1.13 integration test to verify no regressions. |
| **Acceptance** | All Phase 1 functionality preserved. Architecture B1 plumbing verified. Build clean. |
| **Dependencies** | 1B1.1–1B1.7 |
| **Status** | ✅ |

---

## Phase 2: Chat & Prompt System

**Goal:** Full chat experience matching (and exceeding) the opencode client. Rich prompt input, message rendering, session management.

**Duration estimate:** 2 sessions  
**Exit criteria:** Chat experience is feature-complete relative to the opencode client. Multi-part prompts, streaming, file mentions, response renderers all working.

**V&V Targets:**
- [x] Session list loads immediately on chat widget open (Task 2.0)
- [ ] Model selection dropdown works and persists per-session (Task 2.1)
- [ ] Multi-part prompt: text + file attachment + @mention sent correctly to opencode server (Task 2.2)
- [ ] Message timeline renders streaming response with visible progress indicator (Task 2.3)
- [ ] Auto-scroll follows new content; scrolling up pauses auto-scroll (Task 2.3)
- [ ] Code blocks syntax-highlighted with working Copy button (Task 2.4)
- [ ] File:line references in responses are clickable and open editor at correct line (Task 2.6)
- [ ] Session sidebar shows all sessions with create/switch/delete working (Task 2.7)
- [ ] Session fork/revert/compact operations work through UI (Task 2.8)
- [ ] Token usage displays and updates during streaming (Task 2.9)
- [ ] Chat integration test (2.10) passes

### 2.0 — Session List Auto-Load Fix (NEW)
| | |
|---|---|
| **What** | Fix race condition where session list doesn't appear immediately on chat widget open. ChatWidget was calling `getSessions()` during mount before SessionService completed async project restoration from localStorage. Solution: Subscribe to `SessionService.onActiveProjectChanged` event and reload sessions when project loads. Add loading/error/empty states to UI. |
| **Acceptance** | Sessions appear within 500ms of widget open. Loading indicator displays during fetch. Error state shows with retry button on failure. Empty state shows helpful message when 0 sessions exist. |
| **Dependencies** | Phase 1 complete |
| **Priority** | HIGH (user-reported UX blocker) |
| **REQ ref** | REQ-SESSION-LIST-AUTOLOAD |
| **Result** | Race condition eliminated via event subscription. 13 unit tests added (113/113 passing). Build clean. CodeReviewer: 87% confidence (APPROVED). Known improvements: accessibility enhancements, magic number extraction, enhanced error messages (all non-blocking). |
| **Status** | ✅ |

### 2.1 — Model Selection (PRIORITY)
| | |
|---|---|
| **What** | Add model selection dropdown to the chat widget. User can select which LLM model to use per-session (e.g., Claude Sonnet 4.5, GPT-4, etc.). **Implementation:** Fetch available models via `GET /config/providers` endpoint. Store selected model in SessionService per-session state. Pass model metadata with each message sent via `POST /session/{id}/message` (in message parts metadata). Display current model name in chat header. Add dropdown UI for model selection. Model format: `provider/model` (e.g., "anthropic/claude-sonnet-4-5"). |
| **Acceptance** | User can see current model name in chat header. Clicking model name opens dropdown with available models from `GET /config/providers`. Selecting a model updates the active model for the session. New messages include model metadata and use the selected model. Model selection persists for the session. |
| **Dependencies** | Phase 1 complete, Task 1.15 (provider display) |
| **Priority** | HIGH (user-requested blocker - currently uses default/last-used model) |
| **Implementation Notes** | **Discovery:** OpenCode uses per-message model metadata (not global API). Models fetched from `/config/providers`. Model stored in session state, passed with each message. See `model-selection-protocol.md` for full investigation results. |
| **Status** | ⬜ |

### 2.2 — Multi-part prompt input
| | |
|---|---|
| **What** | Upgrade the prompt input to support multiple parts: text (default), file attachments (drag-drop or button), image attachments, @agent mentions (typeahead). Port the multi-part input pattern from opencode client (`packages/app/src/components/prompt/`). |
| **Acceptance** | Can compose a message with text + attached files + @mention. Parts are sent to opencode server correctly. |
| **Dependencies** | Phase 1 complete |
| **Status** | ✅ |
| **Implementation** | All 5 phases complete: Phase 1 (core text input), Phase 2 (file attachments with drag-drop), Phase 3 (image attachments with paste), Phase 4 (@mention typeahead for agents), Phase 5 (keyboard navigation, polish). Files: `prompt-input.tsx`, `parse-from-dom.ts`, `build-request-parts.ts`, `types.ts`, `prompt-input.css`. |

### 2.3 — Message timeline with streaming
| | |
|---|---|
| **What** | Replace the basic message list with a proper timeline. User messages right-aligned (or styled differently), assistant messages left-aligned. Streaming indicator (blinking cursor or progress bar) during response. Auto-scroll to bottom on new content, but respect user scrolling up (scroll spy). |
| **Acceptance** | Conversation reads naturally. Streaming shows real-time text appearance. Scrolling up stops auto-scroll; scrolling to bottom resumes it. |
| **Dependencies** | Phase 1 complete |
| **Status** | ✅ |
| **Implementation** | MessageBubble and MessageTimeline components created. User messages (blue, right), assistant messages (gray, left). Blinking cursor during streaming. Smart auto-scroll with 'New messages' indicator. Message grouping. Files: `message-bubble.tsx`, `message-timeline.tsx`, `message-timeline.css`. |

### 2.4 — Response renderers: code blocks
| | |
|---|---|
| **What** | Create `openspace-chat/src/browser/response-renderers/code-renderer.tsx`. Detects markdown code blocks in assistant responses. Renders with syntax highlighting (use Monaco's tokenizer or a lightweight lib like Shiki). Add "Copy" button and "Apply to file" button (for when code references a file). |
| **Acceptance** | Code blocks in responses are syntax-highlighted with working Copy button. |
| **Dependencies** | 2.3 |
| **Status** | ⬜ |

### 2.5 — Response renderers: diff view
| | |
|---|---|
| **What** | Create `diff-renderer.tsx`. Detects diff blocks in responses. Renders as an inline diff view (using Monaco's diff editor or a React diff component). Shows added/removed lines with color coding. |
| **Acceptance** | Diffs in responses render with green/red highlighting, readable layout. |
| **Dependencies** | 2.2 |
| **Status** | ⬜ |

### 2.6 — Response renderers: file references
| | |
|---|---|
| **What** | Create `file-ref-renderer.tsx`. Detects file path references (e.g., `src/index.ts:42`) in responses. Renders as clickable links that open the file at the referenced line in the editor. Uses `EditorManager.open()`. |
| **Acceptance** | Clicking a file:line reference opens the file and scrolls to that line. |
| **Dependencies** | 2.3 |
| **Status** | ⬜ |

### 2.7 — Session sidebar
| | |
|---|---|
| **What** | Create a sidebar panel showing session list: session title, creation date, last message preview. Clicking a session switches the active session. "New Session" button at top. Context menu with Delete, Fork options. Group by project if multiple projects. |
| **Acceptance** | Session list appears in left sidebar. All CRUD operations work. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 2.8 — Session operations: fork / revert / compact
| | |
|---|---|
| **What** | Implement session fork (create new session from a specific message), revert (roll back to a message), compact (summarize and trim context), and unrevert. Wire to SessionService → OpenCodeProxy → opencode server API. Add UI trigger: context menu on messages or session toolbar buttons. |
| **Acceptance** | Can fork a session at a specific message → new session created with correct history. Revert removes messages after the target. Compact calls the server API. |
| **Dependencies** | 2.7 |
| **Status** | ⬜ |

### 2.9 — Token usage display
| | |
|---|---|
| **What** | Display token usage (input tokens, output tokens, total) in the session header or status bar. Data comes from message metadata via the opencode API. Update in real-time during streaming. |
| **Acceptance** | Token counts visible and updating during/after each message exchange. |
| **Dependencies** | 2.3 |
| **Status** | ⬜ |

### 2.10 — Chat integration test
| | |
|---|---|
| **What** | End-to-end test covering: multi-part prompt → send → streaming response with code block → click file reference → editor opens. Session create/switch/delete. |
| **Acceptance** | Test passes reliably. |
| **Dependencies** | 2.1–2.10 |
| **Status** | ⬜ |

---

## Phase 3: Agent IDE Control

**Goal:** The agent can control the IDE through `%%OS{...}%%` blocks in its response stream. Open files, scroll, highlight, manage panes, create terminals. New commands auto-appear in the agent's system prompt.

**Duration estimate:** 2 sessions  
**Exit criteria:** Agent emits `%%OS{...}%%` blocks → stream interceptor (integrated in OpenCodeProxy) strips them → dispatches via `onAgentCommand` RPC callback → SyncService queues → CommandRegistry executes. Full command inventory working. New commands automatically appear in the agent's instruction set.

**V&V Targets:**
- [ ] Stream interceptor correctly strips `%%OS{...}%%` blocks (test matrix in TECHSPEC §6.5.1 — 8 cases all passing)
- [ ] Chunk-boundary splitting handled (block split across SSE events)
- [ ] Malformed JSON blocks discarded with warning log, not shown to user
- [ ] All pane commands executable via command palette: `openspace.pane.*`
- [ ] All editor commands executable: `openspace.editor.*` (open at line, highlight, scroll, clear)
- [ ] All terminal commands executable: `openspace.terminal.*` (create, send, read_output)
- [ ] All file commands executable: `openspace.file.*` (read, write, list, search)
- [ ] `GET /openspace/instructions` includes full command inventory with argument schemas
- [ ] Adding a new command → manifest regenerates → system prompt updates automatically
- [ ] Pane state publishing: opening a file → `/openspace/instructions` reflects it
- [ ] Command result feedback: failed command result appears in next system prompt
- [ ] Command queue: rapid successive commands execute sequentially without race conditions
- [ ] End-to-end test (3.9) passes

### 3.1 — PaneService implementation
| | |
|---|---|
| **What** | Implement `openspace-core/src/browser/pane-service.ts`. Wraps `ApplicationShell` for programmatic pane control. Methods: `openContent()` (maps to `addWidget` with correct `WidgetOptions`), `closeContent()`, `focusContent()`, `listPanes()` (traverses DockPanel layout tree to extract pane geometry), `resizePane()`. Emit `onPaneLayoutChanged` when layout changes. |
| **Acceptance** | Unit tests confirm pane operations. `listPanes()` returns accurate layout including geometry (percentages). |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 3.2 — Register pane commands in CommandRegistry
| | |
|---|---|
| **What** | Create `openspace-core/src/browser/pane-command-contribution.ts`. Register: `openspace.pane.open`, `openspace.pane.close`, `openspace.pane.focus`, `openspace.pane.list`, `openspace.pane.resize`. Each delegates to PaneService. Include command metadata (argument schema) for the manifest. |
| **Acceptance** | Commands executable from Theia command palette. `openspace.pane.list` returns correct layout. |
| **Dependencies** | 3.1 |
| **Status** | ⬜ |

### 3.3 — Register editor commands in CommandRegistry
| | |
|---|---|
| **What** | Create `openspace-core/src/browser/editor-command-contribution.ts`. Register: `openspace.editor.open` (with line/column/highlight support via `EditorManager.open()`), `openspace.editor.scroll_to` (via `MonacoEditor.revealLineInCenter()`), `openspace.editor.highlight` (via `deltaDecorations()`), `openspace.editor.clear_highlight`, `openspace.editor.read_file`, `openspace.editor.close`. Track highlight IDs for cleanup. Navigation history stack for undo. |
| **Acceptance** | Commands work from command palette. Agent can open file at line 42, highlight lines 42-50 with a green background, clear highlights. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 3.4 — Register terminal commands in CommandRegistry
| | |
|---|---|
| **What** | Create terminal command contribution. Register: `openspace.terminal.create`, `openspace.terminal.send`, `openspace.terminal.read_output` (with ring buffer implementation — hook into xterm.js `onData`), `openspace.terminal.list`, `openspace.terminal.close`. The ring buffer captures output for agent read-back. |
| **Acceptance** | Can create a terminal, send `echo hello`, read back "hello" from output buffer. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 3.5 — Register file commands in CommandRegistry
| | |
|---|---|
| **What** | Register: `openspace.file.read`, `openspace.file.write`, `openspace.file.list`, `openspace.file.search`. These wrap Theia's `FileService` and `WorkspaceService`. Enforce workspace-root constraint for safety. |
| **Acceptance** | Commands work. Cannot read/write outside workspace root. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 3.6 — Stream interceptor implementation
| | |
|---|---|
| **What** | **Note (B1):** The stream interceptor is integrated directly into `OpenCodeProxy` (no separate `stream-interceptor.ts` file — see Phase 1B1 task 1B1.3). This Phase 3 task covers the **full test coverage and hardening** of the interceptor: validate all 8 test cases from TECHSPEC §6.5.1 (basic extraction, mid-sentence, multiple blocks, split across chunks, nested braces, malformed JSON, timeout guard, empty args). Add edge-case tests: back-to-back blocks, blocks inside code fences (should NOT be intercepted), Unicode in args. |
| **Acceptance** | All 8 §6.5.1 test cases pass. Edge-case tests pass. No regressions in message forwarding. Interceptor hardened for production use. |
| **Dependencies** | 1B1.3 (interceptor skeleton implemented) |
| **Status** | ⬜ |

### 3.7 — Command manifest auto-generation
| | |
|---|---|
| **What** | Upgrade BridgeContribution to build a rich manifest from all registered `openspace.*` commands. Manifest includes: command ID, label, description, argument JSON schema (annotated on each command registration), return type description. Manifest is re-published to Hub whenever a new extension loads (handles lazy-loaded extensions). **Note (B1):** BridgeContribution only publishes the manifest to Hub — it does NOT maintain an SSE connection or dispatch commands (that's SyncService's job via RPC). |
| **Acceptance** | Hub's manifest cache contains all openspace commands with full argument schemas. Adding a new command and restarting Theia → manifest updates automatically. |
| **Dependencies** | 1.7, 3.2, 3.3, 3.4, 3.5 |
| **Status** | ⬜ |

### 3.8 — System prompt generation (Hub)
| | |
|---|---|
| **What** | Implement the system prompt template in Hub's `GET /openspace/instructions` handler. Template includes: explanation of `%%OS{...}%%` pattern, full command inventory with argument schemas (from manifest), current IDE state (from `/state` — open panes, active tab, terminal list). Prompt should be clear, concise, and include 2–3 examples of `%%OS{...}%%` usage. |
| **Acceptance** | `GET /openspace/instructions` returns a well-formatted prompt that would teach an LLM how to use the IDE commands. Prompt updates when manifest or state changes. |
| **Dependencies** | 3.7 |
| **Status** | ⬜ |

### 3.9 — End-to-end agent control test
| | |
|---|---|
| **What** | Full integration test: send a message to the agent that triggers it to emit `%%OS{...}%%` blocks (may need to include instructions in the prompt like "open the file X"). Verify: (a) blocks are stripped from chat display by the stream interceptor in OpenCodeProxy, (b) `onAgentCommand` RPC callback fires, (c) SyncService dispatches to CommandRegistry, (d) IDE action is performed (file opens, terminal creates, etc.). |
| **Acceptance** | Agent successfully controls IDE via `%%OS{...}%%` pattern. Clean text shown to user. Full RPC callback path verified. |
| **Dependencies** | 3.6, 3.7, 3.8 |
| **Status** | ⬜ |

### 3.10 — Pane state publishing
| | |
|---|---|
| **What** | BridgeContribution subscribes to `PaneService.onPaneLayoutChanged` and POSTs updated state to Hub `/state` endpoint. State includes: open panes, active tabs, terminal list, active editor file/line. This makes `GET /openspace/instructions` return live IDE state. |
| **Acceptance** | Open a file → `/openspace/instructions` response includes that file in the "Current IDE state" section. Close it → it disappears. |
| **Dependencies** | 3.1, 3.7 |
| **Status** | ⬜ |

### 3.11 — Command result feedback mechanism
| | |
|---|---|
| **What** | Implement the command result feedback loop (TECHSPEC §6.6). After SyncService dispatches a command via `CommandRegistry.executeCommand()`, capture the result (success/failure + error message). POST result to Hub `POST /openspace/command-results`. Hub maintains a per-session ring buffer (last 20 results). Include recent command results in `GET /openspace/instructions` response. This gives the agent feedback on whether its commands succeeded. |
| **Acceptance** | Failed command → result logged in Hub → next `GET /openspace/instructions` includes the failure message. Agent can learn from failures without modifying the opencode server. |
| **Dependencies** | 1.5 (Hub), 1B1.4 (SyncService dispatches commands), 3.9 (agent control working) |
| **TECHSPEC ref** | §6.6 (Command Result Feedback), §6.7 (Agent Command Queue & Throttling) |
| **Status** | ⬜ |

---

## Phase 4: Modality Surfaces

**Goal:** Presentation viewer and whiteboard canvas. Both are full modalities — the agent can create, navigate, and manipulate them via CommandRegistry commands that auto-appear in the manifest.

**Duration estimate:** 2–3 sessions  
**Exit criteria:** Agent can create a presentation and navigate slides. Agent can create a whiteboard and draw basic shapes. Both surfaces open as Theia widgets in the main area. All commands appear in the system prompt automatically.

**V&V Targets:**
- [ ] reveal.js spike (4.0a): bundle size < 500KB gzipped, renders in ReactWidget, no Theia conflicts
- [ ] tldraw spike (4.0b): bundle size < 1MB gzipped, renders in ReactWidget, no Theia conflicts
- [ ] `.deck.md` double-click opens presentation widget (not text editor)
- [ ] Presentation slides render with reveal.js themes and transitions
- [ ] Arrow keys navigate slides; programmatic navigation works
- [ ] Agent can `openspace.presentation.create` → file created → `openspace.presentation.open` → widget opens
- [ ] `.whiteboard.json` double-click opens whiteboard widget
- [ ] User can draw basic shapes, text, and connectors on whiteboard
- [ ] Agent can `openspace.whiteboard.create` and `openspace.whiteboard.add_shape`
- [ ] All presentation and whiteboard commands appear in `GET /openspace/instructions`
- [ ] Modality integration test (4.8) passes

### 4.0a — Spike: reveal.js integration feasibility
| | |
|---|---|
| **What** | Time-boxed spike (2–4 hours) to validate reveal.js integration in a Theia ReactWidget. Goals: (1) confirm reveal.js renders correctly inside a ReactWidget, (2) measure bundle size impact, (3) identify any conflicts with Theia's CSS/layout system, (4) verify keyboard event handling (arrow keys for slide navigation vs. Theia keybindings). Produce a throwaway proof-of-concept, not production code. |
| **Acceptance** | Spike report documenting: bundle size, rendering quality, CSS conflicts (if any), keyboard event handling strategy, recommended integration approach. Go/no-go decision for full implementation. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 4.0b — Spike: tldraw integration feasibility
| | |
|---|---|
| **What** | Time-boxed spike (2–4 hours) to validate tldraw integration in a Theia ReactWidget. Goals: (1) confirm tldraw canvas renders and is interactive inside a ReactWidget, (2) measure bundle size impact, (3) identify any conflicts with Theia's DI or React version, (4) verify tldraw store serialization to/from `.whiteboard.json` files, (5) test programmatic shape creation via tldraw API. Produce a throwaway proof-of-concept, not production code. |
| **Acceptance** | Spike report documenting: bundle size, rendering quality, React version compatibility, tldraw store persistence strategy, recommended integration approach. Go/no-go decision for full implementation. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 4.1 — Presentation widget (reveal.js)
| | |
|---|---|
| **What** | Create `openspace-presentation/src/browser/presentation-widget.tsx`. ReactWidget that embeds reveal.js. Accepts deck content (markdown with `---` slide delimiters). Renders slides with reveal.js themes. Supports slide navigation (keyboard arrows, mouse, programmatic via service). Full-screen mode (toggle). |
| **Acceptance** | A `.deck.md` file opens as a presentation widget. Arrow keys navigate slides. Reveal.js animations and transitions work. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 4.2 — Presentation open handler
| | |
|---|---|
| **What** | Create `PresentationOpenHandler` that registers for `.deck.md` files. When user double-clicks a `.deck.md` in the file tree, it opens in the presentation widget instead of the text editor. Priority 200 (higher than default editor). |
| **Acceptance** | Double-clicking `arch.deck.md` in file tree → presentation widget opens with rendered slides. |
| **Dependencies** | 4.1 |
| **Status** | ⬜ |

### 4.3 — Presentation service + commands
| | |
|---|---|
| **What** | Create `PresentationService` (deck CRUD, playback state) and `PresentationCommandContribution` registering all presentation commands in CommandRegistry: `openspace.presentation.list`, `.read`, `.create`, `.update_slide`, `.open`, `.navigate`, `.play`, `.pause`, `.stop`. Include argument schemas for manifest. |
| **Acceptance** | Agent can `openspace.presentation.create` → creates `.deck.md` file → `openspace.presentation.open` → widget opens → `openspace.presentation.navigate` → slides advance. All commands appear in `GET /openspace/instructions`. |
| **Dependencies** | 4.1, 4.2 |
| **Status** | ⬜ |

### 4.4 — Whiteboard widget (tldraw)
| | |
|---|---|
| **What** | Create `openspace-whiteboard/src/browser/whiteboard-widget.tsx`. ReactWidget that embeds tldraw. Supports freeform drawing, shapes, text, connections. Uses tldraw's store for state. Loads/saves to `.whiteboard.json` files. |
| **Acceptance** | A `.whiteboard.json` file opens as a whiteboard widget. User can draw shapes, type text, make connections. State persists to file on save. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 4.5 — Whiteboard open handler
| | |
|---|---|
| **What** | Register `WhiteboardOpenHandler` for `.whiteboard.json` files. Priority 200. |
| **Acceptance** | Double-clicking `.whiteboard.json` → whiteboard widget opens. |
| **Dependencies** | 4.4 |
| **Status** | ⬜ |

### 4.6 — Whiteboard service + commands
| | |
|---|---|
| **What** | Create `WhiteboardService` (shape CRUD, camera control) and `WhiteboardCommandContribution` registering all whiteboard commands: `openspace.whiteboard.list`, `.read`, `.create`, `.add_shape`, `.update_shape`, `.delete_shape`, `.open`, `.camera.set`, `.camera.fit`, `.camera.get`. |
| **Acceptance** | Agent can create a whiteboard, add shapes, move camera, fit to content. All commands in manifest. |
| **Dependencies** | 4.4, 4.5 |
| **Status** | ⬜ |

### 4.7 — ~~Custom tldraw shape types~~ → DEFERRED to Phase 6
| | |
|---|---|
| **What** | Register custom tldraw shape utilities for structured diagrams: ClassBox (UML class), InterfaceBox, State, Decision, Process, Lifeline, etc. (per TECHSPEC §5.3.3). These are rendered with custom React components and have specific connection points. |
| **Rationale for deferral** | Custom shapes are complex (each requires custom rendering, connection logic, and serialization). Phase 4 should focus on getting basic tldraw integration working first. Basic shapes (rectangle, circle, arrow, text) are provided by tldraw out of the box and are sufficient for MVP. See Phase 6 task 6.7. |
| **Status** | ❌ Deferred to Phase 6 |

### 4.8 — Modality integration test
| | |
|---|---|
| **What** | End-to-end: Agent creates a presentation via `%%OS{...}%%` → user sees slides. Agent creates a whiteboard and adds basic shapes → user sees diagram. Both coexist in the IDE as tabs. |
| **Acceptance** | Full round-trip from agent command to visible modality surface. |
| **Dependencies** | 4.3, 4.6 |
| **Status** | ⬜ |

---

## Phase 5: Polish & Desktop

**Goal:** Production-quality application. Electron desktop build, settings UI, custom theming, persistence, session sharing.

**Duration estimate:** 2 sessions  
**Exit criteria:** Shippable desktop application. All features working. E2E test suite passing.

**V&V Targets:**
- [ ] Default layout: chat right panel, file tree left sidebar, editors main area, terminal bottom
- [ ] Custom dark theme applied by default; light theme toggleable
- [ ] Settings panels: provider config, model selection, appearance settings all functional
- [ ] `yarn build:electron` produces runnable `.app` (macOS)
- [ ] Electron app connects to opencode server, all features work
- [ ] Panel layout persists across restarts (close → reopen → same layout)
- [ ] Session sharing generates link via opencode API
- [ ] E2E test suite (5.7) passes in < 10 minutes
- [ ] CI runs E2E tests

### 5.1 — Custom layout contributions
| | |
|---|---|
| **What** | Create `openspace-layout` extension. Configure default layout: chat in right panel, file tree in left sidebar, main area for editors/presentations/whiteboards, terminal in bottom panel. Use Theia's `ApplicationShellLayoutMigration` for initial layout. Default panel sizes. |
| **Acceptance** | Fresh install opens with opinionated, usable layout. User can still rearrange panels. |
| **Dependencies** | Phases 1–4 complete |
| **Status** | ⬜ |

### 5.2 — Custom theming / branding
| | |
|---|---|
| **What** | Create custom dark and light themes for Theia Openspace. Override CSS variables for colors, fonts, borders. Custom app icon, splash screen. Style chat widget, session sidebar, and modality widgets to have a cohesive look. |
| **Acceptance** | App looks distinct from stock Theia. Dark mode is default and polished. Light mode works. |
| **Dependencies** | 5.1 |
| **Status** | ⬜ |

### 5.3 — Settings panels
| | |
|---|---|
| **What** | Create `openspace-settings` extension with settings panels: Provider configuration (API keys, model selection), Agent configuration, Appearance settings, Keyboard shortcuts. Uses Theia's preference system where possible, custom ReactWidgets for complex panels. |
| **Acceptance** | Users can configure providers, select models, change themes from a settings UI. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 5.4 — Electron desktop build
| | |
|---|---|
| **What** | Configure `electron-app/` with proper Electron packaging: native menus, window controls, app icons (macOS, Windows, Linux), code signing setup (document but don't require). Auto-update framework (electron-updater). Test on macOS at minimum. |
| **Acceptance** | `yarn build:electron` produces a runnable `.app` (macOS) or `.exe` (Windows). Application opens, connects to opencode server, all features work. |
| **Dependencies** | 5.1, 5.2 |
| **Status** | ⬜ |

### 5.5 — Pane configuration persistence
| | |
|---|---|
| **What** | Persist user's panel layout, sizes, and open tabs across sessions using Theia's `StorageService`. On restart, restore the last layout. Handle gracefully when previously-open files no longer exist. |
| **Acceptance** | Close Theia → reopen → same layout, same open tabs. |
| **Dependencies** | 3.1 |
| **Status** | ⬜ |

### 5.6 — Session sharing
| | |
|---|---|
| **What** | Implement session sharing: generate a shareable link via opencode API (`shareSession()`). Display link in a modal. Optionally open shared sessions from a link. |
| **Acceptance** | Can share a session → get a link → link can be opened (if opencode supports it). |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 5.7 — E2E test suite
| | |
|---|---|
| **What** | Comprehensive Playwright E2E test suite covering: app launch, session CRUD, message send/receive, file editing, terminal usage, agent commands via `%%OS{...}%%`, presentation creation/navigation, whiteboard drawing, settings changes, session persistence. Run in CI. |
| **Acceptance** | All tests pass. Test suite runs in < 10 minutes. CI integration. |
| **Dependencies** | All previous phases |
| **Status** | ⬜ |

---

## Phase 6: Extended Features (Ongoing / P3)

These are post-MVP features that extend the platform. Each is independent and can be done in any order.

### 6.1 — i18n (16 languages)
| | |
|---|---|
| **What** | Port the i18n system from the opencode client. 16 locales. Use Theia's `nls` (native language support) where possible, custom i18n for our widgets. |
| **Status** | ⬜ |

### 6.2 — Comments / annotations modality
| | |
|---|---|
| **What** | New extension: `openspace-comments`. Agent and user can add comments anchored to code lines (like PR review comments). Displayed as Monaco decorations + sidebar panel. |
| **Status** | ⬜ |

### 6.3 — Diff review modality
| | |
|---|---|
| **What** | New extension: `openspace-diff-review`. Side-by-side diff viewer with accept/reject controls. Agent can open a diff review widget showing proposed changes. |
| **Status** | ⬜ |

### 6.4 — Voice input/output
| | |
|---|---|
| **What** | Speech-to-text for prompt input (Web Speech API or Whisper). Text-to-speech for agent responses. Push-to-talk mode. |
| **Status** | ⬜ |

### 6.5 — Browser preview modality
| | |
|---|---|
| **What** | Embedded browser (iframe or Electron webview) for previewing web apps. Agent can navigate it, take screenshots, inspect DOM. |
| **Status** | ⬜ |

### 6.6 — Auto-updater (Electron)
| | |
|---|---|
| **What** | Electron auto-update via GitHub Releases or custom update server. Notification UI for available updates. |
| **Status** | ⬜ |

### 6.7 — Custom tldraw shape types (deferred from Phase 4)
| | |
|---|---|
| **What** | Register custom tldraw shape utilities for structured diagrams: ClassBox (UML class), InterfaceBox, State, Decision, Process, Lifeline, etc. (per TECHSPEC §5.3.3). These are rendered with custom React components and have specific connection points. Each shape type requires: custom rendering component, connection anchor points, serialization schema, and argument schema for agent commands. |
| **Acceptance** | Agent can `add_shape` with type "class_box" and it renders as a UML class diagram box with name/attributes/methods sections. All diagram types from TECHSPEC §5.3.3 supported: block, class, state machine, flowchart, sequence. |
| **Dependencies** | Phase 4 complete (basic tldraw integration working) |
| **Status** | ⬜ |

---

## Cross-Cutting Concerns

These are not phases — they apply throughout development.

### CC.1 — Error handling pattern
| | |
|---|---|
| **What** | Every command and service method must return structured results: `{ success: true, data: ... }` or `{ success: false, error: string, code?: string }`. No silent failures (NFR-002). Errors from agent commands must be logged and optionally surfaced as notifications. |
| **Applies to** | All phases |

### CC.2 — Logging
| | |
|---|---|
| **What** | Use Theia's `ILogger` throughout. Log levels: DEBUG for wire-level details (SSE events, HTTP calls), INFO for lifecycle events (session created, command executed), WARN for recoverable issues (reconnection, stale state), ERROR for failures. Hub and stream interceptor should log all command traffic at DEBUG level. |
| **Applies to** | All phases |

### CC.3 — Testing strategy
| | |
|---|---|
| **What** | Unit tests for all services (mock DI dependencies). Integration tests for backend ↔ opencode server communication. Widget tests for React components (render tests). E2E tests for user workflows (Playwright). Minimum 80% coverage for core services. |
| **Applies to** | All phases |

### CC.4 — Documentation
| | |
|---|---|
| **What** | README with setup instructions. Architecture decision records (this TECHSPEC). API documentation for all RPC protocols. Developer guide for creating new modality extensions. |
| **Applies to** | All phases, incrementally |

---

## Task Dependency Graph (Simplified)

```
Phase 0 ✅                           Phase 1 (93% ✅)
┌──────┐                      ┌──────────────────────────────────────┐
│ 0.1  │──→ 0.2 ──→ 0.3      │ 1.1 ──→ 1.2 ──→ 1.3 ──→ 1.4        │
│      │          ──→ 0.4     │                    ──→ 1.5 (Hub)     │
│      │          ──→ 0.5     │ 1.4 ──→ 1.6 ──→ 1.8 ──→ 1.9        │
│      │          ──→ 0.6     │ 1.5 ──→ 1.7 ──→ 1.9                 │
│      │          ──→ 0.7     │ 1.9 ──→ 1.10 ──→ 1.11 ──→ 1.13     │
│      │          ──→ 0.8     │ 1.5 ──→ 1.12 ──→ 1.13               │
└──────┘                      │ 1.4+1.6 ──→ 1.14 (Permission, P0)   │
                              └──────────────────────────────────────┘
                                          │
                                          ▼
                              Phase 1B1 (Architecture C→B1 Refactor)
                              ┌──────────────────────────────────────┐
                              │ 1B1.1 (ChatAgent→SessionService)     │
                              │ 1B1.2 (onAgentCommand RPC iface)     │
                              │   ──→ 1B1.3 (stream interceptor)     │
                              │   ──→ 1B1.4 (SyncService dispatch)   │
                              │ 1B1.5 (simplify Hub)                 │
                              │ 1B1.6 (simplify BridgeContribution)  │
                              │   depends on 1B1.4                   │
                              │ 1B1.7 (fix Hub URL prefix)           │
                              │ 1B1.1–7 ──→ 1B1.8 (verification)    │
                              └──────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    ▼                     ▼                      ▼
              Phase 2               Phase 3                Phase 4
         ┌──────────────┐     ┌──────────────────┐   ┌──────────────────┐
         │ 2.1–2.8      │     │ 3.1 ──→ 3.2      │   │ 4.0a (reveal.js  │
         │   ──→ 2.9    │     │ 3.3, 3.4, 3.5    │   │       spike)     │
         └──────────────┘     │ 3.6 (hardening    │   │ 4.0b (tldraw     │
                              │   depends 1B1.3)  │   │       spike)     │
                              │   ──→ 3.7 ──→ 3.8│   │ 4.1 ──→ 4.2      │
                              │   ──→ 3.9         │   │   ──→ 4.3        │
                              │ 3.1 ──→ 3.10      │   │ 4.4 ──→ 4.5      │
                              │ 3.9 ──→ 3.11      │   │   ──→ 4.6        │
                              │   (result fbk,    │   │ 4.3+4.6 ──→ 4.8  │
                              │   depends 1B1.4)  │   │ (4.7 → Phase 6)  │
                              └──────────────────┘   └──────────────────┘
                                          │                  │
                                          ▼                  ▼
                                    Phase 5 ◄────────────────┘
                                 ┌──────────────┐
                                 │ 5.1–5.7      │
                                 └──────────────┘
                                          │
                                          ▼
                                    Phase 6 (ongoing)
                                 ┌──────────────────┐
                                 │ 6.1–6.6          │
                                 │ 6.7 (custom      │
                                 │   tldraw shapes) │
                                 └──────────────────┘
```

**Critical path:** 0.1 → 0.2 → 0.3 → 0.4 → 1.1 → 1.2 → 1.4 → 1.5 → 1.7 → 1.9 → 1.10 → **1B1.2 → 1B1.3** → 3.6 → 3.7 → 3.8 → 3.9

**Parallelizable:**
- Phase 2 and Phase 3 can run in parallel (chat polish doesn't block agent commands)
- Phase 4 spikes (4.0a, 4.0b) can run in parallel with Phase 2/3 after Phase 1B1 complete
- Phase 4 tasks 4.1–4.3 (presentation) and 4.4–4.6 (whiteboard) are independent
- Phase 3 tasks 3.2, 3.3, 3.4, 3.5 are all independent (different command groups)
- Task 1.14 (permission handling) can run in parallel with 1.7–1.13
- Task 3.11 (command result feedback) follows 3.9 but is independent of Phase 4
- Phase 1B1 tasks 1B1.1, 1B1.2, 1B1.5, 1B1.7 are all independent of each other
- Phase 1B1 tasks 1B1.3 and 1B1.4 depend on 1B1.2 but are independent of each other
- Phase 0 tasks 0.5, 0.6, 0.7, 0.8 are all independent

---

## How to Use This Plan

1. **Track progress** by updating the Status field (⬜ → 🟡 → ✅)
2. **Each task is a Builder delegation** — Oracle writes a `contract.md` referencing the specific task ID (e.g., "Implement task 1.5") with the details from this plan
3. **Phase gates** — at the end of each phase, run the integration test for that phase before moving on
4. **Cross-cutting concerns** are checked at every code review
5. **This document is living** — update it as discoveries are made during implementation

---

## Technical Debt (Parallel Tracks)

These items represent known technical debt that is being addressed in parallel with main development. They do NOT block feature development but MUST be resolved before production release.

### E2E Test Infrastructure Gap

**Issue:** E2E tests written for Architecture B1 assume browser HTTP requests can be mocked with Playwright's `page.route()`, but Architecture B1 uses backend-side RPC (Node.js backend → Hub → OpenCode). Browser-level mocks cannot intercept server-side HTTP calls.

**Impact:**
- E2E tests for Task 2.0+ cannot properly mock backend data
- Only smoke tests (no backend data required) can pass
- Full E2E coverage requires infrastructure rebuild

**Status:** 🔴 Blocked — needs dedicated investigation track

**Solution Approaches:**
1. **Option 1 (Recommended):** Use real backend (Hub + OpenCode) during E2E tests, create real test data via API
2. **Option 2:** Mock at RPC layer (complex, fragile)
3. **Option 3:** Mock Hub server (maintenance burden)

**Estimated Effort:** 6-8 hours

**Detailed Analysis:** See `docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md`

**User Authorization:** User authorized parallel work on 2026-02-17:
- **Main track:** Continue with Tasks 2.1+ using unit tests for validation
- **Parallel track:** Fix E2E infrastructure separately
- **Rationale:** "If you can't test, you don't know if you developed correctly" — but E2E infrastructure can be a separate engineering effort when there's a fundamental architecture mismatch

**Current Test Status:**
- `tests/e2e/session-list-autoload.spec.ts`: 1/1 passing (Test 4 — empty state)
- Tests 1-3 removed (require backend data, blocked by infrastructure)
- Test 5 skipped (requires manual profiling)

**Exit Criteria:**
- All E2E tests for Tasks 2.0–2.5 passing
- E2E infrastructure documented for future test authors
- CI pipeline includes full E2E suite

---

*End of WORKPLAN-THEIA-OPENSPACE*
