# Code Review Fix Plan — Theia OpenSpace

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 10 critical, 27 important, and 20 minor issues identified in the 2026-02-21 full codebase code review.

**Architecture:** Fixes are grouped by priority (Critical > Important > Minor) and themed by concern (Security, Correctness, Architecture). Each task is independent unless noted. Security fixes come first because they are externally exploitable.

**Tech Stack:** TypeScript, React/TSX, Node.js, Inversify DI, Theia APIs, DOMPurify, Vitest

**Review Reference:** `docs/reviews/CODE-REVIEW-2026-02-21.md`

---

## Phase 1: Critical Fixes (10 critical issues + 1 related hardening task)

### Task 1: XSS — Sanitize Mermaid SVG output

**Gap:** `markdown-renderer.tsx` MermaidBlock assigns `mermaid.render()` SVG directly to `innerHTML` without sanitization. Crafted Mermaid diagrams with `<script>`, `<foreignObject>`, or SVG event handlers execute arbitrary JavaScript.

**Why It Matters:** Full XSS in the chat webview. An attacker who can influence LLM responses (prompt injection) gains code execution within the extension host, potentially accessing workspace files, credentials, and executing commands. This is the highest-severity issue in the codebase.

**How We Fix It:**
1. Import DOMPurify (already a project dependency)
2. Sanitize the SVG output before innerHTML assignment using SVG profile
3. Add a regression test with a malicious Mermaid diagram payload

**Files to Modify:**
- `extensions/openspace-chat/src/browser/markdown-renderer.tsx` — MermaidBlock component, innerHTML assignment line

**Files to Create/Expand:**
- `extensions/openspace-chat/src/browser/__tests__/markdown-renderer-xss.spec.ts`

**Specifics:**
```typescript
// In MermaidBlock, after mermaid.render():
containerRef.current.innerHTML = DOMPurify.sanitize(svg, {
  USE_PROFILES: { svg: true, svgFilters: true }
});
```

**Verification:** Unit test renders a Mermaid diagram containing `<foreignObject><script>alert(1)</script></foreignObject>` and verifies the script tag is stripped from the output HTML.

---

### Task 2: XSS — Fix DOMPurify configuration (ALLOW_UNKNOWN_PROTOCOLS)

**Gap:** `markdown-renderer.tsx` configures DOMPurify with `ALLOW_UNKNOWN_PROTOCOLS: true`, which permits `javascript:` URLs to survive sanitization. A crafted markdown link like `[click](javascript:alert(1))` executes on click.

**Why It Matters:** Stored XSS via crafted links in LLM responses or user messages. Users clicking rendered links execute arbitrary code.

**How We Fix It:**
1. Remove `ALLOW_UNKNOWN_PROTOCOLS: true` from the DOMPurify config
2. If custom protocols are needed (vscode:, theia:), whitelist them explicitly via `ALLOWED_URI_REGEXP`
3. Add regression test with javascript: URL payload

**Files to Modify:**
- `extensions/openspace-chat/src/browser/markdown-renderer.tsx` — DOMPurify.sanitize() call in renderMarkdown

**Specifics:**
```typescript
// Replace ALLOW_UNKNOWN_PROTOCOLS: true with:
ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|vscode|theia):/i
```

**Verification:** Test that `[click](javascript:alert(1))` is rendered with href stripped or replaced with safe value.

---

### Task 3: Security Hardening — Sanitize ANSI rendering output

**Gap:** `markdown-renderer.tsx` AnsiBlock uses `dangerouslySetInnerHTML` with Anser library output. Current code escapes via Anser, but lacks defense-in-depth sanitization at the final HTML injection boundary.

**Why It Matters:** Hardens a high-risk rendering path and reduces regression risk if upstream escaping assumptions change.

**How We Fix It:**
1. Wrap Anser's HTML output in DOMPurify.sanitize() before setting innerHTML
2. Add regression test with ANSI-embedded HTML payload

**Files to Modify:**
- `extensions/openspace-chat/src/browser/markdown-renderer.tsx` — AnsiBlock component

**Specifics:**
```typescript
dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(
    anser.ansiToHtml(normalized, { use_classes: true })
  )
}}
```

**Verification:** Test that ANSI input containing `\x1b[31m<img src=x onerror=alert(1)>\x1b[0m` is rendered with the onerror handler stripped.

---

### Task 4: XSS — Sanitize presentation widget innerHTML

**Gap:** `presentation-widget.tsx:200-203` writeSlidesDom() injects slide content via innerHTML with only `</script>` escaping. Payloads like `<img src=x onerror="alert(1)">` execute. Deck files (.deck.md) are shared via git repositories.

