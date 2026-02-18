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

import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { EditorManager, EditorOpenerOptions } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { URI } from '@theia/core/lib/common/uri';
import * as monaco from '@theia/monaco-editor-core';
import { Position, EditorWidget } from '@theia/editor/lib/browser';
import * as path from 'path';
import { isSensitiveFile } from '../common/sensitive-files';
import { OpenCodeService } from '../common/opencode-protocol';

/**
 * Range interface for highlighting code regions.
 */
export interface Range {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
}

/**
 * Tracked highlight for cleanup (GAP-4).
 */
export interface TrackedHighlight {
    id: string;
    editorId: string;
    decorationIds: string[];
    createdAt: Date;
}

/**
 * Arguments for openspace.editor.open command.
 */
export interface EditorOpenArgs {
    path: string;
    line?: number;
    column?: number;
    highlight?: boolean;
}

/**
 * Arguments for openspace.editor.scroll_to command.
 */
export interface EditorScrollArgs {
    path?: string;
    line: number;
}

/**
 * Arguments for openspace.editor.highlight command.
 */
export interface EditorHighlightArgs {
    path?: string;
    ranges: Range[];
    highlightId?: string;
    color?: string;
}

/**
 * Arguments for openspace.editor.clear_highlight command.
 */
export interface EditorClearHighlightArgs {
    highlightId: string;
}

/**
 * Arguments for openspace.editor.read_file command.
 */
export interface EditorReadFileArgs {
    path?: string;
}

/**
 * Arguments for openspace.editor.close command.
 */
export interface EditorCloseArgs {
    path?: string;
}

/**
 * JSON Schema for openspace.editor.open command arguments.
 */
export const EDITOR_OPEN_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'File path to open (relative to workspace)'
        },
        line: {
            type: 'number',
            description: 'Line number to open cursor at'
        },
        column: {
            type: 'number',
            description: 'Column number to position cursor'
        },
        highlight: {
            type: 'boolean',
            description: 'Whether to highlight the opened file'
        }
    },
    required: ['path']
};

/**
 * JSON Schema for openspace.editor.scroll_to command arguments.
 */
export const EDITOR_SCROLL_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'File path to scroll to'
        },
        line: {
            type: 'number',
            description: 'Line number to scroll to'
        }
    },
    required: ['path', 'line']
};

/**
 * JSON Schema for openspace.editor.highlight command arguments.
 */
export const EDITOR_HIGHLIGHT_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'File path to highlight'
        },
        ranges: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    startLine: { type: 'number' },
                    endLine: { type: 'number' },
                    startColumn: { type: 'number' },
                    endColumn: { type: 'number' }
                },
                required: ['startLine', 'endLine']
            },
            description: 'Array of ranges to highlight'
        },
        highlightId: {
            type: 'string',
            description: 'Optional custom highlight ID'
        },
        color: {
            type: 'string',
            description: 'Highlight color (hex or CSS color)'
        }
    },
    required: ['path', 'ranges']
};

/**
 * JSON Schema for openspace.editor.clear_highlight command arguments.
 */
export const EDITOR_CLEAR_HIGHLIGHT_SCHEMA = {
    type: 'object',
    properties: {
        highlightId: {
            type: 'string',
            description: 'ID of the highlight to clear'
        }
    },
    required: ['highlightId']
};

/**
 * JSON Schema for openspace.editor.read_file command arguments.
 */
export const EDITOR_READ_FILE_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'File path to read (relative to workspace)'
        }
    },
    required: ['path']
};

/**
 * JSON Schema for openspace.editor.close command arguments.
 */
export const EDITOR_CLOSE_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'File path to close'
        }
    },
    required: ['path']
};

/**
 * Command IDs for editor operations.
 */
export const EditorCommands = {
    OPEN: 'openspace.editor.open',
    SCROLL_TO: 'openspace.editor.scroll_to',
    HIGHLIGHT: 'openspace.editor.highlight',
    CLEAR_HIGHLIGHT: 'openspace.editor.clear_highlight',
    READ_FILE: 'openspace.editor.read_file',
    CLOSE: 'openspace.editor.close'
} as const;

/**
 * Simple UUID generator for unique IDs.
 */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * EditorCommandContribution - Registers editor commands in Theia's CommandRegistry.
 * 
 * Implements CommandContribution to register 6 editor commands:
 * - openspace.editor.open: Open a file in the editor at specific line/column
 * - openspace.editor.scroll_to: Scroll to a specific line in an open file
 * - openspace.editor.highlight: Highlight code ranges with decorations
 * - openspace.editor.clear_highlight: Clear a highlight by ID
 * - openspace.editor.read_file: Read file content (with security validation)
 * - openspace.editor.close: Close an editor by path
 * 
 * Security per §17.1 and §17.4:
 * - Validates all paths against workspace root
 * - Rejects path traversal (..)
 * - Rejects symlinks pointing outside workspace
 * - Blocks sensitive files (.env, .git/, id_rsa, *.pem, etc.)
 */
