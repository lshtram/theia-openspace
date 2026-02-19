# Markdown Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an `openspace-viewers` Theia extension that opens `.md` files in a rendered preview by default, with a tab-bar toggle to switch between a Markdown preview (with Mermaid diagram support) and a full embedded Monaco editor — in-place, no new tab.

**Architecture:** A new `openspace-viewers` extension follows the exact `openspace-presentation` pattern: a `MarkdownViewerWidget extends ReactWidget` renders content, a `MarkdownViewerOpenHandler` intercepts `.md`/`.markdown`/`.mdown` files at priority 200 (beating Monaco's default 100, while `.deck.md` files are still handled first by `PresentationOpenHandler` due to its more specific suffix check). The widget manages a `mode: 'preview' | 'edit'` React state; in preview mode it renders `markdown-it` HTML with Mermaid diagrams; in edit mode it mounts a `<div>` that hosts a live `MonacoEditor` instance (created via `MonacoEditorServices`). A `TabBarToolbarContribution` wires the toggle button.

**Tech Stack:** TypeScript, React (`@theia/core/shared/react`), `markdown-it`, `mermaid`, `dompurify`, `@theia/monaco` (for embedded editor), `@theia/core` `TabBarToolbarContribution`, `@theia/filesystem` `FileService`

---

## Reference Files (read before implementing)

| Purpose | Path |
|---|---|
| Widget pattern | `extensions/openspace-presentation/src/browser/presentation-widget.tsx` |
| Open handler pattern | `extensions/openspace-presentation/src/browser/presentation-open-handler.ts` |
| DI module pattern | `extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts` |
| Test patterns | `extensions/openspace-presentation/src/browser/__tests__/` |
| CSS pattern | `extensions/openspace-presentation/src/browser/style/presentation-widget.css` |
| TabBarToolbar API | `node_modules/@theia/core/lib/browser/shell/tab-bar-toolbar/tab-bar-toolbar-types.d.ts` |
| EditorManager API | `node_modules/@theia/editor/lib/browser/editor-manager.d.ts` |

---

## Task 1: Scaffold the extension package

**Files:**
- Create: `extensions/openspace-viewers/package.json`
- Create: `extensions/openspace-viewers/tsconfig.json`
- Modify: `tsconfig.json` (root) — add reference
- Modify: `package.json` (root) — add to `build:extensions` script
- Modify: `browser-app/package.json` — add dependency

**Step 1: Create `extensions/openspace-viewers/package.json`**

```json
{
  "name": "openspace-viewers",
  "version": "0.1.0",
  "license": "MIT",
  "theiaExtensions": [
    {
      "frontend": "lib/browser/openspace-viewers-frontend-module"
    }
  ],
  "dependencies": {
    "@theia/core": "1.68.2",
    "@theia/editor": "1.68.2",
    "@theia/filesystem": "1.68.2",
    "@theia/monaco": "1.68.2",
    "@theia/workspace": "1.68.2",
    "dompurify": "^3.2.3",
    "markdown-it": "^14.1.0",
    "mermaid": "^11.4.1"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.5",
    "@types/markdown-it": "^14.1.2",
    "rimraf": "^5.0.0",
    "typescript": "~5.4.5"
  },
  "scripts": {
    "build": "tsc && mkdir -p lib/browser/style && cp src/browser/style/*.css lib/browser/style/",
    "clean": "rimraf lib tsconfig.tsbuildinfo",
    "watch": "tsc --watch"
  }
}
```

**Step 2: Create `extensions/openspace-viewers/tsconfig.json`**

```json
{
  "extends": "../../configs/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": "src",
    "composite": true,
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.Fragment"
  },
  "include": ["src"],
  "exclude": ["lib", "node_modules"]
}
```

**Step 3: Add to root `tsconfig.json`**

In the `"references"` array, add after the `openspace-presentation` entry:
```json
{ "path": "./extensions/openspace-viewers" },
```

**Step 4: Add to root `package.json` `build:extensions` script**

Append to the end of the `build:extensions` command (before the closing `"`):
```
 && yarn --silent --cwd extensions/openspace-viewers build
```

**Step 5: Add to `browser-app/package.json` dependencies**

```json
"openspace-viewers": "0.1.0"
```

**Step 6: Install dependencies**

```bash
yarn --cwd extensions/openspace-viewers install
```

**Step 7: Commit**

```bash
git add extensions/openspace-viewers/package.json extensions/openspace-viewers/tsconfig.json tsconfig.json package.json browser-app/package.json
git commit -m "feat: scaffold openspace-viewers extension package"
```

---

## Task 2: Open handler with tests

**Files:**
- Create: `extensions/openspace-viewers/src/browser/markdown-viewer-open-handler.ts`
- Create: `extensions/openspace-viewers/src/browser/__tests__/markdown-viewer-open-handler.spec.ts`

**Step 1: Write the failing test**

Create `extensions/openspace-viewers/src/browser/__tests__/markdown-viewer-open-handler.spec.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { URI } from '@theia/core/lib/common/uri';
import { MarkdownViewerOpenHandler } from '../markdown-viewer-open-handler';

describe('MarkdownViewerOpenHandler canHandle logic', () => {
    let handler: MarkdownViewerOpenHandler;

    beforeEach(() => {
        handler = new MarkdownViewerOpenHandler();
    });

    it('should return priority 200 for .md files', () => {
        expect(handler.canHandle(new URI('file:///project/README.md'))).to.equal(200);
    });

    it('should return priority 200 for .markdown files', () => {
        expect(handler.canHandle(new URI('file:///project/notes.markdown'))).to.equal(200);
    });

    it('should return priority 200 for .mdown files', () => {
        expect(handler.canHandle(new URI('file:///project/doc.mdown'))).to.equal(200);
    });

    it('should return 0 for .deck.md files (handled by presentation)', () => {
        // PresentationOpenHandler checks .deck.md first by string suffix, so
        // our handler must also reject it so there is no ambiguity.
        expect(handler.canHandle(new URI('file:///project/talk.deck.md'))).to.equal(0);
    });

    it('should return 0 for .ts files', () => {
        expect(handler.canHandle(new URI('file:///project/index.ts'))).to.equal(0);
    });

    it('should return 0 for .json files', () => {
        expect(handler.canHandle(new URI('file:///project/data.json'))).to.equal(0);
    });

    it('should return 0 for files with no extension', () => {
        expect(handler.canHandle(new URI('file:///project/Makefile'))).to.equal(0);
    });

    it('should handle .md files in deep subdirectories', () => {
        expect(handler.canHandle(new URI('file:///a/b/c/d/e.md'))).to.equal(200);
    });
});
```

**Step 2: Run test to verify it fails**

```bash
yarn --cwd extensions/openspace-viewers build 2>&1 | tail -5
```

Expected: compile error — `MarkdownViewerOpenHandler` not found.

**Step 3: Create `extensions/openspace-viewers/src/browser/markdown-viewer-open-handler.ts`**

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, WidgetManager } from '@theia/core/lib/browser';
import { ILogger } from '@theia/core/lib/common/logger';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MarkdownViewerWidget } from './markdown-viewer-widget';

