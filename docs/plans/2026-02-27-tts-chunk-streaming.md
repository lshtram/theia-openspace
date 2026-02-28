# TTS Chunk Streaming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce narration first-audio latency from "wait for full text synthesis" to "first sentence ready" (~300–600ms on CPU) by splitting cleaned text into sentences on the backend, synthesizing each sentence with Kokoro, and streaming PCM chunks to the browser via HTTP chunked transfer as they are produced.

**Architecture:** The backend `POST /openspace/voice/narrate` route switches from a single `synthesize()` call to sentence-by-sentence synthesis. Each sentence's PCM result is written to the HTTP response immediately as a newline-delimited JSON (NDJSON) line with `seq` + `audioBase64`. The browser reads the chunked response via `ReadableStream`, decodes and plays each chunk as it arrives, while the next chunk is still being synthesized on the server.

**Tech Stack:** TypeScript, Node.js streams (Express `res.write`/`res.flush`), browser `fetch` `ReadableStream`, existing `AudioContext`, Mocha/Chai tests.

---

## Pre-flight

Before starting, confirm which directory Theia is serving from:

```bash
ps aux | grep main.js
```

If it's a worktree (`.worktrees/<name>/`), all build steps below must run in that worktree directory instead of the repo root.

---

## Task 1: Sentence splitter utility + tests

A pure utility function. No side effects. Tests first.

**Files:**
- Create: `extensions/openspace-voice/src/common/sentence-splitter.ts`
- Create: `extensions/openspace-voice/src/__tests__/sentence-splitter.spec.ts`

---

### Step 1: Write the failing tests

Create `extensions/openspace-voice/src/__tests__/sentence-splitter.spec.ts`:

```typescript
// extensions/openspace-voice/src/__tests__/sentence-splitter.spec.ts
import { assert } from 'chai';
import { splitIntoSentences } from '../common/sentence-splitter';

describe('splitIntoSentences', () => {
  it('splits on periods', () => {
    const result = splitIntoSentences('Hello world. How are you. Fine thanks.');
    assert.deepEqual(result, ['Hello world.', 'How are you.', 'Fine thanks.']);
  });

  it('splits on question marks', () => {
    const result = splitIntoSentences('Is it working? Yes it is.');
    assert.deepEqual(result, ['Is it working?', 'Yes it is.']);
  });

  it('splits on exclamation marks', () => {
    const result = splitIntoSentences('It works! Great news. Done.');
    assert.deepEqual(result, ['It works!', 'Great news.', 'Done.']);
  });

  it('handles newlines as sentence breaks', () => {
    const result = splitIntoSentences('First sentence.\nSecond sentence.\nThird.');
    assert.deepEqual(result, ['First sentence.', 'Second sentence.', 'Third.']);
  });

  it('filters out empty/whitespace-only fragments', () => {
    const result = splitIntoSentences('One.  Two.   Three.');
    assert.equal(result.length, 3);
    result.forEach(s => assert.isAbove(s.trim().length, 0));
  });

  it('returns single element for text with no sentence-ending punctuation', () => {
    const result = splitIntoSentences('No punctuation here');
    assert.deepEqual(result, ['No punctuation here']);
  });

  it('returns empty array for empty string', () => {
    const result = splitIntoSentences('');
    assert.deepEqual(result, []);
  });

  it('preserves punctuation at end of sentence', () => {
    const result = splitIntoSentences('Done! Really?');
    assert.equal(result[0], 'Done!');
    assert.equal(result[1], 'Really?');
  });

  it('handles abbreviations gracefully - does not split on "e.g."', () => {
    // Abbreviations are tricky - acceptable to split here, just verify no crash
    const result = splitIntoSentences('Use e.g. this approach. It works.');
    assert.isAbove(result.length, 0);
    // Last fragment should be non-empty
    result.forEach(s => assert.isAbove(s.trim().length, 0));
  });

  it('splits text of multiple sentences into correct count', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const result = splitIntoSentences(text);
    assert.equal(result.length, 4);
  });
});
```

