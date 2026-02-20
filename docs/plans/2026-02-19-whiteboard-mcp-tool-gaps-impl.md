# Whiteboard MCP Tool Gaps — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken `draw-diagram` skill + add `batch_add_shapes`, `replace`, and `find_shapes` MCP tools so agents can create diagrams reliably in one round-trip.

**Architecture:** Three new MCP tools added to hub-mcp.ts + matching browser handlers in whiteboard-widget.tsx + one bug fix in whiteboard-command-contribution.ts + SKILL.md rewrite to reference actual tools. All changes go in main repo, then synced to the worktree `.worktrees/whiteboard-direct-mount/` for rebuild.

**Tech Stack:** TypeScript, tldraw 4.x Editor API, MCP SDK (zod schemas), Theia CommandContribution.

---

## IMPORTANT: Build context

- Server runs from: `.worktrees/whiteboard-direct-mount/` (port 3000)
- Before any build, verify: `ps aux | grep main.js` to confirm PID and path
- Build sequence after code changes:
  1. `cd .worktrees/whiteboard-direct-mount/extensions/openspace-whiteboard && npm run build` (tsc)
  2. `cd .worktrees/whiteboard-direct-mount/extensions/openspace-core && npm run build` (tsc — hub-mcp.ts)
  3. `cd .worktrees/whiteboard-direct-mount/browser-app && npm run build` (webpack)
  4. Hard-reload browser: Cmd+Shift+R on localhost:3000
- Changes must be made to BOTH `extensions/` (main repo) AND `.worktrees/whiteboard-direct-mount/extensions/` (running server)

---

## Task 1: Fix `text` shape height injection bug

**Files:**
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts:631`

The `addShapeViaEditor` method currently injects `h` for all non-arrow types. tldraw's `text` shape does not accept `h` (auto-sizes). This causes a validation warning on every text shape.

**Step 1: Read the current code**

Read `extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts`, lines 628–648.

**Step 2: Apply the fix**

In `addShapeViaEditor`, change:
```typescript
const isArrow = args.type === 'arrow';
const baseProps: Record<string, unknown> = isArrow
    ? {}  // arrows: no w/h; caller supplies start/end in args.props
    : { w: args.width ?? 200, h: args.height ?? 100 };
```
to:
```typescript
const isArrow = args.type === 'arrow';
const isText = args.type === 'text';
const baseProps: Record<string, unknown> = (isArrow || isText)
    ? {}  // arrows: use start/end; text: auto-sizes (no h)
    : { w: args.width ?? 200, h: args.height ?? 100 };
```

For `text` shapes, also default `w` to 200 if not provided (text needs a width for wrapping). Update the condition to pass `w` for text:

```typescript
const isArrow = args.type === 'arrow';
const isText = args.type === 'text';
let baseProps: Record<string, unknown>;
if (isArrow) {
    baseProps = {};  // arrows: use start/end in props
} else if (isText) {
    baseProps = { w: args.width ?? 200 };  // text: w only, no h (auto-sizes)
} else {
    baseProps = { w: args.width ?? 200, h: args.height ?? 100 };
}
```

**Step 3: Verify the change looks correct**

Re-read the modified section to confirm no syntax errors.

**Step 4: Commit main repo**

```bash
git add extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts
git commit -m "fix: text shapes should not receive h prop (auto-sizes in tldraw)"
```

---

## Task 2: Add `batchCreateShapes`, `replaceAllShapes`, `findShapes` to WhiteboardWidget

**Files:**
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-widget.tsx`

These methods will be called by the new command handlers. They mirror the existing `createShape`, `updateShapeById`, `deleteShapeById` pattern.

**Step 1: Read the current widget methods (lines 164–210)**

Understand the `createShape` method pattern to replicate it.

**Step 2: Add `batchCreateShapes` method after `createShape` (around line 180)**

