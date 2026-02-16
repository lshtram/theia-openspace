# RFC-001: Eclipse Theia Architecture Research
## Building an AI-Native IDE on the Theia Platform

| Field | Value |
|---|---|
| **Status** | DRAFT |
| **Author** | Scout (scout_7e3a) |
| **Date** | 2026-02-16 |
| **Audience** | Oracle, Builder, Designer |
| **Sources** | Theia Docs, GitHub source, DZone deep-dive series, EclipseSource blogs |

---

## Executive Summary

Eclipse Theia is a highly modular, extensible IDE platform built with TypeScript. It runs in both browser and Electron (desktop) modes with a **frontend/backend split architecture** communicating over **WebSocket/JSON-RPC**. Its extension system uses **InversifyJS dependency injection** with contribution points — the same mechanism used internally, meaning custom extensions are first-class citizens with identical power to core modules.

**Critical finding for Theia Openspace**: Theia already ships **Theia AI** — a built-in framework for building AI-native tools with chat agents, tool functions (MCP-like), prompt management, custom response rendering, and change sets. This is directly aligned with our goals and should be our primary integration surface.

---

## 1. Extension System

### 1.1 Four Extension Mechanisms

Theia supports **four** complementary ways to extend:

| Mechanism | Install Time | API Access | Use Case |
|---|---|---|---|
| **Theia Extensions** | Compile-time (npm) | Full internal API via DI | Custom products, complex views, deep integration |
| **VS Code Extensions** | Runtime | VS Code API (restricted) | Adding features, language support, existing ecosystem |
| **Theia Plugins** | Runtime | VS Code API + Theia extras | Frontend manipulation (under review, not recommended) |
| **Headless Plugins** | Runtime | Custom backend APIs only | Backend-only extensibility, CLI |

**Recommendation for Theia Openspace**: Use **Theia Extensions** exclusively. We need full DI access for agent-controlled panel management, custom widgets, and deep platform integration. VS Code extensions can be consumed as add-ons but our core features must be Theia extensions.

### 1.2 InversifyJS Dependency Injection

