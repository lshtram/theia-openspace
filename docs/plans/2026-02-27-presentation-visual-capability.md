# Presentation Visual Capability Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable full visual capability in the OpenSpace presentation system (syntax highlighting + Mermaid diagrams via reveal.js plugins), update the presentation-builder skill to document exactly what works, and rewrite the 5 typed demo decks to showcase every visual tool.

**Architecture:** Three phases in order — (1) enable reveal.js plugins in the widget + allow `<canvas>` and `<svg>` through DOMPurify + copy plugin JS assets, (2) update the skill to accurately describe working tools and add Chart.js CDN guidance, (3) rewrite the 5 demo decks to be visually rich showcases.

**Tech Stack:** reveal.js 5.2.1 (RevealHighlight, RevealNotes plugins already in node_modules), DOMPurify allowlist expansion, marked.js (already used), Chart.js via CDN `<script>` in slide HTML, existing local assets in `design/assets/`.

---

## Task 1: Enable RevealHighlight and RevealNotes plugins in the widget

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx:743-755`

**Context:**
The `initializeReveal()` method currently passes `plugins: []`. Both `RevealHighlight` and `RevealNotes` ship inside the already-installed `reveal.js` package and can be imported directly. `RevealHighlight` enables syntax highlighting on fenced code blocks. `RevealNotes` enables the speaker notes panel (press S).

**Step 1: Import the plugins at the top of the file**

In `extensions/openspace-presentation/src/browser/presentation-widget.tsx`, find the import block near line 30:

```typescript
import Reveal from 'reveal.js';
```

Add two imports directly below it:

```typescript
import RevealHighlight from 'reveal.js/plugin/highlight/highlight.esm.js';
import RevealNotes from 'reveal.js/plugin/notes/notes.esm.js';
```

**Step 2: Add plugins to the Reveal initialization**

Find the `plugins: [],` line (around line 754) inside `initializeReveal()` and change it to:

```typescript
plugins: [RevealHighlight, RevealNotes],
```

**Step 3: Copy the highlight CSS to reveal-themes/**

The highlight plugin needs a syntax-highlight stylesheet. Open `browser-app/webpack.config.js` and find the `CopyPlugin` `patterns` array. Add two new entries after the existing ones:

```javascript
{
    // RevealHighlight plugin CSS — monokai theme for code blocks
    from: path.resolve(__dirname, '../node_modules/reveal.js/plugin/highlight/monokai.css'),
    to: path.join(__dirname, 'lib/frontend/reveal-themes/highlight-monokai.css'),
},
{
    // RevealHighlight plugin CSS — zenburn theme (alternative)
    from: path.resolve(__dirname, '../node_modules/reveal.js/plugin/highlight/zenburn.css'),
    to: path.join(__dirname, 'lib/frontend/reveal-themes/highlight-zenburn.css'),
},
```

**Step 4: Inject the highlight CSS as a static link tag**

In `presentation-widget.tsx`, find the `injectRevealBaseCSS()` static method (around line 140). It already injects `reveal.css` and `reset.css` as `<link>` tags. Add a similar injection for the highlight CSS. Add after the existing link tag injections:

```typescript
// Inject highlight.js syntax theme for RevealHighlight plugin
const highlightHref = '/reveal-themes/highlight-monokai.css';
if (!document.querySelector(`link[href="${highlightHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = highlightHref;
    document.head.appendChild(link);
}
```

**Step 5: Expand the DOMPurify allowlist for highlight output**

The highlight plugin wraps code tokens in `<span class="hljs-*">` elements. DOMPurify currently only allows certain tags. Find the `DOMPurify.sanitize()` call (around line 387) and expand `ALLOWED_TAGS`:

Current:
```typescript
ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','a','img',
    'code','pre','em','strong','blockquote','br','hr','table','thead','tbody',
    'tr','th','td','span','div','sup','sub'],
```

Change to (add `svg`, `path`, `circle`, `line`, `rect`, `text`, `g`, `defs`, `use`, `canvas` for diagram/chart support):
```typescript
ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','a','img',
    'code','pre','em','strong','blockquote','br','hr','table','thead','tbody',
    'tr','th','td','span','div','sup','sub',
    'svg','path','circle','line','rect','polyline','polygon','text','g','defs','use','marker','animate',
    'canvas','script'],
```

Also expand `ALLOWED_ATTR` to add SVG/data attributes:
```typescript
ALLOWED_ATTR: ['href','src','alt','class','id','style',
    'viewBox','xmlns','width','height','fill','stroke','stroke-width','d','cx','cy','r',
    'x','y','x1','y1','x2','y2','points','transform','opacity','font-size','text-anchor',
    'data-id','data-line-numbers','data-trim','data-noescape','type','defer','async']
```

**Note on `<script>` in DOMPurify:** DOMPurify by default neutralizes `<script>` even if listed in ALLOWED_TAGS unless `FORCE_BODY` is set. For Chart.js CDN support, we need a different approach — see Task 2.

**Step 6: Build the presentation extension**

```bash
yarn --cwd extensions/openspace-presentation build
```

Expected: No TypeScript errors. The `lib/` folder updates.

**Step 7: Clear webpack cache and rebuild**

```bash
rm -rf browser-app/.webpack-cache
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

Expected: Webpack builds successfully. Verify highlight CSS was copied:
```bash
ls browser-app/lib/frontend/reveal-themes/highlight-monokai.css
```

**Step 8: Verify highlight plugin is in the bundle**

```bash
rg "RevealHighlight\|hljs\|highlight" browser-app/lib/frontend/vendors-node_modules_openspace-presentation_lib_browser_openspace-presentation-frontend-module_js.js | head -5
```

Expected: Lines containing highlight/hljs references.

**Step 9: Commit**

```bash
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx browser-app/webpack.config.js
git commit -m "feat(presentation): enable RevealHighlight and RevealNotes plugins"
```

---

## Task 2: Allow Chart.js CDN scripts via a script-injection escape hatch

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx` (writeSlidesDom area)

**Context:**
DOMPurify strips `<script>` tags for good reason. But Chart.js charts in slides require a CDN script load + a `<canvas>` element + inline `<script>` to initialize. We need a controlled escape hatch: extract `<script>` blocks from slide content before sanitization, validate they only reference allowed CDN origins, then re-inject them after DOMPurify.

**Step 1: Add a script extraction helper**

In `presentation-widget.tsx`, add a new static method near `extractSlideDirectives()`:

```typescript
/**
 * Extract <script> tags from slide HTML before DOMPurify sanitization.
 * Only scripts with src matching ALLOWED_SCRIPT_SRCS or inline scripts
 * referencing allowed globals (Chart, mermaid) are passed through.
 * Returns the cleaned HTML (scripts removed) and an array of script descriptors.
 */
private static readonly ALLOWED_SCRIPT_SRCS = [
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/mermaid',
];

static extractScripts(html: string): { cleanHtml: string; scripts: Array<{ src?: string; inline?: string }> } {
    const scripts: Array<{ src?: string; inline?: string }> = [];
    const cleanHtml = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attrs: string, body: string) => {
        const srcMatch = /\bsrc=["']([^"']*)["']/.exec(attrs);
        if (srcMatch) {
            const src = srcMatch[1];
            if (PresentationWidget.ALLOWED_SCRIPT_SRCS.some(allowed => src.startsWith(allowed))) {
                scripts.push({ src });
            }
        } else if (body.trim()) {
            // Inline script — allow only if it references Chart or mermaid
            if (/\b(Chart|mermaid)\b/.test(body)) {
                scripts.push({ inline: body });
            }
        }
        return '';
    });
    return { cleanHtml, scripts };
}
```

**Step 2: Wire the script extractor into writeSlidesDom**

In `writeSlidesDom()`, find the per-slide processing loop (around line 380). The current flow is:

```
rawContent → extractSlideDirectives → marked.parse → DOMPurify.sanitize → <section>
```

Change to:

```
rawContent → extractSlideDirectives → marked.parse → extractScripts → DOMPurify.sanitize → <section> + re-inject scripts
```

Specifically, after `const renderedHtml = marked.parse(...)`:

```typescript
const { cleanHtml: scriptlessHtml, scripts } = PresentationWidget.extractScripts(renderedHtml);
const sanitized = DOMPurify.sanitize(scriptlessHtml, { ... });

// Re-inject allowed scripts after the sanitized content
let scriptTags = '';
for (const s of scripts) {
    if (s.src) {
        scriptTags += `<script src="${s.src}"></script>`;
    } else if (s.inline) {
        scriptTags += `<script>${s.inline}</script>`;
    }
}
return `<section${notesAttr}${directives}>${sanitized}${scriptTags}</section>`;
```

**Step 3: Build and rebuild**

```bash
yarn --cwd extensions/openspace-presentation build
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

**Step 4: Verify extractScripts is in the bundle**

```bash
rg "extractScripts\|ALLOWED_SCRIPT_SRCS" browser-app/lib/frontend/vendors-node_modules_openspace-presentation_lib_browser_openspace-presentation-frontend-module_js.js | head -3
```

**Step 5: Commit**

```bash
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx
git commit -m "feat(presentation): allow Chart.js CDN scripts in slide content"
```

---

## Task 3: Also allow data-auto-animate and fragment directives via extractSlideDirectives

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx` (extractSlideDirectives)

**Context:**
Currently `extractSlideDirectives()` only passes through `data-background-*` and `data-notes` attributes. But `data-auto-animate`, `data-auto-animate-id`, `data-transition`, `data-visibility`, and `data-timing` are all legitimate reveal.js section attributes used in the existing demo decks. Check if they're already supported; if not, extend the allowlist regex.

**Step 1: Check the current allowedAttrRe**

In `presentation-widget.tsx`, find `extractSlideDirectives()` (around line 410). The current regex is:

```typescript
const allowedAttrRe = /\b(data-background-(?:image|opacity|color|video|size|position|repeat|transition|interactive)|data-notes)=["']([^"']*)["']/g;
```

**Step 2: Extend the allowlist**

Replace with:

```typescript
const allowedAttrRe = /\b(data-background-(?:image|opacity|color|gradient|video|size|position|repeat|transition|interactive)|data-notes|data-auto-animate(?:-id|-easing|-duration|-unmatched)?|data-transition(?:-speed)?|data-visibility|data-timing|data-state)=["']([^"']*)["']/g;
```

Also add boolean attributes (those without values like `data-auto-animate` standalone). After the while loop, add:

```typescript
// Handle boolean attributes (no value) like data-auto-animate
const boolAttrRe = /\b(data-auto-animate)\b(?!=)/g;
let boolMatch: RegExpExecArray | null;
while ((boolMatch = boolAttrRe.exec(attrs)) !== null) {
    directives += ` ${boolMatch[1]}`;
}
```

**Step 3: Build and verify**

```bash
yarn --cwd extensions/openspace-presentation build
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

**Step 4: Commit**

```bash
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx
git commit -m "fix(presentation): pass data-auto-animate and data-transition through slide directives"
```

---

## Task 4: Update the presentation-builder skill

**Files:**
- Modify: `.opencode/skills/presentation-builder/SKILL.md`

**Context:**
The skill currently documents Mermaid as a supported tool, but it has never actually worked (plugins were disabled). Now that RevealHighlight is enabled, syntax highlighting works. Mermaid is NOT enabled (no RevealMermaid plugin — that would require the mermaid npm package). The skill needs to:
1. Remove or caveat the Mermaid section (it does NOT work currently)
2. Add Chart.js CDN guidance with a working example
3. Add a clear "What Actually Works" summary at the top of the Visual-First section
4. Strengthen the "minimums" enforcement language
5. Add half-screen layout guidance (font sizes, max content per slide)
6. Update the template list to note which demos showcase each visual type

**Step 1: Rewrite the Visual-First Design section**

Replace the entire `### Visual-First Design` section with an updated version that:

- Opens with "What actually works" table:

| Visual type | How | Works today |
|---|---|---|
| Syntax-highlighted code | Fenced code blocks with language tag | ✅ |
| SVG diagrams | `<img src="design/assets/diagrams/foo.svg">` | ✅ |
| Background images | `data-background-image` directive | ✅ |
| HTML/CSS charts | Inline HTML with flexbox/position | ✅ |
| Chart.js charts | CDN `<script>` + `<canvas>` | ✅ (via CDN) |
| Mermaid diagrams | `mermaid` fenced block | ❌ (plugin not enabled) |

- Updates Minimums to: "Every deck MUST have at least 3 visuals: 1 background image, 1 diagram or chart, 1 syntax-highlighted code block."
- Adds Chart.js example (see Task 5 for the working pattern to document)
- Updates "Creating Diagrams" section to note Mermaid is not currently available
- Adds "Half-screen layout" subsection with guidance

**Half-screen layout guidance to add:**

```markdown
### Half-Screen Layout

Presentations run embedded in the IDE, often side-by-side with code. Design for ~50% screen width:

- **Max 6 bullet points per slide** — more than 6 causes overflow
- **Font sizes:** use `font-size: 0.75em` or smaller for supplementary text
- **Images:** `max-height: 40vh` on images to prevent overflow
- **Code blocks:** max 12 lines; use `font-size: 0.6em` on `<pre>` for dense code
- **Avoid fixed pixel heights** on layout containers — use `vh` or `%` instead
- **Test at 50% width** by splitting the IDE editor and presentation side-by-side
```

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/SKILL.md
git commit -m "docs(skill): update presentation-builder with accurate visual capability list"
```

---

## Task 5: Rewrite demo-architecture-modular.deck.md

**File:** `design/deck/demo-architecture-modular.deck.md`

**Existing state:** 742 lines, already has background images, tags, highlight boxes. Uses `data-auto-animate`. Good structure but code blocks lack language tags for highlighting, and no actual charts.

**Goal:** Showcase architecture diagram (SVG), syntax-highlighted code (TypeScript), HTML/CSS scatter chart.

**What to preserve:** Overall structure (monolith vs modular monolith narrative), existing images, tag system, the `<!-- .slide: data-background-image=... -->` patterns.

**What to improve:**
1. Add language tags to all fenced code blocks (they have none currently — just ` ``` ` without a language)
2. Add one Chart.js slide showing a quantitative comparison (e.g., deploy time vs team size)
3. Ensure `design/assets/diagrams/modular-monolith-architecture.svg` is referenced in a split-layout slide
4. All slides must fit in half-screen: audit for text overflow, trim bullets to ≤6

**Step 1: Read the full current file**

Read `design/deck/demo-architecture-modular.deck.md` in full to understand all 742 lines before editing.

**Step 2: Add language tags to code blocks**

Find all ` ``` ` (backtick-triple without language) and add appropriate language tags (`typescript`, `bash`, `json`, etc.).

**Step 3: Add the SVG diagram slide**

Find the slide that discusses the modular architecture and add or replace with a split-layout slide:

```markdown
---

## Modular Architecture

<div style="display: flex; gap: 1.5em; align-items: center;">
  <div style="flex: 1; font-size: 0.8em;">
    <h3 style="font-size: 1em; color: var(--r-heading-color);">Modules as boundaries</h3>
    <ul>
      <li>Each module owns its domain</li>
      <li>No cross-module direct DB access</li>
      <li>Contracts enforced at compile time</li>
    </ul>
  </div>
  <div style="flex: 1;">
    <img src="design/assets/diagrams/modular-monolith-architecture.svg"
         style="width: 100%; max-height: 40vh; object-fit: contain; border-radius: 8px;">
  </div>
</div>
```

**Step 4: Add the Chart.js comparison slide**

Add a slide after the trade-off discussion:

```markdown
---

## The Numbers

<canvas id="arch-chart" style="max-height: 45vh;"></canvas>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById('arch-chart'), {
  type: 'bar',
  data: {
    labels: ['Monolith', 'Modular Mono', 'Microservices'],
    datasets: [
      { label: 'Deploy time (min)', data: [35, 35, 8], backgroundColor: ['#ef4444','#6366f1','#10b981'] },
      { label: 'Ops complexity (1-10)', data: [2, 3, 9], backgroundColor: ['#fca5a5','#a5b4fc','#6ee7b7'] }
    ]
  },
  options: { responsive: true, plugins: { legend: { labels: { color: '#e2e8f0' } } },
    scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
              y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } } } }
});
</script>
```

**Step 5: Build and visual check**

Open the deck in the IDE presentation panel and verify:
- Code blocks show syntax highlighting colors
- The SVG diagram loads
- The Chart.js bar chart renders
- No slide overflows at ~50% screen width

**Step 6: Commit**

```bash
git add design/deck/demo-architecture-modular.deck.md
git commit -m "feat(demo): add syntax highlighting, SVG diagram, and Chart.js to architecture demo"
```

---

## Task 6: Rewrite demo-concept-sse.deck.md

**File:** `design/deck/demo-concept-sse.deck.md`

**Existing state:** ~724 lines. Explains Server-Sent Events. Has background image (`sse-signal-hero.jpg`), HTML/CSS scatter chart (axis diagram), and sequence of protocol slides.

**Goal:** Showcase: sequence/flow diagram (SVG), syntax-highlighted code, the existing HTML/CSS axis chart (verify it fits), and one new Chart.js latency comparison.

**What to improve:**
1. Add language tags to all code blocks
2. Reference `design/assets/diagrams/sse-flow-diagram.svg` in a split-layout slide
3. Verify the axis chart (HTML/CSS) fits at half-screen width
4. Trim any slides with > 6 bullets

**Step 1: Read the full file**

Read `design/deck/demo-concept-sse.deck.md` in full.

**Step 2: Fix code blocks, add SVG diagram slide, trim overflow**

Follow the same pattern as Task 5.

**Step 3: Add language tags to all code blocks**

SSE code examples should use `javascript`, `typescript`, or `http` as language tags.

**Step 4: Commit**

```bash
git add design/deck/demo-concept-sse.deck.md
git commit -m "feat(demo): add syntax highlighting and SVG diagram to SSE concept demo"
```

---

## Task 7: Rewrite demo-tutorial-rate-limiter.deck.md

**File:** `design/deck/demo-tutorial-rate-limiter.deck.md`

**Existing state:** ~760 lines. Step-by-step tutorial building a rate limiter. Has `terminal-infra-hero.jpg` background. Heavy on code.

**Goal:** Showcase: step-by-step syntax-highlighted code with `[line-numbers]` progression, the rate-limiter flow SVG diagram, a Chart.js line chart showing token bucket replenishment over time.

**What to improve:**
1. Add language tags (TypeScript) to all code blocks — this is the most important one since it's code-heavy
2. Add `[1|2-5|6-10]` line highlight ranges to tutorial code blocks to guide the reader through steps
3. Reference `design/assets/diagrams/rate-limiter-flow.svg`
4. Add a Chart.js line chart for token bucket visualization

**Step 1: Read the full file**

Read `design/deck/demo-tutorial-rate-limiter.deck.md` in full.

**Step 2: Add language tags and line-number ranges to code blocks**

For tutorial code blocks with multi-step reveals, use:
```
```typescript [1-3|4-8|9-15]
```

