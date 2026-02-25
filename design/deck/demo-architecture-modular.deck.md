---
title: "Monolith vs Modular Monolith"
theme: black
transition: slide
controls: true
progress: true
slideNumber: "c/t"
---

<!-- SLIDE 1 — TITLE -->
<!-- .slide: data-background-gradient="linear-gradient(160deg, #0a0e1a 0%, #0d1b2e 50%, #0a1f35 100%)" -->

<div class="centered" style="padding-top: 0.5em;">

# Monolith vs Modular Monolith

<div class="bp-rule"></div>

<p class="slide-subtitle">After this: you'll know when a modular monolith outperforms microservices — and what it takes to get there.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-info">Architecture Decision</span>
  <span class="tag tag-primary">System Design</span>
  <span class="tag tag-warning">Modularization</span>
</div>

</div>

Note: This is a targeted comparison for teams caught between "our monolith is painful" and "microservices feels too heavy." We'll work through the decision rigorously, not abstractly. Estimated 15 minutes.

---

<!-- SLIDE 2 — THE DECISION -->
<!-- .slide: data-background-color="#0a0e1a" -->

## The Decision

<div class="highlight-box">
  <strong>The Architectural Question</strong>
  <p>We're a 6-engineer team with 80k DAU, a 35-minute CI, and two squads blocked by each other every sprint. Microservices feels too heavy. Is there a better way?</p>
</div>

**Context:**

- Current codebase: 180k lines of TypeScript, single Postgres database <!-- .element: class="fragment fade-up" -->
- 3 product squads sharing one repo, one pipeline, one deploy <!-- .element: class="fragment fade-up" -->
- 99.5% uptime SLA — outages directly cost revenue <!-- .element: class="fragment fade-up" -->
- Team has zero distributed-systems operational experience <!-- .element: class="fragment fade-up" -->
- 18-month runway; Series A metrics under pressure <!-- .element: class="fragment fade-up" -->

Note: Read the decision question aloud. The context bullets are what make this non-generic — every criterion we use in the comparison traces back to one of these constraints.

---

<!-- SLIDE 3 — ARCHITECTURE A: WHAT IT IS -->
<!-- .slide: data-auto-animate data-auto-animate-id="arch-a" data-background-color="#0a0e1a" -->

## Monolith <span class="tag tag-info">Architecture A</span>

**A single deployable unit.** All application code, business logic, and data access live in one codebase, compiled and deployed together as one process.

<div style="margin-top: 1em; font-size: 0.82em; color: var(--bp-muted);">

**Characteristics:**

- One repository, one build artifact, one deployment <!-- .element: class="fragment fade-up" -->
- All modules share memory space — cross-module calls are direct function invocations <!-- .element: class="fragment fade-up" -->
- Single database with a unified schema versioned alongside code <!-- .element: class="fragment fade-up" -->
- Local dev loop is minimal friction: clone → install → run one command <!-- .element: class="fragment fade-up" -->

</div>

Note: Give the monolith its due. Amazon, Shopify, Stack Overflow, and Basecamp all run monoliths at serious scale. This is a legitimate architecture, not a legacy smell.

---

<!-- SLIDE 4 — ARCHITECTURE A: STRENGTHS / WEAKNESSES -->
<!-- .slide: data-auto-animate data-auto-animate-id="arch-a" data-background-color="#0a0e1a" -->

## Monolith <span class="tag tag-info">Architecture A</span>

<div class="two-column" style="margin-top: 0.6em;">

<div class="column strengths">

### Strengths

- **Simple local dev** — one process, no orchestration overhead <!-- .element: class="fragment fade-up" -->
- **ACID transactions** — cross-feature consistency without distributed patterns <!-- .element: class="fragment fade-up" -->
- **Low operational surface** — one pipeline, one log stream, one deploy target <!-- .element: class="fragment fade-up" -->
- **Fast initial velocity** — no API contracts to negotiate between modules <!-- .element: class="fragment fade-up" -->

</div>

<div class="column weaknesses">

### Weaknesses

- **Coupled deploys** — one team's broken build blocks everyone's release <!-- .element: class="fragment fade-up" -->
- **All-or-nothing scaling** — can't scale the hot path without scaling everything <!-- .element: class="fragment fade-up" -->
- **Growing CI times** — test suite and build time compound with codebase growth <!-- .element: class="fragment fade-up" -->
- **Entangled modules** — without enforcement, cross-cutting dependencies accumulate <!-- .element: class="fragment fade-up" -->

</div>

</div>

