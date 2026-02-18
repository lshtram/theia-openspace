---
id: REQ-SESSION-LIST-AUTOLOAD
author: analyst_f4a3
status: DRAFT
priority: HIGH
phase: Phase 2 (Chat & Prompt System)
task_id: 2.0
date: 2026-02-17
---

# REQ-SESSION-LIST-AUTOLOAD

## Overview

When the Chat Widget opens, existing sessions should be visible immediately in the session dropdown alongside the "+ New Session" button. Currently, the session list appears empty on initial load due to a race condition between widget mount and SessionService initialization, requiring users to manually trigger a refresh to see their sessions.

This is a **UX blocker** that creates a broken first-run experience and violates user expectations for stateful UI components.

---

## Problem Statement

### Current Behavior
1. User opens Chat Widget (first time in session or after reload)
2. SessionService is still restoring project/session from localStorage (async initialization)
3. ChatWidget calls `SessionService.getSessions()` during mount
4. `getSessions()` returns empty array `[]` because `_activeProject` is not yet loaded
5. UI displays only "+ New Session" button, no existing sessions visible
6. **Sessions only appear after manual action** (creating new session, switching tabs, etc.)

### Root Cause
**Race condition between two async operations:**

1. **ChatWidget mount** → `useEffect` → `loadSessions()` → `SessionService.getSessions()`
2. **SessionService.init()** → async restore project from localStorage → `setActiveProject()`

These operations run in parallel. ChatWidget assumes SessionService is fully initialized at mount time, but `@postConstruct()` initialization is not synchronous with DI container resolution.

**Missing subscription:** ChatWidget subscribes to `onActiveSessionChanged` but NOT `onActiveProjectChanged`. When project loads after initial mount, no re-fetch is triggered.

### Impact
- **High severity UX issue**: Users cannot see or access existing sessions without workaround
- **Perception of data loss**: UI appears empty even when sessions exist in backend
- **Workaround required**: Users must create a new session or reload UI to trigger refresh
- **Breaks session continuity**: Last active session should be restored automatically (Phase 1B1 requirement), but user sees empty state first

---

## User Stories

### US-1: Session List Visible on Widget Open
**As a** Theia Openspace user  
**I want** to see all my existing sessions immediately when I open the Chat Widget  
**So that** I can quickly switch to a previous conversation without manual intervention

**Acceptance Criteria:**
- [ ] Opening Chat Widget displays session list within 500ms if sessions exist
- [ ] If 0 sessions exist, only "+ New Session" button is shown (expected behavior)
- [ ] If 1+ sessions exist, session dropdown shows all sessions with correct titles
- [ ] Loading state (spinner/skeleton) is displayed while sessions are being fetched
- [ ] Error state is displayed if session fetch fails, with retry option

### US-2: Active Session Restored on Startup
**As a** Theia Openspace user  
**I want** my last active session to be automatically selected when I restart the IDE  
**So that** I can continue my work without losing context

**Acceptance Criteria:**
- [ ] Last active session ID is restored from localStorage
- [ ] Session list loads before attempting to restore active session
- [ ] If restored session ID is invalid, user sees clear error message
- [ ] Message history is loaded automatically after session restore

### US-3: Graceful Error Handling
**As a** Theia Openspace user  
**I want** clear error messages if sessions fail to load  
**So that** I understand what went wrong and how to fix it

**Acceptance Criteria:**
- [ ] Network errors show "Failed to load sessions. Retry?" message
- [ ] Missing project shows "No project selected. Please open a project." message
- [ ] Backend errors show "Session service unavailable. Check OpenCode server." message
- [ ] All error states include retry button or corrective action

---

## Functional Requirements

### FR-1: Synchronization on Project Load
**Requirement:** ChatWidget MUST subscribe to `SessionService.onActiveProjectChanged` event and reload sessions when project changes.

**Rationale:** Project is a prerequisite for sessions. When project loads (including during startup), session list must refresh.

**Implementation Notes:**
- Add event listener in `ChatComponent` useEffect (around line 123)
- Call `loadSessions()` when `onActiveProjectChanged` fires
- Ensure event listener is cleaned up in useEffect return

### FR-2: Loading State UI
**Requirement:** ChatWidget MUST display a loading indicator while sessions are being fetched.

**Rationale:** Without visual feedback, users perceive the UI as broken or unresponsive.

**Implementation Notes:**
- Add `isLoadingSessions` state variable in ChatComponent
- Set to `true` before calling `loadSessions()`
- Set to `false` after `getSessions()` completes or errors
- Display spinner or skeleton UI in session dropdown when loading

