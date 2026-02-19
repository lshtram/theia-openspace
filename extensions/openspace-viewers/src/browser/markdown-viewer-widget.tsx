// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import { MonacoEditor, MonacoEditorServices } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
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

// Initialize mermaid once at module load — it is a global singleton.
mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

@injectable()
export class MarkdownViewerWidget extends ReactWidget {
    static readonly ID = 'openspace-markdown-viewer-widget';
    static readonly LABEL = 'Markdown Viewer';

    /** URI of the file being viewed. Set by the open handler. */
    public uri: string = '';

    protected content: string = '';
    protected mode: ViewerMode = 'preview';
    protected monacoEditor: MonacoEditor | undefined;
    /** Guards against concurrent async invocations of mountMonacoEditor. */
    protected mountingEditor: boolean = false;
    /** Editor-scoped disposables — cleared on every destroyMonacoEditor() call. */
    protected editorDisposables = new DisposableCollection();

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(MonacoEditorServices)
    protected readonly monacoEditorServices!: MonacoEditorServices;

    @inject(MonacoTextModelService)
    protected readonly textModelService!: MonacoTextModelService;

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
        this.update();
    }

    /** Called by the open handler to set or refresh file content. */
    setContent(content: string): void {
        this.content = content;
        this.mode = 'preview';
        this.destroyMonacoEditor();
        this.update();
    }

    /** Called by the toolbar toggle contribution. */
    toggleMode(): void {
        if (this.mode === 'preview') {
            this.mode = 'edit';
        } else {
            // Capture current editor content before destroying
            if (this.monacoEditor) {
                this.content = this.monacoEditor.document.getText();
            }
            this.destroyMonacoEditor();
            this.mode = 'preview';
        }
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

    protected onBeforeDetach(msg: Message): void {
        this.destroyMonacoEditor();
        super.onBeforeDetach(msg);
    }

    protected render(): React.ReactNode {
        if (this.mode === 'preview') {
            return this.renderPreview();
        }
        return this.renderEditor();
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

    protected renderEditor(): React.ReactNode {
        return (
            <div
                className="markdown-viewer-editor-container"
                ref={(el) => {
                    if (el && !this.monacoEditor && !this.mountingEditor) {
                        this.mountMonacoEditor(el).catch(err =>
                            console.error('[MarkdownViewerWidget] Monaco mount failed:', err)
                        );
                    }
                }}
            />
        );
    }

    protected async mountMonacoEditor(container: HTMLDivElement): Promise<void> {
        if (!this.uri || this.mountingEditor) { return; }
        this.mountingEditor = true;
        try {
            const uri = new URI(this.uri);
            // loadModel returns MonacoEditorModel directly — no IReference to manage.
            // MonacoEditor.create() acquires its own managed reference internally.
            const document = await this.textModelService.loadModel(uri);

            this.monacoEditor = await MonacoEditor.create(
                uri,
                document,
                container,
                this.monacoEditorServices,
                {
                    language: 'markdown',
                    autoSizing: false,
                    minHeight: -1,
                }
            );

            // Layout to fill container after mount
            this.monacoEditor.getControl().layout();

            // Auto-save: debounced 1s. Listener registered on editorDisposables
            // (not this.toDispose) so it is cleared each time destroyMonacoEditor()
            // is called, preventing listener accumulation across edit sessions.
            let saveTimer: ReturnType<typeof setTimeout> | undefined;
            this.editorDisposables.push(
                this.monacoEditor.document.onDidChangeContent(() => {
                    if (saveTimer) { clearTimeout(saveTimer); }
                    saveTimer = setTimeout(() => {
                        this.saveCurrentContent().catch(err =>
                            console.warn('[MarkdownViewerWidget] Auto-save failed:', err)
                        );
                    }, 1000);
                })
            );
        } finally {
            this.mountingEditor = false;
        }
    }

    protected destroyMonacoEditor(): void {
        // Dispose editor-scoped listeners first, then reset the collection
        // so the next edit session starts clean.
        this.editorDisposables.dispose();
        this.editorDisposables = new DisposableCollection();
        if (this.monacoEditor) {
            this.monacoEditor.dispose();
            this.monacoEditor = undefined;
        }
    }

    protected async saveCurrentContent(): Promise<void> {
        if (!this.monacoEditor || !this.uri) { return; }
        const text = this.monacoEditor.document.getText();
        const uri = new URI(this.uri);
        await this.fileService.write(uri, text);
    }

    /** Run mermaid.run() after DOM settles. */
    protected runMermaid(): void {
        setTimeout(() => {
            mermaid.run({ querySelector: '.markdown-viewer-preview .mermaid' }).catch(err => {
                console.warn('[MarkdownViewerWidget] Mermaid render error:', err);
            });
        }, 0);
    }
}
