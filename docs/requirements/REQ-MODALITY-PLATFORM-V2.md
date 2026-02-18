---
id: REQ-MODALITY-PLATFORM-V2
author: oracle_7c4a
status: ACTIVE
date: 2026-02-16
updated: 2026-02-16
purpose: Canonical requirements baseline and active backlog for all modalities
note: Updated to reflect Theia extension architecture (CommandRegistry + %%OS{...}%% stream interceptor pattern)
---

# Requirements: Modality Platform V2

> **Document Type:** Requirements Document (Active - Single Source of Truth)  
> **Purpose:** Single active requirements baseline for all supported modalities with implementation tracking  
> **Audience:** Product, engineering, and QA teams  
> **Related Documents:**
> - [Theia Openspace TECHSPEC](../architecture/TECHSPEC-THEIA-OPENSPACE.md) - System architecture (source of truth)
> - [Theia Openspace WORKPLAN](../architecture/WORKPLAN.md) - Phased implementation plan
> - [Openspace Feature Requirements](./REQ-OPENSPACE.md) - Feature-level requirements with test tracking
> - ~~[Modality Platform V2 Spec](../architecture/TECHSPEC-MODALITY-PLATFORM-V2.md)~~ - *(archived, superseded by TECHSPEC-THEIA-OPENSPACE)*
> - ~~[Hub/MCP Architecture](../architecture/HUB-MCP-ARCHITECTURE.md)~~ - *(archived, superseded by TECHSPEC §6 CommandRegistry)*

## 1. Purpose

Define a single active requirements baseline for all supported modalities, aligned to:
- `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` (Theia extension architecture)
- `docs/architecture/WORKPLAN.md` (phased implementation plan)

This document consolidates requirements previously spread across legacy modality guides.

> **Architecture note:** The Theia Openspace platform uses **Theia's CommandRegistry** as the agent command mechanism. Agent commands are registered as `openspace.*` commands in the CommandRegistry. The agent emits `%%OS{...}%%` blocks in its response stream, which are intercepted by the stream interceptor (TECHSPEC §6.5), stripped from the chat display, and relayed to the CommandRegistry via the Hub + BridgeContribution. This replaces the previous MCP tool architecture. Throughout this document, references to "commands" mean CommandRegistry commands, not MCP tools.

## 2. Active Modality Set

**Current Focus (MVP):**
1. **Presentation** - Slide deck creation, editing, playback
2. **Editor/Viewer** - Text/code editing with agent collaboration
3. **Whiteboard** - Visual collaboration canvas (unified with Drawing)

**Deferred (Post-MVP):**
4. Diff Review
5. Comments
6. Annotation
7. Voice
8. Browser Snapshot Preview

---

## 3. System & Framework Requirements

### 3.1 Platform-Wide User Stories

- `US-SYS-001` As a user, I can open each artifact in exactly one canonical modality surface.
- `US-SYS-002` As a user, I can co-edit with the agent without data corruption.
- `US-SYS-003` As a user, I receive explicit validation failures, not silent degradation.
- `US-SYS-004` As a user, unchanged content/layout/style stays stable after incremental updates.
- `US-SYS-005` As a user, cross-modality handoffs are predictable and deterministic.
- `US-SYS-006` As a user, active context and key view state can be restored across sessions.

### 3.2 Platform Functional Requirements

#### Core Architecture
| ID | Requirement | Priority |
|---|---|---|
| REQ-SYS-001 | Every modality defines a canonical artifact model; projections/adapters are derived outputs. | Must |
| REQ-SYS-002 | Agent mutations are patch/operation based; blind full-document agent rewrites are disallowed. | Must |
| REQ-SYS-003 | Mutations pass schema + semantic + policy validation before apply. | Must |
| REQ-SYS-004 | Apply operations are atomic and versioned. | Must |
| REQ-SYS-005 | Runtime emits update/apply/failure events with modality, artifact, actor, timestamp. | Must |

#### Context & Handoff
| ID | Requirement | Priority |
|---|---|---|
| REQ-SYS-006 | Active context uses one unified context contract for all modalities. | Must |
| REQ-SYS-007 | Cross-modality handoff payloads include source modality, target path/id, and optional location metadata. | Must |

#### Security & Safety
| ID | Requirement | Priority |
|---|---|---|
| REQ-SYS-008 | All file paths are normalized and constrained to workspace root. | Must |
| REQ-SYS-009 | External I/O paths emit start/success/failure logs with ISO timestamps. | Must |
| REQ-SYS-010 | Poll/retry loops apply a shared `MIN_INTERVAL` in success and failure paths. | Must |

