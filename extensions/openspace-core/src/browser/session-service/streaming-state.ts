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
import { Message, MessagePart } from '../../common/opencode-protocol';
import { MessageStoreService, MessageStoreServiceImpl } from './message-store';

export const StreamingStateService = Symbol('StreamingStateService');

/**
 * Streaming update event data for incremental message updates.
 */
export interface StreamingUpdate {
    messageId: string;
    delta: string;
    isDone: boolean;
}

/**
 * Manages streaming lifecycle, token buffering, streaming status,
 * and the RPC fallback timer.
 */
@injectable()
export class StreamingStateServiceImpl implements Disposable {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(MessageStoreService)
    protected readonly messageStore!: MessageStoreServiceImpl;

    private readonly STREAMING_DONE_DELAY_MS = 500;
    readonly RPC_FALLBACK_DELAY_MS = 5000;

    private _isStreaming = false;
    private _streamingMessageId: string | undefined;
    private _currentStreamingStatus = '';
    private _lastStatusChangeTime = 0;
    private _statusChangeTimeout: ReturnType<typeof setTimeout> | undefined;
    private _streamingDoneTimer: ReturnType<typeof setTimeout> | undefined;
    _rpcFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    // ── Emitters ──

    private readonly onMessageStreamingEmitter = new Emitter<StreamingUpdate>();
    readonly onMessageStreaming: Event<StreamingUpdate> = this.onMessageStreamingEmitter.event;

    private readonly onIsStreamingChangedEmitter = new Emitter<boolean>();
    readonly onIsStreamingChanged: Event<boolean> = this.onIsStreamingChangedEmitter.event;

    private readonly onStreamingStatusChangedEmitter = new Emitter<string>();
    readonly onStreamingStatusChanged: Event<string> = this.onStreamingStatusChangedEmitter.event;

    // ── Getters ──

    get isStreaming(): boolean { return this._isStreaming; }
    get streamingMessageId(): string | undefined { return this._streamingMessageId; }
    get currentStreamingStatus(): string { return this._currentStreamingStatus; }
    get streamingDoneTimer(): ReturnType<typeof setTimeout> | undefined { return this._streamingDoneTimer; }

    // ── Streaming state management ──

    /** Set streaming on (used by facade's sendMessage). */
    setStreaming(value: boolean): void {
        this._isStreaming = value;
        this.onIsStreamingChangedEmitter.fire(value);
    }

    /** Cancel the RPC fallback timer. */
    cancelRpcFallback(): void {
        if (this._rpcFallbackTimer) {
            clearTimeout(this._rpcFallbackTimer);
            this._rpcFallbackTimer = undefined;
        }
    }

    /** Start the RPC fallback timer. Calls `onFallback` if SSE doesn't deliver in time. */
    startRpcFallback(onFallback: () => void): void {
        this.cancelRpcFallback();
        this._rpcFallbackTimer = setTimeout(() => {
            this._rpcFallbackTimer = undefined;
            onFallback();
        }, this.RPC_FALLBACK_DELAY_MS);
    }

    /**
     * Clear local streaming state (used on session switch when leaving a streaming session).
     */
    clearLocalStreamingState(): void {
        this._streamingMessageId = undefined;
        if (this._streamingDoneTimer) {
            clearTimeout(this._streamingDoneTimer);
            this._streamingDoneTimer = undefined;
        }
        this._isStreaming = false;
        this.onIsStreamingChangedEmitter.fire(false);
        this.resetStreamingStatus();
    }

    /**
     * Force-stop streaming if no SSE activity is ongoing.
     * Used by facade after sendMessage's finally block.
     */
    stopIfIdle(): void {
        if (!this._streamingDoneTimer && !this._streamingMessageId) {
            this._isStreaming = false;
            this.onIsStreamingChangedEmitter.fire(false);
            this.resetStreamingStatus();
        }
    }

    /**
     * Full abort: clear all streaming state and timers.
     */
    abortStreaming(): void {
        this.cancelRpcFallback();
        this._streamingMessageId = undefined;
        if (this._streamingDoneTimer) {
            clearTimeout(this._streamingDoneTimer);
            this._streamingDoneTimer = undefined;
        }
        this._isStreaming = false;
        this.onIsStreamingChangedEmitter.fire(false);
        this.resetStreamingStatus();
    }

    // ── Core streaming methods ──

    updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void {
        this.cancelRpcFallback();
        this.logger.debug(`[StreamingState] Streaming update: ${messageId}, isDone=${isDone}`);

        if (!isDone) {
            this._streamingMessageId = messageId;
            if (this._streamingDoneTimer) {
                clearTimeout(this._streamingDoneTimer);
                this._streamingDoneTimer = undefined;
            }
            if (!this._isStreaming) {
                this._isStreaming = true;
                this.onIsStreamingChangedEmitter.fire(true);
            }
            this.updateStreamingStatus(this.messageStore.messages);
        }

        if (!isDone) {
            this.onMessageStreamingEmitter.fire({ messageId, delta, isDone });
        }

        if (delta) {
            const index = this.messageStore.findMessageIndex(messageId);
            if (index < 0) {
                this.logger.warn(`[StreamingState] Streaming message not found: ${messageId}`);
            } else {
                const message = this.messageStore.getMessageAt(index);
                const parts = [...(message.parts || [])];
                if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const lastPart = parts[parts.length - 1] as any;
                    if ('text' in lastPart) {
                        parts[parts.length - 1] = { ...lastPart, text: lastPart.text + delta };
                    }
                } else {
                    parts.push({
                        type: 'text',
                        text: delta,
                        id: `temp-part-${crypto.randomUUID()}`,
                        sessionID: message.sessionID,
                        messageID: message.id
                    } as unknown as NonNullable<Message['parts']>[0]);
                }
                this.messageStore.setMessageAt(index, { ...message, parts });
            }
        }

