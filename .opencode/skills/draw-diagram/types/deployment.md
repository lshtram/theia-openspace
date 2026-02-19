# Deployment Diagram

**Purpose:** Show the physical or cloud deployment topology — execution environments, nodes, artifacts.

**diagramType:** `deployment`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `node` | `rectangle` | Execution environment (server, VM, container, device) — use `«device»`, `«server»`, `«container»` stereotype |
| `artifact` | `rectangle` | Deployable unit (JAR, WAR, executable, image) — smaller box inside node |
| `database` | `rectangle` | Database artifact or node (use label `«database»`) |
| `cloud` | `cloud` | Cloud region or provider |
| `device` | `rectangle` | Physical device |
| `note` | `tldraw.note` | Annotation |

> Note: `cloud` maps directly to the tldraw `cloud` geo shape.

## Edge Relations

| relation | Use for |
|---|---|
| `deployment` | Artifact deployed to node |
| `communication-path` | Network/protocol link between nodes |
| `dependency` | One artifact depends on another |

## Layout Convention

- Nodes arranged in tiers (e.g., client / app / data tiers): 3 columns, 300px apart
- Each node: w=200, h=120
- Artifacts nested inside nodes: offset +20px from node edges
- Cloud shapes: larger (w=240, h=140)

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "deployment",
  "metadata": { "title": "Production Deployment", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "browser-node", "kind": "node",     "label": "«device»\nBrowser",    "layout": { "x": 40,  "y": 80,  "w": 200, "h": 100, "locked": false }, "semantics": { "stereotype": "device" },    "styleToken": "node.default" },
    { "id": "app-server",   "kind": "node",     "label": "«server»\nApp Server", "layout": { "x": 300, "y": 80,  "w": 200, "h": 100, "locked": false }, "semantics": { "stereotype": "server" },   "styleToken": "node.system" },
    { "id": "db-server",    "kind": "database", "label": "«database»\nPostgreSQL","layout": { "x": 560, "y": 80,  "w": 200, "h": 120, "locked": false }, "semantics": {},                           "styleToken": "node.external" },
    { "id": "api-artifact", "kind": "artifact", "label": "«artifact»\napi.jar",  "layout": { "x": 320, "y": 110, "w": 160, "h": 50,  "locked": false }, "semantics": { "stereotype": "artifact" }, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "browser-node", "to": "app-server", "relation": "communication-path", "label": "HTTPS",    "styleToken": "edge.default" },
    { "id": "e2", "from": "app-server",   "to": "db-server",  "relation": "communication-path", "label": "TCP/5432", "styleToken": "edge.default" },
    { "id": "e3", "from": "api-artifact", "to": "app-server", "relation": "deployment",          "label": "",         "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Showing logical components instead of physical artifacts** — Deployment diagrams show what runs where, not the code structure.
2. **Missing communication-path labels** — Always label links with the protocol/port.
