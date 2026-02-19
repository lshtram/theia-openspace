# Component Diagram

**Purpose:** Show the physical or logical decomposition of a system into components with interfaces.

**diagramType:** `component`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `component` | `rectangle` | A software component (labeled with `«component»` stereotype) |
| `interface` | `ellipse` | A provided interface (lollipop notation — small circle, w=30, h=30) |
| `required-interface` | `ellipse` | A required interface (arc notation — small, w=30, h=30) |
| `port` | `rectangle` | Port on a component (small square on boundary, w=16, h=16) |
| `subsystem` | `rectangle` | Subsystem grouping (large container box) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `dependency` | Component depends on another |
| `realization` | Component provides/realizes an interface |
| `usage` | Component uses/requires an interface |
| `assembly` | Provided interface connects to required interface |

## Layout Convention

- Left-to-right: client components on left, service/infrastructure on right
- Components: w=180, h=80
- Interfaces (lollipop): w=30, h=30, positioned at component boundary
- Node spacing: 240px horizontal, 120px vertical

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "component",
  "metadata": { "title": "API Architecture", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "web",   "kind": "component", "label": "«component»\nWeb App",  "layout": { "x": 60,  "y": 100, "w": 180, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "api",   "kind": "component", "label": "«component»\nREST API", "layout": { "x": 320, "y": 100, "w": 180, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.system" },
    { "id": "db",    "kind": "component", "label": "«component»\nDatabase", "layout": { "x": 580, "y": 100, "w": 180, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.external" },
    { "id": "iface", "kind": "interface", "label": "IUserAPI",              "layout": { "x": 260, "y": 126, "w": 30,  "h": 30, "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "e1", "from": "web", "to": "iface", "relation": "usage",       "label": "", "styleToken": "edge.dashed" },
    { "id": "e2", "from": "api", "to": "iface", "relation": "realization", "label": "", "styleToken": "edge.default" },
    { "id": "e3", "from": "api", "to": "db",    "relation": "dependency",  "label": "", "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Drawing components as plain boxes without stereotype** — Always include `«component»` in the label or semantics.
2. **Connecting components directly instead of through interfaces** — Prefer interface-mediated connections for architectural diagrams.
