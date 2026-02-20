# Presentation Tab Double-Click Edit Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Double-clicking the tab of a `.deck.md` presentation widget toggles between Reveal.js presentation mode and a Monaco text editor, matching the existing behaviour in `MarkdownViewerWidget`; the tab-double-click wiring is extracted into a shared utility in `openspace-core` so future extensions can reuse it with one function call.

**Architecture:** A pure helper function `attachTabDblClickToggle` is added to `openspace-core`. `MarkdownViewerWidget` is refactored to call it (no behaviour change). `PresentationWidget` gains `mode`, `toggleMode()`, injected Monaco services, and calls the same helper. A `TabBarToolbarContribution` is added to `openspace-presentation` for toolbar-button discoverability, mirroring the MD viewer.

**Tech Stack:** TypeScript, Theia ReactWidget, InversifyJS DI, Monaco Editor (`@theia/monaco`), reveal.js, Mocha/Chai unit tests.

---

## Task 1: Add shared `attachTabDblClickToggle` utility to `openspace-core`

**Files:**
- Create: `extensions/openspace-core/src/browser/tab-dblclick-toggle.ts`
- Create: `extensions/openspace-core/src/browser/__tests__/tab-dblclick-toggle.spec.ts`

### Step 1: Write the failing test

```ts
// extensions/openspace-core/src/browser/__tests__/tab-dblclick-toggle.spec.ts
import { expect } from 'chai';
import { attachTabDblClickToggle } from '../tab-dblclick-toggle';

describe('attachTabDblClickToggle', () => {
    function makeDOM(labelText: string): {
        dockPanel: HTMLElement;
        tabBarContent: HTMLElement;
        tab: HTMLElement;
        labelEl: HTMLElement;
        widgetNode: HTMLElement;
    } {
        // Build the minimal DOM structure that Theia's dock panel produces:
        //   .lm-DockPanel
        //     .lm-TabBar-content
        //       .lm-TabBar-tab
        //         .lm-TabBar-tabLabel  (textContent = labelText)
        //     <widget-node>
        const dockPanel = document.createElement('div');
        dockPanel.className = 'lm-DockPanel';

        const tabBarContent = document.createElement('ul');
        tabBarContent.className = 'lm-TabBar-content';

        const tab = document.createElement('li');
        tab.className = 'lm-TabBar-tab';

        const labelEl = document.createElement('div');
        labelEl.className = 'lm-TabBar-tabLabel';
        labelEl.textContent = labelText;

        tab.appendChild(labelEl);
        tabBarContent.appendChild(tab);

        const widgetNode = document.createElement('div');
        dockPanel.appendChild(tabBarContent);
        dockPanel.appendChild(widgetNode);
        document.body.appendChild(dockPanel);

        return { dockPanel, tabBarContent, tab, labelEl, widgetNode };
    }

    afterEach(() => {
        // Remove all dock panels added during tests
        document.querySelectorAll('.lm-DockPanel').forEach(el => el.remove());
    });

    it('calls onToggle when the correct tab is double-clicked', () => {
        let called = 0;
        const { widgetNode, tab } = makeDOM('My File.md');
        const disposable = attachTabDblClickToggle(widgetNode, () => 'My File.md', () => { called++; });
        tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(called).to.equal(1);
        disposable.dispose();
    });

    it('does NOT call onToggle when a different tab is double-clicked', () => {
        let called = 0;
        const { widgetNode, tabBarContent } = makeDOM('Other File.md');

        // Add a second tab with a different label
        const otherTab = document.createElement('li');
        otherTab.className = 'lm-TabBar-tab';
        const otherLabel = document.createElement('div');
        otherLabel.className = 'lm-TabBar-tabLabel';
        otherLabel.textContent = 'Not My Widget';
        otherTab.appendChild(otherLabel);
        tabBarContent.appendChild(otherTab);

        attachTabDblClickToggle(widgetNode, () => 'Other File.md', () => { called++; });
        otherTab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(called).to.equal(0);
    });

    it('removes the listener after dispose()', () => {
        let called = 0;
        const { widgetNode, tab } = makeDOM('file.deck.md');
        const disposable = attachTabDblClickToggle(widgetNode, () => 'file.deck.md', () => { called++; });
        disposable.dispose();
        tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(called).to.equal(0);
    });

    it('returns early without throwing when no .lm-DockPanel ancestor exists', () => {
        const orphan = document.createElement('div');
        document.body.appendChild(orphan);
        expect(() => {
            const d = attachTabDblClickToggle(orphan, () => 'x', () => undefined);
            d.dispose();
        }).to.not.throw();
        orphan.remove();
    });
});
```

