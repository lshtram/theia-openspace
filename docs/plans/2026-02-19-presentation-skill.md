# Presentation Builder Skill System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a comprehensive presentation-builder skill system for the theia-openspace project that teaches agents how to craft beautiful, effective technical presentations using RevealJS markdown format.

**Architecture:** A master `SKILL.md` focused on design intelligence (how to structure compelling technical presentations), a `revealjs-reference.md` companion for syntax lookup, and five annotated template deck files for the core technical presentation types used in vibe coding sessions.

**Tech Stack:** RevealJS (via Theia Openspace's presentation modality), Markdown, CSS custom properties, OpenCode skill system

---

## Overview

The skill lives at `.opencode/skills/presentation-builder/` and is loaded when an agent needs to create a presentation. The opencode.json skills path must reference this location. Five template files cover the presentation types most needed when explaining technical concepts to users during vibe coding: architecture comparisons, code tutorials, concept explanations, options comparisons, and problem/solution narratives.

---

### Task 1: Create Directory Structure and Register Skills Path

**Files:**
- Create directory: `.opencode/skills/presentation-builder/`
- Create directory: `.opencode/skills/presentation-builder/templates/`
- Modify: `opencode.json`

**Step 1: Create directories**

```bash
mkdir -p .opencode/skills/presentation-builder/templates
```

**Step 2: Add skills path to opencode.json**

The `opencode.json` currently has no `skills` key. Add it:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "skills": {
    "paths": [
      ".opencode/skills"
    ]
  },
  "mcp": { ... }
}
```

**Step 3: Verify directory exists**

```bash
ls -la .opencode/skills/presentation-builder/
ls -la .opencode/skills/presentation-builder/templates/
```

**Step 4: Commit**

```bash
git add opencode.json .opencode/skills/
git commit -m "feat: scaffold presentation-builder skill directory and register skills path"
```

---

### Task 2: Write Master SKILL.md

**Files:**
- Create: `.opencode/skills/presentation-builder/SKILL.md`

**Purpose:** The master skill teaches *design intelligence* — how to structure and craft compelling technical presentations. Agents use this skill once they've decided to build a presentation. It does NOT cover the "should I build a presentation?" question (that belongs in a future meta-communication skill).

**Content to write:**

```markdown
---
name: presentation-builder
description: Use when creating any reveal.js presentation in OpenSpace — architecture reviews, code tutorials, concept explanations, option comparisons, or problem/solution narratives. Covers design principles, slide structure, and RevealJS markdown format.
---

# Presentation Builder

## Overview
OpenSpace presentations use reveal.js rendered in the IDE via `.deck.md` files stored in `design/deck/`. The format is Markdown with YAML frontmatter. This skill teaches you to craft presentations that are visually clear, technically precise, and optimized for explaining complex ideas to a developer during a vibe-coding session.

## Critical: Required Format

ALL presentations MUST have:
1. YAML frontmatter with `title:` field
2. Slide separators `---` between EVERY horizontal slide
3. `===` for vertical (nested) slides

Without these, the presentation renders BLANK.

Minimal working example:
[minimal example from NSO skill]

## File Location

Store all presentations at `design/deck/my-name.deck.md`

## Choose Your Template

Pick the template that matches your intent — copy it from `.opencode/skills/presentation-builder/templates/`:

| Template | When to use |
|----------|------------|
| `architecture-comparison.deck.md` | Comparing two architectural approaches (monolith vs micro, REST vs GraphQL, SQL vs NoSQL) |
| `code-tutorial.deck.md` | Walking through code step by step, teaching a pattern or API |
| `concept-explanation.deck.md` | Explaining how something works (how React reconciliation works, what a JWT is) |
| `options-comparison.deck.md` | Presenting N options with criteria and a recommendation |
| `problem-solution.deck.md` | Problem narrative → diagnosis → solution (used for bug post-mortems, tech debt explanations) |

## Design Principles for Technical Presentations

### The One-Idea-Per-Slide Rule
Each slide answers exactly one question. If you can ask "but what about X?" after reading a slide, that's a second slide.

Bad: A slide titled "Microservices" that covers definition, benefits, drawbacks, and when to use all at once.
Good: Four slides — one per concept, built up sequentially.

### Progressive Disclosure
Never show a conclusion before the audience understands the evidence. Use fragments to reveal bullet points one at a time when each point is a standalone insight. Use slide sequences when each point needs its own visual treatment.

Use fragments when:
- You're listing 3+ parallel items and want the audience to consider each before seeing the next
- You're revealing a conclusion after premises
- You want to highlight one item while others are present

Use separate slides when:
- Each point needs a diagram, code block, or detailed explanation
- The visual transition itself conveys meaning (things are changing, evolving)

### Code on Slides: Show, Don't Tell
For code presentations, show the minimum code needed to make the point. Use line highlighting to direct attention. Use auto-animate between slides to show code evolution.

Rule: If the code block is more than 15 lines, it's probably two slides.
Rule: Always use `[data-line-numbers]` with step highlights for tutorial-style code walks.

### Comparison Slides: Structure for Decision
When comparing options, use a consistent structure so the audience can track the comparison:
- Present each option's "hero" slide first (what is it, at its best)
- Then the head-to-head comparison
- Then the decision criteria
- Finally the recommendation

Never start with the recommendation. The audience needs to build understanding first.

### Title Slide: Signal the Narrative
The title slide sets expectations. Use a subtitle that tells the user what they'll be able to decide or do after watching: "After this: you'll know when to choose Postgres over MongoDB for your use case."

### Closing Slide: Action, Not Summary
Don't summarize. The last slide should answer "so what do I do now?" Give the user a clear next action or decision.

## Themes

For technical presentations in vibe coding sessions, use:
- `openspace-modern` — Default dark theme, great for code-heavy content
- `openspace-ocean` — Blue tones, good for architecture diagrams
- `night` — Dark with orange accents, high contrast
- `moon` — Dark blue, softer on eyes for long explanations

For lighter environments:
- `white` — Clean, professional
- `solarized` — Easy on eyes

## Key RevealJS Features for Technical Presentations

### Code with Step-by-Step Highlights
```markdown
```typescript [1-3|5-8|10-12]
// Step 1: imports highlighted
// Step 2: setup highlighted  
// Step 3: usage highlighted
```
```

### Auto-Animate for Code Evolution
Show code growing or changing between slides:
```markdown
<!-- .slide: data-auto-animate -->
<pre data-id="code"><code data-trim data-line-numbers>
const handler = async (req) => {
  return { status: 200 }
}
</code></pre>

---

<!-- .slide: data-auto-animate -->
<pre data-id="code"><code data-trim data-line-numbers>
const handler = async (req) => {
  const user = await auth(req)
  if (!user) return { status: 401 }
  return { status: 200 }
}
</code></pre>
```

### r-stack for Comparison Reveals
Show one thing at a time in the same visual space:
```markdown
<div class="r-stack">
  <div class="fragment fade-out" data-fragment-index="0">Option A diagram</div>
  <div class="fragment current-visible" data-fragment-index="0">Option B diagram</div>
  <div class="fragment">Final state</div>
</div>
```

### Two-Column Layout for Comparisons
```markdown
<div style="display: flex; gap: 2em;">
  <div style="flex: 1;">
    ## Option A
    - Pro 1
    - Pro 2
  </div>
  <div style="flex: 1;">
    ## Option B
    - Pro 1
    - Pro 2
  </div>
</div>
```

## Full RevealJS Syntax Reference
For complete syntax: `.opencode/skills/presentation-builder/revealjs-reference.md`

## MCP Tools for Presentations

```typescript
// List all presentation files
await mcp.call('presentation.list', {})

// Open in UI
await mcp.call('presentation.open', { name: 'my-deck.deck.md' })

// Read current content
await mcp.call('presentation.read', { name: 'my-deck.deck.md' })

// Update content
await mcp.call('presentation.update', { name: 'my-deck.deck.md', content: newContent })

// Navigate to slide
await mcp.call('presentation.navigate', { slideIndex: 2 })
```

## Validation
Run before presenting:
```bash
node scripts/validate-presentation.js design/deck/my-deck.deck.md
```
```

**Step 1: Write the file** (use Write tool)

**Step 2: Verify it loads correctly**

Ensure the YAML frontmatter is valid (name + description only, under 1024 chars).

**Step 3: Commit**

```bash
git add .opencode/skills/presentation-builder/SKILL.md
git commit -m "feat: add presentation-builder master skill with design intelligence"
```

---

### Task 3: Write revealjs-reference.md

**Files:**
- Create: `.opencode/skills/presentation-builder/revealjs-reference.md`

**Purpose:** Complete syntax cheat sheet for RevealJS markdown. This is a reference document — dense, comprehensive, well-indexed. Agents load this when they need to recall specific syntax.

**Sections to include** (draw from existing NSO skill + gap analysis):

1. **Frontmatter options** — all config keys with types and defaults
2. **Slide separators** — `---` horizontal, `===` vertical
3. **Slide attributes** — `<!-- .slide: ... -->` syntax for background-color, gradient, transition, auto-animate, timing
4. **Element attributes** — `<!-- .element: class="fragment" -->` syntax
5. **All fragment styles** — complete table (fade-in, fade-out, fade-up/down/left/right, grow, shrink, highlight-red/green/blue, etc.)
6. **All transitions** — none, fade, slide, convex, concave, zoom + speeds
7. **All backgrounds** — color, gradient, image (with all options), video (with options), iframe, parallax
8. **Code blocks** — line numbers, step highlights `[1-3|5|7-10]`, line offset, data-trim, data-noescape, HTML entities template
9. **Auto-animate** — data-id matching, settings, groups, restart
10. **Layout helpers** — r-stack, r-fit-text, r-stretch, r-frame
11. **All themes** — complete list with descriptions
12. **Math/LaTeX** — `$$...$$` syntax
13. **Speaker notes** — Note: syntax, aside tag, data-notes
14. **Keyboard shortcuts** — quick reference table

**Step 1: Write the file** (draw heavily from NSO skill's existing coverage, add gaps from quality assessment)

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/revealjs-reference.md
git commit -m "feat: add complete RevealJS syntax reference"
```

---

### Task 4: Create architecture-comparison.deck.md Template

**Files:**
- Create: `.opencode/skills/presentation-builder/templates/architecture-comparison.deck.md`

**Purpose:** A complete, annotated template for comparing two architectural approaches. The structure follows: Title → Context/Problem → Architecture A (hero) → Architecture B (hero) → Head-to-Head Comparison → Decision Criteria → Recommendation → Next Steps.

**Key features to use:**
- `openspace-ocean` theme (blue tones, good for architecture)
- Two-column layout for head-to-head comparison
- Fragments on comparison criteria (reveal one criterion at a time)
- `r-stretch` for diagram images
- Gradient title slide

**Template structure:**

```markdown
---
title: [Architecture A] vs [Architecture B]
theme: openspace-ocean
transition: slide
---

<!-- Slide 1: Title -->
<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" -->
# [Architecture A] vs [Architecture B]
## [Context: what decision are we making?]

Note: Set the context — what problem are we solving? What constraint led us here?

---

<!-- Slide 2: The Decision We're Making -->
# The Question

<div class="highlight-box">
  We need to decide: **[specific decision, e.g., "should we split this monolith?"]**
</div>

**Context:**
- [Current state or constraint]
- [Driver for the decision]
- [Scale/timeline/team consideration]

---

<!-- Slide 3: Option A - What it is at its best -->
<!-- .slide: data-auto-animate -->
# [Architecture A]
## What it looks like

[diagram or description]

---

<!-- Slide 4: Option A strengths/weaknesses -->
<!-- .slide: data-auto-animate -->
# [Architecture A]

<div style="display: flex; gap: 2em;">
  <div>
    **Strengths**
    - [strength 1] <!-- .element: class="fragment fade-up" -->
    - [strength 2] <!-- .element: class="fragment fade-up" -->
  </div>
  <div>
    **Weaknesses**
    - [weakness 1] <!-- .element: class="fragment fade-up" -->
    - [weakness 2] <!-- .element: class="fragment fade-up" -->
  </div>
</div>

---

<!-- Slide 5: Option B - What it is at its best -->
<!-- ... same pattern as option A ... -->

---

<!-- Slide 6: Head-to-Head -->
# Comparison

| Criterion | [Arch A] | [Arch B] |
|-----------|---------|---------|
| [criterion 1] | [A score] | [B score] |
| [criterion 2] | [A score] | [B score] |
| [criterion 3] | [A score] | [B score] |

---

<!-- Slide 7: Decision Criteria (progressive) -->
# What Matters For Your Case?

- **Team size:** [implication] <!-- .element: class="fragment" -->
- **Scale requirements:** [implication] <!-- .element: class="fragment" -->
- **Operational complexity:** [implication] <!-- .element: class="fragment" -->
- **Time to market:** [implication] <!-- .element: class="fragment" -->

---

<!-- Slide 8: Recommendation -->
<!-- .slide: data-background-gradient="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" -->
# Our Recommendation

<div class="metric" style="margin: 1em auto; max-width: 600px;">
  <div class="metric-value">[Architecture A/B]</div>
  <div class="metric-label">for [your specific context]</div>
</div>

**Because:**
- [reason 1]
- [reason 2]
- [reason 3]

---

<!-- Slide 9: Next Steps -->
# Next Steps

1. [Concrete action 1] <!-- .element: class="fragment fade-up" -->
2. [Concrete action 2] <!-- .element: class="fragment fade-up" -->
3. [Concrete action 3] <!-- .element: class="fragment fade-up" -->
```

**Step 1: Write the template file** with full CSS (reuse openspace-modern CSS, adjust for ocean theme), complete annotations, and working examples

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/templates/architecture-comparison.deck.md
git commit -m "feat: add architecture-comparison presentation template"
```

---

### Task 5: Create code-tutorial.deck.md Template

**Files:**
- Create: `.opencode/skills/presentation-builder/templates/code-tutorial.deck.md`

**Purpose:** Template for walking through code step by step. Structure: Title → What We're Building → Setup Code → Core Implementation (with step-by-step highlights) → Complete Code → Usage → Summary.

**Key features to use:**
- `openspace-modern` theme (dark, good for code)
- `data-line-numbers` with `|` step highlights for progressive code reveals
- Auto-animate between code blocks to show code growing
- `data-id` matching for smooth code evolution animations

**Step 1: Write the template with full annotations showing the line-highlight syntax**

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/templates/code-tutorial.deck.md
git commit -m "feat: add code-tutorial presentation template"
```

---

### Task 6: Create concept-explanation.deck.md Template

**Files:**
- Create: `.opencode/skills/presentation-builder/templates/concept-explanation.deck.md`

**Purpose:** Template for explaining a concept (how JWT works, what a message queue does, etc.). Structure: Title → Why This Matters → The Core Idea (analogy) → How It Works (step by step) → Real Code Example → Common Pitfalls → Summary.

**Key features to use:**
- Fragment build-up for the "how it works" sequence
- `r-stack` for showing the same diagram evolving
- Auto-animate for process flow diagrams

**Step 1: Write the template**

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/templates/concept-explanation.deck.md
git commit -m "feat: add concept-explanation presentation template"
```

---

### Task 7: Create options-comparison.deck.md Template

**Files:**
- Create: `.opencode/skills/presentation-builder/templates/options-comparison.deck.md`

**Purpose:** Template for presenting N options with criteria and recommendation. Structure: Title → The Context → [Option X slide for each option] → Decision Matrix → Recommendation → Action.

**Key features to use:**
- Consistent "option card" layout (each option gets same visual treatment)
- Decision matrix table with color-coded scores
- Final recommendation with strong visual treatment (gradient bg, large type)

**Step 1: Write the template (supports 2-4 options)**

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/templates/options-comparison.deck.md
git commit -m "feat: add options-comparison presentation template"
```

