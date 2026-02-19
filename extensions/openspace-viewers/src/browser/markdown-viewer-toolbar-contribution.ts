// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
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

    /**
     * The last MarkdownViewerWidget that was the active (current) widget.
     * We track this separately because clicking a toolbar button can shift
     * shell focus away from the widget before the command executes, making
     * shell.currentWidget unreliable at command execution time.
     */
    protected lastActiveViewerWidget: MarkdownViewerWidget | undefined;

    @postConstruct()
    protected init(): void {
        this.shell.onDidChangeCurrentWidget(() => {
            const widget = this.shell.currentWidget;
            if (widget instanceof MarkdownViewerWidget) {
                this.lastActiveViewerWidget = widget;
            }
        });
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(MarkdownViewerCommands.TOGGLE_MODE, {
            // Always enabled — the toolbar item's isVisible gates when it shows.
            // We must not gate on currentWidget here because the click shifts focus.
            isEnabled: () => true,
            execute: () => {
                const widget = this.lastActiveViewerWidget;
                if (widget && !widget.isDisposed) {
                    widget.toggleMode();
                }
            },
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: MarkdownViewerCommands.TOGGLE_MODE.id,
            command: MarkdownViewerCommands.TOGGLE_MODE.id,
            tooltip: 'Toggle Preview / Edit',
            icon: () => {
                const widget = this.lastActiveViewerWidget;
                if (!widget || widget.isDisposed) { return 'codicon codicon-edit'; }
                return widget.getMode() === 'preview'
                    ? 'codicon codicon-edit'
                    : 'codicon codicon-preview';
            },
            group: 'navigation',
            priority: 0,
            isVisible: (widget) => widget instanceof MarkdownViewerWidget,
        });
    }
}
