# Phase T4/T5: ArtifactStore + PatchEngine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add atomic writes, rolling backups, audit logging, and OCC-versioned patching for all agent-written files in the workspace.

**Architecture:** A new `ArtifactStore` service (node-side, in `openspace-core`) handles all agent file writes atomically via `p-queue` (concurrency 1), `tmp+rename+fsync`, rolling 20-version history in `.openspace/artifacts/history/`, and NDJSON audit log. The existing `PatchEngine` is refactored to delegate writes to `ArtifactStore`. A new MCP tool `openspace.artifact.patch` exposes OCC-versioned patching to the agent. The existing `openspace.file.write` tool is also routed through `ArtifactStore` so ALL agent writes get protection.

**Tech Stack:** TypeScript, Node.js `fs/promises`, `p-queue` (new dep), `chokidar` (new dep), Express (existing), Zod (existing), Mocha + Sinon (tests).

**Branch:** `feature/phase-1-permission-ui`
**Test invariant:** `yarn test:unit` must stay at 488+ passing throughout.
**Commit rule:** One commit per task. No `--no-verify`. Explicit `git add <files>`.

---

## Pre-flight check

Before starting: from workspace root, run `yarn test:unit` and verify 488 passing.

---

### Task T5.1: Add p-queue and chokidar dependencies

**Files:**
- Modify: `extensions/openspace-core/package.json`

**Step 1: Add dependencies**

In `extensions/openspace-core/package.json`, add to `"dependencies"`:
```json
"chokidar": "^3.6.0",
"p-queue": "^6.6.2"
```

> Use p-queue v6 (CommonJS-compatible). v7+ is pure ESM and requires extra workarounds.

**Step 2: Install**

```bash
yarn install
```

Expected: resolves without error.

**Step 3: Verify types exist**

```bash
ls node_modules/p-queue/dist/index.js node_modules/chokidar/index.js
```

Expected: both files present.

**Step 4: Run tests (must still pass)**

```bash
yarn test:unit
```

Expected: 488 passing.

**Step 5: Commit**

```bash
git add extensions/openspace-core/package.json yarn.lock
git commit -m "chore: add p-queue v6 and chokidar deps to openspace-core"
```

---

### Task T5.2: Create ArtifactStore service

**Files:**
- Create: `extensions/openspace-core/src/node/artifact-store.ts`
- Create: `extensions/openspace-core/src/node/__tests__/artifact-store.spec.ts`

**Step 1: Write the failing tests**

Create `extensions/openspace-core/src/node/__tests__/artifact-store.spec.ts`:

