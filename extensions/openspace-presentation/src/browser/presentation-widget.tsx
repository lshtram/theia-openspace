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
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import Reveal from 'reveal.js';

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
 * Presentation Widget - displays reveal.js presentations in a Theia widget.
 */
@injectable()
export class PresentationWidget extends ReactWidget {
    static readonly ID = 'openspace-presentation-widget';
    static readonly LABEL = 'Presentation';

    protected revealDeck: Reveal | undefined;
    protected deckContent: string = '';
    protected containerRef: React.RefObject<HTMLDivElement>;

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
        this.update();
        // Re-initialize reveal.js if already attached
        if (this.revealDeck) {
            this.initializeReveal();
        }
    }

    /**
     * Get the current deck content
     */
    getContent(): string {
        return this.deckContent;
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
        this.initializeReveal();
    }

    protected onBeforeDetach(msg: Message): void {
        if (this.revealDeck) {
            this.revealDeck.destroy();
            this.revealDeck = undefined;
        }
        super.onBeforeDetach(msg);
    }

    protected initializeReveal(): void {
        const deckElement = this.containerRef.current?.querySelector('.reveal') as HTMLElement;
        if (!deckElement) {
            console.warn('[PresentationWidget] Reveal element not found');
            return;
        }

        if (this.revealDeck) {
            this.revealDeck.destroy();
        }

        this.revealDeck = new Reveal(deckElement, {
            hash: true,
            slideNumber: true,
            keyboard: false, // Disable to avoid Theia conflicts
            transition: 'slide',
            backgroundTransition: 'fade',
            embedded: true,
            margin: 0.04,
            width: 1200,
            height: 700,
            center: true
        });

        this.revealDeck.initialize().catch((err: Error) => {
            console.error('[PresentationWidget] Failed to initialize reveal.js:', err);
        });
    }

    protected render(): React.ReactNode {
        const parsed = PresentationWidget.parseDeckContent(this.deckContent);
        
        return (
            <div className="presentation-container" ref={this.containerRef}>
                <div className="reveal">
                    <div className="slides">
                        {parsed.slides.map((slide, index) => (
                            <section key={index} data-notes={slide.notes}>
                                <div 
                                    className="slide-content"
                                    dangerouslySetInnerHTML={{ __html: this.markdownToHtml(slide.content) }}
                                />
                            </section>
                        ))}
                        {parsed.slides.length === 0 && (
                            <section>
                                <h1>No Slides</h1>
                                <p>Create a presentation using .deck.md files</p>
                                <pre>
{`---
title: My Presentation
theme: black
---
# Slide 1
Content here
---
# Slide 2
More content`}
                                </pre>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /**
     * Simple markdown to HTML conversion for slides
     */
    protected markdownToHtml(markdown: string): string {
        let html = markdown;
        
        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Bold and italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Lists
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
        
        // Paragraphs (double newlines)
        html = html.replace(/\n\n/g, '</p><p>');
        
        // Wrap in paragraph if not already wrapped
        if (!html.startsWith('<')) {
            html = '<p>' + html + '</p>';
        }
        
        return html;
    }
}

/**
 * Navigation service for programmatic slide control
 */
@injectable()
export class PresentationNavigationService {
    protected reveal: Reveal | undefined;

    constructor(reveal?: Reveal) {
        this.reveal = reveal;
    }

    setReveal(reveal: Reveal): void {
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
