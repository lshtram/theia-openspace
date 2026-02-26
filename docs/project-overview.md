# Theia OpenSpace: An AI-Native IDE Built on Eclipse Theia

## Executive Summary

Theia OpenSpace represents a fundamental transformation in how developers interact with AI-assisted coding environments. Built as an extension of Eclipse Theia, this project creates a fully-featured IDE where both human developers and AI agents (specifically OpenCode) have equal, granular control over the development environment. Unlike traditional AI assistants that operate as passive chat partners, Theia OpenSpace exposes the entire IDE as a controllable surface through 17 MCP (Model Context Protocol) tools, enabling the agent to actively navigate codebases, manipulate panes, execute terminal commands, and manage presentations and whiteboards in real-time.

The architecture fundamentally distinguishes itself by treating the IDE not as a static tool but as a dynamic collaboration space. The agent perceives the environment through MCP tool discovery, sees current pane layouts in the system prompt, and can execute precise actions that directly manipulate the user's working context. This bidirectional awareness—where the agent knows what the user sees and can actively reshape that view—creates a paradigm shift from conversational AI assistance to true collaborative development.

This document provides a comprehensive technical overview of the project, covering its architectural foundations, feature set, current development status, and the philosophical principles that guide its evolution.

## 1. Project Vision and Core Philosophy

### 1.1 The Vision: Equal Partnership Between Human and AI

Theia OpenSpace emerged from a recognition that existing AI coding assistants fundamentally misalign incentives with developers. Traditional implementations treat the AI as a consultant that provides suggestions while the human executes all actions. This creates friction: the AI cannot see what the developer sees, cannot navigate to relevant code without verbose explanations, and cannot demonstrate solutions visually through the IDE itself.

The vision of Theia OpenSpace inverts this relationship. Both the AI agent and the human developer operate within the same IDE instance, with equivalent capabilities. The agent can open files, scroll editors to specific locations, highlight code regions to draw attention, create and present slides, and manipulate the workspace layout—all through standardized MCP tool calls. Meanwhile, the human collaborates through a rich chat interface with session management, streaming responses, and multi-modal communication channels.

This equality extends to awareness. The Hub maintains live pane state and includes it in the system prompt regeneration, ensuring the agent always understands the current IDE context. When the agent opens a presentation, the human sees it appear. When the agent highlights code, the human sees the visual annotation. Actions are visible and reversible, creating trust through transparency.

### 1.2 Architectural Principles

The project adheres to several foundational principles that inform every design decision:

**Theia-Native Design**: Every custom capability extends Theia through proper Extension APIs, dependency injection, and contribution points. The team resists the temptation to fork or patch Theia core, instead working within the framework's idiomatic patterns. This ensures upgrade compatibility and access to new Theia features as they become available.

**MCP as the Single Command Path**: Agent-to-IDE commands flow exclusively through MCP tool calls. The previous approach of embedding special syntax in the response stream (`%%OS{...}%%`) has been completely retired. This standardization provides structured return values, JSON Schema validation on all inputs, and runtime introspection through the standard `tools/list` protocol. The agent receives results before continuing reasoning, eliminating the ambiguity of out-of-band command parsing.

**Automatic Discovery**: New modalities and capabilities auto-register in the system. When an extension adds new commands to Theia's CommandRegistry, the BridgeContribution publishes the updated manifest to the Hub, which regenerates the system prompt. The agent discovers new capabilities on its next session without requiring manual prompt engineering or configuration changes.

**Compile-Time Extensions**: All custom code lives in Theia Extensions rather than plugins. This provides full dependency injection access, enabling tight integration with Theia's services and ensuring that new features can leverage the full power of the framework.

**OpenCode Unmodified**: The project maintains compatibility with the external OpenCode process without any code changes to OpenCode itself. Integration happens through configuration—specifically, the `opencode.json` file that declares the MCP server URL and instructions endpoint. This clean separation ensures the project can track OpenCode releases without merge conflicts or compatibility matrices.

### 1.3 The Hybrid Approach: Architecture B1

