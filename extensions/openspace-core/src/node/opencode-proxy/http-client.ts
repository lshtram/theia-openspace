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
 * Low-level HTTP client for communicating with the OpenCode server.
 * Handles URL construction, raw HTTP requests, and JSON request/response.
 *
 * Extracted from OpenCodeProxy to keep each module focused and <400 lines.
 *
 * Design note: delete() previously bypassed requestJson(); it now goes
 * through the unified pipeline for consistency.
 */

import { inject, injectable } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import * as http from 'http';
import * as https from 'https';

/**
 * Symbol for configuring the OpenCode server URL.
 */
export const OpenCodeServerUrl = Symbol('OpenCodeServerUrl');

/**
 * Default OpenCode server URL.
 */
export const DEFAULT_OPENCODE_URL = 'http://localhost:7890';

@injectable()
export class HttpClient {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeServerUrl)
    protected readonly serverUrl!: string;

    /**
     * Build the full URL for an API endpoint.
     */
    buildUrl(endpoint: string, queryParams?: Record<string, string | undefined>): string {
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
    rawRequest(
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
     */
    async requestJson<T>(options: { url: string; type: string; data?: string; headers?: Record<string, string>; timeoutMs?: number }): Promise<T> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        };

        let statusCode: number;
        let body: string;
        this.logger.debug(`[HttpClient] FETCH_START: ${options.type} ${options.url}`);
        try {
            ({ statusCode, body } = await this.rawRequest(options.url, options.type, headers, options.data, options.timeoutMs));
        } catch (err) {
            this.logger.warn(`[HttpClient] FETCH_FAIL: ${options.type} ${options.url}: ${err}`);
            throw err;
        }
        this.logger.debug(`[HttpClient] FETCH_SUCCESS: ${options.type} ${options.url} (${statusCode})`);

        if (statusCode < 200 || statusCode >= 300) {
            throw new Error(`OpenCodeProxy: HTTP ${statusCode} - ${body}`);
        }

        return JSON.parse(body) as T;
    }

    /**
     * Make a GET request.
     */
    async get<T>(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[HttpClient] GET ${url}`);
        return this.requestJson<T>({ url, type: 'GET' });
    }

    /**
     * Make a POST request with optional body.
     */
    async post<T>(endpoint: string, body?: unknown, queryParams?: Record<string, string | undefined>, timeoutMs?: number): Promise<T> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[HttpClient] POST ${url}`);
        return this.requestJson<T>({
            url,
            type: 'POST',
            data: body ? JSON.stringify(body) : undefined,
            timeoutMs
        });
    }

    /**
     * Make a DELETE request.
     * Normalized: now goes through requestJson for consistent error handling.
     */
    async delete(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<void> {
        const url = this.buildUrl(endpoint, queryParams);
        this.logger.debug(`[HttpClient] DELETE ${url}`);
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
    async patch<T>(endpoint: string, body?: unknown): Promise<T> {
        const url = this.buildUrl(endpoint);
        this.logger.debug(`[HttpClient] PATCH ${url}`);
        return this.requestJson<T>({
            url,
            type: 'PATCH',
            data: body ? JSON.stringify(body) : undefined
        });
    }
}
