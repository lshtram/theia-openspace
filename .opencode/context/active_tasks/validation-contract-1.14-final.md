---
id: VALIDATION-1.14-FINAL
author: oracle_e4b1
status: ACTIVE
date: 2026-02-17
task_id: Task-1.14-Permission-UI-Final
---

# Janitor Validation Contract: Task 1.14 — Final Validation (After Builder Fixes)

## Context

Builder applied 3 critical fixes after initial review:
1. Fixed bare `React` import in `permission-dialog.tsx` → `@theia/core/shared/react`
2. Fixed bare `React` import in `permission-dialog-contribution.ts` → `@theia/core/shared/react`
3. Added `onStop()` lifecycle hook in `permission-dialog-contribution.ts`
4. Migrated from deprecated `ReactDOM.render()` to React 18 `createRoot` API

**This is the final validation before user approval.** ALL tests must pass.

## Source Files Under Review

| File | Purpose | Lines |
|---|---|---|
| `extensions/openspace-core/src/browser/permission-dialog.tsx` | React component | 166 |
| `extensions/openspace-core/src/browser/permission-dialog-manager.ts` | Queue/timeout logic | 239 |
| `extensions/openspace-core/src/browser/permission-dialog-contribution.ts` | DI wiring + lifecycle | 156 |
| `extensions/openspace-core/src/browser/style/permission-dialog.css` | Styling | 205 |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | DI bindings (lines 55-57) | 59 |
| `extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts` | Unit tests | 453 |

## Validation Checklist (MANDATORY — ALL MUST PASS)

### 1. Build Verification
```bash
node scripts/build-summary.js
```
- [ ] All 6 extensions compile with 0 TypeScript errors
- [ ] Browser app backend + frontend bundles compile
- [ ] Report exact build time and exit code

### 2. Lint
```bash
yarn lint --quiet || yarn lint
```
- [ ] 0 linting errors
- [ ] Report output (if any warnings, list them)

### 3. Typecheck
```bash
yarn typecheck || npx tsc --noEmit
```
- [ ] 0 TypeScript errors across all packages
- [ ] Report output

### 4. Unit Tests (Permission Dialog)
```bash
npx mocha --require ts-node/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"
```
- [ ] All permission dialog manager tests pass
- [ ] Report: X/X passing, 0 failures
- [ ] Report execution time

### 5. Unit Tests (All Browser Tests)
```bash
npx mocha --require ts-node/register "extensions/openspace-core/src/browser/__tests__/*.spec.ts"
```
- [ ] All openspace-core browser tests pass
- [ ] Report: X/X passing, 0 failures

### 6. E2E Tests (BATCHED)

**CRITICAL**: E2E tests MUST catch browser hangs, infinite loading, and runtime crashes.

Run in batches of 3-5 tests:

**Batch 1 (Smoke Tests):**
```bash
# Check if E2E test files exist
ls -la tests/e2e/*.spec.ts 2>/dev/null || echo "No E2E tests found in tests/e2e/"
```

**If E2E tests exist**, run them in batches. After each batch, verify:
- [ ] App loads without hanging (within 30s)
- [ ] No infinite spinners in browser
- [ ] No console error loops
- [ ] Main UI elements render (menu, sidebar, editor area)
- [ ] User can interact with UI (click, type, etc.)

**If E2E tests do NOT exist yet**, document this and create a manual smoke test checklist:

**Manual E2E Smoke Test (MANDATORY if no automated E2E):**
1. Start server: `node browser-app/lib/backend/main.js --hostname=0.0.0.0 --port=3000`
2. Open browser: `http://localhost:3000`
3. Wait max 30 seconds for app to load
4. Verify:
   - [ ] No infinite loading spinner
   - [ ] Main menu bar visible
   - [ ] Sidebar renders (files/chat/etc.)
   - [ ] Chat widget shows "Active Session" dropdown
   - [ ] Console has no error loops (check for repeating errors)
   - [ ] Can click on menu items (File, Edit, View)
   - [ ] Can interact with chat widget (click dropdown)
5. Trigger permission dialog (if possible):
   - [ ] If OpenCode server is running, trigger a permission request
   - [ ] Verify dialog appears within 1s
   - [ ] Verify Grant/Deny buttons work
   - [ ] Verify keyboard shortcuts (Enter/Escape) work
6. Shutdown: Ctrl+C server, verify no hanging processes

**Report**: Document each smoke test step result (PASS/FAIL).

