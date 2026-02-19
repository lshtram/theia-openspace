// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { Widget, DockLayout } from '@theia/core/lib/browser';
import { SplitEditorContribution } from '@theia/editor/lib/browser/split-editor-contribution';
import { MarkdownViewerWidget } from './markdown-viewer-widget';
import { MarkdownViewerOpenHandler } from './markdown-viewer-open-handler';
import { URI } from '@theia/core/lib/common/uri';

@injectable()
export class MarkdownViewerSplitContribution implements SplitEditorContribution<MarkdownViewerWidget> {

    @inject(MarkdownViewerOpenHandler)
    protected readonly openHandler!: MarkdownViewerOpenHandler;

    canHandle(widget: Widget): number {
        return widget instanceof MarkdownViewerWidget ? 100 : 0;
    }

    async split(widget: MarkdownViewerWidget, splitMode: DockLayout.InsertMode): Promise<MarkdownViewerWidget | undefined> {
        if (!widget.uri) { return undefined; }
        return this.openHandler.open(new URI(widget.uri), {
            widgetOptions: { mode: splitMode, ref: widget },
            forceNewWidget: true,
        });
    }
}