**Why It Matters:** Arbitrary code execution when any user opens a malicious .deck.md file. This is a stored XSS vector transmitted through version control — high blast radius in team environments.

**How We Fix It:**
1. Import DOMPurify (already available in the project)
2. Sanitize slide content before innerHTML injection
3. Configure allowlist for presentation-safe HTML tags
4. Add regression test

**Files to Modify:**
- `extensions/openspace-presentation/src/browser/presentation-widget.tsx` — writeSlidesDom() method

**Files to Create:**
- `extensions/openspace-presentation/src/browser/__tests__/presentation-widget-xss.spec.ts`

**Specifics:**
```typescript
import DOMPurify from 'dompurify';

// In writeSlidesDom():
const sanitized = DOMPurify.sanitize(slide.content ?? '', {
  ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li','a','img',
    'code','pre','em','strong','blockquote','br','hr','table','thead','tbody',
    'tr','th','td','span','div','sup','sub'],
  ALLOWED_ATTR: ['href','src','alt','class','id','style']
});
```

**Verification:** Test that a .deck.md containing `<img src=x onerror="alert(document.cookie)">` renders with onerror stripped.

---
### Task 5: Path traversal — Fix resolveContentPath for absolute paths

**Gap:** `resolve-content-path.ts:24` returns absolute paths as-is with no workspace containment check. Any caller passing user-controlled input can read/write arbitrary filesystem locations, completely escaping the workspace sandbox.

**Why It Matters:** Complete sandbox escape. The sensitive-file blocklist in file-command-contribution.ts is bypassed if other callers use resolveContentPath directly. An agent can read `/etc/shadow` or write to `~/.ssh/authorized_keys`.

**How We Fix It:**
1. Always resolve input paths against the workspace root
2. After resolution, verify the resolved path starts with workspace root
3. Reject paths that escape the workspace with a clear error
4. Audit all callers of resolveContentPath to ensure none depend on absolute-path passthrough
5. Add tests for absolute path rejection

**Files to Modify:**
- `extensions/openspace-core/src/browser/resolve-content-path.ts`

**Files to Create/Modify:**
- `extensions/openspace-core/src/browser/__tests__/resolve-content-path.spec.ts` (expand existing)

**Specifics:**
```typescript
export function resolveContentPath(workspaceRoot: string, inputPath: string): string {
  // Always resolve relative to workspace root, even if path is absolute
  const resolved = path.resolve(workspaceRoot, inputPath);

  // Verify containment
  const normalizedRoot = path.resolve(workspaceRoot) + path.sep;
  const normalizedResolved = path.resolve(resolved);
  if (!normalizedResolved.startsWith(normalizedRoot) && normalizedResolved !== path.resolve(workspaceRoot)) {
    throw new Error(`Path '${inputPath}' escapes workspace root`);
  }

  return resolved;
}
```

**Verification:** Test that `/etc/passwd`, `../../etc/shadow`, and `/tmp/malicious` all throw. Test that `./valid/file.ts` and `subdir/file.ts` resolve correctly within workspace.

---

### Task 6: Origin validation — Tighten hub CORS

**Gap:** `hub.ts:75` CORS check allows requests with empty or undefined Origin header. Any local process, curl, or server-side HTTP client can call all hub endpoints without restriction.

**Why It Matters:** The hub exposes command execution and file operations. A malicious local process (or remote process if port is exposed) can execute arbitrary commands through the hub API.

**How We Fix It:**
1. Reject requests with empty/undefined Origin
2. Verify backend HTTP bind address is localhost-only in backend application startup configuration
3. Consider adding a shared secret token generated at startup
4. Add tests for origin validation

**Files to Modify:**
- `extensions/openspace-core/src/node/hub.ts` — CORS validation logic

**Files to Create:**
- `extensions/openspace-core/src/node/__tests__/hub.spec.ts`

**Specifics:**
```typescript
// Reject empty/undefined origins
if (!origin) {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('Origin required');
  return;
}
// Validate against allowlist
if (!allowedOrigins.includes(origin)) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}

```

**Verification:** Test that requests with no Origin header receive 403. Test that requests from allowed origins succeed. Verify backend startup configuration binds to localhost-only.

---

### Task 7: Data corruption — Fix file.patch replace-all behavior

**Gap:** `hub-mcp.ts:429` uses `content.split(oldText).join(newText)` which replaces EVERY occurrence of oldText. Users expect a targeted single replacement. If oldText appears multiple times, all locations are silently modified.

**Why It Matters:** Silent data corruption. An AI agent patching one function inadvertently modifies identically-named code elsewhere in the file. The user sees no warning.

