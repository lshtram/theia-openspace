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
 * Shared sensitive file patterns that must be blocked per §17.4.
 * 
 * This module provides a centralized denylist for sensitive files that
 * should not be accessible to AI agents. Both editor and file commands
 * use this shared configuration to ensure consistent security enforcement.
 * 
 * Patterns include:
 * - Environment files (.env, .env.local, .env.production)
 * - Version control (.git/, .ssh/)
 * - Private keys and certificates (id_rsa, id_ed25519, *.pem, *.key)
 * - Cloud service credentials (credentials.json, service-account.json, .aws/credentials)
 * - Configuration secrets (secrets.yml, master.key, database.yml)
 */

/**
 * Sensitive file patterns as RegExp objects.
 * These patterns match filenames and paths that should be blocked from access.
 */
export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
    /\.env$/,
    /\.env\.[a-zA-Z0-9]+$/,
    /^\.git\//,
    /^git\//,
    /id_rsa/,
    /id_dsa/,
    /id_ecdsa/,
    /id_ed25519/,
    /\.pem$/,
    /\.key$/,
    /\.cert$/,
    /(?:^|[/\\])\.ssh[/\\]/,  // Matches .ssh/ at start or after a separator
    /(?:^|[/\\])\.?secrets?(?:[/\\.]|$)/i,  // Task 15: Matches actual secrets files/dirs, not 'secret-santa.ts'
    /credentials/,
    /config.*secret/,
    /\.htpasswd$/,
    /\.aws/,
    /azure\.json$/,
    /gcloud/,
    /service-account\.json$/,
    /firebase-adminsdk/,
    /database\.yml/,
];

/**
 * Check if a file path matches any sensitive file pattern.
 * 
 * @param filePath The file path to check (can be filename or full path)
 * @returns true if the path matches any sensitive pattern, false otherwise
 */
export function isSensitiveFile(filePath: string): boolean {
    const normalizedPath = filePath.toLowerCase();
    
    for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if a file path matches any sensitive file pattern.
 * Alternative name for isSensitiveFile for better readability in some contexts.
 * 
 * @param path The file path to check
 * @returns true if the path is sensitive, false otherwise
 */
export function matchesSensitivePattern(path: string): boolean {
    return isSensitiveFile(path);
}
