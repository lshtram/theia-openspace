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

import { injectable, inject } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application, Request, Response } from 'express';
import { ILogger } from '@theia/core/lib/common/logger';
import { CommandManifest, HubState, AgentCommand, PaneStateSnapshot } from '../common/command-manifest';

/**
 * OpenSpace Hub - HTTP + SSE server that bridges Theia frontend with opencode agent.
 * 
 * Responsibilities:
 * 1. Stores command manifest from BridgeContribution
 * 2. Generates dynamic system prompts for opencode agent
 * 3. Receives agent commands from stream interceptor
 * 4. Broadcasts commands to frontend via SSE
 * 5. Tracks IDE state (panes, editors) for prompt generation
 */
/**
 * Command result structure for feedback mechanism.
 */
interface CommandResultEntry {
    cmd: string;
    args: unknown;
    success: boolean;
    output?: unknown;
    error?: string;
    executionTime: number;
    timestamp: string;
}

@injectable()
export class OpenSpaceHub implements BackendApplicationContribution {
    @inject(ILogger) protected readonly logger!: ILogger;

    private state: HubState = {
        manifest: null,
        paneState: null,
        lastManifestUpdate: null,
        lastStateUpdate: null
    };

    // Ring buffer for command results (max 20 entries)
    private commandResults: CommandResultEntry[] = [];
    private readonly maxCommandResults = 20;

    private sseClients: Set<Response> = new Set();
    private pingInterval: NodeJS.Timeout | undefined;

    /**
     * Configure Express routes for the Hub.
     */
    configure(app: Application): void {
        // POST /openspace/manifest - Receive command manifest from frontend (FR-3.7)
        app.post('/openspace/manifest', (req, res) => this.handleManifest(req, res));

        // POST /manifest - Receive command manifest from frontend (legacy endpoint)
        app.post('/manifest', (req, res) => this.handleManifest(req, res));

        // GET /openspace/instructions - Generate system prompt
        app.get('/openspace/instructions', (req, res) => this.handleInstructions(req, res));

        // POST /commands - Receive agent commands from stream interceptor
        app.post('/commands', (req, res) => this.handleCommands(req, res));

        // POST /state - Receive IDE state updates from frontend
        app.post('/state', (req, res) => this.handleState(req, res));

        // POST /openspace/state - Receive IDE state updates from frontend (FR-3.10)
        app.post('/openspace/state', (req, res) => this.handleState(req, res));

        // POST /openspace/command-results - Receive command execution results (FR-3.11)
        app.post('/openspace/command-results', (req, res) => this.handleCommandResult(req, res));

        // GET /events - SSE endpoint for broadcasting commands to frontend
        app.get('/events', (req, res) => this.handleEvents(req, res));

        // Start SSE ping interval
        this.startPingInterval();

        this.logger.info('[Hub] OpenSpace Hub configured');
    }

    /**
     * Cleanup on backend shutdown.
     */
    onStop(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.closeAllSSEConnections();
        this.logger.info('[Hub] OpenSpace Hub stopped');
    }