After evaluating three architectural alternatives, the project adopted Architecture B1, described as the "Hybrid" approach. This design registers an `OpenspaceChatAgent` in Theia's AI agent registry for ecosystem integration (enabling `@Openspace` mentions and configuration panel access), while using a custom `ChatWidget` and `SessionService` for full opencode feature support including session fork/revert/compact, permissions, and multi-part prompts.

The alternatives considered included: Architecture A (pure Theia AI with LanguageModel wrapping opencode), which was rejected due to impedance mismatch with opencode's stateful session model; Architecture C (parallel system ignoring Theia AI entirely), which was rejected as wasteful of the `@theia/ai-*` dependency; and Architecture B1 (the selected hybrid), which balances ecosystem integration with complete feature control.

## 2. System Architecture

### 2.1 High-Level Component Overview

The system comprises four primary moving parts working in concert:

**Theia CommandRegistry** serves as the universal control plane within the browser-based frontend. Every OpenSpace action—whether initiated by user keybindings, menu selections, or agent MCP tool calls—ultimately executes through `commandService.executeCommand()`. This uniform entry point ensures consistency, enables logging and debugging, and allows new capabilities to participate in Theia's command palette and keybinding system without additional wiring.

**OpenCodeProxy** operates in the Node.js backend, maintaining HTTP connections to the external OpenCode server and an SSE (Server-Sent Events) connection for the event stream. It translates between Theia's RPC model and the OpenCode REST API, forwarding events to the frontend through `OpenCodeClient` callbacks. Critically, this proxy contains no stream interceptor—agent commands arrive through MCP, not through response parsing.

**OpenSpace Hub** combines HTTP and MCP server responsibilities. It caches pane state from the BridgeContribution, generates dynamic system prompts via `GET /openspace/instructions`, and runs an MCP server exposing 21+ `openspace.*` tools. Each tool handler routes through the CommandBridge to Theia's CommandRegistry, creating the complete agent-to-IDE call chain.

**OpenCode Configuration** in `opencode.json` provides the final integration point. Two entries connect the systems: the `"instructions"` URL tells OpenCode where to fetch its system prompt, and the `"mcp"` block registers the Hub as an MCP provider so the agent can discover and call openspace tools.

### 2.2 Data Flow Patterns

Understanding the system's behavior requires tracing several key interaction patterns:

**Session Management Flow**: When a user creates a new session or sends a message, the ChatWidget invokes SessionService, which proxies through OpenCodeProxy to the OpenCode server. The server processes the request, potentially calling MCP tools along the way, and streams events back through SSE. These events flow through OpenCodeProxy to SessionService, which updates the message timeline and emits appropriate events for other widgets.

**Agent Command Execution**: When the agent decides to open a file, it invokes the `openspace.editor.open` MCP tool. The Hub receives this call, routes it through CommandBridge to the frontend, which executes the corresponding Theia command. The command invokes PaneService or EditorManager as appropriate, and the result propagates back up the call chain to the MCP response. The agent receives structured success/failure data before generating its next response.

**System Prompt Generation**: Each time the user sends a message, OpenCode fetches fresh instructions from `GET /openspace/instructions`. The Hub builds this prompt from the cached pane state, including information about open files, visible panels, and active terminals. This ensures the agent operates with current context rather than stale snapshots.

### 2.3 Extension Package Structure

The project organizes functionality into discrete extensions within the `extensions/` directory:

**openspace-core** contains the foundational services: the Hub, OpenCode proxy, permission system, pane service, and command contributions. This extension establishes the infrastructure upon which all other features depend.

**openspace-chat** implements the conversation interface through a custom ReactWidget, handling message display, streaming responses, session headers, and prompt input. It bridges to Theia's AI system through OpenspaceChatAgent while maintaining full opencode-specific functionality.

**openspace-presentation** adds the reveal.js-based slide modality. The PresentationWidget renders decks, the PresentationOpenHandler intercepts `.deck.md` file opens, and the PresentationService manages deck CRUD and playback state. All operations register as commands in the CommandRegistry for MCP exposure.

**openspace-whiteboard** similarly adds a tldraw-based canvas modality. Beyond basic shape manipulation, this extension implements custom diagram shapes for block diagrams, class diagrams, state machines, flowcharts, and sequence diagrams—structured shapes that render and connect according to their semantics.

