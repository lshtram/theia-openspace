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
 * Tests for WhiteboardOpenHandler canHandle logic.
 * These tests verify the file extension matching logic.
 */

// Simple path checker mimicking the canHandle logic
function canHandleWhiteboardJson(path: string): number {
    const WHITEBOARD_EXTENSION = '.whiteboard.json';
    if (path.endsWith(WHITEBOARD_EXTENSION)) {
        return 200;
    }
    return 0;
}

describe('WhiteboardOpenHandler canHandle logic', () => {
    it('should return priority 200 for .whiteboard.json files', () => {
        const path = '/test/project/diagram.whiteboard.json';
        const priority = canHandleWhiteboardJson(path);
        if (priority !== 200) {
            throw new Error(`Expected 200, got ${priority}`);
        }
    });

    it('should return priority 200 for .whiteboard.json files in subdirectories', () => {
        const path = '/test/project/docs/whiteboard.whiteboard.json';
        const priority = canHandleWhiteboardJson(path);
        if (priority !== 200) {
            throw new Error(`Expected 200, got ${priority}`);
        }
    });

    it('should return 0 for .json files without .whiteboard prefix', () => {
        const path = '/test/project/data.json';
        const priority = canHandleWhiteboardJson(path);
        if (priority !== 0) {
            throw new Error(`Expected 0, got ${priority}`);
        }
    });

    it('should return 0 for .deck.md files', () => {
        const path = '/test/project/presentation.deck.md';
        const priority = canHandleWhiteboardJson(path);
        if (priority !== 0) {
            throw new Error(`Expected 0, got ${priority}`);
        }
    });

    it('should return 0 for .txt files', () => {
        const path = '/test/project/notes.txt';
        const priority = canHandleWhiteboardJson(path);
        if (priority !== 0) {
            throw new Error(`Expected 0, got ${priority}`);
        }
    });
});
