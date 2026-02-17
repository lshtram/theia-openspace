#!/usr/bin/env node
/**
 * Clean build summary script
 * Provides concise, user-friendly build output
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

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function checkExtension(name) {
  const libPath = path.join(__dirname, '..', 'extensions', name, 'lib');
  return fs.existsSync(libPath);
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const mb = stats.size / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  } catch {
    return 'N/A';
  }
}

async function main() {
  console.clear();
  log('═══════════════════════════════════════════════════════', BLUE);
  log('   Theia OpenSpace - Build Process', BOLD + BLUE);
  log('═══════════════════════════════════════════════════════', BLUE);
  console.log();

  const startTime = Date.now();

  // Extensions
  log('Building Extensions...', BOLD);
  const extensions = [
    'openspace-core',
    'openspace-chat',
    'openspace-presentation',
    'openspace-whiteboard',
    'openspace-layout',
    'openspace-settings'
  ];

  const extStartTime = Date.now();
  try {
    execSync('yarn --silent build:extensions', { stdio: 'pipe' });
    const extTime = Date.now() - extStartTime;
    
    extensions.forEach(ext => {
      const built = checkExtension(ext);
      log(`  ${built ? '✓' : '✗'} ${ext}`, built ? GREEN : YELLOW);
    });
    log(`  ${DIM}Completed in ${formatTime(extTime)}${RESET}`);
  } catch (error) {
    log('  ✗ Build failed', YELLOW);
    console.error(error.message);
    process.exit(1);
  }
  console.log();

  // Browser App
  log('Building Browser App...', BOLD);
  const browserStartTime = Date.now();
  try {
    execSync('yarn --silent --cwd browser-app build', { stdio: 'pipe' });
    const browserTime = Date.now() - browserStartTime;
    
    const libPath = path.join(__dirname, '..', 'browser-app', 'lib');
    const mainSize = getFileSize(path.join(libPath, 'backend', 'main.js'));
    const frontendPath = path.join(libPath, 'frontend');
    
    log(`  ✓ Backend bundle: ${mainSize}`, GREEN);
    log(`  ✓ Frontend bundles compiled`, GREEN);
    log(`  ${DIM}Completed in ${formatTime(browserTime)}${RESET}`);
  } catch (error) {
    log('  ✗ Build failed', YELLOW);
    console.error(error.message);
    process.exit(1);
  }
  console.log();

  // Summary
  const totalTime = Date.now() - startTime;
  log('═══════════════════════════════════════════════════════', BLUE);
  log(`✓ Build completed successfully in ${formatTime(totalTime)}`, BOLD + GREEN);
  log('═══════════════════════════════════════════════════════', BLUE);
  console.log();
  log('Run: yarn start:browser', DIM);
  log('Open: http://localhost:3000', DIM);
  console.log();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
