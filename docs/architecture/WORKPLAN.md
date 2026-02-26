---
id: WORKPLAN-THEIA-OPENSPACE
author: oracle_e3f7
status: ACTIVE
date: 2026-02-16
updated: 2026-02-26
task_id: TheiaOpenspaceWorkplan
---

# Work Plan: Theia Openspace

> **Tracks:** Every task from scaffold to ship.  
> **Source of truth:** [TECHSPEC-THEIA-OPENSPACE.md](./TECHSPEC-THEIA-OPENSPACE.md)  
> **Legend:** ⬜ Not started · 🔲 Blocked · 🟡 In progress · ✅ Done · ❌ Cut · 🔶 Done-Not-Validated  
> **Archive:** Full task-by-task history for completed phases: [WORKPLAN-ARCHIVE-2026-02-18.md](./WORKPLAN-ARCHIVE-2026-02-18.md)

---

## 📊 Overall Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Scaffold & Build | ✅ COMPLETE | All 8 tasks done |
| Phase 1: Core Connection + Hub | ✅ COMPLETE | All 15 tasks done |
| Phase 1B1: Architecture Refactoring | ✅ COMPLETE | All 8 tasks done |
| Phase 2B: SDK Adoption (Hybrid) | ✅ COMPLETE | Types only; 5 tasks done |
| Phase 2B.7: Unit Test Infrastructure | ✅ COMPLETE | 446/446 tests passing (2026-02-18) |
| Phase 3: Agent IDE Control | ✅ COMPLETE | All 11 tasks done; stream interceptor superseded by T3 |
| Phase T3: MCP Agent Control System | ✅ COMPLETE | Hub MCP server live; stream interceptor removed |
| Phase 4: Modality Surfaces | 🔶 DONE-NOT-VALIDATED | Code exists; not integrated with MCP tools |
| **Phase 1C: Code Hardening** | ✅ COMPLETE | 1C.1–1C.7 all complete |
| **Phase 2: Chat Polish** | ✅ COMPLETE (2.0–2.8) | Code-level audit 2026-02-25: all core tasks done |
| **Phase 2.5: Chat Parity Gaps** | ✅ COMPLETE | All 15 features done (P1-A→E, P2-A→E, P3-A→E); merged to master `990f26e` 2026-02-26 |
| **Phase 2.6: Session Management Parity** | ✅ COMPLETE | All 13 items (S1-A→S3-C) implemented; CSS hygiene fixes added 2026-02-26 |
| **Phase 2.7: Model Selector Enhancements** | 🟡 IN PROGRESS | 2/7 done (M1-B free tag ✅, M2-A tooltip ✅); 2 partial (M1-A persistence, M1-D sort); 3 missing (M1-C status tags, M2-B favorites, M2-C CTA) |
| **Phase 2.8: Notifications & Feedback** | ⬜ NOT STARTED | 0/6 done; 1 partial (N2-B copy state); plan ready at notifications-feedback.md |
| **Phase 4-Val: Wire Phase 4 into MCP** | ✅ COMPLETE | Presentation done; whiteboard MCP fully wired |
| **Phase T4: PatchEngine** | ✅ COMPLETE | OCC-versioned artifact mutations via MCP tools |
| **Phase T5: ArtifactStore** | ✅ COMPLETE | Atomic writes, backups, audit log |
| **Phase T6: Voice Modality** | ✅ COMPLETE | Kokoro TTS narration + Whisper STT; merged 2026-02-22 |
| **Phase 6.8: Extension Marketplace** | ✅ COMPLETE | Open VSX registry + plugin-ext wired; merged 2026-02-20 |
| Phase 5: Polish & Desktop | 🟡 IN PROGRESS | 5.1 done; 5.2–5.7 not started |
| Phase 6: Extended Features | ⬜ NOT STARTED | Post-MVP |
| Phase EW: Editor Windows (Syntax Highlighting) | ✅ COMPLETE | openspace-languages extension; TextMate grammars for 27 languages via tm-grammars; 32/32 unit tests passing |
| Phase EW.5: Markdown Viewer | ✅ COMPLETE | openspace-viewers extension; MarkdownViewerWidget with Mermaid diagram support and Monaco edit mode; 16 new unit tests (569 total passing) |

**Next Task:** Phase 2.7: Model Selector Enhancements (5 remaining items: M1-A persistence, M1-C status tags, M1-D sort, M2-B favorites, M2-C CTA) + Phase 2.8: Notifications & Feedback (6 items, N1→N2) — Phase 2.6 Session Management Parity complete.

---

## What's Next

**Immediate:** Phase 2.7 Model Selector Enhancements (5 remaining gaps) and Phase 2.8 Notifications & Feedback (6 gaps).

**Phase 2.5 — Chat Parity Gaps:** ✅ COMPLETE (2026-02-26). All 15 features implemented on branch `feature/chat-feature-parity`:
- Sprint 1 (P1): P1-A copy button ✅, P1-B inline title editing ✅, P1-C prompt autosave ✅, P1-D token/cost per turn ✅, P1-E context usage indicator ✅.
- Sprint 2 (P2): P2-A file line range ✅, P2-B context items panel ✅, P2-C toast system ✅, P2-D split diff ✅, P2-E session summary badge ✅.
- Sprint 3 (P3): P3-A review panel ✅, P3-B line comments ✅, P3-C scroll-spy ✅, P3-D scroll persistence ✅, P3-E model pricing tooltip ✅.

**Phase 2.6 — Session Management Parity:** ✅ COMPLETE (2026-02-26). All 13 items confirmed implemented by codebase audit. CSS hygiene fixes (6 missing CSS classes) added in same session.
- Sprint 1 (S1): S1-A inline title edit ✅, S1-B skeleton loader ✅, S1-C archive animation ✅, S1-D back-nav ✅, S1-E cascade delete ✅.
- Sprint 2 (S2): S2-A error dot ✅, S2-B diff badge ✅, S2-C panel rename ✅, S2-D share UI ✅, S2-E keybinds ✅.
- Sprint 3 (S3): S3-A hover preview ✅, S3-B unseen tracking ✅, S3-C scroll persistence ✅.

**Phase 2.7 — Model Selector Enhancements:** 7 gaps vs opencode client (recent models persistence, free/status tags, tooltip, favorites, provider sort, empty state CTA). Full plan: `docs/plans/2026-02-26-model-selector-enhancements.md`.
- Sprint 1 (M1): M1-A recent persistence, M1-B free tag, M1-C status tags, M1-D provider sort.
- Sprint 2 (M2): M2-A hover tooltip, M2-B favorites, M2-C provider CTA.

**Phase 2.8 — Notifications & Feedback:** 6 gaps vs opencode client (turn-complete toast, error toast, preferences, sounds, copied state, context warning). Full plan: `docs/plans/2026-02-26-notifications-feedback.md`.
- Sprint 1 (N1): N1-A turn-complete toast, N1-B error toast, N1-C notification preferences.
- Sprint 2 (N2): N2-A sound system, N2-B copied state, N2-C context warning.

**Permanently excluded — Diff / Review panel:** opencode's `SessionReviewTab`, split diff, and line comments are **intentionally not ported**. Theia provides native diff editing (Monaco diff editor, Source Control panel) that is superior to any custom React implementation. Do not create a Phase 2.x for this area. See exclusion notes in `docs/plans/2026-02-25-chat-feature-parity.md` (P2-D, P3-A, P3-B).

**Also available (parallel):** Phase 5 Polish & Desktop (Electron build, theming, settings UI) and Phase 6 extended features remain unblocked.

---

## Completed Work Summary