```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ArtifactStore } from '../artifact-store';

describe('ArtifactStore', () => {
    let tmpDir: string;
    let store: ArtifactStore;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-store-test-'));
        store = new ArtifactStore(tmpDir);
    });

    afterEach(() => {
        store.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('write()', () => {
        it('creates a new file with the given content', async () => {
            await store.write('hello.txt', 'world', { actor: 'agent', reason: 'test' });
            const content = fs.readFileSync(path.join(tmpDir, 'hello.txt'), 'utf-8');
            assert.strictEqual(content, 'world');
        });

        it('overwrites an existing file atomically', async () => {
            fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'old');
            await store.write('file.txt', 'new', { actor: 'agent', reason: 'update' });
            const content = fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8');
            assert.strictEqual(content, 'new');
        });

        it('creates parent directories as needed', async () => {
            await store.write('sub/dir/file.txt', 'content', { actor: 'agent', reason: 'test' });
            assert.ok(fs.existsSync(path.join(tmpDir, 'sub', 'dir', 'file.txt')));
        });

        it('creates a backup of existing file before overwriting', async () => {
            fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'original');
            await store.write('file.txt', 'updated', { actor: 'agent', reason: 'test' });
            const historyDir = path.join(tmpDir, '.openspace', 'artifacts', 'history', 'file.txt');
            const backups = fs.readdirSync(historyDir);
            assert.strictEqual(backups.length, 1);
        });

        it('appends to audit log', async () => {
            await store.write('file.txt', 'content', { actor: 'agent', reason: 'audit-test' });
            const logPath = path.join(tmpDir, '.openspace', 'artifacts', 'events.ndjson');
            const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
            assert.strictEqual(lines.length, 1);
            const event = JSON.parse(lines[0]);
            assert.strictEqual(event.artifact, 'file.txt');
            assert.strictEqual(event.actor, 'agent');
            assert.strictEqual(event.action, 'CREATE');
        });

        it('logs UPDATE action for existing file', async () => {
            fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'v1');
            await store.write('file.txt', 'v2', { actor: 'agent', reason: 'update' });
            const logPath = path.join(tmpDir, '.openspace', 'artifacts', 'events.ndjson');
            const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
            const event = JSON.parse(lines[0]);
            assert.strictEqual(event.action, 'UPDATE');
        });

        it('rejects paths that escape workspace root', async () => {
            await assert.rejects(
                () => store.write('../escape.txt', 'bad', { actor: 'agent', reason: 'test' }),
                /escapes project root/
            );
        });

        it('serializes concurrent writes to the same file', async () => {
            const results: number[] = [];
            const p1 = store.write('serial.txt', 'first', { actor: 'agent', reason: 'test' })
                .then(() => results.push(1));
            const p2 = store.write('serial.txt', 'second', { actor: 'agent', reason: 'test' })
                .then(() => results.push(2));
            await Promise.all([p1, p2]);
            // Both should complete (order may vary, but no torn write)
            assert.strictEqual(results.length, 2);
            const content = fs.readFileSync(path.join(tmpDir, 'serial.txt'), 'utf-8');
            assert.ok(content === 'first' || content === 'second');
        });

        it('emits FILE_CHANGED event after write', async () => {
            const events: Array<{ path: string; actor: string }> = [];
            store.on('FILE_CHANGED', (e) => events.push(e));
            await store.write('notify.txt', 'hello', { actor: 'agent', reason: 'test' });
            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].path, 'notify.txt');
            assert.strictEqual(events[0].actor, 'agent');
        });
    });

    describe('read()', () => {
        it('reads existing file as Buffer', async () => {
            fs.writeFileSync(path.join(tmpDir, 'read.txt'), 'hello');
            const buf = await store.read('read.txt');
            assert.strictEqual(buf.toString(), 'hello');
        });

        it('throws if file does not exist', async () => {
            await assert.rejects(() => store.read('missing.txt'));
        });
    });

    describe('rolling backup limit', () => {
        it('keeps at most 20 backup versions', async () => {
            fs.writeFileSync(path.join(tmpDir, 'roll.txt'), 'v0');
            for (let i = 1; i <= 25; i++) {
                await store.write('roll.txt', `v${i}`, { actor: 'agent', reason: 'roll' });
            }
            const historyDir = path.join(tmpDir, '.openspace', 'artifacts', 'history', 'roll.txt');
            const backups = fs.readdirSync(historyDir);
            assert.ok(backups.length <= 20, `Expected <= 20 backups, got ${backups.length}`);
        });
    });
});
```

**Step 2: Run tests — verify they fail**

```bash
yarn test:unit
```

Expected: errors about `../artifact-store` not found.

**Step 3: Implement ArtifactStore**

Create `extensions/openspace-core/src/node/artifact-store.ts`:

