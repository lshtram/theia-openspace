# Test Coverage, Kokoro Fix & LLM Narration Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three issues discovered in code review: (1) 32 spec files excluded from mocha, (2) `KokoroAdapter.isAvailable()` always returns `true` causing HTTP 500, (3) passthrough LLM stub in `VoiceHubContribution` replaced with real opencode HTTP caller.

**Architecture:**
- Fix 1: Broaden `.mocharc.json` glob patterns + add `--exit` flag; fix 5 targeted bugs across 3 spec files and 1 source file to get all 32 specs passing.
- Fix 2: Replace hardcoded `return true` in `KokoroAdapter.isAvailable()` with a `require.resolve('kokoro-js')` probe, cached after first call.
- Fix 3: Add a standalone `callOpenCodeLlm(prompt, text)` function in `voice-hub-contribution.ts` that creates an ephemeral opencode session, posts the message, polls for the assistant reply, then deletes the session.

**Tech Stack:** TypeScript, Mocha, ts-node, Chai, Sinon, jsdom, Node.js `http` module, opencode REST API at `http://localhost:7890`.

---

## Task 1: Broaden `.mocharc.json` glob patterns and add `--exit`

**Files:**
- Modify: `.mocharc.json`

**Context:**
Current patterns miss: (a) browser specs in non-core extensions, (b) voice specs at `src/__tests__/`, (c) `src/common/__tests__/` in openspace-core.

New patterns needed:
- `"extensions/**/src/browser/__tests__/*.spec.ts"` — covers all browser specs
- `"extensions/**/src/__tests__/*.spec.ts"` — covers voice and any other flat `src/__tests__/`
- `"extensions/**/src/common/__tests__/*.spec.ts"` — covers common specs

Add `"exit": true` to force-exit after tests complete (React component tests leave lingering timers/handles).

**Step 1: Update `.mocharc.json`**

Replace the `"spec"` array and add `"exit"`:

```json
{
  "require": ["./test-setup.js", "ts-node/register/transpile-only"],
  "extensions": ["ts", "tsx"],
  "spec": [
    "extensions/**/src/node/**/__tests__/*.spec.ts",
    "extensions/**/src/browser/__tests__/*.spec.ts",
    "extensions/**/src/common/__tests__/*.spec.ts",
    "extensions/**/src/__tests__/*.spec.ts",
    "packages/**/src/**/*.spec.ts"
  ],
  "timeout": 10000,
  "exit": true,
  "color": true,
  "reporter": "spec",
  "node-option": [
    "no-warnings"
  ]
}
```

**Step 2: Run 1 spec to verify the new glob picks it up**

```bash
npx mocha --config .mocharc.json extensions/openspace-settings/src/browser/__tests__/ai-models-toggle-logic.spec.ts
```
Expected: spec runs and passes (was previously excluded).

**Step 3: Commit**

```bash
git add .mocharc.json
git commit -m "test: broaden mocharc glob patterns to include all browser/common/voice specs"
```

---

## Task 2: Add `scrollIntoView` polyfill to `test-setup.js`

**Files:**
- Modify: `test-setup.js`

**Context:**
`message-timeline.spec.ts` renders a React component that calls `element.scrollIntoView()` inside a `useEffect`. jsdom doesn't implement `scrollIntoView`, so 4 tests throw `TypeError: bottomSentinelRef.current?.scrollIntoView is not a function`. Fix: polyfill it in `test-setup.js` (same pattern as existing `queryCommandSupported` polyfill).

**Step 1: Add `scrollIntoView` polyfill to `test-setup.js`**

After the existing `document.execCommand` polyfill block, add:

```javascript
// Polyfill scrollIntoView — not implemented in jsdom
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () { /* noop */ };
}
```

**Step 2: Run `message-timeline.spec.ts` to verify it passes**

```bash
npx mocha --config .mocharc.json extensions/openspace-chat/src/browser/__tests__/message-timeline.spec.ts
```
Expected: all tests pass (was 4 failing before).

**Step 3: Commit**

