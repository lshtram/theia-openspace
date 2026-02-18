---
id: REQ-OPENSPACE
author: oracle_e3f7
status: IN-PROGRESS
date: 2026-02-16
task_id: TheiaOpenspaceRequirements
---

# Requirements: Theia Openspace

> **Purpose:** Track features and their verifying tests as we implement.  
> **Status:** IN-PROGRESS — features added as Phase 0+ implementation proceeds.  
> **Format:** Each feature has a unique ID, description, and test reference.

---

## Feature Categories

- [FEAT-INFRA] Infrastructure & Build
- [FEAT-CORE] Core Connection & Session Management  
- [FEAT-CHAT] Chat & Conversation System
- [FEAT-AGENT] Agent IDE Control
- [FEAT-PRES] Presentation Modality
- [FEAT-WB] Whiteboard Modality
- [FEAT-LAYOUT] Layout & Theming
- [FEAT-SETTINGS] Settings & Configuration

---

## [FEAT-INFRA] Infrastructure & Build

### FEAT-INFRA-001: Theia Version Resolution
**Description:** Research and pin exact Theia version (1.68.2) with @theia/ai-* packages.  
**Status:** ✅ Complete  
**Phase:** 0.1  
**Verifying Test:** Scout research report confirms version stability and AI framework maturity.  
**Implementation:** `/Users/Shared/dev/theia-openspace/.opencode/context/active_tasks/Phase0-Scaffold/result.md`

### FEAT-INFRA-002: Monorepo Scaffold
**Description:** Yarn workspaces monorepo with browser-app and electron-app targets, root tsconfig.json.  
**Status:** ✅ Complete  
**Phase:** 0.2  
**Verifying Test:** `yarn install && yarn build:browser` succeeds without errors.  
**Dependencies:** FEAT-INFRA-001  
**Implementation:** `/Users/Shared/dev/theia-openspace/` - Full monorepo structure created by Builder.

### FEAT-INFRA-003: Extension Package Stubs
**Description:** 6 extension packages with proper package.json metadata and empty DI modules: openspace-core, openspace-chat, openspace-presentation, openspace-whiteboard, openspace-layout, openspace-settings.  
**Status:** ✅ Complete  
**Phase:** 0.3  
**Verifying Test:** All extensions listed in `theiaExtensions` compile without errors; Theia build includes them.  
**Implementation:** All 6 extensions created in `/Users/Shared/dev/theia-openspace/extensions/` with placeholder DI modules.

### FEAT-INFRA-004: Browser App Target
**Description:** browser-app package.json with all required Theia dependencies and extension references.  
**Status:** ✅ Complete  
**Phase:** 0.4  
**Verifying Test:** `yarn start:browser` launches Theia at http://localhost:3000.  
**Implementation:** `/Users/Shared/dev/theia-openspace/browser-app/` configured with all dependencies and extensions.

### FEAT-INFRA-005: Feature Filtering
**Description:** FilterContribution removes Debug, SCM, Notebook panels from the IDE.  
**Status:** ✅ Complete  
**Phase:** 0.5  
**Verifying Test:** Theia UI has no Debug sidebar, no SCM view, no Notebook editor option in menus.  
**Implementation:** `extensions/openspace-core/src/browser/filter-contribution.ts` - FilterContribution implementation.

### FEAT-INFRA-006: Custom Branding
**Description:** Window title set to "Theia Openspace", minimal CSS overrides for header.  
**Status:** ✅ Complete  
**Phase:** 0.6  
**Verifying Test:** Browser tab shows "Theia Openspace" title.  
**Implementation:** Custom CSS in `openspace-layout`, favicon in `browser-app/resources/`.

### FEAT-INFRA-007: AI Chat Panel Verification
**Description:** @theia/ai-chat-ui renders visible chat panel with basic agent registration.  
**Status:** ✅ Complete  
**Phase:** 0.7  
**Verifying Test:** Chat panel visible in sidebar; typing a message triggers agent response (even if echo).  
**Implementation:** Echo agent in `openspace-chat/src/browser/chat-agent.ts`.

### FEAT-INFRA-008: CI Pipeline
**Description:** GitHub Actions workflow for build, typecheck, and test on push/PR.  
**Status:** ✅ Complete  
**Phase:** 0.8  
**Verifying Test:** CI passes on clean checkout; badge in README.  
**Implementation:** `.github/workflows/ci.yml` with build, typecheck steps.

