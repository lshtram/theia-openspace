# Pending Improvements Review

**Date:** 2026-02-16  
**Status:** Ready for User Decision  
**Context:** NSO System Failure Investigation Complete

---

## Overview

This document consolidates all pending improvements from:
1. **NSO session-improvements.md** (12 entries)
2. **TDD Investigation Action Items** (4 categories)
3. **Remediation Contract** (comprehensive git + test plan)
4. **Current project state** (Phase 1 at 93%, Task 1.14 pending)

**Goal:** Review each improvement category, decide what to implement, prioritize, and execute.

---

## Categories

- [A] **CRITICAL - NSO Prompt Updates** (COMPLETED - needs validation)
- [B] **CRITICAL - Git + Test Remediation** (active contract exists)
- [C] **Process Improvements** (NSO workflow enhancements)
- [D] **Pattern Documentation** (reusable patterns discovered)
- [E] **Skill Gaps** (missing skill features)
- [F] **Investigation Items** (requires research)

---

## [A] CRITICAL - NSO Prompt Updates ✅ COMPLETED

**Status:** Implemented but not validated in practice

### What Was Done (2026-02-16)

1. ✅ **Oracle.md** - Added Section 3: Contract Quality Gate
   - Pre-delegation checklist with 20+ requirements
   - Infrastructure verification (git, tests, lint, TypeScript)
   - Testing requirements verification
   - Quality gates verification
   - Exit criteria verification
   - Self-correction protocol

2. ✅ **Builder.md** - Strengthened TDD Enforcement
   - "The Iron Law (ABSOLUTE - NO EXCEPTIONS)"
   - Pre-Implementation Verification (MANDATORY)
   - Test Coverage Requirements (≥70% critical, ≥50% non-critical)
   - Test-First Enforcement Checklist (9-point mandatory)
   - Explicit: "If test doesn't FAIL before code → DELETE and start over"

3. ✅ **Janitor.md** - Added Infrastructure + Coverage Validation
   - STAGE 0: Infrastructure Verification (NEW - must pass first)
     - Git repository check
     - Test infrastructure check
     - Lint infrastructure check
     - TypeScript configuration check
     - Coverage infrastructure check
   - STAGE B: TDD Compliance & Test Validation (completely rewritten)
     - TDD process verification (RED→GREEN documentation required)
     - Test suite completeness (unit/integration/E2E requirements)
     - Coverage analysis (≥70% critical, ≥50% non-critical)

### Recommendation

**✅ KEEP AS-IS** - These updates directly address the root cause (Oracle creating deficient contracts). No additional NSO prompt changes needed until we validate these work in practice.

**Next Step:** Test updated prompts on Task 1.14 (Permission UI) to verify enforcement works.

---

## [B] CRITICAL - Git + Test Remediation 🔴 ACTIVE CONTRACT

**Status:** Contract exists, not yet executed  
**Contract:** `.opencode/context/active_tasks/contract-remediation-test-git.md`  
**Priority:** 🔴 CRITICAL (blocks Task 1.14)

### Current State

- ❌ **No git repository** - `fatal: not a git repository`
- ❌ **Zero unit tests** - 800+ lines of production code untested
- ❌ **No E2E tests** - integration scenarios not automated
- ❌ **Test infrastructure misconfigured** - jest installed but not working
- ✅ **Code works** - Phase 1 Tasks 1.1-1.13 functional and validated

### What Contract Proposes (8-9 hours work)

**Part 1: Git Repository** (30 minutes)
- Initialize git repository
- Create .gitignore
- Initial commit: Phase 0 foundation
- Feature branch: `feature/phase-1-foundation`
- Commit Phase 1 work in 5-7 logical commits

**Part 2: Unit Tests** (3 hours)
- Test framework: Mocha + Chai + Sinon
- SessionService tests (getSessions, deleteSession, edge cases)
- ChatWidget tests (dropdown, create/switch/delete sessions)
- Target: ≥80% coverage for Phase 1 code

**Part 3: E2E Tests** (2 hours)
- Framework: Playwright
- 5 scenarios:
  1. System startup, chat widget opens
  2. Create new session
  3. Send message (mocked)
  4. Switch between sessions
  5. Delete session with confirmation
- Batched execution per NSO protocol