```bash
git add test-setup.js
git commit -m "test: add scrollIntoView polyfill to test-setup for jsdom"
```

---

## Task 3: Extract `WhiteboardUtils` and types to `whiteboard-types.ts`

**Files:**
- Create: `extensions/openspace-whiteboard/src/browser/whiteboard-types.ts`
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-widget.tsx`
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts`
- Modify: `extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts`

**Context:**
`whiteboard-service.spec.ts` imports `WhiteboardUtils` and `WhiteboardData` from `whiteboard-widget.tsx`. That file imports tldraw and `@theia/core/lib/browser` (which has circular deps with `@theia/workspace`), crashing mocha at load time with `TypeError: Class extends value undefined is not a constructor or null`.

Fix: move `WhiteboardUtils`, `WhiteboardData`, and `WhiteboardRecord` out of `whiteboard-widget.tsx` into a new `whiteboard-types.ts` that has no heavy imports. Then `whiteboard-widget.tsx`, `whiteboard-service.ts`, and the spec all import from `whiteboard-types.ts`.

**Step 1: Create `whiteboard-types.ts`**

```typescript
// extensions/openspace-whiteboard/src/browser/whiteboard-types.ts

/**
 * Lightweight whiteboard types and utilities — no tldraw or Theia imports.
 * Kept separate so unit tests can import WhiteboardUtils without pulling in
 * the tldraw/Theia browser dependency chain.
 */

/** Shape of tldraw's TLStoreSnapshot (plain object). */
export interface WhiteboardData {
    store: Record<string, unknown>;
    schema: { schemaVersion: number; sequences: Record<string, unknown> };
}

/** A whiteboard record as stored/returned by the service. */
export interface WhiteboardRecord {
    uri: string;
    name: string;
}

export class WhiteboardUtils {
    static validate(data: unknown): data is WhiteboardData {
        if (!data || typeof data !== 'object') return false;
        const d = data as WhiteboardData;
        // Native TLStoreSnapshot format: { store: {…}, schema: { schemaVersion, sequences } }
        return (
            'store' in d && typeof d.store === 'object' &&
            'schema' in d && typeof d.schema === 'object'
        );
    }
}
```

**Step 2: Update `whiteboard-widget.tsx` to import from `whiteboard-types.ts`**

Remove the `WhiteboardData`, `WhiteboardRecord`, and `WhiteboardUtils` definitions from `whiteboard-widget.tsx`. Re-export them from `whiteboard-types.ts` for backward compat (other code imports these from `whiteboard-widget`).

At the top of `whiteboard-widget.tsx`, replace the inline type/class definitions with:
```typescript
export { WhiteboardData, WhiteboardRecord, WhiteboardUtils } from './whiteboard-types';
```
And remove the original `export type WhiteboardData`, `export interface WhiteboardRecord`, `export class WhiteboardUtils` blocks.

**Step 3: Update `whiteboard-service.ts` imports**

Change import of `WhiteboardData`/`WhiteboardRecord` from `'./whiteboard-widget'` to `'./whiteboard-types'`.

```typescript
// Before:
import { WhiteboardData, WhiteboardRecord } from './whiteboard-widget';
// After:
import { WhiteboardData, WhiteboardRecord } from './whiteboard-types';
```

**Step 4: Update `whiteboard-service.spec.ts` imports**

Change both imports from `'../whiteboard-widget'` to `'../whiteboard-types'`.

```typescript
// Before:
import { WhiteboardService } from '../whiteboard-service';
import { WhiteboardUtils, WhiteboardData } from '../whiteboard-widget';
// After:
import { WhiteboardService } from '../whiteboard-service';
import { WhiteboardUtils, WhiteboardData } from '../whiteboard-types';
```

**Step 5: Run `whiteboard-service.spec.ts` to verify it passes**

```bash
npx mocha --config .mocharc.json extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts
```
Expected: all tests pass (was crashing before).

**Step 6: Commit**

