# Slidev Presentation System — Design Document

> **For Claude:** This is a design document, not an implementation plan. See the companion implementation plan for task-by-task steps.

**Goal:** Replace the current reveal.js presentation system with Slidev, using named layouts and semantic Vue components so the AI agent produces polished presentations without writing freeform HTML/CSS.

**Architecture:** Agent writes `.slides.md` → `SlidevBuildService` runs `slidev build` to produce a static SPA → Theia serves it at `/slidev-spa/{deckId}/` → `SlidevViewerWidget` embeds it in an iframe.

**Decisions:**
- **SPA build, not dev server** — eliminates Vite CVE surface, ~300MB/instance memory, port management, process lifecycle complexity
- **Shared Slidev workspace** at `.openspace/slidev/` — single location for CLI, theme, components
- **Coexistence** with legacy `.deck.md` / reveal.js system

---

## 1. Problem Statement

The current reveal.js system requires the agent to write freeform HTML/CSS per slide. This produces inconsistent visual quality because LLMs don't reliably generate good CSS. Research of OSS AI presentation tools (Presenton, LangChat Slides, Slidev, Gamma) shows the solution: **named layouts + typed data fields** so design quality is handled by the template system.

## 2. Architecture Overview

```
Agent (MCP tools)
  │
  ├─ presentation.create  ──→  writes .slides.md to design/slides/{name}.slides.md
  ├─ presentation.update_slide ──→ edits slide content in .slides.md
  ├─ presentation.open    ──→  triggers build + opens viewer widget
  │
  ▼
SlidevBuildService (Node backend)
  │
  ├─ Copies .slides.md into .openspace/slidev/slides.md
  ├─ Runs: npx @slidev/cli build --out .slidev-builds/{deckId}/
  ├─ Build produces static SPA (HTML + JS + CSS)
  │
  ▼
Express static route: /slidev-spa/{deckId}/
  │
  ▼
SlidevViewerWidget (Theia browser widget)
  └─ <iframe src="http://localhost:3000/slidev-spa/{deckId}/" />
```

### 2.1 Key Components

| Component | Location | Responsibility |
|-----------|----------|---------------|
| `SlidevBuildService` | `openspace-slidev/src/node/` | Build orchestration, file management, build caching |
| `SlidevViewerWidget` | `openspace-slidev/src/browser/` | ReactWidget with iframe, navigation overlay, toolbar |
| `SlidevStaticContribution` | `openspace-slidev/src/node/` | `BackendApplicationContribution` mounting `/slidev-spa` Express route |
| `openspace-slidev-theme` | `.openspace/slidev/themes/openspace/` | Custom Slidev theme with layouts + components |
| `presentation-tools.ts` | `openspace-core/src/node/hub-mcp/` | Updated MCP tool handlers (same 10 signatures) |
| `presentation-builder` skill | `.opencode/skills/presentation-builder/` | Rewritten agent instructions for Slidev format |

### 2.2 Why SPA Build, Not Dev Server

The original design proposed spawning a Vite dev server per presentation. Critical review revealed:

| Concern | Dev Server | SPA Build (chosen) |
|---------|-----------|-------------------|
| Security | Vite has repeated CVEs (file read, path traversal) | Zero attack surface |
| Memory | ~200–330 MB per instance | ~0 (no running process) |
| Port management | Complex (auto-increment, no strict-port CLI) | None (uses Theia's port 3000) |
| Process lifecycle | New infrastructure needed | One-shot build, no process to manage |
| Multiple presentations | 1 GB+ for 3 decks | Negligible (static files) |
| Layout restore on IDE restart | Must re-spawn server | Just re-serve cached files |
| Edit feedback latency | Sub-second HMR | ~3–5s rebuild |

The latency tradeoff is acceptable because presentations are **agent-to-user** (agent generates, user views — no iterative editing loop). The agent calls `update_slide` then `open`; a 3–5 second build is invisible compared to the LLM generation time.

## 3. File Format: `.slides.md`

Uses Slidev's native markdown format. Each slide has per-slide YAML frontmatter.

```markdown
---
theme: openspace
colorSchema: dark
palette: midnight-tech
title: System Architecture Review
---

# System Architecture Review

Q3 2026 Technical Deep-Dive

---
layout: stat-grid
---

::stats::

- label: "Uptime"
  value: "99.97%"
  trend: "up"
- label: "P95 Latency"
  value: "42ms"
  trend: "down"
- label: "Throughput"
  value: "12.4k rps"
  trend: "up"
- label: "Error Rate"
  value: "0.03%"
  trend: "stable"

---
layout: two-cols
---

# API Gateway

The gateway handles routing and auth.

::right::

```typescript
app.use('/api', authMiddleware);
app.use('/api/v2', rateLimiter);
```

---
layout: architecture
---

::nodes::

- id: api
  label: "API Gateway"
  icon: "mdi/server"
- id: cache
  label: "Redis Cache"
  icon: "mdi/database"
- id: db
  label: "PostgreSQL"
  icon: "mdi/database"

::edges::

- from: api
  to: cache
  label: "lookup"
- from: api
  to: db
  label: "query"
```

### 3.1 Global Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `theme` | `string` | Yes | Always `openspace` |
| `colorSchema` | `'dark' \| 'light'` | No | Default: `dark` |
| `palette` | `string` | No | One of: `midnight-tech`, `ocean`, `slate-pro`, `light-pro`. Default: `midnight-tech` |
| `title` | `string` | Yes | Presentation title |

### 3.2 Per-Slide Frontmatter

Each slide after `---` can have a `layout:` field selecting a named layout.

## 4. Named Layouts (12)

Each layout defines which **slots** the agent fills. Slots use Slidev's `::name::` syntax — no CSS authoring.

### 4.1 `title`
Full-screen title slide with subtitle and optional branding.

**Slots:** default (title + subtitle text)

**Constraints:** Title ≤ 60 chars, subtitle ≤ 120 chars.

### 4.2 `section`
Section divider — large text, minimal decoration.

**Slots:** default

**Constraints:** Heading ≤ 40 chars, subtext ≤ 80 chars.

### 4.3 `default`
Standard content slide. Markdown body with bullets, paragraphs, code blocks.

**Slots:** default

**Constraints:** ≤ 6 bullet points, ≤ 80 chars per bullet.

### 4.4 `two-cols`
Two-column layout. Left and right content.

**Slots:** default (left), `::right::` (right)

**Constraints:** Each column ≤ 5 bullets or 1 code block.

### 4.5 `code-walk`
Code on one side, annotations on the other. Supports Shiki Magic Move for animated transitions.

**Slots:** default (explanation), `::code::` (code block)

**Constraints:** Code ≤ 25 lines, explanation ≤ 4 bullets.

### 4.6 `stat-grid`
2x2 or 1x4 grid of metric cards.

**Slots:** `::stats::` (YAML array of `{ label, value, trend? }`)

**Constraints:** 3–4 stats, label ≤ 20 chars, value ≤ 10 chars.

### 4.7 `comparison`
Side-by-side comparison of two options/approaches.

**Slots:** `::left::` (option A), `::right::` (option B), `::verdict::` (optional conclusion)

**Constraints:** Each side ≤ 5 bullet points, verdict ≤ 100 chars.

### 4.8 `architecture`
Node-and-edge architecture diagram rendered as styled HTML (not Mermaid).

**Slots:** `::nodes::` (YAML array of `{ id, label, icon? }`), `::edges::` (YAML array of `{ from, to, label? }`)

**Constraints:** ≤ 8 nodes, ≤ 12 edges.

### 4.9 `timeline`
Horizontal or vertical timeline of events/milestones.

**Slots:** `::events::` (YAML array of `{ date, title, description? }`)

**Constraints:** 3–6 events, title ≤ 30 chars, description ≤ 80 chars.

### 4.10 `decision`
Decision matrix — options with scored criteria.

**Slots:** `::options::` (YAML array of `{ name, scores: { criterion: rating } }`), `::recommendation::` (text)

**Constraints:** 2–4 options, 3–5 criteria.

### 4.11 `quote`
Large quotation with attribution.

**Slots:** default (quote text + attribution)

**Constraints:** Quote ≤ 200 chars, attribution ≤ 60 chars.

### 4.12 `closing`
End slide with summary and optional call-to-action.

**Slots:** default

**Constraints:** ≤ 3 bullet points.

## 5. Vue Components

Available inside any layout for richer content.

| Component | Props | Usage |
|-----------|-------|-------|
| `<StatCard>` | `label`, `value`, `trend?`, `icon?` | Single metric display |
| `<Callout>` | `type: 'info' \| 'warning' \| 'success' \| 'tip'`, `title?` | Highlighted callout box |
| `<CodeAnnotation>` | `line`, `text` | Inline code annotation marker |
| `<Timeline>` | `events: Array<{date, title, description?}>` | Vertical timeline |
| `<CompareTable>` | `headers`, `rows` | Styled comparison table |
| `<ArchDiagram>` | `nodes`, `edges` | Architecture node-edge diagram |
| `<ProgressBar>` | `value`, `max`, `label` | Horizontal progress indicator |

## 6. Color Palettes

The agent selects a palette by name in frontmatter. The theme maps it to CSS custom properties.

| Palette | Use Case | Background | Accent | Text |
|---------|----------|------------|--------|------|
| `midnight-tech` | Technical/architecture | Deep navy | Electric blue | White |
| `ocean` | Data/metrics | Dark teal | Cyan | Light gray |
| `slate-pro` | Business/decisions | Charcoal | Orange | Off-white |
| `light-pro` | Documentation/tutorials | White | Indigo | Dark gray |

## 7. Custom Theme Structure

```
.openspace/slidev/themes/openspace/
├── package.json          # { "name": "slidev-theme-openspace", "slidev": { ... } }
├── layouts/
│   ├── title.vue
│   ├── section.vue
│   ├── default.vue
│   ├── two-cols.vue
│   ├── code-walk.vue
│   ├── stat-grid.vue
│   ├── comparison.vue
│   ├── architecture.vue
│   ├── timeline.vue
│   ├── decision.vue
│   ├── quote.vue
│   └── closing.vue
├── components/
│   ├── StatCard.vue
│   ├── Callout.vue
│   ├── CodeAnnotation.vue
│   ├── Timeline.vue
│   ├── CompareTable.vue
│   ├── ArchDiagram.vue
│   └── ProgressBar.vue
├── styles/
│   ├── index.css          # Global styles, palette CSS vars
│   └── layouts.css        # Layout-specific base styles
└── setup/
    └── main.ts            # Font loading, global config
```

### 7.1 Theme Resolution

Slidev resolves themes by checking: built-in → theme → addons → local `layouts/`. We use a local path reference:

```yaml
# In .openspace/slidev/package.json
{
  "slidev": {
    "theme": "./themes/openspace"
  }
}
```

Or in frontmatter:
```yaml
theme: ./themes/openspace
```

This avoids any npm install/publish step for the theme.

## 8. Build Pipeline

### 8.1 Shared Slidev Workspace

```
.openspace/slidev/
├── package.json          # @slidev/cli, theme deps
├── node_modules/         # Pre-installed (via postinstall or first-run)
├── themes/openspace/     # Custom theme (see §7)
├── slides.md             # Symlink or copy of active .slides.md
└── .slidev-builds/       # Build output directory
    ├── {deckId-1}/       # Static SPA for deck 1
    │   ├── index.html
    │   ├── assets/
    │   └── ...
    └── {deckId-2}/       # Static SPA for deck 2
```

### 8.2 Build Process

1. Agent calls `presentation.create` or `presentation.update_slide`
2. `.slides.md` file is written to `design/slides/{name}.slides.md`
3. Agent calls `presentation.open`
4. `SlidevBuildService`:
   a. Copies `{name}.slides.md` → `.openspace/slidev/slides.md`
   b. Computes `deckId` from filename (e.g., `system-architecture-review`)
   c. Checks if `.slidev-builds/{deckId}/` exists and is newer than source → skip build (cache hit)
   d. Runs: `npx @slidev/cli build --out .slidev-builds/{deckId}/ --base /slidev-spa/{deckId}/`
   e. Waits for build to complete (typically 3–5 seconds)
   f. Returns URL: `http://localhost:3000/slidev-spa/{deckId}/`
5. `SlidevViewerWidget` opens with iframe pointing to that URL

### 8.3 Build Caching

- **Cache key:** SHA256 of `.slides.md` content stored in `.slidev-builds/{deckId}/.build-hash`
- **Cache hit:** If hash matches, skip build entirely — iframe loads immediately
- **Cache invalidation:** On `update_slide`, re-hash and rebuild if changed
- **Cleanup:** Evict builds older than 24 hours on IDE startup

### 8.4 First-Run Bootstrap

On first `presentation.create` or `presentation.open`, if `.openspace/slidev/node_modules/` doesn't exist:

1. Check `node` and `npm` are available (fail with clear error if not)
2. Run `npm install` in `.openspace/slidev/` (installs `@slidev/cli` + deps)
3. This is a one-time ~30 second operation
4. Subsequent builds use the installed packages

The `package.json` and theme files are **shipped with the extension** and copied to `.openspace/slidev/` on first use. This ensures the theme is always in sync with the extension version.

## 9. SlidevViewerWidget

### 9.1 Structure

```typescript
class SlidevViewerWidget extends ReactWidget {
  // State
  private deckId: string;
  private currentSlide: number = 0;
  private totalSlides: number = 0;
  private isBuilding: boolean = false;

  render(): React.ReactNode {
    if (this.isBuilding) {
      return <BuildingOverlay deckId={this.deckId} />;
    }
    return (
      <div className="slidev-viewer-container">
        <iframe
          ref={this.iframeRef}
          src={`/slidev-spa/${this.deckId}/`}
          sandbox="allow-scripts allow-same-origin"
          className="slidev-viewer-iframe"
        />
        <NavigationOverlay
          current={this.currentSlide}
          total={this.totalSlides}
          onNavigate={this.handleNavigate}
        />
      </div>
    );
  }
}
```

### 9.2 Navigation

Slidev SPAs support URL hash navigation: `#/1`, `#/2`, etc. The widget controls navigation by updating the iframe's `src` hash or posting messages via `window.postMessage`.

### 9.3 Communication: Widget ↔ Slidev SPA

- **Widget → SPA:** Change `iframe.src` hash for navigation, or `postMessage` for custom commands
- **SPA → Widget:** Slidev emits page change events; a small injected script forwards them via `postMessage` to the parent. The `SlidevStaticContribution` injects this script into the SPA's `index.html` during build post-processing.
- **Slide count:** Parsed from the `.slides.md` source (count `---` separators) or extracted from the built SPA's route manifest.

### 9.4 Lifecycle

- `onAfterAttach()`: Load iframe with built SPA URL
- `onResize()`: iframe auto-resizes (CSS `width: 100%; height: 100%`)
- `onBeforeDetach()`: No process to kill (SPA is static)
- `storeState()`: Persist `{ deckId, currentSlide }`
- `restoreState()`: Reload iframe from cached build (instant if build exists)

## 10. MCP Tool Changes

Same 10 tool names and Zod schemas. Implementation changes only.

| Tool | Current Behavior | New Behavior |
|------|-----------------|--------------|
| `list` | List `.deck.md` files | List both `.deck.md` AND `.slides.md` files |
| `read` | Parse `.deck.md` format | Detect format by extension, parse accordingly |
| `create` | Write `.deck.md` | Write `.slides.md` (Slidev format) |
| `update_slide` | Edit slide in `.deck.md` | Edit slide in `.slides.md`, invalidate build cache |
| `open` | Open reveal.js widget | Trigger build if needed, open Slidev viewer widget |
| `navigate` | Call `Reveal.slide()` | Update iframe hash |
| `play/pause/stop` | Reveal.js autoplay | Slidev's built-in presenter mode or custom autoplay |
| `toggleFullscreen` | Widget fullscreen | iframe fullscreen via Fullscreen API |

### 10.1 Format Detection

Tools detect format by file extension:
- `.deck.md` → route to legacy `PresentationWidget` (reveal.js)
- `.slides.md` → route to new `SlidevViewerWidget`

The `create` tool always creates `.slides.md` (new format). Legacy `.deck.md` files remain readable.

## 11. Agent Instruction System (Skill)

The `presentation-builder` skill will be rewritten to teach the agent:

1. **Layout vocabulary** — which layout to pick for each content type
2. **Slot syntax** — how to fill `::name::` slots with content
3. **Character constraints** — per-field limits that prevent text overflow
4. **Component usage** — when and how to use Vue components
5. **Palette selection** — which palette fits which presentation context
6. **Anti-patterns** — never write raw CSS, never use `<style>` blocks, never exceed slot constraints

### 11.1 Layout Selection Guide (for skill)

| Content Type | Recommended Layout |
|-------------|-------------------|
| Opening / title | `title` |
| Section break | `section` |
| Bullet points / prose | `default` |
| Side-by-side content | `two-cols` |
| Code explanation | `code-walk` |
| Metrics / KPIs | `stat-grid` |
| Option comparison | `comparison` or `decision` |
| System diagram | `architecture` |
| Historical progression | `timeline` |
| Key quote / principle | `quote` |
| Wrap-up / next steps | `closing` |

## 12. Coexistence Strategy

| Aspect | Legacy (`.deck.md`) | New (`.slides.md`) |
|--------|--------------------|--------------------|
| Extension | `openspace-presentation` | `openspace-slidev` |
| Renderer | reveal.js (in-DOM) | Slidev SPA (iframe) |
| Storage | `design/deck/` | `design/slides/` |
| Theme | reveal.js CSS | Vue components + CSS vars |
| MCP tools | Same tool names | Format-detected routing |
| Skill | Legacy section in skill | Primary section in skill |

Legacy presentations continue to work. The agent defaults to `.slides.md` for new presentations. No migration of existing decks is planned.

## 13. Directory Structure (New Files)

```
extensions/openspace-slidev/
├── package.json
├── tsconfig.json
├── src/
│   ├── browser/
│   │   ├── slidev-viewer-widget.tsx
│   │   ├── slidev-viewer-service.ts
│   │   ├── slidev-command-contribution.ts
│   │   ├── slidev-open-handler.ts
│   │   ├── slidev-toolbar-contribution.ts
│   │   ├── openspace-slidev-frontend-module.ts
│   │   └── style/
│   │       └── slidev-viewer.css
│   ├── node/
│   │   ├── slidev-build-service.ts
│   │   ├── slidev-static-contribution.ts
│   │   └── openspace-slidev-backend-module.ts
│   └── common/
│       └── slidev-protocol.ts
└── resources/
    └── slidev-workspace/          # Template copied to .openspace/slidev/
        ├── package.json
        ├── themes/openspace/
        │   ├── package.json
        │   ├── layouts/*.vue
        │   ├── components/*.vue
        │   ├── styles/*.css
        │   └── setup/main.ts
        └── .gitignore

design/slides/                     # New slide storage (parallel to design/deck/)

.openspace/slidev/                 # Runtime workspace (gitignored)
├── node_modules/
├── slides.md                      # Working copy for builds
└── .slidev-builds/                # Built SPAs
```

## 14. Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | `SlidevBuildService` build/cache logic | Jest, mock `child_process` |
| Unit | `.slides.md` parser | Jest, fixtures |
| Unit | Format detection (`.deck.md` vs `.slides.md`) | Jest |
| Integration | Build pipeline end-to-end | Jest with real `@slidev/cli` (slow, CI only) |
| E2E | MCP tools → widget rendering | Playwright, existing E2E infrastructure |
| Visual | Layout rendering quality | Manual review of built SPAs |

## 15. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `@slidev/cli` breaking changes | Medium | Pin exact version, test on update |
| Build time > 5s for large decks | Medium | Build caching, incremental if possible |
| First-run `npm install` fails (network, perms) | Medium | Clear error message, manual install instructions |
| Slidev SPA CSP conflicts with Theia | Low | Test iframe sandbox settings, adjust if needed |
| `node`/`npm` not available on system | Medium | Check on first use, fail with actionable error |
| Theme component rendering differs from design | Low | Visual test suite, iterate on components |

## 16. Non-Goals

- Real-time collaborative editing of presentations
- PDF/PPTX export (Slidev supports this but not in scope)
- Migrating existing `.deck.md` presentations to `.slides.md`
- Speaker notes / presenter mode (can be added later)
- Image generation for slides (Presenton-style `__image_prompt__` fields)
</content>
</invoke>