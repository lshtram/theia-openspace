---
title: OpenSpace Midnight
theme: black
transition: slide
---

# OpenSpace Midnight

<div class="lead" style="margin-top: 0.5em;">

**Dark Technical Theme** for Developer Presentations

</div>

<div style="margin-top: 3em;">

<span class="badge badge-accent">2026 Design</span>
<span class="badge">Dark Mode</span>
<span class="badge">Code-First</span>

</div>

---

## Typography System

<h4>Heading Hierarchy</h4>

<h1>Heading 1 — 3.5em</h1>

<h2>Heading 2 — 2.2em</h2>

<h3>Heading 3 — 1.4em</h3>

<p class="lead">Lead paragraph — larger text for introductions and key points.</p>

<p>Body paragraph — standard reading text at 28px base size for optimal readability.</p>

---

## Color Palette

<div class="columns" style="margin-top: 2em;">
<div>

### Primary

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #00d9ff; border-radius: 12px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Accent<br>#00d9ff</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #7c3aed; border-radius: 12px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Purple<br>#7c3aed</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #00d9ff 0%, #7c3aed 100%); border-radius: 12px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Gradient</p>
  </div>
</div>

</div>
<div>

### Status Colors

<div style="display: flex; gap: 1em; flex-wrap: wrap;">
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #10b981; border-radius: 12px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Success<br>#10b981</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #f59e0b; border-radius: 12px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Warning<br>#f59e0b</p>
  </div>
  <div style="text-align: center;">
    <div style="width: 80px; height: 80px; background: #ef4444; border-radius: 12px;"></div>
    <p style="font-size: 0.8em; margin-top: 0.5em;">Error<br>#ef4444</p>
  </div>
</div>

</div>
</div>

---

## Code Blocks

Built for developer presentations with syntax highlighting:

```typescript
interface Theme {
  name: string;
  colors: {
    accent: string;
    background: string;
    text: string;
  };
}

const midnight: Theme = {
  name: 'openspace-midnight',
  colors: {
    accent: '#00d9ff',
    background: '#0a0a0f',
    text: '#e4e4e7'
  }
};
```

Inline code looks like `const x = 42;` within text.

---

## Lists

<div class="columns">
<div>

### Unordered List

- First item with modern styling
- Second item with accent marker
- Third item for demonstration
- Fourth item showing spacing

</div>
<div>

### Ordered List

1. First numbered item
2. Second numbered item
3. Third numbered item
4. Fourth numbered item

</div>
</div>

---

## Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Dark mode support | <span class="badge badge-success">Done</span> | High |
| Syntax highlighting | <span class="badge badge-success">Done</span> | High |
| Custom animations | <span class="badge">Planned</span> | Medium |
| Export to PDF | <span class="badge">Planned</span> | Low |

---

## Cards & Info Boxes

<div class="card card-accent">
<h3 style="margin-top: 0;">Pro Tip</h3>
<p style="margin-bottom: 0;">Use cards to highlight important information or group related content together.</p>
</div>

<div class="card card-success">
<h3 style="margin-top: 0;">Success</h3>
<p style="margin-bottom: 0;">Green accent for positive outcomes and confirmations.</p>
</div>

<div class="card card-warning">
<h3 style="margin-top: 0;">Warning</h3>
<p style="margin-bottom: 0;">Orange accent for cautions and important notes.</p>
</div>

---

## Metrics & Statistics

<div class="columns" style="text-align: center; margin-top: 2em;">
<div class="metric">
  <div class="metric-value">40+</div>
  <div class="metric-label">Unit Test Suites</div>
</div>
<div class="metric">
  <div class="metric-value">15+</div>
  <div class="metric-label">E2E Test Suites</div>
</div>
<div class="metric">
  <div class="metric-value">80%</div>
  <div class="metric-label">Unit Coverage</div>
</div>
</div>

---

## Blockquotes

> "Good design is obvious. Great design is transparent."
> 
> — Joe Sparano

Blockquotes are perfect for highlighting quotes, important notes, or key takeaways from your presentation.

---

# OpenSpace Midnight

<div class="centered">

**Ready for your next technical presentation**

<div style="margin-top: 2em;">

<span class="badge badge-accent">Dark Theme</span>
<span class="badge">Code-First</span>
<span class="badge">Developer Focused</span>

</div>

</div>

<style>
/* ═══════════════════════════════════════════════════════════════
   OPENSPACE MIDNIGHT - Dark Technical Theme
   Inspired by: Tokyo Night, 2026 Design Trends, Developer Conferences
   ═══════════════════════════════════════════════════════════════ */

