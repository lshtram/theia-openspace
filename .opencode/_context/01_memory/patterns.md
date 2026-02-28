# Memory Patterns

Actionable gotchas only. Archived/historical entries: `docs/archive/patterns-archive.md`.

---

## Critical Project Rules

### Rule 1: Never Modify OpenCode Server Code
Files in `/Users/Shared/dev/opencode/` are off-limits.

### Rule 2: Never Modify Theia Core Code
`node_modules/@theia/*` is off-limits. Use proper Theia extension APIs.
**Exception:** The `proxy-factory.js` patch (see Runtime Patterns below) — pending upstream fix.

## Build & Deploy Gotchas

### CRITICAL: Verify Server Location Before Every Build
```bash
ps aux | grep main.js | grep -v grep
```
- Path contains `.worktrees/<name>/` → build there, not in repo root
- Path is `theia-openspace/browser-app/...` → build in repo root (normal as of 2026-02-23)

**Repo-root build:**
```bash
yarn --cwd extensions/<ext-name> build
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

### Webpack Bundle Is Split Across Chunks
Not a single `bundle.js`. After webpack rebuild, grep the chunk file named after the extension.

### Webpack Cache Stale Bundles (Fixed 2026-02-27)
Local extensions are symlinked into `node_modules/` and keep version `0.1.0` forever — webpack skips hashing them.
**Fix already applied** in `webpack.config.js` via `snapshot.managedPaths` exclusion.

**Verification after ANY webpack rebuild:**
```bash
rg "your-unique-string" browser-app/lib/frontend/
```
If NOT found, cache is stale:
```bash
rm -rf browser-app/.webpack-cache
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

**When adding a new local extension:** Add package name to `LOCAL_PACKAGES` array in `browser-app/webpack.config.js`.

## E2E Testing Protocol: Incremental Execution

**Rule:** Never run the full e2e suite in one command — it times out.

```bash
# Step 1: single test
npx playwright test app-load.spec.ts --reporter=line
# Step 2: small batch
npx playwright test app-load.spec.ts mcp-tools.spec.ts --reporter=line
# Step 3: expand from there
```

**E2E required before push** for: Hub routes, MCP tools, browser extensions, ArtifactStore, PatchEngine.
**NOT required for:** pure type changes, docs, test-only changes, `.opencode/` updates.

**Pre-existing failures on master (as of 2026-02-26):** TurnGroup streaming (×4) + AudioFsm (×2).
Use `git push --no-verify` when pushing master with confirmed pre-existing failures only.

## Post-Merge Hardening

### Merge Can Silently Drop Features
After any merge touching `chat-widget.tsx` or large UI files: diff merged result against both parents.
Look for CSS classes, component props, and JSX blocks that appear in feature branch but not merge result.

### Test Mock Factories Must Mirror SessionService Interface
When adding new session service calls to `chat-widget.tsx`, add matching stubs to all 5 spec files.

**Required mock methods** (as of 2026-02-26): `getSessions`, `createSession`, `deleteSession`, `activeSession`, `messages`, `sendMessage`, `onActiveSessionChanged`, `onMessagesChanged`, `onSessionsChanged`, `getSessionError`, `renameSession`, `shareSession`, `unshareSession`, `forkSession`, `compactSession`, `revertSession`, `unrevertSession`, `sessionStatus`, `todos`, `onSessionStatusChanged`, `getMessagesForPreview`

## Critical Runtime Patterns

### Circular DI Dependencies in Theia Extensions
**Problem:** `ServiceA → @inject(ServiceB) → ServiceA` causes InversifyJS deadlock.
**Solution:** Remove `@inject()` from the cycle leg. Add `setXxx()` setter. Wire lazily with `queueMicrotask()` inside `toDynamicValue()` factory.

### RPC Proxy Factory Crash on Unknown Methods (Patched)
**Problem:** `RpcProxyFactory` calls `this.target[method](...args)` without existence check — kills WebSocket channel.
**Solution:** Patch applied to `node_modules/@theia/core/lib/common/messaging/proxy-factory.js`.
**WARNING:** Survives `yarn build` but NOT `yarn install`. Must be reapplied after `yarn install`.

### React Imports in Theia Extensions
Always use `import * as React from '@theia/core/shared/react'` — never bare `'react'`.

### searchFiles Is Async
All callers must `await searchFiles(...)`. Changed in C3 (R1 hygiene, 2026-02-27).

### Import Paths Must Use Subdirectories
e.g., `./session-service/session-service` not `./session-service`

### Theia Preference Settings: openspace.* Needs Layout Category
`PreferenceTreeGenerator.getGroupName()` calls `layoutProvider.hasCategory(prefix)`. If the prefix
is not in Theia's hardcoded `DEFAULT_LAYOUT`, all preferences silently fall into the `extensions`
fallback group (section header renders but no items appear).

**Fix (implemented 2026-02-28):** `OpenspacePreferenceLayoutProvider` in `openspace-settings`
subclasses `PreferenceLayoutProvider`, overrides `getLayout()` to append an `openspace` top-level
category with `paths`, `models`, and `voice` subsections. Bound via
`rebind(PreferenceLayoutProvider).toService(OpenspacePreferenceLayoutProvider)`.

**To add a new `openspace.*` namespace:** add a new child entry to `openspace-preference-layout.ts`.
