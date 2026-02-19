# State Diagram

**Purpose:** Show the life cycle of an object: states it can be in and the transitions triggered by events.

**diagramType:** `state`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `initial` | `ellipse` | Filled start pseudostate (small, w=30, h=30) |
| `final` | `ellipse` | End state (double circle — use label "●" or "END") |
| `state` | `rectangle` | Named state |
| `choice` | `diamond` | Choice/branch pseudostate |
| `fork` | `rectangle` | Fork bar (narrow horizontal: w=120, h=10) |
| `join` | `rectangle` | Join bar (narrow horizontal: w=120, h=10) |
| `composite-state` | `rectangle` | State containing nested sub-states (larger) |

## Edge Relations

| relation | Use for |
|---|---|
| `transition` | Standard state transition (labeled with `event [guard] / action`) |
| `internal` | Internal transition (no state change) |
| `completion` | Unnamed completion transition |

## Semantics Fields

```json
"semantics": {
  "entry": "startTimer()",
  "exit": "cancelTimer()",
  "doActivity": "processRequest()",
  "guard": "[balance > 0]",
  "trigger": "paymentReceived"
}
```

## Layout Convention

- Top-to-bottom flow: initial at top, final at bottom
- States spaced 140px apart vertically
- Choice pseudostates (diamonds): w=60, h=60
- Fork/join bars: w=120, h=12

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "state",
  "metadata": { "title": "Order State Machine", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "init",    "kind": "initial", "label": "",          "layout": { "x": 205, "y": 40,  "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "pending", "kind": "state",   "label": "Pending",   "layout": { "x": 140, "y": 120, "w": 160, "h": 60,  "locked": false }, "semantics": { "entry": "notifyUser()" }, "styleToken": "node.default" },
    { "id": "paid",    "kind": "state",   "label": "Paid",      "layout": { "x": 140, "y": 260, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "shipped", "kind": "state",   "label": "Shipped",   "layout": { "x": 140, "y": 400, "w": 160, "h": 60,  "locked": false }, "semantics": { "entry": "sendTracking()" }, "styleToken": "node.default" },
    { "id": "final",   "kind": "final",   "label": "Delivered", "layout": { "x": 140, "y": 540, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "t1", "from": "init",    "to": "pending", "relation": "completion", "label": "",               "styleToken": "edge.default" },
    { "id": "t2", "from": "pending", "to": "paid",    "relation": "transition",  "label": "paymentReceived", "styleToken": "edge.default" },
    { "id": "t3", "from": "paid",    "to": "shipped", "relation": "transition",  "label": "dispatch",        "styleToken": "edge.default" },
    { "id": "t4", "from": "shipped", "to": "final",   "relation": "transition",  "label": "delivered",       "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Missing initial pseudostate** — Every state diagram must start with an `initial` node.
2. **Using transitions without labels** — All transitions (except from initial) must have an event/trigger label.
