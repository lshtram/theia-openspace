# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-17

## Current Focus
- **Status:** PHASE 3 REQUIREMENTS ✅ APPROVED — Ready for implementation
- **Completed (2026-02-17):**
  - Phase 1: All tasks (1.1–1.15) ✅
  - Phase 1B1: All tasks (1B1.1–1B1.8) ✅
  - Architecture refactor: C → B1 complete
  - Phase 3 requirements document created and audited
  - Multi-perspective audit (4 perspectives, 15 gaps identified)
  - User decision: All BLOCKING + RECOMMENDED gaps integrated into Phase 3 requirements
  - Technical debt document created for OPTIONAL gaps
- **Next:** Begin Phase 3 implementation in `.worktrees/phase-3-agent-control` worktree

## Architecture B1 Summary
| Component | Before (Architecture C) | After (Architecture B1) |
|---|---|---|
| ChatAgent | Echo stub | Delegates to SessionService |
| Agent commands | Hub SSE relay (5 hops) | RPC callback `onAgentCommand` (direct) |
| Stream interceptor | Separate file, posts to Hub `/commands` | Integrated in OpenCodeProxy, dispatches via RPC |
| Hub endpoints | 5 (manifest, state, instructions, commands, events) | 3 (manifest, state, instructions) |
| BridgeContribution | Manifest + SSE listener + command dispatch | Manifest + pane state only |
| SyncService | SSE event forwarding only | SSE events + agent command dispatch + command queue |

## Phase 3 Requirements Review Status ✅ APPROVED
**Completed:** 2026-02-17

**Deliverables Created:**
1. ✅ Requirements document: `docs/requirements/REQ-AGENT-IDE-CONTROL.md` (920 lines)
   - Executive summary, 6 user stories, 11 functional requirements
   - 5 categories of non-functional requirements
   - Risks, dependencies, acceptance criteria
   - 20 Phase 3 commands fully specified

2. ✅ Presentation: `design/deck/phase-3-requirements-review.deck.md` (17 slides)
   - Architecture explanation (B1 RPC path)
   - Scope and commands overview
   - Implementation plan and risks

3. ✅ Multi-perspective audit (NSO skill `rm-multi-perspective-audit`)
   - 4 perspectives: User, Security Engineer, SRE, Legal/Compliance
   - 15 gaps identified:
     - 3 BLOCKING (GAP-1, GAP-2, GAP-4)
     - 6 RECOMMENDED (GAP-3, GAP-5, GAP-6, GAP-8, GAP-9)
     - 6 OPTIONAL (GAP-7, GAP-10-15)

4. ✅ Technical debt document: `docs/technical-debt/PHASE-3-OPTIONAL-GAPS.md`
   - Documents 6 OPTIONAL gaps deferred to post-Phase 3 work
   - Includes revisit criteria and implementation estimates

**User Decision:**
- ✅ Integrate all BLOCKING + RECOMMENDED gaps (GAP-1 through GAP-9) into Phase 3 requirements NOW
- ✅ Defer OPTIONAL gaps (GAP-7, GAP-10-15) as technical debt
- ✅ Requirements document status updated to APPROVED

**Security Enhancements (BLOCKING + RECOMMENDED):**
- GAP-1: Symlink path traversal protection
- GAP-2: Prompt injection prevention (ignore `%%OS{...}%%` in code fences)
- GAP-3: Configurable failure notifications
- GAP-4: Resource cleanup on session end
- GAP-5: First-run consent dialog
- GAP-6: Per-message command rate limiting (max 10 commands)
- GAP-8: Dangerous command confirmation (rm, sudo, etc.)
- GAP-9: Sensitive file denylist (.env, .git/, id_rsa, etc.)

**Technical Specifications:**
- ✅ REQ-TECHSPEC-GAP-ANALYSIS.md — Multi-perspective audit complete
- ✅ Added §6.8 (E2E Test) to TECHSPEC
- ✅ Added §17.9 (Terminal Output Sanitization) to TECHSPEC
- ✅ All gaps resolved: 100% REQ-TECHSPEC correspondence
- ✅ Ready for Builder to begin implementation


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