const HANDLER_PRIORITY = 200;
const MD_EXTENSIONS = ['.md', '.markdown', '.mdown'];
const DECK_SUFFIX = '.deck.md';

@injectable()
export class MarkdownViewerOpenHandler implements OpenHandler {

    readonly id = 'openspace-markdown-viewer-open-handler';

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    canHandle(uri: URI): number {
        const path = uri.path.toString();
        // Exclude .deck.md — handled by PresentationOpenHandler
        if (path.endsWith(DECK_SUFFIX)) {
            return 0;
        }
        const matched = MD_EXTENSIONS.some(ext => path.endsWith(ext));
        return matched ? HANDLER_PRIORITY : 0;
    }

    async open(uri: URI): Promise<MarkdownViewerWidget> {
        const widget = await this.widgetManager.getOrCreateWidget(
            MarkdownViewerWidget.ID,
            { uri: uri.toString() }
        ) as MarkdownViewerWidget;

        widget.uri = uri.toString();
        widget.title.label = uri.path.base;

        try {
            const content = await this.readFileContent(uri);
            widget.setContent(content);
        } catch (error) {
            this.logger.error('[MarkdownViewerOpenHandler] Failed to load file:', error);
            widget.setContent('# Error\n\nFailed to load file content.');
        }

        return widget;
    }

