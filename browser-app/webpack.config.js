/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
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
configs.forEach(config => {
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
});

module.exports = [
    ...configs,
    nodeConfig.config
];
