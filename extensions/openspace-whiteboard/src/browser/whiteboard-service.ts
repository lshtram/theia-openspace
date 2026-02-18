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
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { WhiteboardData, WhiteboardRecord, WhiteboardUtils } from './whiteboard-widget';

/**
 * File extension for whiteboard files.
 */
const WHITEBOARD_EXTENSION = '.whiteboard.json';

/**
 * Whiteboard service for managing whiteboard files and shape operations.
 * Provides CRUD operations for .whiteboard.json files and shape management.
 */
@injectable()
export class WhiteboardService {

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    /**
     * Get the file extension for whiteboard files.
     */
    getFileExtension(): string {
        return WHITEBOARD_EXTENSION;
    }

    /**
     * List all whiteboard files in the workspace.
     * Returns the workspace root path - actual listing would be done via search.
     * @returns Array of whiteboard file paths
     */
    async listWhiteboards(): Promise<string[]> {
        const workspaceRoot = this.workspaceService.workspace;
        if (!workspaceRoot) {
            console.warn('[WhiteboardService] No workspace open');
            return [];
        }

        // Return the workspace root for search-based listing
        return [workspaceRoot.resource.toString()];
    }

    /**
     * Read a whiteboard file and return its content.
     * @param path The file path to read
     * @returns The whiteboard content and parsed data
     */
    async readWhiteboard(path: string): Promise<{ content: string; data: WhiteboardData }> {
        const uri = new URI(path);
        const contentResult = await this.fileService.read(uri);
        const content = contentResult.value;
        
        const data = JSON.parse(content) as WhiteboardData;
        
        return { content, data };
    }

    /**
     * Create a new whiteboard file.
     * @param path The file path for the new whiteboard
     * @param title Optional title for the whiteboard
     * @returns The created file path
     */
    async createWhiteboard(path: string, title?: string): Promise<string> {
        // Ensure path has correct extension
        let finalPath = path;
        if (!finalPath.endsWith(WHITEBOARD_EXTENSION)) {
            finalPath = `${path}${WHITEBOARD_EXTENSION}`;
        }

        const uri = new URI(finalPath);
        const data = WhiteboardUtils.createEmpty();
        
        // Add title if provided
        if (title) {
            data.records.push({
                id: 'title',
                type: 'text',
                text: title,
                x: 50,
                y: 50
            });
        }
        
        const content = JSON.stringify(data, null, 2);
        
        await this.fileService.create(uri, content);
        
        console.log('[WhiteboardService] Created whiteboard:', finalPath);
        return finalPath;
    }

    /**
     * Add a shape to a whiteboard.
     * @param path The file path
     * @param shape The shape to add
     * @returns The updated whiteboard data
     */
    async addShape(path: string, shape: WhiteboardRecord): Promise<WhiteboardData> {
        const { data } = await this.readWhiteboard(path);
        
        const updatedData = WhiteboardUtils.addShape(data, shape);
        
        // Save to file
        const uri = new URI(path);
        await this.fileService.write(uri, JSON.stringify(updatedData, null, 2));
        
        console.log('[WhiteboardService] Added shape:', shape.id, 'to', path);
        return updatedData;
    }

    /**
     * Update a shape in a whiteboard.
     * @param path The file path
     * @param shapeId The shape ID to update
     * @param props The properties to update
     * @returns The updated whiteboard data
     */
    async updateShape(path: string, shapeId: string, props: Partial<WhiteboardRecord>): Promise<WhiteboardData> {
        const { data } = await this.readWhiteboard(path);
        
        const updatedData = WhiteboardUtils.updateShape(data, shapeId, props);
        
        // Save to file
        const uri = new URI(path);
        await this.fileService.write(uri, JSON.stringify(updatedData, null, 2));
        
        console.log('[WhiteboardService] Updated shape:', shapeId, 'in', path);
        return updatedData;
    }

    /**
     * Delete a shape from a whiteboard.
     * @param path The file path
     * @param shapeId The shape ID to delete
     * @returns The updated whiteboard data
     */
    async deleteShape(path: string, shapeId: string): Promise<WhiteboardData> {
        const { data } = await this.readWhiteboard(path);
        
        const updatedData = WhiteboardUtils.removeShape(data, shapeId);
        
        // Save to file
        const uri = new URI(path);
        await this.fileService.write(uri, JSON.stringify(updatedData, null, 2));
        
        console.log('[WhiteboardService] Deleted shape:', shapeId, 'from', path);
        return updatedData;
    }

    /**
     * Get the current active whiteboard path.
     */
    getActiveWhiteboard(): string | undefined {
        return this.activeWhiteboardPath;
    }

    /**
     * Set the active whiteboard path.
     */
    setActiveWhiteboard(path: string | undefined): void {
        this.activeWhiteboardPath = path;
    }

    /**
     * Current active whiteboard path.
     */
    protected activeWhiteboardPath?: string;
    
    /**
     * Camera state.
     */
    protected cameraState: CameraState = {
        x: 0,
        y: 0,
        zoom: 1
    };

    /**
     * Get the current camera state.
     */
    getCameraState(): CameraState {
        return this.cameraState;
    }

    /**
     * Set the camera state.
     */
    setCameraState(state: CameraState): void {
        this.cameraState = state;
    }
}

/**
 * Camera state for whiteboard.
 */
export interface CameraState {
    x: number;
    y: number;
    zoom: number;
}

/**
 * Argument types for whiteboard commands.
 */
export type WhiteboardListArgs = Record<string, never>;

export interface WhiteboardReadArgs {
    path: string;
}

export interface WhiteboardCreateArgs {
    path: string;
    title?: string;
}

export interface WhiteboardAddShapeArgs {
    path: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    props?: Record<string, unknown>;
}

export interface WhiteboardUpdateShapeArgs {
    path: string;
    shapeId: string;
    props: Record<string, unknown>;
}

export interface WhiteboardDeleteShapeArgs {
    path: string;
    shapeId: string;
}

export interface WhiteboardOpenArgs {
    path: string;
}

export interface WhiteboardCameraSetArgs {
    path?: string;
    x: number;
    y: number;
    zoom: number;
}

export interface WhiteboardCameraFitArgs {
    path?: string;
    shapeIds?: string[];
    padding?: number;
}

export interface WhiteboardCameraGetArgs {
    path?: string;
}
