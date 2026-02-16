# OpenCode Client - Complete Feature List & Analysis

> **Generated:** 2026-02-16  
> **Repository:** https://github.com/anomalyco/opencode.git  
> **Source Location:** `/Users/Shared/dev/opencode/`  
> **Target:** app/ (packages/app), desktop/ (packages/desktop), web/ (packages/web)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Application Features (packages/app)](#core-application-features-packagesapp)
3. [Desktop-Specific Features (packages/desktop)](#desktop-specific-features-packagesdesktop)
4. [Web/Documentation Features (packages/web)](#webdocumentation-features-packagesweb)
5. [Feature-to-File Mapping](#feature-to-file-mapping)
6. [Requirements Traceability](#requirements-traceability)

---

## Architecture Overview

### Project Structure

```
packages/
├── app/           # Core client application (SolidJS, TypeScript)
├── desktop/       # Tauri v2 desktop wrapper (Rust + TypeScript)
├── web/           # Documentation website (Astro + Starlight)
├── docs/          # Mintlify documentation
├── sdk/           # TypeScript SDK
└── [other]/       # Additional packages
```

### Provider Hierarchy (State Management)

```
AppBaseProviders
├── MetaProvider
├── Font
├── ThemeProvider
├── LanguageProvider
├── DialogProvider
└── MarkedProvider (Markdown parsing)

AppShellProviders
├── SettingsProvider
├── PermissionProvider
├── LayoutProvider
├── NotificationProvider
├── ModelsProvider
├── CommandProvider
└── HighlightsProvider

SessionProviders
├── TerminalProvider
├── FileProvider
├── PromptProvider
└── CommentsProvider
```

---

## Core Application Features (packages/app)

### 1. ROUTING & NAVIGATION

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Route Structure** | URL-based routing with SolidJS Router | `src/app.tsx` |
| **Home Route** | Project list and server connection | `src/pages/home.tsx` |
| **Directory Route** | Project workspace with sessions | `src/pages/layout.tsx` |
| **Session Route** | Active session with file/timeline/terminal panels | `src/pages/session.tsx` |
| **Deep Links** | opencode:// URL protocol support | `src/pages/layout/deep-links.ts` |
| **Navigation History** | Back/forward navigation handling | `src/context/platform.tsx` |

### 2. STATE MANAGEMENT (Context Providers)

#### 2.1 Global State

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Global Sync** | Project/provider/settings synchronization | `src/context/global-sync.tsx` |
| **Global SDK** | Server event streaming and client management | `src/context/global-sdk.tsx` |
| **Server Connection** | URL management and health polling | `src/context/server.tsx` |
| **Settings** | User preferences persistence | `src/context/settings.tsx` |
| **Models** | AI model visibility/favorites management | `src/context/models.tsx` |

#### 2.2 Directory-Scoped State

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Sync** | Optimistic updates and pending queue | `src/context/sync.tsx` |
| **SDK** | Per-directory API client | `src/context/sdk.tsx` |
| **Terminal** | PTY session management | `src/context/terminal.tsx` |
| **File** | File tree and content caching | `src/context/file.tsx` |
| **Prompt** | Multi-part prompt input state | `src/context/prompt.tsx` |
| **Comments** | Line-level file comments | `src/context/comments.tsx` |

#### 2.3 Session-Scoped State

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Layout** | Panel widths, tabs, terminal height | `src/context/layout.tsx` |
| **Local** | Agent/model selection per session | `src/context/local.tsx` |
| **Command** | Command palette and keybindings | `src/context/command.tsx` |
| **Permission** | Auto-accept rules for permissions | `src/context/permission.tsx` |

### 3. FILE MANAGEMENT

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **File Tree** | Hierarchical file browser with expand/collapse | `src/components/file-tree.tsx` |
| **File Watching** | Real-time file change detection | `src/context/file/watcher.ts` |
| **Content Cache** | LRU cache with eviction (40 entries, 20MB) | `src/context/file/content-cache.ts` |
| **View Cache** | Per-session scroll/selection state | `src/context/file/view-cache.ts` |
| **Path Normalization** | Cross-platform path handling | `src/context/file/path.ts` |
| **File Search** | Quick file/command/session finder | `src/components/dialog-select-file.tsx` |
| **File Tabs** | Draggable file tabs with code viewing | `src/pages/session/file-tabs.tsx` |

### 4. SESSION MANAGEMENT

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Session List** | Hierarchical session tree per workspace | `src/pages/layout/sidebar-workspace.tsx` |
| **Session Tabs** | Draggable session tabs | `src/components/session/session-sortable-tab.tsx` |
| **Session Header** | Title editing, actions, app opener | `src/components/session/session-header.tsx` |
| **Session Context** | Token usage and context metrics | `src/components/session/session-context-tab.tsx` |
| **Message Timeline** | Scrollable message list with scroll spy | `src/pages/session/message-timeline.tsx` |
| **Review Panel** | Diff viewing and file review | `src/pages/session/review-tab.tsx` |
| **Session Fork** | Create new session from message history | `src/components/dialog-fork.tsx` |
| **Session Undo/Redo** | Revert to previous session state | `src/context/sync.tsx` |

### 5. TERMINAL MANAGEMENT

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Terminal Creation** | New PTY session creation | `src/context/terminal.tsx` |
| **Terminal Tabs** | Draggable terminal tabs | `src/components/session/session-sortable-terminal-tab.tsx` |
| **Terminal Panel** | Resizable terminal panel | `src/pages/session/terminal-panel.tsx` |
| **Terminal Widget** | XTerm.js integration | `src/components/terminal.tsx` |
| **Terminal Persistence** | Workspace-scoped terminal state | `src/context/terminal.tsx` |
| **Clone Terminal** | Duplicate existing terminal | `src/context/terminal.tsx` |

### 6. PROMPT SYSTEM

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Prompt Input** | ContentEditable-based input | `src/components/prompt-input.tsx` |
| **Multi-part Prompts** | Text, file, agent, image attachments | `src/context/prompt.tsx` |
| **@ Mentions** | File/agent/model mention with popover | `src/components/prompt-input/slash-popover.tsx` |
| **Slash Commands** | /command execution | `src/context/command.tsx` |
| **Image Attachments** | Drag-drop and paste images | `src/components/prompt-input/attachments.ts` |
| **Prompt History** | Up/down arrow navigation | `src/components/prompt-input/history.ts` |
| **Context Items** | Selected file ranges as context | `src/components/prompt-input/context-items.tsx` |
| **Submit Logic** | Request building and submission | `src/components/prompt-input/submit.ts` |

### 7. DIALOG SYSTEM

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Connect Provider** | OAuth/API key provider connection | `src/components/dialog-connect-provider.tsx` |
| **Custom Provider** | OpenAI-compatible provider setup | `src/components/dialog-custom-provider.tsx` |
| **Edit Project** | Project metadata editing | `src/components/dialog-edit-project.tsx` |
| **Manage Models** | Model visibility management | `src/components/dialog-manage-models.tsx` |
| **Release Notes** | Feature highlights carousel | `src/components/dialog-release-notes.tsx` |
| **Select Directory** | Directory picker | `src/components/dialog-select-directory.tsx` |
| **Select File** | Quick file finder | `src/components/dialog-select-file.tsx` |
| **Select MCP** | MCP server selection | `src/components/dialog-select-mcp.tsx` |
| **Select Model** | Model selection with provider grouping | `src/components/dialog-select-model.tsx` |
| **Select Provider** | Provider selection list | `src/components/dialog-select-provider.tsx` |
| **Select Server** | Server URL management | `src/components/dialog-select-server.tsx` |
| **Settings** | Settings dialog with tabs | `src/components/dialog-settings.tsx` |

### 8. SETTINGS PANELS

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **General Settings** | Auto-save, release notes, updates | `src/components/settings-general.tsx` |
| **Keybinds** | Keyboard shortcut configuration | `src/components/settings-keybinds.tsx` |
| **Models** | Model selection and management | `src/components/settings-models.tsx` |
| **Providers** | Provider connection management | `src/components/settings-providers.tsx` |
| **Agents** | Agent configuration | `src/components/settings-agents.tsx` |
| **Commands** | Custom commands | `src/components/settings-commands.tsx` |
| **MCP** | MCP server settings | `src/components/settings-mcp.tsx` |
| **Permissions** | Permission auto-accept rules | `src/components/settings-permissions.tsx` |

### 9. SIDEBAR FEATURES

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Project List** | Draggable sortable project tiles | `src/pages/layout/sidebar-project.tsx` |
| **Workspace Tree** | Session tree per workspace | `src/pages/layout/sidebar-workspace.tsx` |
| **Session Links** | Session navigation links | `src/e2e/sidebar/sidebar-session-links.spec.ts` |
| **Shell Actions** | New session, open project buttons | `src/pages/layout/sidebar-shell.tsx` |
| **Auto-open** | Mouse aim tracking for sidebar | `src/utils/aim.ts` |

### 10. COMMAND PALETTE

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Command Registration** | Register commands with keybinds | `src/context/command.tsx` |
| **Keybind Parsing** | Parse mod+shift+p style keybinds | `src/context/command-keybind.test.ts` |
| **Slash Commands** | /command in prompt input | `src/context/command.tsx` |
| **Session Commands** | Session-specific commands | `src/pages/session/use-session-commands.tsx` |

### 11. NOTIFICATIONS

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Turn Complete** | Browser notification on agent completion | `src/context/notification.tsx` |
| **Error Notifications** | Error toast messages | `src/context/notification.tsx` |
| **Indexing Status** | File indexing progress | `src/context/notification.tsx` |
| **Sound Alerts** | Audio notifications | `src/utils/sound.ts` |
| **Notification Click** | Handle notification click action | `src/utils/notification-click.ts` |

### 12. INTERNATIONALIZATION (i18n)

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **16 Languages** | Full UI translation support | `src/i18n/*.ts` |
| **Dictionary Merging** | Runtime dictionary updates | `src/context/language.tsx` |
| **Locale Detection** | Browser locale detection | `src/entry.tsx` |
| **Cookie Persistence** | Language preference storage | `src/context/language.tsx` |

### 13. UTILITIES

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **ID Generation** | Prefixed IDs (ses_, msg_, etc.) | `src/utils/id.ts` |
| **Base64 Encoding** | URL-safe base64 | `src/utils/base64.ts` |
| **UUID Generation** | UUID v4 with fallback | `src/utils/uuid.ts` |
| **Time Formatting** | Relative time display | `src/utils/time.ts` |
| **Persisted Storage** | localStorage with migration | `src/utils/persist.ts` |
| **LRU Cache** | Scoped cache with TTL | `src/utils/scoped-cache.ts` |
| **Server Health** | Health check with retry | `src/utils/server-health.ts` |
| **Worktree State** | Pending/ready/failed states | `src/utils/worktree.ts` |
| **Terminal Writer** | Terminal output batching | `src/utils/terminal-writer.ts` |
| **Speech Recognition** | Web Speech API wrapper | `src/utils/speech.ts` |
| **Drag-Drop** | Axis constraints for DnD | `src/utils/solid-dnd.tsx` |

### 14. E2E TESTS

| Feature | Test File |
|---------|-----------|
| **Home Page** | `e2e/app/home.spec.ts` |
| **Navigation** | `e2e/app/navigation.spec.ts` |
| **Command Palette** | `e2e/app/palette.spec.ts` |
| **Session Management** | `e2e/app/session.spec.ts` |
| **File Tree** | `e2e/files/file-tree.spec.ts` |
| **File Viewer** | `e2e/files/file-viewer.spec.ts` |
| **Model Picker** | `e2e/models/model-picker.spec.ts` |
| **Project Switching** | `e2e/projects/projects-switch.spec.ts` |
| **Settings** | `e2e/settings/settings.spec.ts` |
| **Terminal** | `e2e/terminal/terminal.spec.ts` |
| **Sidebar** | `e2e/sidebar/sidebar.spec.ts` |

---

## Desktop-Specific Features (packages/desktop)

### 1. TAURI RUST BACKEND

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Sidecar Management** | Spawn/kill opencode server process | `src-tauri/src/lib.rs` |
| **CLI Integration** | CLI installation and sync | `src-tauri/src/cli.rs` |
| **Window Management** | Main and loading windows | `src-tauri/src/windows.rs` |
| **Markdown Parsing** | Native markdown parser | `src-tauri/src/markdown.rs` |
| **Logging** | Structured logging with tracing | `src-tauri/src/logging.rs` |
| **WSL Support** | Windows Subsystem for Linux paths | `src-tauri/src/lib.rs` |
| **Display Backend** | Wayland/X11 selection (Linux) | `src-tauri/src/linux_display.rs` |
| **Window Customization** | Platform-specific window tweaks | `src-tauri/src/window_customizer.rs` |

### 2. DESKTOP UI INTEGRATION

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Entry Point** | Desktop-specific app bootstrap | `src/entry.tsx` |
| **Platform Provider** | Desktop platform abstraction | `src/index.tsx` |
| **Native File Pickers** | OS file/directory dialogs | `src/index.tsx` |
| **Deep Link Handling** | opencode:// URL protocol | `src/index.tsx` |
| **Clipboard Images** | Native clipboard image reading | `src/index.tsx` |
| **Native Menu (macOS)** | Application menu bar | `src/menu.ts` |
| **Auto-Updater** | Automatic update checking/installation | `src/updater.ts` |
| **WebView Zoom** | Zoom in/out controls | `src/webview-zoom.ts` |
| **Loading Screen** | Initialization progress UI | `src/loading.tsx` |

### 3. STORAGE

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Tauri Store** | Encrypted persistent storage | `src/index.tsx` |
| **Storage Debouncing** | 250ms write debounce | `src/index.tsx` |
| **Memory Fallback** | In-memory store when file fails | `src/index.tsx` |

### 4. MENU SYSTEM (macOS)

| Menu | Items | Implementation |
|------|-------|----------------|
| **OpenCode** | About, Check Updates, Install CLI, Restart, Hide, Quit | `src/menu.ts` |
| **File** | New Session (Shift+Cmd+S), Open Project (Cmd+O), Close Window | `src/menu.ts` |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Select All | `src/menu.ts` |
| **View** | Toggle Sidebar (Cmd+B), Toggle Terminal, Back, Forward, Session Navigation | `src/menu.ts` |
| **Help** | Documentation, Discord, Feedback, Bug Report | `src/menu.ts` |

### 5. TAURI COMMANDS

| Command | Description | Rust Implementation |
|---------|-------------|---------------------|
| `kill_sidecar` | Terminate server process | `src-tauri/src/lib.rs` |
| `install_cli` | Install CLI binary | `src-tauri/src/cli.rs` |
| `await_initialization` | Wait for server ready | `src-tauri/src/lib.rs` |
| `get_default_server_url` | Get saved server URL | `src-tauri/src/server.rs` |
| `set_default_server_url` | Save server URL | `src-tauri/src/server.rs` |
| `get_wsl_config` | Get WSL settings | `src-tauri/src/server.rs` |
| `set_wsl_config` | Save WSL settings | `src-tauri/src/server.rs` |
| `get_display_backend` | Get Linux display backend | `src-tauri/src/lib.rs` |
| `set_display_backend` | Set Linux display backend | `src-tauri/src/lib.rs` |
| `parse_markdown_command` | Native markdown parse | `src-tauri/src/markdown.rs` |
| `check_app_exists` | Verify app installation | `src-tauri/src/lib.rs` |
| `wsl_path` | Convert WSL paths | `src-tauri/src/lib.rs` |
| `resolve_app_path` | Resolve Windows app paths | `src-tauri/src/lib.rs` |

---

## Web/Documentation Features (packages/web)

### 1. DOCUMENTATION SITE (Astro + Starlight)

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Multi-language Docs** | 16 language translations | `astro.config.mjs` |
| **Sidebar Navigation** | Organized doc categories | `astro.config.mjs` |
| **Custom Theme** | Toolbeam docs theme | `astro.config.mjs` |
| **Expressive Code** | Syntax highlighting | `astro.config.mjs` |
| **Edit Links** | GitHub edit links | `astro.config.mjs` |
| **Last Updated** | Page modification dates | `astro.config.mjs` |

### 2. LANDING PAGE

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Hero Section** | Logo, title, install command | `src/components/Lander.astro` |
| **Feature List** | Key product features | `src/components/Lander.astro` |
| **Install Alternatives** | npm, Bun, Homebrew, Paru, Mise | `src/components/Lander.astro` |
| **Screenshot Gallery** | TUI, VSCode, GitHub screenshots | `src/components/Lander.astro` |
| **Command Copy** | One-click install command copy | `src/components/Lander.astro` |
| **Responsive Design** | Mobile-optimized layout | `src/components/Lander.astro` |

### 3. SESSION SHARING

| Feature | Description | Implementation File |
|---------|-------------|---------------------|
| **Share Component** | Public session viewing | `src/components/Share.tsx` |
| **WebSocket Poll** | Real-time updates via wss | `src/components/Share.tsx` |
| **Message Rendering** | Part-based message display | `src/components/share/part.tsx` |
| **Content Types** | Bash, Code, Diff, Error, Markdown, Text | `src/components/share/content-*.tsx` |
| **Statistics** | Cost, token usage display | `src/components/Share.tsx` |
| **Auto-scroll** | Scroll-to-bottom button | `src/components/Share.tsx` |

### 4. CUSTOM COMPONENTS

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **Head** | SEO and meta tags | `src/components/Head.astro` |
| **Header** | Site header with navigation | `src/components/Header.astro` |
| **Footer** | Site footer | `src/components/Footer.astro` |
| **SiteTitle** | Logo and title | `src/components/SiteTitle.astro` |
| **Icons** | Custom icon components | `src/components/icons/` |

---

## Feature-to-File Mapping

### Entry Points

| Entry | Purpose | File |
|-------|---------|------|
| **Web Entry** | Browser bootstrap | `packages/app/src/entry.tsx` |
| **Desktop Entry** | Tauri bootstrap | `packages/desktop/src/entry.tsx` |
| **App Shell** | Provider hierarchy | `packages/app/src/app.tsx` |
| **Desktop Index** | Platform provider | `packages/desktop/src/index.tsx` |

### Core Contexts

| Context | Provider | Hook | Files |
|---------|----------|------|-------|
| **Global Sync** | `GlobalSyncProvider` | `useGlobalSync` | `src/context/global-sync.tsx` + `global-sync/*.ts` |
| **Global SDK** | `GlobalSDKProvider` | `useGlobalSDK` | `src/context/global-sdk.tsx` |
| **Server** | `ServerProvider` | `useServer` | `src/context/server.tsx` |
| **Sync** | `SyncProvider` | `useSync` | `src/context/sync.tsx` |
| **SDK** | `SDKProvider` | `useSDK` | `src/context/sdk.tsx` |
| **File** | `FileProvider` | `useFile` | `src/context/file.tsx` + `file/*.ts` |
| **Terminal** | `TerminalProvider` | `useTerminal` | `src/context/terminal.tsx` |
| **Prompt** | `PromptProvider` | `usePrompt` | `src/context/prompt.tsx` |
| **Layout** | `LayoutProvider` | `useLayout` | `src/context/layout.tsx` |
| **Settings** | `SettingsProvider` | `useSettings` | `src/context/settings.tsx` |
| **Command** | `CommandProvider` | `useCommand` | `src/context/command.tsx` |
| **Language** | `LanguageProvider` | `useLanguage` | `src/context/language.tsx` |
| **Platform** | `PlatformProvider` | `usePlatform` | `src/context/platform.tsx` |

### Page Components

| Page | Route | Component | File |
|------|-------|-----------|------|
| **Home** | `/` | `Home` | `src/pages/home.tsx` |
| **Directory** | `/:dir` | `DirectoryLayout` | `src/pages/directory-layout.tsx` |
| **Layout** | `/:dir/*` | `Layout` | `src/pages/layout.tsx` |
| **Session** | `/:dir/session/:id?` | `Session` | `src/pages/session.tsx` |
| **Error** | - | `ErrorPage` | `src/pages/error.tsx` |

### Dialog Components

| Dialog | Component | File |
|--------|-----------|------|
| **Connect Provider** | `DialogConnectProvider` | `src/components/dialog-connect-provider.tsx` |
| **Custom Provider** | `DialogCustomProvider` | `src/components/dialog-custom-provider.tsx` |
| **Edit Project** | `DialogEditProject` | `src/components/dialog-edit-project.tsx` |
| **Fork Session** | `DialogFork` | `src/components/dialog-fork.tsx` |
| **Manage Models** | `DialogManageModels` | `src/components/dialog-manage-models.tsx` |
| **Release Notes** | `DialogReleaseNotes` | `src/components/dialog-release-notes.tsx` |
| **Select Directory** | `DialogSelectDirectory` | `src/components/dialog-select-directory.tsx` |
| **Select File** | `DialogSelectFile` | `src/components/dialog-select-file.tsx` |
| **Select MCP** | `DialogSelectMcp` | `src/components/dialog-select-mcp.tsx` |
| **Select Model** | `DialogSelectModel` | `src/components/dialog-select-model.tsx` |
| **Select Model Unpaid** | `DialogSelectModelUnpaid` | `src/components/dialog-select-model-unpaid.tsx` |
| **Select Provider** | `DialogSelectProvider` | `src/components/dialog-select-provider.tsx` |
| **Select Server** | `DialogSelectServer` | `src/components/dialog-select-server.tsx` |
| **Settings** | `DialogSettings` | `src/components/dialog-settings.tsx` |

### Settings Components

| Settings Panel | Component | File |
|----------------|-----------|------|
| **General** | `SettingsGeneral` | `src/components/settings-general.tsx` |
| **Keybinds** | `SettingsKeybinds` | `src/components/settings-keybinds.tsx` |
| **Models** | `SettingsModels` | `src/components/settings-models.tsx` |
| **Providers** | `SettingsProviders` | `src/components/settings-providers.tsx` |
| **Agents** | `SettingsAgents` | `src/components/settings-agents.tsx` |
| **Commands** | `SettingsCommands` | `src/components/settings-commands.tsx` |
| **MCP** | `SettingsMcp` | `src/components/settings-mcp.tsx` |
| **Permissions** | `SettingsPermissions` | `src/components/settings-permissions.tsx` |

### Session Components

| Component | Purpose | File |
|-----------|---------|------|
| **Session Header** | Title, actions, app opener | `src/components/session/session-header.tsx` |
| **Session Context Tab** | Token/context metrics | `src/components/session/session-context-tab.tsx` |
| **Session New View** | Empty state worktree selector | `src/components/session/session-new-view.tsx` |
| **Sortable Tab** | Draggable session tab | `src/components/session/session-sortable-tab.tsx` |
| **Sortable Terminal Tab** | Draggable terminal tab | `src/components/session/session-sortable-terminal-tab.tsx` |
| **Context Usage** | Context usage display | `src/components/session-context-usage.tsx` |

### Prompt Input Components

| Component | Purpose | File |
|-----------|---------|------|
| **Prompt Input** | Main input component | `src/components/prompt-input.tsx` |
| **Attachments** | Image/file attachment handling | `src/components/prompt-input/attachments.ts` |
| **Build Request Parts** | Convert to SDK format | `src/components/prompt-input/build-request-parts.ts` |
| **Context Items** | Context chips display | `src/components/prompt-input/context-items.tsx` |
| **Drag Overlay** | Drag state visual feedback | `src/components/prompt-input/drag-overlay.tsx` |
| **Editor DOM** | ContentEditable management | `src/components/prompt-input/editor-dom.ts` |
| **History** | Prompt history navigation | `src/components/prompt-input/history.ts` |
| **Image Attachments** | Image thumbnail display | `src/components/prompt-input/image-attachments.tsx` |
| **Placeholder** | Dynamic placeholder text | `src/components/prompt-input/placeholder.ts` |
| **Slash Popover** | @mention and /command popover | `src/components/prompt-input/slash-popover.tsx` |
| **Submit** | Submission logic | `src/components/prompt-input/submit.ts` |

### Utility Functions

| Utility | Purpose | File |
|---------|---------|------|
| **Agent Colors** | Agent theme colors | `src/utils/agent.ts` |
| **Aim Tracking** | Mouse tracking for sidebar | `src/utils/aim.ts` |
| **Base64** | URL-safe base64 encoding | `src/utils/base64.ts` |
| **DOM Utils** | DOM selection helpers | `src/utils/dom.ts` |
| **ID Generator** | Prefixed ID generation | `src/utils/id.ts` |
| **Notification Click** | Handle notification actions | `src/utils/notification-click.ts` |
| **Performance** | Navigation timing | `src/utils/perf.ts` |
| **Persist** | localStorage with migration | `src/utils/persist.ts` |
| **Prompt Utils** | Prompt text extraction | `src/utils/prompt.ts` |
| **Runtime Adapters** | VS Code disposable API | `src/utils/runtime-adapters.ts` |
| **Same Check** | Array equality | `src/utils/same.ts` |
| **Scoped Cache** | LRU with TTL | `src/utils/scoped-cache.ts` |
| **Server Health** | Health check with retry | `src/utils/server-health.ts` |
| **Solid DnD** | Drag-drop constraints | `src/utils/solid-dnd.tsx` |
| **Sound** | Audio notifications | `src/utils/sound.ts` |
| **Speech** | Web Speech API | `src/utils/speech.ts` |
| **Terminal Writer** | Output batching | `src/utils/terminal-writer.ts` |
| **Time** | Relative time formatting | `src/utils/time.ts` |
| **UUID** | UUID generation | `src/utils/uuid.ts` |
| **Worktree** | Worktree state management | `src/utils/worktree.ts` |

---

## Requirements Traceability

### Requirements Document

**Location:** `specs/project.md`

### API Endpoints (from specs/project.md)

| Endpoint | Method | Feature | Implementation |
|----------|--------|---------|----------------|
| `/project` | GET | List projects | `src/context/global-sync.tsx` |
| `/project/init` | POST | Initialize project | `src/context/global-sync.tsx` |
| `/project/:projectID/session` | GET | List sessions | `src/context/global-sync.tsx` |
| `/project/:projectID/session` | POST | Create session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID` | GET | Get session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID` | DELETE | Delete session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/init` | POST | Init session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/abort` | POST | Abort session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/share` | POST | Share session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/compact` | POST | Compact session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/message` | GET | List messages | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/message` | POST | Send message | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/revert` | POST | Revert session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/unrevert` | POST | Unrevert session | `src/context/sync.tsx` |
| `/project/:projectID/session/:sessionID/permission/:permissionID` | POST | Respond to permission | `src/context/permission.tsx` |
| `/project/:projectID/session/:sessionID/find/file` | GET | Find files | `src/context/file.tsx` |
| `/project/:projectID/session/:sessionID/file` | GET | Read file | `src/context/file.tsx` |
| `/project/:projectID/session/:sessionID/file/status` | GET | File status | `src/context/sync.tsx` |
| `/provider` | GET | Get provider | `src/context/global-sync.tsx` |
| `/config` | GET | Get config | `src/context/global-sync.tsx` |
| `/project/:projectID/agent` | GET | Get agent | `src/context/global-sync.tsx` |
| `/project/:projectID/find/file` | GET | Find files | `src/context/file.tsx` |

### Feature Requirements Mapping

| Requirement | Feature | Files |
|-------------|---------|-------|
| Multi-project support | Project list, switching | `src/context/global-sync.tsx`, `src/pages/layout/sidebar-project.tsx` |
| Worktree support | Worktree state management | `src/utils/worktree.ts`, `src/components/session/session-new-view.tsx` |
| Session management | Create, delete, fork, revert | `src/context/sync.tsx`, `src/components/dialog-fork.tsx` |
| File management | Tree view, file watching, caching | `src/context/file.tsx`, `src/components/file-tree.tsx` |
| Terminal integration | PTY creation, management | `src/context/terminal.tsx`, `src/components/terminal.tsx` |
| Real-time sync | Event streaming, optimistic updates | `src/context/global-sdk.tsx`, `src/context/sync.tsx` |
| Multi-language support | 16 language translations | `src/i18n/*.ts`, `src/context/language.tsx` |
| Desktop native features | File pickers, auto-updater, deep links | `packages/desktop/src/index.tsx` |
| Command palette | Keybinds, slash commands | `src/context/command.tsx` |
| Settings management | Multiple settings panels | `src/components/settings-*.tsx` |
| Notification system | Browser notifications, sounds | `src/context/notification.tsx` |
| Session sharing | Public share links | `packages/web/src/components/Share.tsx` |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Total Source Files (app)** | ~150+ |
| **Context Providers** | 20+ |
| **Dialog Components** | 14 |
| **Settings Panels** | 8 |
| **Session Components** | 10+ |
| **Prompt Input Components** | 11 |
| **Utility Modules** | 25+ |
| **i18n Languages** | 16 |
| **E2E Test Files** | 30+ |
| **Desktop Tauri Commands** | 12 |
| **Desktop Menu Items** | 25+ |

---

*This document provides a comprehensive mapping of features to implementation files in the OpenCode client codebase.*
