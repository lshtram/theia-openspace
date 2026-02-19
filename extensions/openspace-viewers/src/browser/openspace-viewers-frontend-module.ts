// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ContainerModule } from '@theia/core/shared/inversify';
import './style/markdown-viewer-widget.css';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { MarkdownViewerWidget } from './markdown-viewer-widget';
import { MarkdownViewerOpenHandler } from './markdown-viewer-open-handler';
import { MarkdownViewerToolbarContribution } from './markdown-viewer-toolbar-contribution';

export default new ContainerModule((bind) => {
    // Widget factory
    bind(MarkdownViewerWidget).toSelf();
    bind(WidgetFactory)
        .toDynamicValue((context) => ({
            id: MarkdownViewerWidget.ID,
            createWidget: () => context.container.get<MarkdownViewerWidget>(MarkdownViewerWidget),
        }))
        .whenTargetNamed(MarkdownViewerWidget.ID);

    // Open handler
    bind(MarkdownViewerOpenHandler).toSelf();
    bind(OpenHandler).toService(MarkdownViewerOpenHandler);

    // Toolbar toggle
    bind(MarkdownViewerToolbarContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(MarkdownViewerToolbarContribution);
    bind(TabBarToolbarContribution).toService(MarkdownViewerToolbarContribution);
});