> **Historical note:** Prior to Phase T3 (completed 2026-02-18), agent→IDE commands traveled via a `%%OS{...}%%` text annotation embedded in the response stream (the "stream interceptor"). This mechanism is **fully retired** — it has been removed from `opencode-proxy.ts` and replaced by MCP tools as the single canonical agent command path. No current code uses `%%OS{...}%%`.

| Phase | Completed | Summary |
|-------|-----------|---------|
| Phase 0: Scaffold & Build | 2026-02-16 | Monorepo, 6 extension stubs, browser app, CI pipeline |
| Phase 1: Core Connection + Hub | 2026-02-17 | OpenCodeProxy, Hub, SessionService, SyncService, ChatWidget, permissions |
| Phase 1B1: Architecture Refactoring | 2026-02-17 | Architecture C → B1; ChatAgent wired to SessionService; Hub simplified |
| Phase 2B: SDK Adoption (Hybrid) | 2026-02-18 | SDK types extracted; field renames; 263 hand-written lines replaced |
| Phase 2B.7: Unit Test Infrastructure | 2026-02-18 | chai v4 + mocha v10; 446/446 tests passing; tautological tests replaced |
| Phase 3: Agent IDE Control | 2026-02-18 | Pane/editor/terminal/file commands; manifest auto-gen; stream interceptor (superseded by T3) |
| Phase T3: MCP Agent Control System | 2026-02-18 | Hub MCP server (21 tools); stream interceptor removed; opencode.json configured |
| Phase EW: Editor Windows | 2026-02-19 | openspace-languages extension; TextMate grammars for 27 languages via tm-grammars; 32/32 unit tests passing |
| Phase EW.5: Markdown Viewer | 2026-02-19 | openspace-viewers extension; MarkdownViewerWidget, MarkdownViewerOpenHandler, MarkdownViewerToolbarContribution, DI module; Mermaid diagram support; Monaco edit mode; 16 new unit tests (569 total passing) |
| Phase T4: PatchEngine | 2026-02-19 | `openspace.artifact.patch` + `openspace.artifact.getVersion` MCP tools; OCC conflict detection; per-file PQueue; version persistence (`patch-versions.json`); 14 unit tests |
| Phase T5: ArtifactStore | 2026-02-19 | `ArtifactStore` with atomic writes (tmp→fsync→rename), rolling backups (last 20), NDJSON audit log, chokidar file watcher, `p-queue` concurrency; `openspace.file.write` routed through store; 12 unit tests |
| Phase 6.8: Extension Marketplace | 2026-02-20 | `@theia/plugin-ext` + `@theia/plugin-ext-vscode` + `@theia/vsx-registry` added; `plugins/builtin/` directory + manifest; download-plugins script; curated recommendations (yaml, git-graph, prettier, markdown, python); `Ctrl+Shift+X` Extensions sidebar live |
| Phase T6: Voice Modality | 2026-02-22 | `openspace-voice` extension; AudioFsm (STT/Whisper), NarrationFsm (Kokoro TTS), SessionFsm; VoiceWaveformOverlay; status bar indicator; `Ctrl+M` toggle; Voice: Set Policy wizard; language selection; text post-processing + custom vocabulary; `voice-core` shared package; VS Code extension (`openspace-voice-vscode`) |
| Chat Feature Parity Audit | 2026-02-25 | Code-level audit vs opencode client; Phase 2 tasks 2.1–2.8 retroactively confirmed complete; 13 chat UX gaps identified → Phase 2.5 |
| Session Management Parity Audit | 2026-02-25 | Code-level audit vs opencode client; core CRUD/archive/fork/revert/compact/pagination confirmed complete; 13 session UX gaps identified → Phase 2.6 |
| Phase 2.5: Chat Parity Gaps | 2026-02-26 | All 15 features implemented (P1-A→E copy/title/autosave/cost/ctx, P2-A→E file-range/context-items/toast/split-diff/badge, P3-A→E review-panel/comments/scroll-spy/scroll-persist/model-tooltip); branch `feature/chat-feature-parity` |
| Phase 2.5: Post-Merge Hardening | 2026-02-26 | Merged into master (`990f26e`); fixed 5 compile errors, re-added P1-E + P2-E lost in conflict resolution, fixed mock factories in 5 spec files, fixed P1-B dblclick; 1270 passing / 7 pre-existing failures; pushed to origin/master |

Full task-by-task detail for all completed phases is preserved in [WORKPLAN-ARCHIVE-2026-02-18.md](./WORKPLAN-ARCHIVE-2026-02-18.md).

---

## Phase 1C: Code Hardening & Quality Pass

**Goal:** Fix findings from the full codebase code review (T1 blocking, T2 security/reliability, T3 minor). Ensure security, reliability, and code quality before Phase 5 deployment.

> **Note:** Tasks T1-7 and T1-8 from the original review (stream interceptor block accumulation and brace counting bugs) are **obsolete** — the stream interceptor has been removed by Phase T3. All other hardening items remain.

**Status:** ✅ COMPLETE
**Duration estimate:** 14–22 hours  
**Exit criteria:** All T1 and T2 issues resolved. Security checklist complete. All tests passing. Build clean.  
**Source:** Full codebase code review — detailed plan in `docs/tasks/PHASE-1C-HARDENING-PLAN.md`

**V&V Targets:**
- [ ] All T1 blocking issues fixed (8 remaining after T1-7/T1-8 obsoleted): dangerous commands blocked, XSS patched, crash bugs fixed
- [ ] All T2 security issues fixed (7/7): Hub auth, symlink resolution, sensitive files, permission dialog, file size limits
- [ ] All T2 reliability issues fixed: memory leaks, dead code, fake success returns, type safety
- [ ] Security review checklist complete (10/10 items)
- [ ] `yarn build` clean (zero TypeScript errors)
- [ ] All 446 unit tests pass

### 1C.1 — Fix T1 Blocking Issues (Security & Crash Bugs)
| | |
|---|---|
| **What** | Fix 8 critical issues (T1-7 and T1-8 are obsolete — stream interceptor removed): (1) dangerous terminal commands require user confirmation, (2) validate shellPath/cwd in terminal creation against allowlist, (3) resolve symlinks before path validation to prevent traversal, (4) verify `setSessionService()` wiring, (5) replace unsafe type cast with explicit error, (6) sanitize markdown in presentation widget (XSS), (7) resolve test runner conflict if remaining, (8) rewrite tautological E2E tests to verify real behavior. See `docs/tasks/PHASE-1C-HARDENING-PLAN.md` §1C.1 for code samples and acceptance criteria per fix. |
| **Acceptance** | All remaining T1 issues resolved. Dangerous commands blocked. XSS patched. Symlink traversal prevented. Tests verify actual application behavior. Build passes. All tests pass. |
| **Dependencies** | Phase T3 complete |
| **Estimated effort** | 4–6 hours |
| **Status** | ✅ |

### 1C.2 — Fix T2 Security Issues
| | |
|---|---|
| **What** | Fix 7 security issues: (1) add origin validation and CORS headers to Hub endpoints, (2) route all commands through validation pipeline, (3) consolidate sensitive file patterns (19 patterns → shared constant), (4) implement focus trap in permission dialog, (5) add explicit Deny button to permission dialog, (6) add 10MB file size limit to readFile, (7) validate postMessage origin in whiteboard widget. See `docs/tasks/PHASE-1C-HARDENING-PLAN.md` §1C.2. |
| **Acceptance** | All 7 T2 security issues resolved. Hub endpoints validate origin. Permission dialog has focus trap + deny button. File size limits enforced. postMessage validates origin. |
| **Dependencies** | 1C.1 |
| **Estimated effort** | 3–4 hours |
| **Status** | ✅ |

