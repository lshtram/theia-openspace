---
title: Terminal Green
theme: black
transition: slide
---

<!-- .slide: data-background-color="#0d0f0d" -->

# Terminal Green

<div class="term-rule"></div>

<div style="font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace; font-size: 1.1em; color: #00c853; margin-top: 1em;">
$ openspace --theme terminal<span class="cursor">▊</span>
</div>

<div style="margin-top: 3em; font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace; font-size: 0.7em; color: #4a7a4a; letter-spacing: 0.14em;">
THEME v1.0 &nbsp;//&nbsp; DEVELOPER-NATIVE &nbsp;//&nbsp; CODE-FIRST AESTHETIC
</div>

---

## Typography System

<div class="term-label">// heading hierarchy — all monospaced</div>

<h1 style="font-size: 2.2em;">H1 — System Title</h1>

<h2 style="font-size: 1.6em; border: none; padding: 0;">H2 — Section Header</h2>

<h3 style="font-size: 1.2em;">H3 — Subsection Label</h3>

<p class="lead">Lead paragraph — 1.25em, muted green tint. Used for slide context and introductory summaries on dark terminal backgrounds.</p>

<p>Body text — 28px base, color <code>#d4e6d4</code>. Monospaced throughout — the IDE aesthetic demands it. Even prose reads like source.</p>

> **&gt;** "The terminal is not a constraint — it is the canonical interface. All other UIs are approximations."

<div style="margin-top: 1.2em; font-size: 0.72em; color: #4a7a4a; font-family: 'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;">
// CSS sizes: H1 3.0em · H2 2.0em · H3 1.3em · lead 1.25em · body 1em
// Specimens above shown at reduced size for slide fit
</div>

---

## Color System

<div class="term-label">// design tokens — terminal palette</div>

<div style="display: flex; gap: 1.2em; flex-wrap: wrap; margin-top: 1.5em;">
  <div style="text-align: center;">
    <div style="width: 88px; height: 88px; background: #0d0f0d; border-radius: 4px; border: 1px solid #1b5e20;"></div>
    <p style="font-size: 0.65em; margin-top: 0.5em; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #4a7a4a;">Background<br><span style="color: #d4e6d4;">#0d0f0d</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 88px; height: 88px; background: #141814; border-radius: 4px; border: 1px solid #1b5e20;"></div>
    <p style="font-size: 0.65em; margin-top: 0.5em; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #4a7a4a;">Surface<br><span style="color: #d4e6d4;">#141814</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 88px; height: 88px; background: #00c853; border-radius: 4px; box-shadow: 0 0 18px rgba(0, 200, 83, 0.45);"></div>
    <p style="font-size: 0.65em; margin-top: 0.5em; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #4a7a4a;">Term Green<br><span style="color: #d4e6d4;">#00c853</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 88px; height: 88px; background: #69f0ae; border-radius: 4px; box-shadow: 0 0 18px rgba(105, 240, 174, 0.35);"></div>
    <p style="font-size: 0.65em; margin-top: 0.5em; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #4a7a4a;">Bright Green<br><span style="color: #d4e6d4;">#69f0ae</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 88px; height: 88px; background: #1b5e20; border-radius: 4px;"></div>
    <p style="font-size: 0.65em; margin-top: 0.5em; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #4a7a4a;">Dim Green<br><span style="color: #d4e6d4;">#1b5e20</span></p>
  </div>
  <div style="text-align: center;">
    <div style="width: 88px; height: 88px; background: #00e676; border-radius: 4px; box-shadow: 0 0 14px rgba(0, 230, 118, 0.5);"></div>
    <p style="font-size: 0.65em; margin-top: 0.5em; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #4a7a4a;">Cursor<br><span style="color: #d4e6d4;">#00e676</span></p>
  </div>
</div>

<div style="margin-top: 1.8em; padding: 0.8em 1.2em; border: 1px solid #1b5e20; border-radius: 3px; background: rgba(20, 24, 20, 0.8); font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.72em; color: #4a7a4a;">
  <span style="color: #00c853;">body:</span> <span style="color: #d4e6d4;">#d4e6d4</span> &nbsp;&nbsp;<span style="color: #00c853;">muted:</span> <span style="color: #d4e6d4;">#4a7a4a</span> &nbsp;&nbsp;<span style="color: #00c853;">scanline:</span> <span style="color: #d4e6d4;">repeating-linear-gradient</span>
</div>

---

## Lists + Callouts

<div class="term-label">// system principles — terminal prompt style</div>

<div style="display: flex; gap: 2.5em;">
<div style="flex: 1;">

