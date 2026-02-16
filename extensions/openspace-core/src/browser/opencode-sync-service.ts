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
import {
    OpenCodeClient,
    SessionNotification,
    MessageNotification,
    FileNotification,
    PermissionNotification,
    TextMessagePart
} from '../common/opencode-protocol';
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

    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    /**
     * Internal state for tracking streaming messages.
     * Maps messageId → accumulated text.
     */
    private streamingMessages = new Map<string, { text: string }>();

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
     */
    private handleMessagePartial(event: MessageNotification): void {
        if (!event.data) {
            console.warn('[SyncService] message.partial event missing data');
            return;
        }

        // Extract text delta from parts
        const delta = this.extractTextDelta(event.data.parts);

        if (!delta) {
            console.debug('[SyncService] No text delta in partial event');
            return;
        }

        // Get existing streaming message
        const stream = this.streamingMessages.get(event.messageId);
        if (!stream) {
            console.warn(`[SyncService] Received partial event before created: ${event.messageId}`);
            return; // Ignore out-of-order event
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
     * Returns concatenated text from all TextMessagePart parts.
     */
    private extractTextDelta(parts: Array<any>): string {
        let text = '';

        for (const part of parts) {
            if (part.type === 'text') {
                const textPart = part as TextMessagePart;
                text += textPart.text;
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
}
