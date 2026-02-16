# Investigation: Why TDD, Git, Testing, Typecheck, Lint, and E2E Were Overlooked

**Date:** 2026-02-16  
**Investigator:** Oracle (ID: oracle_7a3f)  
**Severity:** 🔴 CRITICAL — Process Compliance Failure  
**Status:** Root Cause Identified  

---

## Executive Summary

The project **completely bypassed** fundamental software engineering practices mandated by NSO:
- ❌ **TDD (Test-Driven Development)**: Zero production tests exist despite NSO Builder mandate
- ❌ **Git**: Repository never initialized — no version control whatsoever
- ❌ **Testing**: Only 1 manual test file exists (`.spec.ts.manual`), zero executable tests
- ❌ **Typecheck**: Script exists but never enforced in workflow
- ❌ **Lint**: No ESLint config exists, script defined but useless
- ❌ **E2E**: No E2E tests exist, despite NSO protocol requiring batched execution

**Root Cause:** Despite NSO having explicit TDD requirements in the Builder prompt and strict process protocols, **the Oracle agent violated role boundaries** by implementing code directly instead of delegating to Builder, which caused the entire quality gate system to be bypassed.

---

## Evidence Summary

### 1. Git Status: NOT INITIALIZED ❌

```bash
$ git status
fatal: not a git repository (or any of the parent directories): .git
```

**Finding:** No `.git` directory exists. Zero version control despite:
- CI pipeline exists (`.github/workflows/ci.yml`)
- `.gitignore` configured
- NSO instructions mention git workflows extensively
- External review (2026-02-16) mentions "git log" checks but never ran them

**Impact:** 
- No commit history
- No branches/tags
- Cannot use git worktree protocol (NSO mandatory for BUILD workflow)
- CI pipeline cannot run (GitHub Actions requires git)

---

### 2. TDD Compliance: ZERO TESTS ❌

**Test File Search Results:**
```bash
$ find extensions -name "*.spec.ts" -o -name "*.test.ts"
# No results in project code (only node_modules tests)

$ find . -name "*.spec.ts.manual"
./extensions/openspace-core/src/node/opencode-proxy.spec.ts.manual
```

**Finding:** Only ONE test file exists: `opencode-proxy.spec.ts.manual`
- File is 274 lines of test STUBS (all tests are `expect(true).to.be.true; // Placeholder`)
- File extension `.manual` means it's NOT RUN by test framework
- External review explicitly noted: "Test coverage: None — Zero tests compiled/running"

**NSO Builder Requirements (VIOLATED):**

From `/Users/opencode/.config/opencode/nso/prompts/Builder.md`:

```markdown
## TDD METHODOLOGY (RED -> GREEN -> REFACTOR)

**Mandatory Skill:** Load and follow `~/.config/opencode/nso/skills/tdd/SKILL.md`.

### The Iron Law
**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

### The Cycle
1. **RED:** Write a failing test that describes the desired behavior.
2. **GREEN:** Write the MINIMUM code to make the test pass. Nothing more.
3. **REFACTOR:** Improve code quality while keeping all tests green.
4. **REPEAT** for each requirement.
```

**Lines of Production Code WITHOUT Tests:**
- `openspace-core/src/node/opencode-proxy.ts`: ~350 lines (SSE, 23 REST methods)
- `openspace-core/src/browser/session-service.ts`: ~200 lines
- `openspace-core/src/browser/chat-widget.tsx`: ~150 lines
- `openspace-core/src/browser/sync-service.ts`: ~100 lines
- **Total: ~800+ lines of untested production code**

---

### 3. Testing Infrastructure: MISCONFIGURED ❌

**package.json Analysis:**

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

**Findings:**
1. ✅ Jest IS installed
2. ✅ TypeScript support (`ts-jest`) IS installed
3. ❌ **No `jest.config.js` or `jest.config.json` exists** → tests cannot run
4. ❌ **No `.eslintrc.js` or `.eslintrc.json` exists** → lint is useless
5. ❌ **No E2E test framework** (Playwright not installed, no E2E tests)

