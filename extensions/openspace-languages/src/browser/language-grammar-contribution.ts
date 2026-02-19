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
