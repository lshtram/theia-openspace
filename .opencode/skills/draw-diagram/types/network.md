# Network Diagram

**Purpose:** Show the physical or logical topology of a network — hosts, devices, connections, and protocols.

**diagramType:** `network`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `router` | `hexagon` | Network router (w=80, h=80) |
| `switch` | `rectangle` | Network switch |
| `server` | `rectangle` | Server or host |
| `firewall` | `diamond` | Firewall or security boundary |
| `cloud` | `cloud` | Cloud provider or internet zone |
| `workstation` | `rectangle` | End-user workstation or client device |
| `subnet` | `rectangle` | A subnet or VLAN boundary (large container box) |
| `load-balancer` | `trapezoid` | Load balancer |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `link` | Wired network link (label with bandwidth/protocol, e.g., `1Gbps`, `HTTPS`) |
| `wireless` | Wireless link (dashed) |
| `tunnel` | VPN or encrypted tunnel (dashed + label) |

## Semantics Fields

```json
"semantics": {
  "ip": "10.0.1.1",
  "vlan": "100",
  "protocol": "BGP",
  "bandwidth": "10Gbps"
}
```

## Layout Convention

- Core/backbone devices at center; edge devices around perimeter
- Subnets as grouping rectangles (large, w=300+, h=200+)
- Device nodes: w=120, h=60 (servers), w=80, h=80 (routers)
- Zone separation: internet zone at top, DMZ in middle, internal at bottom
- 200px spacing between devices

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "network",
  "metadata": { "title": "Office Network Topology", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "internet",  "kind": "cloud",        "label": "Internet",      "layout": { "x": 240, "y": 20,  "w": 200, "h": 100, "locked": false }, "semantics": {}, "styleToken": "node.external" },
    { "id": "firewall",  "kind": "firewall",      "label": "Firewall",      "layout": { "x": 300, "y": 170, "w": 80,  "h": 80,  "locked": false }, "semantics": { "ip": "192.168.1.1" }, "styleToken": "node.accent" },
    { "id": "router",    "kind": "router",        "label": "Core Router",   "layout": { "x": 300, "y": 320, "w": 80,  "h": 80,  "locked": false }, "semantics": { "ip": "10.0.0.1", "protocol": "OSPF" }, "styleToken": "node.default" },
    { "id": "switch",    "kind": "switch",        "label": "Core Switch",   "layout": { "x": 300, "y": 460, "w": 120, "h": 60,  "locked": false }, "semantics": { "vlan": "10,20,30" }, "styleToken": "node.default" },
    { "id": "web-server","kind": "server",        "label": "Web Server",    "layout": { "x": 120, "y": 580, "w": 120, "h": 60,  "locked": false }, "semantics": { "ip": "10.0.1.10" }, "styleToken": "node.default" },
    { "id": "db-server", "kind": "server",        "label": "DB Server",     "layout": { "x": 460, "y": 580, "w": 120, "h": 60,  "locked": false }, "semantics": { "ip": "10.0.2.10" }, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "internet",  "to": "firewall",   "relation": "link",     "label": "WAN",    "styleToken": "edge.default" },
    { "id": "e2", "from": "firewall",  "to": "router",     "relation": "link",     "label": "1Gbps",  "styleToken": "edge.default" },
    { "id": "e3", "from": "router",    "to": "switch",     "relation": "link",     "label": "10Gbps", "styleToken": "edge.default" },
    { "id": "e4", "from": "switch",    "to": "web-server", "relation": "link",     "label": "1Gbps",  "styleToken": "edge.default" },
    { "id": "e5", "from": "switch",    "to": "db-server",  "relation": "link",     "label": "1Gbps",  "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Missing IP or protocol labels on links** — Network diagrams must show protocols and connection specs on edges.
2. **Confusing logical and physical topology** — Decide upfront: physical (shows cables) or logical (shows traffic flow). Don't mix without clear labeling.
