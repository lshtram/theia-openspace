/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for renderMarkdown (markdown-renderer.tsx).
 * Loaded from compiled lib to avoid tsx/DOMPurify/decorator issues in ts-node.
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

describe('renderMarkdown', () => {
    afterEach(() => {
        // clean up any containers added to body
        document.body.innerHTML = '';
    });

    it('returns empty array for empty string', () => {
        const result = renderMarkdown('');
        expect(result).to.be.an('array').with.length(0);
    });

    it('returns non-empty array for non-empty text', () => {
        const result = renderMarkdown('hello world');
        expect(result).to.be.an('array').with.length.greaterThan(0);
    });

    it('renders plain text wrapped in html', () => {
        const nodes = renderMarkdown('hello world');
        const container = renderToContainer(nodes);
        expect(container.textContent).to.include('hello world');
    });

    it('renders bold markdown', () => {
        const nodes = renderMarkdown('**bold text**');
        const container = renderToContainer(nodes);
        const strong = container.querySelector('strong');
        expect(strong).to.not.be.null;
        expect(strong!.textContent).to.include('bold text');
    });

    it('renders inline code', () => {
        const nodes = renderMarkdown('use `console.log()` here');
        const container = renderToContainer(nodes);
        const code = container.querySelector('code');
        expect(code).to.not.be.null;
        expect(code!.textContent).to.include('console.log()');
    });

    it('renders headings', () => {
        const nodes = renderMarkdown('# Heading One');
        const container = renderToContainer(nodes);
        const h1 = container.querySelector('h1');
        expect(h1).to.not.be.null;
        expect(h1!.textContent).to.include('Heading One');
    });

    it('renders unordered list', () => {
        const nodes = renderMarkdown('- item one\n- item two');
        const container = renderToContainer(nodes);
        const items = container.querySelectorAll('li');
        expect(items.length).to.be.greaterThanOrEqual(2);
    });

    it('renders links', () => {
        const nodes = renderMarkdown('[OpenSpace](https://example.com)');
        const container = renderToContainer(nodes);
        const anchor = container.querySelector('a');
        expect(anchor).to.not.be.null;
        expect(anchor!.textContent).to.include('OpenSpace');
    });

    it('renders fenced code block as CodeBlock component', () => {
        const nodes = renderMarkdown('```typescript\nconst x = 1;\n```');
        // Should produce React nodes (not throw)
        expect(nodes).to.be.an('array').with.length.greaterThan(0);
        // The code sentinel should be replaced with a React element
        const container = renderToContainer(nodes);
        // Code block renders something containing the code
        expect(container.textContent).to.include('x');
    });

    it('detects mermaid code block and produces mermaid node', () => {
        const nodes = renderMarkdown('```mermaid\ngraph TD\nA-->B\n```');
        expect(nodes).to.be.an('array').with.length.greaterThan(0);
        // The result should render without throwing
        expect(() => renderToContainer(nodes)).to.not.throw();
    });

    it('renders diff code block without throwing', () => {
        const diffText = '```diff\n-old line\n+new line\n```';
        expect(() => {
            const nodes = renderMarkdown(diffText);
            renderToContainer(nodes);
        }).to.not.throw();
    });
});
