# Generic Viewer Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a generic mechanism that automatically provides toggle functionality between "pretty viewer" mode and raw text mode for any viewer widget, without requiring viewer authors to implement anything.

**Architecture:** Create a high-priority OpenHandler interceptor that detects viewer widgets by ID pattern, tracks toggle state per URI, and delegates to either the viewer or the text editor based on state. Uses existing `attachTabDblClickToggle` for the double-click interaction. A `FrontendApplicationContribution` listens for new widgets and attaches the double-click handler to any toggleable viewer.

**Tech Stack:** TypeScript, Theia `OpenerService`/`ApplicationShell`/`NavigatableWidget` APIs, inversify DI

---

## Key Theia API Facts (read before implementing)

- **Correct service**: `OpenerService` (not `OpenHandlerRegistry`) — imported from `@theia/core/lib/browser`
- **Get all handlers**: `openerService.getOpeners(uri)` — **async**, returns `Promise<OpenHandler[]>`
- **Get best handler**: `openerService.getOpener(uri)` — **async**, returns `Promise<OpenHandler>`
- **Widget events**: `shell.onDidAddWidget` — fires `Widget` directly (no wrapper)
- **Get URI from widget**: `NavigatableWidget.getUri(widget)` — from `@theia/core/lib/browser/navigatable-types`
- **Lifecycle hook**: Implement `FrontendApplicationContribution` and bind to it (not `WidgetLifecycleListener`)
- **Widget disposables**: `widget.toDisposeOnDetach` exists on base `Widget` and is safe to push to

---

## Implementation Location

All new code goes in `extensions/openspace-core/src/browser/viewer-toggle/`:

```
src/browser/
├── viewer-toggle/
│   ├── viewer-toggle-service.ts          # Core service: canToggle(), toggle(), getToggleState()
│   ├── viewer-toggle-open-handler.ts     # OpenHandler interceptor (priority 150)
│   ├── viewer-toggle-contribution.ts     # FrontendApplicationContribution: attaches tab dbl-click
│   └── __tests__/
│       ├── viewer-toggle-service.spec.ts
│       └── viewer-toggle-open-handler.spec.ts
```

DI bindings go directly in the existing:
- `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts`

---

## Task 1: ViewerToggleService

**Files:**
- Create: `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-service.ts`

**Step 1: Write the failing tests first**

Create `extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-service.spec.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { URI } from '@theia/core/lib/common/uri';
import { ViewerToggleService } from '../viewer-toggle-service';

// Minimal stub for OpenerService — only what ViewerToggleService needs
function makeOpenerService(handlers: Array<{ id: string; priority: number }>) {
    return {
        getOpeners: async (_uri: URI) => handlers.map(h => ({
            id: h.id,
            canHandle: (_u: URI) => h.priority,
            open: async () => undefined,
        })),
        getOpener: async () => { throw new Error('not needed'); },
    };
}

function makeService(handlers: Array<{ id: string; priority: number }>) {
    const svc = new ViewerToggleService();
    // Inject stub OpenerService manually (bypasses DI for tests)
    (svc as any).openerService = makeOpenerService(handlers);
    return svc;
}

describe('ViewerToggleService', () => {
    describe('canToggle()', () => {
        it('returns false for excluded image extensions', async () => {
            const svc = makeService([{ id: 'image-viewer', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.png'))).to.be.false;
        });

        it('returns false when no viewer handler exists', async () => {
            // Handler ID does not contain "viewer"
            const svc = makeService([{ id: 'my-editor', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.csv'))).to.be.false;
        });

        it('returns true for text file with a viewer handler', async () => {
            const svc = makeService([{ id: 'csv-viewer-handler', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.csv'))).to.be.true;
        });

        it('returns true for .md file with a viewer handler', async () => {
            const svc = makeService([{ id: 'openspace-markdown-viewer-open-handler', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.md'))).to.be.true;
        });

        it('returns false for .zip file even with a viewer handler', async () => {
            const svc = makeService([{ id: 'zip-viewer-handler', priority: 200 }]);
            expect(await svc.canToggle(new URI('file:///test.zip'))).to.be.false;
        });
    });

    describe('getToggleState()', () => {
        it('returns preview by default', () => {
            const svc = makeService([]);
            expect(svc.getToggleState(new URI('file:///test.csv'))).to.equal('preview');
        });
    });

    describe('toggle()', () => {
        it('flips preview → edit', () => {
            const svc = makeService([]);
            const uri = new URI('file:///test.csv');
            expect(svc.toggle(uri)).to.equal('edit');
            expect(svc.getToggleState(uri)).to.equal('edit');
        });

        it('flips edit → preview', () => {
            const svc = makeService([]);
            const uri = new URI('file:///test.csv');
            svc.toggle(uri); // → edit
            expect(svc.toggle(uri)).to.equal('preview');
            expect(svc.getToggleState(uri)).to.equal('preview');
        });

        it('is independent per URI', () => {
            const svc = makeService([]);
            const a = new URI('file:///a.csv');
            const b = new URI('file:///b.csv');
            svc.toggle(a); // a → edit
            expect(svc.getToggleState(a)).to.equal('edit');
            expect(svc.getToggleState(b)).to.equal('preview');
        });
    });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx mocha "extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-service.spec.ts"
```