**How We Fix It:**
1. Count occurrences of oldText in the content
2. If exactly 1: replace it
3. If 0: return error "oldText not found"
4. If >1: return error asking for more context to disambiguate
5. Route the write through ArtifactStore (fixes C2 simultaneously)
6. Add tests for all three cases

**Files to Modify:**
- `extensions/openspace-core/src/node/hub-mcp.ts` — file.patch handler

**Specifics:**
```typescript
// Count occurrences
const occurrences = content.split(oldText).length - 1;
if (occurrences === 0) {
  return { content: [{ type: 'text', text: JSON.stringify({
    error: 'oldText not found in file'
  })}]};
}
if (occurrences > 1) {
  return { content: [{ type: 'text', text: JSON.stringify({
    error: `oldText found ${occurrences} times. Provide more surrounding context to uniquely identify the target location.`
  })}]};
}
// Exactly one occurrence — safe to replace
const newContent = content.replace(oldText, newText);
// Use ArtifactStore for atomic write + backup + audit (fixes C2)
await this.artifactStore.write(filePath, newContent);
```

**Verification:** Test: single occurrence replaces correctly. Test: zero occurrences returns error. Test: multiple occurrences returns disambiguation error. Test: write goes through ArtifactStore (mock and verify call).

---
### Task 8: Streaming race condition — Subscribe before send

**Gap:** `chat-agent.ts:30-50` awaits `sendMessage()` then subscribes to `onMessageStreaming`. The backend starts streaming immediately, so early events (including potentially isDone) are lost before the subscription exists.

**Why It Matters:** Every chat interaction potentially loses its first tokens. If isDone is missed, the UI stays in "thinking" state permanently, the subscription leaks, and the user must reload.

**How We Fix It:**
1. Subscribe to onMessageStreaming BEFORE calling sendMessage
2. Filter events by session/message ID to ignore stale events
3. Add a timeout (5 minutes) that auto-disposes the subscription and shows error state
4. Track the subscription in the widget's toDispose collection for cleanup on disposal
5. This fixes both C3 (race condition) and I1 (subscription leak)

**Files to Modify:**
- `extensions/openspace-chat/src/browser/chat-agent.ts`

**Specifics:**
```typescript
async sendMessage(request: ChatRequest): Promise<void> {
  const sessionId = this.sessionService.currentSessionId;

  // Subscribe FIRST, before sending
  const sub = this.chatService.onMessageStreaming(event => {
    if (event.sessionId !== sessionId) return; // filter
    // ... handle streaming event ...
    if (event.isDone) {
      sub.dispose();
      clearTimeout(timeout);
    }
  });

  // Safety timeout
  const timeout = setTimeout(() => {
    sub.dispose();
    // Show error state
  }, 5 * 60 * 1000);

  // Track for cleanup on widget disposal
  this.toDispose.push(Disposable.create(() => {
    sub.dispose();
    clearTimeout(timeout);
  }));

  // NOW send the message
  await this.chatService.sendMessage(request);
}
```

**Verification:** Test that subscription is created before sendMessage is called (mock and verify ordering). Test that timeout fires and cleans up. Test that disposal cleans up subscription.

---

### Task 9: Unbounded search — Add limits to searchInDirectory

**Gap:** `file-command-contribution.ts:522-572` searchInDirectory recursively walks the filesystem with no depth limit and no result cap. In a monorepo with node_modules, .git, or deeply nested directories, this exhausts memory or blocks indefinitely.

**Why It Matters:** Denial of service. A single file.search command from an AI agent can freeze or crash the entire IDE. In workspaces with 100k+ files this is near-certain.

**How We Fix It:**
1. Add maxDepth parameter (default 10)
2. Add maxResults parameter (default 1000)
3. Skip well-known large directories (node_modules, .git, dist, build, .next, out)
4. Return truncation indicator when limits hit
5. Add tests for limit enforcement

**Files to Modify:**
- `extensions/openspace-core/src/browser/file-command-contribution.ts` — searchInDirectory method

**Specifics:**
```typescript
private static readonly SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache'
]);
private static readonly MAX_DEPTH = 10;
private static readonly MAX_RESULTS = 1000;

async searchInDirectory(
  dir: string, pattern: string,
  depth = 0, results: string[] = []
): Promise<{ matches: string[]; truncated: boolean }> {
  if (depth > FileCommandContribution.MAX_DEPTH) return { matches: results, truncated: true };
  if (results.length >= FileCommandContribution.MAX_RESULTS) return { matches: results, truncated: true };

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= FileCommandContribution.MAX_RESULTS) break;
    if (entry.isDirectory() && FileCommandContribution.SKIP_DIRS.has(entry.name)) continue;
    // ... recurse or match ...
  }
  return { matches: results, truncated: false };
}
```

