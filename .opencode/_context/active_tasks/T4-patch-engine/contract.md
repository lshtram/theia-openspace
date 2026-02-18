# Builder Contract: Phase T4 — PatchEngine

**Issued by:** oracle  
**Date:** 2026-02-18  
**Status:** ACTIVE

---

## Objective

Implement the PatchEngine service for versioned, operation-based artifact mutations.
Port from the reference implementation at `/Users/Shared/dev/openspace/runtime-hub/src/services/PatchEngine.ts`
but adapted to Theia's CommonJS environment (no ESM imports, no external dependencies beyond `fs`).

---

## Scope

### T4.1 — Create `patch-engine.ts`

**File:** `extensions/openspace-core/src/node/patch-engine.ts`

This is a self-contained service. It does NOT depend on ArtifactStore (that comes in T5).
For T4, file I/O is done directly with Node's `fs` module.

#### Interface

```typescript
export interface PatchRequest {
  baseVersion: number;
  actor: string;
  intent: string;
  ops: unknown[];
}

export interface PatchApplyResult {
  version: number;
  bytes: number;
}

export class ConflictError extends Error {
  readonly code = 'VERSION_CONFLICT';
  constructor(
    readonly currentVersion: number,
    readonly filePath: string
  ) { ... }
}

export class PatchValidationError extends Error {
  readonly code: string;
  readonly location: string;
  readonly remediation: string;
  constructor(code: string, location: string, reason: string, remediation: string) { ... }
}

export class PatchEngine {
  constructor(workspaceRoot: string) { ... }

  getVersion(filePath: string): number;

  async apply(filePath: string, request: PatchRequest): Promise<PatchApplyResult>;

  /** Persist version map to disk — call after each successful apply */
  private async saveVersions(): Promise<void>;

  /** Load version map from disk on init */
  async loadVersions(): Promise<void>;
}
```

#### Supported operations

1. **`replace_content`** — Full content replacement. `{ op: 'replace_content', content: string }`. Always exactly 1 op.
2. **`replace_lines`** — Line range replacement. `{ op: 'replace_lines', startLine: number, endLine: number, content: string }`. Zero-indexed line numbers. Can have multiple ops (applied in reverse order by line number to avoid offset drift).

#### Version persistence

- Versions stored in `{workspaceRoot}/.openspace/patch-versions.json` as `{ "relative/path/to/file": 3, ... }`
- Directory `.openspace/` created if it does not exist
- Versions loaded from disk on `loadVersions()` call
- Versions saved to disk after every successful `apply()`
- If `patch-versions.json` does not exist, all versions start at 0

#### OCC (Optimistic Concurrency Control)

- If `request.baseVersion !== currentVersion` → throw `ConflictError(currentVersion, filePath)`
- If ops fail validation → throw `PatchValidationError`
- On success → write file, increment version, save versions, return `{ version, bytes }`

#### Path safety

- `filePath` is always relative (e.g., `design/arch.diagram.json`)
- Absolute path = `path.resolve(workspaceRoot, filePath)`
- Must verify resolved path starts with `workspaceRoot` (prevent traversal)
- Must create parent directories if they don't exist (for new files)

#### Concurrency

- Use a `Map<string, Promise<void>>` as a per-file serial queue
- Before writing: await any in-flight write for the same path, then proceed
- This prevents torn writes under concurrent MCP tool calls

---

### T4.2 — Add Hub patch endpoint + integrate into hub.ts

**File:** `extensions/openspace-core/src/node/hub.ts`

Add route: `POST /files/:filePath*/patch`

Note the wildcard `:filePath*` to handle paths with slashes (e.g., `design/arch.json`).
Express encodes this as `req.params['0']` or `req.params.filePath + req.params[0]`.
Use `req.params[0]` or reconstruct from the raw URL after `/files/` prefix.

**Route handler:**

```typescript
app.post('/files/*', async (req: Request, res: Response) => {
  // Only handle paths ending in /patch
  const rawPath = (req.params as any)[0] as string;
  if (!rawPath.endsWith('/patch')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const filePath = rawPath.slice(0, -'/patch'.length); // strip trailing /patch

  try {
    const result = await this.patchEngine.apply(filePath, req.body);
    res.json(result); // { version: N, bytes: N }
  } catch (error) {
    if (error instanceof ConflictError) {
      res.status(409).json({ currentVersion: error.currentVersion });
    } else if (error instanceof PatchValidationError) {
      res.status(400).json({ code: error.code, location: error.location, reason: error.message, remediation: error.remediation });
    } else {
      res.status(500).json({ error: String(error) });
    }
  }
});
```

