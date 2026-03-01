/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Keyboard navigation tests for ModelSelector component (model-selector.tsx).
 *
 * Bug H1: handleKeyDown (lines 184-197) only handles Enter/Space (open) and
 * Escape (close). ArrowDown/ArrowUp keyboard navigation between model options
 * is missing — an accessibility requirement (REQ-MODEL-SELECTION AC-7).
 *
 * Tests marked "BUG H1" are expected to FAIL until arrow-key navigation is
 * implemented.
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

// ---------------------------------------------------------------------------
// Helpers (mirrors model-selector.spec.ts)
// ---------------------------------------------------------------------------

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

let _cleanup: (() => void) | undefined;

function mount(svc: ReturnType<typeof makeSessionService>, onManageModels = sinon.stub()) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(ModelSelector, {
            sessionService: svc, enabledModels: [], onManageModels,
        }));
    });
    const unmount = () => { act(() => { root.unmount(); }); container.remove(); };
    _cleanup = unmount;
    return { container, onManageModels, unmount };
}

/** Standard two-provider fixture used by most keyboard tests. */
function twoProviderService() {
    return makeSessionService({
        models: [
            makeProvider('openai', 'OpenAI', {
                'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o'),
                'gpt-4o-mini': makeModel('openai', 'gpt-4o-mini', 'GPT-4o Mini'),
            }),
            makeProvider('anthropic', 'Anthropic', {
                'claude-3-5': makeModel('anthropic', 'claude-3-5', 'Claude 3.5'),
            }),
        ],
    });
}

/** Open the dropdown and wait for models to render. */
async function openDropdown(container: HTMLElement) {
    await act(async () => {
        (container.querySelector('.model-selector-pill') as HTMLButtonElement)?.click();
    });
    // Let getAvailableModels resolve
    await act(async () => { await Promise.resolve(); });
}

/** Dispatch a native KeyboardEvent on an element inside act(). */
async function pressKey(element: HTMLElement, key: string, extras: Partial<KeyboardEventInit> = {}) {
    await act(async () => {
        element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extras }));
    });
}

