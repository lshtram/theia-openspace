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
 * Thin REST API wrappers for the OpenCode server.
 * Each method maps 1:1 to an OpenCode REST endpoint, delegating HTTP
 * mechanics to HttpClient.
 *
 * Extracted from OpenCodeProxy to keep each module focused and <400 lines.
 */

import { inject, injectable } from '@theia/core/shared/inversify';
import {
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
import { HttpClient } from './http-client';

@injectable()
export class RestApiFacade {

    @inject(HttpClient)
    protected readonly http!: HttpClient;

    // =========================================================================
    // MCP Management
    // =========================================================================

    async connectMcpServer(name: string): Promise<void> {
        await this.http.post<boolean>(`/mcp/${encodeURIComponent(name)}/connect`);
    }

    async getMcpStatus(directory: string): Promise<Record<string, unknown> | undefined> {
        try {
            return await this.http.get<Record<string, unknown>>(
                `/mcp?directory=${encodeURIComponent(directory)}`
            );
        } catch {
            return undefined;
        }
    }

    // =========================================================================
    // Project Methods
    // =========================================================================

    async getProjects(): Promise<Project[]> {
        return this.http.get<Project[]>('/project');
    }

    async initProject(directory: string): Promise<Project> {
        return this.http.post<Project>('/project/init', { directory });
    }

    // =========================================================================
    // Session Methods
    //
    // Note: _projectId parameters are present for interface consistency with
    // OpenCodeService. The OpenCode API is project-agnostic (sessions are
    // global, not scoped per project), so the parameter is intentionally
    // unused. The underscore prefix is the TypeScript convention for this.
    // =========================================================================

    async getSessions(_projectId: string, options?: { search?: string; limit?: number; start?: number }): Promise<Session[]> {
        const query: Record<string, string | undefined> = {};
        if (options?.search) { query['search'] = options.search; }
        if (options?.limit !== undefined) { query['limit'] = String(options.limit); }
        if (options?.start !== undefined) { query['start'] = String(options.start); }
        return this.http.get<Session[]>('/session', query);
    }

    async getSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.get<Session>(`/session/${encodeURIComponent(sessionId)}`);
    }

    async getSessionStatuses(_projectId: string): Promise<Array<{ sessionId: string; status: SDKTypes.SessionStatus }>> {
        try {
            const data = await this.http.get<Record<string, SDKTypes.SessionStatus>>(`/session/status`);
            return Object.entries(data).map(([sessionId, status]) => ({ sessionId, status }));
        } catch {
            return [];
        }
    }

    async createSession(_projectId: string, session: Partial<Session> & { mcp?: Record<string, unknown> }): Promise<Session> {
        return this.http.post<Session>(`/session`, session);
    }

    async deleteSession(_projectId: string, sessionId: string): Promise<void> {
        return this.http.delete(`/session/${encodeURIComponent(sessionId)}`);
    }

    async archiveSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.patch<Session>(`/session/${encodeURIComponent(sessionId)}`, {
            time: { archived: Date.now() }
        });
    }

    async renameSession(_projectId: string, sessionId: string, title: string): Promise<Session> {
        return this.http.patch<Session>(`/session/${encodeURIComponent(sessionId)}`, { title });
    }

    async initSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/init`, {});
    }

    async abortSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/abort`, {});
    }

    async shareSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/share`, {});
    }

    async unshareSession(_projectId: string, sessionId: string): Promise<Session> {
        await this.http.delete(`/session/${encodeURIComponent(sessionId)}/share`);
        return this.getSession(_projectId, sessionId);
    }

    async compactSession(_projectId: string, sessionId: string, model?: { providerID: string; modelID: string }): Promise<Session> {
        const body: Record<string, unknown> = {};
        if (model) {
            body['providerID'] = model.providerID;
            body['modelID'] = model.modelID;
        }
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/summarize`, body);
    }

    async revertSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/revert`, {});
    }

    async unrevertSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/unrevert`, {});
    }

    async forkSession(_projectId: string, sessionId: string, messageId?: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/fork`, messageId ? { messageID: messageId } : {});
    }

    async getDiff(_projectId: string, sessionId: string): Promise<string> {
        const url = this.http.buildUrl(`/session/${encodeURIComponent(sessionId)}/diff`);
        const { statusCode, body } = await this.http.rawRequest(url, 'GET', { 'Accept': 'text/plain' });
        if (statusCode < 200 || statusCode >= 300) { return ''; }
        return body;
    }

    async getTodos(_projectId: string, sessionId: string): Promise<Array<{ id: string; description: string; status: string }>> {
        try {
            return this.http.get<Array<{ id: string; description: string; status: string }>>(
                `/session/${encodeURIComponent(sessionId)}/todo`
            );
        } catch {
            return [];
        }
    }

    async grantPermission(_projectId: string, sessionId: string, permissionId: string): Promise<Session> {
        return this.http.post<Session>(`/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(permissionId)}`, {});
    }

    async replyPermission(_projectId: string, requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> {
        await this.http.post<unknown>(`/permission/${encodeURIComponent(requestId)}/reply`, { reply });
    }

    // =========================================================================
    // Message Methods
    // =========================================================================

    async getMessages(_projectId: string, sessionId: string, limit = 400, before?: string): Promise<MessageWithParts[]> {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) { params.set('before', before); }
        return this.http.get<MessageWithParts[]>(`/session/${encodeURIComponent(sessionId)}/message?${params}`);
    }

    async getMessage(_projectId: string, sessionId: string, messageId: string): Promise<MessageWithParts> {
        return this.http.get<MessageWithParts>(`/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(messageId)}`);
    }

    async createMessage(_projectId: string, sessionId: string, message: Partial<Message>, model?: { providerID: string; modelID: string }): Promise<MessageWithParts> {
        const body: Record<string, unknown> = {};
        if (message.parts) {
            body.parts = message.parts;
        }
        if (model) {
            body.model = model;
        }
        // Message generation can legitimately run well beyond 30 seconds.
        return this.http.post<MessageWithParts>(`/session/${encodeURIComponent(sessionId)}/message`, body, undefined, 0);
    }

    // =========================================================================
    // File Methods
    // =========================================================================

    async findFiles(_projectId: string, sessionId: string): Promise<string[]> {
        return this.http.get<string[]>(`/session/${encodeURIComponent(sessionId)}/find/file`);
    }

    async getFile(_projectId: string, sessionId: string): Promise<FileContent> {
        return this.http.get<FileContent>(`/session/${encodeURIComponent(sessionId)}/file`);
    }

    async getFileStatus(_projectId: string, sessionId: string): Promise<FileStatus[]> {
        return this.http.get<FileStatus[]>(`/session/${encodeURIComponent(sessionId)}/file/status`);
    }

    // =========================================================================
    // Agent Methods
    // =========================================================================

    async getAgent(_projectId: string, directory?: string): Promise<Agent> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.http.get<Agent>('/agent', queryParams);
    }

    // =========================================================================
    // Provider Methods
    // =========================================================================

    async getProvider(directory?: string): Promise<Provider> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.http.get<Provider>('/provider', queryParams);
    }

    // =========================================================================
    // Config Methods
    // =========================================================================

    async getConfig(directory?: string): Promise<AppConfig> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.http.get<AppConfig>('/config', queryParams);
    }

    async getAvailableModels(directory?: string): Promise<ProviderWithModels[]> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        const response = await this.http.get<{ providers: ProviderWithModels[] }>('/config/providers', queryParams);
        return response.providers || [];
    }

    // =========================================================================
    // Command Methods
    // =========================================================================

    async listCommands(directory?: string): Promise<CommandInfo[]> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.http.get<CommandInfo[]>('/command', queryParams);
    }

    async sessionCommand(sessionId: string, command: string, args: string, agent: string, model?: { providerID: string; modelID: string }): Promise<void> {
        const body: Record<string, unknown> = {
            command,
            arguments: args,
            agent,
        };
        if (model) {
            body['model'] = `${model.providerID}/${model.modelID}`;
        }
        await this.http.post<unknown>(`/session/${encodeURIComponent(sessionId)}/command`, body);
    }

    async searchFiles(_sessionId: string, query: string, limit = 20): Promise<string[]> {
        return this.http.get<string[]>(`/find/file`, {
            query,
            limit: String(limit),
        });
    }

    async listAgents(directory?: string): Promise<AgentInfo[]> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.http.get<AgentInfo[]>('/agent', queryParams);
    }

    // =========================================================================
    // Question Methods
    // =========================================================================

    async listPendingQuestions(_projectId: string, sessionId: string): Promise<SDKTypes.QuestionRequest[]> {
        const all = await this.http.get<SDKTypes.QuestionRequest[]>('/question');
        return (all || []).filter(q => q.sessionID === sessionId);
    }

    async answerQuestion(_projectId: string, requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<boolean> {
        return this.http.post<boolean>(`/question/${encodeURIComponent(requestId)}/reply`, { answers });
    }

    async rejectQuestion(_projectId: string, requestId: string): Promise<boolean> {
        return this.http.post<boolean>(`/question/${encodeURIComponent(requestId)}/reject`, {});
    }
}
