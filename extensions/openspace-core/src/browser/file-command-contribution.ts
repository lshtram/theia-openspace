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
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { URI } from '@theia/core/lib/common/uri';
import * as path from './browser-path';
import { OpenCodeService } from '../common/opencode-protocol';
import { isSensitiveFile } from '../common/sensitive-files';
import { validatePath as sharedValidatePath } from './path-validator';

/**
 * File information returned by list command.
 */
export interface FileInfo {
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
}

/**
 * Arguments for openspace.file.read command.
 */
export interface FileReadArgs {
    path: string;
}

/**
 * Arguments for openspace.file.write command.
 */
export interface FileWriteArgs {
    path: string;
    content: string;
}

/**
 * Arguments for openspace.file.list command.
 */
export interface FileListArgs {
    path: string;
}

/**
 * Arguments for openspace.file.search command.
 */
export interface FileSearchArgs {
    query: string;
    includePattern?: string;
    excludePattern?: string;
}

/**
 * Critical directories that must be protected from writes per SC-3.5.2.
 */
const CRITICAL_WRITE_PATTERNS: RegExp[] = [
    /\.git\//i,
    /node_modules\//i,
    /\.theia\//i,
];

/**
 * JSON Schema for openspace.file.read command arguments.
 */
export const FILE_READ_SCHEMA = {
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
 * JSON Schema for openspace.file.write command arguments.
 */
export const FILE_WRITE_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'File path to write (relative to workspace)'
        },
        content: {
            type: 'string',
            description: 'Content to write to file'
        }
    },
    required: ['path', 'content']
};

/**
 * JSON Schema for openspace.file.list command arguments.
 */
export const FILE_LIST_SCHEMA = {
    type: 'object',
    properties: {
        path: {
            type: 'string',
            description: 'Directory path to list (relative to workspace)'
        }
    },
    required: ['path']
};

/**
 * JSON Schema for openspace.file.search command arguments.
 */
export const FILE_SEARCH_SCHEMA = {
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'Search query'
        },
        includePattern: {
            type: 'string',
            description: 'Glob pattern to include (e.g., "**/*.ts")'
        },
        excludePattern: {
            type: 'string',
            description: 'Glob pattern to exclude (e.g., "**/node_modules/**")'
        }
    },
    required: ['query']
};

/**
 * Command IDs for file operations.
 */
export const FileCommands = {
    READ: 'openspace.file.read',
    WRITE: 'openspace.file.write',
    LIST: 'openspace.file.list',
    SEARCH: 'openspace.file.search'
} as const;

/**
 * Maximum file size for read operations (10MB).
 * T2-20: Prevents OOM on huge files.
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * FileCommandContribution - Registers file commands in Theia's CommandRegistry.
 * 
 * Implements CommandContribution to register 4 file commands:
 * - openspace.file.read: Read file content (with security validation)
 * - openspace.file.write: Write content to file (with security validation)
 * - openspace.file.list: List files in directory
 * - openspace.file.search: Search for files matching a pattern
 * 
 * Security per §17.1, §17.4, and SC-3.5.2:
 * - Validates all paths against workspace root
 * - Rejects path traversal (..)
 * - Rejects symlinks pointing outside workspace
 * - Blocks sensitive files (.env, .git/, id_rsa, *.pem, etc.)
 * - Blocks writes to critical directories (.git/, node_modules/, .theia/)
 */
@injectable()
export class FileCommandContribution implements CommandContribution {

    @inject(FileService)
    private readonly fileService!: FileService;

    @inject(WorkspaceService)
    private readonly workspaceService!: WorkspaceService;

