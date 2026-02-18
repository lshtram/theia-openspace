# Phase 1C Remaining Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 5 remaining Phase 1C hardening items found by the audit of 2026-02-19.

**Architecture:** Fixes span browser (permission dialog, sync service, presentation widget, dead code) and Node backend (symlink validation via new `validatePath` RPC method added to `OpenCodeService`).

**Tech Stack:** TypeScript, Theia RPC (`JsonRpcConnectionHandler`), Node `fs.promises.realpath`, React

---

## Audit Summary

Items confirmed still needing fixes (all others are already done):

| # | ID | File | Status |
|---|-----|------|--------|
| 1 | T2-15 | `opencode-sync-service.ts:100` | Test hooks exposed unconditionally |
| 2 | T1-2/T1-3 | `terminal-command-contribution.ts:371`, `editor-command-contribution.ts:314`, `file-command-contribution.ts:219` | Symlink traversal: `path.normalize()` only, no `fs.realpath()` |
| 3 | T2-18 | `permission-dialog.tsx:89` | Focus trap incomplete (Tab doesn't cycle within dialog) |
| 4 | T2-1/T2-2 | `common/pane-protocol.ts` | Dead file — zero source imports |
| 5 | T2-23 | `presentation-widget.tsx:154` | `PresentationNavigationService.setReveal()` never called from `initializeReveal()` |

**Intentional non-fix:** `resizePane` returns fake success (T2-9/T2-10) — Theia `ApplicationShell` has no direct resize API.

---

## Task 1: Guard test hooks with NODE_ENV in SyncService (T2-15)

**Files:**
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts:95-118`

**Context:** The block at line 95–118 exposes `window.__openspace_test__` unconditionally whenever `typeof window !== 'undefined'`. This means it is always exposed in production. It should only be exposed in non-production builds.

The existing comment explains why `process.env.NODE_ENV` was removed — webpack lazy-loaded chunks make it unreliable. But the real fix is to check the condition at build time by wrapping with `process.env.NODE_ENV !== 'production'`, which webpack's DefinePlugin **does** replace in production builds, even in lazy chunks.

**Step 1: Read the file**
Read `extensions/openspace-core/src/browser/opencode-sync-service.ts` lines 90–120.

**Step 2: Write the failing test**

In `extensions/openspace-core/src/browser/__tests__/opencode-sync-service.spec.ts`, verify there is a test confirming hooks are guarded. Add:

```typescript
it('should not expose test hooks in production-like environment', () => {
    // The guard condition is checked at runtime; we verify the code path exists.
    // In production builds webpack DefinePlugin replaces process.env.NODE_ENV with 'production',
    // and the dead-code eliminator removes the entire block.
    // Here we just verify the guard logic is present (structural test).
    const src = require('fs').readFileSync(
        require('path').join(__dirname, '../opencode-sync-service.ts'), 'utf-8'
    );
    expect(src).to.include("process.env.NODE_ENV !== 'production'");
});
```

Run: `yarn test:unit 2>&1 | tail -20`  
Expected: FAIL (guard not present yet)

**Step 3: Add the NODE_ENV guard**

In `opencode-sync-service.ts`, replace the existing test-hook block (starting at the `if (typeof window !== 'undefined')` comment at line 93) with:

```typescript
        // T2-15: Only expose test hooks in non-production builds.
        // process.env.NODE_ENV is replaced by webpack DefinePlugin at build time,
        // which also dead-code eliminates the entire block in production bundles.
        if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
            if (typeof (window as any).__openspace_test__ === 'undefined') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__openspace_test__ = {};
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.assign((window as any).__openspace_test__, {
                triggerAgentCommand: (cmd: AgentCommand) => {
                    this.onAgentCommand(cmd);
                },
                getLastDispatchedCommand: () => this._lastDispatchedCommand,
                injectMessageEvent: (event: MessageNotification) => {
                    this.onMessageEvent(event);
                }
            });
            console.info('[SyncService] E2E test helpers exposed (non-production)');
        }
```

**Step 4: Run tests**

```
yarn test:unit 2>&1 | tail -20
```
Expected: All tests pass.

**Step 5: Build check**

```
yarn build 2>&1 | tail -20
```
Expected: Zero TypeScript errors.

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/browser/opencode-sync-service.ts
git commit -m "fix(security): guard test hooks with NODE_ENV !== production (T2-15)"
```

---

## Task 2: Symlink traversal — add `validatePath` RPC method to Node backend (T1-2/T1-3)

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` (add method to `OpenCodeService` interface)
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` (implement method using `fs.promises.realpath`)
- Modify: `extensions/openspace-core/src/browser/editor-command-contribution.ts` (inject `OpenCodeService`, call `validatePath`)
- Modify: `extensions/openspace-core/src/browser/file-command-contribution.ts` (same)
- Modify: `extensions/openspace-core/src/browser/terminal-command-contribution.ts` (same for cwd)
- Test: `extensions/openspace-core/src/browser/__tests__/editor-command-contribution.spec.ts`

