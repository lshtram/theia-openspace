---
id: STATUS-PHASE-2B-SDK-ADOPTION-V2
author: oracle_e4c1
date: 2026-02-18
task_id: phase-2b-sdk-adoption
version: 2.0 (Hybrid Approach)
---

# Task Status: Phase 2B — SDK Adoption (Hybrid Approach)

## Current State
- **Status:** 🟡 **READY FOR BUILDER** — Contract revised for hybrid approach
- **Worktree:** `.worktrees/phase-2b-sdk-adoption` (clean, ready for work)
- **Contract:** ✅ APPROVED v2.0 (Hybrid Approach — Types Only)
- **Decision:** `docs/architecture/DECISION-SDK-ADOPTION.md` v2.0 (Hybrid Approach)
- **WORKPLAN:** Updated with revised Phase 2B tasks (2B.1–2B.5, 6-8h)

## Approach Change: Original Plan → Hybrid (2026-02-18)

**Original Plan (BLOCKED):**
- Replace ~1,450 lines: HTTP client + types + SSE handling
- Use SDK runtime client (`createOpencodeClient()`)
- Use SDK event subscription (`client.event.subscribe()`)
- Remove `eventsource-parser` dependency
- Estimated: 12-18 hours

**Critical Blocker Discovered:**
- SDK is ESM-only (`"type": "module"`)
- Theia requires CommonJS (`"module": "commonjs"`)
- TypeScript cannot import ESM in CJS projects (6 approaches evaluated, all failed)
- See `DECISION-SDK-ADOPTION.md` §6 for full blocker analysis

**Approved Hybrid Approach:**
- Replace ~263 lines: type definitions only
- Extract SDK's `dist/gen/types.gen.d.ts` (3,380 lines, zero imports) → local file
- Keep hand-rolled HTTP/SSE client (now typed with SDK types)
- Keep `eventsource-parser` dependency
- Estimated: 6-8 hours

**Primary Goal Still Achieved:**
- ✅ Type compatibility with OpenCode API
- ✅ Fixes 7 field name mismatches
- ✅ Adds 9 missing Part types
- ✅ Adds 11 missing event types
- ⏸️ Runtime SDK benefits deferred until ESM/CJS blocker resolved

## Worktree Setup
✅ Worktree created at `.worktrees/phase-2b-sdk-adoption`  
✅ Task workspace created at `.opencode/context/active_tasks/phase-2b-sdk-adoption/`  
✅ Contract approved: `contract.md` v2.0  
✅ Audit complete: `audit-report.md` (all gaps mitigated)  
🟡 Builder NOT yet delegated (awaiting Oracle delegation)

## Multi-Perspective Audit — RESOLVED (from v1.0)

**GAP-LEGAL-1:** ✅ User confirmed MIT → MIT compatibility acceptable  
**Project License:** MIT  
**SDK License:** MIT  
**Status:** No issues — both permissive, fully compatible

All 12 gaps mitigated or accepted:
- ✅ 9 mitigated in contract updates
- ✅ 1 resolved (license)
- ⏸️ 2 deferred to Phase 6 (feature flag, circuit breaker)

## Implementation Plan (5 Tasks — Reduced from 6)

| Task | Status | Description | Effort |
|------|--------|-------------|--------|
| 2B.1 | ⬜ Pending | Extract SDK types + npm script | 1h |
| 2B.2 | ⬜ Pending | Create type bridge in opencode-protocol.ts | 2h |
| 2B.3 | ⬜ Pending | Update consumers for field renames + Part types | 2h |
| 2B.4 | ⬜ Pending | Cleanup hand-written types + documentation | 1h |
| 2B.5 | ⬜ Pending | Integration verification | 1–2h |

**Deferred Tasks (ESM/CJS blocker):**
- ~~2B.5~~ Replace HTTP calls with SDK client — BLOCKED
- ~~2B.6~~ Replace SSE handling with SDK events — BLOCKED

## Exit Criteria (Updated for Hybrid Approach)
- [ ] SDK installed as devDependency (`@opencode-ai/sdk@1.2.6` exact)
- [ ] SDK types extracted to `src/common/opencode-sdk-types.ts` (3,380 lines)
- [ ] npm script `extract-sdk-types` created
- [ ] `yarn build` zero errors
- [ ] All hand-written types eliminated (~263 lines)
- [ ] Field renames complete (`projectId` → `projectID`, etc.)
- [ ] Part type handling exhaustive (12 variants)
- [ ] All 100+ unit tests pass
- [ ] All E2E tests pass (batched execution)
- [ ] HTTP client unchanged (logic same, types updated)
- [ ] SSE handling unchanged
- [ ] `eventsource-parser` still in dependencies
- [ ] THIRD-PARTY-NOTICES updated with SDK attribution
- [ ] Type extraction documented (`docs/development/SDK-TYPE-EXTRACTION.md`)
- [ ] Manual smoke test: 8/8 steps pass

## Timeline (Revised)
- **Started:** 2026-02-18 (v2.0 hybrid approach)
- **Estimated:** 6–8 hours (1 session)
- **Expected Completion:** 2026-02-18 (same day)

---
*BUILD workflow in progress: Oracle → Builder → Janitor → CodeReviewer → Oracle*
