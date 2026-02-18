---
id: TECHSPEC-THEIA-OPENSPACE
author: oracle_e3f7
status: DRAFT
date: 2026-02-16
updated: 2026-02-18
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
| **MCP as agent control surface** | Agent calls `openspace.*` MCP tools exposed by the Hub MCP server; opencode is configured to use the Hub as an MCP provider — opencode stays unmodified |
| **Compile-time extensions** | All custom code is Theia Extensions (not plugins) for full DI access |
| **Opencode unmodified** | The only hook into opencode is its native `instructions` URL support — no forks, patches, or code changes to opencode |
| **RPC as the single transport** | All backend→frontend communication uses Theia's JSON-RPC channel (OpenCodeClient callbacks). No separate SSE relay between internal components. |

---

## 2. System Architecture

### 2.1 High-Level Architecture (Architecture B1 + MCP)

> **Architecture decision:** Architecture B1 — "Hybrid" approach. We register an `OpenspaceChatAgent` in Theia's AI agent registry for ecosystem integration (@mentions, config panel), but use a custom `ChatWidget` + `SessionService` for full opencode feature support (fork/revert/compact, permissions, multi-part prompts). See §15 for rationale and alternatives considered.

> **Agent control decision (2026-02-18):** MCP (Model Context Protocol) is the sole agent→IDE command path. The `%%OS{...}%%` stream interceptor and `onAgentCommand()` RPC callback have been retired. The Hub now runs an MCP server; opencode is configured to use it as an MCP provider. See §6 for full specification.

The architecture has **four moving parts** and two config lines:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      Theia Openspace Application (Architecture B1 + MCP)         │
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
│  │  │   User keybinds, menus, AND agent MCP tool calls all execute here.   │  │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                             │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │
│  │  │              Frontend Services (DI Container)                        │  │  │
│  │  │                                                                      │  │  │
│  │  │  SessionService        — session/message state, talks to backend     │  │  │
│  │  │  SyncService           — RPC callbacks, updates UI state             │  │  │
│  │  │  OpenspaceChatAgent    — registered in Theia AI, delegates to        │  │  │
│  │  │                          SessionService (makes @Openspace work)      │  │  │
│  │  │  BridgeContribution    — publishes pane state to Hub; registers      │  │  │
│  │  │                          as CommandBridge receiver for MCP calls     │  │  │
│  │  │  PaneService           — programmatic pane control                   │  │  │
│  │  └──────────────────────────┬───────────────────────────────────────────┘  │  │
│  └─────────────────────────────┼──────────────────────────────────────────────┘  │
│                                │ JSON-RPC over WebSocket                         │
│  ┌─────────────────────────────┼──────────────────────────────────────────────┐  │
│  │                      Backend (Node.js)                                      │  │
│  │  ┌─────────────────────────┴───────────────────────────────────────────┐   │  │
│  │  │  ② OpenCodeProxy (HTTP client + SSE — no stream interceptor)        │   │  │
│  │  │   • HTTP calls to opencode server REST API                          │   │  │
│  │  │   • SSE connection to opencode server event stream                  │   │  │
│  │  │   • Forwards events to frontend via OpenCodeClient callbacks        │   │  │
│  │  │   • No %%OS{...}%% parsing — agent commands go via MCP              │   │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │  │
│  │  │  ③ OpenSpace Hub (HTTP + MCP server)                                │   │  │
│  │  │   • POST /openspace/state — receives pane state from Bridge         │   │  │
│  │  │   • GET /openspace/instructions — generates system prompt from      │   │  │
│  │  │     live pane state (consumed by opencode)                          │   │  │
│  │  │   • ALL /mcp — MCP server (McpServer via @modelcontextprotocol/sdk) │   │  │
│  │  │     exposes 21+ openspace.* tools; routes calls via CommandBridge   │   │  │
│  │  │     → Theia CommandRegistry                                         │   │  │
│  │  └─────────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────┬───────────────────────────────────────────────┘  │
│                               │ REST + SSE                  ▲ MCP tool calls     │
│  ┌────────────────────────────┴─────────────────────────────┼──────────────────┐ │
│  │                 OpenCode Server (External Process — UNMODIFIED)               │ │
│  │   Sessions │ Messages │ AI Execution │ MCP Servers │ Files                   │ │
│  │                                                                               │ │
│  │   ④ opencode.json:                                                            │ │
│  │      "instructions": ["http://localhost:3000/openspace/instructions"]         │ │
│  │      "mcp": { "openspace-hub": { "type": "http",                             │ │
│  │                                   "url": "http://localhost:3000/mcp" } }      │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1.1 The Four Moving Parts

| # | Component | Location | Role |
|---|---|---|---|
| ① | **Theia CommandRegistry** | Theia frontend (browser) | All OpenSpace actions (pane.open, editor.scroll, whiteboard.add_shape, etc.) are registered as real Theia commands. User keybindings, menus, and agent MCP tool calls all go through `commandService.executeCommand()` |
| ② | **OpenCodeProxy** | Theia backend (Node.js) | HTTP client to opencode server. Maintains SSE connection for event streaming. Forwards events to frontend via `OpenCodeClient` RPC callbacks. **No stream interceptor** — agent commands flow via MCP, not through the response stream |
| ③ | **OpenSpace Hub** | HTTP + MCP server, co-located with Theia backend | (a) Caches pane state from BridgeContribution, (b) generates system prompt via `GET /openspace/instructions`, (c) **runs MCP server** exposing 21+ `openspace.*` tools that route via `CommandBridge` → Theia `CommandRegistry` → frontend IDE actions |
| ④ | **opencode.json** | OpenCode config file | Two entries: `"instructions"` URL for system prompt injection, and `"mcp"` block registering the Hub as an MCP provider so the agent can call `openspace.*` tools |

