# Progress

## Current Milestones

### TTS Sentence-Chunk Streaming (2026-02-27) -- COMPLETE

Reduced narration first-audio latency from "full text synthesis wait" to
"first sentence ready" (~300–600ms on CPU, vs multiple seconds previously).

Architecture:
- Backend: `narrateTextStreaming()` splits cleaned text into sentences,
  synthesizes each, streams NDJSON chunks over chunked HTTP transfer
- Browser: `NarrationFsm.fetchAndPlay()` reads `ReadableStream`, decodes and
  plays each chunk in seq order while next chunk synthesizes in parallel

Files changed:
- `sentence-splitter.ts` (new utility)
- `voice-backend-service.ts` (new `narrateTextStreaming` method + `NarrateStreamChunk`)
- `voice-hub-contribution.ts` (route updated for NDJSON streaming)
- `narration-fsm.ts` (streaming fetchAndPlay + exported `parseNdjsonLines` helper)

Commits: `a628d51`, `295ca2b`, `38d3339`, `93a145b`
Tests: **1307 passing, 0 failing, 1 pending**

### God Object Decomposition (2026-02-26/27) -- COMPLETE

**Branch:** `refactor/god-object-decomposition` (pushed to origin)
**Design doc:** `docs/plans/2026-02-27-god-object-decomposition-design.md`
**Constraint:** All modules <400 lines. No public API changes. Sub-directories per god object.

**6 phases, 7 commits, 46 modules created:**

| Phase | Monolith | Lines | Modules | Commit |
|-------|----------|-------|---------|--------|
| 1 | `hub-mcp.ts` (node) | 956 -> 1148 | 10 | `4af4f01` |
| 2 | `opencode-proxy.ts` (node) | 1330 -> 1471 | 6 | `5a221bb` |
| 3 | `session-service.ts` (browser) | 2118 -> 1701 | 7 | `583af66` |
| 4a | `message-bubble.tsx` (chat) | 1455 -> 1402 | 6 | `228ce9b` |
| 4b | `chat-widget.tsx` (chat) | 1280 -> 1513 | 7 | `392b836` |
| 4c | `prompt-input.tsx` (chat) | 1186 -> 1512 | 10 | `859f786` |

Tests: **1231 passing, 0 failing, 1 pending** — maintained across all commits.

**Key decisions:**
- Sub-directories over flat files (user chose this)
- No barrel files — direct imports (matches project convention)
- DOMPurify for sanitization in prompt-input (community library over custom)
- `userMessageIds` shared between SseConnectionManager and SseEventRouter (intentional coupling)
- Session sub-services use DI with `@injectable()` and 5 new symbols
- Chat frontend modules are plain React (no DI) — hooks extracted, facade wires them

**Phase 1 (hub-mcp/):** 10 files — types, file-utils, editor-tools, file-tools, pane-tools, presentation-tools, terminal-tools, voice-tools, whiteboard-tools, hub-mcp facade
**Phase 2 (opencode-proxy/):** 6 files — http-client, rest-api, sse-connection, sse-event-router, node-utils, opencode-proxy facade
**Phase 3 (session-service/):** 7 files — types, model-preference, interaction-handlers, message-store, session-lifecycle, streaming-state, session-service facade
**Phase 4a (message-bubble/):** 6 files — tool-constants, message-actions, content-part-renderer, task-tool-block, tool-call-renderer, message-bubble facade
**Phase 4b (chat-widget/):** 7 files — use-session-subscriptions, use-session-actions, use-message-queue, use-shell-execution, use-model-preference, chat-header-bar, chat-widget facade
**Phase 4c (prompt-input/):** 10 files — 4 pre-existing (types, build-request-parts, parse-from-dom, prompt-context-items) + 6 new (cursor-utils, prompt-constants, sanitize-html, use-prompt-history, use-typeahead, use-attachments) + rewritten facade

### R1 Hygiene (2026-02-27) -- COMPLETE

All 7 code quality issues from CODE-REVIEW-2026-02-27.md fixed and merged to master.
Tests: **1231 passing, 0 failing, 1 pending**

| Task | Item | Fix |
|------|------|-----|
| I9 | Platform-aware shell | `node-utils.ts` |
| M13 | Structured logger | `HubLogger` interface, `FileDeps.logger` |
| C2 | ReDoS guard | `isSafeRegex` in `file-utils.ts` |
| C3 | Async fs | `searchFiles` async, `artifact-store` async |
| C1/E2 | `getMcpConfig` RPC | Moved to backend, removed browser `fs` import |
| I8 | Prune localStorage | `pruneStaleEntries` in notification-service |
| I5 | DOMPurify | Replaced custom sanitize impl in `sanitize-html.ts` |

Note: `searchFiles` is now async — all callers must `await` it.



All 13 items (S1-A through S3-C) confirmed implemented. 6 CSS classes added for hygiene.

### Phase 2.5 Post-Merge Hardening (2026-02-26) -- COMPLETE

Merge commit `a8b5873`. Post-merge fixes: 5 compile errors, 5 test mock gaps, P1-B dblclick fix, P1-E + P2-E re-added. Final: 1270 passing on master. Pushed as `990f26e`.

### BUG-7 + CPU Streaming Fix (2026-02-25) -- COMPLETE

Session diff JSON parsing + 5 memoizations in message-bubble.tsx.

### Code Review Fixes Merge (2026-02-25) -- COMPLETE

12 fixes from CODE-REVIEW-2026-02-24.md. 822 tests, 130/131 E2E. Commit `9b8b3ee`.

### Phase T3: MCP Agent Control (2026-02-22) -- COMPLETE

17 MCP tools. Stream interceptor retired. 387 unit tests.

### E2E Suite Rewrite + Hook Fixes (2026-02-18) -- COMPLETE

28 passed, 6 skipped. Real assertions replacing 30 fake tests.

### 9 Critical Chat Bug Fixes (2026-02-18) -- COMPLETE

412 unit tests passing.

### Phase 1C Code Hardening (2026-02-18) -- COMPLETE

54 issues fixed (10 T1 + 28 T2 + 16 T3). 412 unit tests.

### Phase 2B SDK Type Adoption (2026-02-18) -- COMPLETE

Hybrid approach: types extracted from ESM-only SDK.

### Phase 1B1 Architecture Refactoring (2026-02-17) -- COMPLETE

C->B1 refactor. 100 unit + 21 E2E tests.

## Archived Milestones
- [x] NSO initialized (2026-02-16)
- [x] Phase 0: Scaffold — ALL 8 TASKS COMPLETE
- [x] Phase 1: Core Connection + Hub (13/14 tasks)
- [x] Phase 1B1: Architecture B1 refactoring (8 tasks)
- [x] Phase 2B: SDK type adoption (5 tasks)
- [x] Phase 1C: Code hardening (54 issues)
- [x] Phase T3: MCP agent control (17 tools)
- [x] Phase 4: Modality surfaces (presentation, whiteboard)
- [x] Phase T4/T5/T6/EW/EW.5: ArtifactStore, PatchEngine, voice, waveform
- [x] Phase 6.8/1C: E2E suite
- [x] Phase 2.5: Chat parity (15 features)
- [x] Phase 2.6: Session management parity (13 items)
- [x] God Object Decomposition (8,325 lines -> 46 modules)
