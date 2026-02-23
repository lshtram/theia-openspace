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

import { expect } from 'chai';
import { PresentationCommandIds, PresentationArgumentSchemas } from '../presentation-command-contribution';

/**
 * Derive the tab label from a .deck.md path (mirrors the logic in open-handler and command-contribution).
 */
function deckTabLabel(filePath: string): string {
    const base = filePath.split('/').pop() ?? filePath;
    return base.endsWith('.deck.md') ? base.slice(0, -'.deck.md'.length) : base;
}

/**
 * Tests for PresentationCommandContribution exports.
 * These tests verify that all 9 commands are properly defined with correct argument schemas.
 */

describe('deckTabLabel — tab title derived from filename', () => {
    it('should strip .deck.md from a simple filename', () => {
        expect(deckTabLabel('/workspace/design/my-talk.deck.md')).to.equal('my-talk');
    });

    it('should strip .deck.md from a nested path', () => {
        expect(deckTabLabel('design/deck/sse-explained-v2.deck.md')).to.equal('sse-explained-v2');
    });

    it('should return basename unchanged for non-.deck.md files', () => {
        expect(deckTabLabel('/workspace/foo/bar.md')).to.equal('bar.md');
    });

    it('should handle path with no directory separator', () => {
        expect(deckTabLabel('slides.deck.md')).to.equal('slides');
    });
});

describe('PresentationCommandContribution Exports', () => {
    describe('Command IDs', () => {
        it('should define list command ID', () => {
            expect(PresentationCommandIds.LIST).to.equal('openspace.presentation.list');
        });

        it('should define read command ID', () => {
            expect(PresentationCommandIds.READ).to.equal('openspace.presentation.read');
        });

        it('should define create command ID', () => {
            expect(PresentationCommandIds.CREATE).to.equal('openspace.presentation.create');
        });

        it('should define update_slide command ID', () => {
            expect(PresentationCommandIds.UPDATE_SLIDE).to.equal('openspace.presentation.update_slide');
        });

        it('should define open command ID', () => {
            expect(PresentationCommandIds.OPEN).to.equal('openspace.presentation.open');
        });

        it('should define navigate command ID', () => {
            expect(PresentationCommandIds.NAVIGATE).to.equal('openspace.presentation.navigate');
        });

        it('should define play command ID', () => {
            expect(PresentationCommandIds.PLAY).to.equal('openspace.presentation.play');
        });

        it('should define pause command ID', () => {
            expect(PresentationCommandIds.PAUSE).to.equal('openspace.presentation.pause');
        });

        it('should define stop command ID', () => {
            expect(PresentationCommandIds.STOP).to.equal('openspace.presentation.stop');
        });
    });

    describe('Argument Schemas', () => {
        it('should have valid JSON Schema structure for all commands', () => {
            const expectedKeys = ['list', 'read', 'create', 'update_slide', 'open', 'navigate', 'play', 'pause', 'stop'];
            expectedKeys.forEach(key => {
                expect(PresentationArgumentSchemas).to.have.property(key);
            });
            expect(expectedKeys).to.have.length(9);
        });

        it('should have proper schema types', () => {
            const schemaKeys = Object.keys(PresentationArgumentSchemas) as Array<keyof typeof PresentationArgumentSchemas>;
            schemaKeys.forEach(key => {
                expect(PresentationArgumentSchemas[key].type).to.equal('object');
            });
        });

        it('should require path for read schema', () => {
            expect(PresentationArgumentSchemas.read.required).to.include('path');
        });

        it('should require path and title for create schema', () => {
            expect(PresentationArgumentSchemas.create.required).to.include('path');
            expect(PresentationArgumentSchemas.create.required).to.include('title');
        });

        it('should require path, slideIndex, and content for update_slide schema', () => {
            expect(PresentationArgumentSchemas.update_slide.required).to.include('path');
            expect(PresentationArgumentSchemas.update_slide.required).to.include('slideIndex');
            expect(PresentationArgumentSchemas.update_slide.required).to.include('content');
        });

        it('should require path for open schema', () => {
            expect(PresentationArgumentSchemas.open.required).to.include('path');
        });

        it('should define direction enum for navigate schema', () => {
            expect(PresentationArgumentSchemas.navigate.properties.direction.enum).to.include('prev');
            expect(PresentationArgumentSchemas.navigate.properties.direction.enum).to.include('next');
        });

        it('should advertise first and last as valid navigate directions', () => {
            const directions = PresentationArgumentSchemas.navigate.properties.direction.enum as string[];
            expect(directions).to.include('first');
            expect(directions).to.include('last');
        });
    });
});
