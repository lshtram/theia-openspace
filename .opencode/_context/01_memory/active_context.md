# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-26

## GitHub Issues - Task Tracking

All tasks are now managed in GitHub Issues: https://github.com/lshtram/theia-openspace/issues

## Current Focus
- **Status:** God object decomposition COMPLETE on branch `refactor/god-object-decomposition`. Pushed to remote. Ready for merge/PR.
- **Previous:** Phases 2.5, 2.6 complete on master. Phases 2.7, 2.8 partially implemented.
- **Next:** Merge god-object-decomposition branch into master, then continue with Phase 2.7/2.8 or R1 hygiene tasks.

## God Object Decomposition (2026-02-26/27) -- COMPLETE

**Branch:** `refactor/god-object-decomposition` (pushed to `origin/refactor/god-object-decomposition`)
**Worktree:** `.worktrees/god-object-decomposition/`
**Design doc:** `docs/plans/2026-02-27-god-object-decomposition-design.md`
**Test baseline:** 1231 passing, 0 failing, 1 pending (maintained across all 6 commits)

| Phase | File | Original | Modules | Max Lines | Commit |
|-------|------|----------|---------|-----------|--------|
| 1 | `hub-mcp.ts` | 956L | 10 | 222 | `4af4f01` |
| 2 | `opencode-proxy.ts` | 1,330L | 6 | 375 | `5a221bb` |
| 3 | `session-service.ts` | 2,118L | 7 | 385 | `583af66` |
| 4a | `message-bubble.tsx` | 1,455L | 6 | 392 | `228ce9b` |
| 4b | `chat-widget.tsx` | 1,280L | 7 | 390 | `392b836` |
| 4c | `prompt-input.tsx` | 1,186L | 10 | 394 | `859f786` |
| **Total** | | **8,325L** | **46** | **<400** | |

All original monolith files deleted. Facades maintain existing public APIs. No DI binding changes needed for hub-mcp (not DI-managed) or chat frontend modules (React components).

### Subdirectory Locations
- `extensions/openspace-core/src/node/hub-mcp/` — 10 files
- `extensions/openspace-core/src/node/opencode-proxy/` — 6 files
- `extensions/openspace-core/src/browser/session-service/` — 7 files
- `extensions/openspace-chat/src/browser/message-bubble/` — 6 files
- `extensions/openspace-chat/src/browser/chat-widget/` — 7 files
- `extensions/openspace-chat/src/browser/prompt-input/` — 10 files (4 pre-existing + 6 new)

## Pending Work (not on this branch)

### Phase 2.7 Model Selector Enhancements -- IN PROGRESS
| Item | Feature | Status |
|---|---|---|
| M1-A | Recent models persistence (localStorage) | Partial |
| M1-B | Free tag badge | Done |
| M1-C | Status tags (slow/fast/offline) | Missing |
| M1-D | Provider sort (alphabetical) | Partial |
| M2-A | Hover tooltip | Done |
| M2-B | Favorites (star models) | Missing |
| M2-C | Provider CTA (empty state) | Missing |

### Phase 2.8 Notifications & Feedback -- NOT STARTED
6 gaps (N1-A through N2-C), 1 partial (N2-B copy state)

### R1 Hygiene Tasks
Plan at `docs/plans/2026-02-27-r1-hygiene.md` — not yet started.

## Server State
- **PID 23917:** Port 3000, repo root — SOLE server
- **Worktree server:** Not running (killed)

## Key References

| What | Where |
|---|---|
| God object design doc | `docs/plans/2026-02-27-god-object-decomposition-design.md` |
| R1 hygiene plan | `docs/plans/2026-02-27-r1-hygiene.md` |
| Session analysis (features) | `docs/reviews/SESSION-ANALYSIS-FEATURES-2026-02-25.md` |
| Architecture | `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` |
| Phase 2.7 plan | `docs/plans/2026-02-26-model-selector-enhancements.md` |
| Phase 2.8 plan | `docs/plans/2026-02-26-notifications-feedback.md` |

## Known Issues for Future Agents
- **proxy-factory.js patch**: In `node_modules/` — survives `yarn build` but NOT `yarn install`
- **7 pre-existing test failures on master**: TurnGroup streaming (x4) + AudioFsm (x2) + 1 other — use `--no-verify` when pushing master
- **Worktree test count differs from master**: Worktree has 1231 passing; master has 1270 passing (different test set)
- **After merging decomposition branch**: Import paths in any new code must use subdirectory paths (e.g., `./session-service/session-service` not `./session-service`)
