/**
 * Shared MCP test helpers.
 *
 * The /mcp endpoint uses the Streamable HTTP transport which requires:
 *   Accept: application/json, text/event-stream
 * Responses are SSE-formatted: "event: message\ndata: {...}\n\n"
 */

const HUB_URL = 'http://localhost:3000';
export const MCP_URL = `${HUB_URL}/mcp`;

/** Parse an SSE-formatted MCP HTTP response body into a JSON-RPC object. */
export function parseSseResponse(text: string): any {
    const dataLine = text.split('\n').find(line => line.startsWith('data:'));
    if (!dataLine) {
        throw new Error(`MCP SSE response has no data line. Body: ${text.substring(0, 200)}`);
    }
    return JSON.parse(dataLine.slice('data:'.length).trim());
}

/** Send a raw JSON-RPC request to the MCP endpoint and return the parsed response. */
export async function mcpJsonRpc(method: string, params?: unknown): Promise<any> {
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
            Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    return parseSseResponse(await response.text());
}

/** Call a named MCP tool and return the parsed response. */
export async function mcpCall(name: string, args: unknown = {}): Promise<any> {
    return mcpJsonRpc('tools/call', { name, arguments: args });
}
