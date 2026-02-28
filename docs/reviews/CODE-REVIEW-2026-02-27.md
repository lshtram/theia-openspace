# Architectural Code Review: theia-openspace
*Focus: prior finding regression check + new findings · 2026-02-27*

---

## A. Prior Findings Status

Tracking the 15 findings (E1–E15) from the [2026-02-26 review](./CODE-REVIEW-2026-02-26.md).

| ID | Finding | Status | Evidence |
|---|---|---|---|
| E1 | Duplicate `renameSession` in protocol | ✅ FIXED | `opencode-protocol.ts:217` — single declaration |
| E2 | `getMcpConfig()` reads fs in browser | ❌ STILL OPEN | `session-service.ts:331-361` — `fs.readFileSync` with runtime guard |
| E3 | SyncService accesses SessionService private | ✅ FIXED | `session-service.ts:2066-2068` — public `incrementUnseenForSession()` method |
| E4 | ChatComponent bypasses SessionService | ✅ FIXED | `chat-widget.tsx` uses `sessionService.sendMessage()` etc. |
| E5 | `projectId` everywhere but ignored | ⚠️ PARTIALLY FIXED | Warning comment added (Stage 1), still in all method signatures |
| E6 | Mutation methods on public SessionService interface | ❌ STILL OPEN | `session-service.ts:125-148` — no `SessionMutator` split |
| E7 | `toolNameToCategory` display logic in SessionService | ❌ STILL OPEN | `session-service.ts:1901-1911` |
| E8 | Streaming correlation state in OpenCodeProxy | ❌ STILL OPEN | `opencode-proxy.ts:90-99` — `lastStreamingPartMessageId`, `userMessageIds` |
| E9 | Session list loading duplicated between widgets | ❌ STILL OPEN | `chat-widget.tsx:616-634` and `sessions-widget.tsx:75-86` both call `getSessions()` |
| E10 | Voice DI module swallows errors | ❓ UNABLE TO VERIFY | Voice frontend module not in scoped files |
| E11 | Hardcoded Hub port `localhost:3000` | ✅ FIXED | Uses `window.location.origin` now |
| E12 | Dead `SessionServiceWiring` symbol | ✅ FIXED | Wiring done inline in frontend module, no dead class |
| E13 | `console.log` in production paths | ⚠️ PARTIALLY FIXED | `opencode-proxy.ts` uses logger; `hub-mcp.ts` still has 10+ `console.log` |
| E14 | `onFileEvent` stub since Phase 1 | ❌ STILL OPEN | `opencode-sync-service.ts:656-671` — "no action in Phase 1" |
| E15 | `session.title` used without null guard | ✅ FIXED | `session-service.ts:51-53` — `sessionDisplayTitle()` utility |

**Summary:** 5/15 fixed, 2/15 partially fixed, 7/15 still open, 1 unverified.

---

## B. New Findings

---

### 🔴 Critical — Must Fix

---

#### C1. Node.js `fs` import in browser bundle

**File:** `session-service.ts:33`

**Finding:** `import * as fs from 'fs'` in a browser-side service. This either fails at runtime or bloats the webpack bundle with a polyfill. The import is guarded by a runtime check (`typeof fs.existsSync === 'function'` at line 335), but the import itself is the problem — webpack must resolve it regardless of runtime branching.

**Impact:** Bundle bloat, brittle runtime behavior, violates browser/node boundary. This is the root cause of E2 and the reason it remains open.

**Proposal — move `getMcpConfig()` to the backend via RPC:**

1. **`opencode-proxy.ts`** — add backend method:
   ```typescript
   async getMcpConfig(directory: string): Promise<McpConfig | undefined> {
     const configPath = path.join(directory, 'opencode.json');
     try {
       const raw = await fs.promises.readFile(configPath, 'utf-8');
       return JSON.parse(raw) as McpConfig;
     } catch {
       return undefined;
     }
   }
   ```

2. **`opencode-protocol.ts`** — add to `OpenCodeService` interface:
   ```typescript
   getMcpConfig(directory: string): Promise<McpConfig | undefined>;
   ```