### Step 2: Run test to confirm it fails

```bash
cd /Users/Shared/dev/theia-openspace
npx mocha --spec 'extensions/openspace-core/src/**/__tests__/tab-dblclick-toggle.spec.ts'
```

Expected: FAIL — `Cannot find module '../tab-dblclick-toggle'`

### Step 3: Implement the utility

```ts
// extensions/openspace-core/src/browser/tab-dblclick-toggle.ts

/**
 * Attaches a double-click listener to the Luminous tab bar that contains
 * the given widget node. When a tab whose label matches `getLabel()` is
 * double-clicked, `onToggle()` is called.
 *
 * @param widgetNode  The widget's root DOM node (`this.node` inside a Theia widget).
 * @param getLabel    Returns the current tab label to match against.
 * @param onToggle    Callback invoked on a matching double-click.
 * @returns           A Disposable that removes the event listener.
 */
export function attachTabDblClickToggle(
    widgetNode: HTMLElement,
    getLabel: () => string,
    onToggle: () => void,
): { dispose(): void } {
    const dockPanel = widgetNode.closest('.lm-DockPanel');
    if (!dockPanel) { return { dispose: () => undefined }; }

    const tabBarContent = dockPanel.querySelector('.lm-TabBar-content');
    if (!tabBarContent) { return { dispose: () => undefined }; }

    const handler = (e: Event): void => {
        const tab = (e.target as HTMLElement).closest('.lm-TabBar-tab');
        if (!tab) { return; }
        const label = tab.querySelector('.lm-TabBar-tabLabel');
        if (label && label.textContent === getLabel()) {
            onToggle();
        }
    };

    tabBarContent.addEventListener('dblclick', handler);
    return { dispose: () => tabBarContent.removeEventListener('dblclick', handler) };
}
```

### Step 4: Run tests to confirm they pass

```bash
cd /Users/Shared/dev/theia-openspace
npx mocha --spec 'extensions/openspace-core/src/**/__tests__/tab-dblclick-toggle.spec.ts'
```

Expected: all 4 tests PASS.

### Step 5: Build `openspace-core`

```bash
cd /Users/Shared/dev/theia-openspace/extensions/openspace-core
npm run build
```

Expected: exits 0, `lib/browser/tab-dblclick-toggle.js` exists.

### Step 6: Commit

```bash
cd /Users/Shared/dev/theia-openspace
git add extensions/openspace-core/src/browser/tab-dblclick-toggle.ts \
        extensions/openspace-core/src/browser/__tests__/tab-dblclick-toggle.spec.ts \
        extensions/openspace-core/lib/
git commit -m "feat(core): add attachTabDblClickToggle shared utility"
```

---

## Task 2: Refactor `MarkdownViewerWidget` to use the shared utility

**Files:**
- Modify: `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx`

The goal is to replace the inline `attachTabDblClickListener` body with a call to the shared helper. Behaviour is unchanged — existing tests must continue to pass.

### Step 1: Update the import

In `markdown-viewer-widget.tsx`, add this import near the top (after the existing imports):

```ts
import { attachTabDblClickToggle } from 'openspace-core/lib/browser/tab-dblclick-toggle';
```

### Step 2: Replace `attachTabDblClickListener` implementation

Find the existing method (lines 209–226):

