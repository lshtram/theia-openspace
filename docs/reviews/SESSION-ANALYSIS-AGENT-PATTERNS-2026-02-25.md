# Agent Behavior Anti-Patterns

## Overview
This document captures patterns of AI agent inefficiency, misbehavior, and areas for improvement discovered through session analysis.

## Source
- Session files: `/Users/agentuser/.local/share/opencode/storage/session_diff/`
- Analysis period: Phase 2+ (Feb 18-25, 2026)
- Related: `docs/reviews/SESSION-ANALYSIS-FEATURES-2026-02-25.md`, `SESSION-ANALYSIS-BUGS-2026-02-25.md`

---

## Anti-Patterns Identified

### 1. Validation Skip (HIGH Severity)

**Problem:** Agent marks tasks complete without running validation steps (Janitor/verification).

**Evidence:** 
- Session: `ses_37b253510ffefN62kn2oVvohxG.json` (line 389)
- Finding: "validation_skip: Task marked complete without evidence of validation"

**Root Cause:** Agent eager to move on without verifying fix works.

**Improvement:** Must re-run Janitor validation after ANY Builder fix before proceeding.

---

### 2. Build in Wrong Place (HIGH Severity)

**Problem:** Agent builds in repo root when server runs from worktree (or vice versa).

**Evidence:** 
- File: `.opencode/_context/01_memory/patterns.md` (lines 86-107)
- Text: "CRITICAL: Verify Server Location Before Every Build"
- Command: `ps aux | grep main.js | grep -v grep`

**Root Cause:** Agent didn't check server location before building.

**Improvement:** Always run `ps aux | grep main.js | grep -v grep` first:
- If path contains `.worktrees/<name>/` → build there
- If path is `theia-openspace/browser-app/...` → build in repo root

---

### 3. Repeated Failure / Duplicate Fixes (HIGH Severity)

**Problem:** Same file modified multiple times to fix the same issue.

**Evidence:** 
- Session: `ses_37b253510ffefN62kn2oVvohxG.json` (line 389)
- Finding: "presentation-command-contribution.ts modified 5 times"
- `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts` - 5x modifications
- `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts` - 4x modifications
- `smoke-test.deck.md` - 4x modifications

**Root Cause:** Agent failed to fix correctly on first attempt, had to retry.

**Improvement:** Should verify fix works before moving on; more careful analysis before implementing.

---

### 4. Error Escalation (HIGH Severity)

**Problem:** Agent makes multiple errors in sequence, compounding problems.

**Evidence:** 
- Session: `ses_37b253510ffefN62kn2oVvohxG.json` (line 389)
- Finding: "error_escalation: Error cascade detected - multiple errors in quick succession"

**Root Cause:** Agent continues making changes without pausing to verify.

**Improvement:** Should pause and verify after each fix rather than continuing through multiple changes.

---

### 5. User Dissatisfaction (HIGH Severity)

**Problem:** Agent requires repeated course corrections from user.

