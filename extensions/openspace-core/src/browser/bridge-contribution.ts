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
import { CommandManifest, CommandDefinition, AgentCommand } from '../common/command-manifest';

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

    private eventSource?: EventSource;
    private reconnectAttempts = 0;
    private reconnectTimer?: number;
    private readonly maxReconnectDelay = 30000; // 30 seconds
    private readonly hubBaseUrl = 'http://localhost:3001'; // TODO: Phase 5.2 - make configurable via preferences

    /**
     * Called when the frontend application starts.
     * Publishes command manifest and establishes SSE connection.
     */
    async onStart(): Promise<void> {
        console.info('[BridgeContribution] Starting...');
        
        // Publish command manifest
        await this.publishManifest();
        
        // Establish SSE connection
        this.connectSSE();
    }

    /**
     * Called when the frontend application stops.
     * Closes SSE connection and cleans up resources.
     */
    onStop(): void {
        console.info('[BridgeContribution] Stopping...');
        this.disconnectSSE();
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

    /**
     * Establish SSE connection to Hub.
     * 
     * Connection Details:
     * - URL: http://localhost:3001/openspace/events
     * - Protocol: Server-Sent Events (EventSource)
     * - Event Types: AGENT_COMMAND, ping
     * - Auto-reconnect: exponential backoff on error
     * 
     * Event Handlers:
     * - onopen: resets reconnect counter
     * - onmessage: parses and dispatches commands
     * - onerror: triggers reconnection
     */
    private connectSSE(): void {
        console.info('[BridgeContribution] Connecting to Hub SSE...');
        
        this.eventSource = new EventSource(`${this.hubBaseUrl}/openspace/events`);
        
        this.eventSource.onopen = () => {
            console.info('[BridgeContribution] SSE connection established');
            this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
        };
        
        this.eventSource.onmessage = (event: MessageEvent) => {
            this.handleSSEEvent(event);
        };
        
        this.eventSource.onerror = () => {
            console.warn('[BridgeContribution] SSE disconnected, reconnecting...');
            this.reconnectSSE();
        };
    }

    /**
     * Handle incoming SSE events.
     * 
     * Event Format:
     * {
     *   "type": "AGENT_COMMAND",
     *   "data": {
     *     "cmd": "openspace.pane.open",
     *     "args": { "type": "editor", "uri": "file:///path/to/file" }
     *   }
     * }
     * 
     * Processing Steps:
     * 1. Parse JSON event data
     * 2. Validate event type
     * 3. Extract cmd and args
     * 4. Execute command via CommandRegistry
     * 
     * Error Handling:
     * - Parse error: log and skip
     * - Unknown event type: log warning
     * - Invalid event data: log error
     */
    private handleSSEEvent(event: MessageEvent): void {
        try {
            const parsedEvent = JSON.parse(event.data);
            
            if (parsedEvent.type === 'AGENT_COMMAND') {
                const agentCommand: AgentCommand = parsedEvent.data;
                console.info(`[BridgeContribution] Received command: ${agentCommand.cmd}`);
                
                // Execute command via CommandRegistry
                this.executeCommand(agentCommand);
            } else if (parsedEvent.type === 'ping') {
                // Ignore keepalive pings
                console.debug('[BridgeContribution] Received ping');
            } else {
                console.warn(`[BridgeContribution] Unknown event type: ${parsedEvent.type}`);
            }
        } catch (error: any) {
            console.error('[BridgeContribution] Invalid event data:', error);
        }
    }

    /**
     * Execute agent command via CommandRegistry.
     * 
     * Steps:
     * 1. Check if command exists in registry
     * 2. Convert args to array format if needed
     * 3. Execute via commandRegistry.executeCommand()
     * 
     * Error Handling:
     * - Command not found: log warning, skip execution
     * - Execution error: log error, continue (don't block subsequent commands)
     * 
     * @param agentCommand Command to execute with id and arguments
     */
    private async executeCommand(agentCommand: AgentCommand): Promise<void> {
        try {
            const { cmd, args } = agentCommand;
            
            // Check if command exists
            if (!this.commandRegistry.getCommand(cmd)) {
                console.warn(`[BridgeContribution] Unknown command: ${cmd}`);
                return;
            }
            
            // Execute command - convert args to array format
            // If args is an object, wrap in array; if array, use as-is; if undefined, use empty array
            const argsArray = args ? (Array.isArray(args) ? args : [args]) : [];
            await this.commandRegistry.executeCommand(cmd, ...argsArray);
            
            console.debug(`[BridgeContribution] Command executed: ${cmd}`);
        } catch (error: any) {
            console.error(`[BridgeContribution] Command execution failed:`, error);
        }
    }

    /**
     * Disconnect SSE connection and clean up resources.
     * 
     * Cleanup Steps:
     * 1. Close EventSource if exists
     * 2. Clear reconnection timer if pending
     * 3. Reset state variables
     * 
     * Memory Safety:
     * - Ensures EventSource is properly closed
     * - Clears timers to prevent memory leaks
     */
    private disconnectSSE(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
            console.debug('[BridgeContribution] SSE connection closed');
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    /**
     * Reconnect SSE with exponential backoff.
     * 
     * Backoff Strategy:
     * - Initial delay: 1 second
     * - Exponential: delay = 1s * 2^attempts
     * - Formula: Math.min(1000 * 2^attempts, 30000)
     * - Max delay: 30 seconds
     * 
     * Example Delays:
     * - Attempt 0: 1s
     * - Attempt 1: 2s
     * - Attempt 2: 4s
     * - Attempt 3: 8s
     * - Attempt 4: 16s
     * - Attempt 5+: 30s (max)
     * 
     * Implementation:
     * 1. Disconnect existing connection
     * 2. Calculate delay with exponential backoff
     * 3. Schedule reconnection with setTimeout
     * 4. Increment attempt counter
     */
    private reconnectSSE(): void {
        this.disconnectSSE();
        
        const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );
        
        console.debug(`[BridgeContribution] Reconnecting in ${delay}ms...`);
        
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectAttempts++;
            this.connectSSE();
        }, delay);
    }

    // NOTE: publishPaneState() method deferred to Phase 2
    // Future implementation will:
    // - Collect pane state from ApplicationShell
    // - Build PaneStateSnapshot
    // - POST to http://localhost:3001/openspace/state
    // - Support system prompt generation with IDE context
}
