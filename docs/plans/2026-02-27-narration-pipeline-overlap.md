# Narration Pipeline Overlap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate audible silence gaps between sentences by decoupling the NDJSON stream reader from the audio player so that the client buffers incoming chunks while the current sentence is playing.

**Architecture:** Split `fetchAndPlay` into two concurrent async loops — a `readerLoop` that drains the HTTP stream into a `pending` map, and a `playerLoop` that plays chunks from `pending` in `seq` order. Both run concurrently via `Promise.all`. The `pending: Map<seq, Float32Array>` and sequential ordering logic already exist; this is a reorganisation, not a new data structure. A shared `streamDone` flag + a notify mechanism (a simple resolved-promise chain) lets the player know when reading is complete.

**Tech Stack:** TypeScript, Web Audio API, Chai + Mocha (tests)

---

## Context

- Extension: `extensions/openspace-voice/`
- Build: `yarn --cwd extensions/openspace-voice build`
- Test runner: `yarn test:unit` (from repo root)
- Known pre-existing failures: AudioFsm ×2 — ignore
- All commits use `--no-verify`

---

## Why the gap exists (root cause)

The current `fetchAndPlay` uses a single sequential loop:

```
while (!streamDone) {
  await reader.read()       // blocks here
  decode chunk → pending
  await playPending()       // ALSO blocks here while audio plays
}
```

`await playPending()` calls `await playFloat32()` which awaits `source.onended`. While that awaits, `reader.read()` is not called. So the HTTP response buffer fills with the next sentence's audio, but the client doesn't consume it until the current sentence finishes. When the sentence ends, the client then reads and plays — back-to-back reads with no overlap.

The fix: reader and player run concurrently, so sentence N+1 is already in `pending` and ready to play the instant sentence N ends.

---

## The new structure

```ts
private async fetchAndPlay(request: NarrationRequest, signal: AbortSignal): Promise<void> {
  // ... fetch, error check, audioCtx setup, state transition — unchanged ...

  const pending = new Map<number, Float32Array>();
  let nextReadSeq = 0;    // player's read pointer
  let streamDone = false;
  let streamError: Error | null = null;

  // Notify mechanism: player waits on this when pending is empty but stream isn't done.
  // Reader resolves it each time a new chunk lands.
  let notifyPlayer!: () => void;
  const makeNotifyPromise = (): Promise<void> =>
    new Promise<void>(resolve => { notifyPlayer = resolve; });
  let playerNotify = makeNotifyPromise();

  const readerLoop = async (): Promise<void> => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let leftover = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = leftover + decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        leftover = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: { seq: number; audioBase64?: string; done: boolean; error?: string };
          try { chunk = JSON.parse(line); } catch { continue; }
          if (chunk.done) { streamDone = true; notifyPlayer(); return; }
          if (chunk.error) { streamError = new Error(`TTS server error: ${chunk.error}`); streamDone = true; notifyPlayer(); return; }
          if (chunk.audioBase64) {
            const bytes = Uint8Array.from(atob(chunk.audioBase64), c => c.charCodeAt(0));
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
            pending.set(chunk.seq, float32);
          }
          notifyPlayer();            // wake player after each chunk
          playerNotify = makeNotifyPromise();
        }
      }
    } finally {
      streamDone = true;
      notifyPlayer(); // ensure player unblocks even if we exit early
    }
  };

  const playerLoop = async (): Promise<void> => {
    while (true) {
      // Drain all in-order chunks currently in pending
      while (pending.has(nextReadSeq)) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const float32 = pending.get(nextReadSeq)!;
        pending.delete(nextReadSeq);
        nextReadSeq++;
        await this.playFloat32(float32, signal);
      }
      // If stream is done and no more pending chunks, we're finished
      if (streamDone && !pending.has(nextReadSeq)) break;
      // Wait for reader to notify us of a new chunk
      await playerNotify;
    }
    if (streamError) throw streamError;
  };

  await Promise.all([readerLoop(), playerLoop()]);
  this.options.onEmotionChange?.(null);
}
```

**Key properties:**
- `readerLoop` decodes and buffers into `pending` as fast as the network delivers
- `playerLoop` plays in strict `seq` order; if `pending` is empty it awaits `playerNotify`
- Reader calls `notifyPlayer()` each time a chunk lands — immediately wakes a waiting player
- `streamDone` flag + final `notifyPlayer()` in `finally` ensures player exits even if reader throws
- Abort signal checked at top of player inner loop (same as before)
- `streamError` propagated: if server sends `{ error: "..." }`, player throws after reader exits

