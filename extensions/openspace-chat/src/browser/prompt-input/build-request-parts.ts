/**
 * Build MessagePart[] from Prompt for sending to opencode server.
 * 
 * This module serializes the internal Prompt representation into the format
 * expected by the opencode server's message API (openspace-core protocol).
 * 
 * Produces SDK-compatible part inputs:
 * - TextPartInput:  { type: 'text', text: string }
 * - FilePartInput:  { type: 'file', mime: string, url: string, filename?: string }
 * - AgentPartInput: { type: 'agent', name: string }
 * Images are sent as FilePartInput with data: URL and the image MIME type.
 */

import type { Prompt, MessagePart } from './types';

/**
 * Build MessagePart array from Prompt for sending to the server.
 * 
 * @param prompt The parsed prompt from the editor
 * @param workspaceRoot The workspace root path (for resolving relative paths)
 * @returns Array of message parts ready to send to server
 */
export function buildRequestParts(prompt: Prompt, workspaceRoot: string): MessagePart[] {
    if (prompt.length === 0) {
        return [];
    }

    const parts: MessagePart[] = [];
    let textContent = '';

    // Process parts in order to maintain structure
    for (const part of prompt) {
        switch (part.type) {
            case 'text':
                textContent += part.content;
                break;

            case 'file': {
                // Flush accumulated text before file
                if (textContent.length > 0) {
                    parts.push({ type: 'text', text: textContent });
                    textContent = '';
                }

                // Build absolute path then produce a file:// URL (SDK FilePartInput format)
                const absolutePath = resolveAbsolutePath(workspaceRoot, part.path);
                const fileUrl = `file://${encodeFilePath(absolutePath)}${fileSelectionQuery(part.selection)}`;
                const filename = getBasename(part.path);
                parts.push({
                    type: 'file',
                    mime: 'text/plain',
                    url: fileUrl,
                    filename
                });
                break;
            }

            case 'agent': {
                // Flush accumulated text before agent mention
                if (textContent.length > 0) {
                    parts.push({ type: 'text', text: textContent });
                    textContent = '';
                }
                // Emit a proper AgentPartInput
                parts.push({ type: 'agent', name: part.name });
                break;
            }

            case 'image': {
                // Flush accumulated text before image
                if (textContent.length > 0) {
                    parts.push({ type: 'text', text: textContent });
                    textContent = '';
                }

                // Images are sent as FilePartInput with data: URL
                parts.push({
                    type: 'file',
                    mime: part.mime,
                    url: part.dataUrl,
                    filename: part.filename
                });
                break;
            }
        }
    }

    // Flush any remaining text
    if (textContent.length > 0) {
        parts.push({ type: 'text', text: textContent });
    }

    return parts;
}

/**
 * Resolve a relative path to an absolute path.
 */
function resolveAbsolutePath(workspaceRoot: string, path: string): string {
    if (path.startsWith('/')) {
        return path;
    }
    // Handle Windows paths
    if (/^[A-Za-z]:[\\/]/.test(path)) {
        return path;
    }
    return `${workspaceRoot.replace(/[\\/]+$/, '')}/${path}`;
}

/**
 * Encode a file path for use in a file:// URL.
 * Normalizes backslashes, ensures a leading slash (for Windows drive letters),
 * then percent-encodes each path segment while preserving separators.
 */
function encodeFilePath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    // Windows drive letter paths (C:/...) need a leading slash in file:// URLs
    const withLeadingSlash = normalized.startsWith('/') ? normalized : '/' + normalized;
    return withLeadingSlash.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

/**
 * Get the basename (filename) from a path.
 */
function getBasename(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop() || path;
}

/**
 * Build a query string for file line selection.
 */
function fileSelectionQuery(selection?: { startLine: number; endLine: number }): string {
    return selection ? `?start=${selection.startLine}&end=${selection.endLine}` : '';
}
