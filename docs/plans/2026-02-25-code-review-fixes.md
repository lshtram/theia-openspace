# Code Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all valid findings from the 2026-02-24 code review — spanning type safety, test reliability, code duplication, URL validation, and observability — without changing any runtime behaviour.

**Architecture:** All changes are confined to `extensions/openspace-core/` and `extensions/openspace-presentation/` / `extensions/openspace-whiteboard/`. No Theia core or OpenCode server modifications. Every task with a runtime-visible change gets a failing test written first (TDD).

**Branch:** `bug/code-review-fixes` (worktree at `.worktrees/bug-fixes/`)

**Tech Stack:** TypeScript 5.4, Jest (unit), Sinon (stubs), Playwright (e2e — not used here)

**Build command:** `yarn --cwd .worktrees/bug-fixes build` (or `yarn workspace openspace-core compile`)

**Test command (unit):** `yarn --cwd .worktrees/bug-fixes test --testPathPattern="<spec>"` — run one spec at a time per AGENTS.md Rule 4.

---

## Issues addressed (in execution order)

| # | Issue | Type | TDD? |
|---|---|---|---|
| 1 | Extract shared `resolveSafePath` (Issue 10) | Refactor | No (pure refactor, existing tests cover it) |
| 2 | Validate `OPENCODE_SERVER_URL` at startup (Issue 20) | Bug | Yes |
| 3 | Improve `IMcpServer` + `registerVoiceTools` types (Issue 5) | Type safety | No (compile-time only) |
| 4 | Surface session restore failure to user (Issue 9) | UX | Yes |
| 5 | Replace `setTimeout` delays with fake timers in tests (Issue 15) | Test reliability | N/A (test-only) |
| 6 | Add comment explaining `_projectId` unused params (Issue 18) | Docs | No |
| 7 | Fix import grouping in `hub-mcp.ts` (Issue 16) | Style | No |
| 8 | Add magic-string constants for tool names (Issue 17) | Style/safety | No |
| 9 | Add JSDoc to `OpenCodeProxy.requestJson()` and `.rawRequest()` (Issue 12) | Docs | No |
| 10 | Standardise logging format for I/O operations (Issue 6) | Observability | No |
| 11 | Harden CORS allowed-origins config (Issue 8) | Config | No |
| 12 | Add rate limiting to Hub endpoints (Issue 7) | Security | Yes |

**Issues explicitly NOT addressed:**
- Issue 3 (SSE leak): **False positive** — cleanup is already correct.
- Issue 4 (MCP resolveSafePath): **False positive** — all call sites already have try/catch.
- Issue 13 (PatchEngine blocking): **False positive** — all I/O is async; `realpathSync` is intentional stat-only.
- Issue 19 (manual test): **False positive** — file does not exist.
- Issue 21 (TypeScript upgrade): deferred to Phase 6 as planned.
- Issue 2 (E2E infrastructure): separate dedicated work item.
- Issue 11 (magic string file extensions): deferred — changing shared constants across presentation/whiteboard requires broader coordination.
- Issue 14 (patch-engine error-path tests): separate enhancement.

---

## Task 1: Extract shared `resolveSafePath` utility (Issue 10)

**Why first:** Tasks 2 and 3 both touch `hub-mcp.ts`; cleaner to consolidate the duplicated function first so subsequent diffs are minimal.

**Files:**
- Create: `extensions/openspace-core/src/node/path-utils.ts`
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts` (remove private method, import shared one)
- Modify: `extensions/openspace-core/src/node/patch-engine.ts` (same)

**Context:** `hub-mcp.ts:819–843` and `patch-engine.ts:348–381` contain near-identical implementations. The only difference is the error thrown:
- `hub-mcp.ts` throws `new Error('Path traversal detected: ...')`
- `patch-engine.ts` throws `new PatchValidationError('PATH_TRAVERSAL', 'filePath', ..., ...)`

**Design decision:** The shared function should throw a plain `Error` (the lowest common denominator). `PatchEngine.resolveSafePath` wraps it to re-throw as `PatchValidationError` — preserving existing behaviour for callers that catch specifically on `PatchValidationError`.

**Step 1: Create `path-utils.ts`**

```typescript
// extensions/openspace-core/src/node/path-utils.ts
import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolve `filePath` relative to `workspaceRoot`, ensuring the resolved path
 * stays within the workspace (prevents path traversal and symlink escape).
 *
 * Uses `fs.realpathSync` to resolve symlinks before the containment check.
 * For paths that do not yet exist, the nearest existing parent is resolved.
 *
 * @throws {Error} if the resolved path escapes the workspace root.
 */
