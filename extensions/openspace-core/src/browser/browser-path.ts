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
 * Browser-safe POSIX path utilities.
 *
 * The webpack bundle stubs out Node's `path` module (path: false) so it resolves
 * to an empty object in the browser, causing `path.isAbsolute is not a function`
 * errors. This module provides the small subset of path operations needed by
 * browser-side code using pure string manipulation.
 *
 * All paths are assumed to be POSIX-style (forward slashes), which is correct
 * for the macOS/Linux environments this application targets.
 */

/** Path separator — always '/' in the browser context. */
export const sep = '/';

/** Returns true if the path starts with '/'. */
export function isAbsolute(p: string): boolean {
    return p.startsWith('/');
}

/**
 * Join path segments, collapsing redundant slashes.
 * Equivalent to Node's path.join for POSIX paths.
 */
export function join(...parts: string[]): string {
    const joined = parts
        .filter(p => p !== '')
        .join('/')
        .replace(/\/+/g, '/');
    // Preserve a leading slash if the first segment was absolute
    if (parts[0]?.startsWith('/') && !joined.startsWith('/')) {
        return '/' + joined;
    }
    return joined;
}

/**
 * Resolve '..' and '.' components in a path.
 * Equivalent to Node's path.normalize for POSIX paths.
 */
export function normalize(p: string): string {
    const isAbs = p.startsWith('/');
    const parts = p.split('/');
    const result: string[] = [];
    for (const part of parts) {
        if (part === '' || part === '.') {
            continue;
        } else if (part === '..') {
            if (result.length > 0 && result[result.length - 1] !== '..') {
                result.pop();
            } else if (!isAbs) {
                result.push('..');
            }
        } else {
            result.push(part);
        }
    }
    const normalized = result.join('/');
    if (isAbs) {
        return '/' + normalized;
    }
    return normalized || '.';
}

/**
 * Returns the last portion of a path (the filename).
 * Equivalent to Node's path.basename.
 */
export function basename(p: string, ext?: string): string {
    const parts = p.replace(/\/+$/, '').split('/');
    let base = parts[parts.length - 1] ?? '';
    if (ext && base.endsWith(ext)) {
        base = base.slice(0, base.length - ext.length);
    }
    return base;
}

/**
 * Returns the directory portion of a path.
 * Equivalent to Node's path.dirname.
 */
export function dirname(p: string): string {
    const idx = p.replace(/\/+$/, '').lastIndexOf('/');
    if (idx < 0) {
        return '.';
    }
    if (idx === 0) {
        return '/';
    }
    return p.slice(0, idx);
}