### FR-3: Empty State Differentiation
**Requirement:** ChatWidget MUST distinguish between "loading sessions" and "no sessions exist" states.

**Rationale:** Users need to understand whether the system is working or if there's genuinely no data.

**Visual Design:**
- **Loading state**: Spinner icon + "Loading sessions..." text
- **Empty state**: Info icon + "No sessions. Create one to start." text
- **Error state**: Error icon + Error message + "Retry" button

### FR-4: Error Recovery
**Requirement:** ChatWidget MUST provide retry mechanism for failed session loads.

**Rationale:** Transient network errors should not require full page reload.

**Implementation Notes:**
- Catch errors in `loadSessions()` and store in `loadError` state
- Display error message with "Retry" button
- Retry button calls `loadSessions()` again
- Clear error state on successful load

### FR-5: Race Condition Prevention
**Requirement:** SessionService initialization MUST complete before ChatWidget can query sessions.

**Options for Implementation:**
1. **Option A (Recommended)**: Add `SessionService.onReady` event that fires after init completes
   - ChatWidget waits for this event before initial `loadSessions()`
   - Pro: Explicit contract, easy to test
   - Con: Requires SessionService changes
   
2. **Option B**: Make SessionService emit `onActiveProjectChanged` during init
   - ChatWidget subscribes and reloads on this event
   - Pro: Reuses existing event
   - Con: Event fires even if project didn't change
   
3. **Option C**: ChatWidget polls SessionService until project loads
   - Use `setInterval` to check `sessionService.activeProject !== undefined`
   - Pro: No SessionService changes needed
   - Con: Inefficient, adds latency

**Decision Required:** Oracle must choose option during technical design phase.

---

## Non-Functional Requirements

### NFR-1: Performance
- Session list MUST load within **500ms** of project initialization on typical networks
- UI MUST remain responsive during session loading (no blocking operations)
- Session list fetch MUST be cancellable if widget unmounts before completion

### NFR-2: Reliability
- Session list MUST handle backend unavailability gracefully (no crashes)
- Duplicate session fetch requests MUST be deduplicated (prevent race conditions)
- Session list MUST recover automatically if OpenCode server reconnects

### NFR-3: User Experience
- Loading state MUST be visually distinct from empty state
- Error messages MUST be actionable (tell user what to do next)
- Session list MUST preserve scroll position when refreshing

### NFR-4: Testability
- Session loading logic MUST be unit-testable in isolation
- Race condition MUST be reproducible in E2E tests (slow network simulation)
- All error states MUST be testable via mock API failures

---

## Acceptance Criteria

### AC-1: Happy Path (1+ Sessions Exist)
**Given** the ChatWidget is mounted for the first time  
**And** the user has 3 existing sessions in the backend  
**When** SessionService completes initialization  
**Then** the session dropdown displays all 3 sessions with correct titles  
**And** the loading indicator disappears  
**And** the total time from mount to display is < 500ms

### AC-2: Empty State (0 Sessions Exist)
**Given** the ChatWidget is mounted  
**And** the user has 0 sessions in the backend  
**When** SessionService completes initialization  
**Then** the session dropdown shows "No sessions" message  
**And** only the "+ New Session" button is enabled  
**And** no loading indicator is visible

### AC-3: Error State (Backend Unavailable)
**Given** the ChatWidget is mounted  
**And** the OpenCode server is unreachable  
**When** SessionService attempts to fetch sessions  
**Then** an error message is displayed: "Failed to load sessions. Retry?"  
**And** a "Retry" button is visible  
**And** clicking "Retry" attempts to reload sessions

### AC-4: Race Condition Prevention
**Given** SessionService is still initializing (project not loaded)  
**And** ChatWidget mounts and calls `loadSessions()`  
**When** `getSessions()` returns empty array due to no active project  
**Then** ChatWidget subscribes to `onActiveProjectChanged`  
**And** when project loads, ChatWidget automatically retries `loadSessions()`  
**And** session list populates without user intervention

### AC-5: Loading State Visibility
**Given** the ChatWidget is mounted  
**When** `loadSessions()` is called  
**Then** a loading spinner appears in the session dropdown  
**And** the spinner disappears after sessions load or error occurs  
**And** the spinner is visible for at least 100ms (prevents flicker on fast networks)

### AC-6: Session Restoration
**Given** the user had session ID "abc123" active in their last IDE session  
**And** localStorage contains `openspace.activeSessionId = "abc123"`  
**When** SessionService initializes  
**Then** session list loads BEFORE attempting to restore active session  
**And** session "abc123" is set as active  
**And** message history is loaded for session "abc123"  
**And** ChatWidget displays the restored session without empty state flash