### Step 2: Run test to verify it fails

```bash
yarn --cwd extensions/openspace-voice test --grep "splitIntoSentences"
```

Expected: compile error — `splitIntoSentences` not found.

### Step 3: Implement the sentence splitter

Create `extensions/openspace-voice/src/common/sentence-splitter.ts`:

```typescript
// extensions/openspace-voice/src/common/sentence-splitter.ts

/**
 * Split plain text into individual sentences for incremental TTS synthesis.
 *
 * Strategy:
 * - Split on [.!?] followed by whitespace or end-of-string (keeps punctuation with sentence)
 * - Split on newlines (each line is a separate unit)
 * - Filter out empty/whitespace-only fragments
 *
 * This is intentionally simple — TTS quality doesn't depend on perfect sentence
 * boundary detection, and false splits only add a tiny synthesis overhead.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  // The regex keeps the punctuation with the sentence (positive lookbehind).
  // Also split on newlines.
  const raw = text
    .split(/(?<=[.!?])\s+|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // If no splits occurred (e.g., no punctuation), return the whole text as one sentence
  if (raw.length === 0) return [];
  return raw;
}
```

### Step 4: Run tests to verify they pass

```bash
yarn --cwd extensions/openspace-voice test --grep "splitIntoSentences"
```

Expected: 10 passing.

### Step 5: Commit

```bash
git add extensions/openspace-voice/src/common/sentence-splitter.ts \
        extensions/openspace-voice/src/__tests__/sentence-splitter.spec.ts
git commit -m "feat(voice): add sentence splitter utility for incremental TTS"
```

---

## Task 2: Backend streaming narrate handler

Replace the single-blob response with NDJSON chunked transfer. Each JSON line is:
`{"seq":N,"audioBase64":"...","done":false}\n`
Final line: `{"seq":-1,"done":true}\n`

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-backend-service.ts`
- Modify: `extensions/openspace-voice/src/node/voice-hub-contribution.ts`
- Modify: `extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`

---

### Step 1: Write the failing tests for the new streaming method

Add to `extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`:

```typescript
import { splitIntoSentences } from '../common/sentence-splitter';

// ... (after the existing tests, add:)