#### Agent-to-Client Command Channel
| ID | Requirement | Priority |
|---|---|---|
| REQ-SYS-011 | Agent can command the client UI to open/close/focus panes and modalities via `%%OS{...}%%` blocks in its response stream, intercepted and relayed through the Hub → BridgeContribution → CommandRegistry pipeline. | Must |
| REQ-SYS-012 | Agent commands are emitted as `%%OS{"cmd":"openspace.*","args":{...}}%%` blocks in the LLM response stream. The stream interceptor strips these blocks before displaying text to the user. | Must |
| REQ-SYS-013 | BridgeContribution listens for `AGENT_COMMAND` SSE events from the Hub and dispatches them to `CommandRegistry.executeCommand()`. | Must |
| REQ-SYS-014 | The Hub auto-generates a system prompt at `GET /openspace/instructions` that includes the full command inventory, argument schemas, and current IDE state. New commands registered in the CommandRegistry automatically appear in the agent's system prompt. | Must |

---

## 4. Pane & Tab System Requirements

### 4.1 Pane & Tab System User Stories

#### Pane Management (User)
- `US-PANE-001` As a user, I can manually split, rearrange, resize, and close panes without agent interference.
- `US-PANE-002` As a user, I can arrange my workspace layout (pane configuration) and have it persist across sessions, while content within panes/tabs may change.
- `US-PANE-003` As a user, I can save multiple workspace layouts and switch between them (e.g., "coding layout", "review layout", "presentation layout").
- `US-PANE-004` As a user, when I reopen the workspace, my last pane configuration is restored, even if some content is no longer available.

#### Tab Management (User)
- `US-PANE-005` As a user, I can focus a tab by clicking on it.
- `US-PANE-006` As a user, I can close a tab using the close button or keyboard shortcut (Cmd+W).
- `US-PANE-007` As a user, when content is opened in the active pane, it creates a new tab (or activates existing tab if content is already open).
- `US-PANE-008` As a user, I can reorder tabs within a pane by dragging them.
- `US-PANE-009` As a user, I can drag a tab to another pane to move it.

#### Agent Control (Agent)
- `US-PANE-010` As an agent, I can open, close, and navigate modalities on the user's behalf — showing them files, drawings, presentations, and highlighting relevant content.
- `US-PANE-011` As an agent, I can query what panes and tabs are currently open to understand the user's workspace.
- `US-PANE-012` As an agent, I can open content in a new pane (side-by-side) or in the current pane, matching the user's workflow preference.
- `US-PANE-013` As an agent, I can resize panes to optimize the user's workspace layout for a specific task.

### 4.2 Pane System Functional Requirements

#### Core Pane Operations
| ID | Requirement | Priority |
|---|---|---|
| REQ-PANE-001 | `openspace.pane.open` command accepts `{ type: SpaceType, title: string, contentId?: string, targetPaneId?: string, newPane?: boolean, splitDirection?: 'horizontal' \| 'vertical' }` and opens content in the client UI. | Must |
| REQ-PANE-002 | `openspace.pane.close` command accepts `{ paneId?: string, contentId?: string }` and closes the specified pane or tab. | Must |
| REQ-PANE-003 | `openspace.pane.focus` command accepts `{ paneId?: string, contentId?: string }` and activates the target pane/tab. | Must |
| REQ-PANE-004 | Pane commands that reference non-existent pane IDs return clear error messages rather than silent no-ops. | Must |

#### Pane Layout & Geometry
| ID | Requirement | Priority |
|---|---|---|
| REQ-PANE-005 | `openspace.pane.list` command returns the current pane layout tree with pane IDs, active tabs, content descriptions, and geometry. | Must |
| REQ-PANE-006 | Pane geometry includes viewport position (x, y) and dimensions (width, height) as percentages. | Must |
| REQ-PANE-007 | Split pane geometry includes split ratios for intelligent resize decisions. | Must |
| REQ-PANE-008 | `openspace.pane.resize` command accepts `{ paneId: string, width?: number, height?: number }` (percentages) and resizes the target pane. | Should |

#### Pane Configuration Persistence
| ID | Requirement | Priority |
|---|---|---|
| REQ-PANE-009 | Pane configuration persists to disk: layout tree structure, split ratios, pane dimensions, and positions. | Must |
| REQ-PANE-010 | Content within panes (which tabs are open) is tracked separately from pane configuration. | Must |
| REQ-PANE-011 | On session restore, pane configuration (layout structure) is restored first; content restoration is optional and configurable. | Must |
| REQ-PANE-012 | If persisted content is unavailable (file deleted, artifact missing), the pane remains with an empty state or placeholder, preserving layout. | Must |
| REQ-PANE-013 | User can save named workspace layouts (e.g., "coding", "review") and switch between them. | Should |
| REQ-PANE-014 | User manual pane operations (drag, resize, close) are not intercepted or overridden by agent commands. | Must |

