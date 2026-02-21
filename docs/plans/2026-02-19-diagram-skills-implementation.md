# Diagram Skills System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete skill system for the `draw-diagram` agent skill, covering 21 diagram types and 3 themes, stored in `.opencode/skills/draw-diagram/` inside the theia-openspace project.

**Architecture:** A master `SKILL.md` is auto-discovered by OpenCode. It instructs the agent to identify the diagram type, then Read the specific type file and optionally a theme file. All output is `diagram.json` format consumed by the existing `whiteboard.update` MCP tool.

**Tech Stack:** Markdown skill files only. No code changes. References `IDiagram` interface at `openspace-client/src/interfaces/IDrawing.ts` and tldraw geo types: `rectangle`, `ellipse`, `diamond`, `cloud`, `triangle`, `hexagon`, `octagon`, `oval`, `pentagon`, `rhombus`, `rhombus-2`, `star`, `trapezoid`, `heart`, `check-box`, `x-box`, `arrow-up/down/left/right`.

---

## Task 1: Create directory structure

**Files:**
- Create: `.opencode/skills/draw-diagram/` (directory)
- Create: `.opencode/skills/draw-diagram/types/` (directory)
- Create: `.opencode/skills/draw-diagram/themes/` (directory)

**Step 1: Create directories**

```bash
mkdir -p /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/types
mkdir -p /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/themes
```

**Step 2: Verify**

```bash
ls /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/
```

Expected: `types/` and `themes/` directories present.

**Step 3: Commit**

```bash
git add .opencode/skills/
git commit -m "feat: scaffold draw-diagram skill directory structure"
```

---

## Task 2: Write master skill — `draw-diagram/SKILL.md`

**Files:**
- Create: `.opencode/skills/draw-diagram/SKILL.md`

**What it must contain:**
1. YAML frontmatter with `name: draw-diagram` and description
2. Diagram type catalogue (21 types, one-line each)
3. Step-by-step process: identify type → Read type file → Read theme file → compose diagram.json → call MCP tool
4. The canonical `diagram.json` schema with every field annotated
5. Layout rules (no overlapping nodes, sensible spacing: ~160px wide, ~60px tall for most nodes, 80px gap minimum)
6. MCP tool reference table
7. Hard rules (always set `diagramType`, always use semantic `kind` values, never use placeholder coords all at 0,0)

**Step 1: Write the file**

Full content for `.opencode/skills/draw-diagram/SKILL.md`:

