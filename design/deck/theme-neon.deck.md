---
title: Neon Arcade
theme: black
transition: zoom
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap');

:root {
  --arcade-bg: #0d0015;
  --arcade-surface: #1a0a2e;
  --arcade-surface-2: #2d1b4e;
  --arcade-cyan: #00ffff;
  --arcade-magenta: #ff00ff;
  --arcade-lime: #39ff14;
  --arcade-yellow: #ffff00;
  --arcade-pink: #ff6b9d;
  --arcade-gradient: linear-gradient(90deg, #00ffff, #ff00ff, #39ff14);
  --arcade-gradient-diag: linear-gradient(135deg, #00ffff 0%, #ff00ff 50%, #39ff14 100%);
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.8; }
  94% { opacity: 1; }
  96% { opacity: 0.9; }
  97% { opacity: 1; }
}

@keyframes pulse-glow {
  0%, 100% { text-shadow: 0 0 10px var(--arcade-cyan), 0 0 20px var(--arcade-cyan), 0 0 40px var(--arcade-cyan); }
  50% { text-shadow: 0 0 5px var(--arcade-cyan), 0 0 10px var(--arcade-cyan), 0 0 20px var(--arcade-cyan); }
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.reveal {
  font-family: 'Space Mono', monospace;
  font-size: 26px;
  color: #ffffff;
  background: var(--arcade-bg);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 60px 80px;
  height: 100%;
  background: 
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 255, 255, 0.03) 2px,
      rgba(0, 255, 255, 0.03) 4px
    ),
    radial-gradient(ellipse at 30% 20%, rgba(255, 0, 255, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
    var(--arcade-bg);
}

.reveal h1 {
  font-family: 'Press Start 2P', cursive;
  font-size: 2.5em;
  line-height: 1.4;
  margin-bottom: 0.4em;
  color: var(--arcade-cyan);
  text-shadow: 0 0 10px var(--arcade-cyan), 0 0 20px var(--arcade-cyan), 0 0 40px var(--arcade-cyan);
  animation: pulse-glow 2s ease-in-out infinite;
  letter-spacing: 2px;
}

.reveal h2 {
  font-family: 'Space Mono', monospace;
  font-size: 2em;
  font-weight: 700;
  color: var(--arcade-magenta);
  margin-bottom: 0.5em;
  text-transform: uppercase;
  letter-spacing: 4px;
  text-shadow: 0 0 10px var(--arcade-magenta);
}

.reveal h3 {
  font-family: 'Space Mono', monospace;
  font-size: 1.3em;
  font-weight: 700;
  color: var(--arcade-lime);
  margin-bottom: 0.6em;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.reveal h4 {
  font-family: 'Space Mono', monospace;
  font-size: 0.8em;
  font-weight: 700;
  color: var(--arcade-yellow);
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-bottom: 1em;
  padding: 0.3em 0.8em;
  background: var(--arcade-surface-2);
  border: 1px solid var(--arcade-yellow);
  display: inline-block;
}

.reveal p {
  font-size: 0.95em;
  line-height: 1.8;
  color: #e0e0e0;
  margin-bottom: 1em;
}

.reveal .lead {
  font-size: 1.2em;
  color: var(--arcade-pink);
  line-height: 1.6;
}

.reveal a {
  color: var(--arcade-cyan);
  text-decoration: none;
  border: 2px solid var(--arcade-cyan);
  padding: 0.2em 0.5em;
  transition: all 0.2s ease;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
}

.reveal a:hover {
  background: var(--arcade-cyan);
  color: var(--arcade-bg);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.6);
}

.reveal ul, .reveal ol {
  margin: 0 0 1.5em 0;
  padding-left: 0;
  list-style: none;
}

.reveal ul li, .reveal ol li {
  position: relative;
  padding-left: 2em;
  margin-bottom: 0.8em;
  line-height: 1.5;
  color: #ffffff;
}

.reveal ul li::before {
  content: '►';
  position: absolute;
  left: 0;
  color: var(--arcade-lime);
  font-size: 0.7em;
  text-shadow: 0 0 5px var(--arcade-lime);
}

.reveal ol {
  counter-reset: arcade-counter;
}

.reveal ol li {
  counter-increment: arcade-counter;
}

.reveal ol li::before {
  content: '[' counter(arcade-counter, decimal) ']';
  position: absolute;
  left: 0;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  color: var(--arcade-cyan);
  font-size: 0.9em;
}

.reveal code {
  font-family: 'Space Mono', monospace;
  font-size: 0.85em;
  background: var(--arcade-surface);
  padding: 0.2em 0.5em;
  border-radius: 0;
  color: var(--arcade-lime);
  border: 1px solid var(--arcade-lime);
  box-shadow: 0 0 10px rgba(57, 255, 20, 0.2);
}

.reveal pre {
  background: var(--arcade-surface);
  border: 2px solid var(--arcade-cyan);
  border-radius: 0;
  padding: 1.5em;
  margin: 1.5em 0;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 20px rgba(0, 255, 255, 0.05);
  position: relative;
}

.reveal pre::before {
  content: 'TERMINAL';
  position: absolute;
  top: -12px;
  left: 20px;
  background: var(--arcade-bg);
  padding: 0 10px;
  font-size: 0.7em;
  color: var(--arcade-cyan);
  letter-spacing: 2px;
}

.reveal pre code {
  background: none;
  padding: 0;
  color: #ffffff;
  font-size: 0.85em;
  border: none;
  box-shadow: none;
}

.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.85em;
  border: 2px solid var(--arcade-magenta);
}

.reveal th {
  background: var(--arcade-surface-2);
  color: var(--arcade-cyan);
  font-weight: 700;
  text-align: left;
  padding: 1em 1.2em;
  text-transform: uppercase;
  font-size: 0.75em;
  letter-spacing: 2px;
  border-bottom: 2px solid var(--arcade-magenta);
}

.reveal td {
  padding: 0.8em 1.2em;
  border-bottom: 1px solid var(--arcade-surface-2);
  color: #ffffff;
}

.reveal tr:hover td {
  background: var(--arcade-surface);
}

.reveal blockquote {
  margin: 1.5em 0;
  padding: 1.5em 2em;
  background: var(--arcade-surface);
  border: 2px solid var(--arcade-pink);
  border-radius: 0;
  font-style: normal;
  color: var(--arcade-pink);
  box-shadow: 0 0 20px rgba(255, 107, 157, 0.3);
}

.reveal blockquote p {
  font-size: 1.1em;
  color: #ffffff;
}

.reveal strong {
  font-weight: 700;
  color: var(--arcade-yellow);
}

.reveal em {
  font-style: italic;
  color: var(--arcade-magenta);
}

.arcade-card {
  background: var(--arcade-surface);
  border: 2px solid var(--arcade-cyan);
  padding: 1.5em;
  margin: 1em 0;
  position: relative;
}

.arcade-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 30px 30px 0;
  border-color: transparent var(--arcade-cyan) transparent transparent;
}