@injectable()
export class EditorCommandContribution implements CommandContribution {

    @inject(EditorManager)
    private readonly editorManager!: EditorManager;

    @inject(FileService)
    private readonly fileService!: FileService;

    @inject(WorkspaceService)
    private readonly workspaceService!: WorkspaceService;

    @inject(OpenCodeService) @optional()
    private readonly openCodeService?: OpenCodeService;

    /**
     * Map of tracked highlights for cleanup (GAP-4).
     */
    private highlights: Map<string, TrackedHighlight> = new Map();

    /**
     * Validate a file path against workspace root.
     * Implements GAP-1 (path traversal) and GAP-9 (symlink protection) per §17.1.
     * Implements sensitive file blocking per §17.4.
     * 
     * T1-3: Added symlink detection warning.
     * 
     * @param filePath The file path to validate (relative or absolute)
     * @returns The validated absolute path if allowed, null if denied
     */
    async validatePath(filePath: string): Promise<string | null> {
        try {
            // Step 1: Get workspace root
            const workspaceRoot = this.workspaceService.tryGetRoots()[0];
            if (!workspaceRoot) {
                console.warn('[EditorCommand] No workspace root found');
                return null;
            }
            const rootUri = workspaceRoot.resource;
            const rootPath = rootUri.path.toString();

            // Step 2: Resolve the path (handle relative paths)
            let resolvedPath: string;
            if (path.isAbsolute(filePath)) {
                resolvedPath = filePath;
            } else {
                resolvedPath = path.join(rootPath, filePath);
            }

            // Step 3: Check for path traversal (..)
            let normalizedPath = path.normalize(resolvedPath);
            if (normalizedPath.includes('..')) {
                console.warn(`[EditorCommand] Path traversal attempt rejected: ${filePath}`);
                return null;
            }

            // Step 4: Check for symlink traversal outside workspace
            // T1-3: Resolve symlinks via Node backend (browser can't call fs.realpath)
            const pathComponents = normalizedPath.split(path.sep);
            for (const component of pathComponents) {
                if (component === '..') {
                    console.warn(`[EditorCommand] Path traversal via symlink rejected: ${filePath}`);
                    return null;
                }
            }
            
            // Check if resolved path starts with workspace root
            const normalizedRoot = path.normalize(rootPath);
            if (!normalizedPath.startsWith(normalizedRoot) && 
                !normalizedPath.replace(/[\\/]/g, '/').startsWith(normalizedRoot.replace(/[\\/]/g, '/'))) {
                console.warn(`[EditorCommand] Path outside workspace rejected: ${filePath}`);
                return null;
            }

            // T1-3: Resolve symlinks via Node backend (browser can't call fs.realpath)
            if (this.openCodeService) {
                const result = await this.openCodeService.validatePath(normalizedPath, normalizedRoot);
                if (!result.valid) {
                    console.warn(`[EditorCommand] Path rejected by symlink check: ${result.error}`);
                    return null;
                }
                // Update to the canonically resolved path before further checks
                normalizedPath = result.resolvedPath || normalizedPath;
            }

            // Step 5: Check against sensitive file patterns (§17.4) - using shared module
            const fileName = path.basename(normalizedPath);
            const relativePath = normalizedPath.replace(rootPath, '').replace(/^\//, '');
            
            // Use shared sensitive file check from common module
            if (isSensitiveFile(fileName) || isSensitiveFile(relativePath)) {
                console.warn(`[EditorCommand] Sensitive file access denied: ${filePath}`);
                return null;
            }

            return normalizedPath;
        } catch (error) {
            console.error('[EditorCommand] Path validation error:', error);
            return null;
        }
    }

    /**
     * Get or create a unique highlight ID.
     */
    private getHighlightId(customId?: string): string {
        return customId || generateUUID();
    }

    /**
     * Register all editor commands with Theia's CommandRegistry.
     */
    registerCommands(registry: CommandRegistry): void {
        // Register openspace.editor.open
        registry.registerCommand(
            {
                id: EditorCommands.OPEN,
                label: 'OpenSpace: Open File'
            },
            {
                execute: async (args: EditorOpenArgs) => {
                    return this.openEditor(args);
                }
            }
        );

        // Register openspace.editor.scroll_to
        registry.registerCommand(
            {
                id: EditorCommands.SCROLL_TO,
                label: 'OpenSpace: Scroll to Line'
            },
            {
                execute: async (args: EditorScrollArgs) => {
                    return this.scrollToLine(args);
                }
            }
        );

        // Register openspace.editor.highlight
        registry.registerCommand(
            {
                id: EditorCommands.HIGHLIGHT,
                label: 'OpenSpace: Highlight Code'
            },
            {
                execute: async (args: EditorHighlightArgs) => {
                    return this.highlightCode(args);
                }
            }
        );

        // Register openspace.editor.clear_highlight
        registry.registerCommand(
            {
                id: EditorCommands.CLEAR_HIGHLIGHT,
                label: 'OpenSpace: Clear Highlight'
            },
            {
                execute: async (args: EditorClearHighlightArgs) => {
                    return this.clearHighlight(args);
                }
            }
        );

        // Register openspace.editor.read_file
        registry.registerCommand(
            {
                id: EditorCommands.READ_FILE,
                label: 'OpenSpace: Read File'
            },
            {
                execute: async (args: EditorReadFileArgs) => {
                    return this.readFile(args);
                }
            }
        );

        // Register openspace.editor.close
        registry.registerCommand(
            {
                id: EditorCommands.CLOSE,
                label: 'OpenSpace: Close File'
            },
            {
                execute: async (args: EditorCloseArgs) => {
                    return this.closeEditor(args);
                }
            }
        );
    }

    /**
     * Open an editor at a specific file path, line, and column.
     */
    private async openEditor(args: EditorOpenArgs): Promise<{ success: boolean; editorId?: string }> {
        try {
            // Validate path first (security per §17.1, §17.4)
            const validatedPath = await this.validatePath(args.path);
            if (!validatedPath) {
                return { success: false };
            }

            // Create URI for the file and open the editor
            const options: EditorOpenerOptions = {
                mode: 'activate',
            };
            
            if (args.line !== undefined) {
                options.selection = {
                    start: {
                        line: args.line - 1,
                        character: args.column !== undefined ? args.column - 1 : 0
                    }
                };
                options.revealOption = 'centerIfOutsideViewport';
            }

            // Open the editor
            const editorWidget = await this.editorManager.open(URI.fromFilePath(validatedPath), options);

            // Get editor ID
            const editorId = editorWidget.id;

            return { success: true, editorId };
        } catch (error) {
            console.error('[EditorCommand] Error opening editor:', error);
            return { success: false };
        }
    }

    /**
     * Scroll to a specific line in an open file.
     */
    private async scrollToLine(args: EditorScrollArgs): Promise<{ success: boolean }> {
        try {
            let editorWidget: EditorWidget | undefined;

            if (args.path) {
                // Validate path first
                const validatedPath = await this.validatePath(args.path);
                if (!validatedPath) {
                    return { success: false };
                }
                editorWidget = await this.editorManager.getByUri(URI.fromFilePath(validatedPath));
            } else {
                editorWidget = this.editorManager.currentEditor;
            }

            if (!editorWidget) {
                console.warn(`[EditorCommand] Editor not found for scroll_to`);
                return { success: false };
            }

            const monacoEditor = MonacoEditor.get(editorWidget);
            if (monacoEditor) {
                const position: Position = { line: args.line - 1, character: 0 };
                monacoEditor.revealPosition(position, { vertical: 'centerIfOutsideViewport' });
            }
            return { success: true };
        } catch (error) {
            console.error('[EditorCommand] Error scrolling to line:', error);
            return { success: false };
        }
    }

    /**
     * Highlight code ranges in an editor.
     */
    private async highlightCode(args: EditorHighlightArgs): Promise<{ success: boolean; highlightId: string }> {
        try {
            let editorWidget: EditorWidget | undefined;

            if (args.path) {
                // Validate path first
                const validatedPath = await this.validatePath(args.path);
                if (!validatedPath) {
                    return { success: false, highlightId: '' };
                }
                editorWidget = await this.editorManager.open(URI.fromFilePath(validatedPath), {
                    mode: 'reveal'
                });
            } else {
                editorWidget = this.editorManager.currentEditor;
            }

            if (!editorWidget) {
                console.warn('[EditorCommand] No editor available for highlight');
                return { success: false, highlightId: '' };
            }

            const monacoEditor = MonacoEditor.get(editorWidget);
            if (!monacoEditor) {
                console.warn('[EditorCommand] Monaco editor not available');
                return { success: false, highlightId: '' };
            }

            // Generate unique highlight ID
            const highlightId = this.getHighlightId(args.highlightId);

            // Get the underlying Monaco editor control
            const editorControl = monacoEditor.getControl();

            // Create decorations for each range
            const decorations: monaco.editor.IModelDeltaDecoration[] = args.ranges.map(range => {
                const startColumn = range.startColumn || 1;
                const endColumn = range.endColumn || 1000; // Large number to extend to end of line
                
                return {
                    range: new monaco.Range(
                        range.startLine,
                        startColumn,
                        range.endLine,
                        endColumn
                    ),
                    options: {
                        inlineClassName: `openspace-highlight-${(args.color || 'yellow').replace('#', '')}`,
                        hoverMessage: { value: 'OpenSpace Highlight' }
                    }
                };
            });

            // Apply decorations
            const decorationIds = editorControl.deltaDecorations([], decorations);

            // Track the highlight for cleanup (GAP-4)
            this.highlights.set(highlightId, {
                id: highlightId,
                editorId: editorWidget.id,
                decorationIds,
                createdAt: new Date()
            });

            return { success: true, highlightId };
        } catch (error) {
            console.error('[EditorCommand] Error highlighting code:', error);
            return { success: false, highlightId: '' };
        }
    }

    /**
     * Clear a highlight by ID.
     */
    private async clearHighlight(args: EditorClearHighlightArgs): Promise<{ success: boolean }> {
        try {
            const trackedHighlight = this.highlights.get(args.highlightId);
            if (!trackedHighlight) {
                console.warn(`[EditorCommand] Highlight not found: ${args.highlightId}`);
                return { success: false };
            }

            // Find the editor and remove decorations
            const widgets = this.editorManager.all;
            const editorWidget = widgets.find((w: EditorWidget) => w.id === trackedHighlight.editorId);
            
            if (editorWidget) {
                const monacoEditor = MonacoEditor.get(editorWidget);
                if (monacoEditor) {
                    const editorControl = monacoEditor.getControl();
                    // Clear decorations by passing empty newDecorations
                    editorControl.deltaDecorations(trackedHighlight.decorationIds, []);
                }
            }

            // Remove from tracking map
            this.highlights.delete(args.highlightId);
            return { success: true };
        } catch (error) {
            console.error('[EditorCommand] Error clearing highlight:', error);
            return { success: false };
        }
    }

    /**
     * Read file content (with security validation).
     */
    private async readFile(args: EditorReadFileArgs): Promise<{ success: boolean; content?: string }> {
        try {
            // If no path provided, read from current active editor
            if (!args.path) {
                const currentEditor = this.editorManager.currentEditor;
                if (!currentEditor) {
                    return { success: false };
                }
                const monacoEditor = MonacoEditor.get(currentEditor);
                if (monacoEditor) {
                    const content = monacoEditor.getControl().getModel()?.getValue();
                    return { success: true, content: content ?? '' };
                }
                return { success: false };
            }

            // Validate path first (security per §17.1, §17.4)
            const validatedPath = await this.validatePath(args.path);
            if (!validatedPath) {
                return { success: false };
            }

            // If the file is already open in an editor, read from the Monaco model
            // to include any unsaved changes
            const openWidget = await this.editorManager.getByUri(URI.fromFilePath(validatedPath));
            if (openWidget) {
                const monacoEditor = MonacoEditor.get(openWidget);
                if (monacoEditor) {
                    const content = monacoEditor.getControl().getModel()?.getValue();
                    return { success: true, content: content ?? '' };
                }
            }

            // Fall back to reading from disk via FileService
            const content = await this.fileService.read(URI.fromFilePath(validatedPath));
            return { success: true, content: content.value };
        } catch (error) {
            console.error('[EditorCommand] Error reading file:', error);
            return { success: false };
        }
    }

    /**
     * Close an editor by path.
     */
    private async closeEditor(args: EditorCloseArgs): Promise<{ success: boolean }> {
        try {
            let editorWidget: EditorWidget | undefined;

            if (args.path) {
                // Validate path first
                const validatedPath = await this.validatePath(args.path);
                if (!validatedPath) {
                    return { success: false };
                }
                editorWidget = await this.editorManager.getByUri(URI.fromFilePath(validatedPath));
            } else {
                editorWidget = this.editorManager.currentEditor;
            }

            if (!editorWidget) {
                return { success: false };
            }

            // Close the widget
            await editorWidget.close();
            return { success: true };
        } catch (error) {
            console.error('[EditorCommand] Error closing editor:', error);
            return { success: false };
        }
    }

    /**
     * Get all tracked highlights (for testing/debugging).
     */
    getTrackedHighlights(): Map<string, TrackedHighlight> {
        return this.highlights;
    }
}
