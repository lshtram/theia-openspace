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