/** Return all .model-option elements currently in the portal (document.body). */
function getOptions(_container: HTMLElement): HTMLElement[] {
    return Array.from(document.body.querySelectorAll('.model-option'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelSelector – Keyboard Navigation', () => {
    afterEach(() => {
        if (_cleanup) { try { _cleanup(); } catch { /* already unmounted */ } _cleanup = undefined; }
        document.body.innerHTML = '';
    });

    // -----------------------------------------------------------------------
    // 1. Enter / Space to open (existing behaviour — should PASS)
    // -----------------------------------------------------------------------
    describe('Enter/Space when closed', () => {
        it('opens dropdown on Enter key', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            const pill = container.querySelector('.model-selector-pill') as HTMLElement;

            await pressKey(pill, 'Enter');
            // Let models load
            await act(async () => { await Promise.resolve(); });

            expect(document.body.querySelector('.model-dropdown')).to.not.equal(null);
            unmount();
        });

        it('opens dropdown on Space key', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            const pill = container.querySelector('.model-selector-pill') as HTMLElement;

            await pressKey(pill, ' ');
            await act(async () => { await Promise.resolve(); });

            expect(document.body.querySelector('.model-dropdown')).to.not.equal(null);
            unmount();
        });
    });

    // -----------------------------------------------------------------------
    // 2. Escape to close (existing behaviour — should PASS)
    // -----------------------------------------------------------------------
    describe('Escape when open', () => {
        it('closes dropdown on Escape', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            await openDropdown(container);

            const pill = container.querySelector('.model-selector-pill') as HTMLElement;
            await pressKey(pill, 'Escape');

            expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            unmount();
        });
    });

    // -----------------------------------------------------------------------
    // 3. ArrowDown navigation (BUG H1 — should FAIL)
    // -----------------------------------------------------------------------
    describe('ArrowDown when open (BUG H1 — missing implementation)', () => {
        it('moves focus to the first model option on initial ArrowDown', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const pill = container.querySelector('.model-selector-pill') as HTMLElement;
                await pressKey(pill, 'ArrowDown');

                const options = getOptions(container);
                expect(options.length).to.be.greaterThan(0);
                expect(document.activeElement).to.equal(options[0]);
            } finally {
                unmount();
            }
        });

        it('moves focus from first option to second option on ArrowDown', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                expect(options.length).to.be.greaterThan(1);

                // Press ArrowDown once to focus first option (from index -1 → 0)
                await pressKey(container.querySelector('.model-selector') as HTMLElement, 'ArrowDown');
                // Press ArrowDown again to move to second option (from index 0 → 1)
                await pressKey(container.querySelector('.model-selector') as HTMLElement, 'ArrowDown');

                // Re-query after re-render (React may recreate DOM nodes)
                const updatedOptions = getOptions(container);
                expect(document.activeElement).to.equal(updatedOptions[1]);
            } finally {
                unmount();
            }
        });

        it('wraps focus from last option back to first on ArrowDown', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                const lastOption = options[options.length - 1];
                lastOption.focus();
                await pressKey(lastOption, 'ArrowDown');

                // Expect wrap-around to first option
                expect(document.activeElement).to.equal(options[0]);
            } finally {
                unmount();
            }
        });
    });

    // -----------------------------------------------------------------------
    // 4. ArrowUp navigation (BUG H1 — should FAIL)
    // -----------------------------------------------------------------------
    describe('ArrowUp when open (BUG H1 — missing implementation)', () => {
        it('moves focus to last option on ArrowUp from first option', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                expect(options.length).to.be.greaterThan(0);

                options[0].focus();
                await pressKey(options[0], 'ArrowUp');

                // Expect wrap-around to last option
                expect(document.activeElement).to.equal(options[options.length - 1]);
            } finally {
                unmount();
            }
        });

        it('moves focus from second option to first option on ArrowUp', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const selector = container.querySelector('.model-selector') as HTMLElement;

                // Press ArrowDown twice to focus second option (index -1 → 0 → 1)
                await pressKey(selector, 'ArrowDown');
                await pressKey(selector, 'ArrowDown');

                // Now press ArrowUp to move back to first option (index 1 → 0)
                await pressKey(selector, 'ArrowUp');

                // Re-query after re-render (React may recreate DOM nodes)
                const updatedOptions = getOptions(container);
                expect(document.activeElement).to.equal(updatedOptions[0]);
            } finally {
                unmount();
            }
        });

        it('moves focus to last option on initial ArrowUp from pill', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const pill = container.querySelector('.model-selector-pill') as HTMLElement;
                await pressKey(pill, 'ArrowUp');

                const options = getOptions(container);
                expect(document.activeElement).to.equal(options[options.length - 1]);
            } finally {
                unmount();
            }
        });
    });

    // -----------------------------------------------------------------------
    // 5. Enter on focused option (existing — ModelOption's own handler)
    // -----------------------------------------------------------------------
    describe('Enter on focused model option', () => {
        it('selects the model when Enter is pressed on a focused option', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                expect(options.length).to.be.greaterThan(0);

                options[0].focus();
                await pressKey(options[0], 'Enter');

                // setActiveModel should have been called with the first model's fullId
                expect((svc.setActiveModel as sinon.SinonStub).called).to.equal(true);
                const calledWith = (svc.setActiveModel as sinon.SinonStub).firstCall.args[0];
                expect(calledWith).to.equal('openai/gpt-4o');
            } finally {
                unmount();
            }
        });

        it('selects the model when Space is pressed on a focused option', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                expect(options.length).to.be.greaterThan(0);

                options[0].focus();
                await pressKey(options[0], ' ');

                expect((svc.setActiveModel as sinon.SinonStub).called).to.equal(true);
            } finally {
                unmount();
            }
        });

        it('closes dropdown after selecting via Enter', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                options[0].focus();
                await pressKey(options[0], 'Enter');

                expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            } finally {
                unmount();
            }
        });
    });

    // -----------------------------------------------------------------------
    // 6. Tab key — model options should be focusable (tabIndex={0})
    // -----------------------------------------------------------------------
    describe('Tab key focusability', () => {
        it('model options have tabIndex=0 and are focusable', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                expect(options.length).to.be.greaterThan(0);

                for (const option of options) {
                    expect(option.getAttribute('tabindex')).to.equal('0');
                }
            } finally {
                unmount();
            }
        });

        it('model options have role="option"', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const options = getOptions(container);
                for (const option of options) {
                    expect(option.getAttribute('role')).to.equal('option');
                }
            } finally {
                unmount();
            }
        });
    });

    // -----------------------------------------------------------------------
    // 7. Escape from search input (existing behaviour)
    // -----------------------------------------------------------------------
    describe('Escape from search input', () => {
        it('clears search text on first Escape when search has value', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const searchInput = document.body.querySelector('.model-search-input') as HTMLInputElement;
                expect(searchInput).to.not.equal(null);

                // Simulate typing by setting value and dispatching change via React's onChange
                await act(async () => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value'
                    )!.set!;
                    nativeInputValueSetter.call(searchInput, 'gpt');
                    searchInput.dispatchEvent(new window.Event('change', { bubbles: true }));
                });

                // First Escape should clear search, dropdown stays open
                await pressKey(searchInput, 'Escape');

                // Dropdown should still be open
                expect(document.body.querySelector('.model-dropdown')).to.not.equal(null);
            } finally {
                unmount();
            }
        });

        it('closes dropdown on Escape when search is empty', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const searchInput = document.body.querySelector('.model-search-input') as HTMLInputElement;
                expect(searchInput).to.not.equal(null);

                // Escape with empty search should close
                await pressKey(searchInput, 'Escape');

                expect(document.body.querySelector('.model-dropdown')).to.equal(null);
            } finally {
                unmount();
            }
        });
    });

    // -----------------------------------------------------------------------
    // 8. Search input filtering (existing feature, keyboard test)
    // -----------------------------------------------------------------------
    describe('Search input filtering', () => {
        it('filters model options when typing in search', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                // All 3 models should be present before search
                let options = getOptions(container);
                expect(options.length).to.equal(3);

                const searchInput = document.body.querySelector('.model-search-input') as HTMLInputElement;

                // Simulate React onChange
                await act(async () => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value'
                    )!.set!;
                    nativeInputValueSetter.call(searchInput, 'claude');
                    searchInput.dispatchEvent(new window.Event('change', { bubbles: true }));
                });

                // After filtering for "claude", only 1 model should remain
                options = getOptions(container);
                expect(options.length).to.equal(1);
                expect(options[0].textContent).to.include('Claude 3.5');
            } finally {
                unmount();
            }
        });

        it('shows empty message when search matches nothing', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);

                const searchInput = document.body.querySelector('.model-search-input') as HTMLInputElement;

                await act(async () => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value'
                    )!.set!;
                    nativeInputValueSetter.call(searchInput, 'nonexistentmodel');
                    searchInput.dispatchEvent(new window.Event('change', { bubbles: true }));
                });

                expect(document.body.querySelector('.model-dropdown-empty')?.textContent).to.include('No models match');
            } finally {
                unmount();
            }
        });
    });

    // -----------------------------------------------------------------------
    // 9. Dropdown has correct ARIA attributes
    // -----------------------------------------------------------------------
    describe('ARIA attributes', () => {
        it('pill button has aria-expanded=false when closed', () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                const pill = container.querySelector('.model-selector-pill') as HTMLElement;
                expect(pill.getAttribute('aria-expanded')).to.equal('false');
            } finally {
                unmount();
            }
        });

        it('pill button has aria-expanded=true when open', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);
                const pill = container.querySelector('.model-selector-pill') as HTMLElement;
                expect(pill.getAttribute('aria-expanded')).to.equal('true');
            } finally {
                unmount();
            }
        });

        it('pill button has aria-haspopup="dialog"', () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                const pill = container.querySelector('.model-selector-pill') as HTMLElement;
                expect(pill.getAttribute('aria-haspopup')).to.equal('listbox');
            } finally {
                unmount();
            }
        });

        it('dropdown has role="dialog"', async () => {
            const svc = twoProviderService();
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);
                const dropdown = document.body.querySelector('.model-dropdown') as HTMLElement;
                expect(dropdown.getAttribute('role')).to.equal('dialog');
            } finally {
                unmount();
            }
        });

        it('selected option has aria-selected=true', async () => {
            const svc = makeSessionService({
                activeModel: 'openai/gpt-4o',
                models: [
                    makeProvider('openai', 'OpenAI', {
                        'gpt-4o': makeModel('openai', 'gpt-4o', 'GPT-4o'),
                        'gpt-4o-mini': makeModel('openai', 'gpt-4o-mini', 'GPT-4o Mini'),
                    }),
                ],
            });
            const { container, unmount } = mount(svc);
            try {
                await openDropdown(container);
                const options = getOptions(container);
                const selected = options.find(o => o.getAttribute('aria-selected') === 'true');
                expect(selected).to.not.equal(undefined);
                expect(selected!.textContent).to.include('GPT-4o');
            } finally {
                unmount();
            }
        });
    });
});
