// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, Command } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ApplicationShell } from '@theia/core/lib/browser';
import { MarkdownViewerWidget } from './markdown-viewer-widget';

export namespace MarkdownViewerCommands {
    export const TOGGLE_MODE: Command = {
        id: 'openspace.markdownViewer.toggleMode',
        label: 'Toggle Preview/Edit',
    };
}

@injectable()
export class MarkdownViewerToolbarContribution
    implements CommandContribution, TabBarToolbarContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(MarkdownViewerCommands.TOGGLE_MODE, {
            isEnabled: () => this.currentViewerWidget() !== undefined,
            isVisible: () => this.currentViewerWidget() !== undefined,
            execute: () => {
                const widget = this.currentViewerWidget();
                widget?.toggleMode();
            },
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: MarkdownViewerCommands.TOGGLE_MODE.id,
            command: MarkdownViewerCommands.TOGGLE_MODE.id,
            tooltip: 'Toggle Preview / Edit',
            icon: () => {
                const widget = this.currentViewerWidget();
                if (!widget) { return 'codicon codicon-edit'; }
                return widget.getMode() === 'preview'
                    ? 'codicon codicon-edit'
                    : 'codicon codicon-preview';
            },
            group: 'navigation',
            priority: 0,
            isVisible: (widget) => widget instanceof MarkdownViewerWidget,
        });
    }

    protected currentViewerWidget(): MarkdownViewerWidget | undefined {
        const widget = this.shell.currentWidget;
        return widget instanceof MarkdownViewerWidget ? widget : undefined;
    }
}
