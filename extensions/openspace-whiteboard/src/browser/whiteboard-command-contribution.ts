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

import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { ILogger } from '@theia/core/lib/common/logger';
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WidgetManager, ApplicationShell } from '@theia/core/lib/browser';
import { WhiteboardService, 
    WhiteboardListArgs, 
    WhiteboardReadArgs, 
    WhiteboardCreateArgs,
    WhiteboardAddShapeArgs,
    WhiteboardUpdateShapeArgs,
    WhiteboardDeleteShapeArgs,
    WhiteboardOpenArgs,
    WhiteboardCameraSetArgs,
    WhiteboardCameraFitArgs,
    WhiteboardCameraGetArgs,
    WhiteboardBatchAddShapesArgs,
    WhiteboardReplaceArgs,
    WhiteboardFindShapesArgs
} from './whiteboard-service';
import { WhiteboardWidget } from './whiteboard-widget';

/**
 * Command IDs for whiteboard commands.
 * These are used for manifest generation (argument schemas stored separately).
 */
export const WhiteboardCommandIds = {
    LIST: 'openspace.whiteboard.list',
    READ: 'openspace.whiteboard.read',
    CREATE: 'openspace.whiteboard.create',
    ADD_SHAPE: 'openspace.whiteboard.add_shape',
    UPDATE_SHAPE: 'openspace.whiteboard.update_shape',
    DELETE_SHAPE: 'openspace.whiteboard.delete_shape',
    OPEN: 'openspace.whiteboard.open',
    CAMERA_SET: 'openspace.whiteboard.camera.set',
    CAMERA_FIT: 'openspace.whiteboard.camera.fit',
    CAMERA_GET: 'openspace.whiteboard.camera.get',
    BATCH_ADD_SHAPES: 'openspace.whiteboard.batch_add_shapes',
    REPLACE: 'openspace.whiteboard.replace',
    FIND_SHAPES: 'openspace.whiteboard.find_shapes',
} as const;

/**
 * Argument schemas for whiteboard commands.
 * Used for manifest auto-generation in Phase 3.
 */
export const WhiteboardArgumentSchemas = {
    list: {
        type: 'object',
        properties: {},
        additionalProperties: false
    },
    read: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the whiteboard file'
            }
        },
        required: ['path'],
        additionalProperties: false
    },
    create: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path for the new whiteboard file'
            },
            title: {
                type: 'string',
                description: 'Optional title for the whiteboard'
            }
        },
        required: ['path'],
        additionalProperties: false
    },
    add_shape: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the whiteboard file'
            },
            type: {
                type: 'string',
                description: 'tldraw shape type. Use "geo" for rectangles/ellipses/diamonds (set props.geo), "text" for standalone text, "arrow" for directed arrows, "note" for sticky notes. Do NOT use "rectangle" or "ellipse" directly.'
            },
            x: {
                type: 'number',
                description: 'X position of the shape on the canvas'
            },
            y: {
                type: 'number',
                description: 'Y position of the shape on the canvas'
            },
            width: {
                type: 'number',
                description: 'Width of the shape in pixels (not used for arrow shapes)'
            },
            height: {
                type: 'number',
                description: 'Height of the shape in pixels (not used for arrow shapes)'
            },
            props: {
                type: 'object',
                description: 'Shape-specific props. For geo: { geo: "rectangle"|"ellipse"|"diamond", color: "blue"|"red"|"green"|"yellow"|"orange"|"violet"|"grey"|"black"|"white", fill: "none"|"semi"|"solid", richText: {type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"label"}]}]} }. For arrow: { start: {x:0,y:0}, end: {x:100,y:100}, arrowheadEnd: "arrow", color: "black" }. For text: { richText: ..., color: "black", size: "m" }. Colors must be tldraw named colors, not hex values.'
            }
        },
        required: ['path', 'type', 'x', 'y'],
        additionalProperties: false
    },
    update_shape: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the whiteboard file'
            },
            shapeId: {
                type: 'string',
                description: 'ID of the shape to update'
            },
            props: {
                type: 'object',
                description: 'Properties to update'
            }
        },
        required: ['path', 'shapeId', 'props'],
        additionalProperties: false
    },
    delete_shape: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the whiteboard file'
            },
            shapeId: {
                type: 'string',
                description: 'ID of the shape to delete'
            }
        },
        required: ['path', 'shapeId'],
        additionalProperties: false
    },
    open: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the whiteboard file'
            }
        },
        required: ['path'],
        additionalProperties: false
    },
    camera_set: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional path to whiteboard file'
            },
            x: {
                type: 'number',
                description: 'Camera X position'
            },
            y: {
                type: 'number',
                description: 'Camera Y position'
            },
            zoom: {
                type: 'number',
                description: 'Camera zoom level'
            }
        },
        required: ['x', 'y', 'zoom'],
        additionalProperties: false
    },
    camera_fit: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional path to whiteboard file'
            },
            shapeIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of shape IDs to fit'
            },
            padding: {
                type: 'number',
                description: 'Padding around shapes'
            }
        },
        additionalProperties: false
    },
    camera_get: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional path to whiteboard file'
            }
        },
        additionalProperties: false
    },
    batch_add_shapes: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Path to the whiteboard file' },
            shapes: {
                type: 'array',
                description: 'Array of shapes to add',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' },
                        props: { type: 'object' }
                    },
                    required: ['type', 'x', 'y']
                }
            }
        },
        required: ['path', 'shapes'],
        additionalProperties: false
    },
    replace: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Path to the whiteboard file' },
            shapes: {
                type: 'array',
                description: 'Shapes to place after clearing the canvas',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        width: { type: 'number' },
                        height: { type: 'number' },
                        props: { type: 'object' }
                    },
                    required: ['type', 'x', 'y']
                }
            }
        },
        required: ['path', 'shapes'],
        additionalProperties: false
    },
    find_shapes: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Path to the whiteboard file' },
            label: { type: 'string', description: 'Substring to match against shape text labels' },
            type: { type: 'string', description: 'Filter by tldraw shape type (geo, arrow, text, note)' },
            tag: { type: 'string', description: 'Filter by shapes with this metadata tag' },
            limit: { type: 'number', description: 'Max results (default: 50)' }
        },
        required: ['path'],
        additionalProperties: false
    }
};