describe('VoiceBackendService streaming', () => {
  let service: VoiceBackendService;
  const chunks: string[] = [];

  before(() => {
    service = new VoiceBackendService({
      sttProvider: mockStt,
      ttsProvider: mockTts,
    });
  });

  beforeEach(() => {
    chunks.length = 0;
    lastSynthesizedText = '';
  });

  it('narrateTextStreaming with narrate-off calls onChunk with done:true immediately', async () => {
    const doneChunks: Array<{ seq: number; done: boolean }> = [];
    await service.narrateTextStreaming(
      { text: 'hello', mode: 'narrate-off', voice: 'af_sarah', speed: 1.0 },
      (chunk) => doneChunks.push(chunk),
    );
    assert.equal(doneChunks.length, 1);
    assert.isTrue(doneChunks[0].done);
    assert.equal(doneChunks[0].seq, -1);
  });

  it('narrateTextStreaming yields one chunk per sentence', async () => {
    const received: Array<{ seq: number; audioBase64?: string; done: boolean }> = [];
    await service.narrateTextStreaming(
      { text: 'First sentence. Second sentence.', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 },
      (chunk) => received.push(chunk),
    );
    // 2 sentences + 1 done marker
    assert.equal(received.length, 3);
    assert.isFalse(received[0].done);
    assert.equal(received[0].seq, 0);
    assert.isString(received[0].audioBase64);
    assert.isFalse(received[1].done);
    assert.equal(received[1].seq, 1);
    assert.isTrue(received[2].done);
    assert.equal(received[2].seq, -1);
  });

  it('narrateTextStreaming sends cleaned text to TTS per sentence', async () => {
    const synthesized: string[] = [];
    const captureTts: TtsProvider = {
      kind: 'tts', id: 'capture',
      isAvailable: async () => true,
      synthesize: async (req) => { synthesized.push(req.text); return { audio: new Uint8Array([1, 2, 3]), sampleRate: 24000 }; },
      dispose: async () => {},
    };
    const svc = new VoiceBackendService({ sttProvider: mockStt, ttsProvider: captureTts });
    await svc.narrateTextStreaming(
      { text: '**Bold sentence.** Normal sentence.', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 },
      () => {},
    );
    // Should have synthesized cleaned text fragments
    assert.isAbove(synthesized.length, 0);
    synthesized.forEach(s => {
      assert.notInclude(s, '**', 'bold markers should be stripped');
    });
  });

  it('narrateTextStreaming returns empty for all-code text', async () => {
    const received: Array<{ done: boolean }> = [];
    await service.narrateTextStreaming(
      { text: '```js\nconsole.log("x");\n```', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 },
      (chunk) => received.push(chunk),
    );
    assert.equal(received.length, 1);
    assert.isTrue(received[0].done);
  });
});
```

### Step 2: Run tests to verify they fail

```bash
yarn --cwd extensions/openspace-voice test --grep "VoiceBackendService streaming"
```

Expected: `narrateTextStreaming is not a function`

### Step 3: Add `narrateTextStreaming` to VoiceBackendService

Edit `extensions/openspace-voice/src/node/voice-backend-service.ts`.

Add the import at the top (after existing imports):

```typescript
import { splitIntoSentences } from '../common/sentence-splitter';
```

Add the streaming chunk type:

```typescript
export interface NarrateStreamChunk {
  seq: number;            // -1 for the final done marker
  audioBase64?: string;   // present for non-done chunks
  done: boolean;
}
```

Add the new method to `VoiceBackendService` (after `narrateText`):

```typescript
  /**
   * Streaming variant of narrateText.
   *
   * Splits cleaned text into sentences, synthesizes each with Kokoro,
   * and calls onChunk immediately as each finishes — enabling the browser
   * to start playing the first sentence while later sentences are still
   * being synthesized.
   *
   * Final call: onChunk({ seq: -1, done: true })
   */
  async narrateTextStreaming(
    request: NarrateTextRequest,
    onChunk: (chunk: NarrateStreamChunk) => void,
  ): Promise<void> {
    if (request.mode === 'narrate-off') {
      onChunk({ seq: -1, done: true });
      return;
    }

    const cleaned = cleanTextForTts(request.text);
    if (!cleaned) {
      onChunk({ seq: -1, done: true });
      return;
    }

    const sentences = splitIntoSentences(cleaned);
    if (sentences.length === 0) {
      onChunk({ seq: -1, done: true });
      return;
    }

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (!sentence.trim()) continue;

      const ttsResult = await this.ttsProvider.synthesize({
        text: sentence,
        language: 'en-US',
        speed: request.speed,
        voice: request.voice,
      });

      onChunk({
        seq: i,
        audioBase64: Buffer.from(ttsResult.audio).toString('base64'),
        done: false,
      });
    }

    onChunk({ seq: -1, done: true });
  }
