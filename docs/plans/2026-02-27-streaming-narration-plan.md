# Streaming Narration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Start TTS audio within ~1s of a streaming agent response, by embedding a `[NARRATION_SUMMARY]` tag at the head of every response and extracting it live as tokens arrive — zero second LLM call.

**Architecture:** A new `NarrationTagExtractor` state machine processes streaming text deltas and fires a callback the moment the closing `[/NARRATION_SUMMARY]` tag is seen. The voice frontend module subscribes to `onMessageStreaming` deltas instead of waiting for `isDone:true`. The chat renderer strips the tag block from display. The hub system prompt instructs every agent to emit the tag.

**Tech Stack:** TypeScript, Mocha/Chai, Theia browser extension, existing `NarrationFsm`, existing `POST /narrate` endpoint.

---

## Pre-flight

Before starting, confirm which directory Theia is serving from:

```bash
ps aux | grep main.js
```

If it's a worktree (`.worktrees/<name>/`), all build steps below must run in that worktree directory instead of the repo root.

---

## Task 1: NarrationTagExtractor — state machine + tests

**Files:**
- Create: `extensions/openspace-voice/src/common/narration-tag-extractor.ts`
- Create: `extensions/openspace-voice/src/__tests__/narration-tag-extractor.spec.ts`

---

### Step 1: Write the failing tests

Create `extensions/openspace-voice/src/__tests__/narration-tag-extractor.spec.ts`:

```typescript
// extensions/openspace-voice/src/__tests__/narration-tag-extractor.spec.ts
import { assert } from 'chai';
import { NarrationTagExtractor } from '../common/narration-tag-extractor';

describe('NarrationTagExtractor', () => {
  let extractor: NarrationTagExtractor;
  let summaries: string[];
  let tagsSeen: boolean[];

  beforeEach(() => {
    summaries = [];
    tagsSeen = [];
    extractor = new NarrationTagExtractor({
      onSummaryReady: (text) => summaries.push(text),
    });
  });

  it('extracts summary when tags arrive in one delta', () => {
    extractor.feed('[NARRATION_SUMMARY]\nI fixed the bug.\n[/NARRATION_SUMMARY]\n\nFull answer...');
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0], 'I fixed the bug.');
  });

  it('extracts summary when tags are split across multiple deltas', () => {
    extractor.feed('[NARR');
    extractor.feed('ATION_SUMMARY]\n');
    extractor.feed('The build is passing');
    extractor.feed(' now.\n[/NARRATION_SUMMARY]');
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0], 'The build is passing now.');
  });

  it('fires callback exactly once even if more text follows', () => {
    extractor.feed('[NARRATION_SUMMARY]\nDone.\n[/NARRATION_SUMMARY]\nMore text.\nEven more.');
    assert.equal(summaries.length, 1);
  });

  it('does not fire if closing tag never arrives', () => {
    extractor.feed('[NARRATION_SUMMARY]\nPartial summary...');
    assert.equal(summaries.length, 0);
  });

  it('does not fire if no tags present at all', () => {
    extractor.feed('Just a normal response with no tags.');
    assert.equal(summaries.length, 0);
  });

  it('trims whitespace from extracted summary', () => {
    extractor.feed('[NARRATION_SUMMARY]\n  \n  Hello world.  \n\n[/NARRATION_SUMMARY]');
    assert.equal(summaries[0], 'Hello world.');
  });

  it('hasSummary returns false before tag closes', () => {
    extractor.feed('[NARRATION_SUMMARY]\nPartial...');
    assert.isFalse(extractor.hasSummary);
  });

  it('hasSummary returns true after tag closes', () => {
    extractor.feed('[NARRATION_SUMMARY]\nDone.\n[/NARRATION_SUMMARY]');
    assert.isTrue(extractor.hasSummary);
  });

  it('reset() clears state so a new message can be processed', () => {
    extractor.feed('[NARRATION_SUMMARY]\nFirst.\n[/NARRATION_SUMMARY]');
    extractor.reset();
    extractor.feed('[NARRATION_SUMMARY]\nSecond.\n[/NARRATION_SUMMARY]');
    assert.equal(summaries.length, 2);
    assert.equal(summaries[1], 'Second.');
  });

  it('handles opening tag split at boundary character', () => {
    extractor.feed('[NARRATION_SUM');
    extractor.feed('MARY]\nSplit open.\n[/NARRATION_SUMMARY]');
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0], 'Split open.');
  });
});
```

