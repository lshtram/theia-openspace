# Interaction Overview Diagram

**Purpose:** A high-level flowchart of interaction fragments — shows how multiple sequence or interaction scenarios are combined in a control flow.

**diagramType:** `interaction-overview`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `initial` | `ellipse` | Start node (small, w=30, h=30) |
| `final` | `ellipse` | End node (small, w=30, h=30) |
| `interaction-ref` | `rectangle` | Reference to a named interaction (label: `ref: LoginSequence`) |
| `inline-interaction` | `rectangle` | An inline interaction fragment (label: `sd: ValidateUser`) |
| `decision` | `diamond` | Branch point (one in, multiple out) |
| `merge` | `diamond` | Merge point (multiple in, one out) |
| `fork` | `rectangle` | Fork bar for parallel interaction flows (w=160, h=8) |
| `join` | `rectangle` | Join bar (w=160, h=8) |

## Edge Relations

| relation | Use for |
|---|---|
| `flow` | Control flow from one interaction to the next |
| `guarded-flow` | Conditional flow (labeled with `[condition]`) |

## Layout Convention

- Top-to-bottom flow like an activity diagram
- Interaction-ref nodes: w=200, h=80 (large enough to read the ref name)
- Decision diamonds: w=80, h=80
- Spacing: 120px vertically between nodes

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "interaction-overview",
  "metadata": { "title": "Checkout Flow Overview", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "start",        "kind": "initial",         "label": "",                     "layout": { "x": 225, "y": 20,  "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "ref-login",    "kind": "interaction-ref", "label": "ref: LoginSequence",   "layout": { "x": 140, "y": 100, "w": 200, "h": 80,  "locked": false }, "semantics": { "refName": "LoginSequence" },  "styleToken": "node.default" },
    { "id": "dec-auth",     "kind": "decision",        "label": "Authenticated?",       "layout": { "x": 200, "y": 240, "w": 80,  "h": 80,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "ref-checkout", "kind": "interaction-ref", "label": "ref: CheckoutFlow",    "layout": { "x": 140, "y": 390, "w": 200, "h": 80,  "locked": false }, "semantics": { "refName": "CheckoutFlow" }, "styleToken": "node.default" },
    { "id": "ref-error",    "kind": "interaction-ref", "label": "ref: ShowAuthError",   "layout": { "x": 400, "y": 390, "w": 200, "h": 80,  "locked": false }, "semantics": { "refName": "ShowAuthError" }, "styleToken": "node.default" },
    { "id": "end",          "kind": "final",           "label": "",                     "layout": { "x": 225, "y": 540, "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "f1", "from": "start",        "to": "ref-login",    "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f2", "from": "ref-login",    "to": "dec-auth",     "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f3", "from": "dec-auth",     "to": "ref-checkout", "relation": "guarded-flow", "label": "[yes]", "styleToken": "edge.default" },
    { "id": "f4", "from": "dec-auth",     "to": "ref-error",    "relation": "guarded-flow", "label": "[no]",  "styleToken": "edge.default" },
    { "id": "f5", "from": "ref-checkout", "to": "end",          "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f6", "from": "ref-error",    "to": "end",          "relation": "flow",         "label": "",      "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Drawing full sequence details inline** — Use `interaction-ref` to reference named sequences; this diagram shows the flow between them, not the detail within.
2. **Confusing with activity diagrams** — The nodes here represent interactions/sequences, not actions. Labels should reference scenario names.