3. **`session-service.ts`** — replace inline implementation with RPC call:
   ```typescript
   private async getMcpConfig(): Promise<McpConfig | undefined> {
     if (!this._activeProject) return undefined;
     return this.openCodeService.getMcpConfig(this._activeProject.directory);
   }
   ```
   Delete the entire `fs`-based implementation and the `import * as fs` statement.

**Effort:** 2–3 hours. **Risk:** Low — same data, different transport. Resolves E2 simultaneously.

---

#### C2. User-supplied regex in `searchFiles` causes ReDoS risk

**File:** `hub-mcp.ts:874-878`

**Finding:** `new RegExp(pattern)` with user-supplied input from MCP tool calls. While there is a 5-second timeout on the overall search operation, a pathological regex (e.g., `(a+)+$`) can spike CPU for the entire duration, blocking the event loop for all other requests.

**Impact:** Denial of service through malicious regex patterns via MCP. A single bad pattern blocks all other MCP tool calls and SSE streams for up to 5 seconds.

**Proposal:**

```typescript
// hub-mcp.ts — wrap regex construction in validation:
import { isSafeRegex } from './regex-validator'; // or use 'safe-regex2' npm package

let regex: RegExp;
try {
  if (!isSafeRegex(pattern)) {
    return { content: [{ type: 'text', text: `Unsafe regex pattern rejected: ${pattern}` }] };
  }
  regex = new RegExp(pattern);
} catch (e) {
  return { content: [{ type: 'text', text: `Invalid regex: ${e.message}` }] };
}
```

Alternatively, use the `safe-regex2` npm package which detects exponential-time patterns.

**Effort:** 1–2 hours. **Risk:** Low — additive validation.

---

#### C3. Synchronous filesystem calls block the event loop

**Files:**
- `hub-mcp.ts:897,914,916` — `searchFiles` uses `fs.readdirSync`, `fs.statSync`, `fs.readFileSync`
- `artifact-store.ts:67` — `fs.readFileSync` in chokidar watcher callback

**Finding:** Synchronous I/O blocks the Node.js event loop. For large directory trees, `searchFiles` can block for seconds while scanning. During that time, all other MCP requests, SSE streams, and Hub routes are stalled.

**Impact:** All concurrent MCP operations freeze during file search. In the worst case, SSE connections time out and clients receive stale data.

**Proposal — convert to async `fs.promises` API:**

```typescript
// hub-mcp.ts — replace synchronous searchFiles with async version:
async function searchFiles(dir: string, regex: RegExp, results: SearchResult[]): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await searchFiles(fullPath, regex, results);
    } else if (entry.isFile()) {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      // ... match logic
    }
  }
}
```

For `artifact-store.ts`, use `await fs.promises.readFile()` in the chokidar callback (chokidar callbacks support async).

**Effort:** 3–4 hours. **Risk:** Low — same logic, async execution.

---

### 🟡 Important — Should Fix

---

#### I4. Pervasive `as unknown as` and `as any` type casts

**Files:**
- `chat-widget.tsx:274,320,467,478,489,497,855,907,930`
- `session-service.ts:628,1533,1809,1821,1854,1881`
- `model-selector.tsx:88-93`

**Finding:** Fields like `parentID`, `summary`, `revert`, `share`, `model`, `free`, `inputPrice`, `outputPrice` are accessed through `as unknown as` or `as any` casts, indicating the OpenCode SDK types in the protocol are incomplete or out of date. This is a new finding not present in the prior review — the cast count has grown as features were added.

**Impact:** No compile-time safety for frequently-accessed fields. Runtime crashes if the upstream OpenCode API changes field names or types. TypeScript's value proposition is negated at these call sites.

**Proposal — extend `opencode-sdk-types.ts` with missing fields:**

```typescript
// opencode-sdk-types.ts — add the missing fields to existing types:
export interface Session {
  // ... existing fields
  parentID?: string;
  time: SessionTime & { archived?: string };
}

export interface Message {
  // ... existing fields
  summary?: string;
  revert?: { messageId: string };
  share?: { url: string };
}

export interface Model {
  // ... existing fields
  free?: boolean;
  inputPrice?: number;
  outputPrice?: number;
}
```