    @inject(OpenCodeService) @optional()
    private readonly openCodeService?: OpenCodeService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

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
            { logTag: '[FileCommand]' }
        );
    }
    /**
     * Validate a path for write operations.
     * Implements SC-3.5.2: Critical file protection.
     * 
     * @param filePath The file path to validate for writing
     * @returns The validated absolute path if allowed, null if denied
     */
    async validateWritePath(filePath: string): Promise<string | null> {
        // First run standard path validation
        const validatedPath = await this.validatePath(filePath);
        if (!validatedPath) {
            return null;
        }

        // Check against critical write patterns per SC-3.5.2
        const normalizedPath = path.normalize(validatedPath);
        
        for (const pattern of CRITICAL_WRITE_PATTERNS) {
            if (pattern.test(normalizedPath)) {
                this.logger.warn(`[FileCommand] Critical write to protected directory rejected: ${filePath}`);
                return null;
            }
        }

        return validatedPath;
    }

    /**
     * Check if a path matches sensitive file patterns.
     * Uses shared sensitive file module for consistent checking.
     * @param filePath The file path to check
     * @returns true if the path is sensitive
     */
    isSensitive(filePath: string): boolean {
        return isSensitiveFile(filePath);
    }

    /**
     * Check if a path matches critical write protection patterns.
     * @param filePath The file path to check
     * @returns true if the path is protected from writes
     */
    isCriticalWritePath(filePath: string): boolean {
        const normalizedPath = path.normalize(filePath);
        for (const pattern of CRITICAL_WRITE_PATTERNS) {
            if (pattern.test(normalizedPath)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Register all file commands with Theia's CommandRegistry.
     */
    registerCommands(registry: CommandRegistry): void {
        // Register openspace.file.read
        registry.registerCommand(
            {
                id: FileCommands.READ,
                label: 'OpenSpace: Read File'
            },
            {
                execute: async (args: FileReadArgs) => {
                    return this.readFile(args);
                }
            }
        );

        // Register openspace.file.write
        registry.registerCommand(
            {
                id: FileCommands.WRITE,
                label: 'OpenSpace: Write File'
            },
            {
                execute: async (args: FileWriteArgs) => {
                    return this.writeFile(args);
                }
            }
        );

        // Register openspace.file.list
        registry.registerCommand(
            {
                id: FileCommands.LIST,
                label: 'OpenSpace: List Files'
            },
            {
                execute: async (args: FileListArgs) => {
                    return this.listFiles(args);
                }
            }
        );

        // Register openspace.file.search
        registry.registerCommand(
            {
                id: FileCommands.SEARCH,
                label: 'OpenSpace: Search Files'
            },
            {
                execute: async (args: FileSearchArgs) => {
                    return this.searchFiles(args);
                }
            }
        );
    }

    /**
     * Read file content with security validation and size limit.
     * T2-20: Added file size check to prevent OOM on huge files.
     */
    private async readFile(args: FileReadArgs): Promise<{ success: boolean; content?: string; error?: string }> {
        try {
            // Validate path first (security per §17.1, §17.4)
            const validatedPath = await this.validatePath(args.path);
            if (!validatedPath) {
                return { success: false };
            }

            const uri = new URI(validatedPath);
            
            // Check if it's a file
            const stat = await this.fileService.resolve(uri);
            if (!stat.isFile) {
                this.logger.warn(`[FileCommand] Not a file: ${args.path}`);
                return { success: false };
            }

            // T2-20: Check file size before reading
            const size = (stat as { size?: number }).size;
            if (size !== undefined && size > MAX_FILE_SIZE) {
                this.logger.warn(`[FileCommand] File too large: ${args.path} (${size} bytes, max ${MAX_FILE_SIZE})`);
                return { 
                    success: false, 
                    error: `File too large: ${size} bytes (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` 
                };
            }

            const content = await this.fileService.read(uri);
            return { success: true, content: content.value };
        } catch (error) {
            this.logger.error('[FileCommand] Error reading file:', error);
            return { success: false };
        }
    }

    /**
     * Write content to file with security validation.
     */
    private async writeFile(args: FileWriteArgs): Promise<{ success: boolean }> {
        try {
            // Validate path for writing (security per §17.1, §17.4, SC-3.5.2)
            const validatedPath = await this.validateWritePath(args.path);
            if (!validatedPath) {
                return { success: false };
            }

            const uri = new URI(validatedPath);
            
            // Check if parent directory exists, create if needed
            const parentUri = uri.parent;
            try {
                await this.fileService.resolve(parentUri);
            } catch {
                // Parent doesn't exist, create it
                await this.fileService.createFolder(parentUri);
            }

            // Write the file content
            await this.fileService.write(uri, args.content);
            return { success: true };
        } catch (error) {
            this.logger.error('[FileCommand] Error writing file:', error);
            return { success: false };
        }
    }

    /**
     * List files in a directory with security validation.
     */
    private async listFiles(args: FileListArgs): Promise<{ success: boolean; files: FileInfo[] }> {
        try {
            // Validate path first (security per §17.1, §17.4)
            const validatedPath = await this.validatePath(args.path);
            if (!validatedPath) {
                return { success: false, files: [] };
            }

            const uri = new URI(validatedPath);
            
            // Check if it's a directory
            const stat = await this.fileService.resolve(uri);
            if (!stat.isDirectory) {
                this.logger.warn(`[FileCommand] Not a directory: ${args.path}`);
                return { success: false, files: [] };
            }

            // Get children from the resolved stat
            const children = stat.children || [];
            const files: FileInfo[] = children.map(child => ({
                name: child.name,
                path: child.resource.path.toString(),
                isDirectory: child.isDirectory,
                isFile: child.isFile
            }));

            return { success: true, files };
        } catch (error) {
            this.logger.error('[FileCommand] Error listing files:', error);
            return { success: false, files: [] };
        }
    }

    /**
     * Search for files matching a query.
     * Uses basic content search by reading files and checking for the query string.
     */
    private async searchFiles(args: FileSearchArgs): Promise<{ success: boolean; results: string[] }> {
        try {
            // Validate base workspace path
            const workspaceRoot = this.workspaceService.tryGetRoots()[0];
            if (!workspaceRoot) {
                this.logger.warn('[FileCommand] No workspace root found for search');
                return { success: false, results: [] };
            }

            const rootUri = workspaceRoot.resource;
            
            // Default exclude patterns
            const excludePatterns = (args.excludePattern || '**/node_modules/**').split(',').map(p => p.trim());
            
            // Collect results
            const results: string[] = [];
            
            // Perform basic recursive search (Task 9: depth/result limits enforced inside)
            const { truncated } = await this.searchInDirectory(rootUri, args.query, args.includePattern || '**/*', excludePatterns, results);
            if (truncated) {
                this.logger.warn('[FileCommand] Search results truncated (hit depth or result limit)');
            }
            
            return { success: true, results };
        } catch (error) {
            this.logger.error('[FileCommand] Error searching files:', error);
            return { success: false, results: [] };
        }
    }

    // Task 9: Large workspace protection constants
    private static readonly SKIP_DIRS = new Set([
        'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache', '.yarn'
    ]);
    private static readonly MAX_SEARCH_DEPTH = 10;
    private static readonly MAX_SEARCH_RESULTS = 1000;

    /**
     * Recursively search for files containing the query string.
     * Enforces depth limit, result cap, and skips known large directories.
     */
    private async searchInDirectory(
        dirUri: URI, 
        query: string, 
        includePattern: string, 
        excludePatterns: string[],
        results: string[],
        depth = 0
    ): Promise<{ truncated: boolean }> {
        if (depth > FileCommandContribution.MAX_SEARCH_DEPTH) {
            return { truncated: true };
        }
        if (results.length >= FileCommandContribution.MAX_SEARCH_RESULTS) {
            return { truncated: true };
        }

        try {
            const stat = await this.fileService.resolve(dirUri);
            if (!stat.isDirectory) {
                return { truncated: false };
            }

            const children = stat.children || [];
            let truncated = false;
            
            for (const child of children) {
                if (results.length >= FileCommandContribution.MAX_SEARCH_RESULTS) {
                    truncated = true;
                    break;
                }

                const childPath = child.resource.path.toString();
                
                // Skip well-known large directories
                if (child.isDirectory && FileCommandContribution.SKIP_DIRS.has(child.name)) {
                    continue;
                }

                // Check if path matches exclude patterns
                const shouldExclude = excludePatterns.some(pattern => {
                    const normalizedPattern = pattern.replace('**/', '').replace('**', '');
                    return childPath.includes(normalizedPattern);
                });
                
                if (shouldExclude) {
                    continue;
                }

                if (child.isDirectory) {
                    // Recurse into subdirectory
                    const sub = await this.searchInDirectory(child.resource, query, includePattern, excludePatterns, results, depth + 1);
                    if (sub.truncated) {
                        truncated = true;
                    }
                } else if (child.isFile) {
                    // Check if file matches include pattern (basic extension check)
                    const fileName = child.name;
                    const includeExt = includePattern.replace('**/*.', '').replace('**/*', '');
                    if (!includeExt || fileName.endsWith(includeExt) || includePattern === '**/*') {
                        try {
                            const content = await this.fileService.read(child.resource);
                            if (content.value.includes(query)) {
                                results.push(childPath);
                            }
                        } catch {
                            // Skip files that can't be read (binary, etc.)
                        }
                    }
                }
            }
            return { truncated };
        } catch (error) {
            // Silently handle permission errors
            return { truncated: false };
        }
    }
}