```markdown
---
name: draw-diagram
description: "Use when creating or editing any diagram in the whiteboard modality. Covers all UML types, flowcharts, ER, mind maps, C4, and more. Loads the right type-specific sub-skill and optional theme."
---

# Skill: draw-diagram

## Overview

This skill guides you to create or edit diagrams in the whiteboard modality using the canonical `diagram.json` format. All diagrams are written as structured scene-graph JSON and applied via the `whiteboard.update` MCP tool.

## Process

1. **Identify the diagram type** from the user's request (see catalogue below)
2. **Read the type file**: `Read` `.opencode/skills/draw-diagram/types/<type>.md`
3. **Choose a theme** (optional): If the user mentions aesthetics/style, `Read` `.opencode/skills/draw-diagram/themes/<theme>.md`. Default: `technical`.
4. **Compose the `diagram.json`** following the type file's node kinds, edge relations, semantics, and layout rules
5. **Apply** using the MCP tool

## Diagram Type Catalogue

| Type slug | Description | Type file |
|---|---|---|
| `flowchart` | Process flow with decisions, start/end | `types/flowchart.md` |
| `sequence` | Time-ordered messages between participants | `types/sequence.md` |
| `class` | OOP classes, interfaces, attributes, methods, relationships | `types/class.md` |
| `state` | State machine with transitions and guards | `types/state.md` |
| `activity` | Workflow with actions, decisions, forks, swimlanes | `types/activity.md` |
| `use-case` | Actor-system interactions and relationships | `types/use-case.md` |
| `component` | Software components, interfaces, ports, dependencies | `types/component.md` |
| `deployment` | Physical deployment: nodes, artifacts, environments | `types/deployment.md` |
| `object` | Object instances and slot values | `types/object.md` |
| `timing` | State timelines for concurrent objects over time | `types/timing.md` |
| `er` | Entity-relationship (Crow's Foot notation) | `types/er.md` |
| `mind-map` | Central concept with hierarchical branches | `types/mind-map.md` |
| `block` | Functional block diagrams (SysML-style) | `types/block.md` |
| `c4-context` | C4 Level 1: system context map | `types/c4-context.md` |
| `c4-container` | C4 Level 2: container breakdown | `types/c4-container.md` |
| `network` | Network topology: hosts, switches, protocols | `types/network.md` |
| `gantt` | Task timeline with milestones and dependencies | `types/gantt.md` |
| `package` | UML packages, imports, access dependencies | `types/package.md` |
| `interaction-overview` | Interaction fragments combined in a flow | `types/interaction-overview.md` |
| `composite-structure` | Internal parts and ports of a classifier | `types/composite-structure.md` |
| `communication` | Objects with numbered messages (collaboration) | `types/communication.md` |

## Theme Catalogue

| Theme slug | Use when | File |
|---|---|---|
| `technical` | Developer docs, code review, architecture wikis | `themes/technical.md` |
| `presentation` | Slides, demos, stakeholder communication | `themes/presentation.md` |
| `beautiful` | Portfolio, public docs, polished reports | `themes/beautiful.md` |

Always `Read` `themes/themes.md` first, then the specific theme file.

## Canonical `diagram.json` Schema

```json
{
  "schemaVersion": "1.0",
  "diagramType": "<type-slug>",
  "metadata": {
    "title": "Human-readable title",
    "createdAt": "<ISO timestamp>",
    "updatedAt": "<ISO timestamp>"
  },
  "style": {
    "theme": "<theme-name or 'light'>",
    "tokens": {
      "node.default": { "stroke": "#1f2937", "fill": "#ffffff", "font": "IBM Plex Sans" },
      "edge.default": { "stroke": "#6b7280" }
    }
  },
  "nodes": [
    {
      "id": "unique-stable-id",
      "kind": "<semantic-kind from type file>",
      "label": "Display label",
      "layout": { "x": 100, "y": 100, "w": 160, "h": 60, "locked": false },
      "semantics": { },
      "styleToken": "node.default"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": "source-node-id",
      "to": "target-node-id",
      "relation": "<relation-type from type file>",
      "label": "",
      "styleToken": "edge.default"
    }
  ],
  "groups": [],
  "constraints": [],
  "sourceRefs": {}
}
```

## Layout Rules

- **Spacing**: minimum 80px gap between nodes; typical node: w=160, h=60
- **Sequence/vertical flow**: increment y by 120–140px per step
- **Left-to-right flow**: increment x by 220–250px per step
- **No stacking at origin**: never place multiple nodes at (0,0)
- **Groups/swimlanes**: use x-offset to separate lanes (each lane ~300px wide)
- **Mind maps**: root at center (400,300); branches radiate outward by 200px

## Available MCP Tools

| Action | Tool | Key parameters |
|---|---|---|
| Create or fully replace diagram | `whiteboard.update` | `name`, `content` (JSON string) |
| Read existing diagram | `whiteboard.read` | `name` |
| List diagrams | `whiteboard.list` | — |
| Inspect scene nodes | `drawing.inspect_scene` | — |
| Propose incremental patch | `drawing.propose_patch` | `patch` (IOperation array), `intent` |
| Apply proposed patch | `drawing.apply_patch` | `patchId` |
| Open in UI pane | `pane.open` | `type: "whiteboard"`, `contentId` |

## Hard Rules

1. Always set `diagramType` to the correct slug
2. Always use semantic `kind` values from the type file — never use `kind: "block"` for a lifeline
3. Node IDs must be unique, stable, and meaningful (e.g., `"user-actor"`, not `"node1"`)
4. Layout coordinates must be spatially coherent — no two nodes at the same position
5. The `semantics` object must contain type-specific data (see type file)
6. For **new** diagrams: use `whiteboard.update` with the full JSON
7. For **edits** to existing diagrams: use `drawing.propose_patch` + `drawing.apply_patch`
8. Always `Read` the type file before composing — do not rely on memory alone
```

**Step 2: Verify the file exists and frontmatter is valid**

```bash
head -5 /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/SKILL.md
```

Expected: `---`, `name: draw-diagram`, `description: ...`

**Step 3: Commit**

```bash
git add .opencode/skills/draw-diagram/SKILL.md
git commit -m "feat: add draw-diagram master skill"
```

---

## Task 3: Write themes index and three theme files

**Files:**
- Create: `.opencode/skills/draw-diagram/themes/themes.md`
- Create: `.opencode/skills/draw-diagram/themes/technical.md`
- Create: `.opencode/skills/draw-diagram/themes/presentation.md`
- Create: `.opencode/skills/draw-diagram/themes/beautiful.md`

### `themes/themes.md`

Theme index — agent reads this first.

```markdown
# Diagram Themes

## Theme Token Structure

Themes set values in `style.tokens`. These keys are recognized:

- `node.default` — fill, stroke, font for most nodes
- `node.accent` — highlighted/important nodes
- `node.external` — out-of-scope or external system nodes
- `node.system` — the main system being diagrammed
- `edge.default` — standard arrows
- `edge.dashed` — dependency/optional relationships
- `edge.message` — synchronous messages (sequence)
- `edge.async` — asynchronous messages

## Available Themes

- `technical` — neutral, dense, developer-focused
- `presentation` — bold, spacious, stakeholder-friendly
- `beautiful` — polished, refined color palette

Set `style.theme` to the theme name. Then apply the token values from the theme file.
```

### `themes/technical.md`