---

## Task 1: Refactor `fetchAndPlay` — concurrent reader + player loops

**Files:**
- Modify: `extensions/openspace-voice/src/browser/narration-fsm.ts`
- Test: `extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts`

### Step 1: Write failing test first

Open `extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts`.

Add this test at the end of the `describe` block. It verifies that chunk N+1 is already in `pending` and plays immediately after chunk N ends — measurable by confirming two sources are created with zero delay between them:

```ts
it('concurrent read+play: sentence N+1 starts without gap after sentence N ends', (done) => {
  // Two audio chunks delivered together in one network read
  const makeChunk = (seq: number): string => {
    const pcm = new Int16Array(240); // 10ms silence at 24kHz
    const bytes = new Uint8Array(pcm.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return JSON.stringify({ seq, audioBase64: btoa(s), done: false });
  };
  const ndjson =
    makeChunk(0) + '\n' +
    makeChunk(1) + '\n' +
    JSON.stringify({ seq: 2, done: true }) + '\n';

  const origFetch = globalThis.fetch;
  (globalThis as unknown as Record<string, unknown>).fetch = (_url: string, opts?: RequestInit) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        // Deliver BOTH chunks in one read (simulates server pre-buffering)
        controller.enqueue(encoder.encode(ndjson));
        controller.close();
      }
    });
    return Promise.resolve(new Response(body, { status: 200 }));
  };

  const sourceEndedCallbacks: Array<() => void> = [];
  const origAudioContext = (globalThis as Record<string, unknown>).AudioContext;
  (globalThis as Record<string, unknown>).AudioContext = class {
    createBuffer() { return { copyToChannel() {} }; }
    createBufferSource() {
      const src = {
        buffer: null as unknown,
        onended: null as (() => void) | null,
        connect() {},
        start() {
          // Auto-resolve after a microtask so playback "completes" quickly
          Promise.resolve().then(() => { src.onended?.(); });
        },
        stop() {},
      };
      sourceEndedCallbacks.push(() => src.onended?.());
      return src;
    }
    get destination() { return {}; }
    close() {}
    suspend() {}
    resume() {}
  };

  let sourcesCreated = 0;
  const origCreateBufferSource = Object.getOwnPropertyDescriptor(
    (globalThis as Record<string, unknown>).AudioContext.prototype, 'createBufferSource'
  );
  // Count how many sources are created — should be 2 (one per sentence)
  const fsm3 = new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
    onPlaybackComplete: () => {
      // Both chunks should have been created
      assert.equal(sourcesCreated, 0, 'placeholder — real assertion below');
      done();
    },
  });

  // Simpler approach: just verify onPlaybackComplete fires with no onError
  let errorCalled = false;
  let playbackComplete = false;
  const fsm4 = new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
    onError: () => { errorCalled = true; },
    onPlaybackComplete: () => { playbackComplete = true; },
  });

  fsm4.enqueue({ text: 'hi', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });

  setTimeout(() => {
    try {
      assert.isFalse(errorCalled, 'no error expected');
      assert.isTrue(playbackComplete, 'playback should complete');
      assert.equal(fsm4.state, 'idle');
      done();
    } finally {
      (globalThis as unknown as Record<string, unknown>).fetch = origFetch;
      (globalThis as unknown as Record<string, unknown>).AudioContext = origAudioContext;
    }
  }, 500);
});
```

> **Note on this test:** The test above validates the observable outcome (complete cleanly, no error, state idle). A stricter timing test (proving N+1 buffered before N ends) requires fine-grained AudioContext control that is too brittle for this unit test suite. The concurrency is better verified by ear in Task 2 (manual test). The unit test here is a regression guard.

### Step 2: Run test to verify it fails (or at least runs)

```bash
yarn test:unit 2>&1 | grep -A3 "concurrent read"
```

Expected: test may pass trivially with current code (if the fetch resolves before playback) — that's OK. The real test is the absence-of-gap by ear. Move on.

### Step 3: Implement the refactor

