# C4 Context Diagram

**Purpose:** C4 Level 1 — show the target software system in context: the users who interact with it and the external systems it depends on. Audience: everyone, including non-technical stakeholders.

**diagramType:** `c4-context`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `person` | `rectangle` | A human user or role that interacts with the system (use `node.default` style) |
| `system` | `rectangle` | The software system being described (use `node.system` style) |
| `external-system` | `rectangle` | An external software system outside the scope (use `node.external` style) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `uses` | Person or external system uses/calls the target system (label with technology/purpose) |
| `external-rel` | Bidirectional or outbound relationship with an external system |

## Semantics Fields

```json
"semantics": {
  "technology": "REST API",
  "description": "Customer views their order history",
  "tag": "[Person]"
}
```

## Layout Convention

- Target system centered: x=340, y=220 (approx canvas center)
- Persons upper-left and/or upper-right: 300px from system center
- External systems around perimeter: left, right, or below
- Node sizes: person w=160, h=80; system w=200, h=100; external w=160, h=80
- All labels should include a bracketed tag: `[Person]`, `[Software System]`, `[External System]`

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "c4-context",
  "metadata": { "title": "Internet Banking System Context", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "customer",      "kind": "person",          "label": "Customer\n[Person]",               "layout": { "x": 80,  "y": 80,  "w": 160, "h": 80,  "locked": false }, "semantics": { "tag": "[Person]", "description": "A bank customer" }, "styleToken": "node.default" },
    { "id": "banking-system","kind": "system",           "label": "Internet Banking\n[Software System]","layout": { "x": 280, "y": 220, "w": 220, "h": 100, "locked": false }, "semantics": { "tag": "[Software System]" }, "styleToken": "node.system" },
    { "id": "email-system",  "kind": "external-system",  "label": "Email System\n[External System]",  "layout": { "x": 560, "y": 220, "w": 160, "h": 80,  "locked": false }, "semantics": { "tag": "[External System]", "description": "Sends notification emails" }, "styleToken": "node.external" },
    { "id": "mainframe",     "kind": "external-system",  "label": "Mainframe\n[External System]",     "layout": { "x": 280, "y": 420, "w": 160, "h": 80,  "locked": false }, "semantics": { "tag": "[External System]", "description": "Core banking legacy system" }, "styleToken": "node.external" }
  ],
  "edges": [
    { "id": "e1", "from": "customer",       "to": "banking-system", "relation": "uses",         "label": "Views accounts, pays bills",      "styleToken": "edge.default" },
    { "id": "e2", "from": "banking-system", "to": "email-system",   "relation": "external-rel", "label": "Sends email using",               "styleToken": "edge.dashed" },
    { "id": "e3", "from": "banking-system", "to": "mainframe",      "relation": "external-rel", "label": "Gets account data from [XML/HTTPS]","styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Showing implementation details** — Context diagrams show people and systems, not technology choices or code structure.
2. **Forgetting the bracketed tags** — Every node label should include `[Person]`, `[Software System]`, or `[External System]` to identify the C4 element type.
