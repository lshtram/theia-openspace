# Contract: Phase 3 Task 3.2 — Pane Commands Registration

> **Task ID:** 3.2  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Create `PaneCommandContribution` to register 5 pane commands in Theia's `CommandRegistry`.

**Why:** The agent needs to execute pane operations via `openspace.pane.*` commands.

**Dependencies:** Task 3.1 (PaneService) ✅ COMPLETE

---

## 2. Technical Specification Reference

This task implements the requirements from:

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.2 (FR-3.2: Pane Commands Registration) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.2 (pattern), §6.6 (Pane Commands) |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/pane-command-contribution.ts  (NEW)
extensions/openspace-core/src/browser/__tests__/pane-command-contribution.spec.ts  (NEW)
extensions/openspace-core/src/browser/openspace-core-frontend-module.ts  (MODIFY - bind contribution)
```

---

## 4. Requirements

### 4.1 Commands to Register

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.pane.open` | `{ type: "editor"\|"terminal"\|"presentation"\|"whiteboard", contentId: string, splitDirection?: "horizontal"\|"vertical" }` | `{ success: boolean, paneId?: string }` |
| `openspace.pane.close` | `{ paneId: string }` | `{ success: boolean }` |
| `openspace.pane.focus` | `{ paneId: string }` | `{ success: boolean }` |
| `openspace.pane.list` | `{}` | `{ panes: PaneInfo[] }` |
| `openspace.pane.resize` | `{ paneId: string, width?: number, height?: number }` | `{ success: boolean }` |

### 4.2 Command Contribution Pattern

```typescript
@injectable()
export class PaneCommandContribution implements CommandContribution {
  
  @inject(PaneService)
  private readonly paneService: PaneService;
  
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(
      { 
        id: 'openspace.pane.open',
        label: 'OpenSpace: Open Pane',
        arguments: [
          { name: 'type', type: 'string', enum: ['editor', 'terminal', 'presentation', 'whiteboard'] },
          { name: 'contentId', type: 'string' },
          { name: 'splitDirection', type: 'string', enum: ['horizontal', 'vertical'], required: false }
        ]
      },
      (args: PaneOpenArgs) => this.paneService.openContent(args)
    );
    
    // Repeat for close, focus, list, resize
  }
}
```

### 4.3 Argument Schemas

Each command must include a JSON Schema for the manifest auto-generation (FR-3.7):

```typescript
const paneOpenSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['editor', 'terminal', 'presentation', 'whiteboard'],
      description: 'Type of content to open'
    },
    contentId: {
      type: 'string',
      description: 'Identifier for the content (file path, terminal title, etc.)'
    },
    splitDirection: {
      type: 'string',
      enum: ['horizontal', 'vertical'],
      description: 'Direction to split the pane'
    }
  },
  required: ['type', 'contentId']
};
```

---

## 5. Implementation Steps

1. **Create `pane-command-contribution.ts`**
   - Implement `CommandContribution` interface
   - Register all 5 commands
   - Include argument schemas

2. **Create unit tests**
   - Test each command delegation
   - Test argument schema extraction

3. **Update frontend-module.ts**
   - Bind `PaneCommandContribution` to `CommandContribution`

4. **Verify**
   - Commands appear in command palette
   - Commands delegate to PaneService correctly

---

## 6. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.2.1 | Commands executable from Theia command palette | Run Theia, press Cmd+Shift+P, type "openspace.pane" |
| AC-3.2.2 | `openspace.pane.list` returns correct layout | Call command, verify PaneInfo[] returned |
| AC-3.2.3 | All commands include argument schemas | Check manifest output |
| AC-3.2.4 | Commands registered in DI module | Verify binding |

---

## 7. Test Scenarios

| # | Test | Expected |
|---|------|----------|
| T1 | Execute `openspace.pane.list` from palette | Returns list of panes |
| T2 | Execute `openspace.pane.open` with valid args | Opens pane |
| T3 | Execute `openspace.pane.close` with invalid ID | Returns error |
| T4 | All 5 commands appear in command palette | Visible in list |

---

## 8. Files to Modify/Create

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/pane-command-contribution.ts` | CREATE |
| `extensions/openspace-core/src/browser/__tests__/pane-command-contribution.spec.ts` | CREATE |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | MODIFY (bind contribution) |

---

## 9. Success Criteria

- [ ] 5 pane commands registered in CommandRegistry
- [ ] Each command includes argument schema for manifest
- [ ] Commands delegate to PaneService correctly
- [ ] Unit tests pass (minimum 5)
- [ ] Commands visible in Theia command palette
- [ ] No regressions in existing tests

---

## 10. Notes

- **Command ID prefix:** Must be `openspace.pane.*` (not `openspace:pane.*`)
- **Label:** Use `OpenSpace: [Action] Pane` format
- **Error handling:** Return `{ success: false, error: string }` on failure
- **Schema:** Required for manifest auto-generation (FR-3.7)

---

**Contract Status:** APPROVED  
**Start Date:** 2026-02-17  
**Target Completion:** Before Task 3.3 (Editor Commands)
