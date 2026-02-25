# Bugs Extracted from Session Analysis

## Overview
This document contains all bugs identified and fixed from chronological session review (Feb 18-25, 2026).

## Source
- Session files: `/Users/agentuser/.local/share/opencode/storage/session_diff/`
- Analysis period: Phase 2+ (Feb 18, 2026 - present)

---

## Chat/Session Bugs (Feb 18)

### Fixed
| Bug | Description | Fix |
|-----|-------------|-----|
| Session race condition | Chat sessions not loading on project change | Added project change subscription |
| Loading state missing | Chat loading state not displayed during fetch | Added isLoadingSessions with 100ms min |
| Error state missing | Chat error state not displayed on fetch failure | Added error state with retry button |
| Auto-scroll failing | Conditional scroll suppressed | Unconditional scroll + "new messages" indicator |
| Dropdown stale | Session dropdown not updating on project change | Added onActiveProjectChanged listener |
| Test hooks exposed | window.__openspace_test__ exposed in production | Added NODE_ENV guard |
| Symlink vulnerability | path.normalize only | Added proper traversal check |
| Focus trap incomplete | Permission dialog focus trap | Completed implementation |
| Reveal not initialized | navigationService.setReveal() never called | Wired in initialize |
| Presentation stub | pane.open type=presentation was no-op | Implemented full handler |

---

## Streaming/UI Bugs (Feb 20)

### Fixed
| Bug | Description | Fix |
|-----|-------------|-----|
| Tool cards not grouped | Single messages for multiple tools | Collapsible turn group |
| Popup invisible | Slash/@ popup menus hidden | Fixed overflow: hidden |
| Stop button state | Doesn't fully reset streaming | Added sessionBusy reset |
| Question rendering | Not working | Fixed rendering logic |
| Light theme | Syntax highlighting hardcoded dark | Added light theme CSS |
| Spinner missing | @keyframes not defined | Added oc-spin keyframes |

---

## Security Bugs (Feb 21)

### Fixed
| Bug | Description | Fix |
|-----|-------------|-----|
| Mermaid XSS | DOMPurify sanitization missing | Added sanitization |
| DOMPurify config | ALLOW_UNKNOWN_PROTOCOLS issue | Fixed configuration |
| ANSI injection | Script tag via ANSI sequences | Added ANSI sanitization |

---

## Conversation Flow Bugs (Feb 22)

### Fixed
| Bug | Description | Fix |
|-----|-------------|-----|
| Button flicker | Send/stop flicker during multi-step turns | Server-authoritative sessionBusy |
| Duplicate messages | SSE + RPC race condition | SSE as single source |
| TurnGroup rendering | Last assistant message not grouped | Fixed rendering logic |

---

## Infrastructure Bugs (Feb 23-25)

### Fixed
| Bug | Description | Fix |
|-----|-------------|-----|
| CI masking | "|| echo" fallbacks hiding failures | Removed fallbacks |
| Mocha config | Missing --exit flag and patterns | Added to .mocharc.json |
| Hub readiness | HTTP 503 false negatives | Fixed retry logic |
| Webpack paths | Config comments wrong worktree | Fixed paths |
| Diff memory | O(m*n) on large files | Added MAX_DIFF_LINES = 1000 |
| Stream race | Subscription after send | Subscribe BEFORE sendMessage |

---

## Known Unresolved Bugs

| Bug | Description | Status |
|-----|-------------|--------|
| Terminal process leak | Terminal processes not cleaned up | KNOWN_BUGS.md - open |

---

## Bug Categories Summary

| Category | Count |
|----------|-------|
| Chat/Session | 10 |
| Streaming/UI | 6 |
| Security | 3 |
| Conversation Flow | 3 |
| Infrastructure | 6 |
| **Total Fixed** | **28** |
| Known Unresolved | 1 |
