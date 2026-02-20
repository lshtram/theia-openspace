# Memory Patterns

## Discovered Issues & Solutions

### Session Management UI Patterns (Task 1.11)
- **Dropdown State Management**: Use separate state for dropdown visibility (`showSessionList`) and session data (`sessions`). Click-outside detection via `.closest()` checks if click target is within dropdown container.
- **Active Session Cleanup**: When deleting active session, automatically clear all related state: `_activeSession`, `_messages`, localStorage entry, and fire both `onActiveSessionChanged(undefined)` and `onMessagesChanged([])` events.
- **Event-Driven UI Updates**: Use event subscriptions (`onActiveSessionChanged`, `onMessagesChanged`) to trigger UI re-renders. Store disposables in ref and clean up on unmount.
- **Loading State Management**: Set loading flags before async operations, clear in finally block. Prevents race conditions and enables UI to show loading indicators.

### Documentation Structure Patterns (Task 1.12)
- **Multi-Tier Verification**: Document verification in 3 tiers: (1) Manual endpoint check (curl), (2) Log verification (OpenCode logs), (3) Agent behavior test (ask agent about commands).
- **Troubleshooting by Failure Mode**: Organize troubleshooting by specific error messages (404, connection refused, empty list) with solutions for each.
- **Advanced Configuration Section**: After basic setup, provide advanced scenarios (multiple sources, remote instances, custom ports) for power users.
- **Testing Checklist**: Include concrete checklist with expected outputs (not just "test it works").

## Critical Project Rules (Phase 0)

### Rule 1: Never Modify OpenCode Server Code
- **Scope:** Any files in `/Users/Shared/dev/opencode/` or equivalent
- **Rationale:** OpenCode server is an external dependency; modifications create maintenance burden and may break on updates
- **Enforcement:** Janitor validates this in every validation pass

### Rule 2: Never Modify Theia Core Code
- **Scope:** Any files in `@theia/*` packages in `node_modules/`
- **Rationale:** Theia is a dependency; modifications create forks that are hard to maintain and upgrade
- **Enforcement:** All custom work must use proper Theia extension APIs (ContributionProvider, FilterContribution, etc.)
- **Extension Pattern:** Use `ContainerModule` with inversify for dependency injection

## Architecture Patterns
- Follow NSO BUILD workflow for features
- Follow NSO DEBUG workflow for bugs

