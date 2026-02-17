---
id: TECHSPEC-THEIA-OPENSPACE
author: oracle_e3f7
status: DRAFT
date: 2026-02-16
updated: 2026-02-17
task_id: TheiOpenspaceArchitecture
---

# Technical Specification: Theia Openspace

> **Document Type:** Technical Architecture Specification  
> **Purpose:** Define the architecture for Theia Openspace — an AI-native IDE built on Eclipse Theia where both agent and user have full, equal control over the IDE environment  
> **Audience:** Engineering team, all NSO agents  
> **Prerequisites:**
> - [RFC-001: Theia Architecture Research](./RFC-001-THEIA-ARCHITECTURE-RESEARCH.md)
> - [REQ-MODALITY-PLATFORM-V2](../requirements/REQ-MODALITY-PLATFORM-V2.md)
> - [OpenCode Feature List](../../OPENCODE_FEATURE_LIST.md)

---

## 1. Vision & Core Principles

### 1.1 Product Vision

Theia Openspace replaces the current opencode desktop/web client with a full IDE where:

1. **Agent and user are equal participants** — both can open/close tabs, navigate code, create presentations, draw diagrams, scroll editors, run terminals
2. **Multi-modal communication** — the agent communicates through presentations, whiteboards, code navigation, comments, and highlighted code — not just chat text
3. **IDE-native experience** — built on Eclipse Theia, providing Monaco editor, file tree, terminal, keybindings, extensions — a real development environment
4. **Preserved opencode functionality** — all existing opencode client features (sessions, prompts, file management, settings, MCP tools) are available

### 1.2 Architectural Principles

| Principle | Implication |
|---|---|
| **Theia-native** | Use Theia Extension APIs, DI, contribution points — don't fight the framework |
| **Theia AI first** | Register `ChatAgent` in Theia AI for agent discoverability; use custom chat widget for full opencode feature support (Architecture B1 — see §2.1.1) |
| **CommandRegistry as universal control plane** | Every OpenSpace action is a Theia command — agent, user, and keybindings all execute via `commandService.executeCommand()` |
| **Modality surfaces as Widgets** | Presentations, whiteboards, editors are all Theia Widgets in the ApplicationShell |
| **Automatic discovery** | New commands auto-register in the command manifest; the agent's system prompt regenerates from the live manifest — zero manual prompt engineering |
| **Stream interceptor pattern** | Agent emits `%%OS{...}%%` blocks inline in its response; stream interceptor in OpenCodeProxy strips them and dispatches to frontend via RPC callback — opencode stays unmodified |
| **Compile-time extensions** | All custom code is Theia Extensions (not plugins) for full DI access |
| **Opencode unmodified** | The only hook into opencode is its native `instructions` URL support — no forks, patches, or code changes to opencode |
| **RPC as the single transport** | All backend→frontend communication uses Theia's JSON-RPC channel (OpenCodeClient callbacks). No separate SSE relay between internal components. |

---

## 2. System Architecture

### 2.1 High-Level Architecture (Architecture B1)

> **Architecture decision:** Architecture B1 — "Hybrid" approach. We register an `OpenspaceChatAgent` in Theia's AI agent registry for ecosystem integration (@mentions, config panel), but use a custom `ChatWidget` + `SessionService` for full opencode feature support (fork/revert/compact, permissions, multi-part prompts). See §15 for rationale and alternatives considered.

