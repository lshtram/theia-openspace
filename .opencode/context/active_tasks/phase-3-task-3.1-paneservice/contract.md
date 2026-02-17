# Contract: Phase 3 Task 3.1 — PaneService Implementation

> **Task ID:** 3.1  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Implement `PaneService` — a service that wraps Eclipse Theia's `ApplicationShell` for programmatic pane control.

**Why:** The agent needs to open, close, focus, list, and resize panes. PaneService is the foundation for all `openspace.pane.*` commands.

**Dependencies:** Phase 1 complete (✅)

---

## 2. Technical Specification Reference

This task implements the requirements from:

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.1 (FR-3.1: PaneService Implementation) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.2 (pattern), §6.6 (Pane Commands) |
| TECHSPEC-THEIA-OPENSPACE.md | §17.5 (Resource cleanup on session end) |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/pane-service.ts  (NEW)
extensions/openspace-core/src/browser/pane-service.ts  (UNIT TESTS)
extensions/openspace-core/src/browser/openspace-core-frontend-module.ts  (MODIFY - bind PaneService)
```

---

## 4. Requirements

### 4.1 Core Methods

Implement the following methods in `PaneService`:

```typescript
@injectable()
export class PaneService {
  
  /**
   * Open content in a pane (editor, terminal, presentation, whiteboard).
   * Maps to ApplicationShell.addWidget() with correct WidgetOptions.
   */
  async openContent(args: PaneOpenArgs): Promise<{ success: boolean; paneId?: string }>;
  
  /**
   * Close a pane by ID. Confirms closure or throws if pane doesn't exist.
   */
  async closeContent(args: PaneCloseArgs): Promise<{ success: boolean }>;
  
  /**
   * Focus a pane by ID, bringing it to front and setting keyboard focus.
   */
  async focusContent(args: PaneFocusArgs): Promise<{ success: boolean }>;
  
  /**
   * List all panes with geometry (percentages), tab info, and active tab.
   * Traverses the DockPanel layout tree.
   */
  async listPanes(): Promise<PaneInfo[]>;
  
  /**
   * Resize a pane to specified dimensions (percentage-based).
   */
  async resizePane(args: PaneResizeArgs): Promise<{ success: boolean }>;
  
  /**
   * Event emitted when layout changes (pane opened, closed, resized, focused).
   */
  get onPaneLayoutChanged(): Event<PaneStateSnapshot>;
}
```

### 4.2 Argument Types

```typescript
interface PaneOpenArgs {
  type: 'editor' | 'terminal' | 'presentation' | 'whiteboard';
  contentId: string;
  title?: string;
  splitDirection?: 'horizontal' | 'vertical';
}

interface PaneCloseArgs {
  paneId: string;
}

interface PaneFocusArgs {
  paneId: string;
}

interface PaneResizeArgs {
  paneId: string;
  width?: number;  // percentage (0-100)
  height?: number; // percentage (0-100)
}

interface PaneInfo {
  id: string;
  area: 'main' | 'left' | 'right' | 'bottom';
  title: string;
  tabs: TabInfo[];
  activeTab?: string;
  width?: number;  // percentage
  height?: number; // percentage
}

interface TabInfo {
  id: string;
  title: string;
  type: 'editor' | 'terminal' | 'presentation' | 'whiteboard' | 'other';
  isDirty?: boolean;
  uri?: string;
}

interface PaneStateSnapshot {
  panes: PaneInfo[];
  activePane?: string;
  timestamp: string;
}
```

### 4.3 Event Emission

The service must emit `onPaneLayoutChanged` events when:
- A pane is opened
- A pane is closed
- A pane is resized
- A pane is focused
- A tab is switched

Use Theia's `Event` emitter:
```typescript
private readonly _onPaneLayoutChanged = new Emitter<PaneStateSnapshot>();
get onPaneLayoutChanged(): Event<PaneStateSnapshot> {
  return this._onPaneLayoutChanged.event;
}
```

---

## 5. Implementation Hints

### 5.1 Accessing ApplicationShell

```typescript
@inject(ApplicationShell)
private readonly shell: ApplicationShell;
```

### 5.2 Opening a Widget

```typescript
// Example: Open editor
const opener = this.editorManager.get(uri);
if (opener) {
  await opener.open(uri, { widgetOptions: { area: 'main', ... } });
}
```

### 5.3 Traversing DockPanel

```typescript
// Access the main dock panel
const dockPanel = this.shell.mainAreaPanel;

