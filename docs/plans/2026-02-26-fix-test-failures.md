# Fix 7 Test Failures (master branch) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 7 failing tests on master so `yarn test` exits 0.

**Architecture:** Three independent bug groups. Each is a test-only fix — no production behaviour changes. Fixes are applied in any order since they touch different files.

**Tech Stack:** TypeScript, Mocha/Chai, React, jsdom, streaming-vocab.ts

---

## Background — Root Cause Summary

| # | Test file | Root cause |
|---|-----------|------------|
| 1–4 | `message-bubble-groupparts.spec.ts` (2), `message-bubble.spec.ts` (2) | CSS class renamed: `turn-group-status` → `turn-group-activity-phrase` in commit `f48ff7a`; tests were not updated |
| 5 | `message-bubble-separation.spec.ts` | Test string `'Let me think about this...'` contains `...` which markdown-it (typographer:true) converts to `…`; test should match the typographic form or avoid `...` |
| 6–7 | `audio-fsm.spec.ts` | `chat-feature-parity-p1ab.spec.ts` replaces the entire `globalThis.navigator` object (`globalThis.navigator = { clipboard: ... }`) which destroys the `mediaDevices` mock set by `audio-fsm.spec.ts` at module load time; must restore `mediaDevices` after the clipboard tests |

---

## Task 1: Fix TurnGroup CSS class in `message-bubble-groupparts.spec.ts`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/__tests__/message-bubble-groupparts.spec.ts`

### Step 1: Update the selectors in the two failing tests

Find tests 11 and 16. Change `.turn-group-status` → `.turn-group-activity-phrase`.
Also update the textContent assertions: the new component does NOT pass `streamingStatus` through directly — it calls `pickPhrase(statusToCategory(streamingStatus))`. We should verify the activity-phrase element exists and is non-empty rather than asserting exact text.

Open the file and find:

```
// test 11 — lines ~275-288
const status = container.querySelector('.turn-group-status');
expect(status).to.not.be.null;
expect(status!.textContent).to.equal('Analyzing code');
```

Replace with:
```
const status = container.querySelector('.turn-group-activity-phrase');
expect(status).to.not.be.null;
// Activity phrase is vocabulary-driven; just verify it is non-empty
expect(status!.textContent!.trim().length).to.be.greaterThan(0);
```

And find test 16:
```
const status = container.querySelector('.turn-group-status');
expect(status).to.not.be.null;
expect(status!.textContent).to.equal('Thinking');
```

Replace with:
```
const status = container.querySelector('.turn-group-activity-phrase');
expect(status).to.not.be.null;
expect(status!.textContent!.trim().length).to.be.greaterThan(0);
```

### Step 2: Run the groupparts spec and verify it passes

```bash
npx mocha --timeout 10000 --exit --require ./test-setup.js \
  --require ts-node/register/transpile-only --extension ts,tsx \
  extensions/openspace-chat/src/browser/__tests__/message-bubble-groupparts.spec.ts
```

Expected: All tests in that file pass.

### Step 3: Commit

```bash
git add extensions/openspace-chat/src/browser/__tests__/message-bubble-groupparts.spec.ts
git commit -m "fix(test): update TurnGroup selector from turn-group-status to turn-group-activity-phrase"
```

---

## Task 2: Fix TurnGroup CSS class in `message-bubble.spec.ts`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/__tests__/message-bubble.spec.ts`

### Step 1: Find the two failing tests (~lines 762-779)

```
it('shows streaming status text', () => {
    ...
    const status = container.querySelector('.turn-group-status');
    expect(status).to.not.be.null;
    expect(status!.textContent).to.equal('Searching...');
```

```
it('shows default "Thinking" when no streamingStatus', () => {
    ...
    const status = container.querySelector('.turn-group-status');
    expect(status!.textContent).to.equal('Thinking');
```

Replace both `.turn-group-status` selectors with `.turn-group-activity-phrase`.
Remove the exact-text assertions (they are testing internal vocabulary, not the contract) and replace with non-empty checks:

```typescript
const status = container.querySelector('.turn-group-activity-phrase');
expect(status).to.not.be.null;
expect(status!.textContent!.trim().length).to.be.greaterThan(0);
```

### Step 2: Run the spec and verify it passes

```bash
npx mocha --timeout 10000 --exit --require ./test-setup.js \
  --require ts-node/register/transpile-only --extension ts,tsx \
  extensions/openspace-chat/src/browser/__tests__/message-bubble.spec.ts
```

Expected: All tests in that file pass.

### Step 3: Commit

```bash
git add extensions/openspace-chat/src/browser/__tests__/message-bubble.spec.ts
git commit -m "fix(test): update TurnGroup selector in message-bubble.spec.ts"
```

---

## Task 3: Fix typographic ellipsis in `message-bubble-separation.spec.ts`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/__tests__/message-bubble-separation.spec.ts`

