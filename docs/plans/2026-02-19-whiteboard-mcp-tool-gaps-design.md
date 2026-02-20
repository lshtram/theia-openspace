# Whiteboard MCP Tool Gaps — Design Document

> **Date:** 2026-02-19  
> **Status:** Approved  
> **Author:** brainstorming session

---

## 1. Problem

The `draw-diagram` skill and whiteboard MCP integration have several gaps preventing reliable diagram creation:

### 1a. SKILL.md references non-existent tools

`draw-diagram/SKILL.md` instructs the agent to call:
- `whiteboard.update` — **does not exist** in hub-mcp.ts
- `drawing.inspect_scene` — **does not exist**
- `drawing.propose_patch` / `drawing.apply_patch` — **do not exist**

Every diagram creation attempt fails because the agent cannot apply the diagram.

### 1b. No batch add tool (performance)

A flowchart with 10 nodes + 9 arrows requires 19 sequential `add_shape` calls, each going through the MCP bridge at ~1–2s per call. That's 19–38 seconds minimum for a small diagram, and any mid-stream error leaves a partial diagram on canvas.

### 1c. No atomic replace tool

To replace a diagram the agent must: `read` (get all shape IDs), then `delete_shape` N times, then `add_shape` N times. There is no atomic "clear and redraw" operation.

### 1d. `text` shape gets incorrect `h` prop

In `addShapeViaEditor` (whiteboard-command-contribution.ts), `baseProps` injects `h: args.height ?? 100` for all non-arrow shape types. But tldraw's `text` shape does NOT accept `h` — it auto-sizes. This causes a tldraw validation warning for every text shape.

### 1e. `frame` shape type untested

Some diagram types (composite-structure, swimlanes in activity) need a `frame` shape. The `frame` type is tldraw-native but untested through the MCP bridge.

---

## 2. Architecture Decision: Keep `diagram.json` as conceptual intermediate

The `diagram.json` format (schemaVersion, nodes, edges, style, semantics) is preserved as the agent's **conceptual mental model** inside the skill instructions. This provides:

1. **Engine abstraction:** The format can be translated to any future rendering engine, not just tldraw
2. **Token efficiency:** Agents reason about diagrams in semantic terms (lifelines, states, actors) rather than raw tldraw store records
3. **Maintainability:** Type files and theme files describe diagram semantics independently of tldraw internals

However, `diagram.json` is **NOT a tool parameter**. The skill translates it to tldraw-native `add_shape` calls. There is no `whiteboard.update(diagram.json)` tool — that translation layer was never implemented and is not needed.

---

## 3. Solution Design

### 3a. New MCP tools (hub-mcp.ts)

#### `openspace.whiteboard.batch_add_shapes`
Add N shapes in a single bridge round-trip.

**Parameters:**
```typescript
{
  path: string,              // absolute path to .whiteboard.json
  shapes: Array<{
    type: string,            // tldraw shape type: geo | text | arrow | note | frame
    x: number,
    y: number,
    width?: number,          // not used for arrow
    height?: number,         // not used for arrow or text
    props?: Record<string, unknown>
  }>
}
```

**Returns:** `{ success: true, shapeIds: string[], path: string }`

**Implementation:** Calls `openspace.whiteboard.batch_add_shapes` via `executeViaBridge`. The browser handler calls `createShape` in a loop (or uses `editor.createShapes([...])` if the tldraw API supports it).

#### `openspace.whiteboard.replace`
Atomically clear all shapes from a whiteboard and add a new set in one bridge call.

**Parameters:**
```typescript
{
  path: string,
  shapes: Array<same as batch_add_shapes>
}
```

**Returns:** `{ success: true, shapeIds: string[], clearedCount: number, path: string }`

**Implementation:** Browser handler calls `editor.selectAll()` + `editor.deleteShapes()` then `editor.createShapes()` (or iterates). Wrapped in a single transaction if tldraw supports it, otherwise sequential with auto-save suppressed until complete.

#### `openspace.whiteboard.find_shapes`
Search shapes on a whiteboard without reading the full store.

**Parameters:**
```typescript
{
  path: string,
  label?: string,            // substring match on shape text content
  type?: string,             // filter by tldraw shape type
  tag?: string,              // filter by shapes that have a metadata tag (for diagram kinds)
  limit?: number             // default 50
}
```

**Returns:** Array of `{ id, type, x, y, width, height, label }` — compact, no richText blobs

**Implementation:** Browser handler reads `editor.getCurrentPageShapes()`, filters, extracts text from `richText` to a plain string for the response.