/**
 * Command contribution for whiteboard commands.
 * Registers all openspace.whiteboard.* commands in Theia's CommandRegistry.
 */
@injectable()
export class WhiteboardCommandContribution implements CommandContribution {

    @inject(WhiteboardService)
    protected readonly whiteboardService!: WhiteboardService;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    /**
     * Register all whiteboard commands.
     */
    registerCommands(registry: CommandRegistry): void {
        // openspace.whiteboard.list
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.LIST,
                label: 'OpenSpace: List Whiteboards'
            },
            {
                execute: async (args?: WhiteboardListArgs) => {
                    this.logger.info('[WhiteboardCommand] Listing whiteboards');
                    return this.whiteboardService.listWhiteboards();
                }
            }
        );

        // openspace.whiteboard.read
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.READ,
                label: 'OpenSpace: Read Whiteboard'
            },
            {
                execute: async (args: WhiteboardReadArgs) => {
                    this.logger.info('[WhiteboardCommand] Reading whiteboard:', args.path);
                    return this.whiteboardService.readWhiteboard(args.path);
                }
            }
        );

        // openspace.whiteboard.create
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.CREATE,
                label: 'OpenSpace: Create Whiteboard'
            },
            {
                execute: async (args: WhiteboardCreateArgs) => {
                    this.logger.info('[WhiteboardCommand] Creating whiteboard:', args.path);
                    return this.whiteboardService.createWhiteboard(args.path, args.title);
                }
            }
        );

        // openspace.whiteboard.add_shape
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.ADD_SHAPE,
                label: 'OpenSpace: Add Shape to Whiteboard'
            },
            {
                execute: async (args: WhiteboardAddShapeArgs) => {
                    this.logger.info('[WhiteboardCommand] Adding shape to whiteboard:', args.path);
                    return this.addShapeViaEditor(args);
                }
            }
        );

        // openspace.whiteboard.update_shape
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.UPDATE_SHAPE,
                label: 'OpenSpace: Update Shape in Whiteboard'
            },
            {
                execute: async (args: WhiteboardUpdateShapeArgs) => {
                    this.logger.info('[WhiteboardCommand] Updating shape:', args.shapeId, 'in whiteboard:', args.path);
                    return this.updateShapeViaEditor(args);
                }
            }
        );

        // openspace.whiteboard.delete_shape
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.DELETE_SHAPE,
                label: 'OpenSpace: Delete Shape from Whiteboard'
            },
            {
                execute: async (args: WhiteboardDeleteShapeArgs) => {
                    this.logger.info('[WhiteboardCommand] Deleting shape:', args.shapeId, 'from whiteboard:', args.path);
                    return this.deleteShapeViaEditor(args);
                }
            }
        );

        // openspace.whiteboard.open
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.OPEN,
                label: 'OpenSpace: Open Whiteboard'
            },
            {
                execute: async (args?: WhiteboardOpenArgs) => {
                    if (args?.path) {
                        this.logger.info('[WhiteboardCommand] Opening whiteboard:', args.path);
                        return this.openWhiteboard(args.path);
                    }
                    // No path provided (e.g. command palette) — open empty whiteboard
                    this.logger.info('[WhiteboardCommand] Opening blank whiteboard');
                    return this.openBlankWhiteboard();
                }
            }
        );

        // openspace.whiteboard.camera.set
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.CAMERA_SET,
                label: 'OpenSpace: Set Whiteboard Camera'
            },
            {
                execute: async (args: WhiteboardCameraSetArgs) => {
                    this.logger.info('[WhiteboardCommand] Setting camera:', String(args));
                    return this.setCamera(args);
                }
            }
        );

        // openspace.whiteboard.camera.fit
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.CAMERA_FIT,
                label: 'OpenSpace: Fit Whiteboard Camera'
            },
            {
                execute: async (args: WhiteboardCameraFitArgs) => {
                    this.logger.info('[WhiteboardCommand] Fitting camera:', String(args));
                    return this.fitCamera(args);
                }
            }
        );

        // openspace.whiteboard.camera.get
        registry.registerCommand(
            { 
                id: WhiteboardCommandIds.CAMERA_GET,
                label: 'OpenSpace: Get Whiteboard Camera'
            },
            {
                execute: async (args?: WhiteboardCameraGetArgs) => {
                    this.logger.info('[WhiteboardCommand] Getting camera state');
                    return this.getCamera(args);
                }
            }
        );

        // openspace.whiteboard.batch_add_shapes
        registry.registerCommand(
            {
                id: WhiteboardCommandIds.BATCH_ADD_SHAPES,
                label: 'OpenSpace: Batch Add Shapes to Whiteboard'
            },
            {
                execute: async (args: WhiteboardBatchAddShapesArgs) => {
                    this.logger.info('[WhiteboardCommand] Batch adding', args.shapes?.length, 'shapes to:', args.path);
                    return this.batchAddShapesViaEditor(args);
                }
            }
        );

        // openspace.whiteboard.replace
        registry.registerCommand(
            {
                id: WhiteboardCommandIds.REPLACE,
                label: 'OpenSpace: Replace Whiteboard Content'
            },
            {
                execute: async (args: WhiteboardReplaceArgs) => {
                    this.logger.info('[WhiteboardCommand] Replacing whiteboard content:', args.path, 'with', args.shapes?.length, 'shapes');
                    return this.replaceViaEditor(args);
                }
            }
        );

        // openspace.whiteboard.find_shapes
        registry.registerCommand(
            {
                id: WhiteboardCommandIds.FIND_SHAPES,
                label: 'OpenSpace: Find Shapes in Whiteboard'
            },
            {
                execute: async (args: WhiteboardFindShapesArgs) => {
                    this.logger.info('[WhiteboardCommand] Finding shapes in:', args.path);
                    return this.findShapesViaEditor(args);
                }
            }
        );
    }

    /**
     * Open a blank whiteboard (no file backing) — useful for quick access from command palette.
     */
    protected async openBlankWhiteboard(): Promise<{ success: boolean; uri: string }> {
        const widget = await this.widgetManager.getOrCreateWidget(
            WhiteboardWidget.ID,
            { uri: '__blank__' }
        ) as WhiteboardWidget;
        if (!widget.isAttached) {
            this.shell.addWidget(widget, { area: 'main' });
        }
        this.shell.activateWidget(widget.id);
        return { success: true, uri: '__blank__' };
    }

    /**
     * Open a blank whiteboard (no file backing) — useful for quick access from command palette.
     */
    protected async openBlankWhiteboard(): Promise<WhiteboardWidget> {
        const widget = await this.widgetManager.getOrCreateWidget(
            WhiteboardWidget.ID,
            { uri: '__blank__' }
        ) as WhiteboardWidget;
        if (!widget.isAttached) {
            this.shell.addWidget(widget, { area: 'main' });
        }
        this.shell.activateWidget(widget.id);
        return widget;
    }

    /**
     * Open a whiteboard in a widget.
     */
    protected async openWhiteboard(path: string): Promise<{ success: boolean; path: string }> {
        const uri = path.startsWith('file://') ? new URI(path) : URI.fromFilePath(path);
        
        // Read file content
        const contentResult = await this.fileService.read(uri);
        const content = contentResult.value;

        // Get or create widget
        const widget = await this.widgetManager.getOrCreateWidget(
            WhiteboardWidget.ID,
            { uri: path }
        ) as WhiteboardWidget;

        // Load content
        widget.loadFromJson(content);
        widget.setFilePath(uri.toString());
        
        // Add to shell if not already attached, then activate
        if (!widget.isAttached) {
            this.shell.addWidget(widget, { area: 'main' });
        }
        this.shell.activateWidget(widget.id);

        // Update service state
        this.whiteboardService.setActiveWhiteboard(path);

        // Return a plain serializable result (not the widget object, which cannot be JSON-serialised)
        return { success: true, path };
    }

    /**
     * Set camera position and zoom.
     */
    protected async setCamera(args: WhiteboardCameraSetArgs): Promise<void> {
        this.whiteboardService.setCameraState({
            x: args.x,
            y: args.y,
            zoom: args.zoom
        });
    }

    /**
     * Fit camera to shapes or entire canvas.
     */
    protected async fitCamera(args: WhiteboardCameraFitArgs): Promise<void> {
        // Get the current whiteboard data
        const activePath = args.path || this.whiteboardService.getActiveWhiteboard();
        if (!activePath) {
            this.logger.warn('[WhiteboardCommand] No active whiteboard for camera fit');
            return;
        }

        const { data } = await this.whiteboardService.readWhiteboard(activePath);
        
        // Get shape records from the native TLStoreSnapshot format.
        // The store is a dict keyed by record ID; filter to only 'shape' records.
        const allRecords = Object.values(data.store ?? {}) as unknown as Array<Record<string, unknown>>;
        const shapeRecords = allRecords.filter(r => r['typeName'] === 'shape');

        if (shapeRecords.length === 0) {
            // Reset to default if no shapes
            this.whiteboardService.setCameraState({ x: 0, y: 0, zoom: 1 });
            return;
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const record of shapeRecords) {
            const x = (record['x'] as number) || 0;
            const y = (record['y'] as number) || 0;
            const props = (record['props'] as Record<string, unknown>) ?? {};
            const w = (props['w'] as number) || (record['width'] as number) || 100;
            const h = (props['h'] as number) || (record['height'] as number) || 100;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        }

        const padding = args.padding || 50;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Calculate zoom to fit
        const boundsWidth = maxX - minX + padding * 2;
        const boundsHeight = maxY - minY + padding * 2;
        const zoom = Math.min(1, Math.min(800 / boundsWidth, 600 / boundsHeight));

        this.whiteboardService.setCameraState({
            x: centerX,
            y: centerY,
            zoom
        });
    }

    /**
     * Get current camera state.
     */
    protected async getCamera(args?: WhiteboardCameraGetArgs): Promise<{ x: number; y: number; zoom: number }> {
        return this.whiteboardService.getCameraState();
    }

    /**
     * Find the active whiteboard widget (the one whose file path matches, or the most recently activated one).
     */
    protected getActiveWidget(path?: string): WhiteboardWidget | undefined {
        const widgets = this.widgetManager.getWidgets(WhiteboardWidget.ID) as WhiteboardWidget[];
        if (path) {
            const match = widgets.find(w => w.getFilePath() === path || w.uri === path);
            if (match) return match;
        }
        // Fall back to the currently active whiteboard widget in the shell
        const active = this.shell.activeWidget;
        if (active instanceof WhiteboardWidget) return active;
        // Fall back to any widget that is ready
        return widgets.find(w => w.isEditorReady());
    }

    /**
     * tldraw only accepts named colours for shape props.color.
     * This maps any CSS hex colour (or any string) to the nearest tldraw colour
     * by computing Euclidean distance in RGB space.
     */
    private toTldrawColor(input: string): string {
        const TLDRAW_COLORS: Record<string, [number, number, number]> = {
            'black':       [  0,   0,   0],
            'grey':        [145, 145, 145],
            'white':       [255, 255, 255],
            'red':         [231,  45,  45],
            'light-red':   [255, 153, 153],
            'orange':      [255, 160,   0],
            'yellow':      [255, 225,   0],
            'green':       [  0, 180,  80],
            'light-green': [153, 225, 153],
            'blue':        [ 67, 101, 255],
            'light-blue':  [153, 204, 255],
            'violet':      [111,  45, 189],
            'light-violet':[200, 153, 255],
        };
        // If already a valid tldraw colour name, pass through.
        if (Object.prototype.hasOwnProperty.call(TLDRAW_COLORS, input)) {
            return input;
        }
        // Parse hex (#RGB or #RRGGBB).
        const hex = input.replace(/^#/, '');
        let r: number, g: number, b: number;
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        } else {
            return 'black'; // unparseable — fall back
        }
        let best = 'black';
        let bestDist = Infinity;
        for (const [name, [cr, cg, cb]] of Object.entries(TLDRAW_COLORS)) {
            const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
            if (dist < bestDist) { bestDist = dist; best = name; }
        }
        return best;
    }

    /**
     * Sanitise shape props for a given tldraw shape type:
     * - Maps hex/unknown colours to tldraw named colours.
     * - Converts plain `text` strings to the `richText` ProseMirror doc format
     *   used by all tldraw 4.x shape types (geo, text, note, frame, etc.).
     */
    private sanitizeProps(props: Record<string, unknown>, _shapeType?: string): Record<string, unknown> {
        const out = { ...props };

        // Colour normalisation
        if (typeof out['color'] === 'string') {
            out['color'] = this.toTldrawColor(out['color'] as string);
        }
        if (typeof out['labelColor'] === 'string') {
            out['labelColor'] = this.toTldrawColor(out['labelColor'] as string);
        }

        // tldraw 4.x uses richText (ProseMirror doc) for all text content.
        // Convert a plain `text` string and remove the now-invalid key.
        if (typeof out['text'] === 'string') {
            const textContent = out['text'] as string;
            delete out['text'];
            if (textContent) {
                out['richText'] = {
                    type: 'doc',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: textContent }] }]
                };
            }
        }

        return out;
    }

    /**
     * Add a shape via the live tldraw editor.
     * Builds a valid tldraw TLShapePartial from the args and calls editor.createShape().
     */
    protected async addShapeViaEditor(args: WhiteboardAddShapeArgs): Promise<{ success: boolean; shapeId: string; path: string }> {
        const widget = this.getActiveWidget(args.path);
        if (!widget || !widget.isEditorReady()) {
            throw new Error(`No active whiteboard editor for path: ${args.path}`);
        }

        // Build a tldraw-compatible TLShapePartial.
        // tldraw shape types: 'geo' (rectangle/ellipse/diamond/…), 'text', 'note', 'arrow', 'draw', 'frame'
        // For geo shapes the sub-type (rectangle/ellipse/diamond) goes in props.geo.
        // Arrow shapes do NOT accept w/h — they use start/end point props instead.
        const shapeId = `shape:${Date.now()}`;
        const isArrow = args.type === 'arrow';
        const isText = args.type === 'text';
        let baseProps: Record<string, unknown>;
        if (isArrow) {
            baseProps = {};  // arrows: use start/end in props
        } else if (isText) {
            baseProps = { w: args.width ?? 200 };  // text: w only, no h (auto-sizes)
        } else {
            baseProps = { w: args.width ?? 200, h: args.height ?? 100 };
        }

        const shapePartial: Record<string, unknown> = {
            id: shapeId,
            type: args.type,          // 'geo', 'text', 'note', 'arrow', etc.
            x: args.x,
            y: args.y,
            props: {
                ...baseProps,
                ...this.sanitizeProps(args.props ?? {}, args.type)
            }
        };

        const createdId = widget.createShape(shapePartial);
        return { success: true, shapeId: createdId ?? shapeId, path: args.path };
    }

    /**
     * Update a shape via the live tldraw editor.
     */
    protected async updateShapeViaEditor(args: WhiteboardUpdateShapeArgs): Promise<{ success: boolean; shapeId: string; path: string }> {
        const widget = this.getActiveWidget(args.path);
        if (!widget || !widget.isEditorReady()) {
            throw new Error(`No active whiteboard editor for path: ${args.path}`);
        }
        const ok = widget.updateShapeById(args.shapeId, { type: undefined, ...this.sanitizeProps(args.props) });
        return { success: ok, shapeId: args.shapeId, path: args.path };
    }

    /**
     * Delete a shape via the live tldraw editor.
     */
    protected async deleteShapeViaEditor(args: WhiteboardDeleteShapeArgs): Promise<{ success: boolean; shapeId: string; path: string }> {
        const widget = this.getActiveWidget(args.path);
        if (!widget || !widget.isEditorReady()) {
            throw new Error(`No active whiteboard editor for path: ${args.path}`);
        }
        const ok = widget.deleteShapeById(args.shapeId);
        return { success: ok, shapeId: args.shapeId, path: args.path };
    }

    /**
     * Add multiple shapes to a whiteboard in one call.
     */
    protected async batchAddShapesViaEditor(args: WhiteboardBatchAddShapesArgs): Promise<{ success: boolean; shapeIds: string[]; path: string }> {
        const widget = this.getActiveWidget(args.path);
        if (!widget || !widget.isEditorReady()) {
            throw new Error(`No active whiteboard editor for path: ${args.path}`);
        }

        const shapePartials = args.shapes.map((s, i) => {
            const id = `shape:${Date.now()}-${i}`;
            const isArrow = s.type === 'arrow';
            const isText = s.type === 'text';
            let baseProps: Record<string, unknown>;
            if (isArrow) {
                baseProps = {};
            } else if (isText) {
                baseProps = { w: s.width ?? 200 };
            } else {
                baseProps = { w: s.width ?? 200, h: s.height ?? 100 };
            }
            return {
                id,
                type: s.type,
                x: s.x,
                y: s.y,
                props: { ...baseProps, ...this.sanitizeProps(s.props ?? {}, s.type) }
            };
        });

        const shapeIds = widget.batchCreateShapes(shapePartials);
        return { success: true, shapeIds, path: args.path };
    }

    /**
     * Replace all shapes on a whiteboard (clear + batch add) atomically.
     */
    protected async replaceViaEditor(args: WhiteboardReplaceArgs): Promise<{ success: boolean; shapeIds: string[]; clearedCount: number; path: string }> {
        const widget = this.getActiveWidget(args.path);
        if (!widget || !widget.isEditorReady()) {
            throw new Error(`No active whiteboard editor for path: ${args.path}`);
        }

        const shapePartials = args.shapes.map((s, i) => {
            const id = `shape:${Date.now()}-${i}`;
            const isArrow = s.type === 'arrow';
            const isText = s.type === 'text';
            let baseProps: Record<string, unknown>;
            if (isArrow) {
                baseProps = {};
            } else if (isText) {
                baseProps = { w: s.width ?? 200 };
            } else {
                baseProps = { w: s.width ?? 200, h: s.height ?? 100 };
            }
            return {
                id,
                type: s.type,
                x: s.x,
                y: s.y,
                props: { ...baseProps, ...this.sanitizeProps(s.props ?? {}, s.type) }
            };
        });

        const { clearedCount, shapeIds } = widget.replaceAllShapes(shapePartials);
        return { success: true, shapeIds, clearedCount, path: args.path };
    }

    /**
     * Find shapes on a whiteboard, returning compact summaries.
     */
    protected async findShapesViaEditor(args: WhiteboardFindShapesArgs): Promise<{ success: boolean; shapes: unknown[]; path: string }> {
        const widget = this.getActiveWidget(args.path);
        if (!widget || !widget.isEditorReady()) {
            throw new Error(`No active whiteboard editor for path: ${args.path}`);
        }

        const shapes = widget.findShapes({
            label: args.label,
            type: args.type,
            tag: args.tag,
            limit: args.limit,
        });
        return { success: true, shapes, path: args.path };
    }
}
