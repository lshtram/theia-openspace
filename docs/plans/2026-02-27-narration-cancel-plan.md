# Narration Cancel (Esc + Waveform Click) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the user to immediately stop TTS narration by pressing Esc or clicking the waveform overlay widget, with instant HTTP stream cancellation via AbortController.

**Architecture:** `NarrationFsm` owns an `AbortController` created at drain-loop start; `stop()` aborts it. An `AbortError` in the drain loop is treated as a clean stop (not an error). The waveform overlay becomes clickable via a `setOnCancel` setter. An Esc `keydown` listener is registered globally at module init.

**Tech Stack:** TypeScript, Web API (`AbortController`, `KeyboardEvent`), Chai + Mocha (tests), Webpack (browser bundle)

---

## Context

- Extension: `extensions/openspace-voice/`
- Build: `yarn --cwd extensions/openspace-voice build` then webpack (see AGENTS.md Rule 6)
- Test runner: `yarn --cwd extensions/openspace-voice test`
- Known pre-existing failures: `AudioFsm` ×2 — do not fix those, just ignore them
- All commits use `--no-verify`

---

### Task 1: NarrationFsm — AbortController wiring + stop() abort

**Files:**
- Modify: `extensions/openspace-voice/src/browser/narration-fsm.ts`
- Test: `extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts`

**Step 1: Write the failing tests**

Open `extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts` and add the following tests at the end of the existing `describe` block:

```ts
it('stop() while queued returns to idle without calling onError', (done) => {
  let errorCalled = false;
  let modeChanges: string[] = [];
  const fsm = new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
    onError: () => { errorCalled = true; },
    onModeChange: (m) => { modeChanges.push(m); },
  });
  fsm.enqueue({ text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });
  // stop immediately before drain loop can do anything
  fsm.stop();
  // Give drain loop a tick to settle
  setTimeout(() => {
    assert.equal(fsm.state, 'idle');
    assert.isFalse(errorCalled);
    done();
  }, 50);
});

it('stop() transitions state to idle synchronously', () => {
  const fsm = new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
  });
  fsm.enqueue({ text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });
  fsm.stop();
  assert.equal(fsm.state, 'idle');
});
```

**Step 2: Run tests to verify they fail**

```bash
yarn --cwd extensions/openspace-voice test 2>&1 | grep -A3 "stop()"
```

Expected: The new tests appear and may pass trivially for the sync one, but the async test may fail (error called or state wrong). Confirm at least one is meaningful.

**Step 3: Implement AbortController in NarrationFsm**

In `extensions/openspace-voice/src/browser/narration-fsm.ts`:

1. Add private field after `private queue`:
```ts
private _abortController: AbortController | null = null;
```

2. Update `stop()` to abort before clearing:
```ts
stop(): void {
  this._abortController?.abort();
  this._abortController = null;
  this.queue = [];
  this.audioCtx?.close();
  this.audioCtx = null;
  this._state = 'idle';
  this.options.onModeChange?.('idle');
}
```

3. Update `drainLoop()` — create controller at the start:
```ts
private async drainLoop(first: NarrationRequest): Promise<void> {
  this._abortController = new AbortController();
  const { signal } = this._abortController;
  let current: NarrationRequest | undefined = first;
  console.log('[Voice] drainLoop started, mode:', current?.mode);
  while (current) {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'startProcessing' });
    this.options.onModeChange?.('waiting');
    console.log('[Voice] Waiting for TTS...');
    try {
      await this.fetchAndPlay(current, signal);
      this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
      this.options.onPlaybackComplete?.();
      this.options.onModeChange?.('idle');
      console.log('[Voice] Narration complete');
    } catch (err) {
      const isAbort = (err instanceof Error && err.name === 'AbortError') ||
                      (err instanceof DOMException && err.name === 'AbortError');
      if (isAbort) {
        // Clean cancel — state already set to idle by stop()
        this.options.onModeChange?.('idle');
        console.log('[Voice] Narration cancelled');
        return;
      }
      this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
      this.options.onError?.(err as Error);
      this.options.onModeChange?.('idle');
      console.error('[Voice] Narration error:', err);
      return;
    }
    current = this.queue.shift();
    if (current) {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
    }
  }
}
```

4. Update `fetchAndPlay` signature and `fetch()` call to pass signal:
```ts
private async fetchAndPlay(request: NarrationRequest, signal: AbortSignal): Promise<void> {
  console.log('[Voice] fetchAndPlay (streaming) - text:', request.text.substring(0, 100));

  const response = await fetch(this.options.narrateEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  // ... rest of method unchanged ...
```

5. In `fetchAndPlay`, add abort check inside `playFloat32` calls. Before each `await this.playFloat32(float32)` call (there are two — inside `playPending` and after the loop), add a signal check. The cleanest approach: check at the top of `playPending`:

Replace the `playPending` inner function:
```ts
const playPending = async (): Promise<void> => {
  while (pending.has(nextSeq)) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const float32 = pending.get(nextSeq)!;
    pending.delete(nextSeq);
    nextSeq++;
    await this.playFloat32(float32);
  }
};
```

**Step 4: Run tests to verify they pass**

```bash
yarn --cwd extensions/openspace-voice test 2>&1 | tail -20
```

Expected: All new tests pass. Pre-existing AudioFsm failures are acceptable.

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/browser/narration-fsm.ts \
        extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts
git commit --no-verify -m "feat(voice): AbortController in NarrationFsm for immediate cancel"
```

---

### Task 2: VoiceWaveformOverlay — setOnCancel + clickable

**Files:**
- Modify: `extensions/openspace-voice/src/browser/voice-waveform-overlay.ts`

No new test file needed — the overlay is a DOM class. Manual verification is sufficient (tested via browser in Task 5).

**Step 1: Add `setOnCancel` setter and private field**

In `voice-waveform-overlay.ts`, after `private waitingAnimationId`:
```ts
private _onCancel: (() => void) | null = null;

setOnCancel(cb: (() => void) | null): void {
  this._onCancel = cb;
}
```

**Step 2: Make container clickable in `show()`**

In `show()`, after the `Object.assign(container.style, { ... })` block (after setting all the styles including `pointerEvents: 'none'`), add:

```ts
if (this._onCancel) {
  container.style.pointerEvents = 'auto';
  container.style.cursor = 'pointer';
  container.addEventListener('click', this._onCancel);
}
```

This overrides the `pointerEvents: 'none'` set in the style object above, so the order matters — this must come after the `Object.assign`.

**Step 3: Build and verify no TypeScript errors**

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -10
```

Expected: No errors.

**Step 4: Commit**

```bash
git add extensions/openspace-voice/src/browser/voice-waveform-overlay.ts
git commit --no-verify -m "feat(voice): VoiceWaveformOverlay click-to-cancel via setOnCancel"
```

---

### Task 3: VoiceCommandContribution — wire cancel callback in onStart()

**Files:**
- Modify: `extensions/openspace-voice/src/browser/voice-command-contribution.ts`

**Step 1: Wire setOnCancel in onStart()**

In `onStart()`, after `this.updateStatusBar()`, add:
```ts
this.waveformOverlay.setOnCancel(() => this.narrationFsm.stop());
```

The full `onStart()` becomes:
```ts
onStart(): void {
  console.log('[Voice] onStart - policy.enabled:', this.sessionFsm.policy.enabled, 'state:', this.sessionFsm.state);
  if (this.sessionFsm.policy.enabled && this.sessionFsm.state === 'inactive') {
    this.sessionFsm.enable();
    console.log('[Voice] Enabled voice from policy');
  }
  this.updateStatusBar();
  this.waveformOverlay.setOnCancel(() => this.narrationFsm.stop());
}
```

**Step 2: Build**

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -10
```

Expected: No errors.

**Step 3: Commit**

```bash
git add extensions/openspace-voice/src/browser/voice-command-contribution.ts
git commit --no-verify -m "feat(voice): wire waveform overlay click-to-cancel in VoiceCommandContribution"
```

---

### Task 4: Global Esc key listener in frontend module

**Files:**
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`

**Step 1: Add Esc listener after narration observer setup**

In the `toDynamicValue` factory for `NarrationFsm`, after the `window.addEventListener('unload', ...)` block and before `return narrationFsm`, add:

```ts
// Cancel narration on Esc
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && narrationFsm.state !== 'idle') {
    narrationFsm.stop();
  }
});
```

**Step 2: Build**

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -10
```

Expected: No errors.

**Step 3: Commit**

```bash
git add extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
git commit --no-verify -m "feat(voice): Esc key cancels narration globally"
```

---

### Task 5: Bug fix — VoiceInputWidget stop button calls pause() not stop()

**Files:**
- Modify: `extensions/openspace-voice/src/browser/voice-input-widget.tsx`

**Step 1: Fix handleStopNarration**

In `voice-input-widget.tsx`, change `handleStopNarration`:

```ts
// Before:
private handleStopNarration = () => {
  this.narrationFsm.pause();
  this.update();
};

// After:
private handleStopNarration = () => {
  this.narrationFsm.stop();
  this.update();
};
```

Note: `handleMicMouseDown` also calls `narrationFsm.pause()` when narrating — leave that as-is. It intentionally pauses during PTT.

**Step 2: Build**

```bash
yarn --cwd extensions/openspace-voice build 2>&1 | tail -10
```

Expected: No errors.

**Step 3: Commit**

```bash
git add extensions/openspace-voice/src/browser/voice-input-widget.tsx
git commit --no-verify -m "fix(voice): stop narration button calls stop() not pause()"
```

---

### Task 6: Webpack bundle rebuild + browser verification

**Step 1: Rebuild webpack bundle**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development 2>&1 | tail -5
```

**Step 2: Verify changes are in bundle**

```bash
rg "Narration cancelled" browser-app/lib/frontend/
rg "setOnCancel" browser-app/lib/frontend/
```

Both must return matches. If either is missing, clear cache and rebuild:
```bash
rm -rf browser-app/.webpack-cache
yarn --cwd browser-app webpack --config webpack.config.js --mode development 2>&1 | tail -5
```

**Step 3: Hard-refresh browser and manual test**

1. Open `http://localhost:3000` in browser
2. Ensure voice is enabled with narration mode set to `narrate-everything`
3. Send a message to the AI (any message — a long one is better for testing)
4. While the waveform overlay is visible (TTS is playing):
   - **Test A:** Press Esc — overlay should disappear immediately
   - **Test B:** Click the waveform overlay — overlay should disappear immediately
   - **Test C:** Click the ⏹ stop button in the toolbar — overlay should disappear immediately
5. After cancel, send another message — narration should resume normally

**Step 4: Commit**

No code changes — nothing to commit. Verification complete.

---

### Task 7: Final test run

```bash
yarn --cwd extensions/openspace-voice test 2>&1 | tail -20
```

Expected: All new tests pass. Pre-existing AudioFsm failures are acceptable (2 known).
