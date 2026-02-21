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

// Import base types from opencode-protocol.ts
import {
    SessionEventType,
    MessageEventType as BaseMessageEventType,
    FileEventType as BaseFileEventType,
    PermissionEventType as BasePermissionEventType
} from './opencode-protocol';

// Re-export SessionEventType (identical in both files)
export { SessionEventType } from './opencode-protocol';

// Augment types with extra variants
export type MessageEventType = BaseMessageEventType | 'error';
export type FileEventType = BaseFileEventType | 'created' | 'modified' | 'deleted';
export type PermissionEventType = BasePermissionEventType | 'cancelled';

/**
 * Session event interface.
 */
export interface SessionEvent {
    readonly type: SessionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly timestamp: string;
    readonly data?: SessionEventData;
}

export interface SessionEventData {
    readonly id?: string;
    readonly title?: string;
    readonly directory?: string;
    readonly parentID?: string;
    readonly updatedAt?: string;
}

/**
 * Message event interface.
 */
export interface MessageEvent {
    readonly type: MessageEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly messageId: string;
    readonly timestamp: string;
    readonly data?: MessageEventData;
}

export interface MessageEventData {
    readonly id?: string;
    readonly role?: string;
    readonly parts?: MessageEventPart[];
    readonly metadata?: Record<string, unknown>;
}

export interface MessageEventPart {
    readonly type: string;
    readonly text?: string;
    readonly id?: string;
    readonly name?: string;
    readonly input?: Record<string, unknown>;
    readonly tool_use_id?: string;
    readonly content?: string;
    readonly is_error?: boolean;
    readonly path?: string;
    readonly mime_type?: string;
}

/**
 * File event interface.
 */
export interface FileEvent {
    readonly type: FileEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly timestamp: string;
    readonly path?: string;
    readonly status?: 'added' | 'modified' | 'deleted' | 'unchanged';
}

/**
 * Permission event interface.
 */
export interface PermissionEvent {
    readonly type: PermissionEventType;
    readonly sessionId: string;
    readonly projectId: string;
    readonly timestamp: string;
    readonly permissionId?: string;
    readonly permission?: PermissionData;
}

export interface PermissionData {
    readonly id: string;
    readonly type: string;
    readonly message: string;
    readonly status: 'pending' | 'granted' | 'denied';
    readonly agent?: string;
    readonly tool_name?: string;
}

/**
 * Agent command interface for Hub command execution.
 */
export interface SessionAgentCommand {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly arguments?: AgentCommandArgument[];
    readonly timestamp: string;
}

export interface AgentCommandArgument {
    readonly name: string;
    readonly type: string;
    readonly description?: string;
    readonly required?: boolean;
    readonly default?: unknown;
}
