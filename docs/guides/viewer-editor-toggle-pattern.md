# Viewer-Editor Toggle Pattern

This guide explains how to implement a double-click-tab toggle between a read-only viewer mode and a Monaco text editor in a Theia widget. It documents the pattern used by `MarkdownViewerWidget` and `PresentationWidget`, and shows how to apply it to new file format extensions.

---

## What the pattern does

- A widget opens a file in a **viewer** mode (rendered HTML, Reveal.js presentation, etc.).
- Double-clicking the widget's tab (or clicking a toolbar button) switches to **edit** mode, which embeds a Monaco editor on the file.
- Edits are **auto-saved** to disk after a 1-second debounce.
- Double-clicking the tab again (or clicking the toolbar button) returns to viewer mode, re-rendering from the (possibly updated) file content.
- The tab icon changes to indicate the current mode.

---

## Shared infrastructure in `openspace-core`

### `attachTabDblClickToggle`

**Location:** `extensions/openspace-core/src/browser/tab-dblclick-toggle.ts`

```ts
import { attachTabDblClickToggle } from 'openspace-core/lib/browser/tab-dblclick-toggle';
```

**Signature:**

```ts
function attachTabDblClickToggle(
    widgetNode: HTMLElement,   // this.node inside a Theia widget
    getLabel: () => string,    // returns the current tab label to match
    onToggle: () => void,      // called when a matching dblclick fires
): { dispose(): void }
```

**What it does internally:**

1. Walks up from `widgetNode` to find the nearest `.lm-DockPanel` ancestor.
2. Queries `.lm-TabBar-content` inside that panel.
3. Attaches a `dblclick` listener; on each click it checks whether the clicked `.lm-TabBar-tab`'s `.lm-TabBar-tabLabel` text equals `getLabel()`.
4. Returns a disposable — call `.dispose()` to remove the listener.

**Unit tests:** `extensions/openspace-core/src/browser/__tests__/tab-dblclick-toggle.spec.ts`

---

## How to implement the pattern in a new widget

### 1. Add dependencies to `package.json`

Your extension's `package.json` needs:

```json
"dependencies": {
    "@theia/filesystem": "1.68.2",
    "@theia/monaco": "1.68.2",
    "openspace-core": "0.1.0"
}
```

### 2. Add imports to your widget file

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

### 3. Add the mode type and icon constants

```ts
export type MyWidgetMode = 'preview' | 'edit';   // or 'presentation' | 'edit', etc.
```

Inside the class:

```ts
private static readonly ICON_VIEW = 'codicon codicon-markdown';   // your viewer icon
private static readonly ICON_EDIT = 'codicon codicon-edit';
```

### 4. Inject services and add state fields

```ts
protected mode: MyWidgetMode = 'preview';
protected monacoEditor: MonacoEditor | undefined;
protected monacoModelRef: IReference<MonacoEditorModel> | undefined;
protected mountingEditor: boolean = false;
protected editorDisposables = new DisposableCollection();

// Wherever your widget stores the file URI:
public uri: string = '';

@inject(MonacoEditorServices)
protected readonly monacoEditorServices!: MonacoEditorServices;

@inject(MonacoTextModelService)
protected readonly textModelService!: MonacoTextModelService;

@inject(FileService)
protected readonly fileService!: FileService;
```

### 5. Implement `getMode()` and `toggleMode()`

```ts
getMode(): MyWidgetMode {
    return this.mode;
}

toggleMode(): void {
    if (this.mode === 'preview') {
        this.mode = 'edit';
        // Tear down your viewer here (e.g. destroy Reveal.js)
    } else {
        // Capture edits from Monaco before destroying it
        if (this.monacoEditor) {
            this.viewerContent = this.monacoEditor.document.getText();
        }
        this.destroyMonacoEditor();
        this.mode = 'preview';
    }
    this.title.iconClass = this.mode === 'edit'
        ? MyWidget.ICON_EDIT
        : MyWidget.ICON_VIEW;
    this.update();  // triggers re-render
}
```

