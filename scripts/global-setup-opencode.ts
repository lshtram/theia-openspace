/**
 * Global Setup for E2E Tests
 * 
 * Ensures the OpenCode server is running before tests start.
 * This is a requirement for integration tests that communicate with the backend.
 */

import { chromium, FullConfig } from '@playwright/test';
import * as http from 'http';
import { execSync, spawn } from 'child_process';

const OPENCODE_PORT = 7890;
const OPENCODE_URL = `http://localhost:${OPENCODE_PORT}`;

/**
 * Check if a URL is responding
 */
function isServerRunning(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

/**
 * Start the OpenCode server
 */
function startOpenCodeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const opencodePath = process.env.OPENCODE_BIN || '/Users/opencode/.opencode/bin/opencode';
    
    console.log(`[Global Setup] Starting OpenCode server on port ${OPENCODE_PORT}...`);
    
    const proc = spawn(opencodePath, ['serve', '--port', String(OPENCODE_PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    proc.stdout?.on('data', (data) => process.stdout.write(`[opencode] ${data}`));
    proc.stderr?.on('data', (data) => process.stderr.write(`[opencode] ${data}`));
    
    // Wait for server to be ready
    const startTime = Date.now();
    const maxWait = 60000;
    
    const checkInterval = setInterval(() => {
      isServerRunning(OPENCODE_URL).then((running) => {
        if (running) {
          clearInterval(checkInterval);
          console.log('[Global Setup] OpenCode server ready');
          resolve();
        } else if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          proc.kill();
          reject(new Error('OpenCode server failed to start within 60s'));
        }
      });
    }, 1000);
  });
}

async function globalSetup(config: FullConfig) {
  console.log('[Global Setup] Checking OpenCode server...');
  
  // Check if server is already running
  const isRunning = await isServerRunning(OPENCODE_URL);
  
  if (isRunning) {
    console.log(`[Global Setup] OpenCode server already running at ${OPENCODE_URL}`);
    return;
  }
  
  // Server not running - try to start it
  try {
    await startOpenCodeServer();
  } catch (err) {
    console.error('[Global Setup] Failed to start OpenCode server:', err);
    throw err;
  }
}

export default globalSetup;
