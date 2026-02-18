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
 * Tests for WhiteboardWidget exports.
 *
 * NOTE: WhiteboardWidget is a Theia ReactWidget wired via InversifyJS DI.
 * It cannot be instantiated without a full Theia container.
 * These tests cover:
 *   - Static constants (ID, LABEL)
 *   - WhiteboardUtils static methods (createEmpty, validate, addShape, removeShape, updateShape)
 */

import { expect } from 'chai';
import { WhiteboardWidget, WhiteboardUtils, WhiteboardData, WhiteboardRecord } from '../whiteboard-widget';

describe('WhiteboardWidget', () => {

    describe('Widget Constants', () => {
        it('should have correct widget ID', () => {
            expect(WhiteboardWidget.ID).to.equal('openspace-whiteboard-widget');
        });

        it('should have correct widget label', () => {
            expect(WhiteboardWidget.LABEL).to.equal('Whiteboard');
        });
    });

    describe('WhiteboardUtils.createEmpty()', () => {
        it('should return a whiteboard with schema version 1', () => {
            const data = WhiteboardUtils.createEmpty();
            expect(data.schema.version).to.equal(1);
        });

        it('should return a whiteboard with no records', () => {
            const data = WhiteboardUtils.createEmpty();
            expect(data.records).to.be.an('array');
            expect(data.records).to.have.lengthOf(0);
        });

        it('should return a new object each time', () => {
            const a = WhiteboardUtils.createEmpty();
            const b = WhiteboardUtils.createEmpty();
            expect(a).to.not.equal(b);
        });
    });

    describe('WhiteboardUtils.validate()', () => {
        it('should accept a valid whiteboard data object', () => {
            const valid: WhiteboardData = { schema: { version: 1 }, records: [] };
            expect(WhiteboardUtils.validate(valid)).to.be.true;
        });

        it('should accept whiteboard data with records', () => {
            const valid: WhiteboardData = {
                schema: { version: 2 },
                records: [{ id: 'r1', type: 'geo' }]
            };
            expect(WhiteboardUtils.validate(valid)).to.be.true;
        });

        it('should reject null', () => {
            expect(WhiteboardUtils.validate(null)).to.be.false;
        });

        it('should reject undefined', () => {
            expect(WhiteboardUtils.validate(undefined)).to.be.false;
        });

        it('should reject object without schema', () => {
            expect(WhiteboardUtils.validate({ records: [] })).to.be.false;
        });

        it('should reject object with non-numeric schema version', () => {
            expect(WhiteboardUtils.validate({ schema: { version: 'one' }, records: [] })).to.be.false;
        });

        it('should reject object with non-array records', () => {
            expect(WhiteboardUtils.validate({ schema: { version: 1 }, records: 'bad' })).to.be.false;
        });

        it('should reject primitive values', () => {
            expect(WhiteboardUtils.validate('string')).to.be.false;
            expect(WhiteboardUtils.validate(42)).to.be.false;
        });
    });

    describe('WhiteboardUtils.addShape()', () => {
        let base: WhiteboardData;

        beforeEach(() => {
            base = WhiteboardUtils.createEmpty();
        });

        it('should add a shape to an empty whiteboard', () => {
            const shape: WhiteboardRecord = { id: 'shape1', type: 'geo' };
            const updated = WhiteboardUtils.addShape(base, shape);
            expect(updated.records).to.have.lengthOf(1);
            expect(updated.records[0].id).to.equal('shape1');
        });

        it('should not mutate the original data', () => {
            const shape: WhiteboardRecord = { id: 'shape1', type: 'geo' };
            WhiteboardUtils.addShape(base, shape);
            expect(base.records).to.have.lengthOf(0);
        });

        it('should preserve existing shapes when adding', () => {
            const first: WhiteboardRecord = { id: 'r1', type: 'geo' };
            const second: WhiteboardRecord = { id: 'r2', type: 'arrow' };
            const withFirst = WhiteboardUtils.addShape(base, first);
            const withBoth = WhiteboardUtils.addShape(withFirst, second);
            expect(withBoth.records).to.have.lengthOf(2);
        });

        it('should preserve schema version when adding shape', () => {
            const shape: WhiteboardRecord = { id: 's1', type: 'text' };
            const updated = WhiteboardUtils.addShape(base, shape);
            expect(updated.schema.version).to.equal(base.schema.version);
        });
    });

    describe('WhiteboardUtils.removeShape()', () => {
        let base: WhiteboardData;

        beforeEach(() => {
            base = {
                schema: { version: 1 },
                records: [
                    { id: 'shape1', type: 'geo' },
                    { id: 'shape2', type: 'arrow' },
                    { id: 'shape3', type: 'text' }
                ]
            };
        });

        it('should remove the specified shape by id', () => {
            const updated = WhiteboardUtils.removeShape(base, 'shape2');
            expect(updated.records.find(r => r.id === 'shape2')).to.be.undefined;
        });

        it('should preserve remaining shapes after removal', () => {
            const updated = WhiteboardUtils.removeShape(base, 'shape2');
            expect(updated.records).to.have.lengthOf(2);
            expect(updated.records.map(r => r.id)).to.include.members(['shape1', 'shape3']);
        });

        it('should not mutate the original data', () => {
            WhiteboardUtils.removeShape(base, 'shape1');
            expect(base.records).to.have.lengthOf(3);
        });

        it('should return unchanged records if id not found', () => {
            const updated = WhiteboardUtils.removeShape(base, 'nonexistent');
            expect(updated.records).to.have.lengthOf(3);
        });

        it('should preserve schema version when removing shape', () => {
            const updated = WhiteboardUtils.removeShape(base, 'shape1');
            expect(updated.schema.version).to.equal(1);
        });
    });

    describe('WhiteboardUtils.updateShape()', () => {
        let base: WhiteboardData;

        beforeEach(() => {
            base = {
                schema: { version: 1 },
                records: [
                    { id: 'shape1', type: 'geo', x: 100, y: 100 },
                    { id: 'shape2', type: 'arrow', x: 200, y: 200 }
                ]
            };
        });

        it('should update properties of the specified shape', () => {
            const updated = WhiteboardUtils.updateShape(base, 'shape1', { x: 300 });
            const shape = updated.records.find(r => r.id === 'shape1');
            expect(shape?.x).to.equal(300);
        });

        it('should preserve unchanged properties on the updated shape', () => {
            const updated = WhiteboardUtils.updateShape(base, 'shape1', { x: 300 });
            const shape = updated.records.find(r => r.id === 'shape1');
            expect(shape?.y).to.equal(100);
            expect(shape?.type).to.equal('geo');
        });

        it('should not affect other shapes', () => {
            const updated = WhiteboardUtils.updateShape(base, 'shape1', { x: 999 });
            const other = updated.records.find(r => r.id === 'shape2');
            expect(other?.x).to.equal(200);
        });

        it('should not mutate the original data', () => {
            WhiteboardUtils.updateShape(base, 'shape1', { x: 999 });
            expect(base.records[0].x).to.equal(100);
        });

        it('should return unchanged records if id not found', () => {
            const updated = WhiteboardUtils.updateShape(base, 'nonexistent', { x: 0 });
            expect(updated.records[0].x).to.equal(100);
            expect(updated.records[1].x).to.equal(200);
        });

        it('should preserve schema version when updating shape', () => {
            const updated = WhiteboardUtils.updateShape(base, 'shape1', { x: 0 });
            expect(updated.schema.version).to.equal(1);
        });
    });
});