### 6. Implement Monaco lifecycle helpers

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
            uri, ref.object, container, this.monacoEditorServices,
            { model: textModel, language: 'markdown', autoSizing: false, minHeight: -1 }
        );
        this.monacoEditor.getControl().layout();

        // 1-second auto-save debounce
        let saveTimer: ReturnType<typeof setTimeout> | undefined;
        this.editorDisposables.push(
            this.monacoEditor.document.onDidChangeContent(() => {
                if (saveTimer) { clearTimeout(saveTimer); }
                saveTimer = setTimeout(() => {
                    this.saveCurrentContent().catch(err =>
                        console.warn('[MyWidget] Auto-save failed:', err)
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
    await this.fileService.write(new URI(this.uri), text);
}
```

### 7. Hook up `onAfterAttach` and `onBeforeDetach`

```ts
protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    if (this.mode === 'preview') {
        this.renderViewer();   // your viewer initialization
    }
    // Attach the tab double-click toggle
    const disposable = attachTabDblClickToggle(
        this.node,
        () => this.title.label,
        () => this.toggleMode(),
    );
    this.toDisposeOnDetach.push(disposable);
}

protected onBeforeDetach(msg: Message): void {
    this.destroyMonacoEditor();
    // Tear down your viewer here
    super.onBeforeDetach(msg);
}
```

### 8. Update `render()` to branch on mode

```ts
protected render(): React.ReactNode {
    if (this.mode === 'edit') {
        return this.renderEditor();
    }
    return this.renderViewer();
}

protected renderViewer(): React.ReactNode {
    return (
        <div className="my-widget-container" ref={this.containerRef}>
            {/* your viewer markup */}
        </div>
    );
}

protected renderEditor(): React.ReactNode {
    return (
        <div
            className="my-widget-editor-container"
            ref={(el) => {
                if (el && !this.monacoEditor && !this.mountingEditor) {
                    this.mountMonacoEditor(el as HTMLDivElement).catch(err =>
                        console.error('[MyWidget] Monaco mount failed:', err)
                    );
                }
            }}
        />
    );
}
```

### 9. Add CSS for the editor container

```css
/* Edit mode: Monaco editor fills the widget */
.my-widget .my-widget-editor-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
}
```

### 10. Add a toolbar button (optional but recommended)

Create a `MyWidgetToolbarContribution` implementing both `CommandContribution` and `TabBarToolbarContribution`. See `PresentationToolbarContribution` (`extensions/openspace-presentation/src/browser/presentation-toolbar-contribution.ts`) for a complete working example.

Register it in your frontend module:

```ts
bind(MyWidgetToolbarContribution).toSelf().inSingletonScope();
bind(CommandContribution).toService(MyWidgetToolbarContribution);
bind(TabBarToolbarContribution).toService(MyWidgetToolbarContribution);
```

---

## Reference implementations

| Extension | Widget file | Toolbar contribution |
|-----------|-------------|----------------------|
| `openspace-viewers` | `markdown-viewer-widget.tsx` | `markdown-viewer-toolbar-contribution.ts` |
| `openspace-presentation` | `presentation-widget.tsx` | `presentation-toolbar-contribution.ts` |

---

## Key design decisions

**Why destroy-and-replace instead of side-by-side panels?**
Keeping both Reveal.js and Monaco alive simultaneously causes DOM conflicts and unnecessary memory use. Destroying the viewer on entry to edit mode and destroying Monaco on return to viewer mode is the cleanest approach.

**Why `toDisposeOnDetach` for the tab listener?**
Theia's `ReactWidget` calls `onBeforeDetach` and processes `toDisposeOnDetach` automatically when a widget is removed from the shell. This ensures no stale event listeners remain when the widget is closed or moved.

**Why `suppressOpenEditorWhenDirty`?**
Without this, Theia may open a second editor tab when the Monaco model becomes dirty. Setting it prevents that surprise.

**Why `mountingEditor` guard?**
React may call the `ref` callback more than once during reconciliation. The guard prevents a second `mountMonacoEditor` call if the first one is still in flight.
