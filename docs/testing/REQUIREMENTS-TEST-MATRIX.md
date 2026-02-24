# Requirements Test Matrix

Date: 2026-02-23

## Scope

- Requirements baselines:
  - `docs/requirements/REQ-MODALITY-PLATFORM-V2.md`
  - `docs/requirements/REQ-OPENSPACE.md`
  - `docs/requirements/REQ-SESSION-LIST-AUTOLOAD.md`
  - `docs/requirements/REQ-MODEL-DISPLAY.md`
  - `docs/requirements/REQ-MODEL-SELECTION.md`
  - `docs/requirements/REQ-MULTI-PART-PROMPT.md`
  - `docs/requirements/REQ-MESSAGE-TIMELINE.md`
  - `docs/requirements/REQ-AGENT-IDE-CONTROL.md`

## Coverage Rubric

- `Covered`: deterministic unit/integration tests assert expected behavior and error paths.
- `Partial`: tests exist but are narrow, flaky, or only assert shape/smoke behavior.
- `Missing`: no reliable automated test evidence for requirement family.

## Requirement Inventory (REQ-MODALITY-PLATFORM-V2)

- Unique requirement IDs: `113`
  - `REQ-SYS-*`: 14
  - `REQ-PANE-*`: 24
  - `REQ-PRES-*`: 20
  - `REQ-EDT-*`: 28
  - `REQ-WB-*`: 27

## Family-Level Matrix

| Requirement family | Example IDs | Evidence in current tests | Coverage | Notes |
|---|---|---|---|---|
| System core + command channel | REQ-SYS-001..014 | `extensions/openspace-core/src/node/__tests__/patch-engine.spec.ts`, `extensions/openspace-core/src/node/__tests__/hub-mcp.spec.ts`, `extensions/openspace-core/src/node/__tests__/hub.spec.ts`, `extensions/openspace-core/src/browser/__tests__/bridge-contribution.spec.ts`, `tests/e2e/app-load.spec.ts` | Partial | Unit coverage now includes direct Hub route assertions; E2E route checks remain unstable in this environment. |
| Pane operations and geometry | REQ-PANE-001..008 | `extensions/openspace-core/src/browser/__tests__/pane-command-contribution.spec.ts`, `extensions/openspace-core/src/browser/__tests__/pane-service.spec.ts`, `tests/e2e/agent-control.spec.ts` | Partial | Core command coverage, non-existent-pane error signaling, agent-pane cleanup, duplicate editor-tab activation, and pane geometry percentages are now explicitly unit-tested; persistence and advanced resize behavior remain incomplete. |
| Pane persistence and tab lifecycle | REQ-PANE-009..024 | `extensions/openspace-core/src/browser/__tests__/pane-service.spec.ts`, `extensions/openspace-core/src/browser/__tests__/tab-dblclick-toggle.spec.ts`, `extensions/openspace-core/src/browser/__tests__/viewer-toggle-service.spec.ts` | Partial | Unit coverage includes split persistence (`REQ-PANE-009/010`), restore ordering (`REQ-PANE-011`), missing-content placeholder preservation (`REQ-PANE-012`), named layout save/restore (`REQ-PANE-013`), manual close not blocked by agent tracking (`REQ-PANE-014`), dirty-close confirmation (`REQ-PANE-024`), and deterministic tab reorder/move persistence (`REQ-PANE-021/022`); keyboard focus modality and close-mode details still need explicit requirement tests. |
| Editor/viewer command surface | REQ-EDT-006..013 | `extensions/openspace-core/src/browser/__tests__/editor-command-contribution.spec.ts`, `extensions/openspace-core/src/browser/__tests__/file-command-contribution.spec.ts` | Partial | Command handlers are tested, but cross-modality link resolution and full interaction contracts are not fully covered. |
| Editor guided navigation + collaboration | REQ-EDT-014..028 | `extensions/openspace-core/src/browser/__tests__/viewer-toggle-open-handler.spec.ts`, `extensions/openspace-core/src/browser/__tests__/resolve-content-path.spec.ts`, `extensions/openspace-core/src/browser/__tests__/editor-command-contribution.spec.ts` | Partial | Deterministic test coverage now includes open-with-highlight lifecycle (`REQ-EDT-021`); reveal policy matrix, jump-back determinism, and escape-to-exit behavior still require dedicated unit/integration tests. |
| Presentation modality | REQ-PRES-001..020 | `extensions/openspace-presentation/src/browser/__tests__/presentation-service.spec.ts`, `extensions/openspace-presentation/src/browser/__tests__/presentation-commands.spec.ts`, `tests/e2e/presentation-tools.spec.ts` | Partial | Good command-level coverage, but E2E currently emphasizes response shape and bridge behavior over strict requirement outcomes (e.g. playback state machine and PDF export errors). |
| Whiteboard modality | REQ-WB-* | `extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-service.spec.ts`, `extensions/openspace-whiteboard/src/browser/__tests__/whiteboard-commands.spec.ts`, `tests/e2e/whiteboard-diagrams.spec.ts` | Partial | Strong breadth tests exist, but many assertions are smoke/shape oriented; deterministic requirement mapping is incomplete for persistence and error semantics. |
| Chat/session requirements | REQ-SESSION-LIST-AUTOLOAD, FEAT-CHAT-* in REQ-OPENSPACE | `extensions/openspace-chat/src/browser/__tests__/chat-widget-session-load.spec.ts`, `tests/e2e/session-list-autoload.spec.ts`, `tests/e2e/chat-message-flow.spec.ts`, `tests/e2e/session-management.spec.ts` | Partial | Unit tests improved substantially; multiple E2E tests remain skipped/flaky or constrained by infra mismatch. |
| Model display/selection requirements | REQ-MD-1..6 and model-selection docs | `extensions/openspace-chat/src/browser/__tests__/model-selector.spec.ts`, `docs/testing/TASK-1.15-TEST-RESULTS.md` | Partial | Some requirement mapping exists, but not yet normalized into one authoritative traceability matrix with automated pass criteria. |
| Voice requirements (deferred in modality doc, active implementation exists) | Voice-related FEAT/spec areas | `extensions/openspace-voice/src/__tests__/*.spec.ts`, `packages/voice-core/src/**/*.spec.ts` | Partial | Voice unit coverage is broad for FSM/adapters, but requirement traceability to modality baseline is not yet explicit. |

## Traceability Findings

- Requirement IDs are rarely embedded in automated tests.
- A green unit run (`yarn test:unit`) currently proves regression resistance for implemented assertions, not full requirement completeness.
- Several requirements in `REQ-OPENSPACE.md` are still marked pending, so full-suite pass cannot be interpreted as full requirements completion.
- E2E environment execution is now significantly more deterministic after strict precheck probes and recovery hardening; latest full run: `86 passed, 2 skipped`.

## Immediate Actions

1. Add requirement tags (`REQ-*`) to key unit/integration suites for explicit traceability.
2. Convert E2E shape/smoke assertions into requirement-outcome assertions for high-risk paths.
3. Keep E2E minimal and stable; move behavior verification into deterministic unit/integration tests where possible.
