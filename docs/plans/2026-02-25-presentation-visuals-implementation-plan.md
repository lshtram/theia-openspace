# Presentation Visuals Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visual-first playbook to the presentation-builder skill and make all 5 demo decks visually rich with local assets (images + diagrams + charts).

**Architecture:** Store all assets locally under `design/assets/` and reference them in deck slides. Update the skill documentation with explicit visual rules and examples, and revise each demo deck to include 3-5 visuals aligned to topic and theme.

**Tech Stack:** Reveal.js markdown decks, HTML/CSS for charts, TLDraw exports for diagrams, local image assets.

---

### Task 1: Add local asset directories and naming conventions

**Files:**
- Create: `design/assets/images/.gitkeep`
- Create: `design/assets/diagrams/.gitkeep`
- Create: `design/assets/icons/.gitkeep`

**Step 1: Create directories (with .gitkeep)**

Create the three directories above and add `.gitkeep` files so git tracks them.

**Step 2: Commit**

```bash
git add design/assets/images/.gitkeep design/assets/diagrams/.gitkeep design/assets/icons/.gitkeep
git commit -m "chore: add local asset directories for decks"
```

---

### Task 2: Update presentation-builder skill with Visuals Playbook

**Files:**
- Modify: `.opencode/skills/presentation-builder/SKILL.md`

**Step 1: Add Visuals Playbook section**

Include:
- Visual decision tree (diagram vs image vs atmosphere)
- Minimums: 2 visuals per deck; 3-5 for demo decks
- Local asset workflow (search → download → store → reference)
- Asset paths example: `design/assets/images/...`, `design/assets/diagrams/...`
- Attribution note in `Note:` when required

**Step 2: Add local examples**

Add examples using local assets:
- Full background image slide (local path)
- Split layout with diagram image
- HTML/CSS bar chart or axis chart
- TLDraw workflow steps + export guidance

**Step 3: Update template guidance**

Add a short note per template: each demo should include at least 1 diagram + 1 image.

**Step 4: Commit**

```bash
git add .opencode/skills/presentation-builder/SKILL.md
git commit -m "docs: add visuals playbook to presentation builder"
```

---

### Task 3: Source local images for demos (no diagrams yet)

**Files:**
- Add images under `design/assets/images/`

**Step 1: Collect images**

Download and store locally:
- SSE / signal / communication hero image
- Blueprint / architecture hero image
- Geometric abstract divider image
- Terminal / infra hero image
- Incident / operations hero image

Use consistent naming:
- `sse-signal-hero.jpg`
- `modular-blueprint-hero.jpg`
- `geometry-abstract-divider.jpg`
- `terminal-infra-hero.jpg`
- `incident-ops-hero.jpg`

**Step 2: Add attribution notes**

If images require attribution, add the source in speaker notes on the slide where used.

**Step 3: Commit**

```bash
git add design/assets/images/
git commit -m "assets: add local hero imagery for demo decks"
```

---

### Task 4: Create TLDraw diagrams for each demo

**Files:**
- Add diagrams under `design/assets/diagrams/`

**Step 1: Create diagrams in TLDraw**

Produce and export PNG or SVG:
- `sse-flow-diagram.png`
- `modular-monolith-architecture.png`
- `vector-db-flow.png`
- `rate-limiter-flow.png`
- `sse-duplication-fanout.png`

**Step 2: Commit**

```bash
git add design/assets/diagrams/
git commit -m "assets: add TLDraw diagrams for demo decks"
```

---

### Task 5: Revise `demo-concept-sse.deck.md`

**Files:**
- Modify: `design/deck/demo-concept-sse.deck.md`

**Step 1: Add image slide**

Add a title or section divider slide with:
```
<!-- .slide: data-background-image="design/assets/images/sse-signal-hero.jpg" data-background-opacity="0.35" -->
```

**Step 2: Add diagram slide**

Insert a slide with:
```
<img src="design/assets/diagrams/sse-flow-diagram.png" style="width: 90%; border-radius: 12px;">
```

**Step 3: Add chart slide**

Add an HTML/CSS axis chart (latency vs overhead) with theme colors.

**Step 4: Commit**

```bash
git add design/deck/demo-concept-sse.deck.md
git commit -m "feat: add visual slides to SSE concept demo"
```

---

### Task 6: Revise `demo-architecture-modular.deck.md`

**Files:**
- Modify: `design/deck/demo-architecture-modular.deck.md`

**Step 1: Add hero image slide**

Use:
```
<!-- .slide: data-background-image="design/assets/images/modular-blueprint-hero.jpg" data-background-opacity="0.3" -->
```

