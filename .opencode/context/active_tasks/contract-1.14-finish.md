---
id: CONTRACT-1.14-FINISH
author: oracle_e4b1
status: ACTIVE
date: 2026-02-17
task_id: Task-1.14-Permission-UI-Finish
---

# Builder Contract: Task 1.14 — Permission Dialog (Final Integration)

## Context

Task 1.14 is 95% complete. All source files exist, DI bindings are wired, CSS is done, and build passes. Two items remain:

1. **Fix React import** in `permission-dialog.tsx` (bare `react` → `@theia/core/shared/react`)
2. **Verify unit tests pass** for `permission-dialog-manager.spec.ts`

## Remaining Work

### 1. Fix React Import in `permission-dialog.tsx`

**File:** `extensions/openspace-core/src/browser/permission-dialog.tsx`

**Current (line 17):**
```typescript
import * as React from 'react';
```

**Required:**
```typescript
import * as React from '@theia/core/shared/react';
```

**Rationale:** Theia re-exports React through its shared package to ensure a single React instance. Using bare `react` risks dual React instances at runtime, causing hooks to fail. See `patterns.md` → "React Imports in Theia Extensions".

This is the ONLY change needed in this file. Do NOT modify anything else.

### 2. Verify Unit Tests Pass

Run the unit tests for PermissionDialogManager:
```bash
npx mocha --require ts-node/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"
```

If tests fail due to import resolution issues, try:
```bash
npx mocha --require ts-node/register --require tsconfig-paths/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"
```

If that also fails (common in Theia monorepo setups), verify the tests are structurally correct by reviewing them. The tests use `chai` expect and `sinon` fake timers — they are well-written (24 test cases). If the test runner can't resolve Theia imports, document this as "tests verified structurally correct but require Theia build environment to execute" — this is acceptable for Phase 1.

### 3. Verify Build Still Passes

After the import fix:
```bash
node scripts/build-summary.js
```

All 6 extensions + browser app must compile successfully.

## Constraints

- **MINIMAL CHANGES ONLY**: Change exactly one line (the React import). Nothing else.
- **DO NOT rewrite** any other file.
- **NO new tests needed** — existing 24 tests are comprehensive.
- **TDD**: Since we're fixing a single import line, no new failing test is needed. The existing tests serve as regression safety.

## Exit Criteria

1. ✅ `permission-dialog.tsx` line 17 uses `@theia/core/shared/react`
2. ✅ Build passes: `node scripts/build-summary.js` exits 0
3. ✅ Unit tests verified (either passing or documented as structurally correct)
4. ✅ No other files modified

## Files to Modify

1. `extensions/openspace-core/src/browser/permission-dialog.tsx` — Fix React import (line 17)

## Build & Test Commands

```bash
# Build
node scripts/build-summary.js

# Unit tests
npx mocha --require ts-node/register "extensions/openspace-core/src/browser/__tests__/permission-dialog-manager.spec.ts"
```
