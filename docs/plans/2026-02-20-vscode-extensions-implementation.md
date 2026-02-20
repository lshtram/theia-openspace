# VS Code Extensions Support — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the VS Code extension ecosystem in Theia Openspace — Extensions sidebar, Open VSX marketplace, curated pre-bundled extensions, and webpack filesystem caching for fast development builds.

**Architecture:** Add `@theia/plugin-ext` + `@theia/plugin-ext-vscode` + `@theia/vsx-registry` to the browser-app. Wire a `plugins/builtin/` directory for pre-bundled `.vsix` files loaded at startup. Add webpack filesystem cache to `webpack.config.js` for sub-10s incremental builds. Add `build:clean` script for full rebuilds from scratch.

**Tech Stack:** Theia 1.68.2, `@theia/plugin-ext`, `@theia/plugin-ext-vscode`, `@theia/vsx-registry`, `@theia/ovsx-client` (already transitive), webpack 5 filesystem cache, Node.js `https` for `.vsix` download script.

**Worktree:** `.worktrees/feature-extensions` on branch `feature/vscode-extensions`

---

## Task 1: Add webpack filesystem cache to browser-app

Improves all subsequent builds during this feature's development. Do this first.

**Files:**
- Modify: `browser-app/webpack.config.js`
- Modify: `browser-app/.gitignore` (or root `.gitignore`)

**Step 1: Read the current webpack.config.js**

```bash
cat browser-app/webpack.config.js
```

**Step 2: Add filesystem cache to `webpack.config.js`**

In `browser-app/webpack.config.js`, replace the existing `configs.forEach(config => {` block. Add filesystem cache configuration **before** the existing `ignoreWarnings` lines, so the full block reads:

```js
configs.forEach(config => {
    // Persistent filesystem cache — survives between builds
    // Cuts warm build time from ~45s to ~5s when dependencies haven't changed
    config.cache = {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
        buildDependencies: {
            // Invalidate cache when webpack config changes
            config: [__filename, path.resolve(__dirname, 'gen-webpack.config.js')],
        },
    };

    config.ignoreWarnings = [
        // ... existing ignoreWarnings content unchanged ...
    ];
    // ... rest of existing block unchanged ...
});
```

The key addition is the `config.cache = { type: 'filesystem', ... }` block. Leave everything else in the forEach exactly as it is.

**Step 3: Add `.webpack-cache/` to gitignore**

Check if root `.gitignore` already covers it:

```bash
grep -n "webpack" .gitignore
```

If not present, add `browser-app/.webpack-cache/` to the root `.gitignore`.

**Step 4: Verify build still works**

```bash
yarn --silent --cwd browser-app build 2>&1 | tail -5
```

Expected: `webpack 5.x compiled successfully in Xs`. First run will be similar time to before — cache is being written. Note the time.

**Step 5: Verify cache was created**

```bash
ls -la browser-app/.webpack-cache/
```

Expected: directory exists with cache files.

**Step 6: Run build again — verify speedup**

```bash
time yarn --silent --cwd browser-app build 2>&1 | tail -5
```

Expected: significantly faster than first run (should be under 15s, ideally 3-8s with no code changes).

**Step 7: Commit**

```bash
git add browser-app/webpack.config.js .gitignore
git commit -m "perf(build): add webpack filesystem cache for fast incremental builds"
```

---

## Task 2: Add clean-build and dev-build scripts

**Files:**
- Modify: `package.json` (root)
- Modify: `scripts/build-summary.js`

**Step 1: Read current root package.json scripts**

```bash
cat package.json
```

**Step 2: Add new scripts to root `package.json`**

In the `"scripts"` section, add after the existing `"build"` entry:

```json
"build:dev": "node scripts/build-summary.js --mode dev",
"build:clean": "node scripts/clean-build.js",
```

Keep all existing scripts unchanged.

**Step 3: Read `scripts/build-summary.js`**

```bash
cat scripts/build-summary.js
```

**Step 4: Create `scripts/clean-build.js`**

Create `scripts/clean-build.js` with the following content:

```js
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
```

