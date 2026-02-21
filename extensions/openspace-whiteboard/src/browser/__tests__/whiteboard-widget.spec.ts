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
 *   - WhiteboardUtils.validate() with the native TLStoreSnapshot format
 */

import { expect } from 'chai';
import { WhiteboardWidget, WhiteboardUtils, WhiteboardData } from '../whiteboard-widget';

/** Minimal valid TLStoreSnapshot — matches what editor.getSnapshot().document returns. */
function makeSnapshot(extra?: Record<string, unknown>): WhiteboardData {
    return {
        store: extra ?? {},
        schema: { schemaVersion: 2, sequences: {} }
    } as unknown as WhiteboardData;
}

describe('WhiteboardWidget', () => {

    describe('Widget Constants', () => {
        it('should have correct widget ID', () => {
            expect(WhiteboardWidget.ID).to.equal('openspace-whiteboard-widget');
        });

        it('should have correct widget label', () => {
            expect(WhiteboardWidget.LABEL).to.equal('Whiteboard');
        });
    });

    describe('WhiteboardUtils.validate()', () => {
        it('should accept a valid native TLStoreSnapshot', () => {
            expect(WhiteboardUtils.validate(makeSnapshot())).to.be.true;
        });

        it('should accept a snapshot with store records', () => {
            const snap = makeSnapshot({ 'shape:abc': { typeName: 'shape', id: 'shape:abc' } });
            expect(WhiteboardUtils.validate(snap)).to.be.true;
        });

        it('should reject null', () => {
            expect(WhiteboardUtils.validate(null)).to.be.false;
        });

        it('should reject undefined', () => {
            expect(WhiteboardUtils.validate(undefined)).to.be.false;
        });

        it('should reject object without store key', () => {
            expect(WhiteboardUtils.validate({ schema: { schemaVersion: 2 } })).to.be.false;
        });

        it('should reject object without schema key', () => {
            expect(WhiteboardUtils.validate({ store: {} })).to.be.false;
        });

        it('should reject the old legacy format (records array)', () => {
            // Old format: { schema: { version: 1 }, records: [] }
            // This does NOT have a 'store' key, so validate() returns false.
            expect(WhiteboardUtils.validate({ schema: { version: 1 }, records: [] })).to.be.false;
        });

        it('should reject primitive values', () => {
            expect(WhiteboardUtils.validate('string')).to.be.false;
            expect(WhiteboardUtils.validate(42)).to.be.false;
        });
    });
});
