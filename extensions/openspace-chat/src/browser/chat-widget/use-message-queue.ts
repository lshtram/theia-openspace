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

import * as React from '@theia/core/shared/react';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { MessagePartInput, OpenCodeService } from 'openspace-core/lib/common/opencode-protocol';
import type { MessagePart as PromptMessagePart } from '../prompt-input/types';

export interface MessageQueueState {
    queuedCount: number;
    handleSend: (parts: PromptMessagePart[]) => Promise<void>;
    handleCommand: (command: string, args: string, agent?: string) => Promise<void>;
    handleBuiltinCommand: (command: string) => void;
}

/**
 * Message queue, send, and command handlers.
 * Messages are queued when streaming is active and drained sequentially when it ends.
 */
export function useMessageQueue(
    sessionService: SessionService,
    openCodeService: OpenCodeService,
    isStreaming: boolean,
    // getVariant: optional accessor for the current model mode/variant.
    // Reserved for future use when sendMessage supports variant selection.
    _getVariant?: () => string,
): MessageQueueState {
    const [queuedCount, setQueuedCount] = React.useState(0);
    const messageQueueRef = React.useRef<PromptMessagePart[][]>([]);
    const isSendingRef = React.useRef(false);

    const sendPartsNow = React.useCallback(async (parts: PromptMessagePart[]) => {
        const activeModel = sessionService.activeModel;
        const model = activeModel ? (() => {
            const [providerPart, ...modelParts] = activeModel.split('/');
            const modelPart = modelParts.join('/');
            return { providerID: providerPart, modelID: modelPart };
        })() : undefined;

        if (process.env.NODE_ENV !== 'production') {
            if (process.env.NODE_ENV !== 'production') { console.log('[ChatWidget] Sending message with model:', model || 'default'); }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await sessionService.sendMessage(parts as any as MessagePartInput[], model);
    }, [sessionService]);

    const drainQueue = React.useCallback(async () => {
        if (isSendingRef.current) return;
        while (messageQueueRef.current.length > 0) {
            isSendingRef.current = true;
            const next = messageQueueRef.current.shift()!;
            setQueuedCount(messageQueueRef.current.length);
            try {
                await sendPartsNow(next);
            } catch (error) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[ChatWidget] Error sending queued message:', error);
                }
            }
        }
        isSendingRef.current = false;
    }, [sendPartsNow]);

    // When streaming ends, drain any queued messages
    React.useEffect(() => {
        if (!isStreaming) {
            drainQueue();
        }
    }, [isStreaming, drainQueue]);

    const handleSend = React.useCallback(async (parts: PromptMessagePart[]) => {
        if (parts.length === 0) return;

        if (isStreaming || isSendingRef.current) {
            messageQueueRef.current.push(parts);
            setQueuedCount(messageQueueRef.current.length);
            return;
        }

        try {
            await sendPartsNow(parts);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error sending message:', error);
            }
        }
    }, [sessionService, isStreaming, sendPartsNow]);

    const handleCommand = React.useCallback(async (command: string, args: string, agent?: string) => {
        const session = sessionService.activeSession;
        if (!session) return;
        const activeModel = sessionService.activeModel;
        const model = activeModel ? (() => {
            const [providerPart, ...modelParts] = activeModel.split('/');
            return { providerID: providerPart, modelID: modelParts.join('/') };
        })() : undefined;
        await openCodeService.sessionCommand(session.id, command, args, agent ?? 'general', model);
    }, [sessionService, openCodeService]);

    const handleBuiltinCommand = React.useCallback((command: string) => {
        switch (command) {
            case 'clear':
                sessionService.createSession().catch(err => {
                    console.error('[ChatWidget] Failed to create new session for /clear:', err);
                });
                break;
            case 'compact': {
                const session = sessionService.activeSession;
                const project = sessionService.activeProject;
                if (session && project) {
                    const activeModel = sessionService.activeModel;
                    const model = activeModel ? (() => {
                        const [providerPart, ...modelParts] = activeModel.split('/');
                        return { providerID: providerPart, modelID: modelParts.join('/') };
                    })() : undefined;
                    openCodeService.compactSession(project.id, session.id, model).catch(err => {
                        console.error('[ChatWidget] Failed to compact session:', err);
                    });
                }
                break;
            }
            case 'help':
                break;
            default:
                console.warn(`[ChatWidget] Unknown builtin command: /${command}`);
        }
    }, [sessionService, openCodeService]);

    return {
        queuedCount,
        handleSend,
        handleCommand,
        handleBuiltinCommand,
    };
}