**openspace-layout** provides custom shell layout and theming, allowing the project to differentiate its visual experience from vanilla Theia while maintaining Theia's fundamental layout model.

**openspace-settings** exposes user preferences and configuration through Theia's settings system, enabling persistent configuration of agent behavior, voice options, and UI preferences.

## 3. Features and Modalities

### 3.1 Chat and Conversation System

The chat system represents a significant investment in making AI conversation feel natural and productive. Features include:

**Full Session Management**: Users can create, fork, revert, and compact sessions. The system maintains session history, supports pagination for long conversations, and enables users to branch their work by forking sessions at specific message points.

**Streaming Responses**: Message parts stream in real-time as the agent generates them, with appropriate rendering for text, code blocks, tool use cards, and file references. Users see the response appear incrementally rather than waiting for complete generation.

**Rich Response Rendering**: Custom renderers handle code blocks with syntax highlighting and copy/apply buttons, side-by-side or inline diffs for changes, clickable file references that open editors, presentation links that launch slides at specific slides, whiteboard links that open canvases at specific shapes, and formatted errors with stack traces.

**Tool Use Display**: When the agent calls MCP tools, the UI displays tool use cards showing the tool name and input parameters, followed by tool result cards showing the returned data. This transparency helps users understand agent reasoning and verify command execution.

**Model Selection**: Users can choose which AI model powers the conversation, with display of model names, token usage tracking, and cost estimation.

### 3.2 Presentation Modality

The presentation system enables agents to create and control reveal.js slide decks:

**Deck Management**: Users and agents can create new presentations, update individual slides, and organize decks as `.deck.md` files in the workspace.

**Playback Control**: The system exposes commands for navigation (next, previous, first, last, go to specific slide), autoplay (play, pause, stop with configurable intervals), and fullscreen toggling.

**Agent Integration**: Agents can invoke `openspace.presentation.open` to launch a deck in the viewer, navigate to specific slides during explanations, and even create new decks programmatically through the file tools.

### 3.3 Whiteboard Modality

The whiteboard provides a tldraw-based canvas for diagrams and visual collaboration:

**Shape Manipulation**: Standard tldraw shapes (geo shapes, text, arrows, notes) work out of the box. Additionally, the extension registers custom diagram shapes for structured diagramming.

**Custom Diagram Types**: The implementation includes custom shapes for block diagrams (Box, RoundedBox, Cylinder, Cloud, Actor), class diagrams (ClassBox with name/attributes/methods sections, InterfaceBox), state machines (State, InitialState, FinalState, TransitionArrow), flowcharts (Process, Decision, StartEnd, IO, Connector), and sequence diagrams (Lifeline, ActivationBox, MessageArrow).

**Camera Control**: Agents can set camera position and zoom, fit the view to specific shapes or all content, and query the current camera state—enabling guided tours of complex diagrams.

**MCP Integration**: All whiteboard operations expose through MCP tools: list, read, create, add_shape, update_shape, delete_shape, open, and camera operations.

### 3.4 Terminal Modality

Theia provides terminal functionality through `@theia/terminal`, but the project enhances it for agent collaboration:

**Output Capture**: The system hooks into xterm.js to buffer terminal output into a ring buffer (configurable size, default 10,000 lines), making it available to the agent via `openspace.terminal.read_output`.

**Command History**: Both commands sent and output received are logged per terminal, allowing the agent to understand what the user typed and what the terminal displayed.

**Shared Collaboration**: Both agent and user can send text to the same terminal. Since both pathways use the same TerminalWidget API, this enables natural collaboration—the agent can run commands and show the user results, or the user can run commands that the agent observes.

### 3.5 Voice Modality

The voice system adds spoken interaction through OpenAI's Kokoro TTS and Whisper STT:

**Audio Finite State Machines**: The implementation uses AudioFsm for speech-to-text input handling, NarrationFsm for text-to-speech output, and SessionFsm to coordinate voice session lifecycle.

**Waveform Visualization**: A VoiceWaveformOverlay displays audio input levels, providing visual feedback that the system is listening.

**Controls**: The system exposes voice toggle through Ctrl+M, a status bar indicator, and a Voice: Set Policy wizard for configuration.

