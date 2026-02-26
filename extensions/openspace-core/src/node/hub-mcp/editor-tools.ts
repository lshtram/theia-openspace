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

export function registerEditorTools(server: IMcpServer, deps: BridgeDeps): void {
    server.tool(
        TOOL.EDITOR_OPEN,
        'Open a file in the editor, optionally jumping to a specific line',
        {
            path: z.string().describe('File path to open (relative to workspace root or absolute)'),
            line: z.number().optional().describe('Line number to navigate to (1-indexed)'),
            column: z.number().optional().describe('Column number to navigate to (1-indexed)')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.EDITOR_OPEN, args)
    );

    server.tool(
        TOOL.EDITOR_READ_FILE,
        'Read the contents of the currently open file (or a specified file) from the editor',
        {
            path: z.string().optional().describe('File path to read. Defaults to the currently active editor file.')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.EDITOR_READ_FILE, args)
    );

    server.tool(
        TOOL.EDITOR_CLOSE,
        'Close the currently active editor tab or a specified file',
        {
            path: z.string().optional().describe('File path to close. Defaults to the currently active editor.')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.EDITOR_CLOSE, args)
    );

    server.tool(
        TOOL.EDITOR_SCROLL_TO,
        'Scroll the editor to a specific line',
        {
            path: z.string().optional().describe('File path of the editor to scroll. Defaults to active editor.'),
            line: z.number().describe('Line number to scroll to (1-indexed)')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.EDITOR_SCROLL_TO, args)
    );

    server.tool(
        TOOL.EDITOR_HIGHLIGHT,
        'Highlight (select) a range of lines in the editor',
        {
            path: z.string().optional().describe('File path. Defaults to active editor.'),
            ranges: z.array(z.object({
                startLine: z.number().describe('Start line (1-indexed)'),
                endLine: z.number().describe('End line (1-indexed)'),
                startColumn: z.number().optional().describe('Start column (1-indexed)'),
                endColumn: z.number().optional().describe('End column (1-indexed)')
            })).describe('Array of line ranges to highlight'),
            highlightId: z.string().optional().describe('Optional custom highlight ID for later removal'),
            color: z.string().optional().describe('Highlight color (e.g. "yellow", "#ffff00")')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.EDITOR_HIGHLIGHT, args)
    );

    server.tool(
        TOOL.EDITOR_CLEAR_HIGHLIGHT,
        'Clear a named highlight in the editor',
        {
            highlightId: z.string().describe('The highlight ID returned by editor.highlight to clear')
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.EDITOR_CLEAR_HIGHLIGHT, args)
    );
}