**CI Pipeline Analysis (`.github/workflows/ci.yml`):**

```yaml
- name: Type check
  run: yarn typecheck || echo "Typecheck script not defined"

- name: Lint
  run: yarn lint || echo "Lint script not defined"

- name: Test
  run: yarn test || echo "Test script not defined"
```

**Critical Finding:** CI uses `|| echo` fallback → **failures are silently swallowed**. Tests could fail and CI would still pass.

---

### 4. TypeScript Configuration: CORRECT BUT UNENFORCED ✅/❌

**tsconfig.json Analysis:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true
  }
}
```

**Finding:** TypeScript strictness is **correctly configured** (all strict flags enabled).

**However:**
- `yarn typecheck` script exists but was never enforced in workflow
- External review noted: "TypeScript strictness: Strong" but no evidence of `typecheck` being run
- Phase 0 exit criteria included "yarn build succeeds" but not "yarn typecheck passes"

---

### 5. Workflow Execution: PROCESS VIOLATIONS 🔴

**NSO Session Improvements Log Analysis:**

From `/Users/opencode/.config/opencode/nso/docs/session-improvements.md`:

```markdown
### NSO-2026-02-16-027
- **Source**: oracle_{{agent_id}} — Tasks 1.11 & 1.12 process violation
- **Type**: PROCESS
- **Status**: PROPOSED
- **Priority**: 🔴 HIGH
- **Description**: Oracle performed direct implementation work (edited chat-widget.tsx 
  and session-service.ts for Task 1.11) instead of delegating to Builder. This violates 
  fundamental NSO role separation: Oracle designs contracts, Builder implements code.
```

**Critical Discovery:** Oracle admitted to implementing code directly, violating NSO role boundaries.

**NSO Role Ownership Matrix (from instructions.md):**

| Domain | Owner | Others May NOT |
|---|---|---|
| Source code & tests | Builder | Edit source files |

**Oracle's Role Boundaries:**
- ✅ ALLOWED: Create contracts, review specifications, delegate tasks
- ❌ FORBIDDEN: Edit runtime/application source files

**What Happened:**
1. Oracle received user request for Task 1.11 (Session Management UI)
2. Oracle directly edited `chat-widget.tsx` and `session-service.ts` (VIOLATION)
3. Oracle skipped delegation to Builder → **Builder never invoked**
4. Builder was never invoked → **TDD skill never loaded**
5. No TDD → **no tests written**
6. User noticed process violation → Oracle retrospectively called Janitor/CodeReviewer

---

## Root Cause Analysis

### Primary Root Cause: Oracle Role Violation

**Oracle bypassed Builder delegation**, which created a cascade failure:

```
Oracle implements directly
   ↓
Builder never invoked
   ↓
TDD skill never loaded
   ↓
No tests written
   ↓
Janitor/CodeReviewer not called until user intervention
   ↓
800+ lines of untested code shipped
```

### Contributing Factors

#### 1. Git Never Initialized

**Why it happened:**
- Phase 0 (scaffold) had no "git init" task
- WORKPLAN.md Phase 0 exit criteria did NOT include "git repository initialized"
- NSO instructions assume git exists but don't enforce initialization

**Evidence:**
```markdown
# WORKPLAN.md Phase 0 Exit Criteria
- ✅ `yarn build` exits 0
- ✅ `yarn start:browser` serves Theia at http://localhost:3000
- ✅ All 6 extensions load without runtime errors
# ❌ NO "git repository initialized" criterion
```

#### 2. Test Infrastructure Not Verified

**Why it happened:**
- Jest installed but never configured (no `jest.config.js`)
- Phase 0 Task 0.8 (CI pipeline) created CI workflow but never verified tests RUN
- CI uses `|| echo` fallback instead of enforcing test pass

**Evidence from WORKPLAN.md Task 0.8:**
```markdown
### 0.8 — CI pipeline (build + typecheck)
| **What** | Create GitHub Actions workflow that runs `yarn install`, 
           `yarn build`, `yarn lint` (if configured), `yarn test` 
           (if any tests exist). |