Then remove all `as unknown as` and `as any` casts that access these fields. If the upstream SDK types change, TypeScript will report errors at compile time rather than producing `undefined` at runtime.

**Effort:** 1 day. **Risk:** Low — additive type declarations, removes unsafe casts.

---

#### I5. Custom HTML sanitizer instead of established library

**File:** `prompt-input.tsx:32-63`

**Finding:** Custom `sanitizeHtml` function uses regex-based tag stripping. Custom HTML sanitizers are notoriously fragile — edge cases in HTML parsing (e.g., nested tags, attribute injection, Unicode bypasses) can defeat regex-based filters.

**Impact:** Potential XSS if user-generated or AI-generated content passes through this sanitizer in an unexpected context.

**Proposal — replace with DOMPurify:**

```typescript
import DOMPurify from 'dompurify';

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'] });
}
```

DOMPurify is battle-tested, actively maintained, and handles all known HTML parsing edge cases. It is ~7KB gzipped.

**Effort:** 1–2 hours (install dependency + replace function). **Risk:** None.

---

#### I6. Hardcoded `AVAILABLE_AGENTS` array

**File:** `prompt-input.tsx:74-80`

**Finding:** The agent list (`build`, `plan`, `general`, `explore`, `code-reviewer`, `spec-reviewer`) is hardcoded in the UI component. Adding or removing agents requires a code change, recompile, and redeploy.

**Impact:** Breaks single-source-of-truth principle. Will get stale as agents are added or renamed upstream.

**Proposal — fetch agent list from the OpenCode server API at startup:**

```typescript
// session-service.ts — add method:
async getAvailableAgents(): Promise<string[]> {
  // Fetch from OpenCode server config or Hub endpoint
  return this.openCodeService.getAgents();
}
```

`PromptInput` calls this on mount and populates the `@` mention autocomplete from the result. Fall back to the current hardcoded list if the API call fails.

**Effort:** 3–4 hours. **Risk:** Low — graceful degradation with fallback.

---

#### I7. SessionService god object unchanged at ~2,119 lines

**File:** `session-service.ts`

**Finding:** No decomposition since E6/E7 were reported. The class still mixes:
- Session CRUD
- Streaming coordination (three overlapping state machines)
- Message mutation
- Display helpers (`toolNameToCategory`, `sessionDisplayTitle`)
- MCP config reading (filesystem in browser — see C1)
- Pending question/permission management
- Todo list management
- Session pagination state
- `localStorage` persistence

This is the R3 roadmap item from the prior review. It remains at 0% completion.

**Impact:** High coupling, difficult to test in isolation, hard for new contributors to understand. Every new feature adds to this file.

**Proposal:** Execute the R3 roadmap from the prior review — extract `SessionPersistence`, `PendingOperationsQueue`, `MessageStore`, and `StreamingCoordinator` as independent injectable services. Target: `SessionServiceImpl` ≤ 600 lines.

**Effort:** 5–7 days (dedicated sprint). **Risk:** Medium — touches core infrastructure, requires integration testing.

---

#### I8. `notification-service.ts` localStorage unbounded growth

**File:** `notification-service.ts`

**Finding:** The `_counts` Map grows with each new session ID and is serialized to localStorage on every update. Old session IDs are never pruned — they accumulate indefinitely.

**Impact:** localStorage quota exhaustion over time (5–10MB limit in most browsers). After hundreds or thousands of sessions, the serialized Map will approach this limit, causing `QuotaExceededError` exceptions.

**Proposal — prune stale entries on load:**

```typescript
// notification-service.ts — add pruning in the load path:
private pruneStaleEntries(activeSessions: Set<string>): void {
  for (const sessionId of this._counts.keys()) {
    if (!activeSessions.has(sessionId)) {
      this._counts.delete(sessionId);
    }
  }
  this.persist();
}
```

Call `pruneStaleEntries()` when the session list is loaded, passing the set of known session IDs. Alternatively, cap the Map to the most recent N entries (e.g., 200).

