import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { validatePath } from '../path-validator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkspaceService(root: string) {
    return {
        tryGetRoots: () => [{
            resource: {
                path: {
                    fsPath: () => root
                }
            }
        }]
    } as any;
}

function makeLogger() {
    return {
        warn: sinon.stub(),
        error: sinon.stub(),
        info: sinon.stub(),
        debug: sinon.stub()
    } as any;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('path-validator', () => {
    const root = '/workspace';
    const opts = { logTag: '[Test]' };

    it('resolves a relative path within workspace', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('src/foo.ts', ws, makeLogger(), undefined, opts);
        expect(result).to.equal(path.join(root, 'src/foo.ts'));
    });

    it('accepts an absolute path inside workspace', async () => {
        const ws = makeWorkspaceService(root);
        const abs = path.join(root, 'src/bar.ts');
        const result = await validatePath(abs, ws, makeLogger(), undefined, opts);
        expect(result).to.equal(abs);
    });

    it('rejects a path containing .. (traversal)', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('../etc/shadow', ws, makeLogger(), undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects an absolute path outside the workspace', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('/etc/passwd', ws, makeLogger(), undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects /tmp/malicious path', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('/tmp/malicious.ts', ws, makeLogger(), undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects relative traversal ../../etc/shadow', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('../../etc/shadow', ws, makeLogger(), undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects .env as a sensitive file', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('.env', ws, makeLogger(), undefined, opts);
        expect(result).to.be.null;
    });

    it('allows .env when skipSensitiveCheck is true', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('.env', ws, makeLogger(), undefined, { logTag: '[Test]', skipSensitiveCheck: true });
        expect(result).to.equal(path.join(root, '.env'));
    });

    it('returns null when workspace has no roots', async () => {
        const ws = { tryGetRoots: () => [] } as any;
        const result = await validatePath('src/foo.ts', ws, makeLogger(), undefined, opts);
        expect(result).to.be.null;
    });

    it('uses openCodeService to validate symlinks when provided', async () => {
        const ws = makeWorkspaceService(root);
        const resolvedPath = path.join(root, 'src/foo.ts');
        const openCodeService = {
            validatePath: sinon.stub().resolves({ valid: true, resolvedPath })
        } as any;
        const result = await validatePath('src/foo.ts', ws, makeLogger(), openCodeService, opts);
        expect(result).to.equal(resolvedPath);
        expect(openCodeService.validatePath.calledOnce).to.be.true;
    });

    it('rejects when openCodeService reports symlink outside workspace', async () => {
        const ws = makeWorkspaceService(root);
        const openCodeService = {
            validatePath: sinon.stub().resolves({ valid: false, error: 'symlink escapes workspace' })
        } as any;
        const result = await validatePath('src/link.ts', ws, makeLogger(), openCodeService, opts);
        expect(result).to.be.null;
    });
});
