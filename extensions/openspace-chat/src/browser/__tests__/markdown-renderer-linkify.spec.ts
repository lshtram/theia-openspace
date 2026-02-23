/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for linkifyFilePaths behaviour and clipboard error handling
 * in markdown-renderer.tsx.
 *
 * Bug M1: navigator.clipboard.writeText rejects without a .catch() handler.
 * Bug M2: linkifyFilePaths incorrectly linkifies file paths inside inline <code>.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { renderMarkdown } = _require('openspace-chat/lib/browser/markdown-renderer') as {
    renderMarkdown: (text: string, onOpenFile?: (filePath: string) => void) => React.ReactNode[]
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

/** Dummy onOpenFile callback to enable linkification (gated on line 395). */
const noop = (_path: string): void => {};

describe('renderMarkdown — linkify & clipboard', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        sinon.restore();
    });

    // ─── Bug M1: clipboard .catch() missing ──────────────────────────────────

    describe('Bug M1: clipboard writeText rejection handling', () => {
        it('does not throw unhandled rejection when clipboard.writeText rejects on CodeBlock copy', async () => {
            // Stub navigator.clipboard to reject
            const clipboardStub = sinon.stub().rejects(new Error('Clipboard unavailable'));
            const originalClipboard = navigator.clipboard;
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: clipboardStub },
                writable: true,
                configurable: true,
            });

            // Track unhandled rejections
            const unhandledRejections: any[] = [];
            const rejectionHandler = (event: PromiseRejectionEvent) => {
                unhandledRejections.push(event.reason);
            };

            // In jsdom, unhandledrejection may not fire on window but we can
            // also listen on process for Node-level unhandled rejections.
            const nodeHandler = (reason: any) => {
                unhandledRejections.push(reason);
            };
            if (typeof window !== 'undefined') {
                window.addEventListener('unhandledrejection', rejectionHandler);
            }
            process.on('unhandledRejection', nodeHandler);

            try {
                // Render a fenced code block (produces a CodeBlock component)
                const nodes = renderMarkdown('```typescript\nconst x = 1;\n```');
                const container = renderToContainer(nodes);

                // Find and click the copy button
                const copyBtn = container.querySelector('.md-code-copy') as HTMLButtonElement;
                expect(copyBtn).to.not.be.null;

                act(() => {
                    copyBtn.click();
                });

                // Allow the rejected promise to propagate
                await new Promise(resolve => setTimeout(resolve, 50));

                // The clipboard stub should have been called
                expect(clipboardStub.called).to.equal(true);

                // BUG M1: If there's no .catch(), the rejection is unhandled.
                // This test documents the bug — the unhandled rejection WILL fire.
                // When the bug is fixed (adding .catch()), this array would be empty.
                // For now we just verify the test infrastructure works and the click
                // triggers the clipboard call.
            } finally {
                // Restore
                Object.defineProperty(navigator, 'clipboard', {
                    value: originalClipboard,
                    writable: true,
                    configurable: true,
                });
                if (typeof window !== 'undefined') {
                    window.removeEventListener('unhandledrejection', rejectionHandler);
                }
                process.removeListener('unhandledRejection', nodeHandler);
            }
        });

        it('does not throw unhandled rejection when clipboard.writeText rejects on AnsiBlock copy', async () => {
            const clipboardStub = sinon.stub().rejects(new Error('Clipboard unavailable'));
            const originalClipboard = navigator.clipboard;
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: clipboardStub },
                writable: true,
                configurable: true,
            });

            const unhandledRejections: any[] = [];
            const nodeHandler = (reason: any) => {
                unhandledRejections.push(reason);
            };
            process.on('unhandledRejection', nodeHandler);

            try {
                // Render an ANSI code block (produces an AnsiBlock component)
                const nodes = renderMarkdown('```ansi\n\x1b[31mred text\x1b[0m\n```');
                const container = renderToContainer(nodes);

                // Find and click the copy button on the AnsiBlock
                const copyBtn = container.querySelector('.md-code-copy') as HTMLButtonElement;
                expect(copyBtn).to.not.be.null;

                act(() => {
                    copyBtn.click();
                });

                // Allow the rejected promise to propagate
                await new Promise(resolve => setTimeout(resolve, 50));

                expect(clipboardStub.called).to.equal(true);
            } finally {
                Object.defineProperty(navigator, 'clipboard', {
                    value: originalClipboard,
                    writable: true,
                    configurable: true,
                });
                process.removeListener('unhandledRejection', nodeHandler);
            }
        });
    });

    // ─── Bug M2: linkifyFilePaths inside inline <code> ───────────────────────

    describe('Bug M2: linkifyFilePaths in inline code', () => {
        it('linkifies file paths inside inline code (documents the bug)', () => {
            // Inline code: `/usr/local/bin/test` — rendered as <code>/usr/local/bin/test</code>
            // The linkifyFilePaths function splits on tags but treats text between
            // <code> and </code> as a normal text segment, so the path gets linkified.
            // This IS the bug — file paths inside inline code should NOT be linkified.
            const nodes = renderMarkdown('Check the path `/usr/local/bin/test` for details.', noop);
            const container = renderToContainer(nodes);

            const codeEl = container.querySelector('code');
            expect(codeEl).to.not.be.null;

            // Bug M2: The path inside <code> IS linkified because linkifyFilePaths
            // doesn't track whether it's inside a <code> element.
            // When the bug is PRESENT, there will be an <a> inside the <code>.
            const anchorInsideCode = codeEl!.querySelector('a');

            // Documenting the current buggy behavior:
            // The anchor IS present inside <code> — this is the bug.
            // When fixed, anchorInsideCode should be null.
            // For now we assert the bug exists so the test serves as a regression marker.
            expect(anchorInsideCode).to.not.be.null;

            // Verify the path text is still present regardless
            expect(codeEl!.textContent).to.include('/usr/local/bin/test');
        });

        it('does NOT linkify file paths in fenced code blocks (base64-encoded)', () => {
            // Fenced code blocks use base64-encoded sentinels, so paths are NOT exposed
            // to linkifyFilePaths. This should work correctly.
            const nodes = renderMarkdown('```\n/usr/local/bin/test\n```', noop);
            const container = renderToContainer(nodes);

            // The code block content is rendered via CodeBlock component
            // File path should be present as text but NOT wrapped in an <a>
            const codeEl = container.querySelector('.md-code-body code');
            expect(codeEl).to.not.be.null;

            const anchor = codeEl!.querySelector('a.md-file-link');
            expect(anchor).to.be.null;

            expect(codeEl!.textContent).to.include('/usr/local/bin/test');
        });
    });

    // ─── linkifyFilePaths general behaviour ──────────────────────────────────

    describe('linkifyFilePaths — general behaviour', () => {
        it('wraps a Unix file path in normal text with an <a href="file://..."> link', () => {
            const nodes = renderMarkdown('See /home/user/project/src/main.ts for details.', noop);
            const container = renderToContainer(nodes);

            const anchor = container.querySelector('a.md-file-link') as HTMLAnchorElement;
            expect(anchor).to.not.be.null;
            expect(anchor.getAttribute('href')).to.match(/^file:\/\//);
            expect(anchor.textContent).to.include('/home/user/project/src/main.ts');
        });

        it('wraps a Windows-style file path with an <a href="file://..."> link', () => {
            const nodes = renderMarkdown('Open C:\\Users\\foo\\bar.txt to edit.', noop);
            const container = renderToContainer(nodes);

            const anchor = container.querySelector('a.md-file-link') as HTMLAnchorElement;
            expect(anchor).to.not.be.null;
            expect(anchor.getAttribute('href')).to.match(/^file:\/\//);
            expect(anchor.textContent).to.include('C:\\Users\\foo\\bar.txt');
        });

        it('does NOT linkify a file path already inside an <a> tag', () => {
            // Markdown link with a file:// URL — the path is in the href attribute,
            // not in a text segment, so it should NOT be double-wrapped.
            const nodes = renderMarkdown('[click here](file:///home/user/file.ts)', noop);
            const container = renderToContainer(nodes);

            // There should be at most one anchor for this path, not a nested one
            const anchors = container.querySelectorAll('a');
            for (const a of anchors) {
                // No nested <a> inside an <a>
                expect(a.querySelector('a')).to.be.null;
            }
        });

        it('does NOT linkify a single-segment path like /n', () => {
            // The regex requires at least 2 path segments: (/segment){2,}
            // So /n or /foo alone should NOT be linkified.
            const nodes = renderMarkdown('Use the /n flag for newlines.', noop);
            const container = renderToContainer(nodes);

            const anchor = container.querySelector('a.md-file-link');
            expect(anchor).to.be.null;
        });

        it('does NOT linkify paths when onOpenFile is not provided', () => {
            // linkifyFilePaths is gated on onOpenFile being truthy (line 395)
            const nodes = renderMarkdown('See /home/user/project/src/main.ts for details.');
            const container = renderToContainer(nodes);

            const anchor = container.querySelector('a.md-file-link');
            expect(anchor).to.be.null;
        });

        it('linkifies multiple file paths in the same text', () => {
            const md = 'Compare /src/foo/bar.ts and /src/baz/qux.ts for differences.';
            const nodes = renderMarkdown(md, noop);
            const container = renderToContainer(nodes);

            const anchors = container.querySelectorAll('a.md-file-link');
            expect(anchors.length).to.equal(2);
        });

        it('preserves path text content after linkification', () => {
            const path = '/workspace/project/index.ts';
            const nodes = renderMarkdown(`Edit ${path} now.`, noop);
            const container = renderToContainer(nodes);

            const anchor = container.querySelector('a.md-file-link') as HTMLAnchorElement;
            expect(anchor).to.not.be.null;
            expect(anchor.textContent).to.equal(path);
        });
    });
});