```typescript
/**
 * Create multiple shapes in a single operation.
 * Returns the list of created shape IDs.
 */
batchCreateShapes(shapePartials: Record<string, unknown>[]): string[] {
    if (!this.editorRef) {
        this.logger.warn('[WhiteboardWidget] batchCreateShapes: editor not mounted');
        return [];
    }
    const ids: string[] = [];
    for (const partial of shapePartials) {
        this.editorRef.createShape(partial as Parameters<Editor['createShape']>[0]);
        if (partial['id']) ids.push(partial['id'] as string);
    }
    this.handleDataChange();
    return ids;
}
```

**Step 3: Add `replaceAllShapes` method after `batchCreateShapes`**

```typescript
/**
 * Delete all existing shapes and create a new set atomically.
 * Returns { clearedCount, shapeIds }.
 */
replaceAllShapes(shapePartials: Record<string, unknown>[]): { clearedCount: number; shapeIds: string[] } {
    if (!this.editorRef) {
        this.logger.warn('[WhiteboardWidget] replaceAllShapes: editor not mounted');
        return { clearedCount: 0, shapeIds: [] };
    }
    // Get all current shape IDs to count them
    const existing = this.editorRef.getCurrentPageShapes();
    const clearedCount = existing.length;
    // Delete all existing shapes
    if (clearedCount > 0) {
        this.editorRef.selectAll();
        this.editorRef.deleteShapes(this.editorRef.getSelectedShapeIds());
    }
    // Create new shapes
    const shapeIds: string[] = [];
    for (const partial of shapePartials) {
        this.editorRef.createShape(partial as Parameters<Editor['createShape']>[0]);
        if (partial['id']) shapeIds.push(partial['id'] as string);
    }
    this.handleDataChange();
    return { clearedCount, shapeIds };
}
```

**Step 4: Add `findShapes` method after `replaceAllShapes`**

```typescript
/**
 * Find shapes on the current page, optionally filtered by label substring,
 * shape type, or a metadata tag stored in shape.meta.tag.
 * Returns compact shape summaries (no richText blobs).
 */
findShapes(opts: {
    label?: string;
    type?: string;
    tag?: string;
    limit?: number;
}): Array<{ id: string; type: string; x: number; y: number; width: number; height: number; label: string }> {
    if (!this.editorRef) {
        this.logger.warn('[WhiteboardWidget] findShapes: editor not mounted');
        return [];
    }
    const limit = opts.limit ?? 50;
    const shapes = this.editorRef.getCurrentPageShapes();
    const results: Array<{ id: string; type: string; x: number; y: number; width: number; height: number; label: string }> = [];

    for (const shape of shapes) {
        if (opts.type && shape.type !== opts.type) continue;
        if (opts.tag) {
            const meta = shape.meta as Record<string, unknown> | undefined;
            if (!meta || meta['tag'] !== opts.tag) continue;
        }

        // Extract plain text label from richText if present
        const props = shape.props as Record<string, unknown> | undefined;
        let label = '';
        if (props) {
            const rt = props['richText'] as { content?: Array<{ content?: Array<{ text?: string }> }> } | undefined;
            if (rt?.content) {
                label = rt.content
                    .flatMap(p => p.content ?? [])
                    .map(t => t.text ?? '')
                    .join('');
            }
        }

        if (opts.label && !label.toLowerCase().includes(opts.label.toLowerCase())) continue;

        results.push({
            id: shape.id,
            type: shape.type,
            x: shape.x,
            y: shape.y,
            width: (props?.['w'] as number) ?? 0,
            height: (props?.['h'] as number) ?? 0,
            label,
        });

        if (results.length >= limit) break;
    }

    return results;
}
```

**Step 5: Verify the file compiles**

```bash
cd extensions/openspace-whiteboard && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

**Step 6: Commit**

```bash
git add extensions/openspace-whiteboard/src/browser/whiteboard-widget.tsx
git commit -m "feat: add batchCreateShapes, replaceAllShapes, findShapes to WhiteboardWidget"
```

---

## Task 3: Add batch_add_shapes, replace, find_shapes command handlers

**Files:**
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts`

**Step 1: Add new command IDs to `WhiteboardCommandIds` (around line 41)**

Add after `CAMERA_GET`:
```typescript
BATCH_ADD_SHAPES: 'openspace.whiteboard.batch_add_shapes',
REPLACE: 'openspace.whiteboard.replace',
FIND_SHAPES: 'openspace.whiteboard.find_shapes',
```

