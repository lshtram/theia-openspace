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
import { MutableHubState, AgentCommand, PaneStateSnapshot, CommandDefinition } from '../common/command-manifest';
import { OpenSpaceMcpServer, CommandBridgeResult } from './hub-mcp';

/**
 * OpenSpace Hub - HTTP server bridging Theia frontend with the opencode MCP agent.
 *
 * T3 Architecture:
 * 1. Serves MCP tools at /mcp (via OpenSpaceMcpServer).
 * 2. Maintains IDE state (panes) for system prompt generation.
 * 3. Relays agent commands from MCP tools to the browser via RPC (onAgentCommand).
 * 4. Receives command results from the browser (POST /openspace/command-results)
 *    and resolves the pending MCP tool Promises.
 */
@injectable()
export class OpenSpaceHub implements BackendApplicationContribution {
    @inject(ILogger) protected readonly logger!: ILogger;

    // Internal mutable state
    private state: MutableHubState = {
        manifest: null,
        paneState: null,
        lastManifestUpdate: null,
        lastStateUpdate: null
    };

    /**
     * Allowed origins for CORS and origin validation.
     */
    private readonly allowedOrigins: string[] = (() => {
        const theiaPort = process.env['PORT'] || '3000';
        const defaults = [
            `http://localhost:${theiaPort}`,
            `http://127.0.0.1:${theiaPort}`,
        ];
        const envOrigins = process.env['OPENSPACE_HUB_ORIGINS'];
        if (!envOrigins) {
            return defaults;
        }
        const extra = envOrigins.split(',').map(s => s.trim()).filter(Boolean);
        return [...new Set([...defaults, ...extra])];
    })();

    /** MCP server — registered tools live here. */
    private mcpServer!: OpenSpaceMcpServer;

    /**
     * Validate request origin and set CORS headers.
     */
    private validateOrigin(req: Request, res: Response, next: () => void): void {
        const origin = req.headers.origin || req.headers.referer || '';

        // Task 6: Reject requests with empty/undefined origin to prevent
        // unauthenticated local process access to hub endpoints
        if (!origin) {
            this.logger.warn('[Hub] Rejected request with missing Origin header');
            res.status(403).json({ error: 'Forbidden: Origin header required' });
            return;
        }

        // Parse origin as URL and compare protocol+hostname+port strictly to
        // prevent prefix-matching bypass (e.g. http://localhost:3000.evil.tld).
        let parsedOrigin: URL;
        try {
            parsedOrigin = new URL(origin);
        } catch {
            this.logger.warn(`[Hub] Rejected request with unparseable Origin header: ${origin}`);
            res.status(403).json({ error: 'Forbidden: Invalid origin' });
            return;
        }
        const normalizedOrigin = `${parsedOrigin.protocol}//${parsedOrigin.hostname}:${parsedOrigin.port || (parsedOrigin.protocol === 'https:' ? '443' : '80')}`;

        const isAllowed = this.allowedOrigins.some(allowed => {
            try {
                const parsedAllowed = new URL(allowed);
                const normalizedAllowed = `${parsedAllowed.protocol}//${parsedAllowed.hostname}:${parsedAllowed.port || (parsedAllowed.protocol === 'https:' ? '443' : '80')}`;
                return normalizedOrigin === normalizedAllowed;
            } catch {
                return false;
            }
        });

        if (!isAllowed) {
            this.logger.warn(`[Hub] Rejected request from invalid origin: ${origin}`);
            res.status(403).json({ error: 'Forbidden: Invalid origin' });
            return;
        }

        const allowedOrigin = origin;
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        next();
    }