### 3b. Fixes to existing tools (whiteboard-command-contribution.ts)

#### Fix `text` shape height injection
In `addShapeViaEditor`, the `baseProps` currently injects `h` for all non-arrow types. Change to also exclude `text` shapes:

```typescript
const isArrow = args.type === 'arrow';
const isText = args.type === 'text';
const baseProps: Record<string, unknown> = (isArrow || isText)
  ? {}
  : { w: args.width ?? 200, h: args.height ?? 100 };
```

### 3c. Updates to `draw-diagram/SKILL.md`

Replace the broken MCP tool table with the actual tools. Update the workflow:

**Old (broken):**
1. Compose `diagram.json`
2. Call `whiteboard.update` with full JSON

**New (correct):**
1. Compose diagram in `diagram.json` mental model (using type file + theme file)
2. Translate nodes → `add_shape` specs (tldraw props: `type`, `x`, `y`, `width`, `height`, `props`)
3. For **new diagrams**: call `openspace.whiteboard.replace` (one round-trip)
4. For **edits**: call `openspace.whiteboard.find_shapes` to locate targets, then `update_shape`/`delete_shape`/`batch_add_shapes`

The skill also needs a **translation table** mapping `diagram.json` node kinds and edge styles to tldraw props, since the type files use semantic kinds (like `lifeline`, `actor`, `decision`) that need to become specific tldraw geo values.

### 3d. Translation table in SKILL.md

The updated SKILL.md will include a section:

**Node kind → tldraw shape:**

| diagram.json kind | tldraw type | props.geo | Notes |
|---|---|---|---|
| `class`, `state`, `action`, `lifeline`, `component`, `object`, `package` | `geo` | `rectangle` | Standard box |
| `decision`, `choice`, `merge` | `geo` | `diamond` | |
| `start`, `initial`, `actor` (oval) | `geo` | `ellipse` | |
| `use-case` | `geo` | `ellipse` | |
| `end`, `final` | `geo` | `ellipse` | Small w=40, h=40 |
| `cloud` | `geo` | `cloud` | |
| `note` | `note` | — | tldraw sticky note type |
| `database` | `geo` | `trapezoid` | Approximate cylinder |
| `router` | `geo` | `hexagon` | |
| `firewall` | `geo` | `diamond` | |
| `milestone` | `geo` | `diamond` | Small w=20, h=20 |
| `fork`, `join` | `geo` | `rectangle` | Thin: h=8–12 |
| `frame`, `swimlane`, `system-boundary`, `classifier` | `geo` | `rectangle` | Large container |

**Edge style → tldraw arrow props:**

| styleToken | props.dash | props.arrowheadEnd |
|---|---|---|
| `edge.default` | `draw` | `arrow` |
| `edge.dashed` | `dashed` | `arrow` |
| `edge.message` | `draw` | `arrow` |
| `edge.async` | `dashed` | `arrow` |
| `inheritance` | `draw` | `triangle` |
| `implementation` | `dashed` | `triangle` |

---

## 4. What is NOT in scope

- No `whiteboard.update` tool accepting `diagram.json` — translation stays in the skill
- No `drawing.inspect_scene` / `drawing.propose_patch` / `drawing.apply_patch` — replaced by `find_shapes` + direct mutation tools
- No Playwright test suite (separate task)
- No `frame` shape deep testing (nice to have, but blocking demo is more important)

---

## 5. Files to change

| File | Change |
|---|---|
| `extensions/openspace-core/src/node/hub-mcp.ts` | Add `batch_add_shapes`, `replace`, `find_shapes` tool registrations |
| `extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts` | Fix `text` shape height injection |
| `extensions/openspace-whiteboard/src/browser/whiteboard-widget.tsx` | Add `batchCreateShapes`, `replaceAllShapes`, `findShapes` methods |
| `.opencode/skills/draw-diagram/SKILL.md` | Fix tool references, add translation table, update workflow |
| `.worktrees/whiteboard-direct-mount/` | Sync all changes + rebuild |

---

## 6. Build sequence (after code changes)

```bash
# 1. Build whiteboard extension (tsc)
cd .worktrees/whiteboard-direct-mount/extensions/openspace-whiteboard && npm run build

# 2. Build openspace-core (tsc — hub-mcp.ts changed)
cd .worktrees/whiteboard-direct-mount/extensions/openspace-core && npm run build

# 3. Build browser-app (webpack)
cd .worktrees/whiteboard-direct-mount/browser-app && npm run build

# 4. Hard-reload browser: Cmd+Shift+R on localhost:3000
```
