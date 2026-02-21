# Syntax Highlighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add VS Code-quality TextMate syntax highlighting to the Monaco editor for all common languages (TS, TSX, JS, JSX, Python, C/C++, Markdown, JSON, YAML, Rust, Shell, HTML, CSS/SCSS, Java, Go, Ruby, PHP, C#, Swift, Kotlin, Lua, Dart, SQL, and more) via a new `openspace-languages` Theia extension.

**Architecture:** A new extension `extensions/openspace-languages/` registers a single `LanguageGrammarDefinitionContribution` that loads grammar files from the `tm-grammars` npm package (which vendors TextMate grammars sourced directly from `microsoft/vscode` and other authoritative repos). Monaco's existing TextMate service (`@theia/monaco`) activates these grammars automatically once registered. Language configurations (bracket matching, comment toggling, auto-close pairs) are registered alongside via `monaco.languages.setLanguageConfiguration()`.

**Tech Stack:** `tm-grammars` (npm), `@theia/monaco` TextMate infrastructure (`LanguageGrammarDefinitionContribution`, `TextmateRegistry`), `monaco.languages` API, InversifyJS DI.

---

## Background: How TextMate Grammars Work in This Project

The project uses `@theia/monaco` which wraps Monaco Editor with TextMate grammar support via `vscode-textmate` + `vscode-oniguruma`. The registration pattern (established by `@theia/ai-core`'s `PromptTemplateContribution`) is:

1. Register the language with Monaco: `monaco.languages.register({ id, extensions, aliases })`
2. Set language config: `monaco.languages.setLanguageConfiguration(id, config)`
3. Load the `.tmLanguage.json` grammar file (from `tm-grammars`)
4. Wrap it: `{ getGrammarDefinition: () => Promise.resolve({ format: 'json', content: grammar }) }`
5. Register scope→grammar: `registry.registerTextmateGrammarScope(scopeName, provider)`
6. Map language→scope: `registry.mapLanguageIdToTextmateGrammar(id, scopeName)`

The `LanguageGrammarDefinitionContribution` interface has one method: `registerTextmateLanguage(registry: TextmateRegistry): void`.

---

## Task 1: Create extension scaffold

**Files:**
- Create: `extensions/openspace-languages/package.json`
- Create: `extensions/openspace-languages/tsconfig.json`
- Create: `extensions/openspace-languages/src/browser/openspace-languages-frontend-module.ts`
- Create: `extensions/openspace-languages/src/browser/language-grammar-contribution.ts`
- Modify: `package.json` (root — add to `build:extensions` script)
- Modify: `tsconfig.json` (root — add reference)
- Modify: `browser-app/package.json` (add `openspace-languages` dependency)

**Step 1: Create `extensions/openspace-languages/package.json`**

```json
{
  "name": "openspace-languages",
  "version": "0.1.0",
  "license": "MIT",
  "theiaExtensions": [
    {
      "frontend": "lib/browser/openspace-languages-frontend-module"
    }
  ],
  "dependencies": {
    "@theia/core": "1.68.2",
    "@theia/monaco": "1.68.2",
    "tm-grammars": "^1.30.10"
  },
  "devDependencies": {
    "rimraf": "^5.0.0",
    "typescript": "~5.4.5"
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf lib tsconfig.tsbuildinfo",
    "watch": "tsc --watch"
  }
}
```

**Step 2: Create `extensions/openspace-languages/tsconfig.json`**

```json
{
  "extends": "../../configs/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["lib", "node_modules"]
}
```

**Step 3: Create the frontend module stub**

Create `extensions/openspace-languages/src/browser/openspace-languages-frontend-module.ts`:

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { LanguageGrammarContribution } from './language-grammar-contribution';

export default new ContainerModule(bind => {
    bind(LanguageGrammarContribution).toSelf().inSingletonScope();
    bind(LanguageGrammarDefinitionContribution).toService(LanguageGrammarContribution);
    console.log('[OpenSpaceLanguages] Frontend module loaded');
});
```

**Step 4: Create the grammar contribution stub**

Create `extensions/openspace-languages/src/browser/language-grammar-contribution.ts`:

```typescript
import { injectable } from '@theia/core/shared/inversify';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { TextmateRegistry } from '@theia/monaco/lib/browser/textmate/textmate-registry';
import * as monaco from '@theia/monaco-editor-core';

@injectable()
export class LanguageGrammarContribution implements LanguageGrammarDefinitionContribution {
    registerTextmateLanguage(registry: TextmateRegistry): void {
        // Tasks 2–4 will fill this in
    }
}
```

**Step 5: Wire into root `tsconfig.json`**

In `tsconfig.json` (root), add `openspace-languages` to the references array:

```json
{ "path": "./extensions/openspace-languages" }
```

Add it after the existing `openspace-settings` entry.

**Step 6: Wire into root `package.json` build script**

In `package.json` (root), in the `build:extensions` script, append:

```
&& yarn --silent --cwd extensions/openspace-languages build
```

Add it at the end of the existing chain.

**Step 7: Wire into `browser-app/package.json`**

Add to the `dependencies` object:

```json
"openspace-languages": "0.1.0"
```

**Step 8: Install the new dependency**

```bash
yarn install
```

Run from the repo root. Expected: installs `tm-grammars` into the workspace.

**Step 9: Verify extension builds (TypeScript only, no logic yet)**

```bash
yarn --cwd extensions/openspace-languages build
```

Expected: exits 0, `lib/browser/openspace-languages-frontend-module.js` created.

**Step 10: Commit**

```bash
git add extensions/openspace-languages/ tsconfig.json package.json browser-app/package.json
git commit -m "feat: scaffold openspace-languages extension"
```

---

## Task 2: Register core web languages (TS, TSX, JS, JSX, HTML, CSS, SCSS, JSON, Markdown)

These languages already have basic Monaco built-in support (no highlighting without a grammar registered via Theia's TextMate service), so registering their full TextMate grammars gives immediate VS Code-quality coloring.

**Files:**
- Modify: `extensions/openspace-languages/src/browser/language-grammar-contribution.ts`

**Step 1: Add grammar registrations for web languages**

Replace the body of `registerTextmateLanguage` with the following. The pattern for each language is identical — only the grammar file path, scope name, language id, file extensions, and language config vary.

```typescript
import { injectable } from '@theia/core/shared/inversify';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { TextmateRegistry } from '@theia/monaco/lib/browser/textmate/textmate-registry';
import * as monaco from '@theia/monaco-editor-core';

// tm-grammars ships JSON grammar files — import them directly (resolveJsonModule: true in tsconfig)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsGrammar = require('tm-grammars/grammars/typescript.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsxGrammar = require('tm-grammars/grammars/tsx.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsGrammar = require('tm-grammars/grammars/javascript.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsxGrammar = require('tm-grammars/grammars/jsx.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const htmlGrammar = require('tm-grammars/grammars/html.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cssGrammar = require('tm-grammars/grammars/css.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scssGrammar = require('tm-grammars/grammars/scss.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsonGrammar = require('tm-grammars/grammars/json.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mdGrammar = require('tm-grammars/grammars/markdown.json');

@injectable()
export class LanguageGrammarContribution implements LanguageGrammarDefinitionContribution {

    registerTextmateLanguage(registry: TextmateRegistry): void {
        this.registerTypescript(registry);
        this.registerTsx(registry);
        this.registerJavascript(registry);
        this.registerJsx(registry);
        this.registerHtml(registry);
        this.registerCss(registry);
        this.registerScss(registry);
        this.registerJson(registry);
        this.registerMarkdown(registry);
    }

    private registerGrammar(
        registry: TextmateRegistry,
        languageId: string,
        scopeName: string,
        grammar: object,
        extensions: string[],
        aliases: string[],
        langConfig?: monaco.languages.LanguageConfiguration
    ): void {
        monaco.languages.register({ id: languageId, extensions, aliases });
        if (langConfig) {
            monaco.languages.setLanguageConfiguration(languageId, langConfig);
        }
        registry.registerTextmateGrammarScope(scopeName, {
            getGrammarDefinition: () => Promise.resolve({ format: 'json' as const, content: grammar })
        });
        registry.mapLanguageIdToTextmateGrammar(languageId, scopeName);
    }

    private registerTypescript(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'typescript', 'source.ts', tsGrammar,
            ['.ts', '.mts', '.cts'],
            ['TypeScript', 'ts'],
            TYPESCRIPT_LANG_CONFIG
        );
    }

    private registerTsx(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'typescriptreact', 'source.tsx', tsxGrammar,
            ['.tsx'],
            ['TSX', 'TypeScript React'],
            TYPESCRIPT_LANG_CONFIG
        );
    }

    private registerJavascript(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'javascript', 'source.js', jsGrammar,
            ['.js', '.mjs', '.cjs'],
            ['JavaScript', 'js'],
            TYPESCRIPT_LANG_CONFIG
        );
    }

    private registerJsx(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'javascriptreact', 'source.jsx', jsxGrammar,
            ['.jsx'],
            ['JSX', 'JavaScript React'],
            TYPESCRIPT_LANG_CONFIG
        );
    }

    private registerHtml(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'html', 'text.html.basic', htmlGrammar,
            ['.html', '.htm', '.shtml', '.xhtml'],
            ['HTML', 'htm'],
            HTML_LANG_CONFIG
        );
    }

    private registerCss(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'css', 'source.css', cssGrammar,
            ['.css'],
            ['CSS'],
            CSS_LANG_CONFIG
        );
    }

    private registerScss(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'scss', 'source.css.scss', scssGrammar,
            ['.scss'],
            ['SCSS'],
            CSS_LANG_CONFIG
        );
    }

    private registerJson(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'json', 'source.json', jsonGrammar,
            ['.json', '.jsonc', '.babelrc', '.eslintrc'],
            ['JSON'],
            JSON_LANG_CONFIG
        );
    }

    private registerMarkdown(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'markdown', 'text.html.markdown', mdGrammar,
            ['.md', '.markdown', '.mdown'],
            ['Markdown', 'md'],
            MARKDOWN_LANG_CONFIG
        );
    }
}

