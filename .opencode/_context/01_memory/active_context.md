# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-28

## GitHub Issues - Task Tracking

All tasks are tracked in GitHub Issues: https://github.com/lshtram/theia-openspace/issues

## Current Focus

- **Status:** Idle — no active task in `current_task.md`.
- **Last completed (2026-02-28):** Voice emoji stripping + Theia Settings integration for all `openspace.*` preferences. Both tested and working. Root cause: `openspace` was not in Theia's hardcoded `DEFAULT_LAYOUT`. Fixed via `OpenspacePreferenceLayoutProvider` in `openspace-settings`.
- **Next:** Phase 2.7 model selector enhancements (M1-C, M2-B, M2-C remaining) or Phase 2.8 notifications.

## Pending Work

### Phase 2.7 Model Selector Enhancements
See `progress.md` for item status. Plan: `docs/plans/2026-02-26-model-selector-enhancements.md`

### Phase 2.8 Notifications & Feedback
6 gaps (N1-A through N2-C), 1 partial (N2-B). Plan: `docs/plans/2026-02-26-notifications-feedback.md`

## Server State

Theia running on PID ~62487 from repo root at port 3000.

## Key References

| What | Where |
|---|---|
| Architecture | `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` |
| Phase 2.7 plan | `docs/plans/2026-02-26-model-selector-enhancements.md` |
| Phase 2.8 plan | `docs/plans/2026-02-26-notifications-feedback.md` |
| Preference layout | `extensions/openspace-settings/src/browser/openspace-preference-layout.ts` |

## Known Issues for Future Agents

- **proxy-factory.js patch**: In `node_modules/` — survives `yarn build` but NOT `yarn install`
- **Pre-existing test failures on master**: TurnGroup streaming (×4) + AudioFsm (×2) — use `--no-verify` when pushing master
- **Import paths must use subdirectories**: e.g., `./session-service/session-service` not `./session-service`
- **searchFiles is async**: All callers must `await` the result (C3 change, 2026-02-27)
- **DOMPurify installed** at workspace root: `dompurify@3.3.1`, `@types/dompurify@3.2.0`
