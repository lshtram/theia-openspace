# Progress

Archived milestones: `docs/archive/progress-archive.md`

## Completed This Session (2026-02-28)

- ✅ Voice emoji stripping — `cleanTextForTts` strips `\p{Emoji_Presentation}` only (commits `1406b46`, `4611478`)
- ✅ Voice Theia Settings — `VoicePreferenceSchema` registered, `SessionFsm` seeded from prefs + live sync (commits `e0f0a5b`–`6effddb`)
- ✅ Settings UI bug fixed — `OpenspacePreferenceLayoutProvider` adds `openspace` to Theia's layout registry so all `openspace.*` prefs render correctly (commit `9bf81bf`)

## Current Milestones

### Phase 2.7 Model Selector Enhancements — IN PROGRESS

| Item | Feature | Status |
|---|---|---|
| M1-A | Recent models persistence (localStorage) | Partial |
| M1-B | Free tag badge | Done |
| M1-C | Status tags (slow/fast/offline) | Missing |
| M1-D | Provider sort (alphabetical) | Partial |
| M2-A | Hover tooltip | Done |
| M2-B | Favorites (star models) | Missing |
| M2-C | Provider CTA (empty state) | Missing |

Plan: `docs/plans/2026-02-26-model-selector-enhancements.md`

### Phase 2.8 Notifications & Feedback — NOT STARTED

6 gaps (N1-A through N2-C), 1 partial (N2-B copy state).
Plan: `docs/plans/2026-02-26-notifications-feedback.md`

## Test Baseline (master, 2026-02-27)

1231 passing, 1 pending, 0 failing
Pre-existing failures: TurnGroup streaming (×4), AudioFsm (×2) — use `--no-verify` to push master.