Note: The coupled-deploys weakness is the direct symptom our team is experiencing — that 35-minute CI blocking two squads. The question is whether modularity can fix it without the operational cost of services.

---

<!-- SLIDE 5 — ARCHITECTURE B: WHAT IT IS -->
<!-- .slide: data-auto-animate data-auto-animate-id="arch-b" data-background-color="#0a0e1a" -->

## Modular Monolith <span class="tag tag-success">Architecture B</span>

**A single deployable unit with enforced internal boundaries.** Code is organized into discrete modules with explicit interfaces; cross-module dependencies are governed by lint rules and CI gates — not network calls.

<div style="margin-top: 1em; font-size: 0.82em; color: var(--bp-muted);">

**Characteristics:**

- One repository and one deployment — but modules own their code, tests, and interfaces <!-- .element: class="fragment fade-up" -->
- Module boundaries enforced statically (import rules, type contracts) not at runtime <!-- .element: class="fragment fade-up" -->
- Separate CI pipelines per module: only affected modules run on each PR <!-- .element: class="fragment fade-up" -->
- Modules can be extracted to services later — boundaries become the seams <!-- .element: class="fragment fade-up" -->

</div>

Note: This is not just "organized code." The enforcement mechanism is what makes it a Modular Monolith — without enforced boundaries it reverts to a big ball of mud within months.

---

<!-- SLIDE 6 — ARCHITECTURE B: STRENGTHS / WEAKNESSES -->
<!-- .slide: data-auto-animate data-auto-animate-id="arch-b" data-background-color="#0a0e1a" -->

## Modular Monolith <span class="tag tag-success">Architecture B</span>

<div class="two-column" style="margin-top: 0.6em;">

<div class="column strengths">

### Strengths

- **Team autonomy** — squads own modules end-to-end, unblocked by other teams <!-- .element: class="fragment fade-up" -->
- **Parallel CI** — per-module pipelines cut feedback time dramatically <!-- .element: class="fragment fade-up" -->
- **ACID preserved** — still one database; no distributed transaction complexity <!-- .element: class="fragment fade-up" -->
- **Extraction path** — clean module interfaces become service contracts when needed <!-- .element: class="fragment fade-up" -->

</div>

<div class="column weaknesses">

### Weaknesses

- **Boundary enforcement cost** — lint rules, CI gates, and ownership docs require upfront investment <!-- .element: class="fragment fade-up" -->
- **Shared deploy risk** — a catastrophic module failure can still affect the whole process <!-- .element: class="fragment fade-up" -->
- **No granular scaling** — you still scale the whole app, not individual modules <!-- .element: class="fragment fade-up" -->
- **Discipline dependency** — boundaries erode without consistent PR review culture <!-- .element: class="fragment fade-up" -->

</div>

</div>

Note: The weaknesses are real but manageable. Shared deploy risk is mitigated by module-level test gates. No granular scaling is acceptable for most teams below ~50 engineers.

---

<!-- SLIDE 7 — HEAD-TO-HEAD -->
<!-- .slide: data-background-color="#0a0e1a" -->

## Head-to-Head

<table>
  <thead>
    <tr><th>Criterion</th><th>Monolith</th><th>Modular Monolith</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Initial setup time</strong></td><td class="winner">Hours</td><td class="tie">Days (tooling)</td></tr>
    <tr><td><strong>Local dev experience</strong></td><td class="winner">One process</td><td class="winner">One process</td></tr>
    <tr><td><strong>Independent team deploys</strong></td><td class="loser">Blocked by coupling</td><td class="winner">Per-module CI gates</td></tr>
    <tr><td><strong>Operational complexity</strong></td><td class="winner">Minimal</td><td class="winner">Minimal</td></tr>
    <tr><td><strong>Data consistency</strong></td><td class="winner">ACID</td><td class="winner">ACID</td></tr>
    <tr><td><strong>Granular scaling</strong></td><td class="loser">All-or-nothing</td><td class="loser">All-or-nothing</td></tr>
    <tr><td><strong>Module-level fault isolation</strong></td><td class="loser">None</td><td class="tie">Partial (code + CI)</td></tr>
    <tr><td><strong>Team experience required</strong></td><td class="winner">Low</td><td class="winner">Low–Medium</td></tr>
  </tbody>
</table>

Note: The standout pattern: Modular Monolith wins everywhere Monolith wins, and also fixes the coupling problem — without introducing distributed systems complexity. Granular scaling is the one shared gap.

---

<!-- SLIDE 8 — DECISION CRITERIA -->
<!-- .slide: data-background-color="#0a0e1a" -->

