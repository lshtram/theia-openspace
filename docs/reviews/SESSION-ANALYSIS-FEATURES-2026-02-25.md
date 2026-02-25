# Features Extracted from Session Analysis

## Overview
This document contains all features/requirements extracted from chronological session review (Feb 18-25, 2026).

## Source
- Session files: `/Users/agentuser/.local/share/opencode/storage/session_diff/`
- Analysis period: Phase 2+ (Feb 18, 2026 - present)

---

## Phase 1C (Feb 18)

### Chat/Session Features
- Chat session auto-load on project change (subscribes to `onActiveProjectChanged`)
- Chat session loading state (`isLoadingSessions`) with 100ms minimum display
- Chat error state with retry button
- Chat auto-scroll fix (unconditional scroll, "new messages" indicator when user scrolls up)
- Chat widget moved to right sidebar with float-to-window support

### Pane Features
- `pane.open` with `sourcePaneId` for splitting existing panes

### Code Hardening
- Test hooks guard with NODE_ENV check
- Symlink traversal validation
- Focus trap in permission dialog

### Presentation Modality
- 10 MCP tools
- reveal.js widget wired to pane
- RevealMarkdown plugin
- Live reload support

### Architecture
- Stream interceptor retired - MCP as sole command path

---

## Phase 1C.5-1C.7 (Feb 18-19)

### Test Infrastructure
- E2E test infrastructure fixes (`waitForTimeout` → proper waitFor)
- MessageService usage instead of `window.confirm`
- Security validation checklist
- Test coverage expansion across extensions

---

## Phase 2B SDK Adoption (Feb 18)

### Type System
- Hybrid type bridge (ESM → CJS)
- Type extraction npm script (`extract-sdk-types.js`)
- Field name mapping bridge (modelId → model, type → object)

---

## Phase 3/4 (Feb 19-20)

### draw-diagram Skill
21 diagram types:
- flowchart
- sequence
- class
- state
- activity
- use-case
- component
- deployment
- object
- timing
- er (entity-relationship)
- gantt
- mind-map
- network
- block
- c4-context
- c4-container
- composite-structure
- communication
- interaction-overview
- timing

### Themes
- technical
- presentation
- beautiful

### Whiteboard Modality
- diagram.json scene-graph format
- tldraw shapes integration
- `batch_add_shapes` tool
- `replace` tool (atomic clear and redraw)
- `find_shapes` tool

### Presentation Modality
- Reveal.js integration
- Presentation builder skill

### Chat Rendering Enhancements
- Mermaid diagram rendering (`mermaid` library)
- ANSI terminal color rendering (`anser` library)
- Diff highlighting with CSS backgrounds
- Emoji shortcode support (markdown-it-emoji)
- Inline math rendering (KaTeX, markdown-it-texmath)
- Manage Models preference UI (`openspace.models.enabled`)

### Voice Extension
- Voice extension design for TTS/STT
- openspace-voice integration

---

## Bug Fixes Round 1-2 (Feb 20)

- Turn group collapsible for tool cards
- Slash/@ popup menus (overflow: hidden fix)
- Stop button streaming state reset
- Question rendering fix
- Syntax highlighting light theme
- Session spinner keyframes
- File paths as clickable links
- Ctrl+U clear prompt

---

## Phase 5 (Feb 21-25)

### Security
- XSS hardening: DOMPurify config
- Mermaid sanitization
- ANSI sanitization (script tag injection prevention)
- Test hooks guarded by NODE_ENV

### Streaming State
- Server-authoritative `sessionBusy` state
- SSE as single source of truth for messages

### Hub/Startup
- Hub readiness gate (prevents session creation race)
- Improved retry logic - only network errors trigger retries

### Validation
- Centralized path-validator replacing scattered checks
- diff-utils line limit (MAX_DIFF_LINES = 1000)

### E2E Infrastructure
- E2E pre-check script (`e2e-precheck.sh`)
- Workspace trust dialog dismissal
- Playwright config with retries

### Build Performance
- Webpack filesystem cache (~45s → ~5s builds)

### UI Features
- Tab double-click toggle utility
- Viewer-Editor toggle pattern
- Console log cleanup in production

---

## Superseded/Deprecated

| Old Implementation | Superseded By | Date |
|---------------------|---------------|------|
| Stream interceptor | MCP as sole command path | Feb 18 |
| SSE dual-channel (SSE + RPC) | SSE as single source of truth | Feb 22 |
| Per-message isStreaming flag | Server-authoritative sessionBusy | Feb 22 |
| Scattered path validation | path-validator.ts | Feb 21 |
| Hand-rolled parsers | Libraries (CODING_STANDARDS rule) | Feb 20 |