**Part 4: Janitor Re-Validation** (1 hour)
- Run all tests
- Verify coverage ≥80%
- Verify build succeeds
- Create validation report

### Options for User Decision

**Option A: Full Remediation (Recommended by Contract)**
- Execute entire contract (8-9 hours)
- Brings project to 100% NSO compliance
- Establishes proper foundation for Phase 2+
- Risk: Time investment, may discover bugs

**Option B: Minimal Git Only (Quick Fix)**
- Initialize git + commit existing code as-is
- Mark Phase 1 with "UNTESTED - to be retroactively tested" tag
- Enforce TDD strictly from Task 1.14 onward
- Defer test retrofitting to Phase 2 or Phase 7 (backlog cleanup)
- Time: 30 minutes
- Risk: Technical debt accumulates

**Option C: Git + Critical Tests Only (Hybrid)**
- Initialize git + commit existing code
- Write tests ONLY for critical paths:
  - SessionService (state management, edge cases)
  - OpenCodeProxy (API communication)
- Accept no tests for UI components (can be done later)
- Target: ≥50% coverage (vs 80%)
- Time: 2-3 hours
- Risk: Moderate technical debt

**Option D: Defer Entirely**
- Another agent is handling git + tests (per user's earlier statement)
- Skip remediation entirely
- Proceed directly to Task 1.14
- Time: 0 hours
- Risk: Process violations continue

### User Decision Needed

**Question 1:** Which option (A/B/C/D)?

**Question 2:** If A/B/C, should Oracle delegate to Builder now, or wait until after we review other improvements?

---

## [C] Process Improvements (NSO Workflow)

### C1. Oracle Role Violation Prevention 🔴 HIGH PRIORITY

**NSO-2026-02-16-027**

**Issue:** Oracle performed direct implementation work (Tasks 1.11-1.12) instead of delegating to Builder.

**Status:** ⚠️ PARTIALLY ADDRESSED
- ✅ Session-improvements.md logged the violation
- ✅ Oracle.md updated with Contract Quality Gate
- ❌ No explicit "DO NOT IMPLEMENT" guard in Oracle.md

**Proposed Action:**
Add explicit enforcement to Oracle.md top section:
```markdown
## CRITICAL RESTRICTIONS

Oracle MUST NEVER:
- Edit files in `src/` directories
- Use Edit/Write tools on implementation code
- Perform Builder's work (even if user requests seem urgent)

Before taking action, verify:
- [ ] Am I creating a contract? ✅ Proceed
- [ ] Am I delegating to Builder? ✅ Proceed
- [ ] Am I editing implementation code? ❌ STOP - delegate to Builder
```

**User Decision:** Approve this addition to Oracle.md? (Yes/No)

---

### C2. Builder Workflow Gate (Validation Before Complete)

**NSO-2026-02-16-022**

**Issue:** Validation workflow initially skipped Janitor/CodeReviewer. User had to manually enforce complete chain.

**Proposed Action:**
Add pre-completion checklist to Builder.md:
```markdown
## BEFORE MARKING TASK COMPLETE

Builder MUST verify:
- [ ] Janitor validation requested
- [ ] Janitor approval received
- [ ] CodeReviewer audit requested
- [ ] CodeReviewer report received
- [ ] All blocking issues addressed
- [ ] Contract exit criteria met

If ANY item unchecked → task is NOT complete.
```

**User Decision:** Approve this addition to Builder.md? (Yes/No)

---

### C3. E2E Mass-Fix Playbook

**NSO-2026-02-15-017**

**Issue:** When >20 E2E tests break simultaneously, agents rediscover the fix strategy each time.

**Proposed Action:**
Add E2E troubleshooting section to Builder.md or create new skill `e2e-mass-fix`:
```markdown
## E2E Test Mass Failure Protocol

When >20 tests fail simultaneously:

**Phase 1: Identify Root Cause (STOP - Do NOT fix individual tests yet)**
1. Check if infrastructure changed (framework upgrade, config change)
2. Check if selectors/locators broke (UI refactor, class name changes)
3. Check if test environment broke (ports, services, dependencies)

**Phase 2: Fix Root Cause FIRST**
- If selectors broke → fix selector strategy project-wide FIRST
- If config broke → fix config FIRST
- If infrastructure broke → fix infrastructure FIRST

**Phase 3: Batch Verification**
- Test 2-3 tests from DIFFERENT features
- If all pass → root cause fixed
- If some fail → feature-specific issues remain

**Phase 4: Group-by-Group Fixes**
- Fix remaining issues feature-by-feature (not test-by-test)
```

**User Decision:** 
- Approve adding to Builder.md? (Yes/No)
- OR create separate skill? (Yes/No)
- OR defer? (Yes/No)

---

### C4. Session Data Capture Investigation

**NSO-2026-02-16-020**

**Issue:** `copy_session.py` found no session data for Phase 0. May indicate storage path issue.

**Proposed Action:**
Investigate and fix session data capture:
1. Verify OpenCode message storage path
2. Check permissions on storage directory
3. Test session.json creation
4. Update copy_session.py if path differs

**User Decision:** 
- Investigate now? (Yes/No)
- Defer to Scout? (Yes/No)
- Ignore (not critical)? (Yes/No)

---

## [D] Pattern Documentation (Reusable Knowledge)

### D1. React Component Patterns (Task 1.11 Discoveries)

**NSO-2026-02-16-024**

**Discovered Patterns:**
1. Dropdown state management with click-outside detection via `.closest()`
2. Active item cleanup pattern (clear all related state + events + localStorage)
3. Event-driven UI updates with disposable cleanup in useEffect

**Proposed Action:**
Add to `ui-design-system` skill under "React Component Patterns" section with code examples.

**User Decision:** Approve? (Yes/No)

---

### D2. Documentation Structure Best Practices (Task 1.12)

**NSO-2026-02-16-025**

**Discovered Pattern:**
1. Multi-tier verification (manual endpoint, logs, agent behavior)
2. Troubleshooting organized by error message
3. Advanced scenarios after basic setup
4. Concrete testing checklist with expected outputs

**Result:** 95% confidence, 100% accuracy match with implementation

**Proposed Action:**
Create documentation template incorporating this structure. Add to Librarian or Oracle prompt.

**User Decision:** Approve? (Yes/No)

---

### D3. Validation Success Pattern

**NSO-2026-02-16-023**

**Pattern:** When validation workflow is followed correctly:
- Tasks pass with 90%+ confidence
- Zero blocking issues
- Comprehensive documentation
- Actionable non-blocking feedback

**Proposed Action:**
Document this as success pattern in NSO docs. Reference in skill descriptions.

**User Decision:** Approve? (Yes/No)

---

### D4. Radix UI Interaction Patterns

**NSO-2026-02-15-018**

**Issue:** Radix UI primitives (Popover, Dialog, DropdownMenu) have specific dismissal mechanics that differ from native HTML. Agents rediscover this each time writing E2E tests.

**Proposed Action:**
Add Radix UI interaction patterns to `ui-design-system` skill:
- Popover: dismissal via Escape or click outside
- Dialog: must use close button or Escape (backdrop click configurable)
- DropdownMenu: dismissal via click outside or selection

**User Decision:** Approve? (Yes/No)

---

### D5. Project Initialization Rules (Framework Extension Projects)

**NSO-2026-02-16-019**

**Pattern:** Theia Openspace project established two critical restrictions:
1. Never modify OpenCode server code (external dependency)
2. Never modify Theia core code (extend only via extension APIs)

**Proposed Action:**
Add to NSO prompts as standard initialization rules for projects that extend external frameworks.

**User Decision:** 
- Add to NSO? (Yes/No)
- Keep project-specific only? (Yes/No)

---

## [E] Skill Gaps (Missing Features)

### E1. Async Race Condition Detection

**NSO-2026-02-16-026**

**Issue:** CodeReviewer identified "rapid session switching" race condition in Task 1.11. This represents common async pattern gap.

**Proposed Action:**
Add "Async Race Condition Detection" checklist to `code-reviewer` skill:

When reviewing async handlers, check for:
- [ ] Loading state management
- [ ] Early return guards (prevent concurrent calls)
- [ ] AbortController for cancellation
- [ ] Queue for sequential operations
- [ ] Timeout handling

**User Decision:** Approve addition to code-reviewer skill? (Yes/No)

---

## [F] Investigation Items (Requires Research)

### F1. Phantom Fix Detection Protocol ✅ ALREADY IMPLEMENTED

**Status:** IMPLEMENTED (2026-02-15)  
**Location:** Janitor.md Step 2: "Verify Code Changes Match Documentation"

No action needed.

---

### F2. Batched E2E Test Execution ✅ ALREADY IMPLEMENTED

**Status:** IMPLEMENTED (2026-02-15)  
**Location:** NSO instructions.md "E2E TEST EXECUTION PROTOCOL"

No action needed.

---

## Summary of User Decisions Needed

### Immediate Decisions (Block Progress)

1. **[B] Git + Test Remediation** - Which option?
   - [ ] Option A: Full remediation (8-9 hours)
   - [ ] Option B: Git only (30 min)
   - [ ] Option C: Git + critical tests (2-3 hours)
   - [ ] Option D: Defer entirely (another agent handling)

2. **[A] NSO Prompt Validation** - Test updated prompts on Task 1.14?
   - [ ] Yes - proceed to Task 1.14 with strict TDD
   - [ ] No - need more changes first

### Process Improvements (Can defer)

3. **[C1] Oracle Implementation Guard** - Add explicit "DO NOT IMPLEMENT" section?
   - [ ] Yes - add to Oracle.md
   - [ ] No - Contract Quality Gate sufficient

4. **[C2] Builder Completion Gate** - Add pre-completion checklist?
   - [ ] Yes - add to Builder.md
   - [ ] No - rely on workflow discipline

5. **[C3] E2E Mass-Fix Playbook** - How to handle?
   - [ ] Add to Builder.md
   - [ ] Create separate skill
   - [ ] Defer

6. **[C4] Session Data Capture** - Investigate storage path issue?
   - [ ] Yes - investigate now
   - [ ] Defer to Scout
   - [ ] Ignore (not critical)

### Pattern Documentation (Batch approval possible)

7. **[D] Pattern Documentation** - Approve all 5 patterns?
   - [ ] Yes - approve all (D1-D5)
   - [ ] No - review individually
   - [ ] Defer - focus on critical items first

8. **[E1] Async Race Condition Detection** - Add to code-reviewer skill?
   - [ ] Yes - add checklist
   - [ ] No - not needed
   - [ ] Defer

---

## Recommended Execution Order (If All Approved)

1. **Immediate:** Decide on git + test remediation (Option A/B/C/D)
2. **If A/B/C:** Execute remediation contract (Builder + Janitor)
3. **Immediate:** Add Oracle Implementation Guard + Builder Completion Gate
4. **Next:** Test updated NSO prompts on Task 1.14 (Permission UI)
5. **Batch:** Apply all pattern documentation (D1-D5)
6. **Batch:** Add skill enhancements (E1)
7. **Background:** Investigate session data capture (C4) if needed
8. **Defer:** E2E Mass-Fix Playbook (C3) - only needed when mass failures occur

---

## Oracle Recommendations

**Priority 1 (Critical Path):**
- Decide git + test remediation approach (B or C recommended for pragmatism)
- Add Oracle Implementation Guard (prevent recurrence of role violation)
- Test NSO prompt updates on Task 1.14

**Priority 2 (Quality Gates):**
- Add Builder Completion Gate
- Apply pattern documentation (batch approval)

**Priority 3 (Nice to Have):**
- Async race condition detection checklist
- Session data capture investigation
- E2E mass-fix playbook (only if needed)

**Defer:**
- Project-specific patterns that don't generalize to NSO

---

## Next Steps

**User:** Review this document and provide decisions on each section.

**Oracle:** Once decisions received:
1. Execute approved NSO prompt updates
2. Delegate remediation work to Builder (if A/B/C chosen)
3. Apply approved pattern documentation to skills
4. Update session-improvements.md with status changes
5. Proceed to Task 1.14 with validated workflow

---

**Estimated Time to Process All Improvements:**
- NSO updates: 30 minutes
- Remediation: 0-9 hours (depends on option)
- Pattern docs: 1 hour
- Skill updates: 30 minutes

**Total:** 2-11 hours depending on remediation choice

**Recommended:** Choose Option C (Git + Critical Tests) = ~4-5 hours total
