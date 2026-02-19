# Sequence Diagram

**Purpose:** Show time-ordered interactions between participants (actors, systems, objects).

**diagramType:** `sequence`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `lifeline` | `rectangle` | A participant (system, service, user) — placed at top, column headers |
| `actor` | `rectangle` | Human actor (optionally use `oval` for actor head shape) |
| `activation` | `rectangle` | Activation bar showing when a lifeline is executing (narrow, tall) |
| `note` | `tldraw.note` | Annotation/comment attached to a message |

## Edge Relations

| relation | Use for |
|---|---|
| `message` | Synchronous call (solid arrow) |
| `return` | Return value (dashed arrow) |
| `async-message` | Async/fire-and-forget message |
| `create` | Object creation message |
| `destroy` | Object destruction |
| `self-call` | Recursive call back to same lifeline |

## Semantics Fields

```json
"semantics": {
  "messageNumber": "1.1",
  "guard": "[user != null]",
  "stereotype": "create"
}
```

## Layout Convention

- Lifelines are arranged **left-to-right** as column headers: x increments by 220px, y=50, h=60, w=160
- Messages flow **top-to-bottom**: each message edge connects left column to right column at increasing y
- Activation bars sit under lifelines: narrow (w=20), tall (h varies), centered on lifeline x+80
- Time flows downward — first message at y≈150, each subsequent message +80px lower
- Total canvas height ≈ 100 + (message_count × 80)

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "sequence",
  "metadata": { "title": "Login Flow", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "client",  "kind": "lifeline", "label": "Client",      "layout": { "x": 80,  "y": 40, "w": 160, "h": 60, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "auth",    "kind": "lifeline", "label": "AuthService",  "layout": { "x": 320, "y": 40, "w": 160, "h": 60, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "db",      "kind": "lifeline", "label": "Database",     "layout": { "x": 560, "y": 40, "w": 160, "h": 60, "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "m1", "from": "client", "to": "auth",   "relation": "message", "label": "login(user, pwd)", "styleToken": "edge.default" },
    { "id": "m2", "from": "auth",   "to": "db",     "relation": "message", "label": "findUser(user)",   "styleToken": "edge.default" },
    { "id": "m3", "from": "db",     "to": "auth",   "relation": "return",  "label": "User | null",      "styleToken": "edge.dashed" },
    { "id": "m4", "from": "auth",   "to": "client", "relation": "return",  "label": "SessionToken",     "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Placing lifelines vertically** — Lifelines are column headers; they must be arranged horizontally (left-to-right) with messages flowing downward.
2. **Not distinguishing return messages** — Use `relation: "return"` with `styleToken: "edge.dashed"` for return values.
