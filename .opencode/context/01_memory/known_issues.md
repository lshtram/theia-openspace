# Known Issues

**Last Updated**: 2026-02-17

---

## Active Issues

### 🔴 Issue #1: Session List Not Visible on Chat Widget Open
**Reported**: 2026-02-17 (User manual testing)  
**Phase**: Phase 1B1 (discovered), should fix in Phase 2  
**Priority**: HIGH (UX blocker)

#### Symptoms
- When chat widget opens, only "+ New Session" button is visible
- Existing sessions are not displayed in the session list
- User must manually trigger refresh or reload to see sessions

#### Expected Behavior
- Chat widget should display existing session list immediately on open
- If sessions exist, they should be visible alongside "+ New Session" button
- Session list should load automatically on widget initialization

#### Suspected Causes
1. **Race condition**: ChatWidget mounts before SessionService.listSessions() completes
2. **Missing auto-load**: Sessions not fetched automatically on widget init
3. **State sync issue**: SessionService has sessions but ChatWidget doesn't react to initial state

#### Impact
- User cannot see or switch to existing sessions without manual action
- Poor first-run experience (appears broken)
- Workaround exists but shouldn't be necessary

#### Files Involved
- `extensions/openspace-chat/src/browser/chat-widget.tsx` (session list rendering)
- `extensions/openspace-core/src/browser/session-service.ts` (session loading)

#### Proposed Fix (Phase 2)
1. Add `useEffect` hook in ChatWidget to call `sessionService.listSessions()` on mount
2. Ensure SessionService emits `onSessionsChanged` event after loading
3. Add loading state UI (spinner/skeleton) while sessions load
4. Add error handling for failed session list fetch

#### Test Cases Needed
- [ ] Open chat widget with 0 sessions → shows only "+ New Session"
- [ ] Open chat widget with 1+ sessions → shows session list immediately
- [ ] Session list loads within 500ms of widget mount
- [ ] Error fetching sessions → shows error message, allows retry

---

## Resolved Issues

### ✅ Issue: Nested JSON Command Parsing Fails (Phase 1B1)
**Resolved**: 2026-02-17  
**Fix**: Replaced regex with brace-counting state machine in OpenCodeProxy

### ✅ Issue: Multiple Commands Not All Extracted (Phase 1B1)
**Resolved**: 2026-02-17  
**Fix**: Sequential processing eliminates index tracking issues

### ✅ Issue: No Command Validation Security (Phase 1B1)
**Resolved**: 2026-02-17  
**Fix**: Added 3-tier validation (structure + allowlist + args) in SyncService

---

## Deferred Issues (Tech Debt)

### ⚪ Stream Chunk Boundary Limitation
**Severity**: LOW  
**Deferred To**: Phase 3 (Task 3.6)  

#### Description
Stream interceptor cannot handle `%%OS{...}%%` blocks split across SSE chunks. Current parser processes each chunk independently.

#### Why Deferred
- User testing confirms this does not occur in practice yet
- OpenCode server currently sends complete command blocks in single chunks
- Phase 3 has dedicated task for stateful buffering across chunks

#### Mitigation
- Document limitation in TECHSPEC §6.5
- Add TODO comment in opencode-proxy.ts
- Monitor for occurrence in production

---

## Process Failures

(None logged yet — see NSO instructions for format)

| Date | Agent | Failure | Proposed Mechanism |
|------|-------|---------|-------------------|
| (example) | Oracle | Jumped to implementation without delegation | Update Oracle prompt to enforce explicit user consent |
