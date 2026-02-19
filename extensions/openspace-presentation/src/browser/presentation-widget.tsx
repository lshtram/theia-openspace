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
import Reveal from 'reveal.js';
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';

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

    protected revealDeck: Reveal | undefined;
    protected deckContent: string = '';
    protected containerRef: React.RefObject<HTMLDivElement>;
    
    // T2-22: Store the URI for findByUri comparison
    public uri: string = '';

    @inject(PresentationNavigationService) @optional()
    protected readonly navigationService!: PresentationNavigationService;

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
                const escapedContent = (slide.content ?? '').replace(/<\/script>/g, '<\\/script>');
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
        this.writeSlidesDom();
        this.initializeReveal().catch(err => console.error('[PresentationWidget] Failed to initialize reveal.js:', err));
    }

    protected onBeforeDetach(msg: Message): void {
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

}
