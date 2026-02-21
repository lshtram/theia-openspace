// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { URI } from '@theia/core/lib/common/uri';
import { MarkdownViewerOpenHandler } from '../markdown-viewer-open-handler';

describe('MarkdownViewerOpenHandler canHandle logic', () => {
    let handler: MarkdownViewerOpenHandler;

    beforeEach(() => {
        handler = new MarkdownViewerOpenHandler();
    });

    it('should return priority 200 for .md files', () => {
        expect(handler.canHandle(new URI('file:///project/README.md'))).to.equal(200);
    });

    it('should return priority 200 for .markdown files', () => {
        expect(handler.canHandle(new URI('file:///project/notes.markdown'))).to.equal(200);
    });

    it('should return priority 200 for .mdown files', () => {
        expect(handler.canHandle(new URI('file:///project/doc.mdown'))).to.equal(200);
    });

    it('should return 0 for .deck.md files (handled by presentation)', () => {
        expect(handler.canHandle(new URI('file:///project/talk.deck.md'))).to.equal(0);
    });

    it('should return 0 for .ts files', () => {
        expect(handler.canHandle(new URI('file:///project/index.ts'))).to.equal(0);
    });

    it('should return 0 for .json files', () => {
        expect(handler.canHandle(new URI('file:///project/data.json'))).to.equal(0);
    });

    it('should return 0 for files with no extension', () => {
        expect(handler.canHandle(new URI('file:///project/Makefile'))).to.equal(0);
    });

    it('should handle .md files in deep subdirectories', () => {
        expect(handler.canHandle(new URI('file:///a/b/c/d/e.md'))).to.equal(200);
    });
});
