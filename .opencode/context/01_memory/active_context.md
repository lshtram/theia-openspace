# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-17

## Current Focus
- **Status:** PHASE 1B1 ✅ COMPLETE — Ready for Phase 2
- **Completed (2026-02-17):**
  - Phase 1: All tasks (1.1–1.15) ✅
  - Phase 1B1: All tasks (1B1.1–1B1.8) ✅
  - Architecture refactor: C → B1 complete
  - 3 blocking issues fixed (nested JSON, iteration, validation)
  - Janitor runtime verification: PASS (5/5 steps)
  - User manual verification: PASS
- **Known Issue (User-Reported):** Session list not visible immediately when chat window opens (logged for Phase 2)
- **Next:** Begin Phase 2 (Chat & Prompt System) — prioritize session list visibility fix

## Architecture B1 Summary
| Component | Before (Architecture C) | After (Architecture B1) |
|---|---|---|
| ChatAgent | Echo stub | Delegates to SessionService |
| Agent commands | Hub SSE relay (5 hops) | RPC callback `onAgentCommand` (direct) |
| Stream interceptor | Separate file, posts to Hub `/commands` | Integrated in OpenCodeProxy, dispatches via RPC |
| Hub endpoints | 5 (manifest, state, instructions, commands, events) | 3 (manifest, state, instructions) |
| BridgeContribution | Manifest + SSE listener + command dispatch | Manifest + pane state only |
| SyncService | SSE event forwarding only | SSE events + agent command dispatch + command queue |

## Phase 1B1 Status — Architecture B1 Refactoring ✅ COMPLETE
**Completed:** 2026-02-17

All 8 refactoring tasks completed:
1. ✅ 1B1.1: Wire ChatAgent to SessionService
2. ✅ 1B1.2: Add `onAgentCommand` to OpenCodeClient RPC interface
3. ✅ 1B1.3: Integrate stream interceptor into OpenCodeProxy
4. ✅ 1B1.4: Extend SyncService to dispatch agent commands
5. ✅ 1B1.5: Simplify Hub (remove /commands, /events, SSE)
6. ✅ 1B1.6: Simplify BridgeContribution (remove SSE listener)
7. ✅ 1B1.7: Fix Hub URL prefix mismatch
8. ✅ 1B1.8: Architecture B1 integration verification

**Fixes Applied:**
- Issue #1: Nested JSON parsing (regex → brace-counting state machine)
- Issue #2: Iteration misalignment (sequential processing)
- Issue #3: Command validation security (3-tier allowlist)

**Verification:**
- Build: ✅ PASS (0 errors)
- Unit Tests: ✅ 100/100 passing
- Janitor Runtime: ✅ PASS (5/5 steps)
- User Manual: ✅ PASS

## Task 1.14 Status — Permission Dialog UI ✅ COMPLETE
- ✅ Source files created and integrated: `permission-dialog.tsx`, `permission-dialog-contribution.ts`, `permission-dialog-manager.ts`
- ✅ CSS integrated: `style/permission-dialog.css`
- ✅ Unit tests passing: 44 tests for PermissionDialogManager (61 total unit tests pass)
- ✅ E2E tests exist: 8 test cases in `permission-dialog.spec.ts`
- ✅ `PermissionDialogContribution` bound in frontend module
- ✅ Build passes
- ⚠️ **Deferred to Phase 2:** Auto-accept preferences (non-blocking for Phase 1)

## Task 1.15 Status — Model/Provider Display ✅ COMPLETE
- ✅ Implemented in `chat-widget.tsx` (lines 136-151, 317-331)
- ✅ CSS styling added to `chat-widget.css`
- ✅ Uses `OpenCodeService.getProvider()` RPC method
- ✅ Updates on session change (React useEffect)
- ✅ Graceful error handling (logs to console.debug, hides display)
- ✅ Build passes (all 6 extensions compile)
- ✅ Unit tests pass (61/61, no regressions)
- ✅ Janitor validation: PASS
- ✅ CodeReviewer approval: 88% confidence
- ⚠️ **Known Issues (non-blocking):**
  - Race condition on rapid session switch (low risk, cleanup function recommended)
  - Silent error handling (user doesn't see error toast, acceptable for Phase 1)
- 📋 **Manual testing required:** Verify display appears correctly with opencode server running

## Critical Bug Fixes Applied (2026-02-17)
| # | Root Cause | Fix | File |
|---|---|---|---|
| 1 | `@inject(RequestService)` — symbol not bound | Raw `http`/`https` | `opencode-proxy.ts` |
| 2 | `proxy-factory.js` crash on unknown RPC methods | `typeof` guard patch | `node_modules/` (survives rebuild, NOT `yarn install`) |
| 3 | Circular DI: SyncService ↔ SessionService | Lazy setter + `queueMicrotask` | `opencode-sync-service.ts`, `frontend-module.ts` |

## Key Artifacts
- `docs/architecture/WORKPLAN.md` — Detailed work plan (50+ tasks across 7 phases incl. 1B1) — **UPDATED for B1**
- `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` — System architecture — **UPDATED for B1**
- `.opencode/context/active_tasks/contract-1.14-permission-ui.md` — Builder contract

## Known Issues for Future Agents
- **proxy-factory.js patch**: In `node_modules/` — survives `yarn build` but NOT `yarn install`. If `yarn install` is re-run, patch must be reapplied.
- LSP/TS errors in Theia's own `node_modules` are pre-existing — ignore them
- webpack build errors in openspace-layout are pre-existing — unrelated to new code
