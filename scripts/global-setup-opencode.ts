/**
 * Global Setup for E2E Tests
 *
 * Ensures the OpenCode server (:7890) is running before tests start.
 * Theia (:3000) is handled separately by playwright.config.ts webServer.
 *
 * Environment variables:
 *   OPENCODE_BIN   — path to opencode binary (default: auto-detect)
 *   OPENCODE_PORT  — OpenCode port (default: 7890)
 *
 * NOTE: Use `npm run test:e2e` (not `npx playwright test` directly).
 * The npm script runs scripts/e2e-precheck.sh first, which brings up any
 * missing server and waits for both :3000 and :7890 to be healthy before
 * Playwright is launched.
 */

import { FullConfig } from '@playwright/test';
import * as http from 'http';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

// ─── Configuration ───────────────────────────────────────────────────────────

const OPENCODE_PORT = parseInt(process.env.OPENCODE_PORT ?? '7890', 10);
const OPENCODE_URL  = `http://localhost:${OPENCODE_PORT}`;
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;
const PROJECT_ROOT  = path.resolve(__dirname, '..');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
    console.log(`[Global Setup] ${msg}`);
}

function isServerRunning(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3_000, () => { req.destroy(); resolve(false); });
    });
}

type HttpResponse = {
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
};

function request(url: string, method: 'GET' | 'POST', endpointPath: string, payload?: unknown): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const body = payload === undefined ? undefined : JSON.stringify(payload);
        const req = http.request(`${url}${endpointPath}`, {
            method,
            headers: body ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body),
            } : undefined,
        }, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode ?? 0,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf-8'),
                });
            });
        });

        if (body !== undefined) {
            req.write(body);
        }
        req.end();

        req.on('error', (err) => reject(new Error(`Request to ${endpointPath} failed: ${err.message}`)));
        req.setTimeout(5_000, () => {
            req.destroy(new Error(`Request to ${endpointPath} timed out after 5000ms`));
        });
    });
}

function bodyPreview(body: string): string {
    return body.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function isJsonContentType(value: string | string[] | undefined): boolean {
    if (typeof value === 'string') return value.toLowerCase().includes('application/json');
    if (Array.isArray(value)) return value.some((v) => v.toLowerCase().includes('application/json'));
    return false;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isProjectSummary(value: unknown): value is { id: string; worktree?: string; path?: string } {
    if (value === null || typeof value !== 'object') return false;
    const candidate = value as { id?: unknown; worktree?: unknown; path?: unknown };
    const hasLocation = isNonEmptyString(candidate.worktree) || isNonEmptyString(candidate.path);
    return isNonEmptyString(candidate.id) && hasLocation;
}

async function assertOpenCodeProjectApiReady(url: string): Promise<void> {
    const endpoint = '/project';
    const res = await request(url, 'GET', endpoint);
    const contentType = res.headers['content-type'];

    if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(
            `OpenCode API readiness check failed at ${url}${endpoint}: expected HTTP 2xx, got ${res.statusCode}. ` +
            `Run scripts/e2e-precheck.sh (or npm run test:e2e) to restart OpenCode before Playwright.`
        );
    }

    if (!isJsonContentType(contentType)) {
        throw new Error(
            `OpenCode API readiness check failed at ${url}${endpoint}: expected application/json but got ` +
            `${Array.isArray(contentType) ? contentType.join(', ') : (contentType ?? 'unknown')}. ` +
            `Body preview: "${bodyPreview(res.body)}". This usually means port ${OPENCODE_PORT} is serving an HTML app shell instead of OpenCode API.`
        );
    }

    try {
        const parsed = JSON.parse(res.body);
        if (!Array.isArray(parsed)) {
            throw new Error('Expected /project response to be a JSON array');
        }

        const invalidIndex = parsed.findIndex((item) => !isProjectSummary(item));
        if (invalidIndex !== -1) {
            throw new Error(`Invalid project entry at index ${invalidIndex}; expected object with non-empty id and worktree strings`);
        }
    } catch (error) {
        throw new Error(
            `OpenCode API readiness check failed at ${url}${endpoint}: JSON payload shape is invalid. ` +
            `${error instanceof Error ? error.message : 'Unknown JSON parse/shape error'}. ` +
            `Body preview: "${bodyPreview(res.body)}".`
        );
    }

    log(`OpenCode API confirmed at ${url}${endpoint}`);
}

async function assertOpenCodeProjectInitApiReady(url: string): Promise<void> {
    const endpoint = '/project/init';
    const res = await request(url, 'POST', endpoint, { directory: '/__openspace_e2e_probe_nonexistent__' });
    const contentType = res.headers['content-type'];

    if (!isJsonContentType(contentType)) {
        log(
            `Warning: ${url}${endpoint} returned non-JSON (${Array.isArray(contentType) ? contentType.join(', ') : (contentType ?? 'unknown')}). ` +
            `Body preview: "${bodyPreview(res.body)}". Continuing because /project API is healthy.`
        );
        return;
    }

    try {
        JSON.parse(res.body);
    } catch {
        log(
            `Warning: ${url}${endpoint} returned invalid JSON payload. ` +
            `Body preview: "${bodyPreview(res.body)}". Continuing because /project API is healthy.`
        );
        return;
    }

    log(`OpenCode API confirmed at ${url}${endpoint}`);
}

function waitUntilReady(url: string, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        const tick = async (): Promise<void> => {
            if (await isServerRunning(url)) {
                log(`${label} ready at ${url}`);
                resolve();
                return;
            }
            if (Date.now() >= deadline) {
                reject(new Error(`${label} did not become ready within ${READY_TIMEOUT_MS / 1000}s`));
                return;
            }
            const elapsed = Math.round((Date.now() - (deadline - READY_TIMEOUT_MS)) / 1000);
            log(`Waiting for ${label}... (${elapsed}s)`);
            setTimeout(tick, POLL_INTERVAL_MS);
        };
        tick();
    });
}