### Step 2: Run tests to verify they fail

```bash
yarn --cwd extensions/openspace-voice test --grep "NarrationTagExtractor"
```

Expected: compile error or "NarrationTagExtractor is not a constructor"

### Step 3: Implement NarrationTagExtractor

Create `extensions/openspace-voice/src/common/narration-tag-extractor.ts`:

```typescript
// extensions/openspace-voice/src/common/narration-tag-extractor.ts

const OPEN_TAG = '[NARRATION_SUMMARY]';
const CLOSE_TAG = '[/NARRATION_SUMMARY]';

export interface NarrationTagExtractorOptions {
  /** Fired once when [/NARRATION_SUMMARY] is seen. Text is trimmed. */
  onSummaryReady: (summaryText: string) => void;
}

/**
 * Stateful streaming parser for [NARRATION_SUMMARY]...[/NARRATION_SUMMARY].
 *
 * Call feed() with each delta as it arrives. The extractor accumulates a buffer
 * and fires onSummaryReady exactly once when the closing tag is detected.
 *
 * Call reset() between messages to clear state.
 */
export class NarrationTagExtractor {
  private buffer = '';
  private _hasSummary = false;

  constructor(private readonly options: NarrationTagExtractorOptions) {}

  get hasSummary(): boolean {
    return this._hasSummary;
  }

  reset(): void {
    this.buffer = '';
    this._hasSummary = false;
  }

  feed(delta: string): void {
    // Once summary is extracted, ignore all further input
    if (this._hasSummary) return;

    this.buffer += delta;
    this.tryExtract();
  }

  private tryExtract(): void {
    const openIdx = this.buffer.indexOf(OPEN_TAG);
    if (openIdx === -1) {
      // No open tag yet — keep only a tail long enough to detect a split tag
      // (max tag length is OPEN_TAG.length - 1 = 18 chars)
      const keepLen = OPEN_TAG.length - 1;
      if (this.buffer.length > keepLen) {
        this.buffer = this.buffer.slice(-keepLen);
      }
      return;
    }

    const contentStart = openIdx + OPEN_TAG.length;
    const closeIdx = this.buffer.indexOf(CLOSE_TAG, contentStart);
    if (closeIdx === -1) {
      // Open tag found, waiting for close — keep full buffer
      return;
    }

    // Both tags found — extract and emit
    const raw = this.buffer.slice(contentStart, closeIdx);
    const summary = raw.trim();
    this._hasSummary = true;
    this.options.onSummaryReady(summary);
  }
}
```

### Step 4: Run tests to verify they pass

```bash
yarn --cwd extensions/openspace-voice test --grep "NarrationTagExtractor"
```

Expected: 10 passing

### Step 5: Commit

```bash
git add extensions/openspace-voice/src/common/narration-tag-extractor.ts \
        extensions/openspace-voice/src/__tests__/narration-tag-extractor.spec.ts
git commit -m "feat(voice): add NarrationTagExtractor streaming state machine"
```

---

## Task 2: Strip tag from chat UI display

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble/content-part-renderer.tsx`

The `TextPart` component renders message text via `renderMarkdown`. We must strip `[NARRATION_SUMMARY]...[/NARRATION_SUMMARY]` from the text before it reaches the markdown renderer.

---

### Step 1: Write the failing test

Add a test to verify the strip. Check the existing test file for TextPart, or add inline. Since TextPart is a React component (browser), we test the pure stripping logic separately.

Create `extensions/openspace-chat/src/__tests__/narration-tag-strip.spec.ts`:

```typescript
// extensions/openspace-chat/src/__tests__/narration-tag-strip.spec.ts
import { assert } from 'chai';
import { stripNarrationTag } from '../browser/message-bubble/content-part-renderer';