```typescript
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import chokidar from 'chokidar';

// p-queue v6 CJS/ESM compat
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PQueueCtor = ((PQueue as any).default || PQueue) as new (opts: { concurrency: number }) => PQueue<any, any>;

const now = () => new Date().toISOString();

export interface WriteOptions {
    actor: 'user' | 'agent';
    reason: string;
    tool_call_id?: string;
}

export interface ArtifactEvent {
    ts: string;
    artifact: string;
    action: 'CREATE' | 'UPDATE';
    actor: 'user' | 'agent';
    reason: string;
    tool_call_id?: string;
    size_bytes?: number;
}

export class ArtifactStore extends EventEmitter {
    private queue: PQueue<any, any>;
    private projectRoot: string;
    private watcher: ReturnType<typeof chokidar.watch> | null = null;
    private internalWriteInProgress = new Set<string>();

    constructor(projectRoot: string) {
        super();
        this.projectRoot = path.resolve(projectRoot);
        this.queue = new PQueueCtor({ concurrency: 1 });
        this.initWatcher();
    }

    private initWatcher(): void {
        this.watcher = chokidar.watch(this.projectRoot, {
            ignoreInitial: true,
            persistent: false,
            ignored: [
                /node_modules/,
                /\.git/,
                /\.openspace[/\\]artifacts/,
                /\.tmp$/,
            ],
            awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
        });

        this.watcher.on('change', (absolutePath: string) => {
            const rel = path.relative(this.projectRoot, absolutePath).replace(/\\/g, '/');
            if (this.internalWriteInProgress.has(rel)) {
                return; // self-write — suppress
            }
            this.emit('FILE_CHANGED', { path: rel, actor: 'user' });
        });

        this.watcher.on('error', (err: unknown) => {
            console.error('[ArtifactStore] watcher error:', err);
        });
    }

    close(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    private assertInsideRoot(absolutePath: string): void {
        const normalized = path.resolve(absolutePath);
        const withSep = this.projectRoot + path.sep;
        if (normalized !== this.projectRoot && !normalized.startsWith(withSep)) {
            throw new Error(`Path escapes project root: ${absolutePath}`);
        }
    }

    private resolvePath(filePath: string): string {
        const abs = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.projectRoot, filePath);
        this.assertInsideRoot(abs);
        return abs;
    }

    async read(filePath: string): Promise<Buffer> {
        const abs = this.resolvePath(filePath);
        return fsPromises.readFile(abs);
    }

    async write(filePath: string, content: string | Buffer, opts: WriteOptions): Promise<void> {
        return this.queue.add(async () => {
            const abs = this.resolvePath(filePath);
            this.internalWriteInProgress.add(filePath);
            try {
                const exists = await fsPromises.access(abs).then(() => true).catch(() => false);
                await fsPromises.mkdir(path.dirname(abs), { recursive: true });

                if (exists) {
                    await this.createBackup(filePath, abs);
                }

                // Atomic write: tmp -> rename
                const tmp = `${abs}.tmp`;
                await fsPromises.writeFile(tmp, content);
                const fh = await fsPromises.open(tmp, 'r+');
                await fh.sync();
                await fh.close();
                await fsPromises.rename(tmp, abs);

                await this.logEvent(filePath, abs, opts, exists ? 'UPDATE' : 'CREATE');

                this.emit('FILE_CHANGED', { path: filePath, actor: opts.actor });
            } finally {
                setTimeout(() => this.internalWriteInProgress.delete(filePath), 500);
            }
        });
    }

    private async createBackup(filePath: string, abs: string): Promise<void> {
        try {
            const histDir = path.join(this.projectRoot, '.openspace', 'artifacts', 'history', filePath);
            await fsPromises.mkdir(histDir, { recursive: true });
            const ts = now().replace(/[:.]/g, '-');
            await fsPromises.copyFile(abs, path.join(histDir, `v${ts}.bak`));

            // Rolling window: keep last 20
            const entries = await fsPromises.readdir(histDir);
            if (entries.length > 20) {
                const sorted = entries.sort();
                for (const f of sorted.slice(0, entries.length - 20)) {
                    await fsPromises.unlink(path.join(histDir, f));
                }
            }
        } catch (err) {
            console.error('[ArtifactStore] backup failed:', err);
        }
    }

    private async logEvent(filePath: string, abs: string, opts: WriteOptions, action: 'CREATE' | 'UPDATE'): Promise<void> {
        try {
            const stats = await fsPromises.stat(abs);
            const event: ArtifactEvent = {
                ts: now(),
                artifact: filePath,
                action,
                actor: opts.actor,
                reason: opts.reason,
                tool_call_id: opts.tool_call_id,
                size_bytes: stats.size,
            };
            const logPath = path.join(this.projectRoot, '.openspace', 'artifacts', 'events.ndjson');
            await fsPromises.mkdir(path.dirname(logPath), { recursive: true });
            await fsPromises.appendFile(logPath, JSON.stringify(event) + '\n');
        } catch (err) {
            console.error('[ArtifactStore] audit log failed:', err);
        }
    }
}
```

**Step 4: Run tests — verify they pass**

```bash
yarn test:unit
```

