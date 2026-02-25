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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { createParser, ParsedEvent, ParseEvent } from 'eventsource-parser';
import {
    OpenCodeService,
    OpenCodeClient,
    Project,
    Session,
    Message,
    MessagePart,
    MessageWithParts,
    FileStatus,
    FileContent,
    Agent,
    AgentInfo,
    Provider,
    AppConfig,
    CommandInfo,
    SessionNotification,
    MessageNotification,
    FileNotification,
    PermissionNotification,
    QuestionNotification
} from '../common/opencode-protocol';
import * as SDKTypes from '../common/opencode-sdk-types';

/**
 * Default OpenCode server URL.
 */
export const DEFAULT_OPENCODE_URL = 'http://localhost:7890';

/**
 * Symbol for configuring the OpenCode server URL.
 */
export const OpenCodeServerUrl = Symbol('OpenCodeServerUrl');

/**
 * OpenCodeProxy - Backend HTTP client that calls the opencode server REST API.
 * Implements the OpenCodeService interface.
 */
@injectable()
export class OpenCodeProxy implements OpenCodeService {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeServerUrl)
    protected readonly serverUrl!: string;

    protected _client: OpenCodeClient | undefined = undefined;

    // SSE connection state
    protected sseRequest: http.ClientRequest | undefined;
    protected sseConnected: boolean = false;
    protected sseReconnectTimer: NodeJS.Timeout | undefined;
    protected reconnectAttempts: number = 0;
    protected readonly maxReconnectDelay: number = 30000; // 30 seconds
    protected readonly initialReconnectDelay: number = 1000; // 1 second
    protected currentDirectory: string | undefined;
    protected isDisposed: boolean = false;

    /**
     * Track the most recently seen streaming part message ID.
     * The opencode backend sends message.part.updated with one ID (streaming ID) and
     * message.updated (completed) with a different ID (final ID). We record the last
     * streaming part ID here so the completed notification can include it as previousMessageId,
     * allowing the sync service to replace the streaming stub correctly.
     */
    protected lastStreamingPartMessageId: string | undefined;

    /**
     * Track known user message IDs.
     * When message.updated fires with role:'user', we record the message ID here.
     * This lets us skip message.part.updated events for user messages, since the proxy
     * hardcodes role:'assistant' in the partial notification stub and has no other way
     * to detect user message parts.
     */
    protected userMessageIds = new Set<string>();

    // Stream interceptor removed in T3 — agent commands now come via MCP tools

    constructor() {
        // Constructor body empty - dependencies injected via @inject
    }

    /**
     * Get the client for RPC callbacks (protected setter only).
     */
    get client(): OpenCodeClient | undefined {
        return this._client;
    }

    @postConstruct()
    init(): void {
        this.logger.info(`[OpenCodeProxy] Initialized with server URL: ${this.serverUrl}`);
    }

    /**
     * Set the client for RPC callbacks.
     */
    setClient(client: OpenCodeClient | undefined): void {
        const wasConnected = this._client !== undefined;
        this._client = client ?? undefined;
        
        if (client) {
            this.logger.info('[OpenCodeProxy] Frontend client connected');
        } else {
            this.logger.info('[OpenCodeProxy] Frontend client disconnected');
            if (wasConnected) {
                // Clean up SSE connection when frontend disconnects
                this.disconnectSSE();
            }
        }
    }

    /**
     * Dispose of resources.
     */
    dispose(): void {
        this.isDisposed = true;
        this.disconnectSSE();
        this._client = undefined;
    }

    /**
     * Build the full URL for an API endpoint.
     */
    protected buildUrl(endpoint: string, queryParams?: Record<string, string | undefined>): string {
        const url = new URL(endpoint, this.serverUrl);
        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.append(key, value);
                }
            });
        }
        return url.toString();
    }

    /**
     * Make a raw HTTP/HTTPS request and return the status code and body as a string.
     *
     * Used by all higher-level request helpers. Also called directly for non-JSON
     * responses (e.g. plain-text endpoints) and endpoints where status-code inspection
     * is needed before body parsing.
     *
     * @param url       - Fully-qualified URL to request
     * @param method    - HTTP method (GET, POST, DELETE, etc.)
     * @param headers   - Request headers to send
     * @param body      - Optional request body string (e.g. JSON-serialised payload)
     * @param timeoutMs - Request timeout in milliseconds; ≤0 means no timeout (default 30 000)
     * @returns         Object with `statusCode` and `body` (UTF-8 string)
     * @throws          On connection errors, DNS failures, or timeout
     */
    protected rawRequest(
        url: string,
        method: string,
        headers: Record<string, string>,
        body?: string,
        timeoutMs = 30_000
    ): Promise<{ statusCode: number; body: string }> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const requestOptions: http.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers,
            };
            if (timeoutMs > 0) {
                requestOptions.timeout = timeoutMs;
            }

            const req = protocol.request(requestOptions, (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const responseBody = Buffer.concat(chunks).toString('utf-8');
                    resolve({ statusCode: res.statusCode ?? 0, body: responseBody });
                });
                res.on('error', reject);
            });

            req.on('error', reject);
            if (timeoutMs > 0) {
                req.on('timeout', () => {
                    req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${method} ${url}`));
                });
            }

            if (body !== undefined) {
                req.write(body);
            }
            req.end();
        });
    }

    /**
     * Make an HTTP request to the OpenCode server and return the parsed JSON response.
     *
     * Sets `Accept: application/json` and `Content-Type: application/json` by default.
     * Throws on non-2xx status codes with a message that includes the status code and
     * raw response body, making failures easy to diagnose in logs.
     *
     * @param options.url       - Fully-qualified URL (constructed by callers via `buildUrl`)
     * @param options.type      - HTTP method string (e.g. `'GET'`, `'POST'`)
     * @param options.data      - Optional JSON-serialised request body
     * @param options.headers   - Additional headers to merge (override defaults)
     * @param options.timeoutMs - Per-request timeout (defaults to `rawRequest` default of 30 000 ms)
     * @returns Parsed JSON response typed as T
     * @throws  On non-2xx responses or network errors
     */
    protected async requestJson<T>(options: { url: string; type: string; data?: string; headers?: Record<string, string>; timeoutMs?: number }): Promise<T> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        const ts = () => new Date().toISOString();
        console.log(`[${ts()}] FETCH_START: ${options.type} ${options.url}`);
        let statusCode: number;
        let body: string;
        try {
            ({ statusCode, body } = await this.rawRequest(options.url, options.type, headers, options.data, options.timeoutMs));
        } catch (err) {
            console.error(`[${ts()}] FETCH_FAIL: ${options.type} ${options.url}`, err);
            throw err;
        }
        console.log(`[${ts()}] FETCH_SUCCESS: ${options.type} ${options.url} (${statusCode})`);

        if (statusCode < 200 || statusCode >= 300) {
            throw new Error(`OpenCodeProxy: HTTP ${statusCode} - ${body}`);
        }

        return JSON.parse(body) as T;
    }

    /**
     * Make a GET request.
     */
    protected async get<T>(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[OpenCodeProxy] GET ${url}`);
        return this.requestJson<T>({ url, type: 'GET' });
    }

    /**
     * Make a POST request with optional body.
     */
    protected async post<T>(endpoint: string, body?: unknown, queryParams?: Record<string, string | undefined>, timeoutMs?: number): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[OpenCodeProxy] POST ${url}`);
        return this.requestJson<T>({
            url,
            type: 'POST',
            data: body ? JSON.stringify(body) : undefined,
            timeoutMs
        });
    }

    /**
     * Make a DELETE request.
     */
    protected async delete(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<void> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[OpenCodeProxy] DELETE ${url}`);
        const { statusCode, body } = await this.rawRequest(url, 'DELETE', {
            'Accept': 'application/json'
        });
        if (statusCode < 200 || statusCode >= 300) {
            throw new Error(`OpenCodeProxy: HTTP ${statusCode} - DELETE failed: ${body}`);
        }
    }

    /**
     * Make a PATCH request with body.
     */
    protected async patch<T>(endpoint: string, body?: unknown): Promise<T> {
        const url = this.buildUrl(endpoint);
        this.logger.debug(`[OpenCodeProxy] PATCH ${url}`);
        return this.requestJson<T>({
            url,
            type: 'PATCH',
            data: body ? JSON.stringify(body) : undefined
        });
    }

    // =========================================================================
    // MCP Management
    // =========================================================================

    /**
     * Ask OpenCode to (re)connect a named MCP server.
     * Calls POST /mcp/:name/connect — safe to call even if already connected.
     * Used on Theia startup to recover from the race where OpenCode starts before Theia.
     */
    async connectMcpServer(name: string): Promise<void> {
        try {
            await this.post<boolean>(`/mcp/${encodeURIComponent(name)}/connect`);
            this.logger.info(`[OpenCodeProxy] MCP server '${name}' reconnected`);
        } catch (err) {
            this.logger.warn(`[OpenCodeProxy] Failed to reconnect MCP server '${name}': ${err}`);
        }
    }

    // =========================================================================
    // Project Methods
    // =========================================================================

    async getProjects(): Promise<Project[]> {
        return this.get<Project[]>('/project');
    }

    async initProject(directory: string): Promise<Project> {
        return this.post<Project>('/project/init', { directory });
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
        // OpenCode API: GET /session - list all sessions
        const query: Record<string, string | undefined> = {};
        if (options?.search) { query['search'] = options.search; }
        if (options?.limit !== undefined) { query['limit'] = String(options.limit); }
        if (options?.start !== undefined) { query['start'] = String(options.start); }
        return this.get<Session[]>('/session', query);
    }

    async getSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: GET /session/:id
        return this.get<Session>(`/session/${encodeURIComponent(sessionId)}`);
    }

    async getSessionStatuses(_projectId: string): Promise<Array<{ sessionId: string; status: SDKTypes.SessionStatus }>> {
        // OpenCode API: GET /session/status - returns Record<string, SessionStatus>
        try {
            const data = await this.get<Record<string, SDKTypes.SessionStatus>>(`/session/status`);
            return Object.entries(data).map(([sessionId, status]) => ({ sessionId, status }));
        } catch {
            return [];
        }
    }

    async createSession(_projectId: string, session: Partial<Session> & { mcp?: Record<string, unknown> }): Promise<Session> {
        // OpenCode API: POST /session - body: { parentID?, title? }
        return this.post<Session>(`/session`, session);
    }

    async deleteSession(_projectId: string, sessionId: string): Promise<void> {
        // OpenCode API: DELETE /session/:id
        return this.delete(`/session/${encodeURIComponent(sessionId)}`);
    }

    async archiveSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: PATCH /session/:id with { time: { archived: <timestamp> } }
        return this.patch<Session>(`/session/${encodeURIComponent(sessionId)}`, {
            time: { archived: Date.now() }
        });
    }

    async initSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/init
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/init`, {});
    }

    async abortSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/abort
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/abort`, {});
    }

    async shareSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/share
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/share`, {});
    }

    async unshareSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: DELETE /session/:id/share
        await this.delete(`/session/${encodeURIComponent(sessionId)}/share`);
        // Fetch actual session data after unsharing
        return this.getSession(_projectId, sessionId);
    }

    async compactSession(_projectId: string, sessionId: string, model?: { providerID: string; modelID: string }): Promise<Session> {
        // OpenCode API: POST /session/:id/summarize
        const body: Record<string, unknown> = {};
        if (model) {
            body['providerID'] = model.providerID;
            body['modelID'] = model.modelID;
        }
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/summarize`, body);
    }

    async revertSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/revert
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/revert`, {});
    }

    async unrevertSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/unrevert
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/unrevert`, {});
    }

    async forkSession(_projectId: string, sessionId: string, messageId?: string): Promise<Session> {
        // OpenCode API: POST /session/:id/fork
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/fork`, messageId ? { messageID: messageId } : {});
    }

    async getDiff(_projectId: string, sessionId: string): Promise<string> {
        // OpenCode API: GET /session/:id/diff — returns text, not JSON
        const url = this.buildUrl(`/session/${encodeURIComponent(sessionId)}/diff`);
        const { statusCode, body } = await this.rawRequest(url, 'GET', { 'Accept': 'text/plain' });
        if (statusCode < 200 || statusCode >= 300) { return ''; }
        return body;
    }

    async getTodos(_projectId: string, sessionId: string): Promise<Array<{ id: string; description: string; status: string }>> {
        // OpenCode API: GET /session/:id/todo
        try {
            return this.get<Array<{ id: string; description: string; status: string }>>(
                `/session/${encodeURIComponent(sessionId)}/todo`
            );
        } catch {
            return [];
        }
    }

    async grantPermission(_projectId: string, sessionId: string, permissionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/permissions/:permissionID
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(permissionId)}`, {});
    }

    async replyPermission(_projectId: string, requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> {
        // OpenCode API: POST /permission/:requestID/reply
        await this.post<unknown>(`/permission/${encodeURIComponent(requestId)}/reply`, { reply });
    }

    // =========================================================================
    // Message Methods
    // =========================================================================

    async getMessages(_projectId: string, sessionId: string, limit = 400, before?: string): Promise<MessageWithParts[]> {
        // OpenCode API: GET /session/:id/message
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) { params.set('before', before); }
        return this.get<MessageWithParts[]>(`/session/${encodeURIComponent(sessionId)}/message?${params}`);
    }

    async getMessage(_projectId: string, sessionId: string, messageId: string): Promise<MessageWithParts> {
        // OpenCode API: GET /session/:id/message/:messageID
        return this.get<MessageWithParts>(`/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(messageId)}`);
    }

    async createMessage(_projectId: string, sessionId: string, message: Partial<Message>, model?: { providerID: string; modelID: string }): Promise<MessageWithParts> {
        // OpenCode API: POST /session/:id/message
        // API expects: { parts: Array<PartInput>, model?: { providerID, modelID } }
        // Extract only the fields the API expects — don't spread SDK Message fields (id, sessionID, role, time, etc.)
        const body: Record<string, unknown> = {};
        if (message.parts) {
            body.parts = message.parts;
        }
        if (model) {
            body.model = model;
        }
        // Message generation can legitimately run well beyond 30 seconds.
        // Do not apply the default HTTP timeout here.
        return this.post<MessageWithParts>(`/session/${encodeURIComponent(sessionId)}/message`, body, undefined, 0);
    }

    // =========================================================================
    // File Methods
    // =========================================================================

    async findFiles(_projectId: string, sessionId: string): Promise<string[]> {
        // OpenCode API: GET /session/:id/find/file
        return this.get<string[]>(`/session/${encodeURIComponent(sessionId)}/find/file`);
    }

    async getFile(_projectId: string, sessionId: string): Promise<FileContent> {
        // OpenCode API: GET /session/:id/file
        return this.get<FileContent>(`/session/${encodeURIComponent(sessionId)}/file`);
    }

    async getFileStatus(_projectId: string, sessionId: string): Promise<FileStatus[]> {
        // OpenCode API: GET /session/:id/file/status
        return this.get<FileStatus[]>(`/session/${encodeURIComponent(sessionId)}/file/status`);
    }

    // =========================================================================
    // Agent Methods
    // =========================================================================

    async getAgent(_projectId: string, directory?: string): Promise<Agent> {
        // OpenCode API: GET /agent?directory=...
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.get<Agent>('/agent', queryParams);
    }

    // =========================================================================
    // Provider Methods
    // =========================================================================

    async getProvider(directory?: string): Promise<Provider> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.get<Provider>('/provider', queryParams);
    }

    // =========================================================================
    // Config Methods
    // =========================================================================

    async getConfig(directory?: string): Promise<AppConfig> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.get<AppConfig>('/config', queryParams);
    }

    async getAvailableModels(directory?: string): Promise<import('../common/opencode-protocol').ProviderWithModels[]> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        const response = await this.get<{ providers: import('../common/opencode-protocol').ProviderWithModels[] }>('/config/providers', queryParams);
        return response.providers || [];
    }

    // =========================================================================
    // Command Methods
    // =========================================================================

    async listCommands(directory?: string): Promise<CommandInfo[]> {
        // OpenCode API: GET /command
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.get<CommandInfo[]>('/command', queryParams);
    }

    async sessionCommand(sessionId: string, command: string, args: string, agent: string, model?: { providerID: string; modelID: string }): Promise<void> {
        // OpenCode API: POST /session/:id/command
        const body: Record<string, unknown> = {
            command,
            arguments: args,
            agent,
        };
        if (model) {
            body['model'] = `${model.providerID}/${model.modelID}`;
        }
        await this.post<unknown>(`/session/${encodeURIComponent(sessionId)}/command`, body);
    }

    async searchFiles(_sessionId: string, query: string, limit = 20): Promise<string[]> {
        // OpenCode API: GET /find/file?query=...&limit=20
        return this.get<string[]>(`/find/file`, {
            query,
            limit: String(limit),
        });
    }

    async listAgents(directory?: string): Promise<AgentInfo[]> {
        // OpenCode API: GET /agent (returns list of all agents)
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.get<AgentInfo[]>('/agent', queryParams);
    }

    // =========================================================================
    // SSE Event Forwarding
    // =========================================================================

    /**
     * Connect to SSE event stream for a project directory.
     * Called from the frontend after setting an active project.
     * @param directory The project worktree directory
     */
    async connectToProject(directory: string): Promise<void> {
        if (this.isDisposed) {
            this.logger.warn('[OpenCodeProxy] Cannot connect SSE: proxy is disposed');
            return;
        }

        // Skip disconnect/reconnect if already connected to the same directory
        if (this.sseConnected && this.currentDirectory === directory) {
            this.logger.debug(`[OpenCodeProxy] SSE already connected to ${directory}, skipping reconnect`);
            return;
        }

        // Disconnect existing connection if any
        this.disconnectSSE();

        // Task 14: Clear user message ID set on session/project change to prevent unbounded growth
        this.userMessageIds.clear();

        this.currentDirectory = directory;

        this.logger.info(`[OpenCodeProxy] Connecting SSE for directory ${directory}`);
        this.establishSSEConnection();
    }

    /**
     * Disconnect SSE event stream.
     */
    disconnectSSE(): void {
        // Clear reconnection timer
        if (this.sseReconnectTimer) {
            clearTimeout(this.sseReconnectTimer);
            this.sseReconnectTimer = undefined;
        }

        // Abort existing request
        if (this.sseRequest) {
            this.sseRequest.destroy();
            this.sseRequest = undefined;
        }

        this.sseConnected = false;
        this.reconnectAttempts = 0;
        this.currentDirectory = undefined;

        this.logger.debug('[OpenCodeProxy] SSE disconnected');
    }

    /**
     * Establish SSE connection to opencode server.
     */
    protected establishSSEConnection(): void {
        if (this.isDisposed || !this.currentDirectory) {
            return;
        }

        // OpenCode API: GET /event?directory=... (SSE)
        const endpoint = `/event`;
        const url = this.buildUrl(endpoint, { directory: this.currentDirectory });
        const parsedUrl = new URL(url);

        this.logger.debug(`[OpenCodeProxy] Establishing SSE connection to ${url}`);

        // Determine which module to use (http or https)
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        // Create SSE request
        const request = protocol.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

        // SSE connections are long-lived; disable timeout so LLM generation
        // (which may take minutes without sending events) doesn't drop the stream
        request.setTimeout(0); // no timeout

        // Create SSE parser
        const parser = createParser((event: ParseEvent) => {
            if (event.type === 'event') {
                this.handleSSEEvent(event);
            } else if (event.type === 'reconnect-interval') {
                this.logger.debug(`[OpenCodeProxy] Server requested reconnect interval: ${event.value}ms`);
            }
        });

        request.on('response', (response: http.IncomingMessage) => {
            if (response.statusCode !== 200) {
                this.logger.error(`[OpenCodeProxy] SSE connection failed with status ${response.statusCode}`);
                request.destroy();
                this.scheduleReconnect();
                return;
            }

            this.logger.info(`[OpenCodeProxy] SSE connected to ${url}`);
            const isReconnect = this.reconnectAttempts > 0;
            this.sseConnected = true;
            this.reconnectAttempts = 0; // Reset on successful connection

            // Notify client so it can clear accumulated streaming text before replayed deltas arrive
            if (isReconnect && this._client) {
                this.logger.info('[OpenCodeProxy] SSE reconnected — notifying client to clear streaming state');
                this._client.onSSEReconnect();
            }

            // Process incoming data chunks
            response.on('data', (chunk: Buffer) => {
                try {
                    parser.feed(chunk.toString('utf-8'));
                } catch (error) {
                    this.logger.error(`[OpenCodeProxy] Error feeding SSE parser: ${error}`);
                }
            });

            response.on('end', () => {
                this.logger.warn('[OpenCodeProxy] SSE connection closed by server');
                this.sseConnected = false;
                this.sseRequest = undefined;
                if (!this.isDisposed) {
                    this.scheduleReconnect();
                }
            });

            response.on('error', (error: Error) => {
                this.logger.error(`[OpenCodeProxy] SSE response error: ${error.message}`);
                this.sseConnected = false;
                this.sseRequest = undefined;
                if (!this.isDisposed) {
                    this.scheduleReconnect();
                }
            });
        });

        request.on('error', (error: Error) => {
            this.logger.error(`[OpenCodeProxy] SSE request error: ${error.message}`);
            this.sseConnected = false;
            this.sseRequest = undefined;
            if (!this.isDisposed) {
                this.scheduleReconnect();
            }
        });

        request.on('timeout', () => {
            this.logger.warn('[OpenCodeProxy] SSE request timeout');
            request.destroy();
            this.sseConnected = false;
            this.sseRequest = undefined;
            if (!this.isDisposed) {
                this.scheduleReconnect();
            }
        });

        // Store request for cleanup
        this.sseRequest = request;

        // Send request
        request.end();
    }

    /**
     * Schedule reconnection with exponential backoff.
     */
    protected scheduleReconnect(): void {
        if (this.isDisposed || this.sseReconnectTimer) {
            return;
        }

        // Calculate delay with exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s
        const delay = Math.min(
            this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );

        this.reconnectAttempts++;

        this.logger.info(`[OpenCodeProxy] Scheduling SSE reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        // Capture current directory to prevent race condition
        // If user switches projects while timer is pending, we don't want to reconnect to stale project
        const capturedDirectory = this.currentDirectory;

        this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = undefined;
            // Only reconnect if we're not disposed AND directory hasn't changed
            if (!this.isDisposed && 
                this.currentDirectory === capturedDirectory) {
                this.establishSSEConnection();
            }
        }, delay);
    }

    /**
     * Handle incoming SSE event.
     * OpenCode SSE sends GlobalEvent { directory, payload: Event } where Event has a `type` field.
     */
    protected handleSSEEvent(event: ParsedEvent): void {
        if (!this._client) {
            this.logger.debug('[OpenCodeProxy] Received SSE event but no client connected');
            return;
        }

        try {
            const parsed = JSON.parse(event.data);
            // OpenCode server may send events as direct Event objects (no wrapper)
            // OR as GlobalEvent { directory, payload: Event }. Handle both.
            const innerEvent: SDKTypes.Event = (parsed.payload !== undefined)
                ? parsed.payload
                : parsed;
            if (!innerEvent || typeof innerEvent.type !== 'string') {
                this.logger.debug(`[OpenCodeProxy] Ignoring SSE event with no type: ${event.data}`);
                return;
            }
            const eventType = innerEvent.type;

            this.logger.debug(`[OpenCodeProxy] SSE event: ${eventType}`);

            // Route event by type prefix
            if (eventType.startsWith('session.')) {
                this.forwardSessionEvent(innerEvent as SDKTypes.EventSessionCreated | SDKTypes.EventSessionUpdated | SDKTypes.EventSessionDeleted | SDKTypes.EventSessionError | SDKTypes.EventSessionCompacted);
            } else if (eventType.startsWith('message.')) {
                this.forwardMessageEvent(innerEvent as SDKTypes.EventMessageUpdated | SDKTypes.EventMessagePartUpdated | SDKTypes.EventMessagePartDelta | SDKTypes.EventMessageRemoved | SDKTypes.EventMessagePartRemoved);
            } else if (eventType.startsWith('file.')) {
                this.forwardFileEvent(innerEvent as SDKTypes.EventFileEdited | SDKTypes.EventFileWatcherUpdated);
            } else if (eventType.startsWith('permission.')) {
                this.forwardPermissionEvent(innerEvent as SDKTypes.EventPermissionUpdated | SDKTypes.EventPermissionReplied);
            } else if (eventType.startsWith('question.')) {
                this.forwardQuestionEvent(innerEvent as SDKTypes.EventQuestionAsked | SDKTypes.EventQuestionReplied | SDKTypes.EventQuestionRejected);
            } else if (eventType.startsWith('todo.')) {
                this.forwardTodoEvent(innerEvent as { type: string; properties: { sessionID: string; todos: unknown[] } });
            } else {
                this.logger.debug(`[OpenCodeProxy] Unhandled SSE event type: ${eventType}`);
            }
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error handling SSE event: ${error}`);
        }
    }

    /**
     * Forward session event to client.
     */
    protected forwardSessionEvent(event: SDKTypes.EventSessionCreated | SDKTypes.EventSessionUpdated | SDKTypes.EventSessionDeleted | SDKTypes.EventSessionError | SDKTypes.EventSessionCompacted | SDKTypes.EventSessionStatus): void {
        if (!this._client) {
            return;
        }

        try {
            // Handle session.status separately — it has a different shape (no info, has status)
            if (event.type === 'session.status') {
                const statusEvent = event as SDKTypes.EventSessionStatus;
                const notification: SessionNotification = {
                    type: 'status_changed',
                    sessionId: statusEvent.properties.sessionID,
                    projectId: '',
                    sessionStatus: statusEvent.properties.status
                };
                this._client.onSessionEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded session.status: ${statusEvent.properties.status.type}`);
                return;
            }

            // Map SDK event type to notification type
            let type: SessionNotification['type'];
            switch (event.type) {
                case 'session.created': type = 'created'; break;
                case 'session.updated': type = 'updated'; break;
                case 'session.deleted': type = 'deleted'; break;
                case 'session.error': type = 'error_occurred'; break;
                case 'session.compacted': type = 'compacted'; break;
                default:
                    this.logger.debug(`[OpenCodeProxy] Unhandled session event type: ${(event as { type: string }).type}`);
                    return;
            }

            // Extract session info from properties
            const sessionInfo = 'info' in event.properties ? event.properties.info : undefined;
            // Some events (error, compacted) only have sessionID, not full info
            const sessionId = sessionInfo?.id || ('sessionID' in event.properties ? (event.properties as { sessionID?: string }).sessionID : '') || '';
            // For session.error, extract the error message to pass as data
            let errorData: Session | undefined = sessionInfo as Session | undefined;
            if (type === 'error_occurred') {
                const errorEvent = event as SDKTypes.EventSessionError;
                const errObj = errorEvent.properties.error;
                const errMsg = errObj && 'message' in errObj ? (errObj as { message: string }).message : String(errObj ?? 'Unknown error');
                errorData = { error: errMsg } as unknown as Session;
            }

            const notification: SessionNotification = {
                type,
                sessionId,
                projectId: sessionInfo?.projectID || '',
                data: errorData
            };

            this._client.onSessionEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded session event: ${type}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding session event: ${error}`);
        }
    }

    /**
     * Forward message event to client.
     * SDK events: message.updated (full message), message.part.updated (streaming part with delta)
     */
    protected forwardMessageEvent(event: SDKTypes.EventMessageUpdated | SDKTypes.EventMessagePartUpdated | SDKTypes.EventMessagePartDelta | SDKTypes.EventMessageRemoved | SDKTypes.EventMessagePartRemoved): void {
        if (!this._client) {
            return;
        }

        try {
            if (event.type === 'message.updated') {
                // Full message update — map to 'completed' or 'created'
                const msgInfo = event.properties.info;

                // Track user message IDs so we can filter out their part.updated events.
                // The proxy hardcodes role:'assistant' in partial stubs (the Part type has no role),
                // so this is the only reliable place to learn which message IDs belong to user messages.
                if (msgInfo.role === 'user') {
                    this.userMessageIds.add(msgInfo.id);
                    this.logger.debug(`[OpenCodeProxy] Recorded user message ID: ${msgInfo.id}`);
                }
                
                // Build MessageWithParts from the message info
                const data: MessageWithParts = {
                    info: msgInfo,
                    parts: [] // Parts come separately via message.part.updated events
                };

                // Include the last streaming part message ID if it differs from the final ID.
                // This allows the sync service to find and replace the streaming stub correctly.
                // But only carry over the streaming stub ID for assistant messages (not user messages).
                const previousMessageId =
                    msgInfo.role !== 'user' &&
                    this.lastStreamingPartMessageId !== undefined &&
                    this.lastStreamingPartMessageId !== msgInfo.id
                        ? this.lastStreamingPartMessageId
                        : undefined;

                const notification: MessageNotification = {
                    type: 'completed',
                    sessionId: msgInfo.sessionID,
                    projectId: '',
                    messageId: msgInfo.id,
                    data,
                    previousMessageId
                };

                // Clear tracking after forwarding an assistant completed message.
                // Only clear for non-user messages so a user message.updated arriving between
                // the last message.part.updated and the assistant message.updated doesn't
                // prematurely discard the streaming stub ID.
                if (msgInfo.role !== 'user') {
                    this.lastStreamingPartMessageId = undefined;
                }

                // Intercept stream for agent commands
                this._client.onMessageEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded message.updated: ${msgInfo.id}${previousMessageId ? ` (streaming stub: ${previousMessageId})` : ''}`);

            } else if (event.type === 'message.part.updated') {
                // Streaming part update — map to 'partial'
                const part = event.properties.part;
                const delta = event.properties.delta;

                // Skip message.part.updated events for user messages.
                // The backend fires part.updated for user messages too (e.g. the text the user typed).
                // We cannot determine role from Part (it has no role field), but we track user message
                // IDs from message.updated events above.
                if (this.userMessageIds.has(part.messageID)) {
                    this.logger.debug(`[OpenCodeProxy] Skipping message.part.updated for user message: ${part.messageID}`);
                    return;
                }

                // Track the streaming part message ID for use in the next message.updated event
                this.lastStreamingPartMessageId = part.messageID;

                // Build notification with the part and delta
                const data: MessageWithParts = {
                    info: {
                        id: part.messageID,
                        sessionID: part.sessionID,
                        role: 'assistant',
                        time: { created: Date.now() }
                    } as Message,
                    parts: [part]
                };

                // Forward message event directly (T3: no stream interception — commands come via MCP)
                const notification: MessageNotification = {
                    type: 'partial',
                    sessionId: part.sessionID,
                    projectId: '',
                    messageId: part.messageID,
                    data,
                    delta: delta
                };

                this._client.onMessageEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded message.part.updated: ${part.messageID}, delta=${delta ? delta.length : 0} chars`);

            } else if (event.type === 'message.part.delta') {
                // Per-token text delta — forward directly without wrapping in MessageNotification
                const props = event.properties;

                // Skip deltas for user messages
                if (this.userMessageIds.has(props.messageID)) {
                    this.logger.debug(`[OpenCodeProxy] Skipping message.part.delta for user message: ${props.messageID}`);
                    return;
                }

                // Track the streaming message ID (same as message.part.updated)
                this.lastStreamingPartMessageId = props.messageID;

                this._client.onMessagePartDelta({
                    sessionID: props.sessionID,
                    messageID: props.messageID,
                    partID: props.partID,
                    field: props.field,
                    delta: props.delta
                });

                this.logger.debug(`[OpenCodeProxy] Forwarded message.part.delta: part=${props.partID}, field=${props.field}, delta=${props.delta.length} chars`);

            } else if (event.type === 'message.removed') {
                const removedNotification: MessageNotification = {
                    type: 'removed',
                    sessionId: event.properties.sessionID,
                    projectId: '',
                    messageId: event.properties.messageID,
                };
                this._client.onMessageEvent(removedNotification);
                this.logger.debug(`[OpenCodeProxy] Forwarded message.removed: ${event.properties.messageID}`);
            } else if (event.type === 'message.part.removed') {
                const partRemovedNotification: MessageNotification = {
                    type: 'part_removed',
                    sessionId: event.properties.sessionID,
                    projectId: '',
                    messageId: event.properties.messageID,
                    data: {
                        info: { id: event.properties.messageID } as Message,
                        parts: [{ id: event.properties.partID } as MessagePart]
                    }
                };
                this._client.onMessageEvent(partRemovedNotification);
                this.logger.debug(`[OpenCodeProxy] Forwarded message.part.removed: ${event.properties.partID}`);
            }
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding message event: ${error}`);
        }
    }

    /**
     * Forward file event to client.
     */
    protected forwardFileEvent(event: SDKTypes.EventFileEdited | SDKTypes.EventFileWatcherUpdated): void {
        if (!this._client) {
            return;
        }

        try {
            let filePath: string | undefined;
            
            if (event.type === 'file.edited') {
                filePath = event.properties.file;
            } else if (event.type === 'file.watcher.updated') {
                filePath = event.properties.file;
            } else {
                this.logger.debug(`[OpenCodeProxy] Unhandled file event type: ${(event as { type?: unknown }).type}`);
                return;
            }

            const notification: FileNotification = {
                type: 'changed',
                sessionId: '',
                projectId: '',
                path: filePath
            };

            this._client.onFileEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded file event: ${filePath}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding file event: ${error}`);
        }
    }

    /**
     * Forward permission event to client.
     */
    protected forwardPermissionEvent(event: SDKTypes.EventPermissionUpdated | SDKTypes.EventPermissionReplied): void {
        if (!this._client) {
            return;
        }

        try {
            if (event.type === 'permission.updated') {
                // SDK Permission is flat in properties (not wrapped)
                const perm = event.properties;
                
                // Extract patterns from SDK Permission
                const patterns: string[] | undefined = perm.pattern
                    ? (Array.isArray(perm.pattern) ? perm.pattern : [perm.pattern])
                    : undefined;

                const notification: PermissionNotification = {
                    type: 'requested',
                    sessionId: perm.sessionID,
                    projectId: '',
                    permissionId: perm.id,
                    permission: {
                        id: perm.id,
                        type: perm.type,
                        message: perm.title,
                        status: 'pending'
                    },
                    callID: perm.callID,
                    messageID: perm.messageID,
                    title: perm.title,
                    patterns
                };

                this._client.onPermissionEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded permission.updated: ${perm.id}`);

            } else if (event.type === 'permission.replied') {
                const props = event.properties;
                
                const notification: PermissionNotification = {
                    type: props.response === 'granted' ? 'granted' : 'denied',
                    sessionId: props.sessionID,
                    projectId: '',
                    permissionId: props.permissionID
                };

                this._client.onPermissionEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded permission.replied: ${props.permissionID}`);
            }
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding permission event: ${error}`);
        }
    }

    /**
     * Forward question event to client.
     */
    protected forwardQuestionEvent(event: SDKTypes.EventQuestionAsked | SDKTypes.EventQuestionReplied | SDKTypes.EventQuestionRejected): void {
        if (!this._client) return;
        try {
            if (event.type === 'question.asked') {
                const q = event.properties;
                const notification: QuestionNotification = {
                    type: 'asked',
                    sessionId: q.sessionID,
                    projectId: '',
                    requestId: q.id,
                    question: q
                };
                this._client.onQuestionEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded question.asked to client: ${q.id}, sessionId=${q.sessionID}`);
            } else if (event.type === 'question.replied') {
                const props = event.properties;
                const notification: QuestionNotification = {
                    type: 'replied',
                    sessionId: props.sessionID,
                    projectId: '',
                    requestId: props.requestID
                };
                this._client.onQuestionEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded question.replied: ${props.requestID}`);
            } else if (event.type === 'question.rejected') {
                const props = event.properties;
                const notification: QuestionNotification = {
                    type: 'rejected',
                    sessionId: props.sessionID,
                    projectId: '',
                    requestId: props.requestID
                };
                this._client.onQuestionEvent(notification);
                this.logger.debug(`[OpenCodeProxy] Forwarded question.rejected: ${props.requestID}`);
            }
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding question event: ${error}`);
        }
    }

    protected forwardTodoEvent(event: { type: string; properties: { sessionID: string; todos: unknown[] } }): void {
        if (!this._client) { return; }
        try {
            const todos = Array.isArray(event.properties?.todos)
                ? (event.properties.todos as Array<{ id: string; description: string; status: string }>)
                : [];
            this._client.onTodoEvent({
                sessionId: event.properties?.sessionID ?? '',
                todos
            });
            this.logger.debug(`[OpenCodeProxy] Forwarded todo event: ${todos.length} todos`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding todo event: ${error}`);
        }
    }

    // =========================================================================
    // Question Methods
    // =========================================================================

    async listPendingQuestions(_projectId: string, sessionId: string): Promise<import('../common/opencode-sdk-types').QuestionRequest[]> {
        const all = await this.get<import('../common/opencode-sdk-types').QuestionRequest[]>('/question');
        return (all || []).filter(q => q.sessionID === sessionId);
    }

    async answerQuestion(_projectId: string, requestId: string, answers: import('../common/opencode-sdk-types').QuestionAnswer[]): Promise<boolean> {
        return this.post<boolean>(`/question/${encodeURIComponent(requestId)}/reply`, { answers });
    }

    async rejectQuestion(_projectId: string, requestId: string): Promise<boolean> {
        return this.post<boolean>(`/question/${encodeURIComponent(requestId)}/reject`, {});
    }

    /**
     * T1-2/T1-3: Validate a file path by resolving symlinks on the Node backend.
     * Returns the canonically-resolved path if it is within the workspace root.
     */
    async validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }> {
        try {
            // Attempt to resolve symlinks on the real filesystem
            let resolvedPath: string;
            try {
                resolvedPath = await fs.promises.realpath(filePath);
            } catch (e) {
                // Path doesn't exist yet (e.g. createFile for a new file)
                // Resolve the parent directory instead
                const parentDir = path.dirname(filePath);
                const fileName = path.basename(filePath);
                let resolvedParent: string;
                try {
                    resolvedParent = await fs.promises.realpath(parentDir);
                } catch {
                    // Parent doesn't exist either — allow it (new nested path)
                    resolvedParent = path.normalize(parentDir);
                }
                resolvedPath = path.join(resolvedParent, fileName);
            }

            // Normalize workspace root for comparison
            const normalizedRoot = path.normalize(workspaceRoot);
            const normalizedResolved = path.normalize(resolvedPath);

            if (!normalizedResolved.startsWith(normalizedRoot + path.sep) && normalizedResolved !== normalizedRoot) {
                return {
                    valid: false,
                    error: `Path resolves outside workspace: ${filePath} → ${resolvedPath}`
                };
            }

            return { valid: true, resolvedPath: normalizedResolved };
        } catch (err) {
            return {
                valid: false,
                error: `Path validation error: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    }

    /**
     * Execute a shell command on the backend using child_process.exec.
     * Used by the shell mode (!) in the chat prompt input.
     * Commands are run with a 30-second timeout and 1MB output limit.
     * The cwd must be a non-empty absolute path; execution is refused otherwise.
     */
    async executeShellCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
        // Enforce a valid absolute cwd — never fall back to an implicit directory.
        if (!cwd || !path.isAbsolute(cwd)) {
            return {
                stdout: '',
                stderr: `Shell execution refused: cwd must be an absolute path, got: ${JSON.stringify(cwd)}`,
                exitCode: 1,
                error: 'Invalid cwd',
            };
        }

        const MAX_OUTPUT = 1024 * 1024; // 1MB
        const TIMEOUT = 30_000; // 30 seconds

        return new Promise(resolve => {
            try {
                const child = childProcess.exec(command, {
                    cwd,
                    timeout: TIMEOUT,
                    maxBuffer: MAX_OUTPUT,
                    shell: '/bin/bash',
                    env: { ...process.env, TERM: 'dumb' },
                }, (error, stdout, stderr) => {
                    if (error) {
                        // exec error (timeout, signal, etc.)
                        resolve({
                            stdout: stdout || '',
                            stderr: stderr || error.message,
                            exitCode: error.code !== undefined ? (typeof error.code === 'number' ? error.code : 1) : 1,
                            error: error.killed ? 'Command timed out' : undefined,
                        });
                    } else {
                        resolve({
                            stdout: stdout || '',
                            stderr: stderr || '',
                            exitCode: 0,
                        });
                    }
                });

                // Safety: if the child somehow doesn't exit, force-kill after timeout + buffer
                const safetyTimer = setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch { /* ignore */ }
                }, TIMEOUT + 5000);
                child.on('exit', () => clearTimeout(safetyTimer));
            } catch (err) {
                resolve({
                    stdout: '',
                    stderr: err instanceof Error ? err.message : String(err),
                    exitCode: 1,
                    error: 'Failed to execute command',
                });
            }
        });
    }
}
