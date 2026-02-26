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

export function registerWhiteboardTools(server: IMcpServer, deps: BridgeDeps): void {
    server.tool(
        TOOL.WHITEBOARD_LIST,
        'List all .whiteboard.json files in the workspace',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_LIST, args)
    );

    server.tool(
        TOOL.WHITEBOARD_READ,
        'Read a .whiteboard.json file and return its content and shape records',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_READ, args)
    );

    server.tool(
        TOOL.WHITEBOARD_CREATE,
        'Create a new .whiteboard.json file, optionally with a title label',
        {
            path: z.string().describe('Absolute path for the new .whiteboard.json file'),
            title: z.string().optional().describe('Optional title text label added to the canvas'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_CREATE, args)
    );

    server.tool(
        TOOL.WHITEBOARD_ADD_SHAPE,
        'Add a shape to a whiteboard canvas. Shape type must be a tldraw type: "geo" (for rectangles/ellipses/diamonds — set props.geo), "text" (standalone text), "arrow" (directed line), "note" (sticky note). Colors must be tldraw named colors: black, grey, white, red, light-red, orange, yellow, green, light-green, blue, light-blue, violet, light-violet. For geo shapes use props.richText for text labels. Arrow shapes use props.start/end instead of width/height.',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            type: z.string().describe('tldraw shape type: "geo" | "text" | "arrow" | "note". Use "geo" for rectangles/ellipses, not "rectangle".'),
            x: z.number().describe('X position on canvas'),
            y: z.number().describe('Y position on canvas'),
            width: z.number().optional().describe('Shape width in pixels (not used for arrow shapes)'),
            height: z.number().optional().describe('Shape height in pixels (not used for arrow shapes)'),
            props: z.record(z.string(), z.unknown()).optional().describe('Shape props. geo: {geo:"rectangle"|"ellipse"|"diamond", color:"blue", fill:"semi", richText:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"label"}]}]}}. arrow: {start:{x:0,y:0}, end:{x:100,y:100}, arrowheadEnd:"arrow", color:"black"}. Colors must be named (not hex).'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_ADD_SHAPE, args)
    );

    server.tool(
        TOOL.WHITEBOARD_UPDATE_SHAPE,
        'Update properties of an existing shape on the whiteboard',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            shapeId: z.string().describe('ID of the shape to update'),
            props: z.record(z.string(), z.unknown()).describe('Properties to update on the shape'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_UPDATE_SHAPE, args)
    );

    server.tool(
        TOOL.WHITEBOARD_DELETE_SHAPE,
        'Remove a shape from the whiteboard by ID',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            shapeId: z.string().describe('ID of the shape to delete'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_DELETE_SHAPE, args)
    );

    server.tool(
        TOOL.WHITEBOARD_OPEN,
        'Open a .whiteboard.json file in the whiteboard viewer pane',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                .describe('Where to open the pane (default: right)'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_OPEN, args)
    );

    server.tool(
        TOOL.WHITEBOARD_CAMERA_SET,
        'Set the whiteboard canvas camera position and zoom level',
        {
            x: z.number().describe('Camera X offset'),
            y: z.number().describe('Camera Y offset'),
            zoom: z.number().min(0.01).describe('Zoom level (1.0 = 100%)'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_CAMERA_SET, args)
    );

    server.tool(
        TOOL.WHITEBOARD_CAMERA_FIT,
        'Fit the whiteboard camera to show all shapes (or specified shapes)',
        {
            shapeIds: z.array(z.string()).optional()
                .describe('Shape IDs to fit into view; omit to fit all shapes'),
            padding: z.number().optional().describe('Padding in pixels around the fitted area (default 40)'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_CAMERA_FIT, args)
    );

    server.tool(
        TOOL.WHITEBOARD_CAMERA_GET,
        'Get the current whiteboard camera position and zoom level',
        {},
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_CAMERA_GET, args)
    );

    server.tool(
        TOOL.WHITEBOARD_BATCH_ADD_SHAPES,
        'Add multiple shapes to a whiteboard in a single call. Much faster than calling add_shape N times. ' +
        'Each shape follows the same rules as add_shape: type must be "geo"|"text"|"arrow"|"note". ' +
        'Colors must be tldraw named colors (black/grey/white/red/light-red/orange/yellow/green/light-green/blue/light-blue/violet/light-violet). ' +
        'Use props.richText for labels: {type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"label"}]}]}. ' +
        'Arrow shapes use props.start/end instead of width/height.',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            shapes: z.array(z.object({
                type: z.string().describe('tldraw shape type: "geo" | "text" | "arrow" | "note"'),
                x: z.number().describe('X position'),
                y: z.number().describe('Y position'),
                width: z.number().optional().describe('Width (not used for arrow or text)'),
                height: z.number().optional().describe('Height (not used for arrow or text)'),
                props: z.record(z.string(), z.unknown()).optional().describe('Shape props (same as add_shape.props)'),
            })).describe('Array of shapes to add'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_BATCH_ADD_SHAPES, args)
    );

    server.tool(
        TOOL.WHITEBOARD_REPLACE,
        'Atomically clear all shapes from a whiteboard and replace with a new set. ' +
        'Use this for creating a new diagram or completely replacing an existing one. ' +
        'Much more efficient than delete_shape N times + add_shape N times. ' +
        'Shape rules are identical to batch_add_shapes.',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            shapes: z.array(z.object({
                type: z.string().describe('tldraw shape type: "geo" | "text" | "arrow" | "note"'),
                x: z.number().describe('X position'),
                y: z.number().describe('Y position'),
                width: z.number().optional(),
                height: z.number().optional(),
                props: z.record(z.string(), z.unknown()).optional(),
            })).describe('Complete set of shapes to place on the canvas after clearing'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_REPLACE, args)
    );

    server.tool(
        TOOL.WHITEBOARD_FIND_SHAPES,
        'Find shapes on a whiteboard by label text, type, or metadata tag. ' +
        'Returns compact shape summaries (id, type, position, size, label text). ' +
        'Use this instead of whiteboard.read when you only need to locate specific shapes, ' +
        'to avoid receiving the full tldraw store (which can be very large for complex diagrams).',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            label: z.string().optional().describe('Substring to match against shape text content (case-insensitive)'),
            type: z.string().optional().describe('Filter by tldraw shape type (geo, arrow, text, note)'),
            tag: z.string().optional().describe('Filter by metadata tag stored in shape.meta.tag'),
            limit: z.number().int().min(1).max(200).optional().describe('Max results to return (default: 50)'),
        },
        async (args: unknown) => deps.executeViaBridge(TOOL.WHITEBOARD_FIND_SHAPES, args)
    );
}
