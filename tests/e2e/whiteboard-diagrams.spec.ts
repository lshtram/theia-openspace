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
    expect(response.result.content.length, `${label}: content must be non-empty`).toBeGreaterThan(0);
    expect(response.result.content[0].type, `${label}: content[0] must be text`).toBe('text');
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
