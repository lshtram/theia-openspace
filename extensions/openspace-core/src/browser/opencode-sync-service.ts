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
import { Emitter, Event } from '@theia/core';
import { CommandRegistry } from '@theia/core/lib/common/command';
import {
    OpenCodeClient,
    SessionNotification,
    MessageNotification,
    FileNotification,
    PermissionNotification
} from '../common/opencode-protocol';
import { AgentCommand } from '../common/command-manifest';
import { SessionService } from './session-service';

/**
 * OpenCodeSyncService Symbol for DI binding.
 */
export const OpenCodeSyncService = Symbol('OpenCodeSyncService');

/**
 * OpenCodeSyncService interface - RPC callback handler for SSE events.
 * 
 * This service implements the OpenCodeClient interface, receiving events
 * forwarded from the backend (OpenCodeProxy) via RPC callbacks. It updates
 * SessionService state accordingly, enabling reactive UI updates.
 * 
 * Event Flow:
 * OpenCode Server → SSE → Backend (OpenCodeProxy) → RPC callback → SyncService → SessionService → UI
 */
export interface OpenCodeSyncService extends OpenCodeClient {
    /**
     * Event fired when a permission request is received.
     * External components (e.g., PermissionDialogContribution) can subscribe to this event.
     */
    readonly onPermissionRequested: Event<PermissionNotification>;
}

/**
 * OpenCodeSyncService implementation.
 * 
 * Key Responsibilities:
 * - Receive SSE events via RPC callbacks from backend
 * - Track streaming messages (created → partial → completed)
 * - Update SessionService state for active session only
 * - Never throw exceptions from callback methods (to prevent RPC connection breakage)
 * - Log all events comprehensively
 * 
 * Design Decisions:
 * - Only processes events for the currently active session
 * - Maintains internal Map for tracking in-progress streaming messages
 * - All errors are caught and logged (graceful degradation)
 * - Uses SessionService public update methods for state changes
 */
@injectable()
export class OpenCodeSyncServiceImpl implements OpenCodeSyncService {

    /**
     * SessionService is NOT injected via @inject to break a circular DI dependency:
     *   OpenCodeSyncService → SessionService → OpenCodeService → OpenCodeClient → OpenCodeSyncService
     * Instead, it is wired lazily via setSessionService() after DI resolution completes.
     * This is safe because all callback methods (onSessionEvent, etc.) are only invoked
     * by RPC events that arrive well after DI initialization.
     */
    private _sessionService?: SessionService;

    @inject(CommandRegistry)
    private commandRegistry!: CommandRegistry;