```ts
protected attachTabDblClickListener(): void {
    const dockPanel = this.node.closest('.lm-DockPanel');
    if (!dockPanel) { return; }
    const tabBarContent = dockPanel.querySelector('.lm-TabBar-content');
    if (!tabBarContent) { return; }
    const handler = (e: Event) => {
        const tab = (e.target as HTMLElement).closest('.lm-TabBar-tab');
        if (!tab) { return; }
        const label = tab.querySelector('.lm-TabBar-tabLabel');
        if (label && label.textContent === this.title.label) {
            this.toggleMode();
        }
    };
    tabBarContent.addEventListener('dblclick', handler);
    this.toDisposeOnDetach.push({ dispose: () => tabBarContent.removeEventListener('dblclick', handler) });
}
```

Replace with:

```ts
protected attachTabDblClickListener(): void {
    const disposable = attachTabDblClickToggle(
        this.node,
        () => this.title.label,
        () => this.toggleMode(),
    );
    this.toDisposeOnDetach.push(disposable);
}
```

### Step 3: Build `openspace-viewers`

```bash
cd /Users/Shared/dev/theia-openspace/extensions/openspace-viewers
npm run build
```

Expected: exits 0.

### Step 4: Run all existing viewer tests

```bash
cd /Users/Shared/dev/theia-openspace
npx mocha --spec 'extensions/openspace-viewers/src/**/__tests__/*.spec.ts'
```

Expected: all tests PASS (no behaviour change).

### Step 5: Commit

```bash
cd /Users/Shared/dev/theia-openspace
git add extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx \
        extensions/openspace-viewers/lib/
git commit -m "refactor(viewers): use shared attachTabDblClickToggle in MarkdownViewerWidget"
```

---

## Task 3: Add Monaco dependencies to `openspace-presentation`

**Files:**
- Modify: `extensions/openspace-presentation/package.json`

The presentation extension needs `@theia/monaco` to embed a Monaco editor.

### Step 1: Add the dependency

In `extensions/openspace-presentation/package.json`, add `"@theia/monaco": "1.68.2"` to `dependencies`:

```json
"dependencies": {
    "@theia/core": "1.68.2",
    "@theia/filesystem": "1.68.2",
    "@theia/monaco": "1.68.2",
    "@theia/workspace": "1.68.2",
    "dompurify": "^3.2.3",
    "openspace-core": "0.1.0",
    "openspace-settings": "0.1.0",
    "reveal.js": "^5.2.1"
}
```

### Step 2: Verify the package is already available (monorepo)

```bash
ls /Users/Shared/dev/theia-openspace/node_modules/@theia/monaco/lib/browser/monaco-editor.js
```

Expected: file exists (it's in the workspace node_modules).

### Step 3: Commit

```bash
cd /Users/Shared/dev/theia-openspace
git add extensions/openspace-presentation/package.json
git commit -m "feat(presentation): add @theia/monaco dependency for edit mode"
```

---

## Task 4: Add `toggleMode` and Monaco editor to `PresentationWidget`

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx`

This is the core change. We add `mode` state, Monaco injection, `toggleMode()`, and the tab double-click hook.

### Step 1: Add imports at the top of `presentation-widget.tsx`

After the existing imports, add:

```ts
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import { MonacoEditor, MonacoEditorServices } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoTextModelService } from '@theia/monaco/lib/browser/monaco-text-model-service';
import { IReference } from '@theia/monaco-editor-core/esm/vs/base/common/lifecycle';
import { MonacoEditorModel } from '@theia/monaco/lib/browser/monaco-editor-model';
import { attachTabDblClickToggle } from 'openspace-core/lib/browser/tab-dblclick-toggle';
```

### Step 2: Add the `ViewerMode` type and icon constants to the class

Add at the top of the class body, after the existing static `ID` and `LABEL`:

```ts
export type PresentationMode = 'presentation' | 'edit';

// Inside the class:
private static readonly ICON_PRESENTATION = 'fa fa-play-circle';
private static readonly ICON_EDIT = 'codicon codicon-edit';
```

### Step 3: Add injected services and state fields

Add inside the class body alongside the existing `@inject` fields:

```ts
protected mode: PresentationMode = 'presentation';
protected monacoEditor: MonacoEditor | undefined;
protected monacoModelRef: IReference<MonacoEditorModel> | undefined;
protected mountingEditor: boolean = false;
protected editorDisposables = new DisposableCollection();

