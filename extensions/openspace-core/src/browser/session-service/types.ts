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

import { Event } from '@theia/core/lib/common/event';
import { Disposable } from '@theia/core/lib/common/disposable';
import {
    Project, Session, Message, MessagePartInput,
    ProviderWithModels, PermissionNotification
} from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';

// Re-export sub-service symbols for consumer convenience
export { StreamingUpdate, StreamingStateService } from './streaming-state';
export { MessageStoreService } from './message-store';
export { SessionLifecycleService } from './session-lifecycle';
export { InteractionService } from './interaction-handlers';
export { ModelPreferenceService } from './model-preference';

/**
 * Returns a display-safe title for a session.
 * Falls back to a short ID prefix when title is absent or blank.
 */
export function sessionDisplayTitle(session: { id: string; title?: string }): string {
    return session.title?.trim() || `Session ${session.id.slice(0, 8)}`;
}

/**
 * SessionService Symbol for DI binding.
 */
export const SessionService = Symbol('SessionService');

/**
 * SessionService interface - frontend state management for OpenSpace sessions.
 */
export interface SessionService extends Disposable {
    // State (readonly properties)
    readonly activeProject: Project | undefined;
    readonly activeSession: Session | undefined;
    readonly activeModel: string | undefined;
    readonly messages: Message[];
    readonly isLoading: boolean;
    readonly lastError: string | undefined;
    readonly isStreaming: boolean;
    readonly streamingMessageId: string | undefined;
    readonly currentStreamingStatus: string;
    readonly sessionStatus: SDKTypes.SessionStatus;

    // Events
    readonly onActiveProjectChanged: Event<Project | undefined>;
    readonly onActiveSessionChanged: Event<Session | undefined>;
    readonly onActiveModelChanged: Event<string | undefined>;
    readonly onMessagesChanged: Event<Message[]>;
    readonly onMessageStreaming: Event<{ messageId: string; delta: string; isDone: boolean }>;
    readonly onIsLoadingChanged: Event<boolean>;
    readonly onErrorChanged: Event<string | undefined>;
    readonly onIsStreamingChanged: Event<boolean>;
    readonly onStreamingStatusChanged: Event<string>;
    readonly onSessionStatusChanged: Event<SDKTypes.SessionStatus>;

    // Operations
    setActiveProject(projectId: string): Promise<void>;
    setActiveSession(sessionId: string): Promise<void>;
    setActiveModel(model: string): void;
    createSession(title?: string): Promise<Session>;
    sendMessage(parts: MessagePartInput[], model?: { providerID: string; modelID: string }): Promise<void>;
    abort(): Promise<void>;
    getSessions(): Promise<Session[]>;
    searchSessions(query: string): Promise<Session[]>;
    loadMoreSessions(): Promise<Session[]>;
    readonly hasMoreSessions: boolean;
    loadOlderMessages(): Promise<void>;
    readonly hasOlderMessages: boolean;
    getAvailableModels(): Promise<ProviderWithModels[]>;
    deleteSession(sessionId: string): Promise<void>;
    archiveSession(sessionId: string): Promise<void>;
    renameSession(sessionId: string, title: string): Promise<void>;
    shareSession(sessionId: string): Promise<Session>;
    unshareSession(sessionId: string): Promise<void>;
    forkSession(messageId?: string): Promise<void>;
    revertSession(): Promise<void>;
    unrevertSession(): Promise<void>;
    compactSession(): Promise<void>;
    autoSelectProjectByWorkspace(workspacePath: string): Promise<boolean>;

    // State update methods (for SyncService integration)
    incrementUnseenForSession(sessionId: string): void;
    appendMessage(message: Message): void;
    updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStreamingMessageParts(messageId: string, toolParts: any[]): void;
    replaceMessage(messageId: string, message: Message): void;
    fetchMessageFromBackend(messageId: string): Promise<Message | undefined>;
    notifySessionChanged(session: Session): void;
    notifySessionDeleted(sessionId: string): void;
    notifySessionError(sessionId: string, errorMessage: string): void;
    notifyMessageRemoved(sessionId: string, messageId: string): void;
    notifyPartRemoved(sessionId: string, messageId: string, partId: string): void;
    updateSessionStatus(status: SDKTypes.SessionStatus, sessionId?: string): void;
    getSessionStatus(sessionId: string): SDKTypes.SessionStatus | undefined;
    getSessionError(sessionId: string): string | undefined;
    applyPartDelta(messageId: string, partId: string, field: string, delta: string): void;
    clearStreamingPartText(messageId: string): void;
    reloadMessages(): Promise<void>;
    getMessagesForPreview(sessionId: string): Promise<Message[]>;

    // Question state
    readonly pendingQuestions: SDKTypes.QuestionRequest[];
    readonly onQuestionChanged: Event<SDKTypes.QuestionRequest[]>;

    // Todo state
    readonly todos: Array<{ id: string; description: string; status: string }>;
    readonly onTodosChanged: Event<Array<{ id: string; description: string; status: string }>>;

    // Question operations
    addPendingQuestion(question: SDKTypes.QuestionRequest): void;
    removePendingQuestion(requestId: string): void;
    updateTodos(todos: Array<{ id: string; description: string; status: string }>): void;
    answerQuestion(requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<void>;
    rejectQuestion(requestId: string): Promise<void>;

    // Permission state
    readonly pendingPermissions: PermissionNotification[];
    readonly onPermissionChanged: Event<PermissionNotification[]>;

    // Permission operations
    addPendingPermission(permission: PermissionNotification): void;
    removePendingPermission(permissionId: string): void;
    replyPermission(requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void>;
}
