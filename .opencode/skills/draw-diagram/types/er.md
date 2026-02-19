# Entity-Relationship Diagram

**Purpose:** Show entities (tables/objects), their attributes, and the relationships between them. Uses Crow's Foot notation for cardinality.

**diagramType:** `er`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `entity` | `rectangle` | A data entity or table (w=180, h=60) |
| `weak-entity` | `rectangle` | A weak entity — depends on another (set `semantics.weak: true`) |
| `attribute` | `ellipse` | An attribute of an entity (small, w=120, h=40) |
| `key-attribute` | `ellipse` | Primary key attribute (underline convention — small, w=120, h=40) |
| `relationship` | `diamond` | A named relationship between entities (w=120, h=60) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `relationship` | Entity participates in a relationship — label with verb phrase |
| `has-attribute` | Entity to attribute connection |

## Semantics Fields

```json
"semantics": {
  "cardinality": "1:N",
  "participation": "total",
  "weak": false,
  "primaryKey": true
}
```

## Cardinality Notation

Express in edge label or semantics:
- `1:1` — one-to-one
- `1:N` — one-to-many
- `M:N` — many-to-many

## Layout Convention

- Entities as main nodes, 280px apart
- Attribute ellipses attached to their entity, radiating outward (+100px from entity center)
- Relationship diamonds between entities they connect
- Prefer left-to-right layout for relationships; attributes cluster around entities

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "er",
  "metadata": { "title": "Blog Data Model", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "user-entity",    "kind": "entity",       "label": "User",      "layout": { "x": 80,  "y": 160, "w": 180, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "post-entity",    "kind": "entity",       "label": "Post",      "layout": { "x": 440, "y": 160, "w": 180, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "writes-rel",     "kind": "relationship", "label": "Writes",    "layout": { "x": 280, "y": 170, "w": 100, "h": 60,  "locked": false }, "semantics": { "cardinality": "1:N" }, "styleToken": "node.default" },
    { "id": "user-id-attr",   "kind": "key-attribute","label": "userId",    "layout": { "x": 40,  "y": 60,  "w": 120, "h": 40,  "locked": false }, "semantics": { "primaryKey": true }, "styleToken": "node.accent" },
    { "id": "user-name-attr", "kind": "attribute",    "label": "name",      "layout": { "x": 40,  "y": 280, "w": 120, "h": 40,  "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "user-entity",  "to": "writes-rel",     "relation": "relationship",  "label": "1",  "styleToken": "edge.default" },
    { "id": "e2", "from": "writes-rel",   "to": "post-entity",    "relation": "relationship",  "label": "N",  "styleToken": "edge.default" },
    { "id": "e3", "from": "user-entity",  "to": "user-id-attr",   "relation": "has-attribute", "label": "",   "styleToken": "edge.default" },
    { "id": "e4", "from": "user-entity",  "to": "user-name-attr", "relation": "has-attribute", "label": "",   "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Connecting entities directly** — Always route relationships through a `relationship` diamond node.
2. **Omitting cardinality** — Label edges with `1`, `N`, or `M` to express cardinality clearly.