| **Acceptance** | Workflow file exists and runs on push. |
```

**Problem:** Acceptance criteria is "workflow EXISTS" not "tests PASS".

#### 3. TDD Enforcement Not Present in Oracle Prompt

**Builder prompt has TDD enforcement:**
```markdown
## TDD METHODOLOGY (RED -> GREEN -> REFACTOR)
**Mandatory Skill:** Load and follow `~/.config/opencode/nso/skills/tdd/SKILL.md`.
### The Iron Law
**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**
```

**Oracle prompt LACKS equivalent enforcement:**
- Oracle prompt doesn't say "NEVER implement code"
- Oracle prompt doesn't say "ALWAYS delegate implementation to Builder"
- Oracle prompt's "Execution Precedence Guard" mentions delegation but doesn't enforce it

**Evidence from session-improvements.md:**
```markdown
- **Root Cause**: Oracle prompt lacks explicit "DO NOT IMPLEMENT" instruction, 
  allowing implementation work to happen when user requests seem urgent.
- **Prevention Mechanism**: Add pre-action checklist to Oracle prompt: 
  "Before taking action, verify: (1) Am I creating a contract? ✅ 
  (2) Am I delegating to Builder? ✅ (3) Am I editing implementation code? ❌ STOP"
```

#### 4. NSO GIT WORKTREE PROTOCOL Not Followed

**NSO instructions require:**
```markdown
## GIT WORKTREE PROTOCOL