**Step 2: Add new service types to imports**

In the import from `'./whiteboard-service'`, add:
```typescript
WhiteboardBatchAddShapesArgs,
WhiteboardReplaceArgs,
WhiteboardFindShapesArgs,
```

**Step 3: Add argument schemas (after the `camera_get` schema block, around line 222)**

```typescript
batch_add_shapes: {
    type: 'object',
    properties: {
        path: { type: 'string', description: 'Path to the whiteboard file' },
        shapes: {
            type: 'array',
            description: 'Array of shapes to add',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                    props: { type: 'object' }
                },
                required: ['type', 'x', 'y']
            }
        }
    },
    required: ['path', 'shapes'],
    additionalProperties: false
},
replace: {
    type: 'object',
    properties: {
        path: { type: 'string', description: 'Path to the whiteboard file' },
        shapes: {
            type: 'array',
            description: 'Shapes to place after clearing the canvas',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                    props: { type: 'object' }
                },
                required: ['type', 'x', 'y']
            }
        }
    },
    required: ['path', 'shapes'],
    additionalProperties: false
},
find_shapes: {
    type: 'object',
    properties: {
        path: { type: 'string', description: 'Path to the whiteboard file' },
        label: { type: 'string', description: 'Substring to match against shape text labels' },
        type: { type: 'string', description: 'Filter by tldraw shape type (geo, arrow, text, note)' },
        tag: { type: 'string', description: 'Filter by shapes with this metadata tag' },
        limit: { type: 'number', description: 'Max results (default: 50)' }
    },
    required: ['path'],
    additionalProperties: false
},
```

**Step 4: Register the three new commands in `registerCommands` (before the closing `}` of `registerCommands`, around line 393)**

```typescript
// openspace.whiteboard.batch_add_shapes
registry.registerCommand(
    {
        id: WhiteboardCommandIds.BATCH_ADD_SHAPES,
        label: 'OpenSpace: Batch Add Shapes to Whiteboard'
    },
    {
        execute: async (args: WhiteboardBatchAddShapesArgs) => {
            this.logger.info('[WhiteboardCommand] Batch adding', args.shapes?.length, 'shapes to:', args.path);
            return this.batchAddShapesViaEditor(args);
        }
    }
);

// openspace.whiteboard.replace
registry.registerCommand(
    {
        id: WhiteboardCommandIds.REPLACE,
        label: 'OpenSpace: Replace Whiteboard Content'
    },
    {
        execute: async (args: WhiteboardReplaceArgs) => {
            this.logger.info('[WhiteboardCommand] Replacing whiteboard content:', args.path, 'with', args.shapes?.length, 'shapes');
            return this.replaceViaEditor(args);
        }
    }
);

// openspace.whiteboard.find_shapes
registry.registerCommand(
    {
        id: WhiteboardCommandIds.FIND_SHAPES,
        label: 'OpenSpace: Find Shapes in Whiteboard'
    },
    {
        execute: async (args: WhiteboardFindShapesArgs) => {
            this.logger.info('[WhiteboardCommand] Finding shapes in:', args.path);
            return this.findShapesViaEditor(args);
        }
    }
);
```

**Step 5: Add the three implementation methods (at the end of the class, before the closing `}`)**

