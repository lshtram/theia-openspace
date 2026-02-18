/**
 * Parse prompt parts from a contenteditable DOM element.
 * 
 * This module traverses the DOM tree of a contenteditable editor and extracts
 * text, file pills, and agent pills into a structured Prompt array.
 */

import type { Prompt, FilePart, AgentPart } from './types';

/**
 * Parse the contenteditable DOM and extract prompt parts.
 * 
 * The DOM structure we expect:
 * - Text nodes contain plain text
 * - <span data-type="file" data-path="..."> for file pills
 * - <span data-type="agent" data-name="..."> for agent pills
 * - <br> elements for line breaks
 * - Zero-width space (\u200B) is used for cursor positioning and ignored
 * 
 * @param editor The contenteditable element
 * @returns Array of parsed content parts
 */
export function parseFromDOM(editor: HTMLElement): Prompt {
    const parts: Prompt = [];
    let currentOffset = 0;
    let currentTextContent = '';
    let currentTextStart = 0;

    /**
     * Flush any accumulated text content as a TextPart.
     */
    const flushText = () => {
        if (currentTextContent.length > 0) {
            parts.push({
                type: 'text',
                content: currentTextContent,
                start: currentTextStart,
                end: currentOffset
            });
            currentTextContent = '';
        }
    };

    /**
     * Process a single node in the DOM tree.
     */
    const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            // Text node - accumulate text
            let text = node.textContent || '';
            
            // Remove zero-width spaces (used for cursor positioning)
            text = text.replace(/\u200B/g, '');
            
            if (text.length > 0) {
                if (currentTextContent.length === 0) {
                    currentTextStart = currentOffset;
                }
                currentTextContent += text;
                currentOffset += text.length;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;

            if (element.tagName === 'BR') {
                // Line break - add newline to text
                if (currentTextContent.length === 0) {
                    currentTextStart = currentOffset;
                }
                currentTextContent += '\n';
                currentOffset += 1;
            } else if (element.tagName === 'SPAN' && element.getAttribute('data-type')) {
                // Pill element - flush text and add part
                flushText();

                const dataType = element.getAttribute('data-type');
                const content = element.textContent || '';

                if (dataType === 'file') {
                    const path = element.getAttribute('data-path') || '';
                    const startLine = element.getAttribute('data-start-line');
                    const endLine = element.getAttribute('data-end-line');

                    const part: FilePart = {
                        type: 'file',
                        path,
                        content,
                        start: currentOffset,
                        end: currentOffset + content.length
                    };

                    if (startLine && endLine) {
                        part.selection = {
                            startLine: parseInt(startLine, 10),
                            endLine: parseInt(endLine, 10)
                        };
                    }

                    parts.push(part);
                    currentOffset += content.length;
                } else if (dataType === 'agent') {
                    const name = element.getAttribute('data-name') || '';

                    const part: AgentPart = {
                        type: 'agent',
                        name,
                        content,
                        start: currentOffset,
                        end: currentOffset + content.length
                    };

                    parts.push(part);
                    currentOffset += content.length;
                }

                currentTextStart = currentOffset;
            } else {
                // Regular element - recurse into children
                for (const child of Array.from(element.childNodes)) {
                    processNode(child);
                }
            }
        }
    };

    // Process all child nodes
    for (const child of Array.from(editor.childNodes)) {
        processNode(child);
    }

    // Flush any remaining text
    flushText();

    return parts;
}
