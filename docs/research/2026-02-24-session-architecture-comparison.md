# Session & Chat Architecture: OpenCode vs theia-openspace

**Date:** 2026-02-24  
**Branch:** feature/session-analysis  
**Purpose:** Authoritative side-by-side comparison across all 12 session/chat topics.  
Used to drive implementation priorities and identify what must be corrected vs. what can be deferred.

---

## Legend

| Tag | Meaning |
|---|---|
| ✅ Same | OpenSpace matches OpenCode behaviour |
| ⚠️ Difference — correct | OpenSpace diverges; the divergence is a bug or incorrect behaviour that must be fixed |
| 🔲 Gap — needed | Feature exists in OpenCode but is absent in OpenSpace; user-visible value justifies implementation |
| 💤 Gap — defer | Feature exists in OpenCode but is absent in OpenSpace; low value or premature; defer |
| 🐛 Bug | Known defect in current OpenSpace code |

---

## 1. Session Data Model

### OpenCode
**File:** `packages/opencode/src/session/session.sql.ts`, `session/index.ts`

```
Session.Info {
  id, slug, projectID, directory, parentID?,
  title, version,
  time: { created, updated, compacting?, archived? },
  summary?: { additions, deletions, files, diffs },
  share?: { url },
  revert?, permission?
}
```

Stored in SQLite (`SessionTable`). All fields persisted.

### OpenSpace
**File:** `extensions/openspace-core/src/common/opencode-sdk-types.ts`

The full `Session.Info` type is imported and used as-is. `SessionService.sessions: Session.Info[]` holds them in memory.

### Delta

| Field | Status | Notes |
|---|---|---|
| `id`, `title`, `directory`, `projectID` | ✅ Same | Displayed and used correctly |
| `slug` | 🔲 Gap — needed | Available on the object but never displayed in UI; useful for identification |
| `parentID` | 🔲 Gap — needed | Present but unused; forked sessions shown flat (see §11) |
| `time.archived` | 🔲 Gap — needed | Never set via UI; archived sessions not filtered from list |
| `summary` (additions/deletions) | 🔲 Gap — needed | Stats available but not shown anywhere in UI |
| `share.url` | 🔲 Gap — needed | URL available after sharing but never displayed |
| `revert`, `permission` | 💤 Gap — defer | Complex feature; no immediate user demand |

---

## 2. Message / Chat Model

### OpenCode
**File:** `session/message-v2.ts`, `session/session.sql.ts`

Two message roles: `User` and `Assistant`. Each assistant message has a `parentID` pointing to the user message that triggered it. Messages are stored in `MessageTable`; parts in `PartTable`.

**12 Part types:**

| Type | Purpose |
|---|---|
| `text` | Main prose content |
| `reasoning` | Extended thinking / scratchpad (e.g. Claude Extended Thinking) |
| `file` | File attachment or inline file content |
| `tool` | Tool call with state: `pending → running → completed / error` |
| `step-start` | Marks the start of an agent step |
| `step-finish` | Marks end of step; includes token usage |
| `snapshot` | Editor snapshot data |
| `patch` | File diff/patch |
| `agent` | Sub-agent invocation |
| `retry` | Retry metadata |
| `compaction` | Context window truncation marker |
| `subtask` | Sub-task reference |

### OpenSpace
**File:** `extensions/openspace-chat/src/browser/message-bubble.tsx`, `message-timeline.tsx`

Renders: `text`, `tool` (collapsed by default). Streaming text accumulation via `message.part.delta`.

### Delta

| Part type | Status | Notes |
|---|---|---|
| `text` | ✅ Same | Rendered correctly, streaming works |
| `tool` | ✅ Same | Rendered with name; state transitions shown |
| `reasoning` | 🔲 Gap — needed | Models with extended thinking emit these; invisible to user currently |
| `file` | 🔲 Gap — needed | File attachments from model not shown |
| `step-start` / `step-finish` | 💤 Gap — defer | Timing/token info; low user value at this stage |
| `snapshot` / `patch` | 🔲 Gap — needed | File changes made by the model; should surface as a diff view |
| `agent` | 🔲 Gap — needed | Sub-agent calls are invisible; important for transparency |
| `retry` | 💤 Gap — defer | Retry metadata; already partially covered by session status |
| `compaction` | 🔲 Gap — needed | User needs to know when context was truncated; a visual divider |
| `subtask` | 💤 Gap — defer | Low prevalence; defer |
| `parentID` on Assistant message | 🔲 Gap — needed | Not used to thread replies visually |

