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
 * Phase T4: PatchEngine — versioned, operation-based artifact mutations.
 *
 * Supports two operations:
 *   - replace_content: full file replacement (exactly one op)
 *   - replace_lines: zero-indexed line range replacement (one or more ops,
 *     applied in reverse line order to avoid offset drift)
 *
 * Uses Optimistic Concurrency Control (OCC) via a per-file version counter.
 * Versions are persisted to {workspaceRoot}/.openspace/patch-versions.json.
 *
 * Per-file serial write queue prevents torn writes under concurrent MCP tool calls.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface PatchRequest {
    baseVersion: number;
    actor: string;
    intent: string;
    ops: unknown[];
}

export interface PatchApplyResult {
    version: number;
    bytes: number;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ConflictError extends Error {
    readonly code = 'VERSION_CONFLICT';

    constructor(
        readonly currentVersion: number,
        readonly filePath: string
    ) {
        super(`Version conflict on ${filePath}: baseVersion does not match currentVersion ${currentVersion}`);
        this.name = 'ConflictError';
    }
}

export class PatchValidationError extends Error {
    readonly code: string;
    readonly location: string;
    readonly remediation: string;

    constructor(code: string, location: string, reason: string, remediation: string) {
        super(reason);
        this.name = 'PatchValidationError';
        this.code = code;
        this.location = location;
        this.remediation = remediation;
    }
}

// ---------------------------------------------------------------------------
// Operation types (internal)
// ---------------------------------------------------------------------------

interface ReplaceContentOp {
    op: 'replace_content';
    content: string;
}

interface ReplaceLinesOp {
    op: 'replace_lines';
    startLine: number;
    endLine: number;
    content: string;
}

type PatchOp = ReplaceContentOp | ReplaceLinesOp;

// ---------------------------------------------------------------------------
// Operation validators / parsers
// ---------------------------------------------------------------------------

function parseReplaceContentOps(ops: unknown[]): ReplaceContentOp {
    if (ops.length !== 1) {
        throw new PatchValidationError(
            'UNSUPPORTED_PATCH_OPS',
            'ops',
            'Exactly one replace_content operation is required',
            'Provide one op: {"op":"replace_content","content":"..."}'
        );
    }
    const op = ops[0] as Record<string, unknown>;
    if (op.op !== 'replace_content' || typeof op.content !== 'string') {
        throw new PatchValidationError(
            'UNSUPPORTED_PATCH_OPS',
            'ops[0]',
            'Unsupported patch operation',
            'Use {"op":"replace_content","content":"..."}'
        );
    }
    return { op: 'replace_content', content: op.content };
}

function parseReplaceLinesOps(ops: unknown[]): ReplaceLinesOp[] {
    return ops.map((raw, i) => {
        const op = raw as Record<string, unknown>;
        if (
            op.op !== 'replace_lines' ||
            typeof op.startLine !== 'number' ||
            typeof op.endLine !== 'number' ||
            typeof op.content !== 'string'
        ) {
            throw new PatchValidationError(
                'INVALID_OP',
                `ops[${i}]`,
                `replace_lines op at index ${i} is missing required fields`,
                'Each op must have: {"op":"replace_lines","startLine":N,"endLine":N,"content":"..."}'
            );
        }
        return {
            op: 'replace_lines' as const,
            startLine: op.startLine,
            endLine: op.endLine,
            content: op.content,
        };
    });
}

function parseOps(ops: unknown[]): { type: 'replace_content' | 'replace_lines'; ops: PatchOp[] } {
    if (ops.length === 0) {
        throw new PatchValidationError(
            'NO_OPS',
            'ops',
            'ops array must not be empty',
            'Provide at least one operation'
        );
    }

    const firstOp = ops[0] as Record<string, unknown>;
    const opType = firstOp?.op;

    if (opType === 'replace_content') {
        return { type: 'replace_content', ops: [parseReplaceContentOps(ops)] };
    } else if (opType === 'replace_lines') {
        return { type: 'replace_lines', ops: parseReplaceLinesOps(ops) };
    } else {
        throw new PatchValidationError(
            'UNSUPPORTED_OP',
            'ops[0].op',
            `Unknown operation type: ${String(opType)}`,
            'Supported ops: replace_content, replace_lines'
        );
    }
}

// ---------------------------------------------------------------------------
// Content application helpers
// ---------------------------------------------------------------------------

function applyReplaceContent(op: ReplaceContentOp): string {
    return op.content;
}

function applyReplaceLines(currentContent: string, ops: ReplaceLinesOp[]): string {
    const lines = currentContent.split('\n');

    // Validate all ops first (bounds check), before making any changes
    for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (op.startLine < 0 || op.endLine < op.startLine || op.endLine >= lines.length) {
            throw new PatchValidationError(
                'OUT_OF_BOUNDS',
                `ops[${i}]`,
                `Line range [${op.startLine}, ${op.endLine}] is out of bounds for file with ${lines.length} lines`,
                `Ensure startLine >= 0, startLine <= endLine, and endLine < ${lines.length}`
            );
        }
    }

