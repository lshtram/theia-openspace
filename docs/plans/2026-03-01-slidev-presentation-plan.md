# Slidev Presentation System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the reveal.js presentation system with Slidev using SPA builds, named layouts, and semantic Vue components so the AI agent produces polished presentations without writing freeform HTML/CSS.

**Architecture:** Agent writes `.slides.md` → `SlidevBuildService` runs `slidev build` → static SPA served at `/slidev-spa/{deckId}/` → `SlidevViewerWidget` embeds in iframe.

**Tech Stack:** Slidev (`@slidev/cli`), Vue 3 (theme layouts/components), Express (static serving), Theia extension APIs (widget, commands, DI).

**Design Doc:** `docs/plans/2026-03-01-slidev-presentation-design.md`

---

## Phase 1: Foundation — Extension Scaffold + Build Service

### Task 1: Create `openspace-slidev` extension scaffold

**Files:**
- Create: `extensions/openspace-slidev/package.json`
- Create: `extensions/openspace-slidev/tsconfig.json`
- Create: `extensions/openspace-slidev/src/common/slidev-protocol.ts`
- Create: `extensions/openspace-slidev/src/browser/openspace-slidev-frontend-module.ts`
- Create: `extensions/openspace-slidev/src/node/openspace-slidev-backend-module.ts`
- Modify: `browser-app/package.json` (add dependency)

**Step 1: Create package.json**

```json
{
  "name": "openspace-slidev",
  "version": "0.1.0",
  "license": "MIT",
  "theiaExtensions": [
    {
      "frontend": "lib/browser/openspace-slidev-frontend-module",
      "backend": "lib/node/openspace-slidev-backend-module"
    }
  ],
  "dependencies": {
    "@theia/core": "1.68.2",
    "@theia/filesystem": "1.68.2",
    "@theia/workspace": "1.68.2",
    "openspace-core": "0.1.0"
  },
  "devDependencies": {
    "rimraf": "^5.0.0",
    "typescript": "~5.4.5"
  },
  "scripts": {
    "build": "tsc && mkdir -p lib/browser/style && cp src/browser/style/*.css lib/browser/style/ 2>/dev/null || true",
    "clean": "rimraf lib tsconfig.tsbuildinfo",
    "watch": "tsc --watch"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../configs/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": "src",
    "composite": true,
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.Fragment"
  },
  "include": ["src"],
  "exclude": ["lib", "node_modules"]
}
```

**Step 3: Create `slidev-protocol.ts` — shared types**

```typescript
export const SlidevBuildServicePath = '/services/slidev-build';

export interface SlidevBuildResult {
  deckId: string;
  url: string;
  slideCount: number;
  buildTimeMs: number;
  cached: boolean;
}

export interface SlidevBuildRequest {
  sourcePath: string;
  deckId?: string;
}

export interface SlideData {
  index: number;
  content: string;
  layout?: string;
}

export interface SlidevDeckData {
  title: string;
  theme: string;
  palette?: string;
  slides: SlideData[];
}

export const SlidevBuildService = Symbol('SlidevBuildService');
export interface SlidevBuildService {
  build(request: SlidevBuildRequest): Promise<SlidevBuildResult>;
  isBootstrapped(): Promise<boolean>;
  bootstrap(): Promise<void>;
  parseSlides(content: string): SlidevDeckData;
  getCachedBuild(deckId: string): SlidevBuildResult | undefined;
  invalidateCache(deckId: string): void;
}
```

**Step 4: Create minimal frontend module**

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
export default new ContainerModule(bind => {});
```

**Step 5: Create minimal backend module**

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
export default new ContainerModule(bind => {});
```

**Step 6: Add to browser-app/package.json dependencies**

Add `"openspace-slidev": "0.1.0"`.

**Step 7: Verify scaffold compiles**

Run: `yarn --cwd extensions/openspace-slidev build`
Expected: Compiles with no errors.

**Step 8: Commit**

```bash
git add extensions/openspace-slidev/ browser-app/package.json
git commit -m "feat(slidev): scaffold openspace-slidev extension with protocol types"
```

---

### Task 2: Create Slidev workspace template (theme + package.json)

**Files:**
- Create: `extensions/openspace-slidev/resources/slidev-workspace/package.json`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/.gitignore`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/package.json`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/styles/index.css`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/setup/main.ts`