// Recursively walk the widget tree
function traverseWidgets(widget: Widget, result: PaneInfo[]): void {
  // Extract pane info from widget
  // Recurse into split panels
}
```

### 5.4 Listening to Layout Changes

```typescript
// Subscribe to ApplicationShell events
this.shell.onDidChangeActiveWidget(() => {
  this.emitLayoutChange();
});
```

---

## 6. Security & Resource Management (NFR-3.7.1)

Per §17.5, PaneService must support resource cleanup:

```typescript
// Track agent-created panes for cleanup
private agentPanes: Map<string, { paneId: string; createdAt: Date; pinned: boolean }> = new Map();

/**
 * Mark a pane as agent-created (for cleanup tracking).
 */
trackAgentPane(paneId: string, pinned: boolean = false): void {
  this.agentPanes.set(paneId, {
    paneId,
    createdAt: new Date(),
    pinned
  });
}

/**
 * Get all agent-created panes (for cleanup).
 */
getAgentPanes(): Array<{ paneId: string; createdAt: Date; pinned: boolean }> {
  return Array.from(this.agentPanes.values());
}
```

---

## 7. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.1.1 | Unit tests confirm all pane operations | Run `yarn test` in openspace-core |
| AC-3.1.2 | `listPanes()` returns accurate layout including geometry | Manual test: open files, verify list output |
| AC-3.1.3 | Layout change events fire correctly | Subscribe to event, perform action, verify event |
| AC-3.1.4 | Service is injectable via Theia DI | Verify binding in frontend-module.ts |

---

## 8. Test Scenarios

| # | Test | Expected |
|---|------|----------|
| T1 | `openContent({ type: 'editor', contentId: 'src/index.ts' })` | Editor opens in main area |
| T2 | `openContent({ type: 'terminal', title: 'test' })` | Terminal created in bottom panel |
| T3 | `closeContent({ paneId: 'x' })` | Pane closed, returns success |
| T4 | `focusContent({ paneId: 'x' })` | Pane focused, keyboard active |
| T5 | `listPanes()` | Returns array of PaneInfo with geometry |
| T6 | `resizePane({ paneId: 'x', width: 50 })` | Pane resized to 50% |
| T7 | Open file → emit layout event | Event fires with correct state |
| T8 | Close all agent panes on session end | All tracked panes closed |

---

## 9. Implementation Order

1. **Create `pane-service.ts`** with skeleton class and DI annotations
2. **Implement `listPanes()`** — hardest, traverse DockPanel first
3. **Implement basic open/close/focus** — use ApplicationShell APIs
4. **Implement `resizePane`** — manipulate panel sizes
5. **Implement layout change events** — wire to ApplicationShell
6. **Add resource tracking** — for GAP-4 cleanup
7. **Write unit tests** — 5+ tests minimum
8. **Verify in browser** — manual test

---

## 10. Files to Modify/Create

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/pane-service.ts` | CREATE |
| `extensions/openspace-core/src/browser/__tests__/pane-service.spec.ts` | CREATE |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | MODIFY (bind PaneService) |

---

## 11. Success Criteria

- [ ] PaneService class created with all 6 methods
- [ ] Unit tests pass (minimum 5 tests)
- [ ] Service bound in DI container
- [ ] Manual test: open file via command palette works
- [ ] Manual test: list panes returns correct geometry
- [ ] Layout change events emit correctly
- [ ] Code compiles without errors
- [ ] No regressions in existing tests

---

## 12. Notes

- **Theia API:** Use `@theia/core/lib/browser/shell/application-shell` for type definitions
- **Testing:** Use Theia's `Widget` and `ApplicationShell` test utilities
- **Panes:** Remember that panes can be nested (split panels)
- **Performance:** `listPanes()` should be fast (<50ms) — consider caching

---

**Contract Status:** APPROVED  
**Start Date:** 2026-02-17  
**Target Completion:** Before Task 3.2 (Pane Commands Registration)