**Step 5: Verify clean build script runs**

```bash
node scripts/clean-build.js
```

Expected: cleans artifacts, rebuilds from scratch, completes successfully. This will take full build time (~45–55s after plugin-ext is added).

**Step 6: Commit**

```bash
git add package.json scripts/clean-build.js
git commit -m "feat(build): add clean-build script that purges all artifacts including webpack cache"
```

---

## Task 3: Add plugin packages to browser-app

**Files:**
- Modify: `browser-app/package.json`

**Step 1: Read current browser-app/package.json**

```bash
cat browser-app/package.json
```

**Step 2: Add three packages to the `dependencies` section**

In `browser-app/package.json`, add to the `"dependencies"` object (after the existing `@theia/workspace` entry, keeping alphabetical order):

```json
"@theia/plugin-ext": "1.68.2",
"@theia/plugin-ext-vscode": "1.68.2",
"@theia/vsx-registry": "1.68.2"
```

**Step 3: Update the `theia` config block in browser-app/package.json**

Change the `"theia"` section to:

```json
"theia": {
    "target": "browser",
    "theiaPluginsDir": "plugins",
    "frontend": {
        "config": {
            "applicationName": "Theia Openspace",
            "preferences": {
                "files.enableTrash": false
            }
        }
    }
}
```

The addition is `"theiaPluginsDir": "plugins"` — tells Theia where pre-bundled plugins live relative to the browser-app directory.

**Step 4: Update the `start` script in browser-app/package.json**

Change:
```json
"start": "theia start --port 3000"
```
To:
```json
"start": "theia start --port 3000 --plugins=local-dir:../plugins/builtin"
```

**Step 5: Install new packages**

```bash
yarn install
```

Expected: resolves and links the three new packages without errors. Peer dependency warnings about React versions from tldraw are pre-existing and can be ignored.

**Step 6: Rebuild the browser app — let Theia regenerate src-gen**

```bash
yarn --cwd browser-app build 2>&1 | tail -10
```

Expected: `webpack compiled successfully`. The `src-gen/` directory gets regenerated to include the new plugin modules. This will be a full webpack build (cache miss) because new modules are added — expect ~45–55s.

**Step 7: Verify the Extensions view appears**

Start the app:

```bash
yarn start:browser
```

Open `http://localhost:3000`. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac). Expected: the Extensions sidebar panel appears with a search box and sections for Installed/Recommended/Built-in.

If the sidebar does not appear, check the browser console for errors and the terminal for backend errors.

**Step 8: Commit**

```bash
git add browser-app/package.json yarn.lock
git commit -m "feat(extensions): add @theia/plugin-ext, plugin-ext-vscode, vsx-registry to browser-app"
```

---

## Task 4: Rebuild native dependencies for browser target

`@theia/plugin-ext` depends on `node-pty` which has a native Node.js addon. It must be rebuilt for the correct target after package installation.

**Files:** No source files changed — this is a binary rebuild step.

**Step 1: Run Theia's browser rebuild command**

```bash
yarn --cwd browser-app theia rebuild:browser
```

Expected: compiles `node-pty` and any other native addons for the browser/Node backend target. Output includes lines like `electron-rebuild` or `node-gyp rebuild` for native modules.

If this command is not found, try:

```bash
npx --prefix browser-app theia rebuild:browser
```

**Step 2: Rebuild the browser app**

```bash
yarn --cwd browser-app build 2>&1 | tail -5
```

Expected: `webpack compiled successfully`. Webpack cache may partially hit from Task 3.

**Step 3: Verify the app starts and Extensions view still works**

```bash
yarn start:browser
```

Check `http://localhost:3000` — Extensions panel should open on `Ctrl+Shift+X`.

**Step 4: Commit**

```bash
git commit -am "build(extensions): rebuild native deps (node-pty) for browser target"
```

---

## Task 5: Create plugins directory and builtin manifest

**Files:**
- Create: `plugins/builtin.json`
- Create: `plugins/builtin/.gitkeep`
- Modify: `.gitignore` (root)

**Step 1: Create the plugins directory structure**

