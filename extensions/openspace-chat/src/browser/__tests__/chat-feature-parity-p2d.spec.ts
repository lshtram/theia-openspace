/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P2-D: Split diff view toggle.
 *
 * computeSplitDiff — a new export from diff-utils.ts that produces a
 * side-by-side diff structure (SplitDiffLine[]).
 *
 * ToolBlock — the diff header should have a [Unified | Split] toggle button
 * when a diff is present; clicking changes the view class.
 *
 * Imports computeSplitDiff directly from TS source.
 * Imports compiled lib for the ToolBlock React component.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';
import { computeSplitDiff } from '../diff-utils';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { MessageBubble } = _require('openspace-chat/lib/browser/message-bubble/message-bubble') as {
    MessageBubble: React.FC<any>;
};

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── P2-D: computeSplitDiff ───────────────────────────────────────────────────

describe('P2-D: computeSplitDiff', () => {

    it('is exported from diff-utils', () => {
        expect(computeSplitDiff).to.be.a('function');
    });

    it('returns empty array for two identical empty strings', () => {
        const result = computeSplitDiff('', '');
        expect(result).to.deep.equal([]);
    });

    it('returns empty array for two identical non-empty strings', () => {
        const result = computeSplitDiff('line1\nline2', 'line1\nline2');
        expect(result).to.be.an('array');
        // All context lines — no deletions or additions
        result.forEach((row: any) => {
            if (row.left) expect(row.left.type).to.equal('ctx');
            if (row.right) expect(row.right.type).to.equal('ctx');
        });
    });

    it('produces rows with left.type=del for deleted lines', () => {
        const oldText = 'alpha\nbeta\ngamma';
        const newText = 'alpha\ngamma';
        const result = computeSplitDiff(oldText, newText);
        const delRows = result.filter((r: any) => r.left?.type === 'del');
        expect(delRows.length).to.be.greaterThan(0);
        expect(delRows.some((r: any) => r.left.text === 'beta')).to.be.true;
    });

    it('produces rows with right.type=add for added lines', () => {
        const oldText = 'alpha\ngamma';
        const newText = 'alpha\nbeta\ngamma';
        const result = computeSplitDiff(oldText, newText);
        const addRows = result.filter((r: any) => r.right?.type === 'add');
        expect(addRows.length).to.be.greaterThan(0);
        expect(addRows.some((r: any) => r.right.text === 'beta')).to.be.true;
    });

    it('includes line numbers on left side (del and ctx)', () => {
        const result = computeSplitDiff('a\nb\nc', 'a\nc');
        const rowsWithLeft = result.filter((r: any) => r.left);
        rowsWithLeft.forEach((r: any) => {
            expect(r.left.lineNo).to.be.a('number');
            expect(r.left.lineNo).to.be.greaterThan(0);
        });
    });

    it('includes line numbers on right side (add and ctx)', () => {
        const result = computeSplitDiff('a\nc', 'a\nb\nc');
        const rowsWithRight = result.filter((r: any) => r.right);
        rowsWithRight.forEach((r: any) => {
            expect(r.right.lineNo).to.be.a('number');
            expect(r.right.lineNo).to.be.greaterThan(0);
        });
    });
});

// ─── P2-D: ToolBlock split/unified toggle ────────────────────────────────────

function makeToolPartWithDiff(oldContent: string, newContent: string): any {
    return {
        type: 'tool',
        tool: 'write_file',
        id: 'tool-1',
        state: {
            type: 'result',
            title: 'Write file',
            metadata: { filename: 'src/app.ts' },
            output: JSON.stringify({ old: oldContent, new: newContent }),
        },
    };
}

function makeMessage(parts: any[]): any {
    return {
        id: 'msg-1', role: 'assistant', parts,
        time: { created: new Date().toISOString() }, metadata: {},
    };
}

describe('P2-D: ToolBlock unified/split diff toggle', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders a .diff-style-toggle button when a diff is displayed in a tool block', () => {
        const msg = makeMessage([makeToolPartWithDiff('old line\n', 'new line\n')]);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(React.createElement(MessageBubble, { message: msg, isUser: false, isStreaming: false }));
        });

        // Expand the tool block first (if collapsed by default)
        const toolHeader = container.querySelector('.tool-block-header') as HTMLElement;
        if (toolHeader) { act(() => { toolHeader.click(); }); }

        expect(container.querySelector('.diff-style-toggle')).to.not.be.null;
        act(() => root.unmount()); container.remove();
    });

    it('starts in unified view mode (.diff-view--unified)', () => {
        const msg = makeMessage([makeToolPartWithDiff('old line\n', 'new line\n')]);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(React.createElement(MessageBubble, { message: msg, isUser: false, isStreaming: false }));
        });

        const toolHeader = container.querySelector('.tool-block-header') as HTMLElement;
        if (toolHeader) { act(() => { toolHeader.click(); }); }

        expect(container.querySelector('.diff-view--unified')).to.not.be.null;
        expect(container.querySelector('.diff-view--split')).to.be.null;
        act(() => root.unmount()); container.remove();
    });

    it('switches to split view (.diff-view--split) when toggle is clicked', () => {
        const msg = makeMessage([makeToolPartWithDiff('old line\n', 'new line\n')]);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(React.createElement(MessageBubble, { message: msg, isUser: false, isStreaming: false }));
        });

        const toolHeader = container.querySelector('.tool-block-header') as HTMLElement;
        if (toolHeader) { act(() => { toolHeader.click(); }); }

        const toggle = container.querySelector('.diff-style-toggle') as HTMLElement;
        act(() => { toggle.click(); });

        expect(container.querySelector('.diff-view--split')).to.not.be.null;
        expect(container.querySelector('.diff-view--unified')).to.be.null;
        act(() => root.unmount()); container.remove();
    });
});
