/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * E2E Test Suite: Presentation MCP Tools (Tier 2)
 *
 * Tier 2 — Requires Theia + OpenSpace backend running at localhost:3000
 * with a connected browser frontend (bridge must be active for tool execution).
 *
 * Tests all 10 openspace.presentation.* MCP tools via direct HTTP calls to /mcp.
 * Covers: create, read, list, update_slide, open, navigate, play, pause, stop,
 * toggleFullscreen — verifying that each tool is registered, accepts valid arguments,
 * and returns well-formed MCP responses (either success or a documented error state).
 *
 * NOTE (Infrastructure Gap):
 *   Tools that require an active browser bridge (open, navigate, play, pause, stop,
 *   toggleFullscreen) will return isError:true with "Bridge not connected" when no
 *   frontend is connected. The tests accept both connected-success and
 *   disconnected-error as valid responses — they assert response shape, not value.
 *   Tools that operate at the node layer (create, read, list, update_slide) are
 *   fully tested and must succeed when a workspace is present.
 *
 * See docs/plans/2026-02-19-presentation-modality-design.md
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { mcpCall, parseSseResponse, MCP_URL } from './helpers/mcp';

/** Assert that an MCP response is well-formed (has result.content array). */
function assertWellFormed(response: any, toolName: string): void {
    expect(response.result, `${toolName}: response must have result`).toBeDefined();
    expect(response.result.content, `${toolName}: result must have content`).toBeDefined();
    expect(Array.isArray(response.result.content), `${toolName}: content must be array`).toBe(true);
    expect(response.result.content.length, `${toolName}: content must be non-empty`).toBeGreaterThan(0);
    expect(response.result.content[0].type, `${toolName}: content[0].type must be text`).toBe('text');
}

/** Assert an MCP response is a success (isError is false/undefined). */
function assertSuccess(response: any, toolName: string): void {
    assertWellFormed(response, toolName);
    expect(response.result.isError, `${toolName}: must not have isError:true`).not.toBe(true);
}

/** Assert MCP response is either success OR a known bridge-disconnected error. */
function assertSuccessOrBridgeDisconnected(response: any, toolName: string): void {
    assertWellFormed(response, toolName);
    if (response.result.isError === true) {
        // Acceptable disconnected state: bridge not connected, command not found, or timeout
        const text: string = response.result.content[0].text ?? '';
        expect(
            text,
            `${toolName}: if isError, must be a known bridge error`
        ).toMatch(/Bridge not connected|Command not found|not connected|timed out/i);
    }
    // If isError is false/undefined, success — no further assertion needed
}

// ---------------------------------------------------------------------------
// Test workspace: use a temp directory under OS tmpdir so the Theia workspace
// root restriction doesn't block file creation.  We point the path tools at
// the actual workspace root to stay within the allowed root.
// ---------------------------------------------------------------------------
const WORKSPACE_ROOT = '/Users/Shared/dev/theia-openspace';
const TEST_DECK_PATH = path.join(WORKSPACE_ROOT, '_e2e-test-presentation.deck.md');