// ── Language configurations ──────────────────────────────────────────────────
// These match VS Code's built-in configs for bracket matching, auto-close, etc.

const TYPESCRIPT_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['${', '}'], ['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string'] },
        { open: '`', close: '`', notIn: ['string', 'comment'] },
        { open: '/**', close: ' */', notIn: ['string'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: "'", close: "'" },
        { open: '"', close: '"' }, { open: '`', close: '`' }
    ],
    indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/,
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[\}\])].*$/
    }
};

const HTML_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { blockComment: ['<!--', '-->'] },
    brackets: [['<!--', '-->'], ['<', '>'], ['{', '}'], ['(', ')']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: "'", close: "'" },
        { open: '"', close: '"' }
    ],
    surroundingPairs: [
        { open: '"', close: '"' }, { open: "'", close: "'" },
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '<', close: '>' }
    ]
};

const CSS_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
        { open: '{', close: '}', notIn: ['string', 'comment'] },
        { open: '[', close: ']', notIn: ['string', 'comment'] },
        { open: '(', close: ')', notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string', 'comment'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }
    ]
};

const JSON_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '//' },
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '"', close: '"', notIn: ['string'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '"', close: '"' }
    ]
};

const MARKDOWN_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    brackets: [['`', '`']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '`', close: '`' }
    ]
};
```

**Step 2: Build and verify no TypeScript errors**

```bash
yarn --cwd extensions/openspace-languages build
```

Expected: exits 0, no errors.

**Step 3: Commit**

```bash
git add extensions/openspace-languages/src/
git commit -m "feat(languages): register TextMate grammars for TS, TSX, JS, JSX, HTML, CSS, SCSS, JSON, Markdown"
```

---

## Task 3: Register systems and scripting languages (Python, C, C++, Rust, Shell, YAML)

**Files:**
- Modify: `extensions/openspace-languages/src/browser/language-grammar-contribution.ts`

**Step 1: Add grammar imports at the top of the file (alongside the existing imports)**

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pythonGrammar = require('tm-grammars/grammars/python.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cGrammar = require('tm-grammars/grammars/c.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cppGrammar = require('tm-grammars/grammars/cpp.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rustGrammar = require('tm-grammars/grammars/rust.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shellGrammar = require('tm-grammars/grammars/shellscript.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yamlGrammar = require('tm-grammars/grammars/yaml.json');
```

