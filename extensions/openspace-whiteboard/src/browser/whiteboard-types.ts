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
 * Lightweight whiteboard types and utilities — no tldraw or Theia imports.
 * Kept separate so unit tests can import WhiteboardUtils without pulling in
 * the tldraw/Theia browser dependency chain.
 */

/**
 * The native tldraw store snapshot format. This is what `editor.getSnapshot().document`
 * returns and what `editor.loadSnapshot()` expects.
 *
 * Shape: { store: Record<id, TLRecord>, schema: SerializedSchema }
 *
 * We persist this directly to/from the `.whiteboard` JSON file so that tldraw's
 * own migration machinery handles version upgrades transparently.
 */
export interface WhiteboardData {
    store: Record<string, unknown>;
    schema: { schemaVersion: number; sequences?: Record<string, unknown> };
}

/**
 * Legacy format used before the native snapshot API was adopted.
 * Kept for backward-compatible parsing in loadFromJson().
 */
export interface WhiteboardRecord {
    id: string;
    type: string;
    [key: string]: unknown;
}

/**
 * Utility functions for whiteboard data manipulation.
 * NOTE: Most shape manipulation is now done directly via the tldraw Editor API.
 * These helpers are kept for service-layer operations that run without a live editor.
 */
export class WhiteboardUtils {
    static validate(data: unknown): data is WhiteboardData {
        if (!data || typeof data !== 'object') return false;
        const d = data as WhiteboardData;
        // Native TLStoreSnapshot format: { store: {…}, schema: { schemaVersion, sequences } }
        return (
            'store' in d && typeof d.store === 'object' &&
            'schema' in d && typeof d.schema === 'object'
        );
    }
}
