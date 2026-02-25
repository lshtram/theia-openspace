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
 * Resolve `filePath` relative to `workspaceRoot`, ensuring the resolved path
 * stays within the workspace (prevents path traversal and symlink escape).
 *
 * Uses `fs.realpathSync` to resolve symlinks before the containment check.
 * For paths that do not yet exist, the nearest existing parent is resolved.
 *
 * @throws {Error} if the resolved path escapes the workspace root.
 */
export function resolveSafePath(workspaceRoot: string, filePath: string): string {
    const resolved = path.resolve(workspaceRoot, filePath);

    let realRoot: string;
    try {
        realRoot = fs.realpathSync(workspaceRoot);
    } catch {
        realRoot = workspaceRoot;
    }

    let realResolved: string;
    try {
        realResolved = fs.realpathSync(resolved);
    } catch {
        try {
            realResolved = path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
        } catch {
            realResolved = resolved;
        }
    }

    const rootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (!realResolved.startsWith(rootWithSep) && realResolved !== realRoot) {
        throw new Error(`Path traversal detected: "${filePath}" resolves outside workspace root`);
    }
    return realResolved;
}
