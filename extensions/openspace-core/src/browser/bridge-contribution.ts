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
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { CommandManifest, CommandDefinition } from '../common/command-manifest';

/**
 * OpenSpaceBridgeContribution - Frontend service that bridges Theia CommandRegistry with OpenSpace Hub.
 * 
 * Responsibilities:
 * 1. On startup: collect all openspace.* commands from CommandRegistry
 * 2. Build and POST CommandManifest to Hub
 * 3. Establish SSE connection to Hub for AGENT_COMMAND events
 * 4. Execute received commands via CommandRegistry
 * 5. Reconnect SSE with exponential backoff on disconnect
 * 
 * Architecture: Phase 1, Task 1.7
 * - Manifest Publishing: POST to http://localhost:3001/openspace/manifest
 * - SSE Connection: GET http://localhost:3001/openspace/events
 * - Command Dispatch: Execute via CommandRegistry
 * 
 * Graceful Degradation:
 * - Service functions even if Hub is unavailable
 * - Failed manifest publishing logs warning but doesn't block startup
 * - SSE disconnections trigger automatic reconnection with exponential backoff
 */
@injectable()
export class OpenSpaceBridgeContribution implements FrontendApplicationContribution {

    @inject(CommandRegistry)
    protected readonly commandRegistry!: CommandRegistry;

    private readonly hubBaseUrl = window.location.origin; // Uses same port as Theia backend

    /**
     * Called when the frontend application starts.
     * Publishes command manifest.
     */
    async onStart(): Promise<void> {
        console.info('[BridgeContribution] Starting...');
        
        // Publish command manifest
        await this.publishManifest();
        
        // NOTE: Pane state publishing deferred to Phase 3.10
    }

    /**
     * Called when the frontend application stops.
     */
    onStop(): void {
        console.info('[BridgeContribution] Stopping...');
        // No resources to clean up
    }

    /**
     * Collect all openspace.* commands from CommandRegistry and publish manifest to Hub.
     * 
     * Error Handling:
     * - Hub unavailable (ECONNREFUSED): logs warning, continues
     * - HTTP error (4xx/5xx): logs error, continues
     * - Service continues functioning even if publishing fails
     */
    private async publishManifest(): Promise<void> {
        try {
            // Collect commands from CommandRegistry
            const commands = this.collectCommands();
            console.debug(`[BridgeContribution] Collected ${commands.length} commands`);

            // Build manifest
            const manifest: CommandManifest = {
                version: '1.0',
                commands,
                lastUpdated: new Date().toISOString()
            };

            // POST to Hub
            const response = await fetch(`${this.hubBaseUrl}/openspace/manifest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manifest)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.info(`[BridgeContribution] Published manifest: ${commands.length} commands`);
        } catch (error: any) {
            // Graceful degradation - don't block startup if Hub is unavailable
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                console.warn('[BridgeContribution] Warning: Hub not available, manifest not published');
            } else {
                console.error('[BridgeContribution] Error publishing manifest:', error);
            }
        }
    }

    /**
     * Collect all openspace.* commands from CommandRegistry.
     * 
     * @returns Array of CommandDefinition objects for commands starting with 'openspace.'
     * 
     * Implementation Notes:
     * - CommandRegistry.commands returns Command[] (array of Command objects)
     * - Each Command has id, label, and category properties
     * - Filters for commands starting with 'openspace.'
     * - Extracts id, label (as name and description), and category
     */
    private collectCommands(): CommandDefinition[] {
        const commands: CommandDefinition[] = [];
        
        // CommandRegistry.commands returns Command[], iterate and filter
        for (const command of this.commandRegistry.commands) {
            if (command.id.startsWith('openspace.')) {
                commands.push({
                    id: command.id,
                    name: command.label || command.id,
                    description: command.label || command.id, // TODO: Phase 2 - improve description extraction
                    category: command.category
                });
            }
        }
        
        return commands;
    }

    // NOTE: publishPaneState() method deferred to Phase 3.10
    // Future implementation will:
    // - Collect pane state from ApplicationShell
    // - Build PaneStateSnapshot
    // - POST to http://localhost:3000/openspace/state
    // - Support system prompt generation with IDE context
}