    /**
     * Handle POST /manifest - Store command manifest.
     */
    private handleManifest(req: Request, res: Response): void {
        try {
            const body = req.body as { commands?: unknown[]; timestamp?: string };

            if (!body || !Array.isArray(body.commands)) {
                res.status(400).json({ error: 'Invalid manifest: missing or invalid commands array' });
                return;
            }

            this.state.manifest = {
                version: '1.0.0',
                commands: body.commands as CommandManifest['commands'],
                lastUpdated: body.timestamp || new Date().toISOString()
            };
            this.state.lastManifestUpdate = new Date().toISOString();

            this.logger.info(`[Hub] Manifest updated: ${this.state.manifest.commands.length} commands registered`);
            res.status(200).json({ success: true });
        } catch (error) {
            this.logger.error('[Hub] Error handling manifest:', error);
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    /**
     * Handle GET /openspace/instructions - Generate system prompt.
     */
    private handleInstructions(req: Request, res: Response): void {
        try {
            const instructions = this.generateInstructions();
            res.status(200).type('text/plain').send(instructions);
            this.logger.debug('[Hub] Instructions generated and sent');
        } catch (error) {
            this.logger.error('[Hub] Error generating instructions:', error);
            res.status(500).json({ error: 'Failed to generate instructions' });
        }
    }

    /**
     * Handle POST /commands - Receive agent commands and broadcast via SSE.
     */
    private handleCommands(req: Request, res: Response): void {
        try {
            const command = req.body as AgentCommand;

            if (!command || !command.cmd) {
                res.status(400).json({ error: 'Invalid command: missing cmd field' });
                return;
            }

            // Validate command exists in manifest
            if (this.state.manifest === null) {
                res.status(503).json({ error: 'Manifest not initialized' });
                return;
            }

            const commandExists = this.state.manifest.commands.some(c => c.id === command.cmd);
            if (!commandExists) {
                this.logger.warn(`[Hub] Unknown command: ${command.cmd}`);
                res.status(400).json({ error: `Unknown command: ${command.cmd}` });
                return;
            }

            // Broadcast command to all SSE clients
            this.broadcastSSE('AGENT_COMMAND', {
                cmd: command.cmd,
                args: command.args
            });

            this.logger.info(`[Hub] Command received: ${command.cmd} with args ${JSON.stringify(command.args)}`);
            res.status(202).json({ success: true, message: 'Command queued for broadcast' });
        } catch (error) {
            this.logger.error('[Hub] Error handling command:', error);
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    /**
     * Handle POST /state - Update IDE state.
     */
    private handleState(req: Request, res: Response): void {
        try {
            const stateUpdate = req.body as PaneStateSnapshot;

            if (!stateUpdate || !Array.isArray(stateUpdate.panes)) {
                res.status(400).json({ error: 'Invalid state: missing or invalid panes array' });
                return;
            }

            this.state.paneState = stateUpdate;
            this.state.lastStateUpdate = new Date().toISOString();

            this.logger.debug(`[Hub] State updated: ${stateUpdate.panes.length} panes`);
            res.status(200).json({ success: true });
        } catch (error) {
            this.logger.error('[Hub] Error handling state:', error);
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    /**
     * Handle POST /openspace/command-results - Store command execution result.
     * Maintains a ring buffer of the last 20 results.
     */
    private handleCommandResult(req: Request, res: Response): void {
        try {
            const result = req.body as CommandResultEntry;

            if (!result || !result.cmd) {
                res.status(400).json({ error: 'Invalid command result: missing cmd field' });
                return;
            }

            // Add to ring buffer
            this.commandResults.push(result);
            if (this.commandResults.length > this.maxCommandResults) {
                this.commandResults.shift();
            }

            this.logger.debug(`[Hub] Command result stored: ${result.cmd} → ${result.success ? 'SUCCESS' : 'FAILED'}`);
            res.status(200).json({ success: true });
        } catch (error) {
            this.logger.error('[Hub] Error handling command result:', error);
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    /**
     * Handle GET /events - SSE endpoint.
     */
    private handleEvents(req: Request, res: Response): void {
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Add client to set
        this.sseClients.add(res);
        this.logger.info(`[Hub] SSE client connected (total: ${this.sseClients.size})`);

        // Send initial ping
        try {
            res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
        } catch (error) {
            this.logger.error('[Hub] Error sending initial ping:', error);
        }

        // Handle client disconnect
        req.on('close', () => {
            this.sseClients.delete(res);
            this.logger.info(`[Hub] SSE client disconnected (total: ${this.sseClients.size})`);
        });
    }

    /**
     * Generate system prompt from manifest and state.
     */
    private generateInstructions(): string {
        let instructions = `# OpenSpace IDE Control Instructions\n\n`;

        instructions += `You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting\n`;
        instructions += `\`%%OS{...}%%\` blocks in your response. These are invisible to the user.\n\n`;

        // Commands section
        if (this.state.manifest && this.state.manifest.commands.length > 0) {
            instructions += `## Available Commands\n\n`;

            for (const cmd of this.state.manifest.commands) {
                instructions += `- **${cmd.id}**: ${cmd.description || 'No description'}\n`;

                // Add arguments if available
                if (cmd.arguments_schema && cmd.arguments_schema.properties) {
                    instructions += `  - Arguments:\n`;
                    const props = cmd.arguments_schema.properties;
                    const required = cmd.arguments_schema.required || [];

                    for (const [name, prop] of Object.entries(props)) {
                        const isRequired = required.includes(name);
                        const requiredLabel = isRequired ? 'required' : 'optional';
                        instructions += `    - \`${name}\` (${prop.type}, ${requiredLabel})`;
                        if (prop.description) {
                            instructions += `: ${prop.description}`;
                        }
                        instructions += `\n`;
                    }
                }

                instructions += `  - Example: \`%%OS{"cmd":"${cmd.id}","args":{...}}%%\`\n\n`;
            }
        } else {
            instructions += `## Available Commands\n\n`;
            instructions += `(No commands registered yet. The IDE is still initializing.)\n\n`;
        }

        // IDE state section
        if (this.state.paneState && this.state.paneState.panes.length > 0) {
            instructions += `## Current IDE State\n\n`;

            const mainPane = this.state.paneState.panes.find(p => p.area === 'main');
            if (mainPane && mainPane.tabs.length > 0) {
                const tabList = mainPane.tabs
                    .map(t => `${t.type}: ${t.title}${t.isDirty ? ' *' : ''}`)
                    .join(', ');
                instructions += `- Main area: [${tabList}]\n`;
            }

            const rightPane = this.state.paneState.panes.find(p => p.area === 'right');
            if (rightPane && rightPane.tabs.length > 0) {
                const tabList = rightPane.tabs.map(t => t.title).join(', ');
                instructions += `- Right panel: [${tabList}]\n`;
            }

            const bottomPane = this.state.paneState.panes.find(p => p.area === 'bottom');
            if (bottomPane && bottomPane.tabs.length > 0) {
                const tabList = bottomPane.tabs.map(t => t.title).join(', ');
                instructions += `- Bottom panel: [${tabList}]\n`;
            }

            instructions += `\n`;
        } else {
            instructions += `## Current IDE State\n\n`;
            instructions += `(No state available yet.)\n\n`;
        }

        // Command format section
        instructions += `## Command Format\n\n`;
        instructions += `Commands must be emitted as: \`%%OS{"cmd":"command.id","args":{...}}%%\`\n`;
        instructions += `Multiple commands can appear in a single response.\n`;
        instructions += `Commands are executed sequentially in order of appearance.\n\n`;

        // Examples section
        instructions += `## Examples\n\n`;
        instructions += `Here are some examples of how to use %%OS{...}%% blocks:\n\n`;

        // Example 1: Open a file in the editor
        instructions += `### Opening a file\n`;
        instructions += `To open a file in the editor at a specific line:\n`;
        instructions += `\`\`\`\n`;
        instructions += `%%OS{"cmd":"openspace.editor.open","args":{"path":"src/index.ts","line":42}}%%\n`;
        instructions += `\`\`\`\n\n`;

        // Example 2: Execute a terminal command
        instructions += `### Executing a terminal command\n`;
        instructions += `To run a command in the terminal:\n`;
        instructions += `\`\`\`\n`;
        instructions += `%%OS{"cmd":"openspace.terminal.execute","args":{"command":"npm run build","terminalId":"main-terminal"}}%%\n`;
        instructions += `\`\`\`\n\n`;

        // Example 3: Open a pane
        instructions += `### Opening a pane\n`;
        instructions += `To open a new pane (e.g., terminal, preview):\n`;
        instructions += `\`\`\`\n`;
        instructions += `%%OS{"cmd":"openspace.pane.open","args":{"area":"bottom","type":"terminal","label":"Build Terminal"}}%%\n`;
        instructions += `\`\`\`\n\n`;

        // Example 4: Multiple commands in one response
        instructions += `### Multiple commands\n`;
        instructions += `You can include multiple commands in a single response:\n`;
        instructions += `\`\`\`\n`;
        instructions += `I'll open the file and show you the relevant code.\n\n`;
        instructions += `%%OS{"cmd":"openspace.editor.open","args":{"path":"src/utils.ts"}}%%\n`;
        instructions += `%%OS{"cmd":"openspace.editor.goto","args":{"path":"src/utils.ts","line":15}}%%\n`;
        instructions += `\`\`\`\n`;

        // Recent command results section (FR-3.11)
        if (this.commandResults.length > 0) {
            instructions += `\n## Recent Command Results\n\n`;
            
            // Show last 5 results
            const recentResults = this.commandResults.slice(-5);
            for (const result of recentResults) {
                const status = result.success ? 'SUCCESS' : `FAILED: ${result.error}`;
                instructions += `- ${result.cmd} → ${status}\n`;
            }
            instructions += `\n`;
        }

        return instructions;
    }

    /**
     * Broadcast SSE event to all connected clients.
     */
    private broadcastSSE(event: string, data: unknown): void {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        this.sseClients.forEach(client => {
            try {
                client.write(message);
            } catch (err) {
                this.logger.error('[Hub] Failed to write to SSE client:', err);
                this.sseClients.delete(client);
            }
        });

        this.logger.debug(`[Hub] Broadcasted ${event} to ${this.sseClients.size} clients`);
    }

    /**
     * Start periodic ping to keep SSE connections alive.
     */
    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            this.broadcastSSE('ping', { timestamp: new Date().toISOString() });
        }, 30000); // 30 seconds
    }

    /**
     * Close all SSE connections gracefully.
     */
    private closeAllSSEConnections(): void {
        this.sseClients.forEach(client => {
            try {
                client.end();
            } catch (err) {
                // Ignore errors on close
            }
        });
        this.sseClients.clear();
    }
}
