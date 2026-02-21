// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, Command } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ApplicationShell, Widget } from '@theia/core/lib/browser';
import { PresentationWidget } from './presentation-widget';

export const PresentationToolbarCommands = {
    TOGGLE_MODE: {
        id: 'openspace.presentation.toggleMode',
        label: 'Toggle Presentation / Edit',
    } as Command,
};

@injectable()
export class PresentationToolbarContribution
    implements CommandContribution, TabBarToolbarContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(PresentationToolbarCommands.TOGGLE_MODE, {
            isEnabled: (widget: Widget) => widget instanceof PresentationWidget,
            execute: (widget: Widget) => {
                if (widget instanceof PresentationWidget && !widget.isDisposed) {
                    widget.toggleMode();
                }
            },
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: PresentationToolbarCommands.TOGGLE_MODE.id,
            command: PresentationToolbarCommands.TOGGLE_MODE.id,
            tooltip: 'Toggle Presentation / Edit',
            icon: () => {
                const widget = this.shell.currentWidget;
                if (!(widget instanceof PresentationWidget) || widget.isDisposed) {
                    return 'codicon codicon-edit';
                }
                return widget.getMode() === 'presentation'
                    ? 'codicon codicon-edit'
                    : 'fa fa-play-circle';
            },
            group: 'navigation',
            priority: 0,
            isVisible: (widget: Widget) => widget instanceof PresentationWidget,
        });
    }
}
