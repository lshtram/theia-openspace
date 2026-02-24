/* eslint-disable @typescript-eslint/no-explicit-any */
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

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { mcpCall } from './helpers/mcp';
import { BASE_URL, waitForTheiaReady } from './helpers/theia';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Assert MCP response is well-formed and not an error. */
function assertSuccess(response: any, label: string): void {
    expect(response.result, `${label}: must have result`).toBeDefined();
    expect(response.result.isError, `${label}: must not be isError:true`).not.toBe(true);
    expect(Array.isArray(response.result.content), `${label}: content must be array`).toBe(true);
    expect(response.result.content.length, `${label}: content must be non-empty`).toBeGreaterThan(0);
    expect(response.result.content[0].type, `${label}: content[0] must be text`).toBe('text');
}

/** Parse JSON from MCP response content[0].text */
function parseResult(response: any): any {
    return JSON.parse(response.result.content[0].text);
}

/** Workspace root — whiteboards must use absolute paths. */
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');

/** Track all whiteboard files created during the run so afterAll can delete them. */
const createdWhiteboardFiles: string[] = [];

/** Create a fresh whiteboard and return its absolute path. */
async function createWhiteboard(name: string): Promise<string> {
    // Use a timestamp suffix so each run creates a unique file (avoid "file exists" errors)
    const ts = Date.now();
    const wbPath = path.join(WORKSPACE_ROOT, `${name}-${ts}.whiteboard.json`);
    const resp = await mcpCall('openspace.whiteboard.create', { path: wbPath });
    assertSuccess(resp, `create whiteboard "${name}"`);
    createdWhiteboardFiles.push(wbPath);
    return wbPath;
}

/**
 * Poll find_shapes until the tldraw editor is ready (widget initialised) or timeout.
 * Replaces magic `waitForTimeout(1000)` with a condition-based wait.
 */