@inject(MonacoEditorServices)
protected readonly monacoEditorServices!: MonacoEditorServices;

@inject(MonacoTextModelService)
protected readonly textModelService!: MonacoTextModelService;

@inject(FileService)
protected readonly fileService!: FileService;
```

### Step 4: Add `getMode()` and `toggleMode()` public methods

```ts
getMode(): PresentationMode {
    return this.mode;
}

toggleMode(): void {
    if (this.mode === 'presentation') {
        this.mode = 'edit';
        // Tear down reveal so it doesn't fight Monaco over the DOM
        if (this.revealDeck) {
            this.revealDeck.destroy();
            this.revealDeck = undefined;
            this.navigationService?.setReveal(undefined);
        }
    } else {
        // Capture any edits before destroying Monaco
        if (this.monacoEditor) {
            this.deckContent = this.monacoEditor.document.getText();
        }
        this.destroyMonacoEditor();
        this.mode = 'presentation';
    }
    this.title.iconClass = this.mode === 'edit'
        ? PresentationWidget.ICON_EDIT
        : PresentationWidget.ICON_PRESENTATION;
    this.update();
}
```

### Step 5: Add Monaco lifecycle helpers (mirror of MarkdownViewerWidget)

```ts
protected destroyMonacoEditor(): void {
    this.editorDisposables.dispose();
    this.editorDisposables = new DisposableCollection();
    if (this.monacoEditor) {
        this.monacoEditor.dispose();
        this.monacoEditor = undefined;
    }
    if (this.monacoModelRef) {
        this.monacoModelRef.dispose();
        this.monacoModelRef = undefined;
    }
}

protected async mountMonacoEditor(container: HTMLDivElement): Promise<void> {
    if (!this.uri || this.mountingEditor) { return; }
    this.mountingEditor = true;
    try {
        const uri = new URI(this.uri);
        const ref = await this.textModelService.createModelReference(uri);
        this.monacoModelRef = ref;
        ref.object.suppressOpenEditorWhenDirty = true;
        const loadedDoc = await ref.object.load();
        const textModel = loadedDoc.textEditorModel;

        this.monacoEditor = await MonacoEditor.create(
            uri,
            ref.object,
            container,
            this.monacoEditorServices,
            {
                model: textModel,
                language: 'markdown',
                autoSizing: false,
                minHeight: -1,
            }
        );
        this.monacoEditor.getControl().layout();

        let saveTimer: ReturnType<typeof setTimeout> | undefined;
        this.editorDisposables.push(
            this.monacoEditor.document.onDidChangeContent(() => {
                if (saveTimer) { clearTimeout(saveTimer); }
                saveTimer = setTimeout(() => {
                    this.saveCurrentContent().catch(err =>
                        console.warn('[PresentationWidget] Auto-save failed:', err)
                    );
                }, 1000);
            })
        );
    } finally {
        this.mountingEditor = false;
    }
}

protected async saveCurrentContent(): Promise<void> {
    if (!this.monacoEditor || !this.uri) { return; }
    const text = this.monacoEditor.document.getText();
    const uri = new URI(this.uri);
    await this.fileService.write(uri, text);
}
```

### Step 6: Hook double-click in `onAfterAttach`

Update the existing `onAfterAttach`:

```ts
protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    if (this.mode === 'presentation') {
        this.writeSlidesDom();
        this.initializeReveal().catch(err =>
            console.error('[PresentationWidget] Failed to initialize reveal.js:', err)
        );
    }
    const disposable = attachTabDblClickToggle(
        this.node,
        () => this.title.label,
        () => this.toggleMode(),
    );
    this.toDisposeOnDetach.push(disposable);
}
```

> **Note:** The original `onAfterAttach` called `writeSlidesDom()` and `initializeReveal()` unconditionally. Wrap those in `if (this.mode === 'presentation')` so that re-attaching in edit mode doesn't restart the presentation.

### Step 7: Update `onBeforeDetach` to also destroy Monaco

```ts
protected onBeforeDetach(msg: Message): void {
    this.destroyMonacoEditor();
    if (this.revealDeck) {
        this.revealDeck.destroy();
        this.revealDeck = undefined;
    }
    this.navigationService?.setReveal(undefined);
    super.onBeforeDetach(msg);
}
```

### Step 8: Update `render()` to branch on mode

```ts
protected render(): React.ReactNode {
    if (this.mode === 'edit') {
        return this.renderEditor();
    }
    return this.renderPresentation();
}

