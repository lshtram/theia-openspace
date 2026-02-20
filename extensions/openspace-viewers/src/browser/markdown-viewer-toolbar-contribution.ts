// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, Command } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ApplicationShell, Widget } from '@theia/core/lib/browser';
import { MarkdownViewerWidget } from './markdown-viewer-widget';

export const MarkdownViewerCommands = {
    TOGGLE_MODE: {
        id: 'openspace.markdownViewer.toggleMode',
        label: 'Toggle Preview/Edit',
    } as Command,
};

@injectable()
export class MarkdownViewerToolbarContribution
    implements CommandContribution, TabBarToolbarContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(MarkdownViewerCommands.TOGGLE_MODE, {
            isEnabled: (widget: Widget) => widget instanceof MarkdownViewerWidget,
            // The tab-bar toolbar calls executeCommand(commandId, widget), so we
            // receive the exact widget the toolbar button was rendered for.
            execute: (widget: Widget) => {
                console.log('[MarkdownViewerToolbar] execute called, widget:', widget?.id, 'isMarkdown:', widget instanceof MarkdownViewerWidget);
                if (widget instanceof MarkdownViewerWidget && !widget.isDisposed) {
                    widget.toggleMode();
                } else {
                    console.warn('[MarkdownViewerToolbar] execute: widget is not a MarkdownViewerWidget:', widget);
                }
            },
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: MarkdownViewerCommands.TOGGLE_MODE.id,
            command: MarkdownViewerCommands.TOGGLE_MODE.id,
            tooltip: 'Toggle Preview / Edit',
            // icon() is called on every render with no args; read from the current widget
            icon: () => {
                const widget = this.shell.currentWidget;
                if (!(widget instanceof MarkdownViewerWidget) || widget.isDisposed) {
                    return 'codicon codicon-edit';
                }
                return widget.getMode() === 'preview'
                    ? 'codicon codicon-edit'
                    : 'codicon codicon-preview';
            },
            group: 'navigation',
            priority: 0,
            isVisible: (widget: Widget) => widget instanceof MarkdownViewerWidget,
        });
    }
}