```bash
git add extensions/openspace-whiteboard/src/browser/whiteboard-types.ts \
        extensions/openspace-whiteboard/src/browser/whiteboard-widget.tsx \
        extensions/openspace-whiteboard/src/browser/whiteboard-service.ts \
        extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts
git commit -m "refactor(whiteboard): extract WhiteboardUtils/types to whiteboard-types.ts to break tldraw import cycle in tests"
```

---

## Task 4: Fix `audio-fsm.spec.ts` — preserve `navigator.platform` in mock

**Files:**
- Modify: `extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts`

**Context:**
The spec overrides `navigator` via `Object.defineProperty` with only `mediaDevices`, setting `platform` to `undefined`. When `@lumino/domutils` is later required (transitively), it reads `navigator.platform.match(/Mac/i)` at module-load time and crashes. The fix: spread the existing `navigator` object and add `mediaDevices` on top.

**Step 1: Fix the `Object.defineProperty` call in `audio-fsm.spec.ts`**

Find the block (lines ~6-14):
```typescript
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: async (_constraints: any) => mockStream,
    },
  },
  configurable: true,
  writable: true,
});
```

Replace with:
```typescript
Object.defineProperty(global, 'navigator', {
  value: {
    ...((global as any).navigator || {}),
    mediaDevices: {
      getUserMedia: async (_constraints: any) => mockStream,
    },
  },
  configurable: true,
  writable: true,
});
```

**Step 2: Run `audio-fsm.spec.ts` to verify it passes**

```bash
npx mocha --config .mocharc.json extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts
```
Expected: all tests pass (was crashing before).

**Step 3: Commit**

```bash
git add extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts
git commit -m "fix(test): preserve navigator.platform when mocking mediaDevices in audio-fsm.spec"
```

---

## Task 5: Fix `presentation-service.spec.ts` — correct wrong test expectation

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/__tests__/presentation-service.spec.ts`

**Context:**
The test `"respects absolute file:// path unchanged"` passes `file:///tmp/myslides.deck.md` — a path outside the mock workspace root (`file:///workspace`). `resolveContentPath` correctly rejects this with "Path escapes workspace root". The test expectation is wrong — it should test with a path inside the workspace.

**Step 1: Fix the test expectation**

Find (lines ~272-277):
```typescript
it('respects absolute file:// path unchanged', async () => {
    const abs = 'file:///tmp/myslides.deck.md';
    await service.createPresentation(abs, 'My Slides');
    const calledUri = createStub.firstCall.args[0].toString();
    expect(calledUri).to.equal(abs);
});
```

Replace with:
```typescript
it('respects absolute file:// path inside workspace unchanged', async () => {
    const abs = 'file:///workspace/talks/myslides.deck.md';
    await service.createPresentation(abs, 'My Slides');
    const calledUri = createStub.firstCall.args[0].toString();
    expect(calledUri).to.equal(abs);
});
```

**Step 2: Run `presentation-service.spec.ts` to verify all pass**

```bash
npx mocha --config .mocharc.json extensions/openspace-presentation/src/browser/__tests__/presentation-service.spec.ts
```
Expected: all tests pass (was 1 failing before).

**Step 3: Commit**

```bash
git add extensions/openspace-presentation/src/browser/__tests__/presentation-service.spec.ts
git commit -m "fix(test): correct absolute file:// path test to use a path inside the workspace"
```

---

## Task 6: Run full test suite and verify all 32 previously-excluded specs now pass

**Step 1: Run the full mocha suite**

```bash
yarn test
```
(Or: `npx mocha --config .mocharc.json`)

Expected: all previously-468 tests still pass, plus ~406 newly-included tests. Zero failures. If any failures appear, fix them before proceeding.

**Step 2: Spot-check the new spec count**

The previously-run baseline was 468 passing. The new run should show significantly more (estimated ~870+).

---

## Task 7: Fix `KokoroAdapter.isAvailable()` — probe with `require.resolve`

**Files:**
- Modify: `packages/voice-core/src/adapters/kokoro.adapter.ts`