    async findByUri(uri: URI): Promise<MarkdownViewerWidget | undefined> {
        const widgets = await this.widgetManager.getWidgets(MarkdownViewerWidget.ID);
        return widgets.find(w => (w as MarkdownViewerWidget).uri === uri.toString()) as
            MarkdownViewerWidget | undefined;
    }

    protected async readFileContent(uri: URI): Promise<string> {
        const stat = await this.fileService.resolve(uri);
        if (!stat.isFile) { throw new Error('Not a file'); }
        const result = await this.fileService.read(uri);
        return result.value;
    }
}
```

**Step 4: Build and run tests**

```bash
yarn --cwd extensions/openspace-viewers build
```

Then run the unit tests (using the project's test runner from root):

```bash
yarn --cwd extensions/openspace-viewers test 2>&1 | tail -20
```

If no test script exists in the extension yet, check root `package.json` for the test command pattern. The presentation extension runs tests via mocha with ts-node. Add a test script matching `openspace-presentation/package.json` if absent.

Expected: 8 passing tests.

**Step 5: Commit**

```bash
git add extensions/openspace-viewers/src/
git commit -m "feat(viewers): add MarkdownViewerOpenHandler with tests"
```

---

## Task 3: Widget — preview mode (markdown-it + Mermaid)

**Files:**
- Create: `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx`
- Create: `extensions/openspace-viewers/src/browser/style/markdown-viewer-widget.css`
- Create: `extensions/openspace-viewers/src/browser/__tests__/markdown-viewer-widget.spec.ts`

**Step 1: Write the failing tests**

Create `extensions/openspace-viewers/src/browser/__tests__/markdown-viewer-widget.spec.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Tests for MarkdownViewerWidget static constants and pure logic.
 * The widget itself requires a full Theia DI container and cannot be
 * instantiated in unit tests. We test what we can isolate.
 */

import { expect } from 'chai';
import { MarkdownViewerWidget } from '../markdown-viewer-widget';