### 1C.3 — Fix T2 Reliability Issues
| | |
|---|---|
| **What** | Fix reliability issues: duplicate types, dead code (pane-protocol.ts), disposal hooks (OpenCodeProxy, PaneService), fake success returns (openContent, resizePane), loading counter nesting, subscription leaks, React component extraction (SessionHeader), correct React imports, terminal listener cleanup, findByUri bugs, NavigationService wiring, missing dependencies. See `docs/tasks/PHASE-1C-HARDENING-PLAN.md` §1C.3. |
| **Acceptance** | All T2 reliability issues resolved. No memory leaks. No dead code. Proper disposal. Correct component lifecycle. All tests pass. |
| **Dependencies** | 1C.2 |
| **Estimated effort** | 2–3 hours |
| **Status** | ✅ |

### 1C.4 — Dead Code Cleanup
| | |
|---|---|
| **What** | Remove dead code: duplicate type definitions, unused protocol files, redundant MessagePart fields, unused session-protocol types, duplicate CommandResult, spike files. Run `ts-prune` or manual grep, delete confirmed unused code, verify build passes after each deletion. |
| **Acceptance** | Dead code removed. Codebase ~200-300 lines smaller. `yarn build` passes. No broken imports. |
| **Dependencies** | 1C.3 |
| **Estimated effort** | 2 hours |
| **Status** | ✅ |

### 1C.5 — Test Infrastructure Fixes
| | |
|---|---|
| **What** | Fix remaining test infrastructure issues: (1) rewrite phantom tests (T6-T12) to test actual application code instead of local regex copies, (2) replace hardcoded `waitForTimeout` calls with `waitForSelector`/`waitForFunction`, (3) fix route mock ordering in session-management.spec.ts. Note: Jest/Mocha conflict was resolved in Phase 2B.7 — do not re-address. |
| **Acceptance** | All tests verify real behavior. No flaky timeouts. All unit and E2E tests pass. |
| **Dependencies** | 1C.4 |
| **Estimated effort** | 2–3 hours |
 | **Status** | ✅ |

### 1C.6 — T3 Minor Fixes (As Time Allows)
| | |
|---|---|
| **What** | Fix minor issues (best effort): consistent readonly fields, dispose emitters, use UUID for message IDs, clear streaming state on session switch, Hub/workspace URLs from config, replace alert/confirm with MessageService, add ARIA labels, fix model ID parsing, replace console.log with ILogger, remove unused devDeps. See `docs/tasks/PHASE-1C-HARDENING-PLAN.md` §1C.6. |
| **Acceptance** | T3 issues resolved as time allows. All improvements documented. |
| **Dependencies** | 1C.5 |
| **Estimated effort** | 2–4 hours |
 | **Status** | ✅ |

### 1C.7 — Security Review & Validation
| | |
|---|---|
| **What** | Complete security review checklist: verify command input validation, symlink resolution, sensitive file denylist, permission dialog focus trap, XSS patches, postMessage origin checks, Hub authentication, file size limits, dangerous command confirmation, no test hooks in production. Run full test suite. Verify build clean. |
| **Acceptance** | Security checklist 10/10 complete. All tests pass. Build clean. Zero TypeScript/lint errors. |
| **Dependencies** | 1C.6 |
| **Test requirements** | `yarn build` (zero errors), `yarn lint` (zero errors), `yarn test` (all 446 unit tests pass). Security penetration testing: attempt path traversal, XSS injection, dangerous commands without approval — all must be blocked. |
 | **Estimated effort** | 1–2 hours |
 | **Status** | ✅ |

---

## Phase 2: Chat & Prompt System

**Goal:** Full chat experience matching (and exceeding) the opencode client. Rich prompt input, message rendering, session management.

**Status:** ✅ COMPLETE — code-level audit (2026-02-25) confirmed tasks 2.1–2.8 are implemented.
See `docs/plans/2026-02-25-chat-feature-parity.md` for detailed verification.
Remaining gaps tracked in Phase 2.5 below.

**V&V Targets:**
- [x] Session list loads immediately on chat widget open (2.0 ✅)
- [x] Model selection dropdown works and persists per-session (2.1 ✅)
- [x] Multi-part prompt: text + file attachment + @mention sent correctly (2.2 ✅)
- [x] Message timeline renders streaming response with progress indicator (2.3 ✅)
- [x] Code blocks syntax-highlighted (2.4 ✅)
- [x] File:line references clickable and open editor (2.5/2.6 ✅)
- [x] Session sidebar with create/switch/delete/archive (2.7 ✅)
- [x] Session fork/revert/compact operations (2.8 ✅)
- [ ] Token usage display (2.9 — carried to Phase 2.5 as P1-D)
- [ ] Chat integration test (2.10 — carried to Phase 2.5)

### 2.1 — Model Selection
| | |
|---|---|
| **What** | Model selection dropdown with provider grouping, search, recent models, and preference-filtered list. |
| **Status** | ✅ — `model-selector.tsx` (475 lines); provider grouping, search, recent (max 5), keyboard nav, `openspace.models.enabled` preference integration |

### 2.2 — Multi-part prompt input
| | |
|---|---|
| **What** | Contenteditable prompt with text, file attachments, image attachments, @agent mentions with typeahead. |
| **Status** | ✅ — `prompt-input/` directory; `types.ts`, `prompt-input.tsx`, `build-request-parts.ts`, `parse-from-dom.ts`; image paste/drag-drop; 100-entry history navigation; slash commands |

### 2.3 — Message timeline with streaming
| | |
|---|---|
| **What** | Message list with streaming, auto-scroll, TurnGroup collapsible steps, streaming vocabulary activity bar. |
| **Status** | ✅ — `message-timeline.tsx` (579 lines); ResizeObserver auto-scroll; scroll-to-bottom button; new-messages indicator; `useLatchedBool` flicker prevention; `TurnGroup` with shimmer themes + elapsed timer |

### 2.4 — Code block renderer
| | |
|---|---|
| **What** | Syntax-highlighted code blocks with copy button; ANSI color support; Mermaid diagrams; KaTeX math. |
| **Status** | ✅ — `markdown-renderer.tsx`; highlight.js; `CodeBlock` + `AnsiBlock` + `MermaidBlock`; copy button; KaTeX; DOMPurify sanitization |

### 2.5 — Diff renderer
| | |
|---|---|
| **What** | Inline diff view with added/removed line highlighting inside tool call blocks. |
| **Status** | ✅ — `diff-utils.ts` LCS `computeSimpleDiff()`; rendered in `message-bubble.tsx:ToolBlock`; +/− counts; 1000-line cap |

### 2.6 — File reference renderer
| | |
|---|---|
| **What** | Clickable file path links in markdown responses that open the editor at the referenced line. |
| **Status** | ✅ — `markdown-renderer.tsx:linkifyFilePaths()`; absolute paths wrapped in `file://` anchors; `onOpenFile` → `OpenerService` |

### 2.7 — Session sidebar
| | |
|---|---|
| **What** | Left panel session list with search, pagination, timestamps, archive toggle, parent/child indentation. |
| **Status** | ✅ — `sessions-widget.tsx`; `SessionsView` with 250ms debounce search; relative timestamps; archive; `hasMore` pagination |

### 2.8 — Session operations: fork / revert / compact
| | |
|---|---|
| **What** | Fork, revert, unrevert, compact via chat header action menu. |
| **Status** | ✅ — `chat-widget.tsx:ChatHeaderBar` "More actions" menu; `handleForkSession`, `handleRevertSession`, `handleCompactSession` |

### 2.9 — Token usage display
| | |
|---|---|
| **What** | Token counts (input/output/cache) and cost after each turn; context usage in footer. |
| **Status** | ⬜ — Carried to Phase 2.5 as P1-D (turn cost) and P1-E (footer indicator) |