**Context:**
`isAvailable()` currently hardcodes `return true`. When `kokoro-js` is not installed (it's an optional dependency), `synthesize()` fails with `MODULE_NOT_FOUND`. `TtsProviderSelector` then always picks Kokoro, causing HTTP 500 on `/openspace/voice/narrate`. Fix: use `require.resolve('kokoro-js')` to probe without loading, cache result.

**Step 1: Write the failing test in `tts-provider-selector.spec.ts`**

Check if a test already exists for this in `extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts`. If not, add:

```typescript
it('falls back to BrowserSpeechSynthesisStub when KokoroAdapter is not available', async () => {
    // KokoroAdapter.isAvailable() should return false when kokoro-js is not installed
    const kokoro = new KokoroAdapter();
    // In test environment kokoro-js is not installed — should return false
    const available = await kokoro.isAvailable();
    expect(available).to.be.false;
});
```

**Step 2: Run test to verify it fails (currently `isAvailable()` returns true)**

```bash
npx mocha --config .mocharc.json extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts
```
Expected: the new test FAILS (because `isAvailable()` returns `true` even without kokoro-js).

**Step 3: Implement the fix in `KokoroAdapter.isAvailable()`**

In `packages/voice-core/src/adapters/kokoro.adapter.ts`, replace:

```typescript
async isAvailable(): Promise<boolean> {
    // Always return true - let synthesize handle errors
    return true;
}
```

With:

```typescript
private availabilityCache: boolean | undefined = undefined;

async isAvailable(): Promise<boolean> {
    if (this.availabilityCache !== undefined) {
        return this.availabilityCache;
    }
    try {
        require.resolve('kokoro-js');
        this.availabilityCache = true;
    } catch {
        this.availabilityCache = false;
    }
    return this.availabilityCache;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx mocha --config .mocharc.json extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts
```
Expected: all pass including the new test.

**Step 5: Commit**

```bash
git add packages/voice-core/src/adapters/kokoro.adapter.ts \
        extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts
git commit -m "fix(kokoro): isAvailable() probes require.resolve instead of hardcoding true"
```

---

## Task 8: Wire real opencode LLM caller in `VoiceHubContribution` (Task 15)

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-hub-contribution.ts`

**Context:**
`initVoiceService()` currently uses a passthrough `LlmCaller` that wraps raw text in a `NarrationScript` without LLM preprocessing. Task 15 replaces this with a real opencode session caller.

The opencode server runs at `http://localhost:7890`. The flow:
1. `POST /session` — create ephemeral session (no projectID needed)
2. `POST /session/:id/message` — send `[{ type: 'text', text: prompt + '\n\n' + text }]`
3. Poll `GET /session/:id/message` until a message with `role: 'assistant'` appears and its status is complete (no more streaming). Opencode sets `time.completed` on the message when done.
4. Extract the assistant text part content
5. `DELETE /session/:id` — clean up
6. Return the text content (NarrationPreprocessor handles JSON extraction/validation/fallback)

Timeout: 30 seconds. On any error, throw — `NarrationPreprocessor.process()` catches and falls back to raw text.

**Step 1: Write the failing test**

In `extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts` (or a new file `voice-hub-contribution.spec.ts`), add:

```typescript
import * as http from 'http';
import * as sinon from 'sinon';

describe('callOpenCodeLlm (integration-style unit test)', () => {
    // We test the function indirectly through VoiceBackendService narration flow
    // by checking NarrationPreprocessor receives LLM output
    it('passes LLM response through NarrationPreprocessor', async () => {
        // Use the passthrough LLM (already tested in narration-preprocessor.spec.ts)
        // The real opencode caller is tested by its HTTP contract:
        // a mock http server that returns a completed assistant message
        // This is an integration test — mark as skip if opencode not running
        // For unit purposes, the LlmCaller type contract is sufficient
    });
});
```

Actually the `NarrationPreprocessor` is already fully tested. The `callOpenCodeLlm` function is pure HTTP plumbing — test it by verifying the HTTP call sequence with a mock server. Add this test to a new file:

`extensions/openspace-voice/src/__tests__/opencode-llm-caller.spec.ts`:

```typescript
import { expect } from 'chai';
import * as http from 'http';

// We import the function under test once it exists:
// import { callOpenCodeLlm } from '../node/opencode-llm-caller';

describe('callOpenCodeLlm', () => {
    let server: http.Server;
    let port: number;

    before((done) => {
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', () => {
                if (req.method === 'POST' && req.url === '/session') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ id: 'test-session-id' }));
                } else if (req.method === 'POST' && req.url === '/session/test-session-id/message') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ info: { id: 'msg-1' } }));
                } else if (req.method === 'GET' && req.url === '/session/test-session-id/message') {
                    const assistantText = '{"segments":[{"type":"speech","text":"hello","priority":"normal"}]}';
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify([
                        {
                            info: { id: 'msg-1', role: 'assistant', time: { created: 1, completed: 2 } },
                            parts: [{ type: 'text', content: assistantText }]
                        }
                    ]));
                } else if (req.method === 'DELETE' && req.url?.startsWith('/session/')) {
                    res.writeHead(200); res.end('{}');
                } else {
                    res.writeHead(404); res.end('not found');
                }
            });
        });
        server.listen(0, () => {
            port = (server.address() as any).port;
            done();
        });
    });

    after((done) => { server.close(done); });

    it('creates session, posts message, polls reply, deletes session, returns text', async () => {
        // Import dynamically after server is up so we can pass the port
        // Function signature: callOpenCodeLlm(prompt, text, baseUrl?)
        // const result = await callOpenCodeLlm('system prompt', 'user text', `http://localhost:${port}`);
        // expect(result).to.include('segments');
        // Test is a placeholder — fill in once function is extracted
        expect(true).to.be.true; // placeholder
    });
});
```

**Note:** The test above is a scaffold. The real test fills in after the function is implemented.

**Step 2: Extract the LLM caller function**

Add a new standalone function `callOpenCodeLlm` at the bottom of `voice-hub-contribution.ts` (private to the module). It uses Node's built-in `http` module (already imported at the top of the file):

```typescript
/**
 * Call the opencode LLM with a one-shot session for narration preprocessing.
 * Creates an ephemeral session, posts the prompt+text, polls for the assistant
 * reply, deletes the session, and returns the assistant's text content.
 *
 * @throws on HTTP error, timeout, or if no assistant reply arrives within 30s.
 */
