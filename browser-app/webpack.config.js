/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const path = require('path');
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');
const CopyPlugin = require('copy-webpack-plugin');

/**
 * Expose bundled modules on window.theia.moduleName namespace, e.g.
 * window['theia']['@theia/core/lib/common/uri'].
 * Such syntax can be used by external code, for instance, for testing.
configs[0].module.rules.push({
    test: /\.js$/,
    loader: require.resolve('@theia/application-manager/lib/expose-loader')
}); */

// Persistent filesystem cache — survives between builds.
// Cuts warm build time from ~45s to ~5s when dependencies haven't changed.
//
// CACHE INVALIDATION FOR LOCAL EXTENSIONS:
// Local extensions are symlinked: node_modules/openspace-* -> ../extensions/*.
// With resolve.symlinks=false (required for worktree support), webpack sees
// these modules at node_modules/openspace-* paths. By default, webpack treats
// everything in node_modules/ as "managed" — meaning it skips content hashing
// and only checks package name + version. Since our local extensions keep the
// same version (0.1.0) across rebuilds, webpack never detects content changes
// after `tsc` recompiles them. This causes stale bundles.
//
// Fix: Use snapshot.managedPaths with a regex that EXCLUDES our openspace-*
// and voice-core packages from the "managed" assumption. Webpack will then
// check content hashes for these modules on every build.
const LOCAL_PACKAGES = ['openspace-chat', 'openspace-core', 'openspace-layout',
    'openspace-languages', 'openspace-presentation', 'openspace-settings',
    'openspace-viewers', 'openspace-voice', 'openspace-whiteboard', 'voice-core'];
const localPkgPattern = LOCAL_PACKAGES.join('|');

function applyFilesystemCache(config) {
    config.cache = {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
        buildDependencies: {
            config: [
                __filename,
                path.resolve(__dirname, 'gen-webpack.config.js'),
                path.resolve(__dirname, 'gen-webpack.node.config.js'),
            ],
        },
    };
    // Override managedPaths: treat node_modules as managed EXCEPT our local
    // symlinked packages. The regex captures the package path but uses a
    // negative lookahead to exclude our local packages from the managed set.
    // This means webpack will hash+timestamp our local packages normally,
    // while still skipping expensive checks for third-party dependencies.
    config.snapshot = {
        ...(config.snapshot || {}),
        managedPaths: [
            new RegExp(
                `^(.+?[\\/]node_modules[\\/](?!(${localPkgPattern})[\\/])(@.+?[\\/])?.+?)[\\/]`
            ),
        ],
    };
}

configs.forEach(config => {
    applyFilesystemCache(config);

    config.ignoreWarnings = [
        // Suppress Monaco Editor worker dynamic require warnings
        /Critical dependency: the request of a dependency is an expression/,
        // Suppress other known safe warnings
        /Can't resolve 'node:.*'/,
    ];
    
    // Reduce webpack stats output verbosity
    config.stats = {
        ...config.stats,
        warnings: false,
        warningsFilter: [
            /Critical dependency: the request of a dependency is an expression/,
        ],
    };

    // Fix hotkeys-js CJS/ESM interop issue with tldraw.
    // tldraw's pre-bundled CJS uses esbuild's __toESM(require('hotkeys-js'), 1).
    // With isNodeMode=1, __toESM does: { default: module.exports }.
    // The CJS index.js routes through an env check; we alias to the CJS dist
    // directly to ensure webpack gets the function as module.exports, giving
    // import_hotkeys_js.default = the hotkeys function (not a double-wrapped namespace).
    if (config.resolve) {
        // Prevent webpack from resolving symlinks to their real paths.
        // Without this, webpack deduplicates node_modules/openspace-chat
        // to the main repo's copy (via symlink resolution), so the worktree's
        // compiled lib/ files are never included in the bundle.
        config.resolve.symlinks = false;

        config.resolve.alias = {
            ...config.resolve.alias,
            'hotkeys-js': path.resolve(__dirname, '../node_modules/hotkeys-js/dist/hotkeys.common.js'),
        };
        // Stub Node.js built-ins used by voice-core adapters (whisper-cpp, kokoro)
        // These adapters are server-side only; the browser bundle should never call them.
        // path is shimmed with path-browserify (already in the dep tree) so that
        // Theia's terminal widget can call path.basename() without crashing.
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: require.resolve('path-browserify'),
            child_process: false,
            os: false,
            stream: false,
            util: false,
        };
    }
    // kokoro-js is a Node.js-only TTS library (uses native binaries).
    // The browser bundle imports voice-core types/FSMs but never invokes KokoroAdapter.
    // Mark both the package root and the CJS subpath as externals so webpack
    // doesn't try to resolve or bundle either entry point in the frontend chunk.
    config.externals = {
        ...(typeof config.externals === 'object' && !Array.isArray(config.externals) ? config.externals : {}),
        'kokoro-js': 'commonjs kokoro-js',
        'kokoro-js/dist/kokoro.cjs': 'commonjs kokoro-js/dist/kokoro.cjs',
    };
});

applyFilesystemCache(nodeConfig.config);

// kokoro-js is a Node.js-only TTS library that uses native ONNX binaries.
// It is NOT suited for webpack bundling: its CJS build is at a subpath not
// exported via the package exports map, and it requires large binary assets.
// Mark it as external in ALL webpack configs (frontend + backend).
// At runtime, Node.js will load it directly from node_modules.
const kokoroExternals = { 'kokoro-js': 'commonjs kokoro-js', 'kokoro-js/dist/kokoro.cjs': 'commonjs kokoro-js/dist/kokoro.cjs' };
nodeConfig.config.externals = {
    ...(typeof nodeConfig.config.externals === 'object' && !Array.isArray(nodeConfig.config.externals) ? nodeConfig.config.externals : {}),
    ...kokoroExternals,
};

// Copy reveal.js CSS files as static assets so they can be loaded via
// <link> tags without going through webpack's style-loader runtime (which
// overflows the call stack when large CSS files are bundled together).
const revealThemesSrc = path.resolve(__dirname, '../node_modules/reveal.js/dist/theme');
const revealBaseCssSrc = path.resolve(__dirname, '../node_modules/reveal.js/dist/reveal.css');
configs[0].plugins = [
    ...(configs[0].plugins || []),
    new CopyPlugin({
        patterns: [
            {
                from: revealThemesSrc,
                to: path.join(__dirname, 'lib/frontend/reveal-themes'),
                // Include fonts subdirectory so @import url(./fonts/...) in theme CSS resolves.
            },
            {
                from: revealBaseCssSrc,
                to: path.join(__dirname, 'lib/frontend/reveal-themes/reveal.css'),
            },
        ],
    }),
];

module.exports = [
    ...configs,
    nodeConfig.config
];