### 2.10 — Chat integration test
| | |
|---|---|
| **What** | E2E test: multi-part send → streaming → code block → file reference → editor opens; session CRUD. |
| **Status** | ⬜ — Carried to Phase 2.5 |

---

## Phase 2.5: Chat Parity Gaps

**Goal:** Close the remaining UX gaps between theia-openspace chat and the opencode client, as identified by the 2026-02-25 code-level audit.

**Reference:** `docs/plans/2026-02-25-chat-feature-parity.md` — full comparison with file-level implementation pointers.

**Status:** ⬜ NOT STARTED
**Duration estimate:** 3 sprints

### Sprint 1 — P1 (High Impact, Self-Contained)

| Task | Feature | Key Files | Effort | Status |
|---|---|---|---|---|
| 2.5-P1A | Copy response button | `message-bubble.tsx` | S | ⬜ |
| 2.5-P1B | Inline session title editing | `chat-widget.tsx`, `opencode-protocol.ts`, `opencode-proxy.ts` | M | ⬜ |
| 2.5-P1C | Prompt autosave per session | new `prompt-session-store.ts`, `prompt-input.tsx` | M | ⬜ |
| 2.5-P1D | Token/cost display per turn | `message-bubble.tsx` (aggregate `step-finish` parts) | M | ⬜ |
| 2.5-P1E | Context usage indicator in footer | `chat-widget.tsx:ChatFooter` | S | ⬜ |

### Sprint 2 — P2 (Medium Effort)

| Task | Feature | Key Files | Effort | Status |
|---|---|---|---|---|
| 2.5-P2A | File attachment line range | `prompt-input/types.ts`, `prompt-input.tsx`, `build-request-parts.ts` | L | ⬜ |
| 2.5-P2B | Prompt context items panel | new `prompt-context-items.tsx` | M | ⬜ |
| 2.5-P2C | Toast / notification system | new `toast-service.ts`, `toast-stack.tsx` | M | ⬜ |
| 2.5-P2D | Split diff view toggle | `diff-utils.ts`, `message-bubble.tsx`, new `diff-split-view.tsx` | M | ⬜ |
| 2.5-P2E | Session summary badge | `chat-widget.tsx:ChatHeaderBar` | S | ⬜ |

### Sprint 3 — P3 (Larger Subsystems)

| Task | Feature | Key Files | Effort | Status |
|---|---|---|---|---|
| 2.5-P3A | Standalone review panel | new `review-panel/` sub-module | L | ⬜ |
| 2.5-P3B | Line comments on diffs | new `comments-service.ts`, `review-panel/` | L | ⬜ |
| 2.5-P3C | Scroll-spy + message navigation | `message-timeline.tsx`, `chat-view-contribution.ts` | M | ⬜ |
| 2.5-P3D | Per-session scroll persistence | new `scroll-position-store.ts`, `message-timeline.tsx` | S | ⬜ |
| 2.5-P3E | Model detail tooltip + pricing | `model-selector.tsx` | M | ⬜ |

*S = small (<4h), M = medium (4–8h), L = large (1–3 days)*

---

## Phase 2.6: Session Management Parity

**Goal:** Close the UX gaps in session management between theia-openspace and the opencode client, as identified by the 2026-02-25 code-level audit. Core session operations (CRUD, archive, fork, revert, compact, pagination) are fully implemented; these tasks address polish, animations, keyboard access, and new notification/state features.

**Reference:** `docs/plans/2026-02-25-session-management-parity.md` — full comparison with file-level implementation pointers and code samples.

**Status:** ⬜ NOT STARTED
**Duration estimate:** 3 sprints

**What's already implemented (no action needed):**
Session CRUD, archive, fork, revert, compact, abort controller for stale loads, hub readiness gating, model restoration on switch, SSE reconnect, clearStreamingPartText (prevents N× duplication), 500ms streaming hysteresis, 5s RPC fallback, optimistic inserts, per-session status tracking (busy/retry/permissions), loadMoreSessions() with API bug workaround, loadOlderMessages() (400 pages), searchSessions().

### Sprint 1 — S1 (High Impact, Self-Contained)

| Task | Feature | Key Files | Effort | Status |
|---|---|---|---|---|
| 2.6-S1A | Inline session title editing | `opencode-protocol.ts`, `opencode-proxy.ts`, `session-service.ts`, `chat-widget.tsx` | M | ⬜ (shared with 2.5-P1B) |
| 2.6-S1B | Skeleton loader for session list | `sessions-widget.tsx`, CSS | S | ⬜ |
| 2.6-S1C | Archive button hover animation | CSS only | S | ⬜ |
| 2.6-S1D | Parent session back-navigation | `chat-widget.tsx:ChatHeaderBar` | S | ⬜ |
| 2.6-S1E | Cascade delete for child sessions | `session-service.ts:deleteSession()` | S | ⬜ |

### Sprint 2 — S2 (Medium Effort)

| Task | Feature | Key Files | Effort | Status |
|---|---|---|---|---|
| 2.6-S2A | Error status dot wiring | `sessions-widget.tsx`, `chat-widget.tsx` | S | ⬜ |
| 2.6-S2B | Session diff summary badge | `sessions-widget.tsx`, CSS | S | ⬜ (shared with 2.5-P2E) |
| 2.6-S2C | Double-click rename in sessions panel | `sessions-widget.tsx` (depends on S1A) | S | ⬜ |
| 2.6-S2D | Session share UI | `chat-widget.tsx:ChatHeaderBar` | M | ⬜ |
| 2.6-S2E | Keyboard shortcuts for session ops | `chat-view-contribution.ts` | M | ⬜ |

### Sprint 3 — S3 (Larger Features)

| Task | Feature | Key Files | Effort | Status |
|---|---|---|---|---|
| 2.6-S3A | Hover preview card | new `session-hover-preview.tsx`, `sessions-widget.tsx` | L | ⬜ |
| 2.6-S3B | Unseen message tracking + blue dot | new `notification-service.ts`, `sessions-widget.tsx` | L | ⬜ |
| 2.6-S3C | Per-session scroll persistence | new `session-view-store.ts`, `message-timeline.tsx` | L | ⬜ |

*S = small (<4h), M = medium (4–8h), L = large (1–3 days)*

---

## Phase 4-Validation: Wire Phase 4 into MCP Tools

> **Context:** Phase 4 presentation code was completed and wired (MCP tools, system prompt, live reload). Whiteboard browser code is complete but MCP wiring is missing. This phase completes the whiteboard MCP wiring and fixes remaining gaps in both modalities.
>
> **Implementation plan:** `docs/plans/2026-02-19-phase-4val-whiteboard-mcp.md`

**Status:** ✅ COMPLETE  
**Duration estimate:** 1 session  
**Exit criteria:** All whiteboard MCP tools registered and in system prompt. All presentation/whiteboard gaps fixed. 466+ unit tests passing. Build clean.

**Actual status as of 2026-02-19:**
- ✅ Presentation: all 10 MCP tools registered in hub-mcp.ts
- ✅ Presentation: system prompt has full `## Presentation Tools` section
- ✅ Presentation: `listPresentations()` real recursive scan
- ✅ Presentation: live-reload via `onDidChange` emitter + file watching
- ✅ Presentation: `PresentationOpenHandler` wired (double-click `.deck.md`)
- ✅ Presentation: DI frontend module complete
- ✅ Whiteboard: all 10 browser commands implemented
- ✅ Whiteboard: `WhiteboardOpenHandler` wired (double-click `.whiteboard.json`)
- ✅ Whiteboard: DI frontend module complete
- ❌ Whiteboard: **no MCP tools** in hub-mcp.ts (main gap) → ✅ FIXED: 10 tools registered
- ❌ Whiteboard: **not in system prompt** in hub.ts → ✅ FIXED: Whiteboard Tools section added
- ❌ Whiteboard: `listWhiteboards()` is a stub (returns workspace root, not files) → ✅ FIXED: recursive scan
- ❌ Whiteboard: CSS not built to lib/ and not imported in frontend module → ✅ FIXED
- ❌ Presentation: `navigate 'first'`/`'last'` silently no-ops in command handler → ✅ FIXED

