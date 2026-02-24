# OpenCode Session Architecture Analysis

**Date:** 2026-02-24  
**Branch:** feature/session-analysis  
**Sources:** `/Users/Shared/dev/opencode/packages/opencode/src/`

---

## 1. Session Data Model

**File:** `session/session.sql.ts`

```typescript
// SessionTable
{
  id: text (PK),
  project_id: text,
  parent_id: text | null,        // for forked sessions
  slug: text,                    // human-readable identifier
  directory: text,               // working directory
  title: text,
  version: integer,
  share_url: text | null,
  summary_additions: integer,
  summary_deletions: integer,
  summary_files: integer,
  summary_diffs: text (JSON),
  revert: text (JSON),
  permission: text (JSON),
  time_created: integer,
  time_updated: integer,
  time_compacting: integer | null,
  time_archived: integer | null,
}
```

**File:** `session/index.ts` — `Session.Info` type

```typescript
interface Session.Info {
  id: string;
  slug: string;
  projectID: string;
  directory: string;
  parentID?: string;
  title: string;
  version: number;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  summary?: { additions, deletions, files, diffs };
  share?: { url: string };
  revert?: object;
  permission?: object;
}
```

---

## 2. Message / Chat Model

**File:** `session/message-v2.ts`

### MessageV2.Info (union)

```typescript
type MessageV2.Info = MessageV2.User | MessageV2.Assistant

interface MessageV2.User {
  id: string;
  sessionID: string;
  role: 'user';
  time: { created: number };
  agent: string;
  model: { providerID: string; modelID: string };
  format?: string;
  summary?: boolean;
  system?: string;
  tools?: Tool.Info[];
  variant?: string;
}

interface MessageV2.Assistant {
  id: string;
  sessionID: string;
  role: 'assistant';
  time: { created: number; completed?: number };
  error?: AppError;
  parentID: string;       // id of the User message that triggered this
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: string[];
  summary?: boolean;
  cost: number;
  tokens: { input, output, cache_read, cache_write };
  structured?: boolean;
  variant?: string;
  finish?: string;
}
```

### MessageTable (SQL)

```
id, session_id, time_created, data (JSON blob of MessageV2.Info)
```

### PartTable (SQL)

```
id, message_id, session_id, time_created, data (JSON blob of Part)
```

### 12 Part Types

| Type | Key fields |
|---|---|
| `text` | `content: string` |
| `reasoning` | `content: string` |
| `file` | `filename, mediaType, url, content` |
| `tool` | `toolCallId, toolName, state (pending/running/completed/error), input, output` |
| `step-start` | timestamp marker |
| `step-finish` | timestamp marker, usage |
| `snapshot` | editor snapshot data |
| `patch` | file diff / patch data |
| `agent` | sub-agent invocation |
| `retry` | retry metadata |
| `compaction` | summary/compaction marker |
| `subtask` | sub-task reference |

---

## 3. Session Lifecycle

**File:** `session/index.ts`

```
Create → Init (INIT command) → Active/Idle ↔ Busy → Archived/Deleted
                                          ↓
                                     Fork (clone at messageID)
                                          ↓
                                     Child session
```

**Key operations:**
- `Session.create(input)` — creates row, publishes `session.created`
- `Session.init(id)` — runs INIT command
- `Session.fork(id, messageID?)` — clones session, creates child
- `Session.update(id, patch)` — update title, archive
- `Session.delete(id)` — cascade delete children, unshare
- `Session.summarize(id)` — compaction (truncate + summary)
- `Session.share(id)` / `Session.unshare(id)` — cloud sharing
- `Session.revert(id)` / `Session.unrevert(id)` — git revert

---

## 4. Session Status (In-Memory)

**File:** `session/status.ts`

```typescript
type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }
```

- Stored **in-memory only** in `Instance.state()` — not persisted to DB
- Published via Bus as `session.status` event
- Endpoint: `GET /session/status` returns all active statuses

---

## 5. Bus / Event System

**File:** `bus/index.ts`

In-process pub/sub per `Instance`. Events also emitted to `GlobalBus` with `{ directory, payload }` wrapper.

### Session Bus Events

| Event | Payload |
|---|---|
| `session.created` | `Session.Info` |
| `session.updated` | `Session.Info` |
| `session.deleted` | `{ sessionID: string }` |
| `session.diff` | diff data |
| `session.error` | error info |
| `session.status` | `SessionStatus` |
| `session.idle` | _(deprecated, use `session.status`)_ |

### Message Bus Events

| Event | Payload |
|---|---|
| `message.updated` | `MessageV2.Info` |
| `message.removed` | `{ messageID: string }` |
| `message.part.updated` | `Part` (complete replacement) |
| `message.part.delta` | `Part` (incremental delta) |
| `message.part.removed` | `{ partID: string }` |

### Other Notable Events

| Event | Payload |
|---|---|
| `todo.updated` | `TodoItem` |
| `command.executed` | command result |
| `vcs.branch.updated` | branch info |

---

## 6. REST API (Hono server)