describe('stripNarrationTag', () => {
  it('removes the full tag block from text', () => {
    const input = '[NARRATION_SUMMARY]\nI fixed the bug.\n[/NARRATION_SUMMARY]\n\nFull answer here.';
    assert.equal(stripNarrationTag(input), 'Full answer here.');
  });

  it('returns unchanged text when no tag present', () => {
    const input = 'Just a normal response.';
    assert.equal(stripNarrationTag(input), 'Just a normal response.');
  });

  it('handles tag at start with no trailing newline', () => {
    const input = '[NARRATION_SUMMARY]\nSummary.[/NARRATION_SUMMARY]Answer.';
    assert.equal(stripNarrationTag(input), 'Answer.');
  });

  it('returns empty string when entire text is a tag block', () => {
    const input = '[NARRATION_SUMMARY]\nOnly summary.\n[/NARRATION_SUMMARY]';
    assert.equal(stripNarrationTag(input), '');
  });
});
```

### Step 2: Run test to verify it fails

```bash
yarn --cwd extensions/openspace-chat test --grep "stripNarrationTag"
```

Expected: "stripNarrationTag is not a function"

### Step 3: Implement stripNarrationTag and apply in TextPart

Edit `extensions/openspace-chat/src/browser/message-bubble/content-part-renderer.tsx`.

After the imports at the top (line 22), add the export:

```typescript
const NARRATION_TAG_RE = /\[NARRATION_SUMMARY\][\s\S]*?\[\/NARRATION_SUMMARY\]\n?/g;

/**
 * Remove [NARRATION_SUMMARY]...[/NARRATION_SUMMARY] blocks from display text.
 * These are agent-generated narration hints, not part of the user-visible answer.
 */
export function stripNarrationTag(text: string): string {
  return text.replace(NARRATION_TAG_RE, '').trimStart();
}
```

Then in `TextPart` (line 72), change:

```typescript
  const text: string = part.text || '';
```

to:

```typescript
  const text: string = stripNarrationTag(part.text || '');
```

### Step 4: Run test to verify it passes

```bash
yarn --cwd extensions/openspace-chat test --grep "stripNarrationTag"
```

Expected: 4 passing

### Step 5: Rebuild webpack bundle (browser extension changed)

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

### Step 6: Commit

```bash
git add extensions/openspace-chat/src/browser/message-bubble/content-part-renderer.tsx \
        extensions/openspace-chat/src/__tests__/narration-tag-strip.spec.ts
git commit -m "feat(chat): strip [NARRATION_SUMMARY] tag block from chat display"
```

---

## Task 3: Add narration format to system prompt

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts:335-408`

---

### Step 1: Write the test

Add a test that `generateInstructions()` output includes the narration format block.

Check if there's an existing test file for hub.ts:

```bash
ls extensions/openspace-core/src/__tests__/
```

If `hub.spec.ts` exists, add a test there. If not, the hub is tested via E2E — add a unit test by extracting the relevant logic.

Add to an appropriate test file (or create `extensions/openspace-core/src/__tests__/hub-instructions.spec.ts`):

```typescript
// extensions/openspace-core/src/__tests__/hub-instructions.spec.ts
import { assert } from 'chai';

// We test the narration instruction string directly since generateInstructions is private.
// Import the exported constant instead.
import { NARRATION_FORMAT_INSTRUCTION } from '../node/hub';

describe('Hub narration format instruction', () => {
  it('includes the opening tag pattern', () => {
    assert.include(NARRATION_FORMAT_INSTRUCTION, '[NARRATION_SUMMARY]');
  });

  it('includes the closing tag pattern', () => {
    assert.include(NARRATION_FORMAT_INSTRUCTION, '[/NARRATION_SUMMARY]');
  });

  it('instructs the model to write summary first', () => {
    assert.match(NARRATION_FORMAT_INSTRUCTION, /first|before/i);
  });
});
```

