# MCP Hub Readiness Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Guarantee the `openspace-hub` MCP server is reachable before any OpenCode session is created or restored, eliminating the race condition where the agent starts with no tools.

**Architecture:** A `waitForHub(url, options)` utility polls `GET /mcp` with exponential back-off until the Hub responds with HTTP 2xx or a timeout is reached. `SessionServiceImpl.createSession()` and the `init()` restore path both await this gate before calling `openCodeService.createSession()`. If the Hub does not come up within the timeout, a descriptive error is surfaced in the UI rather than creating a silently-broken session.

**Tech Stack:** TypeScript, Sinon/Chai (unit tests), existing `fetch` global (browser), `session-service.ts`, `session-service.spec.ts`

---

### Task 1: Extract `waitForHub` utility

**Files:**
- Create: `extensions/openspace-core/src/browser/hub-readiness.ts`
- Create (test): `extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts`

The utility lives in its own module so it can be tested in isolation without importing the full `SessionServiceImpl`.

**Step 1: Write the failing test**

In `extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts`:

```typescript
import { expect } from 'chai';
import * as sinon from 'sinon';
import { waitForHub } from '../hub-readiness';

describe('waitForHub()', () => {
    let originalFetch: unknown;

    beforeEach(() => {
        originalFetch = (globalThis as Record<string, unknown>)['fetch'];
    });

    afterEach(() => {
        (globalThis as Record<string, unknown>)['fetch'] = originalFetch;
        sinon.restore();
    });

    it('resolves immediately when Hub responds 200 on first attempt', async () => {
        const fetchStub = sinon.stub().resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 10 });

        expect(fetchStub.callCount).to.equal(1);
        expect(fetchStub.firstCall.args[0]).to.equal('http://localhost:3000/mcp');
        expect(fetchStub.firstCall.args[1]).to.deep.include({ method: 'GET' });
    });

    it('retries and resolves once Hub becomes available', async () => {
        const fetchStub = sinon.stub();
        fetchStub.onCall(0).rejects(new TypeError('network error'));
        fetchStub.onCall(1).resolves({ ok: false, status: 503 });
        fetchStub.onCall(2).resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 5, intervalMs: 10 });

        expect(fetchStub.callCount).to.equal(3);
    });

    it('throws HubNotReadyError after exhausting all attempts', async () => {
        const fetchStub = sinon.stub().rejects(new TypeError('network error'));
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        let thrown: Error | undefined;
        try {
            await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 10 });
        } catch (e) {
            thrown = e as Error;
        }

        expect(thrown).to.be.instanceOf(Error);
        expect(thrown!.message).to.include('Hub not ready');
        expect(fetchStub.callCount).to.equal(3);
    });

    it('treats a non-ok HTTP status as unavailable and retries', async () => {
        const fetchStub = sinon.stub();
        fetchStub.onCall(0).resolves({ ok: false, status: 404 });
        fetchStub.onCall(1).resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 10 });

        expect(fetchStub.callCount).to.equal(2);
    });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts \
  --timeout 10000
```

Expected: FAIL — `Cannot find module '../hub-readiness'`

**Step 3: Implement `hub-readiness.ts`**

Create `extensions/openspace-core/src/browser/hub-readiness.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Options for waitForHub().
 */
export interface HubReadinessOptions {
    /** Maximum number of GET attempts before giving up. Default: 20 */
    maxAttempts?: number;
    /** Milliseconds to wait between attempts. Default: 500 */
    intervalMs?: number;
}

/**
 * Poll `url` with GET until it responds with a 2xx status, or throw after
 * maxAttempts are exhausted.
 *
 * This is used to gate OpenCode session creation on the openspace-hub MCP
 * server being reachable. Without this gate, sessions created during Theia
 * startup may receive no MCP tools because OpenCode tried to connect before
 * the Hub was listening.
 *
 * @param url - The URL to probe (typically "http://localhost:3000/mcp")
 * @param options - Retry configuration
 * @throws Error if the Hub does not respond within maxAttempts
 */
export async function waitForHub(url: string, options: HubReadinessOptions = {}): Promise<void> {
    const maxAttempts = options.maxAttempts ?? 20;
    const intervalMs = options.intervalMs ?? 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url, { method: 'GET' });
            if (response.ok) {
                return; // Hub is ready
            }
        } catch {
            // Network error — Hub not yet listening, fall through to retry
        }

        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    throw new Error(
        `Hub not ready after ${maxAttempts} attempts at ${url}. ` +
        `MCP tools will not be available — please ensure the Hub is running.`
    );
}
```

**Step 4: Run test to verify it passes**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts \
  --timeout 10000
```

Expected: 4 passing

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/hub-readiness.ts \
        extensions/openspace-core/src/browser/__tests__/hub-readiness.spec.ts
git commit -m "feat: add waitForHub() readiness utility with tests"
```

---