protected renderPresentation(): React.ReactNode {
    return (
        <div className="presentation-container" ref={this.containerRef}>
            <div className="reveal">
                <div className="slides">
                    {/* Populated imperatively by writeSlidesDom() */}
                </div>
            </div>
        </div>
    );
}

protected renderEditor(): React.ReactNode {
    return (
        <div
            className="presentation-editor-container"
            ref={(el) => {
                if (el && !this.monacoEditor && !this.mountingEditor) {
                    this.mountMonacoEditor(el).catch(err =>
                        console.error('[PresentationWidget] Monaco mount failed:', err)
                    );
                }
            }}
        />
    );
}
```

Rename the existing `render()` contents to `renderPresentation()` by extracting them as shown above.

### Step 9: Build `openspace-presentation`

```bash
cd /Users/Shared/dev/theia-openspace/extensions/openspace-presentation
npm run build
```

Expected: exits 0.

### Step 10: Run presentation tests

```bash
cd /Users/Shared/dev/theia-openspace
npx mocha --spec 'extensions/openspace-presentation/src/**/__tests__/*.spec.ts'
```

Expected: all existing tests PASS (the new editor path is DOM-only, not covered by unit tests; it is verified by manual smoke test).

### Step 11: Commit

```bash
cd /Users/Shared/dev/theia-openspace
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx \
        extensions/openspace-presentation/lib/
git commit -m "feat(presentation): add double-click tab toggle between presentation and edit mode"
```

---

## Task 5: Add toolbar button to `openspace-presentation`

**Files:**
- Create: `extensions/openspace-presentation/src/browser/presentation-toolbar-contribution.ts`
- Modify: `extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts`

This mirrors `MarkdownViewerToolbarContribution` — a pencil/play toggle button in the tab toolbar for discoverability.

### Step 1: Create the toolbar contribution

```ts
// extensions/openspace-presentation/src/browser/presentation-toolbar-contribution.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, Command } from '@theia/core/lib/common/command';
import { TabBarToolbarContribution, TabBarToolbarRegistry } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { ApplicationShell, Widget } from '@theia/core/lib/browser';
import { PresentationWidget } from './presentation-widget';

export const PresentationToolbarCommands = {
    TOGGLE_MODE: {
        id: 'openspace.presentation.toggleMode',
        label: 'Toggle Presentation / Edit',
    } as Command,
};

@injectable()
export class PresentationToolbarContribution
    implements CommandContribution, TabBarToolbarContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(PresentationToolbarCommands.TOGGLE_MODE, {
            isEnabled: (widget: Widget) => widget instanceof PresentationWidget,
            execute: (widget: Widget) => {
                if (widget instanceof PresentationWidget && !widget.isDisposed) {
                    widget.toggleMode();
                }
            },
        });
    }

    registerToolbarItems(registry: TabBarToolbarRegistry): void {
        registry.registerItem({
            id: PresentationToolbarCommands.TOGGLE_MODE.id,
            command: PresentationToolbarCommands.TOGGLE_MODE.id,
            tooltip: 'Toggle Presentation / Edit',
            icon: () => {
                const widget = this.shell.currentWidget;
                if (!(widget instanceof PresentationWidget) || widget.isDisposed) {
                    return 'codicon codicon-edit';
                }
                return widget.getMode() === 'presentation'
                    ? 'codicon codicon-edit'
                    : 'fa fa-play-circle';
            },
            group: 'navigation',
            priority: 0,
            isVisible: (widget: Widget) => widget instanceof PresentationWidget,
        });
    }
}
```

### Step 2: Register in the frontend module

In `openspace-presentation-frontend-module.ts`, add the imports and bindings:

```ts
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { PresentationToolbarContribution } from './presentation-toolbar-contribution';

