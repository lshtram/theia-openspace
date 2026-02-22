// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { URI } from '@theia/core/lib/common/uri';
import { ViewerToggleService } from '../viewer-toggle-service';

// Minimal stub for OpenerService — only what ViewerToggleService needs
function makeOpenerService(handlers: Array<{ id: string; priority: number }>) {
    return {
        getOpeners: async (_uri: URI) => handlers.map(h => ({
            id: h.id,
            canHandle: (_u: URI) => h.priority,
            open: async () => undefined,
        })),
        getOpener: async () => { throw new Error('not needed'); },
    };
}

function makeService(handlers: Array<{ id: string; priority: number }>) {
    const svc = new ViewerToggleService();
    // Inject stub OpenerService manually (bypasses DI for tests)
    (svc as any).openerService = makeOpenerService(handlers);
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
