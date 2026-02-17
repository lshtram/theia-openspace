# Contract: Phase 3 Task 3.6 — Stream Interceptor Hardening

> **Task ID:** 3.6  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Complete test coverage and production hardening for the stream interceptor in `OpenCodeProxy`.

**Why:** The stream interceptor extracts `%%OS{...}%%` blocks from agent responses. Must handle all edge cases: chunk boundaries, malformed JSON, code fences, etc.

**Dependencies:** Task 1B1.3 (interceptor skeleton) ✅ COMPLETE

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.6 (FR-3.6: Stream Interceptor Hardening) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.5, §6.5.1 |
| TECHSPEC-THEIA-OPENSPACE.md | §17.2 (GAP-2: Code fence detection) |

---

## 3. Implementation Location

The interceptor is already integrated in `OpenCodeProxy`:
```
extensions/openspace-core/src/node/opencode-proxy.ts  (MODIFY - enhance interceptor)
extensions/openspace-core/src/node/__tests__/opencode-proxy-stream.spec.ts  (MODIFY - add tests)
```

---

## 4. Requirements

### 4.1 Test Matrix (8 Core Cases from §6.5.1)

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Clean single block | `text %%OS{"cmd":"x","args":{}}%% more` | User sees `text  more`, command dispatched |
| 2 | Block split across chunks | Chunk 1: `text %%OS{"cmd":"x","a` / Chunk 2: `rgs":{}}%% more` | Same as #1 |
| 3 | Block split at delimiter | Chunk 1: `text %` / Chunk 2: `%OS{"cmd":"x"}%% more` | Same as #1 |
| 4 | Malformed JSON | `%%OS{not json}%%` | Discarded, warning logged |
| 5 | Unclosed block | `%%OS{"cmd":"x"` (no close for 5s) | Timeout, buffer discarded |
| 6 | Nested braces | `%%OS{"cmd":"x","args":{"data":"{}"}}%%` | Correctly parsed |
| 7 | Multiple blocks | `a %%OS{...}%% b %%OS{...}%% c` | Both commands dispatched |
| 8 | No blocks | `plain response text` | Passed unchanged |

### 4.2 Edge Cases (Required)

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 9 | False positive `%%` | `100%% increase` | Passed unchanged |
| 10 | Back-to-back blocks | `%%OS{...}%%%%OS{...}%%` | Both extracted |
| 11 | Unicode in args | `%%OS{"cmd":"x","args":{"msg":"héllo"}}%%` | Correctly parsed |
| 12 | Empty args | `%%OS{"cmd":"x","args":{}}%%` | Correctly parsed |
| 13 | **Code fence (GAP-2)** | `` Text ```%%OS{"cmd":"evil"}%%``` `` | Block NOT extracted |
| 14 | Tilde fence | `` Text ~~~%%OS{"cmd":"evil"}%%~~~ `` | Block NOT extracted |
| 15 | Inline code | `` Text `%%OS{"cmd":"x"}%%` `` | Block extracted (allowed) |

### 4.3 Code Fence Detection (GAP-2)

Per §17.2, implement code fence detection to prevent prompt injection:

```typescript
interface ParseState {
  inCodeFence: boolean;
  codeFenceDelimiter: string | null;
}

function shouldExtractBlock(text: string, state: ParseState): boolean {
  // Update code fence state
  for (const delimiter of ['```', '~~~']) {
    const fencePattern = new RegExp(`(${delimiter})`, 'g');
    // Toggle state when delimiter found
    // If in code fence, return false for OS blocks
  }
  return !state.inCodeFence;
}
```

---

## 5. Current Status

The interceptor already exists with basic functionality. Task 3.6 requires:

1. **Add missing test cases** to `opencode-proxy-stream.spec.ts`
2. **Implement code fence detection** (GAP-2)
3. **Verify all 8 core tests pass**
4. **Add edge case tests**

---

## 6. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.6.1 | All 8 §6.5.1 test cases pass | Run tests, all green |
| AC-3.6.2 | Edge-case tests pass | Run tests, all green |
| AC-3.6.3 | No regressions in message forwarding | Verify clean text display |
| AC-3.6.4 | Performance: <5ms overhead | Benchmark test |
| AC-3.6.5 | Code fence detection works | Test #13-15 pass |

---

## 7. Files to Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/node/opencode-proxy.ts` | Add code fence detection |
| `extensions/openspace-core/src/node/__tests__/opencode-proxy-stream.spec.ts` | Add 7+ new tests |

---

## 8. Success Criteria

- [ ] All 8 core test cases pass
- [ ] 7+ edge case tests added (total 15+ tests)
- [ ] Code fence detection implemented (GAP-2)
- [ ] Timeout guard (5s) working
- [ ] No regressions
- [ ] Build passes

---

**Contract Status:** APPROVED  
**Start Date:** 2026-02-17
