---
id: VALIDATION-DEBUG-CHAT-CRITICAL-BUGS
author: oracle_8f2a
status: DRAFT
date: 2026-02-18
task_id: debug-chat-critical-bugs
---

# Validation Contract: Debug Chat Critical Bugs

## Context

The Builder (builder_7e3f) fixed 9 critical bugs that made the chat system non-functional with a real opencode server. All bugs have been fixed and the Builder reports: build passes (0 errors), 412 unit tests pass, 35 E2E tests pass (1 skipped, pre-existing).

## Working Directory

`/Users/Shared/dev/theia-openspace` (main branch, no worktree)

## Files Modified by Builder

| File | Bugs Fixed |
|---|---|
| `extensions/openspace-core/src/browser/bridge-contribution.ts` | #2 (DI wiring) |
| `extensions/openspace-core/src/common/opencode-protocol.ts` | #5 (Project type), #1 (connectToProject), #7 (delta field) |
| `extensions/openspace-core/src/browser/session-service.ts` | #5 (Project→worktree), #1 (connectToProject call) |
| `extensions/openspace-core/src/node/opencode-proxy.ts` | #1 (SSE endpoint), #3+#4 (event parsing), #8 (message body) |
| `extensions/openspace-core/src/browser/opencode-sync-service.ts` | #7 (delta accumulation) |
| `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts` | #5 (test mock update) |
| `extensions/openspace-chat/src/browser/message-bubble.tsx` | #6 (multi-part rendering) |
| `extensions/openspace-chat/src/browser/style/chat-widget.css` | #6 (part type styles) |

## Validation Steps (ALL MUST PASS)

### 1. Infrastructure Checks
- [ ] `yarn build` completes with 0 errors
- [ ] No TypeScript errors in openspace-core extension
- [ ] No TypeScript errors in openspace-chat extension

### 2. Unit Tests
- [ ] `yarn test:unit` — ALL tests pass (expect 412)
- [ ] No skipped tests that weren't previously skipped
- [ ] No test timeouts

### 3. E2E Tests (Batched per protocol)
- [ ] Batch 1 (3-5 tests): Run first batch, verify passes
- [ ] Batch 2: Continue if Batch 1 passes
- [ ] Batch 3+: Continue until all complete
- [ ] Total: expect ~35 passing, 1 skipped (pre-existing)

### 4. Code Quality Spot Checks
- [ ] `bridge-contribution.ts`: Verify `@inject(OpenCodeSyncService)` and `@inject(SessionService)` are present
- [ ] `opencode-proxy.ts`: Verify SSE endpoint uses `/event?directory=` not `/session/:id/events`
- [ ] `opencode-proxy.ts`: Verify `handleSSEEvent()` parses GlobalEvent wrapper (has `payload.type` routing)
- [ ] `opencode-proxy.ts`: Verify `createMessage()` sends only `{ parts, model? }` not full Message object
- [ ] `opencode-protocol.ts`: Verify `Project` type uses `SDKTypes.Project`
- [ ] `opencode-protocol.ts`: Verify `connectToProject(directory: string)` exists in OpenCodeService
- [ ] `opencode-protocol.ts`: Verify `delta?: string` on MessageNotification
- [ ] `session-service.ts`: Verify `project.worktree` used (not `project.name`/`project.path`)
- [ ] `opencode-sync-service.ts`: Verify `handleMessagePartial()` uses `event.delta`
- [ ] `message-bubble.tsx`: Verify renders tool, reasoning, step, file part types (not just text)

## Exit Criteria

- **PASS**: ALL automated checks pass (build, typecheck, unit tests, E2E) AND all spot checks confirm correct implementation
- **FAIL**: ANY automated check fails OR any spot check reveals incorrect implementation

## Result

Write your validation result to `.opencode/context/active_tasks/debug-chat-critical-bugs/janitor_result.md` with:
1. Pass/Fail status for each check
2. Full command output for build, unit tests, E2E tests
3. Any issues discovered
4. Overall PASS/FAIL verdict