---

### Task 8: Create problem-solution.deck.md Template

**Files:**
- Create: `.opencode/skills/presentation-builder/templates/problem-solution.deck.md`

**Purpose:** Template for problem → diagnosis → solution narrative. Used for bug postmortems, explaining tech debt, proposing refactors. Structure: Title → The Problem (what's happening) → Impact (why it matters) → Root Cause → Solution Approach → Implementation → Results/Outcome.

**Key features to use:**
- Dramatic red/dark background for problem slides (visual signal: this is bad)
- Transition to lighter/green tones for solution slides
- Before/after code comparison using auto-animate

**Step 1: Write the template**

**Step 2: Commit**

```bash
git add .opencode/skills/presentation-builder/templates/problem-solution.deck.md
git commit -m "feat: add problem-solution presentation template"
```

---

### Task 9: Add CSS Design System to All Templates

**Files:**
- All 5 template files

**Purpose:** Each template needs a complete `<style>` block in the frontmatter section that establishes the design system. Based on `presentation-modern.deck.md` from the NSO templates but tuned per template type. Shared variables should be consistent across all templates so presentations feel like a cohesive system.

**The design system CSS must include:**
- CSS custom properties (colors, fonts, spacing)
- Headings (gradient text for h1, accent color for h2)
- Lists (custom bullet markers matching theme accent)
- Code blocks (dark background, rounded, shadow)
- Tables (header background, hover effect)
- Blockquotes (left border, muted background)
- Utility classes: `.highlight-box`, `.metric`, `.metric-value`, `.metric-label`, `.two-column`, `.gradient-text`, `.tag`, `.tag-primary`, `.tag-success`, `.tag-warning`
- Fragment transitions (smooth easing)
- Progress bar and controls (matching theme)

**Note:** This task may be done inline while writing each template in Tasks 4-8. If templates already have the CSS, verify it's complete and consistent.

**Step 1: Review all 5 templates for CSS completeness**

**Step 2: Commit if any CSS additions**

```bash
git add .opencode/skills/presentation-builder/templates/
git commit -m "feat: ensure consistent design system CSS across all presentation templates"
```

---

### Task 10: Final Integration Test

**Purpose:** Verify the skill loads correctly and the templates work in OpenSpace.

**Step 1: Verify opencode.json skills path**

```bash
cat opencode.json | grep -A5 skills
```

Expected: `"paths": [".opencode/skills"]`

**Step 2: Verify file structure**

```bash
ls -la .opencode/skills/presentation-builder/
ls -la .opencode/skills/presentation-builder/templates/
```

Expected: SKILL.md, revealjs-reference.md, and 5 template files.

**Step 3: Validate SKILL.md frontmatter**

The `name` field must use only letters, numbers, and hyphens. The description must start with "Use when..." The entire frontmatter must be under 1024 characters.

**Step 4: Quick smoke test — create a test presentation**

If OpenSpace is running, copy a template and open it:

```bash
cp .opencode/skills/presentation-builder/templates/options-comparison.deck.md design/deck/test-presentation.deck.md
# Then open it in the UI via MCP or manually
```

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete presentation-builder skill system with templates"
```

---

## Summary

After completion, the skill system will be at:

```
.opencode/skills/presentation-builder/
  SKILL.md                          # Design intelligence, principles, feature guide
  revealjs-reference.md             # Complete syntax cheat sheet
  templates/
    architecture-comparison.deck.md  # Arch A vs Arch B decision aid
    code-tutorial.deck.md           # Step-through code walkthrough
    concept-explanation.deck.md     # How X works explanation
    options-comparison.deck.md      # N-way option comparison with recommendation
    problem-solution.deck.md        # Problem → diagnosis → solution narrative
```

Agents load `presentation-builder` skill, choose the matching template, fill it in, and open it in OpenSpace via MCP.

Future work: create a meta-communication skill that helps agents decide when to use a presentation vs. inline text vs. a diagram.
