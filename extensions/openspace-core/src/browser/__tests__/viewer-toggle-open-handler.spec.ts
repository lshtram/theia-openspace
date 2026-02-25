// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { URI } from '@theia/core/lib/common/uri';
import { ViewerToggleOpenHandler } from '../viewer-toggle/viewer-toggle-open-handler';
import { ViewerToggleService } from '../viewer-toggle/viewer-toggle-service';

type StubHandler = { id: string; canHandle: (u: URI) => number; open: (u: URI) => Promise<object | undefined> };

function makeHandlersProvider(handlers: StubHandler[]) {
    return {
        getContributions: () => handlers,
    };
}

function makeToggleService(canToggleResult: boolean, state: 'preview' | 'edit' = 'preview') {
    return {
        canToggle: async (_uri: URI) => canToggleResult,
        getToggleState: (_uri: URI) => state,
        toggle: (_uri: URI) => (state === 'preview' ? 'edit' : 'preview') as 'preview' | 'edit',
    } as unknown as ViewerToggleService;
}

function makeHandler(
    canToggleResult: boolean,
    toggleState: 'preview' | 'edit',
    handlers: StubHandler[],
): ViewerToggleOpenHandler {
    const h = new ViewerToggleOpenHandler();
    (h as ViewerToggleOpenHandler & { toggleService: ViewerToggleService; handlersProvider: { getContributions: () => StubHandler[] } }).toggleService = makeToggleService(canToggleResult, toggleState);
    (h as ViewerToggleOpenHandler & { toggleService: ViewerToggleService; handlersProvider: { getContributions: () => StubHandler[] } }).handlersProvider = makeHandlersProvider(handlers);
    return h;
}

describe('ViewerToggleOpenHandler', () => {
    describe('canHandle()', () => {
        it('returns 150 when canToggle is true', async () => {
            const h = makeHandler(true, 'preview', []);
            expect(await h.canHandle(new URI('file:///test.csv'))).to.equal(150);
        });

        it('returns 0 when canToggle is false', async () => {
            const h = makeHandler(false, 'preview', []);
            expect(await h.canHandle(new URI('file:///test.png'))).to.equal(0);
        });
    });

    describe('open() in preview state', () => {
        it('delegates to a viewer handler', async () => {
            let opened: URI | undefined;
            const viewerHandler: StubHandler = {
                id: 'csv-viewer-handler',
                canHandle: () => 200,
                open: async (u) => { opened = u; return {}; },
            };
            const h = makeHandler(true, 'preview', [viewerHandler]);
            const uri = new URI('file:///test.csv');
            await h.open(uri);
            expect(opened?.toString()).to.equal(uri.toString());
        });

        it('returns undefined if no viewer handler found', async () => {
            const h = makeHandler(true, 'preview', []);
            const result = await h.open(new URI('file:///test.csv'));
            expect(result).to.be.undefined;
        });
    });

    describe('open() in edit state', () => {
        it('delegates to a non-viewer editor handler', async () => {
            let opened: URI | undefined;
            const editorHandler: StubHandler = {
                id: 'code-editor-handler',
                canHandle: () => 100,
                open: async (u) => { opened = u; return {}; },
            };
            const viewerHandler: StubHandler = {
                id: 'csv-viewer-handler',
                canHandle: () => 200,
                open: async () => { throw new Error('should not be called'); },
            };
            const h = makeHandler(true, 'edit', [viewerHandler, editorHandler]);
            const uri = new URI('file:///test.csv');
            await h.open(uri);
            expect(opened?.toString()).to.equal(uri.toString());
        });

        it('skips self when finding editor handler', async () => {
            let opened: URI | undefined;
            const editorHandler: StubHandler = {
                id: 'monaco-editor',
                canHandle: () => 100,
                open: async (u) => { opened = u; return {}; },
            };
            const selfHandler: StubHandler = {
                id: 'openspace-viewer-toggle-open-handler',
                canHandle: () => 150,
                open: async () => { throw new Error('self should not be called'); },
            };
            const h = makeHandler(true, 'edit', [selfHandler, editorHandler]);
            const uri = new URI('file:///test.csv');
            await h.open(uri);
            expect(opened?.toString()).to.equal(uri.toString());
        });

        it('returns undefined if no non-viewer handler found', async () => {
            const h = makeHandler(true, 'edit', []);
            const result = await h.open(new URI('file:///test.csv'));
            expect(result).to.be.undefined;
        });
    });
});
