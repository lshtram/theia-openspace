# Bug Fixes Round 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 8 issues identified during manual testing of Bug Fixes Round 1: streaming state flickering, turn grouping, slash command completeness, @ mentions completeness + file context sending, session spinner, shell mode wiring, and pill history serialization.

**Architecture:** Most fixes are in the chat extension (prompt-input.tsx, message-bubble.tsx, chat-widget.tsx) and the core extension (session-service.ts, opencode-proxy.ts, opencode-protocol.ts). The server proxy needs two new endpoints: `GET /command` (list slash commands) and `GET /find/file?query=...` (file search with query). The @ mention pipeline needs to send file `FilePartInput` to the server when a file is mentioned. Shell mode needs a direct bash execution path via the existing OpenCode agent (send `!command` as a prompt to the `bash`-agent or use a built-in behavior — see note below). The streaming flicker needs a debounce/"hysteresis" window before setting `isStreaming=false`.

**Tech Stack:** TypeScript, React, Theia RPC/DI, OpenCode HTTP proxy, highlight.js, ProseMirror/contenteditable

**Priority order (highest → lowest impact):**
1. **B01** — Streaming flicker (T09 + T28) — isStreaming snaps to false between messages
2. **B02** — Turn grouping (T01) — "thinking" text parts before tools silently dropped; "thinking process" toggle confusing
3. **B03** — Slash commands from server (T12) — only 3 hardcoded, need full list from `/command`
4. **B04** — @ mentions: project files (T15) — file search not calling server
5. **B05** — @ mentions: agents from server (T15) — only 4 hardcoded agents
6. **B06** — @ mention pill → FilePartInput sent to server (T17)
7. **B07** — Pill history serialization (T18) — pills stored as plain text, restored as text
8. **B08** — Shell mode wiring (T21) — `!command` sent to agent, not a real shell

---

## Context & Key Files

### Modified source files (all on `master` now)

| File | Purpose |
|------|---------|
| `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx` | Slash commands, @ mentions, pill history, shell mode |
| `extensions/openspace-chat/src/browser/message-bubble.tsx` | Turn grouping, text parts before tools |
| `extensions/openspace-chat/src/browser/chat-widget.tsx` | Session header spinner, streaming state |
| `extensions/openspace-chat/src/browser/style/chat-widget.css` | Spinner CSS, streaming-related CSS |
| `extensions/openspace-core/src/browser/session-service.ts` | isStreaming logic, hysteresis |
| `extensions/openspace-core/src/browser/opencode-sync-service.ts` | SSE message event routing |
| `extensions/openspace-core/src/common/opencode-protocol.ts` | Protocol interface for new methods |
| `extensions/openspace-core/src/node/opencode-proxy.ts` | Proxy methods for new endpoints |

### Test files
| File | Purpose |
|------|---------|
| `extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.ts` | Unit tests for chat widget |
| `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts` | Unit tests for session service |

### Build commands
```bash
# Full rebuild (do this after changes to either extension):
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app build

# Kill & restart server:
lsof -ti :3000 | xargs kill -9
yarn --cwd browser-app start &>/tmp/theia-server.log &
# Wait 10s for startup

# Unit tests (561 currently passing):
node_modules/.bin/mocha --timeout 10000 --exit
```

---

## Task 1 — B01: Fix Streaming Flicker (isStreaming hysteresis)

**Problem:** Between two consecutive tool calls (or between messages in a multi-step response), OpenCode sends `message.completed` for the first assistant message, which calls `updateStreamingMessage(..., isDone=true)` and sets `_isStreaming = false`. Then the next `message.created` / `message.part.delta` comes in and sets it back to `true`. This gap causes the status line to flash "Ready" and the session spinner to disappear momentarily.

