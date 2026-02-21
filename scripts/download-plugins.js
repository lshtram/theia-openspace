#!/usr/bin/env node
/**
 * Downloads pre-bundled extensions (.vsix) from Open VSX registry.
 * Run once during initial setup, or when updating builtin extensions.
 *
 * Usage:
 *   node scripts/download-plugins.js           # download all
 *   node scripts/download-plugins.js --check   # check what's installed
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';

const OVSX_API = 'https://open-vsx.org/api';
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins', 'builtin');
const MANIFEST_PATH = path.join(__dirname, '..', 'plugins', 'builtin.json');

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'theia-openspace/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getLatestVersion(publisher, name) {
  const url = `${OVSX_API}/${publisher}/${name}`;
  const buf = await httpsGet(url);
  const data = JSON.parse(buf.toString());
  if (data.error) throw new Error(`Open VSX error for ${publisher}.${name}: ${data.error}`);
  return data.version;
}

async function downloadExtension(id, requestedVersion) {
  const [publisher, name] = id.split('.');
  if (!publisher || !name) throw new Error(`Invalid extension id: ${id}`);

  const version = requestedVersion === 'latest'
    ? await getLatestVersion(publisher, name)
    : requestedVersion;

  const filename = `${publisher}.${name}-${version}.vsix`;
  const destPath = path.join(PLUGINS_DIR, filename);

  // Skip if already downloaded
  if (fs.existsSync(destPath)) {
    log(`  ✓ ${id}@${version} (already downloaded)`, DIM);
    return { id, version, filename, skipped: true };
  }

  // Remove old versions of this extension
  const existing = fs.readdirSync(PLUGINS_DIR)
    .filter(f => f.startsWith(`${publisher}.${name}-`) && f.endsWith('.vsix'));
  for (const old of existing) {
    fs.unlinkSync(path.join(PLUGINS_DIR, old));
    log(`  → Removed old: ${old}`, DIM);
  }

  // Download
  const downloadUrl = `${OVSX_API}/${publisher}/${name}/${version}/file/${filename}`;
  log(`  ↓ ${id}@${version}...`, YELLOW);
  const vsixData = await httpsGet(downloadUrl);
  fs.writeFileSync(destPath, vsixData);
  log(`  ✓ ${id}@${version} (${(vsixData.length / 1024 / 1024).toFixed(1)} MB)`, GREEN);
  return { id, version, filename, skipped: false };
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  console.log();
  log('═══════════════════════════════════════════════════════', BLUE);
  log('   Theia OpenSpace - Plugin Setup', BOLD + BLUE);
  if (checkOnly) log('   Mode: check only (no downloads)', DIM);
  log('═══════════════════════════════════════════════════════', BLUE);
  console.log();

  if (!fs.existsSync(MANIFEST_PATH)) {
    log(`Error: ${MANIFEST_PATH} not found`, RED);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  fs.mkdirSync(PLUGINS_DIR, { recursive: true });

  if (checkOnly) {
    log('Installed plugins:', BOLD);
    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.vsix'));
    if (files.length === 0) {
      log('  (none) — run: node scripts/download-plugins.js', YELLOW);
    } else {
      files.forEach(f => log(`  ✓ ${f}`, GREEN));
    }
    return;
  }

  log(`Downloading ${manifest.length} extensions from Open VSX...`, BOLD);
  console.log();

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of manifest) {
    try {
      const result = await downloadExtension(entry.id, entry.version || 'latest');
      if (result.skipped) skipped++; else downloaded++;
    } catch (err) {
      log(`  ✗ ${entry.id}: ${err.message}`, RED);
      failed++;
    }
  }

  console.log();
  log('═══════════════════════════════════════════════════════', BLUE);
  log(`  Downloaded: ${downloaded}  |  Skipped: ${skipped}  |  Failed: ${failed}`, downloaded > 0 ? GREEN : (failed > 0 ? RED : DIM));
  log('═══════════════════════════════════════════════════════', BLUE);
  console.log();

  if (failed > 0) {
    log('Some extensions failed to download. Check your network connection.', YELLOW);
    log('The app will still start — users can install extensions via the UI.', DIM);
  } else {
    log('Plugin setup complete. Start the app with: yarn start:browser', GREEN);
  }
  console.log();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