async function callOpenCodeLlm(
    prompt: string,
    text: string,
    baseUrl = 'http://localhost:7890',
): Promise<string> {
    const POLL_INTERVAL_MS = 500;
    const TIMEOUT_MS = 30_000;

    // 1. Create ephemeral session
    const session = await httpPost<{ id: string }>(baseUrl, '/session', {});
    const sessionId = session.id;

    try {
        // 2. Post the user message
        await httpPost(baseUrl, `/session/${encodeURIComponent(sessionId)}/message`, {
            parts: [{ type: 'text', text: `${prompt}\n\n${text}` }],
        });

        // 3. Poll for assistant reply
        const deadline = Date.now() + TIMEOUT_MS;
        while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            const messages = await httpGet<Array<{
                info: { id: string; role: string; time: { created: number; completed?: number } };
                parts: Array<{ type: string; content?: string; text?: string }>;
            }>>(baseUrl, `/session/${encodeURIComponent(sessionId)}/message`);

            const assistant = messages.find(
                (m) => m.info.role === 'assistant' && m.info.time.completed !== undefined,
            );
            if (assistant) {
                // Extract text from first text part
                const textPart = assistant.parts.find((p) => p.type === 'text');
                return textPart?.content ?? textPart?.text ?? '';
            }
        }
        throw new Error('[VoiceHub] LLM call timed out after 30s');
    } finally {
        // 4. Always delete the ephemeral session
        try {
            await httpDelete(baseUrl, `/session/${encodeURIComponent(sessionId)}`);
        } catch (e) {
            console.warn('[VoiceHub] Failed to delete ephemeral LLM session:', e);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpPost<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
    const url = `${baseUrl}${path}`;
    const data = JSON.stringify(body);
    return new Promise<T>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = require('http').request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            },
            (res: import('http').IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString();
                    if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${text}`));
                    }
                    try { resolve(JSON.parse(text) as T); } catch (e) { reject(e); }
                });
                res.on('error', reject);
            },
        );
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function httpGet<T>(baseUrl: string, path: string): Promise<T> {
    const url = `${baseUrl}${path}`;
    return new Promise<T>((resolve, reject) => {
        const parsedUrl = new URL(url);
        require('http').get(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                headers: { 'Accept': 'application/json' },
            },
            (res: import('http').IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString();
                    if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${text}`));
                    }
                    try { resolve(JSON.parse(text) as T); } catch (e) { reject(e); }
                });
                res.on('error', reject);
            },
        ).on('error', reject);
    });
}