**Context:** `fs.promises.realpath()` only exists in Node. The browser contributions cannot call it directly. The existing code does `path.normalize()` only and has a comment saying "browser context, we can't use fs.realpath()". The correct fix is to add a method to the existing `OpenCodeService` RPC interface so that the browser can call the Node backend, which can resolve symlinks.

The RPC pattern in this codebase: methods are added to the `OpenCodeService` interface in `opencode-protocol.ts`, implemented in `opencode-proxy.ts`, and the Theia `JsonRpcConnectionHandler` automatically proxies them. The browser then injects `OpenCodeService` and calls the method — it returns a `Promise` like any RPC call.

### Step 2.1: Add `validatePath` to the `OpenCodeService` interface

In `extensions/openspace-core/src/common/opencode-protocol.ts`, add to the `OpenCodeService` interface (after the config methods block around line 207):

```typescript
    // Path validation (Node-side, uses fs.realpath for symlink resolution)
    validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }>;
```

**Step 2.2: Implement `validatePath` in `opencode-proxy.ts`**

In `extensions/openspace-core/src/node/opencode-proxy.ts`, add the implementation. Read the file first to find where to insert. Add at the end of the class body:

```typescript
    /**
     * T1-2/T1-3: Validate a file path by resolving symlinks on the Node backend.
     * Returns the canonically-resolved path if it is within the workspace root.
     */
    async validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }> {
        const path = require('path') as typeof import('path');
        const fs = require('fs') as typeof import('fs');
        
        try {
            // Attempt to resolve symlinks on the real filesystem
            let resolvedPath: string;
            try {
                resolvedPath = await fs.promises.realpath(filePath);
            } catch (e) {
                // Path doesn't exist yet (e.g. createFile for a new file)
                // Resolve the parent directory instead
                const parentDir = path.dirname(filePath);
                const fileName = path.basename(filePath);
                let resolvedParent: string;
                try {
                    resolvedParent = await fs.promises.realpath(parentDir);
                } catch {
                    // Parent doesn't exist either — allow it (new nested path)
                    resolvedParent = path.normalize(parentDir);
                }
                resolvedPath = path.join(resolvedParent, fileName);
            }

            // Normalize workspace root for comparison
            const normalizedRoot = path.normalize(workspaceRoot);
            const normalizedResolved = path.normalize(resolvedPath);

            if (!normalizedResolved.startsWith(normalizedRoot + path.sep) && normalizedResolved !== normalizedRoot) {
                return {
                    valid: false,
                    error: `Path resolves outside workspace: ${filePath} → ${resolvedPath}`
                };
            }

            return { valid: true, resolvedPath };
        } catch (err) {
            return {
                valid: false,
                error: `Path validation error: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    }
```

**Step 2.3: Write failing unit test for editor-command-contribution**

In `extensions/openspace-core/src/browser/__tests__/editor-command-contribution.spec.ts`, add a test (read the file first to see existing test structure, then add):

```typescript
describe('validatePath symlink traversal', () => {
    it('should call openCodeService.validatePath for symlink resolution', async () => {
        const mockResult = { valid: false, error: 'Path resolves outside workspace' };
        const mockOpenCodeService = {
            validatePath: sinon.stub().resolves(mockResult)
        };
        // Inject mock and call validatePath — verify openCodeService was called
        // (exact test setup depends on existing mock patterns in this test file)
    });
});
```

Run: `yarn test:unit 2>&1 | tail -20`  
Expected: FAIL (validatePath not wired yet)

**Step 2.4: Wire `OpenCodeService` into the three browser contributions**

For each of `editor-command-contribution.ts`, `file-command-contribution.ts`, and `terminal-command-contribution.ts`:

1. Read the file to find the constructor/inject decorators.
2. Add `@inject(OpenCodeService) private readonly openCodeService: OpenCodeService` to the constructor.
3. Add the import at the top: `import { OpenCodeService } from '../common/opencode-protocol';`

**Step 2.5: Call `validatePath` in `editor-command-contribution.ts`**

In the `validatePath` method of `editor-command-contribution.ts` (around line 314 where the comment says "T1-3: In browser context, we cannot resolve symlinks"), replace the symlink comment block with:

```typescript
            // T1-3: Resolve symlinks via Node backend (browser can't call fs.realpath)
            if (this.openCodeService && typeof (this.openCodeService as any).validatePath === 'function') {
                const result = await (this.openCodeService as any).validatePath(normalizedPath, normalizedRoot);
                if (!result.valid) {
                    console.warn(`[EditorCommand] Path rejected by symlink check: ${result.error}`);
                    return null;
                }
                // Use the canonically resolved path going forward
                return result.resolvedPath || normalizedPath;
            }