**Wire PatchEngine into Hub:**
- Add `private patchEngine!: PatchEngine;` field to `OpenSpaceHub`
- Initialize in `configure(app)`: `this.patchEngine = new PatchEngine(this.getWorkspaceRoot()); await this.patchEngine.loadVersions();`
- The `getWorkspaceRoot()` method already exists on Hub (returns `os.homedir()` fallback or env var). Use `process.cwd()` as the workspace root for now — same as what file tools use.

**Add `GET /files/:path*/version` endpoint (bonus — for agents to query current version):**

```
GET /files/design/arch.diagram.json/version → { version: 3 }
```

---

### T4.3 — Unit tests

**File:** `extensions/openspace-core/src/node/__tests__/patch-engine.spec.ts`

Use mocha + chai (same pattern as all other unit tests in this project).
Use `fs.mkdtemp` for temp workspace root in each test.
Clean up temp dir in `afterEach`.

**Required test cases:**

1. `apply replace_content → version increments from 0 to 1`
2. `apply replace_content twice → version increments to 2`
3. `apply with stale baseVersion → throws ConflictError with currentVersion`
4. `apply replace_lines → correct lines replaced`
5. `apply replace_lines out-of-bounds → throws PatchValidationError`
6. `version persists across new PatchEngine instance (loadVersions)`
7. `concurrent applies to same file → serial execution, no torn writes`
8. `path traversal attempt → throws PatchValidationError`
9. `new file created if it does not exist (version 0 → 1)`
10. `GET /files/:path/version endpoint returns correct version (integration test for hub route)`

Tests 1–9 are unit tests on PatchEngine directly.
Test 10 is an integration test using supertest or direct Hub test (skip if too complex).

---

## What NOT to do

- Do NOT implement ArtifactStore (that's T5)
- Do NOT implement diagram-specific ops (addNode/removeNode/etc.) — the reference uses them but we only need `replace_content` and `replace_lines` for T4
- Do NOT add `p-queue` dependency — use the Map-of-Promises pattern instead
- Do NOT add `chokidar` dependency — that's T5

---

## Files to create/modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/node/patch-engine.ts` | CREATE |
| `extensions/openspace-core/src/node/__tests__/patch-engine.spec.ts` | CREATE |
| `extensions/openspace-core/src/node/hub.ts` | MODIFY (add patchEngine field + route) |

---

## Acceptance Criteria

- [ ] `extensions/openspace-core/src/node/patch-engine.ts` exists
- [ ] `PatchEngine.apply()` increments version and writes file on success
- [ ] `PatchEngine.apply()` throws `ConflictError` on stale baseVersion
- [ ] `PatchEngine.apply()` throws `PatchValidationError` on invalid ops
- [ ] Version map persisted to `{workspaceRoot}/.openspace/patch-versions.json`
- [ ] `POST /files/:path/patch` returns `{ version, bytes }` on success
- [ ] `POST /files/:path/patch` returns HTTP 409 `{ currentVersion }` on conflict
- [ ] `POST /files/:path/patch` returns HTTP 400 on validation error
- [ ] `GET /files/:path/version` returns `{ version }` (bonus)
- [ ] `yarn build` passes (zero TypeScript errors)
- [ ] All unit tests pass (`npm run test:unit` — all pass, including new patch-engine tests)
- [ ] No new dependencies added to package.json (use Node built-ins only)

---

## Build & Test Commands

```bash
# From monorepo root:
yarn build

# Unit tests only:
cd extensions/openspace-core && npm run test:unit

# Or from monorepo root:
yarn test:unit
```

---

## Reference

- Reference implementation: `/Users/Shared/dev/openspace/runtime-hub/src/services/PatchEngine.ts`
- Reference tests: `/Users/Shared/dev/openspace/runtime-hub/src/services/PatchEngine.test.ts`
- Note: Reference uses ESM + ArtifactStore + external deps. Adapt to CJS + direct fs + no external deps.
- Existing hub file: `extensions/openspace-core/src/node/hub.ts`
- Existing hub-mcp file: `extensions/openspace-core/src/node/hub-mcp.ts`
