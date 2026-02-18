# Contract: Task 1.11 — Session Management UI

**Task ID:** 1.11  
**Owner:** Builder  
**Status:** 🔄 In Progress  
**Created:** 2026-02-16  
**Dependencies:** Task 1.10 (Chat Widget)

---

## 1. Objective

Add session management controls to the chat widget: "New Session" button, session list (clickable to switch), and delete session button. Users should be able to create, switch, and delete sessions directly from the UI.

**Acceptance Criteria:**
- Can create a new session (button or command)
- Can switch between sessions (messages change automatically)
- Can delete a session
- Active session is visually indicated
- Session list updates when sessions are created/deleted
- No TypeScript errors
- Smooth UX (no jarring transitions)

---

## 2. Architecture Context

### 2.1 SessionService API

**Available methods:**
```typescript
// Create new session (automatically sets as active)
createSession(title?: string): Promise<Session>

// Switch to existing session
setActiveSession(sessionId: string): Promise<void>

// Delete session (need to add to SessionService)
deleteSession(sessionId: string): Promise<void>

// State
readonly activeProject: Project | undefined
readonly activeSession: Session | undefined
readonly messages: Message[]

// Events
readonly onActiveSessionChanged: Event<Session | undefined>
```

**Need to add to SessionService:**
```typescript
// Get all sessions for active project
getSessions(): Promise<Session[]>

// Delete session
deleteSession(sessionId: string): Promise<void>
```

### 2.2 UI Design Options

**Option A: Integrated Header (RECOMMENDED)**
- Add session controls above the message list in ChatWidget
- Session dropdown/list at the top
- "New Session" button next to session selector
- Delete button for active session

**Option B: Separate Sidebar Panel**
- Create dedicated session management panel
- Register as separate view in left sidebar
- Pros: More space for session list
- Cons: More complexity, extra panel

**DECISION:** Use **Option A** (Integrated Header) for Phase 1 simplicity.

---

## 3. Implementation Requirements

### 3.1 Update SessionService

Add these methods to `SessionServiceImpl`:

#### Method: `getSessions(): Promise<Session[]>`

**Purpose:** Fetch all sessions for active project

**Implementation:**
```typescript
async getSessions(): Promise<Session[]> {
    console.info('[SessionService] Operation: getSessions()');
    
    if (!this._activeProject) {
        console.warn('[SessionService] No active project');
        return [];
    }
    
    try {
        const sessions = await this.openCodeService.getSessions(this._activeProject.id);
        console.debug(`[SessionService] Found ${sessions.length} sessions`);
        return sessions;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[SessionService] Error fetching sessions: ${errorMsg}`);
        this._lastError = errorMsg;
        this.onErrorChangedEmitter.fire(errorMsg);
        return [];
    }
}
```

#### Method: `deleteSession(sessionId: string): Promise<void>`

**Purpose:** Delete a session (and clear active session if it was deleted)

**Implementation:**
```typescript
async deleteSession(sessionId: string): Promise<void> {
    console.info(`[SessionService] Operation: deleteSession(${sessionId})`);
    
    if (!this._activeProject) {
        const errorMsg = 'No active project';
        console.error(`[SessionService] Error: ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    this._isLoading = true;
    this.onIsLoadingChangedEmitter.fire(true);
    
    try {
        // Delete via backend
        await this.openCodeService.deleteSession(this._activeProject.id, sessionId);
        
        console.debug(`[SessionService] Deleted session: ${sessionId}`);
        
        // If deleted session was active, clear active session
        if (this._activeSession?.id === sessionId) {
            this._activeSession = undefined;
            this._messages = [];
            window.localStorage.removeItem('openspace.activeSessionId');
            this.onActiveSessionChangedEmitter.fire(undefined);
            this.onMessagesChangedEmitter.fire([]);
            console.debug('[SessionService] Cleared active session (was deleted)');
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[SessionService] Error: ${errorMsg}`);
        this._lastError = errorMsg;
        this.onErrorChangedEmitter.fire(errorMsg);
        throw error;
    } finally {
        this._isLoading = false;
        this.onIsLoadingChangedEmitter.fire(false);
    }
}
```

**Add to SessionService interface:**
```typescript
export interface SessionService extends Disposable {
    // ... existing methods ...
    
    // Session management
    getSessions(): Promise<Session[]>;
    deleteSession(sessionId: string): Promise<void>;
}
```

---

### 3.2 Update ChatWidget with Session Management UI

**File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`

#### UI Structure

```
┌─────────────────────────────────────────┐
│ Session Header                          │
│  [Current Session Title ▼] [+ New]     │
│  [🗑️ Delete]                            │
├─────────────────────────────────────────┤
│                                         │
│  Message List                           │
│  (existing implementation)              │
│                                         │
├─────────────────────────────────────────┤
│  Input Area                             │
│  (existing implementation)              │
└─────────────────────────────────────────┘
```

#### Component Changes