```typescript
/**
 * Add multiple shapes to a whiteboard in one call.
 */
protected async batchAddShapesViaEditor(args: WhiteboardBatchAddShapesArgs): Promise<{ success: boolean; shapeIds: string[]; path: string }> {
    const widget = this.getActiveWidget(args.path);
    if (!widget || !widget.isEditorReady()) {
        throw new Error(`No active whiteboard editor for path: ${args.path}`);
    }

    const shapePartials = args.shapes.map((s, i) => {
        const id = `shape:${Date.now()}-${i}`;
        const isArrow = s.type === 'arrow';
        const isText = s.type === 'text';
        let baseProps: Record<string, unknown>;
        if (isArrow) {
            baseProps = {};
        } else if (isText) {
            baseProps = { w: s.width ?? 200 };
        } else {
            baseProps = { w: s.width ?? 200, h: s.height ?? 100 };
        }
        return {
            id,
            type: s.type,
            x: s.x,
            y: s.y,
            props: { ...baseProps, ...this.sanitizeProps(s.props ?? {}, s.type) }
        };
    });

    const shapeIds = widget.batchCreateShapes(shapePartials);
    return { success: true, shapeIds, path: args.path };
}

/**
 * Replace all shapes on a whiteboard (clear + batch add) atomically.
 */
protected async replaceViaEditor(args: WhiteboardReplaceArgs): Promise<{ success: boolean; shapeIds: string[]; clearedCount: number; path: string }> {
    const widget = this.getActiveWidget(args.path);
    if (!widget || !widget.isEditorReady()) {
        throw new Error(`No active whiteboard editor for path: ${args.path}`);
    }

    const shapePartials = args.shapes.map((s, i) => {
        const id = `shape:${Date.now()}-${i}`;
        const isArrow = s.type === 'arrow';
        const isText = s.type === 'text';
        let baseProps: Record<string, unknown>;
        if (isArrow) {
            baseProps = {};
        } else if (isText) {
            baseProps = { w: s.width ?? 200 };
        } else {
            baseProps = { w: s.width ?? 200, h: s.height ?? 100 };
        }
        return {
            id,
            type: s.type,
            x: s.x,
            y: s.y,
            props: { ...baseProps, ...this.sanitizeProps(s.props ?? {}, s.type) }
        };
    });

    const { clearedCount, shapeIds } = widget.replaceAllShapes(shapePartials);
    return { success: true, shapeIds, clearedCount, path: args.path };
}

/**
 * Find shapes on a whiteboard, returning compact summaries.
 */
protected async findShapesViaEditor(args: WhiteboardFindShapesArgs): Promise<{ success: boolean; shapes: unknown[]; path: string }> {
    const widget = this.getActiveWidget(args.path);
    if (!widget || !widget.isEditorReady()) {
        throw new Error(`No active whiteboard editor for path: ${args.path}`);
    }

    const shapes = widget.findShapes({
        label: args.label,
        type: args.type,
        tag: args.tag,
        limit: args.limit,
    });
    return { success: true, shapes, path: args.path };
}
```

**Step 6: Add the new arg types to whiteboard-service.ts**

Read `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts` to understand the existing arg type pattern, then add:

```typescript
export interface WhiteboardBatchAddShapesArgs {
    path: string;
    shapes: Array<{
        type: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        props?: Record<string, unknown>;
    }>;
}

export interface WhiteboardReplaceArgs {
    path: string;
    shapes: Array<{
        type: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
        props?: Record<string, unknown>;
    }>;
}

export interface WhiteboardFindShapesArgs {
    path: string;
    label?: string;
    type?: string;
    tag?: string;
    limit?: number;
}
```

**Step 7: Build and verify**

```bash
cd extensions/openspace-whiteboard && npm run build 2>&1 | tail -30
```

Expected: no TypeScript errors.

**Step 8: Commit**

```bash
git add extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts
git add extensions/openspace-whiteboard/src/browser/whiteboard-service.ts
git commit -m "feat: add batch_add_shapes, replace, find_shapes command handlers"
```

---

## Task 4: Register the three new MCP tools in hub-mcp.ts

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`

**Step 1: Add three new tool registrations to `registerWhiteboardTools` (after `camera.get`, around line 683)**

```typescript
server.tool(
    'openspace.whiteboard.batch_add_shapes',
    'Add multiple shapes to a whiteboard in a single call. Much faster than calling add_shape N times. ' +
    'Each shape follows the same rules as add_shape: type must be "geo"|"text"|"arrow"|"note". ' +
    'Colors must be tldraw named colors (black/grey/white/red/light-red/orange/yellow/green/light-green/blue/light-blue/violet/light-violet). ' +
    'Use props.richText for labels: {type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"label"}]}]}. ' +
    'Arrow shapes use props.start/end instead of width/height.',
    {
        path: z.string().describe('Absolute path to the .whiteboard.json file'),
        shapes: z.array(z.object({
            type: z.string().describe('tldraw shape type: "geo" | "text" | "arrow" | "note"'),
            x: z.number().describe('X position'),
            y: z.number().describe('Y position'),
            width: z.number().optional().describe('Width (not used for arrow or text)'),
            height: z.number().optional().describe('Height (not used for arrow or text)'),
            props: z.record(z.string(), z.unknown()).optional().describe('Shape props (same as add_shape.props)'),
        })).describe('Array of shapes to add'),
    },
    async (args: any) => this.executeViaBridge('openspace.whiteboard.batch_add_shapes', args)
);