.arcade-card-magenta {
  border-color: var(--arcade-magenta);
}

.arcade-card-magenta::after {
  border-color: transparent var(--arcade-magenta) transparent transparent;
}

.arcade-card-lime {
  border-color: var(--arcade-lime);
}

.arcade-card-lime::after {
  border-color: transparent var(--arcade-lime) transparent transparent;
}

.arcade-badge {
  display: inline-block;
  padding: 0.3em 0.8em;
  font-size: 0.7em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-radius: 0;
  background: transparent;
  border: 2px solid;
  margin-right: 0.5em;
  margin-bottom: 0.5em;
}

.arcade-badge-cyan {
  border-color: var(--arcade-cyan);
  color: var(--arcade-cyan);
}

.arcade-badge-magenta {
  border-color: var(--arcade-magenta);
  color: var(--arcade-magenta);
}

.arcade-badge-lime {
  border-color: var(--arcade-lime);
  color: var(--arcade-lime);
}

.arcade-metric {
  text-align: center;
  padding: 1.5em;
  background: var(--arcade-surface);
  border: 2px solid var(--arcade-cyan);
}

.arcade-metric-value {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.8em;
  color: var(--arcade-lime);
  text-shadow: 0 0 10px var(--arcade-lime);
  line-height: 1;
  margin-bottom: 0.3em;
}

.arcade-metric-label {
  font-size: 0.7em;
  color: var(--arcade-cyan);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.arcade-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3em;
}

.arcade-columns > div {
  padding: 1em 0;
}

.arcade-divider {
  height: 4px;
  background: var(--arcade-gradient);
  margin: 2em 0;
  box-shadow: 0 0 10px var(--arcade-cyan), 0 0 20px var(--arcade-magenta);
}

.reveal .slide-number {
  background: var(--arcade-surface);
  color: var(--arcade-cyan);
  font-size: 12px;
  padding: 8px 12px;
  font-family: 'Space Mono', monospace;
}

.reveal .fragment.fade-up {
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.4s ease;
}

.reveal .fragment.fade-up.visible {
  transform: translateY(0);
  opacity: 1;
}

.arcade-center {
  text-align: center;
}

.arcade-center h1,
.arcade-center h2 {
  text-align: center;
}

.pixel-border {
  border: 4px solid var(--arcade-cyan);
  box-shadow: 
    0 0 0 4px var(--arcade-bg),
    0 0 0 8px var(--arcade-cyan),
    0 0 20px rgba(0, 255, 255, 0.5);
}
</style>

<!-- SLIDE 1: Title -->
<div class="arcade-center">

# NEON ARCADE

<div class="arcade-divider"></div>

<p class="lead">> RETRO-FUTURISTIC Y2K THEME <</p>

<div style="margin-top: 3em;">
<span class="arcade-badge arcade-badge-cyan">Y2K</span>
<span class="arcade-badge arcade-badge-magenta">CYBERPUNK</span>
<span class="arcade-badge arcade-badge-lime">RETRO</span>
</div>

</div>

---

<!-- SLIDE 2: Typography -->
## SYSTEM.TYPOGRAPHY

<h4>> HEADING HIERARCHY</h4>

<h1>HEADING_1</h1>

<h2>HEADING_2</h2>

