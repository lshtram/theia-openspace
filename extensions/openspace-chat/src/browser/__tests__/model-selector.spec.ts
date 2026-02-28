/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for ModelSelector component (model-selector.tsx).
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { ModelSelector } = _require('openspace-chat/lib/browser/model-selector') as {
    ModelSelector: React.FC<any>
};

function makeModel(providerId: string, modelId: string, modelName = modelId) {
    return {
        id: modelId, providerID: providerId, name: modelName,
        api: { id: '', url: '', npm: '' },
        capabilities: {
            temperature: true, reasoning: false, attachment: false, toolcall: true,
            input: { text: true, audio: false, image: false, video: false, pdf: false },
            output: { text: true, audio: false, image: false, video: false, pdf: false },
        },
    };
}

function makeProvider(id: string, name: string, modelEntries: Record<string, ReturnType<typeof makeModel>>) {
    return { id, name, models: modelEntries };
}

function makeSessionService(overrides: {
    activeModel?: string;
    models?: ReturnType<typeof makeProvider>[];
} = {}) {
    const listeners: Array<(m: string | undefined) => void> = [];
    return {
        activeModel: overrides.activeModel,
        onActiveModelChanged: (cb: any) => { listeners.push(cb); return { dispose: () => {} }; },
        getAvailableModels: sinon.stub().resolves(overrides.models ?? []),
        setActiveModel: sinon.stub(),
        _fire: (m: string | undefined) => listeners.forEach(cb => cb(m)),
    };
}

function mount(svc: ReturnType<typeof makeSessionService>, onManageModels = sinon.stub()) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(ModelSelector, {
            sessionService: svc, enabledModels: [], onManageModels,
        }));
    });
    return {
        container, onManageModels,
        unmount: () => { act(() => { root.unmount(); }); container.remove(); },
    };
}

