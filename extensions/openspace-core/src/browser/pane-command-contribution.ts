// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { PaneService, PaneOpenArgs, PaneCloseArgs, PaneFocusArgs, PaneResizeArgs } from './pane-service';

/**
 * JSON Schema for openspace.pane.open command arguments.
 * Used for manifest auto-generation (FR-3.7).
 */
export const PANE_OPEN_SCHEMA = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['editor', 'terminal', 'presentation', 'whiteboard'],
            description: 'Type of content to open'
        },
        contentId: {
            type: 'string',
            description: 'Identifier for the content (file path, terminal title, etc.)'
        },
        title: {
            type: 'string',
            description: 'Optional title for the pane'
        },
        splitDirection: {
            type: 'string',
            enum: ['horizontal', 'vertical'],
            description: 'Direction to split the pane'
        }
    },
    required: ['type', 'contentId']
};

/**
 * JSON Schema for openspace.pane.close command arguments.
 */
export const PANE_CLOSE_SCHEMA = {
    type: 'object',
    properties: {
        paneId: {
            type: 'string',
            description: 'ID of the pane to close'
        }
    },
    required: ['paneId']
};

/**
 * JSON Schema for openspace.pane.focus command arguments.
 */
export const PANE_FOCUS_SCHEMA = {
    type: 'object',
    properties: {
        paneId: {
            type: 'string',
            description: 'ID of the pane to focus'
        }
    },
    required: ['paneId']
};

/**
 * JSON Schema for openspace.pane.list command arguments.
 */
export const PANE_LIST_SCHEMA = {
    type: 'object',
    properties: {}
};

/**
 * JSON Schema for openspace.pane.resize command arguments.
 */
export const PANE_RESIZE_SCHEMA = {
    type: 'object',
    properties: {
        paneId: {
            type: 'string',
            description: 'ID of the pane to resize'
        },
        width: {
            type: 'number',
            description: 'New width as percentage (0-100)'
        },
        height: {
            type: 'number',
            description: 'New height as percentage (0-100)'
        }
    },
    required: ['paneId']
};

/**
 * Command IDs for pane operations.
 */
export const PaneCommands = {
    OPEN: 'openspace.pane.open',
    CLOSE: 'openspace.pane.close',
    FOCUS: 'openspace.pane.focus',
    LIST: 'openspace.pane.list',
    RESIZE: 'openspace.pane.resize'
} as const;

/**
 * PaneCommandContribution - Registers pane management commands in Theia's CommandRegistry.
 * 
 * Implements CommandContribution to register 5 pane commands:
 * - openspace.pane.open: Open a new pane with content
 * - openspace.pane.close: Close a pane by ID
 * - openspace.pane.focus: Focus a pane by ID
 * - openspace.pane.list: List all panes with geometry info
 * - openspace.pane.resize: Resize a pane
 * 
 * Each command includes argument schemas for manifest auto-generation (FR-3.7).
 */
@injectable()
export class PaneCommandContribution implements CommandContribution {

    @inject(PaneService)
    private readonly paneService!: PaneService;

    /**
     * Register all pane commands with Theia's CommandRegistry.
     * Each command delegates to the corresponding PaneService method.
     */
    registerCommands(registry: CommandRegistry): void {
        // Register openspace.pane.open
        registry.registerCommand(
            {
                id: PaneCommands.OPEN,
                label: 'OpenSpace: Open Pane'
            },
            {
                execute: async (args: PaneOpenArgs) => {
                    return this.paneService.openContent(args);
                }
            }
        );

        // Register openspace.pane.close
        registry.registerCommand(
            {
                id: PaneCommands.CLOSE,
                label: 'OpenSpace: Close Pane'
            },
            {
                execute: async (args: PaneCloseArgs) => {
                    return this.paneService.closeContent(args);
                }
            }
        );

        // Register openspace.pane.focus
        registry.registerCommand(
            {
                id: PaneCommands.FOCUS,
                label: 'OpenSpace: Focus Pane'
            },
            {
                execute: async (args: PaneFocusArgs) => {
                    return this.paneService.focusContent(args);
                }
            }
        );

        // Register openspace.pane.list
        registry.registerCommand(
            {
                id: PaneCommands.LIST,
                label: 'OpenSpace: List Panes'
            },
            {
                execute: async () => {
                    const panes = await this.paneService.listPanes();
                    return { panes };
                }
            }
        );

        // Register openspace.pane.resize
        registry.registerCommand(
            {
                id: PaneCommands.RESIZE,
                label: 'OpenSpace: Resize Pane'
            },
            {
                execute: async (args: PaneResizeArgs) => {
                    return this.paneService.resizePane(args);
                }
            }
        );
    }
}
