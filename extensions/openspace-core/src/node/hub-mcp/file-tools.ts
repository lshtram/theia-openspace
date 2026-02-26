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

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { TOOL } from '../../common/tool-names';
import { isSensitiveFile } from '../../common/sensitive-files';
import { resolveSafePath } from '../path-utils';
import type { IMcpServer, FileDeps } from './types';
import { listDirectory, searchFiles } from './file-utils';

export function registerFileTools(server: IMcpServer, deps: FileDeps): void {
    server.tool(
        TOOL.FILE_READ,
        'Read the contents of a file from the workspace',
        {
            path: z.string().describe('File path to read (relative to workspace root or absolute)')
        },
        async (args: { path: string }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path);
                if (isSensitiveFile(resolved)) {
                    return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                }
                const ts = new Date().toISOString();
                deps.logger.info(`[${ts}] FETCH_START: FILE_READ ${resolved}`);
                let content: string;
                try {
                    content = await fs.promises.readFile(resolved, 'utf-8');
                    deps.logger.info(`[${new Date().toISOString()}] FETCH_SUCCESS: FILE_READ ${resolved}`);
                } catch (err) {
                    deps.logger.error(`[${new Date().toISOString()}] FETCH_FAIL: FILE_READ ${resolved}`, err);
                    throw err;
                }
                return { content: [{ type: 'text', text: content }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
            }
        }
    );

    server.tool(
        TOOL.FILE_WRITE,
        'Write (overwrite) a file in the workspace',
        {
            path: z.string().describe('File path to write (relative to workspace root or absolute)'),
            content: z.string().describe('Content to write to the file')
        },
        async (args: { path: string; content: string }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path);
                if (isSensitiveFile(resolved)) {
                    return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                }
                const relPath = path.relative(deps.workspaceRoot, resolved);
                deps.logger.info(`[${new Date().toISOString()}] FETCH_START: FILE_WRITE ${resolved}`);
                await deps.artifactStore.write(relPath, args.content, { actor: 'agent', reason: 'openspace.file.write MCP tool' });
                deps.logger.info(`[${new Date().toISOString()}] FETCH_SUCCESS: FILE_WRITE ${resolved}`);
                return { content: [{ type: 'text', text: `Written ${resolved}` }] };
            } catch (err) {
                deps.logger.error(`[${new Date().toISOString()}] FETCH_FAIL: FILE_WRITE`, err);
                return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
            }
        }
    );

    server.tool(
        TOOL.FILE_LIST,
        'List files and directories in a workspace directory',
        {
            path: z.string().optional().describe('Directory path to list (default: workspace root)'),
            recursive: z.boolean().optional().describe('List recursively (default: false)')
        },
        async (args: { path?: string; recursive?: boolean }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path || '.');
                const entries = listDirectory(resolved, args.recursive ?? false);
                return { content: [{ type: 'text', text: entries.join('\n') }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
            }
        }
    );

    server.tool(
        TOOL.FILE_SEARCH,
        'Search for a pattern in workspace files',
        {
            pattern: z.string().describe('Text or regex pattern to search for'),
            path: z.string().optional().describe('Directory to search in (default: workspace root)'),
            glob: z.string().optional().describe('File glob filter (e.g. "**/*.ts")')
        },
        async (args: { pattern: string; path?: string; glob?: string }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path || '.');
                const results = await searchFiles(resolved, args.pattern, args.glob);
                const text = results.length > 0
                    ? results.join('\n')
                    : 'No matches found';
                return { content: [{ type: 'text', text }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
            }
        }
    );

    server.tool(
        TOOL.FILE_PATCH,
        'Apply a search-and-replace patch to a file',
        {
            path: z.string().describe('File path to patch'),
            oldText: z.string().describe('Exact text to find and replace'),
            newText: z.string().describe('Replacement text')
        },
        async (args: { path: string; oldText: string; newText: string }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path);
                if (isSensitiveFile(resolved)) {
                    return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                }
                deps.logger.info(`[${new Date().toISOString()}] FETCH_START: FILE_PATCH ${resolved}`);
                let original: string;
                try {
                    original = await fs.promises.readFile(resolved, 'utf-8');
                } catch (err) {
                    deps.logger.error(`[${new Date().toISOString()}] FETCH_FAIL: FILE_PATCH read ${resolved}`, err);
                    throw err;
                }

                // Count occurrences to prevent silent multi-location replacement
                const occurrences = original.split(args.oldText).length - 1;
                if (occurrences === 0) {
                    return { content: [{ type: 'text', text: JSON.stringify({ error: 'oldText not found in file' }) }], isError: true };
                }
                if (occurrences > 1) {
                    return { content: [{ type: 'text', text: JSON.stringify({
                        error: `oldText found ${occurrences} times. Provide more surrounding context to uniquely identify the target location.`
                    }) }], isError: true };
                }

                // Exactly one occurrence — safe to replace
                const patched = original.replace(args.oldText, args.newText);

                // Route through ArtifactStore for atomic write + backup + audit
                const relPath = path.relative(deps.workspaceRoot, resolved);
                await deps.artifactStore.write(relPath, patched, { actor: 'agent', reason: 'openspace.file.patch MCP tool' });
                deps.logger.info(`[${new Date().toISOString()}] FETCH_SUCCESS: FILE_PATCH ${resolved}`);
                return { content: [{ type: 'text', text: `Patched ${resolved}` }] };
            } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
            }
        }
    );

    server.tool(
        TOOL.ARTIFACT_GET_VERSION,
        'Get the current OCC version number for an artifact file. Use this before openspace.artifact.patch to get the correct baseVersion.',
        {
            path: z.string().describe('File path relative to workspace root'),
        },
        async (args: { path: string }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path);
                const relPath = path.relative(deps.workspaceRoot, resolved);
                const version = deps.patchEngine.getVersion(relPath);
                return { content: [{ type: 'text', text: JSON.stringify({ path: relPath, version }) }] };
            } catch (err: unknown) {
                return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
            }
        }
    );

    server.tool(
        TOOL.ARTIFACT_PATCH,
        'Apply an OCC-versioned patch to an artifact file. Provides atomic write with backup, audit log, and version conflict detection. Prefer this over openspace.file.write for important artifact files.',
        {
            path: z.string().describe('File path relative to workspace root'),
            baseVersion: z.number().int().min(0).describe('Expected current version (0 if file is new). Use openspace.artifact.getVersion to get the current version.'),
            actor: z.enum(['agent', 'user']).default('agent').describe('Who is applying the patch'),
            intent: z.string().describe('Human-readable description of the change'),
            ops: z.array(z.record(z.string(), z.unknown())).describe('Operations to apply. For replace_content: [{op:"replace_content",content:"..."}]. For replace_lines: [{op:"replace_lines",startLine:N,endLine:N,content:"..."}]'),
        },
        async (args: { path: string; baseVersion: number; actor: 'agent' | 'user'; intent: string; ops: unknown[] }) => {
            try {
                const resolved = resolveSafePath(deps.workspaceRoot, args.path);
                if (isSensitiveFile(resolved)) {
                    return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                }
                const relPath = path.relative(deps.workspaceRoot, resolved);
                const result = await deps.patchEngine.apply(relPath, {
                    baseVersion: args.baseVersion,
                    actor: args.actor ?? 'agent',
                    intent: args.intent,
                    ops: args.ops,
                });
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ version: result.version, bytes: result.bytes, path: relPath }),
                    }],
                };
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
            }
        }
    );
}