**Step 3: Add the flow diagram**

Add a slide early in the tutorial:

```markdown
---

## The Rate Limiter

<div style="display: flex; gap: 1.5em; align-items: center;">
  <div style="flex: 1; font-size: 0.8em;">
    <p>Token bucket algorithm: tokens replenish at a fixed rate; requests consume tokens.</p>
  </div>
  <div style="flex: 1;">
    <img src="design/assets/diagrams/rate-limiter-flow.svg"
         style="width: 100%; max-height: 40vh; object-fit: contain;">
  </div>
</div>
```

**Step 4: Add Chart.js token bucket chart**

```markdown
---

## Token Replenishment

<canvas id="token-chart" style="max-height: 45vh;"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById('token-chart'), {
  type: 'line',
  data: {
    labels: ['0s','1s','2s','3s','4s','5s','6s'],
    datasets: [
      { label: 'Tokens', data: [10,8,6,10,9,7,10],
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', tension: 0.3 },
      { label: 'Requests', data: [0,2,2,0,1,2,0],
        borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)', tension: 0 }
    ]
  },
  options: { responsive: true,
    plugins: { legend: { labels: { color: '#e2e8f0' } } },
    scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
              y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } } } }
});
</script>
```

**Step 5: Commit**

```bash
git add design/deck/demo-tutorial-rate-limiter.deck.md
git commit -m "feat(demo): add syntax highlighting, line-numbers, SVG, and Chart.js to rate limiter tutorial"
```

