# Timing Diagram

**Purpose:** Show how the state of one or more objects changes over a time axis — used for real-time or concurrent systems.

**diagramType:** `timing`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `lifeline` | `rectangle` | Row header — one per object/participant (narrow, on left side) |
| `state-label` | `rectangle` | A named state occupying a horizontal time span on a lifeline's timeline |
| `time-axis` | `rectangle` | Horizontal bar representing the time axis (thin, h=4) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `transition` | Vertical step marking a state change at a point in time |
| `message` | Message passed between lifelines at a time point |

## Semantics Fields

```json
"semantics": {
  "timeStart": 0,
  "timeEnd": 5,
  "unit": "s",
  "stateAt": "Running"
}
```

## Layout Convention

- Lifeline headers: left column, x=0, y increments 100px per row, w=120, h=60
- Time axis: horizontal, starts at x=140, y centered on each lifeline row
- State rectangles: placed on the timeline, x proportional to time value (1 unit = 60px), h=40
- Transitions shown as edge overlays on the timeline

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "timing",
  "metadata": { "title": "Sensor State Timeline", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "sensor-header",  "kind": "lifeline",    "label": "Sensor",   "layout": { "x": 20,  "y": 60,  "w": 100, "h": 50, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "sensor-idle",    "kind": "state-label", "label": "Idle",     "layout": { "x": 140, "y": 65,  "w": 120, "h": 40, "locked": false }, "semantics": { "timeStart": 0, "timeEnd": 2 }, "styleToken": "node.default" },
    { "id": "sensor-active",  "kind": "state-label", "label": "Active",   "layout": { "x": 260, "y": 65,  "w": 180, "h": 40, "locked": false }, "semantics": { "timeStart": 2, "timeEnd": 5 }, "styleToken": "node.accent" },
    { "id": "motor-header",   "kind": "lifeline",    "label": "Motor",    "layout": { "x": 20,  "y": 160, "w": 100, "h": 50, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "motor-off",      "kind": "state-label", "label": "Off",      "layout": { "x": 140, "y": 165, "w": 180, "h": 40, "locked": false }, "semantics": { "timeStart": 0, "timeEnd": 3 }, "styleToken": "node.default" },
    { "id": "motor-running",  "kind": "state-label", "label": "Running",  "layout": { "x": 320, "y": 165, "w": 120, "h": 40, "locked": false }, "semantics": { "timeStart": 3, "timeEnd": 5 }, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "t1", "from": "sensor-idle",  "to": "sensor-active", "relation": "transition", "label": "trigger", "styleToken": "edge.default" },
    { "id": "t2", "from": "motor-off",    "to": "motor-running",  "relation": "transition", "label": "start",   "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Using vertical layout** — Timing diagrams are horizontal; time flows left to right.
2. **Omitting lifeline headers** — Always include a header node on the left for each object being timed.
