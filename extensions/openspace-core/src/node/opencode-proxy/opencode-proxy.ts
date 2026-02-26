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
 * OpenCodeProxy — Facade that implements the OpenCodeService RPC interface.
 *
 * This file used to be a 1,330-line monolith. It has been decomposed into
 * focused sub-modules:
 *
 *   http-client.ts       — URL construction, raw HTTP, JSON request pipeline
 *   rest-api.ts          — 33 thin REST endpoint wrappers
 *   sse-connection.ts    — SSE lifecycle (connect, disconnect, reconnect)
 *   sse-event-router.ts  — SSE event parsing and client forwarding
 *   node-utils.ts        — validatePath, executeShellCommand
 *
 * The facade wires these together and delegates all work. No business logic
 * lives here — only orchestration and the OpenCodeService interface contract.
 */

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import * as fs from 'fs';
import * as path from 'path';
import {
    OpenCodeService,
    OpenCodeClient,
    Project,
    Session,
    Message,
    MessageWithParts,
    FileStatus,
    FileContent,
    Agent,
    AgentInfo,
    Provider,
    AppConfig,
    CommandInfo,
    ProviderWithModels
} from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';
import { RestApiFacade } from './rest-api';
import { SseConnectionManager } from './sse-connection';
import { NodeUtils } from './node-utils';

// Re-export symbols that external consumers depend on
export { OpenCodeServerUrl, DEFAULT_OPENCODE_URL } from './http-client';

/**
 * OpenCodeProxy — Backend service implementing the OpenCodeService RPC interface.
 * Delegates to sub-services for HTTP, SSE, and utility operations.
 */
@injectable()
export class OpenCodeProxy implements OpenCodeService {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(RestApiFacade)
    protected readonly rest!: RestApiFacade;

    @inject(SseConnectionManager)
    protected readonly sse!: SseConnectionManager;

    @inject(NodeUtils)
    protected readonly nodeUtils!: NodeUtils;

    protected _client: OpenCodeClient | undefined = undefined;

    get client(): OpenCodeClient | undefined {
        return this._client;
    }

    @postConstruct()
    init(): void {
        this.logger.info('[OpenCodeProxy] Initialized (facade)');
    }

    setClient(client: OpenCodeClient | undefined): void {
        const wasConnected = this._client !== undefined;
        this._client = client ?? undefined;
        this.sse.setClient(this._client);

        if (client) {
            this.logger.info('[OpenCodeProxy] Frontend client connected');
        } else {
            this.logger.info('[OpenCodeProxy] Frontend client disconnected');
            if (wasConnected) {
                this.sse.disconnectSSE();
            }
        }
    }

    dispose(): void {
        this.sse.dispose();
        this._client = undefined;
    }

    // =========================================================================
    // MCP Management
    // =========================================================================

    async connectMcpServer(name: string): Promise<void> {
        try {
            await this.rest.connectMcpServer(name);
            this.logger.info(`[OpenCodeProxy] MCP server '${name}' reconnected`);
        } catch (err) {
            this.logger.warn(`[OpenCodeProxy] Failed to reconnect MCP server '${name}': ${err}`);
        }
    }

    // =========================================================================
    // Delegated REST API methods
    // =========================================================================