### Step 2: Run test to verify it fails

```bash
yarn --cwd extensions/openspace-core test --grep "Hub narration"
```

Expected: "NARRATION_FORMAT_INSTRUCTION is not exported"

### Step 3: Export the constant and append to generateInstructions

In `extensions/openspace-core/src/node/hub.ts`, add the exported constant just before the `Hub` class:

```typescript
/**
 * System prompt block instructing the agent to emit a narration summary tag
 * at the start of every response. Detected by NarrationTagExtractor in the
 * voice extension for zero-latency TTS trigger.
 */
export const NARRATION_FORMAT_INSTRUCTION = `
## Voice Narration Format

When responding, begin with a 1–2 sentence spoken summary in this exact format:

[NARRATION_SUMMARY]
<summary — plain spoken English, no markdown, no code, no lists, max 30 words>
[/NARRATION_SUMMARY]

Write the summary FIRST, before the full answer. Use conversational language
("I've fixed the bug", "The build is failing because..."). Follow immediately
with the full answer in normal markdown format.
`;
```

Then at the end of `generateInstructions()` (before `return instructions;` at line 408):

```typescript
    instructions += NARRATION_FORMAT_INSTRUCTION;

    return instructions;
```

### Step 4: Run test to verify it passes

```bash
yarn --cwd extensions/openspace-core test --grep "Hub narration"
```

Expected: 3 passing

### Step 5: Commit

```bash
git add extensions/openspace-core/src/node/hub.ts \
        extensions/openspace-core/src/__tests__/hub-instructions.spec.ts
git commit -m "feat(hub): add [NARRATION_SUMMARY] format instruction to system prompt"
```

---

## Task 4: Wire tag extractor into voice frontend module

**Files:**
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`

This is the most important task. Replace the current DOM MutationObserver approach with a dual-path approach:
1. **Fast path**: Subscribe to `onMessageStreaming` deltas. Run NarrationTagExtractor. Fire TTS as soon as summary tag closes.
2. **Fallback path**: On `isDone:true`, if no summary was seen, fall back to current behavior (full text → `POST /narrate`).

---

### Step 1: Understand the imports needed

The module needs access to `SessionService` (for `onMessageStreaming`). Currently the module uses DOM observation. We need to inject `CoreSessionService` from `openspace-core`.

Check what's already available in the voice container:

```bash
grep -r "CoreSessionService\|ISessionService\|SessionService" extensions/openspace-voice/src/ --include="*.ts"
```

If `SessionService` is not yet imported in the voice module, it needs to be injected. The binding exists in `openspace-core`'s frontend module.

### Step 2: Write the test for the streaming trigger logic

Since the wiring is browser-side DI, test the logic of the tag extractor integration in isolation. The key logic to test is the "message accumulation and tag detection + fallback" flow.

Add `extensions/openspace-voice/src/__tests__/streaming-narration-trigger.spec.ts`:

```typescript
// extensions/openspace-voice/src/__tests__/streaming-narration-trigger.spec.ts
import { assert } from 'chai';
import { NarrationTagExtractor } from '../common/narration-tag-extractor';

/**
 * Tests the trigger logic used in the voice frontend module.
 * We test the core decision logic (not the DI wiring).
 */
