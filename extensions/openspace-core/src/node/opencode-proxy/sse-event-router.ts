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

/**
 * SSE event routing and forwarding.
 * Parses incoming SSE events from the OpenCode server and forwards them
 * to the connected frontend client via the appropriate RPC callbacks.
 *
 * Extracted from OpenCodeProxy to keep each module focused and <400 lines.
 */

import { inject, injectable } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import { ParsedEvent } from 'eventsource-parser';
import {
    OpenCodeClient,
    Session,
    Message,
    MessagePart,
    MessageWithParts,
    SessionNotification,
    MessageNotification,
    PermissionNotification
} from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';

@injectable()
export class SseEventRouter {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    /**
     * Track the most recently seen streaming part message ID.
     * The opencode backend sends message.part.updated with one ID (streaming ID) and
     * message.updated (completed) with a different ID (final ID). We record the last
     * streaming part ID here so the completed notification can include it as previousMessageId,
     * allowing the sync service to replace the streaming stub correctly.
     */
    protected lastStreamingPartMessageId: string | undefined;

    /**
     * Track known user message IDs.
     * When message.updated fires with role:'user', we record the message ID here.
     * This lets us skip message.part.updated events for user messages, since the proxy
     * hardcodes role:'assistant' in the partial notification stub and has no other way
     * to detect user message parts.
     */
    readonly userMessageIds = new Set<string>();