---

## 3. Session Lifecycle

### OpenCode
**File:** `session/index.ts`, `server/routes/session.ts`

Full lifecycle:

```
Create → [Init] → Active ↔ Idle/Busy
                         ↓
                    Fork (clone at messageID) → Child session
                         ↓
                    Summarize (compaction)
                         ↓
                    Share / Unshare
                         ↓
                    Revert / Unrevert
                         ↓
                    Archive (soft delete via time.archived)
                         ↓
                    Delete (hard, cascade children)
```

### OpenSpace
**File:** `extensions/openspace-core/src/browser/session-service.ts`

Implemented: `create`, `get`, `list`, `update` (rename only), `delete`, `abort`.

### Delta

| Operation | Status | Notes |
|---|---|---|
| Create | ✅ Same | `POST /session` |
| Get / List | ✅ Same | `GET /session`, `GET /session/:id` |
| Rename (update) | ✅ Same | `PATCH /session/:id` with title |
| Delete | ✅ Same | `DELETE /session/:id` |
| Abort | ✅ Same | `POST /session/:id/abort` |
| Init | ⚠️ Difference — correct | `POST /session/:id/init` never called; INIT command is not run after session creation. OpenCode always inits; OpenSpace skips it silently |
| Fork | 🔲 Gap — needed | No fork UI; child sessions cannot be created |
| Summarize / Compact | 🔲 Gap — needed | No compaction action; long sessions degrade without it |
| Share / Unshare | 💤 Gap — defer | Nice-to-have; not a daily workflow |
| Revert / Unrevert | 🔲 Gap — needed | Revert is a safety feature; agents make file changes |
| Archive | 🔲 Gap — needed | Sessions accumulate; no way to hide old ones |

---

## 4. Message Routing (SSE Event Handling)

### OpenCode
**File:** `bus/index.ts`, `server/routes/session.ts` (SSE endpoint `GET /event`)

All events flow through the Global Bus as `GlobalEvent { type, directory, properties }` and are streamed via SSE. Consumers subscribe at `GET /event?directory=<path>`.

**Session events:** `session.created`, `session.updated`, `session.deleted`, `session.diff`, `session.error`, `session.status`, `session.idle` (deprecated), `session.compacted`

**Message events:** `message.updated`, `message.removed`, `message.part.updated`, `message.part.delta`, `message.part.removed`

**Other events:** `todo.updated`, `command.executed`, `vcs.branch.updated`

### OpenSpace
**File:** `extensions/openspace-core/src/node/opencode-proxy.ts` (SSE consumer),  
`extensions/openspace-core/src/browser/opencode-sync-service.ts` (RPC → browser)

Forwarded events:
- `session.created`, `session.updated`, `session.deleted` → forwarded ✅
- `session.status` → forwarded ✅
- `message.updated` → fetches authoritative copy via REST, then forwards ✅
- `message.part.delta` → text appended to streaming buffer, forwarded ✅

### Delta

| Event | Status | Notes |
|---|---|---|
| `session.created/updated/deleted` | ✅ Same | Forwarded and handled |
| `session.status` | ✅ Same | Forwarded; idle/busy reflected in UI |
| `message.updated` | ✅ Same | Fetched authoritatively and forwarded |
| `message.part.delta` | ✅ Same | Streaming text works |
| `session.error` | ⚠️ Difference — correct | Falls through to `default` case in the SSE router in `opencode-proxy.ts`; error is silently discarded. User never sees model errors |
| `message.part.updated` | ⚠️ Difference — correct | Stubbed — logged but not forwarded. Replaces a part completely; needed for tool state transitions |
| `message.removed` | ⚠️ Difference — correct | Received but not forwarded; deleted messages stay visible in UI |
| `message.part.removed` | ⚠️ Difference — correct | Received but not forwarded |
| `session.idle` | 💤 Gap — defer | Deprecated upstream; superseded by `session.status` |
| `session.compacted` | 🔲 Gap — needed | Should trigger a UI refresh and show compaction marker |
| `todo.updated` | 🔲 Gap — needed | Todos invisible without this |
| `command.executed` | 💤 Gap — defer | No command execution UI yet |
| `vcs.branch.updated` | 💤 Gap — defer | No VCS panel yet |

---

## 5. Session Discovery

### OpenCode
**File:** `server/routes/session.ts` — `GET /session`

Supports query parameters:
- `directory` — filter by project directory
- `roots` — filter by root directories (array)
- `start` — cursor for pagination (timestamp of last seen)
- `search` — full-text search on title/content
- `limit` — max results per page