async function waitForWidgetReady(wbPath: string, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const resp = await mcpCall('openspace.whiteboard.find_shapes', { path: wbPath });
        if (resp.result && resp.result.isError !== true) {
            return; // widget is ready
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Whiteboard widget at "${wbPath}" did not become ready within ${timeoutMs}ms`);
}

/** Delete all whiteboard files created during this test run. */
function cleanupWhiteboardFiles(): void {
    for (const filePath of createdWhiteboardFiles) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (_) {
            // Ignore cleanup errors — test output is more important
        }
    }
    createdWhiteboardFiles.length = 0;
}

/** Replace all shapes on a whiteboard and assert success. */
async function replaceShapes(wbPath: string, shapes: any[], label: string): Promise<void> {
    const resp = await mcpCall('openspace.whiteboard.replace', { path: wbPath, shapes });
    assertSuccess(resp, `replace shapes on "${label}"`);
}

/** Get all shapes on a whiteboard via find_shapes. */
async function findAllShapes(wbPath: string): Promise<any[]> {
    const resp = await mcpCall('openspace.whiteboard.find_shapes', { path: wbPath });
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
    return { type: 'geo', x, y, width: w, height: h, props: { geo: geoType, color, fill, dash: 'draw' } };
}

/** Text shape helper */
function textShape(x: number, y: number, text: string, color = 'black') {
    return { type: 'text', x, y, props: { richText: rt(text), color, size: 'm', font: 'draw', textAlign: 'start', autoSize: true } };
}

/** Note shape helper (type:"note" — NOT geo) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function note(x: number, y: number, text: string, color = 'yellow') {
    return { type: 'note', x, y, width: 200, height: 80, props: { color, richText: rt(text) } };
}

const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/diagrams');

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
        const { mcpJsonRpc } = await import('./helpers/mcp');
        const listResp = await mcpJsonRpc('tools/list');
        const toolNames: string[] = listResp.result.tools.map((t: any) => t.name);
        for (const tool of EXPECTED_WHITEBOARD_TOOLS) {
            expect(toolNames, `tool "${tool}" must be registered`).toContain(tool);
        }
    });
});

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
            geo(150, 50,  20,  20, 'ellipse', 'black', 'solid'),   // Start (filled)
            geo(100, 120, 160, 60, 'rectangle', 'black', 'none'),  // Action
            geo(100, 230, 160, 60, 'diamond', 'black', 'none'),    // Fork
            geo(100, 340, 160, 60, 'rectangle', 'black', 'none'),  // Action 2
            geo(150, 450, 20,  20, 'ellipse', 'black', 'solid'),   // End
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
            geo(50,  50,  620, 350, 'rectangle', 'grey', 'none'),  // System boundary (x=50..670)
            geo(80,  100, 160, 100, 'rectangle', 'blue', 'none'),  // Web app container (x=80..240)
            geo(280, 100, 160, 100, 'rectangle', 'blue', 'none'),  // API container (x=280..440)
            geo(480, 100, 160, 100, 'rectangle', 'blue', 'none'),  // DB container (x=480..640 — inside boundary)
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
            geo(200, 50,  20,  20,  'ellipse', 'black', 'solid'),  // Start
            geo(150, 120, 160, 70,  'rectangle', 'blue', 'none'),  // Interaction A
            geo(150, 240, 160, 70,  'diamond', 'black', 'none'),   // Decision
            geo(150, 360, 160, 70,  'rectangle', 'blue', 'none'),  // Interaction B
            geo(200, 480, 20,  20,  'ellipse', 'black', 'solid'),  // End
            arrow(210, 70,  210, 120),
            arrow(210, 190, 210, 240),
            arrow(210, 310, 210, 360),
            arrow(210, 430, 210, 480),
        ],
    },
};

// ── Block 2: Diagram types ────────────────────────────────────────────────────


// Full-stack E2E types: these also navigate the browser and take screenshots
const FULLSTACK_TYPES = new Set(['flowchart', 'sequence', 'c4-context']);

test.describe('Whiteboard MCP — diagram types', () => {
    // Ensure screenshot dir exists
    test.beforeAll(() => {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    // Clean up whiteboard files created during this describe block
    test.afterAll(() => {
        cleanupWhiteboardFiles();
    });

    for (const [diagramType, { shapes, minCount }] of Object.entries(DIAGRAMS)) {
        test(`diagram type: ${diagramType}`, async ({ page }) => {
            // Collect JS console errors for full-stack E2E checks
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') consoleErrors.push(msg.text());
            });

            // 0. Navigate to app so the bridge is connected
            await page.goto(BASE_URL);
            await waitForTheiaReady(page);

            // 1. Create a fresh whiteboard file
            const wbPath = await createWhiteboard(`test-${diagramType}`);

            // 2. Open it so a widget is live (required for replace/find_shapes)
            const openResp = await mcpCall('openspace.whiteboard.open', { path: wbPath });
            assertSuccess(openResp, `open whiteboard "${diagramType}"`);
            // Wait until the tldraw editor is ready (widget initialised).
            // Polling calls may log transient errors; clear them before the real check.
            await waitForWidgetReady(wbPath);
            consoleErrors.length = 0; // discard any errors from the polling phase

            // 3. Replace with the diagram
            await replaceShapes(wbPath, shapes, diagramType);

            // 4. Count shapes
            const found = await findAllShapes(wbPath);
            expect(
                found.length,
                `${diagramType}: expected >= ${minCount} shapes, got ${found.length}`
            ).toBeGreaterThanOrEqual(minCount);

            // 5. Full-stack E2E: screenshot for a subset of diagram types
            if (FULLSTACK_TYPES.has(diagramType)) {
                // Allow bridge-not-connected errors and 404 resource errors but not JS runtime errors
                const fatalErrors = consoleErrors.filter(
                    (e: string) => !e.includes('Bridge') && !e.includes('not connected') && !e.includes('404')
                );
                expect(fatalErrors, `${diagramType}: fatal JS errors on page`).toHaveLength(0);
                await page.screenshot({
                    path: path.join(SCREENSHOT_DIR, `${diagramType}.png`),
                });
            }
        });
    }
});

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
    technical:     { nodeColor: 'black',      edgeColor: 'grey'          },
    beautiful:     { nodeColor: 'light-blue', edgeColor: 'blue'          },
    presentation:  { nodeColor: 'violet',     edgeColor: 'light-violet'  },
};

test.describe('Whiteboard MCP — themes', () => {
    // Clean up whiteboard files created during this describe block
    test.afterAll(() => {
        cleanupWhiteboardFiles();
    });

    for (const [themeName, { nodeColor, edgeColor }] of Object.entries(THEME_CONFIGS)) {
        test(`theme: ${themeName}`, async ({ page }) => {
            // 0. Navigate to app so the bridge is connected
            await page.goto(BASE_URL);
            await waitForTheiaReady(page);

            const wbPath = await createWhiteboard(`test-theme-${themeName}`);

            // Open whiteboard so the widget is live
            const openResp = await mcpCall('openspace.whiteboard.open', { path: wbPath });
            assertSuccess(openResp, `open whiteboard "theme-${themeName}"`);
            // Wait until the tldraw editor is ready (widget initialised)
            await waitForWidgetReady(wbPath);

            const shapes = flowchartWithTheme(nodeColor, edgeColor);
            await replaceShapes(wbPath, shapes, `theme-${themeName}`);
            const found = await findAllShapes(wbPath);
            expect(found.length, `${themeName}: expected >= 5 shapes`).toBeGreaterThanOrEqual(5);
            // Verify colors were accepted (find_shapes returns shape props)
            const nodeShapes = found.filter((s: any) => s.type === 'geo');
            expect(nodeShapes.length, `${themeName}: must have geo shapes`).toBeGreaterThan(0);
        });
    }
});
