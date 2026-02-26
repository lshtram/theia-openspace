/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P3-B: Line Comments on Diffs.
 *
 * CommentsService — an in-memory service for storing per-file line comments,
 * persisted per session with a 20-session LRU.
 *
 * Imported directly from TypeScript source (pure class, no DI).
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CommentsService } from '../comments-service';

// ─── P3-B: CommentsService ────────────────────────────────────────────────────

describe('P3-B: CommentsService', () => {
    afterEach(() => { sinon.restore(); });

    it('starts with no comments for any file', () => {
        const svc = new CommentsService();
        expect(svc.list('src/auth.ts')).to.deep.equal([]);
    });

    it('adds a line comment via add()', () => {
        const svc = new CommentsService();
        const comment = svc.add({
            file: 'src/auth.ts',
            selection: { startLine: 10, endLine: 12 },
            comment: 'Why is this here?',
        });
        expect(comment.id).to.be.a('string').with.length.greaterThan(0);
        expect(comment.time).to.be.a('number');
        expect(comment.comment).to.equal('Why is this here?');
    });

    it('list() returns all comments for a specific file', () => {
        const svc = new CommentsService();
        svc.add({ file: 'src/auth.ts', selection: { startLine: 5, endLine: 5 }, comment: 'Note A' });
        svc.add({ file: 'src/auth.ts', selection: { startLine: 10, endLine: 10 }, comment: 'Note B' });
        svc.add({ file: 'src/utils.ts', selection: { startLine: 1, endLine: 1 }, comment: 'Other file' });
        const comments = svc.list('src/auth.ts');
        expect(comments).to.have.length(2);
    });

    it('all() returns all comments across all files', () => {
        const svc = new CommentsService();
        svc.add({ file: 'src/a.ts', selection: { startLine: 1, endLine: 1 }, comment: 'A' });
        svc.add({ file: 'src/b.ts', selection: { startLine: 2, endLine: 3 }, comment: 'B' });
        expect(svc.all()).to.have.length(2);
    });

    it('remove(file, id) removes a specific comment', () => {
        const svc = new CommentsService();
        const c = svc.add({ file: 'src/auth.ts', selection: { startLine: 1, endLine: 1 }, comment: 'Remove me' });
        svc.remove('src/auth.ts', c.id);
        expect(svc.list('src/auth.ts')).to.have.length(0);
    });

    it('fires onCommentsChanged event when a comment is added', () => {
        const svc = new CommentsService();
        const cb = sinon.stub();
        svc.onCommentsChanged(cb);
        svc.add({ file: 'src/auth.ts', selection: { startLine: 1, endLine: 1 }, comment: 'Test' });
        expect(cb.calledOnce).to.be.true;
    });

    it('fires onCommentsChanged event when a comment is removed', () => {
        const svc = new CommentsService();
        const c = svc.add({ file: 'src/auth.ts', selection: { startLine: 1, endLine: 1 }, comment: 'Test' });
        const cb = sinon.stub();
        svc.onCommentsChanged(cb);
        svc.remove('src/auth.ts', c.id);
        expect(cb.calledOnce).to.be.true;
    });

    it('remove() ignores unknown file or id gracefully', () => {
        const svc = new CommentsService();
        svc.add({ file: 'src/auth.ts', selection: { startLine: 1, endLine: 1 }, comment: 'Keep' });
        // Should not throw
        expect(() => svc.remove('src/auth.ts', 'unknown-id')).to.not.throw();
        expect(() => svc.remove('nonexistent.ts', 'any-id')).to.not.throw();
        expect(svc.all()).to.have.length(1);
    });

    it('comments include selection range', () => {
        const svc = new CommentsService();
        const c = svc.add({
            file: 'src/auth.ts',
            selection: { startLine: 5, endLine: 8 },
            comment: 'Ranged comment',
        });
        expect(c.selection.startLine).to.equal(5);
        expect(c.selection.endLine).to.equal(8);
    });
});