```markdown
# Technical Theme

**Use when:** Architecture documentation, code review diagrams, developer wikis, internal tooling docs.

**Character:** Neutral colors, thin strokes, compact spacing, maximum information density.

## Style Block

```json
"style": {
  "theme": "technical",
  "tokens": {
    "node.default":   { "stroke": "#374151", "fill": "#f9fafb", "font": "monospace" },
    "node.accent":    { "stroke": "#1d4ed8", "fill": "#dbeafe", "font": "monospace" },
    "node.external":  { "stroke": "#9ca3af", "fill": "#f3f4f6", "font": "monospace" },
    "node.system":    { "stroke": "#1e40af", "fill": "#eff6ff", "font": "monospace" },
    "edge.default":   { "stroke": "#6b7280", "dash": "solid" },
    "edge.dashed":    { "stroke": "#9ca3af", "dash": "dashed" },
    "edge.message":   { "stroke": "#374151", "dash": "solid" },
    "edge.async":     { "stroke": "#374151", "dash": "dashed" }
  }
}
```

## Layout Density

Compact. Use minimum gaps (80px between nodes). Fit more on canvas.

## Background

White (`#ffffff`) or very light gray (`#f9fafb`).
```

### `themes/presentation.md`

```markdown
# Presentation Theme

**Use when:** Slides, demos, stakeholder walkthroughs, executive summaries, conference talks.

**Character:** Bold colors, large text targets, generous spacing, clear visual hierarchy.

## Style Block

```json
"style": {
  "theme": "presentation",
  "tokens": {
    "node.default":   { "stroke": "#1e293b", "fill": "#ffffff", "font": "sans-serif" },
    "node.accent":    { "stroke": "#7c3aed", "fill": "#ede9fe", "font": "sans-serif" },
    "node.external":  { "stroke": "#64748b", "fill": "#f8fafc", "font": "sans-serif" },
    "node.system":    { "stroke": "#7c3aed", "fill": "#ddd6fe", "font": "sans-serif" },
    "edge.default":   { "stroke": "#334155", "dash": "solid" },
    "edge.dashed":    { "stroke": "#94a3b8", "dash": "dashed" },
    "edge.message":   { "stroke": "#1e293b", "dash": "solid" },
    "edge.async":     { "stroke": "#64748b", "dash": "dashed" }
  }
}
```

## Layout Density

Spacious. Use generous gaps (120–160px between nodes). Fewer elements per slide.

## Sizing

Increase node size: typical node w=200, h=80. Labels should be short (3–5 words max).

## Background

White. Avoid dark backgrounds unless user explicitly requests.
```

### `themes/beautiful.md`

```markdown
# Beautiful Theme

**Use when:** Portfolio pieces, public-facing documentation, polished reports, design reviews, marketing materials.

**Character:** Refined color palette, subtle shadows implied by color depth, elegant proportions.

## Style Block

```json
"style": {
  "theme": "beautiful",
  "tokens": {
    "node.default":   { "stroke": "#0f172a", "fill": "#f0f9ff", "font": "sans-serif" },
    "node.accent":    { "stroke": "#0369a1", "fill": "#bae6fd", "font": "sans-serif" },
    "node.external":  { "stroke": "#475569", "fill": "#f8fafc", "font": "sans-serif" },
    "node.system":    { "stroke": "#0c4a6e", "fill": "#e0f2fe", "font": "sans-serif" },
    "edge.default":   { "stroke": "#0369a1", "dash": "solid" },
    "edge.dashed":    { "stroke": "#7dd3fc", "dash": "dashed" },
    "edge.message":   { "stroke": "#0f172a", "dash": "solid" },
    "edge.async":     { "stroke": "#0369a1", "dash": "dashed" }
  }
}
```

## Layout Density

Normal. Balanced spacing (100px gaps). Nodes sized proportionally to content.

## Sizing

Standard: w=180, h=64. Lean into consistent proportions.

## Accent Usage

