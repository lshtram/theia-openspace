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
import { ILogger } from '@theia/core/lib/common/logger';
import { EditorManager, EditorOpenerOptions } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { URI } from '@theia/core/lib/common/uri';
import * as monaco from '@theia/monaco-editor-core';
import { Position, EditorWidget } from '@theia/editor/lib/browser';
import { OpenerService, open as openUri } from '@theia/core/lib/browser/opener-service';
import { OpenCodeService } from '../common/opencode-protocol';
import { validatePath as sharedValidatePath } from './path-validator';

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

    @inject(OpenerService)
    private readonly openerService!: OpenerService;

    @inject(FileService)
    private readonly fileService!: FileService;

    @inject(WorkspaceService)
    private readonly workspaceService!: WorkspaceService;

    @inject(OpenCodeService) @optional()
    private readonly openCodeService?: OpenCodeService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    /**
     * Map of tracked highlights for cleanup (GAP-4).
     */
    private highlights: Map<string, TrackedHighlight> = new Map();

    /**
     * Validate a file path against workspace root.
     * Task 21: Delegates to shared path-validator utility (standardised on fsPath()).
     *
     * @param filePath The file path to validate (relative or absolute)
     * @returns The validated absolute path if allowed, null if denied
     */
    async validatePath(filePath: string): Promise<string | null> {
        return sharedValidatePath(
            filePath,
            this.workspaceService,
            this.logger,
            this.openCodeService,
            { logTag: '[EditorCommand]' }
        );
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
     *
     * Viewer-first behaviour: when no line/column is specified (pure file open),
     * we route through the OpenerService so the ViewerToggleOpenHandler can
     * intercept and open the file in preview mode first.  Double-clicking the
     * tab label will then toggle to the text editor via ViewerToggleContribution.
     *
     * When a line/column is explicitly requested (navigation jump), we bypass the
     * toggle and open directly in the text editor at that position.
     */
    private async openEditor(args: EditorOpenArgs): Promise<{ success: boolean; editorId?: string }> {
        try {
            // Validate path first (security per §17.1, §17.4)
            const validatedPath = await this.validatePath(args.path);
            if (!validatedPath) {
                return { success: false };
            }

            const uri = URI.fromFilePath(validatedPath);

            // If a specific line is requested, open directly as text editor at that position.
            if (args.line !== undefined) {
                const options: EditorOpenerOptions = {
                    mode: 'activate',
                    selection: {
                        start: {
                            line: args.line - 1,
                            character: args.column !== undefined ? args.column - 1 : 0
                        }
                    },
                    revealOption: 'centerIfOutsideViewport',
                };
                const editorWidget = await this.editorManager.open(uri, options);
                if (args.highlight) {
                    const targetLine = args.line > 0 ? args.line : 1;
                    await this.highlightCode({
                        path: args.path,
                        ranges: [{ startLine: targetLine, endLine: targetLine }],
                    });
                }
                return { success: true, editorId: editorWidget.id };
            }

            // No line specified: use OpenerService for viewer-first behaviour.
            // ViewerToggleOpenHandler (priority 150) will intercept and route to
            // the preview/viewer handler when toggle state is 'preview' (default).
            const widget = await openUri(this.openerService, uri, { mode: 'activate' });
            const editorId = widget ? (widget as any).id as string | undefined : undefined;
            return { success: true, editorId };
        } catch (error) {
            this.logger.error('[EditorCommand] Error opening editor:', error);
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
                this.logger.warn(`[EditorCommand] Editor not found for scroll_to`);
                return { success: false };
            }

            const monacoEditor = MonacoEditor.get(editorWidget);
            if (monacoEditor) {
                const position: Position = { line: args.line - 1, character: 0 };
                monacoEditor.revealPosition(position, { vertical: 'centerIfOutsideViewport' });
            }
            return { success: true };
        } catch (error) {
            this.logger.error('[EditorCommand] Error scrolling to line:', error);
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
                this.logger.warn('[EditorCommand] No editor available for highlight');
                return { success: false, highlightId: '' };
            }

            const monacoEditor = MonacoEditor.get(editorWidget);
            if (!monacoEditor) {
                this.logger.warn('[EditorCommand] Monaco editor not available');
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
            this.logger.error('[EditorCommand] Error highlighting code:', error);
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
                this.logger.warn(`[EditorCommand] Highlight not found: ${args.highlightId}`);
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
            this.logger.error('[EditorCommand] Error clearing highlight:', error);
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
            this.logger.error('[EditorCommand] Error reading file:', error);
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
            this.logger.error('[EditorCommand] Error closing editor:', error);
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
