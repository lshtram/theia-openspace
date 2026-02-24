// Test setup file for jsdom environment
require('global-jsdom/register');

// Register tsx extension with ts-node for React component files
const tsNode = require('ts-node');
const path = require('path');
const fs = require('fs');
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

// Theia's FrontendApplicationConfigProvider stores config under Symbol('FrontendApplicationConfigProvider').
// In this test environment, modules can be loaded in multiple forms, creating distinct symbols and causing
// config lookup misses. Normalize that symbol to Symbol.for so all module variants share the same key.
const NativeSymbol = global.Symbol;
function PatchedSymbol(description) {
    if (description === 'FrontendApplicationConfigProvider') {
        return NativeSymbol.for('FrontendApplicationConfigProvider');
    }
    return NativeSymbol(description);
}
PatchedSymbol.for = NativeSymbol.for.bind(NativeSymbol);
PatchedSymbol.keyFor = NativeSymbol.keyFor.bind(NativeSymbol);
Object.getOwnPropertyNames(NativeSymbol).forEach(name => {
    if (!(name in PatchedSymbol)) {
        Object.defineProperty(PatchedSymbol, name, Object.getOwnPropertyDescriptor(NativeSymbol, name));
    }
});
global.Symbol = PatchedSymbol;

// Ensure a single React module identity in tests. Worktree and parent-repo node_modules
// can both be discoverable from this path, which causes invalid hook calls.
const localReact = require(require.resolve('react'));
const localReactDom = require(require.resolve('react-dom'));
const localReactDomClient = require(require.resolve('react-dom/client'));

const reactAliasCandidates = [
    path.resolve(process.cwd(), '../../node_modules/react/index.js'),
    path.resolve(process.cwd(), '../../node_modules/react-dom/index.js'),
    path.resolve(process.cwd(), '../../node_modules/react-dom/client.js'),
];

for (const candidate of reactAliasCandidates) {
    if (fs.existsSync(candidate)) {
        const exportsValue = candidate.endsWith('/react/index.js')
            ? localReact
            : candidate.endsWith('/react-dom/client.js')
                ? localReactDomClient
                : localReactDom;
        require.cache[candidate] = {
            id: candidate,
            filename: candidate,
            loaded: true,
            exports: exportsValue,
        };
    }
}

// Stub the Theia injectable-preference-proxy module to break the circular-dependency
// crash that occurs when importing @theia/core/lib/common/preferences/* in Node.js tests.
// The circular dep: preference-service → common/index → injectable-preference-proxy
// → preference-service (undefined at that point) → TypeError: Class extends undefined.
// Pre-register a stub for the problematic compiled module before anything loads it.
const injectablePrefProxyPath = require.resolve(
    '@theia/core/lib/common/preferences/injectable-preference-proxy'
);
require.cache[injectablePrefProxyPath] = {
    id: injectablePrefProxyPath,
    filename: injectablePrefProxyPath,
    loaded: true,
    exports: {
        PreferenceProxySchema: Symbol('PreferenceProxySchema'),
        PreferenceProxyFactory: Symbol('PreferenceProxyFactory'),
        InjectablePreferenceProxy: class InjectablePreferenceProxy {},
        PreferenceProxyChange: class PreferenceProxyChange {},
    },
};

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

// Configure Theia FrontendApplicationConfigProvider before importing any Theia modules.
// Some tests import from @theia/core/src/* while others import from @theia/core/lib/*,
// so set config on both module variants when available.
const testFrontendConfig = {
    applicationName: 'Theia Openspace Test',
    defaultTheme: 'dark',
    defaultIconTheme: 'none',
    electron: {
        disallowReloadKeybinding: false
    }
};

const FRONTEND_CONFIG_KEY = Symbol.for('theia.test.frontend.config');

class TestFrontendApplicationConfigProvider {
    static get() {
        const config = globalThis[FRONTEND_CONFIG_KEY];
        if (!config) {
            throw new Error('The configuration is not set. Did you call FrontendApplicationConfigProvider#set?');
        }
        return config;
    }

    static set(config) {
        if (!globalThis[FRONTEND_CONFIG_KEY]) {
            globalThis[FRONTEND_CONFIG_KEY] = config;
        }
    }
}

const srcProviderCandidates = new Set([
    require.resolve('@theia/core/src/browser/frontend-application-config-provider'),
    path.resolve(process.cwd(), 'node_modules/@theia/core/src/browser/frontend-application-config-provider.ts'),
    path.resolve(process.cwd(), '../../node_modules/@theia/core/src/browser/frontend-application-config-provider.ts'),
]);

for (const candidate of srcProviderCandidates) {
    if (fs.existsSync(candidate)) {
        require.cache[candidate] = {
            id: candidate,
            filename: candidate,
            loaded: true,
            exports: {
                DEFAULT_BACKGROUND_COLOR_STORAGE_KEY: 'theme.background',
                FrontendApplicationConfigProvider: TestFrontendApplicationConfigProvider,
            },
        };
    }
}

const { FrontendApplicationConfigProvider: FrontendApplicationConfigProviderLib } = require('@theia/core/lib/browser/frontend-application-config-provider');
FrontendApplicationConfigProviderLib.set(testFrontendConfig);
TestFrontendApplicationConfigProvider.set(testFrontendConfig);

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