**Verification:** Test with a mock filesystem deeper than MAX_DEPTH — verify truncation. Test with more files than MAX_RESULTS — verify cap. Test that node_modules is skipped.

---

### Task 10: Type/schema mismatch — Fix PresentationNavigateArgs

**Gap:** `presentation-service.ts:356` defines direction as `'prev' | 'next'` but the JSON schema at `presentation-command-contribution.ts:137` and the handler at lines 451-458 implement `'first'` and `'last'` too. TypeScript won't type-check the first/last branches.

**Why It Matters:** Bugs in the first/last code paths are invisible to the TypeScript compiler. They're effectively untyped dead code despite being reachable at runtime.

**How We Fix It:**
1. Update the TypeScript type to include all four values
2. This is a one-line fix

**Files to Modify:**
- `extensions/openspace-presentation/src/browser/presentation-service.ts` — PresentationNavigateArgs interface

**Specifics:**
```typescript
export interface PresentationNavigateArgs {
  direction?: 'prev' | 'next' | 'first' | 'last';
  slideIndex?: number;
}
```

**Verification:** Run `npx tsc --noEmit` and verify no new type errors. Verify the navigate handler's switch/if-else branches are now type-checked.

---

### Task 11: file.patch atomic write — Route through ArtifactStore

**Gap:** `hub-mcp.ts:429` file.patch uses raw `fs.writeFileSync(filePath, newContent)` while file.write correctly uses `artifactStore.write()` which provides atomic temp-file-rename, .bak backup, and audit logging.

**Why It Matters:** A crash during file.patch write can corrupt the file with no backup. Patches are invisible to the audit log, breaking the chain of accountability for file modifications.

**How We Fix It:** This is resolved as part of Task 7 — the fix routes file.patch through ArtifactStore.write(). No separate task needed. Marking as combined with Task 7.

---

## Phase 2: Important Fixes (27 issues)

### Task 12: Eliminate synchronous fs in async handlers

**Gap:** `hub-mcp.ts:340` uses fs.readFileSync and `patch-engine.ts:330` uses fs.mkdirSync + fs.writeFileSync inside async methods.

**Why It Matters:** Blocks the Node.js event loop. Large file reads stall all concurrent operations (SSE heartbeats, other MCP calls, HTTP requests).

**How We Fix It:**
1. Replace fs.readFileSync with await fs.promises.readFile
2. Replace fs.mkdirSync with await fs.promises.mkdir
3. Replace fs.writeFileSync with await fs.promises.writeFile
4. Search for any other sync fs usage in async contexts

**Files to Modify:**
- `extensions/openspace-core/src/node/hub-mcp.ts:340`
- `extensions/openspace-core/src/node/patch-engine.ts:330`

**Verification:** grep for readFileSync/writeFileSync/mkdirSync in node/ directory and verify none remain in async functions. Run existing tests to verify no regressions.

---
### Task 13: Fix artifact-store write suppression race

**Gap:** `artifact-store.ts:122` uses setTimeout 500ms to suppress chokidar change events after internal writes. On slow filesystems or under load, chokidar fires after 500ms and triggers spurious external-change events.

**Why It Matters:** False "file changed externally" notifications. Potential version conflicts in PatchEngine.

**How We Fix It:**
1. Replace setTimeout with content hash comparison
2. Before writing, store hash of new content
3. In chokidar handler, compute hash of changed file and compare
4. If hash matches last written content, suppress the event

**Files to Modify:**
- `extensions/openspace-core/src/node/artifact-store.ts`

**Verification:** Existing tests pass. Add test that verifies external change detection still works when file is modified by another process (different content hash).

---

### Task 14: Fix userMessageIds memory leak

**Gap:** `opencode-proxy.ts` adds every user message ID to a Set that is never cleared. Grows unboundedly over session lifetime.

**Why It Matters:** Memory leak proportional to number of messages sent.

**How We Fix It:**
1. Clear the Set on session reset/change
2. Or switch to a bounded LRU structure (e.g., last 1000 IDs)

**Files to Modify:**
- `extensions/openspace-core/src/node/opencode-proxy.ts`

**Verification:** Add test verifying Set is cleared when session changes. Or test that Set stays bounded after many messages.

---

### Task 15: Narrow sensitive file regex

**Gap:** `sensitive-files.ts:22` pattern `/secret/i` matches any path containing "secret" — false positives like `src/secret-santa.ts`.

