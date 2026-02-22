/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const path = require('path');
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');

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
            // Invalidate cache when any webpack config changes
            config: [
                __filename,
                path.resolve(__dirname, 'gen-webpack.config.js'),
                path.resolve(__dirname, 'gen-webpack.node.config.js'),
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
});

applyFilesystemCache(nodeConfig.config);

module.exports = [
    ...configs,
    nodeConfig.config
];