- **Monospace everything** — typography is not decorative
- **Zero visual noise** — if it isn't signal, drop it
- **Green on black** — contrast is a feature, not a style
- **Cursor always visible** — feedback is not optional
- **Pipes over panels** — compose, don't nest

</div>
<div style="flex: 1;">

<div style="border: 1px solid #1b5e20; border-left: 3px solid #00c853; border-radius: 0 3px 3px 0; padding: 1.1em 1.4em; background: #0d0f0d; font-size: 0.82em;">
  <div style="font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.78em; color: #00c853; letter-spacing: 0.1em; margin-bottom: 0.7em;">$ cat DESIGN_NOTE.md</div>
  <p style="margin: 0; color: #d4e6d4; line-height: 1.65;">Terminal Green is built for <strong>developer-native contexts</strong> — code reviews, live debugging sessions, and late-night pair programming where visual chrome is an enemy.</p>
  <p style="margin: 0.7em 0 0; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.78em; color: #4a7a4a;">// ref: design/deck/theme-terminal.deck.md</p>
</div>

</div>
</div>

---

## Code + Tables

<div class="term-label">// interface definition — TypeScript</div>

<div style="display: flex; gap: 2em; align-items: flex-start;">
<div style="flex: 1.5;">

```typescript
interface TerminalTheme {
  name: string;
  version: string;
  palette: {
    bg:      '#0d0f0d';
    surface: '#141814';
    accent:  '#00c853';
    bright:  '#69f0ae';
    dim:     '#1b5e20';
    text:    '#d4e6d4';
    muted:   '#4a7a4a';
    cursor:  '#00e676';
  };
}

function applyTerminalTheme(theme: TerminalTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--term-accent', theme.palette.accent);
  root.style.setProperty('--term-text',   theme.palette.text);
}
```

</div>
<div style="flex: 1;">

| Token | Value | Role |
|-------|-------|------|
| `--term-bg` | `#0d0f0d` | Canvas |
| `--term-accent` | `#00c853` | Primary |
| `--term-bright` | `#69f0ae` | Highlight |
| `--term-dim` | `#1b5e20` | Border |
| `--term-text` | `#d4e6d4` | Content |
| `--term-cursor` | `#00e676` | Blink |

</div>
</div>

<style>
/* ═══════════════════════════════════════════════════════════════
   TERMINAL GREEN — Developer-Native Theme
   Inspired by: classic terminal emulators, hacker aesthetic,
   monochrome CRT displays, VT100 terminals, code-first design
   Purpose: code reviews, pair programming, dev-native content
   ═══════════════════════════════════════════════════════════════ */

/* ── Color Tokens ───────────────────────────────────────────── */
:root {
  --term-bg:        #0d0f0d;
  --term-surface:   #141814;
  --term-accent:    #00c853;
  --term-bright:    #69f0ae;
  --term-dim:       #1b5e20;
  --term-text:      #d4e6d4;
  --term-muted:     #4a7a4a;
  --term-cursor:    #00e676;
  --term-font:      'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace;
}

/* ── Background + Scanline Overlay ──────────────────────────── */
.reveal {
  font-family: var(--term-font);
  font-size: 28px;
  color: var(--term-text);
  background: var(--term-bg);
}

.reveal::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 0, 0, 0.07) 3px,
    rgba(0, 0, 0, 0.07) 4px
  );
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 48px 68px;
  height: 100%;
}

/* ── Headings — All Monospaced ──────────────────────────────── */
.reveal h1 {
  font-family: var(--term-font);
  font-size: 3.0em;
  font-weight: 700;
  line-height: 1.05;
  margin-bottom: 0.2em;
  color: var(--term-accent);
  letter-spacing: -0.01em;
  text-shadow: 0 0 30px rgba(0, 200, 83, 0.25);
}

.reveal h2 {
  font-family: var(--term-font);
  font-size: 2.0em;
  font-weight: 600;
  color: var(--term-accent);
  margin-bottom: 0.3em;
  letter-spacing: 0.01em;
  border-bottom: 1px solid var(--term-dim);
  padding-bottom: 0.3em;
}

.reveal h3 {
  font-family: var(--term-font);
  font-size: 1.3em;
  font-weight: 500;
  color: var(--term-bright);
  margin-bottom: 0.4em;
  letter-spacing: 0.02em;
}

.reveal h4 {
  font-family: var(--term-font);
  font-size: 0.78em;
  font-weight: 400;
  color: var(--term-muted);
  letter-spacing: 0.06em;
  margin-bottom: 1em;
}

/* ── Body Text ──────────────────────────────────────────────── */
.reveal p {
  font-family: var(--term-font);
  font-size: 1em;
  line-height: 1.7;
  color: var(--term-text);
  margin-bottom: 1em;
}

