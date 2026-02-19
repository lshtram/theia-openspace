---
name: presentation-builder
description: Use when creating any reveal.js presentation in OpenSpace — architecture comparisons, code tutorials, concept explanations, option comparisons, or problem/solution narratives. Covers design principles, slide structure, and RevealJS markdown format.
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

```markdown
---
title: My Presentation
theme: openspace-modern
---

# First Slide

Content here

---

# Second Slide

More content
```

Key requirements:
- First `---` closes frontmatter
- Use `---` to separate horizontal slides (left/right navigation)
- Use `===` to separate vertical slides (up/down, nested under previous)
- Every slide MUST be separated by `---` or `===`
- Plain markdown with headers only = BLANK presentation

## File Location

Store all presentations at `design/deck/my-name.deck.md`

## Choose Your Template

Pick the template that matches your intent — copy it from `.opencode/skills/presentation-builder/templates/`:

| Template | When to use |
|----------|-------------|
| `architecture-comparison.deck.md` | Comparing two architectural approaches (monolith vs micro, REST vs GraphQL, SQL vs NoSQL) |
| `code-tutorial.deck.md` | Walking through code step by step, teaching a pattern or API |
| `concept-explanation.deck.md` | Explaining how something works (how React reconciliation works, what a JWT is) |
| `options-comparison.deck.md` | Presenting N options with criteria and a recommendation |
| `problem-solution.deck.md` | Problem narrative → diagnosis → solution (bug post-mortems, tech debt, refactor proposals) |

## Design Principles

### The One-Idea-Per-Slide Rule

Each slide answers exactly one question. If you can ask "but what about X?" after reading a slide, that's a second slide.

Bad: A slide titled "Microservices" that covers definition, benefits, drawbacks, and when to use all at once.
Good: Four slides — one per concept, built up sequentially.

### Progressive Disclosure

Never show a conclusion before the audience understands the evidence. Use fragments to reveal bullet points one at a time when each point is a standalone insight. Use slide sequences when each point needs its own visual treatment.

Use **fragments** when:
- Listing 3+ parallel items and you want the audience to consider each before seeing the next
- Revealing a conclusion after premises
- Highlighting one item while others are present

Use **separate slides** when:
- Each point needs a diagram, code block, or detailed explanation
- The visual transition itself conveys meaning (things are changing, evolving)

### Code on Slides: Show, Don't Tell

Show the minimum code needed to make the point. Use line highlighting to direct attention. Use auto-animate between slides to show code evolution.

Rules:
- If the code block is more than 15 lines, it's probably two slides
- Always use `[data-line-numbers]` with step highlights for tutorial-style code walks

### Comparison Slides: Structure for Decision

When comparing options, use a consistent structure:
1. Present each option's "hero" slide first (what is it at its best)
2. Then the head-to-head comparison
3. Then the decision criteria
4. Finally the recommendation

Never start with the recommendation. The audience needs to build understanding first.

### Title Slide: Signal the Narrative

The title slide sets expectations. Use a subtitle that tells the user what they'll be able to decide or do after watching.

Example: "After this: you'll know when to choose Postgres over MongoDB for your use case."

### Closing Slide: Action, Not Summary

Don't summarize. The last slide should answer "so what do I do now?" — give the user a clear next action or decision point.

## Themes

For technical presentations in vibe coding sessions:
- `openspace-modern` — Default dark theme, great for code-heavy content
- `openspace-ocean` — Blue tones, good for architecture diagrams
- `openspace-sunset` — Warm tones, approachable
- `openspace-forest` — Green tones, calm

Built-in RevealJS themes:
- `night` — Dark with orange accents, high contrast
- `moon` — Dark blue, softer on eyes for long explanations
- `white` — Clean, professional
- `solarized` — Easy on eyes for code

## Key RevealJS Features for Technical Presentations

### Code with Step-by-Step Highlights

```markdown
```typescript [1-3|5-8|10-12]
// Step 1: imports highlighted
// Step 2: setup highlighted
// Step 3: usage highlighted
` ``
```

Each `|` separated range is a step — click advances to next highlight group.

### Auto-Animate for Code Evolution

Show code growing or changing between slides — RevealJS smoothly animates matching elements:

```markdown
<!-- .slide: data-auto-animate -->
<pre data-id="code-block"><code data-trim data-line-numbers>
const handler = async (req) => {
  return { status: 200 }
}
</code></pre>

---

<!-- .slide: data-auto-animate -->
<pre data-id="code-block"><code data-trim data-line-numbers>
const handler = async (req) => {
  const user = await auth(req)
  if (!user) return { status: 401 }
  return { status: 200 }
}
</code></pre>
```

The `data-id` attribute on both `<pre>` elements tells RevealJS to animate between them. The value must match between slides.

### r-stack for Layered Reveals

Show one thing at a time in the same visual space:

```markdown
<div class="r-stack">
  <div class="fragment fade-out" data-fragment-index="0">State 1</div>
  <div class="fragment current-visible" data-fragment-index="0">State 2</div>
  <div class="fragment">Final state</div>
</div>
```

### Two-Column Layout for Comparisons

```markdown
<div style="display: flex; gap: 2em; text-align: left;">
  <div style="flex: 1;">

  **Option A**
  - Pro 1
  - Pro 2

  </div>
  <div style="flex: 1;">

  **Option B**
  - Pro 1
  - Pro 2

  </div>
</div>
```

### Fragment Types

```markdown
<!-- .element: class="fragment" -->            fade in (default)
<!-- .element: class="fragment fade-up" -->    slide up while fading in
<!-- .element: class="fragment fade-out" -->   fade out on advance
<!-- .element: class="fragment highlight-red" -->   highlight red
<!-- .element: class="fragment highlight-green" --> highlight green
<!-- .element: class="fragment current-visible" --> visible only for one step
```

### Slide Backgrounds

```markdown
<!-- .slide: data-background-color="#1a1a2e" -->
<!-- .slide: data-background-gradient="linear-gradient(135deg, #0f2027 0%, #2c5364 100%)" -->
<!-- .slide: data-background-image="path/to/image.jpg" data-background-opacity="0.3" -->
```

### Slide Attributes

```markdown
<!-- .slide: data-auto-animate -->
<!-- .slide: data-transition="zoom" -->
<!-- .slide: data-visibility="hidden" -->    skip this slide in presentation
<!-- .slide: data-timing="60" -->            60 seconds for auto-advance
```

### Speaker Notes

```markdown
Note: This note is only visible in speaker view (press S).
```

## MCP Tools for Presentations

```typescript
// List all presentation files
await mcp.call('presentation.list', {})

// Open in the OpenSpace UI
await mcp.call('presentation.open', { name: 'my-deck.deck.md' })

// Read current content
await mcp.call('presentation.read', { name: 'my-deck.deck.md' })

// Update content (full replace)
await mcp.call('presentation.update', { name: 'my-deck.deck.md', content: newContent })

// Navigate to a specific slide
await mcp.call('presentation.navigate', { slideIndex: 2 })
```

## Validation

Run before presenting:

```bash
node scripts/validate-presentation.js design/deck/my-deck.deck.md
```

## Full RevealJS Syntax Reference

For complete syntax details: `.opencode/skills/presentation-builder/revealjs-reference.md`
