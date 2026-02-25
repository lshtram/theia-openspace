---
title: Blueprint Systems
theme: black
transition: slide
---

<!-- .slide: data-background-gradient="linear-gradient(160deg, #0a0e1a 0%, #0d1b2e 100%)" -->

# Blueprint Systems

<div class="bp-rule"></div>

<div class="lead">

**A Technical Design Theme** — Precision. Structure. Clarity.

</div>

<div style="margin-top: 3em; font-family: 'Courier New', monospace; font-size: 0.75em; color: #7eb3d4; letter-spacing: 0.12em;">
THEME VERSION 1.0 &nbsp;///&nbsp; OPENSPACE DESIGN SYSTEM &nbsp;///&nbsp; 2026
</div>

---

<!-- blueprint grid overlay theme CSS -->

## Typography System

<h4 class="bp-label">// heading hierarchy</h4>

<h1>Heading 1 — System Title</h1>

<h2>Heading 2 — Section Header</h2>

<h3>Heading 3 — Subsection</h3>

<p class="lead">Lead paragraph — introductory text rendered at 1.25em with secondary color for emphasis and readability on dark backgrounds.</p>

<p>Body text — 28px base size, color <code>#e8f4fd</code>. Designed for dense technical documentation and architecture notes.</p>

> "Architecture is not about making systems complex — it is about making complexity manageable."

---

## Color System

<h4 class="bp-label">// design tokens</h4>

<div style="display: flex; gap: 1.5em; flex-wrap: wrap; margin-top: 1.5em;">
  <div style="text-align: center;">
    <div style="width: 90px; height: 90px; background: #0a0e1a; border-radius: 10px; border: 1px solid #1e2d4a;"></div>
    <p style="font-size: 0.7em; margin-top: 0.6em; font-family: 'Courier New', monospace; color: #7eb3d4;">Navy<br><span style="color: #e8f4fd;">#0a0e1a</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 90px; height: 90px; background: #1e2d4a; border-radius: 10px;"></div>
    <p style="font-size: 0.7em; margin-top: 0.6em; font-family: 'Courier New', monospace; color: #7eb3d4;">Grid<br><span style="color: #e8f4fd;">#1e2d4a</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 90px; height: 90px; background: #4fc3f7; border-radius: 10px; box-shadow: 0 0 16px rgba(79, 195, 247, 0.4);"></div>
    <p style="font-size: 0.7em; margin-top: 0.6em; font-family: 'Courier New', monospace; color: #7eb3d4;">Accent Blue<br><span style="color: #e8f4fd;">#4fc3f7</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 90px; height: 90px; background: #00e5ff; border-radius: 10px; box-shadow: 0 0 20px rgba(0, 229, 255, 0.5);"></div>
    <p style="font-size: 0.7em; margin-top: 0.6em; font-family: 'Courier New', monospace; color: #7eb3d4;">Highlight<br><span style="color: #e8f4fd;">#00e5ff</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 90px; height: 90px; background: #e8f4fd; border-radius: 10px;"></div>
    <p style="font-size: 0.7em; margin-top: 0.6em; font-family: 'Courier New', monospace; color: #7eb3d4;">Body Text<br><span style="color: #e8f4fd;">#e8f4fd</span></p>
  </div>
</div>

