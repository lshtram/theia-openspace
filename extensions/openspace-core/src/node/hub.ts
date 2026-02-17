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
import { CommandManifest, HubState, PaneStateSnapshot } from '../common/command-manifest';

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
@injectable()
export class OpenSpaceHub implements BackendApplicationContribution {
    @inject(ILogger) protected readonly logger!: ILogger;

    private state: HubState = {
        manifest: null,
        paneState: null,
        lastManifestUpdate: null,
        lastStateUpdate: null
    };

    /**
     * Configure Express routes for the Hub.
     */
    configure(app: Application): void {
        // POST /openspace/manifest - Receive command manifest from frontend
        app.post('/openspace/manifest', (req, res) => this.handleManifest(req, res));

        // GET /openspace/instructions - Generate system prompt
        app.get('/openspace/instructions', (req, res) => this.handleInstructions(req, res));

        // POST /openspace/state - Receive IDE state updates from frontend
        app.post('/openspace/state', (req, res) => this.handleState(req, res));

        this.logger.info('[Hub] OpenSpace Hub configured');
    }

    /**
     * Cleanup on backend shutdown.
     */
    onStop(): void {
        // Hub is stateless cache — no cleanup needed
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
        instructions += `Commands are executed sequentially in order of appearance.\n`;

        return instructions;
    }
}