The entire platform is wired via [InversifyJS](http://inversify.io/). This replaces Eclipse's plugin.xml/OSGi with a TypeScript-native approach.

**Core concepts:**

```typescript
// 1. CONSUMING a service (injection)
@injectable()
export class MyExtension {
  // Field injection
  @inject(MessageService)
  protected readonly messageService!: MessageService;

  // Constructor injection
  constructor(
    @inject(CommandRegistry) private readonly commands: CommandRegistry
  ) {}

  // Post-construct initialization
  @postConstruct()
  protected init(): void {
    // Called after constructor + field injection
  }
}

// 2. PROVIDING a service (binding in a ContainerModule)
export default new ContainerModule(bind => {
  bind(CommandContribution).to(MyCommandContribution);
  bind(MenuContribution).to(MyMenuContribution);
  bind(FrontendApplicationContribution).toService(MyViewContribution);
});
```

**Registration in package.json:**
```json
{
  "theiaExtensions": [
    { "frontend": "lib/browser/my-frontend-module" },
    { "backend": "lib/node/my-backend-module" }
  ]
}
```

### 1.3 Key Contribution Points

| Contribution Point | Interface | Purpose |
|---|---|---|
| `CommandContribution` | `registerCommands(registry)` | Add commands |
| `MenuContribution` | `registerMenus(registry)` | Add menu items |
| `KeybindingContribution` | `registerKeybindings(registry)` | Add keybindings |
| `FrontendApplicationContribution` | `configure()`, `onStart()`, `onStop()` | Frontend lifecycle hooks |
| `BackendApplicationContribution` | `initialize()`, `configure(app)`, `onStart()` | Backend lifecycle + Express endpoints |
| `WidgetFactory` | `{ id, createWidget() }` | Widget instantiation |
| `ConnectionHandler` | `{ path, onConnection() }` | Backend service registration (RPC) |
| `FilterContribution` | `registerContributionFilters()` | Remove/disable contributions |
| `LabelProviderContribution` | Icon/label resolution | Custom icons and labels |
| `PropertyDataService` | Property view data | Custom property views |

### 1.4 ContributionProvider Pattern

```typescript
// Defining a contribution point
bindContributionProvider(bind, ConnectionHandler);

// Consuming all contributions of a type
constructor(
  @inject(ContributionProvider) @named(ConnectionHandler)
  protected readonly handlers: ContributionProvider<ConnectionHandler>
) {}
```

### 1.5 Filtering Contributions (Removing Unwanted Features)

```typescript
@injectable()
export class RemoveFromUIFilterContribution implements FilterContribution {
  registerContributionFilters(registry: FilterContributionRegistry): void {
    // Remove debug, test, SCM, etc.
    registry.addFilters([DebugFrontendContribution, TestContribution]);
  }
}
```

**Relevance**: We can strip Theia to exactly the features we need, removing debug, SCM, notebook, etc.

---

## 2. Widget & Panel System

### 2.1 Architecture Overview

```
ApplicationShell (top-level Widget)
├── topPanel (MenuBar)
├── leftPanelHandler (SidePanelHandler) → SideBar + DockPanel
│   └── ViewContainers → Individual Widgets
├── mainPanel (TheiaDockPanel) → Editors, custom main-area widgets
├── rightPanelHandler (SidePanelHandler)
└── bottomPanel (TheiaDockPanel) → Terminal, Output, Problems
```

- **ApplicationShell** — the root layout manager
- **SidePanelHandler** — manages left/right sidebar (TabBar + DockPanel)
- **TheiaDockPanel** — tab-based container for widgets
- **ViewContainer** — groups multiple widgets in a sidebar section (accordion)
- **Widget** — base building block (from Phosphor.js/Lumino)

### 2.2 Widget Class Hierarchy

```
Widget (Phosphor/Lumino)
└── BaseWidget (Theia)
    ├── ReactWidget  → React-based rendering
    ├── TreeWidget   → Hierarchical tree UIs
    └── ...custom widgets
```

### 2.3 Creating Custom Widgets

**Three components required:**

**1. The Widget itself** (e.g., using React):
```typescript
@injectable()
export class ChatWidget extends ReactWidget {
  static readonly ID = 'openspace:chat';
  static readonly LABEL = 'Chat';

  @postConstruct()
  protected init(): void {
    this.id = ChatWidget.ID;
    this.title.label = ChatWidget.LABEL;
    this.title.caption = ChatWidget.LABEL;
    this.title.closable = true;
    this.title.iconClass = 'codicon codicon-comment-discussion';
    this.update();
  }

  protected render(): React.ReactNode {
    return <div id="chat-container">
      {/* Your React chat UI here */}
    </div>;
  }
}
```

**2. Widget Factory** (registers with WidgetManager):
```typescript
// In frontend module:
bind(ChatWidget).toSelf();
bind(WidgetFactory).toDynamicValue(ctx => ({
  id: ChatWidget.ID,
  createWidget: () => ctx.container.get<ChatWidget>(ChatWidget)
})).inSingletonScope();
```

**3. Widget Contribution** (wires to workbench):
```typescript
@injectable()
export class ChatViewContribution extends AbstractViewContribution<ChatWidget> {
  constructor() {
    super({
      widgetId: ChatWidget.ID,
      widgetName: ChatWidget.LABEL,
      defaultWidgetOptions: { area: 'right' },  // left, right, main, bottom
      toggleCommandId: 'openspace.chat.toggle'
    });
  }
}
```

### 2.4 Programmatic Panel Management (KEY for Agent Control)

The `ApplicationShell` provides full programmatic control:

```typescript
@inject(ApplicationShell)
protected readonly shell: ApplicationShell;

// Add widget to a specific area
await this.shell.addWidget(widget, {
  area: 'main' | 'left' | 'right' | 'bottom',  // Area type
  mode: 'tab-after' | 'tab-before' | 'split-right' | 'split-left' |
        'split-top' | 'split-bottom' | 'tab-replace',   // InsertMode
  ref: existingWidget,  // Reference widget for relative positioning
  rank: 100             // Ordering rank
});

// Activate (focus) a widget
await this.shell.activateWidget('widget-id');

// Reveal without focus
await this.shell.revealWidget('widget-id');

// Close a widget
widget.close();
widget.dispose();

// Get widgets
this.shell.mainPanel;       // TheiaDockPanel
this.shell.bottomPanel;     // TheiaDockPanel
this.shell.leftPanelHandler;  // SidePanelHandler
this.shell.rightPanelHandler; // SidePanelHandler

// Event hooks
this.shell.onDidAddWidget(widget => { ... });
this.shell.onDidRemoveWidget(widget => { ... });
this.shell.onDidChangeActiveWidget(args => { ... });
this.shell.onDidChangeCurrentWidget(args => { ... });
```

**WidgetOptions interface:**
```typescript
interface WidgetOptions {
  area?: 'main' | 'left' | 'right' | 'bottom' | 'top';
  mode?: 'tab-after' | 'tab-before' | 'split-right' | 'split-left' |
         'split-top' | 'split-bottom' | 'tab-replace';
  ref?: Widget;    // Reference widget
  rank?: number;   // Ordering
}
```

### 2.5 Custom Shell Layout

You can completely replace the `ApplicationShell`:

```typescript
// Rebind to custom shell
rebind(ApplicationShell).to(CustomApplicationShell);

// Override createLayout for custom panel arrangement
export class CustomApplicationShell extends ApplicationShell {
  protected override createLayout(): Layout {
    // Fully custom layout
  }
}
```

### 2.6 ViewContainers (Sidebar Sections)

ViewContainers group widgets in sidebar accordion-style:

```typescript
// navigator-widget-factory.ts pattern
export function createNavigatorWidgetFactory(container: Container): WidgetFactory {
  return {
    id: EXPLORER_VIEW_CONTAINER_ID,
    createWidget: () => {
      const viewContainer = container.get(ViewContainer);
      viewContainer.addWidget(fileNavigatorWidget, { order: 0 });
      viewContainer.addWidget(openEditorsWidget, { order: 1 });
      return viewContainer;
    }
  };
}
```

**Relevance**: This is exactly how we'd build a composite sidebar with file tree + agent status + session info.

---

## 3. Monaco Editor Integration

### 3.1 Architecture

Monaco is integrated via the `@theia/monaco` package. Theia wraps Monaco in its own editor API (`@theia/editor`) for abstraction.

**Layer stack:**
```
@theia/editor (stable, LSP-based API)
    ↕
@theia/monaco (Monaco ↔ LSP conversion)
    ↕
monaco-editor-core (VS Code's editor)
```

**Important**: Positions in Monaco are 1-based, but 0-based in LSP and VS Code API. `@theia/monaco` handles conversion.

### 3.2 EditorManager — Programmatic Editor Control

```typescript
@inject(EditorManager)
protected readonly editorManager: EditorManager;

// Open a file at specific location
const editor = await this.editorManager.open(
  new URI('file:///path/to/file.ts'),
  {
    mode: 'activate',   // 'activate' | 'reveal' | 'open'
    selection: { start: { line: 10, character: 0 }, end: { line: 10, character: 20 } },
    widgetOptions: { area: 'main', mode: 'split-right' }
  }
);

// Access current editor
const current = this.editorManager.currentEditor;
const all = this.editorManager.all;

// Events
this.editorManager.onCreated(widget => { ... });
this.editorManager.onCurrentEditorChanged(widget => { ... });
```

### 3.3 Decorations and Markers

Through the Monaco editor API:
```typescript
// Via MonacoEditor
const monacoEditor = (editorWidget.editor as MonacoEditor).getControl();

// Apply decorations
const decorations = monacoEditor.deltaDecorations([], [{
  range: new monaco.Range(1, 1, 1, 10),
  options: {
    inlineClassName: 'highlight-error',
    hoverMessage: { value: 'Error here' },
    glyphMarginClassName: 'error-glyph'
  }
}]);

// Scroll to line
monacoEditor.revealLineInCenter(42);

// Set cursor position
monacoEditor.setPosition({ lineNumber: 10, column: 1 });
```

### 3.4 Custom Editor Types

Implement `OpenHandler` or extend `WidgetOpenHandler` for custom file viewers:

```typescript
@injectable()
export class MarkdownPreviewHandler extends WidgetOpenHandler<MarkdownPreviewWidget> {
  readonly id = 'markdown-preview';

  canHandle(uri: URI): number {
    return uri.path.ext === '.md' ? 200 : 0;  // Higher = higher priority
  }
}
```

**Relevance**: We can create custom "editor" types for presentations, whiteboards, etc. that open in the main area just like code editors.

---

## 4. Terminal Integration

### 4.1 Terminal Architecture

Theia's terminal is in `@theia/terminal` package, based on xterm.js.

### 4.2 TerminalService API

```typescript
@inject(TerminalService)
protected readonly terminalService: TerminalService;

// Create a new terminal
const terminal = await this.terminalService.newTerminal({
  title: 'Agent Terminal',
  cwd: '/path/to/workspace',
  shellPath: '/bin/zsh',
  shellArgs: [],
  env: { CUSTOM_VAR: 'value' }
});

// Open it in the shell
this.terminalService.open(terminal, {
  widgetOptions: { area: 'bottom' },
  mode: 'activate'
});

// Access all terminals
const allTerminals = this.terminalService.all;

// Get by ID
const term = this.terminalService.getById('terminal-widget-id');
```

### 4.3 Terminal Widget

```typescript
// TerminalWidget provides:
interface TerminalWidget extends Widget {
  readonly processId: Promise<number>;
  readonly terminalId: number;
  sendText(text: string): void;
  // ... more
}
```

### 4.4 Task Terminal Integration

Tasks can spawn terminals via `TaskTerminalWidgetManager`:
```typescript
this.shell.addWidget(widget, {
  area: openerOptions.widgetOptions?.area || 'bottom'
});
```

**Relevance**: We can create agent-controlled terminals that execute commands and stream output. The `sendText()` method allows programmatic command execution.

---

## 5. File System

### 5.1 FileService Architecture

The `FileService` in `@theia/filesystem` is the primary API:

```typescript
@inject(FileService)
protected readonly fileService: FileService;

// Read file
const content = await this.fileService.read(uri);

// Write file
await this.fileService.write(uri, 'content');

// Create file/folder
await this.fileService.createFile(uri, 'initial content');
await this.fileService.createFolder(uri);

// Delete
await this.fileService.delete(uri);

// Move/copy
await this.fileService.move(sourceUri, targetUri);
await this.fileService.copy(sourceUri, targetUri);

// Watch for changes
const watcher = this.fileService.watch(uri, { recursive: true });
this.fileService.onDidFilesChange(event => {
  for (const change of event.changes) {
    // change.type: ADDED | UPDATED | DELETED
    // change.resource: URI
  }
});

// File stat (existence check, metadata)
const stat = await this.fileService.resolve(uri);
```

### 5.2 Custom File System Providers

```typescript
// Implement FileServiceContribution to register custom providers
@injectable()
export class MyFSContribution implements FileServiceContribution {
  registerFileSystemProviders(service: FileService): void {
    service.registerProvider('myscheme', myProvider);
  }
}
```

### 5.3 File Navigator / Tree

The file tree uses `TreeWidget` (see Section 2). The `@theia/navigator` package provides `FileNavigatorWidget` with full tree functionality:
- Expandable/collapsible nodes
- Lazy child resolution
- Drag & drop
- Context menus
- Decorations
- Search/filter

**Creating a custom tree** uses `createTreeContainer()`:
```typescript
function createCustomTreeContainer(parent: Container): Container {
  const child = createTreeContainer(parent, {
    model: CustomTreeModel,
    widget: CustomTreeWidget,
    props: {
      contextMenuPath: CUSTOM_CONTEXT_MENU,
      search: true,
      multiSelect: true
    }
  });
  return child;
}
```

**Relevance**: We can create custom file trees with agent-specific views (filtered files, workspace snapshots, etc.).

---

## 6. Frontend ↔ Backend Communication

### 6.1 Architecture

Theia uses **two separate processes** (frontend + backend) communicating via:
- **JSON-RPC over WebSocket** for service calls
- **REST over HTTP** for additional endpoints
- All connections are multiplexed over a single WebSocket

### 6.2 Creating a Backend Service

**Step 1: Define the protocol** (in `common/`):
```typescript
// my-protocol.ts (shared between frontend and backend)
export const myServicePath = '/services/my-service';

export const MyService = Symbol('MyService');
export interface MyService extends RpcServer<MyClient> {
  doSomething(param: string): Promise<string>;
  runAgentCommand(agentId: string, command: string): Promise<void>;
}

export const MyClient = Symbol('MyClient');
export interface MyClient {
  onAgentOutput(agentId: string, output: string): void;
  onStatusChanged(status: string): void;
}
```

**Step 2: Implement the backend service** (in `node/`):
```typescript
@injectable()
export class MyServiceImpl implements MyService {
  protected client?: MyClient;

  setClient(client: MyClient | undefined): void {
    this.client = client;
  }

  async doSomething(param: string): Promise<string> {
    // Backend logic here
    // Notify frontend:
    this.client?.onAgentOutput('agent1', 'result');
    return 'done';
  }

  dispose(): void { }
}
```

**Step 3: Register backend module** (in `node/`):
```typescript
export default new ContainerModule(bind => {
  bind(MyServiceImpl).toSelf().inSingletonScope();
  bind(MyService).toService(MyServiceImpl);

  bind(ConnectionHandler).toDynamicValue(ctx =>
    new RpcConnectionHandler<MyClient>(myServicePath, client => {
      const server = ctx.container.get<MyServiceImpl>(MyServiceImpl);
      server.setClient(client);
      return server;
    })
  ).inSingletonScope();
});
```

**Step 4: Connect from frontend** (in `browser/`):
```typescript
export default new ContainerModule(bind => {
  bind(MyService).toDynamicValue(ctx => {
    const connection = ctx.container.get(WebSocketConnectionProvider);
    const watcher = ctx.container.get(MyWatcher);
    return connection.createProxy<MyService>(myServicePath, watcher.getClient());
  }).inSingletonScope();
});
```

### 6.3 Events System

```typescript
// Create an emitter
protected readonly onStatusChangedEmitter = new Emitter<string>();
readonly onStatusChanged = this.onStatusChangedEmitter.event;

// Fire events
this.onStatusChangedEmitter.fire('connected');

// Subscribe
this.myService.onStatusChanged(status => {
  console.log('Status:', status);
});
```

### 6.4 Custom HTTP Endpoints

Via `BackendApplicationContribution`:
```typescript
@injectable()
export class MyEndpoint implements BackendApplicationContribution {
  configure(app: Application): void {
    app.get('/api/agents', (req, res) => {
      res.json({ agents: ['oracle', 'builder'] });
    });
    app.post('/api/agents/:id/execute', json(), (req, res) => {
      // Handle agent execution
    });
  }
}
```

**Relevance**: This is exactly how we build the MCP tool integration backend. Backend services manage agent processes, communicate with MCP servers, and push events to the frontend via the client callback pattern.

---

## 7. Theming & UI

### 7.1 CSS Variables

Theia uses CSS custom properties (variables) for theming:
```css
:root {
  --theia-editor-background: #1e1e1e;
  --theia-sideBar-background: #252526;
  --theia-activityBar-background: #333333;
  --theia-panel-background: #1e1e1e;
  --theia-tab-activeBackground: #1e1e1e;
  /* ... hundreds of variables following VS Code's naming */
}
```

### 7.2 Custom Styling

Extensions can add CSS/LESS files:
```json
{
  "theiaExtensions": [{
    "frontend": "lib/browser/my-frontend-module",
    "frontendElectron": "lib/electron-browser/my-electron-module"
  }]
}
```

Import styles in your module:
```typescript
import '../../src/browser/style/my-custom-styles.css';
```

### 7.3 "Many Island" Style (Custom Layout)

The DZone deep-dive demonstrates creating a modern "island" layout by:
1. Overriding `ApplicationShell.createLayout()`
2. Custom `SidePanelHandler` with horizontal tabs
3. CSS variables for rounded corners, spacing, transparency

```css
#theia-app-shell {
  background: var(--theia-island-background);
}

#theia-left-content-panel,
#theia-main-content-panel,
#theia-bottom-content-panel {
  border-radius: 8px;
  margin: 4px;
}
```

### 7.4 Toolbar & Menu Customization

- **Dynamic Toolbar**: `@theia/toolbar` provides a customizable toolbar
- **Menu removal**: Override `MenuContribution` or use `FilterContribution`
- **Custom menus**: Create new `MenuPath` entries and register items

```typescript
// Create a custom top-level menu
export const AI_MENU: MenuPath = ['menubar', 'ai-menu'];

menus.registerSubmenu(AI_MENU, 'AI', { order: '8' });
menus.registerMenuAction(AI_MENU, {
  commandId: 'openspace.chat.open',
  label: 'Open Chat'
});
```

**Relevance**: We can fully customize the chrome — remove stock menus, add AI-specific menus, create a custom toolbar with agent status indicators.

---

## 8. Building & Packaging

### 8.1 Project Scaffolding

Use the Yeoman generator:
```bash
npm install -g yo @theia/generator-theia-extension
yo @theia/extension
```

### 8.2 Monorepo Structure

```
theia-openspace/
├── package.json              # Root: workspaces, scripts
├── tsconfig.json
├── browser-app/              # Browser app definition
│   └── package.json          # Dependencies = selected extensions
├── electron-app/             # Electron app definition
│   └── package.json
├── extensions/               # Custom Theia extensions
│   ├── openspace-chat/       # Chat widget extension
│   │   ├── package.json
│   │   └── src/
│   │       ├── browser/      # Frontend module + widgets
│   │       ├── node/         # Backend services
│   │       └── common/       # Shared protocols
│   ├── openspace-agents/     # Agent management extension
│   ├── openspace-canvas/     # Whiteboard/canvas extension
│   └── openspace-session/    # Session management extension
└── plugins/                  # VS Code extension bundles
```

### 8.3 Root package.json

```json
{
  "private": true,
  "workspaces": [
    "browser-app",
    "electron-app",
    "extensions/*"
  ],
  "scripts": {
    "build:browser": "yarn --cwd browser-app bundle",
    "build:electron": "yarn --cwd electron-app bundle",
    "start:browser": "yarn --cwd browser-app start",
    "start:electron": "yarn --cwd electron-app start",
    "watch": "lerna run --parallel watch"
  }
}
```

### 8.4 Browser App package.json

```json
{
  "name": "browser-app",
  "dependencies": {
    "@theia/core": "latest",
    "@theia/editor": "latest",
    "@theia/filesystem": "latest",
    "@theia/monaco": "latest",
    "@theia/navigator": "latest",
    "@theia/terminal": "latest",
    "@theia/workspace": "latest",
    "@theia/ai-core": "latest",
    "@theia/ai-chat": "latest",
    "@theia/ai-chat-ui": "latest",
    "openspace-chat": "0.0.0",
    "openspace-agents": "0.0.0"
  },
  "theia": { "target": "browser" }
}
```

### 8.5 Electron App

```json
{
  "name": "electron-app",
  "dependencies": { /* same + electron-specific */ },
  "theia": { "target": "electron" }
}
```

Build and run:
```bash
yarn build:browser && yarn start:browser    # → http://localhost:3000
yarn build:electron && yarn start:electron  # → Native window
```

### 8.6 Theia CLI

```bash
theia build          # Build the application
theia rebuild:browser # Rebuild native deps for browser
theia rebuild:electron # Rebuild native deps for electron
theia start          # Start the application
theia check:theia-version # Verify version compatibility
```

---

## 9. Theia AI Framework (CRITICAL for Theia Openspace)

### 9.1 Overview

Theia AI (`@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui`) is a **built-in framework** for creating AI-native tools. It provides:

- **Agent framework**: Create custom AI agents with unique behaviors
- **Chat UI**: Default chat widget with `@agent` mentions
- **Prompt management**: Template system with variables, runtime editing
- **LLM integration**: Multiple provider support (OpenAI, Anthropic, Ollama, etc.)
- **Tool functions**: MCP-style function calling for LLMs
- **Custom response rendering**: Rich UI in chat responses
- **Change sets**: Agent-proposed code changes
- **MCP server integration**: Built-in Model Context Protocol support

### 9.2 Creating a Chat Agent

```typescript
import { AbstractStreamParsingChatAgent } from '@theia/ai-chat';
import { LanguageModelRequirement } from '@theia/ai-core';

export class OpenspaceChatAgent extends AbstractStreamParsingChatAgent {
  id = 'OpenspaceChat';
  name = 'Openspace';
  description = 'AI-native IDE assistant';

  languageModelRequirements: LanguageModelRequirement[] = [{
    purpose: 'chat',
    identifier: 'default/universal',
  }];

  protected defaultLanguageModelPurpose = 'chat';

  override prompts = [{
    id: myPromptTemplate.id,
    defaultVariant: myPromptTemplate
  }];

  protected override systemPromptId = myPromptTemplate.id;
}
```

### 9.3 Tool Functions (LLM-callable tools)

```typescript
// Implement ToolProvider interface
@injectable()
export class WorkspaceTools implements ToolProvider {
  getTool(): Tool {
    return {
      id: 'getWorkspaceFileList',
      description: 'Lists all files in the workspace',
      parameters: { /* JSON Schema */ },
      handler: async (params) => {
        // Return file list
        return JSON.stringify(fileList);
      }
    };
  }
}
```

Usage in prompts:
```
Use the following functions to access the workspace:
- ~{getWorkspaceFileList}
- ~{getFileContent}
```

### 9.4 Custom Response Rendering

Agents can return structured response parts that render as custom UI:

```typescript
// In agent: parse LLM response and create structured content
const commandButton = {
  kind: 'command',
  commandId: 'my.command',
  label: 'Execute'
};
```

Register custom renderers:
```typescript
// Bind a ResponsePartRenderer to render custom UI for specific response types
bind(ResponsePartRenderer).to(MyCommandButtonRenderer);
```

### 9.5 MCP Integration

Theia IDE has **built-in MCP server management**:
- Configure MCP servers in settings
- View server status (Running/Starting/Errored/Stopped)
- Access tools from MCP servers in chat
- Copy tool references for prompt embedding

### 9.6 Variables System

```typescript
// Global variable (available to all agents)
@injectable()
export class WorkspaceVariable implements Variable {
  id = 'workspaceRoot';
  description = 'The workspace root path';

  async resolve(): Promise<string> {
    return this.workspaceService.tryGetRoots()[0]?.resource.toString() ?? '';
  }
}

// Agent-specific variable
// Chat context variables (file, selection, etc.)
```

### 9.7 Chat Suggestions

```typescript
model.setSuggestions([{
  kind: 'callback',
  callback: () => this.chatService.sendRequest(sessionId, {
    text: '@Coder please fix the build errors'
  }),
  content: '[Fix build errors]'
}]);
```

**Relevance**: This is our primary integration framework. Instead of building AI infrastructure from scratch, we extend Theia AI with custom agents, tool functions, and response renderers. The MCP integration handles our tool calling needs.

---

## 10. Recommendations for Theia Openspace Architecture

### 10.1 Extension Structure

```
extensions/
├── openspace-core/           # Core services, session mgmt, agent protocol
│   ├── browser/              # Frontend DI module
│   ├── node/                 # Backend: agent process mgmt, MCP bridge
│   └── common/               # Shared protocols
├── openspace-chat/           # Chat widget (extends Theia AI chat)
│   └── browser/              # Custom chat UI, response renderers
├── openspace-canvas/         # Whiteboard/canvas widget
│   └── browser/              # Canvas widget, drawing tools
├── openspace-presentation/   # Presentation viewer widget
│   └── browser/              # Reveal.js or similar viewer
├── openspace-agent-panel/    # Agent control panel
│   └── browser/              # Agent status, pane control UI
├── openspace-layout/         # Custom ApplicationShell
│   └── browser/              # Custom layout, sidebar tabs
└── openspace-theme/          # Custom theming
    └── browser/              # CSS variables, custom styles
```

### 10.2 Key Integration Points

| Feature | Theia API | Extension Package |
|---|---|---|
| Chat interface | `@theia/ai-chat-ui` + custom ReactWidget | openspace-chat |
| Agent control of panes | `ApplicationShell.addWidget/activateWidget` | openspace-agent-panel |
| Agent tool functions | Theia AI `ToolProvider` | openspace-core |
| Terminal control | `TerminalService.newTerminal/sendText` | openspace-core |
| File operations | `FileService.read/write/watch` | openspace-core |
| Editor control | `EditorManager.open` + Monaco decorations | openspace-core |
| Backend agent mgmt | `BackendApplicationContribution` + RPC | openspace-core (node) |
| MCP integration | Theia AI MCP support + custom `ToolProvider` | openspace-core |
| Custom file tree | `TreeWidget` + `createTreeContainer` | openspace-core |
| Session management | Custom RPC service + `StorageService` | openspace-core |
| Custom layout | Rebind `ApplicationShell` | openspace-layout |
| Presentation viewer | Custom `WidgetOpenHandler` for `.md`/`.pptx` | openspace-presentation |
| Whiteboard/canvas | Custom `ReactWidget` in main area | openspace-canvas |

### 10.3 Gotchas and Limitations

1. **Build time**: Theia extensions are compile-time; changes require rebuild. Use `watch` mode for development.
2. **Monaco internal API**: `@theia/monaco` uses internal VS Code APIs. Avoid depending on these directly; use `@theia/editor` abstractions where possible.
3. **Phosphor/Lumino**: The underlying widget framework has its own lifecycle. `onUpdateRequest`, `onResize`, `onAfterAttach` etc. come from there.
4. **Singleton scope**: Most services should be `inSingletonScope()` to avoid multiple instances.
5. **DI ordering**: `@postConstruct` runs after constructor + field injection. Use it for initialization that needs injected services.
6. **Theia AI is still beta**: The AI framework is evolving rapidly. Pin versions carefully.
7. **Theia Plugins deprecated**: Don't use Theia Plugins; use Theia Extensions or VS Code Extensions.
8. **FilterContribution**: After filtering contributions, run `Reset Workbench Layout` command to apply changes.
9. **WebSocket multiplexing**: All RPC services share one WebSocket. High-frequency events should be batched.
10. **Electron vs Browser**: Some APIs differ (file system access, native menus). Use conditional imports.

### 10.4 Critical Path Items

1. **Start with Yeoman generator** → scaffold monorepo with browser + electron apps
2. **Add `@theia/ai-*` dependencies** → get Theia AI framework immediately
3. **Build openspace-core first** → backend agent service + RPC protocol
4. **Build openspace-chat second** → extend Theia AI chat with custom agent
5. **Build openspace-layout third** → custom shell with agent-controlled panels
6. **Then content surfaces** → canvas, presentation viewer, etc.

---

## Appendix A: Key Source File Locations in Theia Repo

| Component | Path |
|---|---|
| ApplicationShell | `packages/core/src/browser/shell/application-shell.ts` |
| SidePanelHandler | `packages/core/src/browser/shell/side-panel-handler.ts` |
| BaseWidget/ReactWidget | `packages/core/src/browser/widgets/` |
| ViewContainer | `packages/core/src/browser/view-container.ts` |
| WidgetManager | `packages/core/src/browser/widget-manager.ts` |
| FrontendApplication | `packages/core/src/browser/frontend-application.ts` |
| BackendApplication | `packages/core/src/node/backend-application.ts` |
| WebSocketConnectionProvider | `packages/core/src/browser/messaging/` |
| RpcConnectionHandler | `packages/core/src/common/messaging/` |
| EditorManager | `packages/editor/src/browser/editor-manager.ts` |
| MonacoEditor | `packages/monaco/src/browser/monaco-editor.ts` |
| TerminalService | `packages/terminal/src/browser/base/terminal-service.ts` |
| TerminalWidget | `packages/terminal/src/browser/base/terminal-widget.ts` |
| FileService | `packages/filesystem/src/browser/file-service.ts` |
| FileNavigatorWidget | `packages/navigator/src/browser/` |
| TreeWidget | `packages/core/src/browser/tree/` |
| AI Core | `packages/ai-core/src/` |
| AI Chat | `packages/ai-chat/src/` |
| AI Chat UI | `packages/ai-chat-ui/src/` |
| ContributionFilter | `packages/core/src/common/contribution-filter/` |

## Appendix B: Key npm Packages

| Package | Purpose |
|---|---|
| `@theia/core` | Core framework, shell, widgets, DI |
| `@theia/editor` | Editor abstraction API |
| `@theia/monaco` | Monaco editor integration |
| `@theia/filesystem` | File system API |
| `@theia/navigator` | File tree widget |
| `@theia/terminal` | Terminal integration |
| `@theia/workspace` | Workspace management |
| `@theia/messages` | Notifications, message service |
| `@theia/preferences` | Settings/preferences |
| `@theia/ai-core` | AI agent framework |
| `@theia/ai-chat` | Chat agent base classes |
| `@theia/ai-chat-ui` | Chat UI widget |
| `@theia/cli` | Build tools |
| `@theia/toolbar` | Dynamic toolbar |
| `@theia/output` | Output channel widget |

---

*End of RFC-001*
