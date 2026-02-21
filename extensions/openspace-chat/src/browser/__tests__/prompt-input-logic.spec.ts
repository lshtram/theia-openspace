/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for buildRequestParts (build-request-parts.ts) and
 * parseFromDOM (parse-from-dom.ts) — pure functions with no DI dependencies.
 * Imported directly from TypeScript source (no compiled lib needed).
 */

import { expect } from 'chai';
import { buildRequestParts } from '../prompt-input/build-request-parts';
import { parseFromDOM } from '../prompt-input/parse-from-dom';
import type { Prompt } from '../prompt-input/types';

// ─── buildRequestParts ────────────────────────────────────────────────────────

describe('buildRequestParts', () => {
    const ROOT = '/workspace/project';

    it('returns empty array for empty prompt', () => {
        const result = buildRequestParts([], ROOT);
        expect(result).to.deep.equal([]);
    });

    it('returns single text part for plain text prompt', () => {
        const prompt: Prompt = [{ type: 'text', content: 'hello world', start: 0, end: 11 }];
        const result = buildRequestParts(prompt, ROOT);
        expect(result).to.deep.equal([{ type: 'text', text: 'hello world' }]);
    });

    it('merges adjacent text parts', () => {
        const prompt: Prompt = [
            { type: 'text', content: 'foo ', start: 0, end: 4 },
            { type: 'text', content: 'bar', start: 4, end: 7 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result).to.deep.equal([{ type: 'text', text: 'foo bar' }]);
    });

    it('produces file:// URL for absolute path', () => {
        const prompt: Prompt = [
            { type: 'file', path: '/abs/path/to/file.ts', content: '@file.ts', start: 0, end: 8 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result).to.have.length(1);
        const part = result[0] as any;
        expect(part.type).to.equal('file');
        expect(part.url).to.equal('file:///abs/path/to/file.ts');
        expect(part.mime).to.equal('text/plain');
        expect(part.filename).to.equal('file.ts');
    });

    it('resolves relative path against workspaceRoot', () => {
        const prompt: Prompt = [
            { type: 'file', path: 'src/utils.ts', content: '@utils.ts', start: 0, end: 9 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        const part = result[0] as any;
        expect(part.url).to.equal('file:///workspace/project/src/utils.ts');
    });

    it('strips trailing slash from workspaceRoot when resolving relative path', () => {
        const prompt: Prompt = [
            { type: 'file', path: 'main.ts', content: '@main.ts', start: 0, end: 8 }
        ];
        const result = buildRequestParts(prompt, '/workspace/project/');
        const part = result[0] as any;
        expect(part.url).to.equal('file:///workspace/project/main.ts');
    });

    it('appends selection query string when selection present', () => {
        const prompt: Prompt = [
            {
                type: 'file', path: '/src/app.ts', content: '@app.ts',
                start: 0, end: 7,
                selection: { startLine: 10, endLine: 20 }
            }
        ];
        const result = buildRequestParts(prompt, ROOT);
        const part = result[0] as any;
        expect(part.url).to.include('?start=10&end=20');
    });

    it('does not append query string when no selection', () => {
        const prompt: Prompt = [
            { type: 'file', path: '/src/app.ts', content: '@app.ts', start: 0, end: 7 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        const part = result[0] as any;
        expect(part.url).to.not.include('?');
    });

    it('emits agent part for agent mention', () => {
        const prompt: Prompt = [
            { type: 'agent', name: 'oracle', content: '@oracle', start: 0, end: 7 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result).to.deep.equal([{ type: 'agent', name: 'oracle' }]);
    });

    it('flushes text before agent part', () => {
        const prompt: Prompt = [
            { type: 'text', content: 'ask ', start: 0, end: 4 },
            { type: 'agent', name: 'oracle', content: '@oracle', start: 4, end: 11 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result[0]).to.deep.equal({ type: 'text', text: 'ask ' });
        expect(result[1]).to.deep.equal({ type: 'agent', name: 'oracle' });
    });

    it('flushes text before file part', () => {
        const prompt: Prompt = [
            { type: 'text', content: 'see ', start: 0, end: 4 },
            { type: 'file', path: '/a.ts', content: '@a.ts', start: 4, end: 9 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result[0]).to.deep.equal({ type: 'text', text: 'see ' });
        expect((result[1] as any).type).to.equal('file');
    });

    it('handles image part as file with data URL', () => {
        const prompt: Prompt = [
            {
                type: 'image', id: 'img-1', filename: 'photo.png',
                mime: 'image/png', dataUrl: 'data:image/png;base64,abc123'
            }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result).to.have.length(1);
        const part = result[0] as any;
        expect(part.type).to.equal('file');
        expect(part.mime).to.equal('image/png');
        expect(part.url).to.equal('data:image/png;base64,abc123');
        expect(part.filename).to.equal('photo.png');
    });

    it('handles Windows absolute path (C:/ style)', () => {
        const prompt: Prompt = [
            { type: 'file', path: 'C:\\Users\\dev\\file.ts', content: '@file.ts', start: 0, end: 8 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        const part = result[0] as any;
        // Windows path should not have workspaceRoot prepended
        expect(part.url).to.match(/C(%3A|:)/); // colon may be percent-encoded
    });

    it('percent-encodes spaces in file path', () => {
        const prompt: Prompt = [
            { type: 'file', path: '/my project/src/file.ts', content: '@file.ts', start: 0, end: 8 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        const part = result[0] as any;
        expect(part.url).to.include('my%20project');
    });

    it('returns text part at end after file part', () => {
        const prompt: Prompt = [
            { type: 'file', path: '/a.ts', content: '@a.ts', start: 0, end: 5 },
            { type: 'text', content: ' please review', start: 5, end: 19 }
        ];
        const result = buildRequestParts(prompt, ROOT);
        expect(result).to.have.length(2);
        expect((result[1] as any)).to.deep.equal({ type: 'text', text: ' please review' });
    });
});

// ─── parseFromDOM ─────────────────────────────────────────────────────────────

describe('parseFromDOM', () => {
    function makeEditor(html: string): HTMLElement {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div;
    }

    it('returns empty array for empty editor', () => {
        const editor = makeEditor('');
        expect(parseFromDOM(editor)).to.deep.equal([]);
    });

    it('parses plain text node', () => {
        const editor = makeEditor('hello world');
        const result = parseFromDOM(editor);
        expect(result).to.have.length(1);
        expect(result[0].type).to.equal('text');
        expect((result[0] as any).content).to.equal('hello world');
    });

    it('strips zero-width spaces from text', () => {
        const editor = makeEditor('foo\u200Bbar');
        const result = parseFromDOM(editor);
        expect((result[0] as any).content).to.equal('foobar');
    });

    it('converts BR to newline', () => {
        const editor = makeEditor('line1<br>line2');
        const result = parseFromDOM(editor);
        // Should accumulate as single text with \n
        const text = result.map((p: any) => p.content ?? p.text ?? '').join('');
        expect(text).to.include('\n');
    });

    it('parses file pill span', () => {
        const editor = makeEditor('<span data-type="file" data-path="/src/app.ts">@app.ts</span>');
        const result = parseFromDOM(editor);
        expect(result).to.have.length(1);
        expect(result[0].type).to.equal('file');
        expect((result[0] as any).path).to.equal('/src/app.ts');
        expect((result[0] as any).content).to.equal('@app.ts');
    });

    it('parses file pill span with line selection', () => {
        const editor = makeEditor(
            '<span data-type="file" data-path="/a.ts" data-start-line="5" data-end-line="15">@a.ts</span>'
        );
        const result = parseFromDOM(editor);
        const part = result[0] as any;
        expect(part.selection).to.deep.equal({ startLine: 5, endLine: 15 });
    });

    it('parses agent pill span', () => {
        const editor = makeEditor('<span data-type="agent" data-name="oracle">@oracle</span>');
        const result = parseFromDOM(editor);
        expect(result).to.have.length(1);
        expect(result[0].type).to.equal('agent');
        expect((result[0] as any).name).to.equal('oracle');
    });

    it('parses text + file pill + text', () => {
        const editor = makeEditor('see <span data-type="file" data-path="/f.ts">@f.ts</span> please');
        const result = parseFromDOM(editor);
        expect(result).to.have.length(3);
        expect(result[0].type).to.equal('text');
        expect(result[1].type).to.equal('file');
        expect(result[2].type).to.equal('text');
    });

    it('tracks character offsets', () => {
        const editor = makeEditor('abc');
        const result = parseFromDOM(editor);
        const part = result[0] as any;
        expect(part.start).to.equal(0);
        expect(part.end).to.equal(3);
    });

    it('offsets accumulate across parts', () => {
        const editor = makeEditor('ab<span data-type="agent" data-name="x">@x</span>cd');
        const result = parseFromDOM(editor);
        expect((result[0] as any).start).to.equal(0);
        expect((result[0] as any).end).to.equal(2);
        expect((result[1] as any).start).to.equal(2);
        expect((result[1] as any).end).to.equal(4);
        expect((result[2] as any).start).to.equal(4);
        expect((result[2] as any).end).to.equal(6);
    });

    it('recurses into nested divs', () => {
        const editor = makeEditor('<div>nested text</div>');
        const result = parseFromDOM(editor);
        expect(result).to.have.length(1);
        expect((result[0] as any).content).to.equal('nested text');
    });
});