---

## Task 8: Rewrite demo-options-vector-db.deck.md

**File:** `design/deck/demo-options-vector-db.deck.md`

**Existing state:** Options comparison between vector database choices. May have limited visuals currently.

**Goal:** Showcase: multi-option comparison cards, HTML/CSS scatter chart (already a good pattern in the skill), Chart.js radar chart for capability comparison, `design/assets/diagrams/vector-db-flow.svg`.

**Step 1: Read the full file**

Read `design/deck/demo-options-vector-db.deck.md` in full.

**Step 2: Add a Chart.js radar chart**

```markdown
---

## Capability Comparison

<canvas id="radar-chart" style="max-height: 45vh;"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById('radar-chart'), {
  type: 'radar',
  data: {
    labels: ['Query Speed','Scalability','Filtering','Ecosystem','Cost'],
    datasets: [
      { label: 'Pinecone', data: [9,9,7,8,5], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.2)' },
      { label: 'Weaviate', data: [7,8,9,7,8], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' },
      { label: 'pgvector', data: [6,6,8,9,10], borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.2)' }
    ]
  },
  options: { responsive: true,
    plugins: { legend: { labels: { color: '#e2e8f0' } } },
    scales: { r: { ticks: { color: '#94a3b8', backdropColor: 'transparent' },
                   grid: { color: '#334155' }, pointLabels: { color: '#e2e8f0' } } } }
});
</script>
```

