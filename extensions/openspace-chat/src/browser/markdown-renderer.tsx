/**
 * Lightweight inline markdown renderer — no external dependencies.
 * Handles: fenced code blocks, headers (h1–h3), bold, italic, inline code, lists.
 */

import * as React from '@theia/core/shared/react';

/** Render a fenced code block with language label and copy button. */
const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
    const [copied, setCopied] = React.useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <div className="md-code-block">
            <div className="md-code-header">
                <span className="md-code-lang">{lang || 'code'}</span>
                <button type="button" className="md-code-copy oc-icon-btn" onClick={copy} title="Copy">
                    {copied ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    )}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="md-code-body"><code>{code}</code></pre>
        </div>
    );
};

/** Apply inline formatting: **bold**, *italic*, `code`. Returns React nodes. */
function applyInlineFormatting(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) {
            parts.push(text.slice(last, match.index));
        }
        if (match[2]) {
            parts.push(<strong key={key++}>{match[2]}</strong>);
        } else if (match[3]) {
            parts.push(<em key={key++}>{match[3]}</em>);
        } else if (match[4]) {
            parts.push(<code className="md-inline-code" key={key++}>{match[4]}</code>);
        }
        last = match.index + match[0].length;
    }
    if (last < text.length) { parts.push(text.slice(last)); }
    return parts;
}

/**
 * Render markdown text to React nodes.
 * Processes fenced code blocks first, then line-by-line for headings/lists/paragraphs.
 */
export function renderMarkdown(text: string): React.ReactNode[] {
    if (!text) return [];
    const nodes: React.ReactNode[] = [];
    const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
    let last = 0;
    let blockKey = 0;
    let match: RegExpExecArray | null;
    while ((match = fenceRe.exec(text)) !== null) {
        const before = text.slice(last, match.index);
        if (before) { nodes.push(...renderLines(before, blockKey)); blockKey += 100; }
        nodes.push(<CodeBlock key={`cb-${blockKey++}`} lang={match[1]} code={match[2].trimEnd()} />);
        last = match.index + match[0].length;
    }
    const remaining = text.slice(last);
    if (remaining) { nodes.push(...renderLines(remaining, blockKey)); }
    return nodes;
}

/** Render a block of non-code text line by line. */
function renderLines(text: string, keyOffset: number): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const lines = text.split('\n');
    let i = 0;
    let paraLines: string[] = [];
    let key = keyOffset;

    const flushPara = () => {
        const content = paraLines.join('\n').trim();
        if (content) {
            nodes.push(<p className="md-para" key={key++}>{applyInlineFormatting(content)}</p>);
        }
        paraLines = [];
    };

    while (i < lines.length) {
        const line = lines[i];
        const hMatch = line.match(/^(#{1,3})\s+(.*)/);
        if (hMatch) {
            flushPara();
            const level = hMatch[1].length as 1 | 2 | 3;
            const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
            nodes.push(<Tag className={`md-h${level}`} key={key++}>{applyInlineFormatting(hMatch[2])}</Tag>);
            i++; continue;
        }
        if (/^[-*]\s/.test(line)) {
            flushPara();
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^[-*]\s/.test(lines[i])) {
                items.push(<li key={i}>{applyInlineFormatting(lines[i].slice(2))}</li>);
                i++;
            }
            nodes.push(<ul className="md-ul" key={key++}>{items}</ul>);
            continue;
        }
        if (/^\d+\.\s/.test(line)) {
            flushPara();
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                items.push(<li key={i}>{applyInlineFormatting(lines[i].replace(/^\d+\.\s/, ''))}</li>);
                i++;
            }
            nodes.push(<ol className="md-ol" key={key++}>{items}</ol>);
            continue;
        }
        if (line.trim() === '') {
            flushPara();
            i++; continue;
        }
        paraLines.push(line);
        i++;
    }
    flushPara();
    return nodes;
}