The architecture has **four moving parts** and one config line:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      Theia Openspace Application (Architecture B1)               │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                     Frontend (Browser/Electron)                             │  │
│  │                                                                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐              │  │
│  │  │ Chat     │  │ Editor   │  │Presentation│  │  Whiteboard  │              │  │
│  │  │ Widget   │  │(Monaco)  │  │  Widget    │  │   Widget     │              │  │
│  │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──────┬───────┘              │  │
│  │       │              │              │               │                       │  │
│  │  ┌────┴──────────────┴──────────────┴───────────────┴───────────────────┐  │  │
│  │  │         ① Theia CommandRegistry (universal control plane)            │  │  │
│  │  │   All OpenSpace actions registered as commands.                       │  │  │
│  │  │   User keybinds, menus, AND agent commands all execute here.          │  │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                             │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │
│  │  │              Frontend Services (DI Container)                        │  │  │
│  │  │                                                                      │  │  │
│  │  │  SessionService        — session/message state, talks to backend     │  │  │
│  │  │  SyncService           — receives RPC callbacks, updates state,      │  │  │
│  │  │                          dispatches agent commands → CommandRegistry  │  │  │
│  │  │  OpenspaceChatAgent    — registered in Theia AI, delegates to        │  │  │
│  │  │                          SessionService (makes @Openspace work)      │  │  │
│  │  │  BridgeContribution    — publishes command manifest + pane state     │  │  │
│  │  │                          to Hub on startup                           │  │  │
│  │  │  PaneService           — programmatic pane control                   │  │  │
│  │  └──────────────────────────┬───────────────────────────────────────────┘  │  │
│  └─────────────────────────────┼──────────────────────────────────────────────┘  │
│                                │ JSON-RPC over WebSocket                         │
│  ┌─────────────────────────────┼──────────────────────────────────────────────┐  │
│  │                      Backend (Node.js)                                      │  │
│  │  ┌─────────────────────────┴───────────────────────────────────────────┐   │  │
│  │  │  ② OpenCodeProxy (HTTP client + SSE + stream interceptor)           │   │  │
│  │  │   • HTTP calls to opencode server REST API                          │   │  │
│  │  │   • SSE connection to opencode server event stream                  │   │  │
│  │  │   • Stream interceptor: strips %%OS{...}%% blocks from messages,    │   │  │
│  │  │     dispatches extracted commands via RPC callback (onAgentCommand)  │   │  │
│  │  │   • Forwards clean events to frontend via OpenCodeClient callbacks  │   │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │  │
│  │  │  ③ OpenSpace Hub (HTTP only — no SSE)                               │   │  │
│  │  │   • POST /openspace/manifest — receives manifest from Bridge        │   │  │
│  │  │   • POST /openspace/state — receives pane state from Bridge         │   │  │
│  │  │   • GET /openspace/instructions — generates system prompt from      │   │  │
│  │  │     manifest + pane state (consumed by opencode)                     │   │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────┬───────────────────────────────────────────────┘  │
│                               │ REST + SSE                                       │
│  ┌────────────────────────────┴───────────────────────────────────────────────┐  │
│  │                 OpenCode Server (External Process — UNMODIFIED)             │  │
│  │   Sessions │ Messages │ AI Execution │ MCP Servers │ Files                 │  │
│  │                                                                            │  │
│  │   ④ opencode.json: "instructions": ["http://localhost:3000/openspace/      │  │
│  │      instructions"] — single config line, native support                   │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1.1 The Four Moving Parts

| # | Component | Location | Role |
|---|---|---|---|
| ① | **Theia CommandRegistry** | Theia frontend (browser) | All OpenSpace actions (pane.open, editor.scroll, whiteboard.add_shape, etc.) are registered as real Theia commands. User keybindings, menus, and agent commands all go through `commandService.executeCommand()` |
| ② | **OpenCodeProxy + Stream Interceptor** | Theia backend (Node.js) | HTTP client to opencode server. Maintains SSE connection for event streaming. **Integrated stream interceptor** scans response stream for `%%OS{...}%%` blocks, strips them from visible output, and dispatches extracted commands to the frontend via `OpenCodeClient.onAgentCommand()` RPC callback |
| ③ | **OpenSpace Hub** | HTTP server, co-located with Theia backend | (a) Caches command manifest from BridgeContribution, (b) caches pane state from BridgeContribution, (c) generates system prompt via `GET /openspace/instructions` from manifest + live pane state. **Note:** The Hub is a read/write cache with one public endpoint — it does NOT relay commands or maintain SSE connections |
| ④ | **opencode.json** | OpenCode config file | Single line: `"instructions": ["http://localhost:3000/openspace/instructions"]` — opencode's native `instructions` URL support injects OpenSpace awareness into every agent session |

### 2.1.2 Key Insight: Automatic Discovery

When a new modality command is added as a Theia command (e.g., `openspace.whiteboard.camera.fit`):
1. The BridgeContribution picks it up and publishes the updated manifest to the Hub
2. The Hub regenerates the system prompt from the live manifest
3. The agent learns about the new command on its next session — **zero prompt engineering required**

This means adding a new agent capability is just: register a Theia command → it automatically appears in the agent's instruction set.

### 2.1.3 Architecture B1: Why This Design

**Architecture B1** is a hybrid approach chosen after evaluating three alternatives:

| Architecture | Approach | Verdict |
|---|---|---|
| **A: Native Theia AI** | Register `LanguageModel` wrapping opencode, use Theia's `ChatViewWidget` entirely | Rejected — impedance mismatch with opencode's stateful session model (fork/revert/compact/permissions). Theia's `LanguageModel.request()` is stateless. |
| **B1: Hybrid (chosen)** | Register `ChatAgent` in Theia AI for discoverability, custom `ChatWidget` + `SessionService` for full opencode feature support | **Selected** — best balance of ecosystem integration and feature control |
| **C: Parallel System** | Ignore Theia AI entirely, build separate system | Rejected — wastes `@theia/ai-*` dependency, no ecosystem integration, duplicate effort |

**Key B1 decisions:**
- `OpenspaceChatAgent` delegates to `SessionService` — making `@Openspace` mentions work in Theia's built-in chat
- Custom `ChatWidget` for opencode-specific features (fork/revert, permissions, multi-part prompts)
- Agent commands dispatched via existing RPC channel (not a separate SSE relay)
- Hub serves only the `instructions` endpoint (no command relay)

### 2.2 Extension Package Structure

```
theia-openspace/
├── package.json                    # Root: yarn workspaces
├── tsconfig.json                   # Root TypeScript config
├── browser-app/                    # Browser application target
│   └── package.json                # Theia dependencies + our extensions
├── electron-app/                   # Electron (desktop) application target
│   └── package.json
├── extensions/
│   ├── openspace-core/             # Core services, protocols, session mgmt, Hub
│   │   ├── package.json
│   │   └── src/
│   │       ├── common/             # Shared protocols (frontend ↔ backend)
│   │       │   ├── opencode-protocol.ts      # OpenCode server API types
│   │       │   ├── session-protocol.ts       # Session management protocol
│   │       │   ├── command-manifest.ts       # Command manifest types
│   │       │   └── pane-protocol.ts          # Pane control protocol
│   │       ├── browser/            # Frontend DI module
│   │       │   ├── openspace-core-frontend-module.ts
│   │       │   ├── session-service.ts        # Session state management
│   │       │   ├── opencode-sync-service.ts  # SSE sync with opencode server
│   │       │   ├── pane-service.ts           # Programmatic pane control
│   │       │   ├── bridge-contribution.ts    # ② OpenSpaceBridgeContribution
│   │       │   └── pane-command-contribution.ts  # Pane commands → CommandRegistry
│   │       └── node/               # Backend DI module
│   │           ├── openspace-core-backend-module.ts
│   │           ├── opencode-proxy.ts         # HTTP proxy to opencode server + integrated stream interceptor
│   │           ├── session-backend.ts        # Session management backend
│   │           └── hub.ts                    # ③ OpenSpace Hub (HTTP-only, manifest cache + instructions)
│   │
│   ├── openspace-chat/             # Chat & conversation UI
│   │   ├── package.json
│   │   └── src/browser/
│   │       ├── openspace-chat-frontend-module.ts
│   │       ├── chat-widget.tsx               # Main chat widget (ReactWidget)
│   │       ├── prompt-input.tsx              # Multi-part prompt input
│   │       ├── message-timeline.tsx          # Message display
│   │       ├── response-renderers/           # Custom response part renderers
│   │       │   ├── code-renderer.tsx
│   │       │   ├── diff-renderer.tsx
│   │       │   └── command-renderer.tsx
│   │       └── chat-agent.ts                # Theia AI chat agent
│   │
│   ├── openspace-presentation/     # Presentation modality
│   │   ├── package.json
│   │   └── src/browser/
│   │       ├── openspace-presentation-frontend-module.ts
│   │       ├── presentation-widget.tsx       # Reveal.js viewer widget
│   │       ├── presentation-open-handler.ts  # .deck.md file opener
│   │       ├── presentation-service.ts       # Deck CRUD + playback state
│   │       └── presentation-command-contribution.ts  # Commands → CommandRegistry
│   │
│   ├── openspace-whiteboard/       # Whiteboard modality
│   │   ├── package.json
│   │   └── src/browser/
│   │       ├── openspace-whiteboard-frontend-module.ts
│   │       ├── whiteboard-widget.tsx          # tldraw canvas widget
│   │       ├── whiteboard-open-handler.ts     # .whiteboard.json opener
│   │       ├── whiteboard-service.ts          # Shape CRUD + camera
│   │       └── whiteboard-command-contribution.ts  # Commands → CommandRegistry
│   │
│   ├── openspace-layout/           # Custom shell layout & theming
│   │   ├── package.json
│   │   └── src/browser/
│   │       ├── openspace-layout-frontend-module.ts
│   │       ├── openspace-shell.ts             # Custom ApplicationShell
│   │       ├── openspace-sidebar.tsx           # Custom sidebar
│   │       └── styles/                         # Custom CSS/theming
│   │
│   └── openspace-settings/         # Settings & configuration
│       ├── package.json
│       └── src/
│           ├── browser/
│           │   ├── openspace-settings-frontend-module.ts
│           │   └── settings-widget.tsx         # Settings panels
│           └── common/
│               └── settings-protocol.ts
│
├── docs/                           # Documentation
│   ├── requirements/
│   └── architecture/
├── .opencode/                      # NSO context
└── plugins/                        # VS Code extensions (optional)
```

**Key change from previous draft:** The `openspace-agent-tools` extension has been **removed**. Agent tools are no longer a separate concern — each extension registers its own commands in the Theia `CommandRegistry`, and the Hub + BridgeContribution make them available to the agent automatically.

---

## 3. Core Services Architecture

### 3.1 OpenCode Server Integration

The backend acts as a proxy to the existing opencode server, translating between Theia's RPC model and the opencode REST+SSE API.

#### 3.1.1 OpenCode Proxy Service

**Location:** `openspace-core/src/node/opencode-proxy.ts`

```
Frontend (browser) ←→ JSON-RPC ←→ Backend (node) ←→ REST/SSE ←→ OpenCode Server
```

**Protocol definition** (`common/opencode-protocol.ts`):

```typescript
// Core types matching opencode API (from specs/project.md)
export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  metadata: MessageMetadata;
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolName: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string }
  | { type: 'file'; path: string; content?: string }
  | { type: 'image'; url: string; alt?: string };

// RPC Protocol
export const OpenCodeService = Symbol('OpenCodeService');
export const openCodeServicePath = '/services/opencode';

export interface OpenCodeService extends RpcServer<OpenCodeClient> {
  // Projects
  listProjects(): Promise<Project[]>;
  initProject(path: string): Promise<Project>;

  // Sessions
  listSessions(projectId: string): Promise<Session[]>;
  createSession(projectId: string): Promise<Session>;
  deleteSession(projectId: string, sessionId: string): Promise<void>;
  getSession(projectId: string, sessionId: string): Promise<Session>;

  // Messages
  listMessages(projectId: string, sessionId: string): Promise<Message[]>;
  sendMessage(projectId: string, sessionId: string, parts: MessagePart[]): Promise<void>;
  abortSession(projectId: string, sessionId: string): Promise<void>;

  // Session operations
  revertSession(projectId: string, sessionId: string, messageId: string): Promise<void>;
  unrevertSession(projectId: string, sessionId: string): Promise<void>;
  compactSession(projectId: string, sessionId: string): Promise<void>;
  shareSession(projectId: string, sessionId: string): Promise<string>;
  forkSession(projectId: string, sessionId: string, messageId: string): Promise<Session>;

  // Files
  findFiles(projectId: string, sessionId: string, query: string): Promise<string[]>;
  readFile(projectId: string, sessionId: string, path: string): Promise<string>;
  getFileStatus(projectId: string, sessionId: string): Promise<FileStatus[]>;

  // Providers & Config
  getProviders(): Promise<Provider[]>;
  getConfig(): Promise<AppConfig>;
  getAgents(projectId: string): Promise<Agent[]>;

  // Server management
  getServerUrl(): Promise<string>;
  setServerUrl(url: string): Promise<void>;
  checkHealth(): Promise<boolean>;
}

export interface OpenCodeClient {
  // SSE events pushed to frontend
  onSessionEvent(event: SessionEvent): void;
  onMessageEvent(event: MessageEvent): void;
  onFileEvent(event: FileEvent): void;
  onAgentCommand(command: AgentCommand): void;
}
```

#### 3.1.2 SSE Event Stream

The backend maintains an SSE connection to the opencode server and forwards events to the frontend via the JSON-RPC client callback pattern:

```
OpenCode Server ──SSE──→ Backend (OpenCodeProxy) ──RPC callback──→ Frontend (SyncService)
```

Event types to forward:
- `session.*` — session created/updated/deleted
- `message.*` — message added/updated, parts streaming
- `file.*` — file status changes
- `permission.*` — permission requests

> **Note:** Agent commands (`%%OS{...}%%` blocks) are NOT separate SSE events. They are extracted from `message.*` event text by the stream interceptor integrated in OpenCodeProxy (§6.5) and dispatched via the `OpenCodeClient.onAgentCommand()` RPC callback.

### 3.2 Session Management

**Location:** `openspace-core/src/browser/session-service.ts`

The SessionService manages the active session state on the frontend, mirroring the opencode client's `SyncProvider` + `GlobalSyncProvider` pattern.

**Responsibilities:**
- Track active project and session
- Maintain message list with optimistic updates
- Handle session create/delete/fork/revert operations
- Coordinate between chat widget and opencode server
- Emit events for other widgets (file tree, terminal, etc.)

**Key interfaces:**

```typescript
export const SessionService = Symbol('SessionService');

export interface SessionService {
  // State
  readonly activeProject: Project | undefined;
  readonly activeSession: Session | undefined;
  readonly messages: Message[];

  // Events
  readonly onActiveProjectChanged: Event<Project | undefined>;
  readonly onActiveSessionChanged: Event<Session | undefined>;
  readonly onMessagesChanged: Event<Message[]>;
  readonly onMessageStreaming: Event<StreamingUpdate>;

  // Operations
  setActiveProject(projectId: string): Promise<void>;
  setActiveSession(sessionId: string): Promise<void>;
  createSession(): Promise<Session>;
  sendMessage(parts: MessagePart[]): Promise<void>;
  abort(): Promise<void>;
}
```

### 3.3 Pane Service (Agent-Controllable Layout)

**Location:** `openspace-core/src/browser/pane-service.ts`

Wraps Theia's `ApplicationShell` to provide a unified API for both user and agent pane operations.

**Key responsibilities:**
- Map abstract pane operations to ApplicationShell widget management
- Track pane geometry (sizes, positions, split ratios)
- Provide the data source for `pane.list` MCP tool
- Handle agent pane commands received from the backend

```typescript
export const PaneService = Symbol('PaneService');

export interface PaneService {
  // Pane operations (used by both user UI and agent tools)
  openContent(request: OpenContentRequest): Promise<string>; // returns paneId
  closeContent(contentId: string): Promise<void>;
  closePane(paneId: string): Promise<void>;
  focusContent(contentId: string): Promise<void>;
  focusPane(paneId: string): Promise<void>;
  resizePane(paneId: string, width?: number, height?: number): Promise<void>;

  // Query
  listPanes(): PaneLayout;
  getActivePane(): PaneInfo | undefined;
  getActiveContent(): ContentInfo | undefined;

  // Events
  readonly onPaneLayoutChanged: Event<PaneLayout>;
}

export interface OpenContentRequest {
  type: 'editor' | 'presentation' | 'whiteboard' | 'chat' | 'terminal';
  contentId: string;
  title: string;
  targetPaneId?: string;
  newPane?: boolean;
  splitDirection?: 'horizontal' | 'vertical';
}

export interface PaneLayout {
  panes: PaneInfo[];
}

export interface PaneInfo {
  id: string;
  area: 'main' | 'left' | 'right' | 'bottom';
  tabs: TabInfo[];
  activeTabIndex: number;
  geometry: { x: number; y: number; width: number; height: number }; // percentages
}

export interface TabInfo {
  contentId: string;
  type: string;
  title: string;
  isDirty: boolean;
}
```

**Implementation notes:**
- `openContent` maps to `ApplicationShell.addWidget()` with appropriate `WidgetOptions`
- Widget factories for each content type are registered in respective extension modules
- Pane IDs are derived from Theia widget IDs
- Geometry is calculated from the DockPanel layout tree

---

## 4. Chat & Conversation System

### 4.1 Architecture Decision: Hybrid Theia AI Integration (B1)

**Decision: Register agent in Theia AI, custom chat widget for UI.**

Theia AI provides `@theia/ai-chat` and `@theia/ai-chat-ui` with chat session management, agent framework with `@agent` mentions, tool function calling, custom response renderers, and prompt template system.

We use a **hybrid approach (Architecture B1)** because:
1. **Agent registration** gives us `@Openspace` mention routing and Theia AI config panel for free
2. **Custom chat widget** is needed for opencode-specific features that Theia's `ChatViewWidget` cannot support: session fork/revert/compact, permission dialogs, multi-part prompts with file attachments, token usage display
3. The `ChatAgent.invoke()` method delegates to our `SessionService`, which proxies to the opencode server — no `LanguageModel` registration needed

### 4.2 Chat Agent

**Location:** `openspace-chat/src/browser/chat-agent.ts`

Our primary chat agent is a thin bridge between Theia AI and our `SessionService`:

```typescript
@injectable()
export class OpenspaceChatAgent implements ChatAgent {
  id = 'openspace';
  name = 'Openspace';
  description = 'AI assistant with full IDE control';
  locations = [ChatAgentLocation.Panel];

  @inject(SessionService)
  private sessionService: SessionService;

  async invoke(request: MutableChatRequestModel): Promise<void> {
    // Extract user message, send via SessionService → OpenCodeProxy → opencode server
    const text = request.request?.text;
    const parts: MessagePart[] = [{ type: 'text', text }];
    await this.sessionService.sendMessage(parts);

    // Subscribe to streaming updates, push into Theia's response model
    const disposable = this.sessionService.onMessageStreaming(update => {
      request.response.response.addContent(new TextChatResponseContentImpl(update.delta));
      if (update.isDone) {
        request.response.complete();
        disposable.dispose();
      }
    });
  }
}
```

**Key design points:**
- The agent does NOT call LLMs directly — it proxies to the opencode server via `SessionService`
- IDE control happens via the `%%OS{...}%%` stream interceptor pattern (§6), not via MCP tool calls
- The `invoke()` method makes `@Openspace` work from Theia's built-in chat panel
- The primary user-facing chat experience is via our custom `ChatWidget`, which also uses `SessionService` directly

### 4.3 Chat Widget

**Location:** `openspace-chat/src/browser/chat-widget.tsx`

Custom ReactWidget providing the conversation interface. Mirrors the opencode client's session page but as a Theia panel:

**Features to port from opencode client:**
- Multi-part prompt input (text, file mentions, image attachments, @agent mentions)
- Message timeline with scroll spy
- Streaming message display
- Session header (title, token usage, actions)
- Session list in sidebar
- Command palette integration (slash commands)

**Placement:** Right panel by default (configurable). The chat widget is a persistent panel, not a tab in the main area.

### 4.4 Response Renderers

Custom renderers for rich agent responses:

| Response Part Type | Renderer | Description |
|---|---|---|
| `code` | CodeBlockRenderer | Syntax-highlighted code with copy/apply buttons |
| `diff` | DiffRenderer | Side-by-side or inline diff view |
| `file_reference` | FileRefRenderer | Clickable file:line links that open editor |
| `presentation_link` | PresentationRenderer | Link to open presentation at slide |
| `whiteboard_link` | WhiteboardRenderer | Link to open whiteboard at shape |
| `command_button` | CommandRenderer | Executable command button |
| `error` | ErrorRenderer | Formatted error with stack trace |

---

## 5. Modality Surfaces

### 5.1 Editor Modality (Monaco)

**Theia provides this out of the box.** Our additions:

#### 5.1.1 Agent Editor Commands

**Location:** `openspace-core/src/browser/editor-command-contribution.ts`

Commands registered in the CommandRegistry that give the agent control over Monaco editors:

| Command ID | Action | Theia API Used |
|---|---|---|
| `openspace.editor.open` | Open file at line/column, optionally highlight | `EditorManager.open()` with `selection` option |
| `openspace.editor.scroll_to` | Scroll editor to line | `MonacoEditor.getControl().revealLineInCenter()` |
| `openspace.editor.highlight` | Apply transient decorations | `MonacoEditor.getControl().deltaDecorations()` |
| `openspace.editor.clear_highlight` | Remove decorations | `MonacoEditor.getControl().deltaDecorations()` |
| `openspace.editor.read_file` | Read file content | `FileService.read()` |
| `openspace.editor.close` | Close editor tab | `Widget.close()` via `EditorManager` |

See §6.6 for full argument schemas.

#### 5.1.2 Agent-Guided Navigation

Implements REQ-EDT-014 through REQ-EDT-020:

```typescript
export interface AgentRevealRequest {
  path: string;
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  highlight?: boolean;
  highlightId?: string;
  mode?: 'auto-focus' | 'suggest-only' | 'disabled';
  newPane?: boolean;
}
```

**Implementation:**
1. `editor.open` with line params → `EditorManager.open(uri, { selection, widgetOptions })`
2. Highlight → `deltaDecorations()` with custom CSS class + `highlightId` tracking
3. Escape override → keybinding that clears highlights and restores previous position
4. Navigation history → stack of `{uri, selection}` before each agent reveal

### 5.2 Presentation Modality

**Location:** `openspace-presentation/`

#### 5.2.1 Presentation Widget

A custom `ReactWidget` that renders presentation decks using [reveal.js](https://revealjs.com/):

```typescript
@injectable()
export class PresentationWidget extends ReactWidget {
  static readonly ID_PREFIX = 'openspace:presentation:';

  // Each presentation instance gets unique ID from deck path
  constructor(@inject(PresentationWidgetOptions) options: PresentationWidgetOptions) {
    super();
    this.id = PresentationWidget.ID_PREFIX + options.deckPath;
    this.title.label = options.deckName;
    this.title.closable = true;
    this.title.iconClass = 'codicon codicon-preview';
  }

  protected render(): React.ReactNode {
    // Render reveal.js presentation
    return <RevealPresentation
      deck={this.deckContent}
      currentSlide={this.currentSlide}
      playbackState={this.playbackState}
      onSlideChange={this.handleSlideChange}
    />;
  }
}
```

#### 5.2.2 Presentation Open Handler

Registers `.deck.md` files to open in the presentation widget instead of the editor:

```typescript
@injectable()
export class PresentationOpenHandler extends WidgetOpenHandler<PresentationWidget> {
  readonly id = 'openspace.presentation';

  canHandle(uri: URI): number {
    return uri.path.base.endsWith('.deck.md') ? 200 : 0;
  }
}
```

#### 5.2.3 Deck Format

The canonical artifact is a Markdown file with YAML frontmatter and `---` slide delimiters:

```markdown
---
title: Architecture Overview
theme: dark
---

# Slide 1: Introduction

Content here...

---

# Slide 2: System Design

More content...
```

#### 5.2.4 Presentation Commands (registered in CommandRegistry)

| Command ID | Maps to REQ |
|---|---|
| `openspace.presentation.list` | REQ-PRES-005 |
| `openspace.presentation.read` | REQ-PRES-006 |
| `openspace.presentation.create` | REQ-PRES-007 |
| `openspace.presentation.update_slide` | REQ-PRES-008 |
| `openspace.presentation.open` | REQ-PRES-009 |
| `openspace.presentation.navigate` | REQ-PRES-010 |
| `openspace.presentation.play` | REQ-PRES-011 |
| `openspace.presentation.pause` | REQ-PRES-012 |
| `openspace.presentation.stop` | REQ-PRES-013 |

See §6.6 for full argument schemas.

### 5.3 Whiteboard Modality

**Location:** `openspace-whiteboard/`

#### 5.3.1 Whiteboard Widget

A custom `ReactWidget` embedding [tldraw](https://tldraw.dev/):

```typescript
@injectable()
export class WhiteboardWidget extends ReactWidget {
  static readonly ID_PREFIX = 'openspace:whiteboard:';

  protected render(): React.ReactNode {
    return <TldrawCanvas
      store={this.store}
      onMount={this.handleEditorMount}
      shapes={this.customShapes}
    />;
  }
}
```

#### 5.3.2 Whiteboard Open Handler

Registers `.whiteboard.json` files:

```typescript
@injectable()
export class WhiteboardOpenHandler extends WidgetOpenHandler<WhiteboardWidget> {
  readonly id = 'openspace.whiteboard';

  canHandle(uri: URI): number {
    return uri.path.base.endsWith('.whiteboard.json') ? 200 : 0;
  }
}
```

#### 5.3.3 Custom Shape Types

For structured diagrams (REQ-WB-015 through REQ-WB-024):

| Diagram Type | Custom Shapes |
|---|---|
| Block diagram | Box, RoundedBox, Cylinder, Cloud, Actor |
| Class diagram | ClassBox (name/attrs/methods sections), InterfaceBox |
| State machine | State, InitialState, FinalState, TransitionArrow |
| Flowchart | Process, Decision, StartEnd, IO, Connector |
| Sequence diagram | Lifeline, ActivationBox, MessageArrow |

These are registered as custom tldraw shape utilities with their own rendering and connection logic.

#### 5.3.4 Whiteboard Commands (registered in CommandRegistry)

| Command ID | Maps to REQ |
|---|---|
| `openspace.whiteboard.list` | REQ-WB-005 |
| `openspace.whiteboard.read` | REQ-WB-006 |
| `openspace.whiteboard.create` | REQ-WB-007 |
| `openspace.whiteboard.add_shape` | REQ-WB-008 |
| `openspace.whiteboard.update_shape` | REQ-WB-009 |
| `openspace.whiteboard.delete_shape` | REQ-WB-010 |
| `openspace.whiteboard.open` | REQ-WB-011 |
| `openspace.whiteboard.camera.set` | REQ-WB-012 |
| `openspace.whiteboard.camera.fit` | REQ-WB-013 |
| `openspace.whiteboard.camera.get` | REQ-WB-014 |

See §6.6 for full argument schemas.

### 5.4 Terminal Modality (Agent-Exposed)

**Location:** Terminal functionality is provided by `@theia/terminal` out of the box. Our additions enable full agent exposure.

#### 5.4.1 Agent-Terminal Integration

Theia's `TerminalService` and `TerminalWidget` provide:
- `sendText(text)` — programmatic command execution
- `processId` — process tracking
- xterm.js-based rendering with PTY backend

**What we add on top:**

1. **Terminal output capture** — hook into xterm.js `onData` callback to buffer terminal output into a ring buffer (configurable size, default 10,000 lines). This makes terminal output available to the agent via `openspace.terminal.read_output`.

2. **Terminal history** — maintain a per-terminal log of commands sent and output received. The agent can see what the user typed and what the terminal displayed.

3. **Shared terminal collaboration** — both agent and user can `sendText()` to the same terminal. Since both go through the same `TerminalWidget` API, this is naturally collaborative. The output capture ensures the agent sees what the user sees.

#### 5.4.2 Terminal Commands (registered in CommandRegistry)

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.terminal.create` | `{ title?, cwd?, shellPath? }` | `{ terminalId }` |
| `openspace.terminal.send` | `{ terminalId, text }` | `{ success }` |
| `openspace.terminal.read_output` | `{ terminalId, lines?, since? }` | `{ output: string }` |
| `openspace.terminal.list` | `{}` | `{ terminals[] }` |
| `openspace.terminal.close` | `{ terminalId }` | `{ success }` |

See §6.6 for full argument schemas.

### 5.5 Modality Extensibility

The architecture is designed for new modalities to be added as independent Theia extensions. Adding a new modality follows this pattern:

1. **Create extension** — `openspace-[modality]/` with its own `package.json` and DI module
2. **Implement widget** — a `ReactWidget` (or `BaseWidget`) that renders the modality surface
3. **Register commands** — `CommandContribution` that registers `openspace.[modality].*` commands in the CommandRegistry
4. **Auto-discovery** — the BridgeContribution detects the new `openspace.*` commands, publishes updated manifest to Hub, system prompt regenerates — agent learns about the new modality on next session

**No changes to core code required.** The new extension is a standalone npm package added to the workspace.

**Future modality examples:** diff reviewer, comments/annotations, voice I/O, browser preview, diagram editor, kanban board, documentation viewer.

---

## 6. Agent Control System (CommandRegistry + Stream Interceptor)

### 6.1 Architecture Overview

**Previous approach (SUPERSEDED):** MCP ToolProvider — agent calls tools via MCP protocol, tools execute UI actions.

**Current approach:** CommandRegistry + `%%OS{...}%%` stream interceptor via RPC. This is more native, more elegant, and keeps opencode completely unmodified.

The agent controls the IDE through the same mechanism as the user — Theia's `CommandRegistry`. There are no special "agent tools" or MCP indirection layers. Instead:

1. Every OpenSpace action is registered as a **real Theia command** (e.g., `openspace.pane.open`, `openspace.editor.scroll`, `openspace.whiteboard.add_shape`)
2. The agent emits **`%%OS{...}%%` blocks** inline in its response stream
3. The **stream interceptor** (integrated in OpenCodeProxy) strips these blocks from visible output and dispatches extracted commands to the frontend via `OpenCodeClient.onAgentCommand()` **RPC callback**
4. The **SyncService** receives the callback and dispatches to the **CommandRegistry** — same path as user keybindings

```
Agent response stream:
  "Here's the architecture diagram %%OS{"cmd":"openspace.pane.open","args":{"type":"whiteboard","contentId":"arch.wb.json"}}%% I've opened the whiteboard for you."

User sees:
  "Here's the architecture diagram I've opened the whiteboard for you."

What happened behind the scenes:
  OpenCodeProxy (stream interceptor) → RPC onAgentCommand() → SyncService → CommandRegistry → PaneService.openContent()
```

> **Note (Architecture B1 simplification):** Earlier designs routed commands through a Hub SSE relay: interceptor → POST /commands → Hub → SSE → BridgeContribution → CommandRegistry. This added three unnecessary hops. Since the backend already has a direct RPC channel to the frontend (`OpenCodeClient`), we use that channel for agent commands too.

### 6.2 Component: Theia Command Registration

All OpenSpace actions are registered as standard Theia commands in the respective extension modules. This means they are also available via keybindings, menus, and the command palette.

**Pattern — each extension registers its commands:**

```typescript
// In openspace-core/src/browser/openspace-core-frontend-module.ts
@injectable()
export class OpenSpacePaneCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand({ id: 'openspace.pane.open', label: 'OpenSpace: Open Pane' }, {
      execute: (args: PaneOpenArgs) => this.paneService.openContent(args)
    });
    registry.registerCommand({ id: 'openspace.pane.close', label: 'OpenSpace: Close Pane' }, {
      execute: (args: PaneCloseArgs) => this.paneService.closeContent(args)
    });
    registry.registerCommand({ id: 'openspace.pane.focus', label: 'OpenSpace: Focus Pane' }, {
      execute: (args: PaneFocusArgs) => this.paneService.focusContent(args)
    });
    registry.registerCommand({ id: 'openspace.pane.list', label: 'OpenSpace: List Panes' }, {
      execute: () => this.paneService.listPanes()
    });
    registry.registerCommand({ id: 'openspace.pane.resize', label: 'OpenSpace: Resize Pane' }, {
      execute: (args: PaneResizeArgs) => this.paneService.resizePane(args)
    });
  }
}

// In openspace-presentation/src/browser/openspace-presentation-frontend-module.ts
@injectable()
export class OpenSpacePresentationCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand({ id: 'openspace.presentation.open' }, {
      execute: (args) => this.presentationService.openDeck(args)
    });
    registry.registerCommand({ id: 'openspace.presentation.navigate' }, {
      execute: (args) => this.presentationService.navigateToSlide(args)
    });
    // ... etc
  }
}
```

### 6.3 Component: OpenSpaceBridgeContribution (Simplified in B1)

A `FrontendApplicationContribution` that publishes the command manifest and pane state to the Hub. In Architecture B1, the BridgeContribution **no longer listens for SSE events** — agent command dispatch is handled by SyncService via RPC callbacks.

```typescript
@injectable()
export class OpenSpaceBridgeContribution implements FrontendApplicationContribution {
  @inject(CommandRegistry) private commandRegistry: CommandRegistry;
  @inject(PaneService) private paneService: PaneService;