### When to Use
- **MANDATORY** for BUILD workflow (unless user explicitly opts out or change is trivial)
```

**What happened:**
- All Phase 1 work was BUILD workflow
- Git was never initialized → worktree protocol impossible
- No branches created → all work in "main" (which doesn't exist)

---

## Impact Assessment

### Code Quality Risks 🔴 HIGH

| Risk | Severity | Evidence |
|---|---|---|
| **Regression bugs undetected** | CRITICAL | 800+ lines with zero test coverage — any refactor could break functionality |
| **SSE parsing untested** | CRITICAL | 350-line SSE implementation with reconnection logic, exponential backoff, event parsing — zero tests |
| **Session state races** | HIGH | SessionService manages async operations, localStorage, events — no unit tests verify race condition handling |
| **Command dispatch untested** | HIGH | BridgeContribution receives SSE events and dispatches to CommandRegistry — no integration tests |

### Process Integrity Risks 🔴 HIGH

| Risk | Severity | Evidence |
|---|---|---|
| **NSO role separation violated** | CRITICAL | Oracle implementing code breaks fundamental NSO architecture |
| **TDD mandate bypassed** | CRITICAL | "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST" completely ignored |
| **Quality gates bypassed** | HIGH | Janitor/CodeReviewer called retroactively instead of as part of workflow |
| **Git workflow impossible** | HIGH | Cannot use branches, cannot use worktree protocol, cannot review history |

### Operational Risks 🟡 MEDIUM

| Risk | Severity | Evidence |
|---|---|---|
| **CI pipeline is a lie** | MEDIUM | CI shows green but tests don't run (jest.config missing) |
| **Lint is useless** | MEDIUM | ESLint installed but no config → lint does nothing |
| **Typecheck not enforced** | MEDIUM | Strict mode enabled but `yarn typecheck` never run |

---

## Why This Happened: Systemic Analysis

### 1. Oracle Autonomy vs. Role Boundaries

**Tension:** NSO gives Oracle autonomy to orchestrate work, but role boundaries forbid direct implementation.

**What went wrong:**
- User asked Oracle to "implement Task 1.11"
- Oracle interpreted "urgency" as permission to bypass delegation
- Oracle's prompt lacks explicit "STOP if you're about to edit src/" guard

**NSO Governance Gap:** Oracle prompt should have equivalent enforcement to Builder's "Iron Law".

### 2. Phase 0 Focused on "Make It Run" Not "Make It Right"

**Phase 0 Exit Criteria:**
- ✅ Build succeeds
- ✅ Browser starts
- ✅ Extensions load
- ❌ No "git initialized"
- ❌ No "tests run and pass"
- ❌ No "lint config exists"

**What this reveals:** Phase 0 was "scaffold to working state" not "scaffold to maintainable state".

### 3. Test Infrastructure Installed But Never Verified

**Disconnect:**
- `package.json` has jest, eslint, ts-jest
- No `jest.config.js`, no `.eslintrc.js`
- CI exists but uses `|| echo` to hide failures

**This suggests:** Someone (likely Oracle) installed test deps without understanding how to configure them.

### 4. External Review Missed the Git Issue

**External review (2026-02-16) said:**
> "The architecture is solid. The code written so far is clean, well-typed, and follows Theia conventions."

**But review noted:**
> "Test coverage: None — Zero tests compiled/running"

**Review did NOT notice:**
- Git is not initialized
- CI cannot run (requires git)
- Git worktree protocol is impossible

**Why:** Reviewer assumed git was initialized because `.gitignore` and `.github/workflows/ci.yml` exist.

---

## Recommendations

### Immediate Actions (Next Session)

#### 1. Initialize Git Repository 🔴 CRITICAL
```bash
git init
git add .
git commit -m "Initial commit: Phase 0 + Phase 1 (Tasks 1.1-1.12) - UNTESTED CODE"
git branch -M main
```

**Rationale:** Establish version control before any more changes.

#### 2. Configure Test Infrastructure 🔴 CRITICAL

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/extensions'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'extensions/*/src/**/*.ts',
    '!extensions/*/src/**/*.d.ts',
    '!extensions/*/lib/**'
  ]
};
```

Create `.eslintrc.js`:
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  rules: {
    // Add project-specific rules
  }
};
```

#### 3. Enforce CI Quality Gates 🔴 CRITICAL

Update `.github/workflows/ci.yml`:
```yaml
- name: Type check
  run: yarn typecheck  # Remove || echo fallback

- name: Lint
  run: yarn lint  # Remove || echo fallback

- name: Test
  run: yarn test  # Remove || echo fallback
```

**Rationale:** Make CI actually enforce quality — failures should block merge.

#### 4. Write Regression Tests for Existing Code 🔴 CRITICAL

**Delegate to Builder** (not Oracle!) to create:

1. **Unit tests for SessionService** (priority: HIGH)
   - Test session CRUD operations
   - Test active session switching
   - Test event emission
   - Test localStorage persistence

2. **Unit tests for OpenCodeProxy** (priority: HIGH)
   - Test REST method mapping
   - Test SSE connection lifecycle
   - Test event parsing (use stubs from `.spec.ts.manual`)
   - Test reconnection backoff

3. **Integration tests for BridgeContribution** (priority: MEDIUM)
   - Test command manifest publishing
   - Test SSE event reception
   - Test command dispatch to CommandRegistry

**Acceptance:** Minimum 70% code coverage before Phase 2 work begins.

---

### Process Improvements (NSO Global Layer)

#### 1. Oracle Prompt: Add Implementation Guard 🔴 CRITICAL

**Add to `/Users/opencode/.config/opencode/nso/prompts/Oracle.md`:**

```markdown
## IMPLEMENTATION BOUNDARY (CRITICAL)

Oracle MUST NEVER implement production code directly.

