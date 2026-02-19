# Block Diagram

**Purpose:** Show functional decomposition of a system into blocks with flows between them. Based on SysML Block Definition Diagram (BDD) and Internal Block Diagram (IBD) conventions.

**diagramType:** `block`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `block` | `rectangle` | A functional block (label: `«block» Name`) |
| `flow-port` | `ellipse` | A flow port on a block boundary (small, w=20, h=20) |
| `value-property` | `rectangle` | A value property inside a block (smaller box) |
| `constraint-block` | `rectangle` | A constraint parametric block |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `item-flow` | Flow of items/data/energy between blocks (labeled with item type) |
| `connector` | Structural connection between blocks |
| `composition` | Whole-part relationship (filled diamond at owner) |
| `dependency` | Block depends on another |

## Semantics Fields

```json
"semantics": {
  "flowItem": "ElectricPower",
  "unit": "W",
  "properties": ["voltage: Voltage", "current: Current"]
}
```

## Layout Convention

- Top-to-bottom decomposition or left-to-right pipeline
- Blocks: w=180, h=100
- Flow ports: w=20, h=20, placed on block boundary edges
- Blocks spaced 250px apart
- Value properties nested inside block with +15px offset

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "block",
  "metadata": { "title": "Power System Blocks", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "source-block",    "kind": "block",      "label": "«block»\nPowerSource",  "layout": { "x": 60,  "y": 100, "w": 180, "h": 100, "locked": false }, "semantics": { "properties": ["voltage: Voltage"] }, "styleToken": "node.default" },
    { "id": "converter-block", "kind": "block",      "label": "«block»\nConverter",    "layout": { "x": 320, "y": 100, "w": 180, "h": 100, "locked": false }, "semantics": { "properties": ["efficiency: Real"] }, "styleToken": "node.system" },
    { "id": "load-block",      "kind": "block",      "label": "«block»\nLoad",         "layout": { "x": 580, "y": 100, "w": 180, "h": 100, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "port-out",        "kind": "flow-port",  "label": "out",                   "layout": { "x": 230, "y": 140, "w": 20,  "h": 20,  "locked": false }, "semantics": { "flowItem": "ElectricPower" }, "styleToken": "node.accent" },
    { "id": "port-in",         "kind": "flow-port",  "label": "in",                    "layout": { "x": 310, "y": 140, "w": 20,  "h": 20,  "locked": false }, "semantics": { "flowItem": "ElectricPower" }, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "f1", "from": "source-block",    "to": "converter-block", "relation": "item-flow", "label": "ElectricPower", "styleToken": "edge.default" },
    { "id": "f2", "from": "converter-block", "to": "load-block",      "relation": "item-flow", "label": "AC Power",      "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Missing `«block»` stereotype in label** — Always include the stereotype to distinguish from generic boxes.
2. **Using plain arrows instead of `item-flow`** — Block diagrams emphasize what flows between blocks; always label flows with the item type.
