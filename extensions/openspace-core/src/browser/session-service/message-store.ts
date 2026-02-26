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
import { Emitter, Event } from '@theia/core/lib/common/event';
import { ILogger } from '@theia/core/lib/common/logger';
import { Disposable } from '@theia/core/lib/common/disposable';
import { OpenCodeService, Message, MessagePart } from '../../common/opencode-protocol';

export const MessageStoreService = Symbol('MessageStoreService');

/**
 * Manages in-memory message storage, CRUD, and change notification.
 *
 * StreamingState calls `findMessageIndex`, `getMessageAt`, `setMessageAt`,
 * and `fireChanged` to update messages during streaming without owning the array.
 */
@injectable()
export class MessageStoreServiceImpl implements Disposable {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    private _messages: Message[] = [];
    private _messageLoadCursor: string | undefined = undefined;
    private _hasOlderMessages = false;

    private readonly onMessagesChangedEmitter = new Emitter<Message[]>();
    readonly onMessagesChanged: Event<Message[]> = this.onMessagesChangedEmitter.event;

    get messages(): Message[] {
        return this._messages;
    }

    get hasOlderMessages(): boolean {
        return this._hasOlderMessages;
    }

    // ── Low-level accessors for StreamingState ──

    /** Find the index of a message by ID. Returns -1 if not found. */
    findMessageIndex(messageId: string): number {
        return this._messages.findIndex(m => m.id === messageId);
    }

    /** Get message at a specific index. */
    getMessageAt(index: number): Message {
        return this._messages[index];
    }

    /** Replace a message at a specific index and fire change event. */
    setMessageAt(index: number, message: Message): void {
        this._messages[index] = message;
        this.fireChanged();
    }

    /** Fire the messages changed event. */
    fireChanged(): void {
        this.onMessagesChangedEmitter.fire([...this._messages]);
    }

    /** Check if a message with the given ID exists. */
    hasMessage(messageId: string): boolean {
        return this._messages.some(m => m.id === messageId);
    }

    // ── Message CRUD ──

    /**
     * Append a new message. Prevents duplicates by ID.
     * Returns true if the message was added, false if it was a duplicate.
     */
    appendMessage(message: Message): boolean {
        if (this._messages.some(m => m.id === message.id)) {
            this.logger.debug(`[MessageStore] appendMessage: skipping duplicate: ${message.id}`);
            return false;
        }
        this._messages.push(message);
        this.fireChanged();
        return true;
    }

    /** Push a message without dedup check (used for optimistic messages). */
    pushMessage(message: Message): void {
        this._messages.push(message);
        this.fireChanged();
    }

    /** Remove a message by ID (used for optimistic rollback). */
    removeMessage(messageId: string): void {
        this._messages = this._messages.filter(m => m.id !== messageId);
        this.fireChanged();
    }

    /** Replace an existing message by ID. */
    replaceMessage(messageId: string, message: Message): void {
        this.logger.debug(`[MessageStore] Replacing message: ${messageId}`);
        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            this.logger.warn(`[MessageStore] Message not found for replacement: ${messageId}`);
            return;
        }
        this._messages[index] = message;
        this.fireChanged();
    }

    /** Fetch a full message from the backend by ID. */
    async fetchMessageFromBackend(
        projectId: string, sessionId: string, messageId: string
    ): Promise<Message | undefined> {
        try {
            const fullMessage = await this.openCodeService.getMessage(projectId, sessionId, messageId);
            return { ...fullMessage.info, parts: fullMessage.parts || [] } as Message;
        } catch (error) {
            this.logger.debug(`[MessageStore] fetchMessageFromBackend failed for ${messageId}: ${error}`);
            return undefined;
        }
    }

    /**
     * Fetch a message from the backend and insert it if not already present.
     * Used as an RPC fallback when SSE doesn't deliver the assistant message in time.
     */
    async fetchAndInsertFallback(
        projectId: string, sessionId: string, fallbackMessage: Message
    ): Promise<void> {
        const fullMsg = await this.fetchMessageFromBackend(projectId, sessionId, fallbackMessage.id);
        const toInsert = fullMsg ?? fallbackMessage;
        if (!this.hasMessage(fallbackMessage.id)) { this.appendMessage(toInsert); }
    }

    // ── Notification handlers (from SyncService) ──

    notifyMessageRemoved(sessionId: string, activeSessionId: string | undefined, messageId: string): void {
        if (activeSessionId !== sessionId) { return; }
        this._messages = this._messages.filter(m => m.id !== messageId);
        this.fireChanged();
        this.logger.debug(`[MessageStore] Message removed: ${messageId}`);
    }

    notifyPartRemoved(sessionId: string, activeSessionId: string | undefined, messageId: string, partId: string): void {
        if (activeSessionId !== sessionId) { return; }
        this._messages = this._messages.map(m => {
            if (m.id !== messageId) { return m; }
            return { ...m, parts: (m.parts ?? []).filter((p: MessagePart) => p.id !== partId) };
        });
        this.fireChanged();
        this.logger.debug(`[MessageStore] Part removed: ${partId} from message ${messageId}`);
    }

    // ── Bulk operations ──

    /**
     * Load messages for a session from the backend.
     * Returns the loaded messages for model restoration by the caller.
     */
    async loadMessages(projectId: string, sessionId: string): Promise<Message[]> {
        this.logger.debug(`[MessageStore] Loading messages for session: ${sessionId}`);
        const messagesWithParts = await this.openCodeService.getMessages(projectId, sessionId, 400);
        this._messages = messagesWithParts.map(m => ({ ...m.info, parts: m.parts || [] }));
        this._hasOlderMessages = messagesWithParts.length === 400;
        this._messageLoadCursor = messagesWithParts[0]?.info?.id;
        this.fireChanged();
        this.logger.debug(`[MessageStore] Loaded ${this._messages.length} messages`);
        return this._messages;
    }

    async loadOlderMessages(projectId: string, sessionId: string): Promise<void> {
        if (!this._hasOlderMessages) { return; }
        try {
            const older = await this.openCodeService.getMessages(projectId, sessionId, 400, this._messageLoadCursor);
            const olderMapped = older.map(m => ({ ...m.info, parts: m.parts ?? [] }));
            this._messages = [...olderMapped, ...this._messages];
            this._messageLoadCursor = older[0]?.info?.time?.created?.toString();
            this._hasOlderMessages = older.length === 400;
            this.fireChanged();
        } catch (error) {
            this.logger.warn(`[MessageStore] loadOlderMessages error: ${error}`);
        }
    }

    /** Fetch the last 5 messages of any session for hover preview (read-only). */
    async getMessagesForPreview(projectId: string, sessionId: string): Promise<Message[]> {
        try {
            const msgs = await this.openCodeService.getMessages(projectId, sessionId, 5);
            return msgs.map(m => ({ ...m.info, parts: m.parts ?? [] }));
        } catch {
            return [];
        }
    }

    /** Clear all messages (used on session switch or deletion). */
    clear(): void {
        this._messages = [];
        this._messageLoadCursor = undefined;
        this._hasOlderMessages = false;
        this.fireChanged();
    }

    dispose(): void {
        this.onMessagesChangedEmitter.dispose();
    }
}