Expected: `Error: Cannot find module '../viewer-toggle-service'`

**Step 3: Implement ViewerToggleService**

Create `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-service.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, OpenerService } from '@theia/core/lib/browser';

const DEFAULT_EXCLUDED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.avi', '.mkv',
];

const TEXT_EXTENSIONS = [
    '.txt', '.md', '.markdown', '.mdown', '.csv', '.json', '.yaml', '.yml',
    '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.sh',
    '.bat', '.ps1', '.log', '.ini', '.conf', '.cfg', '.toml', '.sql',
];

const DEFAULT_VIEWER_PATTERN = /viewer/i;

@injectable()
export class ViewerToggleService {
    protected toggleState = new Map<string, 'preview' | 'edit'>();
    protected readonly viewerPattern: RegExp = DEFAULT_VIEWER_PATTERN;
    protected readonly excludedExtensions: string[] = DEFAULT_EXCLUDED_EXTENSIONS;

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    async canToggle(uri: URI): Promise<boolean> {
        if (this.isExcludedExtension(uri)) {
            return false;
        }
        const viewerHandler = await this.findViewerHandler(uri);
        if (!viewerHandler) {
            return false;
        }
        return this.canReadAsText(uri);
    }

    getToggleState(uri: URI): 'preview' | 'edit' {
        return this.toggleState.get(uri.toString()) ?? 'preview';
    }

    toggle(uri: URI): 'preview' | 'edit' {
        const current = this.getToggleState(uri);
        const next = current === 'preview' ? 'edit' : 'preview';
        this.toggleState.set(uri.toString(), next);
        return next;
    }

    protected async findViewerHandler(uri: URI): Promise<OpenHandler | undefined> {
        // getOpeners returns handlers sorted by priority (highest first)
        const handlers = await this.openerService.getOpeners(uri);
        return handlers.find(h => this.isViewerHandler(h));
    }

    protected isViewerHandler(handler: OpenHandler): boolean {
        return this.viewerPattern.test(handler.id);
    }

    protected isExcludedExtension(uri: URI): boolean {
        const ext = uri.path.ext.toLowerCase();
        return this.excludedExtensions.includes(ext);
    }

    protected canReadAsText(uri: URI): boolean {
        const ext = uri.path.ext.toLowerCase();
        return TEXT_EXTENSIONS.includes(ext) || !this.isExcludedExtension(uri);
    }
}
```

**Step 4: Run tests again to verify they pass**

```bash
npx mocha "extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-service.spec.ts"
```

