---
name: draw-diagram
description: "Use when creating or editing any diagram in the whiteboard modality. Covers all UML types, flowcharts, ER, mind maps, C4, and more. Loads the right type-specific sub-skill and optional theme."
---

# Skill: draw-diagram

## Overview

This skill guides you to create or edit diagrams in the whiteboard modality using the canonical `diagram.json` format. All diagrams are written as structured scene-graph JSON and applied via the `whiteboard.update` MCP tool.

## Process

1. **Identify the diagram type** from the user's request (see catalogue below)
2. **Read the type file**: `Read` `.opencode/skills/draw-diagram/types/<type>.md`
3. **Choose a theme** (optional): If the user mentions aesthetics/style, `Read` `.opencode/skills/draw-diagram/themes/<theme>.md`. Default: `technical`.
4. **Compose the `diagram.json`** following the type file's node kinds, edge relations, semantics, and layout rules
5. **Apply** using the MCP tool

## Diagram Type Catalogue

| Type slug | Description | Type file |
|---|---|---|
| `flowchart` | Process flow with decisions, start/end | `types/flowchart.md` |
| `sequence` | Time-ordered messages between participants | `types/sequence.md` |
| `class` | OOP classes, interfaces, attributes, methods, relationships | `types/class.md` |
| `state` | State machine with transitions and guards | `types/state.md` |
| `activity` | Workflow with actions, decisions, forks, swimlanes | `types/activity.md` |
| `use-case` | Actor-system interactions and relationships | `types/use-case.md` |
| `component` | Software components, interfaces, ports, dependencies | `types/component.md` |
| `deployment` | Physical deployment: nodes, artifacts, environments | `types/deployment.md` |
| `object` | Object instances and slot values | `types/object.md` |
| `timing` | State timelines for concurrent objects over time | `types/timing.md` |
| `er` | Entity-relationship (Crow's Foot notation) | `types/er.md` |
| `mind-map` | Central concept with hierarchical branches | `types/mind-map.md` |
| `block` | Functional block diagrams (SysML-style) | `types/block.md` |
| `c4-context` | C4 Level 1: system context map | `types/c4-context.md` |
| `c4-container` | C4 Level 2: container breakdown | `types/c4-container.md` |
| `network` | Network topology: hosts, switches, protocols | `types/network.md` |
| `gantt` | Task timeline with milestones and dependencies | `types/gantt.md` |
| `package` | UML packages, imports, access dependencies | `types/package.md` |
| `interaction-overview` | Interaction fragments combined in a flow | `types/interaction-overview.md` |
| `composite-structure` | Internal parts and ports of a classifier | `types/composite-structure.md` |
| `communication` | Objects with numbered messages (collaboration) | `types/communication.md` |

## Theme Catalogue

| Theme slug | Use when | File |
|---|---|---|
| `technical` | Developer docs, code review, architecture wikis | `themes/technical.md` |
| `presentation` | Slides, demos, stakeholder communication | `themes/presentation.md` |
| `beautiful` | Portfolio, public docs, polished reports | `themes/beautiful.md` |

Always `Read` `themes/themes.md` first, then the specific theme file.

## Canonical `diagram.json` Schema

```json
{
  "schemaVersion": "1.0",
  "diagramType": "<type-slug>",
  "metadata": {
    "title": "Human-readable title",
    "createdAt": "<ISO timestamp>",
    "updatedAt": "<ISO timestamp>"
  },
  "style": {
    "theme": "<theme-name or 'light'>",
    "tokens": {
      "node.default": { "stroke": "#1f2937", "fill": "#ffffff", "font": "IBM Plex Sans" },
      "edge.default": { "stroke": "#6b7280" }
    }
  },
  "nodes": [
    {
      "id": "unique-stable-id",
      "kind": "<semantic-kind from type file>",
      "label": "Display label",
      "layout": { "x": 100, "y": 100, "w": 160, "h": 60, "locked": false },
      "semantics": { },
      "styleToken": "node.default"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": "source-node-id",
      "to": "target-node-id",
      "relation": "<relation-type from type file>",
      "label": "",
      "styleToken": "edge.default"
    }
  ],
  "groups": [],
  "constraints": [],
  "sourceRefs": {}
}
```

## Layout Rules

- **Spacing**: minimum 80px gap between nodes; typical node: w=160, h=60
- **Sequence/vertical flow**: increment y by 120–140px per step
- **Left-to-right flow**: increment x by 220–250px per step
- **No stacking at origin**: never place multiple nodes at (0,0)
- **Groups/swimlanes**: use x-offset to separate lanes (each lane ~300px wide)
- **Mind maps**: root at center (400,300); branches radiate outward by 200px

## Available MCP Tools

| Action | Tool | Key parameters |
|---|---|---|
| Create or fully replace diagram | `whiteboard.update` | `name`, `content` (JSON string) |
| Read existing diagram | `whiteboard.read` | `name` |
| List diagrams | `whiteboard.list` | — |
| Inspect scene nodes | `drawing.inspect_scene` | — |
| Propose incremental patch | `drawing.propose_patch` | `patch` (IOperation array), `intent` |
| Apply proposed patch | `drawing.apply_patch` | `patchId` |
| Open in UI pane | `pane.open` | `type: "whiteboard"`, `contentId` |

## Hard Rules

1. Always set `diagramType` to the correct slug
2. Always use semantic `kind` values from the type file — never use `kind: "block"` for a lifeline
3. Node IDs must be unique, stable, and meaningful (e.g., `"user-actor"`, not `"node1"`)
4. Layout coordinates must be spatially coherent — no two nodes at the same position
5. The `semantics` object must contain type-specific data (see type file)
6. For **new** diagrams: use `whiteboard.update` with the full JSON
7. For **edits** to existing diagrams: use `drawing.propose_patch` + `drawing.apply_patch`
8. Always `Read` the type file before composing — do not rely on memory alone
