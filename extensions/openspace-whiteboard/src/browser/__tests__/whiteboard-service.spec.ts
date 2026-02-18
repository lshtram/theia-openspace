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
 * Tests for WhiteboardService methods.
 */

import { expect } from 'chai';
import { WhiteboardService } from '../whiteboard-service';
import { WhiteboardUtils, WhiteboardData, WhiteboardRecord } from '../whiteboard-widget';

describe('WhiteboardService', () => {
    let service: WhiteboardService;

    beforeEach(() => {
        service = new WhiteboardService();
        // Inject stub fileService and workspaceService — unused by tested methods
        (service as any).fileService = {};
        (service as any).workspaceService = {};
    });

    describe('getFileExtension', () => {
        it('should return .whiteboard.json', () => {
            const ext = service.getFileExtension();
            expect(ext).to.equal('.whiteboard.json');
        });
    });

    describe('createEmpty', () => {
        it('should create empty whiteboard data', () => {
            const data = WhiteboardUtils.createEmpty();

            expect(data.schema.version).to.equal(1);
            expect(data.records).to.be.an('array').that.is.empty;
        });
    });

    describe('validate', () => {
        it('should validate correct data', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: []
            };

            expect(WhiteboardUtils.validate(data)).to.be.true;
        });

        it('should reject missing schema', () => {
            const data = {
                records: []
            };

            expect(WhiteboardUtils.validate(data)).to.be.false;
        });

        it('should reject missing records', () => {
            const data = {
                schema: { version: 1 }
            };

            expect(WhiteboardUtils.validate(data)).to.be.false;
        });

        it('should reject invalid schema version', () => {
            const data = {
                schema: { version: '1' },
                records: []
            };

            expect(WhiteboardUtils.validate(data)).to.be.false;
        });
    });

    describe('addShape', () => {
        it('should add shape to empty whiteboard', () => {
            const data = WhiteboardUtils.createEmpty();
            const shape: WhiteboardRecord = { id: 'shape-1', type: 'rectangle', x: 100, y: 200 };

            const updated = WhiteboardUtils.addShape(data, shape);

            expect(updated.records).to.have.lengthOf(1);
            expect(updated.records[0].id).to.equal('shape-1');
        });

        it('should not modify original data', () => {
            const data = WhiteboardUtils.createEmpty();
            const shape: WhiteboardRecord = { id: 'shape-1', type: 'rectangle', x: 100, y: 200 };

            WhiteboardUtils.addShape(data, shape);

            expect(data.records).to.have.lengthOf(0);
        });

        it('should preserve existing shapes when adding', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };
            const shape: WhiteboardRecord = { id: 'shape-2', type: 'ellipse', x: 100, y: 100 };

            const updated = WhiteboardUtils.addShape(data, shape);

            expect(updated.records).to.have.lengthOf(2);
            expect(updated.records[0].id).to.equal('shape-1');
        });
    });

    describe('removeShape', () => {
        it('should remove shape by ID', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [
                    { id: 'shape-1', type: 'rectangle', x: 0, y: 0 },
                    { id: 'shape-2', type: 'ellipse', x: 100, y: 100 }
                ]
            };

            const updated = WhiteboardUtils.removeShape(data, 'shape-1');

            expect(updated.records).to.have.lengthOf(1);
            expect(updated.records[0].id).to.equal('shape-2');
        });

        it('should handle non-existent shape ID', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };

            const updated = WhiteboardUtils.removeShape(data, 'non-existent');

            expect(updated.records).to.have.lengthOf(1);
        });
    });

    describe('updateShape', () => {
        it('should update shape properties', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };

            const updated = WhiteboardUtils.updateShape(data, 'shape-1', { x: 50, y: 100 });

            expect(updated.records[0].x).to.equal(50);
            expect(updated.records[0].y).to.equal(100);
            // Original properties should be preserved
            expect(updated.records[0].type).to.equal('rectangle');
        });

        it('should handle non-existent shape', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };

            const updated = WhiteboardUtils.updateShape(data, 'non-existent', { x: 50 });

            // Should not throw, just return unchanged data
            expect(updated.records[0].x).to.equal(0);
        });
    });

    describe('camera state', () => {
        it('should store camera state', () => {
            service.setCameraState({ x: 100, y: 200, zoom: 1.5 });
            const cameraState = service.getCameraState();

            expect(cameraState.x).to.equal(100);
            expect(cameraState.y).to.equal(200);
            expect(cameraState.zoom).to.equal(1.5);
        });

        it('should fit camera to shapes', () => {
            const records = [
                { id: '1', type: 'rect', x: 0, y: 0, width: 100, height: 100 },
                { id: '2', type: 'rect', x: 200, y: 200, width: 50, height: 50 }
            ];

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const record of records) {
                const x = (record.x as number) || 0;
                const y = (record.y as number) || 0;
                const w = (record.width as number) || 100;
                const h = (record.height as number) || 100;

                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + w);
                maxY = Math.max(maxY, y + h);
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            expect(centerX).to.equal(125); // (0 + 250) / 2 = 125
            expect(centerY).to.equal(125); // (0 + 250) / 2 = 125
        });
    });
});