**Fix:** Add a 500ms hysteresis timer in `session-service.ts`. When `isDone=true` arrives, don't immediately set `_isStreaming = false` — instead, schedule it. If a new streaming event arrives within 500ms, cancel the timer. Only fire the "false" event after the 500ms window passes with no new activity.

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service.ts`
- Test: `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`

### Step 1: Write failing tests

Add to `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`:

```typescript
describe('isStreaming hysteresis', () => {
    it('does not immediately set isStreaming=false when isDone arrives', () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        assert.equal(service.isStreaming, true);
        service.updateStreamingMessage('msg1', '', true);  // isDone=true
        // Should NOT be false yet (within hysteresis window)
        assert.equal(service.isStreaming, true);
    });

    it('fires isStreaming=false after hysteresis window when no new activity', async () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        service.updateStreamingMessage('msg1', '', true);  // isDone=true
        // Wait for hysteresis (use fake timers or wait 600ms)
        await new Promise(r => setTimeout(r, 600));
        assert.equal(service.isStreaming, false);
    });

    it('cancels the hysteresis timer when new streaming activity arrives', async () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        service.updateStreamingMessage('msg1', '', true);  // isDone=true on msg1
        // New message starts within 500ms window:
        service.updateStreamingMessage('msg2', 'world', false);
        await new Promise(r => setTimeout(r, 600));
        // Should still be streaming (msg2 is active)
        assert.equal(service.isStreaming, true);
    });
});
```

Run: `node_modules/.bin/mocha --timeout 10000 --exit --grep "isStreaming hysteresis"`  
Expected: **FAIL** (no hysteresis exists yet)

### Step 2: Add hysteresis to session-service.ts

In `session-service.ts`, find the class body (around line 140) and add a private timer field:

```typescript
private _streamingDoneTimer: ReturnType<typeof setTimeout> | undefined;
private readonly STREAMING_DONE_DELAY_MS = 500;
```

Then in `updateStreamingMessage()`, replace the block that fires `onIsStreamingChangedEmitter.fire(false)` on `isDone=true` (~line 984):

**Before:**
```typescript
if (isDone) {
    this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: true });
    this._streamingMessageId = undefined;
    this._isStreaming = false;
    this.onIsStreamingChangedEmitter.fire(false);
    this.resetStreamingStatus();
}
```

**After:**
```typescript
if (isDone) {
    this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: true });
    this._streamingMessageId = undefined;
    // Don't set isStreaming=false immediately — wait STREAMING_DONE_DELAY_MS
    // to avoid flicker when a new message starts right after this one completes.
    if (this._streamingDoneTimer) {
        clearTimeout(this._streamingDoneTimer);
    }
    this._streamingDoneTimer = setTimeout(() => {
        this._streamingDoneTimer = undefined;
        this._isStreaming = false;
        this.onIsStreamingChangedEmitter.fire(false);
        this.resetStreamingStatus();
    }, this.STREAMING_DONE_DELAY_MS);
}
```

Also in `applyPartDelta()`, where `_isStreaming` is set to true when streaming starts, add:
```typescript
// Cancel any pending done timer when new streaming activity arrives
if (this._streamingDoneTimer) {
    clearTimeout(this._streamingDoneTimer);
    this._streamingDoneTimer = undefined;
}
```

Do the same in `updateStreamingMessage()` in the `!isDone` branch.

Also update `abort()` and `sendMessage()` finally blocks (lines ~706 and ~752) to also clear the timer:
```typescript
if (this._streamingDoneTimer) {
    clearTimeout(this._streamingDoneTimer);
    this._streamingDoneTimer = undefined;
}
this._isStreaming = false;
// ... rest of existing code
```

### Step 3: Run tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit --grep "isStreaming hysteresis"`  
Expected: **PASS**

### Step 4: Run all tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing (or more if you added new tests)

### Step 5: Commit

```bash
git add extensions/openspace-core/src/browser/session-service.ts extensions/openspace-core/src/browser/__tests__/session-service.spec.ts
git commit -m "fix(core): add 500ms hysteresis to isStreaming to prevent flicker between messages"
```

---

## Task 2 — B02: Fix Turn Grouping (text parts before tools)

**Problem:** In `message-bubble.tsx`, the `MessageBubbleInner` component:
1. Only includes the **last** text part as `finalTextPartWithIndex` — any text parts that arrive **before** tool calls are silently dropped.
2. Wraps all non-text parts in a TurnGroup, but reasoning parts are already inside — the user wants ALL intermediate content (reasoning + tools) grouped together, with the final answer outside.
3. The "Show steps / Thinking process" toggle label is confusing — the user wants it to just be "Show steps" (not "Thinking process").

