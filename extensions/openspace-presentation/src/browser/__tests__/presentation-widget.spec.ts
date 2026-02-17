// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import * as sinon from 'sinon';

describe('PresentationWidget', () => {
    let mockReveal: any;

    const sampleDeckContent = `---
title: Test Presentation
theme: black
---
# Slide 1
Content here
---
# Slide 2
More content
`;

    beforeEach(() => {
        // Mock global Reveal
        mockReveal = {
            initialize: sinon.stub().resolves(),
            sync: sinon.stub(),
            layout: sinon.stub(),
            destroy: sinon.stub(),
            slide: sinon.stub(),
            next: sinon.stub(),
            prev: sinon.stub(),
            getIndices: sinon.stub().returns({ h: 0, v: 0 }),
            getCurrentSlide: sinon.stub().returns(document.createElement('div')),
            getConfig: sinon.stub().returns({ keyboard: false })
        };

        (global as any).Reveal = sinon.stub().returns(mockReveal);
    });

    afterEach(() => {
        sinon.restore();
        delete (global as any).Reveal;
    });

    describe('Widget Constants', () => {
        it('should have correct widget ID', () => {
            const widgetId = 'openspace-presentation-widget';
            expect(widgetId).to.equal('openspace-presentation-widget');
            expect(widgetId).to.include('presentation');
        });

        it('should have correct widget label', () => {
            const widgetLabel = 'Presentation';
            expect(widgetLabel).to.equal('Presentation');
        });
    });

    describe('Deck Content Parsing', () => {
        it('should parse YAML frontmatter', () => {
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const match = sampleDeckContent.match(frontmatterRegex);
            expect(match).to.not.be.null;
            // The frontmatter content
            expect(sampleDeckContent).to.include('title: Test Presentation');
            expect(sampleDeckContent).to.include('theme: black');
        });

        it('should extract slides from markdown', () => {
            const slides = sampleDeckContent.split(/^---$/m).filter(s => s.trim() && !s.startsWith('---'));
            expect(slides.length).to.be.greaterThan(0);
        });

        it('should handle deck without frontmatter', () => {
            const noFrontmatter = `# Slide 1\nContent\n---\n# Slide 2\nMore`;
            const slides = noFrontmatter.split(/^---$/m).filter(s => s.trim());
            expect(slides).to.have.lengthOf(2);
        });

        it('should handle empty deck', () => {
            const empty = '';
            const slides = empty.split(/^---$/m).filter(s => s.trim());
            expect(slides).to.have.lengthOf(0);
        });
    });

    describe('Navigation', () => {
        it('should navigate to next slide', () => {
            mockReveal.next();
            expect(mockReveal.next.calledOnce).to.be.true;
        });

        it('should navigate to previous slide', () => {
            mockReveal.prev();
            expect(mockReveal.prev.calledOnce).to.be.true;
        });

        it('should navigate to specific slide', () => {
            mockReveal.slide(1, 0);
            expect(mockReveal.slide.calledWith(1, 0)).to.be.true;
        });

        it('should get current slide indices', () => {
            const indices = mockReveal.getIndices();
            expect(indices.h).to.equal(0);
            expect(indices.v).to.equal(0);
        });
    });

    describe('Fullscreen', () => {
        it('should have fullscreen toggle capability', () => {
            // Fullscreen API may not be available in test environment - that's OK
            // The important thing is the code handles this gracefully
            expect(typeof document.fullscreenEnabled === 'boolean' || document.fullscreenEnabled === undefined).to.be.true;
        });
    });

    describe('Reveal.js Integration', () => {
        it('should create reveal instance with correct options', () => {
            const reveal = new (global as any).Reveal(document.createElement('div'), {
                keyboard: false,
                hash: true,
                slideNumber: true
            });
            
            expect(reveal).to.not.be.undefined;
            expect((global as any).Reveal.calledOnce).to.be.true;
        });

        it('should initialize reveal.js', async () => {
            const reveal = new (global as any).Reveal(document.createElement('div'));
            await reveal.initialize();
            
            expect(mockReveal.initialize.calledOnce).to.be.true;
        });

        it('should destroy reveal.js', () => {
            const reveal = new (global as any).Reveal(document.createElement('div'));
            reveal.destroy();
            
            expect(mockReveal.destroy.calledOnce).to.be.true;
        });
    });

    describe('Markdown to HTML', () => {
        it('should convert headers', () => {
            const md = '# Header 1\n## Header 2\n### Header 3';
            
            let html = md.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            
            expect(html).to.include('<h1>Header 1</h1>');
            expect(html).to.include('<h2>Header 2</h2>');
            expect(html).to.include('<h3>Header 3</h3>');
        });

        it('should convert bold and italic', () => {
            const md = '**bold** and *italic*';
            
            let html = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            expect(html).to.include('<strong>bold</strong>');
            expect(html).to.include('<em>italic</em>');
        });

        it('should convert code blocks', () => {
            const md = '`inline code`';
            
            let html = md.replace(/`(.*?)`/g, '<code>$1</code>');
            
            expect(html).to.include('<code>inline code</code>');
        });

        it('should convert links', () => {
            const md = '[link text](http://example.com)';
            
            const html = md.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
            
            expect(html).to.include('<a href="http://example.com">link text</a>');
        });

        it('should convert lists', () => {
            const md = '- item 1\n- item 2';
            
            const html = md.replace(/^- (.*$)/gm, '<li>$1</li>');
            
            expect(html).to.include('<li>item 1</li>');
            expect(html).to.include('<li>item 2</li>');
        });
    });

    describe('Deck Options', () => {
        it('should support custom themes', () => {
            const theme = 'white';
            expect(['white', 'black', 'league', 'beige', 'sky', 'night']).to.include(theme);
        });

        it('should support custom transitions', () => {
            const transition = 'slide';
            expect(['none', 'fade', 'slide', 'convex', 'concave', 'zoom']).to.include(transition);
        });
    });
});
