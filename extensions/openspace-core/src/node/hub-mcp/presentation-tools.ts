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

export function registerPresentationTools(server: IMcpServer, deps: BridgeDeps): void {
    server.tool(
        TOOL.PRESENTATION_LIST,
        'List all .deck.md presentation files in the workspace',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_LIST, args)
    );

    server.tool(
        TOOL.PRESENTATION_READ,
        'Read a .deck.md presentation file and return its parsed structure',
        {
            path: z.string().describe('Absolute path to the .deck.md file'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_READ, args)
    );

    server.tool(
        TOOL.PRESENTATION_CREATE,
        'Create a new .deck.md presentation file with title and initial slides',
        {
            path: z.string().describe('Absolute path for the new .deck.md file'),
            title: z.string().describe('Presentation title'),
            slides: z.array(z.string()).optional().describe('Array of markdown slide content strings'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_CREATE, args)
    );

    server.tool(
        TOOL.PRESENTATION_UPDATE_SLIDE,
        'Update the content of a single slide in a .deck.md file',
        {
            path: z.string().describe('Absolute path to the .deck.md file'),
            slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
            content: z.string().describe('New markdown content for the slide'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_UPDATE_SLIDE, args)
    );

    server.tool(
        TOOL.PRESENTATION_OPEN,
        'Open a .deck.md file in the presentation viewer pane',
        {
            path: z.string().describe('Absolute path to the .deck.md file'),
            splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                .describe('Where to open the pane (default: right)'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_OPEN, args)
    );

    server.tool(
        TOOL.PRESENTATION_NAVIGATE,
        'Navigate to a slide in the active presentation',
        {
            direction: z.enum(['next', 'prev', 'first', 'last']).optional()
                .describe('Navigation direction'),
            slideIndex: z.number().int().min(0).optional()
                .describe('Absolute zero-based slide index to jump to'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_NAVIGATE, args)
    );

    server.tool(
        TOOL.PRESENTATION_PLAY,
        'Start autoplay — advances slides automatically on a timer',
        {
            interval: z.number().int().min(500).optional()
                .describe('Milliseconds between slides (default: 5000)'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_PLAY, args)
    );

    server.tool(
        TOOL.PRESENTATION_PAUSE,
        'Pause autoplay, keeping current slide position',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_PAUSE, args)
    );

    server.tool(
        TOOL.PRESENTATION_STOP,
        'Stop autoplay and return to the first slide',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_STOP, args)
    );

    server.tool(
        TOOL.PRESENTATION_TOGGLE_FULLSCREEN,
        'Toggle fullscreen mode for the active presentation viewer',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.PRESENTATION_TOGGLE_FULLSCREEN, args)
    );
}
