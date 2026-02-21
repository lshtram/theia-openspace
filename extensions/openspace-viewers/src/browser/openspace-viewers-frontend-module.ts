// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ContainerModule } from '@theia/core/shared/inversify';
import './style/markdown-viewer-widget.css';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import URI from '@theia/core/lib/common/uri';
import { MarkdownViewerWidget } from './markdown-viewer-widget';
import { MarkdownViewerOpenHandler } from './markdown-viewer-open-handler';
import { MarkdownViewerToolbarContribution } from './markdown-viewer-toolbar-contribution';
import { MarkdownViewerSplitContribution } from './markdown-viewer-split-contribution';
import { SplitEditorContribution } from '@theia/editor/lib/browser/split-editor-contribution';

export default new ContainerModule((bind) => {
    // Widget factory — options must carry uri so restored widgets can reload content
    bind(MarkdownViewerWidget).toSelf();
    bind(WidgetFactory)
        .toDynamicValue((context) => ({
            id: MarkdownViewerWidget.ID,
            createWidget: (options?: { uri?: string }) => {
                const widget = context.container.get<MarkdownViewerWidget>(MarkdownViewerWidget);
                if (options?.uri) {
                    widget.uri = options.uri;
                    const uriObj = new URI(options.uri);
                    widget.title.label = uriObj.path.base;
                    widget.title.caption = uriObj.path.base;
                }
                return widget;
            },
        }))
        .whenTargetNamed(MarkdownViewerWidget.ID);

    // Open handler
    bind(MarkdownViewerOpenHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(MarkdownViewerOpenHandler);

    // Split contribution — enables "Split Right/Down/Up/Left" context menu items
    bind(MarkdownViewerSplitContribution).toSelf().inSingletonScope();
    bind(SplitEditorContribution).toService(MarkdownViewerSplitContribution);

    // Toolbar toggle
    bind(MarkdownViewerToolbarContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(MarkdownViewerToolbarContribution);
});
