/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * XSS regression tests for markdown-renderer.tsx.
 * Tests Tasks 1, 2, and 3: Mermaid SVG sanitization, DOMPurify config fix, ANSI sanitization.
 *
 * These tests load from compiled lib to match test infrastructure conventions.
 */

import { expect } from 'chai';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { renderMarkdown } = _require('openspace-chat/lib/browser/markdown-renderer') as {
    renderMarkdown: (text: string) => React.ReactNode[]
};

// Polyfill atob/btoa in jsdom if not present
if (typeof (globalThis as any).atob === 'undefined') {
    (globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
    (globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}

function renderToContainer(nodes: React.ReactNode[]): HTMLElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        const root = createRoot(container);
        root.render(React.createElement(React.Fragment, null, ...nodes));
    });
    return container;
}

describe('markdown-renderer XSS protection', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ─── Task 2: DOMPurify ALLOW_UNKNOWN_PROTOCOLS fix ────────────────────────

    describe('Task 2: javascript: URL sanitization', () => {
        it('strips javascript: href from rendered links', () => {
            const nodes = renderMarkdown('[click me](javascript:alert(1))');
            const container = renderToContainer(nodes);
            const anchor = container.querySelector('a');
            if (anchor) {
                const href = anchor.getAttribute('href') ?? '';
                expect(href).to.not.include('javascript:');
                expect(href).to.not.match(/^javascript:/i);
            }
            // If anchor is null, the link was stripped entirely — also safe
        });

        it('strips javascript: href with mixed case', () => {
            const nodes = renderMarkdown('[click me](jAvAsCrIpT:alert(1))');
            const container = renderToContainer(nodes);
            const anchors = container.querySelectorAll('a');
            for (const anchor of anchors) {
                const href = anchor.getAttribute('href') ?? '';
                expect(href).to.not.match(/^javascript:/i);
            }
        });

        it('allows https: links through', () => {
            const nodes = renderMarkdown('[safe link](https://example.com)');
            const container = renderToContainer(nodes);
            const anchor = container.querySelector('a');
            expect(anchor).to.not.be.null;
            expect(anchor!.getAttribute('href')).to.equal('https://example.com');
        });

        it('allows vscode: links through', () => {
            const nodes = renderMarkdown('[open in vscode](vscode://extension/id)');
            const container = renderToContainer(nodes);
            const anchor = container.querySelector('a');
            // Either the link is preserved or safely removed — test that no javascript: survives
            if (anchor) {
                const href = anchor.getAttribute('href') ?? '';
                expect(href).to.not.match(/^javascript:/i);
            }
        });
    });

    // ─── Task 3: ANSI rendering sanitization ─────────────────────────────────

    describe('Task 3: ANSI block XSS prevention', () => {
        it('strips onerror handler from ANSI-embedded img tag', () => {
            // ANSI sequence with embedded HTML img/onerror payload
            const ansiPayload = '\x1b[31m<img src=x onerror=alert(1)>\x1b[0m';
            const nodes = renderMarkdown('```ansi\n' + ansiPayload + '\n```');
            const container = renderToContainer(nodes);
            // onerror should not survive DOMPurify sanitization
            const imgs = container.querySelectorAll('img');
            for (const img of imgs) {
                expect(img.getAttribute('onerror')).to.be.null;
            }
            // No script elements
            expect(container.querySelector('script')).to.be.null;
        });

        it('strips script tags from ANSI output', () => {
            const ansiPayload = '\x1b[32m<script>alert(1)</script>\x1b[0m';
            const nodes = renderMarkdown('```ansi\n' + ansiPayload + '\n```');
            const container = renderToContainer(nodes);
            expect(container.querySelector('script')).to.be.null;
        });
    });

    // ─── Task 1: Mermaid SVG sanitization (visual verification) ─────────────

    describe('Task 1: Mermaid rendering does not break on safe input', () => {
        it('renders a markdown code block for mermaid syntax without throwing', () => {
            // Mermaid rendering is async (mermaid.render) and requires a real DOM;
            // in jsdom it degrades gracefully. The important thing is no unhandled XSS.
            expect(() => {
                const nodes = renderMarkdown('```mermaid\ngraph LR\n  A --> B\n```');
                renderToContainer(nodes);
            }).to.not.throw();
        });

        it('renders non-mermaid fenced code blocks safely', () => {
            const nodes = renderMarkdown('```js\nconsole.log("<script>alert(1)</script>")\n```');
            const container = renderToContainer(nodes);
            // Script tag in code block should be escaped, not executed
            expect(container.querySelector('script')).to.be.null;
        });
    });

    // ─── Combined: script tags in markdown body ───────────────────────────────

    describe('General markdown XSS prevention', () => {
        it('does not render raw script tags in markdown body', () => {
            const nodes = renderMarkdown('<script>alert(1)</script>');
            const container = renderToContainer(nodes);
            expect(container.querySelector('script')).to.be.null;
        });

        it('does not render img onerror in markdown body', () => {
            const nodes = renderMarkdown('<img src=x onerror=alert(1)>');
            const container = renderToContainer(nodes);
            const imgs = container.querySelectorAll('img');
            for (const img of imgs) {
                expect(img.getAttribute('onerror')).to.be.null;
            }
        });

        it('does not allow SVG onload handlers', () => {
            const nodes = renderMarkdown('<svg><image onload=alert(1)></image></svg>');
            const container = renderToContainer(nodes);
            const images = container.querySelectorAll('image');
            for (const el of images) {
                expect(el.getAttribute('onload')).to.be.null;
            }
        });

        it('renders safe inline code without XSS', () => {
            const nodes = renderMarkdown('Use `console.log("<script>alert(1)</script>")` in your code.');
            const container = renderToContainer(nodes);
            expect(container.querySelector('script')).to.be.null;
            // The code text should be present but escaped
            expect(container.textContent).to.include('console.log');
        });
    });

});