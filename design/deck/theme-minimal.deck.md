---
title: OpenSpace Minimal
theme: white
transition: slide
---

<style>
/* ═══════════════════════════════════════════════════════════════
   OPENSPACE MINIMAL - Clean Professional Theme
   Inspired by: Swiss Design, Apple Keynotes, Executive Presentations
   Purpose: Executive briefings, board meetings, investor pitches
   ═══════════════════════════════════════════════════════════════ */

/* ── Color Palette ─────────────────────────────────────────────── */
:root {
  --minimal-bg: #ffffff;
  --minimal-surface: #f8fafc;
  --minimal-surface-2: #f1f5f9;
  --minimal-text: #0f172a;
  --minimal-text-secondary: #475569;
  --minimal-text-muted: #94a3b8;
  --minimal-accent: #0f172a;
  --minimal-accent-light: #334155;
  --minimal-border: #e2e8f0;
  --minimal-success: #059669;
  --minimal-focus: #3b82f6;
}

/* ── Base Typography ───────────────────────────────────────────── */
.reveal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 28px;
  color: var(--minimal-text);
  background: var(--minimal-bg);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 70px 90px;
  height: 100%;
}

/* ── Headings ──────────────────────────────────────────────────── */
.reveal h1 {
  font-size: 4em;
  font-weight: 300;
  line-height: 1.1;
  margin-bottom: 0.4em;
  color: var(--minimal-text);
  letter-spacing: -0.03em;
}

.reveal h2 {
  font-size: 2em;
  font-weight: 400;
  color: var(--minimal-text);
  margin-bottom: 0.6em;
  letter-spacing: -0.01em;
}

.reveal h3 {
  font-size: 1.3em;
  font-weight: 500;
  color: var(--minimal-text-secondary);
  margin-bottom: 0.5em;
}

.reveal h4 {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--minimal-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0.8em;
}

/* ── Body Text ─────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.8;
  color: var(--minimal-text-secondary);
  margin-bottom: 1.2em;
  font-weight: 400;
}

.reveal .lead {
  font-size: 1.3em;
  color: var(--minimal-text-secondary);
  line-height: 1.5;
  font-weight: 300;
}

/* ── Links ─────────────────────────────────────────────────────── */
.reveal a {
  color: var(--minimal-text);
  text-decoration: none;
  border-bottom: 1px solid var(--minimal-text);
  transition: opacity 0.2s ease;
}

.reveal a:hover {
  opacity: 0.6;
}

/* ── Lists ─────────────────────────────────────────────────────── */
.reveal ul, .reveal ol {
  margin: 0 0 1.5em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 1.5em;
  margin-bottom: 0.7em;
  line-height: 1.6;
  color: var(--minimal-text-secondary);
}

.reveal ul li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--minimal-text-muted);
}

.reveal ol {
  counter-reset: list-counter;
}

.reveal ol li {
  counter-increment: list-counter;
}

.reveal ol li::before {
  content: counter(list-counter, decimal-leading-zero);
  position: absolute;
  left: 0;
  font-weight: 500;
  color: var(--minimal-text);
  font-size: 0.9em;
}

.reveal ol li::after {
  display: none;
}

/* ── Code Blocks ───────────────────────────────────────────────── */
.reveal code {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 0.85em;
  background: var(--minimal-surface);
  padding: 0.2em 0.5em;
  border-radius: 4px;
  color: var(--minimal-text);
}

.reveal pre {
  background: var(--minimal-surface);
  border: 1px solid var(--minimal-border);
  border-radius: 8px;
  padding: 1.5em;
  margin: 1.5em 0;
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--minimal-text);
  font-size: 0.85em;
}

/* ── Tables ────────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}

.reveal th {
  background: transparent;
  color: var(--minimal-text-muted);
  font-weight: 500;
  text-align: left;
  padding: 1em 1em;
  text-transform: uppercase;
  font-size: 0.75em;
  letter-spacing: 0.1em;
  border-bottom: 1px solid var(--minimal-text);
}

.reveal td {
  padding: 1em;
  border-bottom: 1px solid var(--minimal-border);
  color: var(--minimal-text-secondary);
}

.reveal tr:last-child td {
  border-bottom: none;
}

/* ── Blockquotes ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 2em 0;
  padding: 0;
  background: transparent;
  border: none;
  font-style: normal;
}

.reveal blockquote p {
  font-size: 1.5em;
  font-weight: 300;
  color: var(--minimal-text);
  margin: 0;
  line-height: 1.4;
}

/* ── Emphasis ──────────────────────────────────────────────────── */
.reveal strong {
  font-weight: 500;
  color: var(--minimal-text);
}

.reveal em {
  font-style: italic;
  color: var(--minimal-text-secondary);
}

/* ── Cards ─────────────────────────────────────────────────────── */
.card {
  background: var(--minimal-surface);
  border: 1px solid var(--minimal-border);
  border-radius: 12px;
  padding: 2em;
  margin: 1em 0;
}

/* ── Badges ────────────────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 0.4em 1em;
  font-size: 0.75em;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: 4px;
  background: var(--minimal-surface-2);
  color: var(--minimal-text-secondary);
}

.badge-dark {
  background: var(--minimal-text);
  color: white;
}

.badge-outline {
  background: transparent;
  border: 1px solid var(--minimal-text);
  color: var(--minimal-text);
}

/* ── Metrics ───────────────────────────────────────────────────── */
.metric {
  padding: 1em 0;
}