**Effort:** 1–2 hours. **Risk:** None — additive, only removes entries for deleted sessions.

---

#### I9. Hardcoded shell path `/bin/bash`

**File:** `opencode-proxy.ts:1295`

**Finding:** Shell execution hardcoded to `/bin/bash`. This path does not exist on Windows, and may not be available on minimal Linux containers (which often only have `/bin/sh`).

**Impact:** Feature broken on Windows deployments. Potential failures on Alpine/musl-based Docker images.

**Proposal:**

```typescript
// opencode-proxy.ts — replace:
const shell = '/bin/bash';
// With:
const shell = process.platform === 'win32'
  ? process.env.COMSPEC || 'cmd.exe'
  : process.env.SHELL || '/bin/sh';
```

**Effort:** 15 minutes. **Risk:** None.

---

#### I10. `recentDeltaEvents` memory pressure

**File:** `opencode-sync-service.ts:586-593`

**Finding:** The `recentDeltaEvents` Map is keyed by full delta content strings (not IDs or hashes). Cleanup only triggers when the Map reaches 500 entries. During active streaming, large delta strings (e.g., tool output with file contents) create significant memory pressure.

**Impact:** Memory leaks during long streaming sessions. The Map could grow to several MB before the 500-entry cleanup fires.

**Proposal — use TTL-based eviction with content hashing:**

```typescript
// opencode-sync-service.ts — replace full-content keys with hashes:
private recentDeltaEvents = new Map<string, number>(); // hash → timestamp

private deltaKey(messageId: string, partIndex: number, delta: string): string {
  // Use a fast hash instead of storing full content as key
  return `${messageId}:${partIndex}:${this.simpleHash(delta)}`;
}

private pruneRecentDeltas(): void {
  const now = Date.now();
  for (const [key, timestamp] of this.recentDeltaEvents) {
    if (now - timestamp > 10_000) { // 10s TTL
      this.recentDeltaEvents.delete(key);
    }
  }
}
```

**Effort:** 1–2 hours. **Risk:** Low — deduplication behaviour preserved, memory usage reduced.

---

### 🔵 Minor — Fix When Convenient

---

#### M11. `ExtendedSession` type in sessions-widget.tsx

**File:** `sessions-widget.tsx:27-30`

**Finding:** Local `ExtendedSession` interface adds `parentID` and `time.archived` to the base `Session` type. These fields should be on the shared type definition, not duplicated locally.

**Proposal:** Add `parentID` and `time.archived` to `opencode-sdk-types.ts` (as part of I4 fix), then remove the local `ExtendedSession` interface. Replace all `ExtendedSession` usages with the base `Session` type.

**Effort:** 15 minutes (after I4 is complete). **Risk:** None.

---

#### M12. `sendPartsNow` type cast

**File:** `chat-widget.tsx:997`

**Finding:** `parts as any as MessagePartInput[]` — papers over a type mismatch between the internal part representation and the `MessagePartInput` type expected by the send method.

**Proposal:** Align the internal part builder with the `MessagePartInput` type so the cast is unnecessary. If the types genuinely differ, create an explicit mapping function rather than using `as any`.

**Effort:** 30 minutes. **Risk:** None.

---

#### M13. `console.log` in hub-mcp.ts

**File:** `hub-mcp.ts:103,350,354,356,380,382,385,445,450,471`

**Finding:** 10+ `console.log` and `console.error` calls in production MCP tool handlers. This is the remaining half of E13 — the proxy was fixed, but `hub-mcp.ts` was not.

**Proposal:** Replace with a structured logger:

```typescript
import { ILogger } from '@theia/core';

// In tool handlers:
logger.debug('[HubMCP] Tool registered:', toolName);
logger.warn('[HubMCP] Tool execution failed:', error.message);
```

This matches what was already done for `opencode-proxy.ts` in E13.

**Effort:** 30 minutes. **Risk:** None.

---

#### M14. `onFileEvent` Phase 1 stubs

**File:** `opencode-sync-service.ts:656-671`