**Fix:**
1. Include ALL text parts that arrive before the last text part as part of `intermediateParts` (rendered inside the TurnGroup). Only the true final text part (the last one, which represents the "answer") stays outside the TurnGroup.
2. Rename the TurnGroup toggle from "Thinking process" / "Thinking..." to "Steps" in the completed state.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`
- Test: Manually verify (no unit test for React rendering logic here)

### Step 1: Understand the current intermediateParts logic

Read `message-bubble.tsx` around lines 1037–1066 to understand the current split between `intermediateParts` and `finalTextPartWithIndex`.

The current code:
```typescript
const intermediateParts = React.useMemo(
    () => hasIntermediateParts ? parts.filter(p => p.type !== 'text') : [],
    [hasIntermediateParts, parts]
);

const finalTextPartWithIndex = React.useMemo(() => {
    if (!hasIntermediateParts) return null;
    const textParts = parts.map((p, i) => ({ part: p, index: i })).filter(({ part }) => part.type === 'text');
    return textParts.at(-1) ?? null;
}, [hasIntermediateParts, parts]);
```

The problem: `intermediateParts` excludes ALL text parts. But some text parts (those before the last tool call) should be included in the group.

### Step 2: Fix intermediateParts to include early text parts

Replace the `intermediateParts` and `finalTextPartWithIndex` memos. The new logic: 
- Find the index of the last text part.
- Everything before (and including non-text parts up to that index) = intermediate.
- The last text part = final answer.

```typescript
// Find the index of the last text part
const lastTextPartIndex = React.useMemo(() => {
    if (!hasIntermediateParts) return -1;
    let idx = -1;
    parts.forEach((p, i) => { if (p.type === 'text') idx = i; });
    return idx;
}, [hasIntermediateParts, parts]);

// All parts before the last text part (including early text + tools + reasoning)
const intermediateParts = React.useMemo(() => {
    if (!hasIntermediateParts || lastTextPartIndex < 0) return [];
    return parts.slice(0, lastTextPartIndex);
}, [hasIntermediateParts, parts, lastTextPartIndex]);

// Only the last text part is the "final answer"
const finalTextPartWithIndex = React.useMemo(() => {
    if (!hasIntermediateParts || lastTextPartIndex < 0) return null;
    return { part: parts[lastTextPartIndex], index: lastTextPartIndex };
}, [hasIntermediateParts, parts, lastTextPartIndex]);
```

Note: `hasIntermediateParts` is defined a few lines up — check its definition. It should be `parts.some(p => p.type === 'tool' || p.type === 'reasoning')` or similar. Make sure the logic still works.

### Step 3: Update TurnGroup label

Find the `TurnGroup` component (around line 836) and the completed-state label. Look for where "Thinking process" or "Thinking..." is shown as the toggle label.

In the TurnGroup, the completed state shows a label like "Show steps · 3s". Update the toggle text so it does NOT say "Thinking process" — it should just say "Show steps" / "Hide steps".

Check what text is currently used and remove/replace any "Thinking" or "Thinking process" reference from the TurnGroup header (that text is more appropriate on the status line, not the toggle).

### Step 4: Build and manually test

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app build
lsof -ti :3000 | xargs kill -9
yarn --cwd browser-app start &>/tmp/theia-server.log &
```

Navigate to http://localhost:3000, open the chat widget, send a message that triggers tools (e.g., "read the package.json file and summarize it").

**Expect:** Tool calls appear inside a single TurnGroup. Any text that appears before the first tool call also appears inside the TurnGroup. The final answer appears outside. Toggle says "Show steps" not "Thinking process".

### Step 5: Run unit tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing (no regressions)

### Step 6: Commit

```bash
git add extensions/openspace-chat/src/browser/message-bubble.tsx
git commit -m "fix(chat): include pre-tool text parts in TurnGroup; rename toggle to 'Show steps'"
```

---

## Task 3 — B03: Full Slash Command List from Server

**Problem:** Only 3 commands are hardcoded in `prompt-input.tsx`. OpenCode exposes `GET /command` which returns ALL commands (from config, MCP, skills). The client should also have a small set of local/builtin commands (handled client-side, not sent to server).

**Research:** OpenCode server: `GET /command` → returns `Command.Info[]` with shape:
```typescript
{
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  source?: 'command' | 'mcp' | 'skill';
  subtask?: boolean;
  hints: string[];
}
```