```bash
mkdir -p plugins/builtin
touch plugins/builtin/.gitkeep
```

**Step 2: Create `plugins/builtin.json`**

Create `plugins/builtin.json`:

```json
[
  {
    "id": "redhat.vscode-yaml",
    "version": "latest",
    "description": "YAML language support"
  },
  {
    "id": "vscode.git",
    "version": "latest",
    "description": "Git source control integration"
  },
  {
    "id": "esbenp.prettier-vscode",
    "version": "latest",
    "description": "Code formatter"
  },
  {
    "id": "yzhang.markdown-all-in-one",
    "version": "latest",
    "description": "Markdown editing and preview"
  },
  {
    "id": "ms-python.python",
    "version": "latest",
    "description": "Python language support"
  }
]
```

**Step 3: Add `.vsix` files to gitignore**

Add to root `.gitignore`:

```
# Downloaded plugin binaries — run scripts/download-plugins.js to populate
plugins/builtin/*.vsix
```

**Step 4: Commit**

```bash
git add plugins/ .gitignore
git commit -m "feat(extensions): add plugins/builtin directory and extension manifest"
```

---

## Task 6: Create download-plugins.js script

**Files:**
- Create: `scripts/download-plugins.js`
- Modify: `package.json` (root) — add `setup:plugins` script

**Step 1: Read plugins/builtin.json to understand the format**

```bash
cat plugins/builtin.json
```

**Step 2: Create `scripts/download-plugins.js`**

Create `scripts/download-plugins.js`:

```js
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
```

**Step 3: Add `setup:plugins` script to root `package.json`**

In the `"scripts"` section of root `package.json`, add:

```json
"setup:plugins": "node scripts/download-plugins.js",
"setup:plugins:check": "node scripts/download-plugins.js --check"
```

**Step 4: Test the download script**

```bash
node scripts/download-plugins.js
```

Expected: downloads `.vsix` files to `plugins/builtin/`. Each extension prints its size. Takes ~30–60s depending on network.

If an extension is not found on Open VSX (e.g. `vscode.git` is a VS Code built-in and may not be on Open VSX), the script prints an error but continues. Remove any unavailable extensions from `builtin.json` and replace with available alternatives.

**Step 5: Verify plugins directory**

```bash
ls -lh plugins/builtin/*.vsix
node scripts/download-plugins.js --check
```

Expected: lists all downloaded `.vsix` files with sizes.

**Step 6: Commit**

```bash
git add scripts/download-plugins.js package.json plugins/builtin.json plugins/builtin/.gitkeep
git commit -m "feat(extensions): add download-plugins script and builtin extension manifest"
```

---

## Task 7: Add workspace recommendations file

**Files:**
- Create: `.theia/extensions.json`

**Step 1: Check if `.theia/` exists**

```bash
ls .theia/ 2>/dev/null || echo "no .theia dir"
```

**Step 2: Create `.theia/extensions.json`**

Create `.theia/extensions.json`:

```json
{
  "recommendations": [
    "eamodio.gitlens",
    "dbaeumer.vscode-eslint",
    "streetsidesoftware.code-spell-checker",
    "bradlc.vscode-tailwindcss"
  ]
}
```

These appear in the "Recommended" section of the Extensions sidebar. Users see them suggested but they are not auto-installed.

**Step 3: Commit**

```bash
git add .theia/extensions.json
git commit -m "feat(extensions): add curated extension recommendations for workspace"
```

---

## Task 8: End-to-end verification

**No files changed — this is verification only.**

**Step 1: Start a clean server**

```bash
yarn start:browser
```

**Step 2: Verify Extensions sidebar**

Open `http://localhost:3000` in a browser.

Press `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`).

Expected:
- Extensions panel opens in the left sidebar
- "Search Extensions in Marketplace" input is visible
- "Recommended" section shows the 4 extensions from `.theia/extensions.json`
- "Built-in" section shows extensions from `plugins/builtin/` (if download step ran)

**Step 3: Verify marketplace search**

Type `"python"` in the search box.

Expected:
- Results appear from `open-vsx.org`
- Extensions show name, publisher, version, description
- Install button is present on each result