Expected: 488 + new ArtifactStore tests passing (should be ~498+).

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/artifact-store.ts extensions/openspace-core/src/node/__tests__/artifact-store.spec.ts
git commit -m "feat(T5): add ArtifactStore with atomic writes, backups, audit log"
```

---

### Task T4.1: Refactor PatchEngine to use ArtifactStore

**Files:**
- Modify: `extensions/openspace-core/src/node/patch-engine.ts`
- Create: `extensions/openspace-core/src/node/__tests__/patch-engine.spec.ts`

**Background:** The existing `patch-engine.ts` does direct `fs.writeFileSync` and a hand-rolled Promise chain for serialization. We keep its OCC logic, error types, and version persistence but replace all file I/O with `ArtifactStore.write()` / `ArtifactStore.read()`.

**Step 1: Write the failing tests**

Create `extensions/openspace-core/src/node/__tests__/patch-engine.spec.ts`:

```typescript
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ArtifactStore } from '../artifact-store';
import { PatchEngine, ConflictError, PatchValidationError } from '../patch-engine';

describe('PatchEngine', () => {
    let tmpDir: string;
    let store: ArtifactStore;
    let engine: PatchEngine;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-engine-test-'));
        store = new ArtifactStore(tmpDir);
        engine = new PatchEngine(tmpDir, store);
    });

    afterEach(() => {
        store.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('apply() with replace_content', () => {
        it('creates a new file with version 1', async () => {
            const result = await engine.apply('new.txt', {
                baseVersion: 0,
                actor: 'agent',
                intent: 'create',
                ops: [{ op: 'replace_content', content: 'hello world' }],
            });
            assert.strictEqual(result.version, 1);
            assert.ok(result.bytes > 0);
            const content = fs.readFileSync(path.join(tmpDir, 'new.txt'), 'utf-8');
            assert.strictEqual(content, 'hello world');
        });

        it('increments version on successive applies', async () => {
            fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'v0');
            await engine.apply('file.txt', {
                baseVersion: 0, actor: 'agent', intent: 'update',
                ops: [{ op: 'replace_content', content: 'v1' }],
            });
            const r2 = await engine.apply('file.txt', {
                baseVersion: 1, actor: 'agent', intent: 'update',
                ops: [{ op: 'replace_content', content: 'v2' }],
            });
            assert.strictEqual(r2.version, 2);
        });

        it('throws ConflictError if baseVersion is wrong', async () => {
            fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'content');
            await assert.rejects(
                () => engine.apply('file.txt', {
                    baseVersion: 99, actor: 'agent', intent: 'bad',
                    ops: [{ op: 'replace_content', content: 'x' }],
                }),
                ConflictError
            );
        });

        it('returns remediation hint in ConflictError', async () => {
            try {
                await engine.apply('file.txt', {
                    baseVersion: 5, actor: 'agent', intent: 'bad',
                    ops: [{ op: 'replace_content', content: 'x' }],
                });
                assert.fail('should have thrown');
            } catch (err) {
                assert.ok(err instanceof ConflictError);
                assert.strictEqual(err.currentVersion, 0);
            }
        });

        it('rejects empty ops array', async () => {
            await assert.rejects(
                () => engine.apply('file.txt', { baseVersion: 0, actor: 'agent', intent: 'bad', ops: [] }),
                PatchValidationError
            );
        });

        it('rejects unknown op type', async () => {
            await assert.rejects(
                () => engine.apply('file.txt', {
                    baseVersion: 0, actor: 'agent', intent: 'bad',
                    ops: [{ op: 'unknown', content: 'x' }],
                }),
                PatchValidationError
            );
        });

        it('routes write through ArtifactStore (creates backup)', async () => {
            fs.writeFileSync(path.join(tmpDir, 'track.txt'), 'original');
            await engine.apply('track.txt', {
                baseVersion: 0, actor: 'agent', intent: 'overwrite',
                ops: [{ op: 'replace_content', content: 'new content' }],
            });
            // ArtifactStore should have created a backup
            const histDir = path.join(tmpDir, '.openspace', 'artifacts', 'history', 'track.txt');
            assert.ok(fs.existsSync(histDir), 'history directory should exist');
            const backups = fs.readdirSync(histDir);
            assert.strictEqual(backups.length, 1);
        });
    });

    describe('apply() with replace_lines', () => {
        it('replaces a line range', async () => {
            fs.writeFileSync(path.join(tmpDir, 'lines.txt'), 'line0\nline1\nline2\nline3');
            const result = await engine.apply('lines.txt', {
                baseVersion: 0, actor: 'agent', intent: 'fix line',
                ops: [{ op: 'replace_lines', startLine: 1, endLine: 2, content: 'REPLACED' }],
            });
            assert.strictEqual(result.version, 1);
            const content = fs.readFileSync(path.join(tmpDir, 'lines.txt'), 'utf-8');
            assert.strictEqual(content, 'line0\nREPLACED\nline3');
        });

        it('throws out-of-bounds error', async () => {
            fs.writeFileSync(path.join(tmpDir, 'lines.txt'), 'line0\nline1');
            await assert.rejects(
                () => engine.apply('lines.txt', {
                    baseVersion: 0, actor: 'agent', intent: 'bad',
                    ops: [{ op: 'replace_lines', startLine: 0, endLine: 99, content: 'x' }],
                }),
                PatchValidationError
            );
        });
    });

    describe('getVersion()', () => {
        it('returns 0 for unknown file', () => {
            assert.strictEqual(engine.getVersion('unknown.txt'), 0);
        });

        it('returns correct version after apply', async () => {
            await engine.apply('ver.txt', {
                baseVersion: 0, actor: 'agent', intent: 'init',
                ops: [{ op: 'replace_content', content: 'hi' }],
            });
            assert.strictEqual(engine.getVersion('ver.txt'), 1);
        });
    });

    describe('loadVersions() / persistence', () => {
        it('persists versions to disk and reloads', async () => {
            await engine.apply('persist.txt', {
                baseVersion: 0, actor: 'agent', intent: 'init',
                ops: [{ op: 'replace_content', content: 'v1' }],
            });

            // New engine should load from disk
            const store2 = new ArtifactStore(tmpDir);
            const engine2 = new PatchEngine(tmpDir, store2);
            await engine2.loadVersions();
            assert.strictEqual(engine2.getVersion('persist.txt'), 1);
            store2.close();
        });
    });
});
```

**Step 2: Run tests — verify they fail**

```bash
yarn test:unit
```

Expected: compile errors (PatchEngine constructor signature changed).

**Step 3: Refactor PatchEngine**

Modify `extensions/openspace-core/src/node/patch-engine.ts` — change the constructor and `doWrite` section only:

1. **Constructor:** change signature from `constructor(private readonly workspaceRoot: string)` to `constructor(private readonly workspaceRoot: string, private readonly store: ArtifactStore)` and add import.
2. **Replace `doWrite` body:** instead of `fs.writeFileSync(absolutePath, nextContent, 'utf-8')`, call `await this.store.write(filePath, nextContent, { actor: request.actor as 'agent' | 'user', reason: request.intent })`.
3. **Replace `fs.existsSync` read with `store.read()`:** For `replace_lines`, replace `fs.readFileSync(absolutePath, 'utf-8')` with `(await this.store.read(filePath)).toString('utf-8')`. Wrap in try/catch for "file not found → empty string".
4. **Remove mkdir logic** from `doWrite` (ArtifactStore handles it).
5. **Remove the hand-rolled `writeQueues` Map** — ArtifactStore's p-queue handles serialization.
6. Keep `loadVersions()`, `saveVersions()`, `resolveSafePath()`, all error types, and op parsers unchanged.
7. Add `import { ArtifactStore } from './artifact-store';` at top.

Full refactored `apply()` inner `doWrite`:

```typescript
const doWrite = async (): Promise<PatchApplyResult> => {
    // Read current content (empty string for new files)
    let currentContent = '';
    try {
        const buf = await this.store.read(filePath);
        currentContent = buf.toString('utf-8');
    } catch {
        // file doesn't exist yet — ok for replace_content
    }

    // Apply operations
    let nextContent: string;
    if (parsed.type === 'replace_content') {
        nextContent = applyReplaceContent(parsed.ops[0] as ReplaceContentOp);
    } else {
        nextContent = applyReplaceLines(currentContent, parsed.ops as ReplaceLinesOp[]);
    }

    // Write via ArtifactStore (atomic, backed up, audited)
    await this.store.write(filePath, nextContent, {
        actor: (request.actor === 'user' ? 'user' : 'agent') as 'agent' | 'user',
        reason: request.intent,
    });

    // Increment version
    const nextVersion = currentVersion + 1;
    this.versions.set(filePath, nextVersion);
    await this.saveVersions();

    return {
        version: nextVersion,
        bytes: Buffer.byteLength(nextContent, 'utf-8'),
    };
};
```

Remove the `writeQueues` map and the chaining logic — just `return doWrite()` (ArtifactStore's queue handles serialization now).

**Step 4: Run tests — verify they pass**

```bash
yarn test:unit
```

Expected: 488 + ArtifactStore tests + PatchEngine tests. Should be 510+.

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/patch-engine.ts extensions/openspace-core/src/node/__tests__/patch-engine.spec.ts
git commit -m "refactor(T4): PatchEngine delegates writes to ArtifactStore"
```