Our proxy's `GET /command` proxy method needs to be added.

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — add `listCommands()` method
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — implement `listCommands()`
- Modify: `extensions/openspace-core/src/browser/session-service.ts` — expose commands list
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx` — fetch and display full list

### Step 1: Add protocol method

In `opencode-protocol.ts`, in the `OpenCodeService` interface (around line 165), add after the existing command methods or near model methods:

```typescript
// Command methods
listCommands(directory?: string): Promise<CommandInfo[]>;
```

Also add the `CommandInfo` type near the other types at the top of the file:

```typescript
export interface CommandInfo {
    name: string;
    description?: string;
    agent?: string;
    model?: string;
    source?: 'command' | 'mcp' | 'skill';
    subtask?: boolean;
    hints: string[];
}
```

### Step 2: Implement in proxy

In `opencode-proxy.ts`, add:

```typescript
async listCommands(directory?: string): Promise<CommandInfo[]> {
    // OpenCode API: GET /command
    const queryParams: Record<string, string | undefined> = directory !== undefined ? { directory } : {};
    return this.get<CommandInfo[]>('/command', queryParams);
}
```

Import `CommandInfo` from the protocol file.

### Step 3: Expose in SessionService (optional, or inject OpenCodeService directly)

The prompt input component can call `openCodeService.listCommands()` directly on mount. No need to add it to SessionService.

The prompt-input component currently injects `OpenCodeService` via Theia DI. Check if `OpenCodeService` is already injected in `prompt-input.tsx` — if not, add it. Look for the `@inject(OpenCodeService)` pattern.

Actually, the prompt-input component is a React component rendered by `ChatWidget`. Check how the chat widget passes props to the prompt input — `openCodeService` may need to be passed down as a prop.

### Step 4: Fetch commands on mount in prompt-input.tsx

In `prompt-input.tsx`, add:

```typescript
const [serverCommands, setServerCommands] = React.useState<CommandInfo[]>([]);

React.useEffect(() => {
    let cancelled = false;
    props.openCodeService?.listCommands?.()
        .then(cmds => { if (!cancelled) setServerCommands(cmds); })
        .catch(() => { /* use hardcoded fallback */ });
    return () => { cancelled = true; };
}, [props.openCodeService]);
```

Define local "builtin" commands (handled client-side, not sent to server as slash commands but executed locally):

```typescript
const BUILTIN_SLASH_COMMANDS: Array<{ name: string; description: string; local: true }> = [
    { name: '/clear', description: 'Clear the current session messages', local: true },
    { name: '/compact', description: 'Compact conversation to save context', local: true },
    { name: '/help', description: 'Show available commands', local: true },
];
```

Merge for display (builtin first, then server commands):

```typescript
const allSlashCommands = React.useMemo(() => [
    ...BUILTIN_SLASH_COMMANDS,
    ...serverCommands.map(c => ({ name: `/${c.name}`, description: c.description || '', local: false as const }))
], [serverCommands]);
```

Update the filter line to use `allSlashCommands` instead of `SLASH_COMMANDS`.

### Step 5: Update command dispatch

In `selectSlashCommand()`, check if the command is a builtin (local=true). If it is, handle it locally (call `clearSession()` for `/clear`, etc.). If it is NOT builtin, send it as a message via `onSend()` exactly as today.

For `/clear`, the chat widget currently has a `handleClearSession` callback — make sure it can be triggered from the slash command handler.

### Step 6: Build and test

Build + restart server, then type `/` in the chat. Verify more commands appear.

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing

### Step 7: Commit

```bash
git add extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "feat(chat): fetch full slash command list from server; distinguish local vs server commands"
```

---

## Task 4 — B04+B05: Full @ Mention List (Files + Agents from Server)

**Problem:** The `@` mention popup only shows 4 hardcoded agents. It should show:
1. All project files (via `GET /session/:id/find/file?query=...`)
2. All available agents (via `GET /agent`)

**Research:**
- File search: `GET /session/:id/find/file?query=<text>&dirs=false&limit=20` → returns `string[]` of relative file paths
- `findFiles(projectId, sessionId)` exists in the protocol but takes no query parameter. We need a new method: `searchFiles(sessionId: string, query: string, limit?: number): Promise<string[]>`.
- Agent list: `GET /agent` → returns `Agent.Info[]`. The `getAgent` method returns a single agent. We need a `listAgents()` method.
- Agent shape from SDK: `{ name: string, description?: string, model?: string, ... }`

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — add `searchFiles()` and `listAgents()`
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts` — implement both
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx` — wire up both

### Step 1: Add protocol methods

In `opencode-protocol.ts`:

```typescript
// File search with query
searchFiles(sessionId: string, query: string, limit?: number): Promise<string[]>;

