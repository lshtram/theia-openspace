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
import { WhiteboardCommandIds, WhiteboardArgumentSchemas } from '../whiteboard-command-contribution';

/**
 * Derive the tab label from a .whiteboard.json path (mirrors the logic in open-handler and command-contribution).
 */
function whiteboardTabLabel(filePath: string): string {
    const base = filePath.split('/').pop() ?? filePath;
    return base.endsWith('.whiteboard.json') ? base.slice(0, -'.whiteboard.json'.length) : base;
}

describe('whiteboardTabLabel — tab title derived from filename', () => {
    it('should strip .whiteboard.json from a simple filename', () => {
        expect(whiteboardTabLabel('/workspace/boards/my-board.whiteboard.json')).to.equal('my-board');
    });

    it('should return basename unchanged for non-.whiteboard.json files', () => {
        expect(whiteboardTabLabel('/workspace/foo/notes.json')).to.equal('notes.json');
    });
});

/**
 * Tests for WhiteboardCommandContribution exports.
 * These tests verify that all 10 commands are properly defined with correct argument schemas.
 */

describe('WhiteboardCommandContribution Exports', () => {
    describe('Command IDs', () => {
        it('should define list command ID', () => {
            expect(WhiteboardCommandIds.LIST).to.equal('openspace.whiteboard.list');
        });

        it('should define read command ID', () => {
            expect(WhiteboardCommandIds.READ).to.equal('openspace.whiteboard.read');
        });

        it('should define create command ID', () => {
            expect(WhiteboardCommandIds.CREATE).to.equal('openspace.whiteboard.create');
        });

        it('should define add_shape command ID', () => {
            expect(WhiteboardCommandIds.ADD_SHAPE).to.equal('openspace.whiteboard.add_shape');
        });

        it('should define update_shape command ID', () => {
            expect(WhiteboardCommandIds.UPDATE_SHAPE).to.equal('openspace.whiteboard.update_shape');
        });

        it('should define delete_shape command ID', () => {
            expect(WhiteboardCommandIds.DELETE_SHAPE).to.equal('openspace.whiteboard.delete_shape');
        });

        it('should define open command ID', () => {
            expect(WhiteboardCommandIds.OPEN).to.equal('openspace.whiteboard.open');
        });

        it('should define camera.set command ID', () => {
            expect(WhiteboardCommandIds.CAMERA_SET).to.equal('openspace.whiteboard.camera.set');
        });

        it('should define camera.fit command ID', () => {
            expect(WhiteboardCommandIds.CAMERA_FIT).to.equal('openspace.whiteboard.camera.fit');
        });

        it('should define camera.get command ID', () => {
            expect(WhiteboardCommandIds.CAMERA_GET).to.equal('openspace.whiteboard.camera.get');
        });
    });

    describe('Argument Schemas', () => {
        it('should have valid JSON Schema structure for all commands', () => {
            const expectedKeys = [
                'list', 'read', 'create', 'add_shape', 'update_shape',
                'delete_shape', 'open', 'camera_set', 'camera_fit', 'camera_get'
            ];
            expectedKeys.forEach(key => {
                expect(WhiteboardArgumentSchemas).to.have.property(key);
            });
            expect(expectedKeys).to.have.length(10);
        });

        it('should have proper schema types', () => {
            const schemaKeys = Object.keys(WhiteboardArgumentSchemas) as Array<keyof typeof WhiteboardArgumentSchemas>;
            schemaKeys.forEach(key => {
                expect(WhiteboardArgumentSchemas[key].type).to.equal('object');
            });
        });

        it('should require path for read schema', () => {
            expect(WhiteboardArgumentSchemas.read.required).to.include('path');
        });

        it('should require path for create schema', () => {
            expect(WhiteboardArgumentSchemas.create.required).to.include('path');
        });

        it('should require path, type, x, and y for add_shape schema', () => {
            expect(WhiteboardArgumentSchemas.add_shape.required).to.include('path');
            expect(WhiteboardArgumentSchemas.add_shape.required).to.include('type');
            expect(WhiteboardArgumentSchemas.add_shape.required).to.include('x');
            expect(WhiteboardArgumentSchemas.add_shape.required).to.include('y');
        });

        it('should require path, shapeId, and props for update_shape schema', () => {
            expect(WhiteboardArgumentSchemas.update_shape.required).to.include('path');
            expect(WhiteboardArgumentSchemas.update_shape.required).to.include('shapeId');
            expect(WhiteboardArgumentSchemas.update_shape.required).to.include('props');
        });

        it('should require path and shapeId for delete_shape schema', () => {
            expect(WhiteboardArgumentSchemas.delete_shape.required).to.include('path');
            expect(WhiteboardArgumentSchemas.delete_shape.required).to.include('shapeId');
        });

        it('should require path for open schema', () => {
            expect(WhiteboardArgumentSchemas.open.required).to.include('path');
        });

        it('should require x, y, and zoom for camera_set schema', () => {
            expect(WhiteboardArgumentSchemas.camera_set.required).to.include('x');
            expect(WhiteboardArgumentSchemas.camera_set.required).to.include('y');
            expect(WhiteboardArgumentSchemas.camera_set.required).to.include('zoom');
        });
    });
});