    setSessionService(sessionService: SessionService): void {
        this._sessionService = sessionService;
        console.info('[SyncService] SessionService wired successfully');

        // T3-7: Subscribe to session changes to clear streaming messages
        sessionService.onActiveSessionChanged(() => {
            this.streamingMessages.clear();
            console.debug('[SyncService] Streaming messages cleared on session change');
        });

        // T3-test: Expose test helpers for E2E testing (always in browser context)
        // Creates or extends window.__openspace_test__ unconditionally.
        // Note: PermissionDialogContribution.onStart() may not have run yet (timing race),
        // so we cannot rely on __openspace_test__ already existing — we create it if needed.
        // Note: process is not reliable in webpack lazy-loaded chunks; guard removed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof window !== 'undefined') {
            // Create __openspace_test__ if it doesn't exist yet, then merge in SyncService hooks
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof (window as any).__openspace_test__ === 'undefined') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__openspace_test__ = {};
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.assign((window as any).__openspace_test__, {
                triggerAgentCommand: (cmd: AgentCommand) => {
                    this.onAgentCommand(cmd);
                },
                getLastDispatchedCommand: () => this._lastDispatchedCommand,
                injectMessageEvent: (event: MessageNotification) => {
                    this.onMessageEvent(event);
                }
            });
            console.info('[SyncService] E2E test helpers exposed');
        }
    }

    protected get sessionService(): SessionService {
        if (!this._sessionService) {
            throw new Error(
                'SessionService not initialized. setSessionService() must be called during DI wiring. ' +
                'This is a bug in openspace-core-frontend-module.ts'
            );
        }
        return this._sessionService;
    }

    /**
     * Internal state for tracking streaming messages.
     * Maps messageId → accumulated text.
     */
    private streamingMessages = new Map<string, { text: string }>();

    /**
     * Command queue for sequential execution.
     */
    private commandQueue: AgentCommand[] = [];
    private isProcessingQueue = false;

    /**
     * Tracks the last command dispatched to CommandRegistry.
     * Used by E2E test hooks to verify command dispatch.
     */
    private _lastDispatchedCommand: AgentCommand | null = null;

    /**
     * Emitter for permission requested events.
     */
    private readonly permissionRequestedEmitter = new Emitter<PermissionNotification>();

    /**
     * Event fired when a permission request is received.
     */
    get onPermissionRequested(): Event<PermissionNotification> {
        return this.permissionRequestedEmitter.event;
    }

    /**
     * Handle session lifecycle events (created/updated/deleted/init/abort/etc.).
     * 
     * Only processes events for the currently active session. Updates SessionService
     * state based on event type.
     * 
     * @param event - Session event notification
     */
    onSessionEvent(event: SessionNotification): void {
        try {
            console.debug(`[SyncService] Session event: ${event.type}, sessionId=${event.sessionId}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                console.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            // Handle event types
            switch (event.type) {
                case 'created':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    break;

                case 'updated':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    break;

                case 'deleted':
                    this.sessionService.notifySessionDeleted(event.sessionId);
                    // T3-7: Clear streaming messages when session is deleted
                    this.streamingMessages.clear();
                    break;

                case 'init_started':
                    console.debug('[SyncService] Session init started');
                    break;

                case 'init_completed':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    break;

                case 'aborted':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    // Clear streaming state
                    this.streamingMessages.clear();
                    break;

                case 'shared':
                case 'unshared':
                case 'compacted':
                case 'reverted':
                case 'unreverted':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    break;

                default:
                    console.warn(`[SyncService] Unknown session event type: ${event.type}`);
            }
        } catch (error) {
            console.error('[SyncService] Error in onSessionEvent:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Handle message events (created/partial/completed) - implements streaming protocol.
     * 
     * Message Streaming Protocol:
     * 1. created → Initial message stub with ID
     * 2. partial → Multiple events with incremental text deltas
     * 3. completed → Final complete message
     * 
     * This method tracks streaming state internally and updates SessionService
     * with incremental deltas and final messages.
     * 
     * @param event - Message event notification
     */
    onMessageEvent(event: MessageNotification): void {
        try {
            console.debug(`[SyncService] Message event: ${event.type}, messageId=${event.messageId}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                console.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            // Handle event types
            switch (event.type) {
                case 'created':
                    this.handleMessageCreated(event);
                    break;

                case 'partial':
                    this.handleMessagePartial(event);
                    break;

                case 'completed':
                    this.handleMessageCompleted(event);
                    break;

                default:
                    console.warn(`[SyncService] Unknown message event type: ${event.type}`);
            }
        } catch (error) {
            console.error('[SyncService] Error in onMessageEvent:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Handle message.created event - initial message stub.
     */
    private handleMessageCreated(event: MessageNotification): void {
        if (!event.data) {
            console.warn('[SyncService] message.created event missing data');
            return;
        }

        // Append message stub to SessionService
        this.sessionService.appendMessage(event.data.info);

        // Initialize streaming state
        this.streamingMessages.set(event.messageId, { text: '' });

        console.debug(`[SyncService] Message created: ${event.messageId}`);
    }

    /**
     * Handle message.partial event - incremental text delta.
     * SDK sends message.part.updated with a `delta` field for incremental text.
     * We use the delta directly rather than extracting text from parts.
     */
    private handleMessagePartial(event: MessageNotification): void {
        if (!event.data) {
            console.warn('[SyncService] message.partial event missing data');
            return;
        }

        // Prefer the explicit delta field from the SDK event (set by opencode-proxy from message.part.updated).
        // Fall back to extracting text from parts for backward compatibility.
        const delta = event.delta || this.extractTextDelta(event.data.parts);

        if (!delta) {
            console.debug('[SyncService] No text delta in partial event');
            return;
        }

        // Get or create streaming message tracker
        let stream = this.streamingMessages.get(event.messageId);
        if (!stream) {
            // Received partial before created — auto-initialize tracking
            console.debug(`[SyncService] Auto-initializing streaming tracker for: ${event.messageId}`);
            stream = { text: '' };
            this.streamingMessages.set(event.messageId, stream);

            // Also ensure the message exists in SessionService (append a stub if missing)
            if (event.data.info) {
                this.sessionService.appendMessage(event.data.info);
            }
        }

        // Append delta to accumulated text
        stream.text += delta;

        // Update SessionService with delta
        this.sessionService.updateStreamingMessage(event.messageId, delta, false);

        console.debug(`[SyncService] Message partial: ${event.messageId}, delta=${delta.length} chars`);
    }

    /**
     * Handle message.completed event - final complete message.
     */
    private handleMessageCompleted(event: MessageNotification): void {
        if (!event.data) {
            console.warn('[SyncService] message.completed event missing data');
            return;
        }

        // Signal streaming completion
        this.sessionService.updateStreamingMessage(event.messageId, '', true);

        // Replace streaming stub with final message
        this.sessionService.replaceMessage(event.messageId, event.data.info);

        // Clean up streaming state
        this.streamingMessages.delete(event.messageId);

        console.debug(`[SyncService] Message completed: ${event.messageId}`);
    }

    /**
     * Extract text delta from message parts.
     * Returns concatenated text from all text-type parts (SDK Part union type).
     */
    private extractTextDelta(parts: Array<any>): string {
        let text = '';

        for (const part of parts) {
            if (part.type === 'text' && 'text' in part) {
                text += part.text;
            }
        }

        return text;
    }

    /**
     * Handle file change events (changed/saved/reset).
     * 
     * Phase 1 implementation: Minimal logging only.
     * Future phases will integrate with Theia FileService for automatic editor syncing.
     * 
     * @param event - File event notification
     */
    onFileEvent(event: FileNotification): void {
        try {
            console.debug(`[SyncService] File event: ${event.type}, path=${event.path || 'unknown'}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                console.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            // Phase 1: Log only (no immediate action)
            switch (event.type) {
                case 'changed':
                    console.debug('[SyncService] File changed (no action in Phase 1)');
                    break;

                case 'saved':
                    console.debug('[SyncService] File saved (no action in Phase 1)');
                    break;

                case 'reset':
                    console.debug('[SyncService] File reset (no action in Phase 1)');
                    break;

                default:
                    console.warn(`[SyncService] Unknown file event type: ${event.type}`);
            }
        } catch (error) {
            console.error('[SyncService] Error in onFileEvent:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Handle permission request events (requested/granted/denied).
     * 
     * Phase 1 implementation: Emit events for PermissionDialogContribution.
     * Task 1.14 implements full permission UI and state management.
     * 
     * @param event - Permission event notification
     */
    onPermissionEvent(event: PermissionNotification): void {
        try {
            console.debug(`[SyncService] Permission event: ${event.type}, permissionId=${event.permissionId || 'unknown'}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                console.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            // Emit permission requested events for UI to handle
            if (event.type === 'requested' && event.permission) {
                this.permissionRequestedEmitter.fire(event);
            }

            // Handle other event types
            switch (event.type) {
                case 'requested':
                    console.debug('[SyncService] Permission requested - event emitted');
                    break;

                case 'granted':
                    console.debug('[SyncService] Permission granted');
                    break;

                case 'denied':
                    console.debug('[SyncService] Permission denied');
                    break;

                default:
                    console.warn(`[SyncService] Unknown permission event type: ${event.type}`);
            }
        } catch (error) {
            console.error('[SyncService] Error in onPermissionEvent:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Handle agent command events from OpenCodeProxy stream interceptor.
     * 
     * Commands are queued and executed sequentially to prevent race conditions.
     * Maximum queue depth is 50 commands (warning logged if exceeded).
     * 
     * SECURITY: Commands are validated before queueing. Only commands in the
     * 'openspace.*' namespace are accepted. Malformed commands are rejected.
     * 
     * @param command - Agent command to execute
     */
    onAgentCommand(command: AgentCommand): void {
        try {
            console.debug(`[SyncService] Agent command received: ${command.cmd}`);

            // SECURITY: Validate command before queueing
            if (!this.validateAgentCommand(command)) {
                console.warn(`[SyncService] Command validation failed, rejecting: ${command.cmd}`);
                return;
            }

            // Add to queue
            this.commandQueue.push(command);

            // Warn if queue depth exceeds limit
            if (this.commandQueue.length > 50) {
                console.warn(`[SyncService] Command queue depth exceeded 50: ${this.commandQueue.length}`);
            }

            // Start processing if not already running
            if (!this.isProcessingQueue) {
                this.processCommandQueue();
            }
        } catch (error) {
            console.error('[SyncService] Error in onAgentCommand:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Validate agent command structure and security constraints.
     * 
     * Security Rules:
     * 1. Command ID must be a non-empty string
     * 2. Command ID must start with 'openspace.' (namespace allowlist)
     * 3. Command args must be undefined, an object, or an array (not primitive types)
     * 
     * This prevents:
     * - Execution of arbitrary Theia commands outside the OpenSpace namespace
     * - Path traversal attacks via command IDs
     * - Type confusion attacks via malformed args
     * 
     * @param command - Agent command to validate
     * @returns true if command is valid and safe to execute, false otherwise
     */
    private validateAgentCommand(command: AgentCommand): boolean {
        // Validate command structure
        if (!command || typeof command !== 'object') {
            console.warn('[SyncService] Command validation failed: not an object');
            return false;
        }

        // Validate command ID exists and is a string
        if (!command.cmd || typeof command.cmd !== 'string') {
            console.warn('[SyncService] Command validation failed: cmd missing or not a string');
            return false;
        }

        // SECURITY: Allowlist check - only openspace.* commands permitted
        if (!command.cmd.startsWith('openspace.')) {
            console.warn(`[SyncService] Command validation failed: not in openspace namespace: ${command.cmd}`);
            return false;
        }

        // Validate args structure (must be undefined, object, or array - not primitive)
        if (command.args !== undefined) {
            const argsType = typeof command.args;
            
            if (argsType !== 'object') {
                console.warn(`[SyncService] Command validation failed: args must be object or array, got: ${argsType}`);
                return false;
            }

            // Null is typeof 'object' but we don't want it
            if (command.args === null) {
                console.warn('[SyncService] Command validation failed: args cannot be null');
                return false;
            }

            // Arrays and objects are both typeof 'object', both are acceptable
            // No need to check Array.isArray - CommandRegistry handles both
        }

        // Command passed all validation checks
        return true;
    }

    /**
     * Process command queue sequentially with 50ms inter-command delay.
     * 
     * Execution Rules:
     * - Commands execute in FIFO order
     * - 50ms delay between commands
     * - Unknown commands are skipped with warning
     * - Execution errors are logged but don't block queue
     * - Queue processing continues until empty
     */
    private async processCommandQueue(): Promise<void> {
        this.isProcessingQueue = true;

        while (this.commandQueue.length > 0) {
            const command = this.commandQueue.shift()!;

            try {
                // Check if command exists
                if (!this.commandRegistry.getCommand(command.cmd)) {
                    console.warn(`[SyncService] Unknown command: ${command.cmd}`);
                    continue;
                }

                // Execute command
                const argsArray = command.args ? (Array.isArray(command.args) ? command.args : [command.args]) : [];
                this._lastDispatchedCommand = command;
                await this.commandRegistry.executeCommand(command.cmd, ...argsArray);

                console.debug(`[SyncService] Command executed: ${command.cmd}`);

                // 50ms delay between commands
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                console.error(`[SyncService] Command execution failed: ${command.cmd}`, error);
                // Continue with next command (don't block queue)
            }
        }

        this.isProcessingQueue = false;
    }
}