describe('MarkdownViewerWidget', () => {

    describe('Constants', () => {
        it('should have correct widget ID', () => {
            expect(MarkdownViewerWidget.ID).to.equal('openspace-markdown-viewer-widget');
        });

        it('should have correct widget LABEL', () => {
            expect(MarkdownViewerWidget.LABEL).to.equal('Markdown Viewer');
        });
    });

    describe('renderMarkdown (static helper)', () => {
        it('should render a heading', () => {
            const html = MarkdownViewerWidget.renderMarkdown('# Hello');
            expect(html).to.include('<h1');
            expect(html).to.include('Hello');
        });

        it('should render bold text', () => {
            const html = MarkdownViewerWidget.renderMarkdown('**bold**');
            expect(html).to.include('<strong>bold</strong>');
        });

        it('should render a fenced code block', () => {
            const html = MarkdownViewerWidget.renderMarkdown('```js\nconst x = 1;\n```');
            expect(html).to.include('<code');
            expect(html).to.include('const x = 1;');
        });

        it('should render a mermaid block with class "mermaid"', () => {
            const md = '```mermaid\ngraph TD; A-->B;\n```';
            const html = MarkdownViewerWidget.renderMarkdown(md);
            expect(html).to.include('class="mermaid"');
            expect(html).to.include('graph TD');
        });

        it('should return empty string for empty input', () => {
            expect(MarkdownViewerWidget.renderMarkdown('')).to.equal('');
        });

        it('should not return raw HTML tags from XSS attempt', () => {
            const html = MarkdownViewerWidget.renderMarkdown('<script>alert(1)</script>');
            expect(html).to.not.include('<script>');
        });
    });
});
```

**Step 2: Run to verify they fail (missing module)**

```bash
yarn --cwd extensions/openspace-viewers build 2>&1 | grep "error TS" | head -5
```

**Step 3: Create `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx`**

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

export type ViewerMode = 'preview' | 'edit';

/** Markdown-it instance with mermaid fence override. Created once, shared. */
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Override the fenced code block renderer to emit a <pre class="mermaid"> for
// mermaid blocks, which mermaid.run() will later find and render.
const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    if (info === 'mermaid') {
        const escaped = token.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre class="mermaid">${escaped}</pre>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
};

@injectable()
export class MarkdownViewerWidget extends ReactWidget {
    static readonly ID = 'openspace-markdown-viewer-widget';
    static readonly LABEL = 'Markdown Viewer';

    /** URI of the file being viewed. Set by the open handler. */
    public uri: string = '';

    protected content: string = '';
    protected mode: ViewerMode = 'preview';
    protected editorContainerRef: React.RefObject<HTMLDivElement>;

    @inject(FileService)
    protected readonly fileService!: FileService;

    constructor() {
        super();
        this.id = MarkdownViewerWidget.ID;
        this.title.label = MarkdownViewerWidget.LABEL;
        this.title.caption = MarkdownViewerWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-markdown';
        this.addClass('openspace-markdown-viewer-widget');
        this.editorContainerRef = React.createRef();
    }

    @postConstruct()
    protected init(): void {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        this.update();
    }

    /** Called by the open handler to set or refresh file content. */
    setContent(content: string): void {
        this.content = content;
        this.mode = 'preview';
        this.update();
    }

    /** Called by the toolbar toggle command. */
    toggleMode(): void {
        this.mode = this.mode === 'preview' ? 'edit' : 'preview';
        this.update();
    }

    getMode(): ViewerMode {
        return this.mode;
    }

    /**
     * Static helper: render markdown string → sanitized HTML string.
     * Exposed as static so unit tests can call it without a Theia container.
     */
    static renderMarkdown(markdown: string): string {
        if (!markdown) { return ''; }
        const raw = md.render(markdown);
        return DOMPurify.sanitize(raw);
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        // Run mermaid after first render
        if (this.mode === 'preview') {
            this.runMermaid();
        }
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
    }

    protected render(): React.ReactNode {
        if (this.mode === 'preview') {
            return this.renderPreview();
        }
        return this.renderEditor();
    }

    protected renderPreview(): React.ReactNode {
        const html = MarkdownViewerWidget.renderMarkdown(this.content);
        return (
            <div
                className="markdown-viewer-preview"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: html }}
                ref={el => { if (el) { this.runMermaid(); } }}
            />
        );
    }

    protected renderEditor(): React.ReactNode {
        // The Monaco editor is mounted imperatively into this container div
        // after React attaches it to the DOM (see onAfterRender / useEffect equivalent).
        return (
            <div
                className="markdown-viewer-editor-container"
                ref={this.editorContainerRef}
            />
        );
    }

    /** Run mermaid.run() to convert .mermaid pre blocks into SVG diagrams. */
    protected runMermaid(): void {
        // Defer to next tick so the DOM has settled after React's render.
        setTimeout(() => {
            mermaid.run({ querySelector: '.markdown-viewer-preview .mermaid' }).catch(err => {
                console.warn('[MarkdownViewerWidget] Mermaid render error:', err);
            });
        }, 0);
    }

    protected onBeforeDetach(msg: Message): void {
        super.onBeforeDetach(msg);
    }
}
```

**Step 4: Create `extensions/openspace-viewers/src/browser/style/markdown-viewer-widget.css`**