server.tool(
    'openspace.whiteboard.replace',
    'Atomically clear all shapes from a whiteboard and replace with a new set. ' +
    'Use this for creating a new diagram or completely replacing an existing one. ' +
    'Much more efficient than delete_shape N times + add_shape N times. ' +
    'Shape rules are identical to batch_add_shapes.',
    {
        path: z.string().describe('Absolute path to the .whiteboard.json file'),
        shapes: z.array(z.object({
            type: z.string().describe('tldraw shape type: "geo" | "text" | "arrow" | "note"'),
            x: z.number().describe('X position'),
            y: z.number().describe('Y position'),
            width: z.number().optional(),
            height: z.number().optional(),
            props: z.record(z.string(), z.unknown()).optional(),
        })).describe('Complete set of shapes to place on the canvas after clearing'),
    },
    async (args: any) => this.executeViaBridge('openspace.whiteboard.replace', args)
);

server.tool(
    'openspace.whiteboard.find_shapes',
    'Find shapes on a whiteboard by label text, type, or metadata tag. ' +
    'Returns compact shape summaries (id, type, position, size, label text). ' +
    'Use this instead of whiteboard.read when you only need to locate specific shapes, ' +
    'to avoid receiving the full tldraw store (which can be very large for complex diagrams).',
    {
        path: z.string().describe('Absolute path to the .whiteboard.json file'),
        label: z.string().optional().describe('Substring to match against shape text content (case-insensitive)'),
        type: z.string().optional().describe('Filter by tldraw shape type (geo, arrow, text, note)'),
        tag: z.string().optional().describe('Filter by metadata tag stored in shape.meta.tag'),
        limit: z.number().int().min(1).max(200).optional().describe('Max results to return (default: 50)'),
    },
    async (args: any) => this.executeViaBridge('openspace.whiteboard.find_shapes', args)
);
```

**Step 2: Build openspace-core and verify**

```bash
cd extensions/openspace-core && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "feat: register batch_add_shapes, replace, find_shapes MCP tools"
```

---

## Task 5: Rewrite draw-diagram/SKILL.md

**Files:**
- Modify: `.opencode/skills/draw-diagram/SKILL.md`

The existing SKILL.md references tools that don't exist. Replace it entirely with a version that:
1. Describes the correct MCP tools
2. Adds a translation table from diagram.json node kinds → tldraw shape props
3. Updates the workflow to use `whiteboard.replace` for new diagrams

**Step 1: Read the current SKILL.md**

Read `.opencode/skills/draw-diagram/SKILL.md` to confirm current content.

**Step 2: Write the new SKILL.md**

Full content:

```markdown
---
name: draw-diagram
description: "Use when creating or editing any diagram in the whiteboard modality. Covers all UML types, flowcharts, ER, mind maps, C4, and more. Loads the right type-specific sub-skill and optional theme."
---

# Skill: draw-diagram

## Overview

This skill guides you to create or edit diagrams in the whiteboard modality using tldraw shapes via MCP tools.

**Mental model:** Reason about your diagram using `diagram.json` concepts (nodes, edges, kinds, semantics). Then **translate** those concepts into tldraw shape specs and apply them via the MCP tools below.

## Process

1. **Identify the diagram type** from the user's request (see catalogue below)
2. **Read the type file**: `Read` `.opencode/skills/draw-diagram/types/<type>.md`
3. **Choose a theme** (optional): `Read` `.opencode/skills/draw-diagram/themes/themes.md` then the specific theme file. Default: `technical`.
4. **Compose shapes**: Plan your diagram using the `diagram.json` mental model from the type file, then translate each node and edge to a tldraw shape spec (see translation table below)
5. **Apply** using the MCP tools below

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

