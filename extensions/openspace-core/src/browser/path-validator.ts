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
 * Shared path validation utility.
 *
 * Task 21: Extracted from editor-command-contribution.ts and file-command-contribution.ts
 * which had near-identical validatePath() methods (~60 lines each). The editor variant
 * used `uri.path.toString()` while the file variant used `uri.path.fsPath()`. Both are
 * now standardised on `fsPath()` which is the correct choice for filesystem operations.
 */

import * as path from './browser-path';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ILogger } from '@theia/core/lib/common/logger';
import { OpenCodeService } from '../common/opencode-protocol';
import { isSensitiveFile } from '../common/sensitive-files';

export interface PathValidationOptions {
    /** Human-readable tag used in log messages, e.g. '[EditorCommand]' */
    logTag: string;
    /** When true, sensitive-file blocking is skipped. */
    skipSensitiveCheck?: boolean;
}

/**
 * Validate a file path against the current workspace root.
 *
 * Performs:
 * 1. Workspace-root resolution (relative -> absolute)
 * 2. Path traversal rejection (`..` components)
 * 3. Workspace containment check
 * 4. Optional symlink resolution via OpenCodeService (Node backend)
 * 5. Sensitive file blocking
 *
 * @returns The validated absolute path, or `null` if the path is rejected.
 */
export async function validatePath(
    filePath: string,
    workspaceService: WorkspaceService,
    logger: ILogger,
    openCodeService: OpenCodeService | undefined,
    options: PathValidationOptions
): Promise<string | null> {
    const { logTag } = options;
    try {
        // Step 1: Get workspace root using fsPath() -- correct for all filesystem operations.
        const workspaceRoot = workspaceService.tryGetRoots()[0];
        if (!workspaceRoot) {
            logger.warn(`${logTag} No workspace root found`);
            return null;
        }
        const rootPath = workspaceRoot.resource.path.fsPath();

        // Step 2: Resolve the path (handle relative paths)
        let resolvedPath: string;
        if (path.isAbsolute(filePath)) {
            resolvedPath = filePath;
        } else {
            resolvedPath = path.join(rootPath, filePath);
        }

        // Step 3: Reject path traversal
        let normalizedPath = path.normalize(resolvedPath);
        if (normalizedPath.includes('..')) {
            logger.warn(`${logTag} Path traversal attempt rejected: ${filePath}`);
            return null;
        }

        // Step 3b: Double-check all components for '..' segments (belt-and-suspenders)
        const pathComponents = normalizedPath.split(path.sep);
        for (const component of pathComponents) {
            if (component === '..') {
                logger.warn(`${logTag} Path traversal via component rejected: ${filePath}`);
                return null;
            }
        }

        // Step 4: Workspace containment check
        const normalizedRoot = path.normalize(rootPath);
        const normalizedRootSlash = normalizedRoot.endsWith(path.sep)
            ? normalizedRoot
            : normalizedRoot + path.sep;
        const pathAsForward = normalizedPath.replace(/[/\\]/g, '/');
        const rootAsForward = normalizedRoot.replace(/[/\\]/g, '/');
        const rootSlashForward = rootAsForward.endsWith('/') ? rootAsForward : rootAsForward + '/';

        if (
            normalizedPath !== normalizedRoot &&
            !normalizedPath.startsWith(normalizedRootSlash) &&
            !pathAsForward.startsWith(rootSlashForward) &&
            pathAsForward !== rootAsForward
        ) {
            logger.warn(`${logTag} Path outside workspace rejected: ${filePath}`);
            return null;
        }

        // Step 5: Symlink resolution via Node backend (browser cannot call fs.realpath)
        if (openCodeService) {
            const result = await openCodeService.validatePath(normalizedPath, normalizedRoot);
            if (!result.valid) {
                logger.warn(`${logTag} Path rejected by symlink check: ${result.error}`);
                return null;
            }
            normalizedPath = result.resolvedPath || normalizedPath;
        }

        // Step 6: Sensitive file blocking
        if (!options.skipSensitiveCheck) {
            const fileName = path.basename(normalizedPath);
            const relativePath = normalizedPath
                .replace(rootPath, '')
                .replace(/^[/\\]/, '');

            if (isSensitiveFile(fileName) || isSensitiveFile(relativePath)) {
                logger.warn(`${logTag} Sensitive file access denied: ${filePath}`);
                return null;
            }
        }

        return normalizedPath;
    } catch (error) {
        logger.error(`${logTag} Path validation error:`, error);
        return null;
    }
}
