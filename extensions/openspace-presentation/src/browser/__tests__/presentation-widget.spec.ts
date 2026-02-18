// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Tests for PresentationWidget exports.
 *
 * NOTE: PresentationWidget is a Theia ReactWidget wired via InversifyJS DI.
 * It cannot be instantiated without a full Theia container.
 * These tests cover:
 *   - Static constants (ID, LABEL)
 *   - PresentationWidget.parseDeckContent() static method
 *   - PresentationNavigationService methods (using a stubbed Reveal.js instance)
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { PresentationWidget, PresentationNavigationService } from '../presentation-widget';

describe('PresentationWidget', () => {

    describe('Widget Constants', () => {
        it('should have correct widget ID', () => {
            expect(PresentationWidget.ID).to.equal('openspace-presentation-widget');
        });

        it('should have correct widget label', () => {
            expect(PresentationWidget.LABEL).to.equal('Presentation');
        });
    });

    describe('parseDeckContent — with frontmatter', () => {
        const withFrontmatter = `---
title: Test Presentation
theme: white
transition: fade
---
# Slide 1
Content here
---
# Slide 2
More content`;

        it('should parse title from frontmatter', () => {
            const deck = PresentationWidget.parseDeckContent(withFrontmatter);
            expect(deck.options.title).to.equal('Test Presentation');
        });

        it('should parse theme from frontmatter', () => {
            const deck = PresentationWidget.parseDeckContent(withFrontmatter);
            expect(deck.options.theme).to.equal('white');
        });

        it('should parse transition from frontmatter', () => {
            const deck = PresentationWidget.parseDeckContent(withFrontmatter);
            expect(deck.options.transition).to.equal('fade');
        });

        it('should extract slides after frontmatter', () => {
            const deck = PresentationWidget.parseDeckContent(withFrontmatter);
            expect(deck.slides).to.have.lengthOf(2);
        });

        it('should include slide content', () => {
            const deck = PresentationWidget.parseDeckContent(withFrontmatter);
            expect(deck.slides[0].content).to.include('Slide 1');
            expect(deck.slides[1].content).to.include('Slide 2');
        });

        it('should use default theme "black" when not specified', () => {
            const noTheme = `---\ntitle: No Theme\n---\n# Slide 1\nContent`;
            const deck = PresentationWidget.parseDeckContent(noTheme);
            expect(deck.options.theme).to.equal('black');
        });

        it('should use default transition "slide" when not specified', () => {
            const noTransition = `---\ntitle: No Transition\n---\n# Slide 1\nContent`;
            const deck = PresentationWidget.parseDeckContent(noTransition);
            expect(deck.options.transition).to.equal('slide');
        });
    });

    describe('parseDeckContent — without frontmatter', () => {
        it('should parse slides when no frontmatter is present', () => {
            const noFrontmatter = '# Slide 1\nContent\n---\n# Slide 2\nMore';
            const deck = PresentationWidget.parseDeckContent(noFrontmatter);
            expect(deck.slides).to.have.lengthOf(2);
        });

        it('should include all slide content without frontmatter', () => {
            const noFrontmatter = '# Slide A\nFoo\n---\n# Slide B\nBar';
            const deck = PresentationWidget.parseDeckContent(noFrontmatter);
            expect(deck.slides[0].content).to.include('Slide A');
            expect(deck.slides[1].content).to.include('Slide B');
        });

        it('should default theme to "black" with no frontmatter', () => {
            const deck = PresentationWidget.parseDeckContent('# Single Slide\nHello');
            expect(deck.options.theme).to.equal('black');
        });
    });

    describe('parseDeckContent — edge cases', () => {
        it('should return empty slides array for empty input', () => {
            const deck = PresentationWidget.parseDeckContent('');
            expect(deck.slides).to.have.lengthOf(0);
        });

        it('should handle single slide with no delimiter', () => {
            const deck = PresentationWidget.parseDeckContent('# Single\nContent only');
            expect(deck.slides).to.have.lengthOf(1);
            expect(deck.slides[0].content).to.include('Single');
        });

        it('should extract speaker notes from slides', () => {
            const withNotes = `---\ntitle: Noted\n---\n# Slide 1\nBody text\nNotes: These are speaker notes`;
            const deck = PresentationWidget.parseDeckContent(withNotes);
            expect(deck.slides[0].notes).to.equal('These are speaker notes');
        });

        it('should strip speaker notes from slide content', () => {
            const withNotes = `---\ntitle: Noted\n---\n# Slide 1\nBody text\nNotes: Speaker notes here`;
            const deck = PresentationWidget.parseDeckContent(withNotes);
            expect(deck.slides[0].content).to.not.include('Notes:');
            expect(deck.slides[0].content).to.not.include('Speaker notes here');
        });

        it('should return undefined notes when none are present', () => {
            const noNotes = `---\ntitle: Clean\n---\n# Slide 1\nJust body`;
            const deck = PresentationWidget.parseDeckContent(noNotes);
            expect(deck.slides[0].notes).to.be.undefined;
        });
    });

    describe('PresentationNavigationService', () => {
        let service: PresentationNavigationService;
        let mockReveal: {
            next: sinon.SinonStub;
            prev: sinon.SinonStub;
            slide: sinon.SinonStub;
            getIndices: sinon.SinonStub;
            sync: sinon.SinonStub;
            layout: sinon.SinonStub;
        };

        beforeEach(() => {
            mockReveal = {
                next: sinon.stub(),
                prev: sinon.stub(),
                slide: sinon.stub(),
                getIndices: sinon.stub().returns({ h: 2, v: 1 }),
                sync: sinon.stub(),
                layout: sinon.stub()
            };
            service = new PresentationNavigationService();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            service.setReveal(mockReveal as any);
        });

        afterEach(() => {
            sinon.restore();
        });

        it('should call next() on the reveal instance', () => {
            service.next();
            expect(mockReveal.next.calledOnce).to.be.true;
        });

        it('should call prev() on the reveal instance', () => {
            service.prev();
            expect(mockReveal.prev.calledOnce).to.be.true;
        });

        it('should call slide() with correct horizontal and vertical indices', () => {
            service.slide(3, 2);
            expect(mockReveal.slide.calledOnceWith(3, 2, 0)).to.be.true;
        });

        it('should default vertical and fragment to 0 when not provided', () => {
            service.slide(1);
            expect(mockReveal.slide.calledOnceWith(1, 0, 0)).to.be.true;
        });

        it('should return current slide indices from reveal', () => {
            const indices = service.getIndices();
            expect(indices).to.deep.equal({ h: 2, v: 1 });
        });

        it('should return { h: 0, v: 0 } when no reveal instance is set', () => {
            const bare = new PresentationNavigationService();
            expect(bare.getIndices()).to.deep.equal({ h: 0, v: 0 });
        });

        it('should call sync() on the reveal instance', () => {
            service.sync();
            expect(mockReveal.sync.calledOnce).to.be.true;
        });

        it('should call layout() on the reveal instance', () => {
            service.layout();
            expect(mockReveal.layout.calledOnce).to.be.true;
        });

        it('should not throw when next() is called without a reveal instance', () => {
            const bare = new PresentationNavigationService();
            expect(() => bare.next()).to.not.throw();
        });

        it('should not throw when prev() is called without a reveal instance', () => {
            const bare = new PresentationNavigationService();
            expect(() => bare.prev()).to.not.throw();
        });
    });
});
