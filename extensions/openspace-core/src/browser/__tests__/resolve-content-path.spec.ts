import { expect } from 'chai';
import { resolveContentPath } from '../resolve-content-path';

describe('resolveContentPath', () => {
    const workspaceRoot = 'file:///workspace';

    it('prepends configured folder when given bare filename', () => {
        const result = resolveContentPath('myboard', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/openspace/whiteboards/myboard.whiteboard.json');
    });

    it('does not double-add extension if already present', () => {
        const result = resolveContentPath('myboard.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/openspace/whiteboards/myboard.whiteboard.json');
    });

    it('passes through absolute file:// paths unchanged', () => {
        const abs = 'file:///some/other/place/test.whiteboard.json';
        const result = resolveContentPath(abs, 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal(abs);
    });

    it('passes through absolute /unix paths unchanged', () => {
        const abs = '/tmp/test.whiteboard.json';
        const result = resolveContentPath(abs, 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal(abs);
    });

    it('treats path with directory separator as relative, resolves under workspace root', () => {
        const result = resolveContentPath('subdir/myboard', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/subdir/myboard.whiteboard.json');
    });
});
