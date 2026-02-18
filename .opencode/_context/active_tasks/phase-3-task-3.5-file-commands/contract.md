# Contract: Phase 3 Task 3.5 — File Commands Registration

> **Task ID:** 3.5  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Create `FileCommandContribution` to register 4 file commands in Theia's `CommandRegistry`.

**Why:** The agent needs to read, write, list, and search files.

**Dependencies:** Phase 1 complete (✅)

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.5 (FR-3.5: File Commands Registration) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.6 (File Commands) |
| TECHSPEC-THEIA-OPENSPACE.md | §17.1 (Symlink path traversal) |
| TECHSPEC-THEIA-OPENSPACE.md | §17.4 (Sensitive file denylist) |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/file-command-contribution.ts  (NEW)
extensions/openspace-core/src/browser/__tests__/file-command-contribution.spec.ts  (NEW)
extensions/openspace-core/src/browser/openspace-core-frontend-module.ts  (MODIFY)
```

---

## 4. Requirements

### 4.1 Commands to Register

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.file.read` | `{ path: string }` | `{ success: boolean, content?: string }` |
| `openspace.file.write` | `{ path: string, content: string }` | `{ success: boolean }` |
| `openspace.file.list` | `{ path: string }` | `{ success: boolean, files: FileInfo[] }` |
| `openspace.file.search` | `{ query: string, includePattern?: string, excludePattern?: string }` | `{ success: boolean, results: string[] }` |

### 4.2 Security Requirements (MANDATORY)

**Path Validation (GAP-1):**
```typescript
async function validatePath(workspaceRoot: URI, requestedPath: string): Promise<URI | null> {
  // Resolve symlinks
  const realPath = fs.realpathSync(path.resolve(workspaceRoot.path.fsPath(), requestedPath));
  
  // Check if within workspace
  if (!realPath.startsWith(workspaceRoot.path.fsPath())) {
    return null;
  }
  return new URI(realPath);
}
```

**Sensitive File Denylist (GAP-9):**
```typescript
const SENSITIVE_PATTERNS = [
  /^\.env$/i,
  /^\.env\./i,
  /^\.git\//i,
  /^id_rsa$/i,
  /^.*\.pem$/i,
  /^.*\.key$/i,
  /^credentials\.json$/i,
  /^secrets\./i,
];

function isSensitive(path: string): boolean {
  return SENSITIVE_PATTERNS.some(p => p.test(path));
}
```

**Critical File Protection (SC-3.5.2):**
- Block writes to `.git/`, `node_modules/`, `.theia/`
- Block writes to system directories

### 4.3 File Search

Use Theia's `FileSearchService`:
```typescript
const results = await this.searchService.find({
  query: searchQuery,
  include: includePattern || '**/*',
  exclude: excludePattern || '**/node_modules/**'
});
```

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.5.1 | Commands work for files within workspace | Test: read existing file |
| AC-3.5.2 | Cannot read/write outside workspace | Test: read /etc/passwd → reject |
| AC-3.5.3 | File search returns relevant results | Test: search "TODO" → returns matches |
| AC-3.5.4 | Write operations are atomic | Test: verify no partial writes |
| AC-3.5.5 | Sensitive files blocked | Test: read .env → reject |
| AC-3.5.6 | Symlinks outside workspace rejected | Test: symlink to /etc/passwd → reject |

---

## 6. Test Scenarios

| # | Test | Expected |
|---|------|----------|
| T1 | `openspace.file.read({ path: 'src/index.ts' })` | Returns file content |
| T2 | `openspace.file.write({ path: 'new.txt', content: 'hello' })` | Creates file |
| T3 | `openspace.file.list({ path: 'src' })` | Returns file list |
| T4 | `openspace.file.search({ query: 'TODO' })` | Returns matching files |
| T5 | `openspace.file.read({ path: '../etc/passwd' })` | Rejected |
| T6 | `openspace.file.read({ path: '.env' })` | Rejected (sensitive) |
| T7 | `openspace.file.write({ path: '.git/config' })` | Rejected (critical) |

---

## 7. Files to Create/Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/file-command-contribution.ts` | CREATE |
| `extensions/openspace-core/src/browser/__tests__/file-command-contribution.spec.ts` | CREATE |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | MODIFY |

---

## 8. Success Criteria

- [ ] 4 file commands registered
- [ ] Path validation (traversal + symlink)
- [ ] Sensitive file denylist
- [ ] Critical file protection
- [ ] Unit tests pass (minimum 8)
- [ ] No regressions

---

**Contract Status:** APPROVED  
**Start Date:** 2026-02-17