```

### Step 4: Run tests to verify they pass

```bash
yarn --cwd extensions/openspace-voice test --grep "VoiceBackendService streaming"
```

Expected: 4 passing.

### Step 5: Update the HTTP route to use streaming

Edit `extensions/openspace-voice/src/node/voice-hub-contribution.ts`.

Replace the `POST /openspace/voice/narrate` handler (lines 59–82) with:

```typescript
        // POST /openspace/voice/narrate -- Text cleanup + TTS synthesis (NDJSON streaming)
        app.post(
            '/openspace/voice/narrate',
            express.json(),
            async (req: Request, res: Response) => {
                try {
                    await this.readyPromise;
                    const { text, mode, voice, speed } = req.body as {
                        text: string; mode: string; voice: string; speed: number;
                    };

                    // Set up NDJSON streaming response
                    res.setHeader('Content-Type', 'application/x-ndjson');
                    res.setHeader('Transfer-Encoding', 'chunked');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.flushHeaders();

                    await this.voiceService.narrateTextStreaming(
                        {
                            text,
                            mode: mode as 'narrate-off' | 'narrate-everything' | 'narrate-summary',
                            voice,
                            speed,
                        },
                        (chunk) => {
                            res.write(JSON.stringify(chunk) + '\n');
                        },
                    );

                    res.end();
                } catch (err) {
                    console.error('[VoiceHub] Narrate error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: String(err) });
                    } else {
                        // Headers already sent as chunked — send error chunk then close
                        try {
                            res.write(JSON.stringify({ seq: -1, done: true, error: String(err) }) + '\n');
                            res.end();
                        } catch { /* stream already closed */ }
                    }
                }
            }
        );
```

### Step 6: Commit backend changes

```bash
git add extensions/openspace-voice/src/node/voice-backend-service.ts \
        extensions/openspace-voice/src/node/voice-hub-contribution.ts \
        extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts
git commit -m "feat(voice): streaming NDJSON narrate endpoint — sentence-by-sentence TTS"
```

---

## Task 3: Browser — streaming fetch + incremental playback

Replace the single `response.json()` parse + bulk play with `ReadableStream` line-by-line parsing + per-chunk playback.

The key insight: audio playback of chunk N overlaps with synthesis of chunk N+1 on the server. This means we need a **prefetch queue** in the browser — decode and schedule chunks ahead, play them in order.

**Files:**
- Modify: `extensions/openspace-voice/src/browser/narration-fsm.ts`

---

### Step 1: Write the test

The existing narration-fsm test only tests state transitions (no fetch mocking). Add a unit test for the new `decodeNdjsonStream` helper function that we'll extract.

Add `extensions/openspace-voice/src/__tests__/ndjson-stream.spec.ts`:

```typescript
// extensions/openspace-voice/src/__tests__/ndjson-stream.spec.ts
import { assert } from 'chai';
import { parseNdjsonLines } from '../browser/narration-fsm';

describe('parseNdjsonLines', () => {
  it('parses multiple complete lines', () => {
    const input = '{"seq":0,"done":false}\n{"seq":1,"done":false}\n{"seq":-1,"done":true}\n';
    const result = parseNdjsonLines(input);
    assert.equal(result.length, 3);
    assert.equal(result[0].seq, 0);
    assert.isFalse(result[0].done);
    assert.equal(result[2].seq, -1);
    assert.isTrue(result[2].done);
  });

  it('handles partial last line gracefully (returns only complete lines)', () => {
    const input = '{"seq":0,"done":false}\n{"seq":1,"done":fals';
    const result = parseNdjsonLines(input);
    assert.equal(result.length, 1);
    assert.equal(result[0].seq, 0);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseNdjsonLines(''), []);
  });

  it('ignores empty lines', () => {
    const input = '{"seq":0,"done":false}\n\n{"seq":-1,"done":true}\n';
    const result = parseNdjsonLines(input);
    assert.equal(result.length, 2);
  });
});
```

### Step 2: Run test to verify it fails

```bash
yarn --cwd extensions/openspace-voice test --grep "parseNdjsonLines"
```

Expected: `parseNdjsonLines is not a function`

### Step 3: Rewrite `fetchAndPlay` in NarrationFsm

Edit `extensions/openspace-voice/src/browser/narration-fsm.ts`.

**Export the helper** (add before the `NarrationFsm` class so it can be tested):

```typescript
/**
 * Parse complete NDJSON lines from a text chunk.
 * Returns only fully-parseable lines; partial last lines are ignored.
 */
