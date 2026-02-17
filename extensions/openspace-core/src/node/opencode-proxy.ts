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
import { createParser, ParsedEvent, ParseEvent } from 'eventsource-parser';
import {
    OpenCodeService,
    OpenCodeClient,
    Project,
    Session,
    Message,
    MessageWithParts,
    MessagePart,
    TextMessagePart,
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
import { AgentCommand } from '../common/command-manifest';

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
     * Make a raw HTTP/HTTPS request and return the response body as a string.
     */
    protected rawRequest(url: string, method: string, headers: Record<string, string>, body?: string): Promise<{ statusCode: number; body: string }> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const req = protocol.request({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers
            }, (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const responseBody = Buffer.concat(chunks).toString('utf-8');
                    resolve({ statusCode: res.statusCode ?? 0, body: responseBody });
                });
                res.on('error', reject);
            });

            req.on('error', reject);

            if (body !== undefined) {
                req.write(body);
            }
            req.end();
        });
    }

    /**
     * Make an HTTP request and return the parsed JSON response.
     */
    protected async requestJson<T>(options: { url: string; type: string; data?: string; headers?: Record<string, string> }): Promise<T> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        const { statusCode, body } = await this.rawRequest(options.url, options.type, headers, options.data);

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
        const { statusCode, body } = await this.rawRequest(url, 'DELETE', {
            'Accept': 'application/json'
        });
        if (statusCode < 200 || statusCode >= 300) {
            throw new Error(`OpenCodeProxy: HTTP ${statusCode} - DELETE failed: ${body}`);
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

    async getSessions(_projectId: string): Promise<Session[]> {
        // OpenCode API: GET /session - list all sessions
        return this.get<Session[]>(`/session`);
    }

    async getSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: GET /session/:id
        return this.get<Session>(`/session/${encodeURIComponent(sessionId)}`);
    }

    async createSession(_projectId: string, session: Partial<Session>): Promise<Session> {
        // OpenCode API: POST /session - body: { parentID?, title? }
        return this.post<Session>(`/session`, session);
    }

    async deleteSession(_projectId: string, sessionId: string): Promise<void> {
        // OpenCode API: DELETE /session/:id
        return this.delete(`/session/${encodeURIComponent(sessionId)}`);
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

    async compactSession(_projectId: string, sessionId: string): Promise<Session> {
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/compact`, {});
    }

    async revertSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/revert
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/revert`, {});
    }

    async unrevertSession(_projectId: string, sessionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/unrevert
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/unrevert`, {});
    }

    async grantPermission(_projectId: string, sessionId: string, permissionId: string): Promise<Session> {
        // OpenCode API: POST /session/:id/permissions/:permissionID
        return this.post<Session>(`/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(permissionId)}`, {});
    }

    // =========================================================================
    // Message Methods
    // =========================================================================

    async getMessages(_projectId: string, sessionId: string): Promise<MessageWithParts[]> {
        // OpenCode API: GET /session/:id/message
        return this.get<MessageWithParts[]>(`/session/${encodeURIComponent(sessionId)}/message`);
    }

    async getMessage(_projectId: string, sessionId: string, messageId: string): Promise<MessageWithParts> {
        // OpenCode API: GET /session/:id/message/:messageID
        return this.get<MessageWithParts>(`/session/${encodeURIComponent(sessionId)}/message/${encodeURIComponent(messageId)}`);
    }

    async createMessage(_projectId: string, sessionId: string, message: Partial<Message>, model?: { providerID: string; modelID: string }): Promise<MessageWithParts> {
        // OpenCode API: POST /session/:id/message
        // Model is passed as top-level parameter, not in message metadata
        const body = model ? { ...message, model } : message;
        return this.post<MessageWithParts>(`/session/${encodeURIComponent(sessionId)}/message`, body);
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

        // OpenCode API: GET /session/:id/events (SSE)
        const endpoint = `/session/${encodeURIComponent(this.currentSessionId)}/events`;
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

            // Intercept stream to extract agent commands before forwarding
            let notification: MessageNotification = {
                type,
                sessionId: rawData.sessionId,
                projectId: rawData.projectId,
                messageId: rawData.messageId,
                data: rawData.data as MessageWithParts | undefined
            };

            // If message has parts, intercept them for agent commands
            if (notification.data && notification.data.parts) {
                const { cleanParts, commands } = this.interceptStream(notification.data.parts);
                
                // Dispatch extracted commands via RPC callback
                for (const command of commands) {
                    try {
                        this._client.onAgentCommand(command);
                        this.logger.debug(`[OpenCodeProxy] Dispatched agent command: ${command.cmd}`);
                    } catch (error) {
                        this.logger.error(`[OpenCodeProxy] Error dispatching command: ${error}`);
                    }
                }
                
                // Update notification with cleaned parts (commands stripped)
                notification = {
                    ...notification,
                    data: {
                        ...notification.data,
                        parts: cleanParts
                    }
                };
            }

            this._client.onMessageEvent(notification);
            this.logger.debug(`[OpenCodeProxy] Forwarded message event: ${type}`);
        } catch (error) {
            this.logger.error(`[OpenCodeProxy] Error forwarding message event: ${error}`);
        }
    }

    /**
     * Intercept message stream to extract agent commands from %%OS{...}%% blocks.
     * 
     * Scans text parts for %%OS{...}%% blocks, extracts commands, and strips blocks from visible text.
     * Uses a brace-counting state machine to correctly handle nested JSON objects.
     * 
     * @param parts Message parts from SSE event
     * @returns Object with cleanParts (stripped text) and commands (extracted)
     */
    private interceptStream(parts: MessagePart[]): { cleanParts: MessagePart[], commands: AgentCommand[] } {
        const commands: AgentCommand[] = [];
        const cleanParts: MessagePart[] = [];

        for (const part of parts) {
            if (part.type !== 'text') {
                cleanParts.push(part);
                continue;
            }

            // Extract %%OS{...}%% blocks from text using state machine
            const textPart = part as TextMessagePart;
            const { commands: extractedCommands, cleanText } = this.extractAgentCommands(textPart.text);
            
            // Add extracted commands to result
            commands.push(...extractedCommands);

            // Add cleaned text part (only if non-empty)
            if (cleanText) {
                cleanParts.push({ type: 'text', text: cleanText });
            }
        }

        return { cleanParts, commands };
    }

    /**
     * Extract agent commands from text using brace-counting state machine.
     * 
     * This method correctly handles nested JSON objects by counting opening and closing braces
     * instead of using a simple regex pattern. This prevents the regex issue where /%%OS(\{[^}]*\})%%/g
     * would stop at the first `}` character, failing on nested objects like:
     * {"cmd":"x","args":{"nested":"value"}}
     * 
     * @param text Input text potentially containing %%OS{...}%% command blocks
     * @returns Object with extracted commands array and cleanText (text with command blocks removed)
     */
    private extractAgentCommands(text: string): { commands: AgentCommand[], cleanText: string } {
        const commands: AgentCommand[] = [];
        const cleanSegments: string[] = [];
        
        let pos = 0;
        const marker = '%%OS{';
        
        while (pos < text.length) {
            // Find next command marker
            const markerIndex = text.indexOf(marker, pos);
            
            if (markerIndex === -1) {
                // No more markers, append rest of text
                cleanSegments.push(text.substring(pos));
                break;
            }
            
            // Append text before marker to clean segments
            cleanSegments.push(text.substring(pos, markerIndex));
            
            // Start brace counting from the opening brace after %%OS
            const jsonStartIndex = markerIndex + marker.length - 1; // -1 to include the {
            let braceCount = 0;
            let jsonEndIndex = -1;
            let inString = false;
            let escapeNext = false;
            
            // Count braces to find matching closing brace
            for (let i = jsonStartIndex; i < text.length; i++) {
                const char = text[i];
                
                // Handle string state (ignore braces inside strings)
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                
                if (inString) {
                    continue;
                }
                
                // Count braces outside of strings
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    
                    // Found matching closing brace
                    if (braceCount === 0) {
                        jsonEndIndex = i;
                        break;
                    }
                }
            }
            
            // If we found a complete JSON block
            if (jsonEndIndex !== -1) {
                // Check if it's followed by %%
                const potentialEndMarker = text.substring(jsonEndIndex + 1, jsonEndIndex + 3);
                
                if (potentialEndMarker === '%%') {
                    // Extract JSON string (including braces)
                    const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
                    
                    try {
                        // Parse and validate command
                        const command = JSON.parse(jsonString) as AgentCommand;
                        commands.push(command);
                        this.logger.debug(`[OpenCodeProxy] Extracted command: ${command.cmd || 'unknown'}`);
                    } catch (error) {
                        this.logger.warn(`[OpenCodeProxy] Malformed JSON in command block: ${jsonString}`, error);
                        // Discard malformed block (don't show to user)
                    }
                    
                    // Move position past the entire command block (including }%%)
                    pos = jsonEndIndex + 3;
                } else {
                    // Malformed block (missing closing %%)
                    this.logger.warn(`[OpenCodeProxy] Malformed command block (missing closing %%): ${text.substring(markerIndex, jsonEndIndex + 1)}`);
                    // Skip the marker and continue
                    pos = markerIndex + marker.length;
                }
            } else {
                // Unclosed brace - malformed block
                this.logger.warn(`[OpenCodeProxy] Malformed command block (unclosed braces): ${text.substring(markerIndex, Math.min(markerIndex + 100, text.length))}`);
                // Skip the marker and continue
                pos = markerIndex + marker.length;
            }
        }
        
        const cleanText = cleanSegments.join('');
        return { commands, cleanText };
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