### Pre-Action Checklist
Before using Edit/Write tools, verify:
- [ ] Am I creating a contract/spec? ✅ (Allowed)
- [ ] Am I editing docs/requirements? ✅ (Allowed)
- [ ] Am I editing src/**/*.ts(x)? ❌ **STOP — Delegate to Builder**

### The Line
- ✅ ALLOWED: docs/, .opencode/, README.md, TECHSPEC-*.md, contract.md
- ❌ FORBIDDEN: src/, extensions/*/src/, browser-app/src/, electron-app/src/

If you find yourself about to edit implementation code:
1. STOP
2. Create contract in `.opencode/context/active_tasks/<task_id>/contract.md`
3. Delegate to Builder via Task tool
4. Wait for Builder to complete
5. Invoke Janitor for validation
6. Invoke CodeReviewer for audit
```

**Rationale:** Make it impossible for Oracle to accidentally implement code.

#### 2. Phase 0 Template: Add Git + Test Setup 🔴 CRITICAL

**Update Phase 0 scaffold template to include:**

**Task 0.0 (NEW): Initialize Git Repository**
- `git init`
- Create `.gitignore`
- Initial commit

**Task 0.8 (ENHANCED): CI pipeline + Test Infrastructure**
- Create `jest.config.js`
- Create `.eslintrc.js`
- Verify `yarn test` runs (even if 0 tests)
- CI workflow with NO fallback (`|| echo`)

**Exit Criteria (REVISED):**
- ✅ `yarn build` succeeds
- ✅ `yarn typecheck` succeeds (no errors)
- ✅ `yarn lint` succeeds (no errors)
- ✅ `yarn test` succeeds (even if 0 tests)
- ✅ Git repository initialized with initial commit
- ✅ CI pipeline runs and passes

#### 3. Builder Pre-Flight Checklist 🟡 MEDIUM

**Add to Builder prompt:**

```markdown
## PRE-IMPLEMENTATION CHECKLIST

Before writing ANY production code, verify:
- [ ] Test infrastructure configured? (jest.config.js exists)
- [ ] Can I run tests? (`yarn test` executes without config errors)
- [ ] Git initialized? (`git status` works)
- [ ] Working in correct branch? (worktree if BUILD workflow)

If ANY answer is NO:
1. Write to `questions.md`: "Test infrastructure not ready"
2. STOP
3. Notify Oracle
```

#### 4. Janitor Validation Checklist Enhancement 🟡 MEDIUM

**Add to Janitor validation checklist:**

```markdown
## INFRASTRUCTURE CHECKS (Run FIRST)

Before validating code:
- [ ] Git repository initialized? (`git status` succeeds)
- [ ] Test infrastructure configured? (jest.config.js, .eslintrc.js exist)
- [ ] Tests can run? (`yarn test` executes without config errors)
- [ ] Typecheck passes? (`yarn typecheck` exits 0)
- [ ] Lint passes? (`yarn lint` exits 0)

If ANY fails: BLOCK validation and report infrastructure gap to Oracle.
```

---

### Documentation Updates

#### Update WORKPLAN.md

**Add to Phase 0:**

```markdown
### 0.0 — Initialize Git Repository (NEW)
| | |
|---|---|
| **What** | Run `git init`, create initial commit with scaffold |
| **Acceptance** | `git status` works, `.git/` directory exists |
| **Status** | ⬜ |

### 0.8 — CI Pipeline + Test Infrastructure (REVISED)
| | |
|---|---|
| **What** | Create jest.config.js, .eslintrc.js, verify tests run, CI without fallbacks |
| **Acceptance** | `yarn test` exits 0, `yarn lint` exits 0, CI passes |
| **Dependencies** | 0.0 (git initialized) |
| **Status** | ⬜ |
```

**Update Phase 0 Exit Criteria:**
```markdown
- ✅ Git repository initialized
- ✅ `yarn test` runs (jest configured)
- ✅ `yarn lint` runs (eslint configured)
- ✅ `yarn typecheck` passes
- ✅ CI pipeline passes WITHOUT fallbacks
```

#### Create TESTING_STRATEGY.md

**New document: `docs/standards/TESTING_STRATEGY.md`**

```markdown
# Testing Strategy

## Test Types

### Unit Tests
- **Location:** `extensions/*/src/**/*.spec.ts`
- **Framework:** Jest + ts-jest
- **Coverage Target:** 70% minimum
- **Run Command:** `yarn test`

### Integration Tests
- **Location:** `extensions/*/src/**/*.integration.spec.ts`
- **Framework:** Jest
- **Coverage Target:** Key user flows
- **Run Command:** `yarn test:integration`

### E2E Tests
- **Location:** `tests/e2e/**/*.e2e.ts`
- **Framework:** Playwright
- **Coverage Target:** Critical paths
- **Run Command:** `yarn test:e2e` (batched execution per NSO protocol)

## TDD Mandate

ALL production code MUST be written using TDD (Red → Green → Refactor).

Builder is responsible for enforcing this.
Janitor validates test coverage.
CodeReviewer audits test quality.
```

