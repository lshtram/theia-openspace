---
id: CONTRACT-1.14-E2E-FIX
agent: builder
status: pending
priority: high
parent_task: Task-1.14-Permission-UI
created: 2026-02-17
---

# Builder Contract: Fix E2E Tests for Permission Dialog

## Objective

Rewrite E2E tests in `tests/e2e/permission-dialog.spec.ts` to properly trigger the permission dialog using Theia service events instead of browser CustomEvents.

## Problem Statement

Current E2E tests fail 8/8 because:

1. **Current (broken) approach**: Tests fire browser `CustomEvent` via `window.dispatchEvent()`
   ```typescript
   const event = new CustomEvent('opencode:permission', { detail: { ... } });
   window.dispatchEvent(event);
   ```

2. **Actual trigger mechanism**: Permission dialog listens to `OpenCodeSyncService.onPermissionRequested` event
   ```typescript
   // In permission-dialog-contribution.ts line 88
   this.syncService.onPermissionRequested((event) => {
       this.manager.handlePermissionEvent(event);
   });
   ```

3. **Root cause**: Browser CustomEvents never reach the Theia service layer. The sync service receives events via SSE from OpenCode backend, not from browser DOM events.

## Required Changes

### File: `tests/e2e/permission-dialog.spec.ts`

Replace the `injectPermissionRequest()` helper function with a version that:

1. **Access Theia DI container** via `window['theia']` global (standard Theia pattern)
2. **Get OpenCodeSyncService** from container using the service symbol
3. **Fire event directly** via `syncService.permissionRequestedEmitter.fire(event)`

**Important Technical Details**:

- OpenCodeSyncService has private `permissionRequestedEmitter` (line 103 of `opencode-sync-service.ts`)
- The emitter is exposed via `get onPermissionRequested(): Event<PermissionNotification>` (line 109)
- To fire events in tests, we need to access the private emitter via `(syncService as any).permissionRequestedEmitter.fire(event)`

**Event Structure** (from `PermissionNotification` type):
```typescript
{
  id: string;           // Permission request ID
  sessionId: string;    // Active session ID
  agentId: string;      // Agent requesting permission
  action: string;       // Action type (e.g., "file:write")
  metadata: object;     // Additional context
  timestamp: number;    // Unix timestamp
}
```

### Implementation Strategy

```typescript
async function injectPermissionRequest(
  page: Page,
  id: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  await page.evaluate(({ id, action, metadata }) => {
    // Access Theia DI container
    const container = (window as any)['theia']?.container;
    if (!container) {
      throw new Error('Theia container not available');
    }

    // Get OpenCodeSyncService
    const OpenCodeSyncServiceSymbol = Symbol.for('OpenCodeSyncService');
    const syncService = container.get(OpenCodeSyncServiceSymbol);
    if (!syncService) {
      throw new Error('OpenCodeSyncService not found in container');
    }

    // Get SessionService to find active session ID
    const SessionServiceSymbol = Symbol.for('SessionService');
    const sessionService = container.get(SessionServiceSymbol);
    const activeSession = sessionService.getActiveSession();
    
    if (!activeSession) {
      throw new Error('No active session - cannot inject permission request');
    }

    // Fire permission event via internal emitter
    const event = {
      id,
      sessionId: activeSession.id,
      agentId: 'test-agent',
      action,
      metadata: metadata || {},
      timestamp: Date.now()
    };

    // Access private emitter (test-only workaround)
    const emitter = (syncService as any).permissionRequestedEmitter;
    if (!emitter) {
      throw new Error('Permission emitter not found on sync service');
    }
    
    emitter.fire(event);
  }, { id, action, metadata });
}
```

### Symbol Binding Verification

Check how symbols are bound in `openspace-core-frontend-module.ts`:

```typescript
// Line 32 (existing)
bind(OpenCodeSyncService).to(OpenCodeSyncServiceImpl).inSingletonScope();

// This means the symbol is the value of the OpenCodeSyncService constant
// NOT Symbol.for('OpenCodeSyncService')
```

**If symbols are NOT registered with `Symbol.for()`**, the evaluate function needs to access them differently:

```typescript
// Option 1: Use string lookup if symbols are exported to window
const syncService = container.get('OpenCodeSyncService');

// Option 2: Create matching Symbol by description
const symbols = Object.getOwnPropertySymbols(container._bindingDictionary._map);
const syncServiceSymbol = symbols.find(s => s.description === 'OpenCodeSyncService');
```