```css
/* *****************************************************************************
 * Copyright (C) 2024 OpenSpace contributors.
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 * *****************************************************************************/

.openspace-markdown-viewer-widget {
    position: absolute;
    inset: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

/* Preview mode */
.openspace-markdown-viewer-widget .markdown-viewer-preview {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    padding: 24px 32px;
    box-sizing: border-box;
    color: var(--theia-editor-foreground);
    background: var(--theia-editor-background);
    font-family: var(--theia-ui-font-family);
    font-size: var(--theia-ui-font-size1);
    line-height: 1.7;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview h1,
.openspace-markdown-viewer-widget .markdown-viewer-preview h2,
.openspace-markdown-viewer-widget .markdown-viewer-preview h3,
.openspace-markdown-viewer-widget .markdown-viewer-preview h4 {
    color: var(--theia-editor-foreground);
    margin-top: 1.2em;
    margin-bottom: 0.4em;
    border-bottom: 1px solid var(--theia-widget-border);
    padding-bottom: 0.2em;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview h1 { font-size: 2em; }
.openspace-markdown-viewer-widget .markdown-viewer-preview h2 { font-size: 1.5em; }
.openspace-markdown-viewer-widget .markdown-viewer-preview h3 { font-size: 1.2em; }

.openspace-markdown-viewer-widget .markdown-viewer-preview p {
    margin: 0.6em 0;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview code {
    background: var(--theia-textCodeBlock-background);
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-family: var(--theia-code-font-family);
    font-size: 0.9em;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview pre {
    background: var(--theia-textCodeBlock-background);
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0.8em 0;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview pre code {
    background: none;
    padding: 0;
    font-size: 0.875em;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview blockquote {
    border-left: 3px solid var(--theia-focusBorder);
    margin: 0.8em 0;
    padding: 0.2em 1em;
    color: var(--theia-descriptionForeground);
}

.openspace-markdown-viewer-widget .markdown-viewer-preview a {
    color: var(--theia-textLink-foreground);
}

.openspace-markdown-viewer-widget .markdown-viewer-preview ul,
.openspace-markdown-viewer-widget .markdown-viewer-preview ol {
    padding-left: 1.5em;
    margin: 0.4em 0;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.8em 0;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview th,
.openspace-markdown-viewer-widget .markdown-viewer-preview td {
    border: 1px solid var(--theia-widget-border);
    padding: 6px 12px;
    text-align: left;
}

.openspace-markdown-viewer-widget .markdown-viewer-preview th {
    background: var(--theia-list-activeSelectionBackground);
    font-weight: 600;
}

/* Mermaid diagrams */
.openspace-markdown-viewer-widget .markdown-viewer-preview .mermaid {
    background: transparent;
    text-align: center;
    padding: 1em 0;
}

/* Edit mode — Monaco container fills the widget */
.openspace-markdown-viewer-widget .markdown-viewer-editor-container {
    position: absolute;
    inset: 0;
}
```

**Step 5: Build and run tests**

```bash
yarn --cwd extensions/openspace-viewers build
yarn --cwd extensions/openspace-viewers test 2>&1 | tail -20
```

Expected: all tests pass including the 6 `renderMarkdown` tests.

**Step 6: Commit**

```bash
git add extensions/openspace-viewers/src/
git commit -m "feat(viewers): add MarkdownViewerWidget with preview mode and Mermaid support"
```

---

## Task 4: Edit mode — embedded Monaco editor

The widget renders a bare `<div ref={editorContainerRef}>` in edit mode. We need to create a real Monaco editor in that div after React mounts it, and destroy it when leaving edit mode or detaching.

**Files:**
- Modify: `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx`

**Step 1: Add MonacoEditorServices and editor lifecycle to the widget**

Replace the entire `markdown-viewer-widget.tsx` with the updated version below.