    // Sort by startLine descending (reverse order) to avoid offset drift
    const sortedOps = [...ops].sort((a, b) => b.startLine - a.startLine);

    for (const op of sortedOps) {
        const replacementLines = op.content.split('\n');
        lines.splice(op.startLine, op.endLine - op.startLine + 1, ...replacementLines);
    }

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PatchEngine
// ---------------------------------------------------------------------------

export class PatchEngine {
    private versions = new Map<string, number>();
    private readonly versionsFilePath: string;
    /** Per-file serial write queue: prevents torn writes under concurrent calls */
    private writeQueues = new Map<string, Promise<void>>();

    constructor(private readonly workspaceRoot: string) {
        this.versionsFilePath = path.join(workspaceRoot, '.openspace', 'patch-versions.json');
    }

    /**
     * Get the current version for a file path (relative).
     * Returns 0 if the file has never been patched.
     */
    getVersion(filePath: string): number {
        return this.versions.get(filePath) ?? 0;
    }

    /**
     * Apply a patch request to the given relative file path.
     * Enforces OCC: throws ConflictError if baseVersion doesn't match current.
     * Throws PatchValidationError if ops are invalid.
     * Returns { version, bytes } on success.
     */
    async apply(filePath: string, request: PatchRequest): Promise<PatchApplyResult> {
        // 1. Validate and resolve path (prevents traversal attacks)
        const absolutePath = this.resolveSafePath(filePath);

        // 2. OCC check
        const currentVersion = this.getVersion(filePath);
        if (request.baseVersion !== currentVersion) {
            throw new ConflictError(currentVersion, filePath);
        }

        // 3. Parse and validate ops
        const parsed = this.parseRequest(request);

        // 4. Enqueue behind any in-flight write for this path (serial queue)
        const doWrite = async (): Promise<PatchApplyResult> => {
            // Read current content (empty string for new files)
            let currentContent = '';
            if (fs.existsSync(absolutePath)) {
                currentContent = fs.readFileSync(absolutePath, 'utf-8');
            }

            // Apply operations
            let nextContent: string;
            if (parsed.type === 'replace_content') {
                nextContent = applyReplaceContent(parsed.ops[0] as ReplaceContentOp);
            } else {
                nextContent = applyReplaceLines(currentContent, parsed.ops as ReplaceLinesOp[]);
            }

            // Ensure parent directory exists
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(absolutePath, nextContent, 'utf-8');

            // Increment version
            const nextVersion = currentVersion + 1;
            this.versions.set(filePath, nextVersion);

            // Persist versions to disk
            await this.saveVersions();

            return {
                version: nextVersion,
                bytes: Buffer.byteLength(nextContent, 'utf-8'),
            };
        };

        // Chain write behind any in-flight write for the same path
        const prev = this.writeQueues.get(filePath) ?? Promise.resolve();
        let result!: PatchApplyResult;
        const next = prev.then(async () => {
            result = await doWrite();
        });
        this.writeQueues.set(filePath, next.catch(() => {}));

        await next;
        return result;
    }

    /**
     * Load version map from disk. Call once on startup.
     */
    async loadVersions(): Promise<void> {
        if (!fs.existsSync(this.versionsFilePath)) {
            return; // All versions start at 0
        }
        try {
            const raw = fs.readFileSync(this.versionsFilePath, 'utf-8');
            const data = JSON.parse(raw) as Record<string, number>;
            this.versions = new Map(Object.entries(data));
        } catch {
            // Corrupt file — start fresh
            this.versions = new Map();
        }
    }

    /**
     * Persist version map to disk. Called after every successful apply().
     */
    private async saveVersions(): Promise<void> {
        const dir = path.dirname(this.versionsFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const data: Record<string, number> = {};
        for (const [k, v] of this.versions) {
            data[k] = v;
        }
        fs.writeFileSync(this.versionsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    /**
     * Resolve a relative file path to an absolute path, ensuring it stays
     * within the workspaceRoot (prevents path traversal attacks).
     */
    private resolveSafePath(filePath: string): string {
        // Resolve relative to workspaceRoot
        const resolved = path.resolve(this.workspaceRoot, filePath);

        // Ensure resolved path starts with workspaceRoot
        const root = this.workspaceRoot.endsWith(path.sep)
            ? this.workspaceRoot
            : this.workspaceRoot + path.sep;

        if (!resolved.startsWith(root) && resolved !== this.workspaceRoot) {
            throw new PatchValidationError(
                'PATH_TRAVERSAL',
                'filePath',
                `Path traversal detected: ${filePath} resolves outside workspace root`,
                'Provide a relative path within the workspace (no ../ segments)'
            );
        }

        return resolved;
    }

    /**
     * Parse and validate a PatchRequest, returning typed ops.
     */
    private parseRequest(request: PatchRequest): { type: 'replace_content' | 'replace_lines'; ops: PatchOp[] } {
        if (!request || !Array.isArray(request.ops)) {
            throw new PatchValidationError(
                'INVALID_REQUEST',
                'request',
                'PatchRequest must have an ops array',
                'Provide a valid PatchRequest with ops field'
            );
        }
        return parseOps(request.ops);
    }
}
