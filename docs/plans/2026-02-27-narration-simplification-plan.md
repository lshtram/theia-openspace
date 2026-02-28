# Narration Pipeline Simplification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the race-condition-prone streaming-event-based narration trigger with a DOM-based MutationObserver, and replace the broken LLM preprocessor with regex text cleanup.

**Architecture:** Frontend observes DOM for completed assistant messages, reads rendered text, sends to backend. Backend does regex cleanup and passes directly to TTS. No message store coupling, no streaming event timing.

**Tech Stack:** TypeScript, MutationObserver API, Theia extension DI, Mocha/Chai tests.

---

### Task 1: Add `cleanTextForTts` utility function with tests

**Files:**
- Create: `extensions/openspace-voice/src/common/text-cleanup.ts`
- Create: `extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts`

**Step 1: Write the failing test**

Create `extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts`:

```typescript
// extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts
import { assert } from 'chai';
import { cleanTextForTts } from '../common/text-cleanup';

describe('cleanTextForTts', () => {
  it('strips fenced code blocks', () => {
    const input = 'Before\n```js\nconsole.log("hi");\n```\nAfter';
    assert.equal(cleanTextForTts(input), 'Before\nAfter');
  });

  it('strips inline code', () => {
    assert.equal(cleanTextForTts('Run `npm install` now'), 'Run npm install now');
  });

  it('strips markdown bold and italic', () => {
    assert.equal(cleanTextForTts('This is **bold** and *italic*'), 'This is bold and italic');
  });

  it('strips markdown headers', () => {
    assert.equal(cleanTextForTts('## Section Title\nContent'), 'Section Title\nContent');
  });

  it('strips URLs', () => {
    assert.equal(cleanTextForTts('Visit https://example.com/path for more'), 'Visit  for more');
  });

  it('collapses multiple whitespace', () => {
    assert.equal(cleanTextForTts('too   many    spaces'), 'too many spaces');
  });

  it('trims leading/trailing whitespace', () => {
    assert.equal(cleanTextForTts('  hello world  '), 'hello world');
  });

  it('handles empty input', () => {
    assert.equal(cleanTextForTts(''), '');
  });

  it('strips markdown links but keeps text', () => {
    assert.equal(cleanTextForTts('Click [here](https://example.com) now'), 'Click here now');
  });

  it('strips bullet markers', () => {
    assert.equal(cleanTextForTts('- item one\n- item two'), 'item one\nitem two');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn mocha extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `extensions/openspace-voice/src/common/text-cleanup.ts`:

```typescript
// extensions/openspace-voice/src/common/text-cleanup.ts

/**
 * Clean text for TTS narration by stripping markdown, code, URLs, etc.
 * Produces plain spoken-language text.
 */
export function cleanTextForTts(text: string): string {
  let result = text;

  // Strip fenced code blocks (``` ... ```)
  result = result.replace(/```[\s\S]*?```/g, '');

  // Strip markdown links [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Strip URLs
  result = result.replace(/https?:\/\/[^\s)]+/g, '');

  // Strip inline code
  result = result.replace(/`([^`]*)`/g, '$1');

  // Strip markdown headers (## etc.)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Strip bold/italic markers
  result = result.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1');
  result = result.replace(/_{1,3}(.*?)_{1,3}/g, '$1');

  // Strip bullet markers
  result = result.replace(/^[-*+]\s+/gm, '');

  // Collapse multiple whitespace (but preserve single newlines)
  result = result.replace(/[^\S\n]+/g, ' ');

  // Collapse multiple blank lines into one newline
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
```

**Step 4: Run test to verify it passes**

Run: `yarn mocha extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/common/text-cleanup.ts extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts
git commit -m "feat(voice): add cleanTextForTts utility with tests"
```

---