#### Tab Management
| ID | Requirement | Priority |
|---|---|---|
| REQ-PANE-015 | Each pane can contain multiple tabs with one active tab at a time. | Must |
| REQ-PANE-016 | Tab identity is deterministic based on content type + content ID (e.g., `editor:path/to/file.ts`). | Must |
| REQ-PANE-017 | Opening duplicate content in the same pane activates the existing tab instead of creating a new tab. | Must |
| REQ-PANE-018 | Opening content in the active pane (without `newPane: true`) creates a new tab in that pane. | Must |
| REQ-PANE-019 | User can focus a tab by clicking on it or using keyboard shortcuts (Cmd+1..9 for tab index). | Must |
| REQ-PANE-020 | User can close a tab using close button (×), keyboard shortcut (Cmd+W), or middle-click. | Must |
| REQ-PANE-021 | User can reorder tabs within a pane by drag-and-drop. | Should |
| REQ-PANE-022 | User can drag a tab to another pane to move it (detach from source, attach to target). | Should |
| REQ-PANE-023 | Tabs preserve per-tab view state (scroll, cursor, selection) keyed by content ID without cross-tab leakage. | Must |
| REQ-PANE-024 | Tab close action prompts for save if content is dirty (modified but unsaved). | Must |

---

## 5. Modality Requirements

### 5.1 Presentation Modality

#### 5.1.1 User Stories

**User (Direct File Editing):**
- `US-PRES-001` As a user, I can edit presentation deck files directly as Markdown (`.deck.md`) in the editor.
- `US-PRES-002` As a user, I can view the rendered presentation in playback mode.
- `US-PRES-003` As a user, I can present with playback controls (play, pause, stop, next, previous).
- `US-PRES-004` As a user, I can export the deck to PDF for sharing.
- `US-PRES-005` As a user, I can add narration metadata to slides without changing the deck format.
- `US-PRES-006` As a user, external changes to the deck file (from editor or agent) are reflected in the presentation view in real-time.

**Agent (Programmatic Deck Generation):**
- `US-PRES-007` As an agent, I can generate a complete deck from project artifacts (code, docs, diagrams).
- `US-PRES-008` As an agent, I can create a new presentation deck with title and initial slides.
- `US-PRES-009` As an agent, I can update a single slide without changing other slides (surgical edits).
- `US-PRES-010` As an agent, I can open a presentation in a pane and navigate to a specific slide to show the user.
- `US-PRES-011` As an agent, I can control playback (play, pause, stop) during presentation mode.

#### 5.1.2 Artifact & Data Model

| ID | Requirement | Priority |
|---|---|---|
| REQ-PRES-001 | Canonical artifact: `docs/deck/<name>.deck.md`. | Must |
| REQ-PRES-002 | Deck supports YAML frontmatter + `---` slide delimiter. | Must |
| REQ-PRES-003 | Slide updates validate index and preserve untouched slides exactly (no reordering, no whitespace changes). | Must |
| REQ-PRES-004 | Realtime refresh on external deck updates (file watch with debounce). | Must |

#### 5.1.3 CommandRegistry Commands (Agent Control)

| ID | Requirement | Priority |
|---|---|---|
| REQ-PRES-005 | `openspace.presentation.list` command returns all available decks in workspace. | Must |
| REQ-PRES-006 | `openspace.presentation.read` command accepts `{ name?: string, path?: string }` and returns deck metadata + all slides. | Must |
| REQ-PRES-007 | `openspace.presentation.create` command accepts `{ name: string, title?: string, slides?: SlideContent[] }` and creates a new deck. | Must |
| REQ-PRES-008 | `openspace.presentation.update_slide` command accepts `{ name: string, slideIndex: number, content: string }` and updates a single slide. | Must |
| REQ-PRES-009 | `openspace.presentation.open` command accepts `{ name?: string, path?: string, newPane?: boolean }` and opens a presentation deck in a pane. | Must |
| REQ-PRES-010 | `openspace.presentation.navigate` command accepts `{ name?: string, slideIndex: number }` and navigates the active presentation to the specified slide. | Must |
| REQ-PRES-011 | `openspace.presentation.play` command starts playback in the active presentation. | Should |
| REQ-PRES-012 | `openspace.presentation.pause` command pauses playback in the active presentation. | Should |
| REQ-PRES-013 | `openspace.presentation.stop` command stops playback and returns to edit mode. | Should |

#### 5.1.4 UI & Playback

| ID | Requirement | Priority |
|---|---|---|
| REQ-PRES-014 | Presentation view is read-only; editing happens in the editor modality on the `.deck.md` file. | Must |
| REQ-PRES-015 | Playback states: `stopped \| running \| paused`. | Must |
| REQ-PRES-016 | User can manually navigate slides via keyboard (arrow keys, PgUp/PgDn) and UI controls. | Must |
| REQ-PRES-017 | PDF export path with actionable error handling (missing deps, write failures). | Should |
| REQ-PRES-018 | Presentation UI includes "Edit Source" button that opens the `.deck.md` file in the editor. | Should |

#### 5.1.5 Future Expansion (Deferred)

