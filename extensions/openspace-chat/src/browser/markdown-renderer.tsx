/**
 * Markdown renderer for chat messages.
 *
 * Uses markdown-it (already a project dependency via @theia/core/shared/markdown-it)
 * with highlight.js for syntax highlighting, and DOMPurify for sanitization.
 *
 * This replaces a hand-rolled line-by-line parser with an established, well-tested
 * library that correctly handles: tables, links, blockquotes, nested lists, images,
 * strikethrough, inline HTML, and all other CommonMark + GFM constructs.
 */

import * as React from '@theia/core/shared/react';
// Re-exported from @theia/core — no additional dependency needed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MarkdownIt = require('@theia/core/shared/markdown-it');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('@theia/core/shared/dompurify');

// highlight.js — transitive dep via @theia/preview; declared implicitly.
// We load it exactly as markdown-renderer did before: lazy language registration.
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

// ─── markdown-it instance ────────────────────────────────────────────────────
// Configured once at module load. html:false keeps us safe; linkify:true turns
// bare URLs into links; typographer:true gives smart quotes and dashes.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Override the fenced code block renderer so we can inject our CodeBlock React
// component. We use a placeholder sentinel that renderMarkdown() later replaces
// with actual React nodes — this lets us keep the copy-button UX.
//
// Approach: render fences as a special <oc-code-block> HTML element with the
// language and base64-encoded content as attributes, then in renderMarkdown()
// we post-process the HTML to extract these and render proper React nodes.
//
// Simpler alternative (used here): don't use React for code blocks at all —
// render them as plain HTML with an inline data attribute, then attach a click
// handler via event delegation in the container div.
//
// Actually: we keep the CodeBlock React component by splitting the rendering.
// renderMarkdown() extracts fenced code segments first (pre-parse), renders
// them as <CodeBlock> React nodes, and lets markdown-it handle everything else.
// Replace fence rendering with a sentinel so non-code HTML is rendered by
// markdown-it normally, and code blocks get our React <CodeBlock> component.
// See renderMarkdown() for the full split-and-merge logic.
md.renderer.rules.fence = (tokens: any[], idx: number) => {
    const token = tokens[idx];
    const lang = token.info.trim().split(/\s+/)[0] || '';
    // Encode content as base64 to survive HTML attribute quoting
    const encoded = btoa(unescape(encodeURIComponent(token.content)));
    return `<oc-code lang="${lang}" data-code="${encoded}"></oc-code>`;
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

// ─── renderMarkdown ───────────────────────────────────────────────────────────

/**
 * Render a markdown string to an array of React nodes.
 *
 * Strategy:
 * 1. Run markdown-it to produce HTML (with fenced code blocks replaced by
 *    <oc-code> sentinel elements).
 * 2. Sanitize with DOMPurify (ADD_TAGS for our sentinel).
 * 3. Split the HTML on <oc-code> sentinels and interleave:
 *    - Plain HTML segments → rendered via dangerouslySetInnerHTML in a <div>
 *    - Code sentinels → rendered as <CodeBlock> React components
 *
 * This gives us full CommonMark + GFM rendering (tables, links, blockquotes,
 * nested lists, strikethrough, etc.) while keeping the interactive copy-button
 * code block UX.
 */
export function renderMarkdown(text: string): React.ReactNode[] {
    if (!text) { return []; }

    // Step 1: render to HTML with sentinel code blocks
    const rawHtml = md.render(text);

    // Step 2: sanitize — allow our sentinel tag through
    const sanitized = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['oc-code'],
        ADD_ATTR: ['lang', 'data-code'],
        ALLOW_UNKNOWN_PROTOCOLS: true,
    });

    // Step 3: split on <oc-code ...></oc-code> sentinels
    const sentinelRe = /<oc-code lang="([^"]*)" data-code="([^"]*)"[^>]*><\/oc-code>/g;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = sentinelRe.exec(sanitized)) !== null) {
        // HTML before the sentinel
        const htmlBefore = sanitized.slice(last, match.index).trim();
        if (htmlBefore) {
            nodes.push(
                <div key={key++} className="md-body"
                    dangerouslySetInnerHTML={{ __html: htmlBefore }} />
            );
        }
        // Decode the code content from base64
        const lang = match[1];
        let code = '';
        try {
            code = decodeURIComponent(escape(atob(match[2])));
        } catch {
            code = match[2];
        }
        nodes.push(<CodeBlock key={key++} lang={lang} code={code.trimEnd()} />);
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