**Step 3: Add SVG diagram slide**

Reference `design/assets/diagrams/vector-db-flow.svg`.

**Step 4: Add language tags to code blocks**

**Step 5: Commit**

```bash
git add design/deck/demo-options-vector-db.deck.md
git commit -m "feat(demo): add radar chart, SVG diagram, and syntax highlighting to vector DB options demo"
```

---

## Task 9: Rewrite demo-problem-stream-duplication.deck.md

**File:** `design/deck/demo-problem-stream-duplication.deck.md`

**Existing state:** Problem/solution narrative about SSE stream duplication. Has `incident-ops-hero.jpg` background. References `sse-duplication-fanout.svg`.

**Goal:** Showcase: incident/problem narrative with red/yellow/green status progression, the fanout SVG diagram, a Chart.js before/after metric chart, syntax-highlighted code diff.

**Step 1: Read the full file**

Read `design/deck/demo-problem-stream-duplication.deck.md` in full.

**Step 2: Add language tags to all code blocks**

**Step 3: Verify the SVG diagram reference is correct**

Check that `design/assets/diagrams/sse-duplication-fanout.svg` is used in a slide.

**Step 4: Add a before/after Chart.js bar chart**

```markdown
---

## Impact

<canvas id="impact-chart" style="max-height: 45vh;"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById('impact-chart'), {
  type: 'bar',
  data: {
    labels: ['CPU usage', 'Memory (MB)', 'Latency (ms)', 'Error rate (%)'],
    datasets: [
      { label: 'Before fix', data: [85, 420, 340, 12], backgroundColor: 'rgba(239,68,68,0.7)' },
      { label: 'After fix',  data: [22, 180, 45, 0.1], backgroundColor: 'rgba(16,185,129,0.7)' }
    ]
  },
  options: { responsive: true,
    plugins: { legend: { labels: { color: '#e2e8f0' } } },
    scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
              y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } } } }
});
</script>
```

