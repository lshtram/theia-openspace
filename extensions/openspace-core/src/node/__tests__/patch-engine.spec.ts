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
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'patch-engine-test-')));
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

        it('returns currentVersion in ConflictError', async () => {
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

        it('enforces OCC under concurrent applies (second must fail or serialize)', async () => {
            // Both start with baseVersion 0
            const p1 = engine.apply('concurrent.txt', {
                baseVersion: 0, actor: 'agent', intent: 'first',
                ops: [{ op: 'replace_content', content: 'first' }],
            });
            const p2 = engine.apply('concurrent.txt', {
                baseVersion: 0, actor: 'agent', intent: 'second',
                ops: [{ op: 'replace_content', content: 'second' }],
            });
            // One should succeed, one should throw ConflictError
            const results = await Promise.allSettled([p1, p2]);
            const fulfilled = results.filter(r => r.status === 'fulfilled');
            const rejected = results.filter(r => r.status === 'rejected');
            assert.strictEqual(fulfilled.length, 1, 'exactly one should succeed');
            assert.strictEqual(rejected.length, 1, 'exactly one should fail');
            const reason = (rejected[0] as PromiseRejectedResult).reason;
            assert.ok(reason instanceof ConflictError, 'rejection should be ConflictError');
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
