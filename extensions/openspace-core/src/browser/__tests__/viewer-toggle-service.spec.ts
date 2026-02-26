// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import * as assert from 'assert';
import { URI } from '@theia/core/lib/common/uri';
import { ViewerToggleService } from '../viewer-toggle/viewer-toggle-service';

// Minimal stub for ContributionProvider<OpenHandler>
function makeHandlersProvider(handlers: Array<{ id: string; priority: number }>) {
    return {
        getContributions: () => handlers.map(h => ({
            id: h.id,
            canHandle: (_u: URI) => h.priority,
            open: async () => undefined,
        })),
    };
}

function makeHandlersProviderSpy(handlers: Array<{ id: string; priority: number }>) {
    let lastRecursiveArg: boolean | undefined = undefined;
    const provider = {
        getContributions: (recursive?: boolean) => {
            lastRecursiveArg = recursive;
            return handlers.map(h => ({
                id: h.id,
                canHandle: (_u: URI) => h.priority,
                open: async () => undefined,
            }));
        },
        getLastRecursiveArg: () => lastRecursiveArg,
    };
    return provider;
}

function makeService(handlers: Array<{ id: string; priority: number }>) {
    const svc = new ViewerToggleService();
    // Inject stub ContributionProvider<OpenHandler> manually (bypasses DI for tests)
    (svc as ViewerToggleService & { handlersProvider: { getContributions: () => Array<{ id: string; canHandle: (u: URI) => number; open: (u: URI) => Promise<object | undefined> }> } }).handlersProvider = makeHandlersProvider(handlers);
    return svc;
}

describe('ViewerToggleService', () => {
    describe('canToggle()', () => {
        it('returns false for excluded image extensions', async () => {
            const svc = makeService([{ id: 'image-viewer', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.png'))).to.be.false;
        });

        it('returns false when no viewer handler exists', async () => {
            // Handler ID does not contain "viewer"
            const svc = makeService([{ id: 'my-editor', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.csv'))).to.be.false;
        });

        it('returns true for text file with a viewer handler', async () => {
            const svc = makeService([{ id: 'csv-viewer-handler', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.csv'))).to.be.true;
        });

        it('returns true for .md file with a viewer handler', async () => {
            const svc = makeService([{ id: 'openspace-markdown-viewer-open-handler', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.md'))).to.be.true;
        });

        it('returns false for .zip file even with a viewer handler', async () => {
            const svc = makeService([{ id: 'zip-viewer-handler', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.zip'))).to.be.false;
        });

        it('returns false when only handler is self (openspace-viewer-toggle-open-handler)', async () => {
            const svc = makeService([{ id: 'openspace-viewer-toggle-open-handler', priority: 150 }]);
            expect(await svc.canToggle(new URI('file:///test.csv'))).to.be.false;
        });

        it('returns true when a viewer handler exists alongside self', async () => {
            const svc = makeService([
                { id: 'openspace-viewer-toggle-open-handler', priority: 150 },
                { id: 'csv-viewer-handler', priority: 200 },
            ]);
            expect(await svc.canToggle(new URI('file:///test.csv'))).to.be.true;
        });

        it('calls getContributions with recursive=true to find viewer handlers in parent DI containers', async () => {
            // Viewer handlers (e.g. @theia/preview markdown handler) are bound in a parent DI
            // container, not the local extension container. Without recursive=true, they are
            // invisible and canToggle() always returns false, causing files to open as plain text.
            const spy = makeHandlersProviderSpy([{ id: 'csv-viewer-handler', priority: 200 }]);
            const svc = new ViewerToggleService();
            (svc as ViewerToggleService & { handlersProvider: { getContributions: (recursive?: boolean) => Array<{ id: string; canHandle: (u: URI) => number; open: (u: URI) => Promise<object | undefined> }> } }).handlersProvider = spy;
            await svc.canToggle(new URI('file:///test.csv'));
            assert.strictEqual(spy.getLastRecursiveArg(), true,
                'getContributions must be called with recursive=true');
        });
    });

    describe('getToggleState()', () => {
        it('returns preview by default', () => {
            const svc = makeService([]);
            expect(svc.getToggleState(new URI('file:///test.csv'))).to.equal('preview');
        });
    });

    describe('toggle()', () => {
        it('flips preview → edit', () => {
            const svc = makeService([]);
            const uri = new URI('file:///test.csv');
            expect(svc.toggle(uri)).to.equal('edit');
            expect(svc.getToggleState(uri)).to.equal('edit');
        });

        it('flips edit → preview', () => {
            const svc = makeService([]);
            const uri = new URI('file:///test.csv');
            svc.toggle(uri); // → edit
            expect(svc.toggle(uri)).to.equal('preview');
            expect(svc.getToggleState(uri)).to.equal('preview');
        });

        it('is independent per URI', () => {
            const svc = makeService([]);
            const a = new URI('file:///a.csv');
            const b = new URI('file:///b.csv');
            svc.toggle(a); // a → edit
            expect(svc.getToggleState(a)).to.equal('edit');
            expect(svc.getToggleState(b)).to.equal('preview');
        });
    });
});
