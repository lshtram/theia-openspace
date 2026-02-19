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
import { ILogger } from '@theia/core/lib/common/logger';
import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { WhiteboardData, WhiteboardRecord } from './whiteboard-widget';
import { resolveContentPath } from 'openspace-core/lib/browser/resolve-content-path';
import { OpenspacePreferences } from 'openspace-settings/lib/browser/openspace-preferences';

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

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(PreferenceService)
    protected readonly preferenceService!: PreferenceService;

    /**
     * Get the file extension for whiteboard files.
     */
    getFileExtension(): string {
        return WHITEBOARD_EXTENSION;
    }

    /**
     * List all whiteboard files in the workspace.
     * Recursively scans workspace roots for .whiteboard.json files.
     * @returns Array of whiteboard file paths
     */
    async listWhiteboards(): Promise<string[]> {
        const roots = this.workspaceService.tryGetRoots();
        if (!roots.length) {
            this.logger.warn('[WhiteboardService] No workspace open');
            return [];
        }
        const results: string[] = [];
        for (const root of roots) {
            await this.scanWhiteboardDir(root.resource, results);
        }
        return results;
    }

    private async scanWhiteboardDir(uri: URI, results: string[]): Promise<void> {
        try {
            const stat = await this.fileService.resolve(uri);
            if (!stat.isDirectory) { return; }
            for (const child of (stat.children ?? [])) {
                if (child.isDirectory) {
                    const name = child.resource.path.base;
                    if (!name.startsWith('.') && name !== 'node_modules') {
                        await this.scanWhiteboardDir(child.resource, results);
                    }
                } else if (child.resource.path.base.endsWith(WHITEBOARD_EXTENSION)) {
                    results.push(child.resource.toString());
                }
            }
        } catch {
            // ignore unreadable directories
        }
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
    async createWhiteboard(path: string, _title?: string): Promise<string> {
        // Resolve to a full URI using the configured default folder
        const roots = this.workspaceService.tryGetRoots();
        const workspaceRoot = roots[0]?.resource.toString() ?? 'file:///';
        const configuredFolder = this.preferenceService.get<string>(
            OpenspacePreferences.WHITEBOARDS_PATH,
            'openspace/whiteboards'
        );

        const resolvedUri = resolveContentPath(path, configuredFolder, workspaceRoot, WHITEBOARD_EXTENSION);
        const uri = new URI(resolvedUri);

        // Auto-create parent folder if it doesn't exist
        const parentUri = uri.parent;
        const parentExists = await this.fileService.exists(parentUri);
        if (!parentExists) {
            await this.fileService.createFolder(parentUri);
            this.logger.info('[WhiteboardService] Created folder:', parentUri.toString());
        }

        // Create with minimal empty snapshot
        const emptySnapshot: WhiteboardData = {
            store: {} as Record<string, unknown>,
            schema: { schemaVersion: 2, sequences: {} }
        } as unknown as WhiteboardData;

        const content = JSON.stringify(emptySnapshot, null, 2);
        await this.fileService.create(uri, content);

        this.logger.info('[WhiteboardService] Created whiteboard:', resolvedUri);
        return resolvedUri;
    }

    /**
     * Add a shape to a whiteboard.
     * Shapes are added directly to the native TLStoreSnapshot format.
     * @param path The file path
     * @param shape The shape record to add (must be a valid tldraw shape record)
     * @returns The updated whiteboard data
     */
    async addShape(path: string, shape: WhiteboardRecord): Promise<WhiteboardData> {
        const { data } = await this.readWhiteboard(path);
        
        // Add shape to the store dict (native TLStoreSnapshot format)
        const store = (data.store ?? {}) as Record<string, unknown>;
        store[shape.id] = shape;
        const updatedData = { ...data, store } as unknown as WhiteboardData;
        
        // Save to file
        const uri = new URI(path);
        await this.fileService.write(uri, JSON.stringify(updatedData, null, 2));
        
        this.logger.info('[WhiteboardService] Added shape:', shape.id, 'to', path);
        return updatedData;
    }

    /**
     * Update a shape in a whiteboard.
     */
    async updateShape(path: string, shapeId: string, props: Partial<WhiteboardRecord>): Promise<WhiteboardData> {
        const { data } = await this.readWhiteboard(path);
        
        const store = (data.store ?? {}) as Record<string, unknown>;
        const existing = store[shapeId] as WhiteboardRecord | undefined;
        if (existing) {
            store[shapeId] = { ...existing, ...props };
        }
        const updatedData = { ...data, store } as unknown as WhiteboardData;
        
        // Save to file
        const uri = new URI(path);
        await this.fileService.write(uri, JSON.stringify(updatedData, null, 2));
        
        this.logger.info('[WhiteboardService] Updated shape:', shapeId, 'in', path);
        return updatedData;
    }

    /**
     * Delete a shape from a whiteboard.
     */
    async deleteShape(path: string, shapeId: string): Promise<WhiteboardData> {
        const { data } = await this.readWhiteboard(path);
        
        const store = { ...(data.store ?? {}) } as Record<string, unknown>;
        delete store[shapeId];
        const updatedData = { ...data, store } as unknown as WhiteboardData;
        
        // Save to file
        const uri = new URI(path);
        await this.fileService.write(uri, JSON.stringify(updatedData, null, 2));
        
        this.logger.info('[WhiteboardService] Deleted shape:', shapeId, 'from', path);
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

export interface WhiteboardBatchAddShapesArgs {
    path: string;
    shapes: Array<{
        type: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        props?: Record<string, unknown>;
    }>;
}

export interface WhiteboardReplaceArgs {
    path: string;
    shapes: Array<{
        type: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        props?: Record<string, unknown>;
    }>;
}

export interface WhiteboardFindShapesArgs {
    path: string;
    label?: string;
    type?: string;
    tag?: string;
    limit?: number;
}
