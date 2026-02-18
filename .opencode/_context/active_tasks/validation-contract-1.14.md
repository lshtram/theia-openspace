---
id: VALIDATION-1.14-PERMISSION-UI
author: oracle_e4b1
status: ACTIVE
date: 2026-02-17
task_id: Task-1.14-Permission-UI
---

# Janitor Validation Contract: Task 1.14 — Permission Dialog UI

## Scope

Validate the complete Permission Dialog UI implementation (Task 1.14 — final Phase 1 task).

## Source Files Under Review

| File | Purpose |
|---|---|
| `extensions/openspace-core/src/browser/permission-dialog.tsx` | React component — modal overlay, Grant/Deny buttons, keyboard shortcuts |
| `extensions/openspace-core/src/browser/permission-dialog-manager.ts` | Queue, timeout (60s auto-deny), grant/deny logic |
| `extensions/openspace-core/src/browser/permission-dialog-contribution.ts` | FrontendApplicationContribution — DI wiring, event subscription, DOM rendering |
| `extensions/openspace-core/src/browser/style/permission-dialog.css` | Theia dark theme styling |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | DI bindings (lines 56-57: PermissionDialogContribution binding) |
| `extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts` | 24+ unit tests (chai + sinon fake timers) |

## Validation Checks

### 1. Build Verification
- [ ] Run `node scripts/build-summary.js` — all 6 extensions + browser app must compile with 0 errors
- [ ] Report exact build output

### 2. Unit Test Execution
- [ ] Run unit tests: `npx mocha --require ts-node/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"`
- [ ] All tests must pass
- [ ] Report test count and pass/fail

### 3. Spec Compliance (Contract Requirements)

**From `contract-1.14-permission-ui.md`:**

| Req ID | Requirement | Check |
|---|---|---|
| FR1.1 | Modal dialog centered over IDE | Verify CSS: `.openspace-permission-dialog-overlay` uses `position: fixed`, flexbox centering |
| FR1.2 | Displays agent ID, action type, action details | Verify `permission-dialog.tsx` renders these fields |
| FR1.3 | Grant and Deny buttons present | Verify buttons in JSX with correct class names |
| FR1.4 | Keyboard accessible (Enter=grant, Escape=deny, Tab navigation) | Verify keyboard event handlers in component |
| FR2.1 | Listens to SyncService.onPermissionRequested | Verify `permission-dialog-contribution.ts` subscribes |
| FR2.2 | Displays permission data from event | Verify data flow: event → manager → component |
| FR2.5 | Dialog closes after user response | Verify manager.grant()/deny() calls processNextRequest() |
| FR3.1 | Queue multiple requests | Verify `requestQueue` array in manager |
| FR3.2 | FIFO order processing | Verify `shift()` usage in processNextRequest() |
| FR3.3 | Queue indicator | Verify "Request X of Y" display in component |
| FR4.1 | 60-second timeout auto-deny | Verify `TIMEOUT_MS = 60000` and setTimeout logic |
| FR4.2 | Move to next after timeout | Verify timeout calls `deny()` which calls `processNextRequest()` |

### 4. React Import Compliance
- [ ] `permission-dialog.tsx` uses `@theia/core/shared/react` (NOT bare `react`)
- [ ] `permission-dialog-contribution.ts` uses `@theia/core/shared/react-dom` (NOT bare `react-dom`)
- [ ] No other bare React/ReactDOM imports

### 5. DI Integration
- [ ] `PermissionDialogContribution` bound in `openspace-core-frontend-module.ts`
- [ ] Bound as `FrontendApplicationContribution`
- [ ] Singleton scope

### 6. Code Quality
- [ ] No TypeScript errors in source files
- [ ] JSDoc documentation on public methods
- [ ] Error handling present (try/catch in grant(), defensive null checks)
- [ ] Disposable pattern implemented (cleanup on unmount)

### 7. CSS Quality
- [ ] Uses Theia CSS variables (not hardcoded colors except for Grant/Deny buttons)
- [ ] Responsive design (@media query present)
- [ ] Accessibility: focus outline on buttons
- [ ] Animation: fadeIn + slideIn (subtle, not distracting)

## NO `|| echo` Fallbacks

All checks must actually PASS. Do NOT use `|| echo "ok"` or similar workarounds.

## Exit Criteria

Report a validation result with:
1. PASS/FAIL status for each check
2. Total score (e.g., 15/15)
3. Any blocking issues found
4. Any non-blocking recommendations

Write your report to `.opencode/context/active_tasks/validation-1.14-permission-ui.md`.
