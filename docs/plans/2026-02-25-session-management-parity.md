# Session Management Feature Parity: theia-openspace vs opencode
*Code-level analysis · 2026-02-25*

---

## 1. Architecture Comparison

### theia-openspace session stack
```
SessionsWidget (Theia ReactWidget, left panel)
  └─ SessionsView (React FC, ~236 lines)
       ├─ search input (250ms debounce)
       ├─ session list items (active class, forked indentation)
       ├─ session status badge (busy spinner · retry ↺ · yellow dot)
       ├─ archive button per item
       └─ "Load more" pagination

ChatWidget (Theia ReactWidget, right panel)
  └─ ChatComponent (React FC)
       └─ ChatHeaderBar
            ├─ session name dropdown (inline list)
            ├─ status spinner (streaming) / yellow dot (permissions)
            ├─ "New session" button
            └─ "More actions" menu (Fork · Revert · Compact · Delete)

SessionService (openspace-core, single source of truth)
  └─ SessionServiceImpl (~1932 lines)
       ├─ createSession() — hub readiness gating, MCP config injection
       ├─ setActiveSession() — abort controller, model restore, SSE reconnect
       ├─ loadMoreSessions() — workaround for API pagination bug
       ├─ sendMessage() — optimistic update + 5s RPC fallback + 500ms hysteresis
       └─ dispose() — full cleanup of timers, emitters, abort controllers
```

### opencode session stack (Solid.js)
```
SidebarWorkspace (sidebar-workspace.tsx)
  └─ Session list
       ├─ SessionItem (sidebar-items.tsx) — hover card preview, DnD, status dots
       │    ├─ SessionRow — spinner · orange (perms) · red (error) · blue (unseen) · dash
       │    ├─ SessionSkeleton — 4 animate-pulse shimmer bars (loading state)
       │    ├─ HoverCard (1000ms open, 600ms close) — shows message preview
       │    └─ archive button (opacity-0 → group-hover:opacity-100 transition)
       └─ "Load More" (+5 per click)

SessionPage (session.tsx, ~744 lines)
  └─ MessageTimeline (sticky header)
       ├─ h1 title (click → InlineInput edit flow)
       ├─ back button (if parentID)
       ├─ DropdownMenu (Rename · Archive · Delete)
       └─ Scroll-to-bottom button (opacity/translate/scale animation)

SyncContext — optimistic store with binary search
LayoutContext — session UI state: tabs, scroll, review, pendingMessage (50 LRU)
NotificationContext — unseen message counts per session
```

---

## 2. Gap Analysis (Code Level)

### 2.1 Session Item Rendering

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Session title display | `SessionRow` truncated `text-ellipsis` | `session-list-item` with `text-overflow: ellipsis` | ✅ Both |
| Active session highlight | `bg-primary-500/10` active class | `.session-list-item.active` with CSS var | ✅ Both |
| Busy status spinner | spinner icon when `status.type === "busy" \| "retry"` | `●` + `oc-spin` SVG when busy | ✅ Both |
| Retry indicator | spinner (same as busy) | `↺` text glyph | ✅ Both (different glyph) |
| Permissions dot (orange) | orange dot `notification.permission.count > 0` | yellow dot `#cca700` | ✅ Both |
| Error dot (red) | red dot for error state | `.session-status-dot.error` CSS defined | ⚠️ CSS exists but **not wired** to any event |
| **Unseen messages dot (blue)** | blue dot `notification.session.unseenCount > 0` | **absent** | ❌ Missing |
| **Hover preview card** | `HoverCard` (1000ms/600ms) with `MessageNav` | **absent** | ❌ Missing |
| **Diff summary badge** | `+N -M` from `session.summary` | **absent** | ❌ Missing |
| **Skeleton loader** | `SessionSkeleton` — 4 `animate-pulse` shimmer bars | single spinner `isLoading` | ❌ No skeleton |
| **Archive button animation** | `opacity-0 group-hover:opacity-100 transition` | always-visible static button | ❌ No hover animation |
| Parent/child indentation | CSS indentation | `paddingLeft: 24px` for forked | ✅ Both |
| **Parent back-navigation** | `parentID` renders back-button `←` | `data-parent-id` attr set but **no back button** | ❌ Missing |
| **Agent tint color** | reads agent from last user message, applies accent color | **absent** | ❌ Missing |