Expected: all tests pass

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/viewer-toggle/
git commit -m "feat: add ViewerToggleService"
```

---

## Task 2: ViewerToggleOpenHandler

**Files:**
- Create: `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-open-handler.ts`
- Create: `extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-open-handler.spec.ts`

**Step 1: Write the failing tests first**

Create `extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-open-handler.spec.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import * as sinon from 'sinon';
import { URI } from '@theia/core/lib/common/uri';
import { ViewerToggleOpenHandler } from '../viewer-toggle-open-handler';
import { ViewerToggleService } from '../viewer-toggle-service';

function makeHandler(canToggleResult: boolean, toggleState: 'preview' | 'edit') {
    const toggleService = {
        canToggle: sinon.stub().resolves(canToggleResult),
        getToggleState: sinon.stub().returns(toggleState),
        toggle: sinon.stub(),
    } as unknown as ViewerToggleService;

    const viewerWidget = { id: 'viewer-widget' };
    const textWidget = { id: 'text-widget' };

    const viewerHandler = {
        id: 'csv-viewer-open-handler',
        canHandle: () => 200,
        open: sinon.stub().resolves(viewerWidget),
    };

    const openerService = {
        getOpeners: sinon.stub().resolves([viewerHandler]),
        getOpener: sinon.stub().resolves({
            id: 'default-editor',
            canHandle: () => 100,
            open: sinon.stub().resolves(textWidget),
        }),
    };

    const handler = new ViewerToggleOpenHandler();
    (handler as any).toggleService = toggleService;
    (handler as any).openerService = openerService;

    return { handler, toggleService, openerService, viewerHandler, viewerWidget, textWidget };
}

describe('ViewerToggleOpenHandler', () => {
    describe('canHandle()', () => {
        it('returns PRIORITY when canToggle is true', async () => {
            const { handler } = makeHandler(true, 'preview');
            const result = await handler.canHandle(new URI('file:///test.csv'));
            expect(result).to.equal(ViewerToggleOpenHandler.PRIORITY);
        });

        it('returns 0 when canToggle is false', async () => {
            const { handler } = makeHandler(false, 'preview');
            const result = await handler.canHandle(new URI('file:///test.png'));
            expect(result).to.equal(0);
        });
    });

    describe('open()', () => {
        it('delegates to viewer when state is preview', async () => {
            const { handler, viewerHandler } = makeHandler(true, 'preview');
            const uri = new URI('file:///test.csv');
            await handler.open(uri);
            expect((viewerHandler.open as sinon.SinonStub).calledOnce).to.be.true;
        });

        it('delegates to text editor when state is edit', async () => {
            const { handler, openerService } = makeHandler(true, 'edit');
            const uri = new URI('file:///test.csv');
            await handler.open(uri);
            expect((openerService.getOpener as sinon.SinonStub).calledOnce).to.be.true;
        });
    });
});
```

Check if sinon is available:

```bash
ls node_modules/sinon 2>/dev/null && echo "available" || echo "not available"
```

If sinon is not available, write the stubs manually without sinon (use plain objects with call tracking).

**Step 2: Run tests to verify they fail**

```bash
npx mocha "extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-open-handler.spec.ts"
```

Expected: `Error: Cannot find module '../viewer-toggle-open-handler'`

**Step 3: Implement ViewerToggleOpenHandler**

Create `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-open-handler.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, OpenerOptions, OpenerService } from '@theia/core/lib/browser';
import { ViewerToggleService } from './viewer-toggle-service';

@injectable()
export class ViewerToggleOpenHandler implements OpenHandler {
    readonly id = 'openspace-viewer-toggle-open-handler';
    static readonly PRIORITY = 150;

    @inject(ViewerToggleService)
    protected readonly toggleService!: ViewerToggleService;

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    async canHandle(uri: URI): Promise<number> {
        const toggleable = await this.toggleService.canToggle(uri);
        return toggleable ? ViewerToggleOpenHandler.PRIORITY : 0;
    }

