// Test setup file for jsdom environment
require('global-jsdom/register');

// Register tsx extension with ts-node for React component files
const tsNode = require('ts-node');
tsNode.register({
    transpileOnly: true,
    files: true,
    compilerOptions: {
        jsx: 'react',
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment'
    }
});

// Ignore CSS imports in Node.js (Theia imports CSS from TypeScript files)
require.extensions['.css'] = () => {};
require.extensions['.scss'] = () => {};
require.extensions['.sass'] = () => {};
require.extensions['.less'] = () => {};

// Polyfills for missing jsdom APIs
if (typeof document !== 'undefined') {
    // Deprecated clipboard API polyfill
    if (!document.queryCommandSupported) {
        document.queryCommandSupported = () => false;
    }
    if (!document.execCommand) {
        document.execCommand = () => false;
    }
}

// Polyfill scrollIntoView — not implemented in jsdom
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () { /* noop */ };
}

// Configure Theia FrontendApplicationConfigProvider before importing any Theia modules
const { FrontendApplicationConfigProvider } = require('@theia/core/lib/browser/frontend-application-config-provider');
FrontendApplicationConfigProvider.set({
    applicationName: 'Theia Openspace Test',
    defaultTheme: 'dark',
    defaultIconTheme: 'none',
    electron: {
        disallowReloadKeybinding: false
    }
});

// Polyfills and global test setup
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Polyfill DragEvent and other drag-related APIs for @lumino/dragdrop
if (typeof global.DragEvent === 'undefined') {
    global.DragEvent = class DragEvent extends global.MouseEvent {
        constructor(type, eventInitDict) {
            super(type, eventInitDict);
            this.dataTransfer = eventInitDict && eventInitDict.dataTransfer || null;
        }
    };
}

if (typeof global.DataTransfer === 'undefined') {
    global.DataTransfer = class DataTransfer {
        constructor() {
            this.dropEffect = 'none';
            this.effectAllowed = 'all';
            this.files = [];
            this.items = [];
            this.types = [];
            this._data = {};
        }
        getData(format) { return this._data[format] || ''; }
        setData(format, data) { this._data[format] = data; }
        clearData(format) { if (format) delete this._data[format]; else this._data = {}; }
    };
}

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