**Step 2: Add calls in `registerTextmateLanguage`**

In the `registerTextmateLanguage` method, after the existing calls, add:

```typescript
this.registerPython(registry);
this.registerC(registry);
this.registerCpp(registry);
this.registerRust(registry);
this.registerShell(registry);
this.registerYaml(registry);
```

**Step 3: Add the registration methods (append to class body)**

```typescript
private registerPython(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'python', 'source.python', pythonGrammar,
        ['.py', '.pyw', '.pyi', '.rpy'],
        ['Python', 'py'],
        PYTHON_LANG_CONFIG
    );
}

private registerC(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'c', 'source.c', cGrammar,
        ['.c', '.h'],
        ['C'],
        C_LANG_CONFIG
    );
}

private registerCpp(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'cpp', 'source.cpp', cppGrammar,
        ['.cpp', '.cc', '.cxx', '.c++', '.hpp', '.hh', '.hxx', '.h++', '.inl'],
        ['C++', 'cpp'],
        C_LANG_CONFIG
    );
}

private registerRust(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'rust', 'source.rust', rustGrammar,
        ['.rs'],
        ['Rust', 'rs'],
        RUST_LANG_CONFIG
    );
}

private registerShell(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'shellscript', 'source.shell', shellGrammar,
        ['.sh', '.bash', '.zsh', '.fish', '.command'],
        ['Shell Script', 'bash', 'sh', 'zsh'],
        SHELL_LANG_CONFIG
    );
}

private registerYaml(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'yaml', 'source.yaml', yamlGrammar,
        ['.yml', '.yaml'],
        ['YAML', 'yml'],
        YAML_LANG_CONFIG
    );
}
```