// Agent list
listAgents(directory?: string): Promise<AgentInfo[]>;
```

Add `AgentInfo` type:

```typescript
export interface AgentInfo {
    name: string;
    description?: string;
    model?: string;
    // OpenCode also has `mode`, `hidden` but we only need display fields
}
```

### Step 2: Implement in proxy

```typescript
async searchFiles(sessionId: string, query: string, limit = 20): Promise<string[]> {
    // OpenCode API: GET /session/:id/find/file?query=...&dirs=false&limit=20
    return this.get<string[]>(`/session/${encodeURIComponent(sessionId)}/find/file`, {
        query,
        dirs: 'false',
        limit: String(limit),
    });
}

async listAgents(directory?: string): Promise<AgentInfo[]> {
    // OpenCode API: GET /agent (returns list of all agents)
    const queryParams = directory !== undefined ? { directory } : {};
    return this.get<AgentInfo[]>('/agent', queryParams);
}
```

### Step 3: Fetch agents on mount in prompt-input.tsx

Add a state variable and fetch effect:

```typescript
const [serverAgents, setServerAgents] = React.useState<AgentInfo[]>([]);

React.useEffect(() => {
    let cancelled = false;
    props.openCodeService?.listAgents?.()
        .then(agents => { if (!cancelled) setServerAgents(agents); })
        .catch(() => { /* use hardcoded fallback */ });
    return () => { cancelled = true; };
}, [props.openCodeService]);
```

### Step 4: Wire file search in getTypeaheadItems()

Find `getTypeaheadItems()` in `prompt-input.tsx` (around line 389). The file search path currently returns `[]`. Replace it:

```typescript
if (type === 'file') {
    const sessionId = props.sessionService?.activeSession?.id;
    if (!sessionId || !props.openCodeService) return [];
    try {
        const files = await props.openCodeService.searchFiles(sessionId, query, 20);
        return files.map(f => ({ name: f, description: 'file', type: 'file' as const }));
    } catch {
        return [];
    }
}
```

Note: `getTypeaheadItems()` may be synchronous. If so, convert it to async and update its callers, OR use a separate debounced search effect. Check the current signature — if it's sync, add a `useEffect` with `setTypeaheadItems` state instead of calling it inline.

### Step 5: Mix agents and files in @ popup

When `@` is typed, set `typeaheadType` to `'mixed'` (or handle both). The popup should show:
- Agents first (with a "Agent" label)
- Files second (after user types at least 1 character, so we can search)

Simplest approach: always search for both agents (filter from `serverAgents` by query) and files (via `searchFiles()`). Merge results: agents first, then files.

```typescript
// In the @ mention handler
if (type === '@') {
    const filteredAgents = serverAgents.filter(a => 
        !query || a.name.toLowerCase().includes(query.toLowerCase())
    ).map(a => ({ name: a.name, description: a.description || 'Agent', type: 'agent' as const }));
    
    const fileResults = query.length > 0 
        ? await props.openCodeService.searchFiles(activeSessionId, query)
               .then(files => files.map(f => ({ name: f, description: 'File', type: 'file' as const })))
               .catch(() => [])
        : [];
    
    return [...filteredAgents, ...fileResults];
}
```

### Step 6: Build and test

Build + restart server. Type `@` in the chat — should show agents from server. Type `@pack` — should show package.json in the file list.

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing

### Step 7: Commit

```bash
git add extensions/openspace-core/src/common/opencode-protocol.ts \
        extensions/openspace-core/src/node/opencode-proxy.ts \
        extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "feat(chat): @ mentions now show all project files and server agents"
```

---

## Task 5 — B06: @ Mention Pills → FilePartInput Sent to Server

**Problem:** When the user selects a file mention (`@filename`), the pill is rendered in the editor but when the message is sent, the file content is not attached. OpenCode expects `FilePartInput` objects in the `parts` array for file context.

**Research (from OpenCode reference):**
- File mention → `{ type: 'file', mime: 'text/plain', url: 'file:///absolute/path', filename: '...' }`
- Agent mention → `{ type: 'agent', name: '...' }`
- These are already in the `MessagePartInput` union in the protocol.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/parse-from-dom.ts` — already reads `data-type`, `data-path`, `data-name` from pills; ensure `file` type produces a `FilePartInput`
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts` — ensure `FilePartInput` and `AgentPartInput` types exist in `MessagePartInput` union

### Step 1: Check parse-from-dom.ts

Read `extensions/openspace-chat/src/browser/prompt-input/parse-from-dom.ts` in full. 

Find where pill data attributes are read. Currently the code reads `data-type`, `data-path`, `data-name`. For `type === 'file'`, it needs to produce:
```typescript
{
    type: 'file',
    mime: 'text/plain',
    url: `file://${absolutePath}`,
    filename: basename(path),
}
```

For `type === 'agent'`:
```typescript
{
    type: 'agent',
    name: agentName,
}
```

### Step 2: Check protocol types

In `opencode-protocol.ts`, check `MessagePartInput`. It likely has `TextPartInput`. We need to add or verify `FilePartInput` and `AgentPartInput` exist:

```typescript
export interface FilePartInput {
    type: 'file';
    mime: string;
    url: string;
    filename?: string;
}