---

### Task T4.2: Wire ArtifactStore into hub-mcp.ts file write tools

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`
- Modify: `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts`

**Goal:** Route `openspace.file.write` through `ArtifactStore` so all agent file writes get atomic protection. Also add a new `openspace.artifact.patch` MCP tool that exposes OCC-versioned patching.

**Step 1: Add ArtifactStore + PatchEngine to OpenSpaceMcpServer**

In `hub-mcp.ts`, locate the `OpenSpaceMcpServer` class constructor. Add:

```typescript
import { ArtifactStore } from './artifact-store';
import { PatchEngine } from './patch-engine';
```

Add private members:
```typescript
private artifactStore: ArtifactStore;
private patchEngine: PatchEngine;
```

In the constructor (or `initialize()` method), instantiate:
```typescript
this.artifactStore = new ArtifactStore(this.workspaceRoot);
this.patchEngine = new PatchEngine(this.workspaceRoot, this.artifactStore);
// Load persisted versions on startup
this.patchEngine.loadVersions().catch(err => console.error('[Hub] Failed to load patch versions:', err));
```

Add a `close()` method:
```typescript
close(): void {
    this.artifactStore.close();
}
```

**Step 2: Route openspace.file.write through ArtifactStore**

In `registerFileTools()`, change the `openspace.file.write` handler:

Before:
```typescript
const dir = path.dirname(resolved);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(resolved, args.content, 'utf-8');
return { content: [{ type: 'text', text: `Written ${resolved}` }] };
```

After:
```typescript
const relPath = path.relative(this.workspaceRoot, resolved);
await this.artifactStore.write(relPath, args.content, { actor: 'agent', reason: 'openspace.file.write MCP tool' });
return { content: [{ type: 'text', text: `Written ${resolved}` }] };
```

Change the handler to `async`.

**Step 3: Add openspace.artifact.patch MCP tool**

In `registerFileTools()`, add a new tool after `openspace.file.patch`:

```typescript
server.tool(
    'openspace.artifact.patch',
    'Apply an OCC-versioned patch to an artifact file. Provides atomic write with backup, audit log, and conflict detection.',
    {
        path: z.string().describe('File path relative to workspace root'),
        baseVersion: z.number().int().min(0).describe('Expected current version (0 if file is new). Get from getVersion first.'),
        actor: z.enum(['agent', 'user']).default('agent').describe('Who is applying the patch'),
        intent: z.string().describe('Human-readable description of the change'),
        ops: z.array(z.object({
            op: z.enum(['replace_content', 'replace_lines']),
            content: z.string().optional(),
            startLine: z.number().int().optional(),
            endLine: z.number().int().optional(),
        })).describe('Operations to apply. For replace_content: one op with content field. For replace_lines: one or more ops with startLine, endLine, content.'),
    },
    async (args: { path: string; baseVersion: number; actor: 'agent' | 'user'; intent: string; ops: unknown[] }) => {
        try {
            const resolved = this.resolveSafePath(args.path);
            if (isSensitiveFile(resolved)) {
                return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
            }
            const relPath = path.relative(this.workspaceRoot, resolved);
            const result = await this.patchEngine.apply(relPath, {
                baseVersion: args.baseVersion,
                actor: args.actor ?? 'agent',
                intent: args.intent,
                ops: args.ops,
            });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ version: result.version, bytes: result.bytes, path: relPath }),
                }],
            };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
    }
);
```

**Step 4: Write regression tests**

In `hub-mcp.spec.ts`, add a `describe('openspace.artifact.patch tool')` block verifying:
- Tool is registered
- Successful patch returns `{ version, bytes, path }`
- ConflictError returns `isError: true` with version conflict message
- Invalid path returns isError

Keep all 488 existing tests intact.

**Step 5: Run tests**

```bash
yarn test:unit
```

Expected: 488 + all new tests passing.

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts
git commit -m "feat(T4): wire ArtifactStore into file.write; add artifact.patch MCP tool"
```