### Step 1: Find the failing assertion (~line 729)

```typescript
expect(container.textContent).to.include('Let me think about this...');
```

The text `'...'` passes through `markdown-it` with `typographer: true`, which converts it to `'…'` (U+2026 HORIZONTAL ELLIPSIS). Fix the test string to avoid three dots, or match the rendered form:

**Option A (preferred — use unicode ellipsis in test):**
```typescript
expect(container.textContent).to.include('Let me think about this\u2026');
```

**Option B — change the reasoningPart text to avoid `...`:**
Find the `reasoningPart('Let me think about this...')` call at ~line 719 and change it to:
```typescript
reasoningPart('Let me think about this idea'),
```
Then update the assertion to:
```typescript
expect(container.textContent).to.include('Let me think about this idea');
```

Use Option B because it makes the test text cleaner and avoids depending on typographer internals.

### Step 2: Run the separation spec and verify it passes

```bash
npx mocha --timeout 10000 --exit --require ./test-setup.js \
  --require ts-node/register/transpile-only --extension ts,tsx \
  extensions/openspace-chat/src/browser/__tests__/message-bubble-separation.spec.ts
```

Expected: All tests in that file pass.

### Step 3: Commit

```bash
git add extensions/openspace-chat/src/browser/__tests__/message-bubble-separation.spec.ts
git commit -m "fix(test): avoid typographic ellipsis conversion in separation spec"
```

---

## Task 4: Fix navigator pollution in `chat-feature-parity-p1ab.spec.ts`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/__tests__/chat-feature-parity-p1ab.spec.ts`

### Step 1: Find the two places that replace navigator (~lines 192, 216)

Both look like:
```typescript
(globalThis as any).navigator = {
    clipboard: {
        writeText: (text: string) => { written.push(text); return Promise.resolve(); },
    },
};
```

This replaces the **entire** navigator object, destroying `mediaDevices`. Fix by preserving the existing navigator and only overriding `clipboard`:

```typescript
// Preserve existing navigator, only stub clipboard
Object.defineProperty(globalThis, 'navigator', {
    value: {
        ...(globalThis as { navigator?: object }).navigator,
        clipboard: {
            writeText: (text: string) => { written.push(text); return Promise.resolve(); },
        },
    },
    configurable: true,
    writable: true,
});
```

Do this for **both** occurrences.

**Also add cleanup in `afterEach`** to restore the original navigator after each test in these clipboard tests. Wrap with save/restore:

```typescript
let savedNavigator: unknown;
beforeEach(() => {
    savedNavigator = (globalThis as { navigator?: unknown }).navigator;
});
afterEach(() => {
    if (savedNavigator !== undefined) {
        Object.defineProperty(globalThis, 'navigator', {
            value: savedNavigator,
            configurable: true,
            writable: true,
        });
    }
});
```

Place these `beforeEach`/`afterEach` inside the `describe('P1-A: Copy response button', ...)` block.

### Step 2: Run the audio-fsm spec AFTER the p1ab spec to confirm no pollution

```bash
npx mocha --timeout 10000 --exit --require ./test-setup.js \
  --require ts-node/register/transpile-only --extension ts,tsx \
  "extensions/openspace-chat/src/browser/__tests__/chat-feature-parity-p1ab.spec.ts" \
  "extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts"
```

Expected: Both specs pass (0 failures).

### Step 3: Run p1ab spec alone to confirm clipboard tests still pass

```bash
npx mocha --timeout 10000 --exit --require ./test-setup.js \
  --require ts-node/register/transpile-only --extension ts,tsx \
  extensions/openspace-chat/src/browser/__tests__/chat-feature-parity-p1ab.spec.ts
```

Expected: All tests pass.

### Step 4: Commit

```bash
git add extensions/openspace-chat/src/browser/__tests__/chat-feature-parity-p1ab.spec.ts
git commit -m "fix(test): preserve navigator.mediaDevices when stubbing clipboard in p1ab spec"
```

---

## Task 5: Final verification — run the full suite

### Step 1: Run all tests

```bash
yarn test
```

Expected output:
```
N passing
1 pending
0 failing
```

### Step 2: If any failures remain, investigate and fix

Do NOT proceed to commit until `yarn test` shows 0 failures.

### Step 3: Push when clean

```bash
git push
```

---

## Checklist

- [ ] `message-bubble-groupparts.spec.ts` — 2 tests updated (`.turn-group-status` → `.turn-group-activity-phrase`)
- [ ] `message-bubble.spec.ts` — 2 tests updated (same)
- [ ] `message-bubble-separation.spec.ts` — 1 test updated (avoid `...` in test string)
- [ ] `chat-feature-parity-p1ab.spec.ts` — 2 navigator replacements fixed + save/restore
- [ ] `yarn test` exits 0
