// Test setup file for jsdom environment
require('global-jsdom/register');

// Polyfills and global test setup
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Silence console in tests unless DEBUG is set
if (!process.env.DEBUG) {
    global.console = {
        ...console,
        log: () => {},
        info: () => {},
        debug: () => {},
        warn: () => {}
    };
}
