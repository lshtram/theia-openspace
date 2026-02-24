---
title: OpenSpace Sunset
theme: white
transition: slide
---

<style>
/* ═══════════════════════════════════════════════════════════════
   OPENSPACE SUNSET - Warm Energetic Theme
   Inspired by: 2026 Warm Palettes, Product Showcases, Marketing Decks
   Purpose: Product demos, launches, marketing, customer presentations
   ═══════════════════════════════════════════════════════════════ */

/* ── Color Palette ─────────────────────────────────────────────── */
:root {
  --sunset-bg: #fef7f0;
  --sunset-surface: #ffffff;
  --sunset-surface-2: #fef3e8;
  --sunset-text: #1c1917;
  --sunset-text-secondary: #57534e;
  --sunset-text-muted: #a8a29e;
  --sunset-coral: #f97316;
  --sunset-rose: #f43f5e;
  --sunset-amber: #eab308;
  --sunset-purple: #a855f7;
  --sunset-gradient: linear-gradient(135deg, #f97316 0%, #f43f5e 50%, #a855f7 100%);
  --sunset-gradient-warm: linear-gradient(135deg, #fbbf24 0%, #f97316 100%);
}

/* ── Base Typography ───────────────────────────────────────────── */
.reveal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 28px;
  color: var(--sunset-text);
  background: var(--sunset-bg);
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
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 0.3em;
  background: var(--sunset-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.03em;
}

.reveal h2 {
  font-size: 2.2em;
  font-weight: 700;
  color: var(--sunset-text);
  margin-bottom: 0.5em;
  letter-spacing: -0.01em;
}

.reveal h3 {
  font-size: 1.4em;
  font-weight: 600;
  color: var(--sunset-coral);
  margin-bottom: 0.5em;
}

.reveal h4 {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--sunset-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.6em;
}

/* ── Body Text ─────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--sunset-text-secondary);
  margin-bottom: 1em;
}

.reveal .lead {
  font-size: 1.3em;
  color: var(--sunset-text-secondary);
  line-height: 1.5;
  font-weight: 400;
}

/* ── Links ─────────────────────────────────────────────────────── */
.reveal a {
  color: var(--sunset-coral);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.reveal a:hover {
  border-bottom-color: var(--sunset-coral);
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
  color: var(--sunset-text-secondary);
}

.reveal ul li::before {
  content: '→';
  position: absolute;
  left: 0;
  top: 0;
  color: var(--sunset-coral);
  font-weight: 600;
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
  background: var(--sunset-gradient-warm);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 700;
  color: white;
  padding: 0;
}

.reveal ol li::after {
  display: none;
}

/* ── Code Blocks ───────────────────────────────────────────────── */
.reveal code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.85em;
  background: var(--sunset-surface-2);
  padding: 0.2em 0.5em;
  border-radius: 6px;
  color: var(--sunset-coral);
}

.reveal pre {
  background: var(--sunset-surface);
  border: 2px solid var(--sunset-surface-2);
  border-radius: 16px;
  padding: 1.5em;
  margin: 1.5em 0;
  box-shadow: 0 8px 30px rgba(249, 115, 22, 0.1);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--sunset-text);
  font-size: 0.9em;
}

/* ── Tables ────────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}

.reveal th {
  background: var(--sunset-gradient-warm);
  color: white;
  font-weight: 600;
  text-align: left;
  padding: 1em 1.2em;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 0.05em;
}

.reveal th:first-child { border-radius: 12px 0 0 0; }
.reveal th:last-child { border-radius: 0 12px 0 0; }

.reveal td {
  padding: 0.9em 1.2em;
  border-bottom: 1px solid var(--sunset-surface-2);
  color: var(--sunset-text-secondary);
}

/* ── Blockquotes ───────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1.5em 0;
  padding: 1.5em 2em;
  background: var(--sunset-surface);
  border-left: 4px solid var(--sunset-coral);
  border-radius: 0 16px 16px 0;
  font-style: italic;
  color: var(--sunset-text-secondary);
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.08);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1.1em;
}

/* ── Emphasis ──────────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--sunset-text);
}

.reveal em {
  font-style: italic;
  color: var(--sunset-coral);
}

/* ── Cards ─────────────────────────────────────────────────────── */
.card {
  background: var(--sunset-surface);
  border: 2px solid var(--sunset-surface-2);
  border-radius: 20px;
  padding: 1.8em;
  margin: 1em 0;
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.06);
}

.card-accent {
  border-left: 5px solid var(--sunset-coral);
}

.card-rose {
  border-left: 5px solid var(--sunset-rose);
}

.card-purple {
  border-left: 5px solid var(--sunset-purple);
}

/* ── Badges ────────────────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 0.35em 1em;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 20px;
  background: var(--sunset-surface-2);
  color: var(--sunset-coral);
}

.badge-coral {
  background: var(--sunset-coral);
  color: white;
}

.badge-rose {
  background: var(--sunset-rose);
  color: white;
}

.badge-gradient {
  background: var(--sunset-gradient);
  color: white;
}

/* ── Feature Grid ──────────────────────────────────────────────── */
.feature {
  text-align: center;
  padding: 2em 1.5em;
}

.feature-icon {
  font-size: 2.5em;
  margin-bottom: 0.5em;
}

.feature h3 {
  font-size: 1.2em;
  margin-bottom: 0.3em;
}

.feature p {
  font-size: 0.9em;
  color: var(--sunset-text-muted);
  margin: 0;
}

/* ── Metrics ───────────────────────────────────────────────────── */
.metric {
  text-align: center;
  padding: 1.5em;
  background: var(--sunset-surface);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.08);
}

