# Gantt Chart

**Purpose:** Show a project or sprint timeline with tasks, durations, dependencies, and milestones. Used for project planning and progress tracking.

**diagramType:** `gantt`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `swimlane-header` | `rectangle` | Row label on the left (task or phase name) — narrow column |
| `task-bar` | `rectangle` | Horizontal bar representing a task's duration |
| `milestone` | `diamond` | A point-in-time event (w=20, h=20) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `dependency` | Finish-to-start dependency between tasks |

## Semantics Fields

```json
"semantics": {
  "startDate": "2026-01-05",
  "endDate": "2026-01-12",
  "progress": 0.6,
  "assignee": "Alice",
  "phase": "Development"
}
```

## Layout Convention

- **Time axis is horizontal**: each unit (day, week, sprint) = 80px
- **Rows are horizontal**: each task row is 60px tall, y increments by 60px
- **Swimlane headers**: x=0, w=160, h=60 (left column)
- **Task bars**: start at x=170 (after header), bar width = duration × 80px
- **Milestones**: small diamonds placed at the correct x position on their row
- **Column 0 offset**: week 1 starts at x=170, week 2 at x=250, etc.

## Week/Sprint to X Coordinate

```
x = 170 + (weekIndex × 80)
```

## Example (3-week sprint plan)

```json
{
  "schemaVersion": "1.0",
  "diagramType": "gantt",
  "metadata": { "title": "Sprint 12 Plan", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "header-design",  "kind": "swimlane-header", "label": "Design",         "layout": { "x": 0,   "y": 60,  "w": 160, "h": 60, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "header-dev",     "kind": "swimlane-header", "label": "Development",    "layout": { "x": 0,   "y": 120, "w": 160, "h": 60, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "header-qa",      "kind": "swimlane-header", "label": "QA",             "layout": { "x": 0,   "y": 180, "w": 160, "h": 60, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "task-design",    "kind": "task-bar",        "label": "UI Design",      "layout": { "x": 170, "y": 65,  "w": 160, "h": 50, "locked": false }, "semantics": { "startDate": "2026-01-05", "endDate": "2026-01-12", "progress": 1.0 }, "styleToken": "node.accent" },
    { "id": "task-dev",       "kind": "task-bar",        "label": "Implementation", "layout": { "x": 250, "y": 125, "w": 240, "h": 50, "locked": false }, "semantics": { "startDate": "2026-01-08", "endDate": "2026-01-19", "progress": 0.5 }, "styleToken": "node.system" },
    { "id": "task-qa",        "kind": "task-bar",        "label": "Testing",        "layout": { "x": 410, "y": 185, "w": 160, "h": 50, "locked": false }, "semantics": { "startDate": "2026-01-16", "endDate": "2026-01-23", "progress": 0.0 }, "styleToken": "node.default" },
    { "id": "milestone-ship", "kind": "milestone",       "label": "Release",        "layout": { "x": 561, "y": 185, "w": 20,  "h": 20, "locked": false }, "semantics": { "startDate": "2026-01-23" }, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "d1", "from": "task-design", "to": "task-dev", "relation": "dependency", "label": "", "styleToken": "edge.default" },
    { "id": "d2", "from": "task-dev",    "to": "task-qa",  "relation": "dependency", "label": "", "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Using vertical layout** — Gantt charts are horizontal. Time flows left to right; tasks are rows.
2. **Fixed-width bars regardless of duration** — Bar width must be proportional to task duration. Use the formula: `w = durationInWeeks × 80`.
