# Test Coverage Gaps (Unit-First)

Date: 2026-02-23

## Executive View

- Current status is not "fully covered requirements".
- Unit suite can pass while requirement gaps and production bugs still exist.
- The largest issue is traceability and deterministic behavior assertions, not raw test count.
- E2E environment bootstrap was hardened to strict route/API probes with deterministic recovery and single-worker execution; latest full E2E run completed with `86 passed, 2 skipped`.

## High-Risk Gaps

## 1) System Prompt / Hub Endpoint Contract

- Requirement area: `REQ-SYS-014` and related Hub route contracts.
- Gap:
  - E2E route expectations are unstable in current environment.
  - Tests do not consistently prove `/openspace/instructions` and `/openspace/manifest` contract behavior in a deterministic setup.
- Risk:
  - Agent command availability and schema context can silently drift.
- Needed tests:
  - Node integration tests for Hub routes with explicit expected payloads and failure modes.
  - One stable E2E sanity check only (server up + endpoint returns parseable contract).

## 2) Pane Persistence and Tab Lifecycle

- Requirement area: `REQ-PANE-009..024`.
- Gap:
  - Existing tests emphasize command dispatch and basic interactions.
  - Restore ordering, split persistence, placeholder behavior, named layouts, and dirty-close confirmation now have deterministic unit coverage.
  - Tab movement/reorder contracts now have deterministic unit coverage.
  - Remaining gaps are keyboard/tab-focus modality and close-mode interaction details.
- Risk:
  - Regressions in workspace restore and user state continuity.
- Needed tests:
  - Unit tests around persistence serializer/deserializer and restore ordering.
  - Focused integration tests for dirty-close and duplicate-tab activation behavior.

## 3) Editor Guided Reveal + Navigation Contracts

- Requirement area: `REQ-EDT-014..028`.
- Gap:
  - Partial coverage for open handlers and command wiring.
  - Deterministic requirement-level assertion now exists for open-triggered highlight lifecycle (`REQ-EDT-021`).
  - Missing requirement-level assertions for escape-to-exit and jump-back determinism.
- Risk:
  - Agent guidance can feel inconsistent or trap user focus.
- Needed tests:
  - Unit suites for reveal policy matrix (`auto-focus`, `suggest-only`, `disabled`).
  - Integration suite for `openFileAt` round-trip and navigation history.

## 4) Chat Requirement Completeness vs Green Tests

- Requirement area: `REQ-OPENSPACE` FEAT-CHAT and session/autoload requirements.
- Gap:
  - Some E2E tests are skipped or constrained by infra assumptions.
  - Existing passing tests do not fully cover race conditions and recovery behavior under backend faults.
- Risk:
  - Known UX bugs reappear despite green CI.
- Needed tests:
  - Keep race/retry/error-path checks as deterministic component or service tests.
  - Reserve E2E for one clean happy path per tier.

## 5) Requirement Traceability Discipline

- Requirement area: all `REQ-*` families.
- Gap:
  - Most tests do not annotate or map to requirement IDs.
- Risk:
  - Cannot prove requirement completeness even with many passing tests.
- Needed tests/process:
  - Add requirement tags to test titles or metadata comments.
  - Add CI check that each `Must` requirement is mapped to at least one deterministic automated test.

## Priority Backlog (Next)

1. Add a `Must`-requirements traceability table with explicit test links and owners.
2. Stabilize Hub endpoint tests in unit/integration layer; keep one E2E sanity check.
3. Add pane persistence restore-order tests.
4. Add editor guided navigation lifecycle tests.
5. Reduce E2E to deterministic smoke paths and shift behavioral depth to unit/integration.
6. Keep OpenCode `/project/init` compatibility fallback under observation; current environment serves non-JSON for that endpoint, so setup now uses deterministic `/project` fallback mapping.

## Definition of Done for "Comprehensive"

- Every `Must` requirement in `REQ-MODALITY-PLATFORM-V2.md` and active `REQ-OPENSPACE.md` items has:
  - at least one deterministic automated test,
  - at least one negative-path assertion where applicable,
  - explicit traceability entry in the matrix,
  - stable CI execution without manual interpretation.
