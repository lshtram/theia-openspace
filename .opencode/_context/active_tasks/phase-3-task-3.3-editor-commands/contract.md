# Contract: Phase 3 Task 3.3 — Editor Commands Registration

> **Task ID:** 3.3  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Create `EditorCommandContribution` to register 6 editor commands in Theia's `CommandRegistry`.

**Why:** The agent needs to open files, scroll to lines, highlight code regions, and read/close editors.

**Dependencies:** Phase 1 complete (✅)

---

## 2. Technical Specification Reference

This task implements the requirements from:

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.3 (FR-3.3: Editor Commands Registration) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.6 (Editor Commands) |
| TECHSPEC-THEIA-OPENSPACE.md | §17.1, §17.4 (Security: path traversal, sensitive files) |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/editor-command-contribution.ts  (NEW)
extensions/openspace-core/src/browser/__tests__/editor-command-contribution.spec.ts  (NEW)
extensions/openspace-core/src/browser/openspace-core-frontend-module.ts  (MODIFY - bind contribution)
```

---

## 4. Requirements

### 4.1 Commands to Register

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.editor.open` | `{ path: string, line?: number, column?: number, highlight?: boolean }` | `{ success: boolean, editorId?: string }` |
| `openspace.editor.scroll_to` | `{ path: string, line: number }` | `{ success: boolean }` |
| `openspace.editor.highlight` | `{ path: string, ranges: Range[], highlightId?: string, color?: string }` | `{ success: boolean, highlightId: string }` |
| `openspace.editor.clear_highlight` | `{ highlightId: string }` | `{ success: boolean }` |
| `openspace.editor.read_file` | `{ path: string }` | `{ success: boolean, content?: string }` |
| `openspace.editor.close` | `{ path: string }` | `{ success: boolean }` |

Where `Range`:
```typescript
interface Range {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}
```

### 4.2 Security Requirements

Per §17.1 and §17.4, implement these checks:

1. **Path Validation** — All file paths must be validated against workspace root
2. **Symlink Protection** — Resolve symlinks and reject paths outside workspace
3. **Sensitive File Denylist** — Block `.env`, `.git/`, `id_rsa`, `*.pem`, etc.

### 4.3 Highlight Tracking

Track highlight IDs for cleanup (GAP-4):

```typescript
interface TrackedHighlight {
  id: string;
  editorId: string;
  decorationIds: string[];
  createdAt: Date;
}

private highlights: Map<string, TrackedHighlight> = new Map();
```

---

## 5. Implementation Hints

### 5.1 Opening an Editor

```typescript
// Using EditorManager
const uri = new URI(path);
const editor = await this.editorManager.open(uri, {
  mode: 'activate',
  reveal: true
});
```

### 5.2 Scrolling to Line

```typescript
// Using MonacoEditor
const monacoEditor = await this.editorManager.getWidgetByUri(uri);
if (monacoEditor instanceof MonacoEditor) {
  monacoEditor.revealLineInCenter(line);
}
```

### 5.3 Highlighting Code

```typescript
// Using MonacoEditor.deltaDecorations
const decorations = ranges.map(range => ({
  range: new monaco.Range(range.startLine, 1, range.endLine, 1),
  options: { inlineClassName: 'openspace-highlight' }
}));
const ids = monacoEditor.deltaDecorations([], decorations);
```

### 5.4 Reading Files

```typescript
// Using FileService (must validate path first)
const validatedPath = await this.validatePath(path);
if (!validatedPath) throw new Error('Access denied');
const content = await this.fileService.read(validatedPath);
```

---

## 6. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.3.1 | Agent can open file at line 42 | Test: openspace.editor.open with line=42 |
| AC-3.3.2 | Agent can highlight lines 42-50 with green background | Test: openspace.editor.highlight |
| AC-3.3.3 | Agent can clear highlights by ID | Test: openspace.editor.clear_highlight |
| AC-3.3.4 | Highlight IDs tracked for cleanup | Verify highlights Map |
| AC-3.3.5 | Path validation rejects traversal | Test: open ../etc/passwd |

---

## 7. Test Scenarios

| # | Test | Expected |
|---|------|----------|
| T1 | `openspace.editor.open({ path: 'src/index.ts', line: 42 })` | Editor opens at line 42 |
| T2 | `openspace.editor.highlight({ path: 'src/index.ts', ranges: [...] })` | Lines highlighted |
| T3 | `openspace.editor.clear_highlight({ highlightId: 'x' })` | Highlight removed |
| T4 | `openspace.editor.read_file({ path: '../etc/passwd' })` | Rejected (path traversal) |
| T5 | `openspace.editor.read_file({ path: '.env' })` | Rejected (sensitive file) |
| T6 | `openspace.editor.close({ path: 'src/index.ts' })` | Editor closed |

---

## 8. Files to Modify/Create

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/editor-command-contribution.ts` | CREATE |
| `extensions/openspace-core/src/browser/__tests__/editor-command-contribution.spec.ts` | CREATE |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | MODIFY (bind contribution) |

---

## 9. Success Criteria

- [ ] 6 editor commands registered in CommandRegistry
- [ ] Path validation implemented (traversal + symlink + sensitive files)
- [ ] Highlight tracking for cleanup
- [ ] Unit tests pass (minimum 8)
- [ ] Commands visible in Theia command palette
- [ ] No regressions in existing tests

---

## 10. Notes

- **Command ID prefix:** Must be `openspace.editor.*`
- **Monaco API:** Use `@theia/monaco/lib/browser/monaco-editor` for editor access
- **Security:** All file operations must go through validation
- **Highlights:** Use unique IDs (e.g., UUID) for tracking

---

**Contract Status:** APPROVED  
**Start Date:** 2026-02-17  
**Target Completion:** Before Task 3.4 (Terminal Commands)