## Translation Table: diagram.json → tldraw

### Node kinds → tldraw `geo` shape

| diagram.json `kind` | tldraw `type` | `props.geo` | Typical w × h |
|---|---|---|---|
| `class`, `state`, `action`, `lifeline`, `component`, `object`, `package`, `task-bar`, `swimlane` | `geo` | `rectangle` | 160×60 |
| `decision`, `choice`, `merge`, `firewall`, `milestone` | `geo` | `diamond` | 80×80 |
| `initial`, `final`, `use-case`, `actor` (oval) | `geo` | `ellipse` | 60×60 |
| `cloud` | `geo` | `cloud` | 160×100 |
| `note` | `note` | — | 160×80 |
| `database` | `geo` | `trapezoid` | 160×80 |
| `router`, `hexagon` | `geo` | `hexagon` | 80×80 |
| `fork`, `join` (bar) | `geo` | `rectangle` | 160×10 |
| `frame`, `system-boundary`, `classifier`, `swimlane-header` | `geo` | `rectangle` | 400×300 |

> Note: `initial` and `final` pseudostates should be small (w=40, h=40) and use `fill: "solid"` + dark color.
>
> Note: `fork`/`join` bars should be very thin (h=8–12) and wide (w=120–200).

### Edge styleTokens → tldraw `arrow` props

| `styleToken` / relation | `props.dash` | `props.arrowheadEnd` | `props.arrowheadStart` |
|---|---|---|---|
| `edge.default`, `message`, `flow`, `association`, `uses` | `draw` | `arrow` | `none` |
| `edge.dashed`, `dependency`, `implementation`, `return`, `async` | `dashed` | `arrow` | `none` |
| `inheritance`, `generalization` | `draw` | `triangle` | `none` |
| `composition` | `draw` | `arrow` | `dot` |
| `aggregation` | `draw` | `arrow` | `diamond` |
| `self-call` | `draw` | `arrow` | `none` |

> Arrows use `props.start` and `props.end` (absolute canvas coordinates), NOT width/height.
> For a straight arrow from (x1,y1) to (x2,y2): `start:{x:x1,y:y1}`, `end:{x:x2,y:y2}`.

### Colors (from theme tokens → tldraw named colors)

| Theme token | tldraw color |
|---|---|
| `node.default` fill | `white`, stroke `black` |
| `node.accent` | `blue` |
| `node.system` | `light-blue` |
| `node.external` | `grey` |
| `edge.default` | `black` |
| `edge.dashed` | `grey` |

### Text labels

All text on shapes uses `richText` (ProseMirror doc format):
```json
{
  "type": "doc",
  "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Label text"}]}]
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
| Create new diagram (atomic) | `openspace.whiteboard.replace` | `path`, `shapes[]` |
| Add shapes without clearing | `openspace.whiteboard.batch_add_shapes` | `path`, `shapes[]` |
| Find shapes by label/type | `openspace.whiteboard.find_shapes` | `path`, `label?`, `type?` |
| Update one shape | `openspace.whiteboard.update_shape` | `path`, `shapeId`, `props` |
| Delete one shape | `openspace.whiteboard.delete_shape` | `path`, `shapeId` |
| Read full whiteboard | `openspace.whiteboard.read` | `path` |
| List whiteboards | `openspace.whiteboard.list` | — |
| Open in UI pane | `openspace.whiteboard.open` | `path` |
| Fit camera to shapes | `openspace.whiteboard.camera.fit` | — |

## Hard Rules

1. Always read the type file before composing any diagram
2. Always use semantic `kind` values from the type file for your mental model — translate to tldraw props using the table above
3. Shape IDs must be unique and prefixed with `shape:` (e.g., `shape:user-class`, `shape:login-state`)
4. Layout coordinates must be spatially coherent — no two nodes at the same position
5. For **new** diagrams or **replacing** existing: use `openspace.whiteboard.replace`
6. For **adding to** an existing diagram: use `openspace.whiteboard.batch_add_shapes`
7. For **editing** specific shapes: use `openspace.whiteboard.find_shapes` to locate, then `update_shape`
8. After creating/replacing, call `openspace.whiteboard.camera.fit` to center the view
9. Colors must be tldraw named colors — never hex values
10. Text content must use `richText` format — never a plain `text` string prop
```