## Decision Criteria

**Choose the plain Monolith when:** <!-- .element: class="fragment fade-up" -->

- Team is fewer than ~4 engineers with a single shared sprint goal <!-- .element: class="fragment fade-up" -->
- Domain is early and boundaries aren't yet understood <!-- .element: class="fragment fade-up" -->
- Speed of exploration matters more than team independence <!-- .element: class="fragment fade-up" -->

**Choose the Modular Monolith when:** <!-- .element: class="fragment fade-up" -->

- Multiple squads are blocked by each other's code or deploys <!-- .element: class="fragment fade-up" -->
- CI time is growing and test isolation is absent <!-- .element: class="fragment fade-up" -->
- Microservices ops cost would consume runway you don't have <!-- .element: class="fragment fade-up" -->

**Our situation:** <!-- .element: class="fragment fade-up" -->

> 6 engineers, 3 squads, 35-min CI blocking two teams, 18-month runway, zero distributed-systems ops experience. <!-- .element: class="fragment fade-up" -->

Note: The recommendation should feel inevitable after this slide. Every criterion maps to a concrete fact from slide 2. No abstraction — just logic applied to reality.

---

<!-- SLIDE 9 — RECOMMENDATION -->
<!-- .slide: data-background-gradient="linear-gradient(160deg, #0a0e1a 0%, #0d1b2e 50%, #0a1f35 100%)" -->

## Recommendation

<div class="metric centered" style="margin: 0.4em 0 0.8em;">
  <div class="metric-value">Modular Monolith</div>
  <div class="metric-label">Recommended Architecture</div>
</div>

**Why — in priority order:**

- <span class="tag tag-success">Decisive</span> **Fixes the real pain** — per-module CI eliminates squad blocking without distributed systems overhead <!-- .element: class="fragment fade-up" -->
- <span class="tag tag-success">Decisive</span> **Runway protection** — no months of platform work before teams see relief <!-- .element: class="fragment fade-up" -->
- <span class="tag tag-primary">Important</span> **ACID preserved** — no distributed transactions, no eventual consistency edge cases <!-- .element: class="fragment fade-up" -->
- <span class="tag tag-warning">Revisit when</span> team exceeds ~15 engineers or a dedicated platform hire joins <!-- .element: class="fragment fade-up" -->

Note: This is not a consolation prize. Modular Monolith is the honest engineering answer for this context. It directly solves the stated pain without introducing risks the team can't absorb.

---

<!-- SLIDE 10 — NEXT STEPS -->
<!-- .slide: data-background-color="#0a0e1a" -->

## Next Steps

<ol class="steps-list">

<li class="fragment fade-up">
  <div>
    <strong>Map module boundaries this sprint</strong>
    Identify 3–4 domain modules (e.g., Auth, Billing, Product, Notifications). No code changes yet — document ownership and declare public interfaces.
  </div>
</li>

<li class="fragment fade-up">
  <div>
    <strong>Enforce boundaries with import lint rules (week 2)</strong>
    Add <code>eslint-plugin-import</code> rules so cross-module imports are explicit and CI-gated. Violations fail the build — no exceptions without a review.
  </div>
</li>

<li class="fragment fade-up">
  <div>
    <strong>Split CI pipeline by module (week 3–4)</strong>
    Each module runs its own test suite in parallel. PRs only require passing suites for affected modules. Target: 35 min → under 10 min per squad.
  </div>
</li>

<li class="fragment fade-up">
  <div>
    <strong>Review with data in 6 months</strong>
    Track deploy frequency, mean time to deploy, and inter-squad blocking incidents. If coupling pain persists after modularization, the microservices conversation reopens with real evidence.
  </div>
</li>

</ol>

Note: Assign an owner to each step before leaving this meeting. The goal is that this decision has a clear next action in someone's sprint backlog by end of day.

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

/* ── Design Tokens ──────────────────────────────────────────── */
:root {
  --bp-bg:        #0a0e1a;
  --bp-surface:   #0d1625;
  --bp-grid:      #1e2d4a;
  --bp-accent:    #4fc3f7;
  --bp-hi:        #00e5ff;
  --bp-text:      #e8f4fd;
  --bp-muted:     #7eb3d4;
  --bp-font-mono: 'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace;
  --bp-font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* RevealJS overrides */
  --r-background-color: var(--bp-bg);
  --r-main-color:       var(--bp-text);
  --r-heading-color:    var(--bp-text);
  --r-main-font:        var(--bp-font-body);
  --r-heading-font:     var(--bp-font-mono);
  --r-code-font:        var(--bp-font-mono);
  --r-main-font-size:   28px;
}