**Why It Matters:** Blocks legitimate development workflows.

**How We Fix It:**
1. Replace `/secret/i` with pattern targeting actual secret files
2. Use `/(?:^|[\\/])\.?secrets?(?:[\\/.]|$)/i` or enumerate specific filenames

**Files to Modify:**
- `extensions/openspace-core/src/common/sensitive-files.ts`

**Verification:** Update sensitive-files.spec.ts: add test that `src/secret-santa.ts` is NOT flagged. Verify `.secrets`, `secrets.yml` still flagged.

---

### Task 16: Add hub.ts tests

**Gap:** Zero test coverage for hub HTTP server — origin validation, CORS, state management, command relay.

**Why It Matters:** Origin bypass (Task 6) and routing bugs not caught by CI.

**How We Fix It:**
1. Create hub.spec.ts
2. Test origin validation (valid, invalid, empty)
3. Test state GET/POST endpoints
4. Test command result forwarding
5. Test error responses

**Files to Create:**
- `extensions/openspace-core/src/node/__tests__/hub.spec.ts`

**Verification:** All new tests pass. Coverage report shows hub.ts covered.

---

### Task 17: Implement resizePane or return error

**Gap:** `pane-service.ts:414-436` resizePane() has no resize logic but returns `{ success: true }`.

**Why It Matters:** Agent-requested pane resizing silently fails. Callers think it worked.

**How We Fix It:**
1. Either implement resize using Theia's ApplicationShell.resize(size, area) API
2. Or return `{ success: false, error: 'Not implemented' }` and log warning

**Files to Modify:**
- `extensions/openspace-core/src/browser/pane-service.ts`

**Verification:** Test that resizePane either resizes (if implemented) or returns error (if not).

---

### Task 18: Fix dangerous command regex patterns

**Gap:** `terminal-ring-buffer.ts:190` curl.*> matches safe operations while missing curl|bash pipe-to-shell patterns.

**Why It Matters:** False positives block legitimate workflows. False negatives miss real threats.

**How We Fix It:**
1. Replace overly broad patterns with targeted ones
2. Add pipe-to-shell patterns: `curl.*\|\s*(bash|sh|zsh)`
3. Add download-and-execute chains
4. Remove the over-broad `curl.*>` pattern
5. Add comprehensive tests

**Files to Modify:**
- `extensions/openspace-core/src/browser/terminal-ring-buffer.ts`

**Files to Create:**
- `extensions/openspace-core/src/browser/__tests__/terminal-ring-buffer.spec.ts`

**Verification:** Test true positives (curl|bash, wget|sh). Test true negatives (curl > output.json). All existing tests pass.

---

### Task 19: Fix double-wiring race

**Gap:** `openspace-core-frontend-module.ts:59` triggers SessionServiceWiring via queueMicrotask AND `bridge-contribution.ts:81` triggers it again in onStart(). Race condition on startup.

**Why It Matters:** Duplicate wiring could cause doubled SSE connections or event handler registrations.

**How We Fix It:**
1. Remove the queueMicrotask call in the module
2. Rely solely on BridgeContribution.onStart() for wiring (well-defined lifecycle)
3. OR add idempotency guard inside SessionServiceWiring

**Files to Modify:**
- `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts`

**Verification:** Verify only one call to SessionServiceWiring on startup. Run existing tests.

---

### Task 20: Fix permission dialog onBlur

**Gap:** `permission-dialog.tsx:216` onBlur fires when focus moves between elements WITHIN the dialog, incorrectly setting hasFocus(false).

**Why It Matters:** Focus trap fights user during keyboard navigation between Allow/Deny buttons.

**How We Fix It:**
1. Use relatedTarget to check if focus left the dialog entirely
2. Only set hasFocus(false) when focus leaves the dialog container

**Files to Modify:**
- `extensions/openspace-core/src/browser/permission-dialog.tsx`

**Specifics:**
```tsx
onBlur={(e) => {
  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
    setHasFocus(false);
  }
}}
```

**Verification:** Expand permission-dialog.spec.ts to test that tabbing between buttons doesn't trigger hasFocus(false).

---
### Task 21: Extract shared PathValidator utility

**Gap:** `editor-command-contribution.ts:280-340` and `file-command-contribution.ts:180-240` have nearly identical validatePath() methods (~60 lines each). One uses toString(), the other fsPath() — inconsistency already caused bugs.

**Why It Matters:** Maintenance burden. Bug fixes must be applied twice. Inconsistency already produced path resolution bugs.

**How We Fix It:**
1. Create `path-validator.ts` utility in browser/ directory
2. Standardize on fsPath() for all filesystem operations
3. Import in both command contributions
4. Add workspace containment check (addresses C1-A2 overlap)

