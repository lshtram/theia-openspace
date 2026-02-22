/**
 * Global Teardown for E2E Tests
 *
 * Stops the OpenCode server process started by global-setup-opencode.ts (if any).
 * Only terminates processes that were started by the setup script — pre-existing
 * servers that were already running when setup ran are left untouched.
 */

import { FullConfig } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OPENCODE_PID_FILE = path.join(PROJECT_ROOT, '.opencode-e2e.pid');
const GRACEFUL_TIMEOUT_MS = 5_000;

function log(msg: string): void {
    console.log(`[Global Teardown] ${msg}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function stopProcess(pid: number): Promise<void> {
    if (!isProcessRunning(pid)) {
        log(`Process ${pid} is not running — nothing to stop`);
        return;
    }

    log(`Sending SIGTERM to OpenCode process ${pid}...`);
    try {
        process.kill(pid, 'SIGTERM');
    } catch (err) {
        log(`SIGTERM failed for PID ${pid}: ${err}`);
        return;
    }

    // Poll for graceful exit
    const deadline = Date.now() + GRACEFUL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(200);
        if (!isProcessRunning(pid)) {
            log(`OpenCode process ${pid} exited cleanly`);
            return;
        }
    }

    // Fallback SIGKILL
    log(`OpenCode process ${pid} did not exit within ${GRACEFUL_TIMEOUT_MS}ms — sending SIGKILL`);
    try {
        process.kill(pid, 'SIGKILL');
    } catch {
        // Process may have already exited between the check and the kill
    }
}

async function globalTeardown(_config: FullConfig): Promise<void> {
    if (!fs.existsSync(OPENCODE_PID_FILE)) {
        log('No PID file found — OpenCode was pre-existing; leaving it running');
        return;
    }

    const pidStr = fs.readFileSync(OPENCODE_PID_FILE, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid) || pid <= 0) {
        log(`Invalid PID in file: ${JSON.stringify(pidStr)}`);
        fs.unlinkSync(OPENCODE_PID_FILE);
        return;
    }

    log(`Stopping OpenCode (PID ${pid}) started by globalSetup...`);
    await stopProcess(pid);

    try {
        fs.unlinkSync(OPENCODE_PID_FILE);
    } catch {
        // Ignore
    }
}

export default globalTeardown;
