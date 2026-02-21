/**
 * Markdown renderer for chat messages.
 *
 * Uses markdown-it (already a project dependency via @theia/core/shared/markdown-it)
 * with highlight.js for syntax highlighting, and DOMPurify for sanitization.
 *
 * Extended features:
 * - Mermaid diagrams (```mermaid blocks → MermaidBlock React component)
 * - ANSI terminal color blocks (```ansi blocks → AnsiBlock React component)
 * - Improved diff highlighting (CSS-driven, see chat-widget.css)
 * - Emoji shortcodes (:smile: → emoji via markdown-it-emoji)
 * - Inline math ($...$, $$...$$) via markdown-it-texmath + KaTeX
 */

import * as React from '@theia/core/shared/react';

// Re-exported from @theia/core — no additional dependency needed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MarkdownIt = require('@theia/core/shared/markdown-it');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('@theia/core/shared/dompurify');

// markdown-it-emoji — already in node_modules (hoisted from @theia/core)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const markdownItEmoji = require('markdown-it-emoji');

// markdown-it-texmath + KaTeX for math rendering
// eslint-disable-next-line @typescript-eslint/no-var-requires
const texmath = require('markdown-it-texmath');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const katex = require('katex');

// KaTeX CSS — needed for math rendering
import 'katex/dist/katex.min.css';

// Mermaid — for diagram rendering
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mermaid = require('mermaid');

// Anser — for ANSI terminal color rendering
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Anser = require('anser');

// highlight.js — transitive dep via @theia/preview
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hljs: HLJSApi = require('highlight.js/lib/core');

interface HLJSApi {
    highlight(languageName: string, code: string, ignoreIllegals?: boolean): { value: string };
    highlightAuto(code: string): { value: string };
    registerLanguage(languageName: string, language: unknown): void;
    getLanguage(languageName: string): unknown | undefined;
    registerAliases(aliasList: string | string[], opts: { languageName: string }): void;
}

const LANGUAGES: Array<[string, string[]]> = [
    ['typescript', ['ts']],
    ['javascript', ['js', 'jsx', 'tsx']],
    ['python', ['py']],
    ['bash', ['sh', 'shell', 'zsh']],
    ['json', []],
    ['xml', ['html', 'htm', 'svg', 'xhtml']],
    ['css', []],
    ['go', ['golang']],
    ['rust', ['rs']],
    ['java', []],
    ['c', ['h']],
    ['cpp', ['cc', 'cxx', 'c++', 'hpp']],
    ['sql', []],
    ['yaml', ['yml']],
    ['markdown', ['md']],
    ['diff', ['patch']],
];

let _registered = false;
function ensureLanguagesRegistered(): void {
    if (_registered) { return; }
    _registered = true;
    for (const [name, aliases] of LANGUAGES) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const langDef = require(`highlight.js/lib/languages/${name}`);
            hljs.registerLanguage(name, langDef);
            if (aliases.length > 0) {
                hljs.registerAliases(aliases, { languageName: name });
            }
        } catch { /* language not available — skip */ }
    }
}

function highlightCode(code: string, lang: string): string {
    ensureLanguagesRegistered();
    if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(lang, code, true).value; } catch { /* fall through */ }
    }
    try { return hljs.highlightAuto(code).value; } catch { /* fall through */ }
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Mermaid initialization ───────────────────────────────────────────────────

function getMermaidTheme(): string {
    return document.body.classList.contains('theia-light') ? 'neutral' : 'dark';
}

let _mermaidInitialized = false;
function ensureMermaidInitialized(): void {
    if (_mermaidInitialized) { return; }
    _mermaidInitialized = true;
    mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme() });
}

// ─── markdown-it instance ────────────────────────────────────────────────────

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Plugin: emoji shortcodes (:smile: → 😄)
md.use(markdownItEmoji.full);

// Plugin: math via KaTeX ($...$ and $$...$$)
// texmath renders math to HTML directly — we emit it as an oc-math sentinel
// so we can pass it through DOMPurify with KaTeX's required tags.
md.use(texmath, { engine: katex, delimiters: 'dollars' });