  async onStart(app: FrontendApplication): Promise<void> {
    // 1. Build and publish command manifest to Hub
    const manifest = this.buildCommandManifest();
    await fetch('/openspace/manifest', {
      method: 'POST',
      body: JSON.stringify(manifest)
    });

    // 2. Publish pane state changes to Hub (for system prompt generation)
    this.paneService.onPaneLayoutChanged(layout => {
      fetch('/openspace/state', {
        method: 'POST',
        body: JSON.stringify(layout)
      });
    });

    // NOTE: No SSE connection to Hub. Agent commands arrive via
    // OpenCodeClient.onAgentCommand() RPC callback → SyncService.
  }

  private buildCommandManifest(): CommandManifest {
    return this.commandRegistry.commands
      .filter(cmd => cmd.id.startsWith('openspace.'))
      .map(cmd => ({
        id: cmd.id,
        label: cmd.label,
        category: cmd.category,
        args: this.getCommandArgSchema(cmd.id)
      }));
  }
}
```

### 6.4 Component: OpenSpace Hub (Simplified in B1)

A lightweight HTTP server co-located with the Theia backend (as a `BackendApplicationContribution`). In Architecture B1, the Hub is a **read/write cache** — it stores the command manifest and pane state, and serves the system prompt. It does NOT relay commands or maintain SSE connections.

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/openspace/manifest` | Receives command manifest from BridgeContribution |
| `POST` | `/openspace/state` | Receives pane/editor state updates from BridgeContribution |
| `GET` | `/openspace/instructions` | Returns system prompt generated from manifest + live pane state (consumed by opencode via `instructions` URL) |