---

### Task T4.3: Expose getVersion endpoint + instructions

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`
- Modify: `extensions/openspace-core/src/node/hub.ts`

**Goal:** Add `openspace.artifact.getVersion` MCP tool and update `generateInstructions()` to document both new tools.

**Step 1: Add getVersion tool to registerFileTools()**

```typescript
server.tool(
    'openspace.artifact.getVersion',
    'Get the current OCC version number for an artifact file. Use this before openspace.artifact.patch to get the baseVersion.',
    {
        path: z.string().describe('File path relative to workspace root'),
    },
    async (args: { path: string }) => {
        try {
            const resolved = this.resolveSafePath(args.path);
            const relPath = path.relative(this.workspaceRoot, resolved);
            const version = this.patchEngine.getVersion(relPath);
            return { content: [{ type: 'text', text: JSON.stringify({ path: relPath, version }) }] };
        } catch (err: unknown) {
            return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
        }
    }
);
```

**Step 2: Update generateInstructions() in hub.ts**

Find the file tools instruction block and add:

```
- `openspace.artifact.getVersion` — get current version for OCC (use before patching)
- `openspace.artifact.patch` — OCC-versioned atomic patch with backup and audit log
```

Add a usage note:
```
- For important artifact files (.whiteboard.json, .deck.md, critical configs), prefer openspace.artifact.patch over openspace.file.write — it provides atomic writes, backup history, and version conflict detection.
```

**Step 3: Run tests**

```bash
yarn test:unit
```

Expected: all tests still passing.

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts extensions/openspace-core/src/node/hub.ts
git commit -m "feat(T4): add artifact.getVersion tool and update agent instructions"
```

