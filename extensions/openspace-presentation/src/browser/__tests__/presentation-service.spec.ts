/* eslint-disable @typescript-eslint/no-explicit-any */
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
        // Inject stub logger — used by updateSlide and other methods
        (service as any).logger = { info: sinon.stub(), warn: sinon.stub(), error: sinon.stub() };
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

        it('should write updated content to disk on happy path', async () => {
            const deckContent = `---
title: Happy Path
---
# Slide 1

First slide

---

# Slide 2

Second slide`;
            const writeStub = sinon.stub().resolves();
            const stubFileService = {
                read: sinon.stub().resolves({ value: deckContent }),
                write: writeStub
            };
            (service as any).fileService = stubFileService;

            await service.updateSlide('/test/happy.deck.md', 1, '# Updated Slide 2\n\nNew content');

            expect(writeStub.calledOnce).to.be.true;
            // The second argument to write() is the new file content string
            const writtenContent: string = writeStub.firstCall.args[1];
            expect(writtenContent).to.include('# Updated Slide 2');
            expect(writtenContent).to.include('New content');
            // Original slide 1 should be unchanged
            expect(writtenContent).to.include('# Slide 1');
        });
    });

    describe('onDidChange emitter', () => {
        it('should fire onDidChange event after updateSlide', async () => {
            const deckContent = `---
title: Emitter Test
---
# Slide 1`;
            const stubFileService = {
                read: sinon.stub().resolves({ value: deckContent }),
                write: sinon.stub().resolves()
            };
            (service as any).fileService = stubFileService;

            let firedEvent: { path: string; content: string } | undefined;
            service.onDidChange(evt => { firedEvent = evt; });

            await service.updateSlide('/test/emitter.deck.md', 0, '# Changed Slide');

            expect(firedEvent).to.not.be.undefined;
            expect(firedEvent!.path).to.equal('/test/emitter.deck.md');
            expect(firedEvent!.content).to.include('# Changed Slide');
        });
    });

    describe('setActivePresentation', () => {
        it('should set the active presentation path', () => {
            // Stub fileService to have watch + onDidFilesChange so startWatching works
            (service as any).fileService = {
                watch: sinon.stub().returns({ dispose: sinon.stub() }),
                onDidFilesChange: sinon.stub().returns({ dispose: sinon.stub() })
            };

            service.setActivePresentation('/test/active.deck.md');

            expect(service.getActivePresentation()).to.equal('/test/active.deck.md');
        });

        it('should clear the active presentation path when set to undefined', () => {
            (service as any).fileService = {
                watch: sinon.stub().returns({ dispose: sinon.stub() }),
                onDidFilesChange: sinon.stub().returns({ dispose: sinon.stub() })
            };

            service.setActivePresentation('/test/active.deck.md');
            service.setActivePresentation(undefined);

            expect(service.getActivePresentation()).to.be.undefined;
        });
    });
});

describe('PresentationService.createPresentation — path resolution', () => {
    let service: PresentationService;
    let createStub: sinon.SinonStub;

    beforeEach(() => {
        service = new PresentationService();
        createStub = sinon.stub().resolves();
        (service as any).fileService = {
            create: createStub,
            createFolder: sinon.stub().resolves(),
            exists: sinon.stub().resolves(false),
        };
        (service as any).workspaceService = {
            roots: Promise.resolve([{ resource: { toString: () => 'file:///workspace' } }]),
        };
        // Use unconditional stub so it matches the two-arg call get(key, default)
        (service as any).preferenceService = {
            get: sinon.stub().returns('openspace/decks'),
        };
        (service as any).logger = { warn: sinon.stub(), info: sinon.stub() };
    });

    it('creates file under configured folder for bare name', async () => {
        await service.createPresentation('myslides', 'My Slides');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.include('openspace/decks/myslides.deck.md');
    });

    it('respects absolute file:// path unchanged', async () => {
        const abs = 'file:///tmp/myslides.deck.md';
        await service.createPresentation(abs, 'My Slides');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.equal(abs);
    });

    it('throws when no workspace is open', async () => {
        (service as any).workspaceService = {
            roots: Promise.resolve([]),
        };
        let caught: Error | undefined;
        try {
            await service.createPresentation('myslides', 'My Slides');
        } catch (err) {
            caught = err as Error;
        }
        expect(caught).to.be.instanceOf(Error);
        expect(caught!.message).to.include('Cannot create presentation: no workspace is open');
    });

    it('resolves relative path under workspace root', async () => {
        await service.createPresentation('subdir/talk', 'Talk');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.equal('file:///workspace/subdir/talk.deck.md');
    });

    it('uses custom preference folder when configured', async () => {
        (service as any).preferenceService = {
            get: sinon.stub().returns('my/custom/decks'),
        };
        await service.createPresentation('mytalk', 'My Talk');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.include('my/custom/decks/mytalk.deck.md');
    });
});