**Files to Create:**
- `extensions/openspace-core/src/browser/path-validator.ts`
- `extensions/openspace-core/src/browser/__tests__/path-validator.spec.ts`

**Files to Modify:**
- `extensions/openspace-core/src/browser/editor-command-contribution.ts` — remove validatePath, import from utility
- `extensions/openspace-core/src/browser/file-command-contribution.ts` — same

**Verification:** All existing editor-command and file-command tests still pass. New path-validator tests cover edge cases.

---

### Task 22: Fix streaming subscription leak

**Gap:** `chat-agent.ts` — if isDone never arrives, the onMessageStreaming subscription leaks. No timeout, no cleanup on disposal.

**Why It Matters:** Memory leak per failed/interrupted stream. Over long sessions, degrades performance.

**How We Fix It:** Combined with Task 8 (streaming race condition fix includes timeout and disposal cleanup). No separate task needed.

---

### Task 23: Fix handleShellCommand stale closure

**Gap:** `chat-widget.tsx` handleShellCommand useCallback has `messages.length` in dependency array. Array reference changes while length stays same cause stale closure.

**Why It Matters:** Shell command output at wrong conversation position.

**How We Fix It:**
1. Use a ref to always access latest messages
2. Or use messages array reference as dependency

**Files to Modify:**
- `extensions/openspace-chat/src/browser/chat-widget.tsx`

**Specifics:**
```typescript
const messagesRef = useRef(messages);
messagesRef.current = messages;

const handleShellCommand = useCallback((...) => {
  const currentMessages = messagesRef.current;
  // use currentMessages instead of messages
}, []); // stable reference
```

**Verification:** Existing chat-widget tests pass.

---

### Task 24: Fix LCS diff memory limit

**Gap:** `message-bubble.tsx` computeLCS allocates O(m*n) 2D array. MAX_DIFF_LINES only limits display, not computation. 5000x5000 file diff = 200MB.

**Why It Matters:** Browser tab crash on large file diffs.

**How We Fix It:**
1. Apply MAX_DIFF_LINES limit BEFORE computing LCS
2. If either file exceeds limit, fall back to simple old/new display without line-level diff

**Files to Modify:**
- `extensions/openspace-chat/src/browser/message-bubble.tsx` — computeLCS caller

**Verification:** Test that files exceeding MAX_DIFF_LINES don't trigger LCS computation.

---

### Task 25: Harden model selector default selection when provider has no models

**Gap:** `model-selector.tsx` default model selection depends on the first provider having at least one model. Current code guards against undefined, but default model selection can silently fail when the first provider has an empty models map.

**Why It Matters:** Degraded UX and unclear state when models are available in other providers but no default selection is applied.

**How We Fix It:**
1. Select first available model across providers, not just provider[0]
2. Preserve current guard behavior for fully empty provider lists
3. Show clear empty-state messaging only when no providers expose models

**Files to Modify:**
- `extensions/openspace-chat/src/browser/model-selector.tsx`

**Specifics:**
```typescript
const firstAvailable = providers
  .flatMap(provider => Object.values(provider.models).map(model => ({ provider, model })))
  [0];

if (firstAvailable) {
  sessionService.setActiveModel(`${firstAvailable.provider.id}/${firstAvailable.model.id}`);
} else {
  setError('No models available from any provider');
}
```

**Verification:** Test that first provider empty does not block selecting a model from a later provider. Test fully empty model sets show clear empty state.

---

### Task 26: Validate renderPlan memoization behavior (no code change unless reproduced)

**Gap:** Prior review flagged stale memoization in `message-timeline.tsx`, but current message update flow appears immutable and emits cloned arrays from SessionService.

**Why It Matters:** Avoid unnecessary churn and refactors when the issue is not reproducible in the current architecture.

**How We Fix It:**
1. Add/extend regression test that streams incremental updates and verifies render plan refreshes
2. If the issue is reproducible, implement targeted immutable update fix
3. If not reproducible, document as validated non-issue and close

**Files to Modify (if needed):**
- `extensions/openspace-chat/src/browser/message-timeline.tsx`
- `extensions/openspace-core/src/browser/session-service.ts` (only if mutation path is found)

**Verification:** Automated test demonstrates render plan updates during streaming without stale output.

---

### Task 27: Fix singleton widget IDs (presentation/whiteboard)

**Gap:** PresentationWidget.ID and WhiteboardWidget.ID are static strings. Opening a second file reuses existing widget instead of creating new instance.

**Why It Matters:** Cannot view two presentations or whiteboards side by side.

