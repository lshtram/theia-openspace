# Chat Auto-Scroll, Widget Placement & pane.open sourcePaneId Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix chat auto-scroll so the viewport always follows new content; move the chat widget to the right sidebar with float-to-window support; add `sourcePaneId` to `pane.open` so the agent can split a specific existing pane.



**Architecture:**
- Auto-scroll: two targeted fixes in `message-timeline.tsx` — unconditional scroll on new message, reliable scroll during streaming
- Chat placement: change `area` to `'right'` in `chat-view-contribution.ts`; implement `ExtractableWidget` on `ChatWidget` so the user can pop it into a floating OS window via Theia's `SecondaryWindowHandler`
- `sourcePaneId`: add optional param to MCP schema (`hub-mcp.ts`) and `PaneOpenArgs`; in `openContent()` resolve the widget with `shell.getWidgetById()` and pass it as `ref` in `widgetOptions`

**Tech Stack:** React (hooks), Theia ApplicationShell / ExtractableWidget / SecondaryWindowHandler, TypeScript, Mocha/Chai unit tests

---

## Task 1: Fix chat auto-scroll

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-timeline.tsx:141-183`

### Step 1: Understand current behaviour

Read `message-timeline.tsx` lines 141–183. The problem is:

1. **New-message effect** (line 142): only scrolls if `isNearBottom`. When the agent sends the first reply, the viewport may already be > 50px from the bottom (the initial mount scroll is `'auto'` but the content shifts), so the guard suppresses the scroll.
2. **Streaming effect** (line 170): reads `scrollHeight` before the new token has been painted. The distance check can be stale so no scroll fires.

### Step 2: Apply the fix

In `message-timeline.tsx`, replace the **new-message effect** (lines 141–167) with an unconditional scroll — the user intentionally sent/received a message so we always want to see it. Only suppress scroll if the user is actively scrolling *up* mid-stream:

```tsx
// Auto-scroll logic for new messages
React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const messageCountChanged = messages.length !== lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (messageCountChanged) {
        if (!isUserScrollingRef.current) {
            // Always scroll to show new message — user sent it or agent replied.
            const timer = setTimeout(() => {
                scrollToBottom('smooth');
            }, 50);
            return () => clearTimeout(timer);
        } else {
            // User is actively scrolling; show indicator instead.
            setHasNewMessages(true);
        }
    }
    return undefined;
}, [messages, scrollToBottom]);
```

Also replace the **streaming effect** (lines 169–183) to always scroll when streaming (not gated on stale scroll position):

```tsx
// Auto-scroll during streaming — fire after paint so scrollHeight is current
React.useEffect(() => {
    if (!isStreaming || isUserScrollingRef.current) return;
    requestAnimationFrame(() => {
        bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
}, [streamingData, isStreaming]);
```

### Step 3: Run the unit tests

```bash
yarn test:unit
```

Expected: **446 passing** (no regressions — these effects have no unit test coverage, which is fine; they are tested manually).

### Step 4: Commit

```bash
git add extensions/openspace-chat/src/browser/message-timeline.tsx
git commit -m "fix(chat): always auto-scroll on new message; fix streaming scroll using rAF"
```

---

## Task 2: Move chat to right sidebar

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-view-contribution.ts:38-41`

### Step 1: Change the area and rank

In `chat-view-contribution.ts`, update `defaultWidgetOptions`:

```typescript
defaultWidgetOptions: {
    area: 'right',
    rank: 500
},
```

`rank: 500` places it below any Theia built-in right-panel tools (which typically use ranks 100–400).

### Step 2: Run unit tests

```bash
yarn test:unit
```

Expected: **446 passing**.

### Step 3: Commit

```bash
git add extensions/openspace-chat/src/browser/chat-view-contribution.ts
git commit -m "feat(chat): move chat widget to right sidebar (independent of file tree)"
```

---

## Task 3: Make ChatWidget extractable (float to OS window)

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx:17-58`

Theia's `SecondaryWindowHandler.moveWidgetToSecondaryWindow()` requires the widget to implement `ExtractableWidget`. The interface adds two fields: `isExtractable: boolean` and `secondaryWindow: Window | undefined`. Theia automatically adds a "Move to new window" button in the widget tab context menu when `isExtractable` is `true`.

### Step 1: Add the ExtractableWidget interface

Import `ExtractableWidget` and implement it on `ChatWidget`:

```typescript
import { ExtractableWidget } from '@theia/core/lib/browser/widgets/extractable-widget';
```

Add to the class body (after the `title.iconClass` line):

```typescript
// ExtractableWidget — allows the user to pop the chat into a floating OS window
readonly isExtractable: boolean = true;
secondaryWindow: Window | undefined = undefined;
```

That's it. The `SecondaryWindowHandler` is already wired into Theia's shell and will detect these fields automatically.

### Step 2: Verify TypeScript compiles

```bash
yarn build 2>&1 | grep -E "error TS|ERROR"
```

Expected: no errors.

### Step 3: Run unit tests

```bash
yarn test:unit
```

Expected: **446 passing**.

### Step 4: Commit

```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "feat(chat): implement ExtractableWidget so chat can float to a secondary OS window"
```

---

## Task 4: Add `sourcePaneId` to `pane.open`

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts` (pane.open schema)
- Modify: `extensions/openspace-core/src/browser/pane-service.ts` (`PaneOpenArgs` + `openContent`)
- Modify: `extensions/openspace-core/src/browser/__tests__/pane-service.spec.ts` (new test)

### Step 1: Write the failing test first

In `pane-service.spec.ts`, add a test that passes `sourcePaneId` and verifies `editorManager.open` is called with a `ref` widget. Find the `describe('openContent')` block (or wherever the existing `editor` type tests are) and add:

```typescript
it('should pass ref widget when sourcePaneId resolves to a known widget', async () => {
    const refWidget = { id: 'source-pane-123' } as any;
    (mockShell.getWidgetById as sinon.SinonStub).returns(refWidget);

    const result = await service.openContent({
        type: 'editor',
        contentId: '/workspace/foo.ts',
        sourcePaneId: 'source-pane-123',
        splitDirection: 'vertical',
    });

    expect(result.success).to.be.true;
    const openCall = (mockEditorManager.open as sinon.SinonStub).getCall(0);
    expect(openCall.args[1].widgetOptions.ref).to.equal(refWidget);
    expect(openCall.args[1].widgetOptions.mode).to.equal('split-right');
});

it('should ignore sourcePaneId when it does not resolve to a known widget', async () => {
    (mockShell.getWidgetById as sinon.SinonStub).returns(undefined);

    const result = await service.openContent({
        type: 'editor',
        contentId: '/workspace/foo.ts',
        sourcePaneId: 'nonexistent-pane',
        splitDirection: 'vertical',
    });

    expect(result.success).to.be.true;
    const openCall = (mockEditorManager.open as sinon.SinonStub).getCall(0);
    // ref should be absent (undefined) — falls back to active widget
    expect(openCall.args[1].widgetOptions.ref).to.be.undefined;
});
```

Also check that the `mockShell` stub in the spec already has `getWidgetById` — if not, add it:
```typescript
getWidgetById: sinon.stub().returns(undefined),
```

### Step 2: Run test to verify it fails

```bash
yarn test:unit 2>&1 | grep -E "passing|failing|sourcePaneId"
```

Expected: test errors (property doesn't exist on `PaneOpenArgs` yet).

### Step 3: Add `sourcePaneId` to `PaneOpenArgs`

In `pane-service.ts`, update the interface:

```typescript
export interface PaneOpenArgs {
    type: 'editor' | 'terminal' | 'presentation' | 'whiteboard';
    contentId: string;
    title?: string;
    splitDirection?: 'horizontal' | 'vertical';
    /** Optional: ID of an existing pane to split relative to. When provided and the
     *  widget is found, the new pane is opened relative to it (respecting splitDirection).
     *  If the widget is not found, falls back to the currently active widget. */
    sourcePaneId?: string;
}
```

### Step 4: Use `sourcePaneId` in `openContent`

In `openContent()`, in the `type === 'editor'` branch, resolve the ref widget and add it to `widgetOptions`:

```typescript
// Resolve optional source pane for targeted splitting
const refWidget = args.sourcePaneId
    ? this.shell.getWidgetById(args.sourcePaneId) ?? undefined
    : undefined;

const widgetOptions: ApplicationShell.WidgetOptions = {
    area: 'main',
    mode: args.splitDirection === 'vertical' ? 'split-right' :
          args.splitDirection === 'horizontal' ? 'split-bottom' : 'tab-after',
    ...(refWidget ? { ref: refWidget } : {}),
};
```

Replace the existing `widgetOptions` block in the editor branch with this.

### Step 5: Update `hub-mcp.ts` schema

In `registerPaneTools()`, add `sourcePaneId` to the `pane.open` schema:

```typescript
server.tool(
    'openspace.pane.open',
    'Open a pane in the IDE (editor, terminal, preview, etc.)',
    {
        type: z.enum(['editor', 'terminal', 'presentation', 'whiteboard']).describe('Pane type'),
        contentId: z.string().describe('Content identifier: file path for editor, or terminal title'),
        title: z.string().optional().describe('Optional label for the pane tab'),
        splitDirection: z.enum(['horizontal', 'vertical']).optional()
            .describe('Split direction when opening alongside existing content'),
        sourcePaneId: z.string().optional()
            .describe('ID of an existing pane to split relative to. When provided, the new pane ' +
                      'is placed relative to that specific pane instead of the currently active one. ' +
                      'Use pane.list to obtain pane IDs.'),
    },
    async (args: any) => this.executeViaBridge('openspace.pane.open', args)
);
```

### Step 6: Run tests and verify all pass

```bash
yarn test:unit
```

Expected: **446 passing** (or more, with the two new tests added).

### Step 7: Verify build is clean

```bash
yarn build 2>&1 | grep -E "error TS|ERROR" | head -20
```

Expected: no errors.

### Step 8: Commit

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts \
        extensions/openspace-core/src/browser/pane-service.ts \
        extensions/openspace-core/src/browser/__tests__/pane-service.spec.ts
git commit -m "feat(mcp): add sourcePaneId to pane.open for targeted pane splitting"
```

---

## Task 5: Add low-latency pane cache to WORKPLAN (Technical Debt)

**Files:**
- Modify: `docs/architecture/WORKPLAN.md` (Technical Debt section)

### Step 1: Add the entry

In the `## Technical Debt` section of `WORKPLAN.md`, add a new subsection after the existing entries:

```markdown
### MCP Read-Tool Latency: Push-Based Pane Cache

**Issue:** All MCP read tools (`pane.list`, `editor.read_file`, etc.) incur a full
bridge round-trip: MCP HTTP → Hub → RPC WebSocket → browser → response. This adds
200–500ms per call regardless of how cheap the underlying operation is.

**Root cause:** The browser is the sole source of truth for IDE state (widget list,
open files, etc.), so every read requires a round-trip from the Node hub to the
browser and back.

**Recommended solution (push-based cache):**
- `PaneService.onPaneLayoutChanged` already emits a full `PaneStateSnapshot` on every
  layout change (pane open/close/focus/resize).
- The Hub should subscribe to these events over the bridge (push path) and store the
  last snapshot in memory.
- `pane.list` then returns the cached snapshot synchronously — no round-trip.
- Same pattern can be applied to any other read-heavy tool (editor open files, terminal
  list, etc.).

**Scope:** Affects ALL MCP read tools. Implementing for `pane.list` alone is a 1–2 hour
  task; a general push-cache for all read tools is ~4 hours.

**Status:** ⬜ NOT STARTED  
**Estimated effort:** 1–4 hours (pane.list only → all read tools)  
**Dependencies:** Phase T3 complete (already done)
```

### Step 2: Commit

```bash
git add docs/architecture/WORKPLAN.md
git commit -m "docs: add MCP read-tool latency / push-based pane cache to Technical Debt"
```

---

## Final Verification

```bash
yarn test:unit
```

Expected: **446 passing** (or 448 with the two new `sourcePaneId` tests).

```bash
yarn build 2>&1 | grep -E "error TS|ERROR"
```

Expected: no errors.
