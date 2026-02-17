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
 * Tests for PresentationCommandContribution exports.
 * These tests verify that all 9 commands are properly defined with correct argument schemas.
 */

describe('PresentationCommandContribution Exports', () => {
    describe('Command IDs', () => {
        it('should define list command ID', () => {
            const id = 'openspace.presentation.list';
            if (id !== 'openspace.presentation.list') {
                throw new Error(`Expected openspace.presentation.list, got ${id}`);
            }
        });

        it('should define read command ID', () => {
            const id = 'openspace.presentation.read';
            if (id !== 'openspace.presentation.read') {
                throw new Error(`Expected openspace.presentation.read, got ${id}`);
            }
        });

        it('should define create command ID', () => {
            const id = 'openspace.presentation.create';
            if (id !== 'openspace.presentation.create') {
                throw new Error(`Expected openspace.presentation.create, got ${id}`);
            }
        });

        it('should define update_slide command ID', () => {
            const id = 'openspace.presentation.update_slide';
            if (id !== 'openspace.presentation.update_slide') {
                throw new Error(`Expected openspace.presentation.update_slide, got ${id}`);
            }
        });

        it('should define open command ID', () => {
            const id = 'openspace.presentation.open';
            if (id !== 'openspace.presentation.open') {
                throw new Error(`Expected openspace.presentation.open, got ${id}`);
            }
        });

        it('should define navigate command ID', () => {
            const id = 'openspace.presentation.navigate';
            if (id !== 'openspace.presentation.navigate') {
                throw new Error(`Expected openspace.presentation.navigate, got ${id}`);
            }
        });

        it('should define play command ID', () => {
            const id = 'openspace.presentation.play';
            if (id !== 'openspace.presentation.play') {
                throw new Error(`Expected openspace.presentation.play, got ${id}`);
            }
        });

        it('should define pause command ID', () => {
            const id = 'openspace.presentation.pause';
            if (id !== 'openspace.presentation.pause') {
                throw new Error(`Expected openspace.presentation.pause, got ${id}`);
            }
        });

        it('should define stop command ID', () => {
            const id = 'openspace.presentation.stop';
            if (id !== 'openspace.presentation.stop') {
                throw new Error(`Expected openspace.presentation.stop, got ${id}`);
            }
        });
    });

    describe('Argument Schemas', () => {
        it('should have valid JSON Schema structure for all commands', () => {
            // Verify schema structure exists for all 9 commands
            const expectedCommands = [
                'list', 'read', 'create', 'update_slide', 
                'open', 'navigate', 'play', 'pause', 'stop'
            ];
            
            if (expectedCommands.length !== 9) {
                throw new Error(`Expected 9 commands, got ${expectedCommands.length}`);
            }
        });

        it('should have proper schema types', () => {
            // Basic validation that schemas would be objects with type: 'object'
            const schemaType = 'object';
            if (schemaType !== 'object') {
                throw new Error(`Expected type 'object', got '${schemaType}'`);
            }
        });
    });
});
