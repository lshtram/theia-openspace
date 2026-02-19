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
import { WidgetManager } from '@theia/core/lib/browser';
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
    WhiteboardCameraGetArgs
} from './whiteboard-service';
import { WhiteboardWidget, WhiteboardRecord } from './whiteboard-widget';

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
                description: 'Type of shape (rectangle, ellipse, arrow, text, etc.)'
            },
            x: {
                type: 'number',
                description: 'X position of the shape'
            },
            y: {
                type: 'number',
                description: 'Y position of the shape'
            },
            width: {
                type: 'number',
                description: 'Width of the shape'
            },
            height: {
                type: 'number',
                description: 'Height of the shape'
            },
            props: {
                type: 'object',
                description: 'Additional shape properties'
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
                    const shape: WhiteboardRecord = {
                        id: `shape-${Date.now()}`,
                        type: args.type,
                        x: args.x,
                        y: args.y,
                        width: args.width,
                        height: args.height,
                        ...args.props
                    };
                    return this.whiteboardService.addShape(args.path, shape);
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
                    return this.whiteboardService.updateShape(args.path, args.shapeId, args.props);
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
                    return this.whiteboardService.deleteShape(args.path, args.shapeId);
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
                execute: async (args: WhiteboardOpenArgs) => {
                    this.logger.info('[WhiteboardCommand] Opening whiteboard:', args.path);
                    return this.openWhiteboard(args.path);
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
    }

    /**
     * Open a whiteboard in a widget.
     */
    protected async openWhiteboard(path: string): Promise<WhiteboardWidget> {
        const uri = new URI(path);
        
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
        widget.setFilePath(path);
        
        // Activate the widget
        widget.activate();

        // Update service state
        this.whiteboardService.setActiveWhiteboard(path);

        return widget;
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
        
        if (data.records.length === 0) {
            // Reset to default if no shapes
            this.whiteboardService.setCameraState({ x: 0, y: 0, zoom: 1 });
            return;
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const record of data.records) {
            const x = (record.x as number) || 0;
            const y = (record.y as number) || 0;
            const w = (record.width as number) || 100;
            const h = (record.height as number) || 100;
            
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
}
