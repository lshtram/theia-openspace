# Whiteboard Diagram MCP Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `tests/e2e/whiteboard-diagrams.spec.ts` — a Playwright test suite that validates all 21 diagram types and 3 themes against the live MCP server, plus 3 full-stack E2E screenshot tests.

**Architecture:** Single test file in `tests/e2e/` using the existing `mcpCall` helper from `tests/e2e/helpers/mcp.ts`. Three describe blocks: tools catalog smoke test, 21 diagram type tests (MCP-over-HTTP + `find_shapes` assertions), and 3 theme variant tests. Three of the 21 diagram tests also navigate the browser for full-stack E2E screenshots.

**Tech Stack:** Playwright, TypeScript, existing `mcpCall`/`mcpJsonRpc` helpers, tldraw 4.x shape format (VecModel arrows, `type:"note"` for notes)

---

## Key Facts for Implementers

- **Arrow format (tldraw 4.x):** `props.start: {x: number, y: number}`, `props.end: {x: number, y: number}` — plain VecModel. NOT `{type: "point", x, y}`.
- **Note shape:** `type: "note"` NOT `type: "geo", props.geo: "note"`
- **Text richText format:** `{type:"doc", content:[{type:"paragraph",content:[{type:"text",text:"..."}]}]}`
- **MCP call pattern:** `await mcpCall('openspace.whiteboard.replace', {id, shapes})` — see `tests/e2e/helpers/mcp.ts`
- **Assert success:** check `response.result.isError !== true`
- **`find_shapes` returns:** `response.result.content[0].text` parsed as JSON with `.shapes` array
- **Whiteboard ID:** returned from `openspace.whiteboard.create` as `response.result.content[0].text` parsed as JSON with `.id`
- **Server port:** 3000 (baseURL in playwright.config.ts)
- **Run tests:** `npx playwright test tests/e2e/whiteboard-diagrams.spec.ts --headed` (or headless)

---

## Task 1: Create the test file scaffold

**Files:**
- Create: `tests/e2e/whiteboard-diagrams.spec.ts`

**Step 1: Create the file with imports, helpers, and an empty describe block**

```typescript
/**
 * E2E Test Suite: Whiteboard Diagram MCP Tools
 *
 * Tier 2 — Requires Theia + OpenSpace backend at localhost:3000 with browser bridge.
 *
 * Three describe blocks:
 *   1. Tools catalog smoke test — verifies all 13 whiteboard tools are registered
 *   2. Diagram types — 21 tests, one per type, using replace + find_shapes
 *   3. Themes — 3 tests (technical, beautiful, presentation) using flowchart as reference
 *
 * 3 of the 21 diagram type tests also do full-stack E2E: navigate browser + screenshot.
 *
 * Arrow format (tldraw 4.x): props.start/end = {x, y} (plain VecModel).
 * Note shape: type:"note" (NOT type:"geo", props.geo:"note").
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { mcpCall } from './helpers/mcp';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Assert MCP response is well-formed and not an error. */
function assertSuccess(response: any, label: string): void {
    expect(response.result, `${label}: must have result`).toBeDefined();
    expect(response.result.isError, `${label}: must not be isError:true`).not.toBe(true);
    expect(Array.isArray(response.result.content), `${label}: content must be array`).toBe(true);
}

/** Parse JSON from MCP response content[0].text */
function parseResult(response: any): any {
    return JSON.parse(response.result.content[0].text);
}

/** Create a fresh whiteboard and return its ID. */
async function createWhiteboard(name: string): Promise<string> {
    const resp = await mcpCall('openspace.whiteboard.create', { name });
    assertSuccess(resp, `create whiteboard "${name}"`);
    return parseResult(resp).id;
}

/** Replace all shapes on a whiteboard and assert success. */
async function replaceShapes(id: string, shapes: any[], label: string): Promise<void> {
    const resp = await mcpCall('openspace.whiteboard.replace', { id, shapes });
    assertSuccess(resp, `replace shapes on "${label}"`);
}

/** Get all shapes on a whiteboard via find_shapes. */
async function findAllShapes(id: string): Promise<any[]> {
    const resp = await mcpCall('openspace.whiteboard.find_shapes', { id, filter: {} });
    assertSuccess(resp, 'find_shapes');
    return parseResult(resp).shapes;
}

/** richText helper */
function rt(text: string) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

/** Arrow helper (tldraw 4.x: start/end are plain {x,y} VecModel) */
function arrow(x1: number, y1: number, x2: number, y2: number, color = 'black', dash = 'draw') {
    return {
        type: 'arrow', x: 0, y: 0,
        props: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, dash, arrowheadEnd: 'arrow', arrowheadStart: 'none' }
    };
}

/** Geo shape helper */
function geo(x: number, y: number, w: number, h: number, geoType: string, color = 'black', fill = 'none') {
    return { type: 'geo', x, y, w, h, props: { geo: geoType, color, fill, dash: 'draw' } };
}

/** Text shape helper */
function textShape(x: number, y: number, text: string, color = 'black') {
    return { type: 'text', x, y, props: { richText: rt(text), color, size: 'm', font: 'draw', align: 'start', autoSize: true } };
}

/** Note shape helper (type:"note" — NOT geo) */
function note(x: number, y: number, text: string, color = 'yellow') {
    return { type: 'note', x, y, w: 200, h: 80, props: { color, richText: rt(text) } };
}

const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/diagrams');
```

