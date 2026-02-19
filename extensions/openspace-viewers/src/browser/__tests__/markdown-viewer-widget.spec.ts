// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Tests for MarkdownViewerWidget static constants and pure logic.
 * The widget itself requires a full Theia DI container and cannot be
 * instantiated in unit tests. We test what we can isolate.
 */

import { expect } from 'chai';
import { MarkdownViewerWidget } from '../markdown-viewer-widget';

describe('MarkdownViewerWidget', () => {

    describe('Constants', () => {
        it('should have correct widget ID', () => {
            expect(MarkdownViewerWidget.ID).to.equal('openspace-markdown-viewer-widget');
        });

        it('should have correct widget LABEL', () => {
            expect(MarkdownViewerWidget.LABEL).to.equal('Markdown Viewer');
        });
    });

    describe('renderMarkdown (static helper)', () => {
        it('should render a heading', () => {
            const html = MarkdownViewerWidget.renderMarkdown('# Hello');
            expect(html).to.include('<h1');
            expect(html).to.include('Hello');
        });

        it('should render bold text', () => {
            const html = MarkdownViewerWidget.renderMarkdown('**bold**');
            expect(html).to.include('<strong>bold</strong>');
        });

        it('should render a fenced code block', () => {
            const html = MarkdownViewerWidget.renderMarkdown('```js\nconst x = 1;\n```');
            expect(html).to.include('<code');
            expect(html).to.include('const x = 1;');
        });

        it('should render a mermaid block with class "mermaid"', () => {
            const md = '```mermaid\ngraph TD; A--\u003eB;\n```';
            const html = MarkdownViewerWidget.renderMarkdown(md);
            expect(html).to.include('class="mermaid"');
            expect(html).to.include('graph TD');
        });

        it('should return empty string for empty input', () => {
            expect(MarkdownViewerWidget.renderMarkdown('')).to.equal('');
        });

        it('should not return raw HTML tags from XSS attempt', () => {
            const html = MarkdownViewerWidget.renderMarkdown('<script>alert(1)</script>');
            expect(html).to.not.include('<script>');
        });
    });
});