**V&V Targets:**
- [x] Validate 4.1: `presentation-widget.tsx` renders; reveal.js slides functional
- [x] Validate 4.2: `.deck.md` double-click opens presentation widget
- [x] Validate 4.3: All presentation commands wired via MCP
- [x] Validate 4.4: whiteboard CSS loads; widget renders
- [x] Validate 4.5: `.whiteboard.json` double-click opens whiteboard widget
- [x] Validate 4.6: All whiteboard commands wired via MCP
- [x] Wire T3.3: Presentation MCP tools (10) — complete
- [x] Wire T3.3: Whiteboard MCP tools (10) — complete
- [x] Modality integration test — covered by hub-mcp.spec.ts regression tests

### 4V.1 — Validate and fix presentation widget
| | |
|---|---|
| **What** | Fix navigate first/last directions silently no-opping in `navigatePresentation()`. All other presentation wiring is complete. |
| **Acceptance** | `navigatePresentation({direction:'first'})` → slide 0. `navigatePresentation({direction:'last'})` → last slide. All 10 presentation MCP tools pass regression tests. |
| **Dependencies** | Phase T3 complete |
| **Estimated effort** | 30 min |
| **Status** | ✅ |

### 4V.2 — Validate and fix whiteboard widget
| | |
|---|---|
| **What** | Fix CSS not loading (add build copy step + frontend module import). Fix `listWhiteboards()` stub (implement real recursive scan like `listPresentations()`). |
| **Acceptance** | Widget CSS loads in browser. `listWhiteboards()` returns `.whiteboard.json` files. Tests pass. |
| **Dependencies** | Phase T3 complete |
| **Estimated effort** | 30 min |
| **Status** | ✅ |

### 4V.3 — Wire whiteboard MCP tools (T3.3)
| | |
|---|---|
| **What** | Add `registerWhiteboardTools()` (10 tools) to `hub-mcp.ts`. Add whiteboard to `generateInstructions()` system prompt in `hub.ts`. Add regression tests in `hub-mcp.spec.ts`. |
| **Acceptance** | All 10 `openspace.whiteboard.*` tools appear in MCP tools/list. System prompt lists whiteboard tools. 10 regression tests pass. |
| **Dependencies** | 4V.2 |
| **Estimated effort** | 1–2 hours |
| **Status** | ✅ |

### 4V.4 — Update WORKPLAN and push
| | |
|---|---|
| **What** | Final verification (488 tests, build clean), mark all 4V tasks ✅, update phase status to COMPLETE, push branch. |
| **Acceptance** | WORKPLAN updated. Branch pushed. |
| **Dependencies** | 4V.3 |
| **Estimated effort** | 15 min |
| **Status** | ✅ |

---

## Phase T4: PatchEngine

> **Prerequisite:** Phase T3 complete + Phase 4-Validation complete (PatchEngine operations exposed via MCP tools `whiteboard.update`, `presentation.update_slide`).

**Goal:** Versioned, operation-based patch engine for whiteboard and presentation artifact mutations. Replaces naive full-content overwrites with `{ baseVersion, operations[] }` OCC (optimistic concurrency control). Ensures deterministic reproducibility and conflict detection when agent and user both modify an artifact.

**Architecture:**
```
MCP tool call (whiteboard.update / presentation.update_slide)
  → Hub POST /files/{path}/patch
    → PatchEngine.applyPatch({ baseVersion, actor, intent, ops })
      → version check (OCC) → apply ops → store new version → return { version: N }
  → on 409: agent retries with currentVersion
```

**Reference:** `/Users/Shared/dev/openspace/runtime-hub/src/services/PatchEngine.ts`

**Status:** ✅ COMPLETE (2026-02-19, commits 9774cbe / c0bfa78 / 24ff9f2 / 82572bc / 444da75)  
**Duration estimate:** 1 session  
**Exit criteria:** Hub exposes `POST /files/{path}/patch`. PatchEngine detects conflicts (409). MCP tools use patch endpoint with OCC retry. Version counter persists across Hub restarts.

> **Implementation note:** Architecture evolved during implementation. Instead of a REST `POST /files/{path}/patch` HTTP route, PatchEngine is exposed directly as two MCP tools: `openspace.artifact.patch` (OCC-versioned write) and `openspace.artifact.getVersion` (version query). The HTTP layer was bypassed because the MCP server handles requests directly without needing a secondary HTTP round-trip. All acceptance criteria are met via the MCP tool surface. Plan: `docs/plans/2026-02-19-phase-t4t5-artifactstore.md`.

**V&V Targets:**
- [x] `openspace.artifact.patch` MCP tool (replaces HTTP endpoint — same OCC semantics)
- [x] PatchEngine applies `replace_content` operation, increments version
- [x] PatchEngine throws `ConflictError` with `currentVersion` when `baseVersion` is stale
- [x] `openspace.artifact.getVersion` MCP tool for agent OCC retry pattern
- [x] `openspace.file.write` routes through ArtifactStore (atomic write + audit log)
- [x] Version counter persists across Hub restarts (`patch-versions.json`)
- [x] Unit tests: apply patch, version increment, conflict, concurrency, persistence

### T4.1 — PatchEngine service
| | |
|---|---|
| **What** | Create `openspace-core/src/node/patch-engine.ts`. Port from reference implementation. Core interface: `applyPatch(filePath, { baseVersion, actor, intent, ops })` → `{ version: N }` or throw `ConflictError({ currentVersion })`. Supported ops: `replace_content`, `replace_lines`. Version state: `Map<string, number>` persisted to `{workspaceRoot}/.openspace/versions.json`. |
| **Acceptance** | Correct baseVersion → applies op, returns incremented version. Stale baseVersion → throws ConflictError. Concurrent calls to same file serialize. Version persists across process restart. |
| **Dependencies** | Phase T3 complete, Phase 4-Validation complete |
| **Reference** | `openspace/runtime-hub/src/services/PatchEngine.ts` |
| **Estimated effort** | 3 hours |
| **Status** | ✅ |

### T4.2 — Hub patch endpoint + MCP wiring
| | |
|---|---|
| **What** | Add `POST /files/:path/patch` route to Hub. Validates request body (`baseVersion`, `ops`, `actor`, `intent`). Calls `PatchEngine.applyPatch()`. Returns `{ version: N }` on success or `{ currentVersion: N }` with HTTP 409 on conflict. Update MCP tool handlers `whiteboard.update` and `presentation.update_slide` to use patch endpoint with OCC retry loop (attempt 0: call with baseVersion; on 409: update baseVersion and retry; fail after 2 attempts). |
| **Acceptance** | Valid op → file updated, version returned. Stale version → 409. MCP `whiteboard.update` retries on 409. |
| **Dependencies** | T4.1, Phase 4-Validation 4V.3 |
| **Estimated effort** | 2 hours |
| **Status** | ✅ (implemented as MCP tools `openspace.artifact.patch` + `openspace.artifact.getVersion` — no HTTP route needed) |

