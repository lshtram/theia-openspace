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
import { isSensitiveFile } from '../common/sensitive-files';
import { ArtifactStore } from './artifact-store';
import { PatchEngine } from './patch-engine';

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
 * OpenSpaceMcpServer — MCP server that registers 40 OpenSpace IDE control tools and
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

    private readonly pendingCommands = new Map<string, {
        resolve: (result: CommandBridgeResult) => void;
        reject: (err: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    }>();
    private bridgeCallback: BridgeCallback | undefined;

    /** Absolute path of the workspace root (enforced for file tools). */
    private workspaceRoot: string;

    private artifactStore!: ArtifactStore;
    private patchEngine!: PatchEngine;

    private readonly commandTimeoutMs = 30_000; // 30 seconds

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.artifactStore = new ArtifactStore(this.workspaceRoot);
        this.patchEngine = new PatchEngine(this.workspaceRoot, this.artifactStore);
        this.patchEngine.loadVersions().catch((err: unknown) =>
            console.error('[Hub] Failed to load patch versions:', err)
        );
    }

    close(): void {
        this.artifactStore.close();
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
        // Create a fresh McpServer per request — the SDK does not allow reuse of a connected instance.
        const server = new McpServer({ name: 'openspace-hub', version: '1.0.0' });
        this.registerToolsOn(server);
        // Stateless mode: a new transport per request (sessionIdGenerator: undefined)
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            if (!res.headersSent) {
                res.status(500).json({ error: String(err) });
            }
        }
    }

    // ─── Tool Registration ────────────────────────────────────────────────────

    private registerToolsOn(server: any): void {
        this.registerPaneTools(server);
        this.registerEditorTools(server);
        this.registerTerminalTools(server);
        this.registerFileTools(server);
        this.registerPresentationTools(server);
        this.registerWhiteboardTools(server);
    }

    // ─── Pane Tools (4) ──────────────────────────────────────────────────────

    private registerPaneTools(server: any): void {
        server.tool(
            'openspace.pane.open',
            'Open a pane in the IDE (editor, terminal, preview, etc.)',
            {
                type: z.enum(['editor', 'terminal', 'presentation', 'whiteboard']).describe('Pane type'),
                contentId: z.string().describe('Content identifier: file path for editor, or terminal title'),
                title: z.string().optional().describe('Optional label for the pane tab'),
                splitDirection: z.enum(['horizontal', 'vertical']).optional().describe('Split direction when opening alongside existing content'),
                sourcePaneId: z.string().optional()
                    .describe('ID of an existing pane to split relative to. When provided, the new pane ' +
                              'is placed relative to that specific pane instead of the currently active one. ' +
                              'Use pane.list to obtain pane IDs.'),
            },
            async (args: any) => this.executeViaBridge('openspace.pane.open', args)
        );

        server.tool(
            'openspace.pane.close',
            'Close an open pane by its ID',
            {
                paneId: z.string().describe('ID of the pane to close')
            },
            async (args: any) => this.executeViaBridge('openspace.pane.close', args)
        );

        server.tool(
            'openspace.pane.focus',
            'Focus a specific pane by ID',
            {
                paneId: z.string().describe('ID of the pane to focus')
            },
            async (args: any) => this.executeViaBridge('openspace.pane.focus', args)
        );

        server.tool(
            'openspace.pane.list',
            'List all open panes and their current state',
            {},
            async (args: any) => this.executeViaBridge('openspace.pane.list', args)
        );
    }

    // ─── Editor Tools (6) ────────────────────────────────────────────────────

    private registerEditorTools(server: any): void {
        server.tool(
            'openspace.editor.open',
            'Open a file in the editor, optionally jumping to a specific line',
            {
                path: z.string().describe('File path to open (relative to workspace root or absolute)'),
                line: z.number().optional().describe('Line number to navigate to (1-indexed)'),
                column: z.number().optional().describe('Column number to navigate to (1-indexed)')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.open', args)
        );

        server.tool(
            'openspace.editor.read_file',
            'Read the contents of the currently open file (or a specified file) from the editor',
            {
                path: z.string().optional().describe('File path to read. Defaults to the currently active editor file.')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.read_file', args)
        );

        server.tool(
            'openspace.editor.close',
            'Close the currently active editor tab or a specified file',
            {
                path: z.string().optional().describe('File path to close. Defaults to the currently active editor.')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.close', args)
        );

        server.tool(
            'openspace.editor.scroll_to',
            'Scroll the editor to a specific line',
            {
                path: z.string().optional().describe('File path of the editor to scroll. Defaults to active editor.'),
                line: z.number().describe('Line number to scroll to (1-indexed)')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.scroll_to', args)
        );

        server.tool(
            'openspace.editor.highlight',
            'Highlight (select) a range of lines in the editor',
            {
                path: z.string().optional().describe('File path. Defaults to active editor.'),
                ranges: z.array(z.object({
                    startLine: z.number().describe('Start line (1-indexed)'),
                    endLine: z.number().describe('End line (1-indexed)'),
                    startColumn: z.number().optional().describe('Start column (1-indexed)'),
                    endColumn: z.number().optional().describe('End column (1-indexed)')
                })).describe('Array of line ranges to highlight'),
                highlightId: z.string().optional().describe('Optional custom highlight ID for later removal'),
                color: z.string().optional().describe('Highlight color (e.g. "yellow", "#ffff00")')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.highlight', args)
        );

        server.tool(
            'openspace.editor.clear_highlight',
            'Clear a named highlight in the editor',
            {
                highlightId: z.string().describe('The highlight ID returned by editor.highlight to clear')
            },
            async (args: any) => this.executeViaBridge('openspace.editor.clear_highlight', args)
        );
    }

    // ─── Terminal Tools (5) ──────────────────────────────────────────────────

    private registerTerminalTools(server: any): void {
        server.tool(
            'openspace.terminal.create',
            'Create a new terminal pane',
            {
                title: z.string().optional().describe('Title for the terminal tab'),
                cwd: z.string().optional().describe('Working directory for the terminal'),
                shellPath: z.string().optional().describe('Path to shell executable (must be in allowlist)')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.create', args)
        );

        server.tool(
            'openspace.terminal.send',
            'Send text/command input to a terminal',
            {
                terminalId: z.string().describe('ID of the terminal to send input to'),
                text: z.string().describe('Text to send to the terminal (newline triggers Enter)')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.send', args)
        );

        server.tool(
            'openspace.terminal.read_output',
            'Read recent output from a terminal',
            {
                terminalId: z.string().describe('ID of the terminal to read output from'),
                lines: z.number().optional().describe('Number of recent lines to read (default: 50)')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.read_output', args)
        );

        server.tool(
            'openspace.terminal.list',
            'List all open terminals and their IDs',
            {},
            async (args: any) => this.executeViaBridge('openspace.terminal.list', args)
        );

        server.tool(
            'openspace.terminal.close',
            'Close a terminal by its ID',
            {
                terminalId: z.string().describe('ID of the terminal to close')
            },
            async (args: any) => this.executeViaBridge('openspace.terminal.close', args)
        );
    }

    // ─── File Tools (5, Hub-direct) ──────────────────────────────────────────

    private registerFileTools(server: any): void {
        server.tool(
            'openspace.file.read',
            'Read the contents of a file from the workspace',
            {
                path: z.string().describe('File path to read (relative to workspace root or absolute)')
            },
            async (args: { path: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path);
                    if (isSensitiveFile(resolved)) {
                        return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                    }
                    const content = fs.readFileSync(resolved, 'utf-8');
                    return { content: [{ type: 'text', text: content }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        server.tool(
            'openspace.file.write',
            'Write (overwrite) a file in the workspace',
            {
                path: z.string().describe('File path to write (relative to workspace root or absolute)'),
                content: z.string().describe('Content to write to the file')
            },
            async (args: { path: string; content: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path);
                    if (isSensitiveFile(resolved)) {
                        return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                    }
                    const relPath = path.relative(this.workspaceRoot, resolved);
                    await this.artifactStore.write(relPath, args.content, { actor: 'agent', reason: 'openspace.file.write MCP tool' });
                    return { content: [{ type: 'text', text: `Written ${resolved}` }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        server.tool(
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

        server.tool(
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

        server.tool(
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
                    if (isSensitiveFile(resolved)) {
                        return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                    }
                    const original = fs.readFileSync(resolved, 'utf-8');
                    if (!original.includes(args.oldText)) {
                        return { content: [{ type: 'text', text: 'Error: oldText not found in file' }], isError: true };
                    }
                    const patched = original.split(args.oldText).join(args.newText);
                    fs.writeFileSync(resolved, patched, 'utf-8');
                    return { content: [{ type: 'text', text: `Patched ${resolved}` }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        server.tool(
            'openspace.artifact.getVersion',
            'Get the current OCC version number for an artifact file. Use this before openspace.artifact.patch to get the correct baseVersion.',
            {
                path: z.string().describe('File path relative to workspace root'),
            },
            async (args: { path: string }) => {
                try {
                    const resolved = this.resolveSafePath(args.path);
                    const relPath = path.relative(this.workspaceRoot, resolved);
                    const version = this.patchEngine.getVersion(relPath);
                    return { content: [{ type: 'text', text: JSON.stringify({ path: relPath, version }) }] };
                } catch (err: unknown) {
                    return { content: [{ type: 'text', text: `Error: ${String(err)}` }], isError: true };
                }
            }
        );

        server.tool(
            'openspace.artifact.patch',
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
                    const resolved = this.resolveSafePath(args.path);
                    if (isSensitiveFile(resolved)) {
                        return { content: [{ type: 'text', text: 'Error: Access denied — sensitive file' }], isError: true };
                    }
                    const relPath = path.relative(this.workspaceRoot, resolved);
                    const result = await this.patchEngine.apply(relPath, {
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

    // ─── Presentation Tools (10) ─────────────────────────────────────────────

    private registerPresentationTools(server: any): void {
        server.tool(
            'openspace.presentation.list',
            'List all .deck.md presentation files in the workspace',
            {},
            async (args: any) => this.executeViaBridge('openspace.presentation.list', args)
        );

        server.tool(
            'openspace.presentation.read',
            'Read a .deck.md presentation file and return its parsed structure',
            {
                path: z.string().describe('Absolute path to the .deck.md file'),
            },
            async (args: any) => this.executeViaBridge('openspace.presentation.read', args)
        );

        server.tool(
            'openspace.presentation.create',
            'Create a new .deck.md presentation file with title and initial slides',
            {
                path: z.string().describe('Absolute path for the new .deck.md file'),
                title: z.string().describe('Presentation title'),
                slides: z.array(z.string()).optional().describe('Array of markdown slide content strings'),
            },
            async (args: any) => this.executeViaBridge('openspace.presentation.create', args)
        );

        server.tool(
            'openspace.presentation.update_slide',
            'Update the content of a single slide in a .deck.md file',
            {
                path: z.string().describe('Absolute path to the .deck.md file'),
                slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
                content: z.string().describe('New markdown content for the slide'),
            },
            async (args: any) => this.executeViaBridge('openspace.presentation.update_slide', args)
        );

        server.tool(
            'openspace.presentation.open',
            'Open a .deck.md file in the presentation viewer pane',
            {
                path: z.string().describe('Absolute path to the .deck.md file'),
                splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                    .describe('Where to open the pane (default: right)'),
            },
            async (args: any) => this.executeViaBridge('openspace.presentation.open', args)
        );

        server.tool(
            'openspace.presentation.navigate',
            'Navigate to a slide in the active presentation',
            {
                direction: z.enum(['next', 'prev', 'first', 'last']).optional()
                    .describe('Navigation direction'),
                slideIndex: z.number().int().min(0).optional()
                    .describe('Absolute zero-based slide index to jump to'),
            },
            async (args: any) => this.executeViaBridge('openspace.presentation.navigate', args)
        );

        server.tool(
            'openspace.presentation.play',
            'Start autoplay — advances slides automatically on a timer',
            {
                interval: z.number().int().min(500).optional()
                    .describe('Milliseconds between slides (default: 5000)'),
            },
            async (args: any) => this.executeViaBridge('openspace.presentation.play', args)
        );

        server.tool(
            'openspace.presentation.pause',
            'Pause autoplay, keeping current slide position',
            {},
            async (args: any) => this.executeViaBridge('openspace.presentation.pause', args)
        );

        server.tool(
            'openspace.presentation.stop',
            'Stop autoplay and return to the first slide',
            {},
            async (args: any) => this.executeViaBridge('openspace.presentation.stop', args)
        );

        server.tool(
            'openspace.presentation.toggleFullscreen',
            'Toggle fullscreen mode for the active presentation viewer',
            {},
            async (args: any) => this.executeViaBridge('openspace.presentation.toggleFullscreen', args)
        );
    }

    // ─── Whiteboard Tools (10) ──────────────────────────────────────────────────

    private registerWhiteboardTools(server: any): void {
        server.tool(
            'openspace.whiteboard.list',
            'List all .whiteboard.json files in the workspace',
            {},
            async (args: any) => this.executeViaBridge('openspace.whiteboard.list', args)
        );

        server.tool(
            'openspace.whiteboard.read',
            'Read a .whiteboard.json file and return its content and shape records',
            {
                path: z.string().describe('Absolute path to the .whiteboard.json file'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.read', args)
        );

        server.tool(
            'openspace.whiteboard.create',
            'Create a new .whiteboard.json file, optionally with a title label',
            {
                path: z.string().describe('Absolute path for the new .whiteboard.json file'),
                title: z.string().optional().describe('Optional title text label added to the canvas'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.create', args)
        );

        server.tool(
            'openspace.whiteboard.add_shape',
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
            async (args: any) => this.executeViaBridge('openspace.whiteboard.add_shape', args)
        );

        server.tool(
            'openspace.whiteboard.update_shape',
            'Update properties of an existing shape on the whiteboard',
            {
                path: z.string().describe('Absolute path to the .whiteboard.json file'),
                shapeId: z.string().describe('ID of the shape to update'),
                props: z.record(z.string(), z.unknown()).describe('Properties to update on the shape'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.update_shape', args)
        );

        server.tool(
            'openspace.whiteboard.delete_shape',
            'Remove a shape from the whiteboard by ID',
            {
                path: z.string().describe('Absolute path to the .whiteboard.json file'),
                shapeId: z.string().describe('ID of the shape to delete'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.delete_shape', args)
        );

        server.tool(
            'openspace.whiteboard.open',
            'Open a .whiteboard.json file in the whiteboard viewer pane',
            {
                path: z.string().describe('Absolute path to the .whiteboard.json file'),
                splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                    .describe('Where to open the pane (default: right)'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.open', args)
        );

        server.tool(
            'openspace.whiteboard.camera.set',
            'Set the whiteboard canvas camera position and zoom level',
            {
                x: z.number().describe('Camera X offset'),
                y: z.number().describe('Camera Y offset'),
                zoom: z.number().min(0.01).describe('Zoom level (1.0 = 100%)'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.camera.set', args)
        );

        server.tool(
            'openspace.whiteboard.camera.fit',
            'Fit the whiteboard camera to show all shapes (or specified shapes)',
            {
                shapeIds: z.array(z.string()).optional()
                    .describe('Shape IDs to fit into view; omit to fit all shapes'),
                padding: z.number().optional().describe('Padding in pixels around the fitted area (default 40)'),
            },
            async (args: any) => this.executeViaBridge('openspace.whiteboard.camera.fit', args)
        );

        server.tool(
            'openspace.whiteboard.camera.get',
            'Get the current whiteboard camera position and zoom level',
            {},
            async (args: any) => this.executeViaBridge('openspace.whiteboard.camera.get', args)
        );

        server.tool(
            'openspace.whiteboard.batch_add_shapes',
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
            async (args: any) => this.executeViaBridge('openspace.whiteboard.batch_add_shapes', args)
        );

        server.tool(
            'openspace.whiteboard.replace',
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
            async (args: any) => this.executeViaBridge('openspace.whiteboard.replace', args)
        );

        server.tool(
            'openspace.whiteboard.find_shapes',
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
            async (args: any) => this.executeViaBridge('openspace.whiteboard.find_shapes', args)
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

        const requestId = `${cmd}-${crypto.randomUUID()}`;

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
