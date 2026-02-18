/**
 * OpenCode Server Manager for E2E Tests
 * 
 * This script ensures that the OpenCode server is running before E2E tests start.
 * It checks if the server is already running on the expected port, and if not,
 * starts a new instance.
 * 
 * Usage:
 *   node scripts/ensure-opencode-server.js
 * 
 * Environment:
 *   OPENCODE_PORT - Port to check/start (default: 7890)
 *   OPENCODE_SERVER_URL - Full URL to check (overrides port)
 */

const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OPENCODE_PORT = process.env.OPENCODE_PORT ? parseInt(process.env.OPENCODE_PORT) : 7890;
const OPENCODE_HOST = process.env.OPENCODE_HOST || 'localhost';
const SERVER_URL = process.env.OPENCODE_SERVER_URL || `http://${OPENCODE_HOST}:${OPENCODE_PORT}`;
const PID_FILE = path.join(__dirname, '.opencode-server.pid');
const STARTUP_TIMEOUT = 60000; // 60 seconds max to wait for server
const CHECK_INTERVAL = 1000; // 1 second between checks

/**
 // 1 second * Check if a URL is responding
 */
function checkServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ 
        running: res.statusCode >= 200 && res.statusCode < 500,
        statusCode: res.statusCode 
      });
    });
    req.on('error', () => {
      resolve({ running: false, statusCode: 0 });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ running: false, statusCode: 0 });
    });
  });
}

/**
 * Check if port is in use
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Get the PID of the process using the port
 */
function getPortPid(port) {
  return new Promise((resolve) => {
    exec(`lsof -t -i :${port}`, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve(null);
      } else {
        resolve(parseInt(stdout.trim().split('\n')[0]));
      }
    });
  });
}

/**
 * Start the OpenCode server
 */
function startServer(port) {
  return new Promise((resolve, reject) => {
    console.log(`[OpenCode Server] Starting server on port ${port}...`);
    
    // Check if opencode binary exists
    const opencodePath = process.env.OPENCODE_BIN || '/Users/opencode/.opencode/bin/opencode';
    
    if (!fs.existsSync(opencodePath)) {
      reject(new Error(`OpenCode binary not found at: ${opencodePath}`));
      return;
    }
    
    const serverProcess = spawn(opencodePath, ['serve', '--port', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env }
    });
    
    serverProcess.stdout.on('data', (data) => {
      process.stdout.write(`[opencode] ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`[opencode] ${data}`);
    });
    
    serverProcess.on('error', (err) => {
      console.error(`[OpenCode Server] Failed to start: ${err.message}`);
      reject(err);
    });
    
    // Save PID for cleanup
    fs.writeFileSync(PID_FILE, String(serverProcess.pid));
    console.log(`[OpenCode Server] Started with PID: ${serverProcess.pid}`);
    
    resolve(serverProcess);
  });
}

/**
 * Wait for server to be ready
 */
async function waitForServer(url, timeout) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await checkServer(url);
    if (result.running) {
      return true;
    }
    console.log(`[OpenCode Server] Waiting for server... (${Math.round((Date.now() - startTime)/1000)}s)`);
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
  
  return false;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const forceStart = args.includes('--force');
  
  console.log('[OpenCode Server] Checking server status...');
  console.log(`[OpenCode Server] Target: ${SERVER_URL}`);
  
  // Check if server is already running
  const serverCheck = await checkServer(SERVER_URL);
  
  if (serverCheck.running) {
    console.log(`[OpenCode Server] ✓ Server already running at ${SERVER_URL} (status: ${serverCheck.statusCode})`);
    
    if (forceStart) {
      console.log('[OpenCode Server] Force start requested, killing existing server...');
      const pid = await getPortPid(OPENCODE_PORT);
      if (pid) {
        process.kill(pid);
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      // Verify it's the right type of server by checking response
      process.exit(0);
    }
  }
  
  // Server not running - start it
  console.log(`[OpenCode Server] Server not running on port ${OPENCODE_PORT}`);
  
  // Check if port is in use by something else
  const portInUse = await checkPort(OPENCODE_PORT);
  if (portInUse) {
    const pid = await getPortPid(OPENCODE_PORT);
    if (pid) {
      console.log(`[OpenCode Server] Port ${OPENCODE_PORT} is in use by PID ${pid}. Attempting to use different port...`);
      // Try to find an available port or use dynamic
    }
  }
  
  try {
    await startServer(OPENCODE_PORT);
    
    // Wait for server to be ready
    const ready = await waitForServer(SERVER_URL, STARTUP_TIMEOUT);
    
    if (ready) {
      console.log(`[OpenCode Server] ✓ Server ready at ${SERVER_URL}`);
      process.exit(0);
    } else {
      console.error(`[OpenCode Server] ✗ Server failed to become ready within ${STARTUP_TIMEOUT}ms`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`[OpenCode Server] ✗ Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

main();
