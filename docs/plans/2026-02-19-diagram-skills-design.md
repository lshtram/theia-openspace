# Diagram Skills System — Design Document

> **Date:** 2026-02-19  
> **Status:** Approved  
> **Author:** brainstorming session

---

## 1. Problem

The agent can write `diagram.json` files, but has no structured knowledge of:
- What nodes/edges/semantics to use per diagram type
- What layout conventions apply (left-to-right, top-to-bottom, swimlanes, etc.)
- What style tokens to set for different aesthetic goals

Without this knowledge, the agent produces generic boxes and arrows that technically render but are semantically wrong (e.g., a sequence diagram with no lifelines, a class diagram with no method/attribute notation).

---

## 2. Solution

A skill system for diagram creation, organized as:

```
.opencode/skills/
  draw-diagram/
    SKILL.md                    ← master skill, auto-discovered by OpenCode
    types/
      flowchart.md
      sequence.md
      class.md
      state.md
      activity.md
      use-case.md
      component.md
      deployment.md
      object.md
      timing.md
      er.md
      mind-map.md
      block.md
      c4-context.md
      c4-container.md
      network.md
      gantt.md
      package.md
      interaction-overview.md
      composite-structure.md
    themes/
      themes.md                 ← theme index and shared token definitions
      presentation.md
      technical.md
      beautiful.md
```

---

## 3. Discovery Mechanism

OpenCode automatically discovers skills in `.opencode/skills/<name>/SKILL.md` by walking up from the working directory. No registration in `opencode.json` is needed.

**Future install path:** When a user installs the OpenSpace IDE, an install/setup script merges the project's `.opencode/skills/` paths into the user's global `~/.config/opencode/` config — so skills ship with the product and become globally available post-install, without requiring file copying.

---

## 4. Master Skill Design (`draw-diagram/SKILL.md`)

The master skill:
1. Lists all available diagram types with one-line descriptions
2. Instructs the agent to identify the requested type
3. Directs the agent to `Read` the specific type file
4. Directs the agent to optionally `Read` a theme file
5. Provides the canonical `diagram.json` schema reference
6. Lists available MCP tools (`whiteboard.update`, `drawing.propose_patch`, etc.)
7. Enforces layout and semantic quality rules

---

## 5. Diagram Type Files

Each type file (`types/<type>.md`) covers:

| Section | Content |
|---|---|
| **Purpose** | What this diagram communicates |
| **Node kinds** | Semantic `kind` values to use (e.g., `lifeline`, `actor`, `class`) |
| **Edge relations** | Valid relation types (e.g., `message`, `inheritance`, `dependency`) |
| **Semantics fields** | What goes in `node.semantics` (e.g., `attributes`, `methods`, `guards`) |
| **Layout conventions** | Direction, spacing, grouping rules |
| **Annotated example** | Complete `diagram.json` fragment showing a minimal valid diagram |
| **Common mistakes** | Anti-patterns to avoid |

---

## 6. Theme Files

### `themes/themes.md` (index)
Defines named themes and the style token structure. Agent reads this first, then reads the specific theme file if needed.

| Theme | Use case | Aesthetic |
|---|---|---|
| `presentation` | Slides, demos, stakeholder comms | Large text, bold colors, minimal clutter |
| `technical` | Architecture docs, code review, developer wikis | Dense info, neutral tones, fine lines |
| `beautiful` | Portfolio, public-facing materials, reports | Polished gradients, custom palette, refined spacing |

### Theme file structure
Each theme file defines:
- `style.theme` value to set
- `style.tokens` key/value pairs for fill, stroke, font, size
- Node default overrides
- Edge default overrides
- Recommended layout density (`compact` / `normal` / `spacious`)

---

## 7. Diagram Type Coverage

### UML (13 standard)
1. `class` — classes, interfaces, attributes, methods, relationships
2. `sequence` — lifelines, activation bars, messages (sync/async/return)
3. `use-case` — actors, use cases, system boundary, include/extend
4. `activity` — action nodes, decision/merge, fork/join, swimlanes
5. `component` — components, interfaces, ports, dependencies
6. `state` — states, transitions, guards, entry/exit actions
7. `deployment` — nodes, artifacts, deployment specs
8. `object` — object instances, slot values, links
9. `timing` — lifelines on timeline, state transitions over time
10. `package` — packages, dependencies, import/access
11. `interaction-overview` — combined fragment of interaction refs
12. `composite-structure` — internal parts, ports, connectors
13. `communication` (collaboration) — objects, numbered messages

### Non-UML Common
14. `flowchart` — process flow, decision diamonds, start/end
15. `er` — entities, attributes, relationships (Crow's Foot)
16. `mind-map` — central concept, branches, leaves
17. `block` — functional blocks, signals, information flows
18. `c4-context` — C4 Level 1: systems, actors, external systems
19. `c4-container` — C4 Level 2: containers (apps, DBs, APIs)
20. `network` — physical/logical network topology
21. `gantt` — tasks, timelines, milestones, dependencies

---

## 8. Canonical `diagram.json` Schema (relevant fields per skill)

```json
{
  "schemaVersion": "1.0",
  "diagramType": "<type-slug>",
  "metadata": { "title": "...", "createdAt": "...", "updatedAt": "..." },
  "style": {
    "theme": "<theme-name>",
    "tokens": {
      "node.default": { "stroke": "#...", "fill": "#...", "font": "..." },
      "edge.default": { "stroke": "#...", "dash": "solid|dashed" }
    }
  },
  "nodes": [
    {
      "id": "unique-id",
      "kind": "<semantic-kind>",
      "label": "Display Label",
      "layout": { "x": 0, "y": 0, "w": 160, "h": 60, "locked": false },
      "semantics": { /* type-specific fields */ },
      "styleToken": "node.default"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": "node-id",
      "to": "node-id",
      "relation": "<relation-type>",
      "label": "optional",
      "styleToken": "edge.default"
    }
  ],
  "groups": [],
  "constraints": [],
  "sourceRefs": {}
}
```

---

## 9. MCP Tool Integration

Skills reference the available MCP tools:

| Task | Tool |
|---|---|
| Create new diagram | `whiteboard.update` with full JSON |
| Inspect existing | `whiteboard.read` or `drawing.inspect_scene` |
| Patch existing | `drawing.propose_patch` + `drawing.apply_patch` |
| Open in UI | `pane.open` with `type: "whiteboard"` |

---

## 10. File Layout (Final)

```
theia-openspace/
  .opencode/
    skills/
      draw-diagram/
        SKILL.md
        types/
          flowchart.md
          sequence.md
          class.md
          state.md
          activity.md
          use-case.md
          component.md
          deployment.md
          object.md
          timing.md
          er.md
          mind-map.md
          block.md
          c4-context.md
          c4-container.md
          network.md
          gantt.md
          package.md
          interaction-overview.md
          composite-structure.md
          communication.md
        themes/
          themes.md
          presentation.md
          technical.md
          beautiful.md
```

Total: 1 master skill + 21 type files + 4 theme files = **26 markdown files**

---

## 11. Quality Standards for Skills

Each skill file must:
- Include a complete working `diagram.json` example (not pseudocode)
- Show real `kind` values that map to valid tldraw `geo` shapes
- Include layout coordinates that are spatially coherent (nodes don't overlap)
- Cross-reference the `tldrawMapper.ts` geo types available
- Flag at least 2 common mistakes agents make for that type
