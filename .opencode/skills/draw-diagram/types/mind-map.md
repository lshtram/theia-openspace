# Mind Map

**Purpose:** Radial hierarchy from a central concept, used for brainstorming, concept mapping, and knowledge organization.

**diagramType:** `mind-map`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `root` | `ellipse` | Central concept — placed at center of canvas (w=200, h=80) |
| `branch` | `rectangle` | First-level topic branching from root (w=160, h=50) |
| `leaf` | `rectangle` | Second-level or deeper sub-topic (w=140, h=40) |
| `note` | `tldraw.note` | Annotation or callout |

## Edge Relations

| relation | Use for |
|---|---|
| `branch` | Root to branch connection |
| `leaf` | Branch to leaf (or leaf to deeper leaf) connection |

## Layout Convention

- Root at canvas center: x=320, y=240 (adjust to canvas size)
- Branches radiate outward at evenly distributed angles, 200px from root center
  - 4 branches: angles 45°, 135°, 225°, 315°
  - 6 branches: angles 0°, 60°, 120°, 180°, 240°, 300°
  - 8 branches: every 45°
- Leaves extend a further 180px from each branch
- Convert polar to cartesian: x = cx + r×cos(θ), y = cy + r×sin(θ)

## Coordinate Reference (root at 320, 240)

| Angle | Branch position | Leaf position |
|---|---|---|
| 0° (right) | (520, 240) | (700, 240) |
| 90° (down) | (320, 440) | (320, 620) |
| 180° (left) | (120, 240) | (-60, 240) |
| 270° (up) | (320, 40) | (320, -140) |
| 45° (down-right) | (461, 381) | (588, 510) |
| 135° (down-left) | (179, 381) | (52, 510) |
| 225° (up-left) | (179, 99) | (52, -30) |
| 315° (up-right) | (461, 99) | (588, -30) |

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "mind-map",
  "metadata": { "title": "Software Architecture Topics", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "beautiful", "tokens": {} },
  "nodes": [
    { "id": "root",         "kind": "root",   "label": "Software Architecture", "layout": { "x": 220, "y": 200, "w": 200, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.system" },
    { "id": "branch-design","kind": "branch", "label": "Design Patterns",       "layout": { "x": 460, "y": 200, "w": 160, "h": 50, "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "branch-infra", "kind": "branch", "label": "Infrastructure",        "layout": { "x": 220, "y": 420, "w": 160, "h": 50, "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "branch-data",  "kind": "branch", "label": "Data Management",       "layout": { "x": -20, "y": 200, "w": 160, "h": 50, "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "branch-api",   "kind": "branch", "label": "API Design",            "layout": { "x": 220, "y": -20, "w": 160, "h": 50, "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "leaf-mvc",     "kind": "leaf",   "label": "MVC",                   "layout": { "x": 660, "y": 160, "w": 120, "h": 40, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "leaf-event",   "kind": "leaf",   "label": "Event-Driven",          "layout": { "x": 660, "y": 240, "w": 120, "h": 40, "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "b1", "from": "root", "to": "branch-design", "relation": "branch", "label": "", "styleToken": "edge.default" },
    { "id": "b2", "from": "root", "to": "branch-infra",  "relation": "branch", "label": "", "styleToken": "edge.default" },
    { "id": "b3", "from": "root", "to": "branch-data",   "relation": "branch", "label": "", "styleToken": "edge.default" },
    { "id": "b4", "from": "root", "to": "branch-api",    "relation": "branch", "label": "", "styleToken": "edge.default" },
    { "id": "l1", "from": "branch-design", "to": "leaf-mvc",   "relation": "leaf", "label": "", "styleToken": "edge.default" },
    { "id": "l2", "from": "branch-design", "to": "leaf-event", "relation": "leaf", "label": "", "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Linear layout** — Mind maps must be radial. Never arrange nodes in rows or columns.
2. **Too many root connections** — Only branches connect directly to root. Leaves connect to branches, not root.