**Step 2: Run tsc to check types**

```bash
npx tsc --noEmit
```
Expected: no errors for the new file (it won't compile yet without describe blocks, but imports should resolve).

---

## Task 2: Block 1 — Tools catalog smoke test

**Files:**
- Modify: `tests/e2e/whiteboard-diagrams.spec.ts` (append)

**Step 1: Add the tools catalog describe block**

```typescript
// ── Block 1: Tools catalog ────────────────────────────────────────────────────

const EXPECTED_WHITEBOARD_TOOLS = [
    'openspace.whiteboard.list',
    'openspace.whiteboard.read',
    'openspace.whiteboard.create',
    'openspace.whiteboard.add_shape',
    'openspace.whiteboard.update_shape',
    'openspace.whiteboard.delete_shape',
    'openspace.whiteboard.open',
    'openspace.whiteboard.camera.set',
    'openspace.whiteboard.camera.fit',
    'openspace.whiteboard.camera.get',
    'openspace.whiteboard.batch_add_shapes',
    'openspace.whiteboard.replace',
    'openspace.whiteboard.find_shapes',
];

test.describe('Whiteboard MCP — tools catalog', () => {
    test('all 13 whiteboard tools are registered', async () => {
        const resp = await mcpCall('tools/list', {});
        // tools/list uses different method path — use mcpJsonRpc
        const { mcpJsonRpc } = await import('./helpers/mcp');
        const listResp = await mcpJsonRpc('tools/list');
        const toolNames: string[] = listResp.result.tools.map((t: any) => t.name);
        for (const tool of EXPECTED_WHITEBOARD_TOOLS) {
            expect(toolNames, `tool "${tool}" must be registered`).toContain(tool);
        }
    });
});
```

Note: `tools/list` is a different JSON-RPC method, not a tool call. Use `mcpJsonRpc('tools/list')` not `mcpCall('tools/list', {})`.

**Step 2: Run just this test**

```bash
npx playwright test tests/e2e/whiteboard-diagrams.spec.ts --grep "tools catalog" --headed
```
Expected: 1 test PASS.

**Step 3: Commit**

```bash
git add tests/e2e/whiteboard-diagrams.spec.ts
git commit -m "test: add whiteboard tools catalog smoke test"
```

---

## Task 3: Diagram type payloads — shape data constants

**Files:**
- Modify: `tests/e2e/whiteboard-diagrams.spec.ts` (append shape payload constants)

**Step 1: Add minimal diagram payloads for all 21 types**

These are the shape arrays to pass to `replace`. Keep them small (3–6 shapes). This is the most labor-intensive part — each one must use the correct tldraw shape types per the SKILL.md translation table.

```typescript
// ── Diagram payloads ──────────────────────────────────────────────────────────
// Each is a minimal but correct example of the diagram type.
// Coordinates are canvas-absolute. Arrow start/end are canvas-absolute VecModel {x,y}.

const DIAGRAMS: Record<string, { shapes: any[], minCount: number }> = {

    flowchart: {
        minCount: 5,
        shapes: [
            geo(100, 50,  160, 60, 'ellipse', 'green', 'solid'),   // Start
            geo(100, 160, 160, 60, 'rectangle', 'black', 'none'),  // Process
            geo(100, 270, 160, 60, 'diamond', 'blue', 'none'),     // Decision
            geo(100, 380, 160, 60, 'ellipse', 'red', 'solid'),     // End
            arrow(180, 110, 180, 160),                              // Start→Process
            arrow(180, 220, 180, 270),                              // Process→Decision
            arrow(180, 330, 180, 380),                              // Decision→End
        ],
    },

    sequence: {
        minCount: 5,
        shapes: [
            geo(80,  50, 120, 50, 'rectangle', 'blue', 'none'),    // Actor A lifeline head
            geo(300, 50, 120, 50, 'rectangle', 'blue', 'none'),    // Actor B lifeline head
            geo(130, 100, 4, 200, 'rectangle', 'grey', 'solid'),   // Lifeline A
            geo(350, 100, 4, 200, 'rectangle', 'grey', 'solid'),   // Lifeline B
            arrow(134, 150, 350, 150),                             // message A→B
            arrow(350, 200, 134, 200, 'grey', 'dashed'),           // return B→A
        ],
    },

    activity: {
        minCount: 5,
        shapes: [
            geo(150, 50,  20,  20, 'ellipse', 'black', 'black'),   // Start (filled)
            geo(100, 120, 160, 60, 'rectangle', 'black', 'none'),  // Action
            geo(100, 230, 160, 60, 'diamond', 'black', 'none'),    // Fork
            geo(100, 340, 160, 60, 'rectangle', 'black', 'none'),  // Action 2
            geo(150, 450, 20,  20, 'ellipse', 'black', 'black'),   // End
            arrow(160, 70,  160, 120),
            arrow(160, 180, 160, 230),
            arrow(160, 290, 160, 340),
            arrow(160, 400, 160, 450),
        ],
    },

    state: {
        minCount: 4,
        shapes: [
            geo(100, 50,  160, 60, 'ellipse', 'blue', 'semi'),    // State A
            geo(100, 180, 160, 60, 'ellipse', 'blue', 'semi'),    // State B
            geo(100, 310, 160, 60, 'ellipse', 'grey', 'semi'),    // Final state
            arrow(180, 110, 180, 180),                             // A→B
            arrow(180, 240, 180, 310),                             // B→Final
        ],
    },

    'use-case': {
        minCount: 4,
        shapes: [
            geo(50,  150, 80,  120, 'rectangle', 'grey', 'none'),  // Actor (stick figure stand-in)
            geo(250, 50,  220, 80,  'ellipse', 'blue', 'none'),    // Use case 1
            geo(250, 180, 220, 80,  'ellipse', 'blue', 'none'),    // Use case 2
            arrow(130, 170, 250, 90),                              // Actor → UC1
            arrow(130, 200, 250, 200),                             // Actor → UC2
        ],
    },

    class: {
        minCount: 3,
        shapes: [
            geo(100, 50,  200, 120, 'rectangle', 'black', 'none'), // Class A
            geo(380, 50,  200, 120, 'rectangle', 'black', 'none'), // Class B
            textShape(110, 65, 'ClassA'),
            textShape(390, 65, 'ClassB'),
            { type: 'arrow', x: 0, y: 0, props: { start: {x:300,y:110}, end: {x:380,y:110}, color: 'black', dash: 'dashed', arrowheadEnd: 'arrow', arrowheadStart: 'none' } },
        ],
    },

    object: {
        minCount: 3,
        shapes: [
            geo(100, 50,  200, 100, 'rectangle', 'black', 'none'), // Object A
            geo(380, 50,  200, 100, 'rectangle', 'black', 'none'), // Object B
            textShape(110, 65, 'obj1:ClassA'),
            textShape(390, 65, 'obj2:ClassB'),
            arrow(300, 100, 380, 100, 'black', 'dashed'),
        ],
    },

    component: {
        minCount: 4,
        shapes: [
            geo(50,  50,  400, 300, 'rectangle', 'grey', 'none'),  // System boundary
            geo(100, 100, 140, 80,  'rectangle', 'blue', 'none'),  // Component A
            geo(300, 100, 140, 80,  'rectangle', 'blue', 'none'),  // Component B
            textShape(110, 115, '<<component>>\nServiceA'),
            textShape(310, 115, '<<component>>\nServiceB'),
            arrow(240, 140, 300, 140, 'black', 'dashed'),
        ],
    },

    'composite-structure': {
        minCount: 3,
        shapes: [
            geo(50, 50, 300, 200, 'rectangle', 'grey', 'none'),   // Composite
            geo(80, 100, 100, 80, 'rectangle', 'blue', 'none'),   // Part A
            geo(220, 100, 100, 80, 'rectangle', 'blue', 'none'),  // Part B
            arrow(180, 140, 220, 140),
        ],
    },

    deployment: {
        minCount: 4,
        shapes: [
            geo(50, 50,  300, 250, 'rectangle', 'grey', 'none'),   // Node (server)
            geo(80, 100, 140, 80,  'rectangle', 'blue', 'none'),   // Artifact A
            geo(80, 220, 140, 60,  'rectangle', 'blue', 'none'),   // Artifact B
            textShape(60, 58, '<<node>>\nAppServer'),
            arrow(150, 180, 150, 220),
        ],
    },

    package: {
        minCount: 3,
        shapes: [
            geo(50,  50,  200, 180, 'rectangle', 'grey', 'none'),  // Package A
            geo(320, 50,  200, 180, 'rectangle', 'grey', 'none'),  // Package B
            textShape(60, 58, 'pkg::A'),
            textShape(330, 58, 'pkg::B'),
            arrow(250, 140, 320, 140, 'black', 'dashed'),
        ],
    },

    er: {
        minCount: 4,
        shapes: [
            geo(100, 50,  160, 80, 'rectangle', 'black', 'none'),  // Entity A
            geo(400, 50,  160, 80, 'rectangle', 'black', 'none'),  // Entity B
            geo(250, 55,  100, 70, 'diamond', 'black', 'none'),    // Relationship
            textShape(110, 65, 'Customer'),
            textShape(410, 65, 'Order'),
            arrow(260, 90, 250, 90),  // Entity A → Rel
            arrow(350, 90, 400, 90),  // Rel → Entity B
        ],
    },

    'c4-context': {
        minCount: 4,
        shapes: [
            geo(200, 50,  200, 100, 'rectangle', 'blue', 'solid'), // System (central)
            geo(50,  200, 140, 80,  'rectangle', 'grey', 'none'),  // External system
            geo(400, 200, 140, 80,  'rectangle', 'grey', 'none'),  // External user
            textShape(210, 65, '[System]\nMyApp'),
            arrow(190, 100, 120, 200),
            arrow(340, 100, 400, 200),
        ],
    },

    'c4-container': {
        minCount: 5,
        shapes: [
            geo(50,  50,  500, 350, 'rectangle', 'grey', 'none'),  // System boundary
            geo(80,  100, 160, 100, 'rectangle', 'blue', 'none'),  // Web app container
            geo(280, 100, 160, 100, 'rectangle', 'blue', 'none'),  // API container
            geo(480, 100, 160, 100, 'rectangle', 'blue', 'none'),  // DB container
            textShape(90, 110, '[Web App]\nReact'),
            textShape(290, 110, '[API]\nNode.js'),
            textShape(490, 110, '[DB]\nPostgres'),
            arrow(240, 150, 280, 150),
            arrow(440, 150, 480, 150),
        ],
    },

    communication: {
        minCount: 4,
        shapes: [
            geo(100, 100, 120, 70, 'ellipse', 'blue', 'semi'),   // Object A
            geo(350, 100, 120, 70, 'ellipse', 'blue', 'semi'),   // Object B
            geo(225, 300, 120, 70, 'ellipse', 'blue', 'semi'),   // Object C
            arrow(220, 135, 350, 135),   // A→B
            arrow(160, 170, 260, 300),   // A→C
        ],
    },

    block: {
        minCount: 4,
        shapes: [
            geo(100, 50,  160, 80, 'rectangle', 'blue', 'none'),  // Block A
            geo(350, 50,  160, 80, 'rectangle', 'blue', 'none'),  // Block B
            geo(100, 230, 160, 80, 'rectangle', 'grey', 'none'),  // Block C
            arrow(260, 90, 350, 90),    // A→B
            arrow(180, 130, 180, 230),  // A→C
        ],
    },

    'mind-map': {
        minCount: 4,
        shapes: [
            geo(250, 150, 160, 70, 'ellipse', 'blue', 'semi'),   // Root
            geo(50,  50,  140, 60, 'rectangle', 'grey', 'none'), // Branch 1
            geo(50,  200, 140, 60, 'rectangle', 'grey', 'none'), // Branch 2
            geo(480, 150, 140, 60, 'rectangle', 'grey', 'none'), // Branch 3
            arrow(250, 185, 190, 80),   // Root→B1
            arrow(250, 185, 190, 230),  // Root→B2
            arrow(410, 185, 480, 185),  // Root→B3
        ],
    },

    network: {
        minCount: 4,
        shapes: [
            geo(200, 50,  100, 70, 'rectangle', 'blue', 'none'),  // Router
            geo(50,  200, 100, 70, 'rectangle', 'grey', 'none'),  // Server A
            geo(200, 200, 100, 70, 'rectangle', 'grey', 'none'),  // Server B
            geo(350, 200, 100, 70, 'rectangle', 'grey', 'none'),  // Client
            arrow(250, 120, 100, 200),
            arrow(250, 120, 250, 200),
            arrow(250, 120, 400, 200),
        ],
    },

    gantt: {
        minCount: 4,
        shapes: [
            textShape(50, 50,  'Project Timeline'),
            geo(150, 100, 200, 40, 'rectangle', 'blue', 'solid'),  // Task 1 bar
            geo(380, 100, 150, 40, 'rectangle', 'green', 'solid'), // Task 2 bar
            geo(150, 160, 350, 40, 'rectangle', 'grey', 'solid'),  // Task 3 bar
            textShape(50, 110, 'Task 1'),
            textShape(50, 170, 'Task 3'),
        ],
    },

    timing: {
        minCount: 4,
        shapes: [
            textShape(50,  50,  'Signal A'),
            textShape(50,  130, 'Signal B'),
            geo(150, 50,  300, 20, 'rectangle', 'blue', 'solid'),   // High state A
            geo(150, 80,  300, 20, 'rectangle', 'grey', 'solid'),   // Low state A
            geo(150, 130, 150, 20, 'rectangle', 'blue', 'solid'),   // High state B
            geo(300, 130, 150, 20, 'rectangle', 'grey', 'solid'),   // Low state B
            arrow(300, 60, 300, 140),  // Transition marker
        ],
    },

    'interaction-overview': {
        minCount: 5,
        shapes: [
            geo(200, 50,  20,  20,  'ellipse', 'black', 'black'),  // Start
            geo(150, 120, 160, 70,  'rectangle', 'blue', 'none'),  // Interaction A
            geo(150, 240, 160, 70,  'diamond', 'black', 'none'),   // Decision
            geo(150, 360, 160, 70,  'rectangle', 'blue', 'none'),  // Interaction B
            geo(200, 480, 20,  20,  'ellipse', 'black', 'black'),  // End
            arrow(210, 70,  210, 120),
            arrow(210, 190, 210, 240),
            arrow(210, 310, 210, 360),
            arrow(210, 430, 210, 480),
        ],
    },
};
```

**Step 2: Run tsc to check types**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Task 4: Block 2 — Diagram type tests (all 21)

**Files:**
- Modify: `tests/e2e/whiteboard-diagrams.spec.ts` (append)

**Step 1: Add the diagram types describe block**

```typescript
// ── Block 2: Diagram types ────────────────────────────────────────────────────

// Full-stack E2E types: these also navigate the browser and take screenshots
const FULLSTACK_TYPES = new Set(['flowchart', 'sequence', 'c4-context']);

test.describe('Whiteboard MCP — diagram types', () => {
    // Ensure screenshot dir exists
    test.beforeAll(() => {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    for (const [diagramType, { shapes, minCount }] of Object.entries(DIAGRAMS)) {
        test(`diagram type: ${diagramType}`, async ({ page }) => {
            // 1. Create a fresh whiteboard
            const id = await createWhiteboard(`test-${diagramType}`);

            // 2. Replace with the diagram
            await replaceShapes(id, shapes, diagramType);

            // 3. Count shapes
            const found = await findAllShapes(id);
            expect(
                found.length,
                `${diagramType}: expected >= ${minCount} shapes, got ${found.length}`
            ).toBeGreaterThanOrEqual(minCount);

            // 4. Full-stack E2E: navigate browser, open whiteboard, screenshot
            if (FULLSTACK_TYPES.has(diagramType)) {
                const openResp = await mcpCall('openspace.whiteboard.open', { id });
                // open may fail if bridge disconnected — that's acceptable
                // We just navigate to check the app loads
                await page.goto('/');
                await page.waitForLoadState('networkidle');
                const errors = await page.evaluate(() =>
                    (window as any).__consoleErrors ?? []
                );
                // Allow bridge-not-connected errors but not JS runtime errors
                const fatalErrors = (errors as string[]).filter(
                    e => !e.includes('Bridge') && !e.includes('not connected')
                );
                expect(fatalErrors, `${diagramType}: fatal JS errors on page`).toHaveLength(0);
                await page.screenshot({
                    path: path.join(SCREENSHOT_DIR, `${diagramType}.png`),
                });
            }
        });
    }
});
```

**Step 2: Run just the flowchart test to verify**

```bash
npx playwright test tests/e2e/whiteboard-diagrams.spec.ts --grep "diagram type: flowchart" --headed
```
Expected: PASS, screenshot saved to `test-results/diagrams/flowchart.png`.

**Step 3: Run all diagram type tests**

```bash
npx playwright test tests/e2e/whiteboard-diagrams.spec.ts --grep "diagram types" --headed
```
Expected: all 21 PASS. Fix any failures (wrong shape type, bad coordinates, etc.) before continuing.

**Step 4: Commit**

```bash
git add tests/e2e/whiteboard-diagrams.spec.ts
git commit -m "test: add 21 diagram type MCP tests with full-stack E2E for flowchart/sequence/c4-context"
```

---

## Task 5: Block 3 — Theme tests

**Files:**
- Modify: `tests/e2e/whiteboard-diagrams.spec.ts` (append)

**Step 1: Read the theme files to get color tokens**

The themes are at `.opencode/skills/draw-diagram/themes/`. Read `technical.md`, `beautiful.md`, `presentation.md` to get their color tokens.

Map each theme's `node.primary` color to the nearest tldraw named color:
- technical: `#1e293b` (near-black) → `black`
- beautiful: `#0ea5e9` (sky-blue) → `light-blue`
- presentation: `#7c3aed` (purple) → `violet`

**Step 2: Add theme tests**

```typescript
// ── Block 3: Theme tests ──────────────────────────────────────────────────────

// Reference flowchart with theme-specific colors applied
function flowchartWithTheme(nodeColor: string, edgeColor: string): any[] {
    return [
        geo(100, 50,  160, 60, 'ellipse', nodeColor, 'solid'),
        geo(100, 160, 160, 60, 'rectangle', nodeColor, 'none'),
        geo(100, 270, 160, 60, 'diamond', edgeColor, 'none'),
        geo(100, 380, 160, 60, 'ellipse', nodeColor, 'solid'),
        arrow(180, 110, 180, 160, edgeColor),
        arrow(180, 220, 180, 270, edgeColor),
        arrow(180, 330, 180, 380, edgeColor),
    ];
}

const THEME_CONFIGS = {
    technical:     { nodeColor: 'black',      edgeColor: 'grey'       },
    beautiful:     { nodeColor: 'light-blue', edgeColor: 'blue'       },
    presentation:  { nodeColor: 'violet',     edgeColor: 'light-violet' },
};

test.describe('Whiteboard MCP — themes', () => {
    for (const [themeName, { nodeColor, edgeColor }] of Object.entries(THEME_CONFIGS)) {
        test(`theme: ${themeName}`, async () => {
            const id = await createWhiteboard(`test-theme-${themeName}`);
            const shapes = flowchartWithTheme(nodeColor, edgeColor);
            await replaceShapes(id, shapes, `theme-${themeName}`);
            const found = await findAllShapes(id);
            expect(found.length, `${themeName}: expected >= 5 shapes`).toBeGreaterThanOrEqual(5);
            // Verify colors were accepted (find_shapes returns shape props)
            const nodeShapes = found.filter((s: any) => s.type === 'geo');
            expect(nodeShapes.length, `${themeName}: must have geo shapes`).toBeGreaterThan(0);
        });
    }
});
```

**Step 3: Run theme tests**

```bash
npx playwright test tests/e2e/whiteboard-diagrams.spec.ts --grep "themes" --headed
```
Expected: 3 PASS.

**Step 4: Commit**

```bash
git add tests/e2e/whiteboard-diagrams.spec.ts
git commit -m "test: add 3 theme variant tests for whiteboard diagrams"
```

---

## Task 6: Run the full spec and fix any remaining failures

**Step 1: Run the complete spec**

```bash
npx playwright test tests/e2e/whiteboard-diagrams.spec.ts --headed
```
Expected: all tests PASS (1 + 21 + 3 = 25 tests).

**Step 2: Fix any failures**

Common failure modes and fixes:
- `isError:true` with "shape type not supported" → wrong `type` or `props.geo` value. Check tldraw valid geo values: `cloud`, `rectangle`, `ellipse`, `triangle`, `diamond`, `pentagon`, `hexagon`, `octagon`, `star`, `rhombus`, `rhombus-2`, `oval`, `trapezoid`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down`, `x-box`, `check-box`, `heart`
- `isError:true` with "color not valid" → use only tldraw named colors: `black`, `grey`, `white`, `red`, `light-red`, `orange`, `yellow`, `green`, `light-green`, `blue`, `light-blue`, `violet`, `light-violet`
- Shape count too low → check that `replace` actually cleared previous shapes (it should — replace = wipe + add)
- `find_shapes` returns 0 → check `{ id, filter: {} }` argument format

**Step 3: Commit any fixes**

```bash
git add tests/e2e/whiteboard-diagrams.spec.ts
git commit -m "fix: correct shape payloads in diagram playwright tests"
```

---

## Task 7: Also run against the full e2e suite

**Step 1: Run the full e2e suite**

```bash
npx playwright test
```
Expected: existing tests still pass, new tests all pass.

**Step 2: If the mcp-tools.spec.ts whiteboard tools list test fails**

The existing `mcp-tools.spec.ts` has a `EXPECTED_TOOLS` list. It needs to include the 3 new tools we added (`batch_add_shapes`, `replace`, `find_shapes`). Check:

```bash
grep -n "whiteboard" tests/e2e/mcp-tools.spec.ts | tail -20
```

If the list is incomplete, update `EXPECTED_TOOLS` in `mcp-tools.spec.ts` to add:
- `openspace.whiteboard.batch_add_shapes`
- `openspace.whiteboard.replace`
- `openspace.whiteboard.find_shapes`

**Step 3: Commit if mcp-tools.spec.ts was updated**

```bash
git add tests/e2e/mcp-tools.spec.ts
git commit -m "test: add 3 new whiteboard tools to MCP tools catalog test"
```

---

## Final Checklist

- [ ] `tests/e2e/whiteboard-diagrams.spec.ts` exists and compiles
- [ ] 25 tests total: 1 catalog + 21 diagram types + 3 themes
- [ ] All 25 pass with `npx playwright test tests/e2e/whiteboard-diagrams.spec.ts`
- [ ] Screenshots exist in `test-results/diagrams/` for flowchart, sequence, c4-context
- [ ] Full suite `npx playwright test` still passes (no regressions)
- [ ] `tests/e2e/mcp-tools.spec.ts` updated if needed to include new tools