**1. Add Session State:**
```typescript
const [sessions, setSessions] = React.useState<Session[]>([]);
const [showSessionList, setShowSessionList] = React.useState(false);
```

**2. Load Sessions on Mount:**
```typescript
React.useEffect(() => {
    loadSessions();
    
    // Subscribe to session changes to reload list
    const sessionChangedDisposable = sessionService.onActiveSessionChanged(() => {
        loadSessions();
    });
    
    return () => sessionChangedDisposable.dispose();
}, []);

const loadSessions = async () => {
    try {
        const sessions = await sessionService.getSessions();
        setSessions(sessions);
    } catch (error) {
        console.error('[ChatWidget] Error loading sessions:', error);
    }
};
```

**3. Session Header Component:**
```typescript
const SessionHeader: React.FC = () => {
    const activeSession = sessionService.activeSession;
    
    return (
        <div className="session-header">
            <div className="session-selector">
                <button 
                    className="session-dropdown-button"
                    onClick={() => setShowSessionList(!showSessionList)}
                    disabled={!sessionService.activeProject}
                >
                    {activeSession ? activeSession.title : 'No Session'}
                    <span className="dropdown-icon">▼</span>
                </button>
                
                {showSessionList && (
                    <div className="session-list-dropdown">
                        {sessions.map(session => (
                            <div 
                                key={session.id}
                                className={`session-list-item ${session.id === activeSession?.id ? 'active' : ''}`}
                                onClick={() => handleSessionSwitch(session.id)}
                            >
                                {session.title}
                                {session.id === activeSession?.id && <span className="active-indicator">●</span>}
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <div className="session-list-empty">No sessions</div>
                        )}
                    </div>
                )}
            </div>
            
            <button 
                className="new-session-button"
                onClick={handleNewSession}
                disabled={!sessionService.activeProject}
                title="Create new session"
            >
                + New
            </button>
            
            {activeSession && (
                <button 
                    className="delete-session-button"
                    onClick={handleDeleteSession}
                    title="Delete current session"
                >
                    🗑️
                </button>
            )}
        </div>
    );
};
```

**4. Event Handlers:**
```typescript
const handleNewSession = async () => {
    try {
        const title = `Session ${new Date().toLocaleString()}`;
        await sessionService.createSession(title);
        await loadSessions();
        setShowSessionList(false);
    } catch (error) {
        console.error('[ChatWidget] Error creating session:', error);
        alert(`Failed to create session: ${error}`);
    }
};

const handleSessionSwitch = async (sessionId: string) => {
    try {
        await sessionService.setActiveSession(sessionId);
        setShowSessionList(false);
    } catch (error) {
        console.error('[ChatWidget] Error switching session:', error);
        alert(`Failed to switch session: ${error}`);
    }
};

const handleDeleteSession = async () => {
    const activeSession = sessionService.activeSession;
    if (!activeSession) return;
    
    const confirmed = confirm(`Delete session "${activeSession.title}"?`);
    if (!confirmed) return;
    
    try {
        await sessionService.deleteSession(activeSession.id);
        await loadSessions();
    } catch (error) {
        console.error('[ChatWidget] Error deleting session:', error);
        alert(`Failed to delete session: ${error}`);
    }
};
```

**5. Close Dropdown on Outside Click:**
```typescript
React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.session-selector')) {
            setShowSessionList(false);
        }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
}, []);
```

---

### 3.3 Styling Updates

**File:** `extensions/openspace-chat/src/browser/style/chat-widget.css`

Add CSS for session management UI:

```css
/* Session Header */
.session-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--theia-panel-border);
    background: var(--theia-editor-background);
}

/* Session Selector */
.session-selector {
    position: relative;
    flex: 1;
}

.session-dropdown-button {
    width: 100%;
    padding: 6px 12px;
    background: var(--theia-button-background);
    color: var(--theia-button-foreground);
    border: 1px solid var(--theia-button-border);
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.session-dropdown-button:hover:not(:disabled) {
    background: var(--theia-button-hoverBackground);
}

.session-dropdown-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.dropdown-icon {
    margin-left: 8px;
    font-size: 10px;
}

/* Session List Dropdown */
.session-list-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--theia-dropdown-background);
    border: 1px solid var(--theia-dropdown-border);
    border-radius: 3px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
}

.session-list-item {
    padding: 8px 12px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--theia-foreground);
}

.session-list-item:hover {
    background: var(--theia-list-hoverBackground);
}

.session-list-item.active {
    background: var(--theia-list-activeSelectionBackground);
    color: var(--theia-list-activeSelectionForeground);
    font-weight: bold;
}

.active-indicator {
    color: var(--theia-badge-background);
    font-size: 16px;
}

.session-list-empty {
    padding: 12px;
    text-align: center;
    color: var(--theia-descriptionForeground);
    font-size: 12px;
}

/* New Session Button */
.new-session-button {
    padding: 6px 12px;
    background: var(--theia-button-background);
    color: var(--theia-button-foreground);
    border: 1px solid var(--theia-button-border);
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
}

.new-session-button:hover:not(:disabled) {
    background: var(--theia-button-hoverBackground);
}

.new-session-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Delete Session Button */
.delete-session-button {
    padding: 6px 12px;
    background: var(--theia-button-secondaryBackground);
    color: var(--theia-button-secondaryForeground);
    border: 1px solid var(--theia-button-border);
    border-radius: 3px;
    cursor: pointer;
    font-size: 16px;
}

.delete-session-button:hover {
    background: var(--theia-errorForeground);
    color: white;
}
```

