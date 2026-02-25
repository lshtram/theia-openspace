---
title: "Presentation Visuals Expansion Design"
date: 2026-02-25
status: approved
owners:
  - opencode-agent
related:
  - docs/plans/2026-02-25-presentation-themes-design.md
  - docs/plans/2026-02-25-presentation-themes-implementation-plan.md
---

# Presentation Visuals Expansion Design

## Goal

Make demo decks visually rich and topic-appropriate while updating the presentation-builder skill to enforce and explain visual usage. Visuals should emphasize relationships (diagrams), metaphors (images/illustrations), and atmosphere (fallback only). All assets must be local.

## Scope

- Update `.opencode/skills/presentation-builder/SKILL.md` with a Visuals Playbook and local asset workflow.
- Revise the 5 demo decks to add 3-5 visuals each, aligned to the theme and the topic.
- Optional: add a single "visual usage" slide to theme decks only if it clearly demonstrates how the theme renders imagery or diagrams.

## Visual Strategy

### Selection Rules

1. **Diagram first** when describing structure, flow, or architecture.
2. **Image/illustration** when a metaphor or emotional hook clarifies the idea.
3. **Atmosphere image** only for title/section divider slides.

### Minimum Visuals per Demo Deck

- 1 diagram (TLDraw export or HTML/CSS diagram)
- 1 image/illustration (local asset)
- 1 chart or comparison graphic (HTML/CSS)
- Total: 3-5 visuals per demo deck

### Asset Storage

```
design/
  assets/
    images/
    diagrams/
    icons/
```

- Use consistent names: `sse-signal-hero.jpg`, `modular-monolith-diagram.png`.
- Keep images neutral and reusable; avoid text-heavy imagery.
- Store attribution in speaker notes where required.

## Skill Updates (presentation-builder)

Add a new **Visuals Playbook** section with:

- A decision tree for choosing diagram vs image vs atmosphere.
- Minimum visual requirement: 2 visuals per deck; 3-5 for demo decks.
- Examples using **local assets**:
  - Full background image slide
  - Split layout (text + diagram image)
  - HTML/CSS bar chart
  - Mermaid/TLDraw diagram guidance
- Explicit local-asset workflow steps:
  - Search → download → store under `design/assets/` → reference in deck
- Theme alignment note: diagrams and shapes must use CSS variables from the active theme.

## Demo Deck Visual Plan

### `demo-concept-sse.deck.md` (theme-clarity)

- TLDraw diagram: SSE connection flow (client ⇄ server stream)
- HTML/CSS scatter or axis chart: latency vs overhead
- Local image: communication/signal-themed hero or section divider

### `demo-architecture-modular.deck.md` (theme-blueprint)

- TLDraw architecture diagram: monolith vs modular monolith
- HTML/CSS block comparison: module boundaries and seams
- Local image: blueprint/architecture photo for title

### `demo-options-vector-db.deck.md` (theme-geometry)

- TLDraw data flow: app → embeddings → vector DB → retrieval
- HTML/CSS radar/axis chart: trade-offs across options
- Local illustration: geometric abstract divider

### `demo-tutorial-rate-limiter.deck.md` (theme-terminal)

- TLDraw flow: request → limiter gate → accept/reject
- HTML/CSS chart: token bucket fill/consume timeline
- Local image: terminal/infra background for title

### `demo-problem-stream-duplication.deck.md` (theme-incident)

- TLDraw diagram: duplicated SSE listeners fan-out
- HTML/CSS chart: incident timeline or impact bars
- Local image: incident/ops hero background

## Theme Decks

Leave theme decks largely unchanged. Optionally add one slide to demonstrate how a theme handles imagery/diagrams if it improves clarity.

## Quality Gates

- All images referenced locally under `design/assets/`.
- Each demo deck includes the minimum visuals.
- Visuals align to theme colors and typography.
- No text-heavy slides with busy backgrounds.

## Risks

- Asset sourcing overhead: mitigated by reusing a shared asset pack.
- Visual overload: mitigated by one-idea-per-slide and restrained use of atmosphere images.

## Non-Goals

- Generative image creation (future enhancement when model access is available).
- Full redesign of theme showcase decks.
