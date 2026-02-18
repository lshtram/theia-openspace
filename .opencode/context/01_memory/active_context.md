# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-18

## Current Focus
- **Status:** PHASE 2B.7 COMPLETE ✅ — Unit test infrastructure fixed, all 375 tests passing
- **Next:** Phase 1C.1 — Fix T1 Blocking Issues (10 security/crash bugs)
- **Completed (2026-02-18):**
  - Phase 0: All tasks (0.1–0.8) ✅
  - Phase 1: All tasks (1.1–1.15) ✅
  - Phase 1B1: All tasks (1B1.1–1B1.8) ✅
  - Phase 2B: All tasks (2B.1–2B.5) ✅ — SDK types adopted
  - Phase 2B.7: Unit test infrastructure ✅ — 375/375 tests passing
  - Phase 3: All tasks (3.1–3.11) ✅
  - Phase 4: All tasks (4.1–4.6) ✅ — Presentation and whiteboard modalities complete
  - Scout research: OpenCode SDK — RFC-002 FINAL (`docs/architecture/RFC-002-OPENCODE-SDK-RESEARCH.md`)
  - Decision document: `docs/architecture/DECISION-SDK-ADOPTION.md` v2.0 — Hybrid Approach APPROVED (2026-02-18)
  - ESM/CJS blocker discovered: SDK is ESM-only, Theia requires CJS, TypeScript cannot import ESM in CJS
  - Six approaches evaluated (static import, node16, bundler, dynamic import, fork, wait) — only hybrid works
  - Phase 2B scope revised: ~263 lines (types only) vs ~1,450 originally planned (types + HTTP + SSE)
  - Phase 2B tasks revised: 5 tasks (2B.1–2B.5), 6-8 hours estimated (down from 12-18)
  - WORKPLAN.md updated with hybrid approach tasks
  - Builder contract rewritten: `contract.md` v2.0
  - Phase 3 requirements document created and audited
  - Multi-perspective audit (4 perspectives, 15 gaps identified)
  - User decision: All BLOCKING + RECOMMENDED gaps integrated into Phase 3 requirements
  - Architecture refactor: C → B1 complete
  - **Full codebase code review complete (2026-02-18):**
    - 7 parallel CodeReviewer subagents reviewed all code from Phases 0, 1, 1B1, 3, 4
    - 54 issues identified: 10 T1 blocking, 28 T2 important, 16 T3 minor
    - Review report: `docs/reviews/CODE-REVIEW-FULL-CODEBASE.md`
    - Phase 1C added to WORKPLAN.md (7 tasks: 1C.1–1C.7, ~14–22 hours estimated)
    - Detailed implementation plan: `docs/tasks/PHASE-1C-HARDENING-PLAN.md`
    - **User decision:** Execute Phase 1C immediately after Phase 2B completes (before Phase 5)
- **Next:** Phase 1C Hardening → Phase 5 Polish & Desktop

## Phase 1C: Code Hardening & Quality Pass — Plan Summary (APPROVED 2026-02-18)

**Strategic timing:** Immediately after Phase 2B, before Phase 5 deployment  
**Rationale:** Avoid duplicate work (SDK refactor resolves some issues), clean break point, Phase 4 already deployed (security issues upgraded to critical)

| Task | What | Effort | Priority |
|------|------|--------|----------|
| 1C.1 | Fix T1 blocking (10 issues): dangerous commands, XSS, symlinks, crashes, tests | 4–6h | CRITICAL |
| 1C.2 | Fix T2 security (7 issues): Hub auth, sensitive files, permission dialog, file limits | 3–4h | HIGH |
| 1C.3 | Fix T2 reliability (21 issues): memory leaks, dead code, disposal, type safety | 2–3h | MEDIUM |
| 1C.4 | Dead code cleanup: duplicates, spike files, unused types | 2h | LOW |
| 1C.5 | Test infrastructure: Jest/Mocha conflict, phantom tests, flaky timeouts | 3–4h | MEDIUM |
| 1C.6 | T3 minor fixes (16 issues): as time allows | 2–4h | LOW |
| 1C.7 | Security review & validation: checklist, penetration testing | 1–2h | HIGH |

**Total effort:** 14–22 hours (1–2 sessions)

**Key issues by category:**
- **Security (T1+T2):** 17 issues — XSS, path traversal, dangerous commands, Hub auth, postMessage origin, file size limits
- **Reliability (T2):** 21 issues — memory leaks, fake returns, subscription leaks, dead code, type duplicates
- **Tests (T1+T2):** 13 issues — runner conflict, tautological tests, phantom tests, flaky timeouts
- **Minor (T3):** 16 issues — cleanup, style, configuration hardcoding


| Task | What | Effort | Dependencies |
|------|------|--------|-------------|
| 2B.1 | Extract SDK types + npm script | 1h | Phase 1B1, Phase 3 complete |
| 2B.2 | Create type bridge in opencode-protocol.ts | 2h | 2B.1 |
| 2B.3 | Update consumers for field renames + Part types | 2h | 2B.2 |
| 2B.4 | Cleanup hand-written types + documentation | 1h | 2B.3 |
| 2B.5 | Integration verification | 1–2h | 2B.4 |

**Deferred (ESM/CJS blocker):**
- ~~2B.5~~ Replace HTTP calls with SDK client — BLOCKED until Theia ESM migration or SDK CJS builds
- ~~2B.6~~ Replace SSE handling with SDK events — BLOCKED until ESM/CJS resolved

**Key decisions:**
- SDK installed as devDependency (types source only, not runtime)
- SDK types extracted to `src/common/opencode-sdk-types.ts` (3,380 lines, zero imports)
- npm script `extract-sdk-types` for type re-extraction on SDK updates
- HTTP/SSE client stays unchanged (logic same, just retyped with SDK types)
- `eventsource-parser` dependency stays
- Stream interceptor unchanged (operates on raw SSE, not SDK events)
- `OpenCodeService` DI interface unchanged — callers don't need to change
- Phase 2B blocks nothing (types only, zero runtime changes)

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
