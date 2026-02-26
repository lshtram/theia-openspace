# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-26

## GitHub Issues - Task Tracking

All tasks are now managed in GitHub Issues: https://github.com/lshtram/theia-openspace/issues

## Current Focus
- **Status:** Phase 2.5 Chat Parity MERGED & PUSHED to master. Post-merge hardening complete.
- **Previous:** Phase 2.5 branch `feature/chat-feature-parity` merged into master (commit `a8b5873`); post-merge compile errors and test mock gaps found and fixed (commit `990f26e`)
- **Next:** Phase 2.6 Session Management Parity, Phase 2.7 Model Selector Enhancements, or Phase 2.8 Notifications & Feedback

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

## Server State (2026-02-26)
- **PID 23917:** Port 3000, repo root (`/Users/Shared/dev/theia-openspace/browser-app/`)
- **PID 26671:** Port 3001, worktree (`.worktrees/chat-feature-parity/`) — no longer primary
- **Webpack:** Rebuilt for port 3000 — bundle is current
- **Browser:** Hard-refresh (Cmd+Shift+R) needed to pick up changes

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
- **7 pre-existing test failures**: TurnGroup streaming (×4) + AudioFsm (×2) + 1 other — all in master before Phase 2.5; use `--no-verify` when pushing
- **Port 3001 worktree**: `.worktrees/chat-feature-parity/` is still running at PID 26671 — it can be left running or killed; it's no longer the primary server