**Step 2: Add TLDraw architecture diagram slide**

Use:
```
<img src="design/assets/diagrams/modular-monolith-architecture.png" style="width: 92%; border-radius: 10px;">
```

**Step 3: Add HTML/CSS block comparison graphic**

Create a split layout showing module boundaries and seams.

**Step 4: Commit**

```bash
git add design/deck/demo-architecture-modular.deck.md
git commit -m "feat: add visual slides to modular architecture demo"
```

---

### Task 7: Revise `demo-options-vector-db.deck.md`

**Files:**
- Modify: `design/deck/demo-options-vector-db.deck.md`

**Step 1: Add geometry divider image**

Use:
```
<!-- .slide: data-background-image="design/assets/images/geometry-abstract-divider.jpg" data-background-opacity="0.25" -->
```

**Step 2: Add TLDraw data flow diagram**

Use:
```
<img src="design/assets/diagrams/vector-db-flow.png" style="width: 90%; border-radius: 12px;">
```

**Step 3: Add HTML/CSS radar or axis chart**

Show trade-offs for Pinecone, Weaviate, pgvector.

**Step 4: Commit**

```bash
git add design/deck/demo-options-vector-db.deck.md
git commit -m "feat: add visual slides to vector db options demo"
```

---

### Task 8: Revise `demo-tutorial-rate-limiter.deck.md`

**Files:**
- Modify: `design/deck/demo-tutorial-rate-limiter.deck.md`

**Step 1: Add hero image slide**

Use:
```
<!-- .slide: data-background-image="design/assets/images/terminal-infra-hero.jpg" data-background-opacity="0.3" -->
```

**Step 2: Add TLDraw flow diagram**

Use:
```
<img src="design/assets/diagrams/rate-limiter-flow.png" style="width: 90%; border-radius: 12px;">
```

**Step 3: Add HTML/CSS token bucket chart**

Show fill/consume timeline.

**Step 4: Commit**

```bash
git add design/deck/demo-tutorial-rate-limiter.deck.md
git commit -m "feat: add visual slides to rate limiter tutorial demo"
```

---

### Task 9: Revise `demo-problem-stream-duplication.deck.md`

**Files:**
- Modify: `design/deck/demo-problem-stream-duplication.deck.md`

**Step 1: Add incident hero image slide**

Use:
```
<!-- .slide: data-background-image="design/assets/images/incident-ops-hero.jpg" data-background-opacity="0.3" -->
```

**Step 2: Add TLDraw fan-out diagram**

Use:
```
<img src="design/assets/diagrams/sse-duplication-fanout.png" style="width: 90%; border-radius: 12px;">
```

**Step 3: Add HTML/CSS incident timeline or impact chart**

**Step 4: Commit**

```bash
git add design/deck/demo-problem-stream-duplication.deck.md
git commit -m "feat: add visual slides to incident demo"
```

---

### Task 10: Optional theme deck visual slides (only if useful)

**Files:**
- Modify (optional): `design/deck/theme-clarity.deck.md`
- Modify (optional): `design/deck/theme-blueprint.deck.md`
- Modify (optional): `design/deck/theme-geometry.deck.md`
- Modify (optional): `design/deck/theme-terminal.deck.md`
- Modify (optional): `design/deck/theme-incident.deck.md`

**Step 1: Add one visual usage slide**

Only add if it improves clarity. Keep slides minimal and use local assets to show how the theme renders images/diagrams.

**Step 2: Commit (if any changes)**

```bash
git add design/deck/theme-*.deck.md
git commit -m "feat: add visual usage slides to theme decks"
```

---

### Task 11: Manual validation

**Files:**
- All updated deck files

**Step 1: Structure check**

Ensure each updated deck:
- Has valid YAML frontmatter
- Uses `---` separators correctly
- Keeps `<style>` at end of file
- Includes required visuals

**Step 2: Commit any fixes**

If fixes are needed:

```bash
git add design/deck/*.deck.md
git commit -m "fix: adjust deck structure after visuals update"
```

---

### Task 12: Update memory logs (end of session)

**Files:**
- `.opencode/_context/01_memory/active_context.md`
- `.opencode/_context/01_memory/patterns.md`
- `.opencode/_context/01_memory/progress.md`

**Step 1: Update memory**

Add a note about local asset workflow and visuals rule for decks.

**Step 2: Commit**

```bash
git add .opencode/_context/01_memory/active_context.md .opencode/_context/01_memory/patterns.md .opencode/_context/01_memory/progress.md
git commit -m "docs: update memory for presentation visuals workflow"
```