**Step 1: Create workspace package.json**

```json
{
  "name": "openspace-slidev-workspace",
  "private": true,
  "scripts": {
    "build": "slidev build slides.md"
  },
  "dependencies": {
    "@slidev/cli": "^51.0.0",
    "@slidev/theme-default": "latest"
  }
}
```

**Step 2: Create .gitignore**

```
node_modules/
.slidev-builds/
dist/
slides.md
```

**Step 3: Create theme package.json**

```json
{
  "name": "slidev-theme-openspace",
  "version": "0.1.0",
  "slidev": {
    "colorSchema": "both",
    "defaults": {
      "fonts": {
        "sans": "Inter",
        "mono": "Fira Code"
      }
    }
  }
}
```

**Step 4: Create base theme styles (index.css)**

CSS custom properties for all 4 palettes (`midnight-tech`, `ocean`, `slate-pro`, `light-pro`) using `[data-palette="X"]` selectors. Base `.slidev-layout` styling for typography, code blocks, lists.

See design doc §6 for color values.

**Step 5: Create theme setup/main.ts**

Reads `palette` from frontmatter config and sets `data-palette` attribute on `<html>`.

**Step 6: Commit**

```bash
git add extensions/openspace-slidev/resources/
git commit -m "feat(slidev): add Slidev workspace template with theme base styles and palettes"
```

---

### Task 3: Create starter layout Vue files (title, default, two-cols, section)

**Files:**
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/title.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/default.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/two-cols.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/section.vue`

Each layout is a Vue SFC with:
- `<template>` using `<slot />` and named slots (`<slot name="right" />`)
- `<style scoped>` using CSS custom properties only
- Layout-specific structural CSS (flexbox, grid)

See design doc §4.1–4.4 for slot names and constraints.

**Step 1–4: Create each layout file**

**Step 5: Commit**

```bash
git add extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/
git commit -m "feat(slidev): add title, default, two-cols, and section layouts"
```

---

### Task 4: Create remaining layout Vue files

**Files:**
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/code-walk.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/stat-grid.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/comparison.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/architecture.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/timeline.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/decision.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/quote.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/closing.vue`

See design doc §4.5–4.12 for each layout's slot names and constraints.

**Step 1–8: Create each layout file**

**Step 9: Commit**

```bash
git add extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/layouts/
git commit -m "feat(slidev): add remaining 8 layouts (code-walk through closing)"
```

---

### Task 5: Create Vue components

