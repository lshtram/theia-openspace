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
import { RequestService, RequestContext, RequestOptions } from '@theia/request';
import * as http from 'http';
import * as https from 'https';
import { createParser, ParsedEvent, ParseEvent } from 'eventsource-parser';
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
    Provider,
    AppConfig,
    SessionNotification,
    MessageNotification,
    FileNotification,
    PermissionNotification
} from '../common/opencode-protocol';
import {
    SessionEvent,
    MessageEvent,
    FileEvent,
    PermissionEvent
} from '../common/session-protocol';

/**
 * Default OpenCode server URL.
 */
export const DEFAULT_OPENCODE_URL = 'http://localhost:8080';

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

    @inject(RequestService)
    protected readonly requestService!: RequestService;

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
    protected currentProjectId: string | undefined;
    protected currentSessionId: string | undefined;
    protected isDisposed: boolean = false;

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
     * Make an HTTP request and return the parsed JSON response.
     */
    protected async requestJson<T>(options: RequestOptions): Promise<T> {
        const context = await this.requestService.request({
            ...options,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!RequestContext.isSuccess(context)) {
            const statusCode = context.res.statusCode ?? 'unknown';
            const errorBody = RequestContext.asText(context);
            throw new Error(`OpenCodeProxy: HTTP ${statusCode} - ${errorBody}`);
        }

        return RequestContext.asJson<T>(context);
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
    protected async post<T>(endpoint: string, body?: unknown, queryParams?: Record<string, string | undefined>): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[OpenCodeProxy] POST ${url}`);
        return this.requestJson<T>({
            url,
            type: 'POST',
            data: body ? JSON.stringify(body) : undefined
        });
    }

    /**
     * Make a DELETE request.
     */
    protected async delete(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<void> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[OpenCodeProxy] DELETE ${url}`);
        const context = await this.requestService.request({ url, type: 'DELETE' });
        if (!RequestContext.isSuccess(context)) {
            const statusCode = context.res.statusCode ?? 'unknown';
            const errorBody = RequestContext.asText(context);
            throw new Error(`OpenCodeProxy: HTTP ${statusCode} - DELETE failed: ${errorBody}`);
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
    // =========================================================================

    async getSessions(projectId: string): Promise<Session[]> {
        return this.get<Session[]>(`/project/${encodeURIComponent(projectId)}/session`);
    }

    async getSession(projectId: string, sessionId: string): Promise<Session> {
        return this.get<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}`);
    }

    async createSession(projectId: string, session: Partial<Session>): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session`, session);
    }

    async deleteSession(projectId: string, sessionId: string): Promise<void> {
        return this.delete(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}`);
    }

    async initSession(projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/init`);
    }

    async abortSession(projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/abort`);
    }

    async shareSession(projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/share`);
    }

    async unshareSession(projectId: string, sessionId: string): Promise<Session> {
        await this.delete(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/share`);
        // Fetch actual session data after unsharing
        return this.getSession(projectId, sessionId);
    }

    async compactSession(projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/compact`);
    }

    async revertSession(projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/revert`);
    }

    async unrevertSession(projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/unrevert`);
    }

    async grantPermission(projectId: string, sessionId: string, permissionId: string): Promise<Session> {
        return this.post<Session>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/permission/${encodeURIComponent(permissionId)}`);
    }

    // =========================================================================
    // Message Methods
    // =========================================================================

    async getMessages(projectId: string, sessionId: string): Promise<MessageWithParts[]> {
        return this.get<MessageWithParts[]>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/message`);
    }

    async getMessage(projectId: string, sessionId: string, messageId: string): Promise<MessageWithParts> {
        return this.get<MessageWithParts>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(messageId)}`);
    }

    async createMessage(projectId: string, sessionId: string, message: Partial<Message>): Promise<MessageWithParts> {
        return this.post<MessageWithParts>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/message`, message);
    }

    // =========================================================================
    // File Methods
    // =========================================================================

    async findFiles(projectId: string, sessionId: string): Promise<string[]> {
        return this.get<string[]>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/find/file`);
    }

    async getFile(projectId: string, sessionId: string): Promise<FileContent> {
        return this.get<FileContent>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/file`);
    }

    async getFileStatus(projectId: string, sessionId: string): Promise<FileStatus[]> {
        return this.get<FileStatus[]>(`/project/${encodeURIComponent(projectId)}/session/${encodeURIComponent(sessionId)}/file/status`);
    }

    // =========================================================================
    // Agent Methods
    // =========================================================================

    async getAgent(projectId: string, directory?: string): Promise<Agent> {
        const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
        return this.get<Agent>(`/project/${encodeURIComponent(projectId)}/agent`, queryParams);
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

    // =========================================================================
    // SSE Event Forwarding
    // =========================================================================

    /**
     * Connect to SSE event stream for a session.
     * @param projectId The project ID
     * @param sessionId The session ID
     */
    connectSSE(projectId: string, sessionId: string): void {
        if (this.isDisposed) {
            this.logger.warn('[OpenCodeProxy] Cannot connect SSE: proxy is disposed');
            return;
        }

        // Disconnect existing connection if any
        this.disconnectSSE();

        this.currentProjectId = projectId;
        this.currentSessionId = sessionId;

        this.logger.info(`[OpenCodeProxy] Connecting SSE for project ${projectId}, session ${sessionId}`);
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
        this.currentProjectId = undefined;
        this.currentSessionId = undefined;

        this.logger.debug('[OpenCodeProxy] SSE disconnected');
    }

    /**
     * Establish SSE connection to opencode server.
     */
    protected establishSSEConnection(): void {
        if (this.isDisposed || !this.currentProjectId || !this.currentSessionId) {
            return;
        }

        const endpoint = `/project/${encodeURIComponent(this.currentProjectId)}/session/${encodeURIComponent(this.currentSessionId)}/events`;
        const url = this.buildUrl(endpoint);
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

        // Set connection timeout to prevent hanging on unresponsive servers
        request.setTimeout(30000); // 30 seconds

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
            this.sseConnected = true;
            this.reconnectAttempts = 0; // Reset on successful connection

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

        // Capture current project/session IDs to prevent race condition
        // If user switches sessions while timer is pending, we don't want to reconnect to stale session
        const capturedProjectId = this.currentProjectId;
        const capturedSessionId = this.currentSessionId;

        this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = undefined;
            // Only reconnect if we're not disposed AND session hasn't changed
            if (!this.isDisposed && 
                this.currentProjectId === capturedProjectId && 
                this.currentSessionId === capturedSessionId) {
                this.establishSSEConnection();
            }
        }, delay);
    }

    /**
     * Handle incoming SSE event.
     */
    protected handleSSEEvent(event: ParsedEvent): void {
        if (!this._client) {
            this.logger.debug('[OpenCodeProxy] Received SSE event but no client connected');
            return;
        }

        this.logger.debug(`[OpenCodeProxy] SSE event: ${event.event || 'message'}`);

        try {
            const eventType = event.event || 'message';
            const data = JSON.parse(event.data);

            // Route event to appropriate client callback based on event type prefix
            if (eventType.startsWith('session.')) {
                this.forwardSessionEvent(eventType, data);
            } else if (eventType.startsWith('message.')) {
                this.forwardMessageEvent(eventType, data);
            } else if (eventType.startsWith('file.')) {
                this.forwardFileEvent(eventType, data);
            } else if (eventType.startsWith('permission.')) {
                this.forwardPermissionEvent(eventType, data);
            } else {
                this.logger.warn(`[OpenCodeProxy] Unknown SSE event type: ${eventType}`);
            }
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error handling SSE event: ${error}`);
        }
    }

    /**
     * Forward session event to client.
     */
    protected forwardSessionEvent(eventType: string, rawData: SessionEvent): void {
        if (!this._client) {
            return;
        }

        try {
            // Map SSE event type to notification type
            const type = eventType.replace('session.', '') as SessionNotification['type'];

            const notification: SessionNotification = {
                type,
                sessionId: rawData.sessionId,
                projectId: rawData.projectId,
                data: rawData.data as Session | undefined
            };

            this._client.onSessionEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded session event: ${type}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding session event: ${error}`);
        }
    }

    /**
     * Forward message event to client.
     */
    protected forwardMessageEvent(eventType: string, rawData: MessageEvent): void {
        if (!this._client) {
            return;
        }

        try {
            // Map SSE event type to notification type
            let type: MessageNotification['type'];
            const sseType = eventType.replace('message.', '');

            // Map event types: created->created, streaming/part_added->partial, completed->completed
            if (sseType === 'created') {
                type = 'created';
            } else if (sseType === 'streaming' || sseType === 'part_added') {
                type = 'partial';
            } else if (sseType === 'completed') {
                type = 'completed';
            } else {
                this.logger.warn(`[OpenCodeProxy] Unknown message event type: ${sseType}`);
                return;
            }

            const notification: MessageNotification = {
                type,
                sessionId: rawData.sessionId,
                projectId: rawData.projectId,
                messageId: rawData.messageId,
                data: rawData.data as MessageWithParts | undefined
            };

            this._client.onMessageEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded message event: ${type}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding message event: ${error}`);
        }
    }

    /**
     * Forward file event to client.
     */
    protected forwardFileEvent(eventType: string, rawData: FileEvent): void {
        if (!this._client) {
            return;
        }

        try {
            // Map SSE event type to notification type
            let type: FileNotification['type'];
            const sseType = eventType.replace('file.', '');

            // Map event types: changed/created/modified->changed, saved->saved, reset->reset
            if (sseType === 'changed' || sseType === 'created' || sseType === 'modified') {
                type = 'changed';
            } else if (sseType === 'saved') {
                type = 'saved';
            } else if (sseType === 'reset') {
                type = 'reset';
            } else {
                this.logger.warn(`[OpenCodeProxy] Unknown file event type: ${sseType}`);
                return;
            }

            const notification: FileNotification = {
                type,
                sessionId: rawData.sessionId,
                projectId: rawData.projectId,
                path: rawData.path
            };

            this._client.onFileEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded file event: ${type}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding file event: ${error}`);
        }
    }

    /**
     * Forward permission event to client.
     */
    protected forwardPermissionEvent(eventType: string, rawData: PermissionEvent): void {
        if (!this._client) {
            return;
        }

        try {
            // Map SSE event type to notification type
            let type: PermissionNotification['type'];
            const sseType = eventType.replace('permission.', '');

            // Map event types: request->requested, granted->granted, denied->denied
            if (sseType === 'request') {
                type = 'requested';
            } else if (sseType === 'granted') {
                type = 'granted';
            } else if (sseType === 'denied') {
                type = 'denied';
            } else {
                this.logger.warn(`[OpenCodeProxy] Unknown permission event type: ${sseType}`);
                return;
            }

            const notification: PermissionNotification = {
                type,
                sessionId: rawData.sessionId,
                projectId: rawData.projectId,
                permissionId: rawData.permissionId,
                permission: rawData.permission ? {
                    id: rawData.permission.id,
                    type: rawData.permission.type,
                    message: rawData.permission.message,
                    status: rawData.permission.status
                } : undefined
            };

            this._client.onPermissionEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded permission event: ${type}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding permission event: ${error}`);
        }
    }
}
