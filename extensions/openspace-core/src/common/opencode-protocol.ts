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

import { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { AgentCommand } from './command-manifest';

// ============================================================================
// SDK Type Bridge (Task 2B.2)
// Import SDK types and create aliases for backward compatibility
// ============================================================================
import * as SDKTypes from './opencode-sdk-types';

// Re-export SDK types under our current names for backward compatibility
export type SDKSession = SDKTypes.Session;
export type SDKUserMessage = SDKTypes.UserMessage;
export type SDKAssistantMessage = SDKTypes.AssistantMessage;
export type SDKMessage = SDKTypes.UserMessage | SDKTypes.AssistantMessage;
export type SDKPart = SDKTypes.Part;
export type SDKProvider = SDKTypes.Provider;
export type SDKModel = SDKTypes.Model;
export type SDKProject = SDKTypes.Project;
export type SDKPermission = SDKTypes.Permission;

// Part types (expanded from 3 to 12+ variants)
export type SDKTextPart = SDKTypes.TextPart;
export type SDKFilePart = SDKTypes.FilePart;
export type SDKToolPart = SDKTypes.ToolPart;
export type SDKAgentPart = SDKTypes.AgentPart;
export type SDKStepStartPart = SDKTypes.StepStartPart;
export type SDKStepFinishPart = SDKTypes.StepFinishPart;
export type SDKSnapshotPart = SDKTypes.SnapshotPart;
export type SDKPatchPart = SDKTypes.PatchPart;
export type SDKReasoningPart = SDKTypes.ReasoningPart;
export type SDKRetryPart = SDKTypes.RetryPart;
export type SDKCompactionPart = SDKTypes.CompactionPart;

// Input types (for creating parts without IDs - SDK provides these)
export type SDKTextPartInput = SDKTypes.TextPartInput;
export type SDKFilePartInput = SDKTypes.FilePartInput;
export type MessagePartInput = SDKTypes.TextPartInput | SDKTypes.FilePartInput;

// ============================================================================
// Application Types (SDK-based)
// Using @opencode-ai/sdk types as the source of truth
// ============================================================================

/**
 * Path for the OpenCode service.
 */
export const openCodeServicePath = '/services/opencode';

/**
 * Project interface (Theia-specific, not in SDK).
 */
export interface Project {
    readonly id: string;
    readonly name: string;
    readonly path: string;
}

/**
 * Session type - directly from SDK.
 * SDK uses: projectID (not projectId), time.created/updated (numbers, not string dates)
 */
export type Session = SDKTypes.Session;

/**
 * Message role types.
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message part type - directly from SDK.
 * SDK has 12+ part variants: text, file, tool, agent, step-start, step-finish,
 * snapshot, patch, reasoning, retry, compaction, subtask.
 */
export type MessagePart = SDKTypes.Part;

/**
 * Message type - HYBRID: SDK types + optional parts field.
 * SDK separates UserMessage and AssistantMessage. Our architecture includes
 * parts inline for convenience, but SDK doesn't. This hybrid maintains compatibility.
 */
export type Message = (SDKTypes.UserMessage | SDKTypes.AssistantMessage) & {
    readonly parts?: MessagePart[];
};

/**
 * Message with parts (API response wrapper).
 */
export interface MessageWithParts {
    readonly info: Message;
    readonly parts: MessagePart[];
}

/**
 * File status (API response).
 */
export interface FileStatus {
    readonly path: string;
    readonly status: 'added' | 'modified' | 'deleted' | 'unchanged';
}

/**
 * File content (API response).
 */
export interface FileContent {
    readonly type: 'raw' | 'patch';
    readonly content: string;
}

/**
 * Provider type - directly from SDK.
 */
export type Provider = SDKTypes.Provider;

/**
 * Provider with models (API response format).
 * Note: SDK has Provider and Model types, but API returns them grouped.
 */
export interface ProviderWithModels {
    readonly id: string;
    readonly name: string;
    readonly models: Record<string, SDKTypes.Model>;
}

/**
 * Agent (API response).
 */
export interface Agent {
    readonly id: string;
    readonly name: string;
    readonly provider: Provider;
}

/**
 * Application configuration (API response).
 */
export interface AppConfig {
    readonly model: string;
    readonly provider: string;
    readonly directory?: string;
}

/**
 * OpenCode Service Symbol.
 */
export const OpenCodeService = Symbol('OpenCodeService');

/**
 * OpenCode Client Symbol.
 */
export const OpenCodeClient = Symbol('OpenCodeClient');

/**
 * OpenCode Service interface - RPC methods for the backend.
 */
export interface OpenCodeService extends RpcServer<OpenCodeClient> {
    // Project methods
    getProjects(): Promise<Project[]>;
    initProject(directory: string): Promise<Project>;

    // Session methods
    getSessions(projectId: string): Promise<Session[]>;
    getSession(projectId: string, sessionId: string): Promise<Session>;
    createSession(projectId: string, session: Partial<Session>): Promise<Session>;
    deleteSession(projectId: string, sessionId: string): Promise<void>;
    initSession(projectId: string, sessionId: string): Promise<Session>;
    abortSession(projectId: string, sessionId: string): Promise<Session>;
    shareSession(projectId: string, sessionId: string): Promise<Session>;
    unshareSession(projectId: string, sessionId: string): Promise<Session>;
    compactSession(projectId: string, sessionId: string): Promise<Session>;
    revertSession(projectId: string, sessionId: string): Promise<Session>;
    unrevertSession(projectId: string, sessionId: string): Promise<Session>;
    grantPermission(projectId: string, sessionId: string, permissionId: string): Promise<Session>;

    // Message methods
    getMessages(projectId: string, sessionId: string): Promise<MessageWithParts[]>;
    getMessage(projectId: string, sessionId: string, messageId: string): Promise<MessageWithParts>;
    createMessage(projectId: string, sessionId: string, message: Partial<Message>, model?: { providerID: string; modelID: string }): Promise<MessageWithParts>;

    // File methods
    findFiles(projectId: string, sessionId: string): Promise<string[]>;
    getFile(projectId: string, sessionId: string): Promise<FileContent>;
    getFileStatus(projectId: string, sessionId: string): Promise<FileStatus[]>;

    // Agent methods
    getAgent(projectId: string, directory?: string): Promise<Agent>;

    // Provider methods
    getProvider(directory?: string): Promise<Provider>;

    // Config methods
    getConfig(directory?: string): Promise<AppConfig>;

    // Model methods
    getAvailableModels(directory?: string): Promise<ProviderWithModels[]>;
}

/**
 * OpenCode Client interface - callback methods for the frontend.
 */
export interface OpenCodeClient {
    onSessionEvent(event: SessionNotification): void;
    onMessageEvent(event: MessageNotification): void;
    onFileEvent(event: FileNotification): void;
    onPermissionEvent(event: PermissionNotification): void;
    onAgentCommand(command: AgentCommand): void;
}

/**
 * Session event notification.
 */
export interface SessionNotification {
    readonly type: SessionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly data?: Session;
}

export type SessionEventType =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'init_started'
    | 'init_completed'
    | 'aborted'
    | 'shared'
    | 'unshared'
    | 'compacted'
    | 'reverted'
    | 'unreverted';

/**
 * Message event notification.
 */
export interface MessageNotification {
    readonly type: MessageEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly messageId: string;
    readonly data?: MessageWithParts;
}

export type MessageEventType = 'created' | 'partial' | 'completed';

/**
 * File event notification.
 */
export interface FileNotification {
    readonly type: FileEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly path?: string;
}

export type FileEventType = 'changed' | 'saved' | 'reset';

/**
 * Permission event notification.
 */
export interface PermissionNotification {
    readonly type: PermissionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly permissionId?: string;
    readonly permission?: Permission;
}

export type PermissionEventType = 'requested' | 'granted' | 'denied';

/**
 * Permission interface (SSE event format).
 * Note: This is different from SDK Permission which has title/metadata fields.
 * SSE events use this simpler format.
 */
export interface Permission {
    readonly id: string;
    readonly type: string;
    readonly message: string;
    readonly status: 'pending' | 'granted' | 'denied';
}