### 2.1.2 Key Insight: Automatic Discovery via MCP

When a new modality is added (e.g., `openspace.voice.set_policy`):
1. Register the tool in the Hub's MCP server
2. The agent calls `tools/list` and discovers it automatically on its next session — **zero prompt engineering required**

This means adding a new agent capability is just: implement the tool handler in the Hub → the agent discovers it via MCP introspection.

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
│   │           ├── opencode-proxy.ts         # HTTP proxy to opencode server — no stream interceptor (MCP replaced it)
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
  // NOTE: onAgentCommand() has been removed — agent commands flow via MCP tools (§6), not via the SSE stream
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

> **Note (2026-02-18 — RETIRED):** Agent commands were previously dispatched via an `onAgentCommand()` RPC callback, extracted by a stream interceptor in OpenCodeProxy. This mechanism has been fully retired. Agent commands now flow exclusively via MCP tool calls (§6). The SSE event stream carries only `session.*`, `message.*`, `file.*`, and `permission.*` events.

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
- IDE control happens via MCP tool calls (§6) — the agent calls `openspace.*` tools on the Hub MCP server, which routes to `CommandRegistry`
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

## 6. Agent Control System (MCP Tool Protocol)

> **Architecture Decision (2026-02-18):** The `%%OS{...}%%` stream interceptor has been **retired** and replaced by MCP (Model Context Protocol) as the sole agent→IDE command path. The stream interceptor, `OpenCodeClient.onAgentCommand()` RPC callback, and the `SyncService` command queue have all been removed. MCP provides explicit typed tool calls with structured return values — the agent gets results before continuing reasoning — eliminating the need for out-of-band stream parsing.

### 6.1 Architecture Overview

The agent controls the IDE through **MCP tool calls**. Every OpenSpace action is exposed as an MCP tool on the Hub's MCP server. The agent discovers available tools via standard MCP protocol introspection and calls them explicitly. The Hub routes each tool call to the appropriate Theia `CommandRegistry` command via an internal request to the Theia backend's RPC layer.

```
Agent (opencode)
    │
    │  MCP tool call: openspace.pane.open({ type: "whiteboard", contentId: "arch.wb.json" })
    ▼
Hub MCP Server  (McpServer from @modelcontextprotocol/sdk, port :3100)
    │
    │  routes tool name → handler
    ▼
Tool Handler  (in hub/src/mcp/tools/*.ts)
    │
    │  calls CommandRegistry via Theia RPC bridge
    ▼
Theia Backend CommandRegistry
    │
    │  dispatches to frontend via existing Theia IPC
    ▼
PaneService / EditorService / TerminalService / ...
    │
    ▼
IDE Action executed; result returned up the call stack → MCP tool response → Agent
```

**Single canonical path — no alternatives:**
- Agent → MCP tool call → Hub MCP Server → CommandRegistry → IDE action
- All previous paths (`%%OS{...}%%`, `onAgentCommand()` RPC, SSE relay) are **removed**

**What MCP gives over stream interception:**
1. **Structured return values** — the agent receives success/error/data before continuing its response
2. **Type safety** — JSON Schema validation on every tool input
3. **Introspection** — agent calls `tools/list` to discover all available tools at runtime
4. **Standard protocol** — no custom parsing, no chunk-boundary state machines
5. **No stream pollution** — agent output is clean text; commands are side-channel calls

### 6.2 Component: Hub MCP Server

The Hub runs an MCP server using `@modelcontextprotocol/sdk` alongside its existing HTTP server. All `openspace.*` commands are registered as MCP tools.

**Configuration in `opencode.json`:**
```json
{
  "mcp": {
    "openspace-hub": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

**Server bootstrap (`hub/src/mcp/server.ts`):**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export class OpenSpaceMcpServer {
  private server: McpServer;

  constructor(private commandBridge: CommandBridge) {
    this.server = new McpServer({ name: 'openspace-hub', version: '1.0.0' });
    this.registerAllTools();
  }

  private registerAllTools(): void {
    registerPaneTools(this.server, this.commandBridge);
    registerEditorTools(this.server, this.commandBridge);
    registerTerminalTools(this.server, this.commandBridge);
    registerFileTools(this.server, this.commandBridge, this.artifactStore, this.patchEngine);
    registerPresentationTools(this.server, this.commandBridge);
    registerWhiteboardTools(this.server, this.commandBridge);
    registerModalityTools(this.server, this.commandBridge);
  }

  attachToExpress(app: Express): void {
    const transport = new StreamableHTTPServerTransport({ path: '/mcp' });
    app.use('/mcp', transport.handler());
    this.server.connect(transport);
  }
}
```

**CommandBridge** is the internal adapter that translates MCP tool handler calls into Theia `CommandRegistry.executeCommand()` calls via the existing Theia backend→frontend IPC channel.

```typescript
export interface CommandBridge {
  execute(commandId: string, args: unknown): Promise<CommandResult>;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### 6.3 Component: OpenSpaceBridgeContribution (State Publisher)

A `FrontendApplicationContribution` that publishes command manifest and pane state to the Hub, and registers as the `CommandBridge` receiver. It does **not** listen for agent commands (that role is gone — MCP handles it).

```typescript
@injectable()
export class OpenSpaceBridgeContribution implements FrontendApplicationContribution {
  @inject(CommandRegistry) private commandRegistry: CommandRegistry;
  @inject(PaneService) private paneService: PaneService;