Key changes from Task 3:
1. Inject `MonacoEditorServices` (provides access to Monaco model service, language service, etc.)
2. Add `protected monacoEditor: MonacoEditor | undefined` field
3. `renderEditor()` calls `mountMonacoEditor()` after React commits the div to DOM (via `ref` callback)
4. `mountMonacoEditor()` creates a `MonacoEditorModel` for the URI, then calls `MonacoEditor.create()`
5. `destroyMonacoEditor()` disposes the editor on mode switch or widget detach
6. On save: listen to `monacoEditor.document.onDidSaveTextDocument` or call `fileService.write()` on blur

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoEditorServices } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

export type ViewerMode = 'preview' | 'edit';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info.trim();
    if (info === 'mermaid') {
        const escaped = token.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre class="mermaid">${escaped}</pre>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
};

@injectable()
export class MarkdownViewerWidget extends ReactWidget {
    static readonly ID = 'openspace-markdown-viewer-widget';
    static readonly LABEL = 'Markdown Viewer';

    public uri: string = '';

    protected content: string = '';
    protected mode: ViewerMode = 'preview';
    protected monacoEditor: MonacoEditor | undefined;
    protected editorContainerRef: React.RefObject<HTMLDivElement>;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(MonacoEditorServices)
    protected readonly monacoEditorServices!: MonacoEditorServices;

    @inject(MonacoTextModelService)
    protected readonly textModelService!: MonacoTextModelService;

    constructor() {
        super();
        this.id = MarkdownViewerWidget.ID;
        this.title.label = MarkdownViewerWidget.LABEL;
        this.title.caption = MarkdownViewerWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-markdown';
        this.addClass('openspace-markdown-viewer-widget');
        this.editorContainerRef = React.createRef();
    }

    @postConstruct()
    protected init(): void {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        this.update();
    }

    setContent(content: string): void {
        this.content = content;
        this.mode = 'preview';
        this.destroyMonacoEditor();
        this.update();
    }

    toggleMode(): void {
        if (this.mode === 'preview') {
            this.mode = 'edit';
        } else {
            // Switching back to preview: read current editor content before destroying
            if (this.monacoEditor) {
                this.content = this.monacoEditor.document.getText();
            }
            this.destroyMonacoEditor();
            this.mode = 'preview';
        }
        this.update();
    }

    getMode(): ViewerMode {
        return this.mode;
    }

    static renderMarkdown(markdown: string): string {
        if (!markdown) { return ''; }
        const raw = md.render(markdown);
        return DOMPurify.sanitize(raw);
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (this.mode === 'preview') {
            this.runMermaid();
        }
    }

    protected onBeforeDetach(msg: Message): void {
        this.destroyMonacoEditor();
        super.onBeforeDetach(msg);
    }

    protected render(): React.ReactNode {
        if (this.mode === 'preview') {
            return this.renderPreview();
        }
        return this.renderEditor();
    }