---

## [FEAT-CORE] Core Connection & Session Management

### FEAT-CORE-001: RPC Protocol Definitions
**Description:** TypeScript interfaces for opencode-protocol.ts, session-protocol.ts, command-manifest.ts, pane-protocol.ts.  
**Status:** ⬜ Pending  
**Phase:** 1.1  
**Verifying Test:** All protocol types compile; RPC service path constant defined.

### FEAT-CORE-002: OpenCodeProxy Backend
**Description:** HTTP proxy service implementing OpenCodeService interface, translating RPC to opencode REST API.  
**Status:** ⬜ Pending  
**Phase:** 1.2  
**Verifying Test:** Unit tests confirm proxy correctly translates RPC calls to HTTP requests; can list projects from running opencode server.

### FEAT-CORE-003: SSE Event Forwarding
**Description:** SSE connection to opencode server with event forwarding to frontend via JSON-RPC callbacks.  
**Status:** ⬜ Pending  
**Phase:** 1.3  
**Verifying Test:** Message sent via another client appears in Theia within 200ms; reconnection works after connection drop.

### FEAT-CORE-004: OpenSpace Hub
**Description:** HTTP+SSE server with endpoints: /manifest, /openspace/instructions, /commands, /state, /events.  
**Status:** ⬜ Pending  
**Phase:** 1.5  
**Verifying Test:** Hub starts with Theia; GET /openspace/instructions returns valid prompt; POST /commands → GET /events relay works.

### FEAT-CORE-005: BridgeContribution
**Description:** Frontend service publishing command manifest to Hub, listening for SSE AGENT_COMMAND events, dispatching to CommandRegistry.  
**Status:** ⬜ Pending  
**Phase:** 1.7  
**Verifying Test:** On startup, Hub receives manifest; SSE connection established; commands dispatched correctly.

### FEAT-CORE-006: SessionService
**Description:** Frontend service managing active project/session state with optimistic updates.  
**Status:** ⬜ Pending  
**Phase:** 1.6  
**Verifying Test:** Can switch projects/sessions; messages update in real-time via SSE.

### FEAT-CORE-007: SyncService
**Description:** Frontend service implementing OpenCodeClient, forwarding backend events to SessionService.  
**Status:** ⬜ Pending  
**Phase:** 1.8  
**Verifying Test:** Events from opencode server reflected in SessionService state within 200ms.

### FEAT-CORE-008: Session CRUD UI
**Description:** Create, delete, switch sessions from chat UI or sidebar.  
**Status:** ⬜ Pending  
**Phase:** 1.11  
**Verifying Test:** Can create new session, switch between sessions (messages change), delete session.

### FEAT-CORE-009: OpenCode Instructions Integration
**Description:** opencode.json configured with instructions URL pointing to Hub.  
**Status:** ⬜ Pending  
**Phase:** 1.12  
**Verifying Test:** opencode includes OpenSpace instructions block in agent system prompt.

---

## [FEAT-CHAT] Chat & Conversation System

### FEAT-CHAT-001: Multi-part Prompt Input
**Description:** Text, file attachments, image attachments, @agent mentions with typeahead.  
**Status:** ⬜ Pending  
**Phase:** 2.1  
**Verifying Test:** Can compose message with text + attached files + @mention; parts sent correctly to opencode server.

### FEAT-CHAT-002: Message Timeline with Streaming
**Description:** Styled message list with user/assistant differentiation, streaming indicator, scroll spy.  
**Status:** ⬜ Pending  
**Phase:** 2.2  
**Verifying Test:** Conversation readable; streaming shows real-time text; scroll up stops auto-scroll.

### FEAT-CHAT-003: Code Block Renderer
**Description:** Syntax-highlighted code blocks with Copy and Apply buttons.  
**Status:** ⬜ Pending  
**Phase:** 2.3  
**Verifying Test:** Code blocks syntax-highlighted; Copy button works; Apply opens file with changes.

### FEAT-CHAT-004: Diff Renderer
**Description:** Inline diff view showing added/removed lines with color coding.  
**Status:** ⬜ Pending  
**Phase:** 2.4  
**Verifying Test:** Diffs render with green/red highlighting; readable layout.