**Finding:** Dead stubs with "no action in Phase 1" comments — Phase 1 was completed months ago. The stubs neither handle events nor explain why they don't.

**Proposal:** Either implement file event handling (see E14 proposal from prior review — inject `FileService` and fire `fireFilesChanged`) or replace with a clean TODO:

```typescript
case 'file.write':
case 'file.delete':
case 'file.move':
  // TODO(#<issue-number>): Implement file event forwarding to Theia FileService
  break;
```

**Effort:** 15 minutes (TODO) or 3–4 hours (full implementation). **Risk:** None.

---

#### M15. `projectId` parameter still in all method signatures

**File:** Throughout `opencode-protocol.ts`

**Finding:** Stage 2 of the E5 fix has not been executed. The `projectId` parameter is present on every `OpenCodeService` method but always passed as an empty string. The Stage 1 warning comment was added, but the cleanup was deferred.

**Proposal:** Execute Stage 2 — remove `projectId` from every method signature and every call site in a single mechanical PR. Zero behaviour change (every call site already passes `''`).

**Effort:** 2–3 hours. **Risk:** None — pure parameter removal.

---

## C. Strengths

The codebase has notable areas of quality that should be preserved and emulated:

- **Clear separation between backend and frontend** via Theia RPC. `opencode-protocol.ts` defines the boundary cleanly, and the `OpenCodeService`/`OpenCodeClient` split is idiomatic Theia.

- **ArtifactStore** (`artifact-store.ts`) — well-designed OCC-based write-after-backup with audit trail. Small, focused, correct. A model for what other services should look like.

- **PatchEngine** (`patch-engine.ts`) — clean implementation of optimistic concurrency with proper conflict detection and rollback.

- **`sessionDisplayTitle()` utility** (`session-service.ts:51-53`) — good defensive coding pattern. E15 was fixed correctly with a reusable utility, not scattered inline guards.

- **Model selector** (`model-selector.tsx`) — well-structured React component with grouped and filtered display. Clean separation of data transformation and rendering.

- **Message timeline** (`message-timeline.tsx`) — sophisticated scroll management with `ResizeObserver`, auto-scroll detection, and proper cleanup on unmount.

- **Hub route organization** (`hub.ts`) — clean Express middleware chain with proper CORS configuration and SSE headers.

- **Public method for unseen count** — E3 was properly fixed with `incrementUnseenForSession()`. The cast is gone, the boundary is clean.

---

## D. Architecture Assessment: Roadmap Progress

The R1–R4 roadmap from the prior review remains the primary architectural improvement path. Progress since the 2026-02-26 review:

### Phase R1 — Hygiene: ~60% complete

| Item | Status |
|---|---|
| E1 duplicate `renameSession` | ✅ Fixed |
| E3 private field cast | ✅ Fixed |
| E11 hardcoded port | ✅ Fixed |
| E12 dead symbol | ✅ Fixed |
| E15 session.title null guard | ✅ Fixed |
| E5 Stage 1 (warning comment) | ✅ Done |
| E13 console.log (proxy) | ✅ Fixed |
| E13 console.log (hub-mcp) | ❌ Still open (see M13) |

### Phase R2 — Boundary Fixes: ~20% complete

| Item | Status |
|---|---|
| E4 ChatComponent bypasses SessionService | ✅ Fixed |
| E6 mutation methods on public interface | ❌ Not started |
| E7 `toolNameToCategory` in SessionService | ❌ Not started |
| E9 duplicated session list loading | ❌ Not started |
| `as unknown as` cast elimination (new) | ❌ Not started (see I4) |

### Phase R3 — SessionService Decomposition: 0% complete

`SessionServiceImpl` remains at ~2,119 lines. No sub-service extraction has begun. The four target extractions (`SessionPersistence`, `PendingOperationsQueue`, `MessageStore`, `StreamingCoordinator`) are all pending.

### Phase R4 — Replaceability Abstractions: 0% complete

No `ChatInputService`, no file event implementation, `projectId` still present in all signatures.

---

## E. Recommendations (Top 5, Priority Order)

1. **Move `getMcpConfig()` to the backend** — resolves C1 and E2 simultaneously. Removes `fs` import from the browser bundle. Lowest effort, highest-urgency fix.

