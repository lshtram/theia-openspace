# Code Review — theia-openspace
**Date:** 2026-02-20
**Reviewer:** Claude Sonnet 4.6 (automated deep review)
**Branch:** `master`
**Scope:** All files modified since last merge — 41 changed files across 8 extensions + E2E suite + scripts
**Method:** Full source read of every modified file, cross-referenced against architecture docs, `.opencode/_context/`, and prior review history.

---

## Table of Contents

1. [%%OS{...}%% Legacy Protocol — Verdict & Cleanup Plan](#1-os-legacy-protocol--verdict--cleanup-plan)
2. [Critical Security & Correctness Bugs](#2-critical-security--correctness-bugs)
3. [High-Priority Bugs](#3-high-priority-bugs)
4. [Architecture & Design Issues](#4-architecture--design-issues)
5. [Type Safety](#5-type-safety)
6. [React / UI Correctness](#6-react--ui-correctness)
7. [Test Coverage Gaps](#7-test-coverage-gaps)
8. [Test Quality & Efficiency Issues](#8-test-quality--efficiency-issues)
9. [Code Quality / Minor Issues](#9-code-quality--minor-issues)
10. [Summary Table](#10-summary-table)

---

## 1. %%OS{...}%% Legacy Protocol — Verdict & Cleanup Plan

### Verdict: **Correctly retired. Cleanup is incomplete.**

The `%%OS{...}%%` protocol was the Phase 1–2 in-band command system where the agent embedded IDE commands directly in its text response stream. Phase T3 replaced this entirely with MCP tools over HTTP. The Phase T3 result document (`.opencode/_context/active_tasks/phase-t3-mcp/result.md`) confirms: *"The `%%OS{...}%%` stream interceptor is retired."*

A `grep` of all production extension source code (`extensions/`) returns **zero matches** — the removal from production code is complete and correct.

However, the cleanup is incomplete in three places:

### 1.1 `scripts/verify-phase-1b1-fixes.js` — DELETE THIS FILE

This script was written to verify Phase 1B1 fixes to the `%%OS` stream interceptor. The entire system it tests no longer exists. The file still parses `%%OS{...}%%` patterns (`line 88: /%%OS\{[\s\S]*?\}%%/g`) and tests edge cases for the retired parser. It should be deleted entirely.

```
scripts/verify-phase-1b1-fixes.js  ← DELETE
```

### 1.2 `tests/e2e/agent-control.spec.ts` — Two tests are testing a retired system

**Test 1 (line 92):** `'Stream interceptor: %%OS{...}%% block is NOT displayed in chat UI'`
**Test 2 (line 146):** `'Stream interceptor: plain text passes through unchanged'`

These test names reference the stream interceptor which no longer exists. The test bodies inject events that **already have the `%%OS` content pre-stripped** (`'Hello  World'` — note the double space where the block was, line 119). They assert `%%OS` does not appear in the DOM, but since the injected text never contained `%%OS`, these tests trivially pass and prove nothing.

**What to do:**
- Rename/repurpose Test 1: change it to inject a message with `%%OS{"cmd":"test"}%%` still present and assert it does NOT appear. This would catch any regression where the old protocol re-appears in the chat UI. OR:
- Delete both tests entirely since the stream interceptor is gone. The MCP path does not produce `%%OS` text by design — there is nothing to strip.
- The test for "plain text passes through unchanged" is still valid but should be renamed: `'MessageTimeline: plain assistant text renders in the chat UI'`.

### 1.3 `.opencode/_context/01_memory/known_issues.md` line 70 — Update the known issue

```
Stream interceptor cannot handle `%%OS{...}%%` blocks split across SSE chunks.
```

This known issue is no longer relevant. The stream interceptor was removed. This entry should be deleted or replaced with a note that it was resolved by the Phase T3 MCP migration.

### 1.4 `design/deck/` and `.opencode/_context/` — Historical, leave as-is

The remaining `%%OS` occurrences in design decks and context files are historical documentation and should be left as-is. They accurately describe what the system used to do. Deleting them would lose valuable architectural history.

---

## 2. Critical Security & Correctness Bugs

### 2.1 `openspace.file.patch` bypasses ArtifactStore — **`hub-mcp.ts:423-428`**

**Severity: 🔴 Critical**

```typescript
// openspace.file.write (line 361) — CORRECT: goes through ArtifactStore
await this.artifactStore.write(relPath, args.content, { actor: 'agent', reason: '...' });

// openspace.file.patch (line 428) — BUG: writes directly, bypasses ArtifactStore
fs.writeFileSync(resolved, patched, 'utf-8');
```

`openspace.file.write` routes through `ArtifactStore.write()` which provides: atomic writes, audit logging, chokidar actor tracking (distinguishing agent vs. user edits), and OCC versioning. `openspace.file.patch` bypasses all of this with a raw `fs.writeFileSync`. This is architecturally inconsistent and functionally dangerous:
- Patch operations cannot be audited
- The chokidar watcher cannot distinguish agent-patched files from user edits
- The PatchEngine version counter does not increment, so subsequent `artifact.patch` calls may see a stale version

**Fix:** Route through `artifactStore.write()` after building the patched content:
```typescript
const relPath = path.relative(this.workspaceRoot, resolved);
await this.artifactStore.write(relPath, patched, { actor: 'agent', reason: 'openspace.file.patch MCP tool' });
```

### 2.2 Symlink escape of workspace boundary — **`hub-mcp.ts:801-807`**

**Severity: 🔴 Critical**

```typescript
private resolveSafePath(filePath: string): string {
    const resolved = path.resolve(this.workspaceRoot, filePath);
    if (!resolved.startsWith(this.workspaceRoot + path.sep) && resolved !== this.workspaceRoot) {
        throw new Error(`Path traversal detected...`);
    }
    return resolved;
}
```

`path.resolve()` does **not** follow symlinks — it only resolves `.` and `..` segments lexically. If the workspace contains a symlink (e.g., `project/link -> /etc/passwd`), `path.resolve('/workspace', 'project/link')` returns `/workspace/project/link`, which passes the boundary check. But `fs.readFileSync('/workspace/project/link')` follows the symlink and reads `/etc/passwd`.

**Fix:** Use `fs.realpathSync()` after the lexical resolve, and only if the path exists:
```typescript
const lexical = path.resolve(this.workspaceRoot, filePath);
// Check lexical boundary first (fast, catches obvious traversal)
if (!lexical.startsWith(this.workspaceRoot + path.sep) && lexical !== this.workspaceRoot) {
    throw new Error(`Path traversal detected: "${filePath}"`);
}
// Resolve symlinks for existing paths, re-check boundary
let resolved = lexical;
try {
    resolved = fs.realpathSync(lexical);
    if (!resolved.startsWith(this.workspaceRoot + path.sep) && resolved !== this.workspaceRoot) {
        throw new Error(`Symlink escape detected: "${filePath}" resolves outside workspace`);
    }
} catch (err: any) {
    if (err.code !== 'ENOENT') { throw err; }
    // File doesn't exist yet (write path) — lexical check is sufficient
}
return resolved;
```

### 2.3 Multiple browser tabs silently kill all MCP bridge tools — **`openspace-core-backend-module.ts:46-48`**

**Severity: 🔴 Critical**

```typescript
// Called once per JSON-RPC connection (i.e., once per browser tab/window)
const handler = (client: OpenCodeClient) => {
    const hub = ctx.container.get<OpenSpaceHub>(OpenSpaceHub);
    hub.setClientCallback(command => client.onAgentCommand(command));  // overwrites previous
};
```

`hub.setClientCallback()` stores exactly one callback. Every new browser connection (tab, window, reconnect after refresh) overwrites the previous one. If a user has the IDE open in two tabs, tab 1's bridge is silently disconnected — all MCP tools that go through `executeViaBridge()` will send commands to tab 2 only. Tab 1 gets no error; its pending commands simply time out after 30 seconds.

**Fix (minimal):** Log a warning when overwriting an existing callback. Document this as a known single-tab limitation. A more complete fix requires broadcasting to all connected clients and routing responses back to the originating client via the `requestId`.

### 2.4 `workspaceRoot` is not `readonly` — **`hub-mcp.ts:82`**

**Severity: 🔴 Critical (latent)**

```typescript
private workspaceRoot: string;  // should be readonly
```

Every security decision in `hub-mcp.ts` pivots on `workspaceRoot` being immutable. Nothing currently mutates it, but the lack of `readonly` means a future developer could accidentally reassign it (e.g., in a test helper). This would silently disable all path-traversal protection.

**Fix:** `private readonly workspaceRoot: string;`

---

## 3. High-Priority Bugs

### 3.1 Timer leak when `bridgeCallback` throws — **`hub-mcp.ts:763-777`**

**Severity: 🟠 High**

```typescript
const resultPromise = new Promise<CommandBridgeResult>((resolve, reject) => {
    const timer = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        reject(new Error(`Command timed out after ${this.commandTimeoutMs}ms: ${cmd}`));
    }, this.commandTimeoutMs);
    this.pendingCommands.set(requestId, { resolve, reject, timer });
});

const command: AgentCommand = { cmd, args, requestId };
try {
    this.bridgeCallback(command);
} catch (err) {
    this.pendingCommands.delete(requestId);
    // BUG: timer is NOT cleared here
    return { content: [{ type: 'text', text: `Error: Failed to dispatch command: ${String(err)}` }], isError: true };
}
```

When `bridgeCallback` throws synchronously, `pendingCommands.delete(requestId)` removes the map entry, but the `timer` (already scheduled) is never `clearTimeout()`'d. Thirty seconds later it fires, calls `delete` on an already-absent key (harmless), and calls `reject()` on an already-abandoned Promise (which in Node.js generates an unhandled rejection warning). Each bridge error leaks one 30-second timer.

**Fix:**
```typescript
} catch (err) {
    const pending = this.pendingCommands.get(requestId);
    if (pending) {
        clearTimeout(pending.timer);
        this.pendingCommands.delete(requestId);
    }
    return { ... };
}
```

### 3.2 `SessionServiceWiring` side-effect may never execute — **`openspace-core-frontend-module.ts:59-69`**

**Severity: 🟠 High**

```typescript
bind(SessionServiceWiring).toDynamicValue(ctx => {
    const syncService = ctx.container.get<OpenCodeSyncServiceImpl>(OpenCodeSyncServiceImpl);
    const sessionService = ctx.container.get<SessionService>(SessionService);
    queueMicrotask(() => { syncService.setSessionService(sessionService); });
    return null;
}).inSingletonScope();
```

InversifyJS only evaluates a `toDynamicValue` factory when something calls `container.get(SessionServiceWiring)`. If nothing in the application ever requests `SessionServiceWiring`, the factory never runs, `syncService.setSessionService(sessionService)` is never called, and all SSE events received from the opencode server will fail to update `SessionService` state. The UI would appear to load but no messages, streaming state, or session changes would propagate.

The `inSingletonScope()` ensures it only runs once — but only if it runs at all.

**Fix option A (minimal):** Add `container.get(SessionServiceWiring)` somewhere guaranteed to execute, e.g., inside `BridgeContribution.onStart()`.

**Fix option B (preferred):** Eliminate the circular dependency. `OpenCodeSyncService` should not know about `SessionService`. Instead, `SessionService` subscribes to raw events via an `IOpenCodeEventSource` interface that `OpenCodeSyncService` implements. This removes the circular reference entirely and makes the wiring explicit at the `SessionService` level.

### 3.3 `/^git\//` pattern blocks legitimate `git/` directories — **`sensitive-files.ts:40`**

**Severity: 🟠 High**

```typescript
/^\.git\//,   // line 39 — correct: blocks .git/
/^git\//,     // line 40 — BUG: blocks any path starting with git/
```

The second pattern blocks any path whose first component is `git` without a leading dot — a legitimate project layout (e.g., a project with a `git/` utilities or scripts folder). The `.git/` directory is already fully covered by line 39. Line 40 appears to be a typo where the leading `.` was dropped.

**Fix:** Delete line 40.

### 3.4 `readAll()` exposes the internal mutable array — **`terminal-ring-buffer.ts:83-85`**

**Severity: 🟠 High**

```typescript
readAll(terminalId: string): string[] {
    return this.buffer.get(terminalId) || [];
}
```

When `terminalId` exists in the map, this returns a reference to the live internal array. Any caller who appends to or mutates this array (e.g., `result.push('extra')`, `result.splice(...)`) will corrupt the buffer's state. The `read()` method correctly uses `.slice(-lines)` which creates a new array. `readAll()` should do the same.

**Fix:**
```typescript
readAll(terminalId: string): string[] {
    return [...(this.buffer.get(terminalId) ?? [])];
}
```

### 3.5 Race condition: concurrent `loadSessions()` calls — **`chat-widget.tsx:403-410`**

**Severity: 🟠 High**

```typescript
const sessionChangedDisposable = sessionService.onActiveSessionChanged(() => {
    loadSessions();
});
const projectChangedDisposable = sessionService.onActiveProjectChanged(() => {
    loadSessions();
});
```

When switching a project, both `onActiveProjectChanged` and `onActiveSessionChanged` can fire in rapid succession. Two concurrent `getSessions()` HTTP requests race. Whichever resolves last wins, potentially setting an older session list. There is no request cancellation, generation counter, or debounce.

**Fix:** Use a monotonically increasing generation counter:
```typescript
const loadGenRef = React.useRef(0);
const loadSessions = React.useCallback(async () => {
    const gen = ++loadGenRef.current;
    setIsLoadingSessions(true);
    try {
        const sessions = await sessionService.getSessions();
        if (gen === loadGenRef.current) { setSessions(sessions); }  // stale check
    } finally {
        if (gen === loadGenRef.current) { setIsLoadingSessions(false); }
    }
}, [sessionService]);
```

### 3.6 Double `handleInput` invocation per keystroke — **`prompt-input.tsx:184-191, 469`**

**Severity: 🟠 High**

The editor div registers `handleInput` twice:
1. Via React synthetic event: `onInput={handleInput}` (line 469)
2. Via native event listener: `editorRef.current.addEventListener('input', handleInputRef.current)` (line 189)

Every regular keystroke fires both. The comment explains the native listener was added to handle toolbar-dispatched synthetic `input` events that bypass React's event system — but the result is that normal typing invokes `handleInput` twice, calling `parseFromDOM()` twice and potentially setting state twice per character.

**Fix:** Remove the `onInput={handleInput}` React prop from the JSX (line 469) and keep only the native listener, which handles both cases. Or use a flag to deduplicate.

### 3.7 `loadSessions` race on `onActiveSessionChanged` — also called at initial mount — **`chat-widget.tsx:370-371`**

**Severity: 🟠 Medium-High**

```typescript
// Inside the effect that subscribes to service events:
setMessages([...sessionService.messages]);
loadSessions();  // ← first load, no loading state visible yet
```

`loadSessions()` internally calls `setIsLoadingSessions(true)` as its first statement, but React batches this with the outer effect. On the very first render, the component briefly shows "No sessions yet" before showing the loading spinner, because `isLoadingSessions` starts as `false` and the first `setSessions` call hasn't happened yet. Initialize `isLoadingSessions` to `true` in the initial state:

```typescript
const [isLoadingSessions, setIsLoadingSessions] = React.useState(true);  // not false
```

---

## 4. Architecture & Design Issues

### 4.1 Three divergent write paths create incoherent audit trail — **`hub-mcp.ts`**

**Severity: 🟠 High**

There are now three distinct file-write mechanisms available to the agent:

| Tool | Write path | Audit log | Versioned | Atomic |
|---|---|---|---|---|
| `openspace.file.write` | `ArtifactStore.write()` | ✅ | ✅ | ✅ |
| `openspace.file.patch` | `fs.writeFileSync()` directly | ❌ | ❌ | ❌ |
| `openspace.artifact.patch` | `PatchEngine` → `ArtifactStore` | ✅ | ✅ | ✅ |

The `file.patch` tool is architecturally inconsistent. The tool description in hub-mcp.ts says `artifact.patch` is preferred over `file.write`, but `file.patch` has no such guidance and bypasses all protections. An agent following the "use the right tool" instructions would still reach for `file.patch` for simple text substitutions, silently losing all auditability.

**Fix:** Route `file.patch` through `ArtifactStore` (see §2.1). Consider also adding a deprecation note to `file.patch`'s tool description recommending `artifact.patch` for important files.

### 4.2 `McpServer` instantiated per HTTP request — **`hub-mcp.ts:132-146`**

**Severity: 🟡 Medium**

```typescript
private async handleMcpRequest(req: Request, res: Response): Promise<void> {
    const server = new McpServer({ name: 'openspace-hub', version: '1.0.0' });
    this.registerToolsOn(server);  // registers 40+ tools with their closures
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
}
```

A new `McpServer` is created and all 40+ tools re-registered on **every** MCP request. Each `tools/list` from the agent triggers this. At even moderate usage (an agent checking the tool list before calling a tool), this creates significant GC pressure from dozens of recreated closure objects.

The comment says "the SDK does not allow reuse of a connected instance" — this is true for a *connected* instance, but a disconnected server that has tools registered should be reusable. Investigate whether a pre-registered but unconnected `McpServer` instance can be cached and a fresh transport created per request.

### 4.3 Circular DI resolved with fragile `queueMicrotask` — **`openspace-core-frontend-module.ts:59-69`**

**Severity: 🟡 Medium** (see also §3.2 for the correctness bug aspect)

The `SessionService ↔ OpenCodeSyncService` circular dependency is resolved by a DI factory side-effect with a `queueMicrotask` delay. This is a code smell that indicates the dependency graph has a structural problem. The `queueMicrotask` is explained in a comment as ensuring "DI is fully resolved" — but DI in InversifyJS resolves synchronously within a `container.get()` chain, so the microtask provides no actual guarantee about resolution order.

The comment also notes the factory returns `null`, which is an unusual DI binding pattern. The factory is only used for its side effect, which is fragile.

**Recommended refactor:** Invert the dependency. `SessionService` should subscribe to `OpenCodeSyncService` events (via an `IOpenCodeEventBus` interface) in its `@postConstruct`. `OpenCodeSyncService` fires events; it never needs a back-reference to `SessionService`.

### 4.4 `exposeTestHelper` exposes in all non-production environments — **`permission-dialog-contribution.ts:130-162`**

**Severity: 🟡 Medium**

```typescript
let isDevMode = true;  // defaults to exposed
if (typeof process !== 'undefined' && ...) {
    const nodeEnv = (process as any).env.NODE_ENV;
    if (nodeEnv === 'production') {
        isDevMode = false;
    }
}
if (isDevMode) {
    // expose window.__openspace_test__
}
```

The code defaults to exposing the test hook, only hiding it when `NODE_ENV === 'production'`. Any environment where `NODE_ENV` is `undefined`, `'staging'`, `'qa'`, `'test'`, or anything other than `'production'` will expose `injectPermissionEvent` on `window.__openspace_test__`. The comment says "Only exposed in test/development mode" but the implementation is inverted — it is exposed by default and hidden only in explicit production.

**Fix:**
```typescript
const isDevMode = typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');
```

### 4.5 `OpenSpaceHub` bound only to its concrete class — **`openspace-core-backend-module.ts:54`**

**Severity: 🟢 Low**

```typescript
bind(OpenSpaceHub).toSelf().inSingletonScope();
bind(BackendApplicationContribution).toService(OpenSpaceHub);
```

`OpenSpaceHub` is injected via its concrete class symbol. This makes it difficult to mock in tests (e.g., `hub-mcp.spec.ts` creates an `OpenSpaceMcpServer` directly, bypassing the hub entirely). An `IOpenSpaceHub` interface would enable proper test doubles.

---

## 5. Type Safety

### 5.1 `as any as` double-cast bypasses all type checking — **`chat-widget.tsx:505`**

**Severity: 🟠 High**

```typescript
await sessionService.sendMessage(parts as any as MessagePartInput[], model);
```

`parts` is `PromptMessagePart[]` (from `prompt-input/types.ts`). `MessagePartInput[]` is from `opencode-protocol`. The cast via `any` means TypeScript cannot catch structural mismatches between the two. This is a flag that the two type systems have diverged.

Looking at the types:
- `PromptMessagePart` has `type: 'text' | 'file' | 'image'`, `text`, `path`, `mime_type`
- `MessagePartInput` (from the SDK protocol) likely has a different shape

**Fix:** Write an explicit adapter function `promptPartsToProtocolParts(parts: PromptMessagePart[]): MessagePartInput[]` that maps between the two, surfacing any structural mismatch at compile time.

### 5.2 Naming collision between SDK types and local prompt types

**Severity: 🟠 High**

`opencode-sdk-types.ts` exports: `TextPart`, `FilePart`, `AgentPart`, `ReasoningPart`
`prompt-input/types.ts` independently defines: `TextPart`, `FilePart`, `AgentPart`, `ImagePart`

These share names but have completely different shapes. `chat-widget.tsx` line 29 already has to alias the import: `import type { MessagePart as PromptMessagePart }`. Every file that imports from both modules must manage this aliasing manually, and future developers will inevitably import the wrong type.

**Fix:** Rename the prompt-input types to `PromptTextPart`, `PromptFilePart`, `PromptAgentPart`, `PromptImagePart`. Or namespace them under a `Prompt` namespace object.

### 5.3 `Part` union type includes an anonymous catch-all — **`opencode-sdk-types.ts:345`**

**Severity: 🟡 Medium**

```typescript
export type Part = TextPart | { type: string; [key: string]: unknown } | ...
```

The inline `{ type: string; [key: string]: unknown }` member of the union defeats discriminated union exhaustiveness. TypeScript will assign any object to this member, making `switch (part.type)` exhaustiveness checks useless. Every known part type should be an explicit named interface.

**Fix:** Replace with `UnknownPart = { type: string; [key: string]: unknown }` and document it as the forward-compatibility escape hatch for unknown part types from newer SDK versions.

### 5.4 `MessageOutputLengthError.data` has no `message` field — **`opencode-sdk-types.ts:74-79`**

**Severity: 🟢 Low**

```typescript
export type MessageOutputLengthError = {
    name: "MessageOutputLengthError";
    data: { [key: string]: unknown };  // no message field
};
```

All other error types (`ProviderAuthError`, `UnknownError`, `MessageAbortedError`, `ApiError`) have a `data.message: string` field. `MessageOutputLengthError` does not, breaking uniform error rendering. Any UI that displays `error.data.message` will get `undefined` for this type.

**Fix:** Add `message: string` to `MessageOutputLengthError.data`.

### 5.5 `private root: any | null = null` — **`permission-dialog-contribution.ts:58`**

**Severity: 🟢 Low**

```typescript
private root: any | null = null;
```

The React root from `createRoot()` is typed as `any`. Use `import type { Root } from 'react-dom/client'` or `ReturnType<typeof createRoot>` so the `.unmount()` call is type-checked.

### 5.6 `NodeJS.Timeout` used in browser component — **`message-timeline.tsx:56`**

**Severity: 🟢 Low**

```typescript
const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
```

Browser `setTimeout` returns `number`, not `NodeJS.Timeout`. This compiles because `@types/node` is in scope, but it is semantically wrong and creates confusion about the execution environment.

**Fix:** `React.useRef<ReturnType<typeof setTimeout> | null>(null)`

---

## 6. React / UI Correctness

### 6.1 Streaming data: two `setStreamingData` calls in one event handler — **`chat-widget.tsx:379-395`**

**Severity: 🟠 High**

```typescript
sessionService.onMessageStreaming((update: StreamingUpdate) => {
    setStreamingData(prev => {
        const next = new Map(prev);
        next.set(update.messageId, (next.get(update.messageId) || '') + update.delta);
        return next;
    });

    if (update.isDone) {
        setStreamingData(prev => {          // second call in same handler
            const next = new Map(prev);
            next.delete(update.messageId);
            return next;
        });
    }
});
```

Two `setStreamingData` calls in one synchronous callback. With React 18 automatic batching, both updates will be batched correctly. However, the sequence is: append delta, then delete. If `update.isDone` is true on the last delta, the content is appended and then immediately deleted in the same render — meaning the final delta of a streaming message is never visible in `streamingData` and may not render. The `MessageTimeline` component likely handles the final content from the message's parts list rather than `streamingData`, so this may not be visible as a bug — but it is fragile and hard to reason about.

**Fix:** Combine into one call:
```typescript
setStreamingData(prev => {
    const next = new Map(prev);
    if (update.delta) {
        next.set(update.messageId, (next.get(update.messageId) || '') + update.delta);
    }
    if (update.isDone) {
        next.delete(update.messageId);
    }
    return next;
});
```

### 6.2 `streamingMessageId` from `Map.keys().next().value` is fragile — **`chat-widget.tsx:590`**

**Severity: 🟡 Medium**

```typescript
streamingMessageId={isStreaming ? streamingData.keys().next().value : undefined}
```

`Map.keys().next().value` returns the first key inserted, which is not guaranteed to be the actively-streaming message if any prior message still has uncleared data in the map (e.g., due to a missed `isDone` event). If `streamingData` is empty despite `isStreaming` being `true` (the brief window between stream start and first delta), this returns `undefined`.

**Fix:** Track `streamingMessageId` explicitly in React state, set when streaming begins and cleared on `isDone`.

### 6.3 `checkScrollPosition` recreated on every scroll — **`message-timeline.tsx:61-77`**

**Severity: 🟡 Medium**

```typescript
const checkScrollPosition = React.useCallback(() => {
    const wasScrolledUp = isScrolledUp;
    ...
}, [isScrolledUp]);  // recreated when isScrolledUp changes
```

`checkScrollPosition` is a `useCallback` that depends on `isScrolledUp`. Every time the user scrolls and `isScrolledUp` changes, `checkScrollPosition` is recreated. `handleScroll` depends on `checkScrollPosition` (via its own `useCallback`), so `handleScroll` is also recreated, and the `useEffect` that registers the scroll event listener (lines ~122-133) tears down and re-registers the native listener on every scroll state change. During active scrolling, this creates a brief window where no listener is registered.

**Fix:** Use a `useRef` for scroll state instead of `useState` — it stores the value without triggering a re-render cascade:
```typescript
const isScrolledUpRef = React.useRef(false);
```
Update the ref directly in the scroll handler; only call `setState` when the "show scroll-to-bottom button" visibility needs to change (a separate state variable).

### 6.4 `getMessageGroupInfo` is redefined on every render — **`message-timeline.tsx:174-183`**

**Severity: 🟢 Low**

This function has no dependencies on component state or props. It should be defined outside the component entirely as a module-level pure function.

### 6.5 Conflicting document-level click handlers — **`chat-widget.tsx:427-438` + `150-159`**

**Severity: 🟡 Medium**

`ChatComponent` installs `document.addEventListener('click', ...)` to close the session dropdown. `ChatHeaderBar` installs `document.addEventListener('mousedown', ...)` to close the "more actions" menu. They don't coordinate:

- A click on the session toggle button fires `ChatComponent`'s click handler first (closes the dropdown), then React processes the button's `onClick` (re-opens the dropdown). The user sees no response.
- The `mousedown` handler in `ChatHeaderBar` fires before `click`, meaning `ChatComponent`'s click handler runs after the dropdown has already closed.

**Fix:** Use a `useRef` on the containing element and check `ref.current.contains(e.target)` in a single coordinated handler. Or use a portal with a backdrop element.

### 6.6 Auto-scroll RAF pattern is misleading — **`message-timeline.tsx:159-165`**

**Severity: 🟢 Low**

```typescript
React.useEffect(() => {
    if (!isStreaming || isUserScrollingRef.current) return;
    const rafId = requestAnimationFrame(() => {
        bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
    return () => cancelAnimationFrame(rafId);
}, [streamingData, isStreaming]);
```

`streamingData` is a new `Map` instance on every streaming delta. This effect fires on every delta. The cleanup (`cancelAnimationFrame`) runs on every re-render before the next effect, meaning the RAF is almost always cancelled and the scroll only fires on a render pause. This works in practice, but the code reads as though it should scroll every tick. Add a comment explaining the intentional cancel-and-reschedule pattern.

### 6.7 Slash command menu has no keyboard navigation — **`prompt-input.tsx:534-570`**

**Severity: 🟡 Medium**

The `@mention` typeahead has ArrowUp/Down, Enter-to-select, and Escape handling (lines 89-100). The `/command` slash menu only handles Escape (lines 112-118). There is no arrow key navigation, no Enter to select a slash command, and the code shows `index === 0` as selected (line 540) but there is no `selectedSlashIndex` state variable — the selection state is hardcoded to always show the first item as selected. The menu is completely keyboard-inaccessible.

**Fix:** Add `selectedSlashIndex` state alongside `selectedTypeaheadIndex` and duplicate the ArrowUp/Down/Enter handling from the typeahead section.

### 6.8 `insertTypeaheadItem` silently fails when cursor is not in a text node — **`prompt-input.tsx:221-255`**

**Severity: 🟡 Medium**

```typescript
const insertTypeaheadItem = (item: ...) => {
    const selection = window.getSelection();
    const textNode = selection?.anchorNode;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        setShowTypeahead(false);
        return;  // silently fails — @query text remains in editor
    }
    ...
};
```

If the cursor is positioned immediately after a pill span (a non-text node), `textNode.nodeType !== Node.TEXT_NODE` is true and the function returns early. The typeahead menu disappears but the `@query` text remains unsubstituted in the editor. The user sees no feedback and the `@` is left as raw text.

**Fix:** Add a fallback that appends the item to the editor even when the cursor position is unexpected, and log a warning.

### 6.9 `crypto.randomUUID()` requires secure context — **`prompt-input.tsx:20`**

**Severity: 🟢 Low**

`crypto.randomUUID()` throws in non-HTTPS contexts (some Electron or HTTP dev setups). Add a fallback:
```typescript
const generateId = () =>
    typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
```

### 6.10 File attachment uses bare filename as path — **`prompt-input.tsx:312-321`**

**Severity: 🟡 Medium**

```typescript
const handleRegularFile = (file: File) => {
    const filePart: FilePart = {
        type: 'file',
        path: file.name,    // "image.png" — not a workspace path
        ...
    };
};
```

`File.name` is the base filename only. `FilePart.path` is typed as "workspace-relative or absolute path". A bare `image.png` cannot be resolved server-side. This means the file-attachment feature for non-image files is currently non-functional.

### 6.11 Hardcoded hex colours bypass Theia theming — **`chat-widget.tsx:185, 190, 199, 200`**

**Severity: 🟢 Low**

```typescript
style={{ color: '#858585' }}   // multiple instances
style={{ color: '#f14c4c' }}
style={{ color: '#007acc' }}
```

These literals are invisible in dark mode, wrong in light mode, and invisible in high-contrast mode. The project has `OpenspaceChatColorContribution` which registers CSS variables. Use `var(--theia-descriptionForeground)`, `var(--theia-errorForeground)`, `var(--theia-focusBorder)` respectively.

### 6.12 XSS risk via `contentEditable` paste — **`prompt-input.tsx:handlePaste`**

**Severity: 🟡 Medium**

The `handlePaste` handler intercepts `image/*` file items. Non-image pastes fall through to default browser behavior, which in a `contentEditable` div may insert rich HTML (e.g., from pasting content from a webpage or Word document). The `parseFromDOM` function then traverses these nodes. If the parsed content is ever echoed back to the DOM without sanitization, this is an XSS vector. Additionally, the `%PILL%` placeholder text used in `parseFromDOM` could be injected by a malicious paste.

**Fix:** Call `e.preventDefault()` on all paste events and manually insert the clipboard text as plain text:
```typescript
const text = e.clipboardData?.getData('text/plain') || '';
document.execCommand('insertText', false, text);
```

---

## 7. Test Coverage Gaps

### 7.1 `openspace.file.patch` ArtifactStore bypass is untested — **`hub-mcp.spec.ts`**

No test verifies that `openspace.file.patch` uses `ArtifactStore`. Currently, the tests in Suite 5 test the underlying `resolveSafePath` and `fs` calls directly — not the registered tool handler. Add a test that:
1. Captures the registered `openspace.file.patch` handler using the `fakeServer` pattern
2. Calls it with valid args
3. Asserts that `artifactStore.write()` was called (via sinon spy) and NOT `fs.writeFileSync` directly

### 7.2 `openspace.artifact.patch` and `openspace.artifact.getVersion` missing from MCP smoke test — **`mcp-tools.spec.ts:27-67`**

```typescript
// Comment says "33 tools" — actual count in hub-mcp.ts is 35+
const EXPECTED_TOOLS = [
    // ...
    // Missing:
    // 'openspace.artifact.getVersion',
    // 'openspace.artifact.patch',
];
```

Both artifact tools are registered in `hub-mcp.ts` (lines 436-488) but absent from `EXPECTED_TOOLS`. The smoke test's tool count comment (`20 core + 10 presentation + 3 new whiteboard`) is also stale — it does not count the 2 artifact tools, 3 batch/replace/find whiteboard tools, and the 3 camera tools separately. The actual count is higher.

**Fix:** Add `'openspace.artifact.getVersion'` and `'openspace.artifact.patch'` to `EXPECTED_TOOLS`. Recount and update the comment.

### 7.3 `isSensitiveFile` uppercase path coverage missing — **`sensitive-files.ts`**

No test exercises uppercase filenames (`.ENV`, `CREDENTIALS.JSON`, `ID_RSA`). Given the `toLowerCase()` normalization in `isSensitiveFile`, these would match — but the inconsistency with the `i`-flagged patterns should be tested explicitly.

### 7.4 `sanitizeOutput` edge cases untested — **`terminal-ring-buffer.ts`**

The `sanitizeOutput` function handles four separate ANSI escape categories. No unit test covers:
- OSC sequences (`\x1B]0;title\x07` — terminal title-setting)
- RGB true-color ANSI codes (`\x1B[38;2;255;100;50m`)
- Sequences split across multiple calls (the function is stateless — it can't handle split sequences)
- The interaction of multiple ANSI patterns in one string

### 7.5 `isDangerous` false-positive coverage missing — **`terminal-ring-buffer.ts`**

No test checks that `isDangerous` does NOT fire for safe commands. The current patterns have aggressive false positives:
- `'^curl.*>'` matches `curl https://example.com > /dev/null` (common, safe)
- `'^wget\\s+.*\\s+/'` matches `wget https://example.com/path/to/file` (URL contains `/`)

Add tests:
```typescript
it('does not flag safe curl redirect', () => {
    expect(isDangerous('curl https://example.com > /dev/null')).to.be.true; // actually should be false
});
```
(This test will reveal the false positive and motivate fixing the regex.)

### 7.6 `TerminalRingBuffer.append` with massive data burst — **`terminal-ring-buffer.ts:55`**

No test covers `data.split('\n')` producing tens of thousands of newlines in a single `append()` call. `lines.push(...newLines)` with a very large spread will throw `RangeError: Maximum call stack size exceeded`.

```typescript
it('handles very large single-line data without stack overflow', () => {
    const buf = new TerminalRingBuffer(10000);
    const massiveData = 'x\n'.repeat(50000);
    expect(() => buf.append('term1', massiveData)).to.not.throw();
    expect(buf.getLineCount('term1')).to.equal(10000);
});
```

### 7.7 Hub-mcp Suites 6 and 7 use source-code string matching — **`hub-mcp.spec.ts:440-524`**

Suites 6 (presentation) and 7 (whiteboard) verify tool registration by reading `hub-mcp.ts` as a text file and asserting `include('tool-name')`. This is a structural test that does not verify runtime behavior. If a tool is renamed or the `registerToolsOn` method is refactored, these tests may still pass incorrectly.

**Fix:** Use the `fakeServer` / `captureHandlers` pattern from Suites 8 and 9. Extract it as a shared utility:
```typescript
function captureHandlers(server: OpenSpaceMcpServer): Map<string, HandlerFn> {
    const handlers = new Map<string, HandlerFn>();
    const fakeServer = { tool: (name, _desc, _schema, handler) => handlers.set(name, handler) };
    (server as any).registerToolsOn(fakeServer);
    return handlers;
}
```
Then assert that each tool's handler exists and calls `executeViaBridge` at runtime (not just in source text).

### 7.8 `pane-service.spec.ts` `resizePane` tests are vacuous — **`pane-service.spec.ts:338-374`**

The two `resizePane` tests assert `result.success === true` but the mock `ApplicationShell` does not implement any resize API. If `PaneService.resizePane` is a stub (Theia does not expose a programmatic pane-resize API), these tests prove nothing about behavior. Document this explicitly and consider removing or marking them as `it.skip`.

### 7.9 `file-command-contribution.spec.ts` does not test actual command execution — **`file-command-contribution.spec.ts:105-148`**

The tests verify that commands are registered (the `commandRegistry.getCommand(id)` is not undefined) and that the command handler `validatePath()` returns the right values. But they never call `commandRegistry.executeCommand()` to test the full `read`/`write`/`list`/`search` execution paths, including the `MockFileService` returning data. Calling `commandRegistry.executeCommand(FileCommands.READ, { path: 'file1.ts' })` and asserting the return value would provide much stronger coverage.

### 7.10 E2E "stream interceptor" tests do not test stripping — **`agent-control.spec.ts:92-187`**

Tests 1 and 2 are titled "Stream interceptor: %%OS{...}%% block is NOT displayed in chat UI" but:
- The injected text is already pre-stripped (`'Hello  World'` with a double space where the block was)
- The assertion is just `expect(domText).not.toContain('%%OS')`

Since the `%%OS` protocol is retired and the stream interceptor is removed, these tests are testing the absence of something that never existed in the injected data. They should be:
1. **Renamed**: `'MessageTimeline: assistant text renders correctly'` and `'MessageTimeline: plain text content appears in chat UI'`
2. **Updated**: The assertion should verify the text is *visible* in the DOM, not just that a retired marker is absent
3. Or **deleted** if the stream interceptor removal is considered complete and no regression risk exists

---

## 8. Test Quality & Efficiency Issues

### 8.1 `waitForTheiaReady` helper is duplicated across E2E files

The `waitForTheiaReady(page)` function is copied verbatim in at least `agent-control.spec.ts`, `whiteboard-diagrams.spec.ts`, and other files. Extract to `tests/e2e/helpers/theia.ts`:
```typescript
export async function waitForTheiaReady(page: Page): Promise<void> {
    await page.waitForSelector('.theia-preload', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
}
```

### 8.2 `whiteboard-diagrams.spec.ts` hardcodes developer machine path — **line 39**

```typescript
const WORKSPACE_ROOT = '/Users/Shared/dev/theia-openspace';
```

This will fail on any other developer machine and on CI. Derive from `playwright.config.ts` or an environment variable:
```typescript
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();
```

### 8.3 E2E "skip if hook unavailable" pattern masks real failures

Every test that uses `window.__openspace_test__` checks if the hook is available and skips if not:
```typescript
test.skip(!hasTriggerHook, 'hook not available');
```

A test run where all 5 tests skip will appear green in CI. There is no test that hard-fails if the hooks are missing after a reasonable initialization delay. Add a top-level test:
```typescript
test('Test API is available after app load', async ({ page }) => {
    await waitForTheiaReady(page);
    await page.waitForFunction(
        () => typeof (window as any).__openspace_test__?.triggerAgentCommand === 'function',
        { timeout: 10000 }
    );
});
```

### 8.4 `session-management-integration.spec.ts` uses emoji console.log throughout

`console.log('✓ Server responds with HTTP 200')` etc. throughout the test. This informal output should be removed. Playwright's built-in reporter provides structured output.

### 8.5 Sinon stubs are set via `(service as any).dep = stub` — not restored

Manual mock injection via `(service as any).dep = stub` is not tracked by `sinon.restore()`. After the test, the mutation persists on the service instance. Since each `beforeEach` creates a fresh instance, this is harmless — but it means the `sinon.restore()` calls in `afterEach` provide false safety. Document this clearly or switch to `sinon.stub(service, 'method')` where possible.

### 8.6 `assertTestApiAvailable` logs a warning instead of skipping — **`agent-control.spec.ts:54-64`**

```typescript
async function assertTestApiAvailable(page: Page): Promise<void> {
    const available = ...;
    if (!available) {
        console.warn('[agent-control] window.__openspace_test__ not yet available; tests may skip.');
    }
    // does not throw or skip
}
```

This function is called in `beforeEach` but does nothing actionable when the API is unavailable. Each test then re-checks and skips individually. The function name starts with `assert` but doesn't assert. Either make it throw (hard fail) or rename to `checkTestApiAvailable` and document that individual tests handle the skip.

### 8.7 `loadSessions` minimum flicker-prevention delay is arbitrary — **`chat-widget.tsx:332-334`**

```typescript
const delay = Math.max(0, 100 - elapsed);
setTimeout(() => setIsLoadingSessions(false), delay);
```

A 100ms minimum display time for the loading spinner is a UX heuristic but is implemented as a magic constant with no comment. Add a comment: `// Min 100ms display prevents flicker for fast responses`.

---

## 9. Code Quality / Minor Issues

### 9.1 Empty `@postConstruct` in `PermissionDialogContribution` — **line 60-63**

```typescript
@postConstruct()
protected init(): void {
    // Initialization happens in onStart
}
```

An empty `@postConstruct` adds InversifyJS overhead and misleads readers into thinking there was previously initialization logic here. Remove it.

### 9.2 Unconditional production `console.log` in three modules

- `openspace-chat-frontend-module.ts:22` — `console.log('[OpenSpaceChat] Chat agent registered')`
- `openspace-core-backend-module.ts:57` — `console.log('[OpenSpaceCore] Backend module loaded...')`
- `openspace-core-frontend-module.ts:82` — `console.log('[OpenSpaceCore] Frontend module loaded')`

Every other module guards with `process.env.NODE_ENV !== 'production'` or uses `ILogger`. These three fire unconditionally on every app start. Guard or remove.

### 9.3 Stale comment in `openspace-chat-frontend-module.ts:31`

```typescript
// View contribution (registers widget in left panel)
```

`ChatViewContribution` registers in the **right** panel (`area: 'right'`), not the left.

### 9.4 Missing copyright header in `openspace-chat-frontend-module.ts`

Every other file in the module has the EPL-2.0 `// ***` header. This file does not.

### 9.5 Backend module uses 2-space indentation — **`openspace-core-backend-module.ts:26-57`**

The module function body uses 2-space indentation; the class and rest of the codebase use 4 spaces. Unify.

### 9.6 `matchesSensitivePattern` is a pure alias — **`sensitive-files.ts:88-90`**

Two exported functions with identical implementations. Remove the alias; use `isSensitiveFile` everywhere.

### 9.7 `/secrets/` pattern is redundant with `/secret/i` — **`sensitive-files.ts:50-51`**

`/secrets/` is fully subsumed by `/secret/i`. Remove line 50. Note that `/secret/i` is overly broad (see §2.5 above).

### 9.8 `openspace-sdk-types.ts` has no generated-file header — **line 1**

The file is 3,380 lines of SDK type definitions extracted by the `extract-sdk-types` script. It has no header indicating it's generated. Consumers may try to hand-edit it. Add:
```typescript
// @generated by scripts/extract-sdk-types.ts — DO NOT EDIT MANUALLY
// Run `yarn extract-sdk-types` to regenerate from @opencode-ai/sdk
```

### 9.9 `chat-view-contribution.ts` — `console.debug` leaks to production

```typescript
console.debug('[ChatWidget] Revealing chat widget in shell');
```

Unlike the `chat-widget.tsx` pattern which guards with `process.env.NODE_ENV !== 'production'`, this debug log has no guard.

### 9.10 `artifact.patch` schema and handler both default `actor` to `'agent'` — **`hub-mcp.ts:460, 473`**

```typescript
actor: z.enum(['agent', 'user']).default('agent')  // Zod default
...
actor: args.actor ?? 'agent',                        // runtime default
```

The Zod `.default('agent')` means `args.actor` will always be `'agent'` when omitted — the `?? 'agent'` runtime fallback is unreachable. Remove the redundant `?? 'agent'`.

### 9.11 `listDirectory` does not filter sensitive files from listings — **`hub-mcp.ts:809-830`**

An agent using `openspace.file.list` can enumerate the workspace and discover the names of `.env`, `id_rsa`, and other sensitive files even though it cannot read them. Filter entries through `isSensitiveFile()`:
```typescript
} else if (!isSensitiveFile(entry.name)) {
    results.push(entryRel);
}
```

### 9.12 `TerminalRingBuffer.append` uses spread on potentially huge arrays — **line 55**

```typescript
lines.push(...newLines);
```

`spread` with a very large array will throw `RangeError: Maximum call stack size exceeded`. Replace with:
```typescript
Array.prototype.push.apply(lines, newLines);
// or
for (const line of newLines) { lines.push(line); }
```

---

## 10. Summary Table

| # | Severity | File | Line(s) | Issue |
|---|---|---|---|---|
| 1 | 🔴 Critical | `hub-mcp.ts` | 428 | `file.patch` bypasses ArtifactStore — no audit trail |
| 2 | 🔴 Critical | `hub-mcp.ts` | 801–807 | Symlinks bypass workspace boundary check |
| 3 | 🔴 Critical | `backend-module.ts` | 46–48 | Multi-tab overwrites bridge callback silently |
| 4 | 🔴 Critical | `hub-mcp.ts` | 82 | `workspaceRoot` not `readonly` |
| 5 | 🟠 High | `hub-mcp.ts` | 763–777 | Timer not cleared when bridgeCallback throws |
| 6 | 🟠 High | `frontend-module.ts` | 59–69 | `SessionServiceWiring` may never execute |
| 7 | 🟠 High | `sensitive-files.ts` | 40 | `/^git\//` blocks legitimate `git/` directories |
| 8 | 🟠 High | `terminal-ring-buffer.ts` | 83–85 | `readAll()` exposes internal mutable array |
| 9 | 🟠 High | `chat-widget.tsx` | 403–410 | Race condition in concurrent `loadSessions()` calls |
| 10 | 🟠 High | `prompt-input.tsx` | 184–191, 469 | `handleInput` fires twice per keystroke |
| 11 | 🟠 High | `chat-widget.tsx` | 505 | `as any as` double-cast bypasses all type safety |
| 12 | 🟠 High | multiple | — | `TextPart`/`FilePart`/`AgentPart` name collision between SDK and prompt-input types |
| 13 | 🟠 High | `hub-mcp.ts` | — | Three divergent write paths; `file.patch` architecturally inconsistent |
| 14 | 🟡 Medium | `mcp-tools.spec.ts` | 27–67 | `artifact.getVersion` and `artifact.patch` missing from smoke test |
| 15 | 🟡 Medium | `agent-control.spec.ts` | 92, 146 | "Stream interceptor" tests are testing retired `%%OS` system |
| 16 | 🟡 Medium | `whiteboard-diagrams.spec.ts` | 39 | Hardcoded `/Users/Shared/dev/...` path breaks CI |
| 17 | 🟡 Medium | `chat-widget.tsx` | 370–371 | Initial load shows "no sessions" flash before loading state |
| 18 | 🟡 Medium | `chat-widget.tsx` | 379–395 | Two `setStreamingData` calls in one handler — final delta may not render |
| 19 | 🟡 Medium | `chat-widget.tsx` | 590 | `streamingMessageId` from `Map.keys().next().value` is fragile |
| 20 | 🟡 Medium | `message-timeline.tsx` | 61–77 | `checkScrollPosition` recreated on every scroll; listener re-registered |
| 21 | 🟡 Medium | `chat-widget.tsx` | 427–438, 150–159 | Conflicting document-level click handlers cause dropdown toggling issues |
| 22 | 🟡 Medium | `permission-dialog-contribution.ts` | 130–162 | Test hook exposed in all non-production envs (`undefined`, `staging`, etc.) |
| 23 | 🟡 Medium | `hub-mcp.ts` | 132–146 | Full `McpServer` instantiation + 40+ tool registration per request |
| 24 | 🟡 Medium | `prompt-input.tsx` | 534–570 | Slash command menu has no keyboard navigation |
| 25 | 🟡 Medium | `prompt-input.tsx` | 221–255 | `insertTypeaheadItem` silently fails when cursor is not in a text node |
| 26 | 🟡 Medium | `prompt-input.tsx` | handlePaste | XSS risk: rich HTML paste in `contentEditable` not sanitized |
| 27 | 🟡 Medium | `prompt-input.tsx` | 312–321 | File attachment uses bare filename, not workspace-relative path |
| 28 | 🟡 Medium | `sensitive-files.ts` | 51 | `/secret/i` substring match too broad — blocks test fixtures |
| 29 | 🟡 Medium | `hub-mcp.ts` | 832–878 | `searchFiles` blocks event loop synchronously; no size/result limits |
| 30 | 🟡 Medium | `hub-mcp.ts` | 809–830 | `listDirectory` returns sensitive filenames |
| 31 | 🟡 Medium | `hub-mcp.ts` | — | Circular DI resolved with fragile `queueMicrotask` side-effect |
| 32 | 🟡 Medium | `opencode-sdk-types.ts` | 345 | `Part` union anonymous catch-all defeats exhaustive narrowing |
| 33 | 🟡 Medium | `message-timeline.tsx` | — | `getMessageGroupInfo` redefined on every render |
| 34 | 🟡 Medium | `prompt-input.tsx` | 20 | `crypto.randomUUID()` throws in non-secure contexts |
| 35 | 🟢 Low | `opencode-sdk-types.ts` | 74–79 | `MessageOutputLengthError.data` missing `message: string` |
| 36 | 🟢 Low | `permission-dialog-contribution.ts` | 58 | `root: any` — should be typed as `Root` from `react-dom/client` |
| 37 | 🟢 Low | `message-timeline.tsx` | 56 | `NodeJS.Timeout` used in browser component |
| 38 | 🟢 Low | `chat-widget.tsx` | 185,190,199 | Hardcoded hex colours bypass Theia theming |
| 39 | 🟢 Low | `permission-dialog-contribution.ts` | 60–63 | Empty `@postConstruct` — remove it |
| 40 | 🟢 Low | 3 modules | — | Unconditional production `console.log` |
| 41 | 🟢 Low | `frontend-module.ts` | 31 | Comment says "left panel" — it's the right panel |
| 42 | 🟢 Low | `chat-frontend-module.ts` | — | Missing EPL-2.0 copyright header |
| 43 | 🟢 Low | `backend-module.ts` | 26–57 | 2-space indentation inconsistency |
| 44 | 🟢 Low | `sensitive-files.ts` | 88–90 | `matchesSensitivePattern` is a redundant alias |
| 45 | 🟢 Low | `sensitive-files.ts` | 50 | `/secrets/` redundant — subsumed by `/secret/i` |
| 46 | 🟢 Low | `opencode-sdk-types.ts` | 1 | No `@generated` header on auto-generated file |
| 47 | 🟢 Low | `hub-mcp.ts` | 473 | Double default for `actor` field (`Zod + runtime`) |
| 48 | 🟢 Low | `terminal-ring-buffer.ts` | 55 | `push(...spread)` can stack-overflow on large terminal bursts |
| 49 | 🟢 Low | `scripts/` | — | `verify-phase-1b1-fixes.js` tests a retired system — delete |
| 50 | 🟢 Low | `agent-control.spec.ts` | 90–187 | "Stream interceptor" test names reference retired `%%OS` system |

---

## Appendix A: %%OS{...}%% Cleanup Checklist

| Location | Status | Action |
|---|---|---|
| `extensions/` (all source) | ✅ Clean | No action needed |
| `scripts/verify-phase-1b1-fixes.js` | ❌ Stale | **Delete** |
| `tests/e2e/agent-control.spec.ts:92,146` | ❌ Misleading | **Rename + fix assertions** |
| `.opencode/_context/01_memory/known_issues.md:70` | ❌ Stale | **Delete entry** |
| `design/deck/` | 📚 Historical | Leave as architecture history |
| `.opencode/_context/active_tasks/` (various) | 📚 Historical | Leave as project history |
| `docs/reviews/CODE-REVIEW-FULL-CODEBASE.md` | 📚 Historical | Leave |

---

## Appendix B: Recommended Fix Priority Order

**Sprint 1 — Critical security fixes (must ship before production use):**
1. `hub-mcp.ts` — Make `workspaceRoot` readonly
2. `hub-mcp.ts` — Fix symlink escape: add `fs.realpathSync()` to `resolveSafePath`
3. `hub-mcp.ts` — Route `file.patch` through `ArtifactStore`
4. `hub-mcp.ts` — Fix timer leak in bridge callback catch block
5. `sensitive-files.ts` — Remove `/^git\//` (drop the non-dot pattern)
6. `terminal-ring-buffer.ts` — Fix `readAll()` to return a copy

**Sprint 2 — High-priority bugs:**
7. `openspace-core-backend-module.ts` — Document/mitigate multi-tab bridge overwrite
8. `openspace-core-frontend-module.ts` — Ensure `SessionServiceWiring` executes (add `container.get()` call in BridgeContribution, or restructure)
9. `chat-widget.tsx` — Fix race condition in `loadSessions()` with generation counter
10. `prompt-input.tsx` — Fix double `handleInput` invocation (remove React `onInput` prop or native listener)

**Sprint 3 — Test fixes:**
11. `mcp-tools.spec.ts` — Add artifact tools to `EXPECTED_TOOLS`
12. `agent-control.spec.ts` — Rename/fix "stream interceptor" tests
13. `whiteboard-diagrams.spec.ts` — Replace hardcoded `WORKSPACE_ROOT`
14. `hub-mcp.spec.ts` — Refactor Suites 6/7 to use `captureHandlers` pattern
15. Add missing unit tests: `readAll` copy semantics, `append` large burst, `isDangerous` false-positive cases

**Sprint 4 — UX and type safety:**
16. `chat-widget.tsx` — Fix type system: write `promptPartsToProtocolParts()` adapter; rename prompt-input types
17. `prompt-input.tsx` — Add keyboard navigation to slash command menu
18. `prompt-input.tsx` — Fix XSS: sanitize `contentEditable` paste
19. `chat-widget.tsx` — Fix streaming data state management (combine `setStreamingData` calls)
20. `%%OS` cleanup: delete `verify-phase-1b1-fixes.js`, update known_issues.md, rename E2E tests

---

*Generated by automated code review. All line numbers reference the state of the `master` branch as of 2026-02-20.*