### FEAT-CHAT-005: File Reference Renderer
**Description:** Clickable file:line links that open editor at referenced line.  
**Status:** ⬜ Pending  
**Phase:** 2.5  
**Verifying Test:** Clicking file:line reference opens file and scrolls to line.

### FEAT-CHAT-006: Session Sidebar
**Description:** Sidebar panel showing session list with title, date, preview; CRUD operations.  
**Status:** ⬜ Pending  
**Phase:** 2.6  
**Verifying Test:** Session list in left sidebar; all CRUD operations work.

### FEAT-CHAT-007: Session Operations
**Description:** Fork, revert, compact, unrevert session operations.  
**Status:** ⬜ Pending  
**Phase:** 2.7  
**Verifying Test:** Can fork at message, revert removes subsequent messages, compact calls API.

### FEAT-CHAT-008: Token Usage Display
**Description:** Real-time token count display in session header.  
**Status:** ⬜ Pending  
**Phase:** 2.8  
**Verifying Test:** Token counts visible and updating during/after message exchange.

---

## [FEAT-AGENT] Agent IDE Control

### FEAT-AGENT-001: PaneService
**Description:** Programmatic pane control wrapping ApplicationShell.  
**Status:** ⬜ Pending  
**Phase:** 3.1  
**Verifying Test:** Pane operations work; listPanes() returns accurate layout with geometry.

### FEAT-AGENT-002: Pane Commands
**Description:** openspace.pane.open, .close, .focus, .list, .resize commands in CommandRegistry.  
**Status:** ⬜ Pending  
**Phase:** 3.2  
**Verifying Test:** Commands executable from command palette; list returns correct layout.

### FEAT-AGENT-003: Editor Commands
**Description:** openspace.editor.open, .scroll_to, .highlight, .clear_highlight, .read_file, .close commands.  
**Status:** ⬜ Pending  
**Phase:** 3.3  
**Verifying Test:** Can open file at line 42, highlight lines 42-50, clear highlights from command palette.

### FEAT-AGENT-004: Terminal Commands
**Description:** openspace.terminal.create, .send, .read_output, .list, .close commands with ring buffer.  
**Status:** ⬜ Pending  
**Phase:** 3.4  
**Verifying Test:** Create terminal, send "echo hello", read back "hello" from output buffer.

### FEAT-AGENT-005: File Commands
**Description:** openspace.file.read, .write, .list, .search commands with workspace-root constraint.  
**Status:** ⬜ Pending  
**Phase:** 3.5  **Verifying Test:** Commands work; cannot read/write outside workspace root.

### FEAT-AGENT-006: Stream Interceptor
**Description:** Scans response stream for %%OS{...}%% blocks, strips from visible text, POSTs to Hub.  
**Status:** ⬜ Pending  
**Phase:** 3.6  
**Verifying Test:** Response with %%OS{}%% block → user sees clean text, Hub receives command; handles split chunks correctly.

### FEAT-AGENT-007: Command Manifest Auto-generation
**Description:** BridgeContribution builds manifest from all openspace.* commands with argument schemas.  
**Status:** ⬜ Pending  
**Phase:** 3.7  
**Verifying Test:** Hub manifest cache contains all commands with full schemas; updates automatically on new commands.

### FEAT-AGENT-008: System Prompt Generation
**Description:** Hub generates system prompt from manifest + live IDE state.  
**Status:** ⬜ Pending  
**Phase:** 3.8  
**Verifying Test:** GET /openspace/instructions returns well-formatted prompt with examples; updates on state changes.

### FEAT-AGENT-009: Pane State Publishing
**Description:** BridgeContribution publishes pane state changes to Hub for live IDE state in prompt.  
**Status:** ⬜ Pending  
**Phase:** 3.10  
**Verifying Test:** Open file → /openspace/instructions includes it; close it → it disappears.

### FEAT-AGENT-010: End-to-End Agent Control
**Description:** Full round-trip: agent emits %%OS{}%% → IDE action performed.  
**Status:** ⬜ Pending  
**Phase:** 3.9  
**Verifying Test:** Agent can open file, scroll, highlight, create terminal via %%OS{}%% blocks.

---

## [FEAT-PRES] Presentation Modality

### FEAT-PRES-001: Presentation Widget
**Description:** ReactWidget embedding reveal.js for .deck.md files.  
**Status:** ⬜ Pending  
**Phase:** 4.1  
**Verifying Test:** .deck.md file opens as presentation widget; arrow keys navigate slides.

