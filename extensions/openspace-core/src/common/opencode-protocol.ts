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
export type SDKAgentPartInput = SDKTypes.AgentPartInput;
export type MessagePartInput = SDKTypes.TextPartInput | SDKTypes.FilePartInput | SDKTypes.AgentPartInput;

// ============================================================================
// Application Types (SDK-based)
// Using @opencode-ai/sdk types as the source of truth
// ============================================================================

/**
 * Path for the OpenCode service.
 */
export const openCodeServicePath = '/services/opencode';

/**
 * Project type - directly from SDK.
 * SDK uses: id, worktree (not path/name), vcsDir?, vcs?, time.
 */
export type Project = SDKTypes.Project;

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
 * Command info (API response from GET /command).
 */
export interface CommandInfo {
    name: string;
    description?: string;
    agent?: string;
    model?: string;
    source?: 'command' | 'mcp' | 'skill';
    subtask?: boolean;
    hints?: string[];
}

/**
 * Agent info (API response from GET /agent — returns Agent.Info[]).
 * Shape matches the OpenCode server's Agent.Info zod schema.
 */
export interface AgentInfo {
    name: string;
    description?: string;
    model?: {
        modelID: string;
        providerID: string;
    };
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

    // SSE connection methods
    connectToProject(directory: string): Promise<void>;

    // Session methods
    getSessions(projectId: string): Promise<Session[]>;
    getSession(projectId: string, sessionId: string): Promise<Session>;
    createSession(projectId: string, session: Partial<Session>): Promise<Session>;
    deleteSession(projectId: string, sessionId: string): Promise<void>;
    initSession(projectId: string, sessionId: string): Promise<Session>;
    abortSession(projectId: string, sessionId: string): Promise<Session>;
    shareSession(projectId: string, sessionId: string): Promise<Session>;
    unshareSession(projectId: string, sessionId: string): Promise<Session>;
    compactSession(projectId: string, sessionId: string, model?: { providerID: string; modelID: string }): Promise<Session>;
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

    // Permission methods
    replyPermission(projectId: string, requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void>;

    // Command methods
    listCommands(directory?: string): Promise<CommandInfo[]>;

    // Execute a slash command via POST /session/:id/command
    sessionCommand(sessionId: string, command: string, args: string, agent: string, model?: { providerID: string; modelID: string }): Promise<void>;

    // File search with query
    searchFiles(sessionId: string, query: string, limit?: number): Promise<string[]>;

    // Agent list
    listAgents(directory?: string): Promise<AgentInfo[]>;

    // Question methods
    listPendingQuestions(projectId: string, sessionId: string): Promise<SDKTypes.QuestionRequest[]>;
    answerQuestion(projectId: string, requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<boolean>;
    rejectQuestion(projectId: string, requestId: string): Promise<boolean>;

    // Path validation (Node-side, uses fs.realpath for symlink resolution)
    validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }>;

    // Shell command execution (Node-side, uses child_process.exec)
    executeShellCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }>;
}

/**
 * OpenCode Client interface - callback methods for the frontend.
 */
export interface OpenCodeClient {
    onSessionEvent(event: SessionNotification): void;
    onMessageEvent(event: MessageNotification): void;
    onMessagePartDelta(event: MessagePartDeltaNotification): void;
    onFileEvent(event: FileNotification): void;
    onPermissionEvent(event: PermissionNotification): void;
    onQuestionEvent(event: QuestionNotification): void;
    onAgentCommand(command: AgentCommand): void;
}

/**
 * Question event notification.
 */
export interface QuestionNotification {
    readonly type: QuestionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly requestId: string;
    readonly question?: SDKTypes.QuestionRequest;
}

export type QuestionEventType = 'asked' | 'replied' | 'rejected';

/**
 * Session event notification.
 */
export interface SessionNotification {
    readonly type: SessionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly data?: Session;
    /** Present when type === 'status_changed'. Server-authoritative session status. */
    readonly sessionStatus?: import('../common/opencode-sdk-types').SessionStatus;
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
    | 'unreverted'
    | 'status_changed';

/**
 * Message event notification.
 */
export interface MessageNotification {
    readonly type: MessageEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly messageId: string;
    readonly data?: MessageWithParts;
    /** Incremental text delta for streaming (message.part.updated events). */
    readonly delta?: string;
    /**
     * For 'completed' events: the message ID that was used during streaming (message.part.updated).
     * The opencode backend uses a different ID for streaming parts vs the final consolidated message.
     * When set, the sync service should replace the streaming stub (previousMessageId) with the
     * completed message (messageId), rather than looking up messageId directly.
     */
    readonly previousMessageId?: string;
}

export type MessageEventType = 'created' | 'partial' | 'completed';

/**
 * Message part delta notification — per-token text append.
 * Separate from MessageNotification to avoid overloading the 'partial' type.
 */
export interface MessagePartDeltaNotification {
    readonly sessionID: string;
    readonly messageID: string;
    readonly partID: string;
    readonly field: string;
    readonly delta: string;
}

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
    /** callID links this permission request to a specific ToolPart */
    readonly callID?: string;
    /** messageID of the message containing the tool part */
    readonly messageID?: string;
    /** Human-readable title for the permission prompt */
    readonly title?: string;
    /** Glob patterns the permission applies to */
    readonly patterns?: string[];
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