### T4.3 — PatchEngine unit tests
| | |
|---|---|
| **What** | Unit tests: happy path, conflict detection, concurrent writes (only one succeeds), version persistence across restart, invalid op type rejected. HTTP integration tests: 200 success, 409 conflict, 400 bad request. |
| **Acceptance** | All unit tests pass. All HTTP integration tests pass. Zero data corruption under concurrent load. |
| **Dependencies** | T4.1, T4.2 |
| **Estimated effort** | 2 hours |
| **Status** | ✅ (14 tests in patch-engine.spec.ts + 4 in hub-mcp.spec.ts for artifact.patch, 4 for artifact.getVersion) |

---

## Phase T5: ArtifactStore

> **Prerequisite:** Phase T3 complete. Phase T4 complete (PatchEngine provides versioning).

**Goal:** Extend Hub to store modality artifacts (diagrams, decks) with atomic writes (PQueue), rolling snapshots (last 20 versions), audit log (NDJSON), and file watcher for external changes.

**Architecture:**
```
MCP tool calls (whiteboard.read/update, presentation.read/update_slide)
  → ArtifactStore.read(path) / ArtifactStore.write(path, op, actor)
    → PQueue (concurrency 1 per file) → atomic write → snapshot (every 10 writes)
    → audit log append (NDJSON)
  → FileWatcher → invalidate in-memory cache on external changes
```

**Reference:** `/Users/Shared/dev/openspace/runtime-hub/src/services/ArtifactStore.ts`

**Status:** ✅ COMPLETE (2026-02-19, commits 5ae1993 / 9cf62c8 / 8835bb7)  
**Duration estimate:** 1 session  
**Exit criteria:** Hub uses ArtifactStore for all artifact reads/writes. Audit log written on every write. Rolling snapshots maintained. File watcher detects external changes.

**V&V Targets:**
- [x] `ArtifactStore.read(path)` returns artifact content from disk
- [x] `ArtifactStore.write(path, content, { actor, reason })` writes atomically via PQueue (tmp → fsync → rename)
- [x] Rolling backups: on every write, previous version copied to `.openspace/artifacts/history/`, oldest pruned beyond 20
- [x] Audit log: every write appended to `.openspace/artifacts/events.ndjson`
- [x] File watcher (chokidar): external edit → `FILE_CHANGED` event emitted; internal writes suppressed
- [x] Unit tests: read, write, concurrent writes, backup creation, audit log, watcher suppression (12 tests in artifact-store.spec.ts)

### T5.1 — ArtifactStore service
| | |
|---|---|
| **What** | Create `openspace-core/src/node/artifact-store.ts`. Port from reference implementation. Interface: `read(path): Promise<string>`, `write(path, content, meta: { actor, intent }): Promise<{ version: N }>`. Internals: in-memory cache, `p-queue` (concurrency 1 per file), `chokidar` file watcher, snapshot mechanism (every 10 writes). |
| **Acceptance** | Read returns correct content. Write is atomic. After 10 writes, `.snap-{N}` file exists. After 20 snapshots, oldest pruned. External edit → cache miss on next read. |
| **Dependencies** | Phase T4 complete |
| **Reference** | `openspace/runtime-hub/src/services/ArtifactStore.ts` |
| **Estimated effort** | 3 hours |
| **Status** | ✅ |

### T5.2 — Audit log
| | |
|---|---|
| **What** | Append NDJSON record to `{workspaceRoot}/.openspace/audit.ndjson` on every `ArtifactStore.write()`. Record format: `{ ts, actor, intent, path, version, opType }`. Rotate log at 10MB. Add `GET /openspace/audit` Hub endpoint (returns last 100 records). |
| **Acceptance** | Every write produces an audit record. Log rotation at 10MB. `GET /openspace/audit` returns valid JSON. |
| **Dependencies** | T5.1 |
| **Estimated effort** | 1 hour |
| **Status** | ✅ (audit log at `.openspace/artifacts/events.ndjson`; log rotation and GET endpoint deferred as out-of-scope for MVP) |

### T5.3 — Wire ArtifactStore into Hub MCP tools
| | |
|---|---|
| **What** | Update MCP tool handlers to use `ArtifactStore.read()` and `ArtifactStore.write()` instead of direct `fs` calls. `whiteboard.read/update` → ArtifactStore. `presentation.read/update_slide` → ArtifactStore. Retire direct `fs.readFile`/`fs.writeFile` in MCP handlers for artifact files. |
| **Acceptance** | All artifact reads go through ArtifactStore (cache-first). All artifact writes produce audit records and potential snapshots. No direct `fs` calls in MCP tool handlers for artifact files. |
| **Dependencies** | T5.1, Phase 4-Validation 4V.3 |
| **Estimated effort** | 1 hour |
| **Status** | ✅ (`openspace.file.write` routes through ArtifactStore; new `openspace.artifact.patch` and `openspace.artifact.getVersion` tools added) |

### T5.4 — ArtifactStore unit tests
| | |
|---|---|
| **What** | Unit tests: read from cache, read from disk (cache miss), concurrent writes serialize, snapshot creation at write #10, snapshot pruning beyond 20, audit log record format, file watcher invalidation, log rotation at 10MB. Integration test: write 25 times → verify only 20 snapshots exist, audit log has 25 records. |
| **Acceptance** | All unit tests pass. Integration test passes. No data corruption under concurrent load. |
| **Dependencies** | T5.1, T5.2 |
| **Estimated effort** | 2 hours |
| **Status** | ✅ (12 tests in artifact-store.spec.ts: read, write, atomic pattern, backup pruning, audit log, watcher suppression, concurrent serialization) |

---

## Phase T6: Voice Modality

> **Independent of T3–T5.** Can run in parallel with T4/T5 after T3 is complete. Does NOT block Phase 5.

**Goal:** Port the 3-FSM voice pipeline from openspace to theia-openspace. Whisper STT for prompt input. OpenAI TTS for agent responses. Barge-in detection. Priority-queued narration. Policy layer.

**Architecture (3 FSMs):**
```
Microphone → AudioFSM (idle→listening→processing→error)
                → Whisper STT → SessionFSM.sendTranscript()

Agent text → NarrationFSM (idle→queued→playing→paused)
               → Priority queue (low/normal/high)
               → OpenAI TTS → AudioPlayer
               → Barge-in detector → pause narration on user speech
```

**Reference:** `/Users/Shared/dev/openspace/runtime-hub/src/services/voice-orchestrator.ts`

**Status:** ✅ COMPLETE (2026-02-22, merge commit ef86eb6 — "feature/voice-modality — Kokoro TTS narration end-to-end")  
**Duration estimate:** 2 sessions  
**Exit criteria:** User can speak a prompt → Whisper transcribes → sent to agent. Agent response narrated via TTS. Barge-in pauses narration. Voice enable/disable toggle in settings.

> **Implementation note:** Voice pipeline implemented with Kokoro TTS (local, offline) rather than OpenAI TTS API. STT uses Whisper. Shared `voice-core` package extracted to `packages/voice-core/` and reused by both the Theia extension and a standalone VS Code extension (`openspace-voice-vscode/`). Policy wizard (`Voice: Set Policy`) replaces the planned settings panel.

**V&V Targets:**
- [x] `openspace-voice` extension created with proper DI module
- [x] AudioFSM: idle → listening (push-to-talk via `Ctrl+M`) → processing → idle
- [x] Whisper STT: microphone audio → transcribed text → injected into prompt input
- [x] NarrationFSM: idle → queued → playing → idle/paused
- [x] TTS narrates agent response text via Kokoro TTS (local)
- [x] Priority queue: high-priority narrations interrupt low-priority
- [x] Barge-in detection: user speech while narrating → pause narration
- [x] Policy layer: voice on/off toggle, speed (0.5x–2x), voice selection, narration toggle
- [x] MCP tool: `voice.set_policy` callable by agent
- [x] `Voice: Set Policy` interactive wizard (replaces settings panel)
- [x] Language selection in policy wizard
- [x] Text post-processing + custom vocabulary
- [x] VoiceWaveformOverlay: 32-bar animated canvas waveform
- [x] Status bar indicator synced to policy on startup
- [x] Unit tests for FSM state transitions (`voice-core` package + Theia extension)

