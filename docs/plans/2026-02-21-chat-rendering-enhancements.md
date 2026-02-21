# Chat Rendering Enhancements — Design Doc

**Date:** 2026-02-21  
**Status:** Implemented

## Summary

Adds five rich rendering features to the OpenSpace chat window, all built on established libraries with minimal new dependencies.

## Features

### 1. Mermaid Diagrams

Fenced code blocks tagged ` ```mermaid ` are rendered as SVG diagrams using the `mermaid` library (already installed at 11.12.3 as a transitive dependency). The `MermaidBlock` React component:

- Calls `mermaid.render()` inside a `useEffect` to avoid blocking the main thread
- Detects Theia's active color theme by reading `document.body.classList` (`theia-light` → `'neutral'` theme, `theia-dark` → `'dark'` theme)
- Watches for theme changes via `MutationObserver` on `document.body` and re-renders on change
- Shows a syntax error message in the code-block shell if parsing fails

### 2. ANSI Terminal Colors

Fenced code blocks tagged ` ```ansi ` are rendered with terminal color support using the `anser` library (already installed at 2.3.5 as a transitive dependency of `@theia/console`). The `AnsiBlock` component uses `anser.ansiToHtml()` with `use_classes: true` so colors are CSS class–driven (`.ansi-red`, `.ansi-bright-green`, etc.).

ANSI color classes are defined in `chat-widget.css`. The 16-color palette matches xterm-256 standard values.

### 3. Improved Diff Highlighting

`highlight.js` already emits `.hljs-addition` (green text) and `.hljs-deletion` (red text) for diff blocks. This enhancement adds subtle background colors to those classes in `chat-widget.css` — green tint for additions, red tint for deletions — making diff blocks visually scannable.

### 4. Emoji Shortcodes

The `markdown-it-emoji` plugin (already in `node_modules`, hoisted from `@theia/core`) is added to the markdown-it instance via `md.use(markdownItEmoji.full)`. This renders `:smile:` → 😄 and similar shortcodes inline. No React component needed — markdown-it handles it natively.

### 5. Inline Math (KaTeX)

The `markdown-it-texmath` plugin (v1.0.0, newly added) processes `$...$` inline math and `$$...$$` block math using KaTeX (already installed at 0.16.28 as a transitive dependency of mermaid). KaTeX renders to HTML which is then passed through DOMPurify with an expanded allowlist of KaTeX-required tags and attributes. KaTeX's stylesheet is imported via `import 'katex/dist/katex.min.css'` which webpack handles automatically.

## Architecture

The sentinel pattern already established in `markdown-renderer.tsx` is extended:

```
markdown-it render
  ↓
  fence rule override:
    mermaid → <oc-mermaid data-code="...base64..."></oc-mermaid>
    ansi    → <oc-ansi   data-code="...base64..."></oc-ansi>
    other   → <oc-code lang="..." data-code="...base64..."></oc-code>
  ↓
DOMPurify sanitize (ADD_TAGS: oc-mermaid, oc-ansi, oc-code, KaTeX tags)
  ↓
renderMarkdown() split-merge loop:
  oc-mermaid → <MermaidBlock code={...} />
  oc-ansi    → <AnsiBlock    code={...} />
  oc-code    → <CodeBlock    lang={...} code={...} />
  plain HTML → <div className="md-body" dangerouslySetInnerHTML={...} />
```

## Dependencies Added

| Package | Version | Status |
|---------|---------|--------|
| `mermaid` | ^11.4.1 | Was hoisted; now declared in `openspace-chat/package.json` |
| `anser` | ^2.3.5 | Was hoisted; now declared in `openspace-chat/package.json` |
| `markdown-it-texmath` | ^1.0.0 | New — manually extracted to `node_modules/` |
| `markdown-it-emoji` | — | Already hoisted from `@theia/core`; no declaration needed |
| `katex` | — | Already hoisted from mermaid; no declaration needed |

## Files Modified

- `extensions/openspace-chat/src/browser/markdown-renderer.tsx` — main renderer
- `extensions/openspace-chat/src/browser/style/chat-widget.css` — mermaid, ANSI, diff, KaTeX CSS
- `extensions/openspace-chat/package.json` — added mermaid, anser, markdown-it-texmath deps
