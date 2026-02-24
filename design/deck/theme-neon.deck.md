---
title: OpenSpace Neon
theme: black
transition: slide
---

<style>
/* ═══════════════════════════════════════════════════════════════
   OPENSPACE NEON - Bold Futuristic Theme
   Inspired by: Cyberpunk, Tech Launches, Innovation Showcases
   Purpose: Product launches, innovation demos, tech announcements
   ═══════════════════════════════════════════════════════════════ */

/* ── Color Palette ─────────────────────────────────────────────── */
:root {
  --neon-bg: #050508;
  --neon-surface: #0a0a10;
  --neon-surface-2: #12121a;
  --neon-text: #ffffff;
  --neon-text-muted: #6b7280;
  --neon-cyan: #00ffff;
  --neon-magenta: #ff00ff;
  --neon-green: #00ff88;
  --neon-yellow: #ffff00;
  --neon-purple: #bf00ff;
  --neon-gradient: linear-gradient(90deg, #00ffff 0%, #ff00ff 50%, #00ff88 100%);
}

/* ── Glow Effects ──────────────────────────────────────────────── */
@keyframes neon-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
  20%, 24%, 55% { opacity: 0.6; }
}

/* ── Base Typography ───────────────────────────────────────────── */
.reveal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 28px;
  color: var(--neon-text);
  background: var(--neon-bg);
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
  font-size: 4em;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.3em;
  color: var(--neon-text);
  letter-spacing: -0.03em;
  text-shadow: 
    0 0 10px var(--neon-cyan),
    0 0 20px var(--neon-cyan),
    0 0 40px var(--neon-cyan);
}

.reveal h2 {
  font-size: 2.2em;
  font-weight: 700;
  color: var(--neon-text);
  margin-bottom: 0.5em;
  letter-spacing: -0.01em;
}

.reveal h3 {
  font-size: 1.4em;
  font-weight: 600;
  color: var(--neon-cyan);
  margin-bottom: 0.5em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.reveal h4 {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--neon-magenta);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0.8em;
}

/* ── Body Text ─────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--neon-text);
  margin-bottom: 1em;
  opacity: 0.9;
}

.reveal .lead {
  font-size: 1.3em;
  color: var(--neon-text);
  line-height: 1.5;
  opacity: 0.8;
}

/* ── Links ─────────────────────────────────────────────────────── */
.reveal a {
  color: var(--neon-cyan);
  text-decoration: none;
  text-shadow: 0 0 10px var(--neon-cyan);
  transition: all 0.2s ease;
}

.reveal a:hover {
  text-shadow: 0 0 20px var(--neon-cyan);
}

/* ── Lists ─────────────────────────────────────────────────────── */
.reveal ul, .reveal ol {
  margin: 0 0 1.5em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 2em;
  margin-bottom: 0.7em;
  line-height: 1.5;
  color: var(--neon-text);
  opacity: 0.9;
}

.reveal ul li::before {
  content: '>';
  position: absolute;
  left: 0;
  color: var(--neon-green);
  font-weight: bold;
  text-shadow: 0 0 10px var(--neon-green);
  font-family: monospace;
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
  width: 1.6em;
  height: 1.6em;
  background: var(--neon-surface-2);
  border: 1px solid var(--neon-cyan);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 700;
  color: var(--neon-cyan);
  text-shadow: 0 0 10px var(--neon-cyan);
  padding: 0;
}

.reveal ol li::after {
  display: none;
}

/* ── Code Blocks ───────────────────────────────────────────────── */
.reveal code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.85em;
  background: var(--neon-surface);
  padding: 0.2em 0.5em;
  border-radius: 4px;
  color: var(--neon-cyan);
  border: 1px solid rgba(0, 255, 255, 0.3);
}

.reveal pre {
  background: var(--neon-surface);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 8px;
  padding: 1.5em;
  margin: 1.5em 0;
  box-shadow: 
    0 0 20px rgba(0, 255, 255, 0.1),
    inset 0 0 20px rgba(0, 255, 255, 0.05);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--neon-text);
  font-size: 0.9em;
  border: none;
}