export interface AgentPartInput {
    type: 'agent';
    name: string;
}

export type MessagePartInput = TextPartInput | FilePartInput | AgentPartInput | ...;
```

If these types already exist in the SDK types imported in the protocol, use those — don't duplicate them.

### Step 3: Fix parse-from-dom.ts pill handling

In the pill parsing section, for `type === 'file'` pills:
- Read `data-path` attribute from the pill span
- Construct the absolute path: if the path is relative, prefix with the workspace root. The workspace root is available via the `workspaceService` in Theia, but parse-from-dom is a utility function — it may need the root passed in, or the prompt-input component can resolve it before calling parseFromDOM.
- Produce `{ type: 'file', mime: 'text/plain', url: 'file://<absolutePath>', filename: basename }` as a part.

For `type === 'agent'` pills:
- Read `data-name` attribute
- Produce `{ type: 'agent', name: agentName }` as a part.

These parts should be inserted into the `parts` array alongside the text part.

### Step 4: Update pill insertion to store data-path

When the user selects a file from the `@` popup, the pill must have `data-path` set to the file path. In `prompt-input.tsx`, find the pill-insertion code (when a typeahead item is selected) and add `data-path` for files and `data-name` for agents.

### Step 5: Build and manually test

Build + restart server. Type `@package.json`, select it, then send a message like "What version is listed in the selected file?". The agent should receive the file content.

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing

### Step 6: Also fix the pill-at-start-position delete issue (T17 minor bug)

The user reported that deleting a pill at the first position is difficult. This is typically a contenteditable cursor issue — the cursor needs a zero-width space (`\u200B`) before the first pill, or the pill should never be the very first child.

Add a zero-width non-breaking space (`\u200B`) as the first text node of the editor, or ensure the editor always has a text node before any pill. Check `prompt-input.tsx` where pills are inserted — if the pill is being prepended with no preceding text, insert a space before it.

### Step 7: Commit

```bash
git add extensions/openspace-chat/src/browser/prompt-input/parse-from-dom.ts \
        extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx \
        extensions/openspace-core/src/common/opencode-protocol.ts
git commit -m "feat(chat): send file and agent mention parts to server; fix pill-at-start delete issue"
```

---

## Task 6 — B07: Pill History Serialization

**Problem:** When a user navigates history with the Up arrow, pills come back as plain text (`@oracle`) instead of actual interactive pills. The history save uses `.textContent` which strips all HTML.

**Fix:** Save a structured history item (text + pill metadata) instead of raw text. On restore, re-render the pills from metadata.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx`
- Possibly modify: `extensions/openspace-chat/src/browser/prompt-input/parse-from-dom.ts` (already can read pills)

### Step 1: Define a history entry type

```typescript
interface HistoryEntry {
    text: string;  // raw text content (for backward compat display)
    html: string;  // innerHTML snapshot (for full restoration)
}
```

### Step 2: Save innerHTML on submit

Replace the current history save logic (line ~495):
```typescript
// Before:
const rawText = editorRef.current?.textContent?.trim() || '';
if (rawText && rawText !== historyEntries[0]) {
    setHistoryEntries(prev => [rawText, ...prev].slice(0, MAX_HISTORY));
}

// After:
const rawText = editorRef.current?.textContent?.trim() || '';
const rawHtml = editorRef.current?.innerHTML || '';
if (rawText && rawText !== historyEntries[0]?.text) {
    setHistoryEntries(prev => [{ text: rawText, html: rawHtml }, ...prev].slice(0, MAX_HISTORY));
}
```

Update `historyEntries` state type to `HistoryEntry[]`.