**Step 3: Verify the file was written correctly**

```bash
head -10 .opencode/skills/draw-diagram/SKILL.md
```

Expected: frontmatter with `name: draw-diagram`.

**Step 4: Commit**

```bash
git add .opencode/skills/draw-diagram/SKILL.md
git commit -m "fix: rewrite draw-diagram SKILL.md with correct MCP tool references and translation table"
```

---

## Task 6: Sync changes to worktree and rebuild

**Step 1: Verify the running server's worktree**

```bash
ps aux | grep main.js | grep -v grep
```

Expected: process running from `.worktrees/whiteboard-direct-mount/`.

**Step 2: Sync whiteboard extension**

```bash
cp -r extensions/openspace-whiteboard/src .worktrees/whiteboard-direct-mount/extensions/openspace-whiteboard/
```

**Step 3: Sync openspace-core**

```bash
cp extensions/openspace-core/src/node/hub-mcp.ts .worktrees/whiteboard-direct-mount/extensions/openspace-core/src/node/hub-mcp.ts
```

**Step 4: Build whiteboard extension in worktree**

```bash
cd .worktrees/whiteboard-direct-mount/extensions/openspace-whiteboard && npm run build 2>&1 | tail -20
```

Expected: `Found 0 errors`.

**Step 5: Build openspace-core in worktree**

```bash
cd .worktrees/whiteboard-direct-mount/extensions/openspace-core && npm run build 2>&1 | tail -20
```

Expected: `Found 0 errors`.

**Step 6: Build browser-app in worktree**

```bash
cd .worktrees/whiteboard-direct-mount/browser-app && npm run build 2>&1 | tail -40
```

Expected: webpack compilation succeeds (may take 1–2 minutes).

**Step 7: Hard-reload browser**

Ask user to press `Cmd+Shift+R` on `localhost:3000`.

**Step 8: Verify new tools appear in MCP**

Test via a quick MCP call or check the browser console for no errors.

---

## Task 7: Smoke test — create a simple flowchart

After the rebuild and browser reload, verify end-to-end:

**Step 1: Create a test whiteboard**

Use `openspace.whiteboard.create` to create `/tmp/test-flowchart.whiteboard.json`.

**Step 2: Open it**

Use `openspace.whiteboard.open` with the test path.

**Step 3: Replace with a 3-node flowchart**

Call `openspace.whiteboard.replace` with:
```json
{
  "path": "/tmp/test-flowchart.whiteboard.json",
  "shapes": [
    {
      "type": "geo",
      "x": 200, "y": 50, "width": 100, "height": 50,
      "props": {
        "geo": "ellipse",
        "color": "green",
        "fill": "solid",
        "richText": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Start"}]}]}
      }
    },
    {
      "type": "geo",
      "x": 160, "y": 180, "width": 180, "height": 60,
      "props": {
        "geo": "rectangle",
        "color": "blue",
        "fill": "semi",
        "richText": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Process"}]}]}
      }
    },
    {
      "type": "geo",
      "x": 200, "y": 320, "width": 100, "height": 50,
      "props": {
        "geo": "ellipse",
        "color": "red",
        "fill": "solid",
        "richText": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "End"}]}]}
      }
    }
  ]
}
```

**Step 4: Verify**

Expected: 3 shapes appear on the whiteboard. No errors in browser console.

**Step 5: Test find_shapes**

Call `openspace.whiteboard.find_shapes` with `{ path: "...", label: "Process" }`.

Expected: returns 1 result with the Process shape ID.

**Step 6: Fit camera**

Call `openspace.whiteboard.camera.fit`.

Expected: camera centers on the 3 shapes.

**Step 7: Commit if all tests pass**

```bash
git add docs/plans/2026-02-19-whiteboard-mcp-tool-gaps-impl.md
git commit -m "docs: add whiteboard MCP tool gaps implementation plan"
```
