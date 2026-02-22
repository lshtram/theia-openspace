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
}

export default globalSetup;
