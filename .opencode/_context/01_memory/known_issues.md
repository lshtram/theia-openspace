# Known Issues

**Last Updated**: 2026-02-17

---

## Active Issues

### 🔴 Issue #1: Session List Not Visible on Chat Widget Open
**Reported**: 2026-02-17 (User manual testing)  
**Phase**: Phase 1B1 (discovered), should fix in Phase 2  
**Priority**: HIGH (UX blocker)  
**Requirements**: [REQ-SESSION-LIST-AUTOLOAD](../../docs/requirements/REQ-SESSION-LIST-AUTOLOAD.md)

#### Symptoms
- When chat widget opens, only "+ New Session" button is visible
- Existing sessions are not displayed in the session list
- User must manually trigger refresh or reload to see sessions

#### Root Cause (CONFIRMED)
**Race condition between ChatWidget mount and SessionService initialization:**

1. ChatWidget mounts → calls `loadSessions()` immediately (line 91 in chat-widget.tsx)
2. SessionService.getSessions() checks if `_activeProject` exists (line 546 in session-service.ts)
3. **BUT** SessionService.init() is async and still restoring project from localStorage (lines 159-180)
4. Result: `getSessions()` returns empty array `[]` before project loads
5. ChatWidget subscribes to `onActiveSessionChanged` (line 123) but **NOT** `onActiveProjectChanged`
6. When project finally loads, no re-fetch is triggered → UI stays empty

#### Confirmed Fix (Phase 2)
1. **Primary**: Subscribe ChatWidget to `SessionService.onActiveProjectChanged` event
2. **Secondary**: Add loading state UI (spinner/skeleton) while sessions load
3. **Tertiary**: Add error state UI with retry button for failed loads
4. **Quaternary**: Debounce rapid project changes to prevent duplicate fetches

#### Implementation Status
- [ ] REQ document drafted: [REQ-SESSION-LIST-AUTOLOAD](../../docs/requirements/REQ-SESSION-LIST-AUTOLOAD.md)
- [ ] Oracle approved technical approach
- [ ] Builder implemented ChatWidget changes
- [ ] Builder implemented loading/error states
- [ ] Janitor wrote E2E tests (race condition, error handling)
- [ ] CodeReviewer approved implementation
- [ ] Deployed and verified in production

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
