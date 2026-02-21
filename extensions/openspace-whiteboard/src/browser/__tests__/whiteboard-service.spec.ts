/* eslint-disable @typescript-eslint/no-explicit-any */
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
 * Tests for WhiteboardService methods.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { WhiteboardService } from '../whiteboard-service';
import { WhiteboardUtils, WhiteboardData } from '../whiteboard-widget';

/** Minimal valid TLStoreSnapshot. */
function makeSnapshot(store?: Record<string, unknown>): WhiteboardData {
    return {
        store: store ?? {},
        schema: { schemaVersion: 2, sequences: {} }
    } as unknown as WhiteboardData;
}

describe('WhiteboardService', () => {
    let service: WhiteboardService;

    beforeEach(() => {
        service = new WhiteboardService();
        // Inject stub fileService and workspaceService — unused by tested methods
        (service as any).fileService = {};
        (service as any).workspaceService = {};
        (service as any).logger = { warn: sinon.stub(), info: sinon.stub() };
    });

    describe('getFileExtension', () => {
        it('should return .whiteboard.json', () => {
            const ext = service.getFileExtension();
            expect(ext).to.equal('.whiteboard.json');
        });
    });

    describe('validate', () => {
        it('should validate native TLStoreSnapshot format', () => {
            expect(WhiteboardUtils.validate(makeSnapshot())).to.be.true;
        });

        it('should reject missing store key', () => {
            const data = { schema: { schemaVersion: 2, sequences: {} } };
            expect(WhiteboardUtils.validate(data)).to.be.false;
        });

        it('should reject missing schema key', () => {
            const data = { store: {} };
            expect(WhiteboardUtils.validate(data)).to.be.false;
        });

        it('should reject the old legacy format', () => {
            // Old format used before the native snapshot API
            expect(WhiteboardUtils.validate({ schema: { version: 1 }, records: [] })).to.be.false;
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

        it('should calculate centroid of shape bounding boxes', () => {
            // Pure geometry calculation (not testing service code, just the math used in fitCamera)
            const records = [
                { x: 0,   y: 0,   props: { w: 100, h: 100 } },
                { x: 200, y: 200, props: { w: 50,  h: 50  } }
            ];

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const r of records) {
                minX = Math.min(minX, r.x);
                minY = Math.min(minY, r.y);
                maxX = Math.max(maxX, r.x + r.props.w);
                maxY = Math.max(maxY, r.y + r.props.h);
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            expect(centerX).to.equal(125); // (0 + 250) / 2 = 125
            expect(centerY).to.equal(125); // (0 + 250) / 2 = 125
        });
    });

    describe('listWhiteboards()', () => {
        it('should return empty array when no workspace roots exist', async () => {
            (service as any).workspaceService = { tryGetRoots: sinon.stub().returns([]) };
            const result = await service.listWhiteboards();
            expect(result).to.deep.equal([]);
        });

        it('should return whiteboard files found in workspace', async () => {
            const wbUri = {
                toString: () => '/workspace/board.whiteboard.json',
                path: { base: 'board.whiteboard.json' }
            };
            const rootUri = {
                toString: () => '/workspace',
                path: { base: 'workspace' }
            };
            (service as any).fileService = {
                resolve: sinon.stub().resolves({
                    isDirectory: true,
                    children: [
                        { isDirectory: false, resource: wbUri }
                    ]
                })
            };
            (service as any).workspaceService = {
                tryGetRoots: sinon.stub().returns([{ resource: rootUri }])
            };
            const result = await service.listWhiteboards();
            expect(result).to.include('/workspace/board.whiteboard.json');
        });
    });
});

describe('WhiteboardService.createWhiteboard — path resolution', () => {
    let service: WhiteboardService;
    let createStub: sinon.SinonStub;

    beforeEach(() => {
        service = new WhiteboardService();
        createStub = sinon.stub().resolves();
        (service as any).fileService = {
            create: createStub,
            createFolder: sinon.stub().resolves(),
            exists: sinon.stub().resolves(false),
        };
        (service as any).workspaceService = { tryGetRoots: sinon.stub().returns([{ resource: { toString: () => 'file:///workspace' } }]) };
        (service as any).preferenceService = {
            get: sinon.stub().withArgs('openspace.paths.whiteboards').returns('openspace/whiteboards'),
        };
        (service as any).logger = { warn: sinon.stub(), info: sinon.stub() };
    });

    it('creates file under configured folder for bare name', async () => {
        await service.createWhiteboard('myboard');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.include('openspace/whiteboards/myboard.whiteboard.json');
    });

    it('respects absolute file:// path, does not modify it', async () => {
        const abs = 'file:///tmp/myboard.whiteboard.json';
        await service.createWhiteboard(abs);
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.equal(abs);
    });
});