### T6.1 — openspace-voice extension scaffold
| | |
|---|---|
| **What** | Create `extensions/openspace-voice/` extension. `VoiceService` interface (browser) for audio playback and microphone access. Backend proxy for Whisper API calls. Wire into `browser-app/package.json`. |
| **Acceptance** | Extension builds. Loads in Theia without errors. `VoiceService` is injectable. No audio functionality yet. |
| **Dependencies** | Phase T3 complete |
| **Estimated effort** | 1 hour |
| **Status** | ✅ |

### T6.2 — AudioFSM (STT input)
| | |
|---|---|
| **What** | Implement `AudioFSM`. States: `idle → listening → processing → error → idle`. On `stopListening`: send audio buffer to backend Whisper proxy → transcript → emit `onTranscript(text)`. Wire `onTranscript` to inject text into chat prompt input. Frontend uses `navigator.mediaDevices.getUserMedia`. |
| **Acceptance** | Push-to-talk → microphone active → release → transcript appears in prompt input. Errors handled gracefully. |
| **Dependencies** | T6.1 |
| **Estimated effort** | 3 hours |
| **Status** | ✅ (toggle keybinding `Ctrl+M`; `execCommand` injection into contentEditable prompt; language code normalization + FSM auto-reset) |

### T6.3 — NarrationFSM (TTS output)
| | |
|---|---|
| **What** | Implement `NarrationFSM`. States: `idle → queued → playing → paused → idle`. Priority queue: `{ text, priority: 'low' | 'normal' | 'high', id }`. Backend uses Kokoro TTS (local) → audio buffer → frontend plays via Web Audio API. Subscribe to `SessionService.onMessageStreaming` to enqueue agent response chunks. |
| **Acceptance** | Agent response narrated aloud. High-priority narration interrupts low-priority. Barge-in pauses narration. |
| **Dependencies** | T6.2 |
| **Estimated effort** | 3 hours |
| **Status** | ✅ (Kokoro TTS; NarrationFsm in `voice-core` package; SSE replay guard; exact-once isDone; gap tests for pause-when-idle/queued) |

### T6.4 — SessionFSM (voice session lifecycle)
| | |
|---|---|
| **What** | Implement `SessionFSM`. States: `inactive → active → suspended`. Coordinates AudioFSM and NarrationFSM. Policy: `{ enabled, speed, voice }` from settings. MCP tool `voice.set_policy` updates policy via SessionFSM. Wire to Theia session lifecycle. |
| **Acceptance** | Enabling voice → AudioFSM starts. Disabling → both FSMs stop. Policy changes take effect immediately. Session switch preserves voice state. |
| **Dependencies** | T6.2, T6.3 |
| **Estimated effort** | 2 hours |
| **Status** | ✅ (SessionFsm in `extensions/openspace-voice/src/browser/session-fsm.ts`; default voice enabled, narration off, speed 1x) |

### T6.5 — Voice settings UI + MCP tool
| | |
|---|---|
| **What** | `Voice: Set Policy` interactive wizard; language selection; custom vocabulary; speed (0.5x–2x); narration toggle. Add MCP tool `voice.set_policy` accepting `{ enabled?, speed?, voice? }`. |
| **Acceptance** | Policy wizard visible and functional. `voice.set_policy` MCP tool callable and updates policy. Status bar synced. |
| **Dependencies** | T6.4 |
| **Estimated effort** | 2 hours |
| **Status** | ✅ (wizard in VoiceCommandContribution; language selection; text post-processing + custom vocabulary; status bar sync on startup) |

### T6.6 — Voice integration test
| | |
|---|---|
| **What** | Manual + automated test: enable voice, push-to-talk, speak prompt → transcript appears, send → agent responds → TTS narrates, barge-in pauses narration, `voice.set_policy` MCP tool updates policy. |
| **Acceptance** | Full STT → agent → TTS round-trip working. Barge-in functional. Policy updates apply. |
| **Dependencies** | T6.1–T6.5 |
| **Estimated effort** | 1 hour |
| **Status** | ✅ (unit tests in `voice-core` for NarrationFsm gap cases + stereo WAV; `openspace-voice-vscode` VS Code extension also implemented and tested) |

---

## Phase 5: Polish & Desktop

> **Prerequisite:** Phases T3 + T4 + T5 complete ✅. Phase T6 independent ✅.

**Goal:** Production-quality application. Electron desktop build, settings UI, custom theming, persistence, session sharing.

**Status:** ⬜ NOT STARTED (prerequisites now met — T3 ✅ T4 ✅ T5 ✅)  
**Duration estimate:** 2 sessions  
**Exit criteria:** Shippable desktop application. All features working. E2E test suite passing.

**V&V Targets:**
- [ ] Default layout: chat right panel, file tree left sidebar, editors main area, terminal bottom
- [ ] Custom dark theme applied by default; light theme toggleable
- [ ] Settings panels: provider config, model selection, appearance settings all functional
- [ ] `yarn build:electron` produces runnable `.app` (macOS)
- [ ] Panel layout persists across restarts
- [ ] Session sharing generates link via opencode API
- [ ] E2E test suite (5.7) passes in < 10 minutes

### 5.1 — Custom layout contributions
| | |
|---|---|
| **What** | Configure default layout via `openspace-layout` extension: chat in right panel, file tree in left sidebar, main area for editors/presentations/whiteboards, terminal in bottom panel. |
| **Acceptance** | Fresh install opens with opinionated, usable layout. User can still rearrange panels. |
| **Dependencies** | Phases 1–4 complete |
| **Status** | ⬜ |

### 5.2 — Custom theming / branding
| | |
|---|---|
| **What** | Create custom dark and light themes. Override CSS variables. Custom app icon. Style chat widget, session sidebar, and modality widgets to have a cohesive look. |
| **Acceptance** | App looks distinct from stock Theia. Dark mode is default and polished. Light mode works. |
| **Dependencies** | 5.1 |
| **Status** | ⬜ |

### 5.3 — Settings panels
| | |
|---|---|
| **What** | Create `openspace-settings` extension: provider configuration, agent configuration, appearance settings, keyboard shortcuts. Uses Theia preference system where possible, custom ReactWidgets for complex panels. |
| **Acceptance** | Users can configure providers, select models, change themes from a settings UI. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 5.4 — Electron desktop build
| | |
|---|---|
| **What** | Configure `electron-app/` with Electron packaging: native menus, window controls, app icons (macOS/Windows/Linux), auto-update framework. |
| **Acceptance** | `yarn build:electron` produces a runnable `.app` (macOS). Application connects to opencode server, all features work. |
| **Dependencies** | 5.1, 5.2 |
| **Status** | ⬜ |

### 5.5 — Pane configuration persistence
| | |
|---|---|
| **What** | Persist user's panel layout, sizes, and open tabs across sessions using Theia's `StorageService`. On restart, restore the last layout. Handle gracefully when previously-open files no longer exist. |
| **Acceptance** | Close Theia → reopen → same layout, same open tabs. |
| **Dependencies** | Phase 3 (PaneService) |
| **Status** | ⬜ |

### 5.6 — Session sharing
| | |
|---|---|
| **What** | Generate a shareable session link via opencode API (`shareSession()`). Display link in a modal. |
| **Acceptance** | Can share a session → get a link. |
| **Dependencies** | Phase 1 complete |
| **Status** | ⬜ |

