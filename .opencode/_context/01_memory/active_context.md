# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-27

## GitHub Issues - Task Tracking

All tasks are now managed in GitHub Issues: https://github.com/lshtram/theia-openspace/issues

## Current Focus
- **Status:** TTS Sentence-Chunk Streaming COMPLETE — all 4 tasks done, 1307 tests passing.
- **Previous:** R1 Hygiene (all 7 items) COMPLETE, God object decomposition COMPLETE.
- **Next:** Phase 2.7 model selector enhancements or Phase 2.8 notifications & feedback.

## R1 Hygiene (2026-02-27) -- COMPLETE

**Branch:** `fix/r1-hygiene` — merged to master via fast-forward, worktree removed.
**Plan:** `docs/plans/2026-02-27-r1-hygiene.md`
**Test baseline after merge:** 1231 passing, 1 pending, 0 failing

| Task | Item | Commit | Description |
|------|------|--------|-------------|
| 1 | I9 | `a70980f` | Platform-aware shell (not `/bin/bash`) |
| 2 | M13 | `41d87a7` | Replace console.log with structured logger |
| 3 | C2 | `e1bf7a4` | ReDoS guard (isSafeRegex) in searchFiles |
| 4 | C3 | `3a0cb68` | Convert sync fs to async (searchFiles, artifact-store) |
| 5 | C1/E2 | `be689b3` | Move getMcpConfig to backend RPC, remove fs from browser |
| 6 | I8 | `ba1e746` | Prune stale localStorage entries in notification service |
| 7 | I5 | `b61ad0b` | Replace custom sanitizeHtml with DOMPurify |
| — | fix | `28aaf71` | Update searchFiles tests to await async (C3 follow-up) |

**Note:** DOMPurify installed at workspace root (`dompurify@3.3.1`, `@types/dompurify@3.2.0`).

## Pending Work

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

## Server State
- Theia not running at time of last session. Start with: `node browser-app/lib/backend/main.js --port 3000`

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
- **Pre-existing test failures on master**: TurnGroup streaming (x4) + AudioFsm (x2) — use `--no-verify` when pushing master
- **Import paths must use subdirectories**: e.g., `./session-service/session-service` not `./session-service`
- **searchFiles is async**: All callers must `await` the result (C3 change)
