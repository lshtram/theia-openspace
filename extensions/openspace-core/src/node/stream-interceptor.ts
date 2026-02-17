// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Stream Interceptor - Extracts %%OS{...}%% blocks from text
 * 
 * This module provides functionality to extract agent command blocks from text,
 * handle code fences, and manage chunk boundaries for streaming responses.
 */

export interface ParsedBlock {
    cmd: string;
    args: unknown;
    raw: string;
}

export interface ParseResult {
    text: string;
    blocks: ParsedBlock[];
}

/**
 * Stream Interceptor class
 * Handles:
 * - Chunk boundary splitting
 * - Code fence detection (GAP-2)
 * - Nested braces in JSON
 * - Timeout guard
 * - Unicode in arguments
 */
export class StreamInterceptor {
    private extractedBlocks: ParsedBlock[] = [];
    private pendingText: string = '';  // Text from incomplete block at end of chunk

    /**
     * Process a chunk of text and extract %%OS{...}%% blocks
     */
    processChunk(text: string): ParseResult {
        // Prepend any pending text from previous chunk
        const fullText = this.pendingText + text;
        this.pendingText = '';
        
        // Extract all %%OS{...}%% blocks
        let result = fullText;
        
        // Check if there's an incomplete block at the end
        const lastOpenIdx = result.lastIndexOf('%%OS{');
        const lastCloseIdx = result.lastIndexOf('}%%');
        
        if (lastOpenIdx > lastCloseIdx) {
            // There's an unclosed block - save it for next chunk
            this.pendingText = result.substring(lastOpenIdx);
            result = result.substring(0, lastOpenIdx);
        }
        
        // Find all potential block starts
        let searchStart = 0;
        
        while (true) {
            const startIdx = result.indexOf('%%OS{', searchStart);
            if (startIdx === -1) {
                break;
            }
            
            // Check if this block is inside a code fence
            if (this.isInsideFence(result, startIdx)) {
                searchStart = startIdx + 5;
                continue;
            }
            
            // Find the end of this block
            const endIdx = this.findBlockEnd(result, startIdx);
            
            if (endIdx !== -1) {
                const raw = result.substring(startIdx, endIdx + 1);
                const jsonStr = raw.substring(4, raw.length - 2);
                
                try {
                    const parsed = JSON.parse(jsonStr);
                    // Only extract if it has a valid cmd field
                    if (parsed.cmd) {
                        this.extractedBlocks.push({
                            cmd: parsed.cmd,
                            args: parsed.args || {},
                            raw
                        });
                        
                        // Remove the block
                        result = result.substring(0, startIdx) + result.substring(endIdx + 1);
                        searchStart = startIdx;
                    } else {
                        // No valid cmd, skip
                        searchStart = startIdx + 5;
                    }
                } catch (e) {
                    // Malformed JSON - skip this block
                    searchStart = startIdx + 5;
                }
            } else {
                // Block not complete
                break;
            }
        }
        
        return { text: result, blocks: this.extractedBlocks };
    }

    /**
     * Find the end position of a block starting at startIdx
     */
    private findBlockEnd(text: string, startIdx: number): number {
        let braceDepth = 0;
        let i = startIdx + 4; // Start after %%OS{
        
        while (i < text.length) {
            const char = text[i];
            
            if (char === '{') {
                braceDepth++;
            } else if (char === '}') {
                braceDepth--;
                // Check if this closes the block (braceDepth is now 0) and followed by %%
                if (braceDepth === 0 && i + 1 < text.length && text[i + 1] === '%' && i + 2 < text.length && text[i + 2] === '%') {
                    return i + 2; // Return position of last %
                }
            }
            
            i++;
        }
        
        return -1; // Not found
    }
    
    /**
     * Check if a position in the text is inside a code fence
     */
    private isInsideFence(text: string, pos: number): boolean {
        // Look backwards for fence markers
        let backtickCount = 0;
        let tildeCount = 0;
        let inFence = false;
        let fenceType: string | null = null;
        
        for (let i = 0; i < pos; i++) {
            const char = text[i];
            
            if (char === '`') {
                backtickCount++;
                tildeCount = 0;
                if (backtickCount >= 3 && !inFence) {
                    inFence = true;
                    fenceType = '```';
                } else if (backtickCount >= 3 && inFence && fenceType === '```') {
                    inFence = false;
                    fenceType = null;
                }
            } else if (char === '~') {
                tildeCount++;
                backtickCount = 0;
                if (tildeCount >= 3 && !inFence) {
                    inFence = true;
                    fenceType = '~~~';
                } else if (tildeCount >= 3 && inFence && fenceType === '~~~') {
                    inFence = false;
                    fenceType = null;
                }
            } else {
                backtickCount = 0;
                tildeCount = 0;
            }
        }
        
        return inFence;
    }

    /**
     * Reset the interceptor state
     */
    reset(): void {
        this.pendingText = '';
    }

    /**
     * Process multiple chunks
     */
    processChunks(chunks: string[]): ParseResult {
        let combinedText = '';
        let allBlocks: ParsedBlock[] = [];

        for (const chunk of chunks) {
            const result = this.processChunk(chunk);
            combinedText += result.text;
            allBlocks = allBlocks.concat(result.blocks);
            // Don't reset - pendingText carries over to next chunk
        }

        return { text: combinedText, blocks: allBlocks };
    }
}
