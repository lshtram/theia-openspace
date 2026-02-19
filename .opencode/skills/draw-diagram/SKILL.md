---
name: draw-diagram
description: "Use when creating or editing any diagram in the whiteboard modality. Covers all UML types, flowcharts, ER, mind maps, C4, and more. Loads the right type-specific sub-skill and optional theme."
---

# Skill: draw-diagram

## Overview

This skill guides you to create or edit diagrams in the whiteboard modality using tldraw shapes via MCP tools.

**Mental model:** Reason about your diagram using `diagram.json` concepts (nodes, edges, kinds, semantics). Then **translate** those concepts into tldraw shape specs and apply them via the MCP tools below.

## Process

1. **Identify the diagram type** from the user's request (see catalogue below)
2. **Read the type file**: `Read` `.opencode/skills/draw-diagram/types/<type>.md`
3. **Choose a theme** (optional): `Read` `.opencode/skills/draw-diagram/themes/themes.md` then the specific theme file. Default: `technical`.
4. **Compose shapes**: Plan your diagram using the `diagram.json` mental model from the type file, then translate each node and edge to a tldraw shape spec (see translation table below)
5. **Apply** using the MCP tools below

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

## Translation Table: diagram.json → tldraw

### Node kinds → tldraw `geo` shape

| diagram.json `kind` | tldraw `type` | `props.geo` | Typical w × h |
|---|---|---|---|
| `class`, `state`, `action`, `lifeline`, `component`, `object`, `package`, `task-bar`, `swimlane` | `geo` | `rectangle` | 160×60 |
| `decision`, `choice`, `merge`, `firewall`, `milestone` | `geo` | `diamond` | 80×80 |
| `initial`, `final`, `use-case`, `actor` (oval) | `geo` | `ellipse` | 60×60 |
| `cloud` | `geo` | `cloud` | 160×100 |
| `note` | `note` | — | 160×80 |
| `database` | `geo` | `trapezoid` | 160×80 |
| `router`, `hexagon` | `geo` | `hexagon` | 80×80 |
| `fork`, `join` (bar) | `geo` | `rectangle` | 160×10 |
| `frame`, `system-boundary`, `classifier`, `swimlane-header` | `geo` | `rectangle` | 400×300 |

> Note: `initial` and `final` pseudostates should be small (w=40, h=40) and use `fill: "solid"` + dark color.
>
> Note: `fork`/`join` bars should be very thin (h=8–12) and wide (w=120–200).

### Edge styleTokens → tldraw `arrow` props

| `styleToken` / relation | `props.dash` | `props.arrowheadEnd` | `props.arrowheadStart` |
|---|---|---|---|
| `edge.default`, `message`, `flow`, `association`, `uses` | `draw` | `arrow` | `none` |
| `edge.dashed`, `dependency`, `implementation`, `return`, `async` | `dashed` | `arrow` | `none` |
| `inheritance`, `generalization` | `draw` | `triangle` | `none` |
| `composition` | `draw` | `arrow` | `dot` |
| `aggregation` | `draw` | `arrow` | `diamond` |
| `self-call` | `draw` | `arrow` | `none` |

> Arrows use `props.start` and `props.end` (absolute canvas coordinates), NOT width/height.
> For a straight arrow from (x1,y1) to (x2,y2): `start:{x:x1,y:y1}`, `end:{x:x2,y:y2}`.

### Colors (from theme tokens → tldraw named colors)

| Theme token | tldraw color |
|---|---|
| `node.default` fill | `white`, stroke `black` |
| `node.accent` | `blue` |
| `node.system` | `light-blue` |
| `node.external` | `grey` |
| `edge.default` | `black` |
| `edge.dashed` | `grey` |

### Text labels

All text on shapes uses `richText` (ProseMirror doc format):
```json
{
  "type": "doc",
  "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Label text"}]}]
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
| Create new diagram (atomic) | `openspace.whiteboard.replace` | `path`, `shapes[]` |
| Add shapes without clearing | `openspace.whiteboard.batch_add_shapes` | `path`, `shapes[]` |
| Find shapes by label/type | `openspace.whiteboard.find_shapes` | `path`, `label?`, `type?` |
| Update one shape | `openspace.whiteboard.update_shape` | `path`, `shapeId`, `props` |
| Delete one shape | `openspace.whiteboard.delete_shape` | `path`, `shapeId` |
| Read full whiteboard | `openspace.whiteboard.read` | `path` |
| List whiteboards | `openspace.whiteboard.list` | — |
| Open in UI pane | `openspace.whiteboard.open` | `path` |
| Fit camera to shapes | `openspace.whiteboard.camera.fit` | — |

## Hard Rules

1. Always read the type file before composing any diagram
2. Always use semantic `kind` values from the type file for your mental model — translate to tldraw props using the table above
3. Shape IDs must be unique and prefixed with `shape:` (e.g., `shape:user-class`, `shape:login-state`)
4. Layout coordinates must be spatially coherent — no two nodes at the same position
5. For **new** diagrams or **replacing** existing: use `openspace.whiteboard.replace`
6. For **adding to** an existing diagram: use `openspace.whiteboard.batch_add_shapes`
7. For **editing** specific shapes: use `openspace.whiteboard.find_shapes` to locate, then `update_shape`
8. After creating/replacing, call `openspace.whiteboard.camera.fit` to center the view
9. Colors must be tldraw named colors — never hex values
10. Text content must use `richText` format — never a plain `text` string prop
