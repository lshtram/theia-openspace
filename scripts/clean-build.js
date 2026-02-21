#!/usr/bin/env node
/**
 * Clean build script — deletes ALL build artifacts and rebuilds from scratch.
 * Use this when:
 *   - After a Theia version upgrade
 *   - When webpack cache is suspected stale
 *   - When "yarn build" produces unexpected results
 *   - Before creating a release build
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

async function main() {
  console.clear();
  log('═══════════════════════════════════════════════════════', BLUE);
  log('   Theia OpenSpace - Clean Build', BOLD + BLUE);
  log('   Deletes all artifacts and rebuilds from scratch', DIM);
  log('═══════════════════════════════════════════════════════', BLUE);
  console.log();

  const startTime = Date.now();

  // Step 1: Clean artifacts
  log('Cleaning build artifacts...', BOLD);

  const toClean = [
    // Extension lib dirs
    ...['openspace-core', 'openspace-chat', 'openspace-presentation',
        'openspace-whiteboard', 'openspace-layout', 'openspace-settings',
        'openspace-languages', 'openspace-viewers'].map(e =>
          path.join(__dirname, '..', 'extensions', e, 'lib')),
    // Extension tsconfig build info
    ...['openspace-core', 'openspace-chat', 'openspace-presentation',
        'openspace-whiteboard', 'openspace-layout', 'openspace-settings',
        'openspace-languages', 'openspace-viewers'].map(e =>
          path.join(__dirname, '..', 'extensions', e, 'tsconfig.tsbuildinfo')),
    // Browser app lib
    path.join(__dirname, '..', 'browser-app', 'lib'),
    path.join(__dirname, '..', 'browser-app', 'src-gen'),
    // Webpack cache — this is the key difference from a normal build
    path.join(__dirname, '..', 'browser-app', '.webpack-cache'),
    // Root tsconfig build info
    path.join(__dirname, '..', 'tsconfig.tsbuildinfo'),
  ];

  let cleaned = 0;
  for (const p of toClean) {
    if (removeDir(p)) {
      log(`  ✓ Removed ${path.relative(path.join(__dirname, '..'), p)}`, DIM);
      cleaned++;
    }
  }
  log(`  Cleaned ${cleaned} artifact paths`, GREEN);
  console.log();

  // Step 2: Full rebuild (reuse build-summary logic)
  log('Running full rebuild...', BOLD);
  console.log();

  try {
    execSync('node scripts/build-summary.js', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
  } catch (error) {
    log('Clean build failed', RED);
    process.exit(1);
  }

  const totalTime = Date.now() - startTime;
  log('═══════════════════════════════════════════════════════', BLUE);
  log(`✓ Clean build completed in ${formatTime(totalTime)}`, BOLD + GREEN);
  log('═══════════════════════════════════════════════════════', BLUE);
  console.log();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