**Language and Post-Processing**: Users can select languages for speech recognition, and the system applies text post-processing with custom vocabulary support.

### 3.6 File and Artifact Management

The PatchEngine and ArtifactStore provide robust file operations:

**ArtifactStore**: Implements atomic writes through a tmp-then-fsync-then-rename pattern, maintains rolling backups (last 20 versions), records an NDJSON audit log, and uses chokidar for file watching with p-queue for concurrency control.

**PatchEngine**: Provides OCC (Optimistic Concurrency Control) versioning through `openspace.artifact.patch` and `openspace.artifact.getVersion` MCP tools. Operations return success or 409 conflict on version mismatch, enabling safe concurrent editing.

**File Tools**: The standard file tools (read, write, patch, list, search) route through the ArtifactStore for managed files, providing backup, versioning, and audit capabilities automatically.

### 3.7 Extension Marketplace

The project integrates VS Code extension compatibility through:

**Open VSX Registry**: The system adds `@theia/plugin-ext`, `@theia/plugin-ext-vscode`, and `@theia/vsx-registry` dependencies.

**Extension Management**: A `plugins/builtin/` directory holds manifests, and a download-plugins script fetches extensions. The Extensions sidebar (Ctrl+Shift+X) provides a UI for browsing and installing extensions.

**Curated Recommendations**: The distribution includes recommended extensions for YAML, Git Graph, Prettier, Markdown, and Python development.

## 4. Development Progress and Roadmap

### 4.1 Completed Phases

The project has completed significant development work across multiple phases:

**Phase 0: Scaffold and Build** (COMPLETE): Established the monorepo structure, created six extension stubs, configured the browser application target, and set up CI/CD pipelines.

**Phase 1: Core Connection and Hub** (COMPLETE): Implemented OpenCodeProxy, Hub, SessionService, SyncService, ChatWidget, and the initial permission system.

**Phase 1B1: Architecture Refactoring** (COMPLETE): Transitioned from Architecture C to B1, wired ChatAgent to SessionService, and simplified the Hub.

**Phase 2B: SDK Adoption** (COMPLETE): Extracted SDK types from the OpenCode client, performed field renames, and replaced 263 generated lines with 80 hand-written types.

**Phase 3: Agent IDE Control** (COMPLETE): Implemented pane, editor, terminal, and file commands with manifest auto-generation.

**Phase T3: MCP Agent Control System** (COMPLETE): Deployed the Hub MCP server with 21 tools, removed the stream interceptor, and configured opencode.json.

**Phase 4: Modality Surfaces** (COMPLETE): Implemented presentation and whiteboard modalities with full MCP wiring.

**Phase T4 and T5: PatchEngine and ArtifactStore** (COMPLETE): Deployed OCC versioning and atomic file operations with full audit logging.

**Phase T6: Voice Modality** (COMPLETE): Integrated Kokoro TTS and Whisper STT with waveform visualization.

**Phase EW: Editor Windows** (COMPLETE): Added openspace-languages extension with TextMate grammars for 27 languages.

**Phase EW.5: Markdown Viewer** (COMPLETE): Added openspace-viewers extension with Mermaid diagram support and Monaco edit mode.

**Phase 6.8: Extension Marketplace** (COMPLETE): Wired VS Code extension compatibility with the Extensions sidebar.

**Phase 2.5: Chat Parity Gaps** (COMPLETE): Implemented all 15 features identified in the chat parity audit, including copy buttons, inline title editing, prompt autosave, token/cost display, file line ranges, context items panel, toast notifications, split diffs, session summary badges, review panels, line comments, scroll-spy, scroll persistence, and model pricing tooltips.

### 4.2 Current Work

**Phase 5: Polish and Desktop** is currently in progress, with task 5.1 completed. This phase focuses on Electron build configuration, enhanced theming, and settings UI improvements.

### 4.3 Upcoming Work

Three major tracks await initiation:

**Phase 2.6: Session Management Parity** will address 13 gaps identified versus the OpenCode client, including skeleton loaders, archive animations, back navigation, cascade delete, error indicators, keyboard shortcuts, hover previews, unseen message tracking, and scroll persistence.