    /**
     * Configure Express routes for the Hub.
     */
    configure(app: Application): void {
        // Resolve workspace root (use HOME as fallback)
        const workspaceRoot = process.env.THEIA_WORKSPACE_ROOT || process.cwd();
        this.mcpServer = new OpenSpaceMcpServer(workspaceRoot);

        // Mount MCP at /mcp (POST, GET, DELETE) — no origin restriction (MCP clients connect directly)
        this.mcpServer.mount(app);

        // POST /openspace/register-bridge — browser registers itself as the command bridge
        // Require a valid browser origin so arbitrary local processes cannot register as a bridge
        app.post('/openspace/register-bridge', (req, res, next) => this.validateOrigin(req, res, next), (req, res) => this.handleRegisterBridge(req, res));

        // POST /openspace/manifest — Receive command manifest from frontend (kept for backwards compat)
        app.post('/openspace/manifest', (req, res, next) => this.validateOrigin(req, res, next), (req, res) => this.handleManifest(req, res));
        // Backwards-compat alias: apply the same origin middleware as /openspace/* routes
        app.post('/manifest', (req, res, next) => this.validateOrigin(req, res, next), (req, res) => this.handleManifest(req, res));

        // GET /openspace/instructions — Generate system prompt (no origin restriction; used by agents and tooling)
        app.get('/openspace/instructions', (req, res) => this.handleInstructions(req, res));

        // POST /openspace/state — Receive IDE state updates from frontend
        // Backwards-compat alias: apply the same origin middleware as /openspace/* routes
        app.post('/state', (req, res, next) => this.validateOrigin(req, res, next), (req, res) => this.handleState(req, res));
        app.post('/openspace/state', (req, res, next) => this.validateOrigin(req, res, next), (req, res) => this.handleState(req, res));

        // POST /openspace/command-results — Receive command execution results from browser
        app.post('/openspace/command-results', (req, res, next) => this.validateOrigin(req, res, next), (req, res) => this.handleCommandResult(req, res));

        this.logger.info('[Hub] OpenSpace Hub configured (T3 MCP mode)');
    }

    /**
     * Cleanup on backend shutdown.
     */
    onStop(): void {
        this.logger.info('[Hub] OpenSpace Hub stopped');
    }

    /**
     * Handle POST /openspace/register-bridge
     * The browser frontend calls this to register itself as the command bridge.
     * Extracts the RPC client reference stored on the request by the backend module.
     */
    private handleRegisterBridge(req: Request, res: Response): void {
        // The bridgeCallback is provided externally via setClientCallback().
        // The request body may contain metadata, but the real wiring happens
        // when the backend module calls setClientCallback() after startup.
        this.logger.info('[Hub] Browser registered as command bridge');
        res.status(200).json({ success: true, message: 'Bridge registered' });
    }

    /**
     * Called by the backend DI module to wire the RPC client callback.
     * The callback is invoked by hub-mcp when a tool needs the browser to execute a command.
     */
    setClientCallback(callback: (command: AgentCommand) => void): void {
        this.mcpServer.setBridgeCallback(callback);
        this.logger.info('[Hub] MCP bridge callback wired');
    }