Sessions returned ordered by `time_updated` descending.

### OpenSpace
**File:** `extensions/openspace-core/src/browser/session-service.ts` — `loadSessions()`

Calls `GET /session` with no parameters. Loads all sessions for the current directory at once.

### Delta

| Feature | Status | Notes |
|---|---|---|
| Directory-scoped list | ✅ Same | Directory is set via `x-opencode-directory` header |
| All sessions returned | ✅ Same | Works for small session counts |
| `limit` / cursor pagination | 🔲 Gap — needed | Without pagination, large histories cause slow loads and memory pressure |
| `search` param | 🔲 Gap — needed | No session search in any UI panel |
| `roots` filter | 💤 Gap — defer | Multi-root workspace support not yet relevant |

---

## 6. Session Tracking (In-Memory Status)

### OpenCode
**File:** `session/status.ts`

```typescript
type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }
```

Status is **in-memory only** — not persisted to DB. Published via Bus as `session.status`. Endpoint `GET /session/status` returns all active statuses at once (for startup hydration).

### OpenSpace
**File:** `extensions/openspace-core/src/browser/session-service.ts`

`SessionStatus` type imported and used. `_sessionStatus: Map<string, SessionStatus>` tracks per-session status. `onSessionStatusChanged` emitter fires on updates.

### Delta

| Feature | Status | Notes |
|---|---|---|
| `idle` / `busy` tracking | ✅ Same | Forwarded and reflected in `isStreaming` flag |
| `retry` state forwarding | ✅ Same | Forwarded correctly by proxy |
| `retry` state UI | ⚠️ Difference — correct | `retry` state is received but `attempt`, `message`, and `next` countdown are never shown in UI; user sees no feedback during backoff |
| `GET /session/status` at startup | ⚠️ Difference — correct | Never called; sessions that are busy when the IDE opens will show as idle until the next SSE event arrives |
| `onSessionStatusChanged` disposal | 🐛 Bug | Emitter not disposed in `SessionService.dispose()` — memory leak. **File:** `session-service.ts` `dispose()` method |

---

## 7. Local Storage

### OpenCode
**File:** `storage/db.ts`

SQLite at `~/.local/share/opencode/opencode.db`. All session data, messages, parts, todos, and permissions persisted. WAL mode. Schema migrations via Drizzle ORM.

Legacy JSON file storage (`storage/storage.ts`) being migrated away.

### OpenSpace
**Files:** `session-service.ts` (browser localStorage)

- `localStorage['openspace.activeSessionId']` — active session ID
- `localStorage['openspace.activeProjectId']` — active project ID

No local caching of sessions or messages; everything re-fetched from OpenCode server on load.

### Delta

| Feature | Status | Notes |
|---|---|---|
| Active session persistence | ✅ Same | Correctly persisted in localStorage; survives reload |
| Session list caching | 💤 Gap — defer | Re-fetching on load is fine; caching adds complexity without clear benefit |
| Offline / server-unreachable fallback | 💤 Gap — defer | Out of scope for current phase |

---

## 8. Server Data / API Calls

### OpenCode
30 REST endpoints across sessions, messages, parts, and SSE.

### OpenSpace
8 endpoints called. Full inventory:

| Method | Endpoint | OpenSpace | Status |
|---|---|---|---|
| `GET` | `/session` | `loadSessions()` | ✅ Same |
| `POST` | `/session` | `createSession()` | ✅ Same |
| `GET` | `/session/:id` | `loadSession()` | ✅ Same |
| `PATCH` | `/session/:id` | `renameSession()` | ✅ Same (title only) |
| `DELETE` | `/session/:id` | `deleteSession()` | ✅ Same |
| `POST` | `/session/:id/abort` | `abortSession()` | ✅ Same |
| `GET` | `/session/:id/message` | `loadMessages()` | ⚠️ Difference — correct (no `limit` param) |
| `POST` | `/session/:id/message` | `sendMessage()` | ✅ Same |
| `POST` | `/session/:id/init` | — | ⚠️ Difference — correct |
| `POST` | `/session/:id/fork` | — | 🔲 Gap — needed |
| `POST` | `/session/:id/summarize` | — | 🔲 Gap — needed |
| `POST` | `/session/:id/revert` | — | 🔲 Gap — needed |
| `POST` | `/session/:id/unrevert` | — | 🔲 Gap — needed |
| `GET` | `/session/:id/diff` | — | 🔲 Gap — needed |
| `GET` | `/session/status` | — | ⚠️ Difference — correct (missing startup hydration) |
| `GET` | `/session/:id/children` | — | 🔲 Gap — needed (for fork UI) |
| `GET` | `/session/:id/todo` | — | 🔲 Gap — needed |
| `POST` | `/session/:id/share` | — | 💤 Gap — defer |
| `DELETE` | `/session/:id/share` | — | 💤 Gap — defer |
| `POST` | `/session/:id/command` | — | 💤 Gap — defer |
| `POST` | `/session/:id/shell` | — | 💤 Gap — defer |
| `POST` | `/session/:id/prompt_async` | — | 💤 Gap — defer |
| `DELETE` | `/:s/message/:m/part/:p` | — | 💤 Gap — defer |
| `PATCH` | `/:s/message/:m/part/:p` | — | 💤 Gap — defer |

