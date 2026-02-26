/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P2-A and P2-B.
 *
 * P2-A: File attachment line range UI — when a FilePart has a `selection`,
 *       the PromptContextItems panel shows the line range badge.
 *
 * P2-B: PromptContextItems panel — a new component that renders attached file
 *       context items with path, optional line range, and a remove button.
 *
 * These tests import the new component directly from TypeScript source.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { PromptContextItems } from '../prompt-input/prompt-context-items';

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFileItem(path: string, selection?: { startLine: number; endLine: number }) {
    return { key: path, type: 'file' as const, path, selection };
}

function mountContextItems(items: any[], onRemove = sinon.stub()) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(PromptContextItems, { items, onRemove }));
    });
    return {
        container,
        onRemove,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

// ─── P2-B: PromptContextItems panel ──────────────────────────────────────────

describe('P2-B: PromptContextItems panel', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders nothing when items array is empty', () => {
        const { container, unmount } = mountContextItems([]);
        // Should render nothing or an empty wrapper with no visible items
        expect(container.querySelectorAll('.context-item').length).to.equal(0);
        unmount();
    });

    it('renders one .context-item per file item', () => {
        const items = [makeFileItem('src/auth.ts'), makeFileItem('src/utils.ts')];
        const { container, unmount } = mountContextItems(items);
        expect(container.querySelectorAll('.context-item').length).to.equal(2);
        unmount();
    });

    it('shows the filename (basename) in each context item', () => {
        const items = [makeFileItem('src/components/Button.tsx')];
        const { container, unmount } = mountContextItems(items);
        const item = container.querySelector('.context-item');
        expect(item!.textContent).to.include('Button.tsx');
        unmount();
    });

    it('shows a remove × button for each item', () => {
        const items = [makeFileItem('src/auth.ts')];
        const { container, unmount } = mountContextItems(items);
        expect(container.querySelector('.context-item-remove')).to.not.be.null;
        unmount();
    });

    it('calls onRemove with the item key when × is clicked', () => {
        const onRemove = sinon.stub();
        const items = [makeFileItem('src/auth.ts')];
        const { container, unmount } = mountContextItems(items, onRemove);

        const removeBtn = container.querySelector('.context-item-remove') as HTMLElement;
        act(() => { removeBtn.click(); });

        expect(onRemove.calledOnce).to.be.true;
        expect(onRemove.firstCall.args[0]).to.equal('src/auth.ts');
        unmount();
    });
});

// ─── P2-A: File attachment line range in context items panel ─────────────────

describe('P2-A: File attachment line range display in PromptContextItems', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('shows a line range badge when selection is present', () => {
        const items = [makeFileItem('src/auth.ts', { startLine: 10, endLine: 25 })];
        const { container, unmount } = mountContextItems(items);
        const badge = container.querySelector('.context-item-range');
        expect(badge).to.not.be.null;
        expect(badge!.textContent).to.include('10');
        expect(badge!.textContent).to.include('25');
        unmount();
    });

    it('does NOT show a line range badge when no selection', () => {
        const items = [makeFileItem('src/auth.ts')];
        const { container, unmount } = mountContextItems(items);
        expect(container.querySelector('.context-item-range')).to.be.null;
        unmount();
    });

    it('renders multiple items with mixed selection/no-selection correctly', () => {
        const items = [
            makeFileItem('src/a.ts', { startLine: 1, endLine: 5 }),
            makeFileItem('src/b.ts'),
        ];
        const { container, unmount } = mountContextItems(items);
        const badges = container.querySelectorAll('.context-item-range');
        expect(badges.length).to.equal(1);
        unmount();
    });
});
