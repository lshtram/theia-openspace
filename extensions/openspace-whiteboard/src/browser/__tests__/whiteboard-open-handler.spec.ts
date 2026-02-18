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
 * These tests verify the file extension matching logic using the real class.
 */

import { expect } from 'chai';
import { URI } from '@theia/core/lib/common/uri';
import { WhiteboardOpenHandler } from '../whiteboard-open-handler';

describe('WhiteboardOpenHandler canHandle logic', () => {
    let handler: WhiteboardOpenHandler;

    beforeEach(() => {
        // WhiteboardOpenHandler uses @inject for widgetManager and fileService,
        // but canHandle() only calls uri.path.toString() — no services needed.
        handler = new WhiteboardOpenHandler();
    });

    it('should return priority 200 for .whiteboard.json files', () => {
        const uri = new URI('file:///test/project/diagram.whiteboard.json');
        const priority = handler.canHandle(uri);
        expect(priority).to.equal(200);
    });

    it('should return priority 200 for .whiteboard.json files in subdirectories', () => {
        const uri = new URI('file:///test/project/docs/whiteboard.whiteboard.json');
        const priority = handler.canHandle(uri);
        expect(priority).to.equal(200);
    });

    it('should return 0 for .json files without .whiteboard prefix', () => {
        const uri = new URI('file:///test/project/data.json');
        const priority = handler.canHandle(uri);
        expect(priority).to.equal(0);
    });

    it('should return 0 for .deck.md files', () => {
        const uri = new URI('file:///test/project/presentation.deck.md');
        const priority = handler.canHandle(uri);
        expect(priority).to.equal(0);
    });

    it('should return 0 for .txt files', () => {
        const uri = new URI('file:///test/project/notes.txt');
        const priority = handler.canHandle(uri);
        expect(priority).to.equal(0);
    });
});