---

## 9. Status Updates (UI Layer)

### OpenCode
Status changes are emitted via Bus and SSE. The TUI shows:
- A spinner while `busy`
- A retry countdown (next attempt in Xs, attempt N) while `retry`
- Nothing when `idle`

### OpenSpace
**File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`

Shows a spinner/busy indicator based on `isStreaming` flag (which correlates with `busy` status).

### Delta

| Feature | Status | Notes |
|---|---|---|
| Busy spinner | ✅ Same | Shown during streaming |
| Idle state | ✅ Same | Spinner hidden |
| `retry` countdown UI | ⚠️ Difference — correct | State received but not rendered; user sees no feedback when OpenCode is backing off |
| Per-session status badge in session list | 🔲 Gap — needed | Sessions widget shows no live status indicator |
| Busy indicator in session dropdown | 🔲 Gap — needed | No visual indicator which sessions are active |

---

## 10. Session Switching

### OpenCode (TUI)
**File:** `app/src/context/global-sync.tsx`

Active session is a reactive store per directory. Switching updates the store, loads messages for the new session. Browser `localStorage` persists the choice.

### OpenSpace
**File:** `extensions/openspace-core/src/browser/session-service.ts` — `setActiveSession()`  
**File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`, `sessions-widget.tsx`

Clicking a session in the dropdown or sidebar calls `setActiveSession()`, which persists to `localStorage` and calls `loadMessages()`.

### Delta

| Feature | Status | Notes |
|---|---|---|
| Basic switching | ✅ Same | Clicking a session switches it and loads messages |
| Persistence across reload | ✅ Same | localStorage |
| Session search in dropdown | 🔲 Gap — needed | Hard to find sessions by name with long lists |
| Abort in-progress prompt on switch | ⚠️ Difference — correct | Switching away from a busy session does not abort it; the previous session continues running and streaming silently |
| Navigate to parent session | 🔲 Gap — needed | No way to go from a forked child back to its parent |
| Keyboard shortcut | 💤 Gap — defer | Convenience feature; not blocking |

---

## 11. Session/Chat View UI

### OpenCode (TUI)
SolidJS reactive UI with full feature set: session list, message timeline, tool call display, streaming text, retry/error states, compaction markers, paginated message loading (400/page).

### OpenSpace
**Files:** `chat-widget.tsx`, `message-timeline.tsx`, `sessions-widget.tsx`, `message-bubble.tsx`, `question-dock.tsx`

Functional UI for the core loop: list sessions, view messages, send prompt, see streaming output, handle blocking questions/permissions.

### Delta

| Feature | Status | Notes |
|---|---|---|
| Session list | ✅ Same | Shown in dropdown and sidebar |
| Message display (text, tool) | ✅ Same | Core parts rendered |
| Streaming text | ✅ Same | `message.part.delta` path works |
| Blocking question UI | ✅ Same | `QuestionDock` |
| Permission dialog | ✅ Same | Wired to `onPermissionChanged` |
| Load more messages (pagination) | ⚠️ Difference — correct | All messages loaded at once; no limit/cursor. For sessions with 100s of messages this is a performance problem |
| Compaction marker in timeline | 🔲 Gap — needed | No visual cue when context was truncated |
| Retry / error state display | ⚠️ Difference — correct | Error and retry states not surfaced |
| Todo panel | 🔲 Gap — needed | Todos from model are invisible |
| Session diff / changed files | 🔲 Gap — needed | File changes not summarised anywhere |
| Archived sessions toggle | 🔲 Gap — needed | Archived sessions clutter the list |
| Forked session hierarchy | 🔲 Gap — needed | Flat list; parent→child relationship invisible |

---

## 12. Event / Subscription Model

