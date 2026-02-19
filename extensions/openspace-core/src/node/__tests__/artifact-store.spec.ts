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

        it('serializes concurrent writes to the same file (FIFO)', async () => {
            const completed: number[] = [];
            const p1 = store.write('serial.txt', 'first', { actor: 'agent', reason: 'test' })
                .then(() => completed.push(1));
            const p2 = store.write('serial.txt', 'second', { actor: 'agent', reason: 'test' })
                .then(() => completed.push(2));
            await Promise.all([p1, p2]);
            // Queue is FIFO with concurrency 1: both complete, second wins final content
            assert.strictEqual(completed.length, 2);
            const content = fs.readFileSync(path.join(tmpDir, 'serial.txt'), 'utf-8');
            assert.strictEqual(content, 'second', 'Second write (enqueued after first) should be final content');
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
