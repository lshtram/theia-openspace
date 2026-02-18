# Presentation Modality Design

**Date:** 2026-02-19  
**Status:** Approved

---

## Goal

Make the presentation modality work end-to-end: an agent can call `openspace.presentation.*` MCP tools, a reveal.js widget opens in a Theia pane, slide navigation and autoplay work correctly, markdown is rendered via reveal.js's built-in `RevealMarkdown` plugin, and `.deck.md` files are live-reloaded when changed on disk.

---

## What Already Exists

- `extensions/openspace-presentation/` — full extension compiled to `lib/`, installed and wired into `browser-app/src-gen/frontend/index.js` (line 116)
- `PresentationCommandContribution` registers 9 Theia commands (list, read, create, update_slide, open, navigate, play, pause, stop)
- `PresentationService` — reads/writes `.deck.md` via Theia `FileService`
- `PresentationWidget` — reveal.js widget with a hand-rolled markdown parser
- reveal.js `^5.2.1` installed at `node_modules/reveal.js`; `RevealMarkdown` plugin bundled at `node_modules/reveal.js/plugin/markdown/markdown.esm.js` (includes `marked` internally)
- Type declaration file at `extensions/openspace-presentation/src/types/reveal.js.d.ts`

---

## Gaps Being Fixed

| # | Gap | Severity | Location |
|---|-----|----------|----------|
| 1 | No MCP tools for `openspace.presentation.*` | Blocking | `hub-mcp.ts` |
| 2 | `pane.open type=presentation` is a no-op stub | Blocking | `pane-service.ts:265-274` |
| 3 | `openPresentation()` never calls `shell.addWidget()` | Blocking | `presentation-command-contribution.ts:339-362` |
| 4 | `navigationService.setReveal()` never called | Blocking | `presentation-widget.tsx:154-181` |
| 5 | Reveal.js CSS/theme not loaded | Likely issue | Widget CSS only |
| 6 | Hand-rolled markdown parser | Quality | `presentation-widget.tsx:225-258` |
| 7 | `play` incorrectly calls `toggleFullscreen` | Design issue | `presentation-command-contribution.ts:395` |
| 8 | No file watch / live reload | Missing feature | — |
| 9 | Presentation tools missing from system prompt | Missing | `hub.ts` `generateInstructions()` |
| 10 | `listPresentations()` is a stub | Missing | `presentation-service.ts` |

---

## Architecture

### Command Flow

```
Agent
  → MCP tool (hub-mcp.ts: registerPresentationTools)
  → executeViaBridge()
  → bridge callback
  → opencode-sync-service.ts: onAgentCommand()
  → CommandRegistry.executeCommand(cmd, args)
  → PresentationCommandContribution handler
  → PresentationService (FileService for .deck.md I/O)
  → PresentationWidget (reveal.js DOM)
```

This is identical to the existing pane/editor/terminal tool pattern. No new RPC layers.

### File I/O

All `.deck.md` reads and writes go through Theia's `FileService` (browser-side). This is consistent with every other modality in the codebase. Raw `fs` is not used for presentation files — that would create a second competing write path.

### ArtifactStore

`ArtifactStore` does not exist yet (Phase T5). When it is implemented, **all modalities** (not just presentation) will need to be refactored to route through it. That is a deliberate future decision — see backlog below.

---

## Section 1 — MCP Layer (`hub-mcp.ts` + `hub.ts`)

Add `registerPresentationTools(server)` to `OpenSpaceMcpServer` in `hub-mcp.ts`. All 10 tools route via `executeViaBridge`:

| Tool | Parameters |
|------|-----------|
| `openspace.presentation.list` | — |
| `openspace.presentation.read` | `path` |
| `openspace.presentation.create` | `path`, `title`, `slides[]` |
| `openspace.presentation.update_slide` | `path`, `index`, `content` |
| `openspace.presentation.open` | `path`, `splitDirection?` |
| `openspace.presentation.navigate` | `direction` (`next`/`prev`/`first`/`last`) |
| `openspace.presentation.play` | `interval?` (ms, default 5000) |
| `openspace.presentation.pause` | — |
| `openspace.presentation.stop` | — |
| `openspace.presentation.toggleFullscreen` | — |

Update `generateInstructions()` in `hub.ts` to list the `openspace.presentation.*` tool category.

---

## Section 2 — PaneService (`pane-service.ts`)

Fix `openContent()` to handle `type === 'presentation'` by dispatching to `openspace.presentation.open` via `CommandRegistry` with `{ path, splitDirection }`. Currently falls through to `{ success: false }`.