Use `node.accent` for 1–3 key nodes only. Use `node.system` for the main subject. Everything else: `node.default`.
```

**Step 1: Write all four files** (see content above)

**Step 2: Verify**

```bash
ls /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/themes/
```

Expected: `themes.md  technical.md  presentation.md  beautiful.md`

**Step 3: Commit**

```bash
git add .opencode/skills/draw-diagram/themes/
git commit -m "feat: add diagram theme files (technical, presentation, beautiful)"
```

---

## Task 4: Write UML type files (batch 1: class, sequence, use-case, state)

**Files:** `types/class.md`, `types/sequence.md`, `types/use-case.md`, `types/state.md`

Each file follows this template:
- Purpose
- Node kinds table (kind → geo shape → description)
- Edge relations table
- Semantics fields
- Layout convention
- Complete working example (valid diagram.json fragment)
- Common mistakes

### `types/class.md`

```markdown
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
```

### `types/sequence.md`

```markdown
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
    { "id": "m1", "from": "client", "to": "auth", "relation": "message",  "label": "login(user, pwd)", "styleToken": "edge.default" },
    { "id": "m2", "from": "auth",   "to": "db",   "relation": "message",  "label": "findUser(user)",   "styleToken": "edge.default" },
    { "id": "m3", "from": "db",     "to": "auth", "relation": "return",   "label": "User | null",      "styleToken": "edge.dashed" },
    { "id": "m4", "from": "auth",   "to": "client","relation": "return",  "label": "SessionToken",     "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Placing lifelines vertically** — Lifelines are column headers; they must be arranged horizontally (left-to-right) with messages flowing downward.
2. **Not distinguishing return messages** — Use `relation: "return"` with `styleToken: "edge.dashed"` for return values.
```

### `types/use-case.md`

```markdown
# Use Case Diagram

**Purpose:** Show what a system does from the perspective of external actors — functional scope.

**diagramType:** `use-case`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `actor` | `oval` | External human or system interacting with the subject |
| `use-case` | `ellipse` | A functional behavior the system provides |
| `system-boundary` | `rectangle` | The subject system boundary box (large, contains use-cases) |
| `note` | `tldraw.note` | Annotations |

## Edge Relations

| relation | Use for |
|---|---|
| `association` | Actor participates in use case |
| `include` | One use case always includes another (labeled `«include»`) |
| `extend` | One use case optionally extends another (labeled `«extend»`) |
| `generalization` | Actor or use case specializes another |

## Layout Convention

- Actors on the **left** (and sometimes right) outside the system boundary
- Use cases inside the system boundary box, centered
- System boundary: large rectangle, x=200, y=50, w=400, h=400+
- Actor nodes: x=60, y=100+ (left side); w=80, h=80 (oval)
- Use case nodes: x=220–500, y=80–400; w=160, h=60 (ellipse)

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "use-case",
  "metadata": { "title": "E-Commerce Use Cases", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "customer",      "kind": "actor",           "label": "Customer",        "layout": { "x": 40,  "y": 180, "w": 80,  "h": 80,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "boundary",      "kind": "system-boundary", "label": "Online Store",    "layout": { "x": 160, "y": 40,  "w": 420, "h": 380, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "uc-browse",     "kind": "use-case",        "label": "Browse Products", "layout": { "x": 200, "y": 100, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "uc-checkout",   "kind": "use-case",        "label": "Checkout",        "layout": { "x": 200, "y": 220, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "uc-payment",    "kind": "use-case",        "label": "Process Payment", "layout": { "x": 400, "y": 220, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "customer",    "to": "uc-browse",   "relation": "association", "label": "",          "styleToken": "edge.default" },
    { "id": "e2", "from": "customer",    "to": "uc-checkout", "relation": "association", "label": "",          "styleToken": "edge.default" },
    { "id": "e3", "from": "uc-checkout", "to": "uc-payment",  "relation": "include",     "label": "«include»", "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Connecting actors to system boundary** — Actors associate with use cases, not the boundary box.
2. **Making use-case labels action-less** — Labels must be verb phrases: "Process Payment", not just "Payment".
```

### `types/state.md`

```markdown
# State Diagram

**Purpose:** Show the life cycle of an object: states it can be in and the transitions triggered by events.

**diagramType:** `state`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `initial` | `ellipse` | Filled start pseudostate (small, w=30, h=30) |
| `final` | `ellipse` | End state (double circle — use label "●" or "END") |
| `state` | `rectangle` | Named state |
| `choice` | `diamond` | Choice/branch pseudostate |
| `fork` | `rectangle` | Fork bar (narrow horizontal: w=120, h=10) |
| `join` | `rectangle` | Join bar (narrow horizontal: w=120, h=10) |
| `composite-state` | `rectangle` | State containing nested sub-states (larger) |

## Edge Relations

| relation | Use for |
|---|---|
| `transition` | Standard state transition (labeled with `event [guard] / action`) |
| `internal` | Internal transition (no state change) |
| `completion` | Unnamed completion transition |

## Semantics Fields

```json
"semantics": {
  "entry": "startTimer()",
  "exit": "cancelTimer()",
  "doActivity": "processRequest()",
  "guard": "[balance > 0]",
  "trigger": "paymentReceived"
}
```

## Layout Convention

- Top-to-bottom flow: initial at top, final at bottom
- States spaced 140px apart vertically
- Choice pseudostates (diamonds): w=60, h=60
- Fork/join bars: w=120, h=12

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "state",
  "metadata": { "title": "Order State Machine", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "init",      "kind": "initial", "label": "",          "layout": { "x": 205, "y": 40,  "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "pending",   "kind": "state",   "label": "Pending",   "layout": { "x": 140, "y": 120, "w": 160, "h": 60,  "locked": false }, "semantics": { "entry": "notifyUser()" }, "styleToken": "node.default" },
    { "id": "paid",      "kind": "state",   "label": "Paid",      "layout": { "x": 140, "y": 260, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "shipped",   "kind": "state",   "label": "Shipped",   "layout": { "x": 140, "y": 400, "w": 160, "h": 60,  "locked": false }, "semantics": { "entry": "sendTracking()" }, "styleToken": "node.default" },
    { "id": "final",     "kind": "final",   "label": "Delivered", "layout": { "x": 140, "y": 540, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "t1", "from": "init",    "to": "pending", "relation": "completion", "label": "",                    "styleToken": "edge.default" },
    { "id": "t2", "from": "pending", "to": "paid",    "relation": "transition",  "label": "paymentReceived",    "styleToken": "edge.default" },
    { "id": "t3", "from": "paid",    "to": "shipped", "relation": "transition",  "label": "dispatch",           "styleToken": "edge.default" },
    { "id": "t4", "from": "shipped", "to": "final",   "relation": "transition",  "label": "delivered",          "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Missing initial pseudostate** — Every state diagram must start with an `initial` node.
2. **Using transitions without labels** — All transitions (except from initial) must have an event/trigger label.
```

**Step 1: Write all four type files** (see content above for each)

**Step 2: Verify**

```bash
ls /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/types/
```

**Step 3: Commit**

```bash
git add .opencode/skills/draw-diagram/types/class.md .opencode/skills/draw-diagram/types/sequence.md .opencode/skills/draw-diagram/types/use-case.md .opencode/skills/draw-diagram/types/state.md
git commit -m "feat: add class, sequence, use-case, state diagram type skills"
```

---

## Task 5: Write UML type files (batch 2: activity, component, deployment, object)

**Files:** `types/activity.md`, `types/component.md`, `types/deployment.md`, `types/object.md`

### `types/activity.md`

```markdown
# Activity Diagram

**Purpose:** Model workflow or algorithmic behavior — actions, decisions, concurrency, swimlanes.

**diagramType:** `activity`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `initial` | `ellipse` | Start node (small filled circle, w=30, h=30) |
| `final` | `ellipse` | End node (w=30, h=30) |
| `action` | `rectangle` | An activity step or action |
| `decision` | `diamond` | Branch point (one in, multiple out) |
| `merge` | `diamond` | Merge point (multiple in, one out) |
| `fork` | `rectangle` | Fork bar for parallel flows (w=160, h=8) |
| `join` | `rectangle` | Join bar for parallel flows (w=160, h=8) |
| `swimlane` | `rectangle` | Swimlane header (tall, narrow; acts as label) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `flow` | Control flow (standard arrow) |
| `guarded-flow` | Labeled with `[condition]` |
| `object-flow` | Data/object passing between actions |

## Layout Convention

- Top-to-bottom: initial at top, actions flow downward, +100px per step
- Decisions: w=60, h=60 (diamond shape)
- Swimlane headers: x varies per lane, y=0, w=220, h=40; actions within at x+30, y=80+
- Fork/join bars: w=160, h=10, centered across parallel lanes

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "activity",
  "metadata": { "title": "Order Processing", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "start",       "kind": "initial",  "label": "",             "layout": { "x": 205, "y": 20,  "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" },
    { "id": "receive",     "kind": "action",   "label": "Receive Order","layout": { "x": 140, "y": 100, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "check-stock", "kind": "decision", "label": "In Stock?",    "layout": { "x": 170, "y": 220, "w": 100, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "ship",        "kind": "action",   "label": "Ship Order",   "layout": { "x": 140, "y": 360, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "backorder",   "kind": "action",   "label": "Back-Order",   "layout": { "x": 360, "y": 360, "w": 160, "h": 60,  "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "end",         "kind": "final",    "label": "",             "layout": { "x": 205, "y": 500, "w": 30,  "h": 30,  "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "f1", "from": "start",       "to": "receive",     "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f2", "from": "receive",     "to": "check-stock", "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f3", "from": "check-stock", "to": "ship",        "relation": "guarded-flow", "label": "[yes]", "styleToken": "edge.default" },
    { "id": "f4", "from": "check-stock", "to": "backorder",   "relation": "guarded-flow", "label": "[no]",  "styleToken": "edge.default" },
    { "id": "f5", "from": "ship",        "to": "end",         "relation": "flow",         "label": "",      "styleToken": "edge.default" },
    { "id": "f6", "from": "backorder",   "to": "end",         "relation": "flow",         "label": "",      "styleToken": "edge.default" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Forgetting merge nodes** — When two branches rejoin, add a `merge` diamond before the next action.
2. **Oversized fork/join bars** — Keep them thin: h=8–12, not the full 60px of a regular node.
```

### `types/component.md`

```markdown
# Component Diagram

**Purpose:** Show the physical or logical decomposition of a system into components with interfaces.

**diagramType:** `component`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `component` | `rectangle` | A software component (labeled with `«component»` stereotype) |
| `interface` | `ellipse` | A provided interface (lollipop notation — small circle, w=30, h=30) |
| `required-interface` | `ellipse` | A required interface (arc notation — small, w=30, h=30) |
| `port` | `rectangle` | Port on a component (small square on boundary, w=16, h=16) |
| `subsystem` | `rectangle` | Subsystem grouping (large container box) |
| `note` | `tldraw.note` | Annotation |

## Edge Relations

| relation | Use for |
|---|---|
| `dependency` | Component depends on another |
| `realization` | Component provides/realizes an interface |
| `usage` | Component uses/requires an interface |
| `assembly` | Provided interface connects to required interface |

## Layout Convention

- Left-to-right: client components on left, service/infrastructure on right
- Components: w=180, h=80
- Interfaces (lollipop): w=30, h=30, positioned at component boundary
- Node spacing: 240px horizontal, 120px vertical

## Example

```json
{
  "schemaVersion": "1.0",
  "diagramType": "component",
  "metadata": { "title": "API Architecture", "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z" },
  "style": { "theme": "technical", "tokens": {} },
  "nodes": [
    { "id": "web",     "kind": "component", "label": "«component»\nWeb App",     "layout": { "x": 60,  "y": 100, "w": 180, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.default" },
    { "id": "api",     "kind": "component", "label": "«component»\nREST API",    "layout": { "x": 320, "y": 100, "w": 180, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.system" },
    { "id": "db",      "kind": "component", "label": "«component»\nDatabase",    "layout": { "x": 580, "y": 100, "w": 180, "h": 80, "locked": false }, "semantics": {}, "styleToken": "node.external" },
    { "id": "iface",   "kind": "interface", "label": "IUserAPI",                 "layout": { "x": 260, "y": 126, "w": 30,  "h": 30, "locked": false }, "semantics": {}, "styleToken": "node.accent" }
  ],
  "edges": [
    { "id": "e1", "from": "web", "to": "iface",  "relation": "usage",      "label": "", "styleToken": "edge.dashed" },
    { "id": "e2", "from": "api", "to": "iface",  "relation": "realization", "label": "", "styleToken": "edge.default" },
    { "id": "e3", "from": "api", "to": "db",     "relation": "dependency",  "label": "", "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Drawing components as plain boxes without stereotype** — Always include `«component»` in the label or semantics.
2. **Connecting components directly instead of through interfaces** — Prefer interface-mediated connections for architectural diagrams.
```

### `types/deployment.md`

```markdown
# Deployment Diagram

**Purpose:** Show the physical or cloud deployment topology — execution environments, nodes, artifacts.

**diagramType:** `deployment`

## Node Kinds

| kind | geo | Use for |
|---|---|---|
| `node` | `rectangle` | Execution environment (server, VM, container, device) — use `«device»`, `«server»`, `«container»` stereotype |
| `artifact` | `rectangle` | Deployable unit (JAR, WAR, executable, image) — smaller box inside node |
| `database` | `cylinder` | Database artifact or node |
| `cloud` | `cloud` | Cloud region or provider |
| `device` | `rectangle` | Physical device |
| `note` | `tldraw.note` | Annotation |

> Note: `cylinder` and `cloud` map to tldraw geo shapes directly.

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
    { "id": "browser-node", "kind": "node",     "label": "«device»\nBrowser",     "layout": { "x": 40,  "y": 80,  "w": 200, "h": 100, "locked": false }, "semantics": { "stereotype": "device" },    "styleToken": "node.default" },
    { "id": "app-server",   "kind": "node",     "label": "«server»\nApp Server",  "layout": { "x": 300, "y": 80,  "w": 200, "h": 100, "locked": false }, "semantics": { "stereotype": "server" },   "styleToken": "node.system" },
    { "id": "db-server",    "kind": "database", "label": "PostgreSQL",            "layout": { "x": 560, "y": 80,  "w": 200, "h": 120, "locked": false }, "semantics": {},                           "styleToken": "node.external" },
    { "id": "api-artifact", "kind": "artifact", "label": "«artifact»\napi.jar",   "layout": { "x": 320, "y": 110, "w": 160, "h": 50,  "locked": false }, "semantics": { "stereotype": "artifact" }, "styleToken": "node.default" }
  ],
  "edges": [
    { "id": "e1", "from": "browser-node", "to": "app-server", "relation": "communication-path", "label": "HTTPS", "styleToken": "edge.default" },
    { "id": "e2", "from": "app-server",   "to": "db-server",  "relation": "communication-path", "label": "TCP/5432", "styleToken": "edge.default" },
    { "id": "e3", "from": "api-artifact", "to": "app-server", "relation": "deployment",          "label": "",      "styleToken": "edge.dashed" }
  ],
  "groups": [], "constraints": [], "sourceRefs": {}
}
```

## Common Mistakes

1. **Showing logical components instead of physical artifacts** — Deployment diagrams show what runs where, not the code structure.
2. **Missing communication-path labels** — Always label links with the protocol/port.
```

### `types/object.md`

```markdown
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
    { "id": "alice-obj",   "kind": "object", "label": "alice : User",    "layout": { "x": 80,  "y": 100, "w": 200, "h": 100, "locked": false }, "semantics": { "slots": ["id = 1", "email = \"alice@x.com\""] }, "styleToken": "node.default" },
    { "id": "session-obj", "kind": "object", "label": "s1 : Session",    "layout": { "x": 360, "y": 100, "w": 200, "h": 100, "locked": false }, "semantics": { "slots": ["token = \"abc123\"", "expiresAt = \"2026-12-31\""] }, "styleToken": "node.default" }
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
```

**Step 1: Write all four files**

**Step 2: Commit**

```bash
git add .opencode/skills/draw-diagram/types/activity.md .opencode/skills/draw-diagram/types/component.md .opencode/skills/draw-diagram/types/deployment.md .opencode/skills/draw-diagram/types/object.md
git commit -m "feat: add activity, component, deployment, object diagram type skills"
```

---

## Task 6: Write UML type files (batch 3: timing, package, interaction-overview, composite-structure, communication)

**Files:** `types/timing.md`, `types/package.md`, `types/interaction-overview.md`, `types/composite-structure.md`, `types/communication.md`

Each follows the same template. Key distinctions:

### `types/timing.md`
- **Purpose:** Show state changes of objects over a time axis
- **Nodes:** `lifeline` (header), `state-label` (rectangle on timeline), `time-axis` (horizontal line)
- **Edges:** `transition` (vertical step)
- **Layout:** Lifelines as row headers on left (y increments 100px); time axis runs left-to-right; state rectangles fill horizontal spans

### `types/package.md`
- **Purpose:** Show namespace/package organization and dependencies
- **Nodes:** `package` (rectangle with tab notation — use label like `«package» com.example.auth`), `class` (inside packages, smaller)
- **Edges:** `import` (dashed + `«import»`), `access` (dashed + `«access»`), `dependency`
- **Layout:** Packages as large rectangles, classes nested inside with +30px offset

### `types/interaction-overview.md`
- **Purpose:** High-level flow of interaction fragments — a flowchart of sequence fragments
- **Nodes:** `initial`, `final`, `interaction-ref` (rectangle labeled `ref:` + interaction name), `decision`, `fork`, `join`
- **Edges:** `flow`, `guarded-flow`
- **Layout:** Top-to-bottom like activity diagram

### `types/composite-structure.md`
- **Purpose:** Show internal structure of a classifier — parts, ports, connectors
- **Nodes:** `classifier` (large outer rectangle), `part` (rectangle inside classifier with `/partName : Type`), `port` (small square on boundary), `connector` (labeled link between ports)
- **Edges:** `connector` (part-to-part), `delegation` (port to internal part)
- **Layout:** Classifier as large container (w=500, h=300); parts inside with offsets

### `types/communication.md`
- **Purpose:** Show objects and their interactions with numbered messages (formerly collaboration diagram)
- **Nodes:** `object` (rectangle, `instanceName : Class` format)
- **Edges:** `message` (labeled with sequence number + message: `1: login()`, `2: validate()`)
- **Layout:** Objects arranged in network topology (not linear — free placement), messages as labeled arrows

**Step 1: Write all five files** (follow template: purpose, node kinds, edge relations, semantics, layout, example, mistakes)

**Step 2: Commit**

```bash
git add .opencode/skills/draw-diagram/types/timing.md .opencode/skills/draw-diagram/types/package.md .opencode/skills/draw-diagram/types/interaction-overview.md .opencode/skills/draw-diagram/types/composite-structure.md .opencode/skills/draw-diagram/types/communication.md
git commit -m "feat: add timing, package, interaction-overview, composite-structure, communication type skills"
```

---

## Task 7: Write non-UML type files (batch 1: flowchart, er, mind-map, block)

**Files:** `types/flowchart.md`, `types/er.md`, `types/mind-map.md`, `types/block.md`

### `types/flowchart.md`
- **Purpose:** Generic process flow with decisions
- **Nodes:** `start` (`ellipse`, w=100, h=50), `end` (`ellipse`), `process` (`rectangle`), `decision` (`diamond`), `document` (`trapezoid`), `data` (`rhombus`)
- **Edges:** `flow`, `guarded-flow` (labeled `[yes]`/`[no]`)
- **Layout:** Top-to-bottom; decisions branch right for `[no]`, continue down for `[yes]`

### `types/er.md`
- **Purpose:** Entity-relationship diagram (Crow's Foot notation for cardinality)
- **Nodes:** `entity` (`rectangle`, w=180, h=60), `attribute` (`ellipse`, small, w=120, h=40), `weak-entity` (`rectangle` with double border — use `semantics.weak: true`)
- **Edges:** `relationship` (labeled with verb), with cardinality in semantics: `"semantics": { "cardinality": "1:N" }`
- **Layout:** Entities as main nodes, relationships as labeled edges; entities 280px apart

### `types/mind-map.md`
- **Purpose:** Radial hierarchy from central concept
- **Nodes:** `root` (`ellipse`, w=200, h=80, center of canvas), `branch` (`rectangle`, w=160, h=50), `leaf` (`rectangle`, w=140, h=40)
- **Edges:** `branch` (from root to branch), `leaf` (from branch to leaf)
- **Layout:** Root at (400, 300); branches radiate at 45°/90°/135°/180°/225°/270°/315°/360° at 200px radius; leaves at 380px radius

### `types/block.md`
- **Purpose:** Functional decomposition — SysML-style blocks with flows
- **Nodes:** `block` (`rectangle`, labeled `«block» Name`), `flow-port` (`ellipse` at boundary, w=20, h=20), `value-property` (inside block)
- **Edges:** `item-flow` (labeled with flow item), `connector`
- **Layout:** Top-to-bottom decomposition or left-to-right pipeline; blocks 250px apart

**Step 1: Write all four files**

**Step 2: Commit**

```bash
git add .opencode/skills/draw-diagram/types/flowchart.md .opencode/skills/draw-diagram/types/er.md .opencode/skills/draw-diagram/types/mind-map.md .opencode/skills/draw-diagram/types/block.md
git commit -m "feat: add flowchart, er, mind-map, block diagram type skills"
```

---

## Task 8: Write non-UML type files (batch 2: c4-context, c4-container, network, gantt)

**Files:** `types/c4-context.md`, `types/c4-container.md`, `types/network.md`, `types/gantt.md`

### `types/c4-context.md`
- **Purpose:** C4 Level 1 — show the target system in context of users and external systems
- **Nodes:** `person` (`ellipse` or `rectangle`, labeled with `[Person]` tag), `system` (`rectangle`, the main subject — use `node.system` style), `external-system` (`rectangle`, use `node.external` style)
- **Edges:** `uses` (person→system, labeled with technology/purpose), `external-rel` (system↔external-system)
- **Layout:** Target system centered; persons upper-left; external systems around perimeter; 300px spacing

### `types/c4-container.md`
- **Purpose:** C4 Level 2 — zoom into the target system showing containers (apps, DBs, APIs)
- **Nodes:** `system-boundary` (large `rectangle` container), `container` (`rectangle` inside boundary), `database` (`cylinder`), `person` (`ellipse`), `external-system` (`rectangle`)
- **Edges:** `uses` (labeled with technology), `reads-from`, `writes-to`
- **Layout:** Boundary box centered (large: w=600+, h=400+); containers inside; external elements outside boundary

### `types/network.md`
- **Purpose:** Physical or logical network topology
- **Nodes:** `router` (`hexagon`, w=80, h=80), `switch` (`rectangle`), `server` (`rectangle`), `firewall` (`diamond`), `cloud` (`cloud`), `workstation` (`rectangle`), `subnet` (`rectangle`, large container)
- **Edges:** `link` (labeled with bandwidth/protocol), `wireless` (dashed)
- **Layout:** Core in center; edge devices around perimeter; subnets as grouping boxes

### `types/gantt.md`
- **Purpose:** Project timeline showing tasks, durations, dependencies, milestones
- **Nodes:** `task-bar` (`rectangle`, width proportional to duration), `milestone` (`diamond`, w=20, h=20), `swimlane-header` (`rectangle`, row header on left)
- **Edges:** `dependency` (task→task: finish-to-start)
- **Layout:** Time axis is horizontal (each week/sprint = 80px); tasks as rows (y increments 60px); swimlane headers at x=0, w=150; task bars start at x=160+

**Step 1: Write all four files**

**Step 2: Commit**

```bash
git add .opencode/skills/draw-diagram/types/c4-context.md .opencode/skills/draw-diagram/types/c4-container.md .opencode/skills/draw-diagram/types/network.md .opencode/skills/draw-diagram/types/gantt.md
git commit -m "feat: add c4-context, c4-container, network, gantt diagram type skills"
```

---

## Task 9: Final verification

**Step 1: Verify all files exist**

```bash
find /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram -type f | sort
```

Expected output (26 files):
```
.opencode/skills/draw-diagram/SKILL.md
.opencode/skills/draw-diagram/themes/themes.md
.opencode/skills/draw-diagram/themes/beautiful.md
.opencode/skills/draw-diagram/themes/presentation.md
.opencode/skills/draw-diagram/themes/technical.md
.opencode/skills/draw-diagram/types/activity.md
.opencode/skills/draw-diagram/types/block.md
.opencode/skills/draw-diagram/types/c4-container.md
.opencode/skills/draw-diagram/types/c4-context.md
.opencode/skills/draw-diagram/types/class.md
.opencode/skills/draw-diagram/types/communication.md
.opencode/skills/draw-diagram/types/component.md
.opencode/skills/draw-diagram/types/composite-structure.md
.opencode/skills/draw-diagram/types/deployment.md
.opencode/skills/draw-diagram/types/er.md
.opencode/skills/draw-diagram/types/flowchart.md
.opencode/skills/draw-diagram/types/gantt.md
.opencode/skills/draw-diagram/types/interaction-overview.md
.opencode/skills/draw-diagram/types/mind-map.md
.opencode/skills/draw-diagram/types/network.md
.opencode/skills/draw-diagram/types/object.md
.opencode/skills/draw-diagram/types/package.md
.opencode/skills/draw-diagram/types/sequence.md
.opencode/skills/draw-diagram/types/state.md
.opencode/skills/draw-diagram/types/timing.md
.opencode/skills/draw-diagram/types/use-case.md
```

**Step 2: Verify SKILL.md frontmatter is valid**

```bash
head -5 /Users/Shared/dev/theia-openspace/.opencode/skills/draw-diagram/SKILL.md
```

Expected: frontmatter with `name: draw-diagram`

**Step 3: Verify skill is discoverable by OpenCode**

The skill will be listed in the `skill` tool's available skills. In OpenCode, invoke `skill({ name: "draw-diagram" })` to confirm it loads.

**Step 4: Final commit**

```bash
git add .opencode/skills/draw-diagram/
git commit -m "feat: complete draw-diagram skill system (21 types, 3 themes)"
```
