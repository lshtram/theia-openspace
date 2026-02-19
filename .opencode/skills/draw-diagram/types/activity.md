# Activity Diagram

**Purpose:** Model workflow or algorithmic behavior — actions, decisions, concurrency, swimlanes.

**diagramType:** `activity`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `initial` | `ellipse` | Start node (small filled circle, w=30, h=30) |
| `final` | `ellipse` | End node (w=30, h=30) |
| `action` | `rectangle` | An activity step or action |
| `decision` | `diamond` | Branch point (one in, multiple out) |
| `merge` | `diamond` | Merge point (multiple in, one out) |
| `fork` | `rectangle` | Fork bar for parallel flows (w=160, h=8) |
| `join` | `rectangle` | Join bar for parallel flows (w=160, h=8) |
| `swimlane` | `rectangle` | Swimlane header (tall, narrow; acts as label) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `flow` | Control flow (standard arrow) |
| `guarded-flow` | Labeled with `[condition]` |
| `object-flow` | Data/object passing between actions |

## Layout Convention

- Top-to-bottom: initial at top, actions flow downward, +100px per step
- Decisions: w=100, h=60 (diamond shape)
- Swimlane headers: x varies per lane, y=0, w=220, h=40; actions within at x+30, y=80+
- Fork/join bars: w=160, h=10, centered across parallel lanes

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "activity",
  "metadata": { "title": "Order Processing", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "start",       "kind": "initial",  "label": "",              "layout": { "x": 205, "y": 20,  "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "receive",     "kind": "action",   "label": "Receive Order", "layout": { "x": 140, "y": 100, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "check-stock", "kind": "decision", "label": "In Stock?",     "layout": { "x": 170, "y": 220, "w": 100, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "ship",        "kind": "action",   "label": "Ship Order",    "layout": { "x": 140, "y": 360, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "backorder",   "kind": "action",   "label": "Back-Order",    "layout": { "x": 360, "y": 360, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "end",         "kind": "final",    "label": "",              "layout": { "x": 205, "y": 500, "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "f1", "from": "start",       "to": "receive",     "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f2", "from": "receive",     "to": "check-stock", "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f3", "from": "check-stock", "to": "ship",        "relation": "guarded-flow", "label": "[yes]", "styleToken": "edge.default" },
    { "id": "f4", "from": "check-stock", "to": "backorder",   "relation": "guarded-flow", "label": "[no]",  "styleToken": "edge.default" },
    { "id": "f5", "from": "ship",        "to": "end",         "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f6", "from": "backorder",   "to": "end",         "relation": "flow",         "label": "",      "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Forgetting merge nodes** — When two branches rejoin, add a `merge` diamond before the next action.
2. **Oversized fork/join bars** — Keep them thin: h=8–12, not the full 60px of a regular node.