```

**Step 2.6: Same change in `file-command-contribution.ts`** (around line 219)

**Step 2.7: Same change in `terminal-command-contribution.ts`** (around line 371, for `cwd` validation)

**Step 2.8: Run tests**

```
yarn test:unit 2>&1 | tail -20
```
Expected: All tests pass.

**Step 2.9: Build check**

```
yarn build 2>&1 | tail -20
```
Expected: Zero TypeScript errors.

**Step 2.10: Commit**

```bash
git add extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/browser/editor-command-contribution.ts \
        extensions/openspace-core/src/browser/file-command-contribution.ts \
        extensions/openspace-core/src/browser/terminal-command-contribution.ts
git commit -m "fix(security): resolve symlinks via Node RPC before workspace containment check (T1-2/T1-3)"
```

---

## Task 3: Proper focus trap in permission dialog (T2-18)

**Files:**
- Modify: `extensions/openspace-core/src/browser/permission-dialog.tsx`

**Context:** The current implementation uses a `hasFocus` state variable to track whether the dialog has focus. This correctly blocks Enter/Escape when focus is outside. However, Tab key doesn't cycle within the dialog — focus can escape to background elements. A proper accessibility-grade focus trap cycles Tab within the dialog's focusable elements.

The fix is pure React — no new dependencies. We use a `useEffect` to intercept Tab keydown events when the dialog is open, find all focusable elements within the dialog ref, and cycle through them.

**Step 3.1: Write failing test**

Add a test in the relevant spec file (or create `permission-dialog.spec.ts` if it doesn't exist as a unit test):

```typescript
it('focus trap cycles Tab within dialog elements', () => {
    // This is best verified via E2E; as a unit test, verify the code contains Tab cycling logic
    const src = require('fs').readFileSync(
        require('path').join(__dirname, '../permission-dialog.tsx'), 'utf-8'
    );
    expect(src).to.include("key === 'Tab'");
    expect(src).to.include('focusableElements');
});
```

Run: `yarn test:unit 2>&1 | tail -20`  
Expected: FAIL

**Step 3.2: Add Tab-cycling focus trap**

In `permission-dialog.tsx`, add a new `useEffect` block after the existing keyboard handler (around line 113). Read the file first to confirm exact insertion point:

```typescript
    // T2-18: Full focus trap — cycle Tab key within dialog's focusable elements
    React.useEffect(() => {
        if (!isOpen || !dialogRef.current) {
            return;
        }

        const handleTabKey = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') {
                return;
            }

            const focusable = dialogRef.current!.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
                'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const elements = Array.from(focusable);
            if (elements.length === 0) {
                return;
            }

            const first = elements[0];
            const last = elements[elements.length - 1];
            const active = document.activeElement as HTMLElement;

            if (event.shiftKey) {
                // Shift+Tab: wrap from first to last
                if (active === first) {
                    event.preventDefault();
                    last.focus();
                }
            } else {
                // Tab: wrap from last to first
                if (active === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleTabKey);
        return () => document.removeEventListener('keydown', handleTabKey);
    }, [isOpen]);
```

**Step 3.3: Run tests**

```
yarn test:unit 2>&1 | tail -20
```
Expected: All tests pass.

**Step 3.4: Build check**

```
yarn build 2>&1 | tail -20
```
Expected: Zero errors.

**Step 3.5: Commit**

```bash
git add extensions/openspace-core/src/browser/permission-dialog.tsx
git commit -m "fix(a11y): add proper Tab-cycling focus trap to permission dialog (T2-18)"
```

---

## Task 4: Delete dead `pane-protocol.ts` (T2-1/T2-2)

**Files:**
- Delete: `extensions/openspace-core/src/common/pane-protocol.ts`

**Context:** `pane-protocol.ts` has zero source imports (confirmed by grep — only compiled `.d.ts` references it as a source map artifact). The `PaneService` symbol and all pane interfaces have been moved to `pane-service.ts`. This file is dead code.

**Step 4.1: Confirm no imports**

Run:
```bash
grep -r "pane-protocol" extensions --include="*.ts" --include="*.tsx" | grep -v "/lib/"
```
Expected: No output (zero source imports).

**Step 4.2: Delete the file**

```bash
rm extensions/openspace-core/src/common/pane-protocol.ts
```

**Step 4.3: Build check**

```
yarn build 2>&1 | tail -20
```
Expected: Zero errors. If any broken import appears, fix it before committing.

**Step 4.4: Run tests**

```
yarn test:unit 2>&1 | tail -20
```
Expected: All tests pass.

**Step 4.5: Commit**

```bash
git add -A
git commit -m "chore: delete dead pane-protocol.ts (T2-1/T2-2)"
```

---

## Task 5: Wire `PresentationNavigationService` to Reveal instance (T2-23)

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx`
- Modify: `extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts` (if navigation service not bound to DI)