### Task 2: Gate `createSession()` on hub readiness

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts:562-626`
- Modify (test): `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`

**Step 1: Add hub-readiness import and constant to `session-service.ts`**

At the top of `session-service.ts`, add the import alongside the existing imports (around line 32):

```typescript
import { waitForHub } from './hub-readiness';
```

Also add a private constant just inside the class body (after the class declaration, before the first `@inject`):

```typescript
private readonly HUB_MCP_URL = 'http://localhost:3000/mcp';
private readonly HUB_READINESS_ATTEMPTS = 20;
private readonly HUB_READINESS_INTERVAL_MS = 500;
```

**Step 2: Write the failing test**

In `session-service.spec.ts`, add a new `describe` block after the existing ones (before the final closing `}`):

```typescript
describe('createSession() hub readiness gate', () => {
    let waitForHubStub: sinon.SinonStub;

    beforeEach(() => {
        mockOpenCodeService.getProjects.resolves([mockProject]);
        mockOpenCodeService.createSession.resolves(mockSession);
        mockOpenCodeService.getSession.resolves(mockSession);
        mockOpenCodeService.getMessages.resolves([]);
        // Stub waitForHub on the service instance directly
        waitForHubStub = sinon.stub(
            (sessionService as any).__proto__,
            'waitForHub'
        );
    });

    it('awaits hub readiness before creating a session', async () => {
        waitForHubStub.resolves();
        await sessionService.setActiveProject('proj-1');
        await sessionService.createSession('test');
        expect(waitForHubStub.calledOnce).to.be.true;
        expect(mockOpenCodeService.createSession.calledOnce).to.be.true;
    });

    it('propagates HubNotReadyError and does not call createSession', async () => {
        waitForHubStub.rejects(new Error('Hub not ready after 20 attempts'));
        await sessionService.setActiveProject('proj-1');

        let thrown: Error | undefined;
        try {
            await sessionService.createSession('test');
        } catch (e) {
            thrown = e as Error;
        }

        expect(thrown).to.exist;
        expect(thrown!.message).to.include('Hub not ready');
        expect(mockOpenCodeService.createSession.called).to.be.false;
    });
});
```

> **Note on the stub approach:** Because `waitForHub` is a free function imported into the module, we need to make it injectable for testing. The simplest approach is to wrap the call in a protected method `waitForHub()` on the class, which can then be stubbed via the prototype. See implementation step below.

**Step 3: Run test to verify it fails**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/session-service.spec.ts \
  --timeout 10000 --grep "hub readiness"
```

Expected: FAIL — `waitForHub is not a function` or prototype stub fails

**Step 4: Implement the gate in `session-service.ts`**

Add a protected wrapper method to `SessionServiceImpl` (add near `getMcpConfig`, around line 282):

```typescript
/**
 * Protected wrapper around waitForHub so tests can stub it.
 */
protected async waitForHub(): Promise<void> {
    await waitForHubFn(this.HUB_MCP_URL, {
        maxAttempts: this.HUB_READINESS_ATTEMPTS,
        intervalMs: this.HUB_READINESS_INTERVAL_MS,
    });
}
```

Update the import at the top to use an alias so the method name doesn't clash:

```typescript
import { waitForHub as waitForHubFn } from './hub-readiness';
```

Then in `createSession()` (around line 605), add the hub readiness gate immediately before the MCP config read and session creation:

```typescript
// Gate on hub readiness before creating a session that needs MCP tools
this.logger.info('[SessionService] Waiting for Hub MCP server to be ready...');
await this.waitForHub();
this.logger.info('[SessionService] Hub is ready, proceeding with session creation');

// Create session via backend
const mcpConfig = this.getMcpConfig();
```

**Step 5: Run test to verify it passes**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/session-service.spec.ts \
  --timeout 10000 --grep "hub readiness"
```

Expected: 2 passing

**Step 6: Run full session-service test suite**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/session-service.spec.ts \
  --timeout 10000
```

Expected: all existing tests still pass

**Step 7: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
git commit -m "feat: gate createSession() on hub MCP readiness"
```

---

### Task 3: Gate the `init()` session-restore path on hub readiness

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts:287-317` (the `init()` method)
- Modify (test): `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`

The restore path in `init()` calls `setActiveSession(sessionId)` which sets a stale session. If the hub wasn't ready when that session was originally created, the agent in that session has no MCP tools. The fix: await hub readiness before restoring. If the hub check fails, skip the stale session restore (don't crash the app).

**Step 1: Write the failing test**

Add to `session-service.spec.ts`:

