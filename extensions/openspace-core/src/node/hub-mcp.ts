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

import { Application, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { z } from 'zod';
import { AgentCommand } from '../common/command-manifest';

// Use exports-map compatible require paths (the package.json exports map resolves these correctly)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

/**
 * Result posted back from the browser after executing an agent command.
 */
export interface CommandBridgeResult {
    cmd: string;
    args: unknown;
    success: boolean;
    output?: unknown;
    error?: string;
    executionTime: number;
    timestamp: string;
    requestId?: string;
}

/**
 * Callback type: invoked by OpenSpaceMcpServer to forward a command to the browser via RPC.
 */
export type BridgeCallback = (command: AgentCommand) => void;

/**
 * OpenSpaceMcpServer — MCP server that registers 17 OpenSpace IDE control tools and
 * mounts them on the Express app at POST/GET/DELETE /mcp.
 *
 * Architecture (T3):
 *  1. Agent (opencode) calls an MCP tool.
 *  2. File tools (read/write/list/search/patch) are handled directly in this class.
 *  3. IDE-control tools (pane/editor/terminal) call executeViaBridge():
 *     - Stores a pending Promise keyed by requestId.
 *     - Calls bridgeCallback with the AgentCommand (which includes requestId).
 *     - Hub receives the RPC and calls client.onAgentCommand() → browser executes it.
 *     - Browser POSTs result to POST /openspace/command-results with requestId.
 *     - Hub calls resolveCommand() → Promise resolves → MCP tool returns result.
 *  4. Each MCP request uses a stateless StreamableHTTPServerTransport.
 */
export class OpenSpaceMcpServer {

    private readonly mcpServer: any; // McpServer instance
    private readonly pendingCommands = new Map<string, {
        resolve: (result: CommandBridgeResult) => void;
        reject: (err: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();
    private bridgeCallback: BridgeCallback | undefined;

    /** Absolute path of the workspace root (enforced for file tools). */
    private workspaceRoot: string;

    private readonly commandTimeoutMs = 30_000; // 30 seconds

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.mcpServer = new McpServer({ name: 'openspace-hub', version: '1.0.0' });
        this.registerTools();
    }

    /**
     * Set the bridge callback. Called by Hub once the frontend registers.
     */
    setBridgeCallback(callback: BridgeCallback): void {
        this.bridgeCallback = callback;
    }

    /**
     * Called by Hub when POST /openspace/command-results arrives with a requestId.
     * Resolves the pending Promise for the given requestId.
     */
    resolveCommand(requestId: string, result: CommandBridgeResult): void {
        const pending = this.pendingCommands.get(requestId);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingCommands.delete(requestId);
            pending.resolve(result);
        }
    }

    /**
     * Mount MCP HTTP routes on the Express app.
     * Handles POST (tool calls), GET (SSE), DELETE (session termination) at /mcp.
     */
    mount(app: Application): void {
        app.post('/mcp', (req: Request, res: Response) => this.handleMcpRequest(req, res));
        app.get('/mcp', (req: Request, res: Response) => this.handleMcpRequest(req, res));
        app.delete('/mcp', (req: Request, res: Response) => this.handleMcpRequest(req, res));
    }

    private async handleMcpRequest(req: Request, res: Response): Promise<void> {
        // Stateless mode: a new transport per request (sessionIdGenerator: undefined)
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        try {
            await this.mcpServer.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            if (!res.headersSent) {
                res.status(500).json({ error: String(err) });
            }
        }
    }

    // ─── Tool Registration ────────────────────────────────────────────────────

    private registerTools(): void {
        this.registerPaneTools();
        this.registerEditorTools();
        this.registerTerminalTools();
        this.registerFileTools();
    }

    // ─── Pane Tools (4) ──────────────────────────────────────────────────────

    private registerPaneTools(): void {
        this.mcpServer.tool(
            'openspace.pane.open',
            'Open a pane in the IDE (editor, terminal, preview, etc.)',
            {
                area: z.enum(['main', 'bottom', 'right', 'left']).describe('Target area to open the pane in'),
                type: z.string().describe('Pane type (e.g. terminal, editor, preview)'),
                label: z.string().optional().describe('Optional label for the pane tab'),
                uri: z.string().optional().describe('Optional URI to open in the pane')
            },
            async (args: any) => this.executeViaBridge('openspace.pane.open', args)
        );

        this.mcpServer.tool(
            'openspace.pane.close',
            'Close an open pane by its ID or area',
            {
                paneId: z.string().optional().describe('ID of the pane to close'),
                area: z.enum(['main', 'bottom', 'right', 'left']).optional().describe('Area of the pane to close')
            },
            async (args: any) => this.executeViaBridge('openspace.pane.close', args)
        );

        this.mcpServer.tool(
            'openspace.pane.focus',
            'Focus a specific pane by ID or area',
            {
                paneId: z.string().optional().describe('ID of the pane to focus'),
                area: z.enum(['main', 'bottom', 'right', 'left']).optional().describe('Area of the pane to focus')
            },
            async (args: any) => this.executeViaBridge('openspace.pane.focus', args)
        );

        this.mcpServer.tool(
            'openspace.pane.list',
            'List all open panes and their current state',
            {},
            async (args: any) => this.executeViaBridge('openspace.pane.list', args)
        );
    }

    // ─── Editor Tools (6) ────────────────────────────────────────────────────

    private registerEditorTools(): void {
        this.mcpServer.tool(
            'openspace.editor.open',
            'Open a file in the editor, optionally jumping to a specific line',
            {
                path: z.string().describe('File path to open (relative to workspace root or absolute)'),
                line: z.number().optional().describe('Line number to navigate to (1-indexed)'),
                column: z.number().optional().describe('Column number to navigate to (1-indexed)')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.open', args)
        );

        this.mcpServer.tool(
            'openspace.editor.read_file',
            'Read the contents of the currently open file (or a specified file) from the editor',
            {
                path: z.string().optional().describe('File path to read. Defaults to the currently active editor file.')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.read_file', args)
        );

        this.mcpServer.tool(
            'openspace.editor.close',
            'Close the currently active editor tab or a specified file',
            {
                path: z.string().optional().describe('File path to close. Defaults to the currently active editor.')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.close', args)
        );

        this.mcpServer.tool(
            'openspace.editor.scroll_to',
            'Scroll the editor to a specific line',
            {
                path: z.string().optional().describe('File path of the editor to scroll. Defaults to active editor.'),
                line: z.number().describe('Line number to scroll to (1-indexed)')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.scroll_to', args)
        );

        this.mcpServer.tool(
            'openspace.editor.highlight',
            'Highlight (select) a range of lines in the editor',
            {
                path: z.string().optional().describe('File path. Defaults to active editor.'),
                startLine: z.number().describe('Start line of the highlight range (1-indexed)'),
                endLine: z.number().describe('End line of the highlight range (1-indexed)')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.highlight', args)
        );

        this.mcpServer.tool(
            'openspace.editor.clear_highlight',
            'Clear any active highlights in the editor',
            {
                path: z.string().optional().describe('File path. Defaults to active editor.')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.clear_highlight', args)
        );
    }

    // ─── Terminal Tools (5) ──────────────────────────────────────────────────

    private registerTerminalTools(): void {
        this.mcpServer.tool(
            'openspace.terminal.create',
            'Create a new terminal pane',
            {
                label: z.string().optional().describe('Label for the terminal tab'),
                cwd: z.string().optional().describe('Working directory for the terminal')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.create', args)
        );

        this.mcpServer.tool(
            'openspace.terminal.send',
            'Send text/command input to a terminal',
            {
                terminalId: z.string().describe('ID of the terminal to send input to'),
                text: z.string().describe('Text to send to the terminal (newline triggers Enter)')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.send', args)
        );

        this.mcpServer.tool(
            'openspace.terminal.read_output',
            'Read recent output from a terminal',
            {
                terminalId: z.string().describe('ID of the terminal to read output from'),
                lines: z.number().optional().describe('Number of recent lines to read (default: 50)')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.read_output', args)
        );

        this.mcpServer.tool(
            'openspace.terminal.list',
            'List all open terminals and their IDs',
            {},
            async (args: any) => this.executeViaBridge('openspace.terminal.list', args)
        );

        this.mcpServer.tool(
            'openspace.terminal.close',
            'Close a terminal by its ID',
            {
                terminalId: z.string().describe('ID of the terminal to close')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.close', args)
        );
    }

    // ─── File Tools (5, Hub-direct) ──────────────────────────────────────────

    private registerFileTools(): void {
        this.mcpServer.tool(
            'openspace.file.read',
            'Read the contents of a file from the workspace',
            {
                path: z.string().describe('File path to read (relative to workspace root or absolute)')
            },
            async (args: { path: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path);
                    const content = fs.readFileSync(resolved, 'utf-8');
                    return { content: [{ type: 'text', text: content }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        this.mcpServer.tool(
            'openspace.file.write',
            'Write (overwrite) a file in the workspace',
            {
                path: z.string().describe('File path to write (relative to workspace root or absolute)'),
                content: z.string().describe('Content to write to the file')
            },
            async (args: { path: string; content: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path);
                    const dir = path.dirname(resolved);
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(resolved, args.content, 'utf-8');
                    return { content: [{ type: 'text', text: `Written ${resolved}` }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        this.mcpServer.tool(
            'openspace.file.list',
            'List files and directories in a workspace directory',
            {
                path: z.string().optional().describe('Directory path to list (default: workspace root)'),
                recursive: z.boolean().optional().describe('List recursively (default: false)')
            },
            async (args: { path?: string; recursive?: boolean }) => {
                try {
                    const resolved = this.resolveSafePath(args.path || '.');
                    const entries = this.listDirectory(resolved, args.recursive ?? false);
                    return { content: [{ type: 'text', text: entries.join('\n') }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        this.mcpServer.tool(
            'openspace.file.search',
            'Search for a pattern in workspace files',
            {
                pattern: z.string().describe('Text or regex pattern to search for'),
                path: z.string().optional().describe('Directory to search in (default: workspace root)'),
                glob: z.string().optional().describe('File glob filter (e.g. "**/*.ts")')
            },
            async (args: { pattern: string; path?: string; glob?: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path || '.');
                    const results = this.searchFiles(resolved, args.pattern, args.glob);
                    const text = results.length > 0
                        ? results.join('\n')
                        : 'No matches found';
                    return { content: [{ type: 'text', text }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        this.mcpServer.tool(
            'openspace.file.patch',
            'Apply a search-and-replace patch to a file',
            {
                path: z.string().describe('File path to patch'),
                oldText: z.string().describe('Exact text to find and replace'),
                newText: z.string().describe('Replacement text')
            },
            async (args: { path: string; oldText: string; newText: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path);
                    const original = fs.readFileSync(resolved, 'utf-8');
                    if (!original.includes(args.oldText)) {
                        return { content: [{ type: 'text', text: 'Error: oldText not found in file' }], isError: true };
                    }
                    const patched = original.replace(args.oldText, args.newText);
                    fs.writeFileSync(resolved, patched, 'utf-8');
                    return { content: [{ type: 'text', text: `Patched ${resolved}` }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );
    }

    // ─── Bridge Execution ─────────────────────────────────────────────────────

    /**
     * Execute an IDE-control command by forwarding it to the browser via bridgeCallback.
     * Returns a Promise that resolves when the browser posts back the command result.
     */
    private async executeViaBridge(cmd: string, args: unknown): Promise<any> {
        if (!this.bridgeCallback) {
            return { content: [{ type: 'text', text: 'Error: Bridge not connected. Browser frontend not registered.' }], isError: true };
        }

        const requestId = `${cmd}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const resultPromise = new Promise<CommandBridgeResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingCommands.delete(requestId);
                reject(new Error(`Command timed out after ${this.commandTimeoutMs}ms: ${cmd}`));
            }, this.commandTimeoutMs);

            this.pendingCommands.set(requestId, { resolve, reject, timer });
        });

        const command: AgentCommand = { cmd, args, requestId };
        try {
            this.bridgeCallback(command);
        } catch (err) {
            this.pendingCommands.delete(requestId);
            return { content: [{ type: 'text', text: `Error: Failed to dispatch command: ${String(err)}` }], isError: true };
        }

        try {
            const result = await resultPromise;
            if (result.success) {
                const text = result.output !== undefined
                    ? JSON.stringify(result.output, null, 2)
                    : 'Command executed successfully';
                return { content: [{ type: 'text', text }] };
            } else {
                return { content: [{ type: 'text', text: `Error: ${result.error || 'Command failed'}` }], isError: true };
            }
        } catch (err) {
            return { content: [{ type: 'text', text: String(err) }], isError: true };
        }
    }

    // ─── File Utilities ───────────────────────────────────────────────────────

    /**
     * Resolve a path safely, ensuring it stays within the workspace root.
     * Throws if the resolved path escapes the workspace.
     */
    private resolveSafePath(filePath: string): string {
        const resolved = path.resolve(this.workspaceRoot, filePath);
        if (!resolved.startsWith(this.workspaceRoot + path.sep) && resolved !== this.workspaceRoot) {
            throw new Error(`Path traversal detected: "${filePath}" resolves outside workspace root`);
        }
        return resolved;
    }

    private listDirectory(dirPath: string, recursive: boolean, base?: string): string[] {
        const results: string[] = [];
        const rel = base || '';
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
            return results;
        }
        for (const entry of entries) {
            const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                results.push(`${entryRel}/`);
                if (recursive) {
                    results.push(...this.listDirectory(path.join(dirPath, entry.name), true, entryRel));
                }
            } else {
                results.push(entryRel);
            }
        }
        return results;
    }

    private searchFiles(dirPath: string, pattern: string, globFilter?: string): string[] {
        const results: string[] = [];
        let regex: RegExp;
        try {
            regex = new RegExp(pattern);
        } catch {
            // Fall back to literal search
            regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        }

        // Extract file extension from glob pattern (e.g. "**/*.ts" → ".ts", "*.json" → ".json")
        const ext = globFilter
            ? (globFilter.includes('*') ? globFilter.slice(globFilter.lastIndexOf('*') + 1) : globFilter)
            : null;

        const walk = (dir: string): void => {
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                        walk(full);
                    }
                } else if (!ext || entry.name.endsWith(ext)) {
                    try {
                        const content = fs.readFileSync(full, 'utf-8');
                        const lines = content.split('\n');
                        lines.forEach((line, idx) => {
                            if (regex.test(line)) {
                                results.push(`${full}:${idx + 1}: ${line.trim()}`);
                            }
                        });
                    } catch {
                        // skip unreadable files
                    }
                }
            }
        };

        walk(dirPath);
        return results;
    }
}