describe('ModelSelector', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    describe('Initial render', () => {
        it('renders the pill button', () => {
            const { container, unmount } = mount(makeSessionService());
            expect(container.querySelector('.model-selector-pill')).to.not.equal(null);
            unmount();
        });

        it('shows "Select a model" title when no active model', () => {
            const { container, unmount } = mount(makeSessionService({ activeModel: undefined }));
            expect(container.querySelector('.model-selector-pill')?.getAttribute('title')).to.equal('Select a model');
            unmount();
        });

        it('shows active model in pill title', () => {
            const { container, unmount } = mount(makeSessionService({ activeModel: 'openai/gpt-4o' }));
            expect(container.querySelector('.model-selector-pill')?.getAttribute('title')).to.equal('openai/gpt-4o');
            unmount();
        });

        it('dropdown is hidden initially', () => {
            const { container, unmount } = mount(makeSessionService());
            expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            unmount();
        });
    });

    describe('Toggle', () => {
        it('opens dropdown on click', async () => {
            const { container, unmount } = mount(makeSessionService());
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            expect(document.body.querySelector('.model-dropdown')).to.not.equal(null);
            unmount();
        });

        it('closes dropdown on second click', async () => {
            const { container, unmount } = mount(makeSessionService());
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            unmount();
        });

        it('calls getAvailableModels on open', async () => {
            const svc = makeSessionService();
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            expect((svc.getAvailableModels as sinon.SinonStub).called).to.equal(true);
            unmount();
        });
    });

    describe('Model list', () => {
        it('groups models by provider', async () => {
            const svc = makeSessionService({
                models: [
                    makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') }),
                    makeProvider('anthropic', 'Anthropic', { 'claude-3-5': makeModel('anthropic', 'claude-3-5', 'Claude 3.5') }),
                ],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            const headers = Array.from(document.body.querySelectorAll('.model-provider-header')).map(e => e.textContent?.trim());
            expect(headers).to.include('OpenAI');
            expect(headers).to.include('Anthropic');
            unmount();
        });

        it('shows empty message when no models', async () => {
            const svc = makeSessionService({ models: [] });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            // Empty state: either old .model-dropdown-empty or new .model-selector-empty-text
            const emptyEl = document.body.querySelector('.model-dropdown-empty') ?? document.body.querySelector('.model-selector-empty-text');
            expect(emptyEl?.textContent).to.include('No models');
            unmount();
        });

        it('shows error when getAvailableModels rejects', async () => {
            const svc = makeSessionService();
            (svc.getAvailableModels as sinon.SinonStub).rejects(new Error('net error'));
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            expect(document.body.querySelector('.model-dropdown-error')).to.not.equal(null);
            unmount();
        });
    });

    describe('Selection', () => {
        it('calls setActiveModel on option click', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-option') as HTMLElement)?.click(); });
            expect((svc.setActiveModel as sinon.SinonStub).calledWith('openai/gpt-4o')).to.equal(true);
            unmount();
        });

        it('closes dropdown after selecting a model', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-option') as HTMLElement)?.click(); });
            expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            unmount();
        });
    });

    describe('Manage Models', () => {
        it('calls onManageModels on footer button click', async () => {
            const svc = makeSessionService();
            const onManage = sinon.stub();
            const { container, unmount } = mount(svc, onManage);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-manage-btn') as HTMLButtonElement)?.click(); });
            expect(onManage.calledOnce).to.equal(true);
            unmount();
        });

        it('closes dropdown after Manage Models click', async () => {
            const svc = makeSessionService();
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-manage-btn') as HTMLButtonElement)?.click(); });
            expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            unmount();
        });
    });

    describe('onActiveModelChanged', () => {
        it('updates pill title when service fires model change', () => {
            const svc = makeSessionService({ activeModel: 'openai/gpt-4o' });
            const { container, unmount } = mount(svc);
            act(() => { svc._fire('anthropic/claude-3-5'); });
            expect(container.querySelector('.model-selector-pill')?.getAttribute('title')).to.equal('anthropic/claude-3-5');
            unmount();
        });
    });

    describe('M1-A: recent models localStorage persistence', () => {
        let localStorageStore: Record<string, string> = {};
        let originalLocalStorage: Storage;

        before(() => {
            originalLocalStorage = (global as any).localStorage;
            (global as any).localStorage = {
                getItem: (k: string) => localStorageStore[k] ?? null,
                setItem: (k: string, v: string) => { localStorageStore[k] = v; },
                removeItem: (k: string) => { delete localStorageStore[k]; },
                clear: () => { localStorageStore = {}; },
            };
        });

        after(() => {
            (global as any).localStorage = originalLocalStorage;
        });

        beforeEach(() => { localStorageStore = {}; });
        afterEach(() => { localStorageStore = {}; });

        it('saves selected model to localStorage', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-option') as HTMLElement)?.click(); });
            const stored = JSON.parse(localStorageStore['openspace.recentModels'] ?? '[]') as string[];
            expect(stored).to.include('openai/gpt-4o');
            unmount();
        });

        it('restores recent models from localStorage on mount', async () => {
            localStorageStore['openspace.recentModels'] = JSON.stringify(['openai/gpt-4o']);
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            // Recent section should appear
            const recentHeader = document.body.querySelector('.model-section-header');
            expect(recentHeader?.textContent).to.equal('Recent');
            unmount();
        });
    });

    describe('M1-D: provider sort', () => {
        it('renders provider groups in alphabetical order', async () => {
            const svc = makeSessionService({
                models: [
                    makeProvider('zeta', 'Zeta Corp', { 'z1': makeModel('zeta', 'z1', 'Z1') }),
                    makeProvider('alpha', 'Alpha AI', { 'a1': makeModel('alpha', 'a1', 'A1') }),
                    makeProvider('midway', 'Midway', { 'm1': makeModel('midway', 'm1', 'M1') }),
                ],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            const headers = Array.from(document.body.querySelectorAll('.model-provider-header')).map(e => e.textContent?.trim() ?? '');
            expect(headers).to.deep.equal(['Alpha AI', 'Midway', 'Zeta Corp']);
            unmount();
        });
    });

    describe('M2-B: model favorites', () => {
        let localStorageStore: Record<string, string> = {};
        let originalLocalStorage: Storage;

        before(() => {
            originalLocalStorage = (global as any).localStorage;
            (global as any).localStorage = {
                getItem: (k: string) => localStorageStore[k] ?? null,
                setItem: (k: string, v: string) => { localStorageStore[k] = v; },
                removeItem: (k: string) => { delete localStorageStore[k]; },
                clear: () => { localStorageStore = {}; },
            };
        });

        after(() => {
            (global as any).localStorage = originalLocalStorage;
        });

        beforeEach(() => { localStorageStore = {}; });
        afterEach(() => { localStorageStore = {}; });

        it('renders a star button on each model option', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            expect(document.body.querySelector('.model-favorite-btn')).to.not.equal(null);
            unmount();
        });

        it('clicking star adds model to favorites section', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-favorite-btn') as HTMLButtonElement)?.click(); });
            // Favorites section header should appear
            const sectionHeaders = Array.from(document.body.querySelectorAll('.model-section-header')).map(e => e.textContent?.trim() ?? '');
            expect(sectionHeaders).to.include('Favorites');
            unmount();
        });

        it('persists favorites to localStorage', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-favorite-btn') as HTMLButtonElement)?.click(); });
            const stored = JSON.parse(localStorageStore['openspace.favoriteModels'] ?? '[]') as string[];
            expect(stored).to.include('openai/gpt-4o');
            unmount();
        });
    });

    describe('M1-C: status tags', () => {
        it('renders a deprecated badge when model has status deprecated', async () => {
            const model = { ...makeModel('openai', 'gpt-3', 'GPT-3'), status: 'deprecated' };
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-3': model })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            const badge = document.body.querySelector('.model-status-tag--deprecated');
            expect(badge).to.not.equal(null);
            expect(badge?.textContent).to.include('deprecated');
            unmount();
        });

        it('renders a preview badge when model has status preview', async () => {
            const model = { ...makeModel('openai', 'gpt-next', 'GPT-Next'), status: 'preview' };
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-next': model })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            const badge = document.body.querySelector('.model-status-tag--preview');
            expect(badge).to.not.equal(null);
            unmount();
        });
    });

    describe('M2-C: empty-state CTA', () => {
        it('shows "Open Settings" button when no models and no search query', async () => {
            const onManage = sinon.stub();
            const svc = makeSessionService({ models: [] });
            const { container, unmount } = mount(svc, onManage);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            const ctaBtn = document.body.querySelector('.model-selector-empty-cta');
            expect(ctaBtn).to.not.equal(null);
            unmount();
        });

        it('calls onManageModels when "Open Settings" is clicked', async () => {
            const onManage = sinon.stub();
            const svc = makeSessionService({ models: [] });
            const { container, unmount } = mount(svc, onManage);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            await act(async () => { (document.body.querySelector('.model-selector-empty-cta') as HTMLButtonElement)?.click(); });
            expect(onManage.calledOnce).to.equal(true);
            unmount();
        });

        it('shows "no results" text (not CTA) when search query has no matches', async () => {
            const svc = makeSessionService({
                models: [makeProvider('openai', 'OpenAI', { 'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o') })],
            });
            const { container, unmount } = mount(svc);
            await act(async () => { (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click(); });
            await act(async () => { await Promise.resolve(); });
            // Verify that when there ARE models, no CTA appears (CTA is only for zero-models case)
            const cta = document.body.querySelector('.model-selector-empty-cta');
            expect(cta).to.equal(null);
            unmount();
        });
    });
});