  async onStart(app: FrontendApplication): Promise<void> {
    // 1. Register as command executor for Hub's CommandBridge
    await fetch('/openspace/register-bridge', { method: 'POST' });

    // 2. Publish pane state changes to Hub (for system prompt generation)
    this.paneService.onPaneLayoutChanged(layout => {
      fetch('/openspace/state', {
        method: 'POST',
        body: JSON.stringify(layout)
      });
    });
  }
}
```

### 6.4 Component: OpenSpace Hub (MCP Server + State Cache)

The Hub is a `BackendApplicationContribution` that runs both an HTTP server and an MCP server. It stores pane state, serves the system prompt via `GET /openspace/instructions`, and routes all `openspace.*` MCP tool calls to the frontend via the CommandBridge.

**HTTP Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/openspace/register-bridge` | Frontend registers itself as CommandBridge receiver |
| `POST` | `/openspace/state` | Receives pane/editor state updates from BridgeContribution |
| `GET` | `/openspace/instructions` | Returns system prompt (consumed by opencode via `instructions` URL) |
| `ALL` | `/mcp` | MCP protocol endpoint (handled by McpServer transport) |

> **Removed:** `POST /openspace/manifest` (no longer needed — tools are introspectable via MCP), `POST /openspace/command-results` (results come back synchronously via MCP return values), `GET /events` (no SSE relay).

**System prompt generation (`GET /openspace/instructions`):**

The Hub builds the system prompt from live pane state. It no longer needs to enumerate command schemas in the prompt — the agent discovers tools via MCP `tools/list`.

```
You are operating inside Theia OpenSpace IDE.
You have access to MCP tools prefixed with "openspace." to control the IDE.
Call tools/list to see all available tools and their schemas.

Current IDE state:
- Main area: [editor: src/index.ts (active), editor: README.md]
- Right panel: [chat (active)]
- Bottom panel: [terminal-1]
```

### 6.5 MCP Tool Catalog

All tools follow the naming convention `openspace.<modality>.<action>`. Schemas are enforced via JSON Schema in the MCP `inputSchema` field.

#### Pane Tools

| Tool Name | Input Schema | Returns | REQ |
|---|---|---|---|
| `openspace.pane.open` | `{ type, contentId, title?, targetPaneId?, newPane?, splitDirection? }` | `{ paneId }` | REQ-PANE-001 |
| `openspace.pane.close` | `{ paneId?, contentId? }` | `{ success }` | REQ-PANE-002 |
| `openspace.pane.focus` | `{ paneId?, contentId? }` | `{ success }` | REQ-PANE-003 |
| `openspace.pane.list` | `{}` | `{ panes: PaneInfo[] }` | REQ-PANE-005 |
| `openspace.pane.resize` | `{ paneId, width?, height? }` | `{ success }` | REQ-PANE-008 |

#### Editor Tools

| Tool Name | Input Schema | Returns | REQ |
|---|---|---|---|
| `openspace.editor.open` | `{ path, line?, endLine?, column?, endColumn?, highlight?, mode?, newPane? }` | `{ success }` | REQ-EDT-006 |
| `openspace.editor.read_file` | `{ path, startLine?, endLine? }` | `{ content: string }` | REQ-EDT-008 |
| `openspace.editor.close` | `{ path }` | `{ success }` | REQ-EDT-009 |
| `openspace.editor.scroll_to` | `{ path, line, column? }` | `{ success }` | REQ-EDT-010 |
| `openspace.editor.highlight` | `{ path, ranges[], highlightId? }` | `{ highlightId: string }` | REQ-EDT-011 |
| `openspace.editor.clear_highlight` | `{ path, highlightId? }` | `{ success }` | REQ-EDT-012 |

#### Terminal Tools

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.terminal.create` | `{ title?, cwd?, shellPath? }` | `{ terminalId: string }` |
| `openspace.terminal.send` | `{ terminalId, text }` | `{ success }` |
| `openspace.terminal.read_output` | `{ terminalId, lines? }` | `{ output: string[] }` |
| `openspace.terminal.list` | `{}` | `{ terminals: TerminalInfo[] }` |
| `openspace.terminal.close` | `{ terminalId }` | `{ success }` |

#### File Tools (backed by ArtifactStore — see §6.8)

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.file.read` | `{ path, startLine?, endLine? }` | `{ content: string, version: number }` |
| `openspace.file.write` | `{ path, content }` | `{ success, version: number }` |
| `openspace.file.patch` | `{ path, baseVersion, operations[] }` | `{ success, version: number }` — 409 on OCC conflict |
| `openspace.file.list` | `{ path?, recursive? }` | `{ files: FileInfo[] }` |
| `openspace.file.search` | `{ query, path? }` | `{ matches: SearchMatch[] }` |

#### Presentation Tools

| Tool Name | Input Schema | REQ |
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

#### Whiteboard Tools

| Tool Name | Input Schema | REQ |
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

#### Modality Tools

| Tool Name | Input Schema | Returns |
|---|---|---|
| `openspace.modality.list` | `{}` | `{ modalities: ModalityInfo[] }` |
| `openspace.modality.focus` | `{ modalityId }` | `{ success }` |

### 6.6 Component: Theia Command Registration

All OpenSpace actions are registered as standard Theia commands in the respective extension modules (unchanged from pre-MCP architecture). They remain available via keybindings, menus, and the command palette. The MCP tool handlers call these commands via the CommandBridge; end-users can also invoke them directly.

```typescript
@injectable()
export class OpenSpacePaneCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand({ id: 'openspace.pane.open', label: 'OpenSpace: Open Pane' }, {
      execute: (args: PaneOpenArgs) => this.paneService.openContent(args)
    });
    // ... all other pane / editor / terminal / file / presentation / whiteboard commands
  }
}
```

### 6.7 Agent Command Sequencing