// ─── OpenCode ────────────────────────────────────────────────────────────────

function resolveOpenCodeBin(): string {
    if (process.env.OPENCODE_BIN) return process.env.OPENCODE_BIN;
    const candidates = [
        '/opt/homebrew/bin/opencode',
        '/usr/local/bin/opencode',
        `${process.env.HOME}/.opencode/bin/opencode`,
        '/Users/opencode/.opencode/bin/opencode',
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return 'opencode'; // fallback to PATH
}

function startOpenCode(): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
        const bin = resolveOpenCodeBin();
        log(`Starting OpenCode (${bin} serve --port ${OPENCODE_PORT})...`);
        const proc = spawn(bin, ['serve', '--port', String(OPENCODE_PORT)], {
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
        });
        proc.stdout?.on('data', (d) => process.stdout.write(`[opencode] ${d}`));
        proc.stderr?.on('data', (d) => process.stderr.write(`[opencode] ${d}`));
        proc.on('error', (err) => reject(new Error(`Failed to spawn OpenCode: ${err.message}`)));
        setTimeout(() => resolve(proc), 500);
    });
}

// ─── PID file for teardown ────────────────────────────────────────────────────

/** Path where the PID of a setup-started OpenCode process is written. */
export const OPENCODE_PID_FILE = path.join(PROJECT_ROOT, '.opencode-e2e.pid');

// ─── Main ────────────────────────────────────────────────────────────────────

async function globalSetup(_config: FullConfig): Promise<void> {
    const running = await isServerRunning(OPENCODE_URL);
    if (running) {
        log(`OpenCode already running at ${OPENCODE_URL}`);
        // Not started by us — teardown should leave it alone
    } else {
        log('OpenCode not running — starting it...');
        const proc = await startOpenCode();
        if (proc.pid !== undefined) {
            fs.writeFileSync(OPENCODE_PID_FILE, String(proc.pid), 'utf-8');
            log(`OpenCode PID ${proc.pid} written to ${OPENCODE_PID_FILE}`);
        }
        await waitUntilReady(OPENCODE_URL, 'OpenCode');
    }

    await assertOpenCodeProjectApiReady(OPENCODE_URL);
    await assertOpenCodeProjectInitApiReady(OPENCODE_URL);
}

export default globalSetup;
