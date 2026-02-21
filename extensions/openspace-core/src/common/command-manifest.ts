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
 * Command manifest interface for Hub command caching.
 */
export interface CommandManifest {
    readonly version: string;
    readonly commands: CommandDefinition[];
    readonly lastUpdated: string;
}

/**
 * Command definition interface.
 */
export interface CommandDefinition {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category?: string;
    readonly arguments_schema?: CommandArgumentSchema;
    readonly handler?: string;
}

/**
 * Command argument schema interface (JSON Schema compatible).
 */
export interface CommandArgumentSchema {
    readonly type: 'object';
    readonly properties: Record<string, ArgumentProperty>;
    readonly required?: string[];
    readonly additionalProperties?: boolean;
}

/**
 * Argument property interface.
 */
export interface ArgumentProperty {
    readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    readonly description?: string;
    readonly default?: unknown;
    readonly enum?: unknown[];
    readonly items?: ArgumentProperty;
    readonly properties?: Record<string, ArgumentProperty>;
    readonly required?: string[];
    readonly minimum?: number;
    readonly maximum?: number;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly pattern?: string;
}

/**
 * Command result interface.
 */
export interface CommandResult {
    readonly success: boolean;
    readonly output?: string;
    readonly error?: string;
    readonly data?: unknown;
    readonly executionTime?: number;
}

/**
 * Agent command request interface.
 */
export interface AgentCommandRequest {
    readonly commandId: string;
    readonly arguments?: Record<string, unknown>;
    readonly sessionId: string;
    readonly projectId: string;
    readonly requestId?: string;
}

/**
 * Hub state interface for OpenSpace Hub internal state.
 * Tracks command manifest and IDE pane state.
 * T3-3: All fields are readonly for immutability.
 */
export interface HubState {
    readonly manifest: CommandManifest | null;
    readonly paneState: PaneStateSnapshot | null;
    readonly lastManifestUpdate: string | null;
    readonly lastStateUpdate: string | null;
}

/**
 * Internal mutable Hub state (used internally by Hub implementation).
 */
export interface MutableHubState {
    manifest: CommandManifest | null;
    paneState: PaneStateSnapshot | null;
    lastManifestUpdate: string | null;
    lastStateUpdate: string | null;
}

/**
 * Pane state snapshot for Hub state tracking.
 * Simplified representation of current IDE pane layout.
 */
export interface PaneStateSnapshot {
    panes: PaneInfo[];
    activePane?: string;
    timestamp: string;
}

/**
 * Pane info for state snapshot.
 */
export interface PaneInfo {
    id: string;
    area: 'main' | 'left' | 'right' | 'bottom';
    tabs: TabInfo[];
    activeTab?: string;
}

/**
 * Tab info for pane state.
 */
export interface TabInfo {
    id: string;
    title: string;
    type: 'editor' | 'terminal' | 'presentation' | 'whiteboard' | 'other';
    isDirty?: boolean;
    uri?: string;
}

/**
 * Agent command interface for Hub command relay.
 */
export interface ManifestAgentCommand {
    cmd: string;
    args: unknown;
    sessionId?: string;
    /** Correlation ID used by MCP hub to match command results to pending Promises */
    requestId?: string;
}

/** @deprecated Use ManifestAgentCommand */
export type AgentCommand = ManifestAgentCommand;