export function resolveSafePath(workspaceRoot: string, filePath: string): string {
    const resolved = path.resolve(workspaceRoot, filePath);

    let realRoot: string;
    try {
        realRoot = fs.realpathSync(workspaceRoot);
    } catch {
        realRoot = workspaceRoot;
    }

    let realResolved: string;
    try {
        realResolved = fs.realpathSync(resolved);
    } catch {
        try {
            realResolved = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
        } catch {
            realResolved = resolved;
        }
    }

    const rootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (!realResolved.startsWith(rootWithSep) && realResolved !== realRoot) {
        throw new Error(`Path traversal detected: "${filePath}" resolves outside workspace root`);
    }
    return realResolved;
}
```

**Step 2: Update `hub-mcp.ts`**

Add import at line 24 (after the existing relative imports):
```typescript
import { resolveSafePath } from './path-utils';
```

Delete the private `resolveSafePath(filePath: string): string` method (lines 819–843).

Change all 7 call sites from `this.resolveSafePath(...)` to `resolveSafePath(this.workspaceRoot, ...)`.

**Step 3: Update `patch-engine.ts`**

Add import (after existing relative imports):
```typescript
import { resolveSafePath as resolveSafePathUtil } from './path-utils';
```

Replace the private `resolveSafePath` body with a thin wrapper:
```typescript
private resolveSafePath(filePath: string): string {
    try {
        return resolveSafePathUtil(this.workspaceRoot, filePath);
    } catch (err) {
        throw new PatchValidationError(
            'PATH_TRAVERSAL',
            'filePath',
            (err as Error).message,
            'Provide a relative path within the workspace (no ../ segments)'
        );
    }
}
```

**Step 4: Verify existing tests still pass**

Run: `yarn workspace openspace-core test --testPathPattern="patch-engine"`
Expected: all green (no behaviour change).

Run: `yarn workspace openspace-core test --testPathPattern="hub-mcp"`
Expected: all green.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/path-utils.ts \
        extensions/openspace-core/src/node/hub-mcp.ts \
        extensions/openspace-core/src/node/patch-engine.ts
git commit -m "refactor: extract shared resolveSafePath into path-utils.ts (Issue 10)"
```

---

## Task 2: Validate `OPENCODE_SERVER_URL` at startup (Issue 20)

**Context:** `openspace-core-backend-module.ts:8` reads `process.env.OPENCODE_SERVER_URL` and uses it as-is. If the value is malformed (e.g. `"localhost:7890"` without a protocol), `new URL(endpoint, this.serverUrl)` in `opencode-proxy.ts:150` throws on every API call with a cryptic "Invalid URL" message. Validation should happen at startup so the error is clear and immediate.

**Files:**
- Modify: `extensions/openspace-core/src/node/openspace-core-backend-module.ts`
- Test: `extensions/openspace-core/src/node/__tests__/openspace-core-backend-module.spec.ts` (create)

**Step 1: Write the failing test**

```typescript
// extensions/openspace-core/src/node/__tests__/openspace-core-backend-module.spec.ts
import { expect } from 'chai';
import { validateOpenCodeServerUrl } from '../openspace-core-backend-module';

describe('validateOpenCodeServerUrl', () => {
    it('accepts a well-formed http URL', () => {
        expect(() => validateOpenCodeServerUrl('http://localhost:7890')).not.to.throw();
    });

    it('accepts a well-formed https URL', () => {
        expect(() => validateOpenCodeServerUrl('https://myserver.internal:443')).not.to.throw();
    });

    it('throws for a URL missing a protocol', () => {
        expect(() => validateOpenCodeServerUrl('localhost:7890'))
            .to.throw(/OPENCODE_SERVER_URL.*invalid.*URL/i);
    });

    it('throws for an empty string', () => {
        expect(() => validateOpenCodeServerUrl(''))
            .to.throw(/OPENCODE_SERVER_URL.*invalid.*URL/i);
    });

    it('throws for an arbitrary non-URL string', () => {
        expect(() => validateOpenCodeServerUrl('not-a-url'))
            .to.throw(/OPENCODE_SERVER_URL.*invalid.*URL/i);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn workspace openspace-core test --testPathPattern="openspace-core-backend-module"`
Expected: FAIL — `validateOpenCodeServerUrl is not a function` (not exported yet).

**Step 3: Implement `validateOpenCodeServerUrl` and call it at startup**

In `openspace-core-backend-module.ts`, add an exported validation function and call it when the constant is read:

```typescript
/**
 * Validate that a URL string is well-formed. Called at server startup so that
 * a malformed OPENCODE_SERVER_URL produces a clear error immediately rather than
 * cryptic "Invalid URL" errors on every API call.
 *
 * @throws if the string is not a valid http/https URL.
 */
export function validateOpenCodeServerUrl(url: string): void {
    try {
        new URL(url);
    } catch {
        throw new Error(
            `OPENCODE_SERVER_URL is an invalid URL: "${url}". ` +
            `Expected a well-formed http or https URL (e.g. http://localhost:7890).`
        );
    }
}

const rawUrl = process.env.OPENCODE_SERVER_URL || 'http://localhost:7890';
validateOpenCodeServerUrl(rawUrl);
const DEFAULT_OPENCODE_URL = rawUrl;
```

**Step 4: Run test to verify it passes**

Run: `yarn workspace openspace-core test --testPathPattern="openspace-core-backend-module"`
Expected: 5 passing.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/openspace-core-backend-module.ts \
        extensions/openspace-core/src/node/__tests__/openspace-core-backend-module.spec.ts
git commit -m "fix: validate OPENCODE_SERVER_URL format at startup (Issue 20)"
```

---

## Task 3: Improve `IMcpServer` and `registerVoiceTools` types (Issue 5)