**Step 5: Commit**

```bash
git add design/deck/demo-problem-stream-duplication.deck.md
git commit -m "feat(demo): add syntax highlighting, SVG, and impact chart to stream duplication problem demo"
```

---

## Task 10: Smoke-test all 5 demos in the IDE

**No file changes. Verification only.**

**Step 1: Check that Theia is running from the correct directory**

```bash
ps aux | grep main.js | grep -v grep
```

Note the serving directory. If it's a worktree, build there instead of repo root.

**Step 2: Hard-refresh the browser**

In the browser at `http://localhost:3000`, press `Cmd+Shift+R` (hard refresh).

**Step 3: Open each demo deck**

From the agent, call the MCP presentation tools or use the File Explorer to open each `.deck.md` file:
- `design/deck/demo-architecture-modular.deck.md`
- `design/deck/demo-concept-sse.deck.md`
- `design/deck/demo-tutorial-rate-limiter.deck.md`
- `design/deck/demo-options-vector-db.deck.md`
- `design/deck/demo-problem-stream-duplication.deck.md`

**Step 4: Verify for each deck**

For each deck, confirm:
- [ ] Syntax highlighting visible on code blocks (colored tokens, not monochrome)
- [ ] SVG diagram loads (not broken image icon)
- [ ] Chart.js chart renders (bar/line/radar, not blank canvas)
- [ ] No slide overflow at ~50% screen width (all content visible without scrolling)
- [ ] `data-auto-animate` transitions work (slides animate between auto-animate pairs)

**Step 5: Final commit if any last-minute fixes needed**

```bash
git add design/deck/
git commit -m "fix(demos): visual verification fixes after smoke test"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Enable RevealHighlight + RevealNotes plugins | presentation-widget.tsx, webpack.config.js |
| 2 | Chart.js CDN script injection escape hatch | presentation-widget.tsx |
| 3 | Extend slide directive allowlist (data-auto-animate etc.) | presentation-widget.tsx |
| 4 | Update presentation-builder skill | SKILL.md |
| 5 | Rewrite architecture demo | demo-architecture-modular.deck.md |
| 6 | Rewrite SSE concept demo | demo-concept-sse.deck.md |
| 7 | Rewrite rate limiter tutorial demo | demo-tutorial-rate-limiter.deck.md |
| 8 | Rewrite vector DB options demo | demo-options-vector-db.deck.md |
| 9 | Rewrite stream duplication problem demo | demo-problem-stream-duplication.deck.md |
| 10 | Smoke test all 5 demos in the IDE | — |
