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

import { ArtifactStore } from '../artifact-store';
import { PatchEngine } from '../patch-engine';

/**
 * Minimal logger interface — compatible with Theia ILogger and console.
 * Allows hub-mcp modules to log through the structured logger without a DI dependency.
 */
export interface HubLogger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}

/** Minimal structural type for McpServer (loaded via require). */
export interface IMcpServer {
    tool<T extends Record<string, unknown>>(
        name: string,
        description: string,
        schema: unknown,
        handler: (args: T) => Promise<unknown>
    ): void;
    connect(transport: unknown): Promise<void>;
}

/**
 * Dependencies for bridge-forwarding tool handlers.
 * All IDE-control tools forward commands to the browser via this bridge.
 */
export interface BridgeDeps {
    executeViaBridge: (cmd: string, args: unknown) => Promise<unknown>;
}

/**
 * Extended dependencies for file tools that also need workspace-level services.
 */
export interface FileDeps extends BridgeDeps {
    workspaceRoot: string;
    artifactStore: ArtifactStore;
    patchEngine: PatchEngine;
    logger: HubLogger;
}
