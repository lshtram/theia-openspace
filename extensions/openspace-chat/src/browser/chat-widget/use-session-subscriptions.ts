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
import { Disposable } from '@theia/core/lib/common/disposable';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { Message, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import type * as SDKTypes from 'openspace-core/lib/common/opencode-sdk-types';

export interface SessionSubscriptionState {
    messages: Message[];
    isStreaming: boolean;
    streamingStatus: string;
    streamingMessageId: string | undefined;
    sessionBusy: boolean;
    sessionError: string | undefined;
    setSessionError: (err: string | undefined) => void;
    retryStatus: { attempt: number; message: string; next: number } | undefined;
    pendingQuestions: SDKTypes.QuestionRequest[];
    pendingPermissions: PermissionNotification[];
    /** React-state copy of sessionService.activeSession?.id — changes trigger dependent useEffects */
    activeSessionId: string | undefined;
}

/**
 * Master subscription hook — subscribes to all SessionService events and returns
 * the corresponding reactive state. Keeps the main ChatComponent free of
 * subscription boilerplate.
 */
export function useSessionSubscriptions(
    sessionService: SessionService,
    loadSessions: () => void
): SessionSubscriptionState {
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [streamingStatus, setStreamingStatus] = React.useState('');
    const [streamingMessageId, setStreamingMessageId] = React.useState<string | undefined>();
    const [sessionBusy, setSessionBusy] = React.useState(false);
    const [sessionError, setSessionError] = React.useState<string | undefined>(sessionService.lastError);
    const [retryStatus, setRetryStatus] = React.useState<{ attempt: number; message: string; next: number } | undefined>(undefined);
    const [pendingQuestions, setPendingQuestions] = React.useState<SDKTypes.QuestionRequest[]>([]);
    const [pendingPermissions, setPendingPermissions] = React.useState<PermissionNotification[]>([]);
    const [activeSessionId, setActiveSessionId] = React.useState<string | undefined>(sessionService.activeSession?.id);
    const disposablesRef = React.useRef<Disposable[]>([]);

    React.useEffect(() => {
        // Initial data
        setMessages([...sessionService.messages]);
        loadSessions();

        // Subscribe to message changes (throttled at 100ms during streaming to prevent DOM thrashing)
        let messageThrottleTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingMsgs: Message[] | null = null;

        const messagesDisposable = sessionService.onMessagesChanged(msgs => {
            if (sessionService.isStreaming) {
                pendingMsgs = msgs;
                if (!messageThrottleTimer) {
                    setMessages(msgs);
                    setStreamingMessageId(sessionService.streamingMessageId);
                    messageThrottleTimer = setTimeout(() => {
                        if (pendingMsgs) {
                            setMessages(pendingMsgs);
                            setStreamingMessageId(sessionService.streamingMessageId);
                            pendingMsgs = null;
                        }
                        messageThrottleTimer = null;
                    }, 100);
                }
            } else {
                if (messageThrottleTimer) {
                    clearTimeout(messageThrottleTimer);
                    messageThrottleTimer = null;
                }
                pendingMsgs = null;
                setMessages([...msgs]);
                setStreamingMessageId(sessionService.streamingMessageId);
            }
        });

        const streamingStateDisposable = sessionService.onIsStreamingChanged(streaming => {
            setIsStreaming(streaming);
            if (!streaming) {
                if (messageThrottleTimer) {
                    clearTimeout(messageThrottleTimer);
                    messageThrottleTimer = null;
                }
                if (pendingMsgs) {
                    setMessages(pendingMsgs);
                    pendingMsgs = null;
                }
                const serverIdle = sessionService.sessionStatus?.type === 'idle';
                if (serverIdle) {
                    setStreamingMessageId(undefined);
                    setStreamingStatus('');
                }
            }
        });

        setStreamingStatus(sessionService.currentStreamingStatus);
        const streamingStatusDisposable = sessionService.onStreamingStatusChanged(status => {
            setStreamingStatus(status);
        });

        const currentStatus = sessionService.sessionStatus;
        setSessionBusy(currentStatus ? currentStatus.type !== 'idle' : false);
        const sessionStatusDisposable = sessionService.onSessionStatusChanged?.((status: { type: string; attempt?: number; message?: string; next?: number }) => {
            setSessionBusy(status.type !== 'idle');
            if (status.type === 'retry' && status.attempt !== undefined && status.message !== undefined && status.next !== undefined) {
                setRetryStatus({ attempt: status.attempt, message: status.message, next: status.next });
            } else {
                setRetryStatus(undefined);
            }
            if (status.type === 'idle') {
                setStreamingMessageId(undefined);
                setStreamingStatus('');
            }
        }) ?? { dispose: () => {} };

        const sessionChangedDisposable = sessionService.onActiveSessionChanged(session => {
            setActiveSessionId(session?.id);
            loadSessions();
        });

        const projectChangedDisposable = sessionService.onActiveProjectChanged(() => {
            loadSessions();
        });

        setPendingQuestions([...sessionService.pendingQuestions]);
        const questionChangedDisposable = sessionService.onQuestionChanged(questions => {
            setPendingQuestions([...questions]);
        });

        setPendingPermissions([...sessionService.pendingPermissions]);
        const permissionChangedDisposable = sessionService.onPermissionChanged(permissions => {
            setPendingPermissions([...permissions]);
        });

        setSessionError(sessionService.lastError);
        const errorChangedDisposable = sessionService.onErrorChanged(err => {
            setSessionError(err);
        });

        disposablesRef.current = [
            messagesDisposable,
            streamingStateDisposable,
            streamingStatusDisposable,
            sessionStatusDisposable,
            sessionChangedDisposable,
            projectChangedDisposable,
            questionChangedDisposable,
            permissionChangedDisposable,
            errorChangedDisposable
        ];

        return () => {
            disposablesRef.current.forEach(d => { d.dispose(); });
            disposablesRef.current = [];
            if (messageThrottleTimer) {
                clearTimeout(messageThrottleTimer);
            }
        };
    }, [sessionService, loadSessions]);

    return {
        messages,
        isStreaming,
        streamingStatus,
        streamingMessageId,
        sessionBusy,
        sessionError,
        setSessionError,
        retryStatus,
        pendingQuestions,
        pendingPermissions,
        activeSessionId,
    };
}