---

## Section 3 — Widget Placement (`presentation-command-contribution.ts`)

Fix `openPresentation()` to call `shell.addWidget(widget, { area, mode })` before `widget.activate()`. Map `splitDirection` parameter to Theia shell area/mode:

| splitDirection | area | mode |
|---------------|------|------|
| `right` (default) | `main` | `split-right` |
| `left` | `main` | `split-left` |
| `bottom` | `bottom` | `tab-after` |
| `new-tab` | `main` | `tab-after` |

Also fix the double `fileService.read()` — `openPresentation()` should call `presentationService.readPresentation()` instead of calling `fileService.read()` directly.

---

## Section 4 — RevealMarkdown Plugin (`presentation-widget.tsx`)

Replace the hand-rolled markdown parser with reveal.js's built-in `RevealMarkdown` plugin:

- Import `RevealMarkdown` from `reveal.js/plugin/markdown/markdown.esm.js`
- Change slide HTML to `<section data-markdown><script type="text/template">{raw markdown}</script></section>`
- Pass `plugins: [RevealMarkdown]` to `new Reveal()`
- After `deck.initialize()`, call `this.navigationService.setReveal(this.revealDeck)` (fixes gap #4)
- Import reveal.js CSS: `reveal.css` and a theme (e.g. `black.css`) from the npm package
- Update `reveal.js.d.ts` type declaration to include `RevealMarkdown` plugin export

---

## Section 5 — play / pause / stop Semantics (`presentation-command-contribution.ts`)

Remove the incorrect `toggleFullscreen()` call from `play`. Implement proper autoplay:

- `play(interval = 5000)` — starts a `setInterval` timer that calls `navigationService.next()` every `interval` ms; stores the timer ID on the widget
- `pause()` — clears the timer, leaves current slide position
- `stop()` — clears the timer + calls `navigationService.first()` (returns to slide 0)

---

## Section 6 — Fullscreen Toggle (`presentation-command-contribution.ts`)

New independent command `openspace.presentation.toggleFullscreen`:

```ts
private toggleFullscreen(): void {
  const container = this.widget?.revealContainer;
  if (!container) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen();
  }
}
```

Keybinding: `Ctrl+Shift+F` / `⌘+Shift+F` (works from outside the slide canvas; reveal.js `F` key still works inside).

---

## Section 7 — File Watch / Live Reload (`presentation-service.ts`)

Use Theia's `FileService.watch(uri)` and listen to `onDidFilesChange`. When the currently-open `.deck.md` URI changes, call `PresentationWidget.reload()` which re-reads the file and re-initializes the Reveal instance with updated slides.

---

## Section 8 — `listPresentations()` Fix (`presentation-service.ts`)

Replace the stub with a real implementation: use `FileService` to search for `**/*.deck.md` under the workspace root and return an array of relative paths.

---

## Files to Modify

| File | What changes |
|------|-------------|
| `extensions/openspace-core/src/node/hub-mcp.ts` | Add `registerPresentationTools()` (10 tools) |
| `extensions/openspace-core/src/node/hub.ts` | Update `generateInstructions()` |
| `extensions/openspace-core/src/browser/pane-service.ts` | Fix `type=presentation` branch |
| `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts` | Fix `openPresentation()`, fix play/pause/stop, add toggleFullscreen command+keybinding |
| `extensions/openspace-presentation/src/browser/presentation-widget.tsx` | RevealMarkdown plugin, `setReveal()` wiring, CSS imports, expose `revealContainer` ref |
| `extensions/openspace-presentation/src/browser/presentation-service.ts` | Fix `listPresentations()`, add file watch |
| `extensions/openspace-presentation/src/types/reveal.js.d.ts` | Add `RevealMarkdown` type export |

---

## Backlog / Future Consideration

### ArtifactStore Refactor (Future — not in this implementation)

Currently all modalities (presentation, whiteboard, editor, file) use Theia `FileService` (browser) or raw `fs` (hub node) for file I/O. `ArtifactStore` is a planned Phase T5 node-side service that would add versioned snapshots, atomic writes, an audit log, and a concurrency queue.

**Decision needed (later):** When T5 is implemented, evaluate whether all modality file I/O (including `PresentationService`) should route through ArtifactStore, or whether browser-side `FileService` usage is acceptable for read-heavy paths with ArtifactStore reserved for agent-initiated writes only.

This is low urgency because the current two-path problem (browser `FileService` write vs hub `fs.writeFileSync`) exists in all modalities equally and is not presentation-specific.