    async open(uri: URI, options?: OpenerOptions): Promise<object | undefined> {
        const state = this.toggleService.getToggleState(uri);
        if (state === 'edit') {
            return this.openAsTextEditor(uri, options);
        }
        return this.openWithViewer(uri, options);
    }

    protected async openAsTextEditor(uri: URI, options?: OpenerOptions): Promise<object | undefined> {
        // getOpener returns the highest-priority handler — excluding ourselves, the next
        // best fit for a text file will be Monaco editor (priority 100).
        // We skip ourselves by temporarily returning 0 from canHandle for this call,
        // but the simpler approach is to pass options that force a text editor.
        // In practice getOpener returns us again if we're highest — so we must
        // call getOpeners and find the first non-self handler.
        const handlers = await this.openerService.getOpeners(uri);
        const textHandler = handlers.find(h => h.id !== this.id);
        if (textHandler) {
            return textHandler.open(uri, options);
        }
        return undefined;
    }

    protected async openWithViewer(uri: URI, options?: OpenerOptions): Promise<object | undefined> {
        // getOpeners returns handlers sorted by priority (highest first).
        // Skip ourselves and find the first viewer handler.
        const handlers = await this.openerService.getOpeners(uri);
        const viewerHandler = handlers.find(h =>
            h.id !== this.id && /viewer/i.test(h.id)
        );
        if (viewerHandler) {
            return viewerHandler.open(uri, options);
        }
        // Fallback: delegate to the first non-self handler
        const fallback = handlers.find(h => h.id !== this.id);
        return fallback?.open(uri, options);
    }
}
```

**Step 4: Run tests again to verify they pass**

```bash
npx mocha "extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-open-handler.spec.ts"
```

Expected: all tests pass

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/browser/viewer-toggle/
git commit -m "feat: add ViewerToggleOpenHandler"
```

---

## Task 3: ViewerToggleContribution (Tab Double-Click)

**Files:**
- Create: `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-contribution.ts`

No unit tests for this class — it wires DOM events and shell lifecycle, making it integration-only.

**Step 1: Implement ViewerToggleContribution**

Create `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-contribution.ts`:

```typescript
// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { ApplicationShell, FrontendApplicationContribution, Widget, OpenerService } from '@theia/core/lib/browser';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { attachTabDblClickToggle } from '../tab-dblclick-toggle';
import { ViewerToggleService } from './viewer-toggle-service';
import { ViewerToggleOpenHandler } from './viewer-toggle-open-handler';

@injectable()
export class ViewerToggleContribution implements FrontendApplicationContribution {

    @inject(ViewerToggleService)
    protected readonly toggleService!: ViewerToggleService;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    @postConstruct()
    protected init(): void {
        // onDidAddWidget fires whenever a widget is added to the shell.
        // We attach the toggle handler here so any viewer widget — including
        // those created by third-party extensions — gets the behaviour.
        this.shell.onDidAddWidget((widget: Widget) => {
            this.maybeAttachToggleHandler(widget);
        });
    }

    protected maybeAttachToggleHandler(widget: Widget): void {
        // Use Theia's NavigatableWidget helper to extract the URI from the widget.
        const uri = NavigatableWidget.getUri(widget);
        if (!uri) { return; }

        this.toggleService.canToggle(uri).then(toggleable => {
            if (!toggleable) { return; }

            const disposable = attachTabDblClickToggle(
                widget.node,
                () => widget.title.label,
                () => { this.handleToggle(uri, widget); }
            );

            widget.toDisposeOnDetach.push(disposable);
        }).catch(err => {
            console.warn('[ViewerToggleContribution] canToggle check failed:', err);
        });
    }

    protected handleToggle(uri: URI, currentWidget: Widget): void {
        const newState = this.toggleService.toggle(uri);
        this.reopenWithState(uri, newState, currentWidget).catch(err => {
            console.error('[ViewerToggleContribution] reopenWithState failed:', err);
        });
    }

    protected async reopenWithState(
        uri: URI,
        _state: 'preview' | 'edit',
        oldWidget: Widget
    ): Promise<void> {
        // Find our toggle handler and re-open through it.
        // The handler will check the new state and route to viewer or text editor.
        const handlers = await this.openerService.getOpeners(uri);
        const toggleHandler = handlers.find(h => h.id === ViewerToggleOpenHandler.ID);

        if (toggleHandler) {
            await toggleHandler.open(uri, {
                widgetOptions: { mode: 'replace', ref: oldWidget }
            } as any);
        }
    }
}
```