**Your Task**: 
1. Read `openspace-core-frontend-module.ts` to understand how `OpenCodeSyncService` and `SessionService` symbols are created
2. Determine the correct way to retrieve these services from the Theia container in browser context
3. Implement the corrected `injectPermissionRequest()` helper
4. Verify all 8 tests can trigger the dialog

### CSS Class Name Fix

Current tests expect `.permission-dialog-overlay` but actual component uses `.openspace-permission-dialog-overlay`.

**Required changes**:
- Line 65: Change `.permission-dialog-overlay` → `.openspace-permission-dialog-overlay`
- Line 69: Change `.permission-dialog` → `.openspace-permission-dialog`
- Line 70: Change `.permission-dialog-action` → `.openspace-permission-dialog-action`
- Line 71: Change `.permission-dialog-metadata` → `.openspace-permission-dialog-metadata`
- Line 184: Change `.permission-dialog-queue` → `.openspace-permission-dialog-queue`
- Line 222: Change `.permission-dialog-timeout` → `.openspace-permission-dialog-timeout`
- (Apply to all occurrences in file)

**Correct class names** (from `permission-dialog.css`):
```css
.openspace-permission-dialog-overlay { }
.openspace-permission-dialog { }
.openspace-permission-dialog-header { }
.openspace-permission-dialog-content { }
.openspace-permission-dialog-info { }
.openspace-permission-dialog-agent { }
.openspace-permission-dialog-action { }
.openspace-permission-dialog-metadata { }
.openspace-permission-dialog-actions { }
.openspace-permission-dialog-queue { }
.openspace-permission-dialog-timeout { }
```

## Test Requirements

After implementing:

1. **Run E2E tests**: `yarn test:e2e tests/e2e/permission-dialog.spec.ts`
2. **Expected result**: 8/8 tests passing
3. **Verify**:
   - Dialog appears when permission event fired
   - Grant/Deny buttons work
   - Keyboard shortcuts work (Enter/Escape)
   - Queue processing works (FIFO order)
   - Timeout countdown visible (if implemented)
   - No console errors

## Acceptance Criteria

- ✅ E2E tests trigger permission dialog via `OpenCodeSyncService.onPermissionRequested` event
- ✅ All 8 E2E tests pass
- ✅ CSS class names match actual component
- ✅ No TypeScript errors
- ✅ No runtime console errors during tests
- ✅ Test execution time < 60 seconds (no actual 60s timeout wait)

## Files to Modify

1. `/Users/Shared/dev/theia-openspace/tests/e2e/permission-dialog.spec.ts` (302 lines)
   - Rewrite `injectPermissionRequest()` helper (lines 28-46)
   - Fix CSS class names throughout (20+ occurrences)

## Reference Files

- `/Users/Shared/dev/theia-openspace/extensions/openspace-core/src/browser/opencode-sync-service.ts`
  - Line 103: `permissionRequestedEmitter` definition
  - Line 109: `onPermissionRequested` event getter
  - Line 381: Example of firing event from backend

- `/Users/Shared/dev/theia-openspace/extensions/openspace-core/src/browser/permission-dialog-contribution.ts`
  - Line 88: How dialog subscribes to events

- `/Users/Shared/dev/theia-openspace/extensions/openspace-core/src/browser/openspace-core-frontend-module.ts`
  - Line 32: OpenCodeSyncService DI binding
  - Line 37: SessionService DI binding

- `/Users/Shared/dev/theia-openspace/extensions/openspace-core/src/browser/style/permission-dialog.css`
  - Lines 34-205: CSS class definitions

## Notes

- **Session requirement**: Tests must ensure an active session exists. The working E2E test `tests/e2e/session-management-integration.spec.ts` shows how to create sessions properly.
- **Theia initialization**: Keep existing `waitForTheiaReady()` function — it correctly waits for Theia shell
- **Queue indicator**: Current implementation displays "Request X of Y" — verify tests check this correctly
- **Timeout display**: Implementation MAY NOT have visible countdown timer (spec ambiguity). If `.openspace-permission-dialog-timeout` element doesn't exist, tests should skip checking it (E2E-6, E2E-7).

## Success Criteria

When complete:
1. `yarn test:e2e tests/e2e/permission-dialog.spec.ts` exits with code 0
2. Output shows: "8 passed"
3. No "Error: expect(locator).toBeVisible() failed" errors
4. Test execution completes in < 60 seconds

## Deliverables

1. Updated `tests/e2e/permission-dialog.spec.ts` file
2. Test execution output showing 8/8 passing
3. Brief summary of changes made

---

**Builder**: Read this contract, implement the fix, run tests, report results.