<h3>HEADING_3</h3>

<p>> Body text in Space Mono. Optimized for readability in tech presentations and product launches.</p>

---

<!-- SLIDE 3: Colors -->
## COLOR.PALETTE

<div class="arcade-columns" style="margin-top: 2em;">
<div>

<h4>> PRIMARY COLORS</h4>

<div style="display: flex; gap: 1em; margin-top: 1em;">
  <div style="text-align: center;">
    <div style="width: 50px; height: 50px; background: #00ffff; box-shadow: 0 0 20px #00ffff; border: 2px solid #00ffff;"></div>
    <p style="font-size: 0.7em; margin-top: 0.5em;">CYAN</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 50px; height: 50px; background: #ff00ff; box-shadow: 0 0 20px #ff00ff; border: 2px solid #ff00ff;"></div>
    <p style="font-size: 0.7em; margin-top: 0.5em;">MAGENTA</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 50px; height: 50px; background: #39ff14; box-shadow: 0 0 20px #39ff14; border: 2px solid #39ff14;"></div>
    <p style="font-size: 0.7em; margin-top: 0.5em;">LIME</p>
  </div>
</div>

</div>
<div>

<h4>> ACCENT COLORS</h4>

<div style="display: flex; gap: 1em; margin-top: 1em;">
  <div style="text-align: center;">
    <div style="width: 50px; height: 50px; background: #ffff00; box-shadow: 0 0 15px #ffff00; border: 2px solid #ffff00;"></div>
    <p style="font-size: 0.7em; margin-top: 0.5em;">YELLOW</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 50px; height: 50px; background: #ff6b9d; box-shadow: 0 0 15px #ff6b9d; border: 2px solid #ff6b9d;"></div>
    <p style="font-size: 0.7em; margin-top: 0.5em;">PINK</p>
  </div>
</div>

</div>
</div>

---

<!-- SLIDE 4: Lists -->
## FEATURE.ROADMAP

<div class="arcade-columns">
<div>

<h4>Q1_2026</h4>

> Launch beta program
> Onboard first 100 users
> Collect feedback
> Iterate on features

</div>
<div>

<h4>Q2-Q4_2026</h4>

[01] Public launch
[02] Enterprise features
[03] Global expansion
[04] Platform ecosystem

</div>
</div>

---

<!-- SLIDE 5: Metrics -->
## PERFORMANCE.METRICS

<div class="arcade-columns" style="margin-top: 2em;">
<div class="arcade-metric">
  <div class="arcade-metric-value">99.9%</div>
  <div class="arcade-metric-label">UPTIME</div>
</div>
<div class="arcade-metric">
  <div class="arcade-metric-value"><1ms</div>
  <div class="arcade-metric-label">LATENCY</div>
</div>
<div class="arcade-metric">
  <div class="arcade-metric-value">10M+</div>
  <div class="arcade-metric-label">REQUESTS/SEC</div>
</div>
</div>

---

<!-- SLIDE 6: Tables -->
## PRICING.TIERS

| PLAN | REQUESTS | FEATURES | PRICE |
|------|----------|----------|-------|
| STARTER | 100K/mo | Core | FREE |
| PRO | 10M/mo | AI+Edge | $99/mo |
| ENTERPRISE | Unlimited | Everything | CUSTOM |

---

<!-- SLIDE 7: Cards -->
## NEW_FEATURES

<div class="arcade-card">
<h3 style="margin-top: 0;">> AI AGENTS</h3>
<p style="margin-bottom: 0;">Deploy autonomous AI agents that learn and adapt to your use case.</p>
</div>

<div class="arcade-card arcade-card-magenta">
<h3 style="margin-top: 0;">> EDGE NETWORK</h3>
<p style="margin-bottom: 0;">50 new edge locations for ultra-low latency worldwide.</p>
</div>

<div class="arcade-card arcade-card-lime">
<h3 style="margin-top: 0;">> REAL-TIME SYNC</h3>
<p style="margin-bottom: 0;">Instant data synchronization across all platforms.</p>
</div>

---

<!-- SLIDE 8: Code -->
## DEV.CONFIG

```typescript
import { NeonClient } from '@openspace/neon';

const client = new NeonClient({
  theme: 'cyberpunk',
  features: ['ai', 'realtime', 'edge'],
  performance: 'maximum'
});

await client.initialize();
console.log('🚀 SYSTEM READY!');
```

---

<!-- SLIDE 9: Quote -->
## MISSION.STATEMENT

<blockquote>

"THE FUTURE IS NOW. CODE IT."

</blockquote>

---

<!-- SLIDE 10: Closing -->
<div class="arcade-center pixel-border" style="padding: 2em;">

# THE FUTURE IS NOW

<div class="arcade-divider"></div>

<p style="color: var(--arcade-lime);">> READY TO PLAY? INSERT COIN TO CONTINUE <</p>

<div style="margin-top: 2em;">
<span class="arcade-badge arcade-badge-cyan">NEON</span>
<span class="arcade-badge arcade-badge-magenta">CYBERPUNK</span>
<span class="arcade-badge arcade-badge-lime">Y2K</span>
</div>

</div>