describe('Streaming narration trigger logic', () => {
  it('fires fast path when summary tag completes mid-stream', () => {
    const fired: string[] = [];
    const extractor = new NarrationTagExtractor({
      onSummaryReady: (text) => fired.push(text),
    });

    // Simulate streaming deltas
    extractor.feed('[NARRATION_SUMMARY]\n');
    extractor.feed('I fixed the authentication bug.');
    extractor.feed('\n[/NARRATION_SUMMARY]\n\n## Full answer\n\nHere are the');
    extractor.feed(' details...');

    assert.equal(fired.length, 1, 'should fire exactly once');
    assert.equal(fired[0], 'I fixed the authentication bug.');
  });

  it('does not double-fire if isDone arrives after tag was already extracted', () => {
    const fired: string[] = [];
    const extractor = new NarrationTagExtractor({
      onSummaryReady: (text) => fired.push(text),
    });

    extractor.feed('[NARRATION_SUMMARY]\nDone.\n[/NARRATION_SUMMARY]\nFull text.');

    // Simulate isDone:true arriving — the caller should check extractor.hasSummary
    // before deciding whether to enqueue full text narration
    const shouldFallback = !extractor.hasSummary;
    assert.isFalse(shouldFallback, 'should not fall back when summary already extracted');
    assert.equal(fired.length, 1);
  });

  it('falls back when no tag seen and isDone fires', () => {
    const extractor = new NarrationTagExtractor({
      onSummaryReady: () => { /* not called */ },
    });

    extractor.feed('Normal response without any tags.');

    // Simulate isDone:true: caller checks hasSummary
    const shouldFallback = !extractor.hasSummary;
    assert.isTrue(shouldFallback, 'should fall back when no tag seen');
  });
});
```

### Step 3: Run tests to verify they pass (they use only NarrationTagExtractor)

```bash
yarn --cwd extensions/openspace-voice test --grep "Streaming narration trigger"
```

Expected: 3 passing (these are pure logic tests, no DI)

### Step 4: Rewrite the frontend module

Replace `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts` with the following. Read the current file first (already done above) — preserve all existing bindings, change only the narration trigger section.

The key change is replacing the DOM MutationObserver block (lines 82–148) with a dual-path approach. Here is the replacement for the `NarrationFsm` binding's DynamicValue body (lines 62–149):

```typescript
  bind(NarrationFsm).toDynamicValue(({ container }) => {
    const sessionFsm = container.get(SessionFsm);
    const narrationFsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
      onEmotionChange: (emotion) => {
        try { container.get(VoiceCommandContribution).setEmotion(emotion); } catch { /* not ready */ }
      },
      onModeChange: (mode) => {
        try { container.get(VoiceCommandContribution).setVoiceMode(mode); } catch { /* not ready */ }
      },
    });

    // Per-message state
    let lastNarratedMessageId: string | null = null;
    let currentMessageId: string | null = null;
    let extractor = new NarrationTagExtractor({
      onSummaryReady: (summaryText: string) => {
        // Fast path: summary tag closed while message is still streaming
        if (!currentMessageId || currentMessageId === lastNarratedMessageId) return;
        if (sessionFsm.state === 'inactive') return;
        if (sessionFsm.policy.narrationMode === 'narrate-off') return;
        if (!summaryText) return;

        lastNarratedMessageId = currentMessageId;
        console.log('[Voice] Fast-path narration from summary tag, messageId:', currentMessageId);
        narrationFsm.enqueue({
          text: summaryText,
          mode: 'narrate-summary', // always use summary mode for the fast-path segment
          voice: sessionFsm.policy.voice,
          speed: sessionFsm.policy.speed,
        });
      },
    });

    // Subscribe to streaming deltas via the session service
    const wireStreamingSubscription = (): void => {
      try {
        const sessionService = container.get<{ onMessageStreaming: { event: any } }>(
          Symbol.for('SessionService')
        );
        if (!sessionService?.onMessageStreaming) {
          setTimeout(wireStreamingSubscription, 500);
          return;
        }

        sessionService.onMessageStreaming.event((update: { messageId: string; delta: string; isDone: boolean }) => {
          const { messageId, delta, isDone } = update;

          // Track message boundaries — reset extractor for new messages
          if (messageId !== currentMessageId) {
            currentMessageId = messageId;
            extractor.reset();
          }

          if (sessionFsm.state === 'inactive') return;
          if (sessionFsm.policy.narrationMode === 'narrate-off') return;

          if (!isDone && delta) {
            // Feed each delta into the extractor — fast path fires via callback
            extractor.feed(delta);
          }

          if (isDone) {
            // Fallback path: if no summary tag was extracted, narrate full text
            if (!extractor.hasSummary && messageId !== lastNarratedMessageId) {
              // Only fall back for narrate-everything (narrate-summary requires the tag)
              if (sessionFsm.policy.narrationMode === 'narrate-everything') {
                // Collect full text from DOM (same as current approach)
                const article = document.querySelector<HTMLElement>(
                  `article.message-bubble-assistant[data-message-id="${messageId}"]`
                );
                if (article) {
                  const mdBodies = article.querySelectorAll('.message-bubble-content .part-text .md-body');
                  const text = Array.from(mdBodies)
                    .map(el => (el as HTMLElement).textContent ?? '')
                    .join('\n')
                    .trim();
                  if (text) {
                    lastNarratedMessageId = messageId;
                    console.log('[Voice] Fallback narration (no tag), messageId:', messageId);
                    narrationFsm.enqueue({
                      text,
                      mode: 'narrate-everything',
                      voice: sessionFsm.policy.voice,
                      speed: sessionFsm.policy.speed,
                    });
                  }
                }
              }
            } else if (extractor.hasSummary && sessionFsm.policy.narrationMode === 'narrate-everything') {
              // narrate-everything + tag seen: also queue the full remainder after summary plays
              // (The summary already fired via the fast path; now queue the full text)
              setTimeout(() => {
                const article = document.querySelector<HTMLElement>(
                  `article.message-bubble-assistant[data-message-id="${messageId}"]`
                );
                if (article) {
                  const mdBodies = article.querySelectorAll('.message-bubble-content .part-text .md-body');
                  const text = Array.from(mdBodies)
                    .map(el => (el as HTMLElement).textContent ?? '')
                    .join('\n')
                    .trim();
                  if (text) {
                    console.log('[Voice] Queueing remainder narration for narrate-everything, messageId:', messageId);
                    narrationFsm.enqueue({
                      text,
                      mode: 'narrate-everything',
                      voice: sessionFsm.policy.voice,
                      speed: sessionFsm.policy.speed,
                    });
                  }
                }
              }, 0);
            }
          }
        });

        console.log('[Voice] Streaming narration subscriber attached');
      } catch {
        // SessionService not yet in container — retry
        setTimeout(wireStreamingSubscription, 500);
      }
    };

    if (document.readyState === 'complete') {
      wireStreamingSubscription();
    } else {
      window.addEventListener('load', wireStreamingSubscription);
    }

    return narrationFsm;
  }).inSingletonScope();