.metric-value {
  font-size: 3em;
  font-weight: 800;
  background: var(--sunset-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.metric-label {
  font-size: 0.85em;
  color: var(--sunset-text-muted);
  margin-top: 0.3em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── CTA Button ────────────────────────────────────────────────── */
.cta {
  display: inline-block;
  padding: 1em 2.5em;
  background: var(--sunset-gradient);
  color: white;
  font-weight: 700;
  font-size: 1.1em;
  border-radius: 30px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(249, 115, 22, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(249, 115, 22, 0.4);
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
  background: var(--sunset-surface);
  color: var(--sunset-text-muted);
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px 0 0 0;
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

# OpenSpace Sunset

<div class="lead" style="margin-top: 0.3em;">

**Warm Energetic Theme** for Product & Marketing

</div>

<div style="margin-top: 3em;">

<span class="badge badge-gradient">2026 Design</span>
<span class="badge-coral">Warm Tones</span>
<span class="badge">Energetic</span>

</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 2: Typography
     ═══════════════════════════════════════════════════════════════ -->

## Bold Typography

<h4>For maximum impact and energy</h4>

<h1>Heading 1 — 3.5em</h1>

<h2>Heading 2 — 2.2em</h2>

<h3>Heading 3 — 1.4em</h3>

<p class="lead">Lead paragraph — bold statements deserve bold presentation.</p>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 3: Colors
     ═══════════════════════════════════════════════════════════════ -->

## Warm Color Palette

<div class="columns" style="margin-top: 2em;">
<div>

### Gradient Spectrum

<div style="display: flex; gap: 0.5em; margin-bottom: 1em;">
  <div style="flex: 1; height: 100px; background: linear-gradient(135deg, #fbbf24 0%, #f97316 50%, #f43f5e 100%); border-radius: 16px;"></div>
</div>

<p style="font-size: 0.9em; color: var(--sunset-text-muted);">Sunset gradient: Gold → Coral → Rose</p>

</div>
<div>

### Accent Colors

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 70px; height: 70px; background: #f97316; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Coral</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 70px; height: 70px; background: #f43f5e; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Rose</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 70px; height: 70px; background: #eab308; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Amber</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 70px; height: 70px; background: #a855f7; border-radius: 16px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Purple</p>
  </div>
</div>

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 4: Features
     ═══════════════════════════════════════════════════════════════ -->

## Key Features

<div class="columns" style="margin-top: 2em;">
<div class="feature">
  <div class="feature-icon">🚀</div>
  <h3>Fast</h3>
  <p>Lightning-fast performance</p>
</div>
<div class="feature">
  <div class="feature-icon">🎨</div>
  <h3>Beautiful</h3>
  <p>Modern design system</p>
</div>
<div class="feature">
  <div class="feature-icon">🔒</div>
  <h3>Secure</h3>
  <p>Enterprise-grade security</p>
</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 5: Lists
     ═══════════════════════════════════════════════════════════════ -->

## Product Benefits

<div class="columns">
<div>

### Why Choose Us?

- Reduce development time by 50%
- Improve team collaboration
- Ship features faster
- Delight your customers

</div>
<div>

### Implementation Steps

1. Schedule a demo
2. Start free trial
3. Onboard your team
4. Launch in production

</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 6: Metrics
     ═══════════════════════════════════════════════════════════════ -->

## Customer Results

<div class="columns" style="margin-top: 2em;">
<div class="metric">
  <div class="metric-value">50%</div>
  <div class="metric-label">Faster Time to Market</div>
</div>
<div class="metric">
  <div class="metric-value">3x</div>
  <div class="metric-label">Team Productivity</div>
</div>
<div class="metric">
  <div class="metric-value">10K+</div>
  <div class="metric-label">Happy Customers</div>
</div>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 7: Tables
     ═══════════════════════════════════════════════════════════════ -->

## Pricing Plans

| Plan | Features | Price |
|------|----------|-------|
| Starter | 5 users, 10 projects | $29/mo |
| Pro | 20 users, unlimited projects | $99/mo |
| Enterprise | Unlimited users, SSO, support | Custom |

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 8: Cards
     ═══════════════════════════════════════════════════════════════ -->

## Testimonials

<div class="card card-accent">
<p style="margin-bottom: 0.5em; font-style: italic;">"This product transformed how our team works. We've cut our deployment time in half."</p>
<p style="margin: 0; font-weight: 600; color: var(--sunset-coral);">— Sarah Chen, CTO at TechCorp</p>
</div>

<div class="card card-rose">
<p style="margin-bottom: 0.5em; font-style: italic;">"The best investment we've made this year. ROI was visible within the first month."</p>
<p style="margin: 0; font-weight: 600; color: var(--sunset-rose);">— Mike Johnson, VP Engineering</p>
</div>

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 9: Quote
     ═══════════════════════════════════════════════════════════════ -->

## Our Mission

> "We believe that great tools empower great teams. Our mission is to make every developer more productive and every team more collaborative."

---

<!-- ═══════════════════════════════════════════════════════════════
     SLIDE 10: CTA
     ═══════════════════════════════════════════════════════════════ -->

# Ready to Get Started?

<div class="centered">

<p class="lead">Join thousands of teams already using our platform</p>

<div style="margin-top: 2em;">
<span class="cta">Start Free Trial</span>
</div>

<div style="margin-top: 2em;">
<span class="badge badge-gradient">2026 Design</span>
<span class="badge-coral">Warm</span>
<span class="badge-rose">Energetic</span>
</div>

</div>