**Evidence:** 
- Session: `ses_37b253510ffefN62kn2oVvohxG.json` (line 389)
- Finding: "user_dissatisfaction: User dissatisfaction detected (15 potential signals)"
- 23 user messages immediately followed assistant messages
- 15 correction patterns (user correcting agent's direction)
- Keywords: "wrong", "not what", "incorrect", "broken", "doesn't work", "still"

**Root Cause:** Agent acts without sufficient context, makes wrong assumptions.

**Improvement:** Should gather more context before acting, use skills proactively.

---

### 6. Missing Skill Usage (MEDIUM Severity)

**Problem:** Agent could have used a skill but didn't know about it.

**Evidence:** 
- File: `AGENTS.md` (lines 114-123)
- Project has superpowers skills: brainstorming, writing-plans, executing-plans, TDD, debugging, verification-before-completion
- Rule: "When a skill applies, invoke it before taking any action"

**Root Cause:** Per AGENTS.md Rule - agent doesn't check if skill applies before action.

**Improvement:** Must check for skill applicability BEFORE any action (per AGENTS.md Rule).

---

### 7. Insufficient Context Before Action (MEDIUM Severity)

**Problem:** Agent doesn't understand architecture before implementing.

**Evidence:** 
- Session analysis: "E2E tests for Task 2.0 written with wrong assumptions about architecture"
- Agent implemented without understanding the system

**Root Cause:** Agent didn't explore and understand codebase/architecture before implementing.

**Improvement:** Should explore and understand the codebase/architecture before implementing tests or fixes.

---

### 8. Premature Optimization (MEDIUM Severity)

**Problem:** Agent over-engineers instead of simple fix.

**Evidence:** 
- Session: `ses_37b253510ffefN62kn2oVvohxG.json`
- Multiple files modified 3+ times suggests over-complication

**Root Cause:** Agent jumps to complex solutions instead of simple fixes.

**Improvement:** Start with simplest possible fix, verify it works, then optimize if needed.

---

### 9. Wrong Test Assumptions (MEDIUM Severity)

**Problem:** Tests written with incorrect understanding of system.

**Evidence:** 
- Session analysis: "E2E tests written with wrong assumptions about architecture"
- Tests failed because agent didn't understand RPC vs SSE paths

**Root Cause:** Agent didn't verify architecture assumptions before writing tests.

**Improvement:** Verify system behavior (read code, ask user, check existing tests) before writing new tests.

---

## Session Evidence Summary

| Pattern | Session ID | Line/Reference |
|---------|-----------|---------------|
| Validation Skip | ses_37b253510ffefN62kn2oVvohxG | line 389 |
| Build in Wrong Place | patterns.md | lines 86-107 |
| Repeated Failure | ses_37b253510ffefN62kn2oVvohxG | line 389 |
| Error Escalation | ses_37b253510ffefN62kn2oVvohxG | line 389 |
| User Dissatisfaction | ses_37b253510ffefN62kn2oVvohxG | line 389 |
| Missing Skill | AGENTS.md | lines 114-123 |
| Insufficient Context | ses_37b253510ffefN62kn2oVvohxG | line 389 |
| Premature Optimization | ses_37b253510ffefN62kn2oVvohxG | line 389 |
| Wrong Test Assumptions | ses_37b253510ffefN62kn2oVvohxG | line 389 |

---

## Files Requiring Repeated Modifications

| File | Modifications | Session |
|------|--------------|---------|
| presentation-command-contribution.ts | 5x | ses_37b253510ffefN62kn2oVvohxG |
| hub-mcp.spec.ts | 4x | ses_37b253510ffefN62kn2oVvohxG |
| smoke-test.deck.md | 4x | ses_37b253510ffefN62kn2oVvohxG |
| WORKPLAN.md | 4x | ses_37b253510ffefN62kn2oVvohxG |

---

## Process Failures Documented

1. **Skipped re-validation:** Agent skipped re-validation after Builder fixes
2. **E2E passed but system hang:** Tests didn't catch browser freeze from circular DI
3. **Conditional approval accepted:** Agent accepted "PASS WITH CONDITIONS" when E2E blocked
4. **Wrong test assumptions:** E2E tests written with wrong architecture assumptions

---

## Recommendations

### Before Any Implementation
- [ ] Check if a skill applies (brainstorming, TDD, debugging, etc.)
- [ ] Verify server location with `ps aux | grep main.js`
- [ ] Explore codebase to understand architecture
- [ ] Read existing tests for patterns

### During Implementation
- [ ] Verify each fix works before moving on
- [ ] Run incremental tests (not full suite)
- [ ] Don't accept "conditional" pass - fix root cause

### After Implementation
- [ ] Run Janitor validation
- [ ] Run unit tests
- [ ] Run E2E tests (incremental)
- [ ] Verify in browser if UI changed

---

## Related Documents

- `docs/reviews/SESSION-ANALYSIS-FEATURES-2026-02-25.md` - Features implemented
- `docs/reviews/SESSION-ANALYSIS-BUGS-2026-02-25.md` - Bugs fixed
- `.opencode/_context/01_memory/patterns.md` - Technical patterns
- `.opencode/_context/01_memory/process_failures.md` - Process failure details