---

## Scope

### In Scope
- Fix race condition between ChatWidget mount and SessionService init
- Add loading, empty, and error state UI to session dropdown
- Subscribe ChatWidget to `onActiveProjectChanged` event
- Add retry mechanism for failed session loads
- Ensure session list loads before active session restoration
- Update unit tests for ChatComponent session loading logic
- Add E2E test for session list auto-load on widget open

### Out of Scope
- Session list caching or offline support (Phase 3 concern)
- Session search/filter functionality (not in Phase 2 scope)
- Session list pagination (not needed for MVP)
- Session rename/edit functionality (separate task)
- Performance optimization beyond 500ms target (premature for MVP)

---

## Technical Analysis

### Files to Modify

#### 1. `extensions/openspace-chat/src/browser/chat-widget.tsx`
**Changes Required:**
- Add `isLoadingSessions` state variable
- Add `sessionLoadError` state variable
- Subscribe to `SessionService.onActiveProjectChanged` in useEffect
- Add error handling in `loadSessions()` callback
- Update SessionHeader to display loading/error/empty states
- Add minimum display time for loading spinner (prevent flicker)

**Estimated Lines Changed:** ~50 lines (additions + UI updates)

#### 2. `extensions/openspace-core/src/browser/session-service.ts`
**Changes Required (Optional - depends on solution chosen):**
- **If Option A chosen**: Add `onReadyEmitter` and fire after init completes
- **If Option B chosen**: Ensure `onActiveProjectChanged` fires during init
- **If Option C chosen**: No changes needed

**Estimated Lines Changed:** ~10-20 lines (if Option A or B chosen)

### Proposed Solution (Recommendation)

**Primary Fix: Subscribe to Project Changes**

```typescript
// In ChatComponent useEffect (chat-widget.tsx, line 88)
React.useEffect(() => {
    // Initial data
    setMessages([...sessionService.messages]);
    loadSessions();

    // Subscribe to message changes
    const messagesDisposable = sessionService.onMessagesChanged(msgs => {
        setMessages([...msgs]);
    });

    // Subscribe to streaming updates
    const streamingDisposable = sessionService.onMessageStreaming((update: StreamingUpdate) => {
        // ... existing code ...
    });

    // Subscribe to streaming state
    const streamingStateDisposable = sessionService.onIsStreamingChanged(streaming => {
        setIsStreaming(streaming);
    });

    // Subscribe to session changes to reload list
    const sessionChangedDisposable = sessionService.onActiveSessionChanged(() => {
        loadSessions();
    });

    // ✅ NEW: Subscribe to project changes to reload list
    const projectChangedDisposable = sessionService.onActiveProjectChanged(() => {
        loadSessions();
    });

    // Store disposables for cleanup
    disposablesRef.current = [
        messagesDisposable,
        streamingDisposable,
        streamingStateDisposable,
        sessionChangedDisposable,
        projectChangedDisposable  // ✅ NEW
    ];

    return () => {
        disposablesRef.current.forEach(d => { d.dispose(); });
        disposablesRef.current = [];
    };
}, [sessionService, loadSessions]);
```

**Secondary Fix: Add Loading State UI**

```typescript
// Add state variables
const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
const [sessionLoadError, setSessionLoadError] = React.useState<string | undefined>();

// Update loadSessions callback
const loadSessions = React.useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionLoadError(undefined);
    try {
        const sessions = await sessionService.getSessions();
        setSessions(sessions);
    } catch (error) {
        console.error('[ChatWidget] Error loading sessions:', error);
        setSessionLoadError(error instanceof Error ? error.message : String(error));
    } finally {
        // Minimum display time to prevent flicker
        setTimeout(() => setIsLoadingSessions(false), 100);
    }
}, [sessionService]);
```

**Tertiary Fix: Update SessionHeader UI**

```typescript
// In session dropdown (chat-widget.tsx, line 267)
{showSessionList && (
    <div className="session-list-dropdown">
        {isLoadingSessions && (
            <div className="session-list-loading">
                <span className="spinner">⏳</span> Loading sessions...
            </div>
        )}
        {sessionLoadError && (
            <div className="session-list-error">
                <span className="error-icon">⚠️</span> {sessionLoadError}
                <button onClick={loadSessions}>Retry</button>
            </div>
        )}
        {!isLoadingSessions && !sessionLoadError && sessions.length === 0 && (
            <div className="session-list-empty">No sessions. Create one to start.</div>
        )}
        {!isLoadingSessions && !sessionLoadError && sessions.map(session => (
            <div key={session.id} className="session-list-item" /* ... */ >
                {session.title}
            </div>
        ))}
    </div>
)}
```