**Step 4: Add language configs (append after the existing config constants)**

```typescript
const PYTHON_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '#', blockComment: ["'''", "'''"] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '`', close: '`' }
    ],
    indentationRules: {
        increaseIndentPattern: /^\s*[\:\(\[\{](\s*(#.*)?)?\s*$/,
        decreaseIndentPattern: /^\s*((\belse:\s*)|((\bexcept|\bfinally|\belse)\b.*:))\s*/
    }
};

const C_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '"', close: '"', notIn: ['string'] },
        { open: '/**', close: ' */', notIn: ['string'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }
    ],
    indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*\{[^}"']*$/,
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*\}.*$/
    }
};

const RUST_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['<', '>']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '/**', close: ' */', notIn: ['string'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '<', close: '>' }
    ],
    indentationRules: {
        increaseIndentPattern: /^((?!\/\/).)*\{[^}"']*$/,
        decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*\}.*$/
    }
};

const SHELL_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '`', close: '`', notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '`', close: '`' }
    ]
};

const YAML_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
    comments: { lineComment: '#' },
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '"', close: '"' }, { open: "'", close: "'" }
    ]
};
```

**Step 5: Build and verify**

```bash
yarn --cwd extensions/openspace-languages build
```

Expected: exits 0.

**Step 6: Commit**

```bash
git add extensions/openspace-languages/src/
git commit -m "feat(languages): add Python, C, C++, Rust, Shell, YAML grammars"
```

---

## Task 4: Register additional popular languages (Go, Java, Ruby, PHP, C#, Swift, Kotlin, SQL, Lua, Dart, TOML, Docker)

**Files:**
- Modify: `extensions/openspace-languages/src/browser/language-grammar-contribution.ts`

**Step 1: Add grammar imports**

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const goGrammar = require('tm-grammars/grammars/go.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const javaGrammar = require('tm-grammars/grammars/java.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rubyGrammar = require('tm-grammars/grammars/ruby.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const phpGrammar = require('tm-grammars/grammars/php.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csharpGrammar = require('tm-grammars/grammars/csharp.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const swiftGrammar = require('tm-grammars/grammars/swift.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const kotlinGrammar = require('tm-grammars/grammars/kotlin.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlGrammar = require('tm-grammars/grammars/sql.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const luaGrammar = require('tm-grammars/grammars/lua.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dartGrammar = require('tm-grammars/grammars/dart.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tomlGrammar = require('tm-grammars/grammars/toml.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dockerGrammar = require('tm-grammars/grammars/docker.json');
```

**Step 2: Add calls in `registerTextmateLanguage`**

```typescript
this.registerGo(registry);
this.registerJava(registry);
this.registerRuby(registry);
this.registerPhp(registry);
this.registerCsharp(registry);
this.registerSwift(registry);
this.registerKotlin(registry);
this.registerSql(registry);
this.registerLua(registry);
this.registerDart(registry);
this.registerToml(registry);
this.registerDocker(registry);
```

**Step 3: Add registration methods**

```typescript
private registerGo(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'go', 'source.go', goGrammar,
        ['.go'], ['Go'], C_LANG_CONFIG); // Go uses same bracket config as C
}

private registerJava(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'java', 'source.java', javaGrammar,
        ['.java'], ['Java'], C_LANG_CONFIG);
}

private registerRuby(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'ruby', 'source.ruby', rubyGrammar,
        ['.rb', '.rbw', '.gemspec', 'Gemfile', 'Rakefile'],
        ['Ruby', 'rb'],
        {
            comments: { lineComment: '#', blockComment: ['=begin', '=end'] },
            brackets: [['{', '}'], ['[', ']'], ['(', ')']],
            autoClosingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '(', close: ')' }, { open: '"', close: '"' },
                { open: "'", close: "'" }
            ],
            surroundingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '(', close: ')' }, { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        }
    );
}

private registerPhp(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'php', 'text.html.php', phpGrammar,
        ['.php', '.php4', '.php5', '.phtml', '.ctp'],
        ['PHP'],
        C_LANG_CONFIG
    );
}