**Files:**
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/StatCard.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/Callout.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/CompareTable.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/ArchDiagram.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/Timeline.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/ProgressBar.vue`
- Create: `extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/CodeAnnotation.vue`

Each component uses Vue 3 `<script setup lang="ts">` with typed `defineProps`. See design doc §5 for prop definitions.

**Step 1–7: Create each component**

**Step 8: Commit**

```bash
git add extensions/openspace-slidev/resources/slidev-workspace/themes/openspace/components/
git commit -m "feat(slidev): add 7 Vue components (StatCard, Callout, CompareTable, etc.)"
```

---

### Task 6: Implement `SlidevBuildService`

**Files:**
- Create: `extensions/openspace-slidev/src/node/slidev-build-service.ts`
- Create: `extensions/openspace-slidev/src/node/__tests__/slidev-build-service.test.ts`
- Modify: `extensions/openspace-slidev/src/node/openspace-slidev-backend-module.ts`

**Step 1: Write failing tests**

Test cases:
- `parseSlides()` parses `.slides.md` with frontmatter and `---` separators
- `parseSlides()` extracts per-slide `layout:` from slide frontmatter
- `getDeckId()` derives sanitized ID from filename
- `build()` rejects if not bootstrapped
- `build()` returns cached result when hash matches
- `build()` invalidates cache on content change
- `isBootstrapped()` checks for `node_modules/@slidev/cli`

Run: `npx jest extensions/openspace-slidev/src/node/__tests__/slidev-build-service.test.ts`
Expected: All tests fail.

**Step 2: Implement SlidevBuildServiceImpl**

Key methods:
- `parseSlides(content)`: Split on `\n---\n`, parse global YAML frontmatter, parse per-slide frontmatter
- `bootstrap()`: Copy template from extension resources to `.openspace/slidev/`, run `npm install`
- `build(request)`: Hash content → check cache → copy to workspace → run `slidev build` → return result
- Cache: `Map<deckId, { hash, result }>` with SHA256 content hashing

**Step 3: Run tests**

Run: `npx jest extensions/openspace-slidev/src/node/__tests__/slidev-build-service.test.ts`
Expected: All tests pass.

**Step 4: Wire into backend module**

```typescript
bind(SlidevBuildService).to(SlidevBuildServiceImpl).inSingletonScope();
```

**Step 5: Commit**

```bash
git add extensions/openspace-slidev/src/
git commit -m "feat(slidev): implement SlidevBuildService with parse, build, and caching"
```

---

### Task 7: Implement `SlidevStaticContribution` (Express static route)

**Files:**
- Create: `extensions/openspace-slidev/src/node/slidev-static-contribution.ts`
- Modify: `extensions/openspace-slidev/src/node/openspace-slidev-backend-module.ts`

**Step 1: Create BackendApplicationContribution**

- `configure(app)`: Mount `express.static()` at `/slidev-spa` pointing to `.openspace/slidev/.slidev-builds/`
- Validate deckId path segments (alphanumeric + hyphens only)
- Ensure builds directory exists on startup

**Step 2: Register in backend module**

```typescript
bind(SlidevStaticContribution).toSelf().inSingletonScope();
bind(BackendApplicationContribution).toService(SlidevStaticContribution);
```

**Step 3: Commit**

```bash
git add extensions/openspace-slidev/src/node/
git commit -m "feat(slidev): add static Express route at /slidev-spa/ for built SPAs"
```

---

## Phase 2: Browser Widget + MCP Tools

### Task 8: Implement `SlidevViewerWidget`

**Files:**
- Create: `extensions/openspace-slidev/src/browser/slidev-viewer-widget.tsx`
- Create: `extensions/openspace-slidev/src/browser/style/slidev-viewer.css`
- Modify: `extensions/openspace-slidev/src/browser/openspace-slidev-frontend-module.ts`

**Step 1: Create widget**

Extends `ReactWidget`. Renders `<iframe src="/slidev-spa/{deckId}/">` with:
- Building overlay state
- Navigation overlay (prev/next, slide counter) — appears on hover
- Fullscreen toggle
- `storeState()`/`restoreState()` for layout persistence
- `setDeck()`, `setBuilding()`, `navigateTo()` methods

**Step 2: Create CSS**

Styles for container, iframe (100% fill), navigation overlay, building spinner, empty state.

**Step 3: Wire into frontend module with WidgetFactory**

Follow existing `PresentationWidget` pattern: child container per widget instance.

**Step 4: Commit**

```bash
git add extensions/openspace-slidev/src/browser/
git commit -m "feat(slidev): implement SlidevViewerWidget with iframe and navigation overlay"
```

---

### Task 9: Implement commands, open handler, and viewer service

**Files:**
- Create: `extensions/openspace-slidev/src/browser/slidev-viewer-service.ts`
- Create: `extensions/openspace-slidev/src/browser/slidev-command-contribution.ts`
- Create: `extensions/openspace-slidev/src/browser/slidev-open-handler.ts`
- Modify: `extensions/openspace-slidev/src/browser/openspace-slidev-frontend-module.ts`

**Step 1: Create SlidevViewerService**

Manages active widget reference, coordinates build triggers with backend, handles navigation state.

**Step 2: Create command contribution**

Register command handlers that the MCP bridge calls:
- `openspace.slidev.open` — build + open widget
- `openspace.slidev.navigate` — prev/next/first/last/index
- `openspace.slidev.play/pause/stop` — autoplay via setInterval
- `openspace.slidev.toggleFullscreen` — Fullscreen API on iframe

**Step 3: Create open handler**

`canHandle(uri)` → true for `.slides.md` files. `open(uri)` → triggers build + widget.

**Step 4: Register in frontend module**

**Step 5: Commit**

```bash
git add extensions/openspace-slidev/src/browser/
git commit -m "feat(slidev): add commands, open handler, and viewer service"
```

---

### Task 10: Update MCP presentation tools for format detection

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp/presentation-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/__tests__/presentation-tools-slidev.test.ts`

