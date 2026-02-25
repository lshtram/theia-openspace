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
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import { MonacoEditor, MonacoEditorServices } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
import { IReference } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { attachTabDblClickToggle } from 'openspace-core/lib/browser/tab-dblclick-toggle';
import Reveal from 'reveal.js';
// reveal.js base CSS is loaded as a static <link> tag via injectRevealBaseCSS()
// to avoid webpack style-loader call stack recursion with large CSS bundles.
import { marked } from 'marked';

// All available reveal.js themes - injected as <link> tags to avoid
// webpack style-loader recursion with large combined CSS bundles.
const REVEAL_THEMES = new Set([
    'beige', 'black-contrast', 'black', 'blood', 'dracula', 'league',
    'moon', 'night', 'serif', 'simple', 'sky', 'solarized',
    'white-contrast', 'white', 'white_contrast_compact_verbatim_headers',
]);
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
    private _resizing: boolean = false;
    protected monacoEditor: MonacoEditor | undefined;
    protected monacoModelRef: IReference<MonacoEditorModel> | undefined;
    protected mountingEditor: boolean = false;
    protected editorDisposables = new DisposableCollection();
    private static readonly loadedThemes = new Set<string>();
    private static revealBaseCssInjected = false;

    /** Inject reveal.js base CSS via <link> tag once (avoids style-loader stack overflow). */
    private static injectRevealBaseCSS(): void {
        if (PresentationWidget.revealBaseCssInjected) { return; }
        PresentationWidget.revealBaseCssInjected = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/reveal-themes/reveal.css';
        link.dataset.revealBase = 'true';
        document.head.appendChild(link);
    }

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
        // Inject reveal.js base CSS as a <link> tag once per page load.
        // This avoids the webpack style-loader stack overflow caused by the
        // large reveal.css being processed by the CSS module runtime.
        PresentationWidget.injectRevealBaseCSS();
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
        console.log(`[PresentationWidget] setContent called: contentLen=${content.length}, containerRef=${!!this.containerRef?.current}`);
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
     * Extract all <style>...</style> blocks from slide content strings.
     * Returns the combined CSS text and the cleaned slide contents (styles removed).
     * This must be called BEFORE DOMPurify sanitization because DOMPurify strips <style> tags.
     */
    protected static extractSlideStyles(slides: SlideData[]): { css: string; cleanedSlides: SlideData[] } {
        const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let css = '';
        const cleanedSlides = slides.map(slide => {
            const rawContent = slide.content ?? '';
            const cleanContent = rawContent.replace(styleRe, (_match, cssText: string) => {
                css += cssText + '\n';
                return '';
            });
            return { ...slide, content: cleanContent };
        });
        return { css, cleanedSlides };
    }

    /**
     * Scope all CSS rules in extracted deck styles to a specific container element.
     * Prefixes every rule selector with `#scopeId` so styles only apply inside that element.
     * This prevents CSS from one presentation widget leaking into another.
     *
     * Algorithm:
     * 1. Strip block comments (/* ... *‌/) to avoid misidentifying comment text as selectors
     * 2. Walk the CSS token-by-token tracking brace depth
     * 3. At depth 0, accumulate selector/at-rule text until '{'
     * 4. At depth 1+ (inside a block), pass through content verbatim
     * 5. Prefix selectors: :root → #scopeId, html/body → #scopeId, others → #scopeId <sel>
     * 6. @-rule blocks (media, keyframes, supports) pass through unprefixed at depth 0
     */
    protected static scopeCss(css: string, scopeId: string): string {
        // Step 1: Strip block comments to prevent comment text being parsed as selectors.
        // Replace each comment with whitespace of equal length to preserve character positions.
        const stripped = css.replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length))
            .replace(/@charset[^;]*;/gi, '')
            .replace(/@import[^;]*;/gi, '');

        let result = '';
        let depth = 0;
        let buffer = '';  // accumulates selector text at depth 0, rule body at depth > 0
        let i = 0;

        while (i < stripped.length) {
            const ch = stripped[i];

            if (ch === '{') {
                if (depth === 0) {
                    // buffer holds the selector list or @-rule header
                    const token = buffer.trim();
                    buffer = '';
                    if (token.startsWith('@')) {
                        // @-rule block — emit as-is; inner selectors will be scoped when depth > 0
                        result += token + ' {';
                    } else if (token) {
                        // Regular selector — prefix each comma-separated part
                        const scoped = token
                            .split(',')
                            .map(sel => {
                                const s = sel.trim();
                                if (!s) { return ''; }
                                if (s === ':root') { return `#${scopeId}`; }
                                if (/^(html|body)\b/.test(s)) {
                                    const rest = s.replace(/^(html|body)\b/, '').trim();
                                    return rest ? `#${scopeId} ${rest}` : `#${scopeId}`;
                                }
                                return `#${scopeId} ${s}`;
                            })
                            .filter(Boolean)
                            .join(', ');
                        result += scoped + ' {';
                    } else {
                        result += '{';
                    }
                } else {
                    // Nested brace (inside a rule body or @-rule block)
                    result += buffer + '{';
                    buffer = '';
                }
                depth++;
                i++;
                continue;
            }

            if (ch === '}') {
                result += buffer + '}';
                buffer = '';
                depth = Math.max(0, depth - 1);
                i++;
                continue;
            }

            buffer += ch;
            i++;
        }

        // Flush any remaining buffer (e.g. trailing whitespace)
        result += buffer;
        return result;
    }

    /**
     * Inject extracted CSS from deck <style> blocks into the presentation container.
     * All CSS rules are scoped to the widget's unique container ID to prevent
     * styles from one open presentation leaking into another.
     * Uses a stable element id so repeated calls replace rather than append.
     */
    protected injectDeckStyles(container: HTMLElement, css: string): void {
        const STYLE_ATTR = 'data-deck-styles';
        // Remove previous injection to avoid duplicates on setContent() calls
        const existing = container.querySelector(`[${STYLE_ATTR}]`);
        if (existing) { existing.remove(); }
        if (!css.trim()) { return; }

        // Ensure the container has a stable unique id for CSS scoping
        if (!container.id) {
            container.id = `deck-scope-${Math.random().toString(36).slice(2, 9)}`;
        }
        const scopeId = container.id;
        const scopedCss = PresentationWidget.scopeCss(css, scopeId);

        const styleEl = document.createElement('style');
        styleEl.setAttribute(STYLE_ATTR, 'true');
        styleEl.textContent = scopedCss;
        // Insert before .reveal so styles load before slide content renders
        const revealEl = container.querySelector('.reveal');
        if (revealEl) {
            container.insertBefore(styleEl, revealEl);
        } else {
            container.appendChild(styleEl);
        }
    }

    /**
     * Write slide sections directly into the .slides DOM element (imperative, bypasses React).
     * Markdown is pre-rendered to HTML via marked.js — no data-markdown attribute is used,
     * which avoids the RevealMarkdown infinite-recursion / stack-overflow issue.
     * Must be called after the container is attached to the DOM.
     */
    protected writeSlidesDom(): void {
        const container = this.containerRef?.current;
        if (!container) { console.warn('[PresentationWidget] writeSlidesDom: no container'); return; }
        const slidesEl = container.querySelector('.slides');
        if (!slidesEl) { console.warn('[PresentationWidget] writeSlidesDom: no .slides element'); return; }

        const deck = PresentationWidget.parseDeckContent(this.deckContent);
        console.log(`[PresentationWidget] writeSlidesDom: ${deck.slides.length} slides, deckContentLen=${this.deckContent.length}`);
        if (deck.slides.length === 0) {
            // Clear any previously injected deck styles
            this.injectDeckStyles(container, '');
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
            // Step 1: Extract <style> blocks from ALL slides before any sanitization.
            // DOMPurify strips <style> tags, so we must pull them out first.
            const { css, cleanedSlides } = PresentationWidget.extractSlideStyles(deck.slides);

            // Step 2: Inject combined CSS into the container (outside .reveal)
            this.injectDeckStyles(container, css);

            // Step 3: Render remaining slide content (no <style> tags remain)
            slidesEl.innerHTML = cleanedSlides.map(slide => {
                // Extract <!-- .slide: --> directives BEFORE sanitization, since DOMPurify
                // strips HTML comments by default. The directives are applied as attributes
                // on the <section> element (e.g. data-background-image="...").
                const rawContent = slide.content ?? '';
                const { directives, cleanContent } = PresentationWidget.extractSlideDirectives(rawContent);
                // Pre-render markdown → HTML synchronously via marked.parse()
                // This avoids the RevealMarkdown plugin's data-markdown processing loop
                // which causes a stack overflow (infinite recursion in writeSlidesDom).
                const renderedHtml = marked.parse(cleanContent, { async: false }) as string;
                // Task 4: Sanitize rendered HTML to prevent XSS via crafted .deck.md files
                const sanitized = DOMPurify.sanitize(renderedHtml, {
                    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','a','img',
                        'code','pre','em','strong','blockquote','br','hr','table','thead','tbody',
                        'tr','th','td','span','div','sup','sub'],
                    ALLOWED_ATTR: ['href','src','alt','class','id','style']
                });
                const notesAttr = slide.notes ? ` data-notes="${slide.notes.replace(/"/g, '&quot;')}"` : '';
                // No data-markdown attribute — reveal.js treats this as a plain HTML section
                return `<section${notesAttr}${directives}>${sanitized}</section>`;
            }).join('');
        }
    }

    /**
     * Extract <!-- .slide: key="value" --> directives from slide content.
     * These are reveal.js markdown plugin directives that must be applied as
     * attributes on the <section> element. DOMPurify strips HTML comments, so
     * we extract them before sanitization.
     *
     * Only data-background-* and data-notes attributes are allowed through.
     * Returns a string of attributes to append to the <section> tag, and
     * the content with the comment directives removed.
     */
    static extractSlideDirectives(content: string): { directives: string; cleanContent: string } {
        const directiveRe = /<!--\s*\.slide:\s*(.*?)\s*-->/gs;
        const allowedAttrRe = /\b(data-background-(?:image|opacity|color|video|size|position|repeat|transition|interactive)|data-notes)=["']([^"']*)["']/g;
        let directives = '';
        const cleanContent = content.replace(directiveRe, (_match, attrs: string) => {
            // Only pass through known-safe data-background-* and data-notes attrs
            let match: RegExpExecArray | null;
            while ((match = allowedAttrRe.exec(attrs)) !== null) {
                const attrName = match[1];
                const attrValue = match[2].replace(/"/g, '&quot;');
                directives += ` ${attrName}="${attrValue}"`;
            }
            return '';
        });
        return { directives, cleanContent: cleanContent.trim() };
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
        // When switching back to presentation mode, React replaces the Monaco
        // container with a fresh .presentation-container shell on this update()
        // call. The ref fires synchronously during React's commit, but Reveal.js
        // needs the DOM to be fully laid out. Use rAF to write slides and
        // re-initialize Reveal after the browser's next layout pass.
        if (this.mode === 'presentation') {
            requestAnimationFrame(() => {
                this.writeSlidesDom();
                this.initializeReveal().catch(err =>
                    console.error('[PresentationWidget] Failed to re-initialize reveal.js after toggle:', err)
                );
            });
        }
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
            // Defer layout() until after the browser has done a layout pass.
            // The React commit that swapped .presentation-container for
            // .presentation-editor-container happens synchronously; the browser
            // hasn't recalculated offsetWidth/offsetHeight yet at this point, so
            // calling layout() immediately yields {width:0, height:0} and Monaco
            // renders a single-line editor. rAF lets the browser finish layout first.
            requestAnimationFrame(() => {
                this.monacoEditor?.getControl().layout();
            });

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
        console.log(`[PresentationWidget] onAfterAttach: mode=${this.mode}, deckContentLen=${this.deckContent.length}, uri=${this.uri}`);
        if (this.mode === 'presentation') {
            // Defer slide writing until React has committed its first render.
            // onAfterAttach fires synchronously during Lumino's DOM insertion,
            // before React's useLayoutEffect/componentDidMount runs. rAF lets
            // the browser do a layout pass so containerRef.current is non-null.
            requestAnimationFrame(() => {
                console.log(`[PresentationWidget] rAF in onAfterAttach: containerRef=${!!this.containerRef?.current}, deckContentLen=${this.deckContent.length}`);
                if (!this.deckContent && this.uri) {
                    // Widget was restored from saved layout without setContent() being called
                    // (e.g. page reload). Re-read the file from URI to re-hydrate content.
                    console.log(`[PresentationWidget] Re-hydrating from URI: ${this.uri}`);
                    this.rehydrateFromUri().catch(err =>
                        console.error('[PresentationWidget] Failed to re-hydrate from URI:', err)
                    );
                } else {
                    this.writeSlidesDom();
                    this.initializeReveal().catch(err =>
                        console.error('[PresentationWidget] Failed to initialize reveal.js:', err)
                    );
                }
            });
        }
        const disposable = attachTabDblClickToggle(
            this.node,
            () => this.title.label,
            () => this.toggleMode(),
        );
        this.toDisposeOnDetach.push(disposable);
    }

    /**
     * Re-hydrate deck content from file URI after a page reload.
     * Called when the widget is restored from saved layout (deckContent is empty but uri is set).
     */
    protected async rehydrateFromUri(): Promise<void> {
        if (!this.uri) { return; }
        try {
            const uriObj = this.uri.startsWith('file://') ? new URI(this.uri) : URI.fromFilePath(this.uri);
            const content = await this.fileService.read(uriObj);
            this.deckContent = content.value;
            // Update tab title from filename
            const base = uriObj.path.base;
            this.title.label = base.endsWith('.deck.md') ? base.slice(0, -'.deck.md'.length) : base;
            this.title.caption = this.title.label;
            this.writeSlidesDom();
            await this.initializeReveal();
            console.log(`[PresentationWidget] Re-hydrated ${this.deckContent.length} chars from ${this.uri}`);
        } catch (err) {
            console.error('[PresentationWidget] rehydrateFromUri failed:', err);
        }
    }

    protected onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        // Relay Lumino resize events to Monaco so it fills the widget correctly
        // both on initial mount and on subsequent panel resizes.
        if (this.monacoEditor) {
            this.monacoEditor.getControl().layout();
        }
        // Guard against re-entrant calls: reveal.layout() may trigger a DOM
        // resize, which would fire onResize again, causing a stack overflow.
        if (this.revealDeck && !this._resizing) {
            this._resizing = true;
            try {
                this.revealDeck.layout();
            } finally {
                this._resizing = false;
            }
        }
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

    protected loadTheme(themeName: string): void {
        const theme = themeName || 'black';
        
        // Check if already loaded (global across all widget instances)
        if (PresentationWidget.loadedThemes.has(theme)) { return; }

        // Validate theme name
        if (!REVEAL_THEMES.has(theme)) {
            console.warn(`[PresentationWidget] Unknown theme "${theme}", falling back to black`);
            this.loadTheme('black');
            return;
        }

        PresentationWidget.loadedThemes.add(theme);

        // Inject a <link> tag pointing to the statically-copied theme CSS file.
        // This avoids webpack's style-loader runtime recursion caused by 15
        // large CSS files bundled into a single chunk.
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/reveal-themes/${theme}.css`;
        link.dataset.revealTheme = theme;
        document.head.appendChild(link);
    }

    protected async initializeReveal(): Promise<void> {
        const container = this.containerRef?.current;
        if (!container) { console.warn('[PresentationWidget] initializeReveal: no container'); return; }
        const deckElement = container.querySelector('.reveal');
        if (!deckElement) { console.warn('[PresentationWidget] initializeReveal: no .reveal element'); return; }
        console.log(`[PresentationWidget] initializeReveal starting, deckElement children=${deckElement.children.length}`);

        if (this.revealDeck) {
            this.revealDeck.destroy();
            this.revealDeck = undefined;
        }

        const deck = PresentationWidget.parseDeckContent(this.deckContent);
        const options = deck.options;

        // Load theme dynamically based on frontmatter
        this.loadTheme(options.theme ?? 'black');

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
            plugins: [],
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

    /**
     * Persist URI and mode across page reloads via Theia's ShellLayoutRestorer.
     * The restorer stores this alongside the widget's construction options.
     */
    storeState(): object {
        return { uri: this.uri };
    }

    /**
     * Restore URI from persisted state. Content is re-hydrated in onAfterAttach()
     * via rehydrateFromUri() when deckContent is empty but uri is set.
     */
    restoreState(oldState: object & { uri?: string }): void {
        if (oldState?.uri) {
            this.uri = oldState.uri;
        }
    }

}