// Override the fenced code block renderer to emit typed sentinel elements.
// Supported sentinel types:
//   - <oc-mermaid data-code="...base64..."></oc-mermaid>  → MermaidBlock
//   - <oc-ansi data-code="...base64..."></oc-ansi>        → AnsiBlock
//   - <oc-code lang="..." data-code="...base64..."></oc-code>  → CodeBlock
md.renderer.rules.fence = (tokens: any[], idx: number) => {
    const token = tokens[idx];
    const lang = token.info.trim().split(/\s+/)[0] || '';
    const encoded = btoa(unescape(encodeURIComponent(token.content)));

    if (lang === 'mermaid') {
        return `<oc-mermaid data-code="${encoded}"></oc-mermaid>`;
    }
    if (lang === 'ansi') {
        return `<oc-ansi data-code="${encoded}"></oc-ansi>`;
    }
    return `<oc-code lang="${lang}" data-code="${encoded}"></oc-code>`;
};

// ─── MermaidBlock React component ────────────────────────────────────────────

/**
 * Renders a Mermaid diagram from source text.
 * Detects Theia's active color theme and re-renders when it changes.
 */
const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        ensureMermaidInitialized();

        let cancelled = false;
        const container = containerRef.current;
        if (!container) { return; }

        const renderDiagram = async () => {
            if (cancelled || !containerRef.current) { return; }
            try {
                // Re-initialize with current theme before each render
                mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme() });
                // Generate unique ID required by mermaid API
                const id = `mermaid-${Math.random().toString(36).slice(2)}`;
                const { svg } = await mermaid.render(id, code);
                if (!cancelled && containerRef.current) {
                    containerRef.current.innerHTML = svg;
                    setError(null);
                }
            } catch (e: unknown) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            }
        };

        renderDiagram();

        // Watch for Theia theme changes (adds/removes theia-light class on body)
        const observer = new MutationObserver(() => {
            renderDiagram();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        return () => {
            cancelled = true;
            observer.disconnect();
        };
    }, [code]);

    if (error) {
        return (
            <div className="md-code-block">
                <div className="md-code-header">
                    <span className="md-code-lang">mermaid</span>
                </div>
                <pre className="md-code-body md-mermaid-error">
                    <code>{error}</code>
                </pre>
            </div>
        );
    }

    return (
        <div className="md-mermaid-container">
            <div ref={containerRef} className="md-mermaid-diagram" />
        </div>
    );
};

// ─── AnsiBlock React component ────────────────────────────────────────────────

/**
 * Renders an ANSI terminal color block.
 * Converts ANSI escape sequences to HTML using `anser` with CSS class output.
 */
const AnsiBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = React.useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    // anser converts ANSI codes to <span class="ansi-red"> etc.
    const html = Anser.ansiToHtml(Anser.escapeForHtml(code), { use_classes: true });
    return (
        <div className="md-code-block">
            <div className="md-code-header">
                <span className="md-code-lang">terminal</span>
                <button type="button" className="md-code-copy oc-icon-btn" onClick={copy} title="Copy">
                    {copied ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    )}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="md-code-body md-ansi-body">
                <code className="ansi-output" dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
        </div>
    );
};

// ─── CodeBlock React component ───────────────────────────────────────────────

/** Syntax-highlighted fenced code block with language label and copy button. */
const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
    const [copied, setCopied] = React.useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    const highlighted = highlightCode(code, lang);
    return (
        <div className="md-code-block">
            <div className="md-code-header">
                <span className="md-code-lang">{lang || 'code'}</span>
                <button type="button" className="md-code-copy oc-icon-btn" onClick={copy} title="Copy">
                    {copied ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    )}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="md-code-body">
                <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
        </div>
    );
};