**Step 1: Write failing tests**

- `create` generates `.slides.md` by default
- `list` returns both `.deck.md` and `.slides.md`
- `read` detects format by extension
- `update_slide` works with `.slides.md`
- `open` routes `.slides.md` to Slidev commands

**Step 2: Implement format detection**

Helper `isSlidevFormat(path)` routes to appropriate command IDs. `create` defaults to `.slides.md`. `list` globs both patterns. Storage directory: `design/slides/` for new format.

**Step 3: Run tests and verify**

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp/
git commit -m "feat(slidev): update MCP tools with format detection for .slides.md"
```

---

## Phase 3: Integration + Skill

### Task 11: Integration test — build + serve + render

**Step 1: Build extension**

```bash
yarn --cwd extensions/openspace-slidev build
```

**Step 2: Full Theia rebuild**

```bash
yarn --cwd browser-app run theia build --mode development && node browser-app/scripts/postbuild.js
```

**Step 3: Manual integration test**

1. Bootstrap: verify `.openspace/slidev/` created with `node_modules/`
2. Create test `.slides.md` → verify build produces SPA in `.slidev-builds/`
3. Verify `/slidev-spa/{deckId}/` serves the SPA
4. Open widget → verify iframe renders slides
5. Test navigation, each palette, each layout type

**Step 4: Fix issues**

**Step 5: Commit fixes**

---

### Task 12: Rewrite `presentation-builder` skill for Slidev

**Files:**
- Modify: `.opencode/skills/presentation-builder/SKILL.md`

**Content:**
1. Slidev markdown format reference
2. Layout vocabulary — which layout for each content type (table from design doc §11.1)
3. Slot syntax with examples for each layout
4. Character constraints per field
5. Component usage with prop examples
6. Palette selection guide
7. Anti-patterns (no CSS, no `<style>`, respect constraints)
8. Legacy `.deck.md` section at bottom

**Step 1: Write new skill**

**Step 2: Test by asking agent to generate a sample presentation**

**Step 3: Commit**

```bash
git add .opencode/skills/presentation-builder/
git commit -m "feat(slidev): rewrite presentation-builder skill for Slidev format"
```

---

### Task 13: Sample presentations and storage directory

**Files:**
- Create: `design/slides/example-architecture.slides.md`
- Create: `design/slides/example-metrics.slides.md`

2–3 sample presentations exercising different layouts and palettes.

**Step 1: Create samples**

**Step 2: Build and verify visual quality**

**Step 3: Commit**

```bash
git add design/slides/
git commit -m "feat(slidev): add sample presentations for testing and reference"
```

---

### Task 14: E2E tests

**Files:**
- Create: `tests/e2e/slidev-presentation-tools.spec.ts`

**Step 1: Write tests**

Follow existing `presentation-tools.spec.ts` patterns. Test:
- `create` → `.slides.md` file exists
- `open` → build completes, widget visible
- `navigate` → slide changes
- `list` → returns both formats
- `read` → parses correctly

**Step 2: Run incrementally (Rule 4)**

**Step 3: Fix failures**

**Step 4: Commit**

```bash
git add tests/e2e/
git commit -m "test(slidev): add E2E tests for Slidev presentation tools"
```

---

## Phase 4: Polish

### Task 15: Gitignore + cleanup

**Files:**
- Modify: `.gitignore`

Add:
```
.openspace/slidev/node_modules/
.openspace/slidev/.slidev-builds/
.openspace/slidev/slides.md
```

**Commit**

---

### Task 16: Toolbar contribution

**Files:**
- Create: `extensions/openspace-slidev/src/browser/slidev-toolbar-contribution.ts`
- Modify: `extensions/openspace-slidev/src/browser/openspace-slidev-frontend-module.ts`

Add toolbar buttons: prev, next, play/pause, fullscreen, rebuild.

**Commit**

---

## Execution Notes

- **Build verification (Rule 6):** After browser extension changes, run full `theia build`.
- **E2E before push (Rule 5):** Required since this touches MCP tools and browser extensions.
- **Token economy (Rule 12):** Use `--reporter=dot` for test output.
- **Network required:** Task 11 needs network to install `@slidev/cli` dependencies.
- **Slidev version:** Verify current stable `@slidev/cli` version before Task 2. Pin exact version after testing.