| ID | Requirement | Priority |
|---|---|---|
| REQ-PRES-019 | WYSIWYG slide editor (in-UI editing without touching `.deck.md`). | Future |
| REQ-PRES-020 | Deferred hooks for comment/annotate entry points. | Future |

---

### 5.2 Editor/Viewer Modality

#### 5.2.1 User Stories

**Core Editing:**
- `US-EDT-001` As a user, I can open a file in the editor surface.
- `US-EDT-002` As a user, I can edit and save with clear dirty state indication.
- `US-EDT-003` As a user, I can edit multiple files in tabs with preserved cursor/scroll per tab.
- `US-EDT-004` As a user, external file changes are handled gracefully (reload prompt for clean tabs, conflict warning for dirty tabs).
- `US-EDT-005` As a user, I can toggle between Markdown edit and preview modes with Mermaid rendering.
- `US-EDT-006` As a user, navigation history and session state are stable and restorable.

**Agent Collaboration:**
- `US-EDT-007` As a user, I can follow agent-guided reveal to a specific file and exact location during explanation.
- `US-EDT-008` As a user, I see a transient visual highlight for the exact range the agent references.
- `US-EDT-009` As a user, I can reclaim manual control immediately from agent-guided focus via Escape.
- `US-EDT-010` As a user, I can return to my prior location after agent-guided jumps.
- `US-EDT-011` As a user, I can review agent-proposed edits safely before applying when local file state is dirty.
- `US-EDT-012` As a user, when opening a file from diff review, the selected diff context is preserved.

#### 5.2.2 Artifact & Data Model

| ID | Requirement | Priority |
|---|---|---|
| REQ-EDT-001 | Text/code/markdown/config files supported for MVP. | Must |
| REQ-EDT-002 | Deterministic tab identity via normalized path. | Must |
| REQ-EDT-003 | Save path goes through validated mutation pipeline (patch/operation, not full rewrite). | Must |
| REQ-EDT-004 | Viewer registry supports extensible viewer adapters (Markdown, Mermaid, future image/PDF). | Must |
| REQ-EDT-005 | Multi-tab editor runtime preserves per-tab model + view state (cursor/scroll/selection) keyed by normalized path without cross-tab state leakage. | Must |

#### 5.2.3 CommandRegistry Commands (Agent Control)

| ID | Requirement | Priority |
|---|---|---|
| REQ-EDT-006 | `openspace.editor.open` command accepts `{ path: string, line?: number, endLine?: number, column?: number, endColumn?: number, highlight?: boolean, mode?: 'edit' \| 'view', newPane?: boolean }` and opens the file in the editor. | Must |
| REQ-EDT-007 | `openspace.editor.open` with `line` parameter scrolls to the specified line and optionally highlights the range. | Must |
| REQ-EDT-008 | `openspace.editor.read_file` command accepts `{ path: string, startLine?: number, endLine?: number }` and returns file content (full or range). | Must |
| REQ-EDT-009 | `openspace.editor.close` command accepts `{ path: string }` and closes the editor tab for that file. | Must |
| REQ-EDT-010 | `openspace.editor.scroll_to` command accepts `{ path: string, line: number, column?: number }` and scrolls the editor to the target location. | Must |
| REQ-EDT-011 | `openspace.editor.highlight` command accepts `{ path: string, ranges: [{ startLine, startColumn?, endLine, endColumn? }], highlightId?: string }` and applies transient highlights. | Must |
| REQ-EDT-012 | `openspace.editor.clear_highlight` command accepts `{ path: string, highlightId?: string }` and clears highlights (all if no ID specified). | Must |
| REQ-EDT-013 | All editor commands return structured success/error responses with actionable messages. | Must |

#### 5.2.4 Agent-Guided Navigation

| ID | Requirement | Priority |
|---|---|---|
| REQ-EDT-014 | `openFileAt(path, selection?, options?)` accepts normalized line/column range (`startLine`, `startColumn`, `endLine`, `endColumn`) and resolves deterministically. | Must |
| REQ-EDT-015 | Agent walkthrough highlights support explicit lifecycle actions (`apply`, `update`, `clear`) with stable highlight IDs. | Must |
| REQ-EDT-016 | Agent reveal default is `auto-focus`; user can change policy in settings to `suggest-only` or `disabled`. | Must |
| REQ-EDT-017 | Escape immediately exits active agent-guided focus/highlight mode and returns control to user navigation. | Must |
| REQ-EDT-018 | Agent reveal opens side-by-side editor pane by default (configurable). | Must |
| REQ-EDT-019 | Navigation history supports deterministic jump-back after any agent-guided reveal. | Must |
| REQ-EDT-020 | Line-range highlight is required for MVP; highlight API remains extensible for token/text-range targeting without breaking contract. | Must |

#### 5.2.5 Agent Edit Collaboration

