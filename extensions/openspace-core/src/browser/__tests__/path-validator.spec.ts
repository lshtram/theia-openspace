import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { validatePath } from '../path-validator';
import { OpenCodeService } from '../../common/opencode-protocol';
import { ILogger } from '@theia/core/lib/common/logger';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockWorkspaceRoot {
    resource: {
        path: {
            fsPath: () => string;
        };
    };
}

interface MockWorkspaceService {
    tryGetRoots: () => MockWorkspaceRoot[];
}

interface MockLogger {
    warn: sinon.SinonStub;
    error: sinon.SinonStub;
    info: sinon.SinonStub;
    debug: sinon.SinonStub;
}

function makeWorkspaceService(root: string): MockWorkspaceService {
    return {
        tryGetRoots: () => [{
            resource: {
                path: {
                    fsPath: () => root
                }
            }
        }]
    };
}

function makeLogger(): MockLogger {
    return {
        warn: sinon.stub(),
        error: sinon.stub(),
        info: sinon.stub(),
        debug: sinon.stub()
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('path-validator', () => {
    const root = '/workspace';
    const opts = { logTag: '[Test]' };

    it('resolves a relative path within workspace', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('src/foo.ts', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.equal(path.join(root, 'src/foo.ts'));
    });

    it('accepts an absolute path inside workspace', async () => {
        const ws = makeWorkspaceService(root);
        const abs = path.join(root, 'src/bar.ts');
        const result = await validatePath(abs, ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.equal(abs);
    });

    it('rejects a path containing .. (traversal)', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('../etc/shadow', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects an absolute path outside the workspace', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('/etc/passwd', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects /tmp/malicious path', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('/tmp/malicious.ts', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects relative traversal ../../etc/shadow', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('../../etc/shadow', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.be.null;
    });

    it('rejects .env as a sensitive file', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('.env', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.be.null;
    });

    it('allows .env when skipSensitiveCheck is true', async () => {
        const ws = makeWorkspaceService(root);
        const result = await validatePath('.env', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, { logTag: '[Test]', skipSensitiveCheck: true });
        expect(result).to.equal(path.join(root, '.env'));
    });

    it('returns null when workspace has no roots', async () => {
        const ws: MockWorkspaceService = { tryGetRoots: () => [] };
        const result = await validatePath('src/foo.ts', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, undefined, opts);
        expect(result).to.be.null;
    });

    it('uses openCodeService to validate symlinks when provided', async () => {
        const ws = makeWorkspaceService(root);
        const resolvedPath = path.join(root, 'src/foo.ts');
        const openCodeService: OpenCodeService = {
            validatePath: sinon.stub().resolves({ valid: true, resolvedPath })
        } as unknown as OpenCodeService;
        const result = await validatePath('src/foo.ts', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, openCodeService, opts);
        expect(result).to.equal(resolvedPath);
        expect((openCodeService.validatePath as unknown as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('rejects when openCodeService reports symlink outside workspace', async () => {
        const ws = makeWorkspaceService(root);
        const openCodeService: OpenCodeService = {
            validatePath: sinon.stub().resolves({ valid: false, error: 'symlink escapes workspace' })
        } as unknown as OpenCodeService;
        const result = await validatePath('src/link.ts', ws as unknown as WorkspaceService, makeLogger() as unknown as ILogger, openCodeService, opts);
        expect(result).to.be.null;
    });
});
