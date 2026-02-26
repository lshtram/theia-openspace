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
 * Node-only utility functions for path validation and shell execution.
 * Extracted from OpenCodeProxy to keep each module focused and <400 lines.
 */

import { injectable } from '@theia/core/shared/inversify';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

@injectable()
export class NodeUtils {

    /**
     * T1-2/T1-3: Validate a file path by resolving symlinks on the Node backend.
     * Returns the canonically-resolved path if it is within the workspace root.
     */
    async validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }> {
        try {
            // Attempt to resolve symlinks on the real filesystem
            let resolvedPath: string;
            try {
                resolvedPath = await fs.promises.realpath(filePath);
            } catch {
                // Path doesn't exist yet (e.g. createFile for a new file)
                // Resolve the parent directory instead
                const parentDir = path.dirname(filePath);
                const fileName = path.basename(filePath);
                let resolvedParent: string;
                try {
                    resolvedParent = await fs.promises.realpath(parentDir);
                } catch {
                    // Parent doesn't exist either — allow it (new nested path)
                    resolvedParent = path.normalize(parentDir);
                }
                resolvedPath = path.join(resolvedParent, fileName);
            }

            // Normalize workspace root for comparison
            const normalizedRoot = path.normalize(workspaceRoot);
            const normalizedResolved = path.normalize(resolvedPath);

            if (!normalizedResolved.startsWith(normalizedRoot + path.sep) && normalizedResolved !== normalizedRoot) {
                return {
                    valid: false,
                    error: `Path resolves outside workspace: ${filePath} → ${resolvedPath}`
                };
            }

            return { valid: true, resolvedPath: normalizedResolved };
        } catch (err) {
            return {
                valid: false,
                error: `Path validation error: ${err instanceof Error ? err.message : String(err)}`
            };
        }
    }

    /**
     * Execute a shell command on the backend using child_process.exec.
     * Used by the shell mode (!) in the chat prompt input.
     * Commands are run with a 30-second timeout and 1MB output limit.
     * The cwd must be a non-empty absolute path; execution is refused otherwise.
     */
    async executeShellCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
        // Enforce a valid absolute cwd — never fall back to an implicit directory.
        if (!cwd || !path.isAbsolute(cwd)) {
            return {
                stdout: '',
                stderr: `Shell execution refused: cwd must be an absolute path, got: ${JSON.stringify(cwd)}`,
                exitCode: 1,
                error: 'Invalid cwd',
            };
        }

        const MAX_OUTPUT = 1024 * 1024; // 1MB
        const TIMEOUT = 30_000; // 30 seconds

        return new Promise(resolve => {
            try {
                const child = childProcess.exec(command, {
                    cwd,
                    timeout: TIMEOUT,
                    maxBuffer: MAX_OUTPUT,
                    shell: '/bin/bash',
                    env: { ...process.env, TERM: 'dumb' },
                }, (error, stdout, stderr) => {
                    if (error) {
                        // exec error (timeout, signal, etc.)
                        resolve({
                            stdout: stdout || '',
                            stderr: stderr || error.message,
                            exitCode: error.code !== undefined ? (typeof error.code === 'number' ? error.code : 1) : 1,
                            error: error.killed ? 'Command timed out' : undefined,
                        });
                    } else {
                        resolve({
                            stdout: stdout || '',
                            stderr: stderr || '',
                            exitCode: 0,
                        });
                    }
                });

                // Safety: if the child somehow doesn't exit, force-kill after timeout + buffer
                const safetyTimer = setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch { /* ignore */ }
                }, TIMEOUT + 5000);
                child.on('exit', () => clearTimeout(safetyTimer));
            } catch (err) {
                resolve({
                    stdout: '',
                    stderr: err instanceof Error ? err.message : String(err),
                    exitCode: 1,
                    error: 'Failed to execute command',
                });
            }
        });
    }
}