/* ── Base ───────────────────────────────────────────────────── */
.reveal {
  font-family: var(--bp-font-body);
  font-size: var(--r-main-font-size);
  color: var(--bp-text);
  background: var(--bp-bg);
  background-image: radial-gradient(circle, rgba(30, 45, 74, 0.6) 1px, transparent 1px);
  background-size: 40px 40px;
}

.reveal .slides {
  text-align: left;
}

.reveal .slides section {
  padding: 50px 72px;
  height: 100%;
}

/* ── Headings ───────────────────────────────────────────────── */
.reveal h1 {
  font-family: var(--bp-font-mono);
  font-size: 3.2em;
  font-weight: 700;
  line-height: 1.05;
  margin-bottom: 0.25em;
  color: var(--bp-text);
  letter-spacing: -0.01em;
  text-shadow: 0 0 40px rgba(79, 195, 247, 0.15);
  text-transform: none;
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
  text-transform: none;
}

.reveal h3 {
  font-family: var(--bp-font-mono);
  font-size: 1.3em;
  font-weight: 500;
  color: var(--bp-accent);
  margin-bottom: 0.4em;
  letter-spacing: 0.03em;
  text-transform: none;
}

/* ── Body ───────────────────────────────────────────────────── */
.reveal p {
  font-size: 1em;
  line-height: 1.7;
  color: var(--bp-text);
  margin-bottom: 1em;
}

.reveal .slide-subtitle {
  font-size: 0.75em;
  color: var(--bp-muted);
  line-height: 1.6;
  margin-top: 0.5em;
  margin-bottom: 1em;
}

/* ── Lists — Blueprint // prefix ────────────────────────────── */
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

.reveal ul li::before,
.reveal ol:not(.steps-list) li::before {
  content: '//';
  position: absolute;
  left: 0;
  color: var(--bp-accent);
  font-family: var(--bp-font-mono);
  font-size: 0.8em;
  font-weight: 600;
  top: 0.15em;
}

/* ── Blockquote ─────────────────────────────────────────────── */
.reveal blockquote {
  margin: 1em 0;
  padding: 1em 1.5em;
  background: rgba(30, 45, 74, 0.25);
  border-left: 3px solid var(--bp-accent);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: var(--bp-muted);
}

.reveal blockquote p {
  margin: 0;
  font-size: 1em;
  line-height: 1.6;
}

/* ── Inline code ────────────────────────────────────────────── */
.reveal code {
  font-family: var(--bp-font-mono);
  font-size: 0.83em;
  background: rgba(30, 45, 74, 0.5);
  padding: 0.15em 0.5em;
  border-radius: 3px;
  color: var(--bp-accent);
  border: 1px solid rgba(79, 195, 247, 0.25);
}

/* ── Strong / Em ────────────────────────────────────────────── */
.reveal strong {
  font-weight: 700;
  color: var(--bp-text);
}

.reveal em {
  font-style: italic;
  color: var(--bp-accent);
}

/* ── Highlight Box ──────────────────────────────────────────── */
.reveal .highlight-box {
  background: rgba(13, 22, 37, 0.85);
  border: 1px solid rgba(79, 195, 247, 0.3);
  border-left: 4px solid var(--bp-accent);
  border-radius: 0 6px 6px 0;
  padding: 1.2em 1.5em;
  margin: 0.8em 0;
  color: var(--bp-text);
  font-size: 0.92em;
  line-height: 1.65;
}

.reveal .highlight-box strong {
  color: var(--bp-accent);
  display: block;
  margin-bottom: 0.5em;
  font-family: var(--bp-font-mono);
  font-size: 0.78em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Two-column layout ──────────────────────────────────────── */
.reveal .two-column {
  display: flex;
  gap: 2.5em;
  align-items: flex-start;
  text-align: left;
  width: 100%;
}

.reveal .two-column .column {
  flex: 1;
  min-width: 0;
}

.reveal .two-column .column h3 {
  font-size: 1em;
  font-weight: 700;
  margin-bottom: 0.6em;
  padding-bottom: 0.4em;
  border-bottom: 1px solid var(--bp-grid);
  color: var(--bp-accent);
}

.reveal .two-column .column ul {
  font-size: 0.82em;
  margin-left: 0;
  line-height: 1.7;
}

.reveal .two-column .column.strengths h3 {
  color: #a5d6a7;
  border-bottom-color: rgba(165, 214, 167, 0.35);
}

.reveal .two-column .column.weaknesses h3 {
  color: #ef9a9a;
  border-bottom-color: rgba(239, 154, 154, 0.35);
}

/* ── Metric display ─────────────────────────────────────────── */
.reveal .metric {
  text-align: center;
  padding: 0.6em 1.2em;
}

.reveal .metric-value {
  font-family: var(--bp-font-mono);
  font-size: 2.8em;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--bp-accent), var(--bp-hi));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.reveal .metric-label {
  font-family: var(--bp-font-mono);
  font-size: 0.62em;
  color: var(--bp-muted);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-top: 0.4em;
  font-weight: 500;
}