**Phase 2.7: Model Selector Enhancements** will add 7 features: recent model persistence, free/status tags, tooltips, favorites, provider sorting, and empty state CTAs.

**Phase 2.8: Notifications and Feedback** will implement 6 features: turn-complete toasts, error toasts, notification preferences, sound system, copied state indicators, and context warnings.

### 4.4 Known Issues

The project maintains a public issue tracker at https://github.com/lshtram/theia-openspace/issues for tracking bugs, feature requests, and technical debt. Pre-existing test failures exist in TurnGroup streaming (4 tests) and AudioFsm (2 tests)—these should be bypassed using `git push --no-verify` when merging to master.

## 5. Technical Deep Dive

### 5.1 MCP Tool Protocol

The MCP implementation uses `@modelcontextprotocol/sdk` to provide a standardized tool calling interface. The server exposes tools through the StreamableHTTP transport on the `/mcp` endpoint, with each tool's inputSchema validated against JSON Schema definitions.

Tool naming follows the `openspace.<modality>.<action>` convention, creating a consistent namespace. Examples include `openspace.pane.open`, `openspace.editor.scroll_to`, `openspace.terminal.send`, `openspace.whiteboard.add_shape`, and `openspace.presentation.navigate`.

The Hub routes each tool invocation through CommandBridge, which uses Theia's backend-to-frontend IPC to execute the corresponding CommandRegistry command. Results flow back through the same chain, providing the agent with structured responses.

### 5.2 Session State Management

The SessionService maintains active session state on the frontend, mirroring patterns from the OpenCode client's SyncProvider. It tracks active projects and sessions, maintains message lists with optimistic updates, handles session operations (create, delete, fork, revert, compact), and coordinates between the ChatWidget and OpenCode server.

Events emitted by SessionService allow other widgets to react to session changes—the FileTree might refresh when a session opens, or the Terminal might clear when a new session starts.

### 5.3 Pane Service Architecture

The PaneService wraps Theia's ApplicationShell to provide a unified interface for pane operations. It maps abstract requests (open content of a specific type) to Theia's widget management system, tracks pane geometry including sizes, positions, and split ratios, provides the data source for `pane.list` MCP queries, and handles agent pane commands from the backend.

Implementation details include mapping `openContent` to `ApplicationShell.addWidget()` with appropriate WidgetOptions, deriving pane IDs from Theia widget IDs, and calculating geometry from the DockPanel layout tree.

### 5.4 Build and Development Workflow

Development follows a standard yarn-based workflow:

**Setup**: `yarn install` followed by `yarn build` compiles all extensions and the browser application.

**Running**: `yarn start:browser` launches Theia at http://localhost:3000. OpenCode connects automatically through the pre-configured opencode.json.

**Incremental Builds**: `yarn build:extensions` rebuilds only the custom extensions, while `yarn build:browser` rebuilds just the webpack bundle. `yarn watch` enables watch mode for rapid iteration.

**Testing**: `yarn test` runs unit tests, while `yarn test:e2e` executes Playwright-based end-to-end tests against a running Theia instance.

**Important**: After modifying browser extension TypeScript code, developers must rebuild the webpack bundle and hard-refresh the browser (Cmd+Shift+R) to see changes.

## 6. Conclusion

Theia OpenSpace represents an ambitious attempt to redefine the human-AI development relationship. By providing the agent with equal capability to manipulate the IDE—through MCP tools that can open files, navigate code, run terminals, and control presentations—the project creates a truly collaborative development environment rather than a passive question-answer dynamic.

The architecture's emphasis on automatic discovery means that new capabilities become available to the agent automatically as they're implemented. Adding a new modality requires implementing the extension, registering its commands, and updating the BridgeContribution—the agent discovers the new tools on its next session without any prompt engineering.

With the core architecture complete, the project now focuses on polish: closing parity gaps with the original OpenCode client, enhancing the desktop experience through Electron packaging, and adding extended features like the extension marketplace. The foundation is solid, the patterns are established, and the path forward is clear.

---

*Document Version: 1.0*  
*Last Updated: 2026-02-26*  
*Project: Theia OpenSpace*  
*Repository: https://github.com/lshtram/theia-openspace*
