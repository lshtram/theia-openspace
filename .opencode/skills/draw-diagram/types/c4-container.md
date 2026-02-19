# C4 Container Diagram

**Purpose:** C4 Level 2 — zoom into a single software system to show the containers (applications, databases, microservices, APIs) that make it up. Audience: technical team members.

**diagramType:** `c4-container`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `system-boundary` | `rectangle` | Large bounding box for the target system (dashed border convention) |
| `container` | `rectangle` | An application, service, or microservice inside the system |
| `database` | `rectangle` | A database container (label with `[Database]` tag) |
| `person` | `rectangle` | External user (outside boundary) |
| `external-system` | `rectangle` | External system (outside boundary, use `node.external` style) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `uses` | Person or container calls another container (label with technology) |
| `reads-from` | Container reads data from a database |
| `writes-to` | Container writes data to a database |
| `publishes` | Container publishes messages to a queue/topic |
| `subscribes` | Container subscribes to messages from a queue/topic |

## Semantics Fields

```json
"semantics": {
  "technology": "React, TypeScript",
  "description": "Delivers static UI to the browser",
  "tag": "[Container: Web App]"
}
```

## Layout Convention

- System boundary: large rectangle, x=160, y=60, w=600+, h=400+
- Containers inside boundary, spaced 200px apart horizontally, 150px vertically
- Databases below their consuming containers: +180px y
- Persons and external systems outside boundary
- All labels include technology in brackets: `[Container: React App]`, `[Database: PostgreSQL]`

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "c4-container",
  "metadata": { "title": "Internet Banking Containers", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "customer",     "kind": "person",          "label": "Customer\n[Person]",                     "layout": { "x": 20,  "y": 180, "w": 140, "h": 80,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "boundary",     "kind": "system-boundary", "label": "Internet Banking System",                "layout": { "x": 180, "y": 40,  "w": 640, "h": 500, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "web-app",      "kind": "container",       "label": "Web App\n[Container: React]",            "layout": { "x": 200, "y": 100, "w": 180, "h": 90,  "locked": false }, "semantics": { "technology": "React", "tag": "[Container: Web App]" }, "styleToken": "node.system" },
    { "id": "api",          "kind": "container",       "label": "API Server\n[Container: Node.js]",       "layout": { "x": 460, "y": 100, "w": 180, "h": 90,  "locked": false }, "semantics": { "technology": "Node.js", "tag": "[Container: API]" }, "styleToken": "node.system" },
    { "id": "db",           "kind": "database",        "label": "Database\n[Database: PostgreSQL]",       "layout": { "x": 460, "y": 300, "w": 180, "h": 90,  "locked": false }, "semantics": { "technology": "PostgreSQL", "tag": "[Database]" }, "styleToken": "node.accent" },
    { "id": "email-system", "kind": "external-system", "label": "Email System\n[External System]",        "layout": { "x": 700, "y": 180, "w": 160, "h": 80,  "locked": false }, "semantics": {}, "styleToken": "node.external" }
  ],
  "edges": [
    { "id": "e1", "from": "customer",  "to": "web-app", "relation": "uses",        "label": "HTTPS",         "styleToken": "edge.default" },
    { "id": "e2", "from": "web-app",   "to": "api",     "relation": "uses",        "label": "REST/HTTPS",    "styleToken": "edge.default" },
    { "id": "e3", "from": "api",       "to": "db",      "relation": "reads-from",  "label": "SQL/TCP",       "styleToken": "edge.default" },
    { "id": "e4", "from": "api",       "to": "db",      "relation": "writes-to",   "label": "SQL/TCP",       "styleToken": "edge.default" },
    { "id": "e5", "from": "api",       "to": "email-system", "relation": "uses",   "label": "SMTP",          "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Showing classes or functions** — Containers are runtime deployable units (apps, services, DBs), not code-level constructs.
2. **Placing external people/systems inside the boundary** — Only containers of the target system go inside the boundary box.
