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

> **Last Updated:** 2026-02-25 — Chat + Session management features audited via code-level comparison with opencode client.
> See `docs/architecture/WORKPLAN.md` for the authoritative phase completion record.
> See `docs/plans/2026-02-25-chat-feature-parity.md` for the chat gap analysis and bridging plan.
> See `docs/plans/2026-02-25-session-management-parity.md` for the session management gap analysis and bridging plan.
> Phases 0, 1, 1B1, 1C, 2B, 3, T3, 4, T4, T5, T6, EW, EW.5, 6.8 are fully complete.
> Phase 2 (Chat): tasks 2.1–2.8 are implemented; remaining gaps tracked in FEAT-CHAT-009 onward.
> Session management core implemented (FEAT-CORE-008 to 012); 10 UX gaps tracked in FEAT-CORE-013 onward.

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
**Status:** ✅ Complete  
**Phase:** 1.1  
**Verifying Test:** All protocol types compile; RPC service path constant defined.

### FEAT-CORE-002: OpenCodeProxy Backend
**Description:** HTTP proxy service implementing OpenCodeService interface, translating RPC to opencode REST API.  
**Status:** ✅ Complete  
**Phase:** 1.2  
**Verifying Test:** Unit tests confirm proxy correctly translates RPC calls to HTTP requests; can list projects from running opencode server.

### FEAT-CORE-003: SSE Event Forwarding
**Description:** SSE connection to opencode server with event forwarding to frontend via JSON-RPC callbacks.  
**Status:** ✅ Complete  
**Phase:** 1.3  
**Verifying Test:** Message sent via another client appears in Theia within 200ms; reconnection works after connection drop.

### FEAT-CORE-004: OpenSpace Hub
**Description:** HTTP+SSE server with endpoints: /manifest, /openspace/instructions, /commands, /state, /events.  
**Status:** ✅ Complete  
**Phase:** 1.5  
**Verifying Test:** Hub starts with Theia; GET /openspace/instructions returns valid prompt; POST /commands → GET /events relay works.

### FEAT-CORE-005: BridgeContribution
**Description:** Frontend service publishing command manifest to Hub, listening for SSE AGENT_COMMAND events, dispatching to CommandRegistry.  
**Status:** ✅ Complete  
**Phase:** 1.7  
**Verifying Test:** On startup, Hub receives manifest; SSE connection established; commands dispatched correctly.

### FEAT-CORE-006: SessionService
**Description:** Frontend service managing active project/session state with optimistic updates.  
**Status:** ✅ Complete  
**Phase:** 1.6  
**Verifying Test:** Can switch projects/sessions; messages update in real-time via SSE.

### FEAT-CORE-007: SyncService
**Description:** Frontend service implementing OpenCodeClient, forwarding backend events to SessionService.  
**Status:** ✅ Complete  
**Phase:** 1.8  
**Verifying Test:** Events from opencode server reflected in SessionService state within 200ms.

### FEAT-CORE-008: Session CRUD UI
**Description:** Full session lifecycle from chat UI and sessions sidebar: create, switch, delete, archive, fork, revert, unrevert, compact. Sessions widget shows list with search, pagination, timestamps, parent/child indentation.
**Status:** ✅ Complete
**Phase:** 1.11 / 2.7 / 2.8
**Implementation:** `extensions/openspace-chat/src/browser/sessions-widget.tsx` — `SessionsView` with 250ms debounce search, relative timestamps, archive toggle, `hasMore` pagination; `extensions/openspace-chat/src/browser/chat-widget.tsx` — `ChatHeaderBar` "More actions" menu for fork/revert/compact/delete
**Verifying Test:** Can create, switch, delete, archive, fork, revert, compact sessions from both chat header and sessions sidebar.

### FEAT-CORE-009: OpenCode Instructions Integration
**Description:** opencode.json configured with instructions URL pointing to Hub.
**Status:** ✅ Complete
**Phase:** 1.12
**Verifying Test:** opencode includes OpenSpace instructions block in agent system prompt.

### FEAT-CORE-010: SessionService Advanced Reliability
**Description:** Production-grade reliability features in `SessionServiceImpl`: abort controller for stale session loads, hub readiness gating (20 attempts × 500ms) before session creation, model restoration from last assistant message on session switch, SSE reconnect on switch, clearStreamingPartText() before reconnect (prevents N× duplication), 500ms hysteresis timer on streaming-done, 5s RPC fallback timer for SSE disconnections, optimistic message inserts with SSE as authoritative channel, loading counter for nested async operations.
**Status:** ✅ Complete
**Phase:** 1C / 2.0
**Implementation:** `extensions/openspace-core/src/browser/session-service.ts` — `setActiveSession()` (abort controller, model restore), `createSession()` (hub gate), `sendMessage()` (optimistic insert, 5s RPC fallback, 500ms hysteresis), `clearStreamingPartText()`
**Verifying Test:** Session switch cancels stale load; hub not ready → session creation waits; SSE disconnect → RPC fallback fires; no duplicate streaming content on reconnect.

