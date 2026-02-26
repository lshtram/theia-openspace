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

// Suppress known harmless warnings from Monaco Editor
// Persistent filesystem cache — survives between builds
// Cuts warm build time from ~45s to ~5s when dependencies haven't changed
function applyFilesystemCache(config) {
    config.cache = {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
        buildDependencies: {
            // Invalidate cache when any webpack config changes, or when local
            // extension lib files change (without this, the cache serves stale
            // bundles after a `tsc` recompile of local extensions).
            config: [
                __filename,
                path.resolve(__dirname, 'gen-webpack.config.js'),
                path.resolve(__dirname, 'gen-webpack.node.config.js'),
                // Local extension entry points — changing these busts the cache
                path.resolve(__dirname, '../extensions/openspace-chat/lib/browser/chat-widget.js'),
                path.resolve(__dirname, '../extensions/openspace-chat/lib/browser/message-bubble.js'),
                path.resolve(__dirname, '../extensions/openspace-chat/lib/browser/prompt-input/prompt-input.js'),
                path.resolve(__dirname, '../extensions/openspace-core/lib/browser/session-service.js'),
                path.resolve(__dirname, '../extensions/openspace-core/lib/node/opencode-proxy.js'),
            ],
        },
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
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
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