With MCP, command ordering is explicit — the agent awaits each tool call's result before issuing the next. There is no client-side queue. If the agent needs to open a file and then scroll it, it does:

```
1. openspace.editor.open({ path: "src/index.ts" })  →  { success: true }
2. openspace.editor.scroll_to({ path: "src/index.ts", line: 42 })  →  { success: true }
```

Each step is synchronous from the agent's perspective. This eliminates the race conditions that required the old `CommandQueue` with inter-command delays.

**Error handling:** If a tool call returns `{ success: false, error: "pane not found" }`, the agent receives the error inline and can reason about recovery before taking the next action. No deferred result log is needed.

### 6.8 Component: PatchEngine (Phase T4)

The PatchEngine provides operation-based, version-aware file mutations with Optimistic Concurrency Control (OCC). It is the backing service for the `openspace.file.patch` MCP tool.

**Patch request format:**
```typescript
interface PatchRequest {
  path: string;
  baseVersion: number;          // version the agent read; must match current
  operations: PatchOperation[]; // ordered list of mutations
}

type PatchOperation =
  | { type: 'insert'; line: number; content: string }
  | { type: 'delete'; startLine: number; endLine: number }
  | { type: 'replace'; startLine: number; endLine: number; content: string }
  | { type: 'append'; content: string };
```

**OCC conflict detection:**
- If `baseVersion` does not match the file's current version → 409 Conflict response
- Agent must re-read the file (getting new version), recompute the patch, and retry

**Hub endpoint:**
```
POST /files/{path}/patch
Body: PatchRequest
Response 200: { success: true, version: number }
Response 409: { error: "conflict", currentVersion: number }
```

**Implementation location:** `hub/src/services/PatchEngine.ts`

### 6.9 Component: ArtifactStore (Phase T5)

The ArtifactStore provides atomic file writes, rolling snapshots, and an audit log. It is wired into the `openspace.file.write` and `openspace.file.patch` MCP tool handlers.

**Guarantees:**
- **Atomicity:** Per-file write queue (PQueue concurrency=1) prevents interleaved writes
- **Snapshots:** Rolling window of the last 20 versions per file (stored in `.openspace/snapshots/`)
- **Audit log:** NDJSON append-only log at `.openspace/audit.ndjson` — every write operation records `{ timestamp, path, version, agentId, tool }`
- **External change detection:** File watcher invalidates cached versions when files are modified outside the Hub

**ArtifactStore interface:**
```typescript
interface ArtifactStore {
  read(path: string): Promise<{ content: string; version: number }>;
  write(path: string, content: string, agentId?: string): Promise<{ version: number }>;
  patch(req: PatchRequest, agentId?: string): Promise<{ version: number }> | ConflictError;
  listSnapshots(path: string): Promise<Snapshot[]>;
  restoreSnapshot(path: string, version: number): Promise<void>;
}
```

**Implementation location:** `hub/src/services/ArtifactStore.ts`

### 6.10 End-to-End Agent Control Test (MCP)

**Purpose:** Verify the complete MCP agent control pipeline.

**Test Flow:**
```
Agent calls MCP tool (e.g., openspace.editor.open)
    │
    ▼
Hub McpServer (tool handler invoked)
    │
    ▼
CommandBridge.execute('openspace.editor.open', args)
    │
    ▼
Theia Backend → Frontend IPC → CommandRegistry
    │
    ▼
EditorService.openFile(path, line)
    │
    ▼
Result: { success: true } returned up call stack → MCP tool response → Agent
```

**Test Scenarios:**

| # | Scenario | Expected Result |
|---|----------|-----------------|
| T1 | `openspace.editor.open({ path: "src/index.ts", line: 42 })` | File opens at line 42; tool returns `{ success: true }` |
| T2 | `openspace.editor.highlight({ path: "src/index.ts", ranges: [{ startLine: 42, endLine: 50 }] })` | Lines highlighted; tool returns `{ highlightId: string }` |
| T3 | `openspace.terminal.create({ title: "test" })` → `openspace.terminal.send({ terminalId, text: "echo hello" })` | Terminal created; command executed; each tool returns success |
| T4 | `openspace.terminal.read_output({ terminalId, lines: 10 })` | Returns `{ output: ["hello"] }` |
| T5 | `openspace.pane.open({ type: "editor", contentId: "README.md" })` | Pane opens; returns `{ paneId }` |
| T6 | Sequential tool calls (open → scroll) | Both succeed; second waits for first result |
| T7 | `openspace.file.patch` with stale baseVersion | Returns `{ error: "conflict", currentVersion: N }` |
| T8 | `tools/list` introspection | All 21+ tools listed with correct schemas |

**Verification Checklist:**

- [ ] MCP server starts on Hub boot (port :3100 or configured port)
- [ ] `tools/list` returns all `openspace.*` tools
- [ ] Each tool call invokes the correct CommandRegistry command
- [ ] Tool results are returned synchronously to the agent
- [ ] ArtifactStore atomic writes pass (no interleaving)
- [ ] PatchEngine OCC conflict returns 409 as MCP error
- [ ] All 8 scenarios pass

**Test Implementation Location:** `hub/src/__tests__/mcp-agent-control-e2e.spec.ts`

**Running the Test:**
```bash
cd hub
yarn test:e2e mcp-agent-control
```

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
| OpenSpace Hub (MCP server, instructions, state) | openspace-core/node | P0 |
| BridgeContribution (frontend↔Hub state sync) | openspace-core/browser | P0 |
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

### 8.2 Agent Command Flow (MCP Tool Protocol)

> **Architecture Decision (2026-02-18):** This section has been rewritten to reflect the MCP-only path. The `%%OS{...}%%` stream interceptor diagram has been retired.

When the agent wants to control the IDE (e.g., open a file at a specific line, show a presentation, draw on a whiteboard):

```
Agent decides to open a file — calls MCP tool openspace.editor.open
        │
        ▼
opencode MCP client sends tools/call request to Hub MCP server (HTTP)
        │
        ▼
Hub McpServer receives tool call → looks up CommandBridge handler
        │
        ▼
CommandBridge calls Theia backend → JSON-RPC to frontend BridgeContribution
        │
        ▼
BridgeContribution calls commandRegistry.executeCommand(
        "openspace.editor.open", { path: "src/index.ts", line: 42 }
)
        │
        ▼
EditorManager.open(uri, { selection }) → Monaco editor opens, scrolls, highlights
        │
        ▼
Result { success: true } propagated back up MCP call stack → agent receives result
        │
        ▼
Agent continues reasoning with confirmed result (synchronous, no polling needed)
```

**Key properties:**
- The agent goes through the exact same `CommandRegistry` path as a user pressing a keybinding or clicking a menu item. There is no separate "agent tool" layer.
- MCP tool calls are inherently synchronous from the agent's perspective — the agent awaits the result before continuing. No client-side command queue is needed.
- Agent gets structured `{ success, error? }` results — can reason about failures before next action.
- SSE stream carries only `session.*`, `message.*`, `file.*`, `permission.*` events — no command parsing needed.

### 8.2.1 Architecture Decision Record: MCP vs Stream Interceptor

| Aspect | Retired: Stream Interceptor | Current: MCP Tool Protocol |
|---|---|---|
| Agent interface | `%%OS{...}%%` inline in response stream | Explicit `tools/call` MCP request |
| Execution path | Stream parser → onAgentCommand() RPC → CommandRegistry | McpServer → CommandBridge → CommandRegistry |
| Command transport | Stream-parsed, out-of-band RPC callback | Standard MCP protocol, synchronous |
| Agent gets result | No — fire-and-forget, no feedback | Yes — structured `{ success, error? }` return |
| Discovery | Auto-generated from command manifest | MCP `tools/list` introspection |
| opencode changes | Zero — uses native `instructions` URL | Zero — uses native `mcp` config block |
| Prompt engineering | Auto-generated from live manifest | Auto-discovered via `tools/list` |
| New capability | Register command → auto-appears in prompt | Register MCP tool → auto-discoverable |

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

**Goal:** Agent can control the IDE via MCP tool calls — open files, scroll, highlight, manage panes.

| Task | Extension |
|---|---|
| PaneService implementation | openspace-core/browser |
| Register pane commands in CommandRegistry | openspace-core/browser |
| Register editor commands in CommandRegistry | openspace-core/browser |
| Register terminal commands in CommandRegistry | openspace-core/browser |
| Register file commands in CommandRegistry | openspace-core/browser |
| Hub MCP server (expose openspace.* tools) | openspace-core/node |
| CommandBridge interface + BridgeContribution wiring | openspace-core/browser |
| System prompt generation from Hub instructions endpoint | openspace-core/node (Hub) |

**Exit criteria:** Agent can call `openspace.*` MCP tools to open files at specific lines, highlight code ranges, split panes, create terminals — all via CommandRegistry. MCP tools discoverable via `tools/list`. New commands auto-appear in agent's tool set.

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

**Exit criteria:** Agent can create presentations and whiteboards, navigate slides, draw diagrams — all via `openspace.*` MCP tool calls that route through CommandRegistry.

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
Phase 3: Agent IDE Control ────────► Phase 4: Modality Surfaces (🔶 DONE-NOT-VALIDATED)
    │                                      │
    ▼                                      │
Phase T3: MCP Agent Control System ◄───────┘ (validates Phase 4 integration)
    │
    ├──► Phase T4: PatchEngine
    │         │
    │         ▼
    └──► Phase T5: ArtifactStore
              │
              ▼
         Phase 5: Polish & Desktop

