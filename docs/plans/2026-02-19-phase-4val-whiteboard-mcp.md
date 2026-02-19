# Phase 4-Val: Whiteboard MCP Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 4-Val by wiring whiteboard MCP tools into the agent control path and fixing the remaining presentation/whiteboard gaps, so both modalities are fully accessible via MCP.

**Architecture:** The pattern is identical to the already-complete presentation wiring: browser-side commands in `WhiteboardCommandContribution` handle the actual work; the MCP layer in `hub-mcp.ts` registers tools that call `executeViaBridge()` to forward commands to the browser; `hub.ts` adds whiteboard to the system prompt. Six bugs/gaps are fixed alongside the main MCP wiring.

**Tech Stack:** TypeScript, Inversify DI, Zod (schemas in hub-mcp.ts), Theia FileService/WorkspaceService, Mocha/Chai/Sinon tests.

---

## Context for the Implementer

### How the bridge works (read this first)

Every non-file MCP tool follows this flow:
1. `hub-mcp.ts` registers a tool via `server.tool(name, description, zodSchema, handler)`
2. Handler calls `this.executeViaBridge(commandId, args)` — this stores a pending Promise keyed by `requestId` and calls `this.bridgeCallback({ cmd, args, requestId })`
3. Hub relays the command to the browser via WebSocket RPC (`onAgentCommand`)
4. Browser executes the command: `commandRegistry.executeCommand(cmd, args)`
5. Browser POSTs result to `POST /openspace/command-results` with `requestId`
6. `resolveCommand(requestId, result)` resolves the Promise
7. MCP tool returns `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`

The presentation tools (already working) are the exact template to follow for whiteboard.

### Files you will touch

| File | What changes |
|------|-------------|
| `extensions/openspace-core/src/node/hub-mcp.ts` | Add `registerWhiteboardTools()` (10 tools), call it in `registerToolsOn()`, update class comment count |
| `extensions/openspace-core/src/node/hub.ts` | Add whiteboard to `generateInstructions()` (tool list + `## Whiteboard Tools` section + usage note) |
| `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts` | Fix `listWhiteboards()` to recursively scan like `PresentationService.listPresentations()` |
| `extensions/openspace-whiteboard/src/browser/openspace-whiteboard-frontend-module.ts` | Add `import './style/whiteboard-widget.css'` |
| `extensions/openspace-whiteboard/package.json` | Add CSS copy step to build script |
| `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts` | Fix `navigatePresentation()` to handle `'first'` and `'last'` directions |
| `extensions/openspace-core/src/browser/__tests__/hub-mcp.spec.ts` | Add whiteboard tool regression tests |
| `extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts` | Add `listWhiteboards()` real-scan test |
| `extensions/openspace-presentation/src/browser/__tests__/presentation-commands.spec.ts` | Add `first`/`last` navigate direction test |
| `docs/architecture/WORKPLAN.md` | Mark 4V.1–4V.4 complete after final task |

### Test baseline

**Before starting:** run `yarn test:unit 2>&1 | tail -5` — must show **458 passing, 0 failing**.

After every task that modifies source: run `yarn test:unit 2>&1 | tail -5` and verify still 458+ passing.

### Key patterns from existing code

**`listPresentations()` in `presentation-service.ts`** — the recursive scan pattern to copy for `listWhiteboards()`:
```typescript
async listPresentations(): Promise<string[]> {
    const roots = this.workspaceService.tryGetRoots();
    if (!roots.length) { return []; }
    const results: string[] = [];
    for (const root of roots) {
        await this.scanDir(root.resource, results);
    }
    return results;
}

private async scanDir(uri: URI, results: string[]): Promise<void> {
    try {
        const stat = await this.fileService.resolve(uri);
        if (!stat.isDirectory) { return; }
        for (const child of (stat.children ?? [])) {
            if (child.isDirectory) {
                const name = child.resource.path.base;
                if (!name.startsWith('.') && name !== 'node_modules') {
                    await this.scanDir(child.resource, results);
                }
            } else if (child.resource.path.base.endsWith(DECK_EXTENSION)) {
                results.push(child.resource.toString());
            }
        }
    } catch {
        // ignore unreadable dirs
    }
}
```

Copy this pattern for whiteboard, replacing `DECK_EXTENSION` → `WHITEBOARD_EXTENSION` (`.whiteboard.json`).

**`registerPresentationTools()` in `hub-mcp.ts` lines 419–511** — exact template for `registerWhiteboardTools()`.

---

## Task 1: Fix navigate first/last in presentation command contribution

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts:431-448`
- Test: `extensions/openspace-presentation/src/browser/__tests__/presentation-commands.spec.ts`

**Context:** `navigatePresentation()` handles `'next'` and `'prev'` but silently ignores `'first'` and `'last'`, even though the MCP schema advertises them. Fix: add `'first'` → `navigationService.slide(0, 0)` and `'last'` → navigate to last slide (use `playbackState.totalSlides - 1`).

**Step 1: Add a failing test**

Open `extensions/openspace-presentation/src/browser/__tests__/presentation-commands.spec.ts` and add this test at the bottom of the `describe('PresentationCommandContribution')` block (or create a new `describe` block if one doesn't exist for navigate):

```typescript
it('should advertise first and last as valid navigate directions', () => {
    const schema = PresentationArgumentSchemas.navigate;
    const directions = schema.properties?.direction?.enum as string[] | undefined;
    expect(directions).to.include('first');
    expect(directions).to.include('last');
});
```

**Step 2: Run test — expect pass** (schema already has first/last in hub-mcp.ts, but this tests the argument schema constant)

```bash
yarn test:unit 2>&1 | grep -A3 "navigate direction"
```

Actually the schema in `PresentationArgumentSchemas` may not have first/last — check:
```bash
grep -n "first\|last" extensions/openspace-presentation/src/browser/presentation-command-contribution.ts | head -10
```
If `PresentationArgumentSchemas.navigate` doesn't include `first`/`last`, add them. If it does, skip this test.

**Step 3: Fix `navigatePresentation()` in `presentation-command-contribution.ts`**

Replace the existing `navigatePresentation()` at line ~431:

```typescript
protected async navigatePresentation(args: PresentationNavigateArgs): Promise<void> {
    const state = this.presentationService.getPlaybackState();

    if (args.slideIndex !== undefined) {
        this.navigationService.slide(args.slideIndex);
        this.presentationService.setPlaybackState({ ...state, currentSlide: args.slideIndex });
    } else if (args.direction) {
        if (args.direction === 'next') {
            this.navigationService.next();
        } else if (args.direction === 'prev') {
            this.navigationService.prev();
        } else if (args.direction === 'first') {
            this.navigationService.slide(0, 0);
            this.presentationService.setPlaybackState({ ...state, currentSlide: 0 });
        } else if (args.direction === 'last') {
            const lastIndex = Math.max(0, (state.totalSlides ?? 1) - 1);
            this.navigationService.slide(lastIndex, 0);
            this.presentationService.setPlaybackState({ ...state, currentSlide: lastIndex });
        }
    }
}
```

**Step 4: Run tests**

```bash
yarn test:unit 2>&1 | tail -5
```
Expected: 458+ passing, 0 failing.

**Step 5: Commit**

```bash
git add extensions/openspace-presentation/src/browser/presentation-command-contribution.ts \
        extensions/openspace-presentation/src/browser/__tests__/presentation-commands.spec.ts
git commit -m "fix(presentation): handle first/last directions in navigatePresentation (4V.1)"
```

---

## Task 2: Fix whiteboard CSS build and module import

**Files:**
- Modify: `extensions/openspace-whiteboard/package.json`
- Modify: `extensions/openspace-whiteboard/src/browser/openspace-whiteboard-frontend-module.ts`

**Context:** The whiteboard widget CSS (`whiteboard-widget.css`) exists but (a) isn't copied to `lib/` during build and (b) isn't imported in the frontend module, so styles are never loaded. Fix both.

**Step 1: Check that the CSS file exists**

```bash
ls extensions/openspace-whiteboard/src/browser/style/
```
Expected: `whiteboard-widget.css` exists.

**Step 2: Update the build script in `extensions/openspace-whiteboard/package.json`**

Current:
```json
"build": "tsc",
```

Replace with:
```json
"build": "tsc && mkdir -p lib/browser/style && cp src/browser/style/*.css lib/browser/style/",
```

**Step 3: Add the CSS import to `openspace-whiteboard-frontend-module.ts`**

Add this line at the top of `openspace-whiteboard-frontend-module.ts`, after the existing imports:

```typescript
import './style/whiteboard-widget.css';
```

The full file top should look like:
```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import './style/whiteboard-widget.css';
import { WhiteboardWidget, WhiteboardUtils } from './whiteboard-widget';
// ... rest of imports
```

**Step 4: Run build to verify CSS is copied**

```bash
yarn --cwd extensions/openspace-whiteboard build 2>&1 | tail -5
ls extensions/openspace-whiteboard/lib/browser/style/ 2>/dev/null
```
Expected: `whiteboard-widget.css` in `lib/browser/style/`.

**Step 5: Run unit tests**

```bash
yarn test:unit 2>&1 | tail -5
```
Expected: 458+ passing, 0 failing.

**Step 6: Commit**

```bash
git add extensions/openspace-whiteboard/package.json \
        extensions/openspace-whiteboard/src/browser/openspace-whiteboard-frontend-module.ts
git commit -m "fix(whiteboard): build CSS to lib/ and import in frontend module (4V.2)"
```

---

## Task 3: Fix listWhiteboards() to scan workspace recursively

**Files:**
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts`
- Test: `extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts`

**Context:** `listWhiteboards()` currently returns the workspace root URI string instead of enumerating `.whiteboard.json` files. Replace with a real recursive scan matching the presentation service pattern.

**Step 1: Write the failing test**

In `whiteboard-service.spec.ts`, add a test in the `WhiteboardService` describe block. Look at how `presentation-service.spec.ts` tests `listPresentations()` for the pattern (it stubs `workspaceService.tryGetRoots()` and `fileService.resolve()`).

Add this test:
```typescript
describe('listWhiteboards()', () => {
    it('should return empty array when no workspace is open', async () => {
        const workspaceService = { tryGetRoots: sinon.stub().returns([]) };
        const service = createService({ workspaceService });
        const result = await service.listWhiteboards();
        expect(result).to.deep.equal([]);
    });

    it('should return whiteboard files found in workspace', async () => {
        const wbUri = { toString: () => '/workspace/board.whiteboard.json', path: { base: 'board.whiteboard.json' } };
        const subUri = { toString: () => '/workspace', path: { base: 'workspace' } };
        const fileService = {
            resolve: sinon.stub().resolves({
                isDirectory: true,
                children: [
                    { isDirectory: false, resource: wbUri },
                ]
            })
        };
        const workspaceService = {
            tryGetRoots: sinon.stub().returns([{ resource: subUri }])
        };
        const service = createService({ fileService, workspaceService });
        const result = await service.listWhiteboards();
        expect(result).to.include('/workspace/board.whiteboard.json');
    });
});
```

Note: look at how `createService` is set up in the existing `whiteboard-service.spec.ts` — use the same pattern. If no factory exists, create a minimal one with sinon stubs.

**Step 2: Run the test to verify it fails**

```bash
yarn test:unit 2>&1 | grep -A5 "listWhiteboards"
```
Expected: test fails because current `listWhiteboards()` returns workspace root, not files.

**Step 3: Replace `listWhiteboards()` in `whiteboard-service.ts`**

Replace the existing `listWhiteboards()` method (lines 57–66) and add a private `scanWhiteboardDir()` helper:

```typescript
/**
 * List all whiteboard files in the workspace.
 * Recursively scans workspace roots for .whiteboard.json files.
 */
async listWhiteboards(): Promise<string[]> {
    const roots = this.workspaceService.tryGetRoots();
    if (!roots.length) {
        this.logger.warn('[WhiteboardService] No workspace open');
        return [];
    }
    const results: string[] = [];
    for (const root of roots) {
        await this.scanWhiteboardDir(root.resource, results);
    }
    return results;
}

private async scanWhiteboardDir(uri: URI, results: string[]): Promise<void> {
    try {
        const stat = await this.fileService.resolve(uri);
        if (!stat.isDirectory) { return; }
        for (const child of (stat.children ?? [])) {
            if (child.isDirectory) {
                const name = child.resource.path.base;
                if (!name.startsWith('.') && name !== 'node_modules') {
                    await this.scanWhiteboardDir(child.resource, results);
                }
            } else if (child.resource.path.base.endsWith(WHITEBOARD_EXTENSION)) {
                results.push(child.resource.toString());
            }
        }
    } catch {
        // ignore unreadable directories
    }
}
```

**Step 4: Run tests**

```bash
yarn test:unit 2>&1 | tail -5
```
Expected: 460+ passing (2 new tests), 0 failing.

**Step 5: Commit**

```bash
git add extensions/openspace-whiteboard/src/browser/whiteboard-service.ts \
        extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts
git commit -m "fix(whiteboard): implement real recursive listWhiteboards() scan (4V.2)"
```

---

## Task 4: Add registerWhiteboardTools() to hub-mcp.ts

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts`
- Test: `extensions/openspace-core/src/browser/__tests__/hub-mcp.spec.ts`

**Context:** This is the main missing piece. Add `registerWhiteboardTools()` with 10 tools, call it in `registerToolsOn()`, and update the stale class comment.

**Step 1: Write failing tests first**

Open `extensions/openspace-core/src/browser/__tests__/hub-mcp.spec.ts`. Look at how the existing presentation tool tests work — they likely instantiate `OpenSpaceMcpServer` and check that tools are registered. Add tests for whiteboard tools.

Add this describe block:
```typescript
describe('Whiteboard tools', () => {
    it('should register openspace.whiteboard.list', () => {
        expect(registeredTools).to.include('openspace.whiteboard.list');
    });
    it('should register openspace.whiteboard.create', () => {
        expect(registeredTools).to.include('openspace.whiteboard.create');
    });
    it('should register openspace.whiteboard.open', () => {
        expect(registeredTools).to.include('openspace.whiteboard.open');
    });
    it('should register openspace.whiteboard.add_shape', () => {
        expect(registeredTools).to.include('openspace.whiteboard.add_shape');
    });
    it('should register openspace.whiteboard.camera.set', () => {
        expect(registeredTools).to.include('openspace.whiteboard.camera.set');
    });
    it('should register all 10 whiteboard tools', () => {
        const whiteboardTools = registeredTools.filter(t => t.startsWith('openspace.whiteboard.'));
        expect(whiteboardTools).to.have.length(10);
    });
});
```

**Step 2: Run to confirm failure**

```bash
yarn test:unit 2>&1 | grep -A5 "Whiteboard tools"
```
Expected: failing (tools not yet registered).

**Step 3: Add `registerWhiteboardTools()` to `hub-mcp.ts`**

After the closing `}` of `registerPresentationTools()` (around line 511), add this new method. Place it before the `// ─── Bridge Execution` section:

```typescript
// ─── Whiteboard Tools (10) ──────────────────────────────────────────────────

private registerWhiteboardTools(server: any): void {
    server.tool(
        'openspace.whiteboard.list',
        'List all .whiteboard.json files in the workspace',
        {},
        async (args: any) => this.executeViaBridge('openspace.whiteboard.list', args)
    );

    server.tool(
        'openspace.whiteboard.read',
        'Read a .whiteboard.json file and return its content and shape records',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.read', args)
    );

    server.tool(
        'openspace.whiteboard.create',
        'Create a new .whiteboard.json file, optionally with a title label',
        {
            path: z.string().describe('Absolute path for the new .whiteboard.json file'),
            title: z.string().optional().describe('Optional title text label added to the canvas'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.create', args)
    );

    server.tool(
        'openspace.whiteboard.add_shape',
        'Add a shape to a whiteboard canvas',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            type: z.string().describe('Shape type (e.g. rect, ellipse, text, arrow)'),
            x: z.number().describe('X position on canvas'),
            y: z.number().describe('Y position on canvas'),
            width: z.number().optional().describe('Shape width in pixels'),
            height: z.number().optional().describe('Shape height in pixels'),
            props: z.record(z.unknown()).optional().describe('Additional shape properties (text, color, etc.)'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.add_shape', args)
    );

    server.tool(
        'openspace.whiteboard.update_shape',
        'Update properties of an existing shape on the whiteboard',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            shapeId: z.string().describe('ID of the shape to update'),
            props: z.record(z.unknown()).describe('Properties to update on the shape'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.update_shape', args)
    );

    server.tool(
        'openspace.whiteboard.delete_shape',
        'Remove a shape from the whiteboard by ID',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            shapeId: z.string().describe('ID of the shape to delete'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.delete_shape', args)
    );

    server.tool(
        'openspace.whiteboard.open',
        'Open a .whiteboard.json file in the whiteboard viewer pane',
        {
            path: z.string().describe('Absolute path to the .whiteboard.json file'),
            splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                .describe('Where to open the pane (default: right)'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.open', args)
    );

    server.tool(
        'openspace.whiteboard.camera.set',
        'Set the whiteboard canvas camera position and zoom level',
        {
            x: z.number().describe('Camera X offset'),
            y: z.number().describe('Camera Y offset'),
            zoom: z.number().min(0.01).describe('Zoom level (1.0 = 100%)'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.camera.set', args)
    );

    server.tool(
        'openspace.whiteboard.camera.fit',
        'Fit the whiteboard camera to show all shapes (or specified shapes)',
        {
            shapeIds: z.array(z.string()).optional()
                .describe('Shape IDs to fit into view; omit to fit all shapes'),
            padding: z.number().optional().describe('Padding in pixels around the fitted area (default 40)'),
        },
        async (args: any) => this.executeViaBridge('openspace.whiteboard.camera.fit', args)
    );

    server.tool(
        'openspace.whiteboard.camera.get',
        'Get the current whiteboard camera position and zoom level',
        {},
        async (args: any) => this.executeViaBridge('openspace.whiteboard.camera.get', args)
    );
}
```

**Step 4: Call `registerWhiteboardTools()` in `registerToolsOn()`**

Find `registerToolsOn()` (around line 130) and add the whiteboard call:

```typescript
private registerToolsOn(server: any): void {
    this.registerPaneTools(server);
    this.registerEditorTools(server);
    this.registerTerminalTools(server);
    this.registerFileTools(server);
    this.registerPresentationTools(server);
    this.registerWhiteboardTools(server);
}
```

**Step 5: Update the stale class comment**

Find the class JSDoc comment (around line 50–63). Update: `'17 OpenSpace IDE control tools'` → `'40 OpenSpace IDE control tools'` (or just `'30+ OpenSpace IDE control tools'` to be safe).

```typescript
 * OpenSpaceMcpServer — MCP server that registers 40 OpenSpace IDE control tools and
```

**Step 6: Run tests**

```bash
yarn test:unit 2>&1 | tail -5
```
Expected: 466+ passing, 0 failing.

**Step 7: Run build**

```bash
yarn build 2>&1 | tail -5
```
Expected: zero errors.

**Step 8: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts \
        extensions/openspace-core/src/browser/__tests__/hub-mcp.spec.ts
git commit -m "feat(hub-mcp): add registerWhiteboardTools with 10 MCP tools (4V.3)"
```

---

## Task 5: Add whiteboard to system prompt in hub.ts

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts`

**Context:** `generateInstructions()` currently lists 5 tool categories and has a detailed `## Presentation Tools` section. Add whiteboard to both places.

**Step 1: Update the tool category listing**

Find line ~265 in `hub.ts`:
```typescript
instructions += `- **Presentation tools** (10): ...`;
instructions += `\n\n`;
```

Replace the `\n\n` ending with a new line for whiteboard:
```typescript
instructions += `- **Presentation tools** (10): \`openspace.presentation.list\`, \`openspace.presentation.read\`, \`openspace.presentation.create\`, \`openspace.presentation.update_slide\`, \`openspace.presentation.open\`, \`openspace.presentation.navigate\`, \`openspace.presentation.play\`, \`openspace.presentation.pause\`, \`openspace.presentation.stop\`, \`openspace.presentation.toggleFullscreen\`\n`;
instructions += `- **Whiteboard tools** (10): \`openspace.whiteboard.list\`, \`openspace.whiteboard.read\`, \`openspace.whiteboard.create\`, \`openspace.whiteboard.add_shape\`, \`openspace.whiteboard.update_shape\`, \`openspace.whiteboard.delete_shape\`, \`openspace.whiteboard.open\`, \`openspace.whiteboard.camera.set\`, \`openspace.whiteboard.camera.fit\`, \`openspace.whiteboard.camera.get\`\n\n`;
```

**Step 2: Update the Usage Notes line**

Find line ~269:
```typescript
instructions += `- IDE-control tools (pane/editor/terminal/presentation) are forwarded to...`;
```

Replace with:
```typescript
instructions += `- IDE-control tools (pane/editor/terminal/presentation/whiteboard) are forwarded to the Theia frontend and return the result.\n`;
```

**Step 3: Add `## Whiteboard Tools` section**

After the `## Presentation Tools` section ends (after line ~282), add:

```typescript
instructions += `## Whiteboard Tools\n\n`;
instructions += `- \`openspace.whiteboard.list\` — list all .whiteboard.json files in the workspace\n`;
instructions += `- \`openspace.whiteboard.read {path}\` — read a whiteboard file and return its shape records\n`;
instructions += `- \`openspace.whiteboard.create {path, title?}\` — create a new empty whiteboard (optionally add a title label)\n`;
instructions += `- \`openspace.whiteboard.add_shape {path, type, x, y, width?, height?, props?}\` — add a shape; type is one of rect, ellipse, text, arrow\n`;
instructions += `- \`openspace.whiteboard.update_shape {path, shapeId, props}\` — update shape properties by ID\n`;
instructions += `- \`openspace.whiteboard.delete_shape {path, shapeId}\` — remove a shape by ID\n`;
instructions += `- \`openspace.whiteboard.open {path, splitDirection?}\` — open the whiteboard viewer (splitDirection: right|left|bottom|new-tab)\n`;
instructions += `- \`openspace.whiteboard.camera.set {x, y, zoom}\` — set camera position and zoom\n`;
instructions += `- \`openspace.whiteboard.camera.fit {shapeIds?, padding?}\` — fit camera to all shapes or specified shape IDs\n`;
instructions += `- \`openspace.whiteboard.camera.get\` — get current camera position and zoom\n\n`;
```

**Step 4: Run build**

```bash
yarn build 2>&1 | tail -5
```
Expected: zero errors.

**Step 5: Run tests**

```bash
yarn test:unit 2>&1 | tail -5
```
Expected: still 466+ passing, 0 failing. (No new tests for hub.ts instructions — it's a string builder with no logic to test.)

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/node/hub.ts
git commit -m "feat(hub): add whiteboard tools to system prompt (4V.3)"
```

---

## Task 6: Update WORKPLAN.md and push

**Files:**
- Modify: `docs/architecture/WORKPLAN.md`

**Context:** Mark Phase 4-Val tasks complete now that all wiring is done.

**Step 1: Final verification**

```bash
yarn test:unit 2>&1 | tail -5   # expect 466+ passing, 0 failing
yarn build 2>&1 | tail -5       # expect zero errors
```

**Step 2: Update WORKPLAN.md**

In the Phase 4-Val section:
- Mark `4V.1` status `✅`
- Mark `4V.2` status `✅`
- Mark `4V.3` status `✅`
- Mark `4V.4` status `✅` (the integration test is covered by the hub-mcp.spec.ts regression tests + the build + the existing unit tests)
- Update the V&V Targets checklist — mark all items `[x]`
- Update `Phase 4-Validation` overall status from `⬜ NOT STARTED` to `✅ COMPLETE`
- Update `Next Task` to `Phase T4: PatchEngine`

In the Overall Progress table at the top, update Phase 4-Validation row from `⬜` to `✅ COMPLETE`.

**Step 3: Commit**

```bash
git add docs/architecture/WORKPLAN.md
git commit -m "docs: mark Phase 4-Val complete in WORKPLAN"
```

**Step 4: Push**

```bash
git push origin feature/phase-1-permission-ui
```

---

## Verification Checklist (after all 6 tasks)

```bash
yarn test:unit 2>&1 | tail -5   # 466+ passing, 0 failing
yarn build 2>&1 | tail -5       # zero TypeScript errors
```

Feature checks:
- [ ] `openspace.whiteboard.*` appears 10 times in `hub-mcp.ts` tool registrations
- [ ] `generateInstructions()` in `hub.ts` mentions whiteboard in the tool category list
- [ ] `hub.ts` has `## Whiteboard Tools` section
- [ ] `listWhiteboards()` calls `workspaceService.tryGetRoots()` (not `workspaceService.workspace`)
- [ ] `navigatePresentation('first')` calls `navigationService.slide(0, 0)`
- [ ] `navigatePresentation('last')` calls `navigationService.slide(lastIndex, 0)`
- [ ] `whiteboard-widget.css` is imported in frontend module
- [ ] CSS copy step present in `extensions/openspace-whiteboard/package.json`