> **Removed in B1:** `POST /commands` (agent commands now go via RPC), `GET /events` (no SSE relay needed).

**System prompt generation (`GET /openspace/instructions`):**

The Hub dynamically builds the system prompt from two sources:
1. **Command manifest** — the list of available OpenSpace commands with their argument schemas
2. **Live pane state** — current layout, open tabs, active content

Example generated prompt fragment:
```
You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting
%%OS{...}%% blocks in your response. These are invisible to the user.

Available commands:
- openspace.pane.open: { type: "editor"|"presentation"|"whiteboard"|"terminal", contentId: string, splitDirection?: "horizontal"|"vertical" }
- openspace.editor.scroll: { path: string, line: number }
- openspace.editor.highlight: { path: string, ranges: [{startLine, endLine}], highlightId?: string }
- openspace.presentation.navigate: { deckPath: string, slideIndex: number }
- openspace.whiteboard.add_shape: { whiteboardId: string, shape: {...} }
...

Current IDE state:
- Main area: [editor: src/index.ts (active), editor: README.md]
- Right panel: [chat (active)]
- Bottom panel: [terminal-1]
```

### 6.5 Component: Stream Interceptor (Integrated in OpenCodeProxy)

The stream interceptor is **integrated into OpenCodeProxy** rather than being a separate component. It scans the agent's streaming response for `%%OS{...}%%` patterns as message events arrive from the opencode server's SSE stream. Matched blocks are stripped from the text forwarded to the frontend and dispatched as agent commands via the `OpenCodeClient.onAgentCommand()` RPC callback.