/* Syntax highlighting */
.reveal .token.keyword { color: #ff00ff; text-shadow: 0 0 10px #ff00ff; }
.reveal .token.string { color: #00ff88; text-shadow: 0 0 10px #00ff88; }
.reveal .token.number { color: #ffff00; text-shadow: 0 0 10px #ffff00; }
.reveal .token.function { color: #00ffff; text-shadow: 0 0 10px #00ffff; }
.reveal .token.comment { color: #6b7280; font-style: italic; }

/* ── Tables ────────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}

.reveal th {
  background: var(--neon-surface);
  color: var(--neon-cyan);
  font-weight: 600;
  text-align: left;
  padding: 1em 1.2em;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.1em;
  border-bottom: 2px solid var(--neon-cyan);
  text-shadow: 0 0 10px var(--neon-cyan);
}

.reveal td {
  padding: 0.9em 1.2em;
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
  color: var(--neon-text);
}

/* ── Blockquotes ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.5em 0;
  padding: 1.5em 2em;
  background: var(--neon-surface);
  border-left: 4px solid var(--neon-magenta);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  color: var(--neon-text);
  box-shadow: 0 0 20px rgba(255, 0, 255, 0.2);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1.2em;
}

/* ── Emphasis ──────────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--neon-text);
}

.reveal em {
  font-style: italic;
  color: var(--neon-magenta);
  text-shadow: 0 0 10px var(--neon-magenta);
}

/* ── Cards ─────────────────────────────────────────────────────── */
.card {
  background: var(--neon-surface);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 12px;
  padding: 1.8em;
  margin: 1em 0;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.1);
}

.card-cyan {
  border-color: var(--neon-cyan);
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
}

.card-magenta {
  border-color: var(--neon-magenta);
  box-shadow: 0 0 30px rgba(255, 0, 255, 0.2);
}

.card-green {
  border-color: var(--neon-green);
  box-shadow: 0 0 30px rgba(0, 255, 136, 0.2);
}

/* ── Badges ────────────────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 0.4em 1em;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: 4px;
  background: var(--neon-surface-2);
  color: var(--neon-text-muted);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge-cyan {
  background: transparent;
  border: 1px solid var(--neon-cyan);
  color: var(--neon-cyan);
  text-shadow: 0 0 10px var(--neon-cyan);
}

.badge-magenta {
  background: transparent;
  border: 1px solid var(--neon-magenta);
  color: var(--neon-magenta);
  text-shadow: 0 0 10px var(--neon-magenta);
}

.badge-green {
  background: transparent;
  border: 1px solid var(--neon-green);
  color: var(--neon-green);
  text-shadow: 0 0 10px var(--neon-green);
}

/* ── Feature Grid ──────────────────────────────────────────────── */
.feature {
  text-align: center;
  padding: 2em;
}

.feature-icon {
  font-size: 3em;
  margin-bottom: 0.5em;
  filter: drop-shadow(0 0 20px currentColor);
}

.feature h3 {
  font-size: 1.1em;
  margin-bottom: 0.3em;
}

.feature p {
  font-size: 0.9em;
  color: var(--neon-text-muted);
  margin: 0;
}

/* ── Metrics ───────────────────────────────────────────────────── */
.metric {
  text-align: center;
  padding: 1.5em;
  background: var(--neon-surface);
  border-radius: 12px;
  border: 1px solid rgba(0, 255, 255, 0.2);
}

.metric-value {
  font-size: 3.5em;
  font-weight: 800;
  color: var(--neon-cyan);
  text-shadow: 0 0 30px var(--neon-cyan);
  line-height: 1;
  animation: neon-pulse 2s infinite;
}

.metric-label {
  font-size: 0.85em;
  color: var(--neon-text-muted);
  margin-top: 0.3em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Glowing Divider ───────────────────────────────────────────── */
.glow-line {
  height: 2px;
  background: var(--neon-gradient);
  margin: 2em 0;
  box-shadow: 0 0 20px var(--neon-cyan), 0 0 40px var(--neon-magenta);
}

/* ── CTA Button ────────────────────────────────────────────────── */
.cta {
  display: inline-block;
  padding: 1em 2.5em;
  background: transparent;
  color: var(--neon-cyan);
  font-weight: 700;
  font-size: 1.1em;
  border-radius: 8px;
  text-decoration: none;
  border: 2px solid var(--neon-cyan);
  cursor: pointer;
  text-shadow: 0 0 10px var(--neon-cyan);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.cta:hover {
  background: var(--neon-cyan);
  color: var(--neon-bg);
  text-shadow: none;
  box-shadow: 0 0 40px rgba(0, 255, 255, 0.5);
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
  background: var(--neon-surface);
  color: var(--neon-cyan);
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px 0 0 0;
  text-shadow: 0 0 10px var(--neon-cyan);
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
</style>

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 1: Title
     ═══════════════════════════════════════════════════════════════ -->

# OPENSPACE NEON

<div class="glow-line"></div>

<div class="lead">

**Bold Futuristic Theme** for Tech Announcements

</div>

<div style="margin-top: 3em;">

<span class="badge-cyan">2026 Design</span>
<span class="badge-magenta">Cyberpunk</span>
<span class="badge-green">Innovation</span>

</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 2: Typography
     ═══════════════════════════════════════════════════════════════ -->

## Typography System

<h4>NEON GLOW EFFECTS</h4>

<h1>Heading 1</h1>

<h2>Heading 2</h2>

<h3>Heading 3</h3>

<p>Bold typography with neon glow effects creates maximum visual impact for tech launches and product announcements.</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 3: Colors
     ═══════════════════════════════════════════════════════════════ -->

## Neon Color Spectrum

<div class="columns" style="margin-top: 2em;">
<div>

### Primary Neon Colors

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #00ffff; border-radius: 12px; box-shadow: 0 0 30px #00ffff;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Cyan<br>#00ffff</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #ff00ff; border-radius: 12px; box-shadow: 0 0 30px #ff00ff;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Magenta<br>#ff00ff</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #00ff88; border-radius: 12px; box-shadow: 0 0 30px #00ff88;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Green<br>#00ff88</p>
  </div>
</div>

</div>
<div>

### Accent Colors

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #ffff00; border-radius: 12px; box-shadow: 0 0 30px #ffff00;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Yellow<br>#ffff00</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #bf00ff; border-radius: 12px; box-shadow: 0 0 30px #bf00ff;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Purple<br>#bf00ff</p>
  </div>
</div>

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 4: Features
     ═══════════════════════════════════════════════════════════════ -->

## Product Features

<div class="columns" style="margin-top: 2em;">
<div class="feature">
  <div class="feature-icon" style="color: var(--neon-cyan);">⚡</div>
  <h3 style="color: var(--neon-cyan);">Lightning Fast</h3>
  <p>Sub-millisecond response times</p>
</div>
<div class="feature">
  <div class="feature-icon" style="color: var(--neon-magenta);">🔮</div>
  <h3 style="color: var(--neon-magenta);">AI-Powered</h3>
  <p>Machine learning at the edge</p>
</div>
<div class="feature">
  <div class="feature-icon" style="color: var(--neon-green);">🌐</div>
  <h3 style="color: var(--neon-green);">Global Scale</h3>
  <p>Deployed in 50+ regions</p>
</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 5: Lists
     ═══════════════════════════════════════════════════════════════ -->

## Innovation Roadmap

<div class="columns">
<div>

<h3>Q1 2026</h3>

> Launch beta program
> Onboard first 100 users
> Collect feedback
> Iterate on features

</div>
<div>

<h3>Q2-Q4 2026</h3>

01. Public launch
02. Enterprise features
03. Global expansion
04. Platform ecosystem

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 6: Metrics
     ═══════════════════════════════════════════════════════════════ -->

## Performance Metrics

<div class="columns" style="margin-top: 2em;">
<div class="metric">
  <div class="metric-value">99.9%</div>
  <div class="metric-label">Uptime SLA</div>
</div>
<div class="metric">
  <div class="metric-value">&lt;1ms</div>
  <div class="metric-label">Latency</div>
</div>
<div class="metric">
  <div class="metric-value">10M+</div>
  <div class="metric-label">Requests/sec</div>
</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 7: Code
     ═══════════════════════════════════════════════════════════════ -->

## Developer Experience

```typescript
import { NeonClient } from '@openspace/neon';

const client = new NeonClient({
  theme: 'cyberpunk',
  features: ['ai', 'realtime', 'edge'],
  performance: 'maximum'
});

await client.initialize();
console.log('🚀 Ready to launch!');
```

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 8: Tables
     ═══════════════════════════════════════════════════════════════ -->

## Pricing Tiers

| Plan | Requests | Features | Price |
|------|----------|----------|-------|
| Starter | 100K/mo | Core features | Free |
| Pro | 10M/mo | AI + Edge | $99/mo |
| Enterprise | Unlimited | Everything | Custom |

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 9: Cards
     ═══════════════════════════════════════════════════════════════ -->

## What's New

<div class="card card-cyan">
<h3 style="margin-top: 0; color: var(--neon-cyan);">New Feature: AI Agents</h3>
<p style="margin-bottom: 0;">Deploy autonomous AI agents that learn and adapt to your specific use case.</p>
</div>

<div class="card card-magenta">
<h3 style="margin-top: 0; color: var(--neon-magenta);">Announcement: Global Edge Network</h3>
<p style="margin-bottom: 0;">50 new edge locations deployed for ultra-low latency worldwide.</p>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 10: CTA
     ═══════════════════════════════════════════════════════════════ -->

<div class="centered">

# THE FUTURE IS NOW

<div class="glow-line"></div>

<div style="margin-top: 2em;">
<span class="cta">Get Started</span>
</div>

<div style="margin-top: 3em;">
<span class="badge-cyan">Neon</span>
<span class="badge-magenta">Bold</span>
<span class="badge-green">Innovation</span>
</div>

</div>