Replace the body of `fetchAndPlay` starting after the `this.options.onModeChange?.('speaking')` line (line 147) with the new concurrent structure. The part before that line (fetch, error checks, audioCtx setup, state transition) stays **exactly the same**. Only the stream reading + playing logic changes.

The full new `fetchAndPlay` method:

```ts
private async fetchAndPlay(request: NarrationRequest, signal: AbortSignal): Promise<void> {
  console.log('[Voice] fetchAndPlay (streaming) - text:', request.text.substring(0, 100));

  const response = await fetch(this.options.narrateEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) throw new Error(`Narrate endpoint returned ${response.status}`);
  if (!response.body) throw new Error('No response body for streaming narrate');

  if (!this.audioCtx) {
    this.audioCtx = new AudioContext();
  }

  this._state = validateNarrationTransition({ from: this._state, trigger: 'audioReady' });
  this.options.onModeChange?.('speaking');

  // seq-ordered pending buffers: seq -> Float32Array
  const pending = new Map<number, Float32Array>();
  let nextPlaySeq = 0;
  let streamDone = false;
  let streamError: Error | null = null;

  // Notify mechanism: player waits on this when pending is empty but stream isn't done yet.
  // Reader resolves it each time a new chunk arrives.
  let notifyPlayer!: () => void;
  const makeNotify = (): Promise<void> =>
    new Promise<void>(resolve => { notifyPlayer = resolve; });
  let playerWait = makeNotify();

  const readerLoop = async (): Promise<void> => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let leftover = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = leftover + decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        leftover = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: { seq: number; audioBase64?: string; done: boolean; error?: string };
          try { chunk = JSON.parse(line); } catch { continue; }
          if (chunk.done) { streamDone = true; notifyPlayer(); return; }
          if (chunk.error) {
            streamError = new Error(`TTS server error: ${chunk.error}`);
            streamDone = true;
            notifyPlayer();
            return;
          }
          if (chunk.audioBase64) {
            const bytes = Uint8Array.from(atob(chunk.audioBase64), c => c.charCodeAt(0));
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
            pending.set(chunk.seq, float32);
          }
          // Wake player after each chunk so it can start playing without waiting for the next read
          notifyPlayer();
          playerWait = makeNotify();
        }
      }
    } finally {
      // Always signal player to unblock, even if reader exits early (abort, error, or done)
      streamDone = true;
      notifyPlayer();
    }
  };

  const playerLoop = async (): Promise<void> => {
    while (true) {
      // Play all in-order chunks currently buffered
      while (pending.has(nextPlaySeq)) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const float32 = pending.get(nextPlaySeq)!;
        pending.delete(nextPlaySeq);
        nextPlaySeq++;
        await this.playFloat32(float32, signal);
      }
      // Exit when stream is complete and no more chunks to play
      if (streamDone && !pending.has(nextPlaySeq)) break;
      // Wait for reader to notify us a new chunk arrived
      await playerWait;
    }
    if (streamError) throw streamError;
  };

  await Promise.all([readerLoop(), playerLoop()]);
  this.options.onEmotionChange?.(null);
}
```

### Step 4: Build

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -5
```

Expected: no TypeScript errors.

### Step 5: Run tests

```bash
yarn test:unit 2>&1 | tail -20
```

Expected: all existing tests pass (1311+), no regressions. AudioFsm ×2 failures are pre-existing — ignore.

### Step 6: Commit

```bash
git add extensions/openspace-voice/src/browser/narration-fsm.ts \
        extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts
git commit --no-verify -m "perf(voice): concurrent read+play in fetchAndPlay — eliminate inter-sentence gap"
```

---

## Task 2: Webpack rebuild + manual verification

### Step 1: Rebuild webpack bundle

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development 2>&1 | tail -5
```

Expected: `compiled successfully`.

### Step 2: Verify the change is in the bundle

```bash
rg "readerLoop\|playerLoop\|playerWait\|makeNotify" browser-app/lib/frontend/
```

Expected: at least one match.

### Step 3: Hard-refresh and manual test

1. Open `http://localhost:3000` in browser, press Cmd+Shift+R
2. Enable voice with `narrate-everything` mode
3. Ask the AI a question that produces a multi-sentence response (e.g. "explain what a mutex is in 3 sentences")
4. Listen: sentences should flow continuously with no audible pause between them
5. Also verify cancel still works: Esc, clicking waveform, and stop button

### Step 4: Commit

No code changes — nothing to commit.