## Best Practices
- Keep context files <200 lines
- Update memory at end of every session
- Use exact version pins for @theia/* packages (e.g., "1.68.2" not "^1.68.0")
- Delegate to Scout for research, Builder for implementation, Janitor for validation

## Release Gate: E2E Tests Required Before Push (Added 2026-02-19)

**Rule:** Any commit that touches real functionality (Hub routes, MCP tools, browser extensions, ArtifactStore, PatchEngine, or any production code path) MUST have the full E2E test suite pass before `git push`.

**Command:** `yarn test:e2e`

**Rationale:** Unit tests verify individual units in isolation but cannot catch integration regressions — e.g., the Hub failing to serve the app, MCP tool endpoints returning errors, or browser extension lifecycle failures. E2E tests run Playwright against the real running app and catch these.

**What counts as "real functionality":**
- Any change to `extensions/openspace-core/src/node/` (Hub, MCP server, ArtifactStore, PatchEngine)
- Any change to `extensions/openspace-core/src/browser/` (frontend modules, bridge, sync service)
- Any new MCP tool registration
- Any change to `hub.ts`, `hub-mcp.ts`, `artifact-store.ts`, `patch-engine.ts`
- webpack bundle rebuilds (browser-app)

**What does NOT require E2E (unit tests + build sufficient):**
- Pure type/interface changes
- Documentation updates
- Test file changes only
- `.opencode/` context updates

## Build & Deploy Gotchas (Discovered 2026-02-19)

### CRITICAL: The Server Runs From a Worktree, Not the Main Repo

**The Theia backend (port 3000) runs from `.worktrees/whiteboard-direct-mount/`, NOT from the repo root.**

Verify with: `ps aux | grep main.js`

Expected output shows:
```
node .../theia-openspace/.worktrees/whiteboard-direct-mount/browser-app/lib/backend/main.js --port 3000
```

**Consequence**: Rebuilding in the repo root (`browser-app/build`, `extensions/*/build`) has ZERO effect on the running app. The user will see no change after a hard-reload.

**Rule for every agent**: Before touching ANY build step, run `ps aux | grep main.js` to find which directory the server is serving from. Build there.

**Correct build sequence (targeting the worktree)**:
```bash
yarn --cwd .worktrees/whiteboard-direct-mount/extensions/<ext-name> build
yarn --cwd .worktrees/whiteboard-direct-mount/browser-app build
# Then user does Cmd+Shift+R in browser
```

**How to apply a source fix to the worktree**: The fix must be applied to both the main repo (for git history) and the worktree (for the running server). Check if they differ with `diff extensions/foo/src/... .worktrees/whiteboard-direct-mount/extensions/foo/src/...`.

### Webpack Bundles Are Split Across Chunks

The browser frontend is NOT a single `bundle.js`. Webpack splits it into many chunk files named after their source path. Searching `bundle.js` for a symbol from `extensions/openspace-presentation/` will find nothing.

The presentation widget code lives in:
```
browser-app/lib/frontend/extensions_openspace-presentation_lib_browser_openspace-presentation-frontend-module_js-data_-33a5b6.js
```

**Rule**: After a webpack rebuild, grep the chunk file named after the extension, not `bundle.js`.

## Critical Runtime Patterns (Discovered 2026-02-17)

### Pattern: Circular DI Dependencies in Theia Extensions
- **Problem**: `OpenCodeSyncService → @inject(SessionService) → OpenCodeService → OpenCodeClient → OpenCodeSyncService` creates an infinite loop. InversifyJS deadlocks during resolution.
- **Solution**: Remove `@inject()` from the dependency that creates the cycle. Add a `setXxx()` setter method instead. Wire lazily using `queueMicrotask()` inside the `toDynamicValue()` factory of the other service.
- **Key Insight**: `queueMicrotask` defers execution past the synchronous DI resolution stack, so both singletons exist before wiring.
- **Files**: `opencode-sync-service.ts` (removed `@inject(SessionService)`, added `setSessionService()`), `openspace-core-frontend-module.ts` (added `queueMicrotask` wiring).

### Pattern: Theia RequestService Not Auto-Bound in Backend
- **Problem**: `@theia/request` exports `RequestService` symbol but does NOT auto-bind it. The binding module exists at `@theia/core/lib/node/request/backend-request-module.js` but is only loaded if explicitly imported. Using `@inject(RequestService)` causes InversifyJS to throw "No matching bindings".
- **Solution**: Avoid `RequestService` entirely. Use Node.js built-in `http`/`https` modules for HTTP requests.
- **Files**: `opencode-proxy.ts` (replaced `@inject(RequestService)` with raw `http`/`https` + `rawRequest()` helper).

### Pattern: RPC Proxy Factory Crash on Unknown Methods (Patched)
- **Problem**: `RpcProxyFactory.onNotification` and `onRequest` in Theia core call `this.target[method](...args)` without checking if the method exists. When the backend sends notifications for methods the client doesn't implement, this causes `TypeError` that kills the entire RPC/WebSocket channel.
- **Solution**: Patch `node_modules/@theia/core/lib/common/messaging/proxy-factory.js` with `typeof this.target[method] === 'function'` guard.
- **WARNING**: This patches `node_modules`. Survives `yarn build` (webpack bundles it) but NOT `yarn install`. Must be reapplied after `yarn install`.
- **Violation**: This violates Rule 2 (Never Modify Theia Core Code). A proper long-term fix would be to ensure all RPC client targets implement all expected methods, or contribute the fix upstream to Theia.
- **Files**: `node_modules/@theia/core/lib/common/messaging/proxy-factory.js`

### Pattern: React Imports in Theia Extensions
- **Problem**: Using `import React from 'react'` or `import * as React from 'react'` may bundle a separate React instance, causing hooks to fail.
- **Solution**: Always use `import * as React from '@theia/core/shared/react'` and `import * as ReactDOM from '@theia/core/shared/react-dom'` in Theia extensions. Theia re-exports React through its shared package to ensure a single React instance.

## SDK Type Adoption Patterns (Phase 2B — 2026-02-18)

### Pattern: ESM/CJS Incompatibility in TypeScript Projects
- **Context**: TypeScript CJS projects need to use types from ESM-only npm packages. TypeScript's `import type` does not work with ESM modules when compiling to CJS target.
- **Blocker**: Node.js cannot load ESM modules synchronously in CJS context. TypeScript resolves `import type` statements to ensure type validity, requiring module graph traversal.
- **Solution (Hybrid Approach)**: Extract types from SDK source code to standalone `.d.ts` file with zero imports. This creates a "type bridge" that provides SDK types without ESM/CJS interop issues.
- **Key Technique**: Use npm script to automate type extraction (`npm run extract-sdk-types`). Keep SDK as `devDependency` (never bundle at runtime).
- **Files**: `scripts/extract-sdk-types.js`, `src/common/opencode-sdk-types.ts`

### Pattern: Type Bridge Implementation
- **Problem**: Hand-written types and SDK types have field name mismatches (e.g., `modelId` vs `model`, `type` vs `object`).
- **Solution**: Create intermediate bridge types that map old field names to new SDK types. Allows gradual migration of consumers without breaking changes.
- **Key Insight**: Bridge types provide backward compatibility during transition period. Can be removed once all consumers updated.
- **Files**: `src/common/opencode-protocol.ts` (bridge types), test files (consumer updates)

### Pattern: npm Script for Type Extraction
- **Purpose**: Automate extraction of SDK types when SDK updates are released.
- **Implementation**: Node.js script that reads SDK source files, strips runtime code, preserves type declarations, and writes to single `.d.ts` file.
- **Key Design Decision**: Extract full SDK types (3,380 lines) rather than cherry-picking. Prevents missing dependencies and ensures completeness.
- **Maintenance**: Run `npm run extract-sdk-types` after `npm update @opencode-ai/sdk`.
- **Files**: `scripts/extract-sdk-types.js`, `package.json` (scripts section)

### Gotcha: TypeScript Cannot Import ESM in CJS Target
- **Context**: `tsconfig.json` with `"module": "commonjs"` and ESM-only package in `node_modules`.
- **Symptom**: `import type { X } from 'esm-package'` fails with "ERR_REQUIRE_ESM" or "Module not found".
- **Why**: TypeScript resolves import paths at compile time to validate types. ESM modules require async loading (`import()`), but CJS `require()` is synchronous.
- **Solution**: Do NOT use `import type` from ESM packages. Extract types to standalone file OR use dynamic `import()` for runtime (but not for types).
- **Reference**: Phase 2B decision document (`docs/architecture/DECISION-SDK-ADOPTION.md` v2.0)

### Gotcha: MCP SDK Import Paths — Exports-Map vs Dist Paths (Phase T3)
- **Context**: `@modelcontextprotocol/sdk` v1.26.0 has BOTH ESM and CJS exports with a `package.json` exports map.
- **Symptom**: Using `require('@modelcontextprotocol/sdk/dist/cjs/server/mcp.js')` resolves to `dist/cjs/dist/cjs/server/mcp.js` (double-path) — file not found.
- **Why**: The exports map in `package.json` remaps `./server/mcp.js` → `./dist/cjs/server/mcp.js` automatically. Providing the full `dist/cjs/...` path bypasses the map but doubles the prefix.
- **Correct Paths (exports-map compatible)**:
  ```ts
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
  const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
  ```
- **Wrong Paths (double-resolve)**: `require('@modelcontextprotocol/sdk/dist/cjs/server/mcp.js')` ❌
- **Tool signature**: `mcp.tool(name, description, zodShape, callback)` — description is a plain string, NOT part of zodShape.
- **Stateless transport**: `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` (one transport per request).
- **Reference**: Phase T3 implementation (`extensions/openspace-core/src/node/hub-mcp.ts`)