private registerCsharp(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'csharp', 'source.cs', csharpGrammar,
        ['.cs', '.csx'],
        ['C#', 'csharp'],
        C_LANG_CONFIG
    );
}

private registerSwift(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'swift', 'source.swift', swiftGrammar,
        ['.swift'],
        ['Swift'],
        C_LANG_CONFIG
    );
}

private registerKotlin(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'kotlin', 'source.kotlin', kotlinGrammar,
        ['.kt', '.kts'],
        ['Kotlin', 'kt'],
        C_LANG_CONFIG
    );
}

private registerSql(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'sql', 'source.sql', sqlGrammar,
        ['.sql'],
        ['SQL'],
        {
            comments: { lineComment: '--', blockComment: ['/*', '*/'] },
            brackets: [['{', '}'], ['[', ']'], ['(', ')']],
            autoClosingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '(', close: ')' }, { open: '"', close: '"' },
                { open: "'", close: "'" }
            ],
            surroundingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '(', close: ')' }, { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        }
    );
}

private registerLua(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'lua', 'source.lua', luaGrammar,
        ['.lua'],
        ['Lua'],
        {
            comments: { lineComment: '--', blockComment: ['--[[', ']]'] },
            brackets: [['{', '}'], ['[', ']'], ['(', ')']],
            autoClosingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '(', close: ')' }, { open: '"', close: '"' },
                { open: "'", close: "'" }
            ],
            surroundingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '(', close: ')' }, { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        }
    );
}

private registerDart(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'dart', 'source.dart', dartGrammar,
        ['.dart'],
        ['Dart'],
        C_LANG_CONFIG
    );
}

private registerToml(registry: TextmateRegistry): void {
    this.registerGrammar(registry, 'toml', 'source.toml', tomlGrammar,
        ['.toml'],
        ['TOML'],
        {
            comments: { lineComment: '#' },
            brackets: [['{', '}'], ['[', ']']],
            autoClosingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '"', close: '"' }, { open: "'", close: "'" }
            ],
            surroundingPairs: [
                { open: '{', close: '}' }, { open: '[', close: ']' },
                { open: '"', close: '"' }, { open: "'", close: "'" }
            ]
        }
    );
}