    /**
     * Handle POST /openspace/manifest — Store command manifest.
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
                commands: body.commands as CommandDefinition[],
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
     * Handle GET /openspace/instructions — Generate system prompt.
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
     * Handle POST /openspace/state — Update IDE state.
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
     * Handle POST /openspace/command-results — Receive command execution result from browser.
     * If the result has a requestId, resolves the corresponding pending MCP Promise.
     */
    private handleCommandResult(req: Request, res: Response): void {
        try {
            const result = req.body as CommandBridgeResult;

            if (!result || !result.cmd) {
                res.status(400).json({ error: 'Invalid command result: missing cmd field' });
                return;
            }

            this.logger.debug(`[Hub] Command result: ${result.cmd} → ${result.success ? 'SUCCESS' : 'FAILED'}`);

            // If the result has a requestId, resolve the pending MCP Promise
            if (result.requestId) {
                this.mcpServer.resolveCommand(result.requestId, result);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            this.logger.error('[Hub] Error handling command result:', error);
            res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    /**
     * Generate system prompt describing the MCP tools available to the agent.
     */
    private generateInstructions(): string {
        let instructions = `# OpenSpace IDE Control — MCP Tools\n\n`;

        instructions += `You are operating inside Theia OpenSpace IDE. You can control the IDE by calling\n`;
        instructions += `MCP tools provided by the \`openspace-hub\` MCP server.\n\n`;

        instructions += `## Available Tool Categories\n\n`;
        instructions += `- **Pane tools** (4): \`openspace.pane.open\`, \`openspace.pane.close\`, \`openspace.pane.focus\`, \`openspace.pane.list\`\n`;
        instructions += `- **Editor tools** (6): \`openspace.editor.open\`, \`openspace.editor.read_file\`, \`openspace.editor.close\`, \`openspace.editor.scroll_to\`, \`openspace.editor.highlight\`, \`openspace.editor.clear_highlight\`\n`;
        instructions += `- **Terminal tools** (5): \`openspace.terminal.create\`, \`openspace.terminal.send\`, \`openspace.terminal.read_output\`, \`openspace.terminal.list\`, \`openspace.terminal.close\`\n`;
        instructions += `- **File tools** (5, direct): \`openspace.file.read\`, \`openspace.file.write\`, \`openspace.file.list\`, \`openspace.file.search\`, \`openspace.file.patch\`\n`;
        instructions += `- **Artifact tools** (2, direct): \`openspace.artifact.getVersion\`, \`openspace.artifact.patch\`\n`;
        instructions += `- **Presentation tools** (10): \`openspace.presentation.list\`, \`openspace.presentation.read\`, \`openspace.presentation.create\`, \`openspace.presentation.update_slide\`, \`openspace.presentation.open\`, \`openspace.presentation.navigate\`, \`openspace.presentation.play\`, \`openspace.presentation.pause\`, \`openspace.presentation.stop\`, \`openspace.presentation.toggleFullscreen\`\n`;
        instructions += `- **Whiteboard tools** (10): \`openspace.whiteboard.list\`, \`openspace.whiteboard.read\`, \`openspace.whiteboard.create\`, \`openspace.whiteboard.add_shape\`, \`openspace.whiteboard.update_shape\`, \`openspace.whiteboard.delete_shape\`, \`openspace.whiteboard.open\`, \`openspace.whiteboard.camera.set\`, \`openspace.whiteboard.camera.fit\`, \`openspace.whiteboard.camera.get\`\n\n`;

        instructions += `## Usage Notes\n\n`;
        instructions += `- File tools (read/write/list/search/patch) operate directly on the filesystem.\n`;
        instructions += `- IDE-control tools (pane/editor/terminal/presentation/whiteboard) are forwarded to the Theia frontend and return the result.\n`;
        instructions += `- IDE tools time out after 30 seconds if the browser does not respond.\n`;
        instructions += `- For important artifact files (.whiteboard.json, .deck.md, critical configs), prefer \`openspace.artifact.patch\` over \`openspace.file.write\` — it provides atomic writes, backup history, and version conflict detection.\n`;
        instructions += `- Workflow: call \`openspace.artifact.getVersion\` first to get the current \`version\`, then call \`openspace.artifact.patch\` with \`baseVersion: version\`.\n\n`;

        instructions += `## Presentation Tools\n\n`;
        instructions += `- \`openspace.presentation.list\` — list all .deck.md files in the workspace\n`;
        instructions += `- \`openspace.presentation.read {path}\` — read a presentation and its slides\n`;
        instructions += `- \`openspace.presentation.create {path, title, slides[]}\` — create a new presentation\n`;
        instructions += `- \`openspace.presentation.update_slide {path, slideIndex, content}\` — update one slide\n`;
        instructions += `- \`openspace.presentation.open {path, splitDirection?}\` — open the presentation viewer (splitDirection: right|left|bottom|new-tab)\n`;
        instructions += `- \`openspace.presentation.navigate {direction|slideIndex}\` — go to next/prev/first/last slide or a specific index\n`;
        instructions += `- \`openspace.presentation.play {interval?}\` — start autoplay (default 5s per slide)\n`;
        instructions += `- \`openspace.presentation.pause\` — pause autoplay at current slide\n`;
        instructions += `- \`openspace.presentation.stop\` — stop autoplay and return to first slide\n`;
        instructions += `- \`openspace.presentation.toggleFullscreen\` — toggle fullscreen mode\n\n`;

        instructions += `## Whiteboard Tools\n\n`;
        instructions += `- \`openspace.whiteboard.list\` — list all .whiteboard.json files in the workspace\n`;
        instructions += `- \`openspace.whiteboard.read {path}\` — read a whiteboard file and return its shape records\n`;
        instructions += `- \`openspace.whiteboard.create {path, title?}\` — create a new empty whiteboard (optionally add a title label)\n`;
        instructions += `- \`openspace.whiteboard.add_shape {path, type, x, y, width?, height?, props?}\` — add a shape; type is one of rect, ellipse, text, arrow\n`;
        instructions += `- \`openspace.whiteboard.update_shape {path, shapeId, props}\` — update shape properties by ID\n`;
        instructions += `- \`openspace.whiteboard.delete_shape {path, shapeId}\` — remove a shape by ID\n`;
        instructions += `- \`openspace.whiteboard.open {path, splitDirection?}\` — open the whiteboard viewer (splitDirection: right|left|bottom|new-tab)\n`;
        instructions += `- \`openspace.whiteboard.camera.set {x, y, zoom}\` — set camera position and zoom\n`;
        instructions += `- \`openspace.whiteboard.camera.fit {shapeIds?, padding?}\` — fit camera to all shapes or specified shape IDs\n`;
        instructions += `- \`openspace.whiteboard.camera.get\` — get current camera position and zoom\n\n`;

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
        }

        return instructions;
    }
}
