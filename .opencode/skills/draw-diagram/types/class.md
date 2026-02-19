# Class Diagram

**Purpose:** Show OOP structure — classes, interfaces, their members, and relationships.

**diagramType:** `class`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `class` | `rectangle` | Concrete class with attributes and methods |
| `interface` | `rectangle` | Interface (label prefixed with `«interface»`) |
| `abstract-class` | `rectangle` | Abstract class (label in italics by convention) |
| `enum` | `rectangle` | Enumeration type |
| `package` | `rectangle` | Namespace boundary (larger, acts as container) |

## Edge Relations

| relation | Arrowhead convention | Use for |
|---|---|---|
| `inheritance` | Hollow triangle at target | Extends (class→class or class→abstract) |
| `implementation` | Hollow triangle + dashed | Implements interface |
| `association` | Open arrow | General has-a or knows-about |
| `aggregation` | Diamond at source | Weak whole-part (diamond on owner) |
| `composition` | Filled diamond at source | Strong whole-part (filled diamond on owner) |
| `dependency` | Dashed open arrow | Uses/depends-on (dashed) |

## Semantics Fields (on nodes)

```json
"semantics": {
  "attributes": ["+id: UUID", "-password: String", "#role: Role"],
  "methods": ["+login(): Session", "+logout(): void"],
  "stereotype": "interface"
}
```

## Layout Convention

- Top-to-bottom hierarchy (parent classes above subclasses)
- x-spacing: 220px between sibling classes
- y-spacing: 200px between parent and child
- Typical node: w=200, h=120 (allow height to grow for members)

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "class",
  "metadata": { "title": "Auth Domain", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    {
      "id": "user",
      "kind": "class",
      "label": "User",
      "layout": { "x": 100, "y": 100, "w": 200, "h": 140, "locked": false },
      "semantics": { "attributes": ["+id: UUID", "+email: String"], "methods": ["+login(): Session"] },
      "styleToken": "node.default"
    },
    {
      "id": "admin",
      "kind": "class",
      "label": "Admin",
      "layout": { "x": 100, "y": 320, "w": 200, "h": 100, "locked": false },
      "semantics": { "attributes": ["+permissions: List<Permission>"] },
      "styleToken": "node.default"
    },
    {
      "id": "session",
      "kind": "class",
      "label": "Session",
      "layout": { "x": 380, "y": 100, "w": 200, "h": 100, "locked": false },
      "semantics": { "attributes": ["+token: String", "+expiresAt: DateTime"] },
      "styleToken": "node.default"
    }
  ],
  "edges": [
    { "id": "e1", "from": "admin", "to": "user", "relation": "inheritance", "label": "", "styleToken": "edge.default" },
    { "id": "e2", "from": "user", "to": "session", "relation": "association", "label": "creates", "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Placing attributes in `label`** — Put them in `semantics.attributes`, not the label. The label is just the class name.
2. **Using `kind: "block"` for all nodes** — Use `kind: "class"`, `"interface"`, etc. for semantic correctness.