    getProjects(): Promise<Project[]> { return this.rest.getProjects(); }
    initProject(directory: string): Promise<Project> { return this.rest.initProject(directory); }
    getSessions(projectId: string, options?: { search?: string; limit?: number; start?: number }): Promise<Session[]> { return this.rest.getSessions(projectId, options); }
    getSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.getSession(projectId, sessionId); }
    getSessionStatuses(projectId: string): Promise<Array<{ sessionId: string; status: SDKTypes.SessionStatus }>> { return this.rest.getSessionStatuses(projectId); }
    createSession(projectId: string, session: Partial<Session> & { mcp?: Record<string, unknown> }): Promise<Session> { return this.rest.createSession(projectId, session); }
    deleteSession(projectId: string, sessionId: string): Promise<void> { return this.rest.deleteSession(projectId, sessionId); }
    archiveSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.archiveSession(projectId, sessionId); }
    renameSession(projectId: string, sessionId: string, title: string): Promise<Session> { return this.rest.renameSession(projectId, sessionId, title); }
    initSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.initSession(projectId, sessionId); }
    abortSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.abortSession(projectId, sessionId); }
    shareSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.shareSession(projectId, sessionId); }
    unshareSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.unshareSession(projectId, sessionId); }
    compactSession(projectId: string, sessionId: string, model?: { providerID: string; modelID: string }): Promise<Session> { return this.rest.compactSession(projectId, sessionId, model); }
    revertSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.revertSession(projectId, sessionId); }
    unrevertSession(projectId: string, sessionId: string): Promise<Session> { return this.rest.unrevertSession(projectId, sessionId); }
    forkSession(projectId: string, sessionId: string, messageId?: string): Promise<Session> { return this.rest.forkSession(projectId, sessionId, messageId); }
    getDiff(projectId: string, sessionId: string): Promise<string> { return this.rest.getDiff(projectId, sessionId); }
    getTodos(projectId: string, sessionId: string): Promise<Array<{ id: string; description: string; status: string }>> { return this.rest.getTodos(projectId, sessionId); }
    grantPermission(projectId: string, sessionId: string, permissionId: string): Promise<Session> { return this.rest.grantPermission(projectId, sessionId, permissionId); }
    replyPermission(projectId: string, requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> { return this.rest.replyPermission(projectId, requestId, reply); }
    getMessages(projectId: string, sessionId: string, limit?: number, before?: string): Promise<MessageWithParts[]> { return this.rest.getMessages(projectId, sessionId, limit, before); }
    getMessage(projectId: string, sessionId: string, messageId: string): Promise<MessageWithParts> { return this.rest.getMessage(projectId, sessionId, messageId); }
    createMessage(projectId: string, sessionId: string, message: Partial<Message>, model?: { providerID: string; modelID: string }): Promise<MessageWithParts> { return this.rest.createMessage(projectId, sessionId, message, model); }
    findFiles(projectId: string, sessionId: string): Promise<string[]> { return this.rest.findFiles(projectId, sessionId); }
    getFile(projectId: string, sessionId: string): Promise<FileContent> { return this.rest.getFile(projectId, sessionId); }
    getFileStatus(projectId: string, sessionId: string): Promise<FileStatus[]> { return this.rest.getFileStatus(projectId, sessionId); }
    getAgent(projectId: string, directory?: string): Promise<Agent> { return this.rest.getAgent(projectId, directory); }
    getProvider(directory?: string): Promise<Provider> { return this.rest.getProvider(directory); }
    getConfig(directory?: string): Promise<AppConfig> { return this.rest.getConfig(directory); }
    getAvailableModels(directory?: string): Promise<ProviderWithModels[]> { return this.rest.getAvailableModels(directory); }
    listCommands(directory?: string): Promise<CommandInfo[]> { return this.rest.listCommands(directory); }
    sessionCommand(sessionId: string, command: string, args: string, agent: string, model?: { providerID: string; modelID: string }): Promise<void> { return this.rest.sessionCommand(sessionId, command, args, agent, model); }
    searchFiles(sessionId: string, query: string, limit?: number): Promise<string[]> { return this.rest.searchFiles(sessionId, query, limit); }
    listAgents(directory?: string): Promise<AgentInfo[]> { return this.rest.listAgents(directory); }
    listPendingQuestions(projectId: string, sessionId: string): Promise<SDKTypes.QuestionRequest[]> { return this.rest.listPendingQuestions(projectId, sessionId); }
    answerQuestion(projectId: string, requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<boolean> { return this.rest.answerQuestion(projectId, requestId, answers); }
    rejectQuestion(projectId: string, requestId: string): Promise<boolean> { return this.rest.rejectQuestion(projectId, requestId); }

    // =========================================================================
    // SSE Connection
    // =========================================================================

    connectToProject(directory: string): Promise<void> { return this.sse.connectToProject(directory); }

    // =========================================================================
    // Node Utilities
    // =========================================================================

    validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }> {
        return this.nodeUtils.validatePath(filePath, workspaceRoot);
    }

    executeShellCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
        return this.nodeUtils.executeShellCommand(command, cwd);
    }

    async getMcpConfig(directory: string): Promise<Record<string, unknown> | undefined> {
        const configPath = path.join(directory, 'opencode.json');
        try {
            const raw = await fs.promises.readFile(configPath, 'utf-8');
            const config = JSON.parse(raw);
            if (config.mcp) {
                this.logger.info('[OpenCodeProxy] Found MCP config in: ' + configPath);
                return config.mcp as Record<string, unknown>;
            }
            this.logger.debug('[OpenCodeProxy] No mcp section in: ' + configPath);
            return undefined;
        } catch {
            this.logger.debug('[OpenCodeProxy] No opencode.json at: ' + configPath);
            return undefined;
        }
    }
}