| ID | Requirement | Priority |
|---|---|---|
| REQ-EDT-021 | Dirty-tab agent edit flow is preview-first and non-destructive; default action applies to buffer, with optional explicit apply-to-disk path. | Must |
| REQ-EDT-022 | Agent-driven editor file writes use validated patch/operation pipeline; blind full-document rewrite is disallowed. | Must |

#### 5.2.6 UI & Interaction

| ID | Requirement | Priority |
|---|---|---|
| REQ-EDT-023 | Keyboard save/close/switch shortcuts (Cmd+S, Cmd+W, Cmd+Tab). | Must |
| REQ-EDT-024 | MVP editor command surface includes open/save/save-as, undo/redo, cut/copy/paste, find/replace (single-file), toggle line comment, and deterministic go-to-location reveal. | Must |
| REQ-EDT-025 | Deferred editor commands outside MVP scope (including workspace-wide find and advanced IDE refactors) are explicitly unavailable; no silent no-op command paths. | Must |
| REQ-EDT-026 | Editor/viewer appearance controls include zoom in/out/reset and font size increase/decrease/reset, with keyboard shortcuts and settings persistence. | Should |
| REQ-EDT-027 | Clickable file/location links from agent conversation and other modality surfaces (including presentation) resolve through `openFileAt` and open editor at target range deterministically. | Must |

#### 5.2.7 External Open Hook

| ID | Requirement | Priority |
|---|---|---|
| REQ-EDT-028 | External open hook: `openFileAt(path, selection?)` available for cross-modality integration. | Must |

---

### 5.3 Whiteboard Modality

#### 5.3.1 User Stories

**User (Manual Diagramming):**
- `US-WB-001` As a user, I can create and edit visual diagrams on a whiteboard canvas using a drawing toolbar.
- `US-WB-002` As a user, I can create structured diagrams (block diagrams, class diagrams, state machines, flowcharts, sequence diagrams) using smart shapes and connectors.
- `US-WB-003` As a user, whiteboard state persists and is restorable across sessions.
- `US-WB-004` As a user, there is one unified whiteboard modality (no confusion between "drawing" and "whiteboard").

**Agent (Programmatic Diagram Generation):**
- `US-WB-005` As an agent, I can create, update, and delete shapes programmatically.
- `US-WB-006` As an agent, I can generate structured diagrams (class diagrams, state machines, etc.) from code or specifications.
- `US-WB-007` As an agent, I can navigate the whiteboard camera to show the user specific shapes or regions.
- `US-WB-008` As an agent, I can open a whiteboard in a pane and focus on a specific shape or region.

#### 5.3.2 Artifact & Data Model

| ID | Requirement | Priority |
|---|---|---|
| REQ-WB-001 | Canonical artifact: `docs/whiteboard/<name>.whiteboard.json` (tldraw format). | Must |
| REQ-WB-002 | Whiteboard uses patch/operation-based mutations (no blind full-document rewrites). | Must |
| REQ-WB-003 | Realtime refresh on external whiteboard updates (file watch with debounce). | Must |
| REQ-WB-004 | Whiteboard state includes camera position/zoom as part of persisted view state. | Must |

#### 5.3.3 CommandRegistry Commands (Agent Control)

##### Shape Operations
| ID | Requirement | Priority |
|---|---|---|
| REQ-WB-005 | `openspace.whiteboard.list` command returns all available whiteboards in workspace. | Must |
| REQ-WB-006 | `openspace.whiteboard.read` command accepts `{ name?: string, path?: string }` and returns whiteboard metadata + shapes. | Must |
| REQ-WB-007 | `openspace.whiteboard.create` command accepts `{ name: string, title?: string }` and creates a new whiteboard. | Must |
| REQ-WB-008 | `openspace.whiteboard.add_shape` command accepts `{ name: string, shape: ShapeDefinition }` and adds a shape. | Must |
| REQ-WB-009 | `openspace.whiteboard.update_shape` command accepts `{ name: string, shapeId: string, updates: Partial<ShapeDefinition> }` and updates a shape. | Must |
| REQ-WB-010 | `openspace.whiteboard.delete_shape` command accepts `{ name: string, shapeId: string }` and deletes a shape. | Must |

##### Pane & Camera Control
| ID | Requirement | Priority |
|---|---|---|
| REQ-WB-011 | `openspace.whiteboard.open` command accepts `{ name?: string, path?: string, newPane?: boolean }` and opens a whiteboard in a pane. | Must |
| REQ-WB-012 | `openspace.whiteboard.camera.set` command accepts `{ name?: string, x: number, y: number, zoom: number }` and sets camera position/zoom. | Must |
| REQ-WB-013 | `openspace.whiteboard.camera.fit` command accepts `{ name?: string, shapeIds?: string[], padding?: number }` and fits camera to shapes or entire canvas. | Should |
| REQ-WB-014 | `openspace.whiteboard.camera.get` command returns current camera position/zoom for the active whiteboard. | Should |

