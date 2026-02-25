# theia-openspace Session/Chat Gap Analysis

**Date:** 2026-02-24  
**Branch:** feature/session-analysis  
**Sources:** `extensions/openspace-core/src/`, `extensions/openspace-chat/src/`  
**Reference:** `docs/research/2026-02-24-opencode-session-architecture.md`

---

## Overview

theia-openspace implements a 3-layer architecture:

```
OpenCode Server (REST + SSE)
       ↓
  Node: OpenCodeProxy (opencode-proxy.ts)
       ↓ Theia RPC
  Browser: SessionService + OpenCodeSyncService
       ↓
  UI: ChatWidget, SessionsWidget, MessageTimeline
```

For each of the 12 topics below, this document describes what IS implemented, what is MISSING, and any BUGS found.

---

## 1. Session Data Model

### Implemented
- `Session.Info` type imported from `opencode-sdk-types.ts` (full type with id, slug, title, directory, projectID, parentID, time, summary, share, revert, permission)
- Sessions stored in memory in `SessionService.sessions: Session.Info[]`
- Active session ID stored in `localStorage` key `openspace.activeSessionId`

### Missing
- `slug` field is never displayed in UI
- `parentID` not used for any UI hierarchy (forked sessions show as flat list)
- `summary` stats (additions/deletions/files) not displayed
- `share.url` not displayed or made accessible
- `time.archived` not shown; archived sessions not filtered out of list
- `permission` field not inspected or presented

### Bugs
- None known in the data model itself

---

## 2. Session Lifecycle

### Implemented
- Create: `POST /session` via `SessionService.createSession()`
- Get: `GET /session/:id` via `SessionService.loadSession()`
- List: `GET /session` via `SessionService.loadSessions()`
- Update: `PATCH /session/:id` via `SessionService.renameSession()`
- Delete: `DELETE /session/:id` via `SessionService.deleteSession()`
- Abort: `POST /session/:id/abort` via `SessionService.abortSession()`

### Missing
- **Init:** `POST /session/:id/init` — never called; INIT command not supported
- **Fork:** `POST /session/:id/fork` — not implemented; no UI for forking
- **Summarize/Compact:** `POST /session/:id/summarize` — not implemented
- **Share/Unshare:** `POST/DELETE /session/:id/share` — not implemented; no UI
- **Revert/Unrevert:** `POST /session/:id/revert` and `POST /session/:id/unrevert` — not implemented
- **Archive:** `PATCH /session/:id` with `time.archived` — no UI to archive sessions
- **Diff:** `GET /session/:id/diff` — file diffs not displayed anywhere
- **Children:** `GET /session/:id/children` — child sessions (from fork) not shown

---

## 3. Session/Chat View UI

### Implemented
- `ChatWidget` — main chat panel with session header, message timeline, input area
- `SessionsWidget` — sidebar panel listing sessions
- `SessionHeader` — dropdown with session list + new session button
- `MessageTimeline` — message list with scroll-to-bottom, grouping
- `MessageBubble` — individual message with text parts rendered
- `QuestionDock` — blocking question/permission UI

### Missing
- No archived sessions toggle/filter in session list
- No forked session hierarchy UI (parent→child tree)
- No "load more messages" / paginated message loading (all messages loaded at once)
- No session diff viewer
- No todo list panel
- No session sharing UI
- No "compact session" action in UI

---

## 4. Message Routing

### Implemented (Node layer — `opencode-proxy.ts`)
- `message.updated` → fetch authoritative message via `GET /session/:id/message/:msgID`, forward to browser
- `message.part.delta` → append text to in-progress streaming part, forward to browser
- `message.part.updated` → stub (logged but not forwarded)
- `session.created` / `session.updated` / `session.deleted` → forwarded to browser
- `session.status` → forwarded to browser

### Missing
- **`message.removed`** — received from SSE but no action taken (`opencode-proxy.ts` logs only)
- **`message.part.removed`** — received but not acted upon
- **`message.part.updated`** — stubbed; not forwarded to browser (only `message.part.delta` is forwarded for streaming)
- **`session.error`** — falls through to `default` case in the SSE router; not forwarded
- **`session.idle`** — not forwarded (deprecated but still emitted)
- **`session.compacted`** — not handled
- **`todo.updated`** — not handled
- **`command.executed`** — not handled
- **`vcs.branch.updated`** — not handled

### Bugs
- **750ms delta dedup window** (`opencode-proxy.ts`): deduplication logic may drop rapid legitimate delta events that happen to share the same content within the window
- **`session.error` not forwarded**: errors from the model layer are silently discarded

---

## 5. Session Discovery

### Implemented
- `GET /session` called with no filters — returns all sessions for the active directory
- Sessions loaded on startup and on `session.created`/`session.updated`/`session.deleted` events

### Missing
- **Filter by directory** — `directory` query param not used; always uses current project directory
- **Filter by roots** — `roots` param not used
- **Pagination** — `start` and `limit` params not used; no cursor-based pagination for large session lists
- **Search** — `search` param not used; no session search UI

---

## 6. Session Tracking (Status)

### Implemented
- `session.status` SSE event forwarded from proxy to browser
- `SessionService.onSessionStatusChanged` emitter exposes status changes
- `SessionStatus` type imported from `opencode-sdk-types.ts` (idle/busy/retry)
- `isStreaming` flag tracked separately in `SessionService`

### Missing
- **`GET /session/status`** endpoint never called — bulk status for all sessions unavailable at startup
- **Retry state UI**: `{ type: 'retry', attempt, message, next }` — not shown in UI

### Bugs
- `onSessionStatusChanged` emitter is not disposed in `SessionService.dispose()` — minor memory leak

---

## 7. Local Storage

