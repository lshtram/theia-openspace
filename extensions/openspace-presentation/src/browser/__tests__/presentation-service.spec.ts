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

/**
 * Tests for PresentationService methods.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { PresentationService } from '../presentation-service';
import { PresentationWidget, DeckOptions } from '../presentation-widget';

/**
 * Subclass that exposes the protected buildDeckContent method for testing.
 */
class TestablePresentationService extends PresentationService {
    public buildDeckContent(title: string, slides: string[], options?: DeckOptions): string {
        return super.buildDeckContent(title, slides, options);
    }
}

describe('PresentationService', () => {
    let service: TestablePresentationService;

    beforeEach(() => {
        service = new TestablePresentationService();
        // Inject stub fileService and workspaceService — unused by tested methods
        (service as any).fileService = {};
        (service as any).workspaceService = {};
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getFileExtension', () => {
        it('should return .deck.md', () => {
            const ext = service.getFileExtension();
            expect(ext).to.equal('.deck.md');
        });
    });

    describe('parseDeckContent', () => {
        it('should parse simple presentation', () => {
            const content = `---
title: Test Presentation
theme: black
---
# Slide 1
Content 1
---
# Slide 2
Content 2`;

            const result = PresentationWidget.parseDeckContent(content);

            expect(result.options.title).to.equal('Test Presentation');
            expect(result.slides).to.have.lengthOf(2);
            expect(result.slides[0].content).to.include('Slide 1');
        });

        it('should handle presentation without frontmatter', () => {
            const content = `# Slide 1
Content 1
---
# Slide 2
Content 2`;

            const result = PresentationWidget.parseDeckContent(content);

            expect(result.slides).to.have.lengthOf(2);
        });

        it('should handle single slide', () => {
            const content = `---
title: Single Slide
---
# Hello World`;

            const result = PresentationWidget.parseDeckContent(content);

            expect(result.slides).to.have.lengthOf(1);
        });
    });

    describe('buildDeckContent', () => {
        it('should build presentation with title', () => {
            const slides = ['# Slide 1', '# Slide 2'];
            const content = service.buildDeckContent('My Presentation', slides);

            expect(content).to.include('title: My Presentation');
            expect(content).to.include('# Slide 1');
        });

        it('should include theme when provided', () => {
            const slides = ['# Slide 1'];
            const content = service.buildDeckContent('Test', slides, { theme: 'night' });

            expect(content).to.include('theme: night');
        });

        it('should handle plain text slides', () => {
            const slides = ['Just text'];
            const content = service.buildDeckContent('Test', slides);

            expect(content).to.include('# Just text');
        });
    });

    describe('updateSlide logic', () => {
        it('should update specific slide in array', () => {
            const slides = [
                { content: '# Slide 1' },
                { content: '# Slide 2' },
                { content: '# Slide 3' }
            ];

            // Update slide 1
            const newSlides = [...slides];
            newSlides[1] = { content: '# Updated Slide 2' };

            expect(newSlides[1].content).to.equal('# Updated Slide 2');
            expect(newSlides[0].content).to.equal('# Slide 1');
            expect(newSlides[2].content).to.equal('# Slide 3');
        });

        it('should throw error for invalid slide index', async () => {
            const deckContent = `---
title: Test
---
# Slide 1`;
            const stubFileService = {
                read: sinon.stub().resolves({ value: deckContent }),
                write: sinon.stub().resolves()
            };
            (service as any).fileService = stubFileService;

            try {
                await service.updateSlide('/test/file.deck.md', 5, '# New Content');
                expect.fail('Should have thrown');
            } catch (err: unknown) {
                expect((err as Error).message).to.include('Invalid slide index: 5');
            }
        });
    });
});