    /**
     * Handle incoming SSE event.
     * OpenCode SSE sends GlobalEvent { directory, payload: Event } where Event has a `type` field.
     */
    handleSSEEvent(event: ParsedEvent, client: OpenCodeClient): void {
        try {
            const parsed = JSON.parse(event.data);
            // OpenCode server may send events as direct Event objects (no wrapper)
            // OR as GlobalEvent { directory, payload: Event }. Handle both.
            const innerEvent: SDKTypes.Event = (parsed.payload !== undefined)
                ? parsed.payload
                : parsed;
            if (!innerEvent || typeof innerEvent.type !== 'string') {
                this.logger.debug(`[SseEventRouter] Ignoring SSE event with no type: ${event.data}`);
                return;
            }
            const eventType = innerEvent.type;

            this.logger.info(`[SseEventRouter] SSE event: ${eventType}`);

            // Route event by type prefix
            if (eventType.startsWith('session.')) {
                this.forwardSessionEvent(innerEvent as SDKTypes.EventSessionCreated | SDKTypes.EventSessionUpdated | SDKTypes.EventSessionDeleted | SDKTypes.EventSessionError | SDKTypes.EventSessionCompacted, client);
            } else if (eventType.startsWith('message.')) {
                this.forwardMessageEvent(innerEvent as SDKTypes.EventMessageUpdated | SDKTypes.EventMessagePartUpdated | SDKTypes.EventMessagePartDelta | SDKTypes.EventMessageRemoved | SDKTypes.EventMessagePartRemoved, client);
            } else if (eventType.startsWith('file.')) {
                this.forwardFileEvent(innerEvent as SDKTypes.EventFileEdited | SDKTypes.EventFileWatcherUpdated, client);
            } else if (eventType.startsWith('permission.')) {
                this.forwardPermissionEvent(innerEvent as SDKTypes.EventPermissionUpdated | SDKTypes.EventPermissionReplied, client);
            } else if (eventType.startsWith('question.')) {
                this.forwardQuestionEvent(innerEvent as SDKTypes.EventQuestionAsked | SDKTypes.EventQuestionReplied | SDKTypes.EventQuestionRejected, client);
            } else if (eventType.startsWith('todo.')) {
                this.forwardTodoEvent(innerEvent as { type: string; properties: { sessionID: string; todos: unknown[] } }, client);
            } else {
                this.logger.debug(`[SseEventRouter] Unhandled SSE event type: ${eventType}`);
            }
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error handling SSE event: ${error}`);
        }
    }

    /**
     * Forward session event to client.
     */
    protected forwardSessionEvent(event: SDKTypes.EventSessionCreated | SDKTypes.EventSessionUpdated | SDKTypes.EventSessionDeleted | SDKTypes.EventSessionError | SDKTypes.EventSessionCompacted | SDKTypes.EventSessionStatus, client: OpenCodeClient): void {
        try {
            // Handle session.status separately — it has a different shape (no info, has status)
            if (event.type === 'session.status') {
                const statusEvent = event as SDKTypes.EventSessionStatus;
                const notification: SessionNotification = {
                    type: 'status_changed',
                    sessionId: statusEvent.properties.sessionID,
                    projectId: '',
                    sessionStatus: statusEvent.properties.status
                };
                client.onSessionEvent(notification);
                this.logger.debug(`[SseEventRouter] Forwarded session.status: ${statusEvent.properties.status.type}`);
                return;
            }

            // Map SDK event type to notification type
            let type: SessionNotification['type'];
            switch (event.type) {
                case 'session.created': type = 'created'; break;
                case 'session.updated': type = 'updated'; break;
                case 'session.deleted': type = 'deleted'; break;
                case 'session.error': type = 'error_occurred'; break;
                case 'session.compacted': type = 'compacted'; break;
                default:
                    this.logger.debug(`[SseEventRouter] Unhandled session event type: ${(event as { type: string }).type}`);
                    return;
            }

            const sessionInfo = 'info' in event.properties ? event.properties.info : undefined;
            const sessionId = sessionInfo?.id || ('sessionID' in event.properties ? (event.properties as { sessionID?: string }).sessionID : '') || '';
            let errorData: Session | undefined = sessionInfo as Session | undefined;
            if (type === 'error_occurred') {
                const errorEvent = event as SDKTypes.EventSessionError;
                const errObj = errorEvent.properties.error;
                const errMsg = errObj && 'message' in errObj ? (errObj as { message: string }).message : String(errObj ?? 'Unknown error');
                errorData = { error: errMsg } as unknown as Session;
            }

            const notification: SessionNotification = {
                type,
                sessionId,
                projectId: sessionInfo?.projectID || '',
                data: errorData
            };

            client.onSessionEvent(notification);
            this.logger.debug(`[SseEventRouter] Forwarded session event: ${type}`);
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error forwarding session event: ${error}`);
        }
    }

    /**
     * Forward message event to client.
     * SDK events: message.updated (full message), message.part.updated (streaming part with delta)
     */
    protected forwardMessageEvent(event: SDKTypes.EventMessageUpdated | SDKTypes.EventMessagePartUpdated | SDKTypes.EventMessagePartDelta | SDKTypes.EventMessageRemoved | SDKTypes.EventMessagePartRemoved, client: OpenCodeClient): void {
        try {
            if (event.type === 'message.updated') {
                const msgInfo = event.properties.info;

                // Track user message IDs so we can filter out their part.updated events.
                if (msgInfo.role === 'user') {
                    this.userMessageIds.add(msgInfo.id);
                    this.logger.debug(`[SseEventRouter] Recorded user message ID: ${msgInfo.id}`);
                }

                const data: MessageWithParts = {
                    info: msgInfo,
                    parts: []
                };

                const previousMessageId =
                    msgInfo.role !== 'user' &&
                    this.lastStreamingPartMessageId !== undefined &&
                    this.lastStreamingPartMessageId !== msgInfo.id
                        ? this.lastStreamingPartMessageId
                        : undefined;

                const notification: MessageNotification = {
                    type: 'completed',
                    sessionId: msgInfo.sessionID,
                    projectId: '',
                    messageId: msgInfo.id,
                    data,
                    previousMessageId
                };

                if (msgInfo.role !== 'user') {
                    this.lastStreamingPartMessageId = undefined;
                }

                client.onMessageEvent(notification);
                this.logger.info(`[SseEventRouter] Forwarded message.updated: ${msgInfo.id}, role=${msgInfo.role}${previousMessageId ? ` (streaming stub: ${previousMessageId})` : ''}`);

            } else if (event.type === 'message.part.updated') {
                const part = event.properties.part;
                const delta = event.properties.delta;

                if (this.userMessageIds.has(part.messageID)) {
                    this.logger.debug(`[SseEventRouter] Skipping message.part.updated for user message: ${part.messageID}`);
                    return;
                }

                this.lastStreamingPartMessageId = part.messageID;

                const data: MessageWithParts = {
                    info: {
                        id: part.messageID,
                        sessionID: part.sessionID,
                        role: 'assistant',
                        time: { created: Date.now() }
                    } as Message,
                    parts: [part]
                };

                const notification: MessageNotification = {
                    type: 'partial',
                    sessionId: part.sessionID,
                    projectId: '',
                    messageId: part.messageID,
                    data,
                    delta: delta
                };

                client.onMessageEvent(notification);
                this.logger.debug(`[SseEventRouter] Forwarded message.part.updated: ${part.messageID}, delta=${delta ? delta.length : 0} chars`);

            } else if (event.type === 'message.part.delta') {
                const props = event.properties;

                if (this.userMessageIds.has(props.messageID)) {
                    this.logger.debug(`[SseEventRouter] Skipping message.part.delta for user message: ${props.messageID}`);
                    return;
                }

                this.lastStreamingPartMessageId = props.messageID;

                client.onMessagePartDelta({
                    sessionID: props.sessionID,
                    messageID: props.messageID,
                    partID: props.partID,
                    field: props.field,
                    delta: props.delta
                });

            } else if (event.type === 'message.removed') {
                const removedNotification: MessageNotification = {
                    type: 'removed',
                    sessionId: event.properties.sessionID,
                    projectId: '',
                    messageId: event.properties.messageID,
                };
                client.onMessageEvent(removedNotification);
                this.logger.debug(`[SseEventRouter] Forwarded message.removed: ${event.properties.messageID}`);
            } else if (event.type === 'message.part.removed') {
                const partRemovedNotification: MessageNotification = {
                    type: 'part_removed',
                    sessionId: event.properties.sessionID,
                    projectId: '',
                    messageId: event.properties.messageID,
                    data: {
                        info: { id: event.properties.messageID } as Message,
                        parts: [{ id: event.properties.partID } as MessagePart]
                    }
                };
                client.onMessageEvent(partRemovedNotification);
                this.logger.debug(`[SseEventRouter] Forwarded message.part.removed: ${event.properties.partID}`);
            }
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error forwarding message event: ${error}`);
        }
    }

    /** Forward file event to client. */
    protected forwardFileEvent(event: SDKTypes.EventFileEdited | SDKTypes.EventFileWatcherUpdated, client: OpenCodeClient): void {
        try {
            const filePath = (event.type === 'file.edited' || event.type === 'file.watcher.updated')
                ? event.properties.file : undefined;
            if (!filePath) { return; }
            client.onFileEvent({ type: 'changed', sessionId: '', projectId: '', path: filePath });
            this.logger.debug(`[SseEventRouter] Forwarded file event: ${filePath}`);
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error forwarding file event: ${error}`);
        }
    }

    /**
     * Forward permission event to client.
     */
    protected forwardPermissionEvent(event: SDKTypes.EventPermissionUpdated | SDKTypes.EventPermissionReplied, client: OpenCodeClient): void {
        try {
            if (event.type === 'permission.updated') {
                const perm = event.properties;

                const patterns: string[] | undefined = perm.pattern
                    ? (Array.isArray(perm.pattern) ? perm.pattern : [perm.pattern])
                    : undefined;

                const notification: PermissionNotification = {
                    type: 'requested',
                    sessionId: perm.sessionID,
                    projectId: '',
                    permissionId: perm.id,
                    permission: {
                        id: perm.id,
                        type: perm.type,
                        message: perm.title,
                        status: 'pending'
                    },
                    callID: perm.callID,
                    messageID: perm.messageID,
                    title: perm.title,
                    patterns
                };

                client.onPermissionEvent(notification);
                this.logger.debug(`[SseEventRouter] Forwarded permission.updated: ${perm.id}`);

            } else if (event.type === 'permission.replied') {
                const props = event.properties;

                const notification: PermissionNotification = {
                    type: props.response === 'granted' ? 'granted' : 'denied',
                    sessionId: props.sessionID,
                    projectId: '',
                    permissionId: props.permissionID
                };

                client.onPermissionEvent(notification);
                this.logger.debug(`[SseEventRouter] Forwarded permission.replied: ${props.permissionID}`);
            }
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error forwarding permission event: ${error}`);
        }
    }

    /** Forward question event to client. */
    protected forwardQuestionEvent(event: SDKTypes.EventQuestionAsked | SDKTypes.EventQuestionReplied | SDKTypes.EventQuestionRejected, client: OpenCodeClient): void {
        try {
            if (event.type === 'question.asked') {
                const q = event.properties;
                client.onQuestionEvent({ type: 'asked', sessionId: q.sessionID, projectId: '', requestId: q.id, question: q });
            } else if (event.type === 'question.replied') {
                const p = event.properties;
                client.onQuestionEvent({ type: 'replied', sessionId: p.sessionID, projectId: '', requestId: p.requestID });
            } else if (event.type === 'question.rejected') {
                const p = event.properties;
                client.onQuestionEvent({ type: 'rejected', sessionId: p.sessionID, projectId: '', requestId: p.requestID });
            }
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error forwarding question event: ${error}`);
        }
    }

    /** Forward todo event to client. */
    protected forwardTodoEvent(event: { type: string; properties: { sessionID: string; todos: unknown[] } }, client: OpenCodeClient): void {
        try {
            const todos = Array.isArray(event.properties?.todos)
                ? (event.properties.todos as Array<{ id: string; description: string; status: string }>)
                : [];
            client.onTodoEvent({ sessionId: event.properties?.sessionID ?? '', todos });
        } catch (error) {
            this.logger.error(`[SseEventRouter] Error forwarding todo event: ${error}`);
        }
    }
}
