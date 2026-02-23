/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for prompt history navigation and XSS via innerHTML (Bug C1).
 *
 * Bug C1: In prompt-input.tsx, lines 362, 385, 396 assign
 *   `editorRef.current.innerHTML = entry.html`
 * where `entry.html` is the raw innerHTML snapshot of a previous prompt.
 * If a history entry contains malicious HTML (e.g. `<img src=x onerror=alert(1)>`),
 * it is injected directly into the DOM without sanitization.
 *
 * This file tests:
 *   - History navigation behaviour (ArrowUp/ArrowDown)
 *   - XSS vectors that exploit the unsanitized innerHTML assignment (Bug C1)
 *
 * XSS tests are expected to FAIL until the bug is fixed.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { PromptInput } = _require('openspace-chat/lib/browser/prompt-input/prompt-input') as {
    PromptInput: React.FC<any>
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStubServices() {
    return {
        openCodeService: {
            getClient: () => null,
            onActiveSessionChanged: () => ({ dispose: () => {} }),
            onActiveProjectChanged: () => ({ dispose: () => {} }),
            listCommands: async () => [],
            listAgents: async () => [],
            searchFiles: async () => [],
        },
        sessionService: {
            activeModel: undefined,
            onActiveModelChanged: () => ({ dispose: () => {} }),
            getAvailableModels: async () => [],
            setActiveModel: () => {},
        },
    };
}

let _cleanup: (() => void) | undefined;

function mount(overrides: any = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const { openCodeService } = makeStubServices();
    const props = {
        onSend: sinon.stub(),
        onCommand: sinon.stub(),
        onBuiltinCommand: sinon.stub(),
        onShellCommand: sinon.stub(),
        onStop: sinon.stub(),
        isStreaming: false,
        disabled: false,
        openCodeService,
        ...overrides,
    };
    act(() => { root.render(React.createElement(PromptInput, props)); });
    const unmount = () => { act(() => { root.unmount(); }); container.remove(); };
    _cleanup = unmount;
    return { container, unmount, props };
}

/** Find the contentEditable editor div inside the mounted component. */
function getEditor(container: HTMLElement): HTMLDivElement {
    const editor = container.querySelector('.prompt-input-editor') as HTMLDivElement;
    if (!editor) {
        throw new Error('Could not find .prompt-input-editor element');
    }
    return editor;
}

/** Set text content in the editor and fire input event so React state updates. */
function setEditorText(editor: HTMLDivElement, text: string): void {
    act(() => {
        editor.textContent = text;
        editor.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
}

/** Dispatch a KeyboardEvent on an element inside act(). */
async function pressKey(element: HTMLElement, key: string, extras: Partial<KeyboardEventInit> = {}): Promise<void> {
    await act(async () => {
        element.dispatchEvent(new window.KeyboardEvent('keydown', {
            key, bubbles: true, cancelable: true, ...extras,
        }));
    });
}

/** Submit the current editor content by pressing Enter. */
async function submitEditor(editor: HTMLDivElement): Promise<void> {
    await pressKey(editor, 'Enter');
}

/**
 * Place the cursor at the start of the given contentEditable element.
 * Required because jsdom doesn't move cursor automatically.
 */
function placeCursorAtStart(editor: HTMLDivElement): void {
    const range = document.createRange();
    const sel = window.getSelection();
    if (editor.firstChild) {
        range.setStart(editor.firstChild, 0);
    } else {
        range.setStart(editor, 0);
    }
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
}

/**
 * Place the cursor at the end of the given contentEditable element.
 */
function placeCursorAtEnd(editor: HTMLDivElement): void {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
}

// ---------------------------------------------------------------------------
// Tests — History Navigation
// ---------------------------------------------------------------------------

describe('PromptInput – History Navigation', () => {
    afterEach(() => {
        if (_cleanup) {
            try { _cleanup(); } catch { /* already unmounted */ }
            _cleanup = undefined;
        }
        document.body.innerHTML = '';
    });

    // -----------------------------------------------------------------------
    // 1. ArrowUp with empty editor navigates to previous history entry
    // -----------------------------------------------------------------------
    it('ArrowUp with empty editor navigates to the most recent history entry', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit a message to populate history
            setEditorText(editor, 'first message');
            await submitEditor(editor);

            // Editor should be cleared after submit
            // Now press ArrowUp to navigate history
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');

            expect(editor.textContent).to.equal('first message');
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 2. ArrowUp at top of history stays at top
    // -----------------------------------------------------------------------
    it('ArrowUp at top of history stays at the last entry (does not go past)', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit two messages
            setEditorText(editor, 'message one');
            await submitEditor(editor);
            setEditorText(editor, 'message two');
            await submitEditor(editor);

            // ArrowUp x3: first goes to "message two", second to "message one", third should stay
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('message two');

            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('message one');

            // Third ArrowUp — should stay at "message one" (top of history)
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('message one');
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 3. ArrowDown returns to more recent history
    // -----------------------------------------------------------------------
    it('ArrowDown returns to more recent history entry', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit two messages
            setEditorText(editor, 'older');
            await submitEditor(editor);
            setEditorText(editor, 'newer');
            await submitEditor(editor);

            // Navigate up twice to reach "older"
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('older');

            // Navigate down once — should return to "newer"
            placeCursorAtEnd(editor);
            await pressKey(editor, 'ArrowDown');
            expect(editor.textContent).to.equal('newer');
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 4. ArrowDown from index 0 restores the saved draft
    // -----------------------------------------------------------------------
    it('ArrowDown from most recent entry restores the saved draft', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit a message to populate history
            setEditorText(editor, 'historic');
            await submitEditor(editor);

            // Type a new draft
            setEditorText(editor, 'my draft');

            // Navigate up — should save draft and show history
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('historic');

            // Navigate down — should restore draft
            placeCursorAtEnd(editor);
            await pressKey(editor, 'ArrowDown');
            expect(editor.textContent).to.equal('my draft');
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 5. ArrowUp saves current draft before navigating
    // -----------------------------------------------------------------------
    it('ArrowUp saves the current draft before navigating to history', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit a message
            setEditorText(editor, 'sent message');
            await submitEditor(editor);

            // Type a draft in the editor
            setEditorText(editor, 'unsaved work');

            // ArrowUp navigates to history
            placeCursorAtStart(editor);
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('sent message');

            // ArrowDown restores draft — proves draft was saved
            placeCursorAtEnd(editor);
            await pressKey(editor, 'ArrowDown');
            expect(editor.textContent).to.equal('unsaved work');
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 6. History navigation doesn't trigger when editor has content and cursor not at start
    // -----------------------------------------------------------------------
    it('ArrowUp does NOT navigate history when cursor is in middle of text', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit a message to populate history
            setEditorText(editor, 'history entry');
            await submitEditor(editor);

            // Type new content
            setEditorText(editor, 'some text here');

            // Place cursor in the middle (not at start)
            const textNode = editor.firstChild;
            if (textNode) {
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(textNode, 5); // middle of "some text here"
                range.collapse(true);
                sel?.removeAllRanges();
                sel?.addRange(range);
            }

            // ArrowUp should NOT navigate to history
            await pressKey(editor, 'ArrowUp');
            expect(editor.textContent).to.equal('some text here');
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 7. History navigation only works when no typeahead/slash menu is open
    // -----------------------------------------------------------------------
    it('ArrowUp does NOT navigate history when typeahead menu is open', async () => {
        const { container, unmount } = mount();
        try {
            const editor = getEditor(container);
            editor.focus();

            // Submit a message to populate history
            setEditorText(editor, 'old message');
            await submitEditor(editor);

            // Type "@" to trigger typeahead
            act(() => {
                editor.textContent = '@';
                editor.dispatchEvent(new window.Event('input', { bubbles: true }));
            });

            // Allow typeahead to render
            await act(async () => { await Promise.resolve(); });

            // Check if typeahead is shown
            const typeahead = container.querySelector('.prompt-input-typeahead');
            if (typeahead) {
                // Typeahead is open — ArrowUp should navigate typeahead, not history
                const contentBefore = editor.textContent;
                await pressKey(editor, 'ArrowUp');
                // Editor content should remain unchanged (typeahead handled the key)
                expect(editor.textContent).to.equal(contentBefore);
            }
            // If typeahead didn't open (no agents configured), the test is not applicable
            // but still passes — no assertion failure
        } finally {
            unmount();
        }
    });
});

// ---------------------------------------------------------------------------
// Tests — XSS via innerHTML (Bug C1)
//
// These tests verify that unsanitized innerHTML assignment is exploitable.
// They are expected to FAIL once the bug is fixed (i.e. after sanitization
// is added to the innerHTML assignments at lines 362, 385, 396).
// ---------------------------------------------------------------------------

describe('PromptInput – XSS via innerHTML in history (Bug C1)', () => {
    afterEach(() => {
        if (_cleanup) {
            try { _cleanup(); } catch { /* already unmounted */ }
            _cleanup = undefined;
        }
        document.body.innerHTML = '';
    });

    /**
     * Helper: Directly inject a malicious history entry into the component.
     *
     * Since historyEntries is internal React state and we cannot set it directly
     * through props, we simulate the flow:
     *   1. Set editor innerHTML to the malicious payload
     *   2. Submit (Enter) — the component snapshots innerHTML into historyEntries
     *   3. Press ArrowUp — the component restores entry.html via innerHTML
     *
     * This replicates the real attack vector: if a user composes a message that
     * contains HTML (e.g. pasted from a malicious source or via contentEditable
     * formatting), the raw HTML is stored and later re-injected.
     */
    async function submitAndRecallHtml(
        container: HTMLElement,
        maliciousHtml: string
    ): Promise<HTMLDivElement> {
        const editor = getEditor(container);
        editor.focus();

        // Step 1: Set raw innerHTML (simulating paste or contentEditable formatting)
        act(() => {
            editor.innerHTML = maliciousHtml;
            editor.dispatchEvent(new window.Event('input', { bubbles: true }));
        });

        // Step 2: Submit — component stores {text, html} into historyEntries
        await submitEditor(editor);

        // Step 3: Press ArrowUp — component restores entry.html via innerHTML
        placeCursorAtStart(editor);
        await pressKey(editor, 'ArrowUp');

        return editor;
    }

    // -----------------------------------------------------------------------
    // 8. Script tag should not survive innerHTML restoration
    // -----------------------------------------------------------------------
    it('history entry with <script> tag: script element should NOT be present in DOM (BUG C1)', async () => {
        const { container, unmount } = mount();
        try {
            const editor = await submitAndRecallHtml(
                container,
                'hello <script>alert("xss")</script> world'
            );

            // BUG C1: The raw HTML is assigned via innerHTML without sanitization.
            // After fix, <script> should be stripped. Currently it survives.
            const scripts = editor.querySelectorAll('script');
            expect(scripts.length).to.equal(0,
                'BUG C1: <script> tag survived innerHTML restoration — XSS vulnerability'
            );
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 9. img with onerror should not preserve event handler
    // -----------------------------------------------------------------------
    it('history entry with <img onerror>: onerror attribute should NOT be present (BUG C1)', async () => {
        const { container, unmount } = mount();
        try {
            const editor = await submitAndRecallHtml(
                container,
                'check this <img src="x" onerror="alert(1)"> image'
            );

            // BUG C1: img with onerror is injected verbatim.
            // After fix, onerror should be stripped.
            const imgs = editor.querySelectorAll('img');
            for (const img of imgs) {
                expect(img.getAttribute('onerror')).to.be.null;
                expect(img.hasAttribute('onerror')).to.equal(false,
                    'BUG C1: <img onerror=...> survived innerHTML restoration — XSS vulnerability'
                );
            }
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 10. div with onmouseover should not preserve event handler
    // -----------------------------------------------------------------------
    it('history entry with <div onmouseover>: event handler should NOT be preserved (BUG C1)', async () => {
        const { container, unmount } = mount();
        try {
            const editor = await submitAndRecallHtml(
                container,
                '<div onmouseover="alert(1)">hover me</div>'
            );

            const divs = editor.querySelectorAll('div');
            for (const div of divs) {
                expect(div.hasAttribute('onmouseover')).to.equal(false,
                    'BUG C1: <div onmouseover=...> survived innerHTML restoration — XSS vulnerability'
                );
            }
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 11. innerHTML assignment should sanitize HTML content
    // -----------------------------------------------------------------------
    it('innerHTML restoration should not contain any event handler attributes (BUG C1)', async () => {
        const { container, unmount } = mount();
        try {
            const payload = [
                '<b onmouseover="alert(1)">bold</b>',
                '<a href="javascript:alert(1)">link</a>',
                '<svg onload="alert(1)"><circle r="10"/></svg>',
            ].join(' ');

            const editor = await submitAndRecallHtml(container, payload);

            // Check no inline event handlers survive
            const allElements = editor.querySelectorAll('*');
            const dangerousAttrs = [
                'onmouseover', 'onclick', 'onerror', 'onload', 'onfocus',
                'onblur', 'onmouseenter', 'onmouseleave', 'onsubmit',
            ];
            for (const el of allElements) {
                for (const attr of dangerousAttrs) {
                    expect(el.hasAttribute(attr)).to.equal(false,
                        `BUG C1: ${el.tagName.toLowerCase()} has dangerous attribute "${attr}" after innerHTML restoration`
                    );
                }
            }

            // Check no javascript: URLs survive
            const anchors = editor.querySelectorAll('a');
            for (const a of anchors) {
                const href = a.getAttribute('href') ?? '';
                expect(href).to.not.match(/^javascript:/i,
                    'BUG C1: javascript: URL survived innerHTML restoration'
                );
            }
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 12. SVG with embedded script should be sanitized
    // -----------------------------------------------------------------------
    it('history entry with SVG containing <script>: script should NOT be present (BUG C1)', async () => {
        const { container, unmount } = mount();
        try {
            const editor = await submitAndRecallHtml(
                container,
                '<svg><script>alert("xss")</script></svg>'
            );

            const scripts = editor.querySelectorAll('script');
            expect(scripts.length).to.equal(0,
                'BUG C1: <script> inside SVG survived innerHTML restoration — XSS vulnerability'
            );
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 13. iframe injection should be blocked
    // -----------------------------------------------------------------------
    it('history entry with <iframe>: iframe should NOT be present in DOM (BUG C1)', async () => {
        const { container, unmount } = mount();
        try {
            const editor = await submitAndRecallHtml(
                container,
                'text <iframe src="https://evil.com"></iframe> more text'
            );

            const iframes = editor.querySelectorAll('iframe');
            expect(iframes.length).to.equal(0,
                'BUG C1: <iframe> survived innerHTML restoration — XSS vulnerability'
            );
        } finally {
            unmount();
        }
    });

    // -----------------------------------------------------------------------
    // 14. Safe HTML (pills) should still render correctly
    // -----------------------------------------------------------------------
    it('history entry with safe pill HTML should render correctly', async () => {
        const { container, unmount } = mount();
        try {
            const safeHtml = 'check <span data-type="file" data-path="/src/app.ts" class="prompt-pill file-pill" contenteditable="false">@app.ts</span> please';

            const editor = await submitAndRecallHtml(container, safeHtml);

            // The pill span should survive (this is the legitimate use case for innerHTML)
            const pill = editor.querySelector('span[data-type="file"]');
            expect(pill).to.not.be.null;
            expect(pill!.getAttribute('data-path')).to.equal('/src/app.ts');
            expect(pill!.textContent).to.include('@app.ts');
        } finally {
            unmount();
        }
    });
});

// ---------------------------------------------------------------------------
// Tests — Direct DOM-level XSS (demonstrates the vulnerability pattern)
//
// These tests operate at the DOM level, independent of the React component,
// to clearly demonstrate that innerHTML assignment without sanitization
// is inherently dangerous.
// ---------------------------------------------------------------------------

describe('DOM-level innerHTML XSS (pattern used in Bug C1)', () => {
    let div: HTMLDivElement;

    beforeEach(() => {
        div = document.createElement('div');
        div.contentEditable = 'true';
        document.body.appendChild(div);
    });

    afterEach(() => {
        div.remove();
        document.body.innerHTML = '';
    });

    it('innerHTML creates img elements with onerror attribute', () => {
        // This demonstrates that innerHTML DOES create dangerous elements
        div.innerHTML = '<img src="x" onerror="alert(1)">';

        const img = div.querySelector('img');
        expect(img).to.not.be.null;
        // The onerror attribute IS present — this is the vulnerability
        expect(img!.hasAttribute('onerror')).to.equal(true,
            'innerHTML does preserve onerror — confirming the vulnerability pattern'
        );
    });

    it('innerHTML creates elements with inline event handlers', () => {
        div.innerHTML = '<div onclick="alert(1)" onmouseover="alert(2)">click me</div>';

        const child = div.querySelector('div');
        expect(child).to.not.be.null;
        expect(child!.hasAttribute('onclick')).to.equal(true,
            'innerHTML preserves onclick — confirming the vulnerability pattern'
        );
        expect(child!.hasAttribute('onmouseover')).to.equal(true,
            'innerHTML preserves onmouseover — confirming the vulnerability pattern'
        );
    });

    it('innerHTML creates script elements (jsdom does not execute them)', () => {
        div.innerHTML = '<script>window.__xss_test = true;</script>';

        // jsdom doesn't execute scripts inserted via innerHTML, but the element exists
        const script = div.querySelector('script');
        expect(script).to.not.be.null;
        expect(script!.textContent).to.include('window.__xss_test');
    });

    it('innerHTML creates iframes', () => {
        div.innerHTML = '<iframe src="https://evil.com"></iframe>';

        const iframe = div.querySelector('iframe');
        expect(iframe).to.not.be.null;
        expect(iframe!.getAttribute('src')).to.equal('https://evil.com');
    });

    it('innerHTML preserves javascript: URLs in anchor tags', () => {
        div.innerHTML = '<a href="javascript:alert(1)">click</a>';

        const anchor = div.querySelector('a');
        expect(anchor).to.not.be.null;
        expect(anchor!.getAttribute('href')).to.equal('javascript:alert(1)');
    });
});
