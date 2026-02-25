---
title: Midnight Luxury
theme: black
transition: fade
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

:root {
  --luxury-black: #0a0a0a;
  --luxury-surface: #141418;
  --luxury-surface-2: #1c1c22;
  --luxury-text: #f5f5f5;
  --luxury-text-muted: #8a8a8a;
  --luxury-gold: #d4af37;
  --luxury-gold-light: #f4d58d;
  --luxury-copper: #b87333;
  --luxury-gradient: linear-gradient(135deg, #d4af37 0%, #b87333 100%);
}

.reveal {
  font-family: 'DM Sans', sans-serif;
  font-size: 28px;
  color: var(--luxury-text);
  background: var(--luxury-black);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 80px 100px;
  height: 100%;
  background: radial-gradient(ellipse at 20% 80%, rgba(212, 175, 55, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 20%, rgba(184, 115, 51, 0.03) 0%, transparent 50%),
              var(--luxury-black);
}

.reveal h1 {
  font-family: 'Playfair Display', serif;
  font-size: 5em;
  font-weight: 600;
  line-height: 1;
  margin-bottom: 0.2em;
  color: var(--luxury-text);
  letter-spacing: -0.02em;
}

.reveal h1::after {
  content: '';
  display: block;
  width: 60px;
  height: 2px;
  background: var(--luxury-gradient);
  margin-top: 0.5em;
}

.reveal h2 {
  font-family: 'Playfair Display', serif;
  font-size: 2.8em;
  font-weight: 500;
  color: var(--luxury-text);
  margin-bottom: 0.5em;
  letter-spacing: -0.01em;
}

.reveal h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.6em;
  font-weight: 500;
  color: var(--luxury-gold);
  margin-bottom: 0.6em;
}

.reveal h4 {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75em;
  font-weight: 500;
  color: var(--luxury-gold);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 1em;
}

.reveal p {
  font-size: 1em;
  line-height: 1.8;
  color: var(--luxury-text-muted);
  margin-bottom: 1em;
  font-weight: 300;
}

.reveal .lead {
  font-size: 1.4em;
  color: var(--luxury-text-muted);
  line-height: 1.6;
  font-weight: 300;
}

.reveal a {
  color: var(--luxury-gold);
  text-decoration: none;
  border-bottom: 1px solid var(--luxury-copper);
  transition: all 0.3s ease;
}

.reveal a:hover {
  color: var(--luxury-gold-light);
}

.reveal ul, .reveal ol {
  margin: 0 0 2em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 2em;
  margin-bottom: 1em;
  line-height: 1.6;
  color: var(--luxury-text-muted);
  font-weight: 300;
}

.reveal ul li::before {
  content: '◆';
  position: absolute;
  left: 0;
  top: 0.1em;
  color: var(--luxury-gold);
  font-size: 0.6em;
}

.reveal ol {
  counter-reset: luxury-counter;
}

.reveal ol li {
  counter-increment: luxury-counter;
}

.reveal ol li::before {
  content: '0' counter(luxury-counter);
  position: absolute;
  left: 0;
  top: 0;
  font-family: 'Playfair Display', serif;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--luxury-gold);
}

.reveal code {
  font-family: 'DM Sans', monospace;
  font-size: 0.85em;
  background: var(--luxury-surface);
  padding: 0.3em 0.6em;
  border-radius: 4px;
  color: var(--luxury-gold-light);
  border: 1px solid rgba(212, 175, 55, 0.2);
}

.reveal pre {
  background: var(--luxury-surface);
  border: 1px solid rgba(212, 175, 55, 0.15);
  border-radius: 8px;
  padding: 2em;
  margin: 2em 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--luxury-text);
  font-size: 0.9em;
  line-height: 1.7;
}

.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 2em 0;
  font-size: 0.9em;
}

.reveal th {
  background: var(--luxury-surface);
  color: var(--luxury-gold);
  font-weight: 500;
  text-align: left;
  padding: 1.2em 1.5em;
  border-bottom: 1px solid var(--luxury-gold);
  font-family: 'DM Sans', sans-serif;
  text-transform: uppercase;
  font-size: 0.7em;
  letter-spacing: 0.15em;
}