#### 5.3.4 Diagram Types & Building Blocks

| ID | Requirement | Priority |
|---|---|---|
| REQ-WB-015 | Whiteboard supports basic shapes: rectangle, circle, ellipse, triangle, arrow, line, text. | Must |
| REQ-WB-016 | Whiteboard supports connectors: straight line, elbow connector, curved connector with arrow heads. | Must |
| REQ-WB-017 | Whiteboard supports smart shapes for **block diagrams**: box, rounded box, cylinder, cloud, actor (stick figure). | Must |
| REQ-WB-018 | Whiteboard supports smart shapes for **class diagrams**: class box (with sections for name/attributes/methods), interface, abstract class, inheritance arrow, composition arrow, aggregation arrow. | Should |
| REQ-WB-019 | Whiteboard supports smart shapes for **state machines**: state (rounded rectangle), initial state (filled circle), final state (double circle), transition arrow with label. | Should |
| REQ-WB-020 | Whiteboard supports smart shapes for **flowcharts**: process (rectangle), decision (diamond), start/end (rounded rectangle), input/output (parallelogram), connector (circle). | Should |
| REQ-WB-021 | Whiteboard supports smart shapes for **sequence diagrams**: lifeline (vertical dashed line), activation box, message arrow (sync/async/return). | Could |
| REQ-WB-022 | Agent can programmatically create and position any supported shape type via CommandRegistry commands. | Must |
| REQ-WB-023 | Agent can programmatically create connections between shapes with anchor points. | Must |
| REQ-WB-024 | Shape library is extensible; new shape types can be added without breaking existing whiteboard contracts. | Should |

#### 5.3.5 Modality Unification

| ID | Requirement | Priority |
|---|---|---|
| REQ-WB-025 | Drawing V2 implementation is merged into whiteboard modality (single unified surface). | Must |
| REQ-WB-026 | Legacy `drawing.*` commands are deprecated in favor of `openspace.whiteboard.*` commands. | Must |
| REQ-WB-027 | Migration path exists for legacy drawing artifacts to whiteboard format. | Should |

---

## 6. Deferred Modalities (Out of Scope for MVP)

The following modalities are defined but not prioritized for current implementation:

### 6.1 Diff Review
See legacy requirements in Section 5.3 of previous document version (archived).

### 6.2 Comments
See legacy requirements in Section 5.4 of previous document version (archived).

### 6.3 Annotation
See legacy requirements in Section 5.5 of previous document version (archived).

### 6.4 Voice
**Status:** IMPLEMENTED (BLK-007 complete).  
See legacy requirements in Section 5.6 of previous document version (archived).

### 6.5 Browser Snapshot Preview
See legacy requirements in Section 5.7 of previous document version (archived).

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Deterministic behavior for same base version + same operations. | Stable replay outcomes |
| NFR-002 | Failure transparency with actionable errors. | No silent failure paths |
| NFR-003 | Security and path safety for all artifact operations. | No traversal escapes |
| NFR-004 | Bounded memory/cache strategy in each modality. | Documented limits |
| NFR-005 | Test coverage at unit, integration, and e2e levels per modality critical path. | Required for release |
| NFR-006 | Cross-modality payload determinism for repeated actions. | Stable payload identity |

---

## 8. Implementation Backlog

> **Architecture transition note:** This backlog has been realigned to the Theia extension architecture. The previous `openspace-client` React app is being replaced by a Theia-based application with extensions. All commands are now registered in Theia's `CommandRegistry` (prefixed `openspace.*`) and invoked by the agent via `%%OS{...}%%` blocks in the response stream. See [WORKPLAN.md](../architecture/WORKPLAN.md) for the phased implementation plan.

### 8.1 Completed Backlog Items

| Backlog ID | Scope | Requirement IDs | Status | Exit Criteria |
|---|---|---|---|---|
| BLK-001 | Platform foundations (legacy) | REQ-SYS-001..010 | ✅ done | *(Implemented in old client; requirements carried forward to Theia architecture)* |
| BLK-007 | Voice MVP (legacy) | (archived) | ✅ done | Input/output/policy/interruption/streaming core, tests green |
| BLK-THEIA-000 | Theia scaffold (Phase 0) | REQ-SYS-011..014 | ✅ done | Theia 1.68.2 pinned, 6 extensions stubbed, browser app runs, FilterContribution removes Debug/SCM, echo chat agent works, CI pipeline |

### 8.2 In-Progress Backlog Items

| Backlog ID | Scope | Requirement IDs | Status | Exit Criteria |
|---|---|---|---|---|
| BLK-THEIA-001 | Core Connection + Hub (Phase 1) | REQ-SYS-011..014 | ⬜ PLANNED | OpenCodeProxy, SessionService, Hub, BridgeContribution, SyncService, chat widget, permission handling. See WORKPLAN Phase 1. |