```

Add the import at the top of the file (after the existing imports):

```typescript
import { NarrationTagExtractor } from '../common/narration-tag-extractor';
```

**Important:** Check the exact symbol used for `SessionService` in the core container. Look in:
- `extensions/openspace-core/src/browser/session-service/session-service.ts`
- `extensions/openspace-core/src/browser/opencode-frontend-module.ts`

The symbol may be `CoreOpenCodeServiceSymbols.SessionService` or similar. Update the `Symbol.for(...)` call accordingly.

### Step 5: Build and verify no TypeScript errors

```bash
yarn build 2>&1 | grep -i error | head -30
```

Fix any TypeScript errors before continuing.

### Step 6: Rebuild webpack bundle

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

### Step 7: Manual smoke test

1. Start Theia (if not running): `node browser-app/lib/backend/main.js --port 3000`
2. Open browser at `http://localhost:3000`, hard-refresh (Cmd+Shift+R)
3. Enable voice narration (Ctrl+Shift+V or via command palette)
4. Send a message in chat
5. Verify:
   - Audio starts playing within ~1s of the first tokens appearing
   - The `[NARRATION_SUMMARY]` tag is NOT visible in the chat message bubble
   - Console shows `[Voice] Fast-path narration from summary tag`
   - For models that don't comply: console shows `[Voice] Fallback narration (no tag)` and audio still plays