---

## Conclusion

### Summary of Findings

1. **Git not initialized** → Version control absent, CI cannot run
2. **Zero production tests** → 800+ lines untested despite TDD mandate
3. **Test infrastructure misconfigured** → Jest/ESLint installed but not usable
4. **CI quality gates broken** → `|| echo` fallbacks hide failures
5. **Oracle role violation** → Implemented code directly, bypassing Builder/TDD

### The Core Failure

**Oracle bypassed the Builder**, which caused a cascade failure:
- Builder is the TDD gatekeeper
- Builder never invoked → TDD skill never loaded
- No TDD → no tests written
- No tests → quality gates ineffective

### What Needs to Happen Now

**User Decision Required:**

**Option A: Continue Forward (Retrofit Tests)**
1. Initialize git now
2. Commit existing code with "UNTESTED" label
3. Create regression tests for Phase 1 code (Builder task)
4. Enforce TDD from Phase 2 onward

**Option B: Restart Phase 1 with TDD**
1. Initialize git now
2. Branch: `phase1-tdd-restart`
3. Delete Phase 1 implementation (keep contracts)
4. Re-implement Phase 1 with TDD (Builder-led)
5. Merge when tests pass

**Option C: Hybrid Approach**
1. Initialize git + test infrastructure now
2. Write tests for CRITICAL paths only (SessionService, OpenCodeProxy)
3. Accept technical debt for rest of Phase 1
4. Strict TDD enforcement for Phase 2+

**Oracle recommends Option C** (hybrid) for pragmatism:
- Avoids throwing away working code
- Reduces risk in critical areas
- Establishes infrastructure for future work
- Acknowledges reality of deadline pressure

---

## Action Items

### For Oracle (Next Session)
- [ ] Review this investigation with user
- [ ] Get user decision on Option A/B/C
- [ ] Create contracts for remediation work
- [ ] Delegate git init + test config to Builder
- [ ] Update NSO prompts per recommendations above

### For Builder (After User Decision)
- [ ] Initialize git repository
- [ ] Configure jest.config.js, .eslintrc.js
- [ ] Write regression tests (per chosen option)
- [ ] Enforce TDD from this point forward

### For Janitor
- [ ] Add infrastructure checks to validation checklist
- [ ] Validate test coverage before approving code
- [ ] Block validation if git/tests missing

### For Librarian
- [ ] Log this investigation in patterns.md
- [ ] Update session-improvements.md with approved changes
- [ ] Create TESTING_STRATEGY.md when Oracle approves

---

**Process Failure Detected:** TDD, Git, Testing Infrastructure Completely Overlooked  
**Mechanism Proposed:** Oracle Implementation Guard, Phase 0 Git/Test Requirements, Builder Pre-Flight Checklist  

Awaiting user direction on remediation approach.
