# Contract: Builder - Strip Unwanted Features

**Task ID:** Phase0.5-StripFeatures  
**Assigned to:** Builder  
**Priority:** P1  
**Created:** 2026-02-16  
**Oracle:** oracle_e3f7

---

## Objective

Remove Debug, SCM, and Notebook features from the Theia IDE using FilterContribution.

## Background

Theia Openspace is a focused AI-native IDE. We want to remove features that are not core to the experience:
- Debug panel and debug-related UI
- SCM (Source Control Management) sidebar
- Notebook editor

## Implementation

Create a `FilterContribution` in `openspace-core` that filters out these features.

### File to Create

**extensions/openspace-core/src/browser/filter-contribution.ts:**

```typescript
import { injectable } from '@theia/core/shared/inversify';
import { FilterContribution, FilterRegistry } from '@theia/core/lib/common/filter';

@injectable()
export class OpenSpaceFilterContribution implements FilterContribution {
  registerFilters(registry: FilterRegistry): void {
    // Filter out debug-related contributions
    registry.registerFilter({
      id: 'openspace.filter.debug',
      name: 'Debug',
      pattern: /debug/i
    });
    
    // Filter out SCM contributions
    registry.registerFilter({
      id: 'openspace.filter.scm',
      name: 'SCM',
      pattern: /scm|git/i
    });
    
    // Filter out notebook contributions
    registry.registerFilter({
      id: 'openspace.filter.notebook',
      name: 'Notebook',
      pattern: /notebook/i
    });
  }
}
```

**Update extensions/openspace-core/src/browser/openspace-core-frontend-module.ts:**

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { FilterContribution } from '@theia/core/lib/common/filter';
import { OpenSpaceFilterContribution } from './filter-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  bind(FilterContribution).to(OpenSpaceFilterContribution).inSingletonScope();
});
```

### Alternative Approach

If FilterContribution is not available or doesn't work as expected, use alternative methods:

1. **MenuContribution** - Remove menu items:
```typescript
@injectable()
export class OpenSpaceMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    // Remove debug menus
    menus.unregisterMenuAction('debug');
    // Remove SCM menus
    menus.unregisterMenuAction('scm');
  }
}
```

2. **CommandContribution** - Unregister commands:
```typescript
@injectable()
export class OpenSpaceCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    // Unregister debug commands
    registry.unregisterCommand('debug.start');
    // etc.
  }
}
```

3. **FrontendApplicationContribution** - Hide widgets on startup:
```typescript
@injectable()
export class OpenSpaceLayoutContribution implements FrontendApplicationContribution {
  async onStart(app: FrontendApplication): Promise<void> {
    // Close/hide unwanted panels
    const debugWidget = app.shell.getWidget('debug');
    if (debugWidget) {
      debugWidget.close();
    }
  }
}
```

Use whichever approach works best with Theia 1.68.2. The goal is clean removal of these features.

## Success Criteria

- [ ] Debug panel not visible in left sidebar
- [ ] SCM/Git panel not visible in left sidebar
- [ ] Notebook editor option not available in menus or command palette
- [ ] No debug-related commands in command palette (or minimal set)
- [ ] Core features still work: file tree, editor, terminal, search, preferences

## Testing

1. Build: `yarn build`
2. Start: `yarn start:browser`
3. Verify:
   - Open http://localhost:3000
   - Check left sidebar: only file tree, search, etc. — no debug, no git
   - Open command palette (Cmd+Shift+P): search "debug" — minimal or no results
   - Open command palette: search "git" or "scm" — minimal or no results

## Time Bound

Complete within 1 session.

## Output

Write `result-strip-features.md` in this task directory with:
- Approach taken and why
- Files modified/created
- Verification results
- Any issues encountered

---

**Oracle Note:** The goal is a clean, focused IDE. Don't worry about completely removing all debug/SCM code — just hide the UI contributions so users don't see them.
