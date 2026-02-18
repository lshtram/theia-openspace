# Presentation Modality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the presentation modality work end-to-end: 10 MCP tools, a reveal.js widget that opens in a Theia pane, correct play/pause/stop autoplay semantics, fullscreen toggle, RevealMarkdown plugin replacing the hand-rolled parser, and live reload on `.deck.md` file changes.

**Architecture:** Agent calls MCP tools in `hub-mcp.ts` → `executeViaBridge()` → `opencode-sync-service.ts` → `CommandRegistry` → `PresentationCommandContribution` → `PresentationService` (FileService) / `PresentationWidget` (reveal.js DOM). All file I/O uses Theia `FileService` (consistent with all other modalities).

**Tech Stack:** TypeScript, Theia (ApplicationShell, FileService, WorkspaceService, WidgetManager, CommandRegistry), reveal.js 5.x, RevealMarkdown plugin (bundled inside reveal.js npm package), DOMPurify.

**Design doc:** `docs/plans/2026-02-19-presentation-modality-design.md`

---

## Build Commands

```bash
# Build the presentation extension
cd extensions/openspace-presentation && npm run build

# Build openspace-core
cd extensions/openspace-core && npm run build

# Build the browser-app (full)
cd browser-app && yarn build

# Type-check only (faster)
cd extensions/openspace-presentation && npx tsc --noEmit
cd extensions/openspace-core && npx tsc --noEmit
```

---

## Task 1: Update reveal.js type declarations for RevealMarkdown plugin

**Files:**
- Modify: `extensions/openspace-presentation/src/types/reveal.js.d.ts`

The existing file declares `Reveal` as the default export but has no declaration for the `RevealMarkdown` plugin. We need to add a named export so TypeScript accepts `import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js'`.

**Step 1: Read the current type file**

Read `extensions/openspace-presentation/src/types/reveal.js.d.ts`. Current content (33 lines):
```ts
declare module 'reveal.js' {
  interface RevealOptions { hash, slideNumber, transition, backgroundTransition, keyboard, [key: string]: unknown }
  class Reveal { constructor(element, options?); initialize(): Promise<void>; sync(); layout(); destroy(); slide(h,v?,f?,silent?); next(); prev(); nextFragment(); prevFragment(); getIndices(); getSlide(); getCurrentSlide(); getConfig(); }
  export default Reveal;
}
```

**Step 2: Add RevealMarkdown module declaration**

Add a new `declare module` block for the markdown plugin path. Append to the file:

```ts
declare module 'reveal.js/plugin/markdown/markdown.esm.js' {
    interface RevealPlugin {
        id: string;
        init(deck: import('reveal.js').default): void | Promise<void>;
    }
    const RevealMarkdown: RevealPlugin;
    export default RevealMarkdown;
}
```

**Step 3: Type-check**

```bash
cd extensions/openspace-presentation && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**
```bash
git add extensions/openspace-presentation/src/types/reveal.js.d.ts
git commit -m "feat(presentation): add RevealMarkdown plugin type declaration"
```

---

## Task 2: Switch PresentationWidget to RevealMarkdown + wire navigationService

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx`

Three sub-changes: (a) import RevealMarkdown, (b) change slide rendering to `data-markdown` sections, (c) call `navigationService.setReveal()` after `initialize()`.

**Step 1: Read the current widget file**

Read `extensions/openspace-presentation/src/browser/presentation-widget.tsx` lines 1–100 to confirm imports.

**Step 2: Add RevealMarkdown import**

At the top of the file, after `import Reveal from 'reveal.js';`, add:
```ts
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js';
```

Also add CSS imports (reveal.js ships CSS in its npm package):
```ts
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';
```

**Step 3: Update initializeReveal() to use RevealMarkdown plugin and call setReveal()**

Current `initializeReveal()` (lines 154–181) creates `new Reveal(deckElement, options)` and calls `deck.initialize()`. No plugin, no `setReveal()` call.

Change it to:
```ts
protected async initializeReveal(): Promise<void> {
    const container = this.containerRef?.current;
    if (!container) { return; }
    const deckElement = container.querySelector('.reveal');
    if (!deckElement) { return; }

    if (this.revealDeck) {
        this.revealDeck.destroy();
        this.revealDeck = undefined;
    }

    const deck = this.parseDeckContent(this.deckContent);
    const options = deck.options;

    this.revealDeck = new Reveal(deckElement as HTMLElement, {
        hash: false,
        slideNumber: true,
        keyboard: false,
        embedded: true,
        margin: 0.04,
        width: '100%',
        height: '100%',
        center: true,
        transition: options.transition ?? 'slide',
        backgroundTransition: 'fade',
        plugins: [RevealMarkdown],
    });

    await this.revealDeck.initialize();
    this.navigationService.setReveal(this.revealDeck);
}
```