// Inside the ContainerModule callback, add:
bind(PresentationToolbarContribution).toSelf().inSingletonScope();
bind(CommandContribution).toService(PresentationToolbarContribution);
bind(TabBarToolbarContribution).toService(PresentationToolbarContribution);
```

### Step 3: Build

```bash
cd /Users/Shared/dev/theia-openspace/extensions/openspace-presentation
npm run build
```

Expected: exits 0.

### Step 4: Run all tests

```bash
cd /Users/Shared/dev/theia-openspace
npx mocha --spec 'extensions/**/__tests__/*.spec.ts'
```

Expected: all tests PASS.

### Step 5: Commit

```bash
cd /Users/Shared/dev/theia-openspace
git add extensions/openspace-presentation/src/browser/presentation-toolbar-contribution.ts \
        extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts \
        extensions/openspace-presentation/lib/
git commit -m "feat(presentation): add toolbar toggle button for presentation/edit mode"
```

---

## Task 6: Add CSS for the Monaco editor container in the presentation widget

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/style/presentation-widget.css`

The Monaco container must fill the full widget area (the same requirement the MD viewer's `.markdown-viewer-editor-container` has).

### Step 1: Inspect the existing CSS

Read `extensions/openspace-presentation/src/browser/style/presentation-widget.css` to see current rules.

### Step 2: Add the editor container rule

Append to the CSS file:

```css
/* Edit mode: Monaco editor fills the widget */
.openspace-presentation-widget .presentation-editor-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
}
```

### Step 3: Build

```bash
cd /Users/Shared/dev/theia-openspace/extensions/openspace-presentation
npm run build
```

### Step 4: Commit

```bash
cd /Users/Shared/dev/theia-openspace
git add extensions/openspace-presentation/src/browser/style/presentation-widget.css \
        extensions/openspace-presentation/lib/browser/style/presentation-widget.css
git commit -m "feat(presentation): style Monaco editor container for edit mode"
```

---

## Task 7: Manual smoke test

No automated test covers the full DOM round-trip (Reveal.js + Monaco in a real browser). Verify manually:

1. Start the app: `yarn start` (or whatever the dev start command is).
2. Open a `.deck.md` file from the file tree — confirm the Reveal.js presentation loads.
3. Double-click the tab — confirm the Monaco editor appears with the raw markdown.
4. Edit some text — after ~1 second confirm the file is auto-saved (check modification time or file watcher).
5. Double-click the tab again — confirm Reveal.js re-renders with the edited content.
6. Open a regular `.md` file and verify its double-click toggle still works (regression check).
7. Verify the toolbar pencil/play icon appears for `.deck.md` tabs and toggles correctly.

---

## Summary of files changed

| File | Change |
|------|--------|
| `extensions/openspace-core/src/browser/tab-dblclick-toggle.ts` | **New** — shared utility |
| `extensions/openspace-core/src/browser/__tests__/tab-dblclick-toggle.spec.ts` | **New** — unit tests |
| `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx` | Refactor to use shared utility |
| `extensions/openspace-presentation/package.json` | Add `@theia/monaco` dep |
| `extensions/openspace-presentation/src/browser/presentation-widget.tsx` | Add `mode`, `toggleMode()`, Monaco editor |
| `extensions/openspace-presentation/src/browser/presentation-toolbar-contribution.ts` | **New** — toolbar toggle button |
| `extensions/openspace-presentation/src/browser/openspace-presentation-frontend-module.ts` | Register toolbar contribution |
| `extensions/openspace-presentation/src/browser/style/presentation-widget.css` | Add editor container styles |