.reveal td {
  padding: 1em 1.5em;
  border-bottom: 1px solid var(--luxury-surface-2);
  color: var(--luxury-text-muted);
  font-weight: 300;
}

.reveal tr:hover td {
  background: var(--luxury-surface);
}

.reveal blockquote {
  margin: 2em 0;
  padding: 2em 2.5em;
  background: var(--luxury-surface);
  border-left: 2px solid var(--luxury-gold);
  border-radius: 0 12px 12px 0;
  font-family: 'Playfair Display', serif;
  font-style: italic;
  color: var(--luxury-text);
}

.reveal blockquote p {
  font-size: 1.3em;
  line-height: 1.6;
  color: var(--luxury-text);
  margin: 0;
}

.reveal strong {
  font-weight: 500;
  color: var(--luxury-text);
}

.reveal em {
  font-style: italic;
  color: var(--luxury-gold);
}

.luxury-card {
  background: var(--luxury-surface);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 4px;
  padding: 2.5em;
  margin: 1.5em 0;
  position: relative;
  overflow: hidden;
}

.luxury-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--luxury-gradient);
}

.luxury-card-gold {
  border-color: var(--luxury-gold);
}

.luxury-card-copper {
  border-color: var(--luxury-copper);
}

.luxury-badge {
  display: inline-block;
  padding: 0.5em 1.2em;
  font-size: 0.7em;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  border-radius: 2px;
  background: transparent;
  border: 1px solid var(--luxury-gold);
  color: var(--luxury-gold);
}

.luxury-badge-solid {
  background: var(--luxury-gold);
  color: var(--luxury-black);
}

.luxury-metric {
  text-align: center;
  padding: 2em;
  background: var(--luxury-surface);
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: 4px;
}

.luxury-metric-value {
  font-family: 'Playfair Display', serif;
  font-size: 3.5em;
  font-weight: 600;
  color: var(--luxury-gold);
  line-height: 1;
}

.luxury-metric-label {
  font-size: 0.75em;
  color: var(--luxury-text-muted);
  margin-top: 0.8em;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.luxury-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4em;
}

.luxury-columns > div {
  padding: 1em 0;
}

.luxury-divider {
  width: 40px;
  height: 1px;
  background: var(--luxury-gradient);
  margin: 1.5em 0;
}

.reveal .slide-number {
  background: transparent;
  color: var(--luxury-text-muted);
  font-size: 11px;
  padding: 12px 20px;
  letter-spacing: 0.1em;
}

.reveal .fragment.fade-up {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.reveal .fragment.fade-up.visible {
  transform: translateY(0);
  opacity: 1;
}

.luxury-center {
  text-align: center;
}

.luxury-center h1,
.luxury-center h2 {
  text-align: center;
}

.luxury-center .luxury-divider {
  margin: 2em auto;
}

.grain-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}
</style>

<!-- SLIDE 1: Title -->
<div class="luxury-center">

# Midnight Luxury

<div class="luxury-divider"></div>

<p class="lead">Premium Dark Theme for High-Stakes Presentations</p>

<div style="margin-top: 3em;">
<span class="luxury-badge-solid">Premium</span>
<span class="luxury-badge">Executive</span>
<span class="luxury-badge">Investor Ready</span>
</div>

</div>

---

<!-- SLIDE 2: Typography -->
## Typography System

<h4>Elegant Hierarchy</h4>

<h1>Heading One</h1>

<h2>Heading Two</h2>

<h3>Heading Three</h3>

<p>Body text set in DM Sans at 28px with generous line-height. Designed for clarity in executive settings where every word matters.</p>

---

<!-- SLIDE 3: Color Palette -->
## Signature Palette

<div class="luxury-columns" style="margin-top: 2em;">
<div>

### Primary Metals