**Implementation approach:** The interceptor is a method in `OpenCodeProxy` that processes message event data before calling `client.onMessageEvent()`. This is the natural integration point since OpenCodeProxy already receives and forwards all SSE events.

```typescript
// In OpenCodeProxy
protected forwardMessageEvent(eventType: string, rawData: MessageEvent): void {
  // ... existing logic ...

  // Stream interceptor: strip %%OS{...}%% blocks before forwarding
  if (rawData.data?.parts) {
    const { cleanParts, commands } = this.interceptStream(rawData.data.parts);
    rawData = { ...rawData, data: { ...rawData.data, parts: cleanParts } };

    // Dispatch extracted commands via RPC callback
    for (const command of commands) {
      this._client?.onAgentCommand(command);
    }
  }

  this._client?.onMessageEvent(notification);
}
```

**`%%OS{...}%%` block format:**

```json
%%OS{"cmd":"openspace.pane.open","args":{"type":"whiteboard","contentId":"arch.wb.json"}}%%
```

- `cmd`: The Theia command ID (must match a registered `openspace.*` command)
- `args`: The command arguments (validated against the manifest schema)

**Multiple commands** can appear in a single response:
```
Let me show you the architecture. %%OS{"cmd":"openspace.pane.open","args":{"type":"presentation","contentId":"arch.deck.md"}}%%

Here's slide 3 with the data flow: %%OS{"cmd":"openspace.presentation.navigate","args":{"deckPath":"arch.deck.md","slideIndex":2}}%%
```

#### 6.5.1 Stream Interceptor Robustness (CRITICAL)

The stream interceptor is the highest-risk component. LLMs can produce malformed output, and SSE chunks can split `%%OS{...}%%` blocks at arbitrary byte boundaries.

**Stateful streaming parser requirements:**

1. **Chunk boundary handling:** The parser maintains a state machine across SSE chunks. States: `PASSTHROUGH`, `MAYBE_DELIM` (seen `%`), `IN_DELIM` (seen `%%O`), `IN_BLOCK` (past `%%OS{`), `MAYBE_CLOSE` (seen `}%`). A partial delimiter at the end of a chunk is buffered and re-evaluated when the next chunk arrives.

2. **JSON validation:** Extracted JSON is validated with `JSON.parse()` in a try-catch. Malformed JSON produces a parse error log, not a crash. The malformed block text is **discarded** (not shown to user).

3. **Nested braces:** The parser tracks brace depth to handle JSON strings containing `}` characters. It only considers the block closed when brace depth returns to 0 AND `%%` follows.

4. **Timeout guard:** If a `%%OS{` opening is detected but no closing `}%%` arrives within 5 seconds (configurable), the parser assumes a malformed block, logs a warning, discards the buffer, and returns to `PASSTHROUGH` state. This prevents a runaway buffer from a missing close delimiter.

5. **Error recovery:** After any parse failure, the interceptor resets to `PASSTHROUGH` and continues processing. One bad block does not corrupt subsequent blocks or visible text.

6. **Logging:** All interceptor activity is logged at DEBUG level:
   - `[Interceptor] Block extracted: {cmd}` (on success)
   - `[Interceptor] WARN: Malformed JSON in block: {error}` (on parse failure)
   - `[Interceptor] WARN: Block timeout after {ms}ms, discarding buffer` (on timeout)
   - `[Interceptor] Block dispatched to Hub: {cmd} → {status}` (on POST result)

**Test matrix for interceptor (minimum):**

| Test Case | Input | Expected |
|---|---|---|
| Clean single block | `text %%OS{"cmd":"x","args":{}}%% more text` | User sees `text  more text`, command dispatched |
| Block split across 2 chunks | Chunk 1: `text %%OS{"cmd":"x","a` / Chunk 2: `rgs":{}}%% more` | Same as above |
| Block split at delimiter | Chunk 1: `text %` / Chunk 2: `%OS{"cmd":"x","args":{}}%% more` | Same as above |
| Malformed JSON | `%%OS{not json}%%` | Discarded, warning logged, text continues |
| Unclosed block | `%%OS{"cmd":"x"` + no close for 5s | Timeout, buffer discarded, passthrough resumes |
| Nested braces in JSON | `%%OS{"cmd":"x","args":{"data":"{}"}}%%` | Correctly parsed despite `}` in string |
| Multiple blocks | `a %%OS{...}%% b %%OS{...}%% c` | Both commands dispatched, user sees `a  b  c` |
| No blocks | `plain response text` | Passed through unchanged, zero overhead |
| False positive `%%` | `100%% increase` | Passed through unchanged (no `OS{` after `%%`) |

### 6.6 Command Result Feedback

**Problem:** The `%%OS{...}%%` stream interceptor is a one-way channel. When a command fails (file not found, invalid pane ID, etc.), the agent has no way to learn about the failure during the current response. This creates silent failures that degrade the user experience.

**Solution:** The Hub maintains a per-session **command result log**. Results are included in the next system prompt via `GET /openspace/instructions`.

**Flow (Architecture B1):**

```
Agent emits %%OS{...}%%
    → OpenCodeProxy (stream interceptor) → RPC onAgentCommand()
    → SyncService → CommandRegistry.executeCommand()
                           │
                           ▼
                  Result: { success: true } or { success: false, error: "..." }
                           │
                           ▼
                  SyncService POSTs result to Hub /openspace/command-results
                           │
                           ▼
                  Hub appends to session command log (ring buffer, last 20 results)
                           │
                           ▼
                  Next GET /openspace/instructions includes:
                  "Recent command results:
                   - openspace.editor.open {path: "x.ts"} → SUCCESS
                   - openspace.pane.resize {paneId: "p1"} → FAILED: pane not found"
```

