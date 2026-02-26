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

export function registerTerminalTools(server: IMcpServer, deps: BridgeDeps): void {
    server.tool(
        TOOL.TERMINAL_CREATE,
        'Create a new terminal pane',
        {
            title: z.string().optional().describe('Title for the terminal tab'),
            cwd: z.string().optional().describe('Working directory for the terminal'),
            shellPath: z.string().optional().describe('Path to shell executable (must be in allowlist)')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.TERMINAL_CREATE, args)
    );

    server.tool(
        TOOL.TERMINAL_SEND,
        'Send text/command input to a terminal',
        {
            terminalId: z.string().describe('ID of the terminal to send input to'),
            text: z.string().describe('Text to send to the terminal (newline triggers Enter)')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.TERMINAL_SEND, args)
    );

    server.tool(
        TOOL.TERMINAL_READ_OUTPUT,
        'Read recent output from a terminal',
        {
            terminalId: z.string().describe('ID of the terminal to read output from'),
            lines: z.number().optional().describe('Number of recent lines to read (default: 50)')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.TERMINAL_READ_OUTPUT, args)
    );

    server.tool(
        TOOL.TERMINAL_LIST,
        'List all open terminals and their IDs',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.TERMINAL_LIST, args)
    );

    server.tool(
        TOOL.TERMINAL_CLOSE,
        'Close a terminal by its ID',
        {
            terminalId: z.string().describe('ID of the terminal to close')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.TERMINAL_CLOSE, args)
    );
}