.metric-value {
  font-size: 4em;
  font-weight: 300;
  color: var(--minimal-text);
  line-height: 1;
  letter-spacing: -0.03em;
}

.metric-label {
  font-size: 0.85em;
  color: var(--minimal-text-muted);
  margin-top: 0.3em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 500;
}

/* ── Divider ───────────────────────────────────────────────────── */
.divider {
  width: 60px;
  height: 1px;
  background: var(--minimal-text);
  margin: 2em 0;
}

/* ── Two Column Layout ─────────────────────────────────────────── */
.columns {
  display: flex;
  gap: 4em;
}

.columns > div {
  flex: 1;
}

/* ── Slide Number ──────────────────────────────────────────────── */
.reveal .slide-number {
  background: transparent;
  color: var(--minimal-text-muted);
  font-size: 12px;
  padding: 8px 16px;
}

/* ── Fragments ─────────────────────────────────────────────────── */
.reveal .fragment.fade-up {
  transform: translateY(10px);
  opacity: 0;
  transition: all 0.4s ease;
}

.reveal .fragment.fade-up.visible {
  transform: translateY(0);
  opacity: 1;
}

/* ── Center Content ────────────────────────────────────────────── */
.centered {
  text-align: center;
}

.centered h1,
.centered h2 {
  text-align: center;
}

.centered .divider {
  margin: 2em auto;
}
</style>

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 1: Title
     ═══════════════════════════════════════════════════════════════ -->

# OpenSpace Minimal

<div class="divider"></div>

<p class="lead" style="margin: 0;">

Clean Professional Theme for Executive Presentations

</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 2: Typography
     ═══════════════════════════════════════════════════════════════ -->

## Typography

<h4>Elegant minimalism</h4>

<h1>Heading 1</h1>

<h2>Heading 2</h2>

<h3>Heading 3</h3>

<p>Body text at 28px with generous line-height for optimal readability in executive settings.</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 3: Lists
     ═══════════════════════════════════════════════════════════════ -->

## Strategic Priorities

<div class="columns">
<div>

<h4>Q1 Focus</h4>

- Market expansion
- Product innovation
- Team growth
- Operational efficiency

</div>
<div>

<h4>Roadmap</h4>

01. Foundation phase
02. Growth phase
03. Scale phase
04. Optimize phase

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 4: Metrics
     ═══════════════════════════════════════════════════════════════ -->

## Key Metrics

<div class="columns" style="margin-top: 2em;">
<div class="metric">
  <div class="metric-value">$4.2M</div>
  <div class="metric-label">ARR</div>
</div>
<div class="metric">
  <div class="metric-value">127%</div>
  <div class="metric-label">YoY Growth</div>
</div>
<div class="metric">
  <div class="metric-value">95%</div>
  <div class="metric-label">Retention</div>
</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 5: Tables
     ═══════════════════════════════════════════════════════════════ -->

## Financial Summary

| Metric | Q1 | Q2 | Q3 | Q4 |
|--------|----|----|----|----|
| Revenue | $1.0M | $1.1M | $1.0M | $1.1M |
| Expenses | $0.8M | $0.8M | $0.9M | $0.9M |
| Profit | $0.2M | $0.3M | $0.1M | $0.2M |

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 6: Quote
     ═══════════════════════════════════════════════════════════════ -->

<blockquote>

"Simplicity is the ultimate sophistication."

</blockquote>

<p style="text-align: right; color: var(--minimal-text-muted); font-size: 0.9em;">— Leonardo da Vinci</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 7: Cards
     ═══════════════════════════════════════════════════════════════ -->

## Investment Thesis

<div class="card">
<h3 style="margin-top: 0;">Market Opportunity</h3>
<p style="margin-bottom: 0;">$50B TAM with 25% CAGR. Underserved market with clear pain points and willingness to pay.</p>
</div>

<div class="card">
<h3 style="margin-top: 0;">Competitive Advantage</h3>
<p style="margin-bottom: 0;">Proprietary technology, network effects, and switching costs create durable moat.</p>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 8: Badges
     ═══════════════════════════════════════════════════════════════ -->

## Use Cases

<div style="display: flex; gap: 1em; flex-wrap: wrap; margin-top: 1.5em;">

<span class="badge badge-dark">Board Meetings</span>
<span class="badge badge-dark">Investor Pitches</span>
<span class="badge badge-dark">Executive Briefings</span>
<span class="badge outline">Quarterly Reviews</span>
<span class="badge outline">Strategy Sessions</span>

</div>

<p style="margin-top: 2em; font-size: 0.95em;">Designed for high-stakes professional settings where clarity and credibility matter most.</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 9: Code
     ═══════════════════════════════════════════════════════════════ -->

## Configuration

```yaml
theme: openspace-minimal
purpose: executive-presentations
style:
  typography: light-weight
  colors: monochrome
  spacing: generous
```

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 10: Closing
     ═══════════════════════════════════════════════════════════════ -->

<div class="centered">

# OpenSpace Minimal

<div class="divider"></div>

<p style="color: var(--minimal-text-muted); font-size: 1.1em;">Clean. Professional. Executive.</p>

<div style="margin-top: 3em;">
<span class="badge badge-dark">Swiss Design</span>
<span class="badge badge-outline">Minimal</span>
</div>

</div>