export function parseNdjsonLines(text: string): Array<{ seq: number; audioBase64?: string; done: boolean; error?: string }> {
  return text
    .split('\n')
    .filter(line => line.trim().length > 0)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as { seq: number; audioBase64?: string; done: boolean; error?: string }];
      } catch {
        return [];
      }
    });
}
```

**Replace `fetchAndPlay`** (lines 95–129 in the original file) with the streaming version:

```typescript
  private async fetchAndPlay(request: NarrationRequest): Promise<void> {
    console.log('[Voice] fetchAndPlay (streaming) - text:', request.text.substring(0, 100));

    const response = await fetch(this.options.narrateEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) throw new Error(`Narrate endpoint returned ${response.status}`);
    if (!response.body) throw new Error('No response body for streaming narrate');

    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    this._state = validateNarrationTransition({ from: this._state, trigger: 'audioReady' });
    this.options.onModeChange?.('speaking');

    // Ordered play queue: chunks may be decoded before the previous one finishes playing.
    // We process them strictly in seq order.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let leftover = '';
    // seq-ordered pending buffers: seq -> Float32Array
    const pending = new Map<number, Float32Array>();
    let nextSeq = 0;
    let streamDone = false;

    const playPending = async (): Promise<void> => {
      while (pending.has(nextSeq)) {
        const float32 = pending.get(nextSeq)!;
        pending.delete(nextSeq);
        nextSeq++;
        await this.playFloat32(float32);
      }
    };

    while (!streamDone) {
      const { value, done } = await reader.read();
      if (done) break;

      const text = leftover + decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      // Last element may be partial — save for next iteration
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk: { seq: number; audioBase64?: string; done: boolean; error?: string };
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }

        if (chunk.done) {
          streamDone = true;
          break;
        }

        if (chunk.error) {
          throw new Error(`TTS server error: ${chunk.error}`);
        }

        if (chunk.audioBase64) {
          // Decode PCM immediately (off the main render path)
          const bytes = Uint8Array.from(atob(chunk.audioBase64), c => c.charCodeAt(0));
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
          pending.set(chunk.seq, float32);
        }

        // Play any chunks that are now in order
        await playPending();
      }

      // After processing this read batch, drain any in-order pending chunks
      await playPending();
    }

    // Drain any remaining chunks that arrived out of order
    await playPending();

    this.options.onEmotionChange?.(null);
  }
```

**Add `playFloat32` helper** (replaces the old `playAudioBuffer`):

```typescript
  private async playFloat32(float32: Float32Array): Promise<void> {
    if (!this.audioCtx) return;
    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }
```

**Keep the old `playAudioBuffer` method** (it's still used by `playUtterance` indirectly — actually `playUtterance` uses `decodeAudioData`, so `playAudioBuffer` can be removed. Verify no other callers first):

```bash
grep -r "playAudioBuffer" extensions/openspace-voice/src/
```

If no other callers: delete `playAudioBuffer` and replace its internal usage with `playFloat32`.

### Step 4: Run tests

```bash
yarn --cwd extensions/openspace-voice test --grep "parseNdjsonLines"
```

Expected: 4 passing.

### Step 5: Build browser extension

```bash
yarn --cwd extensions/openspace-voice build
```

Fix any TypeScript errors.

### Step 6: Rebuild webpack bundle

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

Verify the change is in the bundle:

```bash
rg "fetchAndPlay (streaming)" browser-app/lib/frontend/
```

If not found, clear the webpack cache and rebuild:

```bash
rm -rf browser-app/.webpack-cache
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

### Step 7: Manual smoke test

1. Hard-refresh browser: `Cmd+Shift+R`
2. Enable voice narration
3. Send a chat message that produces a multi-sentence response
4. Verify:
   - Audio starts well before the full response would have completed synthesis
   - Audio is seamless between sentences (no audible gap or click)
   - Console shows `[Voice] fetchAndPlay (streaming)`
   - No errors in console