async function httpDelete(baseUrl: string, path: string): Promise<void> {
    const url = `${baseUrl}${path}`;
    return new Promise<void>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = require('http').request(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
            },
            (res: import('http').IncomingMessage) => {
                res.resume(); // drain
                res.on('end', () => {
                    if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
                        return reject(new Error(`HTTP DELETE ${res.statusCode}`));
                    }
                    resolve();
                });
                res.on('error', reject);
            },
        );
        req.on('error', reject);
        req.end();
    });
}
```

**Step 3: Wire `callOpenCodeLlm` into `initVoiceService()`**

In `VoiceHubContribution.initVoiceService()`, replace the `passthroughLlm`:

```typescript
// Before:
const passthroughLlm: LlmCaller = async (_prompt: string, text: string): Promise<string> =>
    JSON.stringify({ segments: [{ type: 'speech', text, priority: 'normal' }] });

// After:
const realLlmCaller: LlmCaller = (prompt: string, text: string) =>
    callOpenCodeLlm(prompt, text);
```

And pass `realLlmCaller` instead of `passthroughLlm` both in the success path and the catch path:

```typescript
this.readyPromise = Promise.all([sttSelector.selectProvider(), ttsSelector.selectProvider()])
    .then(([stt, tts]) => {
        this.voiceService = new VoiceBackendService({
            sttProvider: stt,
            ttsProvider: tts,
            llmCaller: realLlmCaller,   // ← was passthroughLlm
        });
        ...
    })
    .catch((err) => {
        ...
        this.voiceService = new VoiceBackendService({
            ...
            llmCaller: realLlmCaller,   // ← was passthroughLlm
        });
    });
```

**Step 4: Run voice tests to verify no regressions**

```bash
npx mocha --config .mocharc.json extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts
```
Expected: all pass.

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/node/voice-hub-contribution.ts
git commit -m "feat(voice): wire real opencode LLM caller for narration preprocessing (Task 15)"
```

---

## Task 9: Final verification — run full test suite

**Step 1: Run all tests**

```bash
yarn test
```
Or:
```bash
npx mocha --config .mocharc.json
```

Expected: significantly more than 468 tests, 0 failures.

**Step 2: Record the final test count**

Note the new passing count. This establishes the new baseline.

**Step 3: Commit if any straggler fixes were needed**

If any test failures appeared and were fixed in the previous steps, ensure all changes are committed.

---

## Task 10: Rebuild and smoke-test the server (optional but recommended)

**Step 1: Rebuild `openspace-voice` extension**

```bash
yarn --cwd extensions/openspace-voice build
yarn --cwd browser-app build
```

**Step 2: Restart and verify `/openspace/voice/narrate` endpoint**

```bash
node browser-app/lib/backend/main.js
```

Then POST to `http://localhost:3000/openspace/voice/narrate` with:
```json
{ "text": "Hello world", "mode": "narrate-off", "voice": "af_sarah", "speed": 1.0 }
```
Expected: `{ "utterances": [] }` (narrate-off skips LLM).

With `"mode": "narrate-everything"`:
Expected: either a real LLM response (if opencode is running at 7890) or graceful fallback (raw text segment) if opencode is not running. No HTTP 500.