### Task 2: Simplify backend `narrateText` to use regex cleanup instead of LLM preprocessor

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-backend-service.ts`
- Modify: `extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`

**Step 1: Update the test to reflect the new behavior**

The `narrateText` method should now:
- Call `cleanTextForTts` instead of `NarrationPreprocessor`
- Return a single speech segment with cleaned text
- Still respect `narrate-off`

Update `voice-backend-service.spec.ts` — add a test that verifies markdown is stripped:

```typescript
it('narrateText strips markdown before sending to TTS', async () => {
  const result = await service.narrateText({
    text: 'This is **bold** and `code`',
    mode: 'narrate-everything',
    voice: 'af_sarah',
    speed: 1.0,
  });
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].type, 'speech');
  // Audio should be present (from mock TTS)
  assert.isString(result.segments[0].audioBase64);
});
```

**Step 2: Run test to verify current state**

Run: `yarn mocha extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`

**Step 3: Rewrite `narrateText` in `voice-backend-service.ts`**

Replace the `NarrationPreprocessor` usage with direct `cleanTextForTts` call:

```typescript
import { cleanTextForTts } from '../common/text-cleanup';
```

Replace `narrateText` body:
- Remove `NarrationPreprocessor` field and constructor wiring
- `cleanTextForTts(request.text)` → if empty after cleanup, return `{ segments: [] }`
- Otherwise send cleaned text to TTS → return single speech segment
- Remove all `[DIAG]` logging

**Step 4: Run tests**

Run: `yarn mocha extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/node/voice-backend-service.ts extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts
git commit -m "refactor(voice): replace LLM preprocessor with regex text cleanup in narrateText"
```

---

### Task 3: Clean up `voice-hub-contribution.ts` — remove DIAG logging and unused LLM wiring

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-hub-contribution.ts`

**Step 1: Remove `[DIAG]` console.log lines from the `/narrate` handler**

Remove lines 72, 79-85 (the diagnostic logging).

**Step 2: Clean up LLM caller wiring**

If `VoiceBackendService` no longer needs `llmCaller`, remove:
- The `realLlmCaller` variable
- The `callOpenCodeLlm` function and its helper functions (`httpPost`, `httpGet`, `httpDelete`, `sleep`)
- The `LlmCaller` import

Keep the import of `VoiceBackendService` and update the constructor call to not pass `llmCaller`.

**Step 3: Run tests to make sure nothing breaks**

Run: `yarn mocha extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add extensions/openspace-voice/src/node/voice-hub-contribution.ts
git commit -m "chore(voice): remove DIAG logging and unused LLM caller from hub"
```

---

### Task 4: Rewrite frontend narration trigger with MutationObserver

