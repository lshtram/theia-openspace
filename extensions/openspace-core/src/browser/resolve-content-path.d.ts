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
export declare function resolveContentPath(inputPath: string, configuredFolder: string, workspaceRootUri: string, extension: string): string;
//# sourceMappingURL=resolve-content-path.d.ts.map