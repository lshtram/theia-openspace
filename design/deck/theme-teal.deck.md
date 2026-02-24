---
title: OpenSpace Teal
theme: white
transition: slide
---

<style>
/* ═══════════════════════════════════════════════════════════════
   OPENSPACE TEAL - Calm Restorative Theme
   Inspired by: 2026 Color of the Year "Transformative Teal", Wellness Design
   Purpose: Architecture reviews, planning sessions, team retrospectives
   ═══════════════════════════════════════════════════════════════ */

/* ── Color Palette ─────────────────────────────────────────────── */
:root {
  --teal-bg: #faf9f7;
  --teal-surface: #ffffff;
  --teal-surface-2: #f5f3f0;
  --teal-text: #1c1917;
  --teal-text-secondary: #57534e;
  --teal-text-muted: #a8a29e;
  --teal-accent: #0d9488;
  --teal-accent-light: #5eead4;
  --teal-accent-dark: #0f766e;
  --teal-purple: #7c3aed;
  --teal-green: #22c55e;
  --teal-amber: #d97706;
  --teal-gradient: linear-gradient(135deg, #0d9488 0%, #22c55e 100%);
}

/* ── Base Typography ───────────────────────────────────────────── */
.reveal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 28px;
  color: var(--teal-text);
  background: var(--teal-bg);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 60px 80px;
  height: 100%;
}

/* ── Headings ──────────────────────────────────────────────────── */
.reveal h1 {
  font-size: 3.5em;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 0.3em;
  color: var(--teal-text);
  letter-spacing: -0.02em;
}

.reveal h1::after {
  content: '';
  display: block;
  width: 80px;
  height: 4px;
  background: var(--teal-gradient);
  margin-top: 0.3em;
  border-radius: 2px;
}

.reveal h2 {
  font-size: 2.2em;
  font-weight: 600;
  color: var(--teal-text);
  margin-bottom: 0.5em;
  letter-spacing: -0.01em;
}

.reveal h3 {
  font-size: 1.4em;
  font-weight: 600;
  color: var(--teal-accent-dark);
  margin-bottom: 0.5em;
}

.reveal h4 {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--teal-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6em;
}

/* ── Body Text ─────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--teal-text-secondary);
  margin-bottom: 1em;
}

.reveal .lead {
  font-size: 1.25em;
  color: var(--teal-text-secondary);
  line-height: 1.6;
}

/* ── Links ─────────────────────────────────────────────────────── */
.reveal a {
  color: var(--teal-accent);
  text-decoration: none;
  border-bottom: 2px solid var(--teal-accent-light);
  transition: all 0.2s ease;
}

.reveal a:hover {
  border-bottom-color: var(--teal-accent);
}

/* ── Lists ─────────────────────────────────────────────────────── */
.reveal ul, .reveal ol {
  margin: 0 0 1.5em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 1.8em;
  margin-bottom: 0.6em;
  line-height: 1.5;
  color: var(--teal-text-secondary);
}

.reveal ul li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6em;
  width: 10px;
  height: 10px;
  background: var(--teal-accent);
  border-radius: 50%;
}

.reveal ol {
  counter-reset: list-counter;
}

.reveal ol li {
  counter-increment: list-counter;
}

.reveal ol li::before {
  content: counter(list-counter);
  position: absolute;
  left: 0;
  top: 0;
  width: 1.5em;
  height: 1.5em;
  background: var(--teal-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 600;
  color: white;
  padding: 0;
}

.reveal ol li::after {
  display: none;
}

/* ── Code Blocks ───────────────────────────────────────────────── */
.reveal code {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.85em;
  background: var(--teal-surface-2);
  padding: 0.2em 0.5em;
  border-radius: 6px;
  color: var(--teal-accent-dark);
}

.reveal pre {
  background: var(--teal-surface);
  border: 1px solid var(--teal-surface-2);
  border-radius: 16px;
  padding: 1.5em;
  margin: 1.5em 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--teal-text);
  font-size: 0.9em;
  line-height: 1.6;
}

/* Syntax highlighting */
.reveal .token.keyword { color: #0d9488; }
.reveal .token.string { color: #22c55e; }
.reveal .token.number { color: #d97706; }
.reveal .token.function { color: #7c3aed; }
.reveal .token.comment { color: #a8a29e; font-style: italic; }

/* ── Tables ────────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}

.reveal th {
  background: var(--teal-accent);
  color: white;
  font-weight: 600;
  text-align: left;
  padding: 1em 1.2em;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.05em;
}

.reveal th:first-child {
  border-radius: 8px 0 0 0;
}

.reveal th:last-child {
  border-radius: 0 8px 0 0;
}

.reveal td {
  padding: 0.9em 1.2em;
  border-bottom: 1px solid var(--teal-surface-2);
  color: var(--teal-text-secondary);
}

.reveal tr:last-child td {
  border-bottom: none;
}

/* ── Blockquotes ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.5em 0;
  padding: 1.5em 2em;
  background: var(--teal-surface);
  border-left: 4px solid var(--teal-accent);
  border-radius: 0 12px 12px 0;
  font-style: italic;
  color: var(--teal-text-secondary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1.1em;
}

/* ── Emphasis ──────────────────────────────────────────────────── */
.reveal strong {
  font-weight: 600;
  color: var(--teal-text);
}

.reveal em {
  font-style: italic;
  color: var(--teal-text-muted);
}

/* ── Cards ─────────────────────────────────────────────────────── */
.card {
  background: var(--teal-surface);
  border: 1px solid var(--teal-surface-2);
  border-radius: 16px;
  padding: 1.8em;
  margin: 1em 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.card-accent {
  border-left: 4px solid var(--teal-accent);
}

.card-success {
  border-left: 4px solid var(--teal-green);
}

.card-amber {
  border-left: 4px solid var(--teal-amber);
}

/* ── Badges ────────────────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 0.35em 0.9em;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 20px;
  background: var(--teal-surface-2);
  color: var(--teal-text-secondary);
}

.badge-accent {
  background: var(--teal-accent);
  color: white;
}

.badge-success {
  background: var(--teal-green);
  color: white;
}

.badge-outline {
  background: transparent;
  border: 2px solid var(--teal-accent);
  color: var(--teal-accent);
}

/* ── Metrics ───────────────────────────────────────────────────── */
.metric {
  text-align: center;
  padding: 1.5em;
  background: var(--teal-surface);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.metric-value {
  font-size: 2.8em;
  font-weight: 700;
  color: var(--teal-accent);
  line-height: 1;
}

.metric-label {
  font-size: 0.85em;
  color: var(--teal-text-muted);
  margin-top: 0.4em;
}

/* ── Timeline ──────────────────────────────────────────────────── */
.timeline {
  position: relative;
  padding-left: 2em;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--teal-accent-light);
  border-radius: 1px;
}

.timeline-item {
  position: relative;
  margin-bottom: 1.5em;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -2em;
  top: 0.4em;
  width: 14px;
  height: 14px;
  background: var(--teal-accent);
  border-radius: 50%;
  border: 3px solid var(--teal-bg);
}

/* ── Two Column Layout ─────────────────────────────────────────── */
.columns {
  display: flex;
  gap: 3em;
}

.columns > div {
  flex: 1;
}

/* ── Slide Number ──────────────────────────────────────────────── */
.reveal .slide-number {
  background: var(--teal-surface);
  color: var(--teal-text-muted);
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px 0 0 0;
  box-shadow: -2px -2px 8px rgba(0, 0, 0, 0.04);
}

/* ── Fragments ─────────────────────────────────────────────────── */
.reveal .fragment.fade-up {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
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

.centered h1::after {
  margin: 0.3em auto 0;
}
</style>

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 1: Title
     ═══════════════════════════════════════════════════════════════ -->

# OpenSpace Teal

<div class="lead" style="margin-top: 0.3em;">

**Calm Restorative Theme** for Architecture & Planning

</div>

<div style="margin-top: 3em;">

<span class="badge badge-accent">2026 Color</span>
<span class="badge">Wellness Design</span>
<span class="badge badge-outline">Restorative</span>

</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 2: Typography
     ═══════════════════════════════════════════════════════════════ -->

## Typography System

<h4>Clear hierarchy for structured content</h4>

<h1>Heading 1 — 3.5em</h1>

<h2>Heading 2 — 2.2em</h2>

<h3>Heading 3 — 1.4em</h3>

<p class="lead">Lead paragraph — larger introductory text for key points.</p>

<p>Body paragraph — comfortable reading at 28px with soft, muted colors for reduced eye strain during long sessions.</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 3: Color Palette
     ═══════════════════════════════════════════════════════════════ -->

## Restorative Color Palette

<div class="columns" style="margin-top: 2em;">
<div>

### Primary — Transformative Teal

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #0d9488; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Teal<br>#0d9488</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #5eead4; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Light<br>#5eead4</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #0d9488 0%, #22c55e 100%); border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Gradient</p>
  </div>
</div>

</div>
<div>

### Supporting Colors

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #22c55e; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Green<br>#22c55e</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #7c3aed; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Purple<br>#7c3aed</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #d97706; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Amber<br>#d97706</p>
  </div>
</div>

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 4: Lists
     ═══════════════════════════════════════════════════════════════ -->

## Lists for Planning

<div class="columns">
<div>

### Action Items

- Review architecture proposal
- Schedule team retrospective
- Update project timeline
- Finalize sprint goals

</div>
<div>

### Implementation Steps

1. Gather requirements
2. Design solution
3. Build prototype
4. Collect feedback

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 5: Tables
     ═══════════════════════════════════════════════════════════════ -->

## Project Timeline

| Phase | Duration | Owner | Status |
|-------|----------|-------|--------|
| Discovery | 2 weeks | Team A | <span class="badge badge-success">Complete</span> |
| Design | 3 weeks | Team B | <span class="badge badge-accent">In Progress</span> |
| Development | 6 weeks | Team C | <span class="badge">Planned</span> |
| Testing | 2 weeks | QA Team | <span class="badge">Planned</span> |

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 6: Cards
     ═══════════════════════════════════════════════════════════════ -->

## Information Cards

<div class="card card-accent">
<h3 style="margin-top: 0;">Architecture Decision</h3>
<p style="margin-bottom: 0;">Microservices approach selected for improved scalability and team autonomy. Each service owns its data layer.</p>
</div>

<div class="card card-success">
<h3 style="margin-top: 0;">Key Benefit</h3>
<p style="margin-bottom: 0;">Independent deployments reduce coordination overhead and accelerate delivery cycles.</p>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 7: Metrics
     ═══════════════════════════════════════════════════════════════ -->

## Sprint Metrics

<div class="columns" style="margin-top: 2em;">
<div class="metric">
  <div class="metric-value">34</div>
  <div class="metric-label">Stories Completed</div>
</div>
<div class="metric">
  <div class="metric-value">96%</div>
  <div class="metric-label">Sprint Goal</div>
</div>
<div class="metric">
  <div class="metric-value">4.2</div>
  <div class="metric-label">Team Velocity</div>
</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 8: Blockquotes
     ═══════════════════════════════════════════════════════════════ -->

## Key Insights

> "The goal of software architecture is to minimize the human resources required to build and maintain the required system."
> 
> — Robert C. Martin, Clean Architecture

Architecture decisions shape not just the code, but how teams work together.

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 9: Code
     ═══════════════════════════════════════════════════════════════ -->

## Configuration Example

```typescript
const config = {
  theme: 'openspace-teal',
  purpose: 'architecture-reviews',
  colors: {
    accent: '#0d9488',
    background: '#faf9f7'
  },
  mood: 'calm and restorative'
};
```

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 10: Closing
     ═══════════════════════════════════════════════════════════════ -->

# OpenSpace Teal

<div class="centered">

**Calm, focused, restorative**

<div style="margin-top: 2em;">

<span class="badge badge-accent">2026 Design</span>
<span class="badge">Wellness</span>
<span class="badge badge-outline">Planning</span>

</div>

</div>