**How We Fix It:**
1. Adopt markdown viewer's splitCounters pattern from markdown-viewer-open-handler.ts:53-65
2. Generate unique widget keys using URI

**Files to Modify:**
- `extensions/openspace-presentation/src/browser/presentation-open-handler.ts`
- `extensions/openspace-whiteboard/src/browser/whiteboard-open-handler.ts`

**Verification:** Test that opening two .deck.md files creates two distinct widgets.

---

### Task 28: Fix shape ID collisions

**Gap:** `whiteboard-command-contribution.ts:737,798,832` uses `Date.now()` for shape IDs. Two calls in same millisecond collide.

**Why It Matters:** Silent data loss — shapes overwritten.

**How We Fix It:**
1. Use crypto.randomUUID() or monotonic counter

**Files to Modify:**
- `extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts`

**Specifics:**
```typescript
private shapeCounter = 0;
private nextShapeId(): string {
  return `shape:${Date.now()}-${this.shapeCounter++}-${Math.random().toString(36).slice(2, 6)}`;
}
```

**Verification:** Test that 100 rapid shape creations produce unique IDs.

---
### Task 29: Add input validation to command arguments

**Gap:** All presentation and whiteboard command handlers destructure args without null/undefined checks. Missing args produce unhelpful TypeErrors.

**Why It Matters:** Poor developer experience for AI agent callers. Hard to debug.

**How We Fix It:**
1. Add guard clauses at top of each handler
2. Throw descriptive errors for missing required args

**Files to Modify:**
- `extensions/openspace-presentation/src/browser/presentation-command-contribution.ts`
- `extensions/openspace-whiteboard/src/browser/whiteboard-command-contribution.ts`

**Verification:** Existing command tests pass. Add tests for missing args returning clear errors.

---

### Task 30: Fix silently succeeding updateShape/deleteShape

**Gap:** `whiteboard-service.ts:186-215` operations on non-existent shapes return success.

**Why It Matters:** Callers can't detect stale shape IDs.

**How We Fix It:**
1. Throw error when shape doesn't exist

**Files to Modify:**
- `extensions/openspace-whiteboard/src/browser/whiteboard-service.ts`

**Verification:** Test that update/delete with non-existent ID throws.

---

### Task 31: Scope mermaid querySelector to widget

**Gap:** `markdown-viewer-widget.tsx:338,343` uses document.querySelectorAll globally. Multiple viewers interfere.

**Why It Matters:** Visual glitches and rendering errors with multiple markdown viewers open.

**How We Fix It:**
1. Scope selector to this.node instead of document

**Files to Modify:**
- `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx`

**Specifics:**
```typescript
const els = this.node.querySelectorAll('.markdown-viewer-preview .mermaid');
```

**Verification:** Existing tests pass. Manual test with two markdown viewers open.

---

### Task 32: Add onResize to markdown viewer

**Gap:** Markdown viewer doesn't relay resize events to Monaco editor. Layout breaks on panel resize in edit mode.

**Why It Matters:** Broken Monaco editor layout after resize.

**How We Fix It:**
1. Override onResize method, relay to Monaco

**Files to Modify:**
- `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx`

**Specifics:**
```typescript
protected onResize(msg: Widget.ResizeMessage): void {
  super.onResize(msg);
  if (this.monacoEditor) {
    this.monacoEditor.getControl().layout();
  }
}
```

**Verification:** Manual test: open markdown in edit mode, resize panel, verify editor reflows.

---

### Task 33: Add rendering pipeline XSS tests

**Gap:** Zero test coverage for markdown rendering, Mermaid rendering, ANSI rendering. No regression tests for XSS.

**Why It Matters:** Security regressions reintroduced silently.

**How We Fix It:**
1. Create comprehensive XSS test suite
2. Test payloads: script tags, img onerror, javascript: URLs, SVG onload, foreignObject
3. Test each rendering path: markdown, Mermaid, ANSI

**Files to Create:**
- `extensions/openspace-chat/src/browser/__tests__/markdown-renderer-xss.spec.ts`

**Verification:** All XSS tests pass. Run with coverage to verify rendering paths are covered.

---

### Task 34: Add AI models preference renderer tests

**Gap:** Complex toggle logic (empty-array-means-all-enabled) in ai-models-preference-renderer.tsx is untested.

**Why It Matters:** Fragile semantic inversion is easy to break.

**How We Fix It:**
1. Extract toggle logic into a pure utility function
2. Unit test the utility: empty=all, toggle single, toggle provider, toggle all, canonicalize back to empty