<div style="display: flex; gap: 1.5em; margin-top: 1.5em;">
  <div style="text-align: center;">
    <div style="width: 60px; height: 60px; background: #d4af37; border-radius: 2px;"></div>
    <p style="font-size: 0.75em; margin-top: 0.8em;">Gold</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 60px; height: 60px; background: #f4d58d; border-radius: 2px;"></div>
    <p style="font-size: 0.75em; margin-top: 0.8em;">Light Gold</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 60px; height: 60px; background: #b87333; border-radius: 2px;"></div>
    <p style="font-size: 0.75em; margin-top: 0.8em;">Copper</p>
  </div>
</div>

</div>
<div>

### Surface Tones

<div style="display: flex; gap: 1.5em; margin-top: 1.5em;">
  <div style="text-align: center;">
    <div style="width: 60px; height: 60px; background: #0a0a0a; border: 1px solid #333; border-radius: 2px;"></div>
    <p style="font-size: 0.75em; margin-top: 0.8em;">Black</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 60px; height: 60px; background: #141418; border-radius: 2px;"></div>
    <p style="font-size: 0.75em; margin-top: 0.8em;">Surface</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 60px; height: 60px; background: #1c1c22; border-radius: 2px;"></div>
    <p style="font-size: 0.75em; margin-top: 0.8em;">Surface 2</p>
  </div>
</div>

</div>
</div>

---

<!-- SLIDE 4: Lists -->
## Strategic Framework

<div class="luxury-columns">
<div>

<h4>Phase One</h4>

- Market analysis deep dive
- Competitive landscape mapping
- Customer segmentation study
- Strategic partnership identification

</div>
<div>

<h4>Execution Roadmap</h4>

01. Foundation building
02. Market penetration
03. Scale operations
04. Optimize & expand

</div>
</div>

---

<!-- SLIDE 5: Metrics -->
## Performance Metrics

<div class="luxury-columns" style="margin-top: 3em;">
<div class="luxury-metric">
  <div class="luxury-metric-value">$4.2M</div>
  <div class="luxury-metric-label">Annual Revenue</div>
</div>
<div class="luxury-metric">
  <div class="luxury-metric-value">127%</div>
  <div class="luxury-metric-label">Year-over-Year Growth</div>
</div>
<div class="luxury-metric">
  <div class="luxury-metric-value">95%</div>
  <div class="luxury-metric-label">Customer Retention</div>
</div>
</div>

---

<!-- SLIDE 6: Tables -->
## Investment Overview

| Category | Allocation | Expected Return |
|----------|------------|-----------------|
| Product Development | 40% | High |
| Marketing & Growth | 30% | Medium |
| Operations | 20% | Stable |
| Reserve | 10% | — |

---

<!-- SLIDE 7: Cards -->
## Key Insights

<div class="luxury-card luxury-card-gold">
<h3 style="margin-top: 0; color: var(--luxury-gold);">Market Opportunity</h3>
<p style="margin-bottom: 0;">$50B TAM with 25% CAGR. Underserved market with clear pain points and willingness to pay premium pricing.</p>
</div>

<div class="luxury-card luxury-card-copper">
<h3 style="margin-top: 0; color: var(--luxury-copper);">Competitive Edge</h3>
<p style="margin-bottom: 0;">Proprietary technology combined with network effects creates a durable competitive moat.</p>
</div>

---

<!-- SLIDE 8: Quote -->
## Executive Summary

<blockquote>

"Simplicity is the ultimate sophistication."

</blockquote>

<p style="text-align: right; font-size: 0.85em; color: var(--luxury-text-muted);">— Leonardo da Vinci</p>

---

<!-- SLIDE 9: Code -->
## Technical Configuration

```yaml
theme: midnight-luxury
style: premium-dark
purpose: executive-presentations
colors:
  primary: "#d4af37"
  accent: "#b87333"
  background: "#0a0a0a"
```

---

<!-- SLIDE 10: Closing -->
<div class="luxury-center">

# Midnight Luxury

<div class="luxury-divider"></div>

<p style="color: var(--luxury-text-muted);">Premium. Sophisticated. Executive.</p>

<div style="margin-top: 3em;">
<span class="luxury-badge-solid">Premium Dark</span>
<span class="luxury-badge">Executive Ready</span>
</div>

</div>
