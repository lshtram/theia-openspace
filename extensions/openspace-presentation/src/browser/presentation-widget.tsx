// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { injectable, inject, optional, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import { MonacoEditor, MonacoEditorServices } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
import { IReference } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { attachTabDblClickToggle } from 'openspace-core/lib/browser/tab-dblclick-toggle';
import Reveal from 'reveal.js';
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('@theia/core/shared/dompurify');

export interface DeckOptions {
    title?: string;
    theme?: string;
    transition?: string;
}

export interface SlideData {
    content: string;
    notes?: string;
}

export interface DeckData {
    options: DeckOptions;
    slides: SlideData[];
}

export type PresentationMode = 'presentation' | 'edit';

/**
 * Navigation service for programmatic slide control
 */
@injectable()
export class PresentationNavigationService {
    protected reveal: Reveal | undefined;

    constructor() {
        // Reveal instance is set via setReveal() after widget initialization
    }

    setReveal(reveal: Reveal | undefined): void {
        this.reveal = reveal;
    }

    next(): void {
        this.reveal?.next();
    }

    prev(): void {
        this.reveal?.prev();
    }

    slide(h: number, v: number = 0, f: number = 0): void {
        this.reveal?.slide(h, v, f);
    }

    getIndices(): { h: number; v: number; f?: number } {
        return this.reveal?.getIndices() || { h: 0, v: 0 };
    }

    toggleFullscreen(container?: HTMLElement): void {
        const element = container || document.documentElement;
        
        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(err => {
                console.error('[PresentationWidget] Failed to enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error('[PresentationWidget] Failed to exit fullscreen:', err);
            });
        }
    }

    sync(): void {
        this.reveal?.sync();
    }

    layout(): void {
        this.reveal?.layout();
    }
}

/**
 * Presentation Widget - displays reveal.js presentations in a Theia widget.
 */
@injectable()
export class PresentationWidget extends ReactWidget {
    static readonly ID = 'openspace-presentation-widget';
    static readonly LABEL = 'Presentation';
    private static readonly ICON_PRESENTATION = 'fa fa-play-circle';
    private static readonly ICON_EDIT = 'codicon codicon-edit';

    protected revealDeck: Reveal | undefined;
    protected deckContent: string = '';
    protected containerRef: React.RefObject<HTMLDivElement>;
    protected mode: PresentationMode = 'presentation';
    protected monacoEditor: MonacoEditor | undefined;
    protected monacoModelRef: IReference<MonacoEditorModel> | undefined;
    protected mountingEditor: boolean = false;
    protected editorDisposables = new DisposableCollection();

    // T2-22: Store the URI for findByUri comparison
    public uri: string = '';

    @inject(PresentationNavigationService) @optional()
    protected readonly navigationService!: PresentationNavigationService;

    @inject(MonacoEditorServices)
    protected readonly monacoEditorServices!: MonacoEditorServices;

    @inject(MonacoTextModelService)
    protected readonly textModelService!: MonacoTextModelService;

    @inject(FileService)
    protected readonly fileService!: FileService;

