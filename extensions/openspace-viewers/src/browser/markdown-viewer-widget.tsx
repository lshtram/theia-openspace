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
import { IReference } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { StatefulWidget } from '@theia/core/lib/browser/shell/shell-layout-restorer';
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

console.log('[MarkdownViewerWidget] BUILD v7 — tab icon swap + dblclick toggle');

@injectable()
export class MarkdownViewerWidget extends ReactWidget implements StatefulWidget {
    static readonly ID = 'openspace-markdown-viewer-widget';
    static readonly LABEL = 'Markdown Viewer';
    private static readonly ICON_PREVIEW = 'codicon codicon-markdown';
    private static readonly ICON_EDIT = 'codicon codicon-edit';

    /** URI of the file being viewed. Set by the open handler. */
    public uri: string = '';

    protected content: string = '';
    protected mode: ViewerMode = 'preview';
    protected monacoEditor: MonacoEditor | undefined;
    /** Reference to the Monaco model — must be disposed with the editor to release the ref-count. */
    protected monacoModelRef: IReference<MonacoEditorModel> | undefined;
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
        this.title.iconClass = MarkdownViewerWidget.ICON_PREVIEW;
        this.addClass('openspace-markdown-viewer-widget');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    /**
     * Called by Theia when the widget is activated (made visible / focused).
     * If the widget was restored from layout state the content will be empty
     * even though uri is set — reload from disk in that case.
     */
    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
        console.log('[MarkdownViewerWidget] onActivateRequest: uri=', this.uri, 'hasContent=', !!this.content);
        if (this.uri && !this.content) {
            this.reloadFromUri().catch(err =>
                console.error('[MarkdownViewerWidget] Failed to reload on activate:', err)
            );
        }
    }

    /** StatefulWidget: called on unload to persist state across refreshes. */
    storeState(): object {
        console.log('[MarkdownViewerWidget] storeState: uri=', this.uri);
        return { uri: this.uri };
    }

    /** StatefulWidget: called during layout restore to rehydrate the widget. */
    restoreState(oldState: object): void {
        const state = oldState as { uri?: string };
        console.log('[MarkdownViewerWidget] restoreState: uri=', state.uri);
        if (state.uri) {
            this.uri = state.uri;
            const uriObj = new URI(this.uri);
            this.title.label = uriObj.path.base;
            this.title.caption = uriObj.path.base;
            // Reload content from disk asynchronously
            this.reloadFromUri().catch(err =>
                console.error('[MarkdownViewerWidget] restoreState reload failed:', err)
            );
        }
    }

    /** Reload file content from disk (used after layout restore). */
    protected async reloadFromUri(): Promise<void> {
        try {
            console.log('[MarkdownViewerWidget] reloadFromUri: loading', this.uri);
            const uri = new URI(this.uri);
            const result = await this.fileService.read(uri);
            console.log('[MarkdownViewerWidget] reloadFromUri: loaded', result.value.length, 'chars');
            this.setContent(result.value);
        } catch (err) {
            console.error('[MarkdownViewerWidget] reloadFromUri failed:', err);
            this.setContent('# Error\n\nFailed to load file content.');
        }
    }

    /** Called by the open handler to set or refresh file content. */
    setContent(content: string): void {
        this.content = content;
        this.mode = 'preview';
        this.title.iconClass = MarkdownViewerWidget.ICON_PREVIEW;
        this.destroyMonacoEditor();
        this.update();
    }

    /** Called by the toolbar toggle contribution. */
    toggleMode(): void {
        console.log('[MarkdownViewerWidget] toggleMode called, current mode:', this.mode, 'uri:', this.uri);
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
        this.title.iconClass = this.mode === 'edit'
            ? MarkdownViewerWidget.ICON_EDIT
            : MarkdownViewerWidget.ICON_PREVIEW;
        console.log('[MarkdownViewerWidget] toggleMode → new mode:', this.mode);
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
        this.attachTabDblClickListener();
    }

    protected attachTabDblClickListener(): void {
        // this.node is the widget body. The dock panel contains both the
        // widget stack and the tab bar as sibling panels.
        const dockPanel = this.node.closest('.lm-DockPanel');
        if (!dockPanel) { return; }
        const tabBarContent = dockPanel.querySelector('.lm-TabBar-content');
        if (!tabBarContent) { return; }
        const handler = (e: Event) => {
            const tab = (e.target as HTMLElement).closest('.lm-TabBar-tab');
            if (!tab) { return; }
            const label = tab.querySelector('.lm-TabBar-tabLabel');
            if (label && label.textContent === this.title.label) {
                this.toggleMode();
            }
        };
        tabBarContent.addEventListener('dblclick', handler);
        this.toDisposeOnDetach.push({ dispose: () => tabBarContent.removeEventListener('dblclick', handler) });
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
                    console.log('[MarkdownViewerWidget] renderEditor ref fired: el=', !!el, 'hasEditor=', !!this.monacoEditor, 'mounting=', this.mountingEditor, 'uri=', this.uri);
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
        console.log('[MarkdownViewerWidget] mountMonacoEditor: uri=', this.uri, 'containerSize=', container.offsetWidth, 'x', container.offsetHeight, 'mounting=', this.mountingEditor);
        if (!this.uri || this.mountingEditor) { return; }
        this.mountingEditor = true;
        try {
            const uri = new URI(this.uri);
            // createModelReference is ref-counted: returns existing model if already open,
            // creates a new one otherwise. We hold the reference and dispose it with the editor.
            const ref = await this.textModelService.createModelReference(uri);
            this.monacoModelRef = ref;

            // Load the model so textEditorModel is available, then pass it explicitly
            // in options.model — without this Monaco creates a blank model and shows empty content.
            // suppressOpenEditorWhenDirty prevents a second editor from opening on save.
            ref.object.suppressOpenEditorWhenDirty = true;
            const loadedDoc = await ref.object.load();
            const textModel = loadedDoc.textEditorModel;

            this.monacoEditor = await MonacoEditor.create(
                uri,
                ref.object,
                container,
                this.monacoEditorServices,
                {
                    model: textModel,
                    language: 'markdown',
                    autoSizing: false,
                    minHeight: -1,
                }
            );

            console.log('[MarkdownViewerWidget] MonacoEditor created successfully');
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
        // Release the model reference after the editor is disposed
        if (this.monacoModelRef) {
            this.monacoModelRef.dispose();
            this.monacoModelRef = undefined;
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
            const els = document.querySelectorAll('.markdown-viewer-preview .mermaid');
            console.log('[MarkdownViewerWidget] runMermaid: found', els.length, 'mermaid elements');
            if (els.length > 0) {
                console.log('[MarkdownViewerWidget] first mermaid element textContent:', els[0].textContent?.substring(0, 100));
            }
            mermaid.run({ querySelector: '.markdown-viewer-preview .mermaid' }).catch(err => {
                console.warn('[MarkdownViewerWidget] Mermaid render error:', err);
            });
        }, 0);
    }
}