**File:** `server/routes/session.ts` (937 lines)

All routes are **directory-scoped** via `x-opencode-directory` header or `?directory=` query param.

### Session CRUD

| Method | Path | Description |
|---|---|---|
| `GET` | `/session` | List sessions (filters: directory, roots, start, search, limit) |
| `POST` | `/session` | Create session |
| `GET` | `/session/:id` | Get session |
| `PATCH` | `/session/:id` | Update (title, time.archived) |
| `DELETE` | `/session/:id` | Delete (cascade) |

### Session Actions

| Method | Path | Description |
|---|---|---|
| `POST` | `/session/:id/init` | Initialize (run INIT command) |
| `POST` | `/session/:id/fork` | Fork at optional messageID |
| `POST` | `/session/:id/abort` | Cancel active prompt |
| `POST` | `/session/:id/share` | Share to cloud |
| `DELETE` | `/session/:id/share` | Unshare |
| `GET` | `/session/:id/diff` | Get file diffs |
| `POST` | `/session/:id/summarize` | Compaction |
| `POST` | `/session/:id/revert` | Revert files |
| `POST` | `/session/:id/unrevert` | Unrevert files |
| `GET` | `/session/status` | All session statuses |
| `GET` | `/session/:id/children` | Child sessions |
| `GET` | `/session/:id/todo` | Session todos |

### Message CRUD

| Method | Path | Description |
|---|---|---|
| `GET` | `/session/:id/message` | List (with limit, pagination) |
| `GET` | `/session/:id/message/:msgID` | Get single |
| `POST` | `/session/:id/message` | Send prompt (streaming response) |
| `POST` | `/session/:id/prompt_async` | Async prompt (returns 204 immediately) |
| `POST` | `/session/:id/command` | Slash command |
| `POST` | `/session/:id/shell` | Shell command |

### Part CRUD

| Method | Path | Description |
|---|---|---|
| `DELETE` | `/:sessionID/message/:msgID/part/:partID` | Delete part |
| `PATCH` | `/:sessionID/message/:msgID/part/:partID` | Update part |

### SSE (Server-Sent Events)

| Method | Path | Description |
|---|---|---|
| `GET` | `/event` | Global SSE stream (`GlobalEvent` objects) |

`GlobalEvent` structure:
```typescript
{ type: string; directory: string; properties: object }
// e.g. { type: "session.status", directory: "/foo", properties: { type: "busy" } }
```

---

## 7. Session Discovery

**File:** `server/routes/session.ts` — `GET /session`

Query parameters:
- `directory` — filter by project directory
- `roots` — filter by root directories (array)
- `start` — cursor-based pagination (timestamp)
- `search` — text search in title/content
- `limit` — max results (default unknown)

Sessions are ordered by `time_updated` descending.

---

## 8. Session Tracking (In-Memory)

**File:** `session/index.ts` — `Instance` class

Each active session has an `Instance` that holds:
- Current `SessionStatus` (idle/busy/retry)
- Active abort controller
- Running prompt future
- Subscription list (for cleanup)

Instances are keyed by session ID in a module-level Map. An `Instance` is created on first use and destroyed when idle (or after timeout?).

---

## 9. Local Storage

**File:** `storage/db.ts`

- SQLite database at `~/.local/share/opencode/opencode.db`
- BunSQLite + Drizzle ORM
- WAL mode enabled
- Schema migrations via Drizzle
- Tables: `SessionTable`, `MessageTable`, `PartTable`, `TodoTable`, `PermissionTable`

**File:** `storage/storage.ts`

- Legacy JSON file storage (being migrated away from)
- Files stored in `~/.local/share/opencode/<project-hash>/`

---

## 10. Session Switching

OpenCode itself is **stateless** with respect to "which session is active". The concept of active session lives entirely in the client (TUI frontend or IDE).

The TUI frontend (`app/src/context/global-sync.tsx`) maintains:
- A per-directory `currentSession` reactive store
- Persisted in browser `localStorage` (TUI uses its own storage)
- Switching = updating `currentSession` + loading messages for new session

---

## 11. Session/Chat View UI (TUI Reference)

**Files:** `app/src/context/global-sync.tsx`, `app/src/context/sync.tsx`

The TUI SolidJS frontend:
- `global-sync.tsx` — Subscribes to `GET /event` SSE, bootstraps per-directory session stores
- `sync.tsx` — Per-directory message/session sync:
  - Optimistic updates: messages appended immediately, then corrected via `message.updated`
  - Paginated loading: 400 messages per page
  - Reactive store: `SessionStore` with `sessions[]`, `messages[]`, `parts{}`

---

## 12. Subscription / Event Model

Consumers subscribe via SSE at `GET /event?directory=<path>`.

Event format:
```json
{ "type": "session.status", "directory": "/my/project", "properties": { "type": "busy" } }
```

The `type` field identifies the event. The `properties` field is the typed payload.

Retry: SSE streams reconnect automatically (HTTP spec). OpenCode client uses manual reconnect with exponential backoff on connection errors.