**Context:** `IMcpServer` interface in `hub-mcp.ts:34–37` uses `(args: any)` in the tool handler signature. `registerVoiceTools(server: any)` at line 945 accepts an untyped server. Both should use `IMcpServer`.

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`

**Note:** This is compile-time only — no runtime behaviour changes, no new test needed.

**Step 1: Tighten `IMcpServer` handler type**

The handler receives a Zod-validated args object. The MCP SDK types these as `Record<string, unknown>` post-validation. Update the interface:

```typescript
/** Minimal structural type for McpServer (loaded via require). */
interface IMcpServer {
    tool(
        name: string,
        description: string,
        schema: unknown,
        handler: (args: Record<string, unknown>) => Promise<unknown>
    ): void;
    connect(transport: unknown): Promise<void>;
}
```

**Step 2: Update `registerVoiceTools` signature**

Change line 945:
```typescript
// Before:
private registerVoiceTools(server: any): void {

// After:
private registerVoiceTools(server: IMcpServer): void {
```

**Step 3: Update inline `async (args: any)` in `registerVoiceTools`**

Change line 960:
```typescript
// Before:
async (args: any) => this.executeViaBridge('openspace.voice.set_policy', args)

// After:
async (args: Record<string, unknown>) => this.executeViaBridge('openspace.voice.set_policy', args)
```

**Step 4: Verify compilation**

Run: `yarn workspace openspace-core compile`
Expected: zero TypeScript errors.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "fix: replace any types in IMcpServer interface and registerVoiceTools (Issue 5)"
```

---

## Task 4: Surface session restore failure to user (Issue 9)

**Context:** When `setActiveSession` fails in `session-service.ts:init()` (line 384–391), the failure is logged but the user sees nothing. The IDE starts normally, then behaves unexpectedly when the user interacts with a session that was not restored. We should show a Theia notification with an actionable message.

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts`
- Test: `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts` (add test case)

**Step 1: Understand the injection pattern**

`SessionServiceImpl` currently injects only `OpenCodeService` and `ILogger`. We need to add `MessageService` from `@theia/core/lib/common/message-service`.

The class uses property injection (`@inject` decorators), no explicit constructor.

**Step 2: Write the failing test**

In `session-service.spec.ts`, add to the "session restore" describe block:

```typescript
it('notifies the user when session restore fails', async () => {
    // Arrange: setActiveSession rejects
    mockOpenCodeService.setActiveSession = sinon.stub().rejects(new Error('Session not found'));

    // Create a mock MessageService
    const mockMessageService = {
        warn: sinon.stub().resolves()
    };
    // Inject it into the service
    (sessionService as any).messageService = mockMessageService;

    // Act: trigger init()
    (sessionService as any).init();
    await new Promise(r => setTimeout(r, 50));

    // Assert: user was notified
    expect(mockMessageService.warn.calledOnce).to.be.true;
    expect(mockMessageService.warn.firstCall.args[0]).to.match(
        /session.*could not be restored/i
    );
});
```

**Step 3: Run test to verify it fails**

Run: `yarn workspace openspace-core test --testPathPattern="session-service"`
Expected: FAIL — `mockMessageService.warn` not called.

**Step 4: Add `MessageService` injection to `session-service.ts`**

Add import:
```typescript
import { MessageService } from '@theia/core/lib/common/message-service';
```

Add `@inject` property:
```typescript
@inject(MessageService)
protected readonly messageService!: MessageService;
```

**Step 5: Call `messageService.warn` on session restore failure**

In `init()`, update the catch block at line 387–391:

```typescript
} catch (err) {
    this.logger.warn('[SessionService] Failed to restore session:', err);
    // Persisted session may be stale (deleted in backend).
    window.localStorage.removeItem('openspace.activeSessionId');
    // Notify the user — they may need to start a new session manually.
    this.messageService.warn(
        'Previous session could not be restored. You may need to start a new session.',
        'OK'
    ).catch(() => { /* ignore notification errors */ });
}
```

**Step 6: Update the DI binding if needed**

Check `openspace-core-frontend-module.ts` — `MessageService` is typically bound by Theia core automatically and does not need an explicit binding. Verify by compiling.

**Step 7: Run test to verify it passes**

Run: `yarn workspace openspace-core test --testPathPattern="session-service"`
Expected: new test passes; all existing tests still pass.

**Step 8: Compile to verify TypeScript**

Run: `yarn workspace openspace-core compile`
Expected: zero errors.

**Step 9: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
git commit -m "fix: notify user when session restore fails on startup (Issue 9)"
```

---

## Task 5: Replace `setTimeout` delays with fake timers (Issue 15)

**Context:** `session-service.spec.ts` has five `await new Promise(r => setTimeout(r, N))` calls that make tests time-dependent. Three patterns:
1. **Lines 397, 405** — yield to let fire-and-forget `init()` advance (50ms). Fix: use `sinon.useFakeTimers()` + `clock.tickAsync(0)` to drain the microtask queue.
2. **Lines 454, 464** — wait for `STREAMING_DONE_DELAY_MS = 500` to expire (600ms). Fix: use `sinon.useFakeTimers()` + `clock.tickAsync(600)`.
3. **Line 295** — simulates a slow `getSessions` stub (100ms). Fix: replace with a stub that resolves on next tick instead of after 100ms.

**Files:**
- Modify: `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`

**This task is test-only — no production code changes, no new tests needed. Verify by running the full spec before and after to confirm same pass/fail outcome.**

**Step 1: Add a `sinon.useFakeTimers()` sandbox to the relevant describe blocks**

For lines 393–410 (hub-restore tests):

```typescript
describe('session restore on init', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it('restores session when hub is ready', async () => {
        waitForHubStub.resolves();
        (sessionService as any).init();
        await clock.tickAsync(0);   // drain microtask queue
        expect(waitForHubStub.calledOnce).to.be.true;
        expect(sessionService.activeSession?.id).to.equal('session-1');
    });

    it('skips session restore and logs warning when hub is not ready', async () => {
        waitForHubStub.rejects(new Error('Hub not ready after 20 attempts'));
        (sessionService as any).init();
        await clock.tickAsync(0);
        // ... existing assertions
    });
});
```

**Step 2: Fix the streaming hysteresis tests (lines 449–467)**

```typescript
describe('streaming hysteresis', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it('fires isStreaming=false after hysteresis window', async () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        service.updateStreamingMessage('msg1', '', true);
        await clock.tickAsync(600);   // advance 600ms without real wall time
        expect(service.isStreaming).to.equal(false);
    });

    it('cancels hysteresis timer when new streaming activity arrives', async () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        service.updateStreamingMessage('msg1', '', true);
        service.updateStreamingMessage('msg2', 'world', false);
        await clock.tickAsync(600);
        expect(service.isStreaming).to.equal(true);
    });
});
```

**Step 3: Fix the concurrency test (line 295)**

Replace the `100ms` fake delay stub with a next-tick yield:
```typescript
mockOpenCodeService.getSessions.callsFake(async () => {
    await Promise.resolve();   // yield one tick — no wall-clock delay
    slowGetSessions();
    return [mockSession];
});
```

**Step 4: Verify the tests pass**

Run: `yarn workspace openspace-core test --testPathPattern="session-service"`
Expected: all tests pass; elapsed test time reduced significantly.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
git commit -m "test: replace setTimeout delays with fake timers in session-service.spec (Issue 15)"
```

---

## Task 6: Document `_projectId` unused parameters (Issue 18)

**Context:** `opencode-proxy.ts` has ~8 methods with `_projectId: string` that is never used. The underscore convention signals intent, but a comment explains *why* for future maintainers.

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts`

**Step 1: Add a block comment before the first `_projectId` method**

Locate `getSessions` (line 301). Add one comment immediately above the Session Methods section header:

```typescript
// =========================================================================
// Session Methods
//
// Note: _projectId parameters are present for interface consistency with
// OpenCodeService. The OpenCode API is project-agnostic (sessions are
// global, not scoped per project), so the parameter is intentionally
// unused. The underscore prefix is the TypeScript convention for this.
// =========================================================================
```

This one comment covers all session/project methods in the section — no need to repeat on every method.

**Step 2: Verify compilation**

Run: `yarn workspace openspace-core compile`

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy.ts
git commit -m "docs: explain _projectId unused parameter convention (Issue 18)"
```

---

## Task 7: Fix import grouping in `hub-mcp.ts` (Issue 16)

**Context:** The imports in `hub-mcp.ts` lines 17–24 mix external packages and internal/relative imports without a blank line separator between groups 2 and 3, violating `CODING_STANDARDS.md §2`.

Current state:
```typescript
import { Application, Request, Response } from 'express';    // external
import * as path from 'path';                                 // external
import * as fs from 'fs';                                     // external
import { z } from 'zod';                                      // external
import { AgentCommand } from '../common/command-manifest';    // internal (common)
import { isSensitiveFile } from '../common/sensitive-files';  // internal (common)
import { ArtifactStore } from './artifact-store';             // relative (node-local)
import { PatchEngine } from './patch-engine';                 // relative (node-local)
```

The fix adds a blank line between the `../common/` imports (group 2) and the `./` imports (group 3). Also add import for `path-utils.ts` added in Task 1.

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`

**Step 1: Update imports section (lines 17–24)**

```typescript
import { Application, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { z } from 'zod';

import { AgentCommand } from '../common/command-manifest';
import { isSensitiveFile } from '../common/sensitive-files';

import { ArtifactStore } from './artifact-store';
import { PatchEngine } from './patch-engine';
import { resolveSafePath } from './path-utils';
```

**Step 2: Compile to verify**

Run: `yarn workspace openspace-core compile`

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "style: fix import grouping in hub-mcp.ts (Issue 16)"
```

---

## Task 8: Extract magic-string tool names to constants (Issue 17)

**Context:** Tool name strings like `"openspace.pane.open"` and `"openspace.file.read"` appear in both tool registrations and error messages in `hub-mcp.ts`. Extracting them to constants makes renaming safe.

**Files:**
- Create: `extensions/openspace-core/src/common/tool-names.ts`
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`

**Step 1: Identify all tool name strings**

From `hub-mcp.ts`, the complete list of tool names registered (from the `registerXxxTools` methods):

```
openspace.pane.open, openspace.pane.close, openspace.pane.focus, openspace.pane.list
openspace.editor.open, openspace.editor.read_file, openspace.editor.close,
openspace.editor.scroll_to, openspace.editor.highlight, openspace.editor.clear_highlight
openspace.terminal.create, openspace.terminal.send, openspace.terminal.read_output,
openspace.terminal.list, openspace.terminal.close
openspace.file.read, openspace.file.write, openspace.file.list,
openspace.file.search, openspace.file.patch
openspace.artifact.getVersion, openspace.artifact.patch
openspace.presentation.create, openspace.presentation.list,
openspace.presentation.open, openspace.presentation.close,
openspace.presentation.get_content, openspace.presentation.update_content,
openspace.presentation.navigate
openspace.whiteboard.create, openspace.whiteboard.list,
openspace.whiteboard.open, openspace.whiteboard.close,
openspace.whiteboard.get_content, openspace.whiteboard.update_content
voice.set_policy
```

**Step 2: Create `tool-names.ts`**

```typescript
// extensions/openspace-core/src/common/tool-names.ts

/** Canonical tool name constants used in MCP tool registration and bridge dispatch. */
export const TOOL = {
    PANE_OPEN:                  'openspace.pane.open',
    PANE_CLOSE:                 'openspace.pane.close',
    PANE_FOCUS:                 'openspace.pane.focus',
    PANE_LIST:                  'openspace.pane.list',

    EDITOR_OPEN:                'openspace.editor.open',
    EDITOR_READ_FILE:           'openspace.editor.read_file',
    EDITOR_CLOSE:               'openspace.editor.close',
    EDITOR_SCROLL_TO:           'openspace.editor.scroll_to',
    EDITOR_HIGHLIGHT:           'openspace.editor.highlight',
    EDITOR_CLEAR_HIGHLIGHT:     'openspace.editor.clear_highlight',

    TERMINAL_CREATE:            'openspace.terminal.create',
    TERMINAL_SEND:              'openspace.terminal.send',
    TERMINAL_READ_OUTPUT:       'openspace.terminal.read_output',
    TERMINAL_LIST:              'openspace.terminal.list',
    TERMINAL_CLOSE:             'openspace.terminal.close',

    FILE_READ:                  'openspace.file.read',
    FILE_WRITE:                 'openspace.file.write',
    FILE_LIST:                  'openspace.file.list',
    FILE_SEARCH:                'openspace.file.search',
    FILE_PATCH:                 'openspace.file.patch',

    ARTIFACT_GET_VERSION:       'openspace.artifact.getVersion',
    ARTIFACT_PATCH:             'openspace.artifact.patch',

    PRESENTATION_CREATE:        'openspace.presentation.create',
    PRESENTATION_LIST:          'openspace.presentation.list',
    PRESENTATION_OPEN:          'openspace.presentation.open',
    PRESENTATION_CLOSE:         'openspace.presentation.close',
    PRESENTATION_GET_CONTENT:   'openspace.presentation.get_content',
    PRESENTATION_UPDATE_CONTENT:'openspace.presentation.update_content',
    PRESENTATION_NAVIGATE:      'openspace.presentation.navigate',

    WHITEBOARD_CREATE:          'openspace.whiteboard.create',
    WHITEBOARD_LIST:            'openspace.whiteboard.list',
    WHITEBOARD_OPEN:            'openspace.whiteboard.open',
    WHITEBOARD_CLOSE:           'openspace.whiteboard.close',
    WHITEBOARD_GET_CONTENT:     'openspace.whiteboard.get_content',
    WHITEBOARD_UPDATE_CONTENT:  'openspace.whiteboard.update_content',

    VOICE_SET_POLICY:           'voice.set_policy',
} as const;
```

**Step 3: Update `hub-mcp.ts`**

Add import:
```typescript
import { TOOL } from '../common/tool-names';
```

Replace each string literal in `registerXxxTools` calls and `executeViaBridge` calls with the corresponding `TOOL.XXX` constant. For example:
```typescript
// Before
server.tool('openspace.pane.open', ...

// After
server.tool(TOOL.PANE_OPEN, ...
```

**Step 4: Compile to verify**

Run: `yarn workspace openspace-core compile`
Expected: zero errors.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/common/tool-names.ts \
        extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "refactor: extract MCP tool name magic strings to TOOL constants (Issue 17)"
```

---

## Task 9: Add JSDoc to `OpenCodeProxy.requestJson()` and `.rawRequest()` (Issue 12)

**Context:** These two methods are part of the public surface of `OpenCodeProxy` but lack documentation.

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts`

**Step 1: Locate the methods**

Search for `requestJson` and `rawRequest` in `opencode-proxy.ts`. They are private helpers used by `get()` and `post()`.

**Step 2: Add JSDoc**

```typescript
/**
 * Make a JSON-body HTTP request to the OpenCode server.
 *
 * @param method  - HTTP method (GET, POST, DELETE, etc.)
 * @param endpoint - Path relative to serverUrl (e.g. `/session`)
 * @param body    - Optional request body (will be JSON-serialised)
 * @param query   - Optional query string parameters
 * @returns       Parsed JSON response body typed as T
 * @throws        On non-2xx responses or network errors
 */
private async requestJson<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    query?: Record<string, string | undefined>
): Promise<T> {
```

```typescript
/**
 * Make a raw HTTP request to the OpenCode server, returning the response
 * object without parsing the body.
 *
 * Used by streaming endpoints (SSE) that need to consume the response
 * stream directly rather than via JSON parsing.
 *
 * @param method   - HTTP method
 * @param endpoint - Path relative to serverUrl
 * @param headers  - Additional request headers
 * @returns        Node.js `http.IncomingMessage` response stream
 * @throws         On request-level errors (DNS, connection refused, etc.)
 */
private rawRequest(
    method: string,
    endpoint: string,
    headers?: Record<string, string>
): Promise<http.IncomingMessage> {
```

(Adjust to match actual signatures found in the file.)

**Step 3: Compile to verify**

Run: `yarn workspace openspace-core compile`

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy.ts
git commit -m "docs: add JSDoc to OpenCodeProxy requestJson and rawRequest (Issue 12)"
```

---

## Task 10: Standardise I/O logging format (Issue 6)

**Context:** `CODING_STANDARDS.md §3` requires `console.log` with ISO timestamp for external I/O (fetch, file, API). The codebase uses `this.logger.info/debug/warn/error` throughout, which lacks timestamps. The fix is scoped to I/O entry/success/failure points in the three affected files, not replacing all logger calls.

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts`
- Modify: `extensions/openspace-core/src/node/hub.ts`
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`

**Design note:** This is observability-only. Do not replace logger calls for non-I/O events (startup messages, state changes). Only add `[ISO-TIMESTAMP] FETCH_START / FETCH_SUCCESS / FETCH_FAIL` style logs at the I/O boundary points.

**Step 1: `opencode-proxy.ts` — HTTP request method**

In `requestJson()` (or equivalent HTTP helper), add:
```typescript
const ts = () => new Date().toISOString();
console.log(`[${ts()}] FETCH_START: ${method} ${url}`);
try {
    const result = await /* existing fetch logic */;
    console.log(`[${ts()}] FETCH_SUCCESS: ${method} ${url} (${result.statusCode})`);
    return result;
} catch (err) {
    console.error(`[${ts()}] FETCH_FAIL: ${method} ${url}`, err);
    throw err;
}
```

**Step 2: `hub.ts` — manifest fetch**

Find any `fetch()`/`http.request()` calls in hub.ts and wrap similarly.

**Step 3: `hub-mcp.ts` — file I/O in file tools**

The file tools (read, write, list, search, patch) perform file I/O. Add FETCH_START / FETCH_SUCCESS / FETCH_FAIL around the `fs.promises.*` calls in the tool handlers.

**Step 4: Compile and verify**

Run: `yarn workspace openspace-core compile`

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-core/src/node/hub.ts \
        extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "observability: add ISO-timestamp I/O logging per CODING_STANDARDS §3 (Issue 6)"
```

---

## Task 11: Harden CORS allowed-origins configuration (Issue 8)

**Context:** `hub.ts:49–60` hardcodes 12 origins (ports 3000–3005 on localhost and 127.0.0.1). The `OPENSPACE_HUB_ORIGINS` env var can *add* origins but cannot *remove* the hardcoded defaults. The fix reads the Theia server's actual bind port at startup and uses only that port plus the env var overrides — eliminating the 5 extra hardcoded ports.

**Note on scope:** This is a configuration improvement, not a security regression. The current behaviour is that ports 3001–3005 are always allowed even when the server is only on 3000. The fix narrows the default allowlist.

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts`

**Step 1: Identify how to get the actual Theia port**

The `OpenSpaceHub` class is a `BackendApplicationContribution`. It has access to the `BackendApplication` port via environment variable `PORT` (set by Theia's backend app runner) or by inspecting the server. The simplest approach: read `process.env.PORT || '3000'` at construction time.

**Step 2: Update `allowedOrigins` initializer**

```typescript
private readonly allowedOrigins: string[] = (() => {
    const theiaPort = process.env['PORT'] || '3000';
    const defaults = [
        `http://localhost:${theiaPort}`,
        `http://127.0.0.1:${theiaPort}`,
    ];
    const envOrigins = process.env['OPENSPACE_HUB_ORIGINS'];
    if (!envOrigins) { return defaults; }
    const extra = envOrigins.split(',').map(s => s.trim()).filter(Boolean);
    return [...new Set([...defaults, ...extra])];
})();
```

**Step 3: Compile and verify**

Run: `yarn workspace openspace-core compile`

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/hub.ts
git commit -m "fix: derive CORS allowed origins from actual Theia port (Issue 8)"
```

---

## Task 12: Add rate limiting to Hub endpoints (Issue 7)

**Context:** `hub.ts` has no rate limiting. A compromised or buggy browser tab could flood the Hub. A simple in-process token bucket at 200 req/s per IP is sufficient for a localhost-only server.

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts`
- Test: `extensions/openspace-core/src/node/__tests__/hub-rate-limiting.spec.ts` (create)

**Design:** Implement a simple sliding-window counter — no external dependency needed. Track `{ count, windowStart }` per IP in a `Map`. Reset the window every second. If `count > MAX_REQUESTS_PER_SECOND`, return HTTP 429. Also schedule a periodic cleanup of the map to avoid unbounded growth.

**Step 1: Write the failing test**

```typescript
// extensions/openspace-core/src/node/__tests__/hub-rate-limiting.spec.ts
import { expect } from 'chai';
import * as sinon from 'sinon';
import { RateLimiter } from '../hub';  // will export this class

describe('RateLimiter', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it('allows requests within the limit', () => {
        const limiter = new RateLimiter(5); // 5 req/s
        for (let i = 0; i < 5; i++) {
            expect(limiter.isAllowed('127.0.0.1')).to.be.true;
        }
    });

    it('blocks the request that exceeds the limit', () => {
        const limiter = new RateLimiter(5);
        for (let i = 0; i < 5; i++) { limiter.isAllowed('127.0.0.1'); }
        expect(limiter.isAllowed('127.0.0.1')).to.be.false;
    });

    it('resets the window after 1 second', () => {
        const limiter = new RateLimiter(5);
        for (let i = 0; i < 5; i++) { limiter.isAllowed('127.0.0.1'); }
        clock.tick(1001);  // advance past 1 second window
        expect(limiter.isAllowed('127.0.0.1')).to.be.true;
    });

    it('does not affect different IPs', () => {
        const limiter = new RateLimiter(5);
        for (let i = 0; i < 5; i++) { limiter.isAllowed('127.0.0.1'); }
        expect(limiter.isAllowed('192.168.1.1')).to.be.true;
    });

    it('cleans up stale entries', () => {
        const limiter = new RateLimiter(5);
        limiter.isAllowed('127.0.0.1');
        clock.tick(61_000);  // advance past cleanup interval (60s)
        limiter.cleanup();
        expect((limiter as any).counters.size).to.equal(0);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn workspace openspace-core test --testPathPattern="hub-rate-limiting"`
Expected: FAIL — `RateLimiter is not exported`.

**Step 3: Implement `RateLimiter` in `hub.ts`**

Add before the `OpenSpaceHub` class:

```typescript
/**
 * Simple sliding-window rate limiter.
 * Allows up to `maxPerSecond` requests per IP per 1-second window.
 * Exported for unit testing.
 */
export class RateLimiter {
    private readonly counters = new Map<string, { count: number; windowStart: number }>();

    constructor(private readonly maxPerSecond: number = 200) {}

    isAllowed(ip: string): boolean {
        const now = Date.now();
        const entry = this.counters.get(ip);
        if (!entry || now - entry.windowStart >= 1000) {
            this.counters.set(ip, { count: 1, windowStart: now });
            return true;
        }
        if (entry.count >= this.maxPerSecond) {
            return false;
        }
        entry.count++;
        return true;
    }

    /** Remove entries not seen in the last 60 seconds. Call periodically. */
    cleanup(): void {
        const cutoff = Date.now() - 60_000;
        for (const [ip, entry] of this.counters) {
            if (entry.windowStart < cutoff) {
                this.counters.delete(ip);
            }
        }
    }
}
```

**Step 4: Wire into Hub**

In `OpenSpaceHub`:

```typescript
private readonly rateLimiter = new RateLimiter(200);

// In constructor or start():
private cleanupTimer?: NodeJS.Timeout;
// Start cleanup interval (every 60 seconds)
this.cleanupTimer = setInterval(() => this.rateLimiter.cleanup(), 60_000);

// Add middleware in setupRoutes() before validateOrigin:
this.app.use((req: Request, res: Response, next: () => void) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!this.rateLimiter.isAllowed(ip)) {
        res.status(429).json({ error: 'Too Many Requests' });
        return;
    }
    next();
});
```

Also clear `cleanupTimer` in `dispose()` or `onStop()`.

**Step 5: Run test to verify it passes**

Run: `yarn workspace openspace-core test --testPathPattern="hub-rate-limiting"`
Expected: 5 passing.

**Step 6: Compile and verify**

Run: `yarn workspace openspace-core compile`

**Step 7: Commit**

```bash
git add extensions/openspace-core/src/node/hub.ts \
        extensions/openspace-core/src/node/__tests__/hub-rate-limiting.spec.ts
git commit -m "feat: add token-bucket rate limiting to Hub endpoints (Issue 7)"
```

---

## Final Verification

After all 12 tasks are committed:

**Step 1: Run all affected unit test suites**

```bash
yarn workspace openspace-core test --testPathPattern="patch-engine"
yarn workspace openspace-core test --testPathPattern="hub-mcp"
yarn workspace openspace-core test --testPathPattern="session-service"
yarn workspace openspace-core test --testPathPattern="openspace-core-backend-module"
yarn workspace openspace-core test --testPathPattern="hub-rate-limiting"
```

Expected: all passing.

**Step 2: Full build**

```bash
yarn --cwd .worktrees/bug-fixes build
```

Expected: zero TypeScript errors, zero webpack errors.

**Step 3: Review git log**

```bash
git log --oneline master..HEAD
```

Expected: 12 commits, one per task.

---

## Notes for Implementer

- **Working directory:** Always run commands from `/Users/Shared/dev/theia-openspace` (repo root) or use `--cwd .worktrees/bug-fixes`. Never `cd` into the worktree.
- **Theia is live** from `.worktrees/voice-feature`, not from this worktree. Don't confuse them.
- **No browser rebuild needed** for node-only changes (hub.ts, hub-mcp.ts, opencode-proxy.ts, patch-engine.ts). Session-service.ts IS a browser extension — rebuild webpack after Task 4.
- **Webpack rebuild command** (after Task 4):
  `yarn --cwd .worktrees/bug-fixes/browser-app webpack --config webpack.config.js --mode development`
- **Rule 4:** Run one spec file at a time. Never `yarn test` without `--testPathPattern`.