    protected renderPreview(): React.ReactNode {
        const html = MarkdownViewerWidget.renderMarkdown(this.content);
        return (
            <div
                className="markdown-viewer-preview"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: html }}
                ref={el => { if (el) { this.runMermaid(); } }}
            />
        );
    }

    protected renderEditor(): React.ReactNode {
        return (
            <div
                className="markdown-viewer-editor-container"
                ref={(el) => {
                    if (el && !this.monacoEditor) {
                        this.mountMonacoEditor(el).catch(err =>
                            console.error('[MarkdownViewerWidget] Monaco mount failed:', err)
                        );
                    }
                }}
            />
        );
    }

    protected async mountMonacoEditor(container: HTMLDivElement): Promise<void> {
        if (!this.uri) { return; }

        const uri = new URI(this.uri);
        // Get or create the Monaco text model for this URI (shared with any open Monaco editor)
        const reference = await this.textModelService.createModelReference(uri);
        const document = reference.object as MonacoEditorModel;

        this.monacoEditor = await MonacoEditor.create(
            uri,
            document,
            container,
            this.monacoEditorServices,
            {
                language: 'markdown',
                autoSizing: false,
                minHeight: -1,
            }
        );

        // Layout to fill the container
        this.monacoEditor.getControl().layout();

        // Auto-save on content change (debounced 1s)
        let saveTimer: ReturnType<typeof setTimeout> | undefined;
        this.toDispose.push(
            this.monacoEditor.getControl().onDidChangeModelContent(() => {
                if (saveTimer) { clearTimeout(saveTimer); }
                saveTimer = setTimeout(() => {
                    this.saveCurrentContent().catch(err =>
                        console.warn('[MarkdownViewerWidget] Auto-save failed:', err)
                    );
                }, 1000);
            })
        );
    }

    protected destroyMonacoEditor(): void {
        if (this.monacoEditor) {
            this.monacoEditor.dispose();
            this.monacoEditor = undefined;
        }
    }

    protected async saveCurrentContent(): Promise<void> {
        if (!this.monacoEditor || !this.uri) { return; }
        const text = this.monacoEditor.document.getText();
        const uri = new URI(this.uri);
        await this.fileService.write(uri, text);
    }

    protected runMermaid(): void {
        setTimeout(() => {
            mermaid.run({ querySelector: '.markdown-viewer-preview .mermaid' }).catch(err => {
                console.warn('[MarkdownViewerWidget] Mermaid render error:', err);
            });
        }, 0);
    }
}
```

**Step 2: Build**

```bash
yarn --cwd extensions/openspace-viewers build 2>&1 | grep "error TS" | head -20
```

Expected: zero TypeScript errors. If `MonacoEditorServices` import path is wrong, check:
```bash
grep -r "export.*MonacoEditorServices" node_modules/@theia/monaco/lib/browser/ | head -5
```

**Step 3: Run tests (static logic only)**

```bash
yarn --cwd extensions/openspace-viewers test 2>&1 | tail -10
```

Expected: all prior tests still pass (static `renderMarkdown` is unchanged).

**Step 4: Commit**

```bash
git add extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx
git commit -m "feat(viewers): add Monaco edit mode with auto-save to MarkdownViewerWidget"
```

---

## Task 5: Toolbar toggle button

**Files:**
- Create: `extensions/openspace-viewers/src/browser/markdown-viewer-toolbar-contribution.ts`

**Step 1: Create the toolbar contribution**

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, Command } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ApplicationShell } from '@theia/core/lib/browser';
import { MarkdownViewerWidget } from './markdown-viewer-widget';

export namespace MarkdownViewerCommands {
    export const TOGGLE_MODE: Command = {
        id: 'openspace.markdownViewer.toggleMode',
        label: 'Toggle Preview/Edit',
    };
}

@injectable()
export class MarkdownViewerToolbarContribution
    implements CommandContribution, TabBarToolbarContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(MarkdownViewerCommands.TOGGLE_MODE, {
            isEnabled: () => this.currentViewerWidget() !== undefined,
            isVisible: () => this.currentViewerWidget() !== undefined,
            execute: () => {
                const widget = this.currentViewerWidget();
                widget?.toggleMode();
            },
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: MarkdownViewerCommands.TOGGLE_MODE.id,
            command: MarkdownViewerCommands.TOGGLE_MODE.id,
            tooltip: 'Toggle Preview / Edit',
            icon: () => {
                const widget = this.currentViewerWidget();
                if (!widget) { return 'codicon codicon-edit'; }
                return widget.getMode() === 'preview'
                    ? 'codicon codicon-edit'
                    : 'codicon codicon-preview';
            },
            group: 'navigation',
            priority: 0,
            isVisible: (widget) => widget instanceof MarkdownViewerWidget,
        });
    }

    protected currentViewerWidget(): MarkdownViewerWidget | undefined {
        const widget = this.shell.currentWidget;
        return widget instanceof MarkdownViewerWidget ? widget : undefined;
    }
}
```

**Step 2: Build**

```bash
yarn --cwd extensions/openspace-viewers build 2>&1 | grep "error TS" | head -10
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add extensions/openspace-viewers/src/browser/markdown-viewer-toolbar-contribution.ts
git commit -m "feat(viewers): add tab-bar toggle toolbar contribution"
```

---

## Task 6: DI frontend module