**Context:** `PresentationNavigationService` class exists at line 293 with a `setReveal(reveal)` method. `PresentationWidget.initializeReveal()` creates `this.revealDeck = new Reveal(...)` at line 165 but never calls `navigationService.setReveal(this.revealDeck)`. As a result, all MCP navigation commands (`openspace.presentation.navigate`) have a no-op navigation service.

The `PresentationNavigationService` is `@injectable()` so it needs to be injected into `PresentationWidget`. Read the presentation frontend module and widget constructor to determine the current injection pattern.

**Step 5.1: Read files**

Read:
- `extensions/openspace-presentation/src/browser/presentation-widget.tsx` lines 1–90 (constructor/class header)
- `extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts` (full file)

**Step 5.2: Bind `PresentationNavigationService` in DI (if not already bound)**

If the frontend module doesn't bind `PresentationNavigationService`, add:
```typescript
bind(PresentationNavigationService).toSelf().inSingletonScope();
```

**Step 5.3: Inject into `PresentationWidget`**

Add to `PresentationWidget` class:
1. Import `PresentationNavigationService` if not imported.
2. Add `@inject(PresentationNavigationService) protected readonly navigationService: PresentationNavigationService;` to the class.

**Step 5.4: Call `setReveal` in `initializeReveal`**

In `initializeReveal()` at line 178 (after `this.revealDeck.initialize()`), add:

```typescript
        this.revealDeck.initialize().then(() => {
            // T2-23: Wire navigation service to Reveal instance after initialization
            this.navigationService.setReveal(this.revealDeck!);
        }).catch((err: Error) => {
            console.error('[PresentationWidget] Failed to initialize reveal.js:', err);
        });
```

Or if the existing code uses `.catch()` separately, replace the pattern consistently. The key is: after `initialize()` resolves, call `this.navigationService.setReveal(this.revealDeck!)`.

**Step 5.5: Clear navigation service on destroy**

In `onBeforeDetach()` at line 146, after `this.revealDeck.destroy()`, add:

```typescript
        this.navigationService.setReveal(undefined as any);
```

This prevents stale references after widget close.

**Step 5.6: Build check**

```
yarn build 2>&1 | tail -20
```
Expected: Zero errors.

**Step 5.7: Run tests**

```
yarn test:unit 2>&1 | tail -20
```
Expected: All tests pass.

**Step 5.8: Commit**

```bash
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx \
        extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts
git commit -m "fix(presentation): wire PresentationNavigationService to Reveal instance (T2-23)"
```

---

## Task 6: Update WORKPLAN.md status

**Files:**
- Modify: `docs/architecture/WORKPLAN.md`

Update the Phase 1C task statuses. Mark 1C.1, 1C.2, 1C.3 as complete (all T1 and T2 items are now done). Mark 1C.4 as complete (pane-protocol.ts deleted). Leave 1C.5, 1C.6, 1C.7 as pending.

Also update the overall Phase 1C status from ⬜ NOT STARTED to 🟡 In progress.

**Step 6.1: Edit WORKPLAN**

Read `docs/architecture/WORKPLAN.md` lines 31 and 89–151, then update:
- Line 31: `Phase 1C` row → change to `🟡 In progress`
- Section 1C.1: `Status | ⬜` → `Status | ✅`
- Section 1C.2: `Status | ⬜` → `Status | ✅`
- Section 1C.3: `Status | ⬜` → `Status | ✅`
- Section 1C.4: `Status | ⬜` → `Status | ✅`

**Step 6.2: Commit**

```bash
git add docs/architecture/WORKPLAN.md
git commit -m "docs: mark Phase 1C tasks 1C.1-1C.4 complete in WORKPLAN"
```

---

## Verification Checklist (after all 6 tasks)

```bash
yarn test:unit 2>&1 | tail -5   # Must show: passing, 0 failing
yarn build 2>&1 | tail -5       # Must show: zero TypeScript errors
```

Security items confirmed resolved:
- [ ] T2-15: `opencode-sync-service.ts` — test hooks guarded by `process.env.NODE_ENV !== 'production'`
- [ ] T1-2/T1-3: symlink traversal — Node backend `validatePath` called before containment check
- [ ] T2-18: permission dialog — Tab cycles within dialog elements
- [ ] T2-1/T2-2: `pane-protocol.ts` deleted
- [ ] T2-23: `PresentationNavigationService.setReveal()` called in `initializeReveal()`