**Files to Modify:**
- `extensions/openspace-settings/src/browser/ai-models-preference-renderer.tsx` (extract utility)

**Files to Create:**
- `extensions/openspace-settings/src/browser/__tests__/ai-models-toggle-logic.spec.ts`

**Verification:** All toggle logic tests pass.

---

### Task 35: Fix dangerouslySetInnerHTML for SVG icons

**Gap:** message-bubble.tsx ToolBlock uses dangerouslySetInnerHTML for SVG icon strings.

**Why It Matters:** Fragile pattern. Low risk now (hardcoded) but future change to external data introduces XSS without review friction.

**How We Fix It:**
1. Wrap icon SVG strings through DOMPurify with SVG profile
2. Or replace with React SVG components

**Files to Modify:**
- `extensions/openspace-chat/src/browser/message-bubble.tsx`

**Verification:** Visual verification that icons still render correctly.

---

## Phase 3: Minor Fixes (20 issues)

### Task 36: Remove/guard console.log statements

**Files to Modify:**
- `extensions/openspace-core/src/browser/filter-contribution.ts:47` — wrap in NODE_ENV check
- `extensions/openspace-chat/src/browser/openspace-chat-frontend-module.ts:25` — wrap in NODE_ENV check
- `extensions/openspace-viewers/src/browser/markdown-viewer-widget.tsx` — remove BUILD v8 stamp, convert 12 others to logger.debug()
- `extensions/openspace-layout/src/browser/layout-contribution.ts:49` — use ILogger

**Verification:** grep for unguarded console.log in src/browser/ — none remain.

---

### Task 37: Rename duplicate AgentCommand types

**Files to Modify:**
- `extensions/openspace-core/src/common/session-protocol.ts` — rename to SessionAgentCommand
- `extensions/openspace-core/src/common/command-manifest.ts` — rename to ManifestAgentCommand
- Update all import references

**Verification:** tsc --noEmit passes. grep for old name finds no references.

---

### Task 38: Remove dead code and fix minor inconsistencies

This task covers:
- Remove unreachable os.homedir() fallback in hub.ts:102
- Log swallowed errors in patch-engine.ts:296 write queue
- Remove redundant /i flags in sensitive-files.ts
- Remove deprecated document.execCommand usage in prompt-input.tsx
- Fix inconsistent workspace root access in whiteboard-service.ts:66
- Remove redundant file resolve in open handlers
- Fix hardcoded viewport dimensions in whiteboard camera fit
- Add error boundary/defensive checks in AI models preference renderer

**Files to Modify:**
- Multiple files as listed above

**Verification:** All existing tests pass. tsc --noEmit passes.

---

### Task 39: Add missing test files

**Files to Create:**
- `extensions/openspace-core/src/browser/__tests__/bridge-contribution.spec.ts`
- `extensions/openspace-core/src/browser/__tests__/filter-contribution.spec.ts`

**Expand:**
- `extensions/openspace-core/src/browser/__tests__/terminal-ring-buffer.spec.ts` — add missing coverage if not created by Task 18
- `extensions/openspace-core/src/browser/__tests__/permission-dialog.spec.ts` — add keyboard, focus trap, timeout tests

**Verification:** All new tests pass. Coverage improves for target files.

---

### Task 40: Refactor large files (non-blocking)

**Gap:** chat-widget.tsx (908 lines) and message-bubble.tsx (1,237 lines) are too large.

**Why It Matters:** Maintainability. Large files contribute to hook dependency bugs.

**How We Fix It:**
- chat-widget.tsx: extract useSessionManagement, useMessageHandling, useShellCommands, useScrollBehavior hooks
- message-bubble.tsx: split into tool-block.tsx, task-tool-block.tsx, todo-tool-block.tsx, context-tool-group.tsx, turn-group.tsx, retry-banner.tsx, diff-utils.ts

**Files to Create:** Multiple new files as listed
**Files to Modify:** chat-widget.tsx, message-bubble.tsx — reduce to orchestration

**Verification:** All existing tests pass. No visual regressions.

---

## Execution Summary

| Phase | Tasks | Issues Fixed | Priority |
|-------|-------|-------------|----------|
| Phase 1: Critical | Tasks 1-11 | 10 critical + 1 security hardening | Immediate |
| Phase 2: Important | Tasks 12-35 | 27 important | Short-term |
| Phase 3: Minor | Tasks 36-40 | 20 minor | When convenient |

**Estimated effort:**
- Phase 1: 1-2 days (critical security/correctness fixes + ANSI hardening)
- Phase 2: 3-5 days (architecture improvements, test additions)
- Phase 3: 2-3 days (cleanup, refactoring)