// ─── KaTeX DOMPurify allowed tags ────────────────────────────────────────────
// KaTeX renders math to HTML with many custom elements that DOMPurify would strip.
// We allow the minimal set needed for KaTeX output.
const KATEX_TAGS = [
    'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup', 'mfrac',
    'msqrt', 'mroot', 'mtext', 'mspace', 'mtable', 'mtr', 'mtd', 'mover',
    'munder', 'munderover', 'annotation', 'semantics', 'svg', 'path', 'defs',
    'use', 'g', 'rect', 'line', 'circle', 'polygon', 'marker', 'span',
];
const KATEX_ATTRS = [
    'xmlns', 'class', 'style', 'display', 'mathvariant', 'columnalign',
    'rowspan', 'colspan', 'd', 'fill', 'stroke', 'stroke-width',
    'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'r', 'cx', 'cy', 'points', 'id', 'href', 'transform',
    'aria-hidden', 'focusable', 'preserveAspectRatio', 'overflow',
];

// ─── renderMarkdown ───────────────────────────────────────────────────────────

/**
 * Render a markdown string to an array of React nodes.
 *
 * Strategy:
 * 1. Run markdown-it to produce HTML (with fenced code blocks and other
 *    special blocks replaced by sentinel elements).
 * 2. Sanitize with DOMPurify (ADD_TAGS for sentinels + KaTeX tags).
 * 3. Split the HTML on sentinels and interleave:
 *    - Plain HTML segments → rendered via dangerouslySetInnerHTML in a <div>
 *    - Code sentinels → <CodeBlock> React components
 *    - Mermaid sentinels → <MermaidBlock> React components
 *    - ANSI sentinels → <AnsiBlock> React components
 */
export function renderMarkdown(text: string): React.ReactNode[] {
    if (!text) { return []; }

    // Step 1: render to HTML with sentinel elements for special blocks
    const rawHtml = md.render(text);

    // Step 2: sanitize — allow our sentinels and KaTeX output through
    const sanitized = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['oc-code', 'oc-mermaid', 'oc-ansi', ...KATEX_TAGS],
        ADD_ATTR: ['lang', 'data-code', ...KATEX_ATTRS],
        ALLOW_UNKNOWN_PROTOCOLS: true,
    });

    // Step 3: split on sentinel elements and interleave React components
    // Matches: <oc-code lang="..." data-code="..."></oc-code>
    //          <oc-mermaid data-code="..."></oc-mermaid>
    //          <oc-ansi data-code="..."></oc-ansi>
    const sentinelRe = /<(oc-code|oc-mermaid|oc-ansi)([^>]*)><\/\1>/g;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    function decodeBase64(encoded: string): string {
        try { return decodeURIComponent(escape(atob(encoded))); } catch { return encoded; }
    }

    function extractAttr(attrs: string, name: string): string {
        const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
        return m ? m[1] : '';
    }

    while ((match = sentinelRe.exec(sanitized)) !== null) {
        // HTML before the sentinel
        const htmlBefore = sanitized.slice(last, match.index).trim();
        if (htmlBefore) {
            nodes.push(
                <div key={key++} className="md-body"
                    dangerouslySetInnerHTML={{ __html: htmlBefore }} />
            );
        }

        const tag = match[1];
        const attrs = match[2];
        const encodedCode = extractAttr(attrs, 'data-code');
        const code = decodeBase64(encodedCode).trimEnd();

        if (tag === 'oc-mermaid') {
            nodes.push(<MermaidBlock key={key++} code={code} />);
        } else if (tag === 'oc-ansi') {
            nodes.push(<AnsiBlock key={key++} code={code} />);
        } else {
            // oc-code
            const lang = extractAttr(attrs, 'lang');
            nodes.push(<CodeBlock key={key++} lang={lang} code={code} />);
        }

        last = match.index + match[0].length;
    }

    // Remaining HTML after last sentinel
    const htmlAfter = sanitized.slice(last).trim();
    if (htmlAfter) {
        nodes.push(
            <div key={key++} className="md-body"
                dangerouslySetInnerHTML={{ __html: htmlAfter }} />
        );
    }

    return nodes;
}
