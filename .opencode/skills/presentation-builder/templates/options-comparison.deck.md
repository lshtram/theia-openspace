---
title: "State Management Options: useState vs Zustand vs Redux Toolkit"
theme: openspace-sunset
transition: slide
transitionSpeed: default
slideNumber: "c/t"
---

<!-- ============================================================
  CUSTOM STYLES
  These classes are used throughout the deck. Adjust colors to
  match your project's brand or the openspace-sunset theme vars.
  ============================================================ -->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── Base ─────────────────────────────────────────────────── */
  :root {
    --os-primary:        #f59e0b;
    --os-primary-light:  #fbbf24;
    --os-accent:         #ef4444;
    --os-accent-light:   #f87171;
    --os-bg-primary:     #0f172a;
    --os-bg-secondary:   #1e293b;
  }

  .reveal {
    font-size: 38px;
  }

  /* ── Headings ─────────────────────────────────────────────── */
  .reveal h1,
  .reveal h2,
  .reveal h3,
  .reveal h4 {
    text-transform: none;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }

  .reveal h1 { font-size: 2.2em; }
  .reveal h2 { font-size: 1.5em; }
  .reveal h3 { font-size: 1.1em; color: var(--os-primary-light); }

  /* ── Lists ────────────────────────────────────────────────── */
  .reveal ul,
  .reveal ol {
    text-align: left;
    font-size: 0.82em;
    line-height: 1.7;
    margin-left: 1.2em;
  }

  .reveal li { margin-bottom: 0.3em; }

  /* ── Code / Pre ───────────────────────────────────────────── */
  .reveal pre {
    width: 100%;
    font-size: 0.68em;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  }

  .reveal code {
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-size: 0.9em;
  }

  /* ── Tables ───────────────────────────────────────────────── */
  .reveal table {
    font-size: 0.72em;
    width: 100%;
    border-collapse: collapse;
  }

  .reveal table th {
    background: var(--os-bg-secondary);
    color: var(--os-primary);
    padding: 0.6em 0.8em;
    font-weight: 700;
    border-bottom: 2px solid var(--os-primary);
  }

  .reveal table td {
    padding: 0.55em 0.8em;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    vertical-align: middle;
  }

  .reveal table tr:nth-child(even) td {
    background: rgba(255,255,255,0.03);
  }

  /* ── Blockquotes ──────────────────────────────────────────── */
  .reveal blockquote {
    background: rgba(245,158,11,0.1);
    border-left: 4px solid var(--os-primary);
    border-radius: 0 8px 8px 0;
    padding: 0.8em 1.2em;
    font-style: normal;
    font-size: 0.8em;
    color: #e2e8f0;
    width: 90%;
    margin: 1em auto;
    text-align: left;
  }

  /* ── Highlight Box ────────────────────────────────────────── */
  .highlight-box {
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.35);
    border-radius: 10px;
    padding: 0.8em 1.2em;
    margin: 0.6em 0;
    text-align: left;
    font-size: 0.78em;
  }

  /* ── Metric (large winner display) ───────────────────────── */
  .metric {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2em;
    margin: 0 0.6em;
  }

  .metric-value {
    font-size: 2.8em;
    font-weight: 800;
    color: var(--os-primary);
    line-height: 1;
    text-shadow: 0 0 30px rgba(245,158,11,0.5);
  }

  .metric-label {
    font-size: 0.65em;
    color: rgba(255,255,255,0.55);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* ── Tags ─────────────────────────────────────────────────── */
  .tag {
    display: inline-block;
    font-size: 0.55em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.25em 0.7em;
    border-radius: 999px;
    margin: 0 0.2em;
    vertical-align: middle;
    border: 1px solid transparent;
  }

  .tag-primary {
    background: rgba(245,158,11,0.2);
    color: var(--os-primary-light);
    border-color: var(--os-primary);
  }

  .tag-success {
    background: rgba(34,197,94,0.15);
    color: #86efac;
    border-color: #22c55e;
  }

  .tag-warning {
    background: rgba(239,68,68,0.15);
    color: var(--os-accent-light);
    border-color: var(--os-accent);
  }

  /* ── Two-column layout ────────────────────────────────────── */
  .two-column {
    display: flex;
    gap: 2em;
    text-align: left;
    align-items: flex-start;
  }

  .two-column > * { flex: 1; min-width: 0; }

  /* ── Gradient text ────────────────────────────────────────── */
  .gradient-text {
    background: linear-gradient(90deg, var(--os-primary) 0%, var(--os-accent-light) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Fragment baseline (ensure visibility before reveal) ─── */
  .reveal .fragment { opacity: 0.15; }
  .reveal .fragment.visible { opacity: 1; }
  .reveal .fragment.current-fragment { opacity: 1; }
</style>

<!-- ============================================================
  SLIDE 1 — TITLE
  Purpose: Set the scene. State the decision that needs to be made.
  Customize:
    - Change the title to your decision topic
    - Update the subtitle to reflect the number of options
    - The gradient gives a premium "this matters" feeling
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" -->

# <span class="gradient-text">State Management</span>

### We're choosing between **3 options**

<br>

`useState` &nbsp;·&nbsp; `Zustand` &nbsp;·&nbsp; `Redux Toolkit`

<br>

<small style="opacity: 0.5;">After this: you'll know which to reach for on your next React project</small>

Note:
Welcome. This deck walks through each option fairly before giving a recommendation.
Our goal is to understand the trade-offs, not to sell a favourite.

---

<!-- ============================================================
  SLIDE 2 — CONTEXT
  Purpose: Establish why this decision matters and what constraints box us in.
  Customize:
    - Replace the problem statement with your actual situation
    - Update the constraints to match your project reality
    - Keep it to 2-3 bullets per section — this isn't the detail slide
  ============================================================ -->

## The Problem We're Solving

<div class="two-column">
<div>

**Situation**

- Mid-size React app (~25 components)
- 3 developers, shipping fast
- Growing need to share state across distant components
- Currently passing props 4+ levels deep ("prop drilling")

</div>
<div>

**Constraints**

- Bundle size matters — mobile users on 3G
- Team is comfortable with React basics, not Redux veterans
- No legacy Redux code to preserve
- Needs to be testable in isolation

</div>
</div>

<br>

> The right answer depends on *your* constraints. Keep these in view as we walk each option.

Note:
Read the constraints aloud. These are the lens through which we evaluate every option.
If the audience has different constraints, flag them now — the recommendation may differ.

---

<!-- ============================================================
  SLIDE 3 — OPTION 1: useState
  Purpose: Give Option 1 a fair "hero" moment before any comparison.
  Customize:
    - Change the option name, one-liner, pros, cons, and tags
    - Left column = identity card. Right column = honest trade-offs.
    - tag-primary = the recommended winner label
    - tag-warning = significant trade-off or limitation label
    - tag-success = a clear strength
  ============================================================ -->

## Option 1: `useState` + Prop Drilling

<div class="two-column">
<div>

<div class="highlight-box">
<strong>React's built-in state</strong><br>
<small style="opacity:0.7;">Local component state, lifted up when shared</small>
</div>

<br>

**When it shines**
- Small components with local-only state
- Prototyping and simple forms
- No setup, no dependencies

<br>

<span class="tag tag-success">Zero dependencies</span>
<span class="tag tag-success">Zero learning curve</span>
<span class="tag tag-warning">Scales poorly</span>

</div>
<div>

**Pros**
- Ships with React — no install, no bundle cost
- Trivial to test: just render and assert
- Every React developer already knows it
- No abstraction to debug through

**Cons**
- Prop drilling becomes painful at depth > 2
- Lifting state causes unnecessary re-renders
- Sharing across sibling subtrees requires a common ancestor
- Context API "fix" comes with its own footguns

</div>
</div>

Note:
This is the default and deserves a fair showing. Many apps stay here forever and are fine.
The key question: how far are you from the pain threshold?

---

<!-- ============================================================
  SLIDE 4 — OPTION 2: Zustand
  Purpose: Same layout as Option 1 — consistency builds trust.
  Customize:
    - Identical structure to Option 1. Swap content only.
    - Use tag-primary on the option you recommend later.
  ============================================================ -->

## Option 2: Zustand

<div class="two-column">
<div>

<div class="highlight-box">
<strong>Minimal global store</strong><br>
<small style="opacity:0.7;">~1KB — state lives outside React, subscribed via hooks</small>
</div>

<br>

**When it shines**
- Shared state across many components
- Quick to add mid-project
- Teams who want Redux-like patterns without Redux

<br>

<span class="tag tag-primary">Recommended</span>
<span class="tag tag-success">Tiny bundle</span>
<span class="tag tag-success">Simple API</span>

</div>
<div>

**Pros**
- Minimal boilerplate — define a store in ~5 lines
- Devtools integration (Zustand ↔ Redux DevTools)
- Works outside React components (in services, utils)
- No providers or context wrappers required
- Fine-grained subscriptions prevent unnecessary re-renders

**Cons**
- Less opinionated — team needs to set conventions
- Smaller ecosystem than Redux (fewer pre-built patterns)
- Easy to abuse into a global god-object
- Devtools UX isn't as polished as RTK

</div>
</div>

Note:
Zustand is often the "Goldilocks" choice — enough structure without ceremony.
Watch out for teams that turn the store into a dumping ground without slice discipline.

---

<!-- ============================================================
  SLIDE 5 — OPTION 3: Redux Toolkit
  Purpose: Same card layout. Mark with a note to delete if only 2 options.
  DELETE THIS ENTIRE SLIDE if you're comparing only 2 options.
  Customize:
    - Swap all content for your third option
    - Adjust tags to reflect its position in the comparison
  ============================================================ -->

## Option 3: Redux Toolkit (RTK)

<div class="two-column">
<div>

<div class="highlight-box">
<strong>Opinionated Redux</strong><br>
<small style="opacity:0.7;">Full-featured: slices, thunks, RTK Query baked in</small>
</div>

<br>

**When it shines**
- Large teams needing enforced conventions
- Complex async flows (RTK Query for data fetching)
- Apps already invested in Redux ecosystem

<br>

<span class="tag tag-warning">Heavy for our case</span>
<span class="tag tag-success">Maximum tooling</span>
<span class="tag tag-success">Industry standard</span>

</div>
<div>

**Pros**
- Best-in-class DevTools: time-travel, action log, state diff
- RTK Query replaces React Query + state for server state
- Mature ecosystem, tons of learning resources
- Enforces consistent slice patterns at scale

**Cons**
- Significant boilerplate even with RTK abstractions
- ~47KB bundle (gzip) — meaningful on mobile
- Steeper learning curve: slices, actions, selectors, thunks
- Overkill for teams not hitting Redux-scale problems

</div>
</div>

Note:
RTK is excellent — for the right team at the right scale. The cost here is bundle size and ramp-up time.
For teams already in the Redux ecosystem, RTK is a clear upgrade from vanilla Redux.

---

<!-- ============================================================
  SLIDE 6 — DECISION MATRIX
  Purpose: Side-by-side scoring gives the audience a data-driven view.
  Customize:
    - Update the criteria rows for what matters in YOUR project
    - Scoring: ✅ great / ⚠️ ok / ❌ poor
    - Add or remove option columns (keep column count = option count)
    - The table header row calls out the winner column
  ============================================================ -->

## Decision Matrix

<style>
  /* Highlight the winning column — adjust nth-child index to match winner position */
  .decision-matrix td:nth-child(3),
  .decision-matrix th:nth-child(3) {
    background: rgba(245,158,11,0.12) !important;
    border-left: 2px solid var(--os-primary);
    border-right: 2px solid var(--os-primary);
  }
</style>

<table class="decision-matrix">
<thead>
<tr>
  <th>Criteria</th>
  <th>useState</th>
  <th>Zustand ⭐</th>
  <th>Redux Toolkit</th>
</tr>
</thead>
<tbody>
<tr><td>Bundle size impact</td><td>✅ None</td><td>✅ ~1KB</td><td>⚠️ ~47KB</td></tr>
<tr><td>Learning curve</td><td>✅ Zero</td><td>✅ Low</td><td>⚠️ Medium–High</td></tr>
<tr><td>Boilerplate</td><td>✅ Minimal</td><td>✅ Minimal</td><td>⚠️ Moderate</td></tr>
<tr><td>Scales to 50+ components</td><td>❌ No</td><td>✅ Yes</td><td>✅ Yes</td></tr>
<tr><td>Testability</td><td>✅ Easy</td><td>✅ Easy</td><td>⚠️ Setup needed</td></tr>
<tr><td>DevTools support</td><td>❌ Minimal</td><td>⚠️ Good</td><td>✅ Excellent</td></tr>
<tr><td>Handles async state</td><td>⚠️ Manual</td><td>⚠️ Manual</td><td>✅ RTK Query</td></tr>
<tr><td>Cross-component sharing</td><td>❌ Prop drill</td><td>✅ Built for it</td><td>✅ Built for it</td></tr>
</tbody>
</table>

Note:
Walk through each row. Pause on the rows that are contentious.
Acknowledge that Redux Toolkit "wins" some rows — we'll explain why it still isn't the right pick for us.

---

<!-- ============================================================
  SLIDE 7 — WHAT MATTERS FOR US
  Purpose: Filter the matrix through YOUR specific project needs.
  Uses fragments so the audience considers each criterion before
  seeing the next — preventing premature conclusions.
  Customize:
    - List 3-5 criteria that are DECISIVE for your project
    - Include a brief "why this matters here" note per item
    - The final fragment should point directly at the recommendation
  ============================================================ -->

## What Matters For Us

<br>

<ul style="font-size: 0.85em; line-height: 2.2;">
  <li class="fragment fade-up">📦 <strong>Bundle size</strong> — our users are on mobile; every KB matters <!-- .element: class="fragment fade-up" --></li>
  <li class="fragment fade-up">🚀 <strong>Time-to-working</strong> — we're shipping next sprint, not relearning state management</li>
  <li class="fragment fade-up">🔗 <strong>Cross-component sharing</strong> — we've already hit the prop-drilling wall; useState won't scale</li>
  <li class="fragment fade-up">🧪 <strong>Testability</strong> — each slice of state needs to be testable without a full app mount</li>
  <li class="fragment fade-up">⚖️ <strong>Overkill risk</strong> — RTK's async story is great, but we're not data-fetching at that scale yet</li>
</ul>

<br>

<p class="fragment fade-up" style="text-align: center; color: var(--os-primary); font-weight: 700;">
  → These criteria point to one clear answer.
</p>

Note:
Let each fragment land. Ask the audience: "Do any of you weigh these differently?"
If someone prioritizes async data fetching, RTK Query becomes more attractive.

---

<!-- ============================================================
  SLIDE 8 — RECOMMENDATION
  Purpose: The payoff. Big, clear, confident.
  Customize:
    - Update .metric-value to your winner's name
    - Replace the reasoning bullets with your 3 strongest reasons
    - Keep this slide to ONE winner — no hedging
    - The gradient background signals "decision made"
  ============================================================ -->

<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f3460 0%, #533483 100%)" -->

## We're Going With

<br>

<div style="text-align: center;">
  <div class="metric">
    <span class="metric-value">Zustand</span>
    <span class="metric-label">State Management</span>
  </div>
</div>

<br>

<div class="two-column" style="font-size: 0.75em; margin-top: 1em;">
<div>

**Why Zustand wins here**
- Ships 47× smaller than RTK — measurable on mobile
- Our team can be productive in an afternoon, not a week
- Fine-grained subscriptions solve our re-render issues without boilerplate

</div>
<div>

**The path forward**
- One shared `useAppStore` hook, organized into logical slices
- Zustand ↔ Redux DevTools for debugging
- Revisit RTK if we add heavy server-state (RTK Query territory)

</div>
</div>

Note:
This is the end of the analysis. The recommendation follows from the criteria we agreed on.
If someone disagrees, go back to the "What Matters For Us" slide — the disagreement is there.

---

<!-- ============================================================
  SLIDE 9 — IF WE HAD CHOSEN DIFFERENTLY
  Purpose: Show intellectual honesty. Acknowledge the other options
  weren't wrong — just wrong FOR US right now.
  This builds trust and helps the audience understand when
  the recommendation would flip.
  Customize:
    - One brief paragraph per alternative you're acknowledging
    - Frame as "Option X would be right if..." not "Option X is bad"
  ============================================================ -->

## If We'd Chosen Differently

<div class="two-column" style="font-size: 0.78em; margin-top: 0.5em;">
<div>

<div class="highlight-box">

**`useState` would be right if...**

Our components were more isolated, props stayed shallow (≤2 levels), and we weren't planning to grow the feature set. Perfect for a dashboard widget library or a single-form micro-app.

</div>

</div>
<div>

<div class="highlight-box">

**Redux Toolkit would be right if...**

We had a larger team needing enforced conventions, significant async data-fetching that RTK Query would own, or we were already on Redux and upgrading. The tooling is genuinely excellent at that scale.

</div>

</div>
</div>

<br>

> The best choice isn't universal — it's context-specific. **Write down your context when you decide, so future-you understands the reasoning.**

Note:
This slide prevents "but we might need Redux later" objections.
Acknowledge the future: if the context changes, the decision should be re-evaluated.

---

<!-- ============================================================
  SLIDE 10 — NEXT STEPS
  Purpose: Close with action, not summary.
  The audience should leave knowing exactly what happens next.
  Customize:
    - Replace with your actual next actions (with owners + dates)
    - Keep to 4-6 items maximum
    - The first item should be doable TODAY
  ============================================================ -->

## Next Steps

<br>

<ol style="font-size: 0.82em; line-height: 2.2;">
  <li><strong>Install Zustand</strong> — <code>npm install zustand</code> — 2 minutes, no config</li>
  <li><strong>Create <code>src/store/useAppStore.ts</code></strong> — migrate the first prop-drilled state (user auth)</li>
  <li><strong>Wire up Redux DevTools</strong> — add the <code>devtools</code> middleware in dev builds</li>
  <li><strong>Document slice conventions</strong> — one short ADR so the team uses the same pattern</li>
  <li><strong>Set a "revisit" checkpoint</strong> — in 3 months, check if RTK Query is worth adding for server state</li>
</ol>

<br>

<p style="text-align: center; font-size: 0.7em; opacity: 0.5;">
  Questions? · Objections? · Edge cases? → Now is the time.
</p>

Note:
End with energy. The goal is to leave the room with a decision made and an action on the board.
If there are unresolved objections, capture them in the ADR as "considered but rejected because...".
