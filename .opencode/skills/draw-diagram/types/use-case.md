# Use Case Diagram

**Purpose:** Show what a system does from the perspective of external actors — functional scope.

**diagramType:** `use-case`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `actor` | `oval` | External human or system interacting with the subject |
| `use-case` | `ellipse` | A functional behavior the system provides |
| `system-boundary` | `rectangle` | The subject system boundary box (large, contains use-cases) |
| `note` | `tldraw.note` | Annotations |

## Edge Relations

| relation | Use for |
|---|---|
| `association` | Actor participates in use case |
| `include` | One use case always includes another (labeled `«include»`) |
| `extend` | One use case optionally extends another (labeled `«extend»`) |
| `generalization` | Actor or use case specializes another |

## Layout Convention

- Actors on the **left** (and sometimes right) outside the system boundary
- Use cases inside the system boundary box, centered
- System boundary: large rectangle, x=200, y=50, w=400, h=400+
- Actor nodes: x=60, y=100+ (left side); w=80, h=80 (oval)
- Use case nodes: x=220–500, y=80–400; w=160, h=60 (ellipse)

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "use-case",
  "metadata": { "title": "E-Commerce Use Cases", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "customer",    "kind": "actor",           "label": "Customer",        "layout": { "x": 40,  "y": 180, "w": 80,  "h": 80,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "boundary",    "kind": "system-boundary", "label": "Online Store",    "layout": { "x": 160, "y": 40,  "w": 420, "h": 380, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "uc-browse",   "kind": "use-case",        "label": "Browse Products", "layout": { "x": 200, "y": 100, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "uc-checkout", "kind": "use-case",        "label": "Checkout",        "layout": { "x": 200, "y": 220, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "uc-payment",  "kind": "use-case",        "label": "Process Payment", "layout": { "x": 400, "y": 220, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "customer",    "to": "uc-browse",   "relation": "association", "label": "",          "styleToken": "edge.default" },
    { "id": "e2", "from": "customer",    "to": "uc-checkout", "relation": "association", "label": "",          "styleToken": "edge.default" },
    { "id": "e3", "from": "uc-checkout", "to": "uc-payment",  "relation": "include",     "label": "«include»", "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Connecting actors to system boundary** — Actors associate with use cases, not the boundary box.
2. **Making use-case labels action-less** — Labels must be verb phrases: "Process Payment", not just "Payment".
