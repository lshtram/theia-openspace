// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

export type ViewerMode = 'preview' | 'edit';

/** Markdown-it instance with mermaid fence override. Created once, shared. */
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Override the fenced code block renderer to emit a pre.mermaid for mermaid
// blocks, which mermaid.run() will later find and render.
const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    if (info === 'mermaid') {
        const escaped = token.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre class="mermaid">${escaped}</pre>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
};

@injectable()
export class MarkdownViewerWidget extends ReactWidget {
    static readonly ID = 'openspace-markdown-viewer-widget';
    static readonly LABEL = 'Markdown Viewer';

    /** URI of the file being viewed. Set by the open handler. */
    public uri: string = '';

    protected content: string = '';
    protected mode: ViewerMode = 'preview';

    @inject(FileService)
    protected readonly fileService!: FileService;

    constructor() {
        super();
        this.id = MarkdownViewerWidget.ID;
        this.title.label = MarkdownViewerWidget.LABEL;
        this.title.caption = MarkdownViewerWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-markdown';
        this.addClass('openspace-markdown-viewer-widget');
    }

    @postConstruct()
    protected init(): void {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        this.update();
    }

    /** Called by the open handler to set or refresh file content. */
    setContent(content: string): void {
        this.content = content;
        this.mode = 'preview';
        this.update();
    }

    /** Called by the toolbar toggle contribution. */
    toggleMode(): void {
        this.mode = this.mode === 'preview' ? 'edit' : 'preview';
        this.update();
    }

    getMode(): ViewerMode {
        return this.mode;
    }

    /**
     * Render markdown to sanitized HTML.
     * Static so unit tests can call it without a Theia container.
     */
    static renderMarkdown(markdown: string): string {
        if (!markdown) { return ''; }
        const raw = md.render(markdown);
        return DOMPurify.sanitize(raw);
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (this.mode === 'preview') {
            this.runMermaid();
        }
    }

    protected render(): React.ReactNode {
        if (this.mode === 'preview') {
            return this.renderPreview();
        }
        // Edit mode placeholder — Monaco wiring added in Task 4
        return (
            <div className="markdown-viewer-editor-container" />
        );
    }

    protected renderPreview(): React.ReactNode {
        const html = MarkdownViewerWidget.renderMarkdown(this.content);
        return (
            <div
                className="markdown-viewer-preview"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: html }}
                ref={el => { if (el) { this.runMermaid(); } }}
            />
        );
    }

    /** Run mermaid.run() after DOM settles. */
    protected runMermaid(): void {
        setTimeout(() => {
            mermaid.run({ querySelector: '.markdown-viewer-preview .mermaid' }).catch(err => {
                console.warn('[MarkdownViewerWidget] Mermaid render error:', err);
            });
        }, 0);
    }

    protected onBeforeDetach(msg: Message): void {
        super.onBeforeDetach(msg);
    }
}