    constructor() {
        super();
        this.id = PresentationWidget.ID;
        this.title.label = PresentationWidget.LABEL;
        this.title.caption = PresentationWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-play-circle';
        this.addClass('openspace-presentation-widget');
        this.containerRef = React.createRef();
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    /**
     * Set the deck content (markdown with --- slide delimiters)
     */
    setContent(content: string): void {
        this.deckContent = content;
        // Guard: only drive DOM updates when the container is already attached.
        // If called before React has rendered (containerRef.current === null),
        // onAfterAttach() will fire later and pick up deckContent at that point.
        if (!this.containerRef?.current) { return; }
        // Imperatively write slides into the .slides container — outside React's
        // reconciliation scope — so that RevealMarkdown can freely mutate the DOM
        // without React overwriting its changes on the next render cycle.
        this.writeSlidesDom();
        this.initializeReveal().catch(err => console.error('[PresentationWidget] Failed to initialize reveal.js:', err));
    }

    /**
     * Write slide sections directly into the .slides DOM element (imperative, bypasses React).
     * Must be called after the container is attached to the DOM.
     */
    protected writeSlidesDom(): void {
        const container = this.containerRef?.current;
        if (!container) { return; }
        const slidesEl = container.querySelector('.slides');
        if (!slidesEl) { return; }

        const deck = PresentationWidget.parseDeckContent(this.deckContent);
        if (deck.slides.length === 0) {
            slidesEl.innerHTML = `
                <section>
                    <h1>No Slides</h1>
                    <p>Create a presentation using .deck.md files</p>
                    <pre>---
title: My Presentation
theme: black
---
# Slide 1
Content here
---
# Slide 2
More content</pre>
                </section>`;
        } else {
            slidesEl.innerHTML = deck.slides.map(slide => {
                // Task 4: Sanitize slide content to prevent XSS via crafted .deck.md files
                const rawContent = slide.content ?? '';
                const sanitized = DOMPurify.sanitize(rawContent, {
                    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','a','img',
                        'code','pre','em','strong','blockquote','br','hr','table','thead','tbody',
                        'tr','th','td','span','div','sup','sub'],
                    ALLOWED_ATTR: ['href','src','alt','class','id','style']
                });
                const escapedContent = sanitized.replace(/<\/script>/g, '<\\/script>');
                const notesAttr = slide.notes ? ` data-notes="${slide.notes.replace(/"/g, '&quot;')}"` : '';
                return `<section data-markdown=""${notesAttr}><script type="text/template">${escapedContent}</script></section>`;
            }).join('');
        }
    }

    /**
     * Get the current deck content
     */
    getContent(): string {
        return this.deckContent;
    }

    /**
     * Get the current mode ('presentation' or 'edit').
     */
    getMode(): PresentationMode {
        return this.mode;
    }

    /**
     * Toggle between presentation mode (Reveal.js) and edit mode (Monaco).
     */
    toggleMode(): void {
        if (this.mode === 'presentation') {
            this.mode = 'edit';
            // Tear down reveal so it doesn't fight Monaco over the DOM
            if (this.revealDeck) {
                this.revealDeck.destroy();
                this.revealDeck = undefined;
                this.navigationService?.setReveal(undefined);
            }
        } else {
            // Capture any edits before destroying Monaco
            if (this.monacoEditor) {
                this.deckContent = this.monacoEditor.document.getText();
            }
            this.destroyMonacoEditor();
            this.mode = 'presentation';
        }
        this.title.iconClass = this.mode === 'edit'
            ? PresentationWidget.ICON_EDIT
            : PresentationWidget.ICON_PRESENTATION;
        this.update();
    }

    /**
     * Destroy the Monaco editor and all associated disposables.
     */
    protected destroyMonacoEditor(): void {
        this.editorDisposables.dispose();
        this.editorDisposables = new DisposableCollection();
        if (this.monacoEditor) {
            this.monacoEditor.dispose();
            this.monacoEditor = undefined;
        }
        if (this.monacoModelRef) {
            this.monacoModelRef.dispose();
            this.monacoModelRef = undefined;
        }
    }

    /**
     * Mount a Monaco editor into the given container element.
     */
    protected async mountMonacoEditor(container: HTMLDivElement): Promise<void> {
        if (!this.uri || this.mountingEditor) { return; }
        this.mountingEditor = true;
        try {
            const uri = new URI(this.uri);
            const ref = await this.textModelService.createModelReference(uri);
            this.monacoModelRef = ref;
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
            this.monacoEditor.getControl().layout();

            let saveTimer: ReturnType<typeof setTimeout> | undefined;
            this.editorDisposables.push(
                this.monacoEditor.document.onDidChangeContent(() => {
                    if (saveTimer) { clearTimeout(saveTimer); }
                    saveTimer = setTimeout(() => {
                        this.saveCurrentContent().catch(err =>
                            console.warn('[PresentationWidget] Auto-save failed:', err)
                        );
                    }, 1000);
                })
            );
        } finally {
            this.mountingEditor = false;
        }
    }

    /**
     * Save the current Monaco editor content to disk.
     */
    protected async saveCurrentContent(): Promise<void> {
        if (!this.monacoEditor || !this.uri) { return; }
        const text = this.monacoEditor.document.getText();
        const uri = new URI(this.uri);
        await this.fileService.write(uri, text);
    }

    /**
     * Get the presentation container element (used for fullscreen toggle)
     */
    get revealContainer(): HTMLElement | null {
        return this.containerRef?.current ?? null;
    }