**Files:**
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`

This is the core fix. Replace all streaming/store machinery with a DOM observer.

**Step 1: Rewrite the NarrationFsm binding**

Replace the entire block from `bind(NarrationFsm).toDynamicValue(...)` (lines 63-176) with:

```typescript
bind(NarrationFsm).toDynamicValue(({ container }) => {
  const sessionFsm = container.get(SessionFsm);
  const narrationFsm = new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
    onEmotionChange: (emotion) => {
      try {
        const contrib = container.get(VoiceCommandContribution);
        contrib.setEmotion(emotion);
      } catch { /* contribution not yet ready */ }
    },
    onModeChange: (mode) => {
      try {
        const contrib = container.get(VoiceCommandContribution);
        contrib.setVoiceMode(mode);
      } catch { /* contribution not yet ready */ }
    },
  });

  // DOM-based narration trigger: observe when assistant messages finish streaming
  let lastNarratedMessageId: string | null = null;

  const setupObserver = (): void => {
    const timeline = document.querySelector('.message-timeline-content');
    if (!timeline) {
      // Chat not rendered yet — retry after a short delay
      setTimeout(setupObserver, 1000);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
        const target = mutation.target as HTMLElement;
        if (!target.matches?.('article.message-bubble-assistant')) continue;

        // We care about the streaming class being REMOVED (message is now complete)
        const wasStreaming = (mutation.oldValue ?? '').includes('message-bubble-streaming');
        const isStreaming = target.classList.contains('message-bubble-streaming');
        if (!wasStreaming || isStreaming) continue;

        // Message just finished streaming
        const messageId = target.getAttribute('data-message-id');
        if (!messageId || messageId === lastNarratedMessageId) continue;

        // Check voice state
        if (sessionFsm.state === 'inactive') continue;
        if (sessionFsm.policy.narrationMode === 'narrate-off') continue;

        // Extract text from rendered DOM (skip code blocks)
        const mdBodies = target.querySelectorAll('.message-bubble-content .part-text .md-body');
        const text = Array.from(mdBodies)
          .map(el => (el as HTMLElement).textContent ?? '')
          .join('\n')
          .trim();

        if (!text) continue;

        lastNarratedMessageId = messageId;
        console.log('[Voice] Narrating message', messageId, '- text length:', text.length);
        narrationFsm.enqueue({
          text,
          mode: sessionFsm.policy.narrationMode,
          voice: sessionFsm.policy.voice,
          speed: sessionFsm.policy.speed,
        });
      }
    });

    observer.observe(timeline, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
      subtree: true,
    });

    console.log('[Voice] DOM narration observer attached');
  };

  // Start observing once DOM is ready
  if (document.readyState === 'complete') {
    setupObserver();
  } else {
    window.addEventListener('load', setupObserver);
  }

  return narrationFsm;
}).inSingletonScope();
```

**Step 2: Remove unused imports**

Remove the `SessionService` import (line 6) since we no longer need it.

**Step 3: TypeScript compile**

Run: `yarn --cwd extensions/openspace-voice build`
Expected: No errors

**Step 4: Commit**

```bash
git add extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
git commit -m "fix(voice): replace streaming-event narration trigger with DOM MutationObserver"
```

---

### Task 5: Build webpack bundle and restart server

**Files:** No source changes — build step only.

**Step 1: Check which directory Theia is serving from**

Run: `ps aux | grep main.js`
Confirm it's serving from `/Users/Shared/dev/theia-openspace/browser-app/`.

**Step 2: Compile TypeScript for the voice extension**

Run: `yarn --cwd extensions/openspace-voice build`

**Step 3: Build webpack bundle**

Run: `yarn --cwd browser-app webpack --config webpack.config.js --mode development`

**Step 4: Restart the Theia server**

Kill the existing process and restart:
```bash
kill <pid>
yarn --cwd browser-app start --hostname=0.0.0.0 --port=3000 &
```

**Step 5: Verify server responds**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: 200

---

### Task 6: Manual integration test

**Step 1: Open browser to http://localhost:3000**

**Step 2: Enable voice narration**

Use the voice policy wizard or status bar to set narration mode to `narrate-everything`.

**Step 3: Send a message to the assistant**

Type a question and wait for the full response.

**Step 4: Check browser console for `[Voice] Narrating message` log**

This confirms the DOM observer triggered correctly.

**Step 5: Check server log for `/narrate received text`**

Confirm the full text (not truncated) arrived at the backend.

**Step 6: Verify audio plays from the beginning of the message**

The narration should read the complete response from the start.

---

### Task 7: Clean up diagnostic artifacts

**Files:**
- Delete: `test-tts-standalone.js` (if still present)
- Modify: `extensions/openspace-voice/src/node/narration-preprocessor.ts` — remove `[DIAG]` logging (keep file for future use)

**Step 1: Remove remaining `[DIAG]` logging**

Check `narration-preprocessor.ts` lines 31, 42 — remove those console.log lines.

**Step 2: Delete standalone test script**

```bash
rm -f test-tts-standalone.js
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(voice): remove diagnostic logging and test artifacts"
```

---

### Task 8: Run full unit test suite

**Step 1: Run all voice extension unit tests**

Run: `yarn mocha 'extensions/openspace-voice/src/__tests__/*.spec.ts'`
Expected: All tests pass (some existing narration-preprocessor tests may need adjustment since the backend no longer calls it — check and fix if needed).

**Step 2: Run full project unit tests**

Run: `yarn test:unit`
Expected: Pass (with known pre-existing failures in TurnGroup streaming ×4, AudioFsm ×2)

**Step 3: Fix any test failures and commit**

```bash
git add -A
git commit -m "test(voice): update tests for simplified narration pipeline"
```
