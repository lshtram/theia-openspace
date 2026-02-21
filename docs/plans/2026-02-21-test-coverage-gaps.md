# Test Coverage Gaps — Implementation Plan

Date: 2026-02-21 | Branch: feature/test-coverage-gaps

## Tasks

1. prompt-input-logic.spec.ts — buildRequestParts + parseFromDOM (pure TS, ~23 tests)
2. diff-utils.ts extraction + diff-utils.spec.ts (~16 tests)
3. markdown-renderer.spec.ts — renderMarkdown via compiled lib (~11 tests)
4. opencode-proxy-http.spec.ts — OpenCodeProxy HTTP methods (~18 tests)
5. message-timeline.spec.ts — useLatchedBool hook (~4 tests)
6. model-selector.spec.ts — ModelSelector component (~4 tests)
7. chat-message-flow.spec.ts — e2e send message flow (3 tests)

## Run commands
- Unit: npx mocha --timeout 10000 --exit
- E2E: npm run test:e2e