    /**
     * Parse deck content from markdown
     */
    static parseDeckContent(markdown: string): DeckData {
        const lines = markdown.split('\n');
        const frontmatter: Record<string, string> = {};
        const slides: SlideData[] = [];
        
        // Parse YAML frontmatter
        if (lines[0]?.trim() === '---') {
            let i = 1;
            while (i < lines.length && lines[i].trim() !== '---') {
                const [key, ...valueParts] = lines[i].split(':');
                if (key && valueParts.length > 0) {
                    frontmatter[key.trim()] = valueParts.join(':').trim();
                }
                i++;
            }
            
            // Skip past closing ---
            i++;
            
            // Get remaining content as slides
            const content = lines.slice(i).join('\n');
            const slideContents = content.split(/^---$/m).filter(s => s.trim());
            
            slideContents.forEach(slideContent => {
                const notesMatch = slideContent.match(/Note[s]?:\s*([\s\S]*)$/i);
                const notes = notesMatch ? notesMatch[1].trim() : undefined;
                const content = slideContent.replace(/Note[s]?:\s*[\s\S]*$/i, '').trim();
                
                slides.push({ content, notes });
            });
        } else {
            // No frontmatter, treat entire content as slides
            const slideContents = markdown.split(/^---$/m).filter(s => s.trim());
            slideContents.forEach(slideContent => {
                slides.push({ content: slideContent.trim() });
            });
        }
        
        return {
            options: {
                title: frontmatter.title,
                theme: frontmatter.theme || 'black',
                transition: frontmatter.transition || 'slide'
            },
            slides
        };
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (this.mode === 'presentation') {
            this.writeSlidesDom();
            this.initializeReveal().catch(err =>
                console.error('[PresentationWidget] Failed to initialize reveal.js:', err)
            );
        }
        const disposable = attachTabDblClickToggle(
            this.node,
            () => this.title.label,
            () => this.toggleMode(),
        );
        this.toDisposeOnDetach.push(disposable);
    }

    protected onBeforeDetach(msg: Message): void {
        this.destroyMonacoEditor();
        if (this.revealDeck) {
            this.revealDeck.destroy();
            this.revealDeck = undefined;
        }
        this.navigationService?.setReveal(undefined);
        super.onBeforeDetach(msg);
    }

    protected async initializeReveal(): Promise<void> {
        const container = this.containerRef?.current;
        if (!container) { return; }
        const deckElement = container.querySelector('.reveal');
        if (!deckElement) { return; }

        if (this.revealDeck) {
            this.revealDeck.destroy();
            this.revealDeck = undefined;
        }

        const deck = PresentationWidget.parseDeckContent(this.deckContent);
        const options = deck.options;

        this.revealDeck = new Reveal(deckElement as HTMLElement, {
            hash: false,
            slideNumber: true,
            keyboard: false,
            embedded: true,
            margin: 0.04,
            width: '100%',
            height: '100%',
            center: true,
            transition: options.transition ?? 'slide',
            backgroundTransition: 'fade',
            plugins: [RevealMarkdown],
        });

        await this.revealDeck.initialize();
        this.navigationService?.setReveal(this.revealDeck);
    }

    protected render(): React.ReactNode {
        if (this.mode === 'edit') {
            return this.renderEditor();
        }
        return this.renderPresentation();
    }

    protected renderPresentation(): React.ReactNode {
        // Render only the structural shell. Slide <section> elements are written
        // imperatively via writeSlidesDom() to avoid React overwriting RevealMarkdown's
        // DOM mutations (outerHTML replacements) during reconciliation.
        return (
            <div className="presentation-container" ref={this.containerRef}>
                <div className="reveal">
                    <div className="slides">
                        {/* Populated imperatively by writeSlidesDom() */}
                    </div>
                </div>
            </div>
        );
    }

    protected renderEditor(): React.ReactNode {
        return (
            <div
                className="presentation-editor-container"
                ref={(el) => {
                    if (el && !this.monacoEditor && !this.mountingEditor) {
                        this.mountMonacoEditor(el as HTMLDivElement).catch(err =>
                            console.error('[PresentationWidget] Monaco mount failed:', err)
                        );
                    }
                }}
            />
        );
    }

}