/* ── Tags / badges ──────────────────────────────────────────── */
.reveal .tag {
  display: inline-block;
  padding: 0.2em 0.7em;
  border-radius: 999px;
  font-size: 0.6em;
  font-weight: 600;
  font-family: var(--bp-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  vertical-align: middle;
  margin: 0 0.2em;
  line-height: 1.8;
}

.reveal .tag-primary {
  background: rgba(79, 195, 247, 0.15);
  color: var(--bp-accent);
  border: 1px solid rgba(79, 195, 247, 0.4);
}

.reveal .tag-success {
  background: rgba(165, 214, 167, 0.15);
  color: #a5d6a7;
  border: 1px solid rgba(165, 214, 167, 0.4);
}

.reveal .tag-warning {
  background: rgba(255, 204, 128, 0.15);
  color: #ffcc80;
  border: 1px solid rgba(255, 204, 128, 0.4);
}

.reveal .tag-error {
  background: rgba(239, 154, 154, 0.15);
  color: #ef9a9a;
  border: 1px solid rgba(239, 154, 154, 0.4);
}

.reveal .tag-info {
  background: rgba(0, 229, 255, 0.12);
  color: var(--bp-hi);
  border: 1px solid rgba(0, 229, 255, 0.35);
}

/* ── Tables ─────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 0.78em;
  font-family: var(--bp-font-mono);
}

.reveal th {
  background: rgba(30, 45, 74, 0.6);
  color: var(--bp-accent);
  font-weight: 600;
  text-align: left;
  padding: 0.8em 1em;
  border-bottom: 1px solid var(--bp-accent);
  text-transform: uppercase;
  font-size: 0.78em;
  letter-spacing: 0.1em;
}

.reveal td {
  padding: 0.7em 1em;
  border-bottom: 1px solid var(--bp-grid);
  color: var(--bp-text);
  vertical-align: middle;
}

.reveal tr:last-child td {
  border-bottom: none;
}

.reveal tr:hover td {
  background: rgba(30, 45, 74, 0.3);
}

.reveal td.winner {
  color: #a5d6a7;
  font-weight: 600;
}

.reveal td.loser {
  color: var(--bp-muted);
}

.reveal td.tie {
  color: #ffcc80;
}

/* ── Steps list ─────────────────────────────────────────────── */
.reveal .steps-list {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: steps;
}

.reveal .steps-list li {
  counter-increment: steps;
  display: flex;
  align-items: flex-start;
  gap: 0.8em;
  margin-bottom: 0.8em;
  font-size: 0.85em;
  color: var(--bp-text);
  padding-left: 0;
}

.reveal .steps-list li::before {
  content: counter(steps);
  flex-shrink: 0;
  width: 1.8em;
  height: 1.8em;
  background: linear-gradient(135deg, #1e2d4a, #0d1625);
  border: 1px solid var(--bp-accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--bp-font-mono);
  font-weight: 700;
  font-size: 0.85em;
  color: var(--bp-accent);
  margin-top: 0.1em;
}

.reveal .steps-list li strong {
  color: var(--bp-text);
  display: block;
  margin-bottom: 0.2em;
}

/* ── Blueprint Rule ─────────────────────────────────────────── */
.reveal .bp-rule {
  height: 1px;
  background: linear-gradient(90deg, var(--bp-accent) 0%, transparent 80%);
  margin: 0.8em 0 1.2em;
  opacity: 0.6;
}

/* ── Centered helper ────────────────────────────────────────── */
.reveal .centered {
  text-align: center;
}

/* ── Fragments — rely on reveal.js built-in fade-up, just tune timing ── */
.reveal .fragment { transition: opacity 0.4s ease, transform 0.4s ease; }

/* ── Progress bar ───────────────────────────────────────────── */
.reveal .progress {
  background: rgba(255, 255, 255, 0.06);
}

.reveal .progress span {
  background: var(--bp-accent);
}

/* ── Slide number ───────────────────────────────────────────── */
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
</style>