### FEAT-CORE-011: Per-Session Status Tracking
**Description:** `_sessionStatuses: Map<string, SDKTypes.SessionStatus>` tracks busy/idle/retry/error state per session ID. Status propagated via SSE `status_changed` events. `getSessionStatus(id)` used to render status badge in sessions sidebar and chat header. 2500ms debounce prevents tool-transition flicker.
**Status:** ✅ Complete
**Phase:** 2.0
**Implementation:** `extensions/openspace-core/src/browser/session-service.ts` — `_sessionStatuses`, `computeStreamingStatus()`, `MIN_STATUS_INTERVAL = 2500ms`; `sessions-widget.tsx:SessionStatusBadge` — renders `●` (busy/spin), `↺` (retry), orange dot (permissions); `.session-status-dot.error` CSS exists but not yet wired
**Verifying Test:** Busy session shows spinner in sidebar; retry shows ↺; permissions dot shows when pending.

### FEAT-CORE-012: Session Pagination with API Bug Workaround
**Description:** `loadMoreSessions()` works around the opencode API pagination bug (ignores 'start' offset, always returns from newest) by fetching a larger batch and slicing only the new tail using `_sessionCursor` for deduplication. `_sessionLoadLimit` grows by `PAGE_SIZE` increments. `loadOlderMessages()` fetches 400-message pages.
**Status:** ✅ Complete
**Phase:** 2.7
**Implementation:** `extensions/openspace-core/src/browser/session-service.ts` — `loadMoreSessions()`, `loadOlderMessages()`, `_sessionCursor`, `_sessionLoadLimit = 20`, `PAGE_SIZE`
**Verifying Test:** "Load more" fetches additional sessions without duplicates; older messages load correctly.

> **Audit note (2026-02-25):** A code-level comparison with the opencode client was completed for session management.
> The following features (FEAT-CORE-013 onward) represent gaps identified against opencode's session UX.
> See `docs/plans/2026-02-25-session-management-parity.md` for the full analysis.

