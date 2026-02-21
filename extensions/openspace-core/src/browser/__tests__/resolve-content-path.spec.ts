import { expect } from 'chai';
import { resolveContentPath } from '../resolve-content-path';

describe('resolveContentPath', () => {
    const workspaceRoot = 'file:///workspace';

    // ─── Valid paths within workspace ────────────────────────────────────────

    it('prepends configured folder when given bare filename', () => {
        const result = resolveContentPath('myboard', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/openspace/whiteboards/myboard.whiteboard.json');
    });

    it('does not double-add extension if already present', () => {
        const result = resolveContentPath('myboard.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/openspace/whiteboards/myboard.whiteboard.json');
    });

    it('treats path with directory separator as relative, resolves under workspace root', () => {
        const result = resolveContentPath('subdir/myboard', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/subdir/myboard.whiteboard.json');
    });

    it('resolves file:// absolute path within workspace', () => {
        const abs = 'file:///workspace/subdir/test.whiteboard.json';
        const result = resolveContentPath(abs, 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal(abs);
    });

    // ─── Task 5: Path traversal prevention ───────────────────────────────────

    it('throws for absolute /unix path outside workspace (/tmp/...)', () => {
        expect(() =>
            resolveContentPath('/tmp/test.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json')
        ).to.throw(/escapes workspace root/);
    });

    it('throws for /etc/passwd path traversal', () => {
        expect(() =>
            resolveContentPath('/etc/passwd', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json')
        ).to.throw(/escapes workspace root/);
    });

    it('throws for absolute file:// path outside workspace', () => {
        expect(() =>
            resolveContentPath('file:///some/other/place/test.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json')
        ).to.throw(/escapes workspace root/);
    });

    it('throws for relative path traversal ../../etc/shadow', () => {
        expect(() =>
            resolveContentPath('../../etc/shadow', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json')
        ).to.throw(/escapes workspace root/);
    });

    it('throws for /tmp/malicious path', () => {
        expect(() =>
            resolveContentPath('/tmp/malicious.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json')
        ).to.throw(/escapes workspace root/);
    });

    it('allows valid relative subdirectory path within workspace', () => {
        const result = resolveContentPath('valid/file.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/valid/file.whiteboard.json');
    });
});
