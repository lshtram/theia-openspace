# Communication Diagram

**Purpose:** Show objects interacting via numbered messages in a network arrangement — emphasizes structural relationships and message sequencing. Also called a collaboration diagram.

**diagramType:** `communication`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `object` | `rectangle` | An object instance — label format: `instanceName : ClassName` |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `message` | A message between objects — label format: `1: methodName()`, `1.1: nestedCall()` |
| `return` | A return value (dashed) — label format: `1*: returnValue` |

## Semantics Fields

```json
"semantics": {
  "slots": ["id = 1", "status = ACTIVE"],
  "messageNumber": "1.2"
}
```

## Layout Convention

- Objects arranged in free network topology — not a linear sequence
- Typical node: w=180, h=70
- Objects spaced 200–280px apart
- Messages labeled with hierarchical sequence numbers (1, 1.1, 2, 2.1, etc.)

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "communication",
  "metadata": { "title": "Order Collaboration", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "client-obj",    "kind": "object", "label": "c : Client",       "layout": { "x": 80,  "y": 80,  "w": 180, "h": 70, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "order-obj",     "kind": "object", "label": "o : Order",        "layout": { "x": 380, "y": 80,  "w": 180, "h": 70, "locked": false }, "semantics": { "slots": ["id = 42"] }, "styleToken": "node.default" },
    { "id": "payment-obj",   "kind": "object", "label": "p : PaymentGateway","layout": { "x": 380, "y": 260, "w": 180, "h": 70, "locked": false }, "semantics": {}, "styleToken": "node.external" }
  ],
  "edges": [
    { "id": "m1", "from": "client-obj",  "to": "order-obj",   "relation": "message", "label": "1: placeOrder()",  "styleToken": "edge.default" },
    { "id": "m2", "from": "order-obj",   "to": "payment-obj", "relation": "message", "label": "1.1: charge(100)", "styleToken": "edge.default" },
    { "id": "m3", "from": "payment-obj", "to": "order-obj",   "relation": "return",  "label": "1.1*: txId",       "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Not numbering messages** — All messages must carry hierarchical sequence numbers. Un-numbered messages cannot show ordering.
2. **Arranging objects in a line** — Unlike sequence diagrams, communication diagrams use free-form network placement. Objects connect by proximity and relationship.
