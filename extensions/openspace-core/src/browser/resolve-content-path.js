"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContentPath = void 0;
/**
 * Resolves a user-supplied content path into a fully-qualified file:// URI string.
 *
 * Rules:
 *  - Absolute paths (starting with `/` or `file://`) are returned as-is (just ensure extension).
 *  - Paths containing a directory separator (`/`) are treated as relative to workspaceRoot.
 *  - Bare names (no `/`) are placed under `configuredFolder` inside workspaceRoot.
 *
 * @param inputPath      The path the caller provided (bare name, relative, or absolute).
 * @param configuredFolder  Preference value e.g. "openspace/whiteboards" (relative to workspace).
 * @param workspaceRootUri  The workspace root as a file:// URI string.
 * @param extension      The required file extension including dot, e.g. ".whiteboard.json".
 */
function resolveContentPath(inputPath, configuredFolder, workspaceRootUri, extension) {
    // Ensure extension is present
    const withExt = inputPath.endsWith(extension) ? inputPath : `${inputPath}${extension}`;
    // Absolute path — return as-is
    if (withExt.startsWith('/') || withExt.startsWith('file://')) {
        return withExt;
    }
    // Relative path with dir separator — resolve directly under workspace root
    const root = workspaceRootUri.replace(/\/$/, '');
    if (withExt.includes('/')) {
        return `${root}/${withExt}`;
    }
    // Bare name — place under the configured folder
    const folder = configuredFolder.replace(/^\//, '').replace(/\/$/, '');
    return `${root}/${folder}/${withExt}`;
}
exports.resolveContentPath = resolveContentPath;
//# sourceMappingURL=resolve-content-path.js.map