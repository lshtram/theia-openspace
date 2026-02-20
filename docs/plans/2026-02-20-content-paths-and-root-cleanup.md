# Content Paths + Root Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move project root junk into `tmp/`, register Theia preferences for content folder paths (`openspace/whiteboards`, `openspace/decks`), and enforce those defaults in `WhiteboardService.createWhiteboard` and `PresentationService.createPresentation`.

**Architecture:** A `PreferenceSchema` is registered via `PreferenceContribution` in the `openspace-settings` extension. Both `WhiteboardService` and `PresentationService` inject `PreferenceService` and read the configured path when creating files, auto-creating the folder if absent. Path resolution logic is a pure helper function, fully unit-testable.

**Tech Stack:** TypeScript, Theia `PreferenceContribution` / `PreferenceService` (`@theia/core/lib/browser/preferences`), Theia `FileService`, Mocha + Sinon (existing test harness).

---

## Task 1: Root Cleanup — Move junk into `tmp/`

**Files:**
- Create: `tmp/` directory (via `mkdir`)
- Modify: `.gitignore` — add `tmp/`

**Step 1: Create `tmp/` folder and move all junk**

```bash
mkdir -p tmp

# All PNG screenshots
mv *.png tmp/ 2>/dev/null; echo "PNGs moved"

# Test/demo whiteboard files at root
mv Test123.whiteboard.json agent-mcp-tool.whiteboard.json demo.whiteboard.json \
   sample-block-diagram.whiteboard.json testMindmap.whiteboard.json tmp/ 2>/dev/null; echo "Whiteboards moved"

# Test/demo deck files at root
mv flowers.deck.md test-flowers.deck.md test-simple.deck.md tmp/ 2>/dev/null; echo "Decks moved"

# Build logs and stray artifacts
mv build-output.log build-output.txt theia.log tsconfig.tsbuildinfo tmp/ 2>/dev/null; echo "Logs moved"

# Stray analysis notes
mv NSO_Skills_Analysis_for_Superpowers.md NSO_vs_Superpowers_Comparison.md tmp/ 2>/dev/null; echo "Notes moved"
```

**Step 2: Add `tmp/` to `.gitignore`**

Open `.gitignore` and add:
```
tmp/
```

**Step 3: Verify root is clean**

```bash
ls *.png *.whiteboard.json *.deck.md 2>/dev/null && echo "FAIL: files remain" || echo "OK: root clean"
```
Expected: `OK: root clean`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: move dev/test artifacts from root into tmp/, add tmp/ to .gitignore"
```

---

## Task 2: Register OpenSpace Preference Schema in `openspace-settings`

**Files:**
- Create: `extensions/openspace-settings/src/browser/openspace-preferences.ts`
- Modify: `extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts`

**Step 1: Write the failing test**

Create `extensions/openspace-settings/src/browser/__tests__/openspace-preferences.spec.ts`:

```typescript
import { expect } from 'chai';
import { OpenspacePreferences, OpenspacePreferenceDefaults } from '../openspace-preferences';

describe('OpenspacePreferences', () => {
    it('should export WHITEBOARDS_PATH key', () => {
        expect(OpenspacePreferences.WHITEBOARDS_PATH).to.equal('openspace.paths.whiteboards');
    });

    it('should export DECKS_PATH key', () => {
        expect(OpenspacePreferences.DECKS_PATH).to.equal('openspace.paths.decks');
    });

    it('should have correct default for whiteboards', () => {
        expect(OpenspacePreferenceDefaults[OpenspacePreferences.WHITEBOARDS_PATH]).to.equal('openspace/whiteboards');
    });

    it('should have correct default for decks', () => {
        expect(OpenspacePreferenceDefaults[OpenspacePreferences.DECKS_PATH]).to.equal('openspace/decks');
    });
});
```

**Step 2: Run test to confirm it fails**

```bash
yarn test:unit 2>&1 | grep -A5 "OpenspacePreferences"
```
Expected: module not found / FAIL.

**Step 3: Implement `openspace-preferences.ts`**

Create `extensions/openspace-settings/src/browser/openspace-preferences.ts`:

```typescript
import { PreferenceSchema } from '@theia/core/lib/browser/preferences';

export namespace OpenspacePreferences {
    export const WHITEBOARDS_PATH = 'openspace.paths.whiteboards';
    export const DECKS_PATH = 'openspace.paths.decks';
}

export const OpenspacePreferenceDefaults: Record<string, string> = {
    [OpenspacePreferences.WHITEBOARDS_PATH]: 'openspace/whiteboards',
    [OpenspacePreferences.DECKS_PATH]: 'openspace/decks',
};

export const OpenspacePreferenceSchema: PreferenceSchema = {
    type: 'object',
    properties: {
        [OpenspacePreferences.WHITEBOARDS_PATH]: {
            type: 'string',
            default: OpenspacePreferenceDefaults[OpenspacePreferences.WHITEBOARDS_PATH],
            description: 'Folder (relative to workspace root) where new whiteboard files are created.',
        },
        [OpenspacePreferences.DECKS_PATH]: {
            type: 'string',
            default: OpenspacePreferenceDefaults[OpenspacePreferences.DECKS_PATH],
            description: 'Folder (relative to workspace root) where new presentation deck files are created.',
        },
    },
};
```

**Step 4: Wire into the settings frontend module**

Replace the stub in `extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts`:

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { PreferenceContribution } from '@theia/core/lib/browser/preferences';
import { OpenspacePreferenceSchema } from './openspace-preferences';

export default new ContainerModule((bind) => {
    bind(PreferenceContribution).toConstantValue({ schema: OpenspacePreferenceSchema });
});
```

**Step 5: Run tests**

```bash
yarn test:unit 2>&1 | grep -A5 "OpenspacePreferences"
```
Expected: 4 passing.

**Step 6: Build the settings extension to verify no TS errors**

```bash
yarn --cwd extensions/openspace-settings build 2>&1
```
Expected: `Done in ...`

**Step 7: Commit**

```bash
git add extensions/openspace-settings/
git commit -m "feat(settings): register OpenSpace preference schema for content folder paths"
```

---

## Task 3: Path Resolution Helper — shared utility

Both `WhiteboardService` and `PresentationService` need the same logic: "given a bare name or a path, resolve it to a full URI under the configured folder". Put this in a shared location so it's tested once.

**Files:**
- Create: `extensions/openspace-core/src/browser/resolve-content-path.ts`
- Create: `extensions/openspace-core/src/browser/__tests__/resolve-content-path.spec.ts`

**Step 1: Write the failing test**

Create `extensions/openspace-core/src/browser/__tests__/resolve-content-path.spec.ts`:

```typescript
import { expect } from 'chai';
import { resolveContentPath } from '../resolve-content-path';

describe('resolveContentPath', () => {
    const workspaceRoot = 'file:///workspace';

    it('prepends configured folder when given bare filename', () => {
        const result = resolveContentPath('myboard', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/openspace/whiteboards/myboard.whiteboard.json');
    });

    it('does not double-add extension if already present', () => {
        const result = resolveContentPath('myboard.whiteboard.json', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/openspace/whiteboards/myboard.whiteboard.json');
    });

    it('passes through absolute file:// paths unchanged', () => {
        const abs = 'file:///some/other/place/test.whiteboard.json';
        const result = resolveContentPath(abs, 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal(abs);
    });

    it('passes through absolute /unix paths unchanged', () => {
        const abs = '/tmp/test.whiteboard.json';
        const result = resolveContentPath(abs, 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal(abs);
    });

    it('treats path with directory separator as relative, resolves under workspace root', () => {
        const result = resolveContentPath('subdir/myboard', 'openspace/whiteboards', workspaceRoot, '.whiteboard.json');
        expect(result).to.equal('file:///workspace/subdir/myboard.whiteboard.json');
    });
});
```

**Step 2: Run to confirm it fails**

```bash
yarn test:unit 2>&1 | grep -A5 "resolveContentPath"
```
Expected: FAIL — module not found.

**Step 3: Implement the helper**

Create `extensions/openspace-core/src/browser/resolve-content-path.ts`:

```typescript
/**
 * Resolves a user-supplied content path into a fully-qualified file:// URI string.
 *
 * Rules:
 *  - Absolute paths (starting with `/` or `file://`) are returned as-is (just ensure extension).
 *  - Paths containing a directory separator (`/`) are treated as relative to workspaceRoot.
 *  - Bare names (no `/`) are placed under `configuredFolder` inside workspaceRoot.
 *
 * @param inputPath      The path the caller provided (bare name, relative, or absolute).
 * @param configuredFolder  Preference value e.g. "openspace/whiteboards" (relative to workspace).
 * @param workspaceRootUri  The workspace root as a file:// URI string.
 * @param extension      The required file extension including dot, e.g. ".whiteboard.json".
 */
export function resolveContentPath(
    inputPath: string,
    configuredFolder: string,
    workspaceRootUri: string,
    extension: string,
): string {
    // Ensure extension is present
    const withExt = inputPath.endsWith(extension) ? inputPath : `${inputPath}${extension}`;

    // Absolute path — return as-is
    if (withExt.startsWith('/') || withExt.startsWith('file://')) {
        return withExt;
    }

    // Relative path with dir separator — resolve directly under workspace root
    const root = workspaceRootUri.replace(/\/$/, '');
    if (withExt.includes('/')) {
        return `${root}/${withExt}`;
    }

    // Bare name — place under the configured folder
    const folder = configuredFolder.replace(/\/$/, '');
    return `${root}/${folder}/${withExt}`;
}
```

**Step 4: Run tests**

```bash
yarn test:unit 2>&1 | grep -A10 "resolveContentPath"
```
Expected: 5 passing.

**Step 5: Build openspace-core**

```bash
yarn --cwd extensions/openspace-core build 2>&1
```
Expected: `Done in ...`

**Step 6: Commit**

```bash
git add extensions/openspace-core/src/browser/resolve-content-path.ts \
        extensions/openspace-core/src/browser/__tests__/resolve-content-path.spec.ts
git commit -m "feat(core): add resolveContentPath helper for content folder path resolution"
```

---

## Task 4: Wire Path Resolution into `WhiteboardService`

**Files:**
- Modify: `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts`
- Modify: `extensions/openspace-whiteboard/src/browser/openspace-whiteboard-frontend-module.ts`
- Modify: `extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts`

**Step 1: Add failing test for default-path behaviour**

Add to `whiteboard-service.spec.ts` (after existing tests):

```typescript
import { resolveContentPath } from '../../../openspace-core/src/browser/resolve-content-path';

describe('WhiteboardService.createWhiteboard — path resolution', () => {
    let service: WhiteboardService;
    let createStub: sinon.SinonStub;
    let rootsStub: sinon.SinonStub;

    beforeEach(() => {
        service = new WhiteboardService();
        createStub = sinon.stub().resolves();
        rootsStub = sinon.stub().returns([{ resource: { toString: () => 'file:///workspace' } }]);
        (service as any).fileService = {
            create: createStub,
            createFolder: sinon.stub().resolves(),
            exists: sinon.stub().resolves(false),
        };
        (service as any).workspaceService = { tryGetRoots: rootsStub };
        (service as any).preferenceService = {
            get: sinon.stub().withArgs('openspace.paths.whiteboards').returns('openspace/whiteboards'),
        };
        (service as any).logger = { warn: sinon.stub(), info: sinon.stub() };
    });

    it('creates file under configured folder for bare name', async () => {
        await service.createWhiteboard('myboard');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.include('openspace/whiteboards/myboard.whiteboard.json');
    });

    it('respects absolute file:// path, does not modify it', async () => {
        const abs = 'file:///tmp/myboard.whiteboard.json';
        await service.createWhiteboard(abs);
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.equal(abs);
    });
});
```

**Step 2: Run to confirm it fails**

```bash
yarn test:unit 2>&1 | grep -A5 "path resolution"
```

**Step 3: Update `WhiteboardService`**

In `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts`:

Add imports at top:
```typescript
import { PreferenceService } from '@theia/core/lib/browser/preferences';
import { resolveContentPath } from '../../openspace-core/src/browser/resolve-content-path';  // dev-time; use lib path after build
import { OpenspacePreferences } from '../../openspace-settings/src/browser/openspace-preferences';
```

> **Note on import paths:** During development the source paths above work. The final imports in the built extension use the `lib/` paths. Since all extensions are compiled together in one webpack bundle, cross-extension source imports work correctly at dev time. Alternatively, factor the helper into `openspace-core` as a package export — but for now, a direct relative import is fine.

Add `@inject(PreferenceService)` field to the class:
```typescript
@inject(PreferenceService)
protected readonly preferenceService!: PreferenceService;
```

Replace the `createWhiteboard` method body (the path normalization section):
```typescript
async createWhiteboard(path: string, title?: string): Promise<string> {
    // Resolve to a full URI using configured default folder
    const roots = this.workspaceService.tryGetRoots();
    const workspaceRoot = roots[0]?.resource.toString() ?? 'file:///';
    const configuredFolder = this.preferenceService.get<string>(
        OpenspacePreferences.WHITEBOARDS_PATH,
        'openspace/whiteboards'
    );

    let resolvedUri = resolveContentPath(path, configuredFolder, workspaceRoot, '.whiteboard.json');

    // Auto-create parent folder if it doesn't exist
    const uri = new URI(resolvedUri);
    const parentUri = uri.parent;
    const parentExists = await this.fileService.exists(parentUri);
    if (!parentExists) {
        await this.fileService.createFolder(parentUri);
        this.logger.info('[WhiteboardService] Created folder:', parentUri.toString());
    }

    // Create with minimal empty snapshot
    const emptySnapshot: WhiteboardData = {
        store: {} as Record<string, unknown>,
        schema: { schemaVersion: 2, sequences: {} }
    } as unknown as WhiteboardData;

    const content = JSON.stringify(emptySnapshot, null, 2);
    await this.fileService.create(uri, content);

    this.logger.info('[WhiteboardService] Created whiteboard:', resolvedUri);
    return resolvedUri;
}
```

**Step 4: Wire `PreferenceService` in the frontend module**

In `openspace-whiteboard-frontend-module.ts`, `PreferenceService` is already provided by Theia's core container — no additional binding needed. The `@inject(PreferenceService)` decorator is sufficient.

**Step 5: Run tests**

```bash
yarn test:unit 2>&1 | grep -A10 "WhiteboardService"
```
Expected: all existing tests + 2 new path-resolution tests pass.

**Step 6: Build whiteboard extension**

```bash
yarn --cwd extensions/openspace-whiteboard build 2>&1
```
Expected: `Done in ...`

**Step 7: Commit**

```bash
git add extensions/openspace-whiteboard/
git commit -m "feat(whiteboard): resolve new files into configured openspace/whiteboards folder"
```

---

## Task 5: Wire Path Resolution into `PresentationService`

Same pattern as Task 4, applied to the presentation extension.

**Files:**
- Modify: `extensions/openspace-presentation/src/browser/presentation-service.ts`
- Modify: `extensions/openspace-presentation/src/browser/__tests__/presentation-service.spec.ts`

**Step 1: Add failing test**

Add to `presentation-service.spec.ts`:

```typescript
describe('PresentationService.createPresentation — path resolution', () => {
    let service: PresentationService;
    let createStub: sinon.SinonStub;

    beforeEach(() => {
        service = new PresentationService();
        createStub = sinon.stub().resolves();
        (service as any).fileService = {
            create: createStub,
            createFolder: sinon.stub().resolves(),
            exists: sinon.stub().resolves(false),
        };
        (service as any).workspaceService = {
            roots: Promise.resolve([{ resource: { toString: () => 'file:///workspace' } }]),
        };
        (service as any).preferenceService = {
            get: sinon.stub().withArgs('openspace.paths.decks').returns('openspace/decks'),
        };
        (service as any).logger = { warn: sinon.stub(), info: sinon.stub() };
    });

    it('creates file under configured folder for bare name', async () => {
        await service.createPresentation('myslides', 'My Slides');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.include('openspace/decks/myslides.deck.md');
    });

    it('respects absolute file:// path unchanged', async () => {
        const abs = 'file:///tmp/myslides.deck.md';
        await service.createPresentation(abs, 'My Slides');
        const calledUri = createStub.firstCall.args[0].toString();
        expect(calledUri).to.equal(abs);
    });
});
```

**Step 2: Run to confirm failure**

```bash
yarn test:unit 2>&1 | grep -A5 "PresentationService.*path"
```

**Step 3: Update `PresentationService`**

In `extensions/openspace-presentation/src/browser/presentation-service.ts`, add imports:
```typescript
import { PreferenceService } from '@theia/core/lib/browser/preferences';
import { resolveContentPath } from '../../openspace-core/src/browser/resolve-content-path';
import { OpenspacePreferences } from '../../openspace-settings/src/browser/openspace-preferences';
```

Add inject field:
```typescript
@inject(PreferenceService)
protected readonly preferenceService!: PreferenceService;
```

Replace `createPresentation` path resolution (the `finalPath` block at the start of the method):
```typescript
async createPresentation(
    path: string,
    title: string,
    slides: string[] = ['# Slide 1\n\nWelcome to your presentation'],
    options?: DeckOptions
): Promise<string> {
    // Resolve to a full URI using configured default folder
    const roots = await this.workspaceService.roots;
    const workspaceRoot = roots[0]?.resource.toString() ?? 'file:///';
    const configuredFolder = this.preferenceService.get<string>(
        OpenspacePreferences.DECKS_PATH,
        'openspace/decks'
    );

    const resolvedUri = resolveContentPath(path, configuredFolder, workspaceRoot, '.deck.md');

    const uri = new URI(resolvedUri);

    // Auto-create parent folder if it doesn't exist
    const parentUri = uri.parent;
    const parentExists = await this.fileService.exists(parentUri);
    if (!parentExists) {
        await this.fileService.createFolder(parentUri);
        this.logger.info('[PresentationService] Created folder:', parentUri.toString());
    }

    const content = this.buildDeckContent(title, slides, options);
    await this.fileService.create(uri, content);

    this.logger.info('[PresentationService] Created presentation:', resolvedUri);
    return resolvedUri;
}
```

**Step 4: Run tests**

```bash
yarn test:unit 2>&1 | grep -A10 "PresentationService"
```
Expected: all pass.

**Step 5: Build presentation extension**

```bash
yarn --cwd extensions/openspace-presentation build 2>&1
```
Expected: `Done in ...`

**Step 6: Commit**

```bash
git add extensions/openspace-presentation/
git commit -m "feat(presentation): resolve new files into configured openspace/decks folder"
```

---

## Task 6: Full Build + Smoke Test ✅ COMPLETE

**Step 1: Full build** — DONE (clean, 0 errors)

**Step 2: Run all unit tests** — DONE

```
561 passing (2s)   0 failing
```

**Step 3: Smoke test results (2026-02-20)**

- Settings UI (Theia Ctrl+,, search "openspace"):
  - `openspace.paths.decks` shown under "Openspace › Paths: Decks" with default `openspace/decks` ✅
  - `openspace.paths.whiteboards` shown under "Openspace › Paths: Whiteboards" with default `openspace/whiteboards` ✅

- End-to-end path routing via MCP:
  - `openspace.whiteboard.create` with bare name `"smoke-test-wb"` → created at `openspace/whiteboards/smoke-test-wb.whiteboard.json` ✅
  - `openspace.presentation.create` with bare name `"smoke-test-deck"` → created at `openspace/decks/smoke-test-deck.deck.md` ✅
  - Both parent folders auto-created silently ✅

All tasks complete. No post-smoke tweaks needed.

---

## Notes

- The `resolveContentPath` helper intentionally uses string manipulation rather than Theia's `URI` class to stay testable without a DOM/Theia container.
- `FileService.exists` is available in Theia 1.68.2 — verify signature is `exists(resource: URI): Promise<boolean>`. If not, use `fileService.resolve(uri).then(() => true).catch(() => false)` as a fallback.
- The `openspace-settings` extension has no `@theia/preferences` in its `package.json` yet — it inherits `@theia/core` which re-exports `PreferenceContribution`. That is sufficient for the schema registration.
- `PreferenceService` is provided by `@theia/core`'s browser container — no explicit binding needed in the whiteboard/presentation frontend modules.