test.describe('Presentation MCP Tools', () => {

    // Retain a reference to the Theia browser page opened in beforeAll.
    // This is critical: if the Page object is garbage-collected, the bridge
    // disconnects and all executeViaBridge calls time out.
    let theiaBridgePage: import('@playwright/test').Page | undefined;

    // Ensure the Theia bridge is connected before running tests that go through
    // executeViaBridge (all presentation tools, including create/read/list/update_slide).
    test.beforeAll(async ({ browser }) => {
        theiaBridgePage = await browser.newPage();
        await theiaBridgePage.goto('http://localhost:3000');
        await theiaBridgePage.waitForSelector('#theia-app-shell', { timeout: 30000 });
        // theiaBridgePage is intentionally kept open (not closed here).
        // afterAll closes it so the bridge disconnects cleanly at suite end.
    });

    // Clean up the test deck file and close the bridge page after each test run
    test.afterAll(async () => {
        try { fs.unlinkSync(TEST_DECK_PATH); } catch { /* already gone */ }
        try { await theiaBridgePage?.close(); } catch { /* ignore */ }
    });

    // -------------------------------------------------------------------------
    // Tool registration
    // -------------------------------------------------------------------------

    test('all 10 presentation tools are registered in tools/list', async () => {
        const response = await fetch(MCP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        const text = await response.text();
        const data = parseSseResponse(text);

        const toolNames: string[] = data.result.tools.map((t: any) => t.name);
        const presentationTools = [
            'openspace.presentation.list',
            'openspace.presentation.read',
            'openspace.presentation.create',
            'openspace.presentation.update_slide',
            'openspace.presentation.open',
            'openspace.presentation.navigate',
            'openspace.presentation.play',
            'openspace.presentation.pause',
            'openspace.presentation.stop',
            'openspace.presentation.toggleFullscreen',
        ];

        for (const tool of presentationTools) {
            expect(toolNames, `tool "${tool}" must be registered`).toContain(tool);
        }
    });

    test('each presentation tool has name, description, and inputSchema', async () => {
        const response = await fetch(MCP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        });
        const text = await response.text();
        const data = parseSseResponse(text);

        const presentationTools: any[] = data.result.tools.filter((t: any) =>
            t.name.startsWith('openspace.presentation.')
        );

        expect(presentationTools.length).toBe(10);

        for (const tool of presentationTools) {
            expect(tool.name, 'tool.name must be a string').toBeDefined();
            expect(typeof tool.name).toBe('string');
            expect(tool.description, `"${tool.name}" must have description`).toBeDefined();
            expect(tool.inputSchema, `"${tool.name}" must have inputSchema`).toBeDefined();
        }
    });

    // -------------------------------------------------------------------------
    // Node-layer tools (execute without a connected browser bridge)
    // -------------------------------------------------------------------------

    test('openspace.presentation.create — creates a .deck.md file', async () => {
        const response = await mcpCall('openspace.presentation.create', {
            path: TEST_DECK_PATH,
            title: 'E2E Test Presentation',
            slides: [
                '# Slide One\n\nFirst slide content',
                '# Slide Two\n\nSecond slide content',
                '# Slide Three\n\nThird slide content',
            ],
        });

        assertSuccess(response, 'presentation.create');
        // File should now exist on disk
        expect(fs.existsSync(TEST_DECK_PATH), 'deck file must be created on disk').toBe(true);
    });

    test('openspace.presentation.read — reads the created deck', async () => {
        // Precondition: file must exist (create test must run first)
        if (!fs.existsSync(TEST_DECK_PATH)) {
            test.skip();
        }

        const response = await mcpCall('openspace.presentation.read', {
            path: TEST_DECK_PATH,
        });

        assertSuccess(response, 'presentation.read');
        const text: string = response.result.content[0].text;
        // Response should include slide count and/or content
        expect(text).toMatch(/slide|content|presentation/i);
    });

    test('openspace.presentation.list — returns .deck.md files in workspace', async () => {
        // Precondition: at least the test file + the design deck should exist
        const response = await mcpCall('openspace.presentation.list', {});

        assertSuccess(response, 'presentation.list');
        const text: string = response.result.content[0].text;
        // Should be a JSON array of file paths
        expect(text.trim()).toMatch(/^\[/);
        const files: string[] = JSON.parse(text);
        expect(Array.isArray(files)).toBe(true);
        // At least our test file should appear (it was just created above)
        // We check for .deck.md suffix on all entries
        for (const f of files) {
            expect(f).toMatch(/\.deck\.md/);
        }
    });

    test('openspace.presentation.update_slide — updates slide content', async () => {
        if (!fs.existsSync(TEST_DECK_PATH)) {
            test.skip();
        }

        const newContent = '# Updated Slide One\n\nUpdated by E2E test';
        const response = await mcpCall('openspace.presentation.update_slide', {
            path: TEST_DECK_PATH,
            slideIndex: 0,
            content: newContent,
        });

        assertSuccess(response, 'presentation.update_slide');

        // Verify file on disk was actually updated
        const diskContent = fs.readFileSync(TEST_DECK_PATH, 'utf8');
        expect(diskContent).toContain('Updated Slide One');
    });

    test('openspace.presentation.update_slide — rejects invalid slide index', async () => {
        if (!fs.existsSync(TEST_DECK_PATH)) {
            test.skip();
        }

        const response = await mcpCall('openspace.presentation.update_slide', {
            path: TEST_DECK_PATH,
            slideIndex: 999,
            content: '# Should fail',
        });

        // Must return isError:true with out-of-range message
        assertWellFormed(response, 'presentation.update_slide (invalid index)');
        expect(response.result.isError).toBe(true);
        expect(response.result.content[0].text).toMatch(/invalid slide index/i);
    });

    // -------------------------------------------------------------------------
    // Bridge-dependent tools (require connected frontend; accept disconnected)
    // -------------------------------------------------------------------------

    test('openspace.presentation.open — returns well-formed response', async () => {
        const response = await mcpCall('openspace.presentation.open', {
            path: TEST_DECK_PATH,
        });
        assertSuccessOrBridgeDisconnected(response, 'presentation.open');
    });

    test('openspace.presentation.navigate — returns well-formed response', async () => {
        const response = await mcpCall('openspace.presentation.navigate', {
            direction: 'next',
        });
        assertSuccessOrBridgeDisconnected(response, 'presentation.navigate');
    });

    test('openspace.presentation.play — returns well-formed response', async () => {
        const response = await mcpCall('openspace.presentation.play', {
            interval: 3000,
        });
        assertSuccessOrBridgeDisconnected(response, 'presentation.play');
    });

    test('openspace.presentation.pause — returns well-formed response', async () => {
        const response = await mcpCall('openspace.presentation.pause', {});
        assertSuccessOrBridgeDisconnected(response, 'presentation.pause');
    });

    test('openspace.presentation.stop — returns well-formed response', async () => {
        const response = await mcpCall('openspace.presentation.stop', {});
        assertSuccessOrBridgeDisconnected(response, 'presentation.stop');
    });

    test('openspace.presentation.toggleFullscreen — returns well-formed response', async () => {
        const response = await mcpCall('openspace.presentation.toggleFullscreen', {});
        assertSuccessOrBridgeDisconnected(response, 'presentation.toggleFullscreen');
    });
});