.reveal .lead {
  font-size: 1.25em;
  color: var(--term-muted);
  line-height: 1.6;
}

/* ── Inline Code ────────────────────────────────────────────── */
.reveal code {
  font-family: var(--term-font);
  font-size: 0.85em;
  background: rgba(27, 94, 32, 0.25);
  padding: 0.12em 0.45em;
  border-radius: 2px;
  color: var(--term-bright);
  border: 1px solid rgba(105, 240, 174, 0.2);
}

/* ── Code Blocks ────────────────────────────────────────────── */
.reveal pre {
  background: rgba(13, 15, 13, 0.97);
  border: 1px solid var(--term-dim);
  border-radius: 3px;
  padding: 1.2em;
  margin: 1em 0;
  box-shadow:
    0 2px 20px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(0, 200, 83, 0.05);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--term-text);
  font-size: 0.84em;
  line-height: 1.6;
  border: none;
}

/* Syntax token colours — green family */
.reveal .token.keyword  { color: #80cbc4; }
.reveal .token.type     { color: var(--term-bright); }
.reveal .token.string   { color: var(--term-accent); }
.reveal .token.number   { color: #ffcc80; }
.reveal .token.function { color: var(--term-bright); }
.reveal .token.comment  { color: var(--term-muted); font-style: italic; }
.reveal .token.operator { color: #b2dfdb; }
.reveal .token.property { color: var(--term-accent); }

/* ── Lists — Terminal Prompt Style ─────────────────────────── */
.reveal ul, .reveal ol {
  margin: 0 0 1.2em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 2.2em;
  margin-bottom: 0.6em;
  line-height: 1.55;
  color: var(--term-text);
  font-family: var(--term-font);
}

.reveal ul li::before {
  content: '$';
  position: absolute;
  left: 0;
  color: var(--term-accent);
  font-family: var(--term-font);
  font-size: 0.85em;
  font-weight: 700;
  top: 0.12em;
}

.reveal ol {
  counter-reset: term-counter;
}

.reveal ol li {
  counter-increment: term-counter;
}

.reveal ol li::before {
  content: counter(term-counter, decimal-leading-zero) '>';
  position: absolute;
  left: 0;
  font-family: var(--term-font);
  font-size: 0.72em;
  font-weight: 600;
  color: var(--term-accent);
  top: 0.22em;
  letter-spacing: 0;
}

/* ── Blockquote ─────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.2em 0;
  padding: 1em 1.5em;
  background: rgba(20, 24, 20, 0.8);
  border-left: 3px solid var(--term-accent);
  border-radius: 0 3px 3px 0;
  font-style: normal;
  color: var(--term-muted);
  font-family: var(--term-font);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1em;
  line-height: 1.6;
  color: var(--term-text);
}

/* ── Tables ─────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.82em;
  font-family: var(--term-font);
}

.reveal th {
  background: rgba(27, 94, 32, 0.4);
  color: var(--term-accent);
  font-weight: 600;
  text-align: left;
  padding: 0.85em 1em;
  border-bottom: 1px solid var(--term-accent);
  text-transform: uppercase;
  font-size: 0.76em;
  letter-spacing: 0.1em;
}

.reveal td {
  padding: 0.75em 1em;
  border-bottom: 1px solid var(--term-dim);
  color: var(--term-text);
}

.reveal tr:hover td {
  background: rgba(27, 94, 32, 0.15);
}

/* ── Emphasis ───────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--term-bright);
}

.reveal em {
  font-style: italic;
  color: var(--term-accent);
}

/* ── Blinking Cursor ────────────────────────────────────────── */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.cursor {
  color: var(--term-cursor);
  animation: blink 1s step-end infinite;
  font-family: var(--term-font);
}

/* ── Terminal Rule Divider ──────────────────────────────────── */
.term-rule {
  height: 1px;
  background: linear-gradient(90deg, var(--term-accent) 0%, transparent 75%);
  margin: 0.6em 0 1em;
  opacity: 0.5;
}

/* ── Terminal Label ─────────────────────────────────────────── */
.term-label {
  font-family: var(--term-font) !important;
  font-size: 0.72em !important;
  color: var(--term-muted) !important;
  letter-spacing: 0.06em !important;
  margin-bottom: 1em !important;
  border-bottom: none !important;
  padding-bottom: 0 !important;
}

/* ── Slide Number ───────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--term-surface);
  color: var(--term-muted);
  font-family: var(--term-font);
  font-size: 11px;
  padding: 5px 12px;
  border-radius: 3px 0 0 0;
  border-top: 1px solid var(--term-dim);
  border-left: 1px solid var(--term-dim);
}
</style>
