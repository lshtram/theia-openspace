import { injectable } from '@theia/core/shared/inversify';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { TextmateRegistry } from '@theia/monaco/lib/browser/textmate/textmate-registry';
import * as monaco from '@theia/monaco-editor-core';

import tsGrammar from 'tm-grammars/grammars/typescript.json';
import tsxGrammar from 'tm-grammars/grammars/tsx.json';
import jsGrammar from 'tm-grammars/grammars/javascript.json';
import jsxGrammar from 'tm-grammars/grammars/jsx.json';
import htmlGrammar from 'tm-grammars/grammars/html.json';
import cssGrammar from 'tm-grammars/grammars/css.json';
import scssGrammar from 'tm-grammars/grammars/scss.json';
import jsonGrammar from 'tm-grammars/grammars/json.json';
import mdGrammar from 'tm-grammars/grammars/markdown.json';
import pythonGrammar from 'tm-grammars/grammars/python.json';
import cGrammar from 'tm-grammars/grammars/c.json';
import cppGrammar from 'tm-grammars/grammars/cpp.json';
import rustGrammar from 'tm-grammars/grammars/rust.json';
import shellGrammar from 'tm-grammars/grammars/shellscript.json';
import yamlGrammar from 'tm-grammars/grammars/yaml.json';
import goGrammar from 'tm-grammars/grammars/go.json';
import javaGrammar from 'tm-grammars/grammars/java.json';
import rubyGrammar from 'tm-grammars/grammars/ruby.json';
import phpGrammar from 'tm-grammars/grammars/php.json';
import csharpGrammar from 'tm-grammars/grammars/csharp.json';
import swiftGrammar from 'tm-grammars/grammars/swift.json';
import kotlinGrammar from 'tm-grammars/grammars/kotlin.json';
import sqlGrammar from 'tm-grammars/grammars/sql.json';
import luaGrammar from 'tm-grammars/grammars/lua.json';
import dartGrammar from 'tm-grammars/grammars/dart.json';
import tomlGrammar from 'tm-grammars/grammars/toml.json';
import dockerGrammar from 'tm-grammars/grammars/docker.json';

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
        this.registerPython(registry);
        this.registerC(registry);
        this.registerCpp(registry);
        this.registerRust(registry);
        this.registerShell(registry);
        this.registerYaml(registry);
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
            TS_JS_LANG_CONFIG
        );
    }

    private registerTsx(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'typescriptreact', 'source.tsx', tsxGrammar,
            ['.tsx'],
            ['TSX', 'TypeScript React'],
            TS_JS_LANG_CONFIG
        );
    }

    private registerJavascript(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'javascript', 'source.js', jsGrammar,
            ['.js', '.mjs', '.cjs'],
            ['JavaScript', 'js'],
            TS_JS_LANG_CONFIG
        );
    }

    private registerJsx(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'javascriptreact', 'source.js.jsx', jsxGrammar,
            ['.jsx'],
            ['JSX', 'JavaScript React'],
            TS_JS_LANG_CONFIG
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

    private registerGo(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'go', 'source.go', goGrammar,
            ['.go'], ['Go'], C_LANG_CONFIG);
    }

    private registerJava(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'java', 'source.java', javaGrammar,
            ['.java'], ['Java'], C_LANG_CONFIG);
    }

    private registerRuby(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'ruby', 'source.ruby', rubyGrammar,
            ['.rb', '.rbw', '.gemspec'],
            ['Ruby', 'rb'],
            RUBY_LANG_CONFIG
        );
    }

    private registerPhp(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'php', 'source.php', phpGrammar,
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
            SQL_LANG_CONFIG
        );
    }

    private registerLua(registry: TextmateRegistry): void {
        this.registerGrammar(registry, 'lua', 'source.lua', luaGrammar,
            ['.lua'],
            ['Lua'],
            LUA_LANG_CONFIG
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
            TOML_LANG_CONFIG
        );
    }

    private registerDocker(registry: TextmateRegistry): void {
        monaco.languages.register({
            id: 'dockerfile',
            extensions: ['.dockerfile'],
            filenames: ['Dockerfile'],
            aliases: ['Dockerfile', 'docker']
        });
        registry.registerTextmateGrammarScope('source.dockerfile', {
            getGrammarDefinition: () => Promise.resolve({ format: 'json' as const, content: dockerGrammar as object })
        });
        registry.mapLanguageIdToTextmateGrammar('dockerfile', 'source.dockerfile');
    }
}

// ── Language configurations ──────────────────────────────────────────────────
// These match VS Code's built-in configs for bracket matching, auto-close, etc.

const TS_JS_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
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

const RUBY_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
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
};

const SQL_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
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
};

const LUA_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
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
};

const TOML_LANG_CONFIG: monaco.languages.LanguageConfiguration = {
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
};