**Hub endpoint for results:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/openspace/command-results` | Receives command execution results from SyncService |

**Command result schema:**

```typescript
export interface CommandResult {
  cmd: string;
  args: unknown;
  success: boolean;
  error?: string;
  timestamp: string;
}
```

**System prompt inclusion:** The last N command results (default 20) are appended to the `GET /openspace/instructions` response under a "Recent command results" section. This gives the agent feedback on whether its commands succeeded without modifying the opencode server.

### 6.7 Agent Command Queue & Throttling

**Problem:** The agent can emit many `%%OS{...}%%` commands in rapid succession. Dispatching them all simultaneously to the CommandRegistry can cause race conditions (e.g., opening a file and scrolling to a line before the editor is ready) or overwhelm the ApplicationShell layout engine.

**Solution:** The SyncService maintains a **sequential command queue** with configurable inter-command delay.

**Behavior:**

1. When an `onAgentCommand()` RPC callback arrives, the command is added to a FIFO queue.
2. Commands are dispatched one at a time. The next command is dispatched only after the previous command's Promise resolves (or rejects).
3. A configurable **minimum inter-command delay** (default: 50ms) ensures the UI has time to settle between layout mutations.
4. If the queue exceeds a **max depth** (default: 50), new commands are rejected with a warning log. This prevents runaway command floods.
5. Commands tagged with `"priority": "immediate"` in their args bypass the queue and execute immediately. Reserved for time-sensitive operations like `editor.clear_highlight`.

**Queue interface:**

```typescript
interface CommandQueue {
  enqueue(cmd: string, args: unknown): Promise<CommandResult>;
  readonly depth: number;
  readonly isProcessing: boolean;
  clear(): void;
}
```

### 6.6 Complete Command Inventory

All commands use the `openspace.*` prefix and are registered in the Theia CommandRegistry.

#### Pane Commands

| Command ID | Arguments | Returns | REQ |
|---|---|---|---|
| `openspace.pane.open` | `{ type, contentId, title?, targetPaneId?, newPane?, splitDirection? }` | `{ paneId }` | REQ-PANE-001 |
| `openspace.pane.close` | `{ paneId?, contentId? }` | `{ success }` | REQ-PANE-002 |
| `openspace.pane.focus` | `{ paneId?, contentId? }` | `{ success }` | REQ-PANE-003 |
| `openspace.pane.list` | `{}` | `{ panes: PaneInfo[] }` | REQ-PANE-005 |
| `openspace.pane.resize` | `{ paneId, width?, height? }` | `{ success }` | REQ-PANE-008 |

#### Editor Commands

| Command ID | Arguments | Returns | REQ |
|---|---|---|---|
| `openspace.editor.open` | `{ path, line?, endLine?, column?, endColumn?, highlight?, mode?, newPane? }` | `{ success }` | REQ-EDT-006 |
| `openspace.editor.read_file` | `{ path, startLine?, endLine? }` | `{ content }` | REQ-EDT-008 |
| `openspace.editor.close` | `{ path }` | `{ success }` | REQ-EDT-009 |
| `openspace.editor.scroll_to` | `{ path, line, column? }` | `{ success }` | REQ-EDT-010 |
| `openspace.editor.highlight` | `{ path, ranges[], highlightId? }` | `{ highlightId }` | REQ-EDT-011 |
| `openspace.editor.clear_highlight` | `{ path, highlightId? }` | `{ success }` | REQ-EDT-012 |

#### Terminal Commands

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.terminal.create` | `{ title?, cwd?, shellPath? }` | `{ terminalId }` |
| `openspace.terminal.send` | `{ terminalId, text }` | `{ success }` |
| `openspace.terminal.list` | `{}` | `{ terminals[] }` |
| `openspace.terminal.close` | `{ terminalId }` | `{ success }` |

#### File Commands

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.file.read` | `{ path, startLine?, endLine? }` | `{ content }` |
| `openspace.file.write` | `{ path, content }` | `{ success }` |
| `openspace.file.list` | `{ path?, recursive? }` | `{ files[] }` |
| `openspace.file.search` | `{ query, path? }` | `{ matches[] }` |

#### Presentation Commands

| Command ID | Arguments | REQ |
|---|---|---|
| `openspace.presentation.list` | `{}` | REQ-PRES-005 |
| `openspace.presentation.read` | `{ deckPath }` | REQ-PRES-006 |
| `openspace.presentation.create` | `{ deckPath, title, slides[] }` | REQ-PRES-007 |
| `openspace.presentation.update_slide` | `{ deckPath, slideIndex, content }` | REQ-PRES-008 |
| `openspace.presentation.open` | `{ deckPath, slideIndex? }` | REQ-PRES-009 |
| `openspace.presentation.navigate` | `{ deckPath, slideIndex }` | REQ-PRES-010 |
| `openspace.presentation.play` | `{ deckPath }` | REQ-PRES-011 |
| `openspace.presentation.pause` | `{ deckPath }` | REQ-PRES-012 |
| `openspace.presentation.stop` | `{ deckPath }` | REQ-PRES-013 |

#### Whiteboard Commands

| Command ID | Arguments | REQ |
|---|---|---|
| `openspace.whiteboard.list` | `{}` | REQ-WB-005 |
| `openspace.whiteboard.read` | `{ whiteboardId }` | REQ-WB-006 |
| `openspace.whiteboard.create` | `{ whiteboardId, title }` | REQ-WB-007 |
| `openspace.whiteboard.add_shape` | `{ whiteboardId, shape }` | REQ-WB-008 |
| `openspace.whiteboard.update_shape` | `{ whiteboardId, shapeId, updates }` | REQ-WB-009 |
| `openspace.whiteboard.delete_shape` | `{ whiteboardId, shapeId }` | REQ-WB-010 |
| `openspace.whiteboard.open` | `{ whiteboardId }` | REQ-WB-011 |
| `openspace.whiteboard.camera.set` | `{ whiteboardId, x, y, zoom }` | REQ-WB-012 |
| `openspace.whiteboard.camera.fit` | `{ whiteboardId, shapeIds? }` | REQ-WB-013 |
| `openspace.whiteboard.camera.get` | `{ whiteboardId }` | REQ-WB-014 |

---

## 7. Feature Mapping: OpenCode Client → Theia Openspace

### 7.1 What Theia Provides Out of the Box

| OpenCode Feature | Theia Equivalent | Notes |
|---|---|---|
| File tree | `@theia/navigator` (FileNavigatorWidget) | Full tree with drag-drop, context menus |
| Code editor | `@theia/monaco` (MonacoEditor) | Full Monaco with LSP, completions, etc. |
| Terminal | `@theia/terminal` (TerminalWidget) | xterm.js with PTY |
| Command palette | `@theia/core` (QuickInputService) | Built-in Cmd+Shift+P |
| Keybindings | `@theia/core` (KeybindingRegistry) | Full customizable keybinds |
| Settings/preferences | `@theia/preferences` | JSON settings with GUI |
| Notifications | `@theia/messages` (MessageService) | Toast notifications |
| Tabs / panels | `@theia/core` (ApplicationShell) | Full panel management |
| Drag-drop tabs | Built into DockPanel | Lumino widget framework |
| Search in files | `@theia/search-in-workspace` | Workspace-wide search |
| Git integration | `@theia/git` | SCM provider |
| Themes | `@theia/core` theming | Dark/light themes |
| Menu bar | `@theia/core` (MenuContribution) | Fully customizable |
| Zoom | `@theia/core` zoom commands | Built-in |

### 7.2 What We Must Build

| OpenCode Feature | Extension | Priority |
|---|---|---|
| Chat / conversation UI | openspace-chat | P0 |
| Session management (create/delete/fork/revert) | openspace-core | P0 |
| OpenCode server connection + SSE sync | openspace-core | P0 |
| Multi-part prompt input | openspace-chat | P0 |
| Message timeline with streaming | openspace-chat | P0 |
| Agent pane control commands | openspace-core (CommandRegistry) | P0 |
| Agent editor commands (scroll, highlight) | openspace-core (CommandRegistry) | P0 |
| OpenSpace Hub (manifest, instructions, SSE) | openspace-core/node | P0 |
| Stream interceptor (%%OS{...}%% parsing) | openspace-core/node | P0 |
| BridgeContribution (frontend↔Hub) | openspace-core/browser | P0 |
| Presentation viewer | openspace-presentation | P1 |
| Whiteboard / canvas | openspace-whiteboard | P1 |
| Custom layout / branding | openspace-layout | P1 |
| Session sidebar (list, tree) | openspace-core | P1 |
| Agent terminal commands | openspace-core (CommandRegistry) | P1 |
| Settings panels (providers, models, agents) | openspace-settings | P2 |
| Session sharing | openspace-core | P2 |
| i18n (16 languages) | openspace-core | P3 |
| Auto-updater (Electron) | electron-app | P3 |

### 7.3 What We Intentionally Drop

| OpenCode Feature | Reason |
|---|---|
| SolidJS framework | Theia uses React (via ReactWidget) |
| Tauri desktop wrapper | Theia uses Electron |
| Custom file tree implementation | Theia's `@theia/navigator` is superior |
| Custom terminal implementation | Theia's `@theia/terminal` is superior |
| Custom command palette | Theia's built-in QuickInputService |
| Deep link protocol (opencode://) | Replaced by Theia's workspace URI handling |
| Platform provider abstraction | Theia handles platform differences |
| Loading screen | Theia has its own startup sequence |

---

## 8. Data Flow & State Synchronization

### 8.1 Session State Flow

```
User types message in Chat Widget
        │
        ▼
ChatWidget → SessionService.sendMessage(parts)
        │
        ▼
SessionService → OpenCodeService.sendMessage(projectId, sessionId, parts)
        │ (JSON-RPC)
        ▼
OpenCodeProxy → POST /project/{pid}/session/{sid}/message (to opencode server)
        │
        ▼
OpenCode Server processes message, streams response via SSE
        │
        ▼