### Implemented
- `localStorage.setItem('openspace.activeSessionId', id)` — persists active session across reloads
- `localStorage.setItem('openspace.activeProjectId', id)` — persists active project

### Missing
- No persistence of session list (always re-fetched from server on load)
- No offline/fallback behaviour when server is unreachable

---

## 8. Server Data / API Calls

### Implemented (complete list)
| Method | Endpoint | Called from |
|---|---|---|
| `GET` | `/session` | `SessionService.loadSessions()` |
| `POST` | `/session` | `SessionService.createSession()` |
| `GET` | `/session/:id` | `SessionService.loadSession()` |
| `PATCH` | `/session/:id` | `SessionService.renameSession()` |
| `DELETE` | `/session/:id` | `SessionService.deleteSession()` |
| `POST` | `/session/:id/abort` | `SessionService.abortSession()` |
| `GET` | `/session/:id/message` | `SessionService.loadMessages()` |
| `POST` | `/session/:id/message` | `SessionService.sendMessage()` |

### Missing / Never Called
| Method | Endpoint | Status |
|---|---|---|
| `POST` | `/session/:id/init` | Not implemented |
| `POST` | `/session/:id/fork` | Not implemented |
| `POST` | `/session/:id/summarize` | Not implemented |
| `POST` | `/session/:id/share` | Not implemented |
| `DELETE` | `/session/:id/share` | Not implemented |
| `GET` | `/session/:id/diff` | Not implemented |
| `POST` | `/session/:id/revert` | Not implemented |
| `POST` | `/session/:id/unrevert` | Not implemented |
| `GET` | `/session/status` | Not implemented |
| `GET` | `/session/:id/children` | Not implemented |
| `GET` | `/session/:id/todo` | Not implemented |
| `POST` | `/session/:id/command` | Not implemented |
| `POST` | `/session/:id/shell` | Not implemented |
| `DELETE` | `/:s/message/:m/part/:p` | Not implemented |
| `PATCH` | `/:s/message/:m/part/:p` | Not implemented |
| `POST` | `/session/:id/prompt_async` | Not implemented |

---

## 9. Status Updates

### Implemented
- `session.status` events update `SessionService._sessionStatus` map
- `onSessionStatusChanged` fires with `{ sessionId, status }` when status changes
- `ChatWidget` shows a spinner/busy indicator based on `isStreaming` flag

### Missing
- Retry countdown not shown in UI (`{ type: 'retry', next: timestamp }`)
- No per-session status badge in session list (`SessionsWidget`)
- No "busy" indicator in session dropdown

---

## 10. Chat / Message Model

### Implemented
- `MessageV2.Info` type imported and used
- User and Assistant messages rendered
- `text` part content rendered in `MessageBubble`
- `tool` part rendered with name (collapsed by default)
- Streaming text accumulation via `message.part.delta`

### Missing
- **`reasoning` parts** not rendered (displayed if model supports extended thinking)
- **`file` parts** not rendered
- **`step-start` / `step-finish` parts** not rendered (could show timing info)
- **`snapshot` / `patch` parts** not acted upon (could show file diff)
- **`agent` parts** not rendered (sub-agent invocations)
- **`retry` parts** not rendered
- **`compaction` parts** not rendered (marks context window truncation point)
- **`subtask` parts** not rendered
- No paginated message loading — `GET /session/:id/message` called with no `limit` param
- Messages with `summary: true` not visually distinguished (compaction summaries)

---

## 11. Session Switching

### Implemented
- `SessionService.setActiveSession(id)` — sets active session, persists to localStorage, loads messages
- `ChatWidget` session dropdown allows clicking any session to switch
- `SessionsWidget` sidebar allows clicking sessions

### Missing
- No session search in dropdown
- No keyboard shortcut for session switching
- No "go to parent session" navigation (for forked sessions)
- Switching does not abort any in-progress prompt in the previous session

---

## 12. Event / Subscription Model

### Implemented (Node layer subscribes to OpenCode SSE)
`opencode-proxy.ts` connects to `GET /event?directory=...` and forwards selected events to browser via Theia RPC notifications.

Forwarded events:
- `session.created`, `session.updated`, `session.deleted`
- `session.status`
- `message.updated`
- `message.part.delta`

### Missing / Not Forwarded
- `session.error` → falls through to default (not forwarded)
- `session.idle` → not forwarded
- `session.compacted` → not handled
- `message.removed` → received, not forwarded
- `message.part.updated` → stubbed, not forwarded
- `message.part.removed` → received, not forwarded
- `todo.updated` → not handled
- `command.executed` → not handled
- `vcs.branch.updated` → not handled

### Bugs
- SSE reconnection uses `EventSource` (browser API) in Node context — `opencode-proxy.ts` actually uses `fetch()` with streaming body read, which works but lacks native reconnect
- Exponential backoff reconnect: 1s → 30s — good, but no jitter
- `getMcpConfig()` uses Node `fs` module with a guard (`typeof window === 'undefined'`) — fragile if bundled differently

---

## Gap Summary Table

| Category | Implemented | Missing | Bugs |
|---|---|---|---|
| Session lifecycle ops | create, get, list, update, delete, abort | init, fork, summarize, share, revert, diff, children | — |
| SSE events handled | 6 of ~13 | session.error, message.removed, message.part.updated, part.removed, todo.updated, command.executed, vcs.branch.updated | session.error silently dropped |
| Message parts rendered | text, tool | reasoning, file, step-start, step-finish, snapshot, patch, agent, retry, compaction, subtask | — |
| Session discovery | basic list | filters, pagination, search | — |
| Session status | idle/busy forwarded | retry UI, bulk status at startup, per-session badge | onSessionStatusChanged not disposed |
| Message pagination | none | load-more, limit param | all messages loaded at once |
| Session features | — | fork, archive, share, compact, revert, diff | — |
