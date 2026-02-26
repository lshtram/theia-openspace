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
 * SSE connection lifecycle management.
 * Handles establishing, maintaining, and reconnecting the SSE event stream
 * to the OpenCode server. Delegates event parsing to SseEventRouter.
 *
 * Extracted from OpenCodeProxy to keep each module focused and <400 lines.
 */

import { inject, injectable } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import * as http from 'http';
import * as https from 'https';
import { createParser, ParseEvent } from 'eventsource-parser';
import { OpenCodeClient } from '../../common/opencode-protocol';
import { HttpClient } from './http-client';
import { SseEventRouter } from './sse-event-router';

@injectable()
export class SseConnectionManager {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(HttpClient)
    protected readonly http!: HttpClient;

    @inject(SseEventRouter)
    protected readonly eventRouter!: SseEventRouter;

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
     * Getter/setter for the RPC client — set by the facade, read during event routing.
     */
    protected _client: OpenCodeClient | undefined;

    get client(): OpenCodeClient | undefined { return this._client; }

    setClient(client: OpenCodeClient | undefined): void {
        this._client = client;
    }

    /**
     * Connect to SSE event stream for a project directory.
     * Called from the frontend after setting an active project.
     */
    async connectToProject(directory: string): Promise<void> {
        if (this.isDisposed) {
            this.logger.warn('[SseConnectionManager] Cannot connect SSE: proxy is disposed');
            return;
        }

        // Skip disconnect/reconnect if already connected to the same directory
        if (this.sseConnected && this.currentDirectory === directory) {
            this.logger.debug(`[SseConnectionManager] SSE already connected to ${directory}, skipping reconnect`);
            return;
        }

        // Disconnect existing connection if any
        this.disconnectSSE();

        // Clear user message ID set on session/project change to prevent unbounded growth
        this.eventRouter.userMessageIds.clear();

        this.currentDirectory = directory;

        this.logger.info(`[SseConnectionManager] Connecting SSE for directory ${directory}`);
        this.establishSSEConnection();
    }

    /**
     * Disconnect SSE event stream.
     */
    disconnectSSE(): void {
        if (this.sseReconnectTimer) {
            clearTimeout(this.sseReconnectTimer);
            this.sseReconnectTimer = undefined;
        }

        if (this.sseRequest) {
            this.sseRequest.destroy();
            this.sseRequest = undefined;
        }

        this.sseConnected = false;
        this.reconnectAttempts = 0;
        this.currentDirectory = undefined;

        this.logger.debug('[SseConnectionManager] SSE disconnected');
    }

    /**
     * Mark the manager as disposed — prevents reconnect attempts.
     */
    dispose(): void {
        this.isDisposed = true;
        this.disconnectSSE();
    }

    /**
     * Establish SSE connection to opencode server.
     */
    protected establishSSEConnection(): void {
        if (this.isDisposed || !this.currentDirectory) {
            return;
        }

        const endpoint = `/event`;
        const url = this.http.buildUrl(endpoint, { directory: this.currentDirectory });
        const parsedUrl = new URL(url);

        this.logger.debug(`[SseConnectionManager] Establishing SSE connection to ${url}`);

        const protocol = parsedUrl.protocol === 'https:' ? https : http;

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

        // SSE connections are long-lived; disable timeout
        request.setTimeout(0);

        const parser = createParser((event: ParseEvent) => {
            if (event.type === 'event') {
                if (this._client) {
                    this.eventRouter.handleSSEEvent(event, this._client);
                } else {
                    this.logger.debug('[SseConnectionManager] Received SSE event but no client connected');
                }
            } else if (event.type === 'reconnect-interval') {
                this.logger.debug(`[SseConnectionManager] Server requested reconnect interval: ${event.value}ms`);
            }
        });

        request.on('response', (response: http.IncomingMessage) => {
            if (response.statusCode !== 200) {
                this.logger.error(`[SseConnectionManager] SSE connection failed with status ${response.statusCode}`);
                request.destroy();
                this.scheduleReconnect();
                return;
            }

            this.logger.info(`[SseConnectionManager] SSE connected to ${url}`);
            const isReconnect = this.reconnectAttempts > 0;
            this.sseConnected = true;
            this.reconnectAttempts = 0;

            // Notify client so it can clear accumulated streaming text before replayed deltas arrive
            if (isReconnect && this._client) {
                this.logger.info('[SseConnectionManager] SSE reconnected — notifying client to clear streaming state');
                this._client.onSSEReconnect();
            }

            response.on('data', (chunk: Buffer) => {
                try {
                    parser.feed(chunk.toString('utf-8'));
                } catch (error) {
                    this.logger.error(`[SseConnectionManager] Error feeding SSE parser: ${error}`);
                }
            });

            response.on('end', () => {
                this.logger.warn('[SseConnectionManager] SSE connection closed by server');
                this.sseConnected = false;
                this.sseRequest = undefined;
                if (!this.isDisposed) {
                    this.scheduleReconnect();
                }
            });

            response.on('error', (error: Error) => {
                this.logger.error(`[SseConnectionManager] SSE response error: ${error.message}`);
                this.sseConnected = false;
                this.sseRequest = undefined;
                if (!this.isDisposed) {
                    this.scheduleReconnect();
                }
            });
        });

        request.on('error', (error: Error) => {
            this.logger.error(`[SseConnectionManager] SSE request error: ${error.message}`);
            this.sseConnected = false;
            this.sseRequest = undefined;
            if (!this.isDisposed) {
                this.scheduleReconnect();
            }
        });

        request.on('timeout', () => {
            this.logger.warn('[SseConnectionManager] SSE request timeout');
            request.destroy();
            this.sseConnected = false;
            this.sseRequest = undefined;
            if (!this.isDisposed) {
                this.scheduleReconnect();
            }
        });

        this.sseRequest = request;
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

        this.logger.info(`[SseConnectionManager] Scheduling SSE reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        // Capture current directory to prevent race condition
        const capturedDirectory = this.currentDirectory;

        this.sseReconnectTimer = setTimeout(() => {
            this.sseReconnectTimer = undefined;
            if (!this.isDisposed &&
                this.currentDirectory === capturedDirectory) {
                this.establishSSEConnection();
            }
        }, delay);
    }
}