:root {
  --midnight-bg: #0a0a0f;
  --midnight-surface: #12121a;
  --midnight-surface-2: #1a1a25;
  --midnight-text: #e4e4e7;
  --midnight-text-muted: #71717a;
  --midnight-accent: #00d9ff;
  --midnight-accent-2: #7c3aed;
  --midnight-success: #10b981;
  --midnight-warning: #f59e0b;
  --midnight-error: #ef4444;
  --midnight-gradient: linear-gradient(135deg, #00d9ff 0%, #7c3aed 100%);
}

.reveal {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 28px;
  color: var(--midnight-text);
  background: var(--midnight-bg);
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 60px 80px;
  height: 100%;
}

.reveal h1 {
  font-size: 3.5em;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 0.3em;
  background: var(--midnight-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.reveal h2 {
  font-size: 2.2em;
  font-weight: 700;
  color: var(--midnight-text);
  margin-bottom: 0.4em;
  letter-spacing: -0.01em;
}

.reveal h3 {
  font-size: 1.4em;
  font-weight: 600;
  color: var(--midnight-accent);
  margin-bottom: 0.5em;
}

.reveal h4 {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--midnight-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5em;
}

.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--midnight-text);
  margin-bottom: 1em;
}

.reveal .lead {
  font-size: 1.25em;
  color: var(--midnight-text-muted);
  line-height: 1.6;
}

.reveal a {
  color: var(--midnight-accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.reveal a:hover {
  border-bottom-color: var(--midnight-accent);
}

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
}

.reveal ul li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 8px;
  height: 8px;
  background: var(--midnight-accent);
  border-radius: 2px;
  transform: rotate(45deg);
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
  width: 1.4em;
  height: 1.4em;
  background: var(--midnight-surface-2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 600;
  color: var(--midnight-accent);
  padding: 0;
}

.reveal ol li::after {
  display: none;
}

.reveal code {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.85em;
  background: var(--midnight-surface);
  padding: 0.2em 0.5em;
  border-radius: 4px;
  color: var(--midnight-accent);
}

.reveal pre {
  background: var(--midnight-surface);
  border: 1px solid var(--midnight-surface-2);
  border-radius: 12px;
  padding: 1.5em;
  margin: 1.5em 0;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.reveal pre code {
  background: none;
  padding: 0;
  color: var(--midnight-text);
  font-size: 0.9em;
  line-height: 1.6;
}

.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}

.reveal th {
  background: var(--midnight-surface);
  color: var(--midnight-accent);
  font-weight: 600;
  text-align: left;
  padding: 1em 1.2em;
  border-bottom: 2px solid var(--midnight-accent);
  text-transform: uppercase;
  font-size: 0.85em;
  letter-spacing: 0.05em;
}

.reveal td {
  padding: 0.9em 1.2em;
  border-bottom: 1px solid var(--midnight-surface-2);
  color: var(--midnight-text);
}

.reveal tr:hover td {
  background: var(--midnight-surface);
}

.reveal blockquote {
  margin: 1.5em 0;
  padding: 1.5em 2em;
  background: var(--midnight-surface);
  border-left: 4px solid var(--midnight-accent);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  color: var(--midnight-text-muted);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1.1em;
}

.reveal strong {
  font-weight: 700;
  color: var(--midnight-text);
}

.reveal em {
  font-style: italic;
  color: var(--midnight-text-muted);
}

.card {
  background: var(--midnight-surface);
  border: 1px solid var(--midnight-surface-2);
  border-radius: 16px;
  padding: 2em;
  margin: 1em 0;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.card-accent {
  border-left: 4px solid var(--midnight-accent);
}

.card-success {
  border-left: 4px solid var(--midnight-success);
}

.card-warning {
  border-left: 4px solid var(--midnight-warning);
}

.badge {
  display: inline-block;
  padding: 0.3em 0.8em;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
  background: var(--midnight-surface-2);
  color: var(--midnight-text-muted);
}

.badge-accent {
  background: var(--midnight-accent);
  color: var(--midnight-bg);
}

.badge-success {
  background: var(--midnight-success);
  color: #fff;
}

.metric {
  text-align: center;
}

.metric-value {
  font-size: 3em;
  font-weight: 800;
  background: var(--midnight-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.metric-label {
  font-size: 0.9em;
  color: var(--midnight-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 0.3em;
}

.columns {
  display: flex;
  gap: 3em;
}

.columns > div {
  flex: 1;
}

.reveal .slide-number {
  background: var(--midnight-surface);
  color: var(--midnight-text-muted);
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px 0 0 0;
}

.centered {
  text-align: center;
}

.centered h1,
.centered h2 {
  text-align: center;
}
</style>
