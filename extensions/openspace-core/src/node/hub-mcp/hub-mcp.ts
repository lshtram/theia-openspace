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

import { AgentCommand } from '../../common/command-manifest';
import { ArtifactStore } from '../artifact-store';
import { PatchEngine } from '../patch-engine';

import type { IMcpServer, BridgeDeps, FileDeps, HubLogger } from './types';
import { registerPaneTools } from './pane-tools';
import { registerEditorTools } from './editor-tools';
import { registerTerminalTools } from './terminal-tools';
import { registerFileTools } from './file-tools';
import { registerPresentationTools } from './presentation-tools';
import { registerWhiteboardTools } from './whiteboard-tools';
import { registerVoiceTools } from './voice-tools';

// Use exports-map compatible require paths (the package.json exports map resolves these correctly)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
 * OpenSpaceMcpServer — MCP server that registers 46 OpenSpace IDE control tools and
 * mounts them on the Express app at POST/GET/DELETE /mcp.
 *
 * Architecture (T3):
 *  1. Agent (opencode) calls an MCP tool.
 *  2. File tools (read/write/list/search/patch) are handled directly via file-tools.ts.
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

    private workspaceRoot: string;
    private readonly logger: HubLogger;

    private artifactStore!: ArtifactStore;
    private patchEngine!: PatchEngine;

    private readonly commandTimeoutMs = 30_000; // 30 seconds

    constructor(workspaceRoot: string, logger?: HubLogger) {
        this.workspaceRoot = workspaceRoot;
        this.logger = logger ?? console;
        this.artifactStore = new ArtifactStore(this.workspaceRoot);
        this.patchEngine = new PatchEngine(this.workspaceRoot, this.artifactStore);
        this.patchEngine.loadVersions().catch((err: unknown) =>
            this.logger.error('[Hub] Failed to load patch versions:', err)
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

    // ─── Tool Registration (delegated to extracted modules) ───────────────────

    private registerToolsOn(server: IMcpServer): void {
        const bridgeDeps: BridgeDeps = {
            executeViaBridge: (cmd, args) => this.executeViaBridge(cmd, args),
        };
        const fileDeps: FileDeps = {
            ...bridgeDeps,
            workspaceRoot: this.workspaceRoot,
            artifactStore: this.artifactStore,
            patchEngine: this.patchEngine,
            logger: this.logger,
        };

        registerPaneTools(server, bridgeDeps);
        registerEditorTools(server, bridgeDeps);
        registerTerminalTools(server, bridgeDeps);
        registerFileTools(server, fileDeps);
        registerPresentationTools(server, {
            ...bridgeDeps,
            workspaceRoot: this.workspaceRoot,
            logger: this.logger,
        });
        registerWhiteboardTools(server, bridgeDeps);
        registerVoiceTools(server, bridgeDeps);
    }

    // ─── Bridge Execution ─────────────────────────────────────────────────────

    /**
     * Execute an IDE-control command by forwarding it to the browser via bridgeCallback.
     * Returns a Promise that resolves when the browser posts back the command result.
     */
    private async executeViaBridge(cmd: string, args: unknown): Promise<unknown> {
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
}