---

### Task T5.3: Update WORKPLAN.md

**Files:**
- Modify: `docs/architecture/WORKPLAN.md`

**Step 1: Mark T4 + T5 tasks complete**

Update WORKPLAN.md:
- Phase T4: mark T4.1 (PatchEngine refactor), T4.2 (HTTP route + MCP wiring), T4.3 (instructions) as ✅ COMPLETE
- Phase T5: mark T5.1 (deps), T5.2 (ArtifactStore), T5.3 (wiring) as ✅ COMPLETE
- Update "Next Task" pointer

**Step 2: Commit**

```bash
git add docs/architecture/WORKPLAN.md
git commit -m "docs: mark T4 + T5 complete in WORKPLAN"
```

---

### Task T5.4: Push branch

```bash
git push origin feature/phase-1-permission-ui
```

---

## Testing Cheatsheet

| Command | What it checks |
|---|---|
| `yarn test:unit` | All unit tests (must stay 488+) |
| `yarn build` | TypeScript compile (must stay clean) |

## Notes for Implementer

1. **p-queue v6 import quirk:** Always use `const PQueueCtor = ((PQueue as any).default || PQueue) as any` pattern. p-queue v6 ships as ESM but the CJS build wraps it — the `.default` fallback handles both.

2. **chokidar `persistent: false`** in ArtifactStore — this prevents the watcher from keeping the test process alive. Tests call `store.close()` in `afterEach`.

3. **Path normalization:** Always use `path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/')` for relative paths stored in the version map and audit log (Windows compatibility).

4. **ArtifactStore in tests:** Always call `store.close()` in `afterEach`. Always use a fresh `tmpDir` from `os.tmpdir()`.

5. **PatchEngine backward compat:** The `PatchEngine` constructor now requires `ArtifactStore` as second arg. Any existing code that constructs `PatchEngine` must be updated. Currently nothing imports PatchEngine — confirm with `grep -r "new PatchEngine" extensions/` before starting T4.1.

6. **Existing `openspace.file.patch`** (search-and-replace) remains unchanged. The new `openspace.artifact.patch` is a different, OCC-versioned tool alongside it.

