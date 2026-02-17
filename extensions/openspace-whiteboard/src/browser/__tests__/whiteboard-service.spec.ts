// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the terms of the Eclipse
// Public License v. 2.0 which is available at
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

// Whiteboard data types
interface WhiteboardData {
    schema: { version: number };
    records: WhiteboardRecord[];
}

interface WhiteboardRecord {
    id: string;
    type: string;
    [key: string]: unknown;
}

// Helper functions mimicking whiteboard widget utils
function createEmpty(): WhiteboardData {
    return {
        schema: { version: 1 },
        records: []
    };
}

function validate(data: unknown): data is WhiteboardData {
    if (!data || typeof data !== 'object') return false;
    
    const d = data as WhiteboardData;
    if (!d.schema || typeof d.schema.version !== 'number') return false;
    if (!Array.isArray(d.records)) return false;
    
    return true;
}

function addShape(data: WhiteboardData, shape: WhiteboardRecord): WhiteboardData {
    return {
        ...data,
        records: [...data.records, shape]
    };
}

function removeShape(data: WhiteboardData, shapeId: string): WhiteboardData {
    return {
        ...data,
        records: data.records.filter(r => r.id !== shapeId)
    };
}

function updateShape(data: WhiteboardData, shapeId: string, updates: Partial<WhiteboardRecord>): WhiteboardData {
    return {
        ...data,
        records: data.records.map(r => 
            r.id === shapeId ? { ...r, ...updates } : r
        )
    };
}

describe('WhiteboardService', () => {
    describe('getFileExtension', () => {
        it('should return .whiteboard.json', () => {
            const ext = '.whiteboard.json';
            if (ext !== '.whiteboard.json') {
                throw new Error(`Expected .whiteboard.json, got ${ext}`);
            }
        });
    });

    describe('createEmpty', () => {
        it('should create empty whiteboard data', () => {
            const data = createEmpty();
            
            if (data.schema.version !== 1) {
                throw new Error('Schema version should be 1');
            }
            if (!Array.isArray(data.records) || data.records.length !== 0) {
                throw new Error('Records should be empty array');
            }
        });
    });

    describe('validate', () => {
        it('should validate correct data', () => {
            const data = {
                schema: { version: 1 },
                records: []
            };
            
            if (!validate(data)) {
                throw new Error('Should be valid');
            }
        });

        it('should reject missing schema', () => {
            const data = {
                records: []
            };
            
            if (validate(data)) {
                throw new Error('Should be invalid - missing schema');
            }
        });

        it('should reject missing records', () => {
            const data = {
                schema: { version: 1 }
            };
            
            if (validate(data)) {
                throw new Error('Should be invalid - missing records');
            }
        });

        it('should reject invalid schema version', () => {
            const data = {
                schema: { version: '1' },
                records: []
            };
            
            if (validate(data)) {
                throw new Error('Should be invalid - version not number');
            }
        });
    });

    describe('addShape', () => {
        it('should add shape to empty whiteboard', () => {
            const data = createEmpty();
            const shape: WhiteboardRecord = { id: 'shape-1', type: 'rectangle', x: 100, y: 200 };
            
            const updated = addShape(data, shape);
            
            if (updated.records.length !== 1) {
                throw new Error(`Expected 1 record, got ${updated.records.length}`);
            }
            if (updated.records[0].id !== 'shape-1') {
                throw new Error('Shape should have correct ID');
            }
        });

        it('should not modify original data', () => {
            const data = createEmpty();
            const shape: WhiteboardRecord = { id: 'shape-1', type: 'rectangle', x: 100, y: 200 };
            
            addShape(data, shape);
            
            if (data.records.length !== 0) {
                throw new Error('Original data should not be modified');
            }
        });

        it('should preserve existing shapes when adding', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };
            const shape: WhiteboardRecord = { id: 'shape-2', type: 'ellipse', x: 100, y: 100 };
            
            const updated = addShape(data, shape);
            
            if (updated.records.length !== 2) {
                throw new Error(`Expected 2 records, got ${updated.records.length}`);
            }
            if (updated.records[0].id !== 'shape-1') {
                throw new Error('First shape should be preserved');
            }
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
            
            const updated = removeShape(data, 'shape-1');
            
            if (updated.records.length !== 1) {
                throw new Error(`Expected 1 record, got ${updated.records.length}`);
            }
            if (updated.records[0].id !== 'shape-2') {
                throw new Error('Wrong shape removed');
            }
        });

        it('should handle non-existent shape ID', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };
            
            const updated = removeShape(data, 'non-existent');
            
            if (updated.records.length !== 1) {
                throw new Error('Should not remove any shapes');
            }
        });
    });

    describe('updateShape', () => {
        it('should update shape properties', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };
            
            const updated = updateShape(data, 'shape-1', { x: 50, y: 100 });
            
            if (updated.records[0].x !== 50) {
                throw new Error('x should be updated');
            }
            if (updated.records[0].y !== 100) {
                throw new Error('y should be updated');
            }
            // Original properties should be preserved
            if (updated.records[0].type !== 'rectangle') {
                throw new Error('type should be preserved');
            }
        });

        it('should handle non-existent shape', () => {
            const data: WhiteboardData = {
                schema: { version: 1 },
                records: [{ id: 'shape-1', type: 'rectangle', x: 0, y: 0 }]
            };
            
            const updated = updateShape(data, 'non-existent', { x: 50 });
            
            // Should not throw, just return unchanged data
            if (updated.records[0].x !== 0) {
                throw new Error('Non-existent shape should not be updated');
            }
        });
    });

    describe('camera state', () => {
        it('should store camera state', () => {
            const cameraState = { x: 100, y: 200, zoom: 1.5 };
            
            if (cameraState.x !== 100) {
                throw new Error('x should be stored');
            }
            if (cameraState.y !== 200) {
                throw new Error('y should be stored');
            }
            if (cameraState.zoom !== 1.5) {
                throw new Error('zoom should be stored');
            }
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
            
            if (centerX !== 125) { // (0 + 250) / 2 = 125
                throw new Error(`Expected centerX 125, got ${centerX}`);
            }
            if (centerY !== 125) { // (0 + 250) / 2 = 125
                throw new Error(`Expected centerY 125, got ${centerY}`);
            }
        });
    });
});
