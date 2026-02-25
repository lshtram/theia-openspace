# Presentation Themes + Demo Decks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add five new visual themes and five demo decks (one per template) for OpenSpace presentations.

**Architecture:** Themes are implemented as embedded CSS inside `.deck.md` files. Each theme has a showcase deck plus a demo deck that uses the relevant OpenSpace template structure.

**Tech Stack:** Reveal.js Markdown decks, OpenSpace deck conventions

---

### Task 1: Create theme showcase deck — Clarity Editorial

**Files:**
- Create: `design/deck/theme-clarity.deck.md`

**Step 1: Write the deck skeleton with frontmatter + 5 slides**

```markdown
---
title: OpenSpace Clarity
theme: white
transition: slide
---

# OpenSpace Clarity

---

## Typography

---

## Color System

---

## Lists + Callouts

---

## Code + Tables

<!-- CSS appended at end -->
```

**Step 2: Add embedded CSS at the end of the file**

```css
/* Editorial serif headings + warm paper background */
```

**Step 3: Manually verify first slide renders**

Expected: Title slide visible, no blank first slide.

**Step 4: Commit**

```bash
git add design/deck/theme-clarity.deck.md
git commit -m "feat: add clarity editorial theme showcase"
```

---

### Task 2: Create theme showcase deck — Blueprint Systems

**Files:**
- Create: `design/deck/theme-blueprint.deck.md`

**Step 1: Write deck skeleton with 5 slides**
**Step 2: Add CSS (grid background, blueprint palette, mono accents)**
**Step 3: Manual render check**
**Step 4: Commit**

---

### Task 3: Create theme showcase deck — Decision Geometry

**Files:**
- Create: `design/deck/theme-geometry.deck.md`

**Step 1: Write deck skeleton with 5 slides**
**Step 2: Add CSS (bold geometry, high-contrast tags)**
**Step 3: Manual render check**
**Step 4: Commit**

---

### Task 4: Create theme showcase deck — Terminal Lab

**Files:**
- Create: `design/deck/theme-terminal.deck.md`

**Step 1: Write deck skeleton with 5 slides**
**Step 2: Add CSS (terminal code-first styling)**
**Step 3: Manual render check**
**Step 4: Commit**

---

### Task 5: Create theme showcase deck — Incident Response

**Files:**
- Create: `design/deck/theme-incident.deck.md`

**Step 1: Write deck skeleton with 5 slides**
**Step 2: Add CSS (problem→solution with red/green states)**
**Step 3: Manual render check**
**Step 4: Commit**

---

### Task 6: Demo deck — Concept Explanation (SSE)

**Files:**
- Create: `design/deck/demo-concept-sse.deck.md`

**Step 1: Base on `concept-explanation` template structure**
**Step 2: Replace content with SSE topic**
**Step 3: Apply Clarity theme CSS at end**
**Step 4: Manual render check**
**Step 5: Commit**

---

### Task 7: Demo deck — Architecture Comparison (Modular Monolith)

**Files:**
- Create: `design/deck/demo-architecture-modular.deck.md`

**Step 1: Base on `architecture-comparison` template structure**
**Step 2: Replace content with Modular Monolith vs Monolith**
**Step 3: Apply Blueprint theme CSS at end**
**Step 4: Manual render check**
**Step 5: Commit**

---

### Task 8: Demo deck — Options Comparison (Vector DBs)

**Files:**
- Create: `design/deck/demo-options-vector-db.deck.md`

**Step 1: Base on `options-comparison` template structure**
**Step 2: Replace content with Pinecone vs Weaviate vs pgvector**
**Step 3: Apply Decision Geometry theme CSS at end**
**Step 4: Manual render check**
**Step 5: Commit**

---

### Task 9: Demo deck — Code Tutorial (Rate Limiter)

**Files:**
- Create: `design/deck/demo-tutorial-rate-limiter.deck.md`

**Step 1: Base on `code-tutorial` template structure**
**Step 2: Replace content with Node rate limiter**
**Step 3: Apply Terminal theme CSS at end**
**Step 4: Manual render check**
**Step 5: Commit**

---

### Task 10: Demo deck — Problem → Solution (Stream Duplication)

**Files:**
- Create: `design/deck/demo-problem-stream-duplication.deck.md`

**Step 1: Base on `problem-solution` template structure**
**Step 2: Replace content with stream duplication bug**
**Step 3: Apply Incident theme CSS at end**
**Step 4: Manual render check**
**Step 5: Commit**

---

### Task 11: Validation pass

**Step 1: Validate decks with the script**

Run: `node scripts/validate-presentation.js design/deck/theme-clarity.deck.md`

Expected: No errors for all 10 decks.

**Step 2: Commit**

```bash
git add design/deck/demo-*.deck.md design/deck/theme-*.deck.md
git commit -m "feat: add five presentation themes and demos"
```
