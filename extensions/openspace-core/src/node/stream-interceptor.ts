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
 * - Nested braces in JSON with string-aware parsing (T1-8)
 * - Timeout guard
 * - Unicode in arguments
 */
export class StreamInterceptor {
    private pendingText: string = '';  // Text from incomplete block at end of chunk

    /**
     * Process a chunk of text and extract %%OS{...}%% blocks
     * 
     * T1-7: Returns fresh blocks array per invocation (no accumulation)
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
        
        // T1-7: Use local array instead of accumulating across chunks
        const extractedBlocks: ParsedBlock[] = [];
        
        // Find all potential block starts
        let searchStart = 0;
        let foundMore = true;
        
        while (foundMore) {
            const startIdx = result.indexOf('%%OS{', searchStart);
            if (startIdx === -1) {
                foundMore = false;
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
                        // T1-7: Add to local array, not to class property
                        // Preserve all fields from the JSON, not just cmd and args
                        // This maintains backward compatibility with {"cmd":"x","msg":"y"} format
                        extractedBlocks.push({
                            cmd: parsed.cmd,
                            args: parsed.args || parsed, // Use parsed.args if exists, otherwise use all parsed fields
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
        
        // Plain-text fallback: %%OS <verb> <args>%%
        // Handles AI output like "%%OS open path/to/file%%" which is not JSON format
        result = this.parsePlainTextBlocks(result, extractedBlocks);

        // T1-7: Return fresh array with blocks from this chunk only
        return { text: result, blocks: extractedBlocks };
    }

    /**
     * Parse plain-text %%OS <verb> <args>%% blocks as a fallback when
     * the AI outputs non-JSON format (e.g. "%%OS open docs/README.md%%").
     * 
     * Supported verbs:
     *   - open <path>  → cmd: "openspace.editor.open", args: { path }
     *   - run <cmd>    → cmd: "openspace.terminal.run", args: { command: cmd }
     * 
     * Mutates extractedBlocks and returns text with matched blocks removed.
     */
    private parsePlainTextBlocks(text: string, extractedBlocks: ParsedBlock[]): string {
        // Match %%OS <verb> <rest>%% (non-JSON, i.e. not followed by '{')
        // Also matches without closing %% (AI often omits the closing marker, e.g. "%%OS open path/to/file")
        const plainTextPattern = /%%OS(?!\s*\{)\s+(\w+)\s+([^%\n\r]+?)(?:%%|$)/gm;
        let result = text;
        let match: RegExpExecArray | null;

        // Collect all matches first (can't mutate string while iterating)
        const matches: Array<{ full: string; verb: string; arg: string }> = [];
        // eslint-disable-next-line no-cond-assign
        for (match = plainTextPattern.exec(text); match !== null; match = plainTextPattern.exec(text)) {
            matches.push({ full: match[0], verb: match[1].toLowerCase(), arg: match[2].trim() });
        }

        for (const { full, verb, arg } of matches) {
            // Skip if this position is inside a code fence
            const pos = result.indexOf(full);
            if (pos === -1) continue;
            if (this.isInsideFence(result, pos)) continue;

            let cmd: string | undefined;
            let args: unknown;

            if (verb === 'open') {
                cmd = 'openspace.editor.open';
                args = { path: arg };
            } else if (verb === 'run') {
                cmd = 'openspace.terminal.run';
                args = { command: arg };
            }
            // Unknown verbs are silently skipped (passed through as text)

            if (cmd) {
                extractedBlocks.push({ cmd, args, raw: full });
                result = result.replace(full, '');
            }
        }

        return result;
    }

    /**
     * Find the end position of a block starting at startIdx
     * 
     * T1-8: Added string-aware brace counting (handles braces inside JSON strings)
     */
    private findBlockEnd(text: string, startIdx: number): number {
        let braceDepth = 0;
        let insideString = false;
        let escapeNext = false;
        
        let i = startIdx + 4; // Start after %%OS{
        
        while (i < text.length) {
            const char = text[i];
            
            // T1-8: Handle escape sequences
            if (escapeNext) {
                escapeNext = false;
                i++;
                continue;
            }
            
            // T1-8: Handle escaped characters
            if (char === '\\') {
                escapeNext = true;
                i++;
                continue;
            }
            
            // T1-8: Track string boundaries
            if (char === '"') {
                insideString = !insideString;
                i++;
                continue;
            }
            
            // T1-8: Only count braces outside strings
            if (!insideString) {
                if (char === '{') {
                    braceDepth++;
                } else if (char === '}') {
                    braceDepth--;
                    // Check if this closes the block (braceDepth is now 0) and followed by %%
                    if (braceDepth === 0 && i + 1 < text.length && text[i + 1] === '%' && i + 2 < text.length && text[i + 2] === '%') {
                        return i + 2; // Return position of last %
                    }
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
     * 
     * T1-7: Each chunk returns fresh blocks - this method combines them for convenience
     */
    processChunks(chunks: string[]): ParseResult {
        let combinedText = '';
        let allBlocks: ParsedBlock[] = [];

        for (const chunk of chunks) {
            const result = this.processChunk(chunk);
            combinedText += result.text;
            // T1-7: Combine blocks from each chunk
            allBlocks = allBlocks.concat(result.blocks);
        }

        return { text: combinedText, blocks: allBlocks };
    }
}