### Alternative Solutions Considered

#### Alternative 1: Eager Loading in SessionService
**Approach:** Make SessionService pre-fetch sessions during init, cache them, and emit event when ready.

**Pros:**
- Single source of truth for session list
- Reduces network calls (cache reuse)
- Better separation of concerns

**Cons:**
- More complex SessionService logic
- Requires cache invalidation strategy
- May fetch sessions unnecessarily if ChatWidget never opens

**Verdict:** Over-engineered for Phase 2. Consider for Phase 3 offline support.

#### Alternative 2: Render-Blocking Initialization
**Approach:** Don't render ChatWidget until SessionService.init() completes.

**Pros:**
- Eliminates race condition entirely
- Simpler widget logic

**Cons:**
- Delays initial render (poor perceived performance)
- Violates progressive enhancement principles
- Blocks entire widget even if only session list is slow

**Verdict:** Rejected. UX regression.

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Race condition still occurs on slow networks** | High | Medium | Add E2E test with throttled network (Slow 3G profile) to verify fix |
| **SessionService.onActiveProjectChanged never fires** | High | Low | Add unit test to verify event fires after init() completes |
| **Loading spinner flickers on fast networks** | Low | High | Add minimum display time (100ms) to prevent sub-frame flash |
| **Error state doesn't handle backend restart** | Medium | Medium | Subscribe to backend health check events, auto-retry on reconnect |
| **Multiple rapid project changes cause duplicate fetches** | Low | Low | Debounce loadSessions() calls (300ms delay) |
| **SessionService.getSessions() throws instead of returning []** | High | Low | Add try-catch in loadSessions(), convert exceptions to error state |

---

## Dependencies

### Upstream Dependencies
- **SessionService.onActiveProjectChanged event** (already exists, line 115 in session-service.ts)
- **SessionService.getSessions() RPC method** (already exists, line 543 in session-service.ts)
- **OpenCodeService.getSessions() backend API** (already implemented in Phase 1B1)

### Downstream Dependencies
- **Phase 2 Task 2.1 (Session Management)**: May add session rename/archive features that require list refresh
- **Phase 2 Task 2.2 (Multi-Agent Prompt System)**: May add agent-specific session filtering
- **Phase 3 Task 3.3 (Offline Mode)**: Will add session list caching and sync logic

### Blocking Issues
- None. All required APIs and events already exist.

---

## Test Strategy

### Unit Tests

#### Test: ChatComponent loads sessions on mount
```typescript
it('should load sessions when component mounts', async () => {
    const mockSessionService = createMockSessionService({
        activeProject: { id: 'proj1', name: 'Test Project' },
        sessions: [
            { id: 'sess1', title: 'Session 1' },
            { id: 'sess2', title: 'Session 2' }
        ]
    });

    render(<ChatComponent sessionService={mockSessionService} />);

    await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
        expect(screen.getByText('Session 2')).toBeInTheDocument();
    });
});
```

#### Test: ChatComponent reloads sessions when project changes
```typescript
it('should reload sessions when project changes', async () => {
    const mockSessionService = createMockSessionService({
        activeProject: undefined,  // No project initially
        sessions: []
    });

    render(<ChatComponent sessionService={mockSessionService} />);

    // Initially no sessions
    expect(screen.queryByText('Session 1')).not.toBeInTheDocument();

    // Simulate project load
    act(() => {
        mockSessionService.setActiveProject({ id: 'proj1', name: 'Test Project' });
        mockSessionService.fireActiveProjectChanged();
    });

    // Sessions should now load
    await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
    });
});
```

#### Test: ChatComponent displays loading state
```typescript
it('should show loading indicator while fetching sessions', async () => {
    const mockSessionService = createMockSessionService({
        getSessions: () => new Promise(resolve => setTimeout(resolve, 1000))  // Slow
    });

    render(<ChatComponent sessionService={mockSessionService} />);

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
});
```

#### Test: ChatComponent displays error state with retry
```typescript
it('should show error message and retry button on fetch failure', async () => {
    const mockSessionService = createMockSessionService({
        getSessions: () => Promise.reject(new Error('Network error'))
    });

    render(<ChatComponent sessionService={mockSessionService} />);

    await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Click retry
    fireEvent.click(screen.getByText('Retry'));

    // Should attempt reload
    expect(mockSessionService.getSessions).toHaveBeenCalledTimes(2);
});
```

### E2E Tests