OpenCodeProxy receives SSE events → calls client.onMessageEvent()
        │ (JSON-RPC callback)
        ▼
SyncService receives event → updates SessionService state
        │
        ▼
SessionService.onMessagesChanged fires → ChatWidget re-renders
```

### 8.2 Agent Command Flow (%%OS{...}%% Stream Interceptor Pattern)

When the agent wants to control the IDE (e.g., open a file at a specific line, show a presentation, draw on a whiteboard):

```
Agent generates response text with embedded %%OS{...}%% blocks
        │
        ▼
OpenCodeProxy receives message SSE event from opencode server
        │
        ▼
Stream interceptor (in OpenCodeProxy) scans message text
        │
        ├──→ Clean text → forwarded via client.onMessageEvent() → Chat Widget
        │
        └──→ %%OS{"cmd":"openspace.editor.open","args":{"path":"src/index.ts","line":42}}%%
             │
             ▼
        client.onAgentCommand({ cmd, args }) — RPC callback to frontend
             │
             ▼
        SyncService receives callback → dispatches to CommandRegistry
             │
             ▼
        commandRegistry.executeCommand("openspace.editor.open", { path: "src/index.ts", line: 42 })
             │
             ▼
        EditorManager.open(uri, { selection }) → Monaco editor opens, scrolls, highlights
```

**Key properties:**
- The agent goes through the exact same `CommandRegistry` path as a user pressing a keybinding or clicking a menu item. There is no separate "agent tool" layer.
- Agent commands travel over the same RPC channel as message events — no separate SSE relay.

### 8.2.1 Comparison: Old (MCP) vs Current (CommandRegistry + Stream Interceptor via RPC)

| Aspect | Old: MCP ToolProvider | Current: CommandRegistry + Stream Interceptor |
|---|---|---|
| Agent interface | MCP tool call protocol | `%%OS{...}%%` inline in response stream |
| Execution path | ToolProvider → custom handler | CommandRegistry.executeCommand() — same as user |
| Command transport | MCP protocol | RPC callback (onAgentCommand) — same channel as message events |
| Discovery | Manual tool registration | Automatic from command manifest |
| opencode changes | Needed MCP server setup | Zero — uses native `instructions` URL |
| Prompt engineering | Manual per tool | Auto-generated from live manifest |
| New capability | Register tool + update prompt | Register command → auto-appears in prompt |

### 8.3 File Synchronization

```
Theia's FileService.watch() ←→ File system
        │
        ▼
onDidFilesChange event → triggers refresh in:
  - File Navigator (auto)
  - Open editors (auto — Monaco handles this)
  - Presentation widget (if .deck.md changed → re-parse)
  - Whiteboard widget (if .whiteboard.json changed → re-render)
```

---

## 9. Non-Functional Requirements Mapping

| NFR | Implementation |
|---|---|
| NFR-001: Deterministic behavior | Patch-based mutations, versioned operations |
| NFR-002: No silent failures | All tools return structured `{ success, error? }` responses |
| NFR-003: Path safety | URI normalization via Theia's `URI` class; workspace-root constraint |
| NFR-004: Bounded memory | Monaco model lifecycle management; widget disposal on close |
| NFR-005: Test coverage | Unit tests per tool, integration tests per widget, e2e per workflow |
| NFR-006: Cross-modality determinism | Content IDs are path-based and stable |

---

## 10. Implementation Plan

### Phase 0: Scaffold (Week 1)

**Goal:** Buildable Theia application with monorepo structure.

| Task | Details |
|---|---|
| Scaffold monorepo | Yeoman generator, browser-app + electron-app targets |
| Add Theia AI packages | `@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui` |
| Create extension stubs | `openspace-core`, `openspace-chat` (empty DI modules) |
| Verify build | `yarn build:browser && yarn start:browser` succeeds |
| Strip unwanted features | FilterContribution to remove debug, SCM, notebook |
| CI pipeline | Build + type-check on every push |

**Exit criteria:** Running Theia with AI chat panel, stripped chrome, custom branding.

### Phase 1: Core Connection + Hub (Weeks 2–3)

**Goal:** Connect to opencode server, set up Hub (manifest cache + instructions endpoint), manage sessions, send/receive messages. Architecture B1 — agent commands travel via RPC, not Hub SSE relay.

| Task | Extension |
|---|---|
| Define RPC protocols | openspace-core/common |
| Implement OpenCodeProxy backend | openspace-core/node |
| Implement SSE event forwarding | openspace-core/node |
| Implement OpenSpace Hub (HTTP manifest cache + instructions) | openspace-core/node |
| Implement BridgeContribution (manifest publishing) | openspace-core/browser |
| Implement SessionService frontend | openspace-core/browser |
| Implement SyncService (event handling + agent command dispatch) | openspace-core/browser |
| Basic chat widget (send message, see response) | openspace-chat |
| Session create/delete/switch | openspace-core |
| Configure opencode.json instructions URL | Config |

**Exit criteria:** Can connect to opencode server, create session, send message, see streamed response. Hub serves `/openspace/instructions` with command manifest. Agent commands dispatched via RPC.

### Phase 2: Chat & Prompt System (Weeks 3–4)

**Goal:** Full chat experience matching opencode client.

| Task | Extension |
|---|---|
| Multi-part prompt input | openspace-chat |
| File/agent/@mention support | openspace-chat |
| Message timeline with streaming | openspace-chat |
| Response renderers (code, diff, file refs) | openspace-chat |
| Session sidebar (list, tree) | openspace-core |
| Session fork/revert/compact | openspace-core |
| Token usage display | openspace-chat |

**Exit criteria:** Chat experience is feature-complete relative to opencode client.

### Phase 3: Agent IDE Control (Weeks 4–5)

**Goal:** Agent can control the IDE via `%%OS{...}%%` stream interceptor — open files, scroll, highlight, manage panes.

| Task | Extension |
|---|---|
| PaneService implementation | openspace-core/browser |
| Register pane commands in CommandRegistry | openspace-core/browser |
| Register editor commands in CommandRegistry | openspace-core/browser |
| Register terminal commands in CommandRegistry | openspace-core/browser |
| Register file commands in CommandRegistry | openspace-core/browser |
| Stream interceptor (integrated in OpenCodeProxy — %%OS{...}%% parsing + RPC dispatch) | openspace-core/node |
| Command manifest auto-generation | openspace-core/browser |
| System prompt generation from manifest + state | openspace-core/node (Hub) |

**Exit criteria:** Agent can emit `%%OS{...}%%` blocks to open files at specific lines, highlight code ranges, split panes, create terminals — all via CommandRegistry. Agent commands dispatched via RPC callback, not SSE relay. New commands auto-appear in agent's instruction set.

### Phase 4: Modality Surfaces (Weeks 5–7)

**Goal:** Presentation viewer and whiteboard canvas.

| Task | Extension |
|---|---|
| Presentation widget (reveal.js) | openspace-presentation |
| .deck.md file handler | openspace-presentation |
| Presentation commands → CommandRegistry | openspace-presentation |
| Whiteboard widget (tldraw) | openspace-whiteboard |
| .whiteboard.json file handler | openspace-whiteboard |
| Whiteboard commands → CommandRegistry | openspace-whiteboard |
| Custom shape types | openspace-whiteboard |

**Exit criteria:** Agent can create presentations and whiteboards, navigate slides, draw diagrams — all via `%%OS{...}%%` commands that auto-appear in the manifest.

### Phase 5: Polish & Desktop (Weeks 7–8)

**Goal:** Production quality, Electron build, settings, theming.

| Task | Extension |
|---|---|
| Custom ApplicationShell / layout | openspace-layout |
| Settings panels (providers, models, agents) | openspace-settings |
| Custom theming / branding | openspace-layout |
| Electron build configuration | electron-app |
| Pane configuration persistence | openspace-core |
| Session sharing | openspace-core |
| E2E test suite | e2e/ |

**Exit criteria:** Shippable desktop application with all features working.

### Phase 6: Extended Features (Ongoing)

| Task | Priority |
|---|---|
| i18n (16 languages) | P3 |
| Comments system | P3 |
| Diff review modality | P3 |
| Voice input/output | P3 |
| Browser snapshot preview | P3 |
| Auto-updater | P3 |

---

## 11. Dependency Graph

```
Phase 0: Scaffold
    │
    ▼
Phase 1: Core Connection ──────────────────┐
    │                                      │
    ▼                                      │
Phase 2: Chat & Prompt                     │
    │                                      │
    ▼                                      ▼
Phase 3: Agent IDE Control ────────► Phase 4: Modality Surfaces
    │                                      │
    ▼                                      ▼
Phase 5: Polish & Desktop ◄───────────────┘
    │
    ▼
