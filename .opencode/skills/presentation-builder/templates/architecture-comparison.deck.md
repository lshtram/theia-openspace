---
title: "Monolith vs Microservices: Choosing Your Architecture"
author: Your Name
theme: openspace-ocean
transition: slide
transitionSpeed: default
backgroundTransition: fade
controls: true
progress: true
slideNumber: "c/t"
---

<!--
  TEMPLATE: architecture-comparison.deck.md
  ==========================================
  Use this template when comparing two architectural approaches and driving a decision.
  Working example: Monolith vs Microservices.

  HOW TO ADAPT THIS TEMPLATE:
  1. Update frontmatter: change `title` to reflect your specific comparison
  2. Replace Architecture A / Architecture B with your two options throughout
  3. Fill in all [PLACEHOLDER] values with your real content
  4. Adjust the comparison table criteria to match your decision context
  5. Update the recommendation slide with your actual winner and rationale
  6. Customize Next Steps for your team/timeline

  SLIDE COUNT: 10 slides (numbered in comments below)
  ESTIMATED DURATION: 12–18 minutes at 1–2 min/slide
-->

<style>
/* ============================================================
   OCEAN DESIGN SYSTEM
   Base: openspace-ocean theme (blue tones for architecture)
   Accent colors adapted from openspace-modern:
     --os-primary:       #6366f1 → #0ea5e9  (sky blue)
     --os-primary-light: #818cf8 → #38bdf8  (light sky)
     --os-primary-dark:  #4f46e5 → #0284c7  (dark sky)
     --os-accent:        #e94560 → #06b6d4  (cyan)
     --os-accent-light:  #ff6b6b → #67e8f9  (light cyan)
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --os-primary:       #0ea5e9;
  --os-primary-light: #38bdf8;
  --os-primary-dark:  #0284c7;
  --os-accent:        #06b6d4;
  --os-accent-light:  #67e8f9;
  --os-bg-primary:    #0f172a;
  --os-bg-secondary:  #1e293b;
  --os-text-primary:  #f8fafc;
  --os-text-secondary:#cbd5e1;
  --os-text-muted:    #94a3b8;
  --os-success:       #10b981;
  --os-warning:       #f59e0b;
  --os-error:         #ef4444;
  --os-info:          #3b82f6;

  /* RevealJS overrides */
  --r-main-font:        'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --r-heading-font:     'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --r-code-font:        'JetBrains Mono', 'Fira Code', monospace;
  --r-background-color: var(--os-bg-primary);
  --r-main-color:       var(--os-text-primary);
  --r-heading-color:    var(--os-text-primary);
  --r-link-color:       var(--os-primary-light);
  --r-link-color-hover: var(--os-primary);
  --r-selection-background: var(--os-primary);
  --r-selection-color:  var(--os-text-primary);
  --r-main-font-size:   36px;
  --r-heading-font-size: 2.2em;
}

/* ── Base reveal styles ─────────────────────────────────────── */
.reveal {
  font-family: var(--r-main-font);
  font-size: var(--r-main-font-size);
  color: var(--r-main-color);
}

.reveal .slides section {
  text-align: left;
  padding: 0 1.5em;
}

.reveal h1, .reveal h2, .reveal h3, .reveal h4 {
  font-family: var(--r-heading-font);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--r-heading-color);
  margin-bottom: 0.5em;
  line-height: 1.15;
  text-transform: none;
  text-shadow: none;
}

.reveal h1 { font-size: 2.4em; font-weight: 800; }
.reveal h2 { font-size: 1.6em; }
.reveal h3 { font-size: 1.2em; color: var(--os-text-secondary); }

.reveal p {
  color: var(--os-text-secondary);
  line-height: 1.7;
  margin: 0 0 0.8em;
}

.reveal ul, .reveal ol {
  display: block;
  text-align: left;
  color: var(--os-text-secondary);
  line-height: 1.8;
  margin-left: 1.2em;
}

.reveal li { margin-bottom: 0.3em; }
.reveal li strong { color: var(--os-text-primary); }