private registerDocker(registry: TextmateRegistry): void {
    // Dockerfile has no extension — matched by filename
    monaco.languages.register({
        id: 'dockerfile',
        extensions: ['.dockerfile'],
        filenames: ['Dockerfile'],
        aliases: ['Dockerfile', 'docker']
    });
    registry.registerTextmateGrammarScope('source.dockerfile', {
        getGrammarDefinition: () => Promise.resolve({ format: 'json' as const, content: dockerGrammar })
    });
    registry.mapLanguageIdToTextmateGrammar('dockerfile', 'source.dockerfile');
}
```

**Step 4: Build and verify**

```bash
yarn --cwd extensions/openspace-languages build
```

Expected: exits 0.

**Step 5: Commit**

```bash
git add extensions/openspace-languages/src/
git commit -m "feat(languages): add Go, Java, Ruby, PHP, C#, Swift, Kotlin, SQL, Lua, Dart, TOML, Dockerfile grammars"
```

---

## Task 5: Wire into build system and do a full app build

**Files:**
- No new files — verifies the whole pipeline works end-to-end.

**Step 1: Run the full extensions build**

```bash
yarn build:extensions
```

Expected: all 7 extensions (including `openspace-languages`) build cleanly, exits 0.

**Step 2: Run the full browser app build**

```bash
yarn build:browser
```

This runs `theia build` which: discovers `openspace-languages` via `browser-app/package.json`, generates the webpack config, bundles everything. Expected: exits 0. If there are any webpack errors about `.json` imports, see the Troubleshooting section below.

**Step 3: Commit**

```bash
git commit -m "build: verify full app build with openspace-languages"
```

(This commit will have no file changes — it just marks that the build passed. If there were fixups needed in Step 2, those file changes will be in this commit.)

---

## Task 6: Write unit tests

**Files:**
- Create: `extensions/openspace-languages/src/browser/__tests__/language-grammar-contribution.spec.ts`
- Modify: (possibly) `.mocharc.yml` to pick up the new test file path

**Step 1: Check the mocha config to understand test file discovery**

Read `.mocharc.yml` (or `.mocharc.json` or the `mocha` key in `package.json`) at the root. The spec pattern should already pick up `extensions/*/src/browser/__tests__/**/*.spec.ts`. If it only matches specific extension names, add `openspace-languages`.

**Step 2: Write the test file**

Create `extensions/openspace-languages/src/browser/__tests__/language-grammar-contribution.spec.ts`:

```typescript
import { expect } from 'chai';
import { LanguageGrammarContribution } from '../language-grammar-contribution';

// Minimal TextmateRegistry mock — we just want to verify registrations happen
interface ScopeEntry {
    scopeName: string;
    grammar: object;
}

interface LangEntry {
    languageId: string;
    scopeName: string;
}

function makeMockRegistry(): {
    scopes: ScopeEntry[];
    langs: LangEntry[];
    registerTextmateGrammarScope: (scopeName: string, provider: { getGrammarDefinition: () => Promise<{ format: string; content: object }> }) => void;
    mapLanguageIdToTextmateGrammar: (languageId: string, scopeName: string) => void;
} {
    const scopes: ScopeEntry[] = [];
    const langs: LangEntry[] = [];
    return {
        scopes,
        langs,
        registerTextmateGrammarScope(scopeName, provider) {
            // Resolve the grammar to verify it's a non-empty object
            provider.getGrammarDefinition().then(def => {
                scopes.push({ scopeName, grammar: def.content as object });
            });
        },
        mapLanguageIdToTextmateGrammar(languageId, scopeName) {
            langs.push({ languageId, scopeName });
        }
    };
}

// Minimal Monaco mock — languages.register and setLanguageConfiguration are side effects we don't need to verify deeply
const registeredLanguages: string[] = [];
jest_mock: {
    // We stub monaco at module level via the require cache trick used by the test infra
    // If this doesn't work in mocha, use sinon.stub on the module export instead.
}