**Step 4: Verify install flow (smoke test)**

Click Install on a small extension (e.g. `yzhang.markdown-all-in-one` if not pre-bundled).

Expected:
- Progress indicator shown
- Extension installs without error
- Reload prompt may appear

**Step 5: Verify warm build is fast**

Without stopping the server, in another terminal:

```bash
time yarn --cwd browser-app build 2>&1 | tail -3
```

Expected: build completes in under 15s (webpack cache hit).

**Step 6: Verify clean build works**

```bash
yarn build:clean 2>&1 | tail -5
```

Expected: clears all artifacts including `.webpack-cache/`, rebuilds from scratch, completes successfully.

---

## Task 9: Update build-summary.js for plugin-ext awareness

**Files:**
- Modify: `scripts/build-summary.js`

**Step 1: Read current build-summary.js**

```bash
cat scripts/build-summary.js
```

**Step 2: Update the `extensions` array in `build-summary.js`**

The current script checks a hardcoded list of 6 extensions. Add the two that are missing (`openspace-languages`, `openspace-viewers`) to match `build:extensions` in root `package.json`:

```js
const extensions = [
  'openspace-core',
  'openspace-chat',
  'openspace-presentation',
  'openspace-whiteboard',
  'openspace-layout',
  'openspace-settings',
  'openspace-languages',
  'openspace-viewers',
];
```

**Step 3: Add plugin setup hint to build summary output**

After the "Run: yarn start:browser" line near the end of `build-summary.js`, add:

```js
log('Plugins: yarn setup:plugins (first-time setup)', DIM);
```

**Step 4: Commit**

```bash
git add scripts/build-summary.js
git commit -m "chore(build): sync extension list in build-summary, add plugin setup hint"
```

---

## Task 10: Final commit and summary

**Step 1: Verify the full feature is working**

Run through Task 8 verification checklist one more time.

**Step 2: Check git log for clean commit history**

```bash
git log --oneline feature/vscode-extensions ^master | head -15
```

Expected: 7–9 clean, well-scoped commits.

**Step 3: Run unit tests to confirm no regressions**

```bash
npm run test:unit 2>&1 | grep -E "passing|failing" | head -5
```

Expected: same test results as baseline (pre-existing failures only, no new failures).

**Step 4: Summary of what was built**

- `browser-app/webpack.config.js` — filesystem cache (warm builds ~5–10x faster)
- `scripts/clean-build.js` — full rebuild from scratch including cache deletion
- `scripts/download-plugins.js` — downloads curated `.vsix` files from Open VSX
- `browser-app/package.json` — added `plugin-ext`, `plugin-ext-vscode`, `vsx-registry`
- `plugins/builtin.json` — curated list of 5 pre-bundled extensions
- `.theia/extensions.json` — 4 recommended extensions shown in sidebar
- `package.json` — `build:clean`, `setup:plugins`, `setup:plugins:check` scripts
- Extensions sidebar live at `Ctrl+Shift+X` with Open VSX marketplace search

---

## Notes

### If `vscode.git` is not on Open VSX

The `vscode.git` extension is a VS Code built-in and may not be available on Open VSX. If `download-plugins.js` reports an error for it, remove it from `builtin.json`. Git integration in Theia comes from `@theia/scm` (already included) — a separate Git extension adds the Source Control view enrichment. Replace with `mhutchie.git-graph` (available on Open VSX) if a visual Git history view is desired.

### If marketplace search returns no results

Check that the backend can reach `open-vsx.org`. In development: `curl https://open-vsx.org/api/redhat/vscode-yaml` should return JSON. If the backend is behind a proxy, set `HTTPS_PROXY` env var before starting.

### Electron app (deferred)

`electron-app/package.json` is still a stub. To add extensions to Electron later:
1. Add the same three packages
2. Add `@theia/plugin-ext` electron backend module to `electron-app/src-gen`
3. Run `theia rebuild:electron` instead of `rebuild:browser`
4. Use `--plugins=local-dir:../plugins/builtin` in the Electron start command