Phase T6: Voice (parallel — independent of T3/T4/T5)
```

Phase 1 is the critical path. Everything depends on the opencode server connection.
Phase T3 must come before T4 and T5 (MCP tool handlers call PatchEngine / ArtifactStore).
Phase T6 (Voice) is fully independent and can run in parallel with T3/T4/T5.
Phase 5 is blocked on T3 + T4 + T5 all completing.

---

## 12. Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Base platform | Eclipse Theia **1.68.2** | Full IDE framework, Monaco, terminal, extensible. Version pinned in Phase 0. |
| Desktop wrapper | Electron (via Theia) | Theia's native Electron support (replaces Tauri) |
| UI framework | React (via ReactWidget) | Theia's standard widget rendering |
| State management | InversifyJS DI + Event emitters | Theia-native pattern (replaces SolidJS contexts) |
| Chat/AI framework | @theia/ai-* | Built-in agent, tool, prompt, renderer support |
| Agent IDE control | MCP tools via Hub McpServer (`@modelcontextprotocol/sdk`) | Typed tool calls with structured return values; agent gets results before continuing; standard protocol introspection; no stream parsing; replaces retired `%%OS{...}%%` stream interceptor |
| Hub ↔ Frontend (commands) | CommandBridge interface (Hub → Theia RPC → CommandRegistry) | MCP tool handlers call CommandBridge; result returned synchronously up the MCP call stack |
| Editor | Monaco (via @theia/monaco) | Already integrated in Theia |
| Presentation | reveal.js in ReactWidget | Proven slide framework, embeddable |
| Whiteboard | tldraw in ReactWidget | Proven canvas framework, React-native |
| Backend communication | JSON-RPC over WebSocket | Theia's native protocol |
| Hub ↔ Frontend (state) | HTTP (one-way: Frontend → Hub for pane state) | Hub receives state via POST from BridgeContribution; no manifest POST needed (MCP tools are introspectable) |
| OpenCode integration | REST + SSE proxy + `instructions` URL | Compatible with existing opencode server, zero modifications |
| Build system | Yarn workspaces + Theia CLI | Theia's standard build toolchain |
| Package manager | Yarn (required by Theia) | Theia requires Yarn |

---

## 13. Risk Assessment

| Risk | Impact | Probability | Mitigation | Section |
|---|---|---|---|---|
| Theia AI framework instability (still beta) | Breaking changes on upgrade | Medium | Pin to 1.68.2, narrow dependency surface (UI + agent registry only), fallback plan for chat UI (§15.2) | §15 |
| Agent fails to call correct MCP tool | Commands not executed, poor UX | Low | Agent discovers tools via `tools/list`; JSON Schema validation on every call; structured error returned inline | §6.5 |
| MCP server unavailable | Agent cannot control IDE | Medium | Hub and Theia backend share process lifecycle; MCP server restarts with Hub; agent gets connection error immediately | §6.2 |
| Agent command floods overwhelm UI | Race conditions, layout thrashing | Low | Agent awaits each MCP tool call result before next call; sequential by design; no client-side queue needed | §6.7 |
| No agent feedback on command failure | Agent repeats failed commands, poor UX | Low (mitigated by MCP) | MCP tool call returns `{ success: false, error }` synchronously; agent reasons about failure before next action | §6.5 |
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

## 17. Phase 3 Security & UX Enhancements

> **Status:** ADDED 2026-02-17 based on multi-perspective audit
> **Purpose:** Technical implementation specifications for BLOCKING and RECOMMENDED security gaps integrated into Phase 3

This section provides detailed technical specifications for the security and UX enhancements required by Phase 3 (NFR-3.6, NFR-3.7, NFR-3.8).

### 17.1 GAP-1: Symlink Path Traversal Protection

**Problem:** File commands could follow symlinks pointing outside the workspace, allowing access to sensitive system files.

**Implementation Location:** `openspace-core/src/browser/file-commands.ts` (new file)

**Algorithm:**
```typescript
async function validatePath(workspaceRoot: URI, requestedPath: string): Promise<URI | null> {
  // 1. Resolve the path to absolute
  const absolutePath = path.resolve(workspaceRoot.path.fsPath(), requestedPath);
  
  // 2. Resolve any symlinks in the path
  const realPath = fs.realpathSync(absolutePath);
  
  // 3. Check if real path is within workspace
  if (!realPath.startsWith(workspaceRoot.path.fsPath())) {
    return null; // Reject: symlink points outside workspace
  }
  
  return new URI(realPath);
}
```

**Commands Affected:** `openspace.file.read`, `openspace.file.write`, `openspace.file.list`, `openspace.file.search`

**Test Cases:**
| Input | Expected |
|---|---|
| `../etc/passwd` | Reject (path traversal) |
| Symlink to `/etc/passwd` inside workspace | Reject (resolves outside) |
| `src/utils.ts` | Accept |
| Symlink to `src/utils.ts` inside workspace | Accept |

---

### 17.2 GAP-2: MCP Tool Call Authorization

> **Previous section retired (2026-02-18):** This section previously described a code-fence injection attack specific to the `%%OS{...}%%` stream interceptor. That mechanism has been retired. The MCP threat model is described below.

**Problem:** The Hub MCP server accepts tool calls from the opencode process (local HTTP). In a multi-tenant or compromised scenario, a malicious process could call `openspace.*` tools directly.

**Threat:** A prompt-injected payload in untrusted file content could cause the agent to call destructive MCP tools (e.g., `openspace.file.delete`, `openspace.terminal.execute`).

**Implementation Location:** `openspace-core/src/node/hub.ts` — MCP server request handler

**Mitigations:**

1. **Local-only binding:** Hub MCP server binds to `127.0.0.1` only — not externally accessible.
2. **Tool-level confirmation for destructive actions:** Tools with side effects (terminal execution, file deletion) require the agent to first confirm intent via a `openspace.confirm_action` tool call (see §17.3 GAP-8).
3. **Workspace-root constraint:** All file tools validate paths against workspace root (§17.1 GAP-1).
4. **No ambient auth token in tool calls:** Tools do not accept credentials or session tokens — they operate on the local workspace only.

**Test Cases:**

| Scenario | Expected |
|---|---|
| MCP tool call from external network interface | Connection refused (local-only binding) |
| File tool with `../etc/passwd` path | Rejected by path validation (§17.1) |
| Destructive tool without prior confirm | Returns `{ success: false, error: "requires confirmation" }` |
| Valid tool call from opencode process | Executes via CommandRegistry → returns result |

---

### 17.3 GAP-8: Dangerous Command Confirmation

**Problem:** Terminal commands like `rm -rf` could cause data loss without user awareness.

**Implementation Location:** `openspace-core/src/browser/terminal-confirmation.ts` (new file)

**Dangerous Pattern Detection:**
```typescript
const DANGEROUS_PATTERNS = [
  /^rm\s+-rf\s+/,           // rm -rf
  /^rm\s+-r\s+/,            // rm -r (recursive delete)
  /^sudo\s+/,               // sudo elevation
  /^chmod\s+777\s+/,        // chmod 777 (world writable)
  /^chmod\s+-R\s+777\s+/,  // chmod -R 777
  /^dd\s+if=/,              // dd with input file
  /^:\(\)\{:\|:&\}\;:*/,   // Fork bomb
  /^curl.*\|\s*sh/,         // Pipe to shell
  /^wget.*\|\s*sh/,         // Wget pipe to shell
];

