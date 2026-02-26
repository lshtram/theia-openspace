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

import { z } from 'zod';
import { TOOL } from '../../common/tool-names';
import type { IMcpServer, BridgeDeps } from './types';

export function registerPaneTools(server: IMcpServer, deps: BridgeDeps): void {
    server.tool(
        TOOL.PANE_OPEN,
        'Open a pane in the IDE (editor, terminal, preview, etc.)',
        {
            type: z.enum(['editor', 'terminal', 'presentation', 'whiteboard']).describe('Pane type'),
            contentId: z.string().describe('Content identifier: file path for editor, or terminal title'),
            title: z.string().optional().describe('Optional label for the pane tab'),
            splitDirection: z.enum(['horizontal', 'vertical']).optional().describe('Split direction when opening alongside existing content'),
            sourcePaneId: z.string().optional()
                .describe('ID of an existing pane to split relative to. When provided, the new pane ' +
                          'is placed relative to that specific pane instead of the currently active one. ' +
                          'Use pane.list to obtain pane IDs.'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PANE_OPEN, args)
    );

    server.tool(
        TOOL.PANE_CLOSE,
        'Close an open pane by its ID',
        {
            paneId: z.string().describe('ID of the pane to close')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PANE_CLOSE, args)
    );

    server.tool(
        TOOL.PANE_FOCUS,
        'Focus a specific pane by ID',
        {
            paneId: z.string().describe('ID of the pane to focus')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PANE_FOCUS, args)
    );

    server.tool(
        TOOL.PANE_LIST,
        'List all open panes and their current state',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.PANE_LIST, args)
    );
}
