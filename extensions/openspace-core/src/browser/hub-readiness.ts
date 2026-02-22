// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Options for waitForHub().
 */
export interface HubReadinessOptions {
    /** Maximum number of GET attempts before giving up. Default: 20 */
    maxAttempts?: number;
    /** Milliseconds to wait between attempts. Default: 500 */
    intervalMs?: number;
}

/**
 * Poll `url` with GET until it responds with a 2xx status, or throw after
 * maxAttempts are exhausted.
 *
 * This is used to gate OpenCode session creation on the openspace-hub MCP
 * server being reachable. Without this gate, sessions created during Theia
 * startup may receive no MCP tools because OpenCode tried to connect before
 * the Hub was listening.
 *
 * @param url - The URL to probe (typically "http://localhost:3000/mcp")
 * @param options - Retry configuration
 * @throws Error if the Hub does not respond within maxAttempts
 */
export async function waitForHub(url: string, options: HubReadinessOptions = {}): Promise<void> {
    const maxAttempts = options.maxAttempts ?? 20;
    const intervalMs = options.intervalMs ?? 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), intervalMs * 2);
        try {
            // Any HTTP response (even 4xx/5xx) means the server is up and listening.
            // The /mcp SSE endpoint returns 406 for plain GET requests (it requires
            // Accept: text/event-stream), so we must not treat 406 as "not ready".
            await fetch(url, { method: 'GET', signal: controller.signal });
            return; // Hub is ready — any response (including 4xx) means it's listening
        } catch {
            // Network error or AbortError — Hub not yet listening, fall through to retry
        } finally {
            clearTimeout(timeoutId);
        }

        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    throw new Error(
        `Hub not ready after ${maxAttempts} attempts at ${url}. ` +
        `MCP tools will not be available — please ensure the Hub is running.`
    );
}
