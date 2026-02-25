# Presentation Themes + Demo Decks Design

## Summary
Create five new visual themes and five demo presentations tailored to the five OpenSpace presentation templates. Each theme is purpose-built for a specific presentation intent (concept explanation, architecture comparison, options comparison, code tutorial, problem→solution) and is applied directly inside deck files via embedded CSS. Each theme also has a showcase deck. Each demo deck uses one template and its paired theme.

## Goals
- Provide distinct visual languages that reinforce the instructional intent.
- Ensure themes are legible for technical content and code.
- Produce 10 ready-to-show decks: 5 theme showcases + 5 demo decks.

## Inputs / References
- Reveal.js built-in themes and guidance: https://revealjs.com/themes/
- SlidesCarnival template style categories (minimalist, modern, professional, creative):
  - https://www.slidescarnival.com/tag/minimalist
  - https://www.slidescarnival.com/tag/modern
  - https://www.slidescarnival.com/tag/professional
  - https://www.slidescarnival.com/tag/creative

## Theme Strategy (one per presentation intent)
1. **Concept Explanation — “Clarity Editorial”**
   - Style: calm, editorial, high readability
   - Visual cues: serif headings, warm paper background, generous spacing
   - Uses: definitions, mental models, step-by-step explanations

2. **Architecture Comparison — “Blueprint Systems”**
   - Style: technical, structured, blueprint-like
   - Visual cues: dark navy, grid background, monospaced accents
   - Uses: diagrams, trade-off tables, system decomposition

3. **Options Comparison — “Decision Geometry”**
   - Style: bold, geometric, decision clarity
   - Visual cues: warm gradients, high-contrast tags, strong headers
   - Uses: multi-option matrices, criteria ranking, selection logic

4. **Code Tutorial — “Terminal Lab”**
   - Style: terminal-inspired, code-first
   - Visual cues: dark charcoal, green accents, dense code blocks
   - Uses: step-by-step code walkthroughs, CLI output, snippets

5. **Problem → Solution — “Incident Response”**
   - Style: narrative, risk → resolution
   - Visual cues: red/orange for problem, green for fix, bold callouts
   - Uses: postmortems, tech debt narratives, debugging stories

## Deliverables
### Theme showcase decks (5)
- `design/deck/theme-clarity.deck.md`
- `design/deck/theme-blueprint.deck.md`
- `design/deck/theme-geometry.deck.md`
- `design/deck/theme-terminal.deck.md`
- `design/deck/theme-incident.deck.md`

### Demo decks (5)
- Concept: `design/deck/demo-concept-sse.deck.md`
- Architecture: `design/deck/demo-architecture-modular.deck.md`
- Options: `design/deck/demo-options-vector-db.deck.md`
- Tutorial: `design/deck/demo-tutorial-rate-limiter.deck.md`
- Problem→Solution: `design/deck/demo-problem-stream-duplication.deck.md`

## Content Topics (demo decks)
- Concept: “How SSE Works (and why it’s not WebSockets)”
- Architecture: “Monolith vs Modular Monolith”
- Options: “Vector DB Choices: Pinecone vs Weaviate vs pgvector”
- Tutorial: “Build a Safe Rate Limiter in Node”
- Problem→Solution: “Chat Stream Duplication Bug — Root Cause to Fix”

## Format Rules
- YAML frontmatter with `title` + `theme` on every deck
- First slide must appear immediately after frontmatter
- All CSS blocks must be placed at the end of the file
- Slides separated with `---` and vertical stacks with `===`

## Validation
- Decks render non-blank (first slide contains visible content)
- CSS applies (distinct typography + color per theme)
- Code blocks readable in tutorial and problem decks