### 5.7 — E2E test suite
| | |
|---|---|
| **What** | Comprehensive Playwright E2E test suite: app launch, session CRUD, message send/receive, file editing, terminal usage, agent MCP tool execution, presentation creation/navigation, whiteboard drawing, settings changes, session persistence. Run in CI. |
| **Acceptance** | All tests pass. Test suite runs in < 10 minutes. CI integration. |
| **Dependencies** | All previous phases |
| **Status** | ⬜ |

---

## Phase 6: Extended Features (Post-MVP)

These are independent post-MVP features that can be done in any order. **6.8 (Extension Marketplace) is complete.**

| Task | What | Status |
|------|------|--------|
| 6.1 — i18n | Port i18n system from opencode client. 16 locales. | ⬜ |
| 6.2 — Comments / annotations | Agent and user add comments anchored to code lines (like PR review). Monaco decorations + sidebar panel. | ⬜ |
| 6.3 — Diff review modality | Side-by-side diff viewer with accept/reject controls. Agent opens diff review widget. | ⬜ |
| 6.4 — Browser preview modality | Embedded browser (iframe or Electron webview) for previewing web apps. Agent can navigate, screenshot, inspect DOM. | ⬜ |
| 6.5 — Auto-updater | Electron auto-update via GitHub Releases. Notification UI for available updates. | ⬜ |
| 6.6 — Custom tldraw shapes | Register custom tldraw shape types for structured diagrams: ClassBox (UML), InterfaceBox, State, Decision, Process, Lifeline. (Deferred from Phase 4.) | ⬜ |
| 6.7 — LLM inline completions (ghost text) | Wire `monaco.languages.registerInlineCompletionsProvider()` in `openspace-languages` to call the existing OpenCode AI backend (via `opencode-proxy.ts`). Gives Copilot-style tab-to-accept ghost text completions for all supported languages. Infrastructure is fully present: `InlineCompletionsController` auto-registers, `@theia/ai-core` already defines a `default/code-completion` model alias. Needs: a `LanguageModelInlineCompletionProvider` class, debounced trigger on cursor position change, streaming response from the LLM formatted as `InlineCompletion[]`, and an accept/dismiss keybinding. | ⬜ |
| 6.8 — Extension marketplace | `@theia/plugin-ext` + `@theia/plugin-ext-vscode` + `@theia/vsx-registry` added to browser-app. `plugins/builtin/` manifest + download script. Curated recommendations: YAML, git-graph, prettier, markdown-all-in-one, python. `Ctrl+Shift+X` Extensions sidebar live with Open VSX search. Ephemeral `THEIA_CONFIG_DIR` prevents dev-session plugin persistence. | ✅ |

---

## Technical Debt

### E2E Test Infrastructure Gap

**Issue:** E2E tests written for Architecture B1 assume browser HTTP requests can be mocked with Playwright's `page.route()`, but Architecture B1 uses backend-side RPC (Node.js backend → Hub → OpenCode). Browser-level mocks cannot intercept server-side HTTP calls.

**Impact:** E2E tests for Tasks 2.0+ cannot properly mock backend data. Only smoke tests can pass. Full E2E coverage requires infrastructure rebuild.

**Status:** Tracked — needs dedicated investigation track

**Recommended solution:** Use real backend (Hub + OpenCode) during E2E tests, create real test data via API.

**Estimated effort:** 6–8 hours  
**Detailed analysis:** `docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md`

### Phase T3.7 — MCP Integration E2E Test

**Issue:** Full MCP integration E2E test (T3.7) is 🔶 DONE-NOT-VALIDATED. Unit tests (12 security gate tests) pass. Full E2E test requires a live Theia + OpenCode server environment — deferred.

**Status:** 🔶 DONE-NOT-VALIDATED — revisit during Phase 5.7 (E2E test suite)

### MCP Read-Tool Latency: Push-Based Pane Cache

**Issue:** All MCP read tools (`pane.list`, `editor.read_file`, etc.) incur a full bridge round-trip: MCP HTTP → Hub → RPC WebSocket → browser → response. This adds 200–500ms per call regardless of how cheap the underlying browser-side operation is.

**Root cause:** The browser is the sole source of truth for IDE state (widget list, open files, etc.), so every read requires a round-trip from the Node hub to the browser and back.

**Recommended solution (push-based cache):**
- `PaneService.onPaneLayoutChanged` already emits a full `PaneStateSnapshot` on every layout change (pane open/close/focus/resize).
- The Hub should subscribe to these events over the bridge (push path) and store the last snapshot in memory.
- `pane.list` then returns the cached snapshot synchronously — no round-trip, <5ms latency.
- Same pattern can be applied to any other read-heavy tool (editor open files, terminal list, etc.).

**Scope:** Affects ALL MCP read tools. Implementing for `pane.list` alone is a 1–2 hour task; a general push-cache for all read tools is ~4 hours.

**Status:** ⬜ NOT STARTED  
**Estimated effort:** 1–4 hours (pane.list only → all read tools)  
**Dependencies:** Phase T3 complete (already done)

---

### Phase 2B.6 — SDK Type Drift Detection (CI)

**Issue:** No automated check that extracted SDK types stay in sync with `@opencode-ai/sdk` updates.

**Status:** ⬜ NOT STARTED

**What:** GitHub Actions workflow that runs `npm run extract-sdk-types` on schedule, checks `git diff opencode-sdk-types.ts` for changes, fails build on drift, creates PR with updated types.

---

## Cross-Cutting Concerns

### CC.1 — Error handling
Every command and service method must return structured results: `{ success: true, data: ... }` or `{ success: false, error: string, code?: string }`. No silent failures. Errors from agent MCP tools must be logged and surfaced as notifications.

### CC.2 — Logging
Use Theia's `ILogger` throughout. Log levels: DEBUG (SSE events, HTTP calls), INFO (session created, command executed), WARN (reconnection, stale state), ERROR (failures).

### CC.3 — Testing
Unit tests for all services (mock DI dependencies). Integration tests for backend ↔ opencode server communication. Widget tests for React components. E2E tests for user workflows (Playwright). Minimum 80% coverage for core services. **Current:** 446/446 unit tests passing (2026-02-18).

### CC.4 — Documentation
README with setup instructions. Architecture decision records (TECHSPEC). API documentation for all RPC protocols. Developer guide for creating new modality extensions.

---

## Critical Path

```
[COMPLETE] Phase 0 → Phase 1 → Phase 1B1 → Phase 2B → Phase 3 → Phase T3
                                                                       │
                          ┌────────────────────────────────────────────┤
                          │                                            │
                          ▼                                            ▼
                    Phase 1C                                     Phase 4-Val
                 (Code Hardening)                            (Wire Phase 4 → MCP)
                          │                                            │
                          │                                            ▼
                          │                                       Phase T4
                          │                                      (PatchEngine)
                          │                                            │
                          │                                            ▼
                          │                                       Phase T5
                          │                                     (ArtifactStore)
                          │                                            │
                          └───────────────────┬────────────────────────┘
                                              │
                                              ▼
                                         Phase 5
                                    (Polish & Desktop)
                                              │
                                              ▼
                                         Phase 6 (ongoing)

Phase 2 (Chat Polish) — independent, can run in parallel with Phase 1C / T4 / T5
Phase T6 (Voice) ——————— independent, can run in parallel with T4 / T5
```

**Blocking chain:**
```
1C → (parallel) → 4-Val → T4 → T5 → Phase 5
```

**Parallelizable right now:**
- Phase 1C and Phase 4-Validation are both unblocked
- Phase 2 (Chat Polish) is unblocked and independent
- Phase T6 (Voice) is unblocked and independent

---

*End of WORKPLAN-THEIA-OPENSPACE*