```typescript
describe('init() hub readiness gate on session restore', () => {
    let waitForHubStub: sinon.SinonStub;

    beforeEach(() => {
        mockOpenCodeService.getProjects.resolves([mockProject]);
        mockOpenCodeService.getSession.resolves(mockSession);
        mockOpenCodeService.getMessages.resolves([]);
        waitForHubStub = sinon.stub(
            (sessionService as any).__proto__,
            'waitForHub'
        );
        // Seed localStorage with saved IDs
        (window.localStorage.getItem as sinon.SinonStub)
            .withArgs('openspace.activeProjectId').returns('proj-1');
        (window.localStorage.getItem as sinon.SinonStub)
            .withArgs('openspace.activeSessionId').returns('session-1');
    });

    it('restores session when hub is ready', async () => {
        waitForHubStub.resolves();
        (sessionService as any).init();
        // Let the async init() fire
        await new Promise(r => setTimeout(r, 50));
        expect(waitForHubStub.calledOnce).to.be.true;
        expect(sessionService.activeSession?.id).to.equal('session-1');
    });

    it('skips session restore (logs warning) when hub is not ready', async () => {
        waitForHubStub.rejects(new Error('Hub not ready after 20 attempts'));
        (sessionService as any).init();
        await new Promise(r => setTimeout(r, 50));
        expect(waitForHubStub.calledOnce).to.be.true;
        // Session should NOT be restored
        expect(sessionService.activeSession).to.be.undefined;
    });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/session-service.spec.ts \
  --timeout 10000 --grep "init.*hub"
```

Expected: FAIL

**Step 3: Implement the gate in `init()`**

In `session-service.ts`, update the `init()` method (lines 287-317). After `setActiveProject` succeeds and before calling `setActiveSession`, add the hub readiness gate:

```typescript
@postConstruct()
protected init(): void {
    this.logger.info('[SessionService] Initializing...');

    const projectId = window.localStorage.getItem('openspace.activeProjectId');
    const sessionId = window.localStorage.getItem('openspace.activeSessionId');

    (async () => {
        if (projectId) {
            try {
                await this.setActiveProject(projectId);
                this.logger.debug(`[SessionService] Restored project: ${projectId}`);
            } catch (err) {
                this.logger.warn('[SessionService] Failed to restore project:', err);
            }
        }

        // Only restore session if project was loaded successfully
        if (sessionId && this._activeProject) {
            // Gate on hub readiness — a session restored before the Hub is up
            // will have no MCP tools available to the agent.
            try {
                await this.waitForHub();
            } catch (err) {
                this.logger.warn(
                    '[SessionService] Hub not ready during session restore — ' +
                    'skipping session restore to avoid tool-less session. ' +
                    'Create a new session once the IDE is fully loaded.',
                    err
                );
                // Do not restore the stale session
                return;
            }

            try {
                await this.setActiveSession(sessionId);
                this.logger.debug(`[SessionService] Restored session: ${sessionId}`);
            } catch (err) {
                this.logger.warn('[SessionService] Failed to restore session:', err);
            }
        }

        this.logger.info(`[SessionService] Initialized with project=${this._activeProject?.id || 'none'}, session=${this._activeSession?.id || 'none'}`);
    })();
}
```

**Step 4: Run test to verify it passes**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/session-service.spec.ts \
  --timeout 10000 --grep "init.*hub"
```

Expected: 2 passing

**Step 5: Run full test suite**

```bash
npx mocha --require ts-node/register \
  extensions/openspace-core/src/browser/__tests__/session-service.spec.ts \
  --timeout 10000
```

Expected: all tests pass

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service.ts \
        extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
git commit -m "feat: gate init() session restore on hub MCP readiness"
```

---

### Task 4: Run full unit test suite and verify no regressions

**Files:** No changes — verification only.

**Step 1: Run all browser unit tests**

```bash
npx mocha --require ts-node/register \
  "extensions/openspace-core/src/browser/__tests__/**/*.spec.ts" \
  --timeout 10000
```

Expected: all tests pass (no regressions)

**Step 2: Run all node unit tests**

```bash
npx mocha --require ts-node/register \
  "extensions/openspace-core/src/node/__tests__/**/*.spec.ts" \
  --timeout 10000
```

Expected: all tests pass

**Step 3: Run TypeScript build check**

```bash
npx tsc --noEmit -p extensions/openspace-core/tsconfig.json
```

Expected: no errors

**Step 4: Commit (only if any test fixes were needed)**

```bash
git add -A
git commit -m "fix: address any regressions from hub readiness gate"
```

---

### Task 5: Manual smoke test

**No code changes — manual verification.**

**Step 1: Start Theia + OpenCode**

```bash
# Start the app as normal and open the browser
```

**Step 2: Cold-start scenario**

1. Open browser devtools → Console tab
2. Hard-reload the page (Cmd+Shift+R)
3. Watch console logs — you should see:
   ```
   [SessionService] Waiting for Hub MCP server to be ready...
   [SessionService] Hub is ready, proceeding with session creation
   ```
4. Open a chat session and ask the agent to open a presentation
5. Verify the agent uses `openspace.*` MCP tools successfully

**Step 3: Verify hub-not-ready warning**

1. Stop the backend Hub (or point the URL to a wrong port temporarily)
2. Reload — you should see a clear error in the UI/console:
   ```
   Hub not ready after 20 attempts at http://localhost:3000/mcp
   ```
   rather than a silent tool-less session

**Step 4: Final commit of the plan doc**

```bash
git add docs/plans/2026-02-21-mcp-hub-readiness-gate.md
git commit -m "docs: add MCP hub readiness gate implementation plan"
```
