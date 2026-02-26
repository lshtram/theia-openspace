/**
 * Diff utilities — extracted from message-bubble.tsx for testability.
 *
 * Provides line-level diff computation using an LCS-based algorithm.
 */

export interface DiffLine {
    type: 'add' | 'del' | 'ctx';
    text: string;
}

export interface DiffResult {
    lines: DiffLine[];
    additions: number;
    deletions: number;
}

/**
 * Compute a simple line-level diff between two text strings.
 * Falls back to full-replacement when input exceeds 2000 combined lines.
 */
export function computeSimpleDiff(oldText: string, newText: string): DiffResult {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const lines: DiffLine[] = [];
    let additions = 0;
    let deletions = 0;

    // Task 24: Apply per-file line limit BEFORE LCS to prevent O(m*n) memory explosion.
    // LCS allocates m*n cells; 1000x1000 = 1M cells is borderline, 5000x5000 = 200MB crashes the tab.
    const MAX_DIFF_LINES = 1000;
    if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
        for (const l of oldLines) { lines.push({ type: 'del', text: l }); deletions++; }
        for (const l of newLines) { lines.push({ type: 'add', text: l }); additions++; }
        return { lines, additions, deletions };
    }

    // Myers-like simple diff using LCS
    const lcs = computeLCS(oldLines, newLines);
    let oi = 0, ni = 0, li = 0;
    while (oi < oldLines.length || ni < newLines.length) {
        if (li < lcs.length && oi < oldLines.length && ni < newLines.length && oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
            lines.push({ type: 'ctx', text: oldLines[oi] });
            oi++; ni++; li++;
        } else if (li < lcs.length && ni < newLines.length && newLines[ni] === lcs[li]) {
            lines.push({ type: 'del', text: oldLines[oi] }); deletions++; oi++;
        } else if (li < lcs.length && oi < oldLines.length && oldLines[oi] === lcs[li]) {
            lines.push({ type: 'add', text: newLines[ni] }); additions++; ni++;
        } else if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
            lines.push({ type: 'del', text: oldLines[oi] }); deletions++; oi++;
        } else if (ni < newLines.length) {
            lines.push({ type: 'add', text: newLines[ni] }); additions++; ni++;
        }
    }
    return { lines, additions, deletions };
}

/**
 * Represents a row in a side-by-side (split) diff view.
 */
export interface SplitDiffLine {
    left?: { type: 'del' | 'ctx'; text: string; lineNo: number };
    right?: { type: 'add' | 'ctx'; text: string; lineNo: number };
}

/**
 * Compute a side-by-side (split) diff between two text strings.
 * Returns an array of SplitDiffLine rows suitable for a two-column diff view.
 */
export function computeSplitDiff(oldText: string, newText: string): SplitDiffLine[] {
    if (oldText === newText) {
        // Return context rows for identical inputs
        if (oldText === '') return [];
        const lines = oldText.split('\n');
        return lines.map((text, i) => ({
            left: { type: 'ctx', text, lineNo: i + 1 },
            right: { type: 'ctx', text, lineNo: i + 1 },
        }));
    }

    const unified = computeSimpleDiff(oldText, newText);
    const result: SplitDiffLine[] = [];
    let leftLineNo = 1;
    let rightLineNo = 1;

    for (const line of unified.lines) {
        if (line.type === 'ctx') {
            result.push({
                left: { type: 'ctx', text: line.text, lineNo: leftLineNo++ },
                right: { type: 'ctx', text: line.text, lineNo: rightLineNo++ },
            });
        } else if (line.type === 'del') {
            result.push({
                left: { type: 'del', text: line.text, lineNo: leftLineNo++ },
            });
        } else if (line.type === 'add') {
            result.push({
                right: { type: 'add', text: line.text, lineNo: rightLineNo++ },
            });
        }
    }

    return result;
}

/**
 * Compute the Longest Common Subsequence of two string arrays.
 */
export function computeLCS(a: string[], b: string[]): string[] {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; }
            else { dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]); }
        }
    }
    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) { result.unshift(a[i - 1]); i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) { i--; }
        else { j--; }
    }
    return result;
}
