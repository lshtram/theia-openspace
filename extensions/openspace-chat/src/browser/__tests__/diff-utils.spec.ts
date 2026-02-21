/**
 * Unit tests for computeSimpleDiff and computeLCS (diff-utils.ts).
 * Imported directly from TypeScript source — pure functions, no DI dependencies.
 */

import { expect } from 'chai';
import { computeLCS, computeSimpleDiff } from '../diff-utils';

// ─── computeLCS ───────────────────────────────────────────────────────────────

describe('computeLCS', () => {
    it('returns empty array for two empty arrays', () => {
        expect(computeLCS([], [])).to.deep.equal([]);
    });

    it('returns empty array when no common elements', () => {
        expect(computeLCS(['a', 'b'], ['c', 'd'])).to.deep.equal([]);
    });

    it('returns all elements when inputs are identical', () => {
        expect(computeLCS(['a', 'b', 'c'], ['a', 'b', 'c'])).to.deep.equal(['a', 'b', 'c']);
    });

    it('returns correct LCS for classic example', () => {
        // LCS of [a,b,c,d] and [b,c,d,e] is [b,c,d]
        expect(computeLCS(['a', 'b', 'c', 'd'], ['b', 'c', 'd', 'e'])).to.deep.equal(['b', 'c', 'd']);
    });

    it('handles single common element', () => {
        expect(computeLCS(['x', 'a', 'y'], ['z', 'a', 'w'])).to.deep.equal(['a']);
    });

    it('works with code-like lines', () => {
        const a = ['const x = 1;', 'const y = 2;', 'return x + y;'];
        const b = ['const x = 1;', 'const z = 3;', 'return x + y;'];
        const lcs = computeLCS(a, b);
        expect(lcs).to.include('const x = 1;');
        expect(lcs).to.include('return x + y;');
        expect(lcs).to.not.include('const y = 2;');
        expect(lcs).to.not.include('const z = 3;');
    });
});

// ─── computeSimpleDiff ────────────────────────────────────────────────────────

describe('computeSimpleDiff', () => {
    it('returns empty lines for two empty strings', () => {
        const result = computeSimpleDiff('', '');
        expect(result.additions).to.equal(0);
        expect(result.deletions).to.equal(0);
    });

    it('marks all lines as ctx when texts are identical', () => {
        const result = computeSimpleDiff('line1\nline2', 'line1\nline2');
        expect(result.lines.every(l => l.type === 'ctx')).to.be.true;
        expect(result.additions).to.equal(0);
        expect(result.deletions).to.equal(0);
    });

    it('marks added lines with type add', () => {
        const result = computeSimpleDiff('', 'new line');
        expect(result.lines.some(l => l.type === 'add' && l.text === 'new line')).to.be.true;
        expect(result.additions).to.be.greaterThan(0);
        // empty string splits to [''], so the empty line counts as a deletion
    });

    it('marks deleted lines with type del', () => {
        const result = computeSimpleDiff('old line', '');
        expect(result.lines.some(l => l.type === 'del' && l.text === 'old line')).to.be.true;
        expect(result.deletions).to.be.greaterThan(0);
        // empty string splits to [''], so the empty line counts as an addition
    });

    it('produces ctx + del + add for line change', () => {
        const result = computeSimpleDiff('keep\nold', 'keep\nnew');
        const types = result.lines.map(l => l.type);
        expect(types).to.include('ctx');
        expect(types).to.include('del');
        expect(types).to.include('add');
    });

    it('counts additions and deletions correctly', () => {
        const result = computeSimpleDiff('a\nb\nc', 'a\nd\nc');
        expect(result.additions).to.equal(1);
        expect(result.deletions).to.equal(1);
    });

    it('falls back to full replacement for large inputs (>2000 combined lines)', () => {
        const bigOld = Array(1001).fill('old line').join('\n');
        const bigNew = Array(1001).fill('new line').join('\n');
        const result = computeSimpleDiff(bigOld, bigNew);
        expect(result.lines.every(l => l.type === 'del' || l.type === 'add')).to.be.true;
        // No ctx lines in fallback
        expect(result.lines.some(l => l.type === 'ctx')).to.be.false;
    });

    it('addition and deletion counters are correct in fallback', () => {
        const bigOld = Array(1001).fill('x').join('\n');
        const bigNew = Array(1001).fill('y').join('\n');
        const result = computeSimpleDiff(bigOld, bigNew);
        expect(result.deletions).to.equal(1001);
        expect(result.additions).to.equal(1001);
    });

    it('handles single-line no-change', () => {
        const result = computeSimpleDiff('hello', 'hello');
        expect(result.lines).to.have.length(1);
        expect(result.lines[0].type).to.equal('ctx');
    });

    it('preserves line text accurately', () => {
        const result = computeSimpleDiff('foo\nbar', 'foo\nbaz');
        const del = result.lines.find(l => l.type === 'del');
        const add = result.lines.find(l => l.type === 'add');
        expect(del?.text).to.equal('bar');
        expect(add?.text).to.equal('baz');
    });
});