describe('LanguageGrammarContribution', () => {
    let contribution: LanguageGrammarContribution;
    let registry: ReturnType<typeof makeMockRegistry>;

    beforeEach(() => {
        contribution = new LanguageGrammarContribution();
        registry = makeMockRegistry();
    });

    it('should register TypeScript grammar', () => {
        contribution.registerTextmateLanguage(registry as never);
        const entry = registry.langs.find(l => l.languageId === 'typescript');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.ts');
    });

    it('should register TSX grammar', () => {
        contribution.registerTextmateLanguage(registry as never);
        const entry = registry.langs.find(l => l.languageId === 'typescriptreact');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.tsx');
    });

    it('should register Python grammar', () => {
        contribution.registerTextmateLanguage(registry as never);
        const entry = registry.langs.find(l => l.languageId === 'python');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.python');
    });

    it('should register C++ grammar', () => {
        contribution.registerTextmateLanguage(registry as never);
        const entry = registry.langs.find(l => l.languageId === 'cpp');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.cpp');
    });

    it('should register Rust grammar', () => {
        contribution.registerTextmateLanguage(registry as never);
        const entry = registry.langs.find(l => l.languageId === 'rust');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.rust');
    });

    it('should register Markdown grammar', () => {
        contribution.registerTextmateLanguage(registry as never);
        const entry = registry.langs.find(l => l.languageId === 'markdown');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('text.html.markdown');
    });

    it('should register at least 20 languages', () => {
        contribution.registerTextmateLanguage(registry as never);
        expect(registry.langs.length).to.be.greaterThanOrEqual(20);
    });

    it('should register unique language IDs (no duplicates)', () => {
        contribution.registerTextmateLanguage(registry as never);
        const ids = registry.langs.map(l => l.languageId);
        const unique = new Set(ids);
        expect(ids.length).to.equal(unique.size);
    });

    it('should register unique scope names (no duplicates)', () => {
        contribution.registerTextmateLanguage(registry as never);
        const scopes = registry.langs.map(l => l.scopeName);
        const unique = new Set(scopes);
        expect(scopes.length).to.equal(unique.size);
    });
});
```

> **Note on Monaco mock:** `LanguageGrammarContribution` calls `monaco.languages.register()` and `monaco.languages.setLanguageConfiguration()` as side effects. In unit tests, these will throw because Monaco requires a DOM. Two options:
> 1. Mock the `@theia/monaco-editor-core` module (preferred — see how other tests in this project handle it in `extensions/openspace-core/src/browser/__tests__/`)
> 2. Wrap `monaco.languages.*` calls in a try/catch within the contribution for environments where Monaco isn't available
>
> Check `extensions/openspace-core/src/browser/__tests__/` for the existing mock/stub pattern used by this project before deciding which approach to use.

**Step 3: Run the tests**

```bash
yarn test:unit 2>&1 | grep -A5 "LanguageGrammarContribution"
```

Expected: all tests in the `LanguageGrammarContribution` suite pass.

**Step 4: Commit**

```bash
git add extensions/openspace-languages/src/browser/__tests__/
git commit -m "test(languages): add unit tests for LanguageGrammarContribution"
```

---

## Task 7: Update WORKPLAN and push branch

**Files:**
- Modify: `docs/architecture/WORKPLAN.md`

**Step 1: Add the new phase to WORKPLAN**

Add a new completed phase entry in the Overall Progress table and a phase section. Add it in the appropriate position (after Phase 4-Validation, before Phase T4, or as a standalone "Phase EW: Editor Windows" block). Mark status as `✅ COMPLETE`.

**Step 2: Push the branch**

```bash
git push -u origin feature/editor-windows
```

---

## Troubleshooting

### Webpack can't process `.json` imports from `tm-grammars`

The `gen-webpack.config.js` already has `.plist` asset rules. If webpack complains about JSON grammar files being too large or needing a special loader, add a rule to `browser-app/webpack.config.js`:

```javascript
config.module.rules.push({
    test: /tm-grammars\/grammars\/.*\.json$/,
    type: 'javascript/auto',
    use: [{ loader: 'json-loader' }]
});
```

Or simply ensure `type: 'javascript/auto'` without a special loader — webpack 5 handles JSON natively.

### `LanguageGrammarDefinitionContribution` symbol not found

The import path is:
```typescript
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
```

If it resolves to the wrong type symbol at runtime, add a peer DI binding check: verify that `MonacoTextmateService` from `@theia/monaco` is also loaded (it is, as long as `@theia/monaco` is in `browser-app/package.json` — which it already is).

### Grammar not activating for a file type

Monaco maps file extensions to language IDs via `monaco.languages.register({ extensions })`. If a file opens without color, check:
1. The extension list in the `registerGrammar` call includes the file's extension
2. The `mapLanguageIdToTextmateGrammar` call uses the exact same `languageId` string as the `monaco.languages.register` call
3. Reload the browser after a full `yarn build:browser`

### TypeScript error: `Object literal may only specify known properties`

The `format` field in `getGrammarDefinition` must be typed as `'json' as const`, not just `'json'`. The return type is `{ format: 'json' | 'plist', content: ... }`.

---

## Definition of Done

- [ ] `yarn build:verbose` exits 0 (all extensions + browser app)
- [ ] All unit tests in `LanguageGrammarContribution` suite pass
- [ ] Opening a `.ts` file in the running app shows TypeScript syntax highlighting
- [ ] Opening a `.py` file shows Python syntax highlighting
- [ ] Opening a `.cpp` file shows C++ syntax highlighting
- [ ] Opening a `.md` file shows Markdown syntax highlighting with code fence highlighting
- [ ] Comment toggle (`Ctrl+/`) works for all registered languages
- [ ] Bracket matching works for `{}`, `[]`, `()` in all registered languages
- [ ] No console errors about missing grammar scopes or language IDs
