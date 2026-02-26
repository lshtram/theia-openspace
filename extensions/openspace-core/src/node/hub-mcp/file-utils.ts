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

import * as path from 'path';
import * as fs from 'fs';

/**
 * List directory entries, optionally recursively.
 */
export function listDirectory(dirPath: string, recursive: boolean, base?: string): string[] {
    const results: string[] = [];
    const rel = base || '';
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            results.push(`${entryRel}/`);
            if (recursive) {
                results.push(...listDirectory(path.join(dirPath, entry.name), true, entryRel));
            }
        } else {
            results.push(entryRel);
        }
    }
    return results;
}

/**
 * Lightweight ReDoS guard: rejects patterns with nested quantifiers
 * that cause exponential backtracking (e.g., `(a+)+`, `(a|b)*+`).
 * Not a complete ReDoS detector, but catches the most common patterns.
 */
function isSafeRegex(pattern: string): boolean {
    // Reject nested quantifiers: a quantifier immediately following a group with a quantifier
    // Matches patterns like (x+)+, (x*)+, (x+)*, etc.
    if (/\([^)]*[+*]\)[+*{]/.test(pattern)) return false;
    // Reject excessive alternation depth with quantifiers
    if (/\([^)]*\|[^)]*\)[+*{]/.test(pattern)) return false;
    // Reject extremely long patterns (likely generated/malicious)
    if (pattern.length > 200) return false;
    return true;
}

/**
 * Search files in a directory for a regex pattern with safety limits.
 */
export function searchFiles(dirPath: string, pattern: string, globFilter?: string): string[] {
    const results: string[] = [];

    // Safety limits to prevent DoS via large trees / large files / pathological regex
    const MAX_RESULTS = 500;
    const MAX_FILES_SCANNED = 5_000;
    const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
    const MAX_DEPTH = 20;
    const REGEX_TIMEOUT_MS = 5_000; // 5-second wall-clock budget for the entire search

    let regex: RegExp;
    if (!isSafeRegex(pattern)) {
        // Fall back to literal string search for unsafe patterns
        return [];
    }
    try {
        regex = new RegExp(pattern);
    } catch {
        // Fall back to literal search
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }

    // Extract file extension from glob pattern (e.g. "**/*.ts" → ".ts", "*.json" → ".json")
    const ext = globFilter
        ? (globFilter.includes('*') ? globFilter.slice(globFilter.lastIndexOf('*') + 1) : globFilter)
        : null;

    let filesScanned = 0;
    const deadline = Date.now() + REGEX_TIMEOUT_MS;

    const walk = (dir: string, depth: number): void => {
        if (results.length >= MAX_RESULTS) return;
        if (filesScanned >= MAX_FILES_SCANNED) return;
        if (depth > MAX_DEPTH) return;
        if (Date.now() > deadline) return;

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (results.length >= MAX_RESULTS) break;
            if (filesScanned >= MAX_FILES_SCANNED) break;
            if (Date.now() > deadline) break;

            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                    walk(full, depth + 1);
                }
            } else if (!ext || entry.name.endsWith(ext)) {
                filesScanned++;
                try {
                    const stat = fs.statSync(full);
                    if (stat.size > MAX_FILE_SIZE_BYTES) continue; // skip oversized files
                    const content = fs.readFileSync(full, 'utf-8');
                    const lines = content.split('\n');
                    for (let idx = 0; idx < lines.length; idx++) {
                        if (results.length >= MAX_RESULTS) break;
                        if (regex.test(lines[idx])) {
                            results.push(`${full}:${idx + 1}: ${lines[idx].trim()}`);
                        }
                    }
                } catch {
                    // skip unreadable files
                }
            }
        }
    };

    walk(dirPath, 0);
    return results;
}