#### Test: Session list visible on widget open (Playwright)
```typescript
test('session list auto-loads when chat widget opens', async ({ page }) => {
    // Setup: Create 2 sessions in backend
    await createSession('Session 1');
    await createSession('Session 2');

    // Action: Open Theia, open Chat Widget
    await page.goto('http://localhost:3000');
    await page.click('[title="Chat"]');

    // Assert: Sessions visible within 500ms
    await expect(page.locator('.session-list-item')).toHaveCount(2, { timeout: 500 });
    await expect(page.locator('text=Session 1')).toBeVisible();
    await expect(page.locator('text=Session 2')).toBeVisible();
});
```

#### Test: Race condition handled gracefully (Playwright with network throttling)
```typescript
test('session list loads after slow project initialization', async ({ page, context }) => {
    // Simulate slow network (Slow 3G)
    await context.route('**/api/projects/**', route => {
        setTimeout(() => route.continue(), 2000);  // 2s delay
    });

    // Setup: Create session in backend
    await createSession('Test Session');

    // Action: Open Theia
    await page.goto('http://localhost:3000');

    // Assert: Loading state visible initially
    await expect(page.locator('text=Loading sessions...')).toBeVisible();

    // Assert: Session appears after project loads (within 3s total)
    await expect(page.locator('text=Test Session')).toBeVisible({ timeout: 3000 });
});
```

#### Test: Error state with retry
```typescript
test('session list shows error and allows retry', async ({ page, context }) => {
    // Simulate backend error
    await context.route('**/api/sessions', route => {
        route.abort('failed');
    });

    // Action: Open Chat Widget
    await page.goto('http://localhost:3000');
    await page.click('[title="Chat"]');

    // Assert: Error message visible
    await expect(page.locator('text=/Failed to load sessions/')).toBeVisible();
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();

    // Fix network
    await context.unroute('**/api/sessions');

    // Click retry
    await page.click('button:has-text("Retry")');

    // Assert: Sessions load after retry
    await expect(page.locator('.session-list-item')).toHaveCount(1);
});
```

---

## Success Metrics

### Quantitative Metrics
- **Session load time**: 95th percentile < 500ms from widget mount to list display
- **Error rate**: < 1% of session list loads fail (excluding network issues)
- **Retry success rate**: > 90% of retries succeed after transient error
- **Race condition occurrence**: 0% (E2E test should never fail due to empty list)

### Qualitative Metrics
- **User feedback**: No reports of "sessions not visible" after fix deployed
- **Support tickets**: Zero tickets related to session list visibility
- **Developer feedback**: Build/Oracle confirms E2E test passes consistently

---

## Implementation Checklist

- [ ] **Analyst**: Draft REQ document (this document)
- [ ] **Oracle**: Review REQ, approve technical approach (choose Option A/B/C)
- [ ] **Builder**: Implement ChatWidget changes (subscribe to project change event)
- [ ] **Builder**: Implement loading state UI (spinner, error, empty states)
- [ ] **Builder**: Add retry mechanism for failed loads
- [ ] **Builder**: Add debouncing for rapid project changes (if needed)
- [ ] **Builder**: Write unit tests for ChatComponent session loading
- [ ] **Janitor**: Write E2E test for session list auto-load
- [ ] **Janitor**: Write E2E test for race condition (slow network)
- [ ] **Janitor**: Write E2E test for error state and retry
- [ ] **Janitor**: Verify all tests pass (unit + E2E)
- [ ] **CodeReviewer**: Review implementation against acceptance criteria
- [ ] **Oracle**: Final validation, update WORKPLAN with completion status
- [ ] **Librarian**: Update known_issues.md (mark Issue #1 as resolved)
- [ ] **Librarian**: Add session loading pattern to patterns.md

---

## References

### Related Documents
- **TECHSPEC**: `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` (Section 5 — Chat System)
- **WORKPLAN**: `docs/architecture/WORKPLAN.md` (Phase 2 section)
- **Known Issues**: `.opencode/context/01_memory/known_issues.md` (Issue #1)

### Code References
- `extensions/openspace-chat/src/browser/chat-widget.tsx` (lines 66-134: ChatComponent initialization)
- `extensions/openspace-core/src/browser/session-service.ts` (lines 543-562: getSessions method)
- `extensions/openspace-core/src/browser/session-service.ts` (lines 151-181: init method)

### External Resources
- React useEffect dependency rules: https://react.dev/reference/react/useEffect
- Theia Event API: https://theia-ide.org/docs/events/
- Race condition debugging patterns: https://kentcdodds.com/blog/fix-the-slow-render-before-you-fix-the-re-render

---

**END OF REQUIREMENTS DOCUMENT**