### 2.2 Session Lifecycle Operations

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Create session | `client.session.create()` | `sessionService.createSession()` + hub gate | ✅ |
| Switch session | Router navigation + `sync.session.get()` | `setActiveSession()` + abort controller + model restore | ✅ |
| Delete session | `client.session.delete()` | `sessionService.deleteSession()` | ✅ |
| Archive session | `client.session.update({time:{archived}})` | `sessionService.archiveSession()` | ✅ |
| Fork session | `client.session.fork()` | `sessionService.forkSession()` | ✅ |
| Revert/unrevert | `client.session.revert/unrevert()` | `sessionService.revertSession/unrevertSession()` | ✅ |
| Compact session | `client.session.summarize()` | `sessionService.compactSession()` | ✅ |
| **Cascade delete** | Builds parent→children map, DFS traversal deletes descendants | Deletes only the single session | ❌ Missing |
| **Inline title editing** | `title:{draft,editing,saving}` state + `InlineInput` + `sdk.session.update({title})` | **absent** (issue #10) | ❌ Missing |
| **Fork dialog (select messages)** | `<DialogFork>` lets user choose which messages to include | Forks entire session with no UI | ❌ No dialog |
| Share session | `client.session.share()` + copy URL + 3s feedback | API methods exist, **no UI** | ❌ No UI |
| Unshare session | `client.session.unshare()` | API method exists, **no UI** | ❌ No UI |
| **Session undo** | revert to last user message + restore prompt | revert available but no keybind/prompt restore | ❌ No undo UX |
| **Worktree session** | `newSessionWorktree: "main" \| "create"` fork-based create | always creates in default worktree | ❌ Missing |

### 2.3 Title Editing

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| **Click to edit** | `h1` → `InlineInput` with `requestAnimationFrame(focus)` | **absent** | ❌ |
| **Save on Enter** | `onKeyDown` Enter → `saveTitleEditor()` | **absent** | ❌ |
| **Cancel on Escape** | `onKeyDown` Escape → `closeTitleEditor()` | **absent** | ❌ |
| **Optimistic title update** | `sync.set(produce(s => s.session[idx].title = next))` | **absent** | ❌ |
| **Saving indicator** | `disabled` during save, `saving` state | **absent** | ❌ |
| **Rename via menu** | DropdownMenu "Rename" sets `pendingRename = true` then opens editor | **absent** | ❌ |

### 2.4 Session List Animations & Visual Polish

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| **Skeleton loading state** | `SessionSkeleton` — 4 `animate-pulse` shimmer bars | `isLoading && <div className="sessions-loading">` spinner | ❌ No shimmer |
| **Archive button reveal** | `opacity-0 group-hover:opacity-100 transition-opacity` | archive button always visible | ❌ No animation |
| **Scroll-to-bottom animation** | `opacity/translate/scale` transitions on resume button | jump-cut appearance | ❌ No animation |
| CSS enter/exit transitions | CSS transition on session items | no item-level transitions | ❌ Missing |
| **Pending rename state** | blur-then-reopen pattern avoids flickering | N/A | N/A |

### 2.5 Persistence & State Per Session

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| **Per-session UI state LRU cache** | `LayoutContext.sessionView` (50 sessions, scroll/tabs/review) | **absent** | ❌ Missing |
| **Per-session tab state** | `SessionTabs {active, all}` per session, restored on switch | **absent** | ❌ Missing |
| **Per-session scroll position** | `SessionView.scroll` per-tab, 250ms debounce, restored on mount | **absent** | ❌ Missing |
| **Prompt autosave per session** | `PromptContext` 20-session LRU | **absent** | (tracked in chat plan P1-C) |
| **Pending message navigation** | `pendingMessage + pendingMessageAt (2min TTL)` | **absent** | ❌ Missing |
| **Tab handoff between nav** | `TabHandoff {dir,id,at}` 60s TTL, restores tabs on session nav | **absent** | ❌ Missing |
| localStorage (project/session IDs) | routing-based | ✅ `openspace.activeProjectId/SessionId` | ✅ |

### 2.6 Notification & Unseen Tracking

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| **Unseen message count per session** | `NotificationContext.session.unseenCount(sessionID)` | **absent** | ❌ Missing |
| **Blue dot for unseen** | blue dot on `SessionRow` | **absent** | ❌ Missing |
| **Turn complete notification** | `TurnCompleteNotification` on session done | **absent** | ❌ (chat gap P2-C) |
| **Error notification** | `ErrorNotification` with sound | **absent** | ❌ (chat gap P2-C) |

### 2.7 Keyboard Shortcuts

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| New session | `Mod+Shift+S` | **absent** | ❌ |
| Message navigation | `Mod+↑/↓` | **absent** | ❌ (chat plan P3-C) |
| Session undo/redo | `Ctrl+Z / Ctrl+Y` equivalent | **absent** | ❌ |
| Toggle review panel | `Mod+Shift+R` | **absent** | ❌ |
| Toggle file tree | `Ctrl+\` | Theia native | ✅ |
| Toggle terminal | `Ctrl+\`` | Theia native | ✅ |

### 2.8 Pagination & Virtual Scrolling

| Feature | opencode reference | theia-openspace | Gap |
|---|---|---|---|
| Sessions: load more | `+5 per click` via `setLimit()` | ✅ 20 + PAGE_SIZE increment, workaround for API bug | ✅ |
| Messages: load older | `messagePageSize=400` pagination | ✅ `loadOlderMessages()` | ✅ |
| **Virtual message rendering** | `turnInit=20, turnBatch=20, requestIdleCallback` | renders ALL messages (no virtualization) | ❌ No virtual scroll |
| **Prefetch on hover** | 200ms delay `prefetchSession()` | **absent** | ❌ Missing |

---

## 3. What's Already Well-Implemented (No Action Needed)

The following opencode features are fully implemented in theia-openspace:

- Session CRUD (create / switch / delete / archive / fork / revert / compact)
- Auto project selection by workspace path with `initProject()` fallback
- Abort controller for stale session loads (race condition prevention)
- Hub readiness gating before session creation
- Model restoration from session on switch (reads last assistant message)
- MCP config loading from `opencode.json`
- Streaming status with 2500ms debounce (prevents tool-transition flicker)
- 500ms hysteresis timer on streaming done (prevents back-to-back flicker)
- 5s RPC fallback timer for SSE disconnections
- Optimistic message inserts with SSE as authoritative channel
- Loading counter for nested operations (not boolean)
- Session status events (busy/idle/retry) per session via Map
- `loadMoreSessions()` with client-side pagination workaround
- `loadOlderMessages()` with 400-message pages
- `searchSessions()` wrapper
- `clearStreamingPartText()` before SSE reconnect (prevents N× duplication)
- SSE reconnect on session switch to correct directory
- Pending question/permission management
- Todo tracking

---

## 4. Implementation Plan

### Sprint 1 — P1: High Impact, Self-Contained

---

#### S1-A: Inline Session Title Editing
**Effort:** Medium (4–6 hours)
**Issue:** #10

**What:** Click session name in chat header to rename it inline. Enter to save, Escape to cancel.

**Where to implement:**

1. **`opencode-protocol.ts`** — add `renameSession(projectId, sessionId, title): Promise<Session>` to `OpenCodeService` interface

2. **`opencode-proxy.ts`** — implement: `PATCH /session/{id}` with body `{ title }` (same endpoint as archiveSession but different field)

3. **`session-service.ts`** — add `renameSession(title): Promise<void>` delegating to proxy; fires `onActiveSessionChangedEmitter` after with updated session

4. **`chat-widget.tsx:ChatHeaderBar`** — add `title: {draft: string, editing: boolean, saving: boolean}` local state; render `<input>` when `editing`, `<span>` when not; on-click sets `editing=true`

5. **`sessions-widget.tsx:SessionsView`** — add same edit flow on session item double-click (optional; header is primary)

**CSS needed:** `.session-title-input` — matches existing `chat-header-title` width, no border, transparent background, same font

---

#### S1-B: Skeleton Loader for Session List
**Effort:** Small (2–3 hours)
**Issue:** #9 (partial)

**What:** Replace loading spinner with shimmer skeleton bars while sessions load.

**Where to implement:**

1. New component in `sessions-widget.tsx`:
   ```tsx
   function SessionSkeleton() {
     return <div className="sessions-skeleton">
       {[80, 60, 75, 50].map(w => (
         <div className="session-skeleton-item" style={{ width: `${w}%` }} />
       ))}
     </div>;
   }
   ```

2. **`sessions-widget.tsx`** — replace `isLoading && <div className="sessions-loading">` with `<SessionSkeleton />`

3. **CSS** in `sessions-widget.css` (or merged into `chat-widget.css`):
   ```css
   @keyframes shimmer {
     0%   { background-position: -200% center; }
     100% { background-position:  200% center; }
   }
   .session-skeleton-item {
     height: 14px;
     border-radius: 4px;
     background: linear-gradient(90deg,
       var(--oc-bg-hover) 25%, var(--oc-bg-active) 50%, var(--oc-bg-hover) 75%);
     background-size: 200% 100%;
     animation: shimmer 1.4s ease infinite;
     margin: 6px 12px;
   }
   ```

---

#### S1-C: Archive Button Hover Animation
**Effort:** Small (1 hour)
**Issue:** #9 (partial)

**What:** Archive button on session items fades in only on row hover, matching opencode's `opacity-0 group-hover:opacity-100`.

**Where to implement:**

CSS in `chat-widget.css` / `sessions-widget.css`:
```css
.session-list-item .session-archive-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.session-list-item:hover .session-archive-btn {
  opacity: 1;
}
/* Always visible on active/focus for keyboard users */
.session-list-item.active .session-archive-btn,
.session-list-item:focus-within .session-archive-btn {
  opacity: 1;
}
```

---

#### S1-D: Parent Session Back-Navigation
**Effort:** Small (2 hours)

**What:** When viewing a forked session, show `←` back button that navigates to parent session.

**Where to implement:**

1. **`chat-widget.tsx:ChatHeaderBar`** — check `activeSession.parentID`; render `<button className="back-to-parent">←</button>` before session name if present

2. **Callback:** `onNavigateToParent` prop → `handleSessionSwitch(activeSession.parentID)`

3. **CSS:** `.back-to-parent` — small icon-only button, `opacity: 0.7`, hover `opacity: 1`

---

#### S1-E: Cascade Delete for Sessions with Children
**Effort:** Small (2–3 hours)

**What:** When deleting a session that has forked children, delete descendants too (currently only deletes one session).

**Where to implement:**

1. **`session-service.ts:deleteSession()`** — before calling proxy:
   ```typescript
   // Find all sessions in current list with parentID === sessionId (recursive)
   function findDescendants(sessions: Session[], rootId: string): string[] {
     const children = sessions.filter(s => s.parentID === rootId).map(s => s.id);
     return [...children, ...children.flatMap(c => findDescendants(sessions, c))];
   }
   const toDelete = [sessionId, ...findDescendants(currentSessions, sessionId)];
   await Promise.all(toDelete.map(id => openCodeService.deleteSession(projectId, id)));
   ```

2. **`sessions-widget.tsx`** — update confirmation message: "Delete session and N child sessions?"

---

### Sprint 2 — P2: Medium Effort

---

#### S2-A: Status Dot Error State Wiring
**Effort:** Small (1 hour)

**What:** The CSS for `.session-status-dot.error` (red) is defined but never rendered. Wire it up.

**Where:**
- `sessions-widget.tsx:SessionStatusBadge()` — add `status.type === 'error'` branch rendering red dot
- `chat-widget.tsx:ChatHeaderBar` dropdown — same for the dropdown list items
- Need to check what `SDKTypes.SessionStatus` error variant looks like; the protocol type has `'error_occurred'` in `SessionEventType`

---

#### S2-B: Session Diff Summary Badge
**Effort:** Small (2 hours)
**Cross-reference:** chat plan P2-E

**What:** Show `+42 -7` summary badge on each session list item.

**Where:**
- `sessions-widget.tsx:SessionsView` render — check `session.summary?.{additions, deletions}`; render small `<span className="session-diff-badge">+{n} -{m}</span>` to the right of timestamp
- CSS: dim color, monospace font, `font-size: 11px`

---

#### S2-C: Session Rename via Sessions Panel (Double-Click)
**Effort:** Small (2 hours, depends on S1-A)

**What:** Double-click on a session item in the left sessions panel to rename it inline.

**Where:**
- `sessions-widget.tsx` — add `editingId: string | undefined` + `editDraft: string` state per item; `onDoubleClick` toggles edit mode; Enter/Escape handle save/cancel
- Calls `sessionService.renameSession()` from S1-A

---

#### S2-D: Session Share UI
**Effort:** Medium (4 hours)

**What:** Add Share button to the "More actions" menu in `ChatHeaderBar`, copying the share URL to clipboard.

**Where:**
- `chat-widget.tsx:ChatHeaderBar` — add "Share" action; if `activeSession.share?.url` → copy to clipboard with 2s "Copied!" feedback; else call `openCodeService.shareSession()` then copy
- Add "Unshare" action when `session.share?.url` exists
- Display share URL below session name when shared (with copy icon)

---

#### S2-E: Keyboard Shortcuts for Session Operations
**Effort:** Medium (3–4 hours)

**What:** Add `Mod+Shift+S` for new session and `Mod+Shift+N` for rename.

**Where:**
- `chat-view-contribution.ts` — register keybindings:
  ```typescript
  { command: 'openspace.session.new', keybinding: 'ctrlcmd+shift+s' }
  { command: 'openspace.session.rename', keybinding: 'ctrlcmd+shift+n' }
  ```
- New commands: `openspace.session.new` → `sessionService.createSession()`, `openspace.session.rename` → trigger inline edit

---

### Sprint 3 — P3: Larger Features

---

#### S3-A: Hover Preview Card
**Effort:** Large (1–2 days)

**What:** Hovering over a session item for 1 second shows a popover with the last few messages.

**Where:**
- New component `session-hover-preview.tsx` — shows last 3 user messages as plain text
- `sessions-widget.tsx:SessionsView` session items — `onMouseEnter` with 1000ms delay, `onMouseLeave` to cancel; renders `<SessionHoverPreview sessionId={id} />`
- Data: call `sessionService.getMessagesForPreview(sessionId)` — new lightweight method fetching last 5 messages

---

#### S3-B: Unseen Message Tracking
**Effort:** Large (1–2 days)

**What:** Track which sessions have new messages since user last viewed them; show blue dot.

**Where:**
- New: `openspace-core/src/browser/notification-service.ts` — `NotificationService` tracking seen/unseen counts per session:
  ```typescript
  interface SessionNotificationService {
    getUnseenCount(sessionId: string): number;
    markSeen(sessionId: string): void;
    onUnseenChanged: Event<void>;
  }
  ```
- Implementation: compares last-seen `messageId` (persisted in localStorage) vs current `messages.length`
- `session-service.ts` — on `appendMessage()`, if not active session → increment unseen counter
- `sessions-widget.tsx:SessionStatusBadge` — add blue dot branch
- On `setActiveSession()` → `notificationService.markSeen(sessionId)`

---

#### S3-C: Per-Session UI State Persistence
**Effort:** Large (2–3 days)
**Cross-reference:** chat plan P3-D

**What:** Persist and restore scroll position when returning to a previously viewed session.

**Where:**
- New: `openspace-chat/src/browser/session-view-store.ts` — 50-entry LRU mapping `sessionId → {scrollTop, lastMessageId}`:
  ```typescript
  interface SessionViewState {
    scrollTop: number;
    lastMessageId?: string;
  }
  ```
- `message-timeline.tsx` — save `containerRef.scrollTop` on scroll with 250ms debounce; restore on `sessionId` prop change after next paint
- `chat-widget.tsx` — inject `SessionViewStore`, pass `sessionId` to `MessageTimeline`

---

## 5. Summary Table

| ID | Feature | Files | Effort | Priority |
|---|---|---|---|---|
| S1-A | Inline session title editing | `opencode-protocol.ts`, `opencode-proxy.ts`, `session-service.ts`, `chat-widget.tsx` | M | 🔴 S1 |
| S1-B | Skeleton loader for session list | `sessions-widget.tsx`, CSS | S | 🔴 S1 |
| S1-C | Archive button hover animation | CSS only | S | 🔴 S1 |
| S1-D | Parent session back-navigation | `chat-widget.tsx:ChatHeaderBar` | S | 🔴 S1 |
| S1-E | Cascade delete for child sessions | `session-service.ts` | S | 🔴 S1 |
| S2-A | Error dot wiring | `sessions-widget.tsx`, `chat-widget.tsx` | S | 🟡 S2 |
| S2-B | Session diff summary badge | `sessions-widget.tsx`, CSS | S | 🟡 S2 |
| S2-C | Double-click rename in sessions panel | `sessions-widget.tsx` | S | 🟡 S2 |
| S2-D | Session share UI | `chat-widget.tsx:ChatHeaderBar` | M | 🟡 S2 |
| S2-E | Keyboard shortcuts for session ops | `chat-view-contribution.ts` | M | 🟡 S2 |
| S3-A | Hover preview card | new `session-hover-preview.tsx` | L | 🟢 S3 |
| S3-B | Unseen message tracking + blue dot | new `notification-service.ts` | L | 🟢 S3 |
| S3-C | Per-session scroll persistence | new `session-view-store.ts`, `message-timeline.tsx` | L | 🟢 S3 |

*S = small (<4h), M = medium (4–8h), L = large (1–3 days)*