        if (isDone) {
            this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: true });
            this._streamingMessageId = undefined;
            if (this._streamingDoneTimer) { clearTimeout(this._streamingDoneTimer); }
            this._streamingDoneTimer = setTimeout(() => {
                this._streamingDoneTimer = undefined;
                this._isStreaming = false;
                this.onIsStreamingChangedEmitter.fire(false);
                this.resetStreamingStatus();
            }, this.STREAMING_DONE_DELAY_MS);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStreamingMessageParts(messageId: string, toolParts: any[]): void {
        if (!toolParts || toolParts.length === 0) return;

        const index = this.messageStore.findMessageIndex(messageId);
        if (index < 0) {
            this.logger.warn(`[StreamingState] updateStreamingMessageParts: message not found: ${messageId}`);
            return;
        }

        const message = this.messageStore.getMessageAt(index);
        const parts = [...(message.parts || [])];

        for (const incoming of toolParts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingIndex = parts.findIndex(p => (p as any).id === incoming.id);
            if (existingIndex >= 0) {
                parts[existingIndex] = incoming;
            } else {
                const lastTextIndex = parts.reduce((acc, p, i) => p.type === 'text' ? i : acc, -1);
                if (lastTextIndex >= 0) {
                    parts.splice(lastTextIndex, 0, incoming);
                } else {
                    parts.push(incoming);
                }
            }
        }

        this.messageStore.setMessageAt(index, { ...message, parts });
        this.onMessageStreamingEmitter.fire({ messageId, delta: '', isDone: false });
        this.updateStreamingStatus(this.messageStore.messages);
        this.logger.debug(`[StreamingState] Tool parts upserted for message: ${messageId}, count=${toolParts.length}`);
    }

    applyPartDelta(messageId: string, partId: string, field: string, delta: string): void {
        this.cancelRpcFallback();

        const index = this.messageStore.findMessageIndex(messageId);
        if (index < 0) {
            this.logger.warn(`[StreamingState] applyPartDelta: message not found: ${messageId}`);
            return;
        }

        this._streamingMessageId = messageId;
        if (this._streamingDoneTimer) {
            clearTimeout(this._streamingDoneTimer);
            this._streamingDoneTimer = undefined;
        }
        if (!this._isStreaming) {
            this._isStreaming = true;
            this.onIsStreamingChangedEmitter.fire(true);
        }

        const message = this.messageStore.getMessageAt(index);
        const parts = [...(message.parts || [])];

        const partIndex = parts.findIndex(p => (p as { id?: string }).id === partId);
        if (partIndex >= 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const part = { ...parts[partIndex] } as any;
            part[field] = (part[field] || '') + delta;
            parts[partIndex] = part;
        } else {
            const inferredType =
                field === 'reasoning' ? 'reasoning' :
                field === 'input' || field === 'output' ? 'tool' : 'text';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newPart: any = {
                id: partId,
                sessionID: message.sessionID,
                messageID: messageId,
                type: inferredType,
                [field]: delta
            };
            parts.push(newPart);
        }

        this.messageStore.setMessageAt(index, { ...message, parts });
        this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: false });
        this.updateStreamingStatus(this.messageStore.messages);
    }

    clearStreamingPartText(messageId: string): void {
        const index = this.messageStore.findMessageIndex(messageId);
        if (index < 0) { return; }

        const message = this.messageStore.getMessageAt(index);
        const parts = (message.parts || []).map((p: MessagePart) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = { ...p } as any;
            if (copy.text !== undefined) { copy.text = ''; }
            if (copy.reasoning !== undefined) { copy.reasoning = ''; }
            return copy;
        });

        this.messageStore.setMessageAt(index, { ...message, parts });
    }

    // ── Streaming status ──

    private computeStreamingStatus(messages: Message[]): string {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role !== 'assistant') continue;
            if (!msg.parts || msg.parts.length === 0) continue;
            for (let j = msg.parts.length - 1; j >= 0; j--) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const part = msg.parts[j] as any;
                if (part.type === 'tool') return this.toolNameToCategory(part.tool || '');
                if (part.type === 'reasoning') return 'reasoning';
                if (part.type === 'text') return 'thinking';
            }
        }
        return 'idle';
    }

    private toolNameToCategory(toolName: string): string {
        const name = toolName.toLowerCase();
        if (/^(bash|bash_\d+|execute|run_command|run|shell|cmd|terminal)$/.test(name)) return 'bash';
        if (/^task$/.test(name)) return 'task';
        if (/^(todowrite|todoread|todo_write|todo_read)$/.test(name)) return 'todo';
        if (/^read$/.test(name)) return 'read';
        if (/^(list|list_files|grep|glob|find|rg|ripgrep|ripgrep_search|ripgrep_advanced-search|ripgrep_count-matches|ripgrep_list-files|search)$/.test(name)) return 'search';
        if (/^(webfetch|web_fetch)$/.test(name)) return 'webfetch';
        if (/^(edit|write)$/.test(name)) return 'edit';
        return 'mcp';
    }

    private updateStreamingStatus(messages: Message[]): void {
        const newStatus = this.computeStreamingStatus(messages);
        if (newStatus === this._currentStreamingStatus) return;

        const now = Date.now();
        const elapsed = now - this._lastStatusChangeTime;
        const MIN_STATUS_INTERVAL = 2500;

        if (elapsed >= MIN_STATUS_INTERVAL) {
            this._currentStreamingStatus = newStatus;
            this._lastStatusChangeTime = now;
            this.onStreamingStatusChangedEmitter.fire(newStatus);
            if (this._statusChangeTimeout) {
                clearTimeout(this._statusChangeTimeout);
                this._statusChangeTimeout = undefined;
            }
        } else {
            if (this._statusChangeTimeout) clearTimeout(this._statusChangeTimeout);
            this._statusChangeTimeout = setTimeout(() => {
                const latestStatus = this.computeStreamingStatus(this.messageStore.messages);
                this._currentStreamingStatus = latestStatus;
                this._lastStatusChangeTime = Date.now();
                this.onStreamingStatusChangedEmitter.fire(latestStatus);
                this._statusChangeTimeout = undefined;
            }, MIN_STATUS_INTERVAL - elapsed);
        }
    }

    resetStreamingStatus(): void {
        this._currentStreamingStatus = '';
        this._lastStatusChangeTime = 0;
        if (this._statusChangeTimeout) {
            clearTimeout(this._statusChangeTimeout);
            this._statusChangeTimeout = undefined;
        }
        this.onStreamingStatusChangedEmitter.fire('');
    }

    dispose(): void {
        if (this._statusChangeTimeout) {
            clearTimeout(this._statusChangeTimeout);
            this._statusChangeTimeout = undefined;
        }
        if (this._streamingDoneTimer) {
            clearTimeout(this._streamingDoneTimer);
            this._streamingDoneTimer = undefined;
        }
        this.cancelRpcFallback();
        this.onMessageStreamingEmitter.dispose();
        this.onIsStreamingChangedEmitter.dispose();
        this.onStreamingStatusChangedEmitter.dispose();
    }
}