### 8.3 Planned Backlog Items

| Backlog ID | Scope | Requirement IDs | Priority | Exit Criteria |
|---|---|---|---|---|
| BLK-THEIA-002 | Chat & Prompt System (Phase 2) | REQ-SYS-* (chat) | **P0** | Multi-part prompts, streaming, response renderers, session CRUD, token display |
| BLK-THEIA-003 | Agent IDE Control (Phase 3) | REQ-PANE-001..008, REQ-EDT-006..013 | **P0** | Stream interceptor, all `openspace.*` commands, manifest auto-gen, system prompt, pane state publishing, command result feedback |
| BLK-THEIA-004 | Presentation Modality (Phase 4) | REQ-PRES-001..020 | **P1** | reveal.js widget, deck CRUD, playback, agent commands, integration test |
| BLK-THEIA-005 | Whiteboard Modality (Phase 4) | REQ-WB-001..024 | **P1** | tldraw widget, basic shapes, camera control, agent commands, integration test |
| BLK-THEIA-006 | Whiteboard Unification (Phase 4/6) | REQ-WB-025..027 | **P1** | Single whiteboard modality, legacy drawing commands deprecated |
| BLK-THEIA-007 | Polish & Desktop (Phase 5) | REQ-PANE-009..024, NFR-* | **P2** | Layout persistence, theming, settings UI, Electron build, E2E tests |
| BLK-THEIA-008 | Custom tldraw shapes (Phase 6) | REQ-WB-015..024 | **P3** | Custom shape types for structured diagrams (class, state, flowchart, sequence) |

### 8.4 Legacy Backlog Items (Archived)

> The following items were from the `openspace-client` React app architecture. They are retained for reference but are now superseded by the `BLK-THEIA-*` items above. The underlying requirements (REQ-*) remain valid; only the implementation approach has changed.

| Backlog ID | Scope | Status | Note |
|---|---|---|---|
| BLK-003 | Editor/Viewer MVP (old client) | ⚠️ SUPERSEDED | Requirements carried forward as BLK-THEIA-003 (Phase 3 editor commands) |
| BLK-009 | Drawing V2 → Whiteboard (old client) | ⚠️ SUPERSEDED | Requirements carried forward as BLK-THEIA-005/006 (Phase 4 whiteboard) |
| BLK-012 | Editor Line Navigation Fix | ⚠️ SUPERSEDED | Bug was in old `useAgentCommands.ts`; new Theia implementation will address natively (WORKPLAN 3.3) |
| BLK-013 | Editor Highlighting | ⚠️ SUPERSEDED | Covered by WORKPLAN 3.3 (`openspace.editor.highlight` command) |
| BLK-014 | Pane Geometry & Resize | ⚠️ SUPERSEDED | Covered by WORKPLAN 3.1/3.2 (`PaneService` + pane commands) |
| BLK-015 | Whiteboard Camera Control | ⚠️ SUPERSEDED | Covered by WORKPLAN 4.6 (whiteboard commands) |
| BLK-016 | Modality Unification | ⚠️ SUPERSEDED | Covered by BLK-THEIA-006 |
| BLK-017 | Presentation Playback | ⚠️ SUPERSEDED | Covered by BLK-THEIA-004 |
| BLK-018 | Whiteboard Diagram Types | ⚠️ SUPERSEDED | Covered by BLK-THEIA-008 (Phase 6 — deferred) |
| BLK-019 | Pane Config Persistence | ⚠️ SUPERSEDED | Covered by WORKPLAN 5.5 |
| BLK-020 | Tab Management UX | ⚠️ SUPERSEDED | Theia provides built-in tab management; customizations in Phase 5 |

### 8.5 Backlog Completion Rules

- A backlog item can be marked `done` only if all mapped requirements are implemented and the relevant unit/integration/e2e tests pass.
- Keep one primary backlog item `in_progress` at a time; a dependency track already underway may remain `in_progress` when explicitly noted.
- Update this table immediately when status changes.
- Refer to [WORKPLAN.md](../architecture/WORKPLAN.md) for task-level tracking within each backlog item.

---

## 9. Architecture Transition Notes

> **Context:** The original OpenSpace client was a standalone React app (`openspace-client/`) with a Hub/MCP architecture. That client has been superseded by a Theia-based application (`theia-openspace/`) that uses Theia extension APIs. This section documents the transition and key architectural differences.

### 9.1 Architecture Comparison