2. **Convert synchronous fs calls to async** — resolves C3. Prevents event loop blocking during file search. Essential for multi-user Hub scenarios.

3. **Extend SDK types to eliminate `as any` casts** — resolves I4. Restores compile-time type safety for the 20+ fields currently accessed through unsafe casts.

4. **Begin R3: Extract `StreamingCoordinator` from SessionService** — the highest-value architectural improvement. The streaming subsystem is the most complex, most bug-prone part of SessionService. Extracting it first yields the biggest testability and maintainability improvement.

5. **Replace custom HTML sanitizer with DOMPurify** — resolves I5. Eliminates XSS risk from the regex-based sanitizer with a battle-tested library.

---

## F. Summary Scorecard

| Dimension | Rating | Change vs. Prior | Notes |
|---|---|---|---|
| Prior finding resolution | ⚠️ Acceptable | — | 5/15 fixed, 2 partial — steady progress |
| Browser/Node boundary | ❌ Weak | Same | `fs` import in browser bundle (C1/E2) |
| Input validation | ❌ Weak | New finding | ReDoS risk in MCP tool (C2) |
| Event loop safety | ❌ Weak | New finding | Sync fs calls block all requests (C3) |
| Type safety | ❌ Declining | Worse | `as any` casts have grown with features (I4) |
| Security | ⚠️ Mixed | New finding | Custom sanitizer (I5), ReDoS (C2) |
| Module separation | ⚠️ Mixed | Same | SessionService still 2,119 lines |
| Replaceability | ❌ Weak | Same | No abstractions added |
| Platform compatibility | ⚠️ Mixed | New finding | Hardcoded `/bin/bash` (I9) |
| Memory safety | ⚠️ Mixed | New finding | Unbounded localStorage (I8), delta map (I10) |

---

## G. Finding → Phase Mapping

| Finding | Roadmap Phase | Effort |
|---|---|---|
| C1 — `fs` import in browser | R1 (complete E2) | 2–3 hours |
| C2 — ReDoS in searchFiles | R1 | 1–2 hours |
| C3 — Sync fs calls | R1 | 3–4 hours |
| I4 — `as any` casts | R2 | 1 day |
| I5 — Custom HTML sanitizer | R1 | 1–2 hours |
| I6 — Hardcoded agents | R2 | 3–4 hours |
| I7 — SessionService god object | R3 | 5–7 days |
| I8 — localStorage unbounded | R1 | 1–2 hours |
| I9 — Hardcoded `/bin/bash` | R1 | 15 min |
| I10 — `recentDeltaEvents` memory | R2 | 1–2 hours |
| M11 — `ExtendedSession` type | R2 (with I4) | 15 min |
| M12 — `sendPartsNow` cast | R2 (with I4) | 30 min |
| M13 — `console.log` in hub-mcp | R1 | 30 min |
| M14 — `onFileEvent` stubs | R4 | 15 min – 4 hours |
| M15 — `projectId` removal | R4 | 2–3 hours |

**Updated R1 estimate:** ~1.5 days (was ~3 hours — now includes C1, C2, C3, I5, I8, I9, M13)

---

## H. Verdict

**NEEDS WORK.**

The codebase has improved since the last review — 5 of 15 prior findings are fixed, 2 are partially fixed, and the fixes are done correctly (E3, E15 are exemplary). However:

- **3 Critical issues remain:** browser `fs` import (C1/E2), ReDoS risk (C2), and synchronous I/O blocking (C3). All three affect runtime correctness or security.
- **Type safety has regressed** since the prior review — the `as unknown as` cast count has grown as Phase 2.5 features were added without corresponding type declarations (I4).
- **The SessionService god object (R3) is untouched** at 2,119 lines. This is the primary architectural debt and the biggest drag on development velocity.

**Recommended gating criteria before production readiness:**
1. All 3 Critical items (C1, C2, C3) resolved
2. Type casts reduced by ≥80% (I4)
3. R3 sprint scheduled with at least `StreamingCoordinator` extraction complete