Phase 6: Extended Features
```

Phase 1 is the critical path. Everything depends on the opencode server connection.
Phase 3 and Phase 4 can partially overlap (agent tools for editor don't depend on presentation widget).

---

## 12. Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Base platform | Eclipse Theia **1.68.2** | Full IDE framework, Monaco, terminal, extensible. Version pinned in Phase 0. |
| Desktop wrapper | Electron (via Theia) | Theia's native Electron support (replaces Tauri) |
| UI framework | React (via ReactWidget) | Theia's standard widget rendering |
| State management | InversifyJS DI + Event emitters | Theia-native pattern (replaces SolidJS contexts) |
| Chat/AI framework | @theia/ai-* | Built-in agent, tool, prompt, renderer support |
| Agent IDE control | CommandRegistry + Hub + `%%OS{...}%%` stream interceptor | Native Theia command path, automatic discovery, zero opencode modification |
| Editor | Monaco (via @theia/monaco) | Already integrated in Theia |
| Presentation | reveal.js in ReactWidget | Proven slide framework, embeddable |
| Whiteboard | tldraw in ReactWidget | Proven canvas framework, React-native |
| Backend communication | JSON-RPC over WebSocket | Theia's native protocol |
| Hub ↔ Frontend | HTTP (one-way: Frontend → Hub only) | Hub receives manifest/state via POST from BridgeContribution; agent commands travel via RPC (not Hub) |
| OpenCode integration | REST + SSE proxy + `instructions` URL | Compatible with existing opencode server, zero modifications |
| Build system | Yarn workspaces + Theia CLI | Theia's standard build toolchain |
| Package manager | Yarn (required by Theia) | Theia requires Yarn |

---

## 13. Risk Assessment

| Risk | Impact | Probability | Mitigation | Section |
|---|---|---|---|---|
| Theia AI framework instability (still beta) | Breaking changes on upgrade | Medium | Pin to 1.68.2, narrow dependency surface (UI + agent registry only), fallback plan for chat UI (§15.2) | §15 |
| Agent fails to emit valid `%%OS{...}%%` blocks | Commands not executed, poor UX | Medium | Strong system prompt examples, JSON validation in interceptor, malformed blocks discarded with warning log, command result feedback loop (§6.6) | §6.5.1, §6.6 |
| Stream interceptor misparses response | Visible `%%OS{...}%%` blocks or lost commands | Medium | Stateful streaming parser with chunk boundary handling, timeout guard, brace-depth tracking, comprehensive test matrix (§6.5.1) | §6.5.1 |
| Agent command floods overwhelm UI | Race conditions, layout thrashing | Medium | Sequential command queue with inter-command delay, max queue depth, immediate-priority bypass (§6.7) | §6.7 |
| No agent feedback on command failure | Agent repeats failed commands, poor UX | High | Command result log in Hub, included in next system prompt (§6.6) | §6.6 |
| Missing permission handling | Agent blocked on permission requests with no UI | High | Permission events in RPC protocol, PermissionService with dialog UI, auto-accept rules (§14) | §14 |
| reveal.js + tldraw bundle size | Slow initial load | Low | Code splitting, lazy widget loading, spike tasks to validate bundle size before full integration | §10 Phase 4 |
| Monaco internal API changes | Editor commands break | Low | Use @theia/editor abstractions where possible | — |
| OpenCode server API changes | Sync breaks | Medium | Protocol defined in common/, version checks, integration tests against live server | — |
| Hub restart loses state | Manifest cache and pane state lost | Low | BridgeContribution re-publishes manifest on startup, Hub is co-located in Theia backend (same process lifecycle) | §6.4 |
| SSE connection drops (OpenCode→Backend) | Backend loses opencode server events | Medium | Auto-reconnect with exponential backoff in OpenCodeProxy, re-subscribe to events, log missed event window | §3.1.2 |
| FilterContribution class name matching breaks on Theia upgrade | Debug/SCM panels reappear | Medium | Verification test asserts expected class names exist, run before version upgrades (§15.3) | §15.3 |
| Complex DI wiring | Hard to debug | Medium | Thorough logging (all modules log on load), DI container debugging tools | — |
| Theia build times | Slow development cycle | Medium | `watch` mode, incremental compilation (`composite: true` in tsconfig) | — |

---

## 14. Permission Handling

### 14.1 Problem

The opencode server has a permission system — when the agent wants to execute potentially dangerous operations (file writes, terminal commands, etc.), it requests permission from the user. The existing opencode client handles this via `PermissionProvider` and a `/permission/:permissionID` API endpoint.

The TECHSPEC's `OpenCodeService` interface (§3.1.1) did not originally include permission handling. This is a P0 gap.

### 14.2 Solution

**Add permission events to the RPC protocol:**

```typescript
// In opencode-protocol.ts — additions to OpenCodeClient
export interface OpenCodeClient {
  // ... existing events ...
  onPermissionRequest(event: PermissionRequestEvent): void;
}

export interface PermissionRequestEvent {
  permissionId: string;
  sessionId: string;
  type: 'file_write' | 'terminal_exec' | 'tool_use' | string;
  description: string;
  metadata: Record<string, unknown>;
}

// In OpenCodeService — addition
export interface OpenCodeService extends RpcServer<OpenCodeClient> {
  // ... existing methods ...
  respondToPermission(projectId: string, sessionId: string, permissionId: string, allow: boolean): Promise<void>;
}
```

**Permission flow:**

```
OpenCode Server requests permission via SSE event
    → OpenCodeProxy receives event → calls client.onPermissionRequest()
    → SyncService forwards to PermissionService (new frontend service)
    → PermissionService shows dialog in chat widget or notification
    → User clicks Allow/Deny
    → PermissionService → OpenCodeService.respondToPermission()
    → OpenCodeProxy → POST /project/{pid}/session/{sid}/permission/{permId}
```

**Auto-accept rules:** The PermissionService supports configurable auto-accept rules (matching the opencode client's pattern). Rules are stored in Theia preferences and can be managed in the settings panel (Phase 5).

### 14.3 Implementation Phase

Permission handling is added in **Phase 1** (tasks 1.1 and 1.6) as part of the core RPC protocol and SessionService.

---

## 15. Theia AI Integration Strategy & Fallback

### 15.1 What We Use from Theia AI

The architecture depends on `@theia/ai-*` packages (version 1.68.2, confirmed in Phase 0). We use a **narrow surface** of Theia AI:

| Theia AI Component | What We Use | What We Bypass |
|---|---|---|
| `@theia/ai-chat` | `ChatAgent` interface for agent registration, `@agent` mention routing | LLM provider abstraction (we proxy to opencode instead), built-in chat session management |
| `@theia/ai-chat-ui` | Agent discoverability in Theia's AI config panel | Built-in chat view widget (we use custom ChatWidget), response rendering pipeline |
| `@theia/ai-core` | Agent registry, `LanguageModelRequirement` types | Direct LLM API calls, prompt template system |
| `@theia/ai-ide` | IDE-level AI integrations (code completion hooks) | Most features — used sparingly |

**Key insight (Architecture B1):** We register a `ChatAgent` for ecosystem integration (`@Openspace` mentions, AI config panel), but our primary chat experience is a custom `ChatWidget` backed by `SessionService`. The `ChatAgent.invoke()` delegates to `SessionService`, which proxies to the opencode server. This gives us full control over the UX while remaining discoverable in Theia's AI ecosystem.

### 15.2 Fallback Plan

If `@theia/ai-chat-ui` proves too rigid for our chat UX needs (e.g., cannot customize message layout, streaming display, or multi-part prompt input sufficiently), the fallback is:

1. **Replace the chat UI only.** Build a custom `ReactWidget` (`OpenSpaceChatWidget`) placed in the right panel.
2. **Keep the agent registry.** Continue binding `OpenspaceChatAgent` to `ChatAgent` for Theia AI's agent discovery/routing.
3. **Bypass `@theia/ai-chat-ui`.** Remove it from `browser-app/package.json` dependencies. Our custom widget communicates directly with `SessionService`.

This fallback requires ~2 additional days of work but does not change the overall architecture. The decision point is during **Phase 2** (task 2.2 — message timeline with streaming), when we'll know if Theia AI's chat rendering is flexible enough.

### 15.3 FilterContribution Stability

Phase 0's `OpenSpaceFilterContribution` uses constructor name matching to remove Debug and SCM contributions. This is brittle across Theia version upgrades.

**Mitigation:**
1. Add a **verification test** that asserts the expected contribution class names exist in the Theia version. If they're renamed, the test fails and alerts us.
2. When upgrading Theia versions, run the verification test first and update the filter patterns.
3. As a fallback, contributions can also be filtered by checking for specific known interface symbols rather than class names.

---

## 16. Open Questions

1. ~~**Theia version pinning:**~~ **RESOLVED (Phase 0).** Pinned to **Theia 1.68.2** across all packages. `@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui`, and `@theia/ai-ide` confirmed present and functional. Echo chat agent verified working against Theia AI's `ChatAgent` interface.
2. ~~**OpenCode server embedding:**~~ **RESOLVED.** External process only (not embedded).
3. ~~**Custom shell extent:**~~ **RESOLVED.** Stock Theia ApplicationShell with additive contributions (FilterContribution to remove unwanted features, widget contributions to place our panels). No custom shell subclass. Floating windows not supported by Theia in browser mode — we live without them.
4. ~~**VS Code extension compatibility:**~~ **RESOLVED.** Support whatever Theia supports natively at this stage.
5. ~~**Session storage:**~~ **RESOLVED.** Split: Theia StorageService for UI state (panel layout, sizes, active tabs), opencode server for session data (conversations, messages, files). No custom persistence layer.
6. ~~**Stream interceptor placement:**~~ **RESOLVED.** Backend middleware in the Theia backend process (BackendApplicationContribution). No separate service.
7. ~~**Hub deployment:**~~ **RESOLVED.** Co-located as BackendApplicationContribution in the Theia backend. Hub endpoints are Express routes added in the backend's `configure(app)` method.

---

*End of TECHSPEC-THEIA-OPENSPACE*