| Aspect | Old Client (`openspace-client`) | New Client (`theia-openspace`) |
|---|---|---|
| Framework | Custom React app | Theia IDE framework (Eclipse) |
| Agent command mechanism | MCP tools via Hub SSE relay | CommandRegistry commands via `%%OS{...}%%` stream interceptor |
| Pane system | Custom `PaneContext` + React state | Theia `ApplicationShell` + `DockPanel` |
| Editor | Custom Monaco wrapper | Theia's built-in Monaco integration |
| Terminal | Custom xterm.js wrapper | Theia's built-in terminal |
| File system | Custom file service | Theia's `FileService` + `WorkspaceService` |
| Command routing | Hub SSE → `useAgentCommands.ts` → custom event dispatch | Hub SSE → `BridgeContribution` → `CommandRegistry.executeCommand()` |
| System prompt | Hub `GET /openspace/instructions` | Same endpoint, auto-populated from CommandRegistry manifest |
| Permissions | Not implemented | `PermissionService` with dialog UI (TECHSPEC §14) |

### 9.2 Key Implementation Differences

#### Command Registration
- **Old:** Commands defined as MCP tool schemas in Hub config
- **New:** Commands registered as `openspace.*` entries in Theia's `CommandRegistry` with `CommandContribution`. Each command includes argument JSON schema metadata for manifest auto-generation. See WORKPLAN tasks 3.2–3.5.

#### Agent Command Flow
- **Old:** Agent → opencode server → Hub → SSE `PANE_COMMAND` → `useAgentCommands.ts` hook → custom event dispatch
- **New:** Agent emits `%%OS{...}%%` → stream interceptor strips blocks (TECHSPEC §6.5) → posts to Hub `/commands` → Hub relays via SSE → `BridgeContribution` → `CommandRegistry.executeCommand()`

#### Stream Interceptor
- **Old:** Not applicable (MCP tools were direct server calls)
- **New:** `StreamInterceptor` in the backend (TECHSPEC §6.5.1) scans LLM response text for `%%OS{...}%%` patterns, handles chunk-boundary splitting, extracts command JSON, and strips blocks from chat display. This is the core innovation enabling agent IDE control without modifying the opencode server.

### 9.3 Requirement Continuity

All requirements in this document (REQ-SYS-*, REQ-PANE-*, REQ-PRES-*, REQ-EDT-*, REQ-WB-*) remain valid regardless of the architecture transition. The requirements describe **what** the system must do, not **how** it is implemented. The transition from MCP tools to CommandRegistry commands is an implementation detail — the functional contracts (argument schemas, return types, behavior) are preserved.

---

## 10. Scope

### In Scope
- **System & Framework:** Mutation pipeline, validation, events, context, security
- **Pane & Tab System:** Open/close/focus/resize, geometry tracking, state persistence
- **Presentation Modality:** Full MVP (deck CRUD, playback, agent control)
- **Editor Modality:** Full MVP (edit/save, agent navigation/highlight, multi-tab)
- **Whiteboard Modality:** Full MVP (shape CRUD, camera control, unified with drawing)

### Out of Scope (Deferred)
- Diff Review modality
- Comments modality
- Annotation modality
- Browser Snapshot modality
- Advanced IDE features (workspace-wide search, refactoring)

---

## 11. Explicitly Disallowed Patterns

- Re-introducing per-modality active-context endpoint variants as canonical behavior.
- Re-introducing multiple architecture sources of truth.
- Bypassing validation or version checks for agent mutation paths.
- Silent fallback behavior that hides validation or mutation failures.
- Blind full-document rewrites for agent mutations (must use patch/operation pipeline).

---

## 12. Traceability Matrix

| Requirement Group | Verification Method |
|---|---|
| System/framework contracts (REQ-SYS-*) | Unit + integration contract tests |
| Pane system (REQ-PANE-*) | Integration tests + e2e pane manipulation tests |
| Presentation modality (REQ-PRES-*) | Modality unit/component tests + e2e deck workflows |
| Editor modality (REQ-EDT-*) | Modality unit/component tests + e2e editing workflows |
| Whiteboard modality (REQ-WB-*) | Modality unit/component tests + e2e drawing workflows |
| Non-functional requirements (NFR-*) | Log assertions + resilience/safety tests |

---

## 13. Risks and Mitigations

| Perspective | Risk | Mitigation Requirement |
|---|---|---|
| User | Agent auto-focus can feel disruptive during active manual navigation. | `REQ-EDT-016` configurable policy and `REQ-EDT-017` Escape override provide immediate control. |
| Security | Agent-guided file open/write could target unsafe paths or bypass guardrails. | Enforce `REQ-SYS-008` path normalization and `REQ-EDT-022` patch/operation-only write path. |
| SRE/Operations | Frequent reveal/highlight events can create noisy, hard-to-debug interaction traces. | Emit deterministic events under `REQ-SYS-005`; include actor/modality/artifact/timestamp for auditability. |
| Product Reliability | Dirty-tab agent edits can silently clobber user edits. | `REQ-EDT-021` preview-first non-destructive flow with explicit user choice. |
| Accessibility/Usability | Transient highlights may be missed in rapid walkthroughs. | Keep minimum visible dwell for active step and allow jump-back via `REQ-EDT-019`. |
