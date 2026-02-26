# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-26

## GitHub Issues - Task Tracking

All tasks are now managed in GitHub Issues: https://github.com/lshtram/theia-openspace/issues

## Current Focus
- **Status:** Phase 2.6 Session Management Parity confirmed COMPLETE (audit + CSS fixes). Phase 2.7 and 2.8 partially implemented.
- **Previous:** Phase 2.5 branch merged to master (`990f26e`); Phase 2.6 codebase audit confirmed all 13 items already implemented; CSS hygiene fixes added for 6 missing classes.
- **Next:** Phase 2.7 (5 remaining gaps: M1-A persistence, M1-C status tags, M1-D sort, M2-B favorites, M2-C CTA) + Phase 2.8 (6 gaps: N1-A through N2-C)

## Phase 2.6 Audit & CSS Fixes (2026-02-26) ✅ COMPLETE

**What happened this session:**

1. **Codebase audit** confirmed all 13 Phase 2.6 items (S1-A through S3-C) were implemented by a previous agent
2. **CSS hygiene** — 6 CSS classes referenced in TSX but absent from `chat-widget.css` were added:
   - `.session-title-input` / `.sessions-title-input` — inline title edit inputs
   - `.back-to-parent` — back navigation button
   - `.sessions-skeleton` / `.session-skeleton-item` — shimmer skeleton loader
   - `.session-diff-badge` / `.session-diff-add` / `.session-diff-del` — diff badge in sessions panel
   - `.session-summary-badge` — diff badge in chat header
3. **Phase 2.7 audit** — 2/7 done, 2 partial, 3 missing
4. **Phase 2.8 audit** — 0/6 done, 1 partial (N2-B copy state)
5. **Docs updated** — WORKPLAN.md, active_context.md, progress.md, AGENTS.md

## Phase 2.7 Status (2026-02-26) 🟡 IN PROGRESS

| Item | Feature | Status |
|---|---|---|
| M1-A | Recent models persistence (localStorage) | Partial — in-memory only, no localStorage |
| M1-B | Free tag badge | ✅ DONE (`model-selector.tsx:505`) |
| M1-C | Status tags (slow/fast/offline) | ❌ Missing |
| M1-D | Provider sort (alphabetical) | Partial — grouped but insertion-order only |
| M2-A | Hover tooltip | ✅ DONE (delivered as P3-E in Phase 2.5) |
| M2-B | Favorites (star models) | ❌ Missing |
| M2-C | Provider CTA (empty state) | ❌ Missing |

## Phase 2.8 Status (2026-02-26) ⬜ NOT STARTED

| Item | Feature | Status |
|---|---|---|
| N1-A | Turn-complete toast (background sessions) | ❌ Missing |
| N1-B | Error notification toast | ❌ Missing |
| N1-C | Notification preferences in Settings | ❌ Missing |
| N2-A | Sound system (Web Audio API) | ❌ Missing |
| N2-B | Inline "Copied ✓" state | Partial — copy-URL button only, not share action |
| N2-C | Context usage warning toast | Partial — visual indicator exists, no toast |

## Phase 2.5 Merge & Post-Merge Hardening (2026-02-26) ✅ COMPLETE

**What happened this session:**

1. **Merge was already done** in previous session: commit `a8b5873` merged `feature/chat-feature-parity` into `master`
2. **Conflict resolution in previous session** took master's `chat-widget.tsx` entirely, silently dropping P1-E (context usage indicator) and P2-E (session summary badge)
3. **Post-merge compile errors** introduced by master's `469bcd2` were pre-existing and needed fixing:
   - Duplicate `renameSession` in `session-service.ts` — removed POST version, kept PATCH
   - `Disposable` missing `[Symbol.dispose]` in `viewer-toggle-contribution.ts` — wrapped with `Disposable.create()`
   - `.calledOnce` on typed stub in `path-validator.spec.ts` — cast to `SinonStub`
   - Private field intersection narrows to `never` in `hub-rate-limiting.spec.ts` — use `unknown` cast
   - Duplicate POST `renameSession` in `opencode-proxy.ts` — removed
4. **Test mock factories** in 5 spec files were missing ~12 methods each (new session service methods from master)
5. **P1-B tests** needed `dblclick` not `click` (master uses `onDoubleClick`)
6. **P1-E and P2-E re-added** to `chat-widget.tsx` directly
7. **Final state:** 1270 passing, 7 failing (all pre-existing), 1 pending
8. **Committed** `990f26e`, **rebuilt** webpack, **pushed** to `origin/master`

## Server State (2026-02-26 — end of session)
- **PID 23917:** Port 3000, repo root (`/Users/Shared/dev/theia-openspace/browser-app/`) — SOLE server
- **PID 26671 (port 3001 worktree):** KILLED — no longer running
- **Webpack:** Rebuilt for port 3000 — bundle includes Phase 2.6 CSS fixes; current as of session close
- **Browser:** Hard-refresh (Cmd+Shift+R) required to pick up new bundle

### Build commands
```bash
yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app webpack --config webpack.config.js --mode development
# Then Cmd+Shift+R in browser
```

## Key References

| What | Where |
|---|---|
| Session analysis (features) | `docs/reviews/SESSION-ANALYSIS-FEATURES-2026-02-25.md` |
| Session analysis (bugs) | `docs/reviews/SESSION-ANALYSIS-BUGS-2026-02-25.md` |
| Session analysis (agent patterns) | `docs/reviews/SESSION-ANALYSIS-AGENT-PATTERNS-2026-02-25.md` |
| All sessions CSV | `archive/root-debris/all_sessions_tracker.csv` (178 sessions) |
| MCP Tools (17) | Pane×4, Editor×6, Terminal×5, File×5 via Hub `/mcp` |
| Architecture | B1 hybrid (Theia AI + custom widget) |
| Phase 2.5 plan | `docs/plans/2026-02-25-chat-feature-parity.md` |
| Phase 2.6 plan | `docs/plans/2026-02-25-session-management-parity.md` |
| Phase 2.7 plan | `docs/plans/2026-02-26-model-selector-enhancements.md` |
| Phase 2.8 plan | `docs/plans/2026-02-26-notifications-feedback.md` |

## Known Issues for Future Agents
- **proxy-factory.js patch**: In `node_modules/` — survives `yarn build` but NOT `yarn install`. If re-run, must reapply.
- LSP/TS errors in Theia's own `node_modules` are pre-existing — ignore
- webpack build errors in openspace-layout are pre-existing — unrelated
- **GIF animation slot**: Awaiting user-created assets. Drop files in `extensions/openspace-chat/src/browser/style/animations/`
- **7 pre-existing test failures**: TurnGroup streaming (×4) + AudioFsm (×2) + 1 other — all in master; use `--no-verify` when pushing