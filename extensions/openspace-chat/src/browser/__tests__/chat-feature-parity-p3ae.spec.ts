/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P3-A: Standalone Review Panel
 * and P3-E: Model Detail Tooltip + Pricing.
 *
 * P3-A: ReviewPanelWidget — a new Theia ReactWidget that renders a file
 *       list sidebar + diff view. Here we test the pure review panel
 *       React component (ReviewPanel) directly.
 *
 * P3-E: Model detail tooltip — ModelSelector renders a .model-tooltip
 *       popover on hover showing context size and pricing; also adds
 *       "free" and "latest" badges.
 *
 * Imports compiled lib for React components.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);

const { ReviewPanel } = _require('openspace-chat/lib/browser/review-panel') as {
    ReviewPanel: React.FC<any>;
};

const { ModelSelector } = _require('openspace-chat/lib/browser/model-selector') as {
    ModelSelector: React.FC<any>;
};

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFileDiff(filename: string, oldContent: string, newContent: string): any {
    return { filename, oldContent, newContent };
}

function makeModelWithPricing(id: string, options: {
    inputPrice?: number;
    outputPrice?: number;
    contextLength?: number;
    free?: boolean;
    latest?: boolean;
} = {}): any {
    return {
        id,
        name: id,
        providerID: 'openai',
        inputPrice: options.inputPrice,
        outputPrice: options.outputPrice,
        contextLength: options.contextLength,
        free: options.free,
        latest: options.latest,
        api: { id: '', url: '', npm: '' },
        capabilities: {
            temperature: true, reasoning: false, attachment: false, toolcall: true,
            input: { text: true, audio: false, image: false, video: false, pdf: false },
            output: { text: true, audio: false, image: false, video: false, pdf: false },
        },
    };
}

// ─── P3-A: ReviewPanel component ─────────────────────────────────────────────

describe('P3-A: ReviewPanel component', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders a .review-panel container', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ReviewPanel, { diffs: [], onClose: sinon.stub() }));
        });
        expect(container.querySelector('.review-panel')).to.not.be.null;
        act(() => root.unmount()); container.remove();
    });

    it('renders a .review-file-list sidebar', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ReviewPanel, { diffs: [], onClose: sinon.stub() }));
        });
        expect(container.querySelector('.review-file-list')).to.not.be.null;
        act(() => root.unmount()); container.remove();
    });

    it('shows one .review-file-item per diff file', () => {
        const diffs = [
            makeFileDiff('src/auth.ts', 'old auth', 'new auth'),
            makeFileDiff('src/utils.ts', 'old utils', 'new utils'),
        ];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ReviewPanel, { diffs, onClose: sinon.stub() }));
        });
        expect(container.querySelectorAll('.review-file-item').length).to.equal(2);
        act(() => root.unmount()); container.remove();
    });

    it('shows a diff view when a file is selected', () => {
        const diffs = [makeFileDiff('src/auth.ts', 'old line\n', 'new line\n')];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ReviewPanel, { diffs, onClose: sinon.stub() }));
        });
        // Click first file
        const fileItem = container.querySelector('.review-file-item') as HTMLElement;
        act(() => { fileItem.click(); });

        expect(container.querySelector('.review-diff-view')).to.not.be.null;
        act(() => root.unmount()); container.remove();
    });

    it('renders an empty state when there are no diffs', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ReviewPanel, { diffs: [], onClose: sinon.stub() }));
        });
        expect(container.querySelector('.review-empty-state')).to.not.be.null;
        act(() => root.unmount()); container.remove();
    });
});

// ─── P3-E: ModelSelector — pricing / tooltip / badges ─────────────────────────

function makeProvider(id: string, models: any[]) {
    const modelMap: Record<string, any> = {};
    models.forEach(m => { modelMap[m.id] = m; });
    return { id, name: id, models: modelMap };
}

function mountModelSelector(providers: any[], activeModel?: string) {
    const listeners: Array<(m: string | undefined) => void> = [];
    const svc: any = {
        activeModel,
        onActiveModelChanged: (cb: any) => { listeners.push(cb); return { dispose: () => {} }; },
        getAvailableModels: sinon.stub().resolves(providers),
        setActiveModel: sinon.stub(),
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(ModelSelector, {
            sessionService: svc, enabledModels: [], onManageModels: sinon.stub(),
        }));
    });
    return {
        container,
        svc,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

describe('P3-E: ModelSelector — pricing, free badge, latest badge', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders a .model-free-badge on a free model', async () => {
        const freeModel = makeModelWithPricing('gpt-free', { free: true });
        const providers = [makeProvider('openai', [freeModel])];
        const { container, unmount } = mountModelSelector(providers);

        // Open the selector
        const pill = container.querySelector('.model-selector-pill') as HTMLElement;
        act(() => { pill.click(); });

        // Wait for models to load
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        expect(document.body.querySelector('.model-free-badge')).to.not.be.null;
        unmount();
    });

    it('renders a .model-latest-badge on a model flagged as latest', async () => {
        const latestModel = makeModelWithPricing('gpt-latest', { latest: true });
        const providers = [makeProvider('openai', [latestModel])];
        const { container, unmount } = mountModelSelector(providers);

        const pill = container.querySelector('.model-selector-pill') as HTMLElement;
        act(() => { pill.click(); });
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        expect(document.body.querySelector('.model-latest-badge')).to.not.be.null;
        unmount();
    });

    it('shows .model-tooltip with pricing when a model option is hovered', async () => {
        const pricedModel = makeModelWithPricing('gpt-4o', {
            inputPrice: 3.0,
            outputPrice: 15.0,
            contextLength: 128000,
        });
        const providers = [makeProvider('openai', [pricedModel])];
        const { container, unmount } = mountModelSelector(providers);

        const pill = container.querySelector('.model-selector-pill') as HTMLElement;
        act(() => { pill.click(); });
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        // Hover the model option
        const modelOption = document.body.querySelector('.model-option') as HTMLElement;
        if (modelOption) {
            act(() => { modelOption.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
        }

        expect(document.body.querySelector('.model-tooltip')).to.not.be.null;
        unmount();
    });

    it('.model-tooltip includes context length', async () => {
        const pricedModel = makeModelWithPricing('gpt-4o', {
            inputPrice: 3.0, outputPrice: 15.0, contextLength: 128000,
        });
        const providers = [makeProvider('openai', [pricedModel])];
        const { container, unmount } = mountModelSelector(providers);

        const pill = container.querySelector('.model-selector-pill') as HTMLElement;
        act(() => { pill.click(); });
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const modelOption = document.body.querySelector('.model-option') as HTMLElement;
        if (modelOption) {
            act(() => { modelOption.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); });
        }

        const tooltip = document.body.querySelector('.model-tooltip');
        expect(tooltip?.textContent).to.include('128');
        unmount();
    });
});
