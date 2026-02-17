---
id: CONTRACT-1.14-PERMISSION-UI-V2
author: oracle_7d3a
status: ACTIVE
date: 2026-02-17
task_id: Task-1.14-Permission-UI
---

# Builder Contract: Task 1.14 — Permission Dialog UI (Integration)

## Context

Three source files, CSS, and unit tests already exist for the permission dialog system. They were created by a previous Builder but **never integrated** into the frontend DI module. The app currently builds and loads in the browser successfully.

## What Already Exists (DO NOT REWRITE)

| File | Status | Notes |
|---|---|---|
| `permission-dialog.tsx` | ✅ Created | React component. Uses `import * as React from 'react'` — OK (already correct). |
| `permission-dialog-manager.ts` | ✅ Created | Queue, timeout, grant/deny logic. Pure TypeScript. |
| `permission-dialog-contribution.ts` | ✅ Created | FrontendApplicationContribution. Has `import * as ReactDOM from 'react-dom/client'` — **MUST FIX**. |
| `style/permission-dialog.css` | ✅ Created | Theia dark theme styling. |
| `__tests__/permission-dialog-manager.spec.ts` | ✅ Created | 20+ test cases with sinon fake timers. |
| `opencode-sync-service.ts` | ✅ Has `onPermissionRequested` event | Already emits `PermissionNotification` events. |
| `opencode-protocol.ts` | ✅ Has `grantPermission()` | Already defined in `OpenCodeService` interface. |

## Remaining Work (3 items)

### 1. Fix ReactDOM Import in `permission-dialog-contribution.ts`

**Current (broken):**
```typescript
import * as ReactDOM from 'react-dom/client';
```

**Required:**
```typescript
import * as ReactDOM from '@theia/core/shared/react-dom';
```

Theia bundles React/ReactDOM through its shared package. Using `react-dom/client` directly may cause duplicate React instances or missing exports.

**IMPORTANT**: After changing the import, the `ReactDOM.createRoot()` call may need adjustment. Check if `@theia/core/shared/react-dom` exports `createRoot`. If not, use the older `ReactDOM.render()` API:
```typescript
// If createRoot not available:
import * as ReactDOM from '@theia/core/shared/react-dom';
ReactDOM.render(element, this.dialogContainer);
```

### 2. Wire `PermissionDialogContribution` into Frontend Module

In `openspace-core-frontend-module.ts`, add:

```typescript
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { PermissionDialogContribution } from './permission-dialog-contribution';

// Inside ContainerModule:
bind(PermissionDialogContribution).toSelf().inSingletonScope();
bind(FrontendApplicationContribution).toService(PermissionDialogContribution);
```

### 3. Verify Unit Tests Pass

Run: `npx mocha --require ts-node/register --require tsconfig-paths/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"`

Or use the project's existing test infrastructure. The tests use `chai` and `sinon` with fake timers.

If tests fail, fix them. Do NOT skip or weaken tests.

## Constraints

- **TDD**: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. However, since the code and tests already exist, you may fix imports and wire DI without writing new tests — the existing tests serve as the safety net.
- **Build must pass**: Run `node scripts/build-summary.js` and confirm all 6 extensions + browser app compile.
- **App must load in browser**: Start the server (`node browser-app/lib/backend/main.js --hostname=0.0.0.0 --port=3000`) and verify the app loads at `http://localhost:3000` without freeze or errors.
- **DO NOT rewrite existing files** unless strictly necessary for the fix. Minimal changes only.
- **React imports**: Use `@theia/core/shared/react` and `@theia/core/shared/react-dom` — never bare `react` or `react-dom`.

## Exit Criteria

1. ✅ `permission-dialog-contribution.ts` uses `@theia/core/shared/react-dom` (not `react-dom/client`)
2. ✅ `PermissionDialogContribution` is bound in `openspace-core-frontend-module.ts` as `FrontendApplicationContribution`
3. ✅ Build passes: `node scripts/build-summary.js` exits 0
4. ✅ App loads in browser at `http://localhost:3000` — no freeze, no console errors related to permission dialog
5. ✅ Unit tests pass (or are fixed to pass)
6. ✅ All changes are minimal — no unnecessary rewrites

## Build & Test Commands

```bash
# Build
node scripts/build-summary.js

# Start server (for browser verification)
node browser-app/lib/backend/main.js --hostname=0.0.0.0 --port=3000

# Unit tests
npx mocha --require ts-node/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"
```

## Files to Modify

1. `extensions/openspace-core/src/browser/permission-dialog-contribution.ts` — Fix ReactDOM import
2. `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` — Add DI bindings
3. (Possibly) `extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts` — Fix if tests fail