**Files:**
- Create: `extensions/openspace-viewers/src/browser/openspace-viewers-frontend-module.ts`

**Step 1: Create the module**

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ContainerModule } from '@theia/core/shared/inversify';
import './style/markdown-viewer-widget.css';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { MarkdownViewerWidget } from './markdown-viewer-widget';
import { MarkdownViewerOpenHandler } from './markdown-viewer-open-handler';
import { MarkdownViewerToolbarContribution } from './markdown-viewer-toolbar-contribution';

export default new ContainerModule((bind) => {
    // Widget factory
    bind(MarkdownViewerWidget).toSelf();
    bind(WidgetFactory)
        .toDynamicValue((context) => ({
            id: MarkdownViewerWidget.ID,
            createWidget: () => context.container.get<MarkdownViewerWidget>(MarkdownViewerWidget),
        }))
        .whenTargetNamed(MarkdownViewerWidget.ID);

    // Open handler
    bind(MarkdownViewerOpenHandler).toSelf();
    bind(OpenHandler).toService(MarkdownViewerOpenHandler);

    // Toolbar toggle
    bind(MarkdownViewerToolbarContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(MarkdownViewerToolbarContribution);
    bind(TabBarToolbarContribution).toService(MarkdownViewerToolbarContribution);
});
```

**Step 2: Build the extension**

```bash
yarn --cwd extensions/openspace-viewers build 2>&1 | grep "error TS" | head -10
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add extensions/openspace-viewers/src/browser/openspace-viewers-frontend-module.ts
git commit -m "feat(viewers): wire DI frontend module for openspace-viewers"
```

---

## Task 7: Full build and smoke test

**Step 1: Run full build**

```bash
yarn build:verbose 2>&1 | tail -30
```

Expected: exits 0, no errors.

**Step 2: Run all unit tests**

```bash
yarn test 2>&1 | tail -20
```

Expected: all existing tests pass, new tests pass (check total count increased).

**Step 3: Start the dev server (worktree runs on port 3001)**

```bash
yarn --cwd browser-app start --port 3001
```

**Step 4: Manual smoke test checklist**

1. Open the app at `http://localhost:3001`
2. Open any `.md` file from the file tree — confirm it opens in the Markdown viewer (not Monaco)
3. Confirm preview renders headings, bold, links, code blocks correctly
4. Add a mermaid code block to a test `.md` file and confirm it renders as a diagram
5. Click the toolbar toggle (pencil icon) — confirm the Monaco editor appears in-place with the raw markdown
6. Edit some text in Monaco, wait 1s — confirm the file is saved (check file modified time)
7. Click the eye icon to return to preview — confirm the edited content is rendered
8. Open a `.deck.md` file — confirm it still opens in the Presentation viewer (not Markdown viewer)
9. Open a `.ts` file — confirm it still opens in Monaco (not Markdown viewer)

**Step 5: Commit**

If any fixes were needed during smoke test, commit them, then:

```bash
git add -A
git commit -m "feat(viewers): openspace-viewers extension — Markdown viewer with Mermaid and Monaco edit mode"
```

---

## Task 8: Update WORKPLAN

**Files:**
- Modify: `docs/architecture/WORKPLAN.md`

**Step 1: Update the phase table and add a completed entry**

Find the phase summary table at the top of `WORKPLAN.md` and add a row for this work. Also add a completed phase entry in the body. Mark it `✅ COMPLETE` with a brief description.

**Step 2: Commit**

```bash
git add docs/architecture/WORKPLAN.md
git commit -m "docs: mark markdown viewer phase complete in WORKPLAN"
```

---

## Done

After Task 8, the feature branch has:
- `extensions/openspace-viewers/` — fully implemented, tested, wired
- `.md` files open in rendered preview by default
- Mermaid diagrams render inline
- Tab-bar toggle switches to embedded Monaco editor in-place
- Auto-save on edit
- `.deck.md` files unaffected
- All existing tests still passing
- WORKPLAN updated
