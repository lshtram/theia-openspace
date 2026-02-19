# Flowchart

**Purpose:** Generic process flow showing steps, decisions, inputs, and outputs. Not tied to any UML standard — commonly used for algorithm documentation, process manuals, and logic diagrams.

**diagramType:** `flowchart`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `start` | `ellipse` | Start terminal (w=100, h=50) |
| `end` | `ellipse` | End terminal (w=100, h=50) |
| `process` | `rectangle` | A process step or action |
| `decision` | `diamond` | A yes/no or conditional branch |
| `document` | `trapezoid` | A document or report |
| `data` | `rhombus` | Input or output data |
| `predefined-process` | `rectangle` | Call to a predefined sub-process (use double vertical bars in label: `‖ValidateInput‖`) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `flow` | Standard control flow |
| `guarded-flow` | Conditional flow — label with `[Yes]` or `[No]` |

## Layout Convention

- Top-to-bottom main path
- Decision branches: `[Yes]` continues downward; `[No]` branches right (+220px x) then rejoins below
- Process nodes: w=160, h=60
- Decision diamonds: w=100, h=80
- Start/end: w=120, h=50
- Node spacing: 100px vertical between steps

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "flowchart",
  "metadata": { "title": "User Registration", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "start",       "kind": "start",    "label": "Start",             "layout": { "x": 170, "y": 20,  "w": 120, "h": 50,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "input-form",  "kind": "data",     "label": "Enter user details","layout": { "x": 160, "y": 130, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "validate",    "kind": "decision", "label": "Valid?",            "layout": { "x": 180, "y": 260, "w": 100, "h": 80,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "create-user", "kind": "process",  "label": "Create Account",   "layout": { "x": 160, "y": 420, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "show-error",  "kind": "process",  "label": "Show Error",       "layout": { "x": 380, "y": 260, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "end",         "kind": "end",      "label": "End",              "layout": { "x": 170, "y": 560, "w": 120, "h": 50,  "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "f1", "from": "start",       "to": "input-form",  "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f2", "from": "input-form",  "to": "validate",    "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f3", "from": "validate",    "to": "create-user", "relation": "guarded-flow", "label": "[Yes]", "styleToken": "edge.default" },
    { "id": "f4", "from": "validate",    "to": "show-error",  "relation": "guarded-flow", "label": "[No]",  "styleToken": "edge.default" },
    { "id": "f5", "from": "show-error",  "to": "input-form",  "relation": "flow",         "label": "retry", "styleToken": "edge.default" },
    { "id": "f6", "from": "create-user", "to": "end",         "relation": "flow",         "label": "",      "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Using process nodes for decisions** — Always use `decision` (diamond) for branching logic, not rectangles.
2. **Forgetting to rejoin branches** — When a branch loops back or re-merges, add the return edge explicitly.
