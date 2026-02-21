/**
 * Resolves a user-supplied content path into a fully-qualified file:// URI string.
 *
 * Rules:
 *  - Absolute paths (starting with `/` or `file://`) are resolved against the workspace root
 *    and verified to be contained within it (path traversal prevention).
 *  - Paths containing a directory separator (`/`) are treated as relative to workspaceRoot.
 *  - Bare names (no `/`) are placed under `configuredFolder` inside workspaceRoot.
 *
 * @param inputPath      The path the caller provided (bare name, relative, or absolute).
 * @param configuredFolder  Preference value e.g. "openspace/whiteboards" (relative to workspace).
 * @param workspaceRootUri  The workspace root as a file:// URI string.
 * @param extension      The required file extension including dot, e.g. ".whiteboard.json".
 * @throws {Error} If the resolved path escapes the workspace root.
 */
export function resolveContentPath(
    inputPath: string,
    configuredFolder: string,
    workspaceRootUri: string,
    extension: string,
): string {
    // Ensure extension is present
    const withExt = inputPath.endsWith(extension) ? inputPath : `${inputPath}${extension}`;

    const root = workspaceRootUri.replace(/\/$/, '');

    // Absolute path — resolve against workspace root and verify containment
    // Task 5: Always resolve relative to workspace, reject paths that escape
    if (withExt.startsWith('/') || withExt.startsWith('file://')) {
        // Normalize: convert absolute /unix path to file:// URI for containment check
        const uriPath = withExt.startsWith('file://')
            ? withExt
            : `file://${withExt}`;

        // Verify the resolved path is contained within workspace root
        const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
        if (!uriPath.startsWith(normalizedRoot) && uriPath !== root) {
            throw new Error(`Path '${inputPath}' escapes workspace root`);
        }

        return uriPath;
    }

    // Relative path with dir separator — resolve directly under workspace root
    if (withExt.includes('/')) {
        // Normalize away any .. traversal
        const joined = `${root}/${withExt}`;
        const normalized = normalizeUriPath(joined);
        assertContained(normalized, root, inputPath);
        return normalized;
    }

    // Bare name — place under the configured folder
    const folder = configuredFolder.replace(/^\//, '').replace(/\/$/, '');
    return `${root}/${folder}/${withExt}`;
}

/**
 * Collapse `..` segments in a file:// URI path component.
 * e.g. "file:///workspace/subdir/../../../etc/passwd" → "file:////etc/passwd"
 */
function normalizeUriPath(uri: string): string {
    const prefix = uri.startsWith('file://') ? 'file://' : '';
    const path = prefix ? uri.slice(prefix.length) : uri;
    const parts = path.split('/');
    const stack: string[] = [];
    for (const part of parts) {
        if (part === '..') {
            stack.pop();
        } else if (part !== '.') {
            stack.push(part);
        }
    }
    return prefix + stack.join('/');
}

function assertContained(resolvedUri: string, rootUri: string, inputPath: string): void {
    const normalizedRoot = rootUri.endsWith('/') ? rootUri : `${rootUri}/`;
    if (!resolvedUri.startsWith(normalizedRoot) && resolvedUri !== rootUri) {
        throw new Error(`Path '${inputPath}' escapes workspace root`);
    }
}