### FEAT-PRES-002: Presentation Open Handler
**Description:** WidgetOpenHandler for .deck.md files with priority 200.  
**Status:** ⬜ Pending  
**Phase:** 4.2  
**Verifying Test:** Double-clicking .deck.md opens presentation widget, not text editor.

### FEAT-PRES-003: Presentation Commands
**Description:** All presentation commands in CommandRegistry: list, read, create, update_slide, open, navigate, play, pause, stop.  
**Status:** ⬜ Pending  
**Phase:** 4.3  
**Verifying Test:** Agent can create deck, open, navigate slides via commands; all in manifest.

---

## [FEAT-WB] Whiteboard Modality

### FEAT-WB-001: Whiteboard Widget
**Description:** ReactWidget embedding tldraw for .whiteboard.json files.  
**Status:** ⬜ Pending  
**Phase:** 4.4  
**Verifying Test:** .whiteboard.json opens as whiteboard widget; user can draw shapes, type text.

### FEAT-WB-002: Whiteboard Open Handler
**Description:** WidgetOpenHandler for .whiteboard.json files with priority 200.  
**Status:** ⬜ Pending  
**Phase:** 4.5  
**Verifying Test:** Double-clicking .whiteboard.json opens whiteboard widget.

### FEAT-WB-003: Whiteboard Commands
**Description:** All whiteboard commands in CommandRegistry: list, read, create, add_shape, update_shape, delete_shape, open, camera.*.  
**Status:** ⬜ Pending  
**Phase:** 4.6  
**Verifying Test:** Agent can create whiteboard, add shapes, control camera via commands; all in manifest.

### FEAT-WB-004: Custom Shape Types
**Description:** Custom tldraw shapes for UML: ClassBox, InterfaceBox, State, Decision, etc.  
**Status:** ⬜ Pending  
**Phase:** 4.7  
**Verifying Test:** Agent can add_shape with type "class_box" and it renders as UML class diagram.

---

## [FEAT-LAYOUT] Layout & Theming

### FEAT-LAYOUT-001: Default Layout
**Description:** Opinionated default layout: chat right, file tree left, terminal bottom.  
**Status:** ⬜ Pending  
**Phase:** 5.1  
**Verifying Test:** Fresh install opens with correct layout; user can still rearrange.

### FEAT-LAYOUT-002: Custom Theming
**Description:** Dark and light themes for Theia Openspace; custom colors, fonts, borders.  
**Status:** ⬜ Pending  
**Phase:** 5.2  
**Verifying Test:** App looks distinct from stock Theia; dark mode is default and polished.

---

## [FEAT-SETTINGS] Settings & Configuration

### FEAT-SETTINGS-001: Settings Panels
**Description:** Provider configuration, agent configuration, appearance settings panels.  
**Status:** ⬜ Pending  
**Phase:** 5.3  
**Verifying Test:** Users can configure providers, select models, change themes from settings UI.

### FEAT-SETTINGS-002: Electron Desktop Build
**Description:** Electron app packaging with native menus, icons, auto-updater framework.  
**Status:** ⬜ Pending  
**Phase:** 5.4  
**Verifying Test:** yarn build:electron produces runnable .app; all features work.

### FEAT-SETTINGS-003: Layout Persistence
**Description:** Persist panel layout, sizes, open tabs across sessions via StorageService.  
**Status:** ⬜ Pending  
**Phase:** 5.5  
**Verifying Test:** Close Theia → reopen → same layout and tabs.

### FEAT-SETTINGS-004: Session Sharing
**Description:** Generate shareable links via opencode API; open shared sessions.  
**Status:** ⬜ Pending  
**Phase:** 5.6  
**Verifying Test:** Can share session → get link → link opens session (if opencode supports).

---

## Test Summary

| Phase | Feature Count | Tests Required |
|-------|--------------|----------------|
| Phase 0 | 8 | 8 integration/build tests |
| Phase 1 | 9 | 9 unit/integration tests |
| Phase 2 | 8 | 8 UI/integration tests |
| Phase 3 | 10 | 10 unit/integration/E2E tests |
| Phase 4 | 7 | 7 modality tests |
| Phase 5 | 7 | 7 desktop/settings tests |
| **Total** | **49** | **49+ tests** |

---

*This document is updated as implementation proceeds. Last updated: 2026-02-16*