---

## 4. Error Handling Requirements

1. **No active project:** Disable session management buttons, show tooltip "No project loaded"
2. **Session load failure:** Log error, show empty session list with error message
3. **Session create failure:** Show alert with error message, don't close dropdown
4. **Session switch failure:** Show alert, keep current session active
5. **Session delete failure:** Show alert, keep session in list
6. **Delete active session:** Automatically clear active session and messages

---

## 5. UX Requirements

### 5.1 Session Dropdown Behavior
- Clicking dropdown button toggles session list
- Clicking outside dropdown closes it
- Clicking a session switches to it AND closes dropdown
- Active session is visually highlighted
- Sessions sorted by `updatedAt` (most recent first)

### 5.2 New Session
- Default title format: `"Session 2026-02-16 21:30"`
- Automatically switches to new session after creation
- Closes dropdown after creation
- Shows loading state during creation

### 5.3 Delete Session
- Show confirmation dialog: `"Delete session '{title}'?"`
- If active session deleted, clear messages and show "No session" state
- If non-active session deleted, keep current session active
- Reload session list after deletion

---

## 6. Testing Strategy

### 6.1 Manual Testing

**Test Case 1: Create Session**
1. Click "+ New" button
2. Verify new session appears in dropdown
3. Verify new session is active (messages cleared)
4. Verify session list updated

**Test Case 2: Switch Session**
1. Create multiple sessions with different messages
2. Click dropdown, select different session
3. Verify messages change to selected session
4. Verify active indicator moves

**Test Case 3: Delete Session**
1. Create 2 sessions
2. Delete non-active session → verify current session stays active
3. Delete active session → verify cleared to "No session" state
4. Verify deleted sessions removed from list

**Test Case 4: Edge Cases**
- No active project → buttons disabled
- Only 1 session → delete works, shows "No session" state
- Session list empty → shows "No sessions" message

---

## 7. Acceptance Checklist

### 7.1 SessionService Updates
- [ ] Added `getSessions()` method
- [ ] Added `deleteSession()` method
- [ ] Methods added to SessionService interface
- [ ] Comprehensive logging
- [ ] Error handling

### 7.2 ChatWidget Updates
- [ ] Session header added above message list
- [ ] Session dropdown with active indicator
- [ ] "+ New" button functional
- [ ] Delete button functional
- [ ] Click outside closes dropdown
- [ ] Sessions load on mount
- [ ] Session list refreshes on changes

### 7.3 Styling
- [ ] Session header styled
- [ ] Dropdown styled with Theia theme variables
- [ ] Active session visually distinguished
- [ ] Buttons styled consistently
- [ ] Hover states implemented

### 7.4 Functionality
- [ ] Can create new session
- [ ] Can switch between sessions (messages change)
- [ ] Can delete session (with confirmation)
- [ ] Deleting active session clears UI
- [ ] No TypeScript errors
- [ ] Build succeeds

---

## 8. Known Edge Cases

### 8.1 Rapid Session Switching
**Issue:** User rapidly clicks different sessions before loads complete

**Mitigation:** Disable dropdown during session load (show loading state)

### 8.2 Delete Last Session
**Issue:** User deletes the only session

**Expected:** Show "No session" state, allow creating new session

### 8.3 Session Deleted Externally
**Issue:** Another user/process deletes the active session

**Mitigation:** SyncService already handles `session.deleted` events → calls `sessionService.notifySessionDeleted()`

---

## 9. Future Enhancements (Post-Phase 1)

1. **Session Renaming:** Double-click title to edit
2. **Session Search:** Filter sessions by title
3. **Session Sorting:** By date, name, or custom order
4. **Session Grouping:** Organize by project or tags
5. **Session Duplication:** Fork/clone existing session
6. **Session Export:** Download session as JSON/Markdown

---

## 10. Contract Approval

**Oracle:** Approved for Builder implementation  
**Builder:** Ready to implement  
**Janitor:** Contract review pending  
**CodeReviewer:** Contract review pending

---

## 11. References

- **WORKPLAN:** `docs/architecture/WORKPLAN.md` — Task 1.11 (lines 212-218)
- **SessionService:** `extensions/openspace-core/src/browser/session-service.ts`
- **ChatWidget:** `extensions/openspace-chat/src/browser/chat-widget.tsx`
- **OpenCode Protocol:** `extensions/openspace-core/src/common/opencode-protocol.ts`

---

**END OF CONTRACT**