### FEAT-CORE-013: Skeleton Loader for Session List
**Description:** Replace loading spinner with shimmer skeleton bars (4 placeholder items with `animate-pulse`) while sessions load, matching opencode's `SessionSkeleton` component.
**Status:** ⬜ Pending (gap S1-B in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S1-B — new `SessionSkeleton` component in `sessions-widget.tsx`; shimmer CSS using `background: linear-gradient` animation at 1.4s; replace `isLoading` spinner
**Verifying Test:** Session list shows 4 shimmer bars while loading; transitions to real list on load complete.

### FEAT-CORE-014: Archive Button Hover Animation
**Description:** Archive button on session list items fades in only on row hover (`opacity-0 → 1` on `:hover`), matching opencode's `opacity-0 group-hover:opacity-100 transition` pattern. Always visible for active/focused items (keyboard accessibility).
**Status:** ⬜ Pending (gap S1-C in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S1-C — CSS-only change in `sessions-widget.css`
**Verifying Test:** Archive button invisible at rest; appears on row hover; always visible on active session.

### FEAT-CORE-015: Parent Session Back-Navigation
**Description:** When viewing a forked session, show `←` back button that navigates to the parent session. `data-parent-id` attribute is already set on session items but no button is rendered.
**Status:** ⬜ Pending (gap S1-D in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S1-D — add back button to `chat-widget.tsx:ChatHeaderBar` when `activeSession.parentID` is set; wires to `handleSessionSwitch(parentID)`
**Verifying Test:** Forked session shows `←` button; clicking navigates to parent session.

### FEAT-CORE-016: Cascade Delete for Sessions with Children
**Description:** When deleting a session that has forked child sessions, automatically delete all descendants (DFS traversal). Currently only the single session is deleted, leaving orphaned children.
**Status:** ⬜ Pending (gap S1-E in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S1-E — `session-service.ts:deleteSession()` builds descendant list via `findDescendants()`; deletes all in parallel; confirmation UI updated to show child count
**Verifying Test:** Deleting session with children removes all descendants; sidebar shows correct count.

### FEAT-CORE-017: Error Status Dot Wiring
**Description:** `.session-status-dot.error` CSS class is defined but never rendered. Wire red dot to `SessionStatus.error` state in `sessions-widget.tsx:SessionStatusBadge()` and the chat header dropdown.
**Status:** ⬜ Pending (gap S2-A in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S2-A — add `status.type === 'error'` branch to `SessionStatusBadge`
**Verifying Test:** Session with error state shows red dot in sidebar.

### FEAT-CORE-018: Session Rename via Sessions Panel
**Description:** Double-click on a session item in the left sessions panel to rename it inline (edit state with Enter/Escape). Requires S1-A (inline title editing in chat header, FEAT-CHAT-017) as the rename API layer.
**Status:** ⬜ Pending (gap S2-C in session-parity plan; depends on FEAT-CHAT-017)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S2-C — `sessions-widget.tsx` adds `editingId` + `editDraft` state; `onDoubleClick` enters edit mode; calls `sessionService.renameSession()`
**Verifying Test:** Double-clicking session item in sidebar switches to inline edit; Enter saves, Escape cancels.

### FEAT-CORE-019: Session Keyboard Shortcuts
**Description:** Keyboard shortcuts for session operations: `Mod+Shift+S` for new session, `Mod+Shift+N` for rename.
**Status:** ⬜ Pending (gap S2-E in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S2-E — register keybindings in `chat-view-contribution.ts`
**Verifying Test:** `Cmd+Shift+S` creates new session; `Cmd+Shift+N` opens inline title editor.

### FEAT-CORE-020: Session Hover Preview Card
**Description:** Hovering over a session item for 1 second shows a popover preview with the last few messages (like opencode's `HoverCard` with 1000ms open / 600ms close delays).
**Status:** ⬜ Pending (gap S3-A in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S3-A — new `session-hover-preview.tsx` component; `sessions-widget.tsx` wires 1000ms hover delay; `sessionService.getMessagesForPreview()`
**Verifying Test:** Hovering session for 1s shows preview popover; moving off closes it after 600ms.

### FEAT-CORE-021: Unseen Message Tracking + Blue Dot
**Description:** Track which sessions have new messages since the user last viewed them. Show blue dot on session items with unseen messages. Uses a `NotificationService` comparing last-seen message ID (persisted in localStorage) vs current message count.
**Status:** ⬜ Pending (gap S3-B in session-parity plan)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S3-B — new `notification-service.ts`; `getUnseenCount(sessionId)`, `markSeen(sessionId)`; `sessions-widget.tsx:SessionStatusBadge` adds blue dot branch; `setActiveSession()` calls `markSeen()`
**Verifying Test:** Background session receives new message → blue dot appears; switching to session clears it.

### FEAT-CORE-022: Per-Session UI State Persistence
**Description:** Persist and restore scroll position (and optionally other UI state) when returning to a previously viewed session, using a 50-entry LRU cache mapping `sessionId → {scrollTop, lastMessageId}`.
**Status:** ⬜ Pending (gap S3-C in session-parity plan; cross-ref FEAT-CHAT P3-D)
**Plan:** `docs/plans/2026-02-25-session-management-parity.md` §S3-C — new `session-view-store.ts`; `message-timeline.tsx` saves/restores `scrollTop` with 250ms debounce on `sessionId` change
**Verifying Test:** Scroll up in session → switch sessions → return → scroll position restored.

---

## [FEAT-CHAT] Chat & Conversation System

> **Audit note (2026-02-25):** A code-level comparison with the opencode client was completed.
> Many features previously listed as pending are in fact implemented. See
> `docs/plans/2026-02-25-chat-feature-parity.md` for the full analysis.

### FEAT-CHAT-001: Multi-part Prompt Input
**Description:** Text, file attachments, image attachments, @agent mentions with typeahead.
**Status:** ✅ Complete
**Phase:** 2.2
**Implementation:** `extensions/openspace-chat/src/browser/prompt-input/` — contenteditable + pill system + `@mention` typeahead + image paste/drag-drop; `types.ts`, `build-request-parts.ts`, `parse-from-dom.ts`
**Verifying Test:** Can compose message with text + attached files + @mention; parts sent correctly to opencode server.

### FEAT-CHAT-002: Message Timeline with Streaming
**Description:** Styled message list with user/assistant differentiation, streaming indicator, scroll-spy, auto-scroll.
**Status:** ✅ Complete
**Phase:** 2.3
**Implementation:** `extensions/openspace-chat/src/browser/message-timeline.tsx` — ResizeObserver auto-scroll, `SCROLLED_UP_THRESHOLD`, `userScrolledUpRef`, scroll-to-bottom button, new-messages indicator, `useLatchedBool` for flicker prevention
**Verifying Test:** Streaming shows real-time text; scroll up stops auto-scroll; resume button appears.

### FEAT-CHAT-003: Code Block Renderer
**Description:** Syntax-highlighted code blocks via markdown renderer.
**Status:** ✅ Complete
**Phase:** 2.4
**Implementation:** `extensions/openspace-chat/src/browser/markdown-renderer.tsx` — `CodeBlock` component with highlight.js; `AnsiBlock` for ANSI color; `MermaidBlock` for diagrams; copy button; KaTeX math support
**Verifying Test:** Code blocks syntax-highlighted with working copy button.

### FEAT-CHAT-004: Diff Renderer
**Description:** Inline diff view showing added/removed lines with color coding inside tool blocks.
**Status:** ✅ Complete
**Phase:** 2.5
**Implementation:** `extensions/openspace-chat/src/browser/diff-utils.ts` — LCS-based `computeSimpleDiff()`; rendered in `ToolBlock` inside `message-bubble.tsx` with +/− counts and line highlighting; capped at 1000 lines
**Verifying Test:** Diffs render with green/red highlighting inside collapsible tool blocks.

### FEAT-CHAT-005: File Reference Renderer
**Description:** Clickable file:line links in markdown responses that open editor at referenced line.
**Status:** ✅ Complete
**Phase:** 2.6
**Implementation:** `extensions/openspace-chat/src/browser/markdown-renderer.tsx` — `linkifyFilePaths()` scans rendered HTML for bare absolute paths and wraps them in `file://` anchor links; `onOpenFile` callback routes to `OpenerService`
**Verifying Test:** Clicking file:line reference opens file and scrolls to line.

### FEAT-CHAT-006: Session Sidebar
**Description:** Sidebar panel showing session list with title, date, preview; CRUD operations.
**Status:** ✅ Complete
**Phase:** 2.7
**Implementation:** `extensions/openspace-chat/src/browser/sessions-widget.tsx` — `SessionsView` with search (250ms debounce), pagination (`hasMore`), relative timestamps, archive toggle, parent/child indentation; `SessionsWidgetContribution` registers in left panel rank 501
**Verifying Test:** Session list in left sidebar; create/switch/delete/archive work.

### FEAT-CHAT-007: Session Operations
**Description:** Fork, revert, compact, unrevert session operations.
**Status:** ✅ Complete
**Phase:** 2.8
**Implementation:** `extensions/openspace-chat/src/browser/chat-widget.tsx` — `ChatHeaderBar` "More actions" menu; `handleForkSession`, `handleRevertSession`, `handleCompactSession` callbacks; wired to `SessionService` and `OpenCodeService`
**Verifying Test:** Can fork session, revert/unrevert, compact via action menu.

### FEAT-CHAT-008: Token / Cost Display Per Turn
**Description:** Show token usage (input, output, cache) and cost after each assistant turn.
**Status:** ⬜ Pending (gap P1-D in chat-parity plan)
**Phase:** 2.9 (deferred)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P1-D — aggregate `step-finish` parts from `AssistantMessage.tokens` and `cost` fields; display in `TurnGroup` footer as "↑N ↓N · $0.00"
**Verifying Test:** Token counts visible after each turn; hidden for free/unknown models.

### FEAT-CHAT-009: Model Selection Dropdown
**Description:** Provider-grouped model dropdown with search, recent models, and enable/disable filtering.
**Status:** ✅ Complete
**Phase:** 2.1
**Implementation:** `extensions/openspace-chat/src/browser/model-selector.tsx` — `ModelSelector` with search, `groupedModels`, `recentModels` (max 5), keyboard navigation; wired to `openspace.models.enabled` preference; auto-select first available on load
**Verifying Test:** Model dropdown opens with search; selection persists in session; recent models shown.

### FEAT-CHAT-010: Tool Call Rendering
**Description:** Collapsible tool blocks for bash, file edits, context reads, and task sub-agents.
**Status:** ✅ Complete
**Phase:** 2.3
**Implementation:** `extensions/openspace-chat/src/browser/message-bubble.tsx` — `ToolBlock` (collapsible, diff/output/generic), `TaskToolBlock` (always-expanded, polls child session every 2s), `ContextToolGroup` (groups read/grep/glob/search), `TodoToolBlock` (checklist display)
**Verifying Test:** Tool calls display with icon, subtitle, expandable content; permissions shown inline.

### FEAT-CHAT-011: Permission Inline Prompts
**Description:** Permission requests rendered inline within the tool block they belong to.
**Status:** ✅ Complete
**Phase:** 1.14
**Implementation:** `message-bubble.tsx:ToolBlock` — matches `pendingPermissions` by `callID`; renders Allow Once / Allow Always / Deny buttons inside the tool card
**Verifying Test:** Permission request appears inside correct tool block; selecting option dismisses it.

### FEAT-CHAT-012: Multi-turn TurnGroup with Activity Bar
**Description:** Intermediate steps wrapped in collapsible TurnGroup with live elapsed timer and streaming vocabulary phrases.
**Status:** ✅ Complete
**Phase:** 2.3
**Implementation:** `message-bubble.tsx:TurnGroup` — shimmer themes (10 variants), `STREAMING_VOCAB` phrase rotation (`streaming-vocab.ts`), 1% `CHAOS_VOCAB`, live elapsed timer, hide/show toggle after completion with duration
**Verifying Test:** Streaming shows animated activity bar; after completion shows "2m 34s" duration.

### FEAT-CHAT-013: Multi-Question Dock
**Description:** In-chat question prompts for single and multi-question agent requests.
**Status:** ✅ Complete
**Phase:** 1.14
**Implementation:** `extensions/openspace-chat/src/browser/question-dock.tsx` — `SingleQuestionDock` (click or custom input) and `MultiQuestionDock` (tab-per-question with confirm tab, auto-advance for single-select)
**Verifying Test:** Question appears above prompt; answering dismisses it and sends reply to server.

### FEAT-CHAT-014: Reasoning / Compaction / Snapshot / Patch Parts
**Description:** Display of extended reasoning, context compaction markers, workspace snapshots, and file patch summaries.
**Status:** ✅ Complete
**Phase:** 2.3
**Implementation:** `message-bubble.tsx` — `ReasoningBlock` (memoized markdown), `renderCompactionPart()` (divider), `renderSnapshotPart()` (icon + short ID), `renderPatchPart()` (file list); all routed via `renderPart()` dispatcher
**Verifying Test:** Reasoning text displayed; compaction shows visual divider; snapshot/patch show file summaries.

### FEAT-CHAT-015: Retry Countdown Banner
**Description:** Shows error message, retry attempt number, and live countdown to next retry.
**Status:** ✅ Complete
**Phase:** 2.3
**Implementation:** `message-bubble.tsx` lines 995–1023 — `retryStatus` prop with `{message, attempt, next}` fields; countdown updates every second via `setInterval`
**Verifying Test:** Retry banner visible during error recovery; countdown ticks down accurately.

### FEAT-CHAT-016: Copy Response Button
**Description:** One-click copy of the last assistant text part to clipboard with 2s feedback.
**Status:** ⬜ Pending (gap P1-A in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P1-A — add button to `TurnGroup` footer targeting last `type:'text'` part; `navigator.clipboard.writeText()`; 2s `copied` state
**Verifying Test:** Copy button appears on assistant turns; clicking copies text; feedback shown for 2s.

### FEAT-CHAT-017: Inline Session Title Editing
**Description:** Click session name in header to rename it inline.
**Status:** ⬜ Pending (gap P1-B in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P1-B — add `title:{draft,editing,saving}` state to `ChatComponent`; add `renameSession()` to `OpenCodeService` and proxy
**Verifying Test:** Click session name → input appears; Enter/blur saves; title updates in header and sidebar.

### FEAT-CHAT-018: Prompt Autosave Per Session
**Description:** Persist unsent prompt text when switching sessions; restore on return.
**Status:** ⬜ Pending (gap P1-C in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P1-C — new `prompt-session-store.ts` (20-entry LRU); serialize contenteditable HTML on unmount; restore on mount
**Verifying Test:** Type text → switch session → switch back → text is restored.

### FEAT-CHAT-019: Context Usage Indicator
**Description:** Show token usage progress in chat footer during/after turns.
**Status:** ⬜ Pending (gap P1-E in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P1-E — read `tokens.total` from last `step-finish` part; display in `ChatFooter` as "42k / 200k"; highlight when >80%
**Verifying Test:** Token counter visible in footer; updates after each turn.

### FEAT-CHAT-020: File Attachment Line Range Selection
**Description:** Specify start/end line range when attaching a file to the prompt (e.g. `file.ts:10-25`).
**Status:** ⬜ Pending (gap P2-A in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P2-A — extend `FilePart` with `selection:{startLine,endLine}`; range picker popover on file pill; wire through `build-request-parts.ts`
**Verifying Test:** Can attach file and specify line range; server receives selection metadata.

### FEAT-CHAT-021: Prompt Context Items Panel
**Description:** Visible panel below prompt pills showing attached files with line ranges and remove buttons.
**Status:** ⬜ Pending (gap P2-B in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P2-B — new `prompt-context-items.tsx` component; shown above input when items present; path abbreviation + range badge + × remove
**Verifying Test:** Attached files appear in panel with range; clicking × removes them.

### FEAT-CHAT-022: Toast / Notification System
**Description:** Lightweight toast stack for turn-complete, errors, and operation feedback.
**Status:** ⬜ Pending (gap P2-C in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P2-C — new `toast-service.ts` + `toast-stack.tsx`; wired to streaming end, errors, session operations; auto-dismiss with TTL
**Verifying Test:** Turn complete shows success toast; errors show error toast; auto-dismisses.

### FEAT-CHAT-023: Split Diff View
**Description:** Toggle between unified (current) and side-by-side diff in tool blocks.
**Status:** ⬜ Pending (gap P2-D in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P2-D — extend `diff-utils.ts` with `computeSplitDiff()`; toggle in `ToolBlock`; new `diff-split-view.tsx` two-column layout
**Verifying Test:** Toggle button in diff header switches between unified and split views.

### FEAT-CHAT-024: Session Summary Badge
**Description:** Show `+N -M files` change summary next to session name in header.
**Status:** ⬜ Pending (gap P2-E in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P2-E — read `activeSession.summary.{additions,deletions,files}` from SDK; display as small badge in `ChatHeaderBar`
**Verifying Test:** After file edits, summary badge shows correct counts in chat header.

### FEAT-CHAT-025: Standalone Review Panel
**Description:** Dedicated panel showing file diffs for the current session with navigation and diff style toggle.
**Status:** ⬜ Pending (gap P3-A in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P3-A — new `review-panel/` sub-module; file list sidebar + diff view; `getDiff()` API; keybind `Cmd+Shift+R`
**Verifying Test:** Review panel opens with changed files listed; clicking file shows its diff.

### FEAT-CHAT-026: Line Comments on Diffs
**Description:** Add comments to specific lines in the review panel, persisted per session.
**Status:** ⬜ Pending (gap P3-B in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P3-B — new `comments-service.ts` (20-session LRU); `LineComment {id,file,selection,comment,time}`; overlay in review panel; surface in prompt context items
**Verifying Test:** Can add comment on diff line; comment persists when switching and returning to session.

### FEAT-CHAT-027: Model Detail Tooltip and Pricing
**Description:** Hover tooltip on model option showing context length, input/output price, free/latest indicators.
**Status:** ⬜ Pending (gap P3-E in chat-parity plan)
**Plan:** `docs/plans/2026-02-25-chat-feature-parity.md` §P3-E — `ModelTooltip` popover in `model-selector.tsx:ModelOption`; "free" and "latest" badges; pricing from SDK model metadata
**Verifying Test:** Hovering model option shows pricing and context window info.

---

## [FEAT-AGENT] Agent IDE Control

### FEAT-AGENT-001: PaneService
**Description:** Programmatic pane control wrapping ApplicationShell.  
**Status:** ✅ Complete  
**Phase:** 3.1  
**Verifying Test:** Pane operations work; listPanes() returns accurate layout with geometry.

### FEAT-AGENT-002: Pane Commands
**Description:** openspace.pane.open, .close, .focus, .list, .resize commands in CommandRegistry.  
**Status:** ✅ Complete  
**Phase:** 3.2  
**Verifying Test:** Commands executable from command palette; list returns correct layout.

### FEAT-AGENT-003: Editor Commands
**Description:** openspace.editor.open, .scroll_to, .highlight, .clear_highlight, .read_file, .close commands.  
**Status:** ✅ Complete  
**Phase:** 3.3  
**Verifying Test:** Can open file at line 42, highlight lines 42-50, clear highlights from command palette.

### FEAT-AGENT-004: Terminal Commands
**Description:** openspace.terminal.create, .send, .read_output, .list, .close commands with ring buffer.  
**Status:** ✅ Complete  
**Phase:** 3.4  
**Verifying Test:** Create terminal, send "echo hello", read back "hello" from output buffer.

### FEAT-AGENT-005: File Commands
**Description:** openspace.file.read, .write, .list, .search commands with workspace-root constraint.  
**Status:** ✅ Complete  
**Phase:** 3.5  **Verifying Test:** Commands work; cannot read/write outside workspace root.

### FEAT-AGENT-006: Stream Interceptor
**Description:** Scans response stream for %%OS{...}%% blocks, strips from visible text, POSTs to Hub.  
**Status:** ✅ Complete (retired — replaced by MCP in Phase T3)  
**Phase:** 3.6  
**Verifying Test:** Response with %%OS{}%% block → user sees clean text, Hub receives command; handles split chunks correctly.

### FEAT-AGENT-007: Command Manifest Auto-generation
**Description:** BridgeContribution builds manifest from all openspace.* commands with argument schemas.  
**Status:** ✅ Complete  
**Phase:** 3.7  
**Verifying Test:** Hub manifest cache contains all commands with full schemas; updates automatically on new commands.

### FEAT-AGENT-008: System Prompt Generation
**Description:** Hub generates system prompt from manifest + live IDE state.  
**Status:** ✅ Complete  
**Phase:** 3.8  
**Verifying Test:** GET /openspace/instructions returns well-formatted prompt with examples; updates on state changes.

### FEAT-AGENT-009: Pane State Publishing
**Description:** BridgeContribution publishes pane state changes to Hub for live IDE state in prompt.  
**Status:** ✅ Complete  
**Phase:** 3.10  
**Verifying Test:** Open file → /openspace/instructions includes it; close it → it disappears.

### FEAT-AGENT-010: End-to-End Agent Control
**Description:** Full round-trip: agent emits %%OS{}%% → IDE action performed.  
**Status:** ✅ Complete (via MCP tools — %%OS{}%% syntax retired in T3)  
**Phase:** 3.9  
**Verifying Test:** Agent can open file, scroll, highlight, create terminal via %%OS{}%% blocks.

---

## [FEAT-PRES] Presentation Modality

### FEAT-PRES-001: Presentation Widget
**Description:** ReactWidget embedding reveal.js for .deck.md files.  
**Status:** ✅ Complete  
**Phase:** 4.1  
**Verifying Test:** .deck.md file opens as presentation widget; arrow keys navigate slides.

### FEAT-PRES-002: Presentation Open Handler
**Description:** WidgetOpenHandler for .deck.md files with priority 200.  
**Status:** ✅ Complete  
**Phase:** 4.2  
**Verifying Test:** Double-clicking .deck.md opens presentation widget, not text editor.

### FEAT-PRES-003: Presentation Commands
**Description:** All presentation commands in CommandRegistry: list, read, create, update_slide, open, navigate, play, pause, stop.  
**Status:** ✅ Complete  
**Phase:** 4.3  
**Verifying Test:** Agent can create deck, open, navigate slides via commands; all in manifest.

---

## [FEAT-WB] Whiteboard Modality

### FEAT-WB-001: Whiteboard Widget
**Description:** ReactWidget embedding tldraw for .whiteboard.json files.  
**Status:** ✅ Complete  
**Phase:** 4.4  
**Verifying Test:** .whiteboard.json opens as whiteboard widget; user can draw shapes, type text.

### FEAT-WB-002: Whiteboard Open Handler
**Description:** WidgetOpenHandler for .whiteboard.json files with priority 200.  
**Status:** ✅ Complete  
**Phase:** 4.5  
**Verifying Test:** Double-clicking .whiteboard.json opens whiteboard widget.

### FEAT-WB-003: Whiteboard Commands
**Description:** All whiteboard commands in CommandRegistry: list, read, create, add_shape, update_shape, delete_shape, open, camera.*.  
**Status:** ✅ Complete  
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
**Status:** ✅ Complete
**Phase:** Phase 5 (implemented as part of openspace-layout extension)
**Implementation:** `extensions/openspace-layout/src/browser/layout-contribution.ts` — `LayoutContribution` sets default left panel (File Navigator + Extensions), right panel (Chat), bottom panel (Terminal) on fresh launch
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

## [FEAT-VOICE] Voice Modality

### FEAT-VOICE-001: Speech-to-Text Input
**Description:** Push-to-talk voice input that transcribes speech and injects text into the chat prompt.
**Status:** ✅ Complete (Phase T6)
**Implementation:** `extensions/openspace-voice/src/browser/audio-fsm.ts` — STT via `/openspace/voice/stt` endpoint; volume streaming for waveform; auto language detection; 14+ languages
**Verifying Test:** Press voice button, speak, transcript appears in prompt input.

### FEAT-VOICE-002: Text-to-Speech Narration
**Description:** Automatic narration of assistant responses with emotion-aware voice.
**Status:** ✅ Complete (Phase T6)
**Implementation:** `extensions/openspace-voice/src/browser/narration-fsm.ts` — multiple narration modes (all/summary/off); emotion states (excited/concerned/happy/thoughtful/neutral); utterance prioritization; speed control
**Verifying Test:** Assistant response is spoken aloud; emotion affects voice style.

### FEAT-VOICE-003: Voice Policy Configuration
**Description:** UI to configure narration mode, voice, speed, language, and enable/disable voice.
**Status:** ✅ Complete (Phase T6)
**Implementation:** `extensions/openspace-voice/src/browser/voice-policy.ts` — policy FSM; settings wizard; `Ctrl+M` toggle keybind
**Verifying Test:** Voice policy wizard configures narration mode and voice selection.

### FEAT-VOICE-004: Waveform Visualization
**Description:** Real-time waveform overlay during voice recording.
**Status:** ✅ Complete (Phase T6)
**Implementation:** `extensions/openspace-voice/src/browser/voice-waveform-overlay.ts`
**Verifying Test:** Waveform animates during recording.

---

## [FEAT-LANG] Language Support

### FEAT-LANG-001: Syntax Highlighting (27 Languages)
**Description:** TextMate grammar registration for 27 programming languages via tm-grammars package.
**Status:** ✅ Complete (Phase EW)
**Implementation:** `extensions/openspace-languages/src/browser/language-grammar-contribution.ts` — TypeScript/JS/JSX/TSX, Python, Rust, Go, Java, C/C++, C#, Swift, Kotlin, HTML, CSS/SCSS, JSON, YAML, Markdown, Shell, SQL, PHP, Ruby, Lua, Dart, TOML, Dockerfile
**Verifying Test:** Opening files of each language type shows correct syntax highlighting.

### FEAT-LANG-002: Language Configuration
**Description:** Bracket matching, auto-close pairs, comment shortcuts, and indentation rules per language.
**Status:** ✅ Complete (Phase EW)
**Implementation:** Per-language configs in `openspace-languages` extension
**Verifying Test:** Typing `{` auto-closes; `//` inserts line comment in applicable languages.

---

## [FEAT-VIEWER] File Viewers

### FEAT-VIEWER-001: Markdown Viewer with Mermaid
**Description:** Dual-mode markdown preview/edit widget for `.md` files with Mermaid diagram rendering.
**Status:** ✅ Complete (Phase EW.5)
**Implementation:** `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx` — markdown-it + DOMPurify + Mermaid; Monaco edit mode; split editor support; file change monitoring; preview/edit toolbar toggle
**Verifying Test:** `.md` file opens as rendered preview; Mermaid code blocks render as diagrams; toolbar toggles edit mode.

---

## Test Summary

| Category | Features | Complete | Pending |
|---|---|---|---|
| FEAT-INFRA | 8 | 8 | 0 |
| FEAT-CORE | 22 | 12 | 10 (session UX gaps) |
| FEAT-CHAT | 27 | 15 | 12 |
| FEAT-AGENT | 10 | 10 | 0 |
| FEAT-PRES | 3 | 3 | 0 |
| FEAT-WB | 4 | 3 | 1 (custom UML shapes) |
| FEAT-LAYOUT | 2 | 1 | 1 (theming) |
| FEAT-SETTINGS | 4 | 0 | 4 |
| FEAT-VOICE | 4 | 4 | 0 |
| FEAT-LANG | 2 | 2 | 0 |
| FEAT-VIEWER | 1 | 1 | 0 |
| **Total** | **87** | **59 (68%)** | **28 (32%)** |

### Chat Parity Status (vs opencode client)
| Priority | Feature | Status |
|---|---|---|
| P1 | Copy response button (P1-A) | ⬜ FEAT-CHAT-016 |
| P1 | Inline session title editing (P1-B) | ⬜ FEAT-CHAT-017 |
| P1 | Prompt autosave per session (P1-C) | ⬜ FEAT-CHAT-018 |
| P1 | Token/cost display per turn (P1-D) | ⬜ FEAT-CHAT-008 |
| P1 | Context usage indicator (P1-E) | ⬜ FEAT-CHAT-019 |
| P2 | File attachment line range (P2-A) | ⬜ FEAT-CHAT-020 |
| P2 | Prompt context items panel (P2-B) | ⬜ FEAT-CHAT-021 |
| P2 | Toast / notification system (P2-C) | ⬜ FEAT-CHAT-022 |
| P2 | Split diff view (P2-D) | ⬜ FEAT-CHAT-023 |
| P2 | Session summary badge (P2-E) | ⬜ FEAT-CHAT-024 |
| P3 | Standalone review panel (P3-A) | ⬜ FEAT-CHAT-025 |
| P3 | Line comments on diffs (P3-B) | ⬜ FEAT-CHAT-026 |
| P3 | Model detail tooltip + pricing (P3-E) | ⬜ FEAT-CHAT-027 |

Reference: `docs/plans/2026-02-25-chat-feature-parity.md`

### Session Management Parity Status (vs opencode client)
| Sprint | Feature | Req ID | Status |
|---|---|---|---|
| S1 | Inline session title editing | FEAT-CHAT-017 | ⬜ (also covers S1-A) |
| S1 | Skeleton loader for session list | FEAT-CORE-013 | ⬜ |
| S1 | Archive button hover animation | FEAT-CORE-014 | ⬜ |
| S1 | Parent session back-navigation | FEAT-CORE-015 | ⬜ |
| S1 | Cascade delete for child sessions | FEAT-CORE-016 | ⬜ |
| S2 | Error dot wiring | FEAT-CORE-017 | ⬜ |
| S2 | Session diff summary badge | FEAT-CHAT-024 | ⬜ (also covers S2-B) |
| S2 | Double-click rename in sessions panel | FEAT-CORE-018 | ⬜ |
| S2 | Session share UI | FEAT-SETTINGS-004 | ⬜ (also covers S2-D) |
| S2 | Session keyboard shortcuts | FEAT-CORE-019 | ⬜ |
| S3 | Hover preview card | FEAT-CORE-020 | ⬜ |
| S3 | Unseen message tracking + blue dot | FEAT-CORE-021 | ⬜ |
| S3 | Per-session scroll persistence | FEAT-CORE-022 | ⬜ |

Reference: `docs/plans/2026-02-25-session-management-parity.md`

---

*Last updated: 2026-02-25 — chat + session management features audited against opencode client source code*