Note: `ViewerToggleOpenHandler.ID` needs to be added as a static constant. Add `static readonly ID = 'openspace-viewer-toggle-open-handler';` to the handler class in Task 2's file (in addition to `static readonly PRIORITY = 150`).

**Step 2: Add static ID to ViewerToggleOpenHandler**

Edit `extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-open-handler.ts` and add:

```typescript
static readonly ID = 'openspace-viewer-toggle-open-handler';
```

Make sure `readonly id = ViewerToggleOpenHandler.ID;` uses the static constant.

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-contribution.ts
git add extensions/openspace-core/src/browser/viewer-toggle/viewer-toggle-open-handler.ts
git commit -m "feat: add ViewerToggleContribution for tab dbl-click"
```

---

## Task 4: DI Bindings

**Files:**
- Modify: `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts`

**Step 1: Add imports and bindings**

Read the file, then add to the imports section:

```typescript
import { OpenHandler, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ViewerToggleService } from './viewer-toggle/viewer-toggle-service';
import { ViewerToggleOpenHandler } from './viewer-toggle/viewer-toggle-open-handler';
import { ViewerToggleContribution } from './viewer-toggle/viewer-toggle-contribution';
```

Add to the ContainerModule body (after the existing command contributions):

```typescript
// 8. Generic viewer toggle
bind(ViewerToggleService).toSelf().inSingletonScope();
bind(ViewerToggleOpenHandler).toSelf().inSingletonScope();
bind(OpenHandler).toService(ViewerToggleOpenHandler);
bind(ViewerToggleContribution).toSelf().inSingletonScope();
bind(FrontendApplicationContribution).toService(ViewerToggleContribution);
```

**Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. Fix any type errors before proceeding.

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/browser/openspace-core-frontend-module.ts
git commit -m "feat: wire viewer-toggle into DI module"
```

---

## Task 5: Run All Unit Tests

**Step 1: Run the viewer-toggle tests**

```bash
npx mocha \
  "extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-service.spec.ts" \
  "extensions/openspace-core/src/browser/viewer-toggle/__tests__/viewer-toggle-open-handler.spec.ts"
```

Expected: all tests pass

**Step 2: Typecheck the whole project**

```bash
npm run typecheck
```

Expected: no errors

**Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address typecheck issues in viewer-toggle"
```

---

## Summary of Commits

1. `feat: add ViewerToggleService`
2. `feat: add ViewerToggleOpenHandler`
3. `feat: add ViewerToggleContribution for tab dbl-click`
4. `feat: wire viewer-toggle into DI module`
5. `fix: address typecheck issues in viewer-toggle` (if needed)

## Key Behaviours to Verify

- `.csv` file with a handler whose ID contains "viewer" → canToggle = true
- `.png` file → canToggle = false (excluded extension)
- File with only a non-viewer editor → canToggle = false
- toggle() flips preview ↔ edit
- toggle state is independent per URI
- ViewerToggleOpenHandler.canHandle() returns 150 for toggleable URI, 0 otherwise
- ViewerToggleOpenHandler.open() routes to viewer on preview, text editor on edit

## Related

- Design doc: `docs/plans/2026-02-22-generic-viewer-toggle-design.md`
- Worktree: `.worktrees/generic-viewer-toggle`
