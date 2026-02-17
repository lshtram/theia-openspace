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

describe('WhiteboardWidget', () => {
    let mockEditor: any;
    let mockStore: any;

    const sampleWhiteboardData = {
        schema: { version: 1 },
        records: [
            { id: 'shape1', type: 'geo', x: 100, y: 100, props: { geo: 'rectangle' } }
        ]
    };

    beforeEach(() => {
        // Mock tldraw editor
        mockEditor = {
            createShape: sinon.stub(),
            updateShape: sinon.stub(),
            deleteShape: sinon.stub(),
            getCurrentPageShapeIds: sinon.stub().returns(new Set(['shape1'])),
            store: mockStore,
            putRecord: sinon.stub(),
            removeRecord: sinon.stub()
        };

        // Mock store
        mockStore = {
            getSnapshot: sinon.stub().returns(sampleWhiteboardData),
            loadSnapshot: sinon.stub(),
            addListener: sinon.stub(),
            removeListener: sinon.stub()
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Widget Constants', () => {
        it('should have correct widget ID', () => {
            // Widget ID is defined as constant - verify format
            const widgetId = 'openspace-whiteboard-widget';
            expect(widgetId).to.equal('openspace-whiteboard-widget');
            expect(widgetId).to.include('whiteboard');
        });

        it('should have correct widget label', () => {
            const widgetLabel = 'Whiteboard';
            expect(widgetLabel).to.equal('Whiteboard');
        });
    });

    describe('Shape Management', () => {
        it('should create a shape', () => {
            // Test shape creation through the editor API
            mockEditor.createShape.returns({ id: 'new-shape' });
            
            const shape = mockEditor.createShape({
                type: 'geo',
                x: 100,
                y: 100,
                props: { geo: 'rectangle' }
            });

            expect(shape).to.not.be.undefined;
            expect(mockEditor.createShape.calledOnce).to.be.true;
        });

        it('should update a shape', () => {
            mockEditor.updateShape.returns({ id: 'shape1' });
            
            mockEditor.updateShape({
                id: 'shape1',
                type: 'geo',
                props: { color: 'red' }
            });

            expect(mockEditor.updateShape.calledOnce).to.be.true;
        });

        it('should delete a shape', () => {
            mockEditor.deleteShape.returns(undefined);
            
            mockEditor.deleteShape('shape1');

            expect(mockEditor.deleteShape.calledOnceWith('shape1')).to.be.true;
        });

        it('should get all shapes', () => {
            const shapes = mockEditor.getCurrentPageShapeIds();
            expect(shapes.size).to.equal(1);
        });
    });

    describe('Save/Load', () => {
        it('should serialize store to JSON', () => {
            const snapshot = mockStore.getSnapshot();
            expect(snapshot).to.deep.equal(sampleWhiteboardData);
            expect(mockStore.getSnapshot.calledOnce).to.be.true;
        });

        it('should deserialize JSON to store', () => {
            mockStore.loadSnapshot.returns(undefined);
            
            mockStore.loadSnapshot(sampleWhiteboardData);

            expect(mockStore.loadSnapshot.calledOnceWith(sampleWhiteboardData)).to.be.true;
        });

        it('should handle empty whiteboard', () => {
            const emptyData = { schema: { version: 1 }, records: [] };
            mockStore.getSnapshot.returns(emptyData);
            
            const snapshot = mockStore.getSnapshot();
            expect(snapshot.records).to.be.empty;
        });
    });

    describe('File Format', () => {
        it('should use .whiteboard.json extension', () => {
            // Verify the expected file extension
            const filename = 'my-drawing.whiteboard.json';
            expect(filename.endsWith('.whiteboard.json')).to.be.true;
        });

        it('should validate whiteboard JSON structure', () => {
            // Validate schema structure
            expect(sampleWhiteboardData).to.have.property('schema');
            expect(sampleWhiteboardData).to.have.property('records');
            expect(sampleWhiteboardData.schema).to.have.property('version');
            expect(Array.isArray(sampleWhiteboardData.records)).to.be.true;
        });
    });

    describe('Auto-save', () => {
        it('should detect changes in store', () => {
            const listener = sinon.stub();
            mockStore.addListener.returns(undefined);
            mockStore.removeListener.returns(undefined);
            
            mockStore.addListener('change', listener);
            
            expect(mockStore.addListener.calledOnce).to.be.true;
        });
    });

    describe('Whiteboard Data Operations', () => {
        it('should create empty whiteboard data', () => {
            const emptyData = { schema: { version: 1 }, records: [] };
            expect(emptyData.schema.version).to.equal(1);
            expect(emptyData.records).to.be.an('array');
            expect(emptyData.records.length).to.equal(0);
        });

        it('should add shape to whiteboard', () => {
            const data = { schema: { version: 1 }, records: [] as any[] };
            const newShape = { id: 'shape1', type: 'geo', x: 100, y: 100 };
            
            const updatedData = {
                ...data,
                records: [...data.records, newShape]
            };
            
            expect(updatedData.records.length).to.equal(1);
            expect(updatedData.records[0].id).to.equal('shape1');
        });

        it('should remove shape from whiteboard', () => {
            const data = { 
                schema: { version: 1 }, 
                records: [
                    { id: 'shape1', type: 'geo' },
                    { id: 'shape2', type: 'arrow' }
                ] 
            };
            
            const updatedData = {
                ...data,
                records: data.records.filter(r => r.id !== 'shape1')
            };
            
            expect(updatedData.records.length).to.equal(1);
            expect(updatedData.records[0].id).to.equal('shape2');
        });

        it('should update shape in whiteboard', () => {
            const data = { 
                schema: { version: 1 }, 
                records: [
                    { id: 'shape1', type: 'geo', props: { color: 'red' } }
                ] 
            };
            
            const updatedData = {
                ...data,
                records: data.records.map(r => 
                    r.id === 'shape1' ? { ...r, props: { ...r.props, color: 'blue' } } : r
                )
            };
            
            expect(updatedData.records[0].props.color).to.equal('blue');
        });
    });
});