function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command.trim()));
}
```

**User Flow:**
1. Agent sends `openspace.terminal.send` with dangerous command
2. SyncService detects dangerous pattern
3. Confirmation dialog appears: "Agent wants to run: [command] — Allow or Deny?"
4. User decision is cached for session (optional "remember" checkbox)
5. If denied, command returns `{ success: false, error: "User denied" }`

**Configuration:** Via Theia preferences (`openspace.security.confirmDangerousCommands`)

---

### 17.4 GAP-9: Sensitive File Denylist

**Problem:** Agent could read sensitive files like `.env`, `.git/`, SSH keys, credentials.

**Implementation Location:** `openspace-core/src/browser/file-commands.ts` — extend existing validation

**Denylist:**
```typescript
const SENSITIVE_PATTERNS = [
  /^\.env$/i,                    // .env
  /^\.env\.[a-zA-Z0-9]+$/i,     // .env.production, .env.local
  /^\.git\//i,                   // .git/anything
  /^.*\.git\//i,                // anything/.git/
  /^id_rsa$/i,                   // SSH private key
  /^id_dsa$/i,
  /^id_ecdsa$/i,
  /^id_ed25519$/i,
  /^.*\.pem$/i,                  // Any .pem file
  /^.*\.key$/i,                  // Any .key file
  /^credentials\.json$/i,        // credentials.json
  /^secrets\..+$/i,              // secrets.anything
  /^.*\/secrets\//i,             // anything/secrets/
  /^.*\.aws\/credentials$/i,     // AWS credentials
];

function isSensitive(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(normalized));
}
```

**Commands Affected:** `openspace.file.read`, `openspace.editor.read_file`

**Behavior:** Returns `{ success: false, error: "Access denied: sensitive file" }`

**Configuration:** Via Theia preferences (`openspace.security.sensitiveFilePatterns`) — user can add custom patterns

---

### 17.5 GAP-4: Resource Cleanup on Session End

**Problem:** Agent-created resources (terminals, highlights, panes) persist after session ends, causing resource leaks.

**Implementation Location:** `openspace-core/src/browser/session-resource-manager.ts` (new file)

**Resource Tracking:**
```typescript
interface TrackedResource {
  id: string;
  type: 'terminal' | 'highlight' | 'pane';
  createdAt: Date;
  pinned: boolean; // User can pin to prevent cleanup
}

class SessionResourceManager {
  private resources: Map<string, TrackedResource[]> = new Map();
  
  track(sessionId: string, resource: TrackedResource): void {
    const sessionResources = this.resources.get(sessionId) || [];
    sessionResources.push(resource);
    this.resources.set(sessionId, sessionResources);
  }
  
  async cleanup(sessionId: string): Promise<void> {
    const sessionResources = this.resources.get(sessionId) || [];
    for (const resource of sessionResources) {
      if (resource.pinned) continue; // Skip pinned resources
      
      switch (resource.type) {
        case 'terminal':
          await terminalService.close(resource.id);
          break;
        case 'highlight':
          await editorService.clearHighlight(resource.id);
          break;
        case 'pane':
          await paneService.close(resource.id);
          break;
      }
    }
    this.resources.delete(sessionId);
  }
}
```

**Triggers:**
1. Session disconnect (detected via OpenCodeClient RPC)
2. User clicks "End Session" in UI
3. Timeout (no activity for 30 minutes, configurable)

---

### 17.6 GAP-6: Per-Message Command Rate Limiting

**Problem:** Agent could flood commands in a single response, overwhelming the system.

**Implementation:** Extend existing command queue in `OpenCodeSyncService`

```typescript
// In OpenCodeSyncService
const MAX_COMMANDS_PER_MESSAGE = 10;

async handleAgentMessage(message: AgentMessage): Promise<void> {
  const commands = extractCommands(message);
  
  if (commands.length > MAX_COMMANDS_PER_MESSAGE) {
    this.logger.warn(
      `Agent message contains ${commands.length} commands, ` +
      `limiting to ${MAX_COMMANDS_PER_MESSAGE}`
    );
    commands.splice(MAX_COMMANDS_PER_MESSAGE); // Keep first N
  }
  
  // Queue remaining commands...
}
```

**Configuration:** Via Theia preferences (`openspace.agent.maxCommandsPerMessage`)

---

### 17.7 GAP-3: Configurable Failure Notifications

**Problem:** Silent command failures leave user unaware of issues.

**Implementation Location:** `openspace-core/src/browser/command-notification-service.ts` (new file)

**Severity Levels:**
```typescript
enum NotificationSeverity {
  ERROR = 'error',    // Always show toast
  WARNING = 'warning', // Show if user preference enabled
  INFO = 'info'       // Log only
}

interface CommandFailureNotification {
  commandId: string;
  args: unknown;
  error: string;
  severity: NotificationSeverity;
  timestamp: Date;
}

// Show toast based on severity and user preferences
async function notify(failure: CommandFailureNotification): Promise<void> {
  const userPreference = preferences.get('openspace.notifications.commandFailures');
  
  if (failure.severity === NotificationSeverity.ERROR) {
    messageService.error(`Command failed: ${failure.error}`);
  } else if (failure.severity === NotificationSeverity.WARNING && 
             userPreference !== 'disabled') {
    messageService.warn(`Command warning: ${failure.error}`);
  }
  // INFO severity: log only
}
```

**Configuration:** Via Theia preferences (`openspace.notifications.commandFailures`: 'all' | 'errors' | 'disabled')

---

### 17.8 GAP-5: First-Run Consent Dialog

**Problem:** User should explicitly consent to agent IDE control before first use.

**Implementation Location:** `openspace-core/src/browser/consent-manager.ts` (new file)

**Consent Check:**
```typescript
const CONSENT_KEY = 'openspace.agent.consentGiven';
const CONSENT_VERSION = '1.0'; // Bump to re-prompt on feature changes

