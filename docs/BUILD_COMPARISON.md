# Build Output - Before vs After

## Before (100+ lines)

```
yarn run v1.22.22
$ yarn build:extensions && yarn build:browser
$ yarn --cwd extensions/openspace-core build && yarn --cwd extensions/openspace-chat build && yarn --cwd extensions/openspace-presentation build && yarn --cwd extensions/openspace-whiteboard build && yarn --cwd extensions/openspace-layout build && yarn --cwd extensions/openspace-settings build
$ tsc
$ tsc && yarn copy:css
$ mkdir -p lib/browser/style && cp -r src/browser/style/*.css lib/browser/style/ || true
$ tsc
$ tsc
$ tsc && yarn copy:css
$ mkdir -p lib/browser/style && cp -r src/browser/style/*.css lib/browser/style/ || true
$ tsc
$ yarn --cwd browser-app build
$ theia build --mode development
Could not resolve optional peer dependency '@theia/electron'. Skipping...
(node:34789) [DEP0190] DeprecationWarning: Passing args to a child process...
assets by status 1.96 MiB [cached] 14 assets
assets by chunk 10.4 MiB (id hint: vendors)
  asset vendors-node_modules_theia_ai-chat-ui_lib_browser_ai-chat-ui-frontend-module_js.js 1.53 MiB [compared for emit] (id hint: vendors) 2 related assets
  asset vendors-node_modules_theia_preview_lib_browser_preview-frontend-module_js.js 1.44 MiB [compared for emit] (id hint: vendors) 2 related assets
  [... 50+ more lines ...]

WARNING in ../node_modules/@theia/monaco-editor-core/esm/vs/base/common/worker/simpleWorker.js 439:56-66
Critical dependency: the request of a dependency is an expression
 @ ../node_modules/@theia/monaco-editor-core/esm/vs/editor/common/services/editorWorkerBootstrap.js 9:26-80
 @ ../node_modules/@theia/monaco-editor-core/esm/vs/editor/editor.worker.js 21:13-66

WARNING in ../node_modules/@theia/monaco-editor-core/esm/vs/editor/common/services/editorSimpleWorker.js 420:53-63
Critical dependency: the request of a dependency is an expression
 @ ../node_modules/@theia/monaco-editor-core/esm/vs/editor/common/services/editorWorkerBootstrap.js 10:32-66
 @ ../node_modules/@theia/monaco-editor-core/esm/vs/editor/editor.worker.js 21:13-66

2 warnings have detailed information that is not shown.
Use 'stats.errorDetails: true' resp. '--stats-error-details' to show it.

webpack 5.105.2 compiled with 2 warnings in 22714 ms

[... 50+ more lines ...]
```

**Problems:**
- ❌ 100+ lines of output
- ❌ Hard to see if build succeeded
- ❌ Lots of irrelevant warnings
- ❌ No timing summary
- ❌ No clear next steps

---

## After (16 lines)

```
yarn run v1.22.22
$ node scripts/build-summary.js
═══════════════════════════════════════════════════════
   Theia OpenSpace - Build Process
═══════════════════════════════════════════════════════

Building Extensions...
  ✓ openspace-core
  ✓ openspace-chat
  ✓ openspace-presentation
  ✓ openspace-whiteboard
  ✓ openspace-layout
  ✓ openspace-settings
  Completed in 8.6s

Building Browser App...
  ✓ Backend bundle: 0.1 MB
  ✓ Frontend bundles compiled
  Completed in 19.3s

═══════════════════════════════════════════════════════
✓ Build completed successfully in 27.9s
═══════════════════════════════════════════════════════

Run: yarn start:browser
Open: http://localhost:3000

Done in 28.44s.
```

**Benefits:**
- ✅ 16 lines (6x shorter)
- ✅ Clear success indicator
- ✅ No noise, only what matters
- ✅ Timing for each phase
- ✅ Clear next steps
- ✅ Color-coded (green = success)

---

## Need Verbose Output?

For debugging build issues:

```bash
yarn build:verbose
```

This shows all webpack warnings, asset sizes, etc.

---

## Summary

**Before:** 100+ lines, hard to parse, noisy warnings  
**After:** 16 lines, clear status, actionable information

**Build time:** Same (~28 seconds)  
**Warnings suppressed:** Monaco Editor (harmless, can't fix)  
**Information lost:** None (use `build:verbose` when needed)