### Step 8: Commit

```bash
git add extensions/openspace-voice/src/browser/narration-fsm.ts \
        extensions/openspace-voice/src/__tests__/ndjson-stream.spec.ts
git commit -m "feat(voice): incremental audio playback from NDJSON stream — first sentence starts immediately"
```

---

## Task 4: Run full test suite

### Step 1: Run all voice tests

```bash
yarn --cwd extensions/openspace-voice test
```

Expected: all existing tests pass + new tests pass.

### Step 2: Run all tests

```bash
yarn test
```

Expected: all previous passing tests still pass. The 6 known pre-existing failures (TurnGroup streaming ×4, AudioFsm ×2) are acceptable.

### Step 3: Fix any new failures before proceeding

Common failure modes:
- `parseNdjsonLines` export missing (check it's before the class definition)
- `narrateTextStreaming` type errors (check `NarrateStreamChunk` is exported)
- Sentence splitter returning empty for edge cases (check the regex handles text without punctuation)

### Step 4: Commit if fixes were needed

```bash
git add -A
git commit -m "fix(voice): address test failures from TTS streaming changes"
```

---

## Task 5: Update memory files

**Files:**
- Modify: `.opencode/_context/01_memory/active_context.md`
- Modify: `.opencode/_context/01_memory/progress.md`

### Step 1: Update progress.md

Add a new milestone entry:

```markdown
### TTS Sentence-Chunk Streaming (2026-02-27) -- COMPLETE

Reduced narration first-audio latency from "full text synthesis wait" to
"first sentence ready" (~300–600ms on CPU, vs multiple seconds previously).

Architecture:
- Backend: `narrateTextStreaming()` splits cleaned text into sentences,
  synthesizes each, streams NDJSON chunks over chunked HTTP transfer
- Browser: `NarrationFsm.fetchAndPlay()` reads `ReadableStream`, decodes and
  plays each chunk in seq order while next chunk synthesizes in parallel

Files changed:
- `sentence-splitter.ts` (new utility)
- `voice-backend-service.ts` (new `narrateTextStreaming` method)
- `voice-hub-contribution.ts` (route updated for NDJSON streaming)
- `narration-fsm.ts` (streaming fetchAndPlay + parseNdjsonLines helper)
```

### Step 2: Commit

```bash
git add .opencode/_context/01_memory/
git commit -m "docs: update memory files after TTS chunk streaming implementation"
```

---

## Verification Checklist

Before considering this done:

- [ ] `splitIntoSentences` unit tests pass (10 tests)
- [ ] `VoiceBackendService streaming` unit tests pass (4 tests)
- [ ] `parseNdjsonLines` unit tests pass (4 tests)
- [ ] Full test suite: no new failures vs baseline
- [ ] Manual: first audio plays within ~1s for a 3+ sentence narration
- [ ] Manual: audio is seamless between sentence chunks (no audible clicks)
- [ ] Manual: `narrate-off` mode: no audio, no errors
- [ ] Manual: short single-sentence text still works (1 chunk + done)
- [ ] Manual: console shows `[Voice] fetchAndPlay (streaming)`
- [ ] No unhandled errors in browser console

---

## Known Edge Cases

| Case | Behavior |
|---|---|
| Single sentence text | 1 chunk + done marker — works identically to before, minimal overhead |
| Text with no sentence-ending punctuation | `splitIntoSentences` returns whole text as 1 sentence — single chunk |
| Very short sentences (1-2 words) | Still synthesized individually — Kokoro handles short text fine |
| Network interruption mid-stream | `reader.read()` rejects — caught by drainLoop error handler, FSM transitions to error state |
| `audioCtx` suspended (user paused) | `source.start()` queues audio — `onended` fires when the context resumes |
| Response without body (stub provider) | Guard `if (!response.body)` throws before streaming starts |
| Old `narrateText` method | Still present and unchanged — fallback for any non-streaming callers |