**Step 4: Update render() to use data-markdown sections**

Current `render()` (lines 183–219) builds:
```tsx
<section data-notes={notes}><div dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml(content)) }} /></section>
```

Change slides to use RevealMarkdown's native format:
```tsx
{slides.map((slide, i) => (
    <section
        key={i}
        data-markdown=""
        data-notes={slide.notes ?? ''}
    >
        <script type="text/template">{slide.content}</script>
    </section>
))}
```

Note: `data-markdown=""` (empty string attribute) is how reveal.js detects markdown sections in HTML-constructed DOM. The raw markdown goes inside `<script type="text/template">` — RevealMarkdown processes it at initialize time.

Also expose a `revealContainer` getter for the fullscreen toggle:
```ts
get revealContainer(): HTMLElement | null {
    return this.containerRef?.current ?? null;
}
```

**Step 5: Build and check**

```bash
cd extensions/openspace-presentation && npm run build
```
Expected: no TypeScript errors.

**Step 6: Commit**
```bash
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx
git commit -m "feat(presentation): use RevealMarkdown plugin, wire navigationService.setReveal"
```

---

## Task 3: Fix openPresentation() — add shell.addWidget() and remove duplicate read

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts`

Current `openPresentation()` (lines 327–363) calls `widgetManager.getOrCreateWidget()` then `widget.activate()` but never calls `shell.addWidget()`, so the widget is created but never appears in the Theia layout.

Also: it calls `this.fileService.read(uri)` directly (line 335) even though `PresentationService.readPresentation()` already does the same thing — this duplicates logic outside the service.

**Step 1: Read the relevant lines**

Read `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts` lines 1–60 (imports + class fields) and lines 327–363 (`openPresentation`).

**Step 2: Inject ApplicationShell**

The class constructor/fields need `@inject(ApplicationShell) protected readonly shell: ApplicationShell`. Check current injected fields. If `ApplicationShell` is not already injected, add:

```ts
@inject(ApplicationShell)
protected readonly shell: ApplicationShell;
```

And add to imports at top:
```ts
import { ApplicationShell } from '@theia/core/lib/browser';
```

**Step 3: Rewrite openPresentation()**

Replace the method body with:

```ts
protected async openPresentation(args: PresentationOpenArgs): Promise<void> {
    const { path, splitDirection } = args;

    // Use service (not raw fileService.read) to avoid duplicate read logic
    const { content, data } = await this.presentationService.readPresentation(path);

    const widget = await this.widgetManager.getOrCreateWidget<PresentationWidget>(
        PresentationWidget.ID,
        { uri: path }
    );

    // Map splitDirection to Theia shell area/mode
    const area: ApplicationShell.Area = splitDirection === 'bottom' ? 'bottom' : 'main';
    const mode: ApplicationShell.WidgetOptions['mode'] =
        splitDirection === 'left'    ? 'split-left'  :
        splitDirection === 'bottom'  ? 'tab-after'   :
        splitDirection === 'new-tab' ? 'tab-after'   :
        'split-right'; // default

    this.shell.addWidget(widget, { area, mode });

    widget.setContent(content);
    await widget.activate();

    this.presentationService.setActivePresentation(path);
    this.presentationService.setPlaybackState({
        isPlaying: false,
        isPaused: false,
        currentSlide: 0,
        totalSlides: data.slides.length,
    });
}
```

**Step 4: Build and check**

```bash
cd extensions/openspace-presentation && npm run build
```
Expected: no TypeScript errors.

**Step 5: Commit**
```bash
git add extensions/openspace-presentation/src/browser/presentation-command-contribution.ts
git commit -m "fix(presentation): add shell.addWidget() in openPresentation, use service for read"
```

---

## Task 4: Fix play/pause/stop semantics + add toggleFullscreen command

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts`
- Modify: `extensions/openspace-presentation/src/browser/presentation-service.ts` (add `autoplayTimer` field or keep it on the contribution — keep on contribution since it's UI state)

Current problems:
- `playPresentation()` (line 391) calls `navigationService.toggleFullscreen()` — wrong
- `pausePresentation()` (line 407) only sets state — no timer
- `stopPresentation()` (line 420) calls `document.exitFullscreen()` — wrong (fullscreen is separate)
- No `toggleFullscreen` command exists

**Step 1: Add autoplay timer field to the contribution class**

Add a private field:
```ts
private autoplayTimer: ReturnType<typeof setInterval> | undefined;
```

**Step 2: Rewrite playPresentation()**

```ts
protected playPresentation(args: PresentationPlayArgs): void {
    const interval = args.interval ?? 5000;
    if (this.autoplayTimer !== undefined) {
        clearInterval(this.autoplayTimer);
    }
    this.autoplayTimer = setInterval(() => {
        this.navigationService.next();
    }, interval);
    this.presentationService.setPlaybackState({
        ...this.presentationService.getPlaybackState(),
        isPlaying: true,
        isPaused: false,
    });
}
```

**Step 3: Rewrite pausePresentation()**

```ts
protected pausePresentation(): void {
    if (this.autoplayTimer !== undefined) {
        clearInterval(this.autoplayTimer);
        this.autoplayTimer = undefined;
    }
    this.presentationService.setPlaybackState({
        ...this.presentationService.getPlaybackState(),
        isPlaying: false,
        isPaused: true,
    });
}
```

**Step 4: Rewrite stopPresentation()**

```ts
protected stopPresentation(): void {
    if (this.autoplayTimer !== undefined) {
        clearInterval(this.autoplayTimer);
        this.autoplayTimer = undefined;
    }
    this.navigationService.slide(0, 0);
    this.presentationService.setPlaybackState({
        isPlaying: false,
        isPaused: false,
        currentSlide: 0,
        totalSlides: this.presentationService.getPlaybackState().totalSlides,
    });
}
```

**Step 5: Add PRESENTATION_TOGGLE_FULLSCREEN command ID**

In the `PresentationCommandIds` const (lines 39–49), add:
```ts
TOGGLE_FULLSCREEN: 'openspace.presentation.toggleFullscreen',
```

Also add a command schema entry in `PresentationArgumentSchemas` (empty object — no args):
```ts
TOGGLE_FULLSCREEN: {},
```

**Step 6: Register toggleFullscreen command in registerCommands()**

```ts
registry.registerCommand(
    { id: PresentationCommandIds.TOGGLE_FULLSCREEN, label: 'Presentation: Toggle Fullscreen' },
    { execute: () => this.toggleFullscreen() }
);
```

Add keybinding in `registerKeybindings()` (or add `registerKeybindings` if not present):
```ts
registry.registerKeybinding({
    command: PresentationCommandIds.TOGGLE_FULLSCREEN,
    keybinding: 'ctrlcmd+shift+f',
});
```

**Step 7: Implement toggleFullscreen()**

```ts
protected toggleFullscreen(): void {
    // Use the active presentation widget's container
    const widget = this.widgetManager.tryGetWidget<PresentationWidget>(PresentationWidget.ID);
    const container = widget?.revealContainer;
    if (!container) { return; }
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        container.requestFullscreen();
    }
}
```

**Step 8: Build and check**

```bash
cd extensions/openspace-presentation && npm run build
```
Expected: no TypeScript errors.

**Step 9: Commit**
```bash
git add extensions/openspace-presentation/src/browser/presentation-command-contribution.ts
git commit -m "feat(presentation): fix play/pause/stop autoplay semantics, add toggleFullscreen command"
```

---

## Task 5: Fix PaneService — wire type=presentation to presentation.open command

**Files:**
- Modify: `extensions/openspace-core/src/browser/pane-service.ts`

Current `openContent()` for `type === 'presentation'` (lines 275–284) falls through to a stub and returns `{ success: false }`. We need it to dispatch to `openspace.presentation.open` via the `CommandRegistry`.

**Step 1: Read pane-service.ts lines 160–295**

Read `extensions/openspace-core/src/browser/pane-service.ts` lines 160–295 to see the current class fields and `openContent()` implementation.

**Step 2: Inject CommandRegistry if not already present**

Check if `CommandRegistry` is already injected. If not, add:
```ts
@inject(CommandRegistry)
protected readonly commandRegistry: CommandRegistry;
```

And import:
```ts
import { CommandRegistry } from '@theia/core/lib/common';
```

**Step 3: Replace the presentation stub in openContent()**

Find and replace the `type === 'presentation'` branch (currently falls through to getAreaForType fallback). Replace with:

```ts
if (args.type === 'presentation') {
    await this.commandRegistry.executeCommand(
        'openspace.presentation.open',
        {
            path: args.contentId,
            splitDirection: args.splitDirection,
        }
    );
    return { success: true };
}
```

Do the same for `type === 'whiteboard'` if it has the same stub (replace with a whiteboard command dispatch when that is implemented — for now just leave whiteboard stub as-is).

**Step 4: Build openspace-core**

```bash
cd extensions/openspace-core && npm run build
```
Expected: no TypeScript errors.

**Step 5: Commit**
```bash
git add extensions/openspace-core/src/browser/pane-service.ts
git commit -m "fix(pane-service): wire type=presentation to openspace.presentation.open command"
```

---

## Task 6: Fix listPresentations() stub

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-service.ts`

Current `listPresentations()` (lines 53–63) returns only the workspace root as a string — it does not enumerate files.

**Step 1: Read presentation-service.ts lines 17–110**

Confirm imports and the current `listPresentations()` body.

**Step 2: Rewrite listPresentations()**

Use `FileService` + `WorkspaceService` to find all `*.deck.md` files:

```ts
async listPresentations(): Promise<string[]> {
    const roots = await this.workspaceService.roots;
    if (!roots.length) { return []; }
    const rootUri = new URI(roots[0].resource.toString());

    // Use FileStat-based recursive search via resolveDirectory
    const results: string[] = [];
    await this.collectDeckFiles(rootUri, results);
    return results;
}

private async collectDeckFiles(dirUri: URI, results: string[]): Promise<void> {
    try {
        const stat = await this.fileService.resolve(dirUri, { resolveChildren: true });
        if (!stat.children) { return; }
        for (const child of stat.children) {
            if (child.isDirectory) {
                // Skip node_modules and hidden dirs
                const name = child.resource.path.base;
                if (name === 'node_modules' || name.startsWith('.')) { continue; }
                await this.collectDeckFiles(child.resource, results);
            } else if (child.resource.path.toString().endsWith(DECK_EXTENSION)) {
                results.push(child.resource.path.toString());
            }
        }
    } catch {
        // Directory not readable — skip
    }
}
```

Note: `FileService.resolve()` with `{ resolveChildren: true }` is available in Theia 1.68. Confirm the import of `URI` from `@theia/core/lib/common`.

**Step 3: Build and check**

```bash
cd extensions/openspace-presentation && npm run build
```

**Step 4: Commit**
```bash
git add extensions/openspace-presentation/src/browser/presentation-service.ts
git commit -m "feat(presentation): implement real listPresentations() using FileService"
```

---

## Task 7: Add file watch / live reload

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-service.ts`
- Modify: `extensions/openspace-presentation/src/browser/presentation-widget.tsx` (add `reload()` method)

**Step 1: Add reload() method to PresentationWidget**

In `presentation-widget.tsx`, add a public `reload()` method:
```ts
async reload(): Promise<void> {
    if (!this.uri) { return; }
    // Re-read content from disk via the service
    // The widget stores raw deckContent string — just re-call setContent + re-init
    // Caller (PresentationService) is responsible for providing new content
}
```

Actually the cleaner design: `PresentationService` watches the file, reads new content, then calls `widget.setContent(newContent)` which already calls `this.update()` and re-calls `initializeReveal()` if attached. So `reload()` is not needed — `setContent()` already does the right thing.

**Step 2: Add watch logic to PresentationService**

Add a `watchActivePresentation()` method, called from `setActivePresentation()`:

```ts
private watchDisposable: Disposable | undefined;

setActivePresentation(path: string): void {
    this.activePresentationPath = path;
    this.startWatching(path);
}

private async startWatching(path: string): Promise<void> {
    // Clean up previous watch
    this.watchDisposable?.dispose();

    const uri = new URI(path);
    const watchId = await this.fileService.watch(uri);

    const listener = this.fileService.onDidFilesChange(event => {
        const changed = event.changes.find(c =>
            c.resource.toString() === uri.toString()
        );
        if (!changed) { return; }
        // Re-read and push to active widget
        this.reloadActiveWidget(path);
    });

    this.watchDisposable = {
        dispose: () => {
            this.fileService.unwatch(watchId);
            listener.dispose();
        }
    };
}

private async reloadActiveWidget(path: string): Promise<void> {
    try {
        const { content } = await this.readPresentation(path);
        // Emit an event so the widget can react
        this.onDidChangeEmitter.fire({ path, content });
    } catch {
        // File deleted or unreadable — ignore
    }
}
```

Add an event emitter:
```ts
private readonly onDidChangeEmitter = new Emitter<{ path: string; content: string }>();
readonly onDidChange = this.onDidChangeEmitter.event;
```

Import `Emitter` and `Disposable` from `@theia/core/lib/common`.

**Step 3: Subscribe in PresentationCommandContribution**

In `PresentationCommandContribution`, after injecting `PresentationService`, subscribe to `onDidChange` in a `@postConstruct init()`:

```ts
@postConstruct()
protected init(): void {
    this.presentationService.onDidChange(async ({ path, content }) => {
        const widget = this.widgetManager.tryGetWidget<PresentationWidget>(PresentationWidget.ID);
        if (widget && widget.uri === path) {
            widget.setContent(content);
        }
    });
}
```

**Step 4: Build and check**

```bash
cd extensions/openspace-presentation && npm run build
```

**Step 5: Commit**
```bash
git add extensions/openspace-presentation/src/browser/presentation-widget.tsx \
        extensions/openspace-presentation/src/browser/presentation-service.ts \
        extensions/openspace-presentation/src/browser/presentation-command-contribution.ts
git commit -m "feat(presentation): add live reload on .deck.md file changes"
```

---

## Task 8: Add registerPresentationTools() in hub-mcp.ts

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`

Add 10 MCP tools. All route via `executeViaBridge`. Add call to `registerPresentationTools(server)` inside `registerToolsOn()`.

**Step 1: Read hub-mcp.ts lines 128–180**

Confirm the `registerToolsOn()` method and one existing tool registration (e.g. `registerPaneTools`) to match the exact code pattern.

**Step 2: Add registerPresentationTools() call in registerToolsOn()**

```ts
private registerToolsOn(server: any): void {
    this.registerPaneTools(server);
    this.registerEditorTools(server);
    this.registerTerminalTools(server);
    this.registerFileTools(server);
    this.registerPresentationTools(server);  // ADD THIS LINE
}
```

**Step 3: Implement registerPresentationTools()**

Add as a new private method after `registerFileTools`:

```ts
// ─── Presentation Tools (10) ─────────────────────────────────────────────

private registerPresentationTools(server: any): void {
    server.tool(
        'openspace.presentation.list',
        'List all .deck.md presentation files in the workspace',
        {},
        async (args: any) => this.executeViaBridge('openspace.presentation.list', args)
    );

    server.tool(
        'openspace.presentation.read',
        'Read a .deck.md presentation file and return its parsed structure',
        {
            path: z.string().describe('Absolute path to the .deck.md file'),
        },
        async (args: any) => this.executeViaBridge('openspace.presentation.read', args)
    );

    server.tool(
        'openspace.presentation.create',
        'Create a new .deck.md presentation file with title and initial slides',
        {
            path: z.string().describe('Absolute path for the new .deck.md file'),
            title: z.string().describe('Presentation title'),
            slides: z.array(z.string()).describe('Array of markdown slide content strings'),
        },
        async (args: any) => this.executeViaBridge('openspace.presentation.create', args)
    );

    server.tool(
        'openspace.presentation.update_slide',
        'Update the content of a single slide in a .deck.md file',
        {
            path: z.string().describe('Absolute path to the .deck.md file'),
            index: z.number().int().min(0).describe('Zero-based slide index'),
            content: z.string().describe('New markdown content for the slide'),
        },
        async (args: any) => this.executeViaBridge('openspace.presentation.update_slide', args)
    );

    server.tool(
        'openspace.presentation.open',
        'Open a .deck.md file in the presentation viewer pane',
        {
            path: z.string().describe('Absolute path to the .deck.md file'),
            splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                .describe('Where to open the pane (default: right)'),
        },
        async (args: any) => this.executeViaBridge('openspace.presentation.open', args)
    );

    server.tool(
        'openspace.presentation.navigate',
        'Navigate to a slide in the active presentation',
        {
            direction: z.enum(['next', 'prev', 'first', 'last']).optional()
                .describe('Navigation direction'),
            index: z.number().int().min(0).optional()
                .describe('Absolute zero-based slide index to jump to'),
        },
        async (args: any) => this.executeViaBridge('openspace.presentation.navigate', args)
    );

    server.tool(
        'openspace.presentation.play',
        'Start autoplay — advances slides automatically on a timer',
        {
            interval: z.number().int().min(500).optional()
                .describe('Milliseconds between slides (default: 5000)'),
        },
        async (args: any) => this.executeViaBridge('openspace.presentation.play', args)
    );

    server.tool(
        'openspace.presentation.pause',
        'Pause autoplay, keeping current slide position',
        {},
        async (args: any) => this.executeViaBridge('openspace.presentation.pause', args)
    );

    server.tool(
        'openspace.presentation.stop',
        'Stop autoplay and return to the first slide',
        {},
        async (args: any) => this.executeViaBridge('openspace.presentation.stop', args)
    );

    server.tool(
        'openspace.presentation.toggleFullscreen',
        'Toggle fullscreen mode for the active presentation viewer',
        {},
        async (args: any) => this.executeViaBridge('openspace.presentation.toggleFullscreen', args)
    );
}
```

**Step 4: Build openspace-core**

```bash
cd extensions/openspace-core && npm run build
```
Expected: no TypeScript errors.

**Step 5: Commit**
```bash
git add extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "feat(hub-mcp): add registerPresentationTools with 10 MCP tools"
```

---

## Task 9: Update generateInstructions() in hub.ts

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts`

`generateInstructions()` (lines 246–291) currently lists pane, editor, terminal, and file tools in the system prompt. Add a `openspace.presentation.*` section.

**Step 1: Read hub.ts lines 246–293**

Confirm the exact format of the `generateInstructions()` string so we match the style.

**Step 2: Add presentation tools to the system prompt**

Find the section that lists tool categories and add after the file tools section:

```
**Presentation tools** (openspace.presentation.*):
- openspace.presentation.list — list all .deck.md files in the workspace
- openspace.presentation.read {path} — read a presentation and its slides
- openspace.presentation.create {path, title, slides[]} — create a new presentation
- openspace.presentation.update_slide {path, index, content} — update one slide
- openspace.presentation.open {path, splitDirection?} — open the presentation viewer
- openspace.presentation.navigate {direction|index} — go to next/prev/first/last slide or a specific index
- openspace.presentation.play {interval?} — start autoplay (default 5s per slide)
- openspace.presentation.pause — pause autoplay at current slide
- openspace.presentation.stop — stop autoplay and return to first slide
- openspace.presentation.toggleFullscreen — toggle fullscreen mode
```

**Step 3: Build openspace-core**

```bash
cd extensions/openspace-core && npm run build
```

**Step 4: Commit**
```bash
git add extensions/openspace-core/src/node/hub.ts
git commit -m "feat(hub): add presentation tools to generateInstructions system prompt"
```

---

## Task 10: Full build verification

**Step 1: Build all extensions and browser-app**

```bash
cd extensions/openspace-presentation && npm run build
cd extensions/openspace-core && npm run build
cd browser-app && yarn build
```

All three should complete with no TypeScript errors.

**Step 2: Verify no regressions in pane, editor, terminal tools**

Check `extensions/openspace-core/src/browser/pane-service.ts` type-checks cleanly — the `CommandRegistry` injection we added should not conflict with existing fields.

**Step 3: Smoke-test checklist (manual)**

Start the app and verify:
- [ ] `openspace.presentation.create` creates a `.deck.md` file
- [ ] `openspace.presentation.open` opens the reveal.js widget in a pane
- [ ] Widget renders slides using RevealMarkdown (headers, bold, lists work)
- [ ] `openspace.presentation.navigate {direction: 'next'}` advances slides
- [ ] `openspace.presentation.play {interval: 2000}` auto-advances every 2s
- [ ] `openspace.presentation.pause` stops auto-advance at current slide
- [ ] `openspace.presentation.stop` stops and returns to slide 0
- [ ] `openspace.presentation.toggleFullscreen` enters/exits fullscreen
- [ ] Editing and saving the `.deck.md` file triggers live reload in the widget
- [ ] `openspace.presentation.list` returns found `.deck.md` files

**Step 4: Final commit if any fixups needed**
```bash
git add -p
git commit -m "fix(presentation): post-integration fixups"
```

---

## Backlog (out of scope for this implementation)

### ArtifactStore Refactor (Future)

Currently all modalities use Theia `FileService` (browser) for file I/O. `ArtifactStore` (Phase T5) will add versioned snapshots, atomic writes, audit log, and concurrency queue at the hub/node layer.

**Decision needed (later):** When T5 is implemented, evaluate whether all modality file I/O (including `PresentationService`) should route through ArtifactStore, or whether browser-side `FileService` is acceptable for read-heavy paths. This is low urgency — the two-path problem (browser write vs hub fs.writeFileSync) exists equally in all modalities.

Track as: `TODO(T5): evaluate ArtifactStore refactor for PresentationService and all other FileService-based modalities`