async function checkConsent(): Promise<boolean> {
  const storage = storageService.get(CONSENT_KEY);
  const stored = storage ? JSON.parse(storage) : null;
  
  if (stored?.version === CONSENT_VERSION && stored?.granted) {
    return true;
  }
  return false;
}

async function showConsentDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = new ConfirmDialog({
      title: 'Agent IDE Control',
      msg: `The AI agent can now control your IDE:
• Open and edit files
• Create and manage terminals
• Arrange panes and layouts
• Run commands on your behalf

Commands are validated and sandboxed to your workspace.`,
      confirmButtonLabel: 'Allow',
      cancelButtonLabel: 'Cancel'
    });
    
    dialog.open().then(accepted => {
      const result = accepted || false;
      storageService.set(CONSENT_KEY, JSON.stringify({
        version: CONSENT_VERSION,
        granted: result,
        timestamp: new Date().toISOString()
      }));
      resolve(result);
    });
  });
}
```

**Trigger:** First time agent attempts to execute any `openspace.*` command in a session

**Persistence:** Stored in Theia StorageService (persists across sessions)

---

### 17.9 (NEW) Terminal Output Sanitization

**Problem:** Terminal output can contain ANSI escape sequences and control characters that could:
- Manipulate terminal display (cursor movement, color codes)
- Inject malicious commands
- Crash the rendering component

**Implementation Location:** `openspace-core/src/browser/terminal-output-sanitizer.ts` (new file)

**Sanitization Algorithm:**
```typescript
/**
 * Sanitize terminal output to prevent ANSI injection attacks.
 * Removes escape sequences and control characters while preserving
 * legitimate output (colors, basic formatting).
 */
export function sanitizeTerminalOutput(output: string): string {
  // Step 1: Remove ANSI escape sequences (colors, cursor movement, etc.)
  // Matches: \x1B[...letter (CSI sequences), \x1B]...BEL (OSC), etc.
  let sanitized = output
    // CSI sequences: ESC [ <params> <command>
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    // OSC sequences: ESC ] <params> <ST|BEL>
    .replace(/\x1B\][^\x07]*\x07/g, '')
    // ESC followed by single character (other escape sequences)
    .replace(/\x1B[A-Za-z]/g, '')
    // Remove remaining ESC bytes
    .replace(/\x1B/g, '');

  // Step 2: Remove control characters (except legitimate ones)
  // Keep: \n (newline), \r (carriage return), \t (tab)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Step 3: Limit line length to prevent buffer overflow
  const MAX_LINE_LENGTH = 10000;
  sanitized = sanitized
    .split('\n')
    .map(line => line.slice(0, MAX_LINE_LENGTH))
    .join('\n');

  return sanitized;
}

/**
 * Check if output contains suspicious patterns.
 */
export function containsSuspiciousPatterns(output: string): boolean {
  const suspicious = [
    /\x1B\[?.*h/gi,    // Hide cursor
    /\x1B\[?.*l/gi,    // Show cursor (toggle off)
    /\x1B\[?.*s/gi,    // Save cursor
    /\x1B\[?.*u/gi,    // Restore cursor
    /\x1B\[2J/gi,      // Clear screen
    /\x1B\[H/gi,       // Cursor home
  ];
  return suspicious.some(pattern => pattern.test(output));
}
```

**Usage in Terminal Commands:**
```typescript
// In terminal-command-contribution.ts or terminal-service
async function readOutput(terminalId: string, lines: number): Promise<string[]> {
  const rawOutput = this.ringBuffer.get(terminalId, lines);
  
  // Sanitize before returning to agent
  const sanitized = rawOutput.map(line => sanitizeTerminalOutput(line));
  
  // Log if suspicious patterns detected
  if (rawOutput.some(line => containsSuspiciousPatterns(line))) {
    this.logger.warn('Suspicious ANSI patterns detected in terminal output', { terminalId });
  }
  
  return sanitized;
}
```

**Test Cases:**
| Input | Expected Output |
|---|---|
| `\x1B[32mhello\x1B[0m` | `hello` (color codes removed) |
| `\x1B[2J` | `` (clear screen removed) |
| `hello\x00world` | `helloworld` (NULL removed) |
| `hello\nworld` | `hello\nworld` (newline preserved) |
| `hello\tworld` | `hello\tworld` (tab preserved) |
| Long line (>10K chars) | Truncated to 10K |

---

### 17.10 Summary: Implementation Checklist

| Gap | File | Key Method | Test Priority |
|---|---|---|---|
| GAP-1 | `file-commands.ts` | `validatePath()` | HIGH |
| GAP-2 | `opencode-proxy.ts` | `shouldExtractBlock()` | HIGH |
| GAP-3 | `command-notification-service.ts` | `notify()` | MEDIUM |
| GAP-4 | `session-resource-manager.ts` | `cleanup()` | HIGH |
| GAP-5 | `consent-manager.ts` | `showConsentDialog()` | HIGH |
| GAP-6 | `opencode-sync-service.ts` | `handleAgentMessage()` | MEDIUM |
| GAP-8 | `terminal-confirmation.ts` | `isDangerous()` | HIGH |
| GAP-9 | `file-commands.ts` | `isSensitive()` | HIGH |

---

*End of Section 17: Phase 3 Security & UX Enhancements*


---

*End of TECHSPEC-THEIA-OPENSPACE*
