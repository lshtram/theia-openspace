# Builder Contract: Phase 5.1 — Custom Layout Contributions

**Phase:** 5.1  
**Priority:** High  
**Estimated effort:** 2–3 hours  
**Assigned to:** Builder

---

## Goal

Configure the default application layout for Theia Openspace:

| Area | Widget |
|------|--------|
| Left panel | File Navigator (already contributed by `@theia/navigator`) |
| Right panel | Chat widget |
| Main area | Editors / modality widgets (empty by default) |
| Bottom panel | Terminal (already contributed by `@theia/terminal`) |

This layout must activate **on first launch** (no saved layout) via `initializeLayout()`.
On subsequent launches, Theia's stored layout is used (no migration needed).

---

## Files to Modify / Create

### 1. `extensions/openspace-layout/src/browser/layout-contribution.ts` *(CREATE)*

Implement a `FrontendApplicationContribution` that:
- Implements `initializeLayout(app: FrontendApplication): Promise<void>`
- Inside `initializeLayout`:
  - Opens the file navigator in the **left panel** (use `CommandService` to execute `'navigator:toggle'` or `openView` if available)
  - Opens a terminal in the **bottom panel** (use `CommandService` to execute `'terminal:new'` or `TerminalWidget`)
  - Does NOT open the chat widget here — `ChatViewContribution.initializeLayout` handles it

### 2. `extensions/openspace-chat/src/browser/chat-view-contribution.ts` *(MODIFY)*

- Change `defaultWidgetOptions.area` from `'main'` to `'right'`
- Replace `initializeLayout`/`onStart` logic:
  - Add `initializeLayout(app: FrontendApplication): Promise<void>` that calls `this.openView({ area: 'right', activate: false })`
  - Keep `onStart` to handle **stale layout migration** (if widget is in wrong area, move it to `'right'`)
  - Update the area check in `onStart` from `!== 'main'` to `!== 'right'`

### 3. `extensions/openspace-layout/src/browser/openspace-layout-frontend-module.ts` *(MODIFY)*

Bind `LayoutContribution` to `FrontendApplicationContribution`:

```typescript
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { LayoutContribution } from './layout-contribution';
bind(LayoutContribution).toSelf().inSingletonScope();
bind(FrontendApplicationContribution).toService(LayoutContribution);
```

---

## Implementation Notes

### Chat area: `'right'` not `'main'`
The right panel in Theia is a docked secondary panel. Use `area: 'right'` in `openView()` and `addWidget()`.

### initializeLayout vs onStart
- `initializeLayout` is called **only on fresh launch** (no saved layout)
- `onStart` is called **every launch** — use it for stale layout migration

### Terminal: opening programmatically
Use the `CommandService` to fire `'terminal:new'` with the right options, or use the `TerminalService` if available in the extension. Check if `@theia/terminal` is a dependency of `openspace-layout`.

If `@theia/terminal` is NOT a dependency (check `extensions/openspace-layout/package.json`), use `CommandService` only. Do NOT add `@theia/terminal` as a direct dependency — use `CommandService` to decouple.

### File navigator: opening programmatically
The navigator is already opened by `@theia/navigator`'s own `initializeLayout`. So you likely do NOT need to reopen it — just verify it works when you test. If it doesn't open by default, add a `CommandService.executeCommand('navigator:toggle')` call.

### Dependency check
Before implementing, check `extensions/openspace-layout/package.json` `dependencies` and `peerDependencies`. Add `@theia/terminal` as a peerDependency if needed for type access (but use `CommandService` for the actual call to avoid circular DI issues).

---

## Acceptance Criteria

1. **Fresh launch layout**: On a fresh start (localStorage cleared), the app opens with:
   - File navigator visible in the left panel
   - Chat widget visible in the right panel
   - Terminal visible in the bottom panel
   - Main area is empty (ready for editors)

2. **No regression on stored layout**: If the user has a saved layout, `initializeLayout` is NOT called and the old layout is restored as-is.

3. **Stale layout migration**: If a previous version stored the chat widget in `'main'` or `'left'`, `onStart` moves it to `'right'`.

4. **Build passes**: `yarn build` from root completes with 0 errors.

5. **Tests pass**: `yarn test` passes (37 pass, 2 skip, 0 fail).

6. **No TypeScript errors**: `npx tsc --noEmit` in each modified extension produces 0 errors.

---

## Verification Steps (Janitor)

After Builder completes:

1. `yarn build` — must pass (0 errors)
2. `yarn test` — must be 37 pass, 2 skip, 0 fail
3. Manual browser test:
   a. Clear localStorage: `localStorage.clear()` in browser console, then reload
   b. Verify: file navigator left ✅, chat right ✅, terminal bottom ✅
   c. Rearrange panels, reload (without clearing localStorage)
   d. Verify: layout is restored from localStorage (not reset)
4. Check `data-area` attribute on chat widget container — should show `right`

---

## Out of Scope

- Custom CSS theming (Phase 5.2)
- Settings panels (Phase 5.3)
- Electron build (Phase 5.4)
- Layout persistence beyond Theia's default StorageService (Phase 5.5)