### Step 3: Restore innerHTML on Up arrow navigation

In the Up/Down history navigation code (around line 269):
```typescript
// Before:
editorRef.current.textContent = historyEntries[newIndex];

// After:
const entry = historyEntries[newIndex];
editorRef.current.innerHTML = entry.html;
```

### Step 4: Fix comparison used for navigation

The duplicate check `rawText !== historyEntries[0]` needs updating to `rawText !== historyEntries[0]?.text`.

### Step 5: Build and manually test

Build + restart. Type a message with an `@mention` pill, send it, then press Up. The pill should be restored as an actual pill, not plain text.

### Step 6: Run unit tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing

### Step 7: Commit

```bash
git add extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "fix(chat): serialize pill HTML in prompt history so pills restore correctly"
```

---

## Task 7 — B08: Shell Mode Wiring (send `!command` to a bash execution path)

**Problem:** Shell mode (`!command`) prepends `!` to the text and sends it to the agent as a regular chat message. The user expects the command to actually be executed in a shell.

**OpenCode reference behavior:** OpenCode doesn't have a `!`-shell mode. The closest is running bash via the agent using the `bash` tool, or using the `Session.command()` API to run a slash command. Looking at the codebase, OpenCode's TUI has a `!` command that opens a terminal, not a chat message.

**Decision:** The correct approach is to send `!command` as a message to the agent with an explicit instruction — the OpenCode agent has access to bash and will run it. However, we should NOT prepend `!` to the message (that's meaningless to the agent). Instead:
1. Strip the `!` prefix.
2. Wrap the command in a message like: `"Run this shell command: <command>"`

OR better: send a `TextPartInput` with just the command as normal text, but use the special agent `bash` (if one exists in the server's agent list) or prepend "Run in shell: " to the message.

**Simplest correct fix:** Strip the `!` and send the command as-is with the text. The agent will use bash to run it. Remove the `!` prepend that happens at line 503–506 in prompt-input.tsx. Leave the shellMode visual indicator but don't add `!` to the sent text.

**If we want true shell execution in the future:** This requires a separate backend endpoint that spawns a process. Out of scope for Round 2 — document as a known limitation.

**Files:**
- Modify: `extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx`

### Step 1: Strip `!` prefix before sending in shell mode

In `prompt-input.tsx`, find the submit code where `shellMode` adds `!` prefix (lines ~503–506):

```typescript
// BEFORE — adds ! prefix which is meaningless to agent:
if (shellMode && editorRef.current) {
    const editorText = editorRef.current.textContent || '';
    editorRef.current.textContent = '!' + editorText;
}

// AFTER — remove this block entirely; the text is sent as-is
// Shell mode is just a visual hint to the user, not a message prefix
```

Keep the shell mode visual styles (monospace, green indicator) — just don't add `!` to the outgoing message.

### Step 2: Build and test

Build + restart. Type `!ls -la` and press Enter. The message should be sent to the agent as `ls -la` (without `!`). The agent should execute it via bash.

### Step 3: Run unit tests

Run: `node_modules/.bin/mocha --timeout 10000 --exit`  
Expected: 561 passing

### Step 4: Commit

```bash
git add extensions/openspace-chat/src/browser/prompt-input/prompt-input.tsx
git commit -m "fix(chat): shell mode strips the ! prefix before sending; agent runs the command via bash"
```

---

## Final Step: Run all tests + build verification

```bash
node_modules/.bin/mocha --timeout 10000 --exit
```

Expected: ≥ 561 passing, 0 failing.

Then build the full app one final time:
```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app build
```

Expected: No TypeScript errors.

---

## Summary of all tasks

| Task | Bug ID | Description | Files |
|------|--------|-------------|-------|
| 1 | B01 | Streaming flicker — 500ms hysteresis | session-service.ts |
| 2 | B02 | Turn grouping — include pre-tool text; rename toggle | message-bubble.tsx |
| 3 | B03 | Slash commands from server — full `/command` list | protocol, proxy, prompt-input |
| 4 | B04+B05 | @ mentions — project files + server agents | protocol, proxy, prompt-input |
| 5 | B06 | @ mention pills → FilePartInput to server; fix pill-at-start delete | parse-from-dom, prompt-input, protocol |
| 6 | B07 | Pill history — save innerHTML, restore properly | prompt-input |
| 7 | B08 | Shell mode — strip `!` prefix before sending | prompt-input |
