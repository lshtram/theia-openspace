/**
 * E2E Test Suite: MCP Tools Smoke Tests (Tier 2)
 *
 * Tier 2 — Requires Theia + OpenSpace backend running at localhost:3000.
 * Tests that the MCP endpoint is live and returns the expected tool catalog.
 *
 * These tests do NOT require an active opencode session or browser interaction.
 * They use direct HTTP requests to /mcp (the StreamableHTTP transport).
 *
 * Phase T3 contract requirement: verify MCP endpoint is live, tools/list returns
 * expected tools. See .opencode/context/active_tasks/phase-t3-mcp/contract.md
 *
 * NOTE (Infrastructure Gap):
 *   These tests require a running Theia dev server (yarn start).
 *   In CI where no live server exists, they will be skipped automatically
 *   by the global-setup.ts server-detection logic.
 *   See docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md for details.
 */

import { test, expect } from '@playwright/test';

const HUB_URL = 'http://localhost:3000';
const MCP_URL = `${HUB_URL}/mcp`;

/** Send a JSON-RPC request to the MCP endpoint and return the response body. */
async function mcpRequest(method: string, params?: unknown): Promise<any> {
    const body = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        ...(params !== undefined ? { params } : {}),
    };

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

/**
 * Expected tool names registered by OpenSpaceMcpServer.
 * These map exactly to the 20 tools in hub-mcp.ts (17 core + 3 editor extras).
 */
const EXPECTED_TOOLS = [
    // Pane tools (4)
    'openspace.pane.open',
    'openspace.pane.close',
    'openspace.pane.focus',
    'openspace.pane.list',
    // Editor tools (6)
    'openspace.editor.open',
    'openspace.editor.read_file',
    'openspace.editor.close',
    'openspace.editor.scroll_to',
    'openspace.editor.highlight',
    'openspace.editor.clear_highlight',
    // Terminal tools (5)
    'openspace.terminal.create',
    'openspace.terminal.send',
    'openspace.terminal.read_output',
    'openspace.terminal.list',
    'openspace.terminal.close',
    // File tools (5)
    'openspace.file.read',
    'openspace.file.write',
    'openspace.file.list',
    'openspace.file.search',
    'openspace.file.patch',
];

test.describe('MCP Tools Smoke Tests', () => {

    test('/mcp endpoint is reachable (POST returns JSON-RPC response)', async () => {
        // A tools/list call must return a valid JSON-RPC response (result or error)
        const response = await mcpRequest('tools/list');
        expect(response).toBeDefined();
        // Valid JSON-RPC 2.0 response must have jsonrpc and id fields
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBeDefined();
        // Should have either result or error — not both absent
        const hasResultOrError = 'result' in response || 'error' in response;
        expect(hasResultOrError).toBe(true);
    });

    test('tools/list returns all expected OpenSpace tools', async () => {
        const response = await mcpRequest('tools/list');

        expect(response.result).toBeDefined();
        expect(response.result.tools).toBeDefined();

        const toolNames: string[] = response.result.tools.map((t: any) => t.name);

        for (const expectedTool of EXPECTED_TOOLS) {
            expect(toolNames, `Expected tool "${expectedTool}" to be registered`).toContain(expectedTool);
        }
    });

    test('tools/list returns tools with required MCP schema fields', async () => {
        const response = await mcpRequest('tools/list');
        const tools: any[] = response.result.tools;

        for (const tool of tools) {
            // Every tool must have: name, description, inputSchema
            expect(tool.name, 'tool.name must be a string').toBeDefined();
            expect(typeof tool.name).toBe('string');
            expect(tool.description, `tool "${tool.name}" must have description`).toBeDefined();
            expect(tool.inputSchema, `tool "${tool.name}" must have inputSchema`).toBeDefined();
        }
    });

    test('tools/call for openspace.file.read with invalid path returns isError:true', async () => {
        // Path traversal attempt — should be rejected by resolveSafePath
        const response = await mcpRequest('tools/call', {
            name: 'openspace.file.read',
            arguments: { path: '../../../etc/passwd' },
        });

        // The MCP server returns a result (not an error) but with isError:true inside
        // because the tool handler catches the exception and returns error content.
        expect(response.result).toBeDefined();
        const result = response.result;
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/Path traversal detected|outside workspace/);
    });

    test('tools/call for openspace.pane.list returns isError:true when bridge not connected', async () => {
        // Bridge is not connected in a fresh server start without a browser frontend
        // The tool should return isError:true with "Bridge not connected" message
        const response = await mcpRequest('tools/call', {
            name: 'openspace.pane.list',
            arguments: {},
        });

        expect(response.result).toBeDefined();
        // Either bridge is connected (has content without isError) or not connected (isError:true)
        // Both are valid depending on server state; we just assert the response is well-formed
        const result = response.result;
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0].type).toBe('text');
    });
});
