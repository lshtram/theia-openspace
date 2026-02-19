# Object Diagram

**Purpose:** Show a snapshot of object instances and their links at a specific moment in time.

**diagramType:** `object`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `object` | `rectangle` | An object instance — label format: `instanceName : ClassName` |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `link` | Association instance (instantiated association) |
| `dependency` | One object depends on another |

## Semantics Fields

```json
"semantics": {
  "slots": ["id = 42", "email = \"alice@example.com\"", "role = ADMIN"]
}
```

## Layout Convention

- Casual arrangement or mirroring the class diagram's structure
- Objects: w=200, h=100 (taller to show slot values)
- Slot values shown in semantics, not label

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "object",
  "metadata": { "title": "Session Snapshot", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "alice-obj",   "kind": "object", "label": "alice : User",  "layout": { "x": 80,  "y": 100, "w": 200, "h": 100, "locked": false }, "semantics": { "slots": ["id = 1", "email = \"alice@x.com\""] }, "styleToken": "node.default" },
    { "id": "session-obj", "kind": "object", "label": "s1 : Session",  "layout": { "x": 360, "y": 100, "w": 200, "h": 100, "locked": false }, "semantics": { "slots": ["token = \"abc123\"", "expiresAt = \"2026-12-31\""] }, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "l1", "from": "alice-obj", "to": "session-obj", "relation": "link", "label": "owns", "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Using class names as labels instead of `instanceName : ClassName`** — Object instances must follow the colon-separated naming convention.
2. **Making it a class diagram** — Object diagrams show instances with specific slot values, not abstract class structure.
