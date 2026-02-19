# Composite Structure Diagram

**Purpose:** Show the internal structure of a classifier — its parts, ports, and how they connect via connectors.

**diagramType:** `composite-structure`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `classifier` | `rectangle` | The outer classifier (class, component, or collaboration) — large container |
| `part` | `rectangle` | An internal part (instance of a class) — label: `/partName : Type` |
| `port` | `rectangle` | A port on a part or classifier boundary (small square, w=16, h=16) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `connector` | Links two parts (or ports) inside the classifier |
| `delegation` | Connects an outer port to an internal part's port |

## Semantics Fields

```json
"semantics": {
  "partType": "AuthService",
  "multiplicity": "1..*",
  "portInterface": "IAuthProvider"
}
```

## Layout Convention

- Classifier: large outer rectangle, w=540, h=320
- Parts inside classifier: offset +40px from classifier edges, w=160, h=80
- Ports: small squares (w=16, h=16) placed at part boundaries
- Parts spaced 120px apart horizontally

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "composite-structure",
  "metadata": { "title": "OrderProcessor Internal Structure", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "classifier",   "kind": "classifier", "label": "OrderProcessor",       "layout": { "x": 40,  "y": 40,  "w": 540, "h": 300, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "part-validator","kind": "part",       "label": "/validator : Validator","layout": { "x": 80,  "y": 120, "w": 160, "h": 80,  "locked": false }, "semantics": { "partType": "Validator" },  "styleToken": "node.default" },
    { "id": "part-shipper",  "kind": "part",       "label": "/shipper : Shipper",   "layout": { "x": 360, "y": 120, "w": 160, "h": 80,  "locked": false }, "semantics": { "partType": "Shipper" },    "styleToken": "node.default" },
    { "id": "port-in",       "kind": "port",       "label": "in",                   "layout": { "x": 32,  "y": 152, "w": 16,  "h": 16,  "locked": false }, "semantics": { "portInterface": "IOrder" }, "styleToken": "node.accent" },
    { "id": "port-bridge",   "kind": "port",       "label": "",                     "layout": { "x": 236, "y": 152, "w": 16,  "h": 16,  "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "c1", "from": "part-validator", "to": "part-shipper", "relation": "connector",  "label": "validated order", "styleToken": "edge.default" },
    { "id": "d1", "from": "port-in",        "to": "part-validator","relation": "delegation", "label": "",               "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Placing parts outside the classifier boundary** — All parts must be spatially nested inside the classifier rectangle.
2. **Using this as a class diagram** — Composite structure shows internal instantiation (parts), not class inheritance or abstract structure.