### OpenCode
**File:** `bus/index.ts`, `server/routes/session.ts`

In-process Bus per Instance. All events also written to GlobalBus with `{ directory, payload }`. SSE endpoint `GET /event?directory=<path>` streams `GlobalEvent` objects to consumers.

Connection lifecycle: consumers reconnect via standard HTTP (EventSource or equivalent). OpenCode server simply emits; reconnect is the client's responsibility.

### OpenSpace
**File:** `extensions/openspace-core/src/node/opencode-proxy.ts`

Uses `fetch()` with a streaming body reader (not native `EventSource`). Reconnects with exponential backoff: 1s → 30s cap. Events are parsed and selectively forwarded to the browser via Theia RPC notifications.

### Delta

| Feature | Status | Notes |
|---|---|---|
| SSE connection to OpenCode | ✅ Same | Works correctly |
| Exponential backoff reconnect | ✅ Same | 1s→30s; good |
| Event parsing | ✅ Same | `GlobalEvent` format parsed correctly |
| Selective forwarding | ⚠️ Difference — correct | Only 6 of ~13 event types are forwarded; the rest are silently dropped (see §4) |
| Jitter on reconnect | 💤 Gap — defer | No jitter in backoff; could cause thundering herd if multiple IDEs reconnect simultaneously — low priority for single-user use |
| `getMcpConfig()` using Node `fs` in browser context | 🐛 Bug | Guarded by `typeof window === 'undefined'` but fragile; if ever bundled differently the guard will silently fail. **File:** `opencode-proxy.ts` |

---

## Summary: Prioritised Action List

### Must correct (broken behaviour)

| # | Issue | File |
|---|---|---|
| 1 | `session.error` SSE event silently dropped | `opencode-proxy.ts` |
| 2 | `message.part.updated` not forwarded (tool state transitions broken) | `opencode-proxy.ts` |
| 3 | `message.removed` not forwarded (deleted messages stay in UI) | `opencode-proxy.ts` |
| 4 | `message.part.removed` not forwarded | `opencode-proxy.ts` |
| 5 | `POST /session/:id/init` never called after session creation | `session-service.ts` |
| 6 | `GET /session/status` not called at startup (stale status on reconnect) | `opencode-proxy.ts` or `session-service.ts` |
| 7 | `GET /session/:id/message` has no `limit` param (unbounded load) | `session-service.ts` |
| 8 | Session switch does not abort in-progress prompt on previous session | `session-service.ts` |
| 9 | `retry` state not shown in UI | `chat-widget.tsx` |
| 10 | `onSessionStatusChanged` not disposed in `dispose()` | `session-service.ts` |

### Needed gaps (implement)

| # | Feature | Scope |
|---|---|---|
| 11 | `compaction` part / `session.compacted` event → visual marker in timeline | `message-timeline.tsx` + `opencode-proxy.ts` |
| 12 | `reasoning` part rendering | `message-bubble.tsx` |
| 13 | `agent` part rendering | `message-bubble.tsx` |
| 14 | `patch` / `snapshot` part → diff display | `message-bubble.tsx` + `session-service.ts` |
| 15 | Session fork (UI + `POST /session/:id/fork`) | `chat-widget.tsx` + `session-service.ts` |
| 16 | Session revert / unrevert | `chat-widget.tsx` + `session-service.ts` |
| 17 | Session archive (UI + `PATCH` with `time.archived`) | `sessions-widget.tsx` + `session-service.ts` |
| 18 | Session search (`search` param on `GET /session`) | `sessions-widget.tsx` + `session-service.ts` |
| 19 | Paginated message load-more | `message-timeline.tsx` + `session-service.ts` |
| 20 | Session list pagination (`limit` + `start` cursor) | `session-service.ts` |
| 21 | Todo panel (`GET /session/:id/todo` + `todo.updated` SSE) | new `todo-widget.tsx` |
| 22 | Per-session status badge in session list | `sessions-widget.tsx` |
| 23 | Forked session hierarchy display | `sessions-widget.tsx` |
| 24 | `slug` field displayed in session UI | `chat-widget.tsx` / `sessions-widget.tsx` |
| 25 | `summary` stats (additions/deletions) shown | `chat-widget.tsx` |

### Defer (low value or premature)

- Session share / unshare
- `step-start` / `step-finish` part rendering
- `retry` and `subtask` part rendering
- `roots` filter on session list
- VCS branch updates
- Command execution events
- Shell command endpoint
- Part delete / update endpoints
- Prompt async endpoint
- Reconnect jitter
- Session list caching / offline fallback
