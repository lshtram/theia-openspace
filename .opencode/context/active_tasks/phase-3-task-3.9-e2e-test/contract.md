# Contract: Phase 3 Task 3.9 — End-to-End Agent Control Test

> **Task ID:** 3.9  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Create Playwright E2E tests that verify the complete agent control pipeline.

**Why:** This is the **MANDATORY E2E GATE** - all tests must pass before Phase 3 is complete.

**Dependencies:** Tasks 3.6, 3.7, 3.8 ✅ COMPLETE

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.9 (FR-3.9) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.8 |

---

## 3. Implementation Location

```
tests/e2e/agent-control.spec.ts  (NEW)
playwright.config.ts  (MODIFY - if needed)
```

---

## 4. Test Scenarios

### Core Tests (8 scenarios from §6.8)

| # | Scenario | Verification |
|---|---------|--------------|
| T1 | Agent emits `openspace.editor.open` → file opens at line 42 | File visible in editor |
| T2 | Agent emits `openspace.editor.highlight` → lines highlighted | Highlight visible |
| T3 | Agent emits `openspace.terminal.create` + `openspace.terminal.send` | Terminal created, command runs |
| T4 | Agent emits `openspace.terminal.read_output` | Output readable |
| T5 | Agent emits `openspace.pane.open` → pane opens | Pane visible |
| T6 | Multiple blocks in one response | All commands executed |
| T7 | Malformed JSON block | Block discarded, no crash |
| T8 | Chunk boundary split | Block correctly reassembled |

### Additional Tests

| # | Scenario | Verification |
|---|---------|--------------|
| T9 | Clean text shown to user | No `%%OS{...}%%` visible in chat |
| T10 | Command palette shows openspace.* commands | Commands visible |
| T11 | Security: path traversal blocked | Rejected with error |
| T12 | Security: sensitive file blocked | Rejected with error |

---

## 5. Test Implementation

### Test File Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Agent IDE Control', () => {
  
  test('openspace.editor.open - file opens at line', async ({ page }) => {
    // Simulate agent response with %%OS{...}%% block
    await page.goto('/');
    // ... trigger command ...
    // Verify file opened
  });
  
  test('openspace.editor.highlight - lines highlighted', async ({ page }) => {
    // ...
  });
  
  // ... all 12 tests
});
```

### Prerequisites

1. Theia app must be running (`yarn start:browser`)
2. OpenCode server must be available (for full E2E)
3. Hub must be running

---

## 6. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.9.1 | Agent successfully controls IDE via `%%OS{...}%%` | All T1-T8 pass |
| AC-3.9.2 | Clean text shown to user | T9 passes |
| AC-3.9.3 | Full RPC callback path verified | T1-T8 verify full path |
| AC-3.9.4 | Security tests pass | T11-T12 pass |

---

## 7. Files to Create

| File | Action |
|------|--------|
| `tests/e2e/agent-control.spec.ts` | CREATE |

---

## 8. Success Criteria

- [ ] 12 E2E test scenarios implemented
- [ ] All tests pass (or properly skipped with reason)
- [ ] Tests use Playwright correctly
- [ ] Tests are documented

---

**Contract Status:** APPROVED  
**Priority:** MANDATORY E2E GATE
