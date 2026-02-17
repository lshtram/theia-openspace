/**
 * Build MessagePart[] from Prompt for sending to opencode server.
 * 
 * This module serializes the internal Prompt representation into the format
 * expected by the opencode server's message API (openspace-core protocol).
 */

import type { Prompt, MessagePart } from './types';

/**
 * Build MessagePart array from Prompt for sending to the server.
 * 
 * The serialization rules:
 * - All TextParts are concatenated into a single text part
 * - FileParts are converted to file parts with absolute paths
 * - AgentParts are embedded in the text (the opencode server doesn't have a separate agent part type)
 * - ImageParts are converted to image parts with data URL as path
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

                const absolutePath = resolveAbsolutePath(workspaceRoot, part.path);
                parts.push({
                    type: 'file',
                    path: absolutePath,
                    content: part.content
                });
                break;
            }

            case 'agent':
                // Embed agent mention in text (e.g., "@oracle")
                textContent += part.content;
                break;

            case 'image': {
                // Flush accumulated text before image
                if (textContent.length > 0) {
                    parts.push({ type: 'text', text: textContent });
                    textContent = '';
                }

                // Send image as image part with data URL as path
                parts.push({
                    type: 'image',
                    path: part.dataUrl,
                    mime_type: part.mime
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
    return `${workspaceRoot}/${path}`;
}