<div style="margin-top: 2em; padding: 1em 1.5em; border: 1px solid #1e2d4a; border-radius: 6px; background: rgba(30, 45, 74, 0.3); font-family: 'Courier New', monospace; font-size: 0.75em; color: #7eb3d4;">
  <span style="color: #4fc3f7;">gradient:</span> <span style="color: #e8f4fd;">linear-gradient(160deg, #0a0e1a 0%, #0d1b2e 100%)</span>
</div>

---

## Lists + Callouts

<h4 class="bp-label">// system design principles</h4>

<div style="display: flex; gap: 3em;">
<div style="flex: 1;">

- **Separation of concerns** — each module owns one responsibility
- **Fail-fast validation** — surface errors at the earliest boundary
- **Explicit contracts** — typed interfaces over runtime inference
- **Immutable state** — prefer pure functions and derived values
- **Observability first** — trace, log, and metric every system path

</div>
<div style="flex: 1;">

<div style="border: 1px solid #1e2d4a; border-left: 3px solid #4fc3f7; border-radius: 0 6px 6px 0; padding: 1.2em 1.5em; background: rgba(10, 14, 26, 0.8); font-size: 0.85em;">
  <div style="font-family: 'Courier New', monospace; font-size: 0.8em; color: #4fc3f7; letter-spacing: 0.1em; margin-bottom: 0.8em;">SPEC NOTE &nbsp;///&nbsp; v1.0</div>
  <p style="margin: 0; color: #e8f4fd; line-height: 1.6;">Blueprint themes are intended for <strong>systems documentation</strong>, architecture reviews, and technical deep-dives where visual noise would obscure the signal.</p>
  <p style="margin: 0.8em 0 0; font-family: 'Courier New', monospace; font-size: 0.8em; color: #7eb3d4;">ref: design/deck/theme-blueprint.deck.md</p>
</div>

</div>
</div>

---

## Code + Tables

<h4 class="bp-label">// interface definition</h4>

<div style="display: flex; gap: 2em; align-items: flex-start;">
<div style="flex: 1.4;">

```typescript
interface BlueprintTheme {
  name: string;
  version: string;
  palette: {
    navy: '#0a0e1a';
    grid: '#1e2d4a';
    accent: '#4fc3f7';
    highlight: '#00e5ff';
    text: '#e8f4fd';
  };
  fonts: {
    heading: string;  // monospaced stack
    body: string;     // system sans-serif
  };
}

function applyTheme(theme: BlueprintTheme): void {
  document.documentElement.style
    .setProperty('--bp-accent', theme.palette.accent);
}
```

</div>
<div style="flex: 1;">

| Token | Value | Role |
|-------|-------|------|
| `--bp-bg` | `#0a0e1a` | Canvas |
| `--bp-grid` | `#1e2d4a` | Borders |
| `--bp-accent` | `#4fc3f7` | Primary |
| `--bp-hi` | `#00e5ff` | Focus |
| `--bp-text` | `#e8f4fd` | Content |

</div>
</div>

<style>
/* ═══════════════════════════════════════════════════════════════
   BLUEPRINT SYSTEMS — Technical Design Theme
   Inspired by: engineering blueprints, systems documentation,
   precision technical diagrams, CAD design tools
   Purpose: Architecture reviews, systems design, technical docs
   ═══════════════════════════════════════════════════════════════ */

/* ── Color Tokens ───────────────────────────────────────────── */
:root {
  --bp-bg:       #0a0e1a;
  --bp-surface:  #0d1625;
  --bp-grid:     #1e2d4a;
  --bp-grid-2:   #152238;
  --bp-accent:   #4fc3f7;
  --bp-hi:       #00e5ff;
  --bp-text:     #e8f4fd;
  --bp-muted:    #7eb3d4;
  --bp-font-mono: 'Courier New', 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  --bp-font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Background + Grid Pattern ──────────────────────────────── */
.reveal {
  font-family: var(--bp-font-body);
  font-size: 26px;
  color: var(--bp-text);
  background: var(--bp-bg);
  background-image:
    radial-gradient(circle, rgba(30, 45, 74, 0.6) 1px, transparent 1px);
  background-size: 40px 40px;
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 50px 72px;
  height: 100%;
}

/* ── Headings — Monospaced/Technical ────────────────────────── */
.reveal h1 {
  font-family: var(--bp-font-mono);
  font-size: 3.2em;
  font-weight: 700;
  line-height: 1.05;
  margin-bottom: 0.25em;
  color: var(--bp-text);
  letter-spacing: -0.01em;
  text-shadow: 0 0 40px rgba(79, 195, 247, 0.15);
}

.reveal h2 {
  font-family: var(--bp-font-mono);
  font-size: 2em;
  font-weight: 600;
  color: var(--bp-text);
  margin-bottom: 0.3em;
  letter-spacing: 0.01em;
  border-bottom: 1px solid var(--bp-grid);
  padding-bottom: 0.3em;
}

.reveal h3 {
  font-family: var(--bp-font-mono);
  font-size: 1.3em;
  font-weight: 500;
  color: var(--bp-accent);
  margin-bottom: 0.4em;
  letter-spacing: 0.03em;
}

.reveal h4 {
  font-family: var(--bp-font-mono);
  font-size: 0.8em;
  font-weight: 400;
  color: var(--bp-muted);
  text-transform: lowercase;
  letter-spacing: 0.06em;
  margin-bottom: 1em;
}

/* ── Body Text ──────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--bp-text);
  margin-bottom: 1em;
}

.reveal .lead {
  font-size: 1.2em;
  color: var(--bp-muted);
  line-height: 1.6;
}

/* ── Inline Code ────────────────────────────────────────────── */
.reveal code {
  font-family: var(--bp-font-mono);
  font-size: 0.83em;
  background: rgba(30, 45, 74, 0.5);
  padding: 0.15em 0.5em;
  border-radius: 3px;
  color: var(--bp-accent);
  border: 1px solid rgba(79, 195, 247, 0.25);
}

/* ── Code Blocks ────────────────────────────────────────────── */
.reveal pre {
  background: rgba(13, 22, 37, 0.95);
  border: 1px solid var(--bp-grid);
  border-radius: 6px;
  padding: 1.4em;
  margin: 1.2em 0;
  box-shadow:
    0 2px 16px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(79, 195, 247, 0.06);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--bp-text);
  font-size: 0.88em;
  line-height: 1.65;
  border: none;
}

/* Syntax colours — blueprint palette */
.reveal .token.keyword  { color: #80cbc4; }
.reveal .token.type     { color: var(--bp-hi); }
.reveal .token.string   { color: #a5d6a7; }
.reveal .token.number   { color: #ffcc80; }
.reveal .token.function { color: var(--bp-accent); }
.reveal .token.comment  { color: var(--bp-muted); font-style: italic; }
.reveal .token.operator { color: #b0bec5; }

/* ── Lists ──────────────────────────────────────────────────── */
.reveal ul, .reveal ol {
  margin: 0 0 1.2em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 2em;
  margin-bottom: 0.65em;
  line-height: 1.55;
  color: var(--bp-text);
}

.reveal ul li::before {
  content: '//';
  position: absolute;
  left: 0;
  color: var(--bp-accent);
  font-family: var(--bp-font-mono);
  font-size: 0.8em;
  font-weight: 600;
  top: 0.15em;
}

.reveal ol {
  counter-reset: bp-counter;
}

.reveal ol li {
  counter-increment: bp-counter;
}

.reveal ol li::before {
  content: counter(bp-counter, decimal-leading-zero);
  position: absolute;
  left: 0;
  font-family: var(--bp-font-mono);
  font-size: 0.75em;
  font-weight: 600;
  color: var(--bp-accent);
  top: 0.2em;
  letter-spacing: 0;
}

.reveal ol li::after {
  display: none;
}

/* ── Blockquote ─────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.5em 0;
  padding: 1.2em 1.8em;
  background: rgba(30, 45, 74, 0.25);
  border-left: 3px solid var(--bp-accent);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: var(--bp-muted);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1.05em;
  line-height: 1.6;
}

/* ── Tables ─────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2em 0;
  font-size: 0.85em;
  font-family: var(--bp-font-mono);
}

.reveal th {
  background: rgba(30, 45, 74, 0.6);
  color: var(--bp-accent);
  font-weight: 600;
  text-align: left;
  padding: 0.9em 1.1em;
  border-bottom: 1px solid var(--bp-accent);
  text-transform: uppercase;
  font-size: 0.78em;
  letter-spacing: 0.1em;
}

.reveal td {
  padding: 0.8em 1.1em;
  border-bottom: 1px solid var(--bp-grid);
  color: var(--bp-text);
}

.reveal tr:hover td {
  background: rgba(30, 45, 74, 0.3);
}

/* ── Emphasis ───────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--bp-text);
}

.reveal em {
  font-style: italic;
  color: var(--bp-accent);
}

/* ── Blueprint Rule Divider ─────────────────────────────────── */
.bp-rule {
  height: 1px;
  background: linear-gradient(90deg, var(--bp-accent) 0%, transparent 80%);
  margin: 0.8em 0 1.2em;
  opacity: 0.6;
}

/* ── Blueprint Label ────────────────────────────────────────── */
.bp-label {
  font-family: var(--bp-font-mono) !important;
  font-size: 0.72em !important;
  color: var(--bp-muted) !important;
  letter-spacing: 0.08em !important;
  text-transform: lowercase !important;
  margin-bottom: 1.2em !important;
  border-bottom: none !important;
  padding-bottom: 0 !important;
}

/* ── Columns Layout ─────────────────────────────────────────── */
.columns {
  display: flex;
  gap: 3em;
}

.columns > div {
  flex: 1;
}

/* ── Slide Number ───────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--bp-surface);
  color: var(--bp-muted);
  font-family: var(--bp-font-mono);
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 4px 0 0 0;
  border-top: 1px solid var(--bp-grid);
  border-left: 1px solid var(--bp-grid);
}

/* ── Centered Helper ────────────────────────────────────────── */
.centered {
  text-align: center;
}
</style>