### Step 8: Commit

```bash
git add extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts \
        extensions/openspace-voice/src/__tests__/streaming-narration-trigger.spec.ts
git commit -m "feat(voice): streaming narration fast-path via [NARRATION_SUMMARY] tag extraction"
```

---

## Task 5: Run full test suite and verify no regressions

### Step 1: Run all voice tests

```bash
yarn --cwd extensions/openspace-voice test
```

Expected: all existing tests pass + new tests pass

### Step 2: Run all tests

```bash
yarn test
```

Expected: 1231+ passing. The 6 known pre-existing failures (TurnGroup streaming ×4, AudioFsm ×2) are acceptable.

### Step 3: If any new failures, fix them before proceeding

Common failure modes:
- TypeScript import errors for `NarrationTagExtractor` (check the path is correct)
- `stripNarrationTag` not exported (check the `export` keyword is present)
- SessionService symbol mismatch (check exact symbol name in core frontend module)

### Step 4: Final commit if any fixes were needed

```bash
git add -A
git commit -m "fix(voice): address test failures from streaming narration changes"
```

---

## Task 6: Update memory files

**Files:**
- Modify: `.opencode/_context/01_memory/active_context.md`
- Modify: `.opencode/_context/01_memory/progress.md`

### Step 1: Update active_context.md

Add a new section for this feature noting it's complete.

### Step 2: Update progress.md

Add a new milestone entry:

```markdown
### Streaming Narration Fast-Path (2026-02-27) -- COMPLETE

Zero-latency TTS via [NARRATION_SUMMARY] tag embedded in agent responses.
Fast path: ~0.6–1.3s to first audio vs previous 10–30s.
Fallback: narrate-everything degrades to current behavior for non-compliant models.

Files changed:
- `narration-tag-extractor.ts` (new)
- `content-part-renderer.tsx` (strip tag from display)
- `hub.ts` (system prompt instruction)
- `openspace-voice-frontend-module.ts` (streaming delta subscriber)
```

### Step 3: Commit

```bash
git add .opencode/_context/01_memory/
git commit -m "docs: update memory files after streaming narration implementation"
```

---

## Verification Checklist

Before considering this done:

- [ ] `NarrationTagExtractor` unit tests pass (10 tests)
- [ ] `stripNarrationTag` unit tests pass (4 tests)
- [ ] Hub instruction test passes (3 tests)
- [ ] Streaming trigger logic tests pass (3 tests)
- [ ] Full test suite: no new failures vs baseline (1231 passing)
- [ ] Manual: audio starts within ~1s for a capable model (Claude/GPT-4)
- [ ] Manual: `[NARRATION_SUMMARY]` tags NOT visible in chat bubble
- [ ] Manual: fallback fires for a response without tags (`narrate-everything` mode)
- [ ] Console: `[Voice] Fast-path narration from summary tag` log appears on fast path
- [ ] Console: no unhandled errors in voice module

---

## Known Edge Cases

| Case | Behavior |
|---|---|
| Model ignores the format instruction | `narrate-everything`: falls back to current path. `narrate-summary`: silent. |
| Tag appears mid-response (not at start) | Still extracted and narrated — the extractor doesn't care about position |
| Very long summary (model doesn't follow 30-word limit) | Still extracted and sent to TTS — Kokoro handles long text, just slower |
| `narrate-off` mode | Tag extractor runs (for UI strip) but `onSummaryReady` callback is gated by mode check |
| Multiple messages arriving rapidly | `currentMessageId` tracking + `extractor.reset()` ensures each message gets a fresh extractor state |
| Tool-only messages (no text parts) | `delta` is empty string on tool part updates — extractor sees no content, no false positives |
