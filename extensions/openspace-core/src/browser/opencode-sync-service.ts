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
     MessagePartDeltaNotification,
     FileNotification,
     PermissionNotification,
     QuestionNotification,
     TodoNotification
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
     *
     * Race condition: SSE events from opencode can arrive before BridgeContribution.onStart()
     * calls setSessionService(). To handle this, events that arrive before wiring are queued
     * in _pendingEvents and replayed when setSessionService() is finally called.
     */
    private _sessionService?: SessionService;

    /**
     * Queue of events that arrived before setSessionService() was called.
     * Each entry stores the method name and argument to replay after wiring.
     * Cleared after draining in setSessionService().
     */
    private _pendingEvents: Array<{ method: string; arg: unknown }> = [];

    @inject(CommandRegistry)
    private commandRegistry!: CommandRegistry;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    setSessionService(sessionService: SessionService): void {
        this._sessionService = sessionService;
        this.logger.info('[SyncService] SessionService wired successfully');

        // T3-7: Subscribe to session changes to clear streaming messages.
        // Only clear when the session ID actually changes — SSE fires onActiveSessionChanged
        // for many in-session events (init_completed, updated, etc.) and clearing mid-stream
        // would lose accumulated streaming state.
        let lastClearedSessionId: string | undefined;
        sessionService.onActiveSessionChanged(session => {
            const newId = session?.id;
            if (newId !== lastClearedSessionId) {
                this.streamingMessages.clear();
                lastClearedSessionId = newId;
                this.logger.debug(`[SyncService] Streaming messages cleared: session changed to ${newId}`);
            }
        });

        // Drain any events that arrived before wiring completed (DI init race condition).
        // Events are queued in _pendingEvents by the individual handler methods when
        // _sessionService is undefined. Replay them now in arrival order.
        if (this._pendingEvents.length > 0) {
            this.logger.info(`[SyncService] Draining ${this._pendingEvents.length} queued events`);
            const events = this._pendingEvents;
            this._pendingEvents = [];
            for (const { method, arg } of events) {
                try {
                    (this as unknown as Record<string, (a: unknown) => void>)[method](arg);
                } catch (err) {
                    this.logger.error(`[SyncService] Error replaying queued event (${method}):`, err);
                }
            }
        }

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
     * Queue an event for replay after setSessionService() is called.
     * Returns true if the event was queued (caller should return early).
     */
    private queueIfNotReady(method: string, arg: unknown): boolean {
        if (!this._sessionService) {
            this._pendingEvents.push({ method, arg });
            this.logger.info(`[SyncService] Queued ${method} event (SessionService not yet wired)`);
            return true;
        }
        return false;
    }

    /**
     * Internal state for tracking streaming messages.
     * Maps messageId → accumulated text.
     */
    private streamingMessages = new Map<string, { text: string }>();

    /**
     * Deduplicate identical back-to-back delta events that can occur during
     * transient RPC callback reconnects. Keyed by message+part+field+delta.
     */
    private recentDeltaEvents = new Map<string, number>();

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
            if (this.queueIfNotReady('onSessionEvent', event)) { return; }
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
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    break;

                case 'compacted':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    // Compaction replaces the entire message history with a summary —
                    // reload messages so the UI reflects the new compacted content.
                    this.sessionService.reloadMessages().catch(e =>
                        this.logger.warn('[SyncService] Failed to reload messages after compaction:', e)
                    );
                    break;
                case 'reverted':
                case 'unreverted':
                    if (event.data) {
                        this.sessionService.notifySessionChanged(event.data);
                    }
                    break;

                case 'error_occurred':
                    // Forward session error to session-service so UI can display it
                    if (event.data) {
                        const errorData = event.data as unknown as { error?: string };
                        this.sessionService.notifySessionError(
                            event.sessionId,
                            errorData.error ?? 'Unknown session error'
                        );
                    }
                    break;

                case 'status_changed':
                    if (event.sessionStatus) {
                        this.sessionService.updateSessionStatus(event.sessionStatus, event.sessionId);
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
            if (this.queueIfNotReady('onMessageEvent', event)) { return; }
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

                case 'removed':
                    this.sessionService.notifyMessageRemoved(event.sessionId, event.messageId);
                    break;

                case 'part_removed': {
                    const removedPartId = event.data?.parts?.[0]?.id;
                    if (removedPartId) {
                        this.sessionService.notifyPartRemoved(event.sessionId, event.messageId, removedPartId);
                    }
                    break;
                }

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
     * Handle message.partial event - part replacement from message.part.updated.
     * SDK sends message.part.updated with the FULL part content.
     * Text streaming is handled by message.part.delta (applyPartDelta) which appends.
     * So here we REPLACE parts (not extract and append text) to avoid duplication.
     */
    private handleMessagePartial(event: MessageNotification): void {
        if (!event.data) {
            this.logger.warn('[SyncService] message.partial event missing data');
            return;
        }

        // The opencode SSE also fires message.part.updated for user messages (e.g. the text
        // the user typed). The proxy hardcodes role:'assistant' in the stub it builds, so we
        // cannot rely on event.data.info.role here. Instead, check whether the message is
        // already known to SessionService with role:'user' — if so, skip it entirely.
        const existingMsg = this.sessionService.messages.find(m => m.id === event.messageId);
        if (existingMsg?.role === 'user') {
            this.logger.debug(`[SyncService] Skipping partial event for user message: ${event.messageId}`);
            return;
        }

        // Ensure streaming tracker and message stub exist before routing any parts.
        // message.created may arrive after the first partial in some race conditions.
        if (!this.streamingMessages.has(event.messageId)) {
            this.logger.debug(`[SyncService] Auto-initializing streaming tracker for: ${event.messageId}`);
            this.streamingMessages.set(event.messageId, { text: '' });
            if (event.data.info) {
                this.sessionService.appendMessage(event.data.info);
            }
        }

        // Upsert tool/non-text parts, plus EMPTY text/reasoning stubs.
        // We keep empty stubs so part IDs and canonical types (e.g. reasoning) exist
        // before deltas arrive. We still ignore non-empty text/reasoning snapshots to
        // avoid append duplication when message.part.delta for the same token follows.
        //
        // NOTE (A4 investigation 2026-02-24): Tool call state transitions (pending → running →
        // completed → error) are handled correctly. updateStreamingMessageParts() in session-service
        // matches parts by ID and replaces them in-place, so each message.part.updated carrying a new
        // state will overwrite the previous part record. No bug here.
        const allParts = event.data.parts || [];
        const toolParts = allParts.filter((p: any) => {
            if (p.type !== 'text' && p.type !== 'reasoning') {
                return true;
            }
            const text = typeof p.text === 'string' ? p.text : '';
            return text.length === 0;
        });
        if (toolParts.length > 0) {
            this.sessionService.updateStreamingMessageParts(event.messageId, toolParts);
        }

        // Notify streaming subscribers so the UI can identify which message is streaming
        // (e.g. to apply the message-bubble-streaming CSS class and show the elapsed timer).
        // Pass empty delta — text is handled by message.part.delta.
        this.sessionService.updateStreamingMessage(event.messageId, '', false);

        this.logger.debug(`[SyncService] Message partial: ${event.messageId}, parts=${allParts.length} (tool parts upserted: ${toolParts.length})`);
    }

    /**
     * Handle message.completed event - final complete message.
     */
    private handleMessageCompleted(event: MessageNotification): void {
        if (!event.data) {
            this.logger.warn('[SyncService] message.completed event missing data');
            return;
        }

        // Skip completed events for user messages. The opencode SSE fires message.updated for
        // the user message too, which would wipe the user message content with parts:[].
        if (event.data.info?.role === 'user') {
            this.logger.debug(`[SyncService] Skipping completed event for user message: ${event.messageId}`);
            return;
        }

        // The opencode backend sometimes sends message.part.updated with a different ID than
        // the final message.updated ID. previousMessageId (set by the proxy) tells us which
        // streaming stub to signal as done and replace.
        const streamingStubId = event.previousMessageId || event.messageId;

        // Only signal streaming completion if this message is actually being actively streamed.
        // The opencode SSE stream replays all past message.updated events on reconnect,
        // which would fire isDone:true for every historical message. Guard with streamingMessages.
        if (!this.streamingMessages.has(streamingStubId) && !this.streamingMessages.has(event.messageId)) {
            this.logger.debug(`[SyncService] Skipping isDone signal for non-streaming message: ${streamingStubId}`);
            // Still replace the message in case the SSE replay brings updated content.
            const incomingPartsEarly = event.data.parts || [];
            const existingByStub = this.sessionService.messages.find(m => m.id === streamingStubId);
            const existingByFinal = !existingByStub && streamingStubId !== event.messageId
                ? this.sessionService.messages.find(m => m.id === event.messageId)
                : undefined;
            const existingMsgEarly = existingByStub || existingByFinal;
            const lookupId = existingByStub ? streamingStubId : event.messageId;
            if (existingMsgEarly && incomingPartsEarly.length > 0 && event.data.info) {
                const finalMsgEarly = { ...event.data.info, parts: incomingPartsEarly };
                this.sessionService.replaceMessage(lookupId, finalMsgEarly);
            }
            return;
        }

        // Clean up streaming state BEFORE firing isDone.
        // The opencode backend sends multiple message.updated(status=completed) events for the
        // same message during a single response. By removing from streamingMessages first, any
        // subsequent handleMessageCompleted calls for this ID will be blocked by the guard above,
        // ensuring isDone:true fires exactly once per message.
        this.streamingMessages.delete(streamingStubId);
        if (streamingStubId !== event.messageId) {
            this.streamingMessages.delete(event.messageId);
        }

        // Signal streaming completion on the stub that was being streamed
        this.sessionService.updateStreamingMessage(streamingStubId, '', true);

        // Replace streaming stub with final message.
        // The proxy sends parts:[] in the completed notification (parts arrive via part.updated).
        // To avoid wiping streamed content, merge with existing parts when the event has none.
        const incomingParts = event.data.parts || [];
        const existingMsg = this.sessionService.messages.find(m => m.id === streamingStubId);
        const finalMessage = {
            ...event.data.info,
            parts: incomingParts.length > 0 ? incomingParts : (existingMsg?.parts || [])
        };

        if (streamingStubId !== event.messageId) {
            // IDs differ: replace the streaming stub (old ID) with the completed message (new ID).
            // Remove the old stub from the messages array and add the new completed message.
            this.logger.debug(`[SyncService] Replacing streaming stub ${streamingStubId} → ${event.messageId}`);
            this.sessionService.replaceMessage(streamingStubId, finalMessage);
        } else {
            this.sessionService.replaceMessage(event.messageId, finalMessage);
        }

        // Asynchronously fetch the authoritative final message from backend to recover
        // canonical part types/content and correct any duplicated transient stream state.
        void this.refreshCompletedMessageFromBackend(event.messageId);

        this.logger.debug(`[SyncService] Message completed: ${event.messageId}`);
    }

    private async refreshCompletedMessageFromBackend(messageId: string): Promise<void> {
        try {
            const authoritative = await this.sessionService.fetchMessageFromBackend(messageId);
            if (!authoritative || !authoritative.parts || authoritative.parts.length === 0) {
                return;
            }
            this.sessionService.replaceMessage(messageId, authoritative);
            this.logger.debug(`[SyncService] Refreshed completed message from backend: ${messageId}`);
        } catch (error) {
            this.logger.debug(`[SyncService] Failed to refresh completed message ${messageId}: ${error}`);
        }
    }

    /**
     * Handle message.part.delta — per-token text append.
     * This is the high-frequency streaming event. It appends `delta` to
     * the specified `field` of the part identified by `partID`.
     */
    onMessagePartDelta(event: MessagePartDeltaNotification): void {
        try {
            if (this.queueIfNotReady('onMessagePartDelta', event)) { return; }
            this.logger.debug(`[SyncService] Part delta: msg=${event.messageID}, part=${event.partID}, field=${event.field}, len=${event.delta.length}`);

            // Skip identical back-to-back duplicate deltas (same message/part/field/delta)
            // arriving within a short window.
            const dedupeKey = `${event.messageID}|${event.partID}|${event.field}|${event.delta}`;
            const now = Date.now();
            const lastSeen = this.recentDeltaEvents.get(dedupeKey);
            if (lastSeen !== undefined && now - lastSeen < 750) {
                this.logger.debug(`[SyncService] Skipping duplicate delta event: ${dedupeKey}`);
                return;
            }
            this.recentDeltaEvents.set(dedupeKey, now);
            if (this.recentDeltaEvents.size > 500) {
                // Cheap cleanup to prevent unbounded growth
                for (const [k, ts] of this.recentDeltaEvents) {
                    if (now - ts > 5_000) {
                        this.recentDeltaEvents.delete(k);
                    }
                }
            }

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionID) {
                return;
            }

            // Ensure streaming tracker exists (message.part.delta may arrive before message.created)
            if (!this.streamingMessages.has(event.messageID)) {
                // If this message already exists and is completed, this delta is a replayed
                // SSE event from a reconnect for a historical message — drop it to prevent
                // appending on top of already-final content (which causes N× duplication).
                const existingMsg = this.sessionService.messages.find(m => m.id === event.messageID);
                if (existingMsg && (existingMsg.time as any)?.completed) {
                    this.logger.debug(`[SyncService] Dropping replayed delta for completed message: ${event.messageID}`);
                    return;
                }

                this.streamingMessages.set(event.messageID, { text: '' });
                // Create a stub message so applyPartDelta has something to target
                this.sessionService.appendMessage({
                    id: event.messageID,
                    sessionID: event.sessionID,
                    role: 'assistant',
                    time: { created: Date.now() }
                } as any);
            }

            // Apply the delta directly to the part in session service
            this.sessionService.applyPartDelta(event.messageID, event.partID, event.field, event.delta);

            // Also track accumulated text for the streaming tracker
            if (event.field === 'text') {
                const stream = this.streamingMessages.get(event.messageID);
                if (stream) {
                    stream.text += event.delta;
                }
            }
        } catch (error) {
            this.logger.error('[SyncService] Error in onMessagePartDelta:', error);
        }
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
            if (this.queueIfNotReady('onFileEvent', event)) { return; }
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
     * Routes permission events to SessionService for inline permission UI:
     * - 'requested' → addPendingPermission (shows inline buttons below tool card)
     * - 'granted'/'denied' → removePendingPermission (clears inline buttons)
     * 
     * Also fires permissionRequestedEmitter for backward compat with
     * PermissionDialogContribution.
     * 
     * @param event - Permission event notification
     */
    onPermissionEvent(event: PermissionNotification): void {
        try {
            if (this.queueIfNotReady('onPermissionEvent', event)) { return; }
            this.logger.debug(`[SyncService] Permission event: ${event.type}, permissionId=${event.permissionId || 'unknown'}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                this.logger.debug('[SyncService] Ignoring event for non-active session');
                return;
            }

            switch (event.type) {
                case 'requested':
                    // Route to session service for inline permission UI
                    this.sessionService.addPendingPermission(event);
                    // Backward compat: also fire emitter for PermissionDialogContribution
                    if (event.permission) {
                        this.permissionRequestedEmitter.fire(event);
                    }
                    this.logger.debug('[SyncService] Permission requested - routed to session service');
                    break;

                case 'granted':
                    this.sessionService.removePendingPermission(event.permissionId || '');
                    this.logger.debug('[SyncService] Permission granted - removed from pending');
                    break;

                case 'denied':
                    this.sessionService.removePendingPermission(event.permissionId || '');
                    this.logger.debug('[SyncService] Permission denied - removed from pending');
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
     * Handle question events (asked/replied/rejected).
     *
     * @param event - Question event notification
     */
    onQuestionEvent(event: QuestionNotification): void {
        try {
            if (this.queueIfNotReady('onQuestionEvent', event)) { return; }
            this.logger.debug(`[SyncService] Question event: type=${event.type}, requestId=${event.requestId}, sessionId=${event.sessionId}`);

            // Only process events for the currently active session
            if (this.sessionService.activeSession?.id !== event.sessionId) {
                this.logger.debug(`[SyncService] Ignoring question event for non-active session: event.sessionId=${event.sessionId}`);
                return;
            }

            switch (event.type) {
                case 'asked':
                    if (event.question) {
                        this.sessionService.addPendingQuestion(event.question);
                    }
                    break;
                case 'replied':
                case 'rejected':
                    this.sessionService.removePendingQuestion(event.requestId);
                    break;
                default:
                    this.logger.warn(`[SyncService] Unknown question event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error('[SyncService] Error in onQuestionEvent:', error);
        }
    }

    onTodoEvent(event: TodoNotification): void {
        try {
            if (this.queueIfNotReady('onTodoEvent', event)) { return; }
            if (this.sessionService.activeSession?.id !== event.sessionId) { return; }
            this.sessionService.updateTodos(event.todos);
        } catch (error) {
            this.logger.error('[SyncService] Error in onTodoEvent:', error);
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

    /**
     * Handle SSE reconnection.
     *
     * When the SSE connection drops and re-establishes, the server replays all
     * `message.part.delta` events from the beginning. Without clearing the
     * accumulated text first, deltas append on top of existing content, causing
     * N× duplication. This method clears text/reasoning on every message that is
     * currently being streamed so replayed deltas rebuild cleanly.
     */
    onSSEReconnect(): void {
        if (this.streamingMessages.size === 0) {
            return;
        }

        this.logger.info(`[SyncService] SSE reconnected — clearing streaming text for ${this.streamingMessages.size} message(s)`);
        for (const messageId of this.streamingMessages.keys()) {
            this.sessionService.clearStreamingPartText(messageId);
        }

        // Also reset accumulated text in the streaming tracker so it rebuilds from scratch
        for (const [, stream] of this.streamingMessages) {
            stream.text = '';
        }
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
