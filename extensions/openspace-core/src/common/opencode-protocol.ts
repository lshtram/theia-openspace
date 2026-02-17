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

/**
 * Path for the OpenCode service.
 */
export const openCodeServicePath = '/services/opencode';

/**
 * Core Project interface matching opencode REST API.
 */
export interface Project {
    readonly id: string;
    readonly name: string;
    readonly path: string;
}

/**
 * Session interface matching opencode REST API.
 */
export interface Session {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly directory: string;
    readonly parentID?: string;
}

/**
 * Message role types.
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message part types - discriminated union for different content types.
 */
export type MessagePart =
    | TextMessagePart
    | ToolUseMessagePart
    | ToolResultMessagePart
    | FileMessagePart
    | ImageMessagePart;

export interface TextMessagePart {
    readonly type: 'text';
    readonly text: string;
}

export interface ToolUseMessagePart {
    readonly type: 'tool_use';
    readonly id: string;
    readonly name: string;
    readonly input: Record<string, unknown>;
}

export interface ToolResultMessagePart {
    readonly type: 'tool_result';
    readonly tool_use_id: string;
    readonly content: string;
    readonly is_error?: boolean;
}

export interface FileMessagePart {
    readonly type: 'file';
    readonly path: string;
    readonly content?: string;
}

export interface ImageMessagePart {
    readonly type: 'image';
    readonly path: string;
    readonly mime_type?: string;
}

/**
 * Message with parts interface.
 */
export interface Message {
    readonly id: string;
    readonly sessionId: string;
    readonly role: MessageRole;
    readonly parts: MessagePart[];
    readonly metadata?: Record<string, unknown>;
}

/**
 * Message with parts (for API responses).
 */
export interface MessageWithParts {
    readonly info: Message;
    readonly parts: MessagePart[];
}

/**
 * File status interface.
 */
export interface FileStatus {
    readonly path: string;
    readonly status: 'added' | 'modified' | 'deleted' | 'unchanged';
}

/**
 * File content interface.
 */
export interface FileContent {
    readonly type: 'raw' | 'patch';
    readonly content: string;
}

/**
 * Provider interface.
 */
export interface Provider {
    readonly id: string;
    readonly name: string;
    readonly model: string;
}

/**
 * Agent interface.
 */
export interface Agent {
    readonly id: string;
    readonly name: string;
    readonly provider: Provider;
}

/**
 * Application configuration interface.
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
    createMessage(projectId: string, sessionId: string, message: Partial<Message>): Promise<MessageWithParts>;

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
 * Permission interface.
 */
export interface Permission {
    readonly id: string;
    readonly type: string;
    readonly message: string;
    readonly status: 'pending' | 'granted' | 'denied';
}
