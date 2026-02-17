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
 * TerminalRingBuffer - Ring buffer for terminal output capture.
 * 
 * Captures terminal output for agent read-back with a maximum line limit
 * to prevent memory exhaustion (10,000 lines per terminal).
 * 
 * Part of Phase 3 Task 3.4: Terminal Commands Registration
 */
export class TerminalRingBuffer {
    /**
     * Map of terminal IDs to their output lines.
     */
    private buffer: Map<string, string[]> = new Map();
    
    /**
     * Maximum number of lines to retain per terminal.
     * Default: 10,000 lines per §4.2
     */
    private readonly maxLines: number;

    /**
     * Create a new TerminalRingBuffer.
     * 
     * @param maxLines Maximum lines per terminal (default: 10000)
     */
    constructor(maxLines: number = 10000) {
        this.maxLines = maxLines;
    }

    /**
     * Append data to the terminal's ring buffer.
     * 
     * @param terminalId The terminal identifier
     * @param data The data to append (may contain newlines)
     */
    append(terminalId: string, data: string): void {
        const lines = this.buffer.get(terminalId) || [];
        const newLines = data.split('\n');
        lines.push(...newLines);
        
        // Trim to maxLines (keep most recent)
        if (lines.length > this.maxLines) {
            lines.splice(0, lines.length - this.maxLines);
        }
        
        this.buffer.set(terminalId, lines);
    }

    /**
     * Read the last N lines from the terminal's buffer.
     * 
     * @param terminalId The terminal identifier
     * @param lines Number of lines to read (default: 100)
     * @returns Array of output lines (most recent last)
     */
    read(terminalId: string, lines: number = 100): string[] {
        const all = this.buffer.get(terminalId) || [];
        return all.slice(-lines);
    }

    /**
     * Read all lines from the terminal's buffer.
     * 
     * @param terminalId The terminal identifier
     * @returns Array of all output lines
     */
    readAll(terminalId: string): string[] {
        return this.buffer.get(terminalId) || [];
    }

    /**
     * Clear the buffer for a specific terminal.
     * 
     * @param terminalId The terminal identifier
     */
    clear(terminalId: string): void {
        this.buffer.delete(terminalId);
    }

    /**
     * Clear all buffers.
     */
    clearAll(): void {
        this.buffer.clear();
    }

    /**
     * Get the current number of lines in the buffer for a terminal.
     * 
     * @param terminalId The terminal identifier
     * @returns Number of lines in buffer
     */
    getLineCount(terminalId: string): number {
        return (this.buffer.get(terminalId) || []).length;
    }

    /**
     * Check if a terminal has any buffered output.
     * 
     * @param terminalId The terminal identifier
     * @returns true if terminal has buffered output
     */
    hasOutput(terminalId: string): boolean {
        const lines = this.buffer.get(terminalId);
        return lines !== undefined && lines.length > 0;
    }

    /**
     * Get list of all tracked terminal IDs.
     * 
     * @returns Array of terminal IDs
     */
    getTerminalIds(): string[] {
        return Array.from(this.buffer.keys());
    }

    /**
     * Get the maximum lines configuration.
     * 
     * @returns Maximum lines per terminal
     */
    getMaxLines(): number {
        return this.maxLines;
    }
}

/**
 * Sanitize terminal output by removing ANSI escape sequences and control characters.
 * 
 * Per §17.9: Terminal output sanitization
 * 
 * @param output The raw terminal output
 * @returns Sanitized output string
 */
export function sanitizeOutput(output: string): string {
    // Remove ANSI escape sequences (colors, cursor movement, etc.)
    // Matches: ESC [ ... Letter (e.g., \x1B[31m for red)
    let sanitized = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    
    // Remove extended ANSI sequences (RGB colors, etc.)
    // Matches: ESC [ 38;2;R;G;B m (true color)
    sanitized = sanitized.replace(/\x1B\[[0-9;]*;[\d;]+m/g, '');
    
    // Remove other escape sequences
    sanitized = sanitized.replace(/\x1B\][^\x07]*\x07/g, '');
    
    // Remove control characters (except newline, carriage return, tab)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
}

/**
 * Dangerous command patterns for detection per §17.3.
 * Using string-based construction to avoid regex control character issues.
 */
const DANGEROUS_PATTERN_STRINGS: string[] = [
    '^rm\\s+-rf\\s+',           // Recursive force remove
    '^rm\\s+-r\\s+',            // Recursive remove (with force)
    '^rm\\s+-d\\s+',            // Directory remove
    '^sudo\\s+',                // Superuser do
    '^chmod\\s+777\\s+',        // World-writable permissions
    '^chmod\\s+-R\\s+777\\s+',  // Recursive world-writable
    '^:\\(\\)',                 // Fork bomb start (:()
    '^fork\\s*\\(\\s*\\)\\s*\\{', // Fork function
    '^dd\\s+if=',               // Direct disk write
    '^mkfs\\s+',                // Filesystem creation
    '^wipefs\\s+',              // Filesystem wipe
    '^shred\\s+',               // Secure file deletion
    '^curl.*>',                 // Download to system path (any redirect)
    '^wget.*-O\\s+/',           // Wget output to file
    '^wget\\s+.*\\s+/',         // Wget to system path (any position)
    '^chown\\s+-R\\s+\\w+\\s+/', // Recursive ownership change
    '^chgrp\\s+-R\\s+\\w+\\s+/', // Recursive group change
    '^passwd\\s+',              // Password change
    '^useradd\\s+',             // Add user
    '^userdel\\s+',             // Delete user
    '^groupadd\\s+',            // Add group
    '^groupdel\\s+',           // Delete group
    '^shutdown\\s+',            // System shutdown
    '^reboot$',                 // System reboot (standalone)
    '^reboot\\s+',              // System reboot (with args)
    '^halt$',                   // System halt (standalone)
    '^halt\\s+',                // System halt (with args)
    '^init\\s+0',               // Runlevel 0 (halt)
    '^init\\s+6',               // Runlevel 6 (reboot)
];

export const DANGEROUS_PATTERNS: RegExp[] = DANGEROUS_PATTERN_STRINGS.map(p => new RegExp(p));

/**
 * Check if a command is potentially dangerous and requires user confirmation.
 * 
 * Per §17.3: Dangerous command detection (GAP-8)
 * 
 * @param text The command text to check
 * @returns true if the command matches dangerous patterns
 */
export function isDangerous(text: string): boolean {
    const trimmed = text.trim();
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Get the list of dangerous patterns for testing/debugging.
 * 
 * @returns Array of dangerous command patterns
 */
export function getDangerousPatterns(): RegExp[] {
    return [...DANGEROUS_PATTERNS];
}
