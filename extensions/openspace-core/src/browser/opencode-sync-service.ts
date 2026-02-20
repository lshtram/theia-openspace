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
import { ILogger } from '@theia/core/lib/common/logger';
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

    @inject(ILogger)
    protected readonly logger!: ILogger;

    setSessionService(sessionService: SessionService): void {
        this._sessionService = sessionService;
        this.logger.info('[SyncService] SessionService wired successfully');

        // T3-7: Subscribe to session changes to clear streaming messages
        sessionService.onActiveSessionChanged(() => {
            this.streamingMessages.clear();
            this.logger.debug('[SyncService] Streaming messages cleared on session change');
        });

        // T2-15: Only expose test hooks in non-production builds.
        // process.env.NODE_ENV is replaced by webpack DefinePlugin at build time,
        // which also dead-code eliminates the entire block in production bundles.
        if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
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
            this.logger.info('[SyncService] E2E test helpers exposed (non-production)');
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
            this.logger.debug(`[SyncService] Session event: ${event.type}, sessionId=${event.sessionId}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                this.logger.debug('[SyncService] Ignoring event for non-active session');
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
                    this.logger.debug('[SyncService] Session init started');
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
                    this.logger.warn(`[SyncService] Unknown session event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error('[SyncService] Error in onSessionEvent:', error);
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
            this.logger.debug(`[SyncService] Message event: ${event.type}, messageId=${event.messageId}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                this.logger.debug('[SyncService] Ignoring event for non-active session');
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
                    this.logger.warn(`[SyncService] Unknown message event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error('[SyncService] Error in onMessageEvent:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Handle message.created event - initial message stub.
     */
    private handleMessageCreated(event: MessageNotification): void {
        if (!event.data) {
            this.logger.warn('[SyncService] message.created event missing data');
            return;
        }

        // Append message stub to SessionService
        this.sessionService.appendMessage(event.data.info);

        // Initialize streaming state
        this.streamingMessages.set(event.messageId, { text: '' });

        this.logger.debug(`[SyncService] Message created: ${event.messageId}`);
    }

    /**
     * Handle message.partial event - incremental text delta.
     * SDK sends message.part.updated with a `delta` field for incremental text.
     * We use the delta directly rather than extracting text from parts.
     */
    private handleMessagePartial(event: MessageNotification): void {
        if (!event.data) {
            this.logger.warn('[SyncService] message.partial event missing data');
            return;
        }

        // Route tool parts to live update (these carry no text delta)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolParts = (event.data.parts || []).filter((p: any) => p.type === 'tool');
        if (toolParts.length > 0) {
            this.sessionService.updateStreamingMessageParts(event.messageId, toolParts);
        }

        // Prefer the explicit delta field from the SDK event (set by opencode-proxy from message.part.updated).
        // Fall back to extracting text from parts for backward compatibility.
        const delta = event.delta || this.extractTextDelta(event.data.parts);

        if (!delta) {
            this.logger.debug('[SyncService] No text delta in partial event');
            return;
        }

        // Get or create streaming message tracker
        let stream = this.streamingMessages.get(event.messageId);
        if (!stream) {
            // Received partial before created — auto-initialize tracking
            this.logger.debug(`[SyncService] Auto-initializing streaming tracker for: ${event.messageId}`);
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

        this.logger.debug(`[SyncService] Message partial: ${event.messageId}, delta=${delta.length} chars`);
    }

    /**
     * Handle message.completed event - final complete message.
     */
    private handleMessageCompleted(event: MessageNotification): void {
        if (!event.data) {
            this.logger.warn('[SyncService] message.completed event missing data');
            return;
        }

        // Signal streaming completion
        this.sessionService.updateStreamingMessage(event.messageId, '', true);

        // Replace streaming stub with final message
        this.sessionService.replaceMessage(event.messageId, event.data.info);

        // Clean up streaming state
        this.streamingMessages.delete(event.messageId);

        this.logger.debug(`[SyncService] Message completed: ${event.messageId}`);
    }

    /**
     * Extract text delta from message parts.
     * Returns concatenated text from all text-type parts (SDK Part union type).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            this.logger.debug(`[SyncService] File event: ${event.type}, path=${event.path || 'unknown'}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                this.logger.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            // Phase 1: Log only (no immediate action)
            switch (event.type) {
                case 'changed':
                    this.logger.debug('[SyncService] File changed (no action in Phase 1)');
                    break;

                case 'saved':
                    this.logger.debug('[SyncService] File saved (no action in Phase 1)');
                    break;

                case 'reset':
                    this.logger.debug('[SyncService] File reset (no action in Phase 1)');
                    break;

                default:
                    this.logger.warn(`[SyncService] Unknown file event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error('[SyncService] Error in onFileEvent:', error);
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
            this.logger.debug(`[SyncService] Permission event: ${event.type}, permissionId=${event.permissionId || 'unknown'}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                this.logger.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            // Emit permission requested events for UI to handle
            if (event.type === 'requested' && event.permission) {
                this.permissionRequestedEmitter.fire(event);
            }

            // Handle other event types
            switch (event.type) {
                case 'requested':
                    this.logger.debug('[SyncService] Permission requested - event emitted');
                    break;

                case 'granted':
                    this.logger.debug('[SyncService] Permission granted');
                    break;

                case 'denied':
                    this.logger.debug('[SyncService] Permission denied');
                    break;

                default:
                    this.logger.warn(`[SyncService] Unknown permission event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error('[SyncService] Error in onPermissionEvent:', error);
            // Never throw from RPC callback
        }
    }

    /**
     * Handle agent command events forwarded from the MCP hub via RPC.
     *
     * T3: Commands arrive via onAgentCommand() RPC notification (Hub → browser).
     * Executes the command immediately via CommandRegistry, then POSTs the result
     * back to Hub's POST /openspace/command-results (includes requestId for MCP correlation).
     *
     * @param command - Agent command to execute
     */
    onAgentCommand(command: AgentCommand): void {
        this.logger.debug(`[SyncService] Agent command received: ${command.cmd}`);
        // Execute asynchronously — must not throw from RPC callback
        this.executeAndReport(command).catch(err => {
            this.logger.error('[SyncService] Unexpected error in executeAndReport:', err);
        });
    }

    private async executeAndReport(command: AgentCommand): Promise<void> {
        const startTime = Date.now();
        const { cmd, args } = command;

        // SECURITY: Only openspace.* commands are permitted
        if (!cmd || typeof cmd !== 'string' || !cmd.startsWith('openspace.')) {
            this.logger.warn(`[SyncService] Command rejected (not in openspace namespace): ${cmd}`);
            return;
        }

        let success = false;
        let output: unknown;
        let error: string | undefined;

        try {
            if (!this.commandRegistry.getCommand(cmd)) {
                error = `Unknown command: ${cmd}`;
                this.logger.warn(`[SyncService] ${error}`);
            } else {
                const argsArray = args ? (Array.isArray(args) ? args : [args]) : [];
                this._lastDispatchedCommand = command;
                output = await this.commandRegistry.executeCommand(cmd, ...argsArray);
                success = true;
                this.logger.debug(`[SyncService] Command executed: ${cmd}`);
            }
        } catch (err: unknown) {
            error = (err as Error)?.message || String(err);
            this.logger.error(`[SyncService] Command execution failed: ${cmd}`, err);
        }

        // POST result back to Hub for MCP correlation
        try {
            await fetch('/openspace/command-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cmd,
                    args,
                    success,
                    output,
                    error,
                    executionTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    requestId: command.requestId
                })
            });
        } catch (fetchErr) {
            this.logger.debug('[SyncService] Could not post command result to Hub:', fetchErr);
        }
    }
}