### 7. React Import Compliance (CRITICAL)
```bash
grep -rn "from 'react'" extensions/openspace-core/src/browser/ --include="*.ts" --include="*.tsx" | grep -v "@theia/core/shared/react" | grep -v "node_modules" | grep -v "__tests__"
```
- [ ] Output MUST be empty (no bare `react` imports)
- [ ] If any found, this is a BLOCKING FAILURE

```bash
grep -rn "from 'react-dom'" extensions/openspace-core/src/browser/ --include="*.ts" --include="*.tsx" | grep -v "@theia/core/shared/react-dom" | grep -v "node_modules" | grep -v "__tests__"
```
- [ ] Output MUST be empty (no bare `react-dom` imports)
- [ ] If any found, this is a BLOCKING FAILURE

### 8. Spec Compliance (From Contract)

Review source files and verify:

| Req ID | Requirement | Check Method | PASS/FAIL |
|---|---|---|---|
| FR1.1 | Modal dialog centered | Read CSS: `.openspace-permission-dialog-overlay` flexbox centering | |
| FR1.2 | Displays agent ID, action type, details | Read component: agentId, actionType, actionMessage rendered | |
| FR1.3 | Grant/Deny buttons | Read component: both buttons present | |
| FR1.4 | Keyboard shortcuts (Enter/Escape) | Read component: useEffect keyboard handlers | |
| FR2.1 | Subscribes to SyncService.onPermissionRequested | Read contribution: `subscribeToPermissionEvents()` | |
| FR2.5 | Dialog closes after response | Read manager: `grant()`/`deny()` call `processNextRequest()` | |
| FR3.1-3.2 | Queue (FIFO) | Read manager: `requestQueue`, `shift()` usage | |
| FR3.3 | Queue indicator | Read component: "Request X of Y" display | |
| FR4.1 | 60s timeout | Read manager: `TIMEOUT_MS = 60000`, setTimeout | |
| FR4.2 | Timeout auto-deny | Read manager: timeout calls `deny()` | |
| NFR2.1 | React + TypeScript | Verify file extensions .tsx | |
| NFR2.3 | Unit tests comprehensive | Count: 31 permission manager tests | |

### 9. DI Integration
- [ ] `PermissionDialogContribution` bound in `openspace-core-frontend-module.ts` line 56
- [ ] Bound as `FrontendApplicationContribution` (line 57)
- [ ] Singleton scope (`.inSingletonScope()`)

### 10. Lifecycle Correctness
- [ ] `onStart()` method present in contribution (line ~64)
- [ ] `onStop()` method present in contribution (line ~123)
- [ ] `dispose()` method present and cleans up: manager, root, dialogContainer, event subscription

### 11. Code Quality
- [ ] No `any` types without justification (check for `root: any` — acceptable for React 18 compat)
- [ ] Error handling in `grant()` (try/catch/finally)
- [ ] Defensive null checks (manager/current checks)
- [ ] All public methods have JSDoc

### 12. CSS Quality
- [ ] Uses Theia CSS variables with fallbacks
- [ ] Responsive design (@media query present)
- [ ] Accessibility: focus outline on buttons (`:focus`)
- [ ] z-index: 10000 (above Theia UI)

## Exit Criteria (ALL MUST BE TRUE)

1. ✅ Build: 0 errors
2. ✅ Lint: 0 errors
3. ✅ Typecheck: 0 errors
4. ✅ Unit tests: All passing
5. ✅ E2E tests: All passing (or manual smoke test 100% PASS)
6. ✅ React imports: 0 bare imports found
7. ✅ Spec compliance: 12/12 requirements met
8. ✅ DI integration: Correct bindings
9. ✅ Lifecycle: onStart/onStop/dispose present
10. ✅ Code quality: No critical issues
11. ✅ CSS quality: Standards met

**If ANY item fails, verdict is FAIL. Report the blocking issue(s).**

## NO Workarounds

- NO `|| echo "ok"` fallbacks
- NO "tests skipped because X"
- NO "manual verification only"
- ALL automated tests MUST actually run and PASS

## Deliverable

Write report to `.opencode/context/active_tasks/validation-1.14-final.md` with:
1. Checklist results (each item PASS/FAIL)
2. Test evidence (build output, test counts, lint output)
3. E2E smoke test results (if no automated E2E)
4. Overall verdict: PASS or FAIL
5. Blocking issues (if FAIL)
6. Non-blocking observations (if any)