.reveal a {
  color: var(--r-link-color);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.reveal a:hover {
  color: var(--r-link-color-hover);
  border-bottom-color: var(--r-link-color-hover);
}

/* ── Highlight box ──────────────────────────────────────────── */
/*
  Usage: wrap content in a <div class="highlight-box"> block.
  Use for the key decision question, important callouts, and warnings.
  Example:
    <div class="highlight-box">
      <strong>The Question:</strong> Should we split our monolith?
    </div>
*/
.reveal .highlight-box {
  background: linear-gradient(135deg,
    rgba(14, 165, 233, 0.12) 0%,
    rgba(6, 182, 212, 0.08) 100%);
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-left: 4px solid var(--os-primary);
  border-radius: 10px;
  padding: 1.2em 1.5em;
  margin: 0.8em 0;
  color: var(--os-text-primary);
  font-size: 0.95em;
  line-height: 1.6;
}

.reveal .highlight-box strong {
  color: var(--os-primary-light);
  display: block;
  margin-bottom: 0.4em;
  font-size: 1.05em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.8em;
}

/* ── Metric display ─────────────────────────────────────────── */
/*
  Usage: .metric as a container, .metric-value for the big number/word,
         .metric-label for the descriptor below it.
  Example:
    <div class="metric">
      <div class="metric-value">Microservices</div>
      <div class="metric-label">Recommended Architecture</div>
    </div>
*/
.reveal .metric {
  text-align: center;
  padding: 0.8em 1.2em;
}

.reveal .metric-value {
  font-size: 2.8em;
  font-weight: 800;
  color: var(--os-primary-light);
  line-height: 1.1;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.reveal .metric-label {
  font-size: 0.65em;
  color: var(--os-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 0.3em;
  font-weight: 500;
}

/* ── Tags / badges ──────────────────────────────────────────── */
/*
  Usage: inline <span class="tag tag-primary">Label</span>
  Variants: tag-primary (blue), tag-success (green), tag-warning (amber),
            tag-error (red), tag-info (info blue)
  Example:
    <span class="tag tag-success">✓ Recommended</span>
    <span class="tag tag-warning">⚠ Complex</span>
*/
.reveal .tag {
  display: inline-block;
  padding: 0.2em 0.7em;
  border-radius: 999px;
  font-size: 0.6em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  vertical-align: middle;
  margin: 0 0.2em;
  line-height: 1.8;
}

.reveal .tag-primary {
  background: rgba(14, 165, 233, 0.18);
  color: var(--os-primary-light);
  border: 1px solid rgba(14, 165, 233, 0.4);
}

.reveal .tag-success {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.reveal .tag-warning {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.reveal .tag-error {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.reveal .tag-info {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

/* ── Two-column layout ──────────────────────────────────────── */
/*
  Usage: wrap two divs in .two-column for a 50/50 flex split.
  Each child div gets .column class. For asymmetric splits, override flex values.
  Example:
    <div class="two-column">
      <div class="column"><!-- left content --></div>
      <div class="column"><!-- right content --></div>
    </div>
*/
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
  border-bottom: 2px solid rgba(14, 165, 233, 0.3);
  color: var(--os-primary-light);
}

.reveal .two-column .column ul {
  font-size: 0.82em;
  margin-left: 1em;
  line-height: 1.7;
}

.reveal .two-column .column.strengths h3 { color: #34d399; border-bottom-color: rgba(16, 185, 129, 0.4); }
.reveal .two-column .column.weaknesses h3 { color: #f87171; border-bottom-color: rgba(239, 68, 68, 0.4); }

/* ── Gradient text ──────────────────────────────────────────── */
/*
  Usage: <span class="gradient-text">Big Impact Words</span>
  Renders text with a blue→cyan gradient fill.
*/
.reveal .gradient-text {
  background: linear-gradient(135deg, var(--os-primary-light), var(--os-accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Fragments ──────────────────────────────────────────────── */
.reveal .fragment { opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; }
.reveal .fragment.visible { opacity: 1; }
.reveal .fragment.fade-up { transform: translateY(20px); }
.reveal .fragment.fade-up.visible { transform: translateY(0); }

/* ── Tables ─────────────────────────────────────────────────── */
.reveal table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72em;
  margin: 0.5em 0;
}

.reveal table th {
  background: rgba(14, 165, 233, 0.2);
  color: var(--os-primary-light);
  font-weight: 600;
  padding: 0.65em 0.9em;
  text-align: left;
  border-bottom: 2px solid rgba(14, 165, 233, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.85em;
}

.reveal table td {
  padding: 0.6em 0.9em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  color: var(--os-text-secondary);
  vertical-align: middle;
}

.reveal table tr:last-child td { border-bottom: none; }
.reveal table tr:hover td { background: rgba(14, 165, 233, 0.05); }
.reveal table td.winner { color: #34d399; font-weight: 600; }
.reveal table td.loser  { color: var(--os-text-muted); }
.reveal table td.tie    { color: var(--os-warning); }

/* ── Code blocks ────────────────────────────────────────────── */
.reveal code {
  font-family: var(--r-code-font);
  font-size: 0.88em;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  padding: 0.15em 0.45em;
  color: var(--os-accent-light);
}

.reveal pre {
  background: var(--os-bg-secondary);
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 10px;
  padding: 1em 1.2em;
  font-size: 0.78em;
  box-shadow: 0 4px 24px rgba(0,0,0,0.35);
  width: 100%;
  margin: 0.5em 0;
}

.reveal pre code {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 1em;
  color: var(--os-text-primary);
}

/* ── Blockquote ─────────────────────────────────────────────── */
.reveal blockquote {
  background: rgba(14, 165, 233, 0.08);
  border-left: 4px solid var(--os-primary);
  border-radius: 0 8px 8px 0;
  padding: 0.8em 1.2em;
  margin: 0.6em 0;
  font-style: italic;
  color: var(--os-text-secondary);
}

/* ── Progress bar ───────────────────────────────────────────── */
.reveal .progress { background: rgba(255,255,255,0.08); }
.reveal .progress span { background: var(--os-primary); }

/* ── Slide number ───────────────────────────────────────────── */
.reveal .slide-number {
  background: rgba(14, 165, 233, 0.15);
  color: var(--os-text-muted);
  font-size: 0.55em;
  border-radius: 6px;
  padding: 3px 8px;
}

/* ── Utility: centered content ──────────────────────────────── */
.reveal .centered {
  text-align: center;
  width: 100%;
}

/* ── Utility: subtitle under big heading ────────────────────── */
.reveal .slide-subtitle {
  font-size: 0.7em;
  color: var(--os-text-muted);
  font-weight: 400;
  margin-top: -0.3em;
  margin-bottom: 1em;
  letter-spacing: 0.01em;
}

/* ── Utility: divider line ──────────────────────────────────── */
.reveal hr {
  border: none;
  border-top: 1px solid rgba(14, 165, 233, 0.2);
  margin: 0.8em 0;
}

/* ── Next steps numbered list ───────────────────────────────── */
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
  margin-bottom: 0.7em;
  font-size: 0.85em;
  color: var(--os-text-secondary);
}

.reveal .steps-list li::before {
  content: counter(steps);
  flex-shrink: 0;
  width: 1.8em;
  height: 1.8em;
  background: linear-gradient(135deg, var(--os-primary-dark), var(--os-accent));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85em;
  color: white;
  margin-top: 0.05em;
}

.reveal .steps-list li strong {
  color: var(--os-text-primary);
  display: block;
  margin-bottom: 0.1em;
}
</style>

---

<!-- ============================================================
  SLIDE 1 — TITLE SLIDE
  ============================================================
  Purpose: Sets the narrative frame. Tells the viewer exactly what
  decision will be made and what they'll be able to do after.

  HOW TO FILL IN:
  - data-background-gradient: choose two dark colors that match your
    topic mood (ocean blues shown here work for architecture topics)
  - h1: the versus statement — keep it short, punchy
  - p.slide-subtitle: the "after this you can..." sentence
  - tags: label the two sides, or the decision type

  GRADIENT OPTIONS:
  - Ocean/Architecture: linear-gradient(135deg, #0c1445 0%, #0c3460 50%, #0a4f6f 100%)
  - Sunset/Product:     linear-gradient(135deg, #1a0533 0%, #6b21a8 50%, #db2777 100%)
  - Forest/Systems:     linear-gradient(135deg, #052e16 0%, #14532d 50%, #065f46 100%)
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0c1445 0%, #0c3460 50%, #0a4f6f 100%)" -->

<div class="centered" style="padding-top: 0.5em;">

# Monolith vs Microservices

<p class="slide-subtitle">After this: you'll know which architecture fits your team's current stage — and exactly when to revisit that decision.</p>

<div style="margin-top: 1.5em;">
  <span class="tag tag-info">Architecture Decision</span>
  <span class="tag tag-primary">System Design</span>
  <span class="tag tag-warning">Scalability</span>
</div>

</div>

Note: Welcome. This is a technical decision with real tradeoffs — we're not here to pick a winner in the abstract, but to find the right fit for *our* context. Estimated 15 minutes.

---

<!-- ============================================================
  SLIDE 2 — THE DECISION
  ============================================================
  Purpose: State the exact question being answered. Ground the
  audience in the specific context before diving into options.

  HOW TO FILL IN:
  - highlight-box strong: label the question type
    (e.g., "The Architectural Question", "The Infrastructure Decision")
  - highlight-box p: the specific question in one sentence, concrete
  - Context bullets: 3–5 facts about YOUR situation that make this
    decision non-trivial. These are the constraints that rule out
    "just do both" or "it depends" answers.
  - Use fragment fade-up so each context point lands separately

  EXAMPLES OF GOOD DECISION QUESTIONS:
  - "We're at 50k users/day with 3 engineers — do we split the monolith?"
  - "Our deploy takes 40 minutes and is blocking 2 teams — is microservices the answer?"
  - "We're starting fresh — which baseline gives us the most runway?"
  ============================================================ -->

## The Decision

<div class="highlight-box">
  <strong>The Architectural Question</strong>
  <p>We're a 6-engineer team at 80k daily active users, our deployment cycle has grown to 35 minutes, and two squads are blocked on each other every sprint. Should we move to microservices?</p>
</div>

**Context:**
- Current codebase: 180k lines of TypeScript, single Postgres database <!-- .element: class="fragment fade-up" -->
- 3 independent product squads sharing one repo and one deploy pipeline <!-- .element: class="fragment fade-up" -->
- 99.5% uptime SLA — failures are expensive <!-- .element: class="fragment fade-up" -->
- Team has zero microservices operational experience <!-- .element: class="fragment fade-up" -->
- 18-month runway, Series A metrics under pressure <!-- .element: class="fragment fade-up" -->

Note: Read the decision question aloud. Let it sit. The context bullets are what make this specific — without them, every architecture answer is "it depends."

---

<!-- ============================================================
  SLIDE 3 — ARCHITECTURE A: WHAT IT IS (auto-animate start)
  ============================================================
  Purpose: Give Architecture A its best possible introduction.
  This is the "hero" slide — show it at its strongest, not weakest.

  HOW TO FILL IN:
  - data-auto-animate-id: set a unique group name (e.g., "arch-a")
    The NEXT slide must have the same id for the animation to work
  - h2: "Architecture A — What It Is"
  - Replace the definition, characteristics, and diagram with your option
  - Keep this slide to definition + 3–4 characteristics ONLY
    (strengths/weaknesses go on the next slide)

  AUTO-ANIMATE NOTE:
  The h2 heading text must be IDENTICAL between this slide and slide 4
  for RevealJS to animate it smoothly to its new position.
  ============================================================ -->

<!-- .slide: data-auto-animate data-auto-animate-id="arch-a" -->

## Monolith <span class="tag tag-info">Architecture A</span>

**A single deployable unit.** All application code, business logic, and services live in one codebase and are deployed together as one process.

<div style="margin-top: 1em; font-size: 0.82em; color: var(--os-text-secondary);">

**Characteristics:**
- One repository, one build, one deploy <!-- .element: class="fragment fade-up" -->
- Shared memory space — function calls between components are cheap <!-- .element: class="fragment fade-up" -->
- Single database (typically), schema versioned together with code <!-- .element: class="fragment fade-up" -->
- Development loop is fast: edit → run → test locally in seconds <!-- .element: class="fragment fade-up" -->

</div>

Note: Don't be dismissive of the monolith. Amazon, Shopify, Stack Overflow, and Basecamp are all monoliths at scale. It's a legitimate architecture, not a stepping stone.

---

<!-- ============================================================
  SLIDE 4 — ARCHITECTURE A: STRENGTHS / WEAKNESSES (auto-animate continuation)
  ============================================================
  Purpose: The honest assessment. Fragments let each point land before
  the next appears — forces the audience to consider each tradeoff.

  HOW TO FILL IN:
  - data-auto-animate-id must MATCH slide 3's id ("arch-a")
  - The h2 text must be IDENTICAL to slide 3 for the heading animation
  - strengths: 3–4 genuine advantages relevant to YOUR context
  - weaknesses: 3–4 genuine disadvantages relevant to YOUR context
  - Use .column.strengths and .column.weaknesses for the color coding

  IMPORTANT: Be honest about weaknesses. If the audience feels you're
  soft-pedaling, they'll distrust the recommendation.
  ============================================================ -->

<!-- .slide: data-auto-animate data-auto-animate-id="arch-a" -->

## Monolith <span class="tag tag-info">Architecture A</span>

<div class="two-column" style="margin-top: 0.6em;">

<div class="column strengths">

### Strengths

- **Simple local dev** — one `npm start`, everything runs <!-- .element: class="fragment fade-up" -->
- **Easy transactions** — ACID across all business logic, no distributed saga patterns <!-- .element: class="fragment fade-up" -->
- **Low operational overhead** — one deploy pipeline, one set of logs, one place to look <!-- .element: class="fragment fade-up" -->
- **Fast initial velocity** — no API contracts to negotiate between teams <!-- .element: class="fragment fade-up" -->

</div>

<div class="column weaknesses">

### Weaknesses

- **Coupled deploys** — one team's bug blocks everyone's release <!-- .element: class="fragment fade-up" -->
- **Scaling is all-or-nothing** — can't scale just the hot path <!-- .element: class="fragment fade-up" -->
- **Growing build times** — test suite and CI grow with the codebase <!-- .element: class="fragment fade-up" -->
- **Tech lock-in** — hard to adopt new languages or runtimes for specific workloads <!-- .element: class="fragment fade-up" -->

</div>

</div>

Note: The coupled deploys weakness is the most relevant to our context — that 35-minute deploy blocking two squads is a direct symptom of this.

---

<!-- ============================================================
  SLIDE 5 — ARCHITECTURE B: WHAT IT IS (auto-animate start)
  ============================================================
  Purpose: Same treatment for Architecture B. Fair, strong intro.

  HOW TO FILL IN:
  - data-auto-animate-id: set a NEW unique group name (e.g., "arch-b")
    Must be different from "arch-a"
  - Follow the same structure as slide 3
  - Keep it to definition + 3–4 characteristics only

  The auto-animate pair is slides 5 → 6. The heading will smoothly
  animate to its new position as the strengths/weaknesses appear.
  ============================================================ -->

<!-- .slide: data-auto-animate data-auto-animate-id="arch-b" -->

## Microservices <span class="tag tag-success">Architecture B</span>

**A distributed system of independent services.** Each service owns its own business domain, database, and deployment lifecycle. Services communicate via APIs (REST/gRPC/events).

<div style="margin-top: 1em; font-size: 0.82em; color: var(--os-text-secondary);">

**Characteristics:**
- Services deploy independently — a change in Billing doesn't require Auth to redeploy <!-- .element: class="fragment fade-up" -->
- Each service can scale independently based on its own traffic patterns <!-- .element: class="fragment fade-up" -->
- Teams own services end-to-end — clear ownership and accountability <!-- .element: class="fragment fade-up" -->
- Polyglot possible — each service can use the best tool for its job <!-- .element: class="fragment fade-up" -->

</div>

Note: The promise of microservices is autonomy — for teams and for infrastructure. But autonomy has a price, which we'll see on the next slide.

---

<!-- ============================================================
  SLIDE 6 — ARCHITECTURE B: STRENGTHS / WEAKNESSES (auto-animate continuation)
  ============================================================
  Purpose: Honest assessment of Architecture B. Mirror structure of slide 4.

  HOW TO FILL IN:
  - data-auto-animate-id must MATCH slide 5's id ("arch-b")
  - The h2 text must be IDENTICAL to slide 5 for heading animation
  - Same fragment pattern as slide 4
  ============================================================ -->

<!-- .slide: data-auto-animate data-auto-animate-id="arch-b" -->

## Microservices <span class="tag tag-success">Architecture B</span>

<div class="two-column" style="margin-top: 0.6em;">

<div class="column strengths">

### Strengths

- **Independent deploys** — teams ship without coordinating <!-- .element: class="fragment fade-up" -->
- **Granular scaling** — scale only the services that need it <!-- .element: class="fragment fade-up" -->
- **Fault isolation** — a crash in Recommendations doesn't take down Checkout <!-- .element: class="fragment fade-up" -->
- **Team autonomy** — squads own their full stack, move at their own pace <!-- .element: class="fragment fade-up" -->

</div>

<div class="column weaknesses">

### Weaknesses

- **Distributed systems complexity** — network failures, latency, partial failures become your problem <!-- .element: class="fragment fade-up" -->
- **Operational burden** — K8s, service mesh, distributed tracing, secrets management, etc. <!-- .element: class="fragment fade-up" -->
- **Data consistency** — no cross-service transactions; eventual consistency everywhere <!-- .element: class="fragment fade-up" -->
- **High upfront investment** — months of platform work before product teams see benefit <!-- .element: class="fragment fade-up" -->

</div>

</div>

Note: That operational burden line is critical for our team. Zero microservices experience + 18-month runway = very limited room for a learning curve that takes months to recover.

---

<!-- ============================================================
  SLIDE 7 — HEAD-TO-HEAD COMPARISON TABLE
  ============================================================
  Purpose: The objective scorecard. Criteria should be specific to
  your decision context — not a generic list.

  HOW TO FILL IN:
  - Replace criteria with the ones that matter for YOUR decision
  - Use .winner, .loser, and .tie CSS classes on <td> elements
    for color-coded results
  - Criteria should be things the audience can independently verify
  - Avoid vague criteria like "simplicity" — prefer "time to first deploy"
  - 6–8 criteria is ideal; fewer is okay if context is obvious

  CSS CLASSES ON <td>:
  - .winner  → green text (this option wins this criterion)
  - .loser   → muted text (this option loses this criterion)
  - .tie     → amber text (roughly equal)
  ============================================================ -->

## Head-to-Head

| Criterion | Monolith | Microservices |
|-----------|----------|---------------|
| **Initial setup time** | <td class="winner">Days</td> | <td class="loser">Months</td> |
| **Local dev experience** | <td class="winner">Single process</td> | <td class="loser">Docker compose complexity</td> |
| **Independent team deploys** | <td class="loser">Blocked by coupling</td> | <td class="winner">True independence</td> |
| **Operational complexity** | <td class="winner">Low</td> | <td class="loser">High (K8s, tracing, mesh)</td> |
| **Data consistency** | <td class="winner">ACID transactions</td> | <td class="loser">Eventual consistency</td> |
| **Granular scaling** | <td class="loser">All-or-nothing</td> | <td class="winner">Per-service</td> |
| **Fault isolation** | <td class="loser">Shared failure domain</td> | <td class="winner">Per-service boundaries</td> |
| **Team experience required** | <td class="winner">Low</td> | <td class="loser">High (distributed systems)</td> |

Note: No option wins every criterion — that's normal and expected. The question is which criteria matter most given OUR constraints. Hint: operational complexity and experience required are the decisive ones here.

---

<!-- ============================================================
  SLIDE 8 — DECISION CRITERIA
  ============================================================
  Purpose: Explain HOW to decide, not what the answer is yet.
  This slide builds the logical foundation for the recommendation.

  HOW TO FILL IN:
  - List the specific factors that tilt the decision in your context
  - Each criterion should tie directly back to context bullets from slide 2
  - Use fragment fade-up — let each point sink in before the next
  - Add a short parenthetical explanation of WHY it matters for your case

  STRUCTURE TIP:
  Group criteria loosely: 2–3 "if A then Monolith" and 2–3 "if B then Microservices"
  criteria, then your final conclusion follows naturally.

  EXAMPLE STRUCTURE:
  "Choose Monolith if... | Choose Microservices if..."
  ============================================================ -->

## Decision Criteria

**Choose the Monolith when:**

- Team has fewer than ~8 engineers and no dedicated platform/ops team <!-- .element: class="fragment fade-up" -->
- You need to move fast and the domain isn't fully understood yet <!-- .element: class="fragment fade-up" -->
- Tight runway — operational overhead costs runway you don't have <!-- .element: class="fragment fade-up" -->

**Choose Microservices when:** <!-- .element: class="fragment fade-up" -->

- Teams are consistently blocked by other teams' code or deploys <!-- .element: class="fragment fade-up" -->
- You have a platform team that can own the infrastructure layer <!-- .element: class="fragment fade-up" -->
- The domain is well-understood and service boundaries are clear <!-- .element: class="fragment fade-up" -->

**Our situation:** <!-- .element: class="fragment fade-up" -->

> 6 engineers, no platform team, 18-month runway, zero distributed systems experience — but real team coupling pain that's slowing us down. <!-- .element: class="fragment fade-up" -->

Note: This is the fulcrum slide. Every criterion connects back to a real fact about our team. The recommendation on the next slide should feel *inevitable* after this.

---

<!-- ============================================================
  SLIDE 9 — RECOMMENDATION
  ============================================================
  Purpose: State the winner clearly. No hedging. Then give the reasons
  in priority order. The gradient background signals this is the payoff slide.

  HOW TO FILL IN:
  - data-background-gradient: same or similar gradient as title slide
    for visual bookending (signals "this is an important slide")
  - .metric-value: the winning option name (or a clear verdict phrase)
  - .metric-label: 4–6 word description of what this means
  - Reasons list: 3–4 bullet points explaining WHY, in priority order
    (most important reason first)
  - .tag-success on reasons that are decisive
  - Final paragraph: the "but keep watching for..." caveat that shows
    you're being honest about the recommendation's limits

  TONE: Confident but not dismissive of the alternative.
  "We recommend X because of A, B, C. Revisit when D changes."
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0c1445 0%, #0c3460 50%, #0a4f6f 100%)" -->

## Recommendation

<div class="metric centered" style="margin: 0.5em 0 1em;">
  <div class="metric-value">Modular Monolith</div>
  <div class="metric-label">Recommended Architecture</div>
</div>

**Why — in priority order:**

- <span class="tag tag-success">Decisive</span> **Runway protection** — microservices migration costs 3–6 months of platform work before any team feels relief <!-- .element: class="fragment fade-up" -->
- <span class="tag tag-success">Decisive</span> **Experience gap** — distributed systems failures in production are unforgiving; we don't have the muscle memory yet <!-- .element: class="fragment fade-up" -->
- <span class="tag tag-primary">Important</span> **Fix the real pain now** — modular monolith with strict module boundaries + separate CI pipelines per module solves the coupling without the ops cost <!-- .element: class="fragment fade-up" -->
- <span class="tag tag-warning">Revisit when</span> hitting >15 engineers, or a dedicated platform hire joins the team <!-- .element: class="fragment fade-up" -->

Note: "Modular monolith" is the honest middle ground — it's not a consolation prize. It directly addresses the deploy coupling pain (separate CI per module is possible) while keeping ops simple for our runway.

---

<!-- ============================================================
  SLIDE 10 — NEXT STEPS
  ============================================================
  Purpose: Convert the recommendation into action. This is the most
  important slide for follow-through — without it, the decision sits
  in a deck and nothing changes.

  HOW TO FILL IN:
  - Replace each step with YOUR specific actions
  - Include: owner, timeline, and success criteria for each step
  - 4–6 steps is ideal — enough to be concrete, few enough to act on
  - Fragment fade-up: let each step appear separately so the owner
    can acknowledge it
  - Use <strong> for the step title, then a plain sentence for detail

  STRUCTURE OF EACH STEP:
  <strong>Action verb + what + by when</strong>
  Brief explanation of why this step and what done looks like.
  ============================================================ -->

## Next Steps

<ol class="steps-list">

<li class="fragment fade-up">
  <div>
    <strong>Define module boundaries this sprint</strong>
    Map the existing codebase into 3–4 domain modules (Auth, Billing, Product, Notifications). No code changes — just document ownership and interfaces.
  </div>
</li>

<li class="fragment fade-up">
  <div>
    <strong>Enforce module boundaries with lint rules (week 2)</strong>
    Add <code>eslint-plugin-import</code> boundary rules so cross-module imports are explicit and reviewed. Failing CI on boundary violations.
  </div>
</li>

<li class="fragment fade-up">
  <div>
    <strong>Split CI pipeline by module (week 3–4)</strong>
    Each module gets its own test suite run in parallel. Merge no longer requires passing the full suite — only affected modules. Target: 35 min → under 10 min per team.
  </div>
</li>

<li class="fragment fade-up">
  <div>
    <strong>Revisit in 6 months with data</strong>
    Track: deploy frequency, mean time to deploy, inter-squad blocking incidents. If coupling pain persists after modularization, microservices conversation reopens with real evidence.
  </div>
</li>

</ol>

Note: The goal is to make the decision feel done and to give every person in the room something to act on. Assign each step an owner before leaving this meeting.
