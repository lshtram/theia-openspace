# Voice Feature Review 2026-02-21 — Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all Critical, High, Medium, and Low findings from VOICE-FEATURE-REVIEW-2026-02-21.md, plus fill testing gaps identified in the review.

**Architecture:** Worktree at `/Users/Shared/dev/theia-openspace/.worktrees/feature-voice/`. All commands run from that directory. Use `yarn workspace @openspace-ai/voice-core run test` to run voice-core tests (36 tests must still pass after each task).

**Tech Stack:** TypeScript (CommonJS output), Mocha + ts-node, Node.js 22, whisper-cli (Homebrew, flags: `-f` for input, `-otxt` flag, `-of PREFIX` for output prefix), kokoro-js (ESM-only global npm install), VS Code extension, Theia extension.

---

## Sprint 1 — Make the Feature Functional End-to-End

### Task 1: C-1 + L-1 + M-8 — kokoro.adapter.ts: dynamic import, shared load promise, Uint8Array warning

**Files:**
- Modify: `packages/voice-core/src/adapters/kokoro.adapter.ts`
- Modify: `packages/voice-core/src/adapters/kokoro.adapter.spec.ts`

**Step 1: Run baseline tests**
```
yarn workspace @openspace-ai/voice-core run test
```
Expected: 36 passing

**Step 2: Implement fixes in kokoro.adapter.ts**

Replace `isAvailable()`:
```typescript
async isAvailable(): Promise<boolean> {
  try {
    await import('kokoro-js');
    return true;
  } catch {
    return false;
  }
}
```

Remove `modelLoading: boolean` field. Add `modelLoadPromise` field. Replace `getModel()`:
```typescript
private modelLoadPromise: Promise<KokoroTTSInstance> | null = null;

private getModel(): Promise<KokoroTTSInstance> {
  if (this.model) return Promise.resolve(this.model);
  if (this.modelLoadError) return Promise.reject(this.modelLoadError);
  if (!this.modelLoadPromise) {
    this.modelLoadPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js') as { KokoroTTS: KokoroTTSConstructor };
      this.model = await KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        { dtype: 'q8', device: 'cpu' }
      );
      return this.model!;
    })().catch((err: Error) => {
      this.modelLoadError = err;
      this.modelLoadPromise = null;
      throw err;
    });
  }
  return this.modelLoadPromise;
}
```

Update `dispose()` to reset `modelLoadPromise`:
```typescript
async dispose(): Promise<void> {
  this.model = null;
  this.modelLoadError = null;
  this.modelLoadPromise = null;
}
```

Fix M-8 Uint8Array branch in `synthesize()` — add warning:
```typescript
} else if (audioData instanceof Uint8Array) {
  console.warn('[KokoroAdapter] unexpected Uint8Array audio output — check kokoro-js version');
  audioBytes = audioData;
}
```

**Step 3: Add concurrent test to kokoro.adapter.spec.ts**
```typescript
describe('concurrent synthesize() calls', () => {
  it('two calls both reject cleanly when kokoro-js not installed', async () => {
    const adapter = new KokoroAdapter();
    const p1 = adapter.synthesize({ text: 'hello', language: 'en', voice: 'af_sarah', speed: 1 })
      .catch(() => 'rejected1');
    const p2 = adapter.synthesize({ text: 'world', language: 'en', voice: 'af_sarah', speed: 1 })
      .catch(() => 'rejected2');
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.strictEqual(r1, 'rejected1');
    assert.strictEqual(r2, 'rejected2');
  });
});
```

**Step 4: Run tests**
```
yarn workspace @openspace-ai/voice-core run test
```
Expected: 37 passing

**Step 5: Commit**
```
git add packages/voice-core/src/adapters/kokoro.adapter.ts packages/voice-core/src/adapters/kokoro.adapter.spec.ts
git commit -m "fix(voice-core): dynamic import() for kokoro-js ESM; shared load promise (C-1, L-1, M-8)"
```

---

### Task 2: H-3 + M-4 + L-2 — whisper-cpp.adapter.ts: fix CLI args, add modelFile param, settled guard

**Files:**
- Modify: `packages/voice-core/src/adapters/whisper-cpp.adapter.ts`
- Modify: `packages/voice-core/src/adapters/whisper-cpp.adapter.spec.ts`

**Step 1: Add modelFile constructor param to adapter**

Current constructor: `(binaryPath, modelFolder, spawnFn)`.
New constructor: `(binaryPath, modelFolder, modelFile, spawnFn)` where `modelFile` defaults to `'ggml-base.en.bin'`.

**Step 2: Rewrite transcribe() with correct CLI flags**

```typescript
const outPrefix = tmpFile.replace(/\.wav$/, '');
const outTxtFile = outPrefix + '.txt';

return await new Promise<SttTranscriptionResult>((resolve, reject) => {
  let settled = false;
  const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

  const proc = this.spawnFn(
    this.binaryPath,
    [
      '-m', path.join(this.modelFolder, this.modelFile),
      '--language', request.language,
      '-otxt',
      '-of', outPrefix,
      '-f', tmpFile,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  const stderr: Buffer[] = [];
  proc.stderr!.on('data', (chunk: Buffer) => stderr.push(chunk));
  proc.on('error', (err) => settle(() => reject(new Error(`whisper.cpp spawn failed: ${err.message}`))));
  proc.on('close', (code) => {
    if (code !== 0) {
      const errText = Buffer.concat(stderr).toString('utf8').trim();
      settle(() => reject(new Error(`whisper.cpp exited ${code}: ${errText}`)));
      return;
    }
    try {
      const text = fs.readFileSync(outTxtFile, 'utf8').trim();
      settle(() => resolve({ text }));
    } catch (readErr) {
      settle(() => reject(new Error(`whisper.cpp output file not found: ${readErr}`)));
    } finally {
      try { fs.unlinkSync(outTxtFile); } catch { /* ignore */ }
    }
  });

  token?.onCancellationRequested(() => {
    proc.kill();
    settle(() => reject(new Error('STT transcription cancelled')));
  });
});
```

**Step 3: Update all tests to pass 4-arg constructor**

Change all `new WhisperCppAdapter('whisper', '/usr/local/share/whisper', mockSpawn)` to
`new WhisperCppAdapter('whisper', '/usr/local/share/whisper', 'ggml-base.en.bin', mockSpawn)`.

Update `makeTranscribeProc` — it currently emits stdout text but the new code reads a `.txt` file. Rewrite transcribe test to use a spawn mock that writes the output file:

```typescript
it('returns transcribed text from output .txt file', async () => {
  const mockSpawn: SpawnFn = (_cmd, args) => {
    const ofIndex = args.indexOf('-of');
    if (ofIndex !== -1) {
      const prefix = args[ofIndex + 1];
      require('fs').writeFileSync(prefix + '.txt', 'hello world\n');
    }
    return makeFakeProc(0) as any;
  };
  const adapter = new WhisperCppAdapter('whisper', '/models', 'ggml-base.en.bin', mockSpawn);
  const result = await adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' });
  assert.strictEqual(result.text, 'hello world');
});
```

Add cancellation test:
```typescript
it('kills process and rejects with "cancelled" when token fires', async () => {
  let killed = false;
  let onCancelFn: (() => void) | null = null;

  const mockSpawn: SpawnFn = () => {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => { killed = true; };
    // Never emit close — simulates long-running process
    return proc;
  };

  const token = {
    isCancellationRequested: false,
    onCancellationRequested(handler: () => void) { onCancelFn = handler; },
  };

  const adapter = new WhisperCppAdapter('whisper', '/models', 'ggml-base.en.bin', mockSpawn);
  const p = adapter.transcribe(
    { audio: new Uint8Array(100), sampleRate: 16000, language: 'en' },
    token
  );
  await new Promise(r => setImmediate(r));
  onCancelFn!();
  await assert.rejects(p, /cancelled/);
  assert.strictEqual(killed, true, 'proc.kill() should have been called');
});
```

Add args verification test:
```typescript
it('uses -otxt -of <prefix> -f <wavfile> flags', async () => {
  let capturedArgs: string[] = [];
  const mockSpawn: SpawnFn = (_cmd, args) => {
    capturedArgs = [...args];
    const ofIndex = args.indexOf('-of');
    if (ofIndex !== -1) require('fs').writeFileSync(args[ofIndex + 1] + '.txt', 'test\n');
    return makeFakeProc(0) as any;
  };
  const adapter = new WhisperCppAdapter('whisper', '/models', 'ggml-base.en.bin', mockSpawn);
  await adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en' });
  assert.ok(capturedArgs.includes('-otxt'), 'should have -otxt flag');
  assert.ok(capturedArgs.includes('-of'), 'should have -of flag');
  assert.ok(capturedArgs.includes('-f'), 'should have -f for input');
});
```

**Step 4: Run tests**
```
yarn workspace @openspace-ai/voice-core run test
```
Expected: 39+ passing

**Step 5: Commit**
```
git add packages/voice-core/src/adapters/whisper-cpp.adapter.ts packages/voice-core/src/adapters/whisper-cpp.adapter.spec.ts
git commit -m "fix(voice-core): fix whisper.cpp CLI args, add modelFile param, settled guard (H-3, M-4, L-2)"
```

---

### Task 3: C-2 — Decode WebM to raw PCM in Theia AudioFsm

**Files:**
- Modify: `extensions/openspace-voice/src/browser/audio-fsm.ts`

**Step 1: Replace WebM passthrough with AudioContext decode in stopCapture()**

```typescript
// Replace the try block in stopCapture() with:
try {
  const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Decode compressed WebM/Opus → raw Float32 PCM at 16 kHz
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }

  // Convert mono Float32 → Int16 PCM
  const f32 = decoded.getChannelData(0);
  const int16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)));
  }

  const response = await fetch(this.options.sttEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/raw',
      'X-Voice-Language': this.options.language,
      'X-Sample-Rate': '16000',
    },
    body: new Uint8Array(int16.buffer),
  });

  if (!response.ok) throw new Error(`STT endpoint returned ${response.status}`);
  const result = await response.json() as { text: string };

  this._state = validateAudioTransition({ from: this._state, trigger: 'transcriptReady' });
  this.options.onTranscript(result.text);
} catch (err) {
  this._state = validateAudioTransition({ from: this._state, trigger: 'sttError' });
  this.options.onError?.(err as Error);
}
```

**Step 2: Verify Theia TypeScript compiles**
```
cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice
yarn workspace openspace-voice tsc --noEmit 2>&1 | head -40
```

**Step 3: Commit**
```
git add extensions/openspace-voice/src/browser/audio-fsm.ts
git commit -m "fix(theia-voice): decode WebM/Opus to raw PCM before sending to STT (C-2)"
```

---

## Sprint 2 — Fix Reliability and Safety

### Task 4: H-1 + H-2 — Fix dictation.ts EventEmitter throw and double stream()

**Files:**
- Modify: `openspace-voice-vscode/src/commands/dictation.ts`

**Step 1: Replace double stream() call and throw err with error variable pattern**

Find and replace the recorder setup block:
```typescript
// BEFORE:
recorder.stream().on('data', (chunk: Buffer) => pcmChunks.push(chunk));
recorder.stream().on('error', (err: Error) => { throw err; });

// AFTER:
let recordingError: Error | null = null;
const stream = recorder.stream();
stream.on('data', (chunk: Buffer) => pcmChunks.push(chunk));
stream.on('error', (err: Error) => {
  recordingError = err;
  try { recorder!.stop(); } catch { /* ignore */ }
});
```

And after `recorder.stop()`:
```typescript
recorder.stop();
if (recordingError) throw recordingError;  // caught by outer try/catch
```

**Step 2: Verify TypeScript**
```
cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice/openspace-voice-vscode
npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**
```
git add openspace-voice-vscode/src/commands/dictation.ts
git commit -m "fix(vscode-voice): fix EventEmitter throw and double stream() call (H-1, H-2)"
```

---

### Task 5: M-6 + M-7 + L-4 — Theia NarrationFsm iterative drain, error transitions, /32768

**Files:**
- Modify: `packages/voice-core/src/fsm/types.ts`
- Modify: `packages/voice-core/src/fsm/narration-fsm.ts`
- Modify: `extensions/openspace-voice/src/common/voice-fsm.ts`
- Modify: `extensions/openspace-voice/src/browser/narration-fsm.ts`

**Step 1: Add 'error' to NarrationTrigger in voice-core types.ts**
```typescript
export type NarrationTrigger = 'enqueue' | 'startProcessing' | 'audioReady' | 'pause' | 'resume' | 'complete' | 'error';
```

**Step 2: Add error transitions to voice-core narration-fsm.ts TRANSITIONS table**
```typescript
'queued:error': 'idle',
'processing:error': 'idle',
'playing:error': 'idle',
'paused:error': 'idle',
```

**Step 3: Add error cases to Theia validateNarrationTransition in voice-fsm.ts**
```typescript
case 'queued:error': return 'idle';
case 'processing:error': return 'idle';
case 'playing:error': return 'idle';
case 'paused:error': return 'idle';
```

**Step 4: Rewrite Theia narration-fsm.ts processQueue as drainLoop**

Rename `processQueue` to `drainLoop` and convert tail recursion to a while loop:

```typescript
enqueue(request: NarrationRequest): void {
  if (this._state === 'idle') {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
    Promise.resolve().then(() => this.drainLoop(request)).catch((err) => {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
      this.options.onError?.(err as Error);
    });
  } else {
    this.queue.push(request);
  }
}

private async drainLoop(first: NarrationRequest): Promise<void> {
  let current: NarrationRequest | undefined = first;
  while (current) {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'startProcessing' });
    try {
      await this.fetchAndPlay(current);
      this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
      this.options.onPlaybackComplete?.();
    } catch (err) {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
      this.options.onError?.(err as Error);
      return;
    }
    current = this.queue.shift();
    if (current) {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
    }
  }
}
```

The existing `processQueue` method body (fetch + play segments) becomes `fetchAndPlay`.

Note: The existing `processQueue` transitions through 'queued' → 'processing' → 'playing' → 'idle'. In `drainLoop`, `startProcessing` is called at the top (queued → processing), then `fetchAndPlay` handles the audioReady transition internally (the playing→playing state for each segment), and `complete` is called at the end.

Check the current `processQueue` transitions carefully when refactoring:
- `validateNarrationTransition({ trigger: 'startProcessing' })` → processing
- `validateNarrationTransition({ trigger: 'audioReady' })` → playing (inside fetchAndPlay)
- `validateNarrationTransition({ trigger: 'complete' })` → idle (playing→idle is what we need)

Make sure `validateNarrationTransition` has `'playing:complete': 'idle'` — check voice-fsm.ts. If missing, add it.

**Step 5: Fix L-4 — change / 32767 to / 32768 in playAudioBuffer()**
```typescript
for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
```

**Step 6: Run voice-core tests**
```
yarn workspace @openspace-ai/voice-core run test
```
Expected: all passing

**Step 7: Verify Theia TypeScript**
```
yarn workspace openspace-voice tsc --noEmit 2>&1 | head -40
```

**Step 8: Commit**
```
git add packages/voice-core/src/fsm/types.ts packages/voice-core/src/fsm/narration-fsm.ts extensions/openspace-voice/src/common/voice-fsm.ts extensions/openspace-voice/src/browser/narration-fsm.ts
git commit -m "fix(narration): iterative drain loop, error FSM transitions, / 32768 fix (M-6, M-7, L-4)"
```

---

### Task 6: M-5 — readyPromise gate in VoiceHubContribution + X-Sample-Rate passthrough

**Files:**
- Modify: `extensions/openspace-voice/src/node/voice-hub-contribution.ts`

**Step 1: Add readyPromise field and gate handlers**

Add field: `private readyPromise: Promise<void> = Promise.resolve();`

Change `initVoiceService()` to assign to `this.readyPromise` (not a void call):
```typescript
this.readyPromise = Promise.all([sttSelector.selectProvider(), ttsSelector.selectProvider()])
  .then(([stt, tts]) => { this.voiceService = ...; })
  .catch((err) => { ...; this.voiceService = /* stubs */; });
```

In each async handler, add `await this.readyPromise;` as first line.

Also update STT handler to read and pass X-Sample-Rate:
```typescript
const sampleRateHeader = req.headers['x-sample-rate'] as string | undefined;
const sampleRate = sampleRateHeader ? parseInt(sampleRateHeader, 10) : 16000;
const result = await this.voiceService.transcribeSpeech({ audio, language, sampleRate });
```

**Step 2: Verify Theia TypeScript**
```
yarn workspace openspace-voice tsc --noEmit 2>&1 | head -40
```

**Step 3: Commit**
```
git add extensions/openspace-voice/src/node/voice-hub-contribution.ts
git commit -m "fix(theia-voice): readyPromise gate for voiceService init, pass sampleRate from header (M-5)"
```

---

## Sprint 3 — Polish and Completeness

### Task 7: M-1 + L-3 — Implement stopNarration command; wire narrationFsm

**Files:**
- Modify: `openspace-voice-vscode/src/extension.ts`
- Modify: `openspace-voice-vscode/src/commands/read-aloud.ts`

**Step 1: Update ReadAloudDeps to include narrationFsm**
```typescript
interface ReadAloudDeps {
  ttsAdapter: KokoroAdapter;
  sessionFsm: SessionFsm;
  narrationFsm: NarrationFsm;
}
```

**Step 2: Use narrationFsm states in read-aloud command**

Transition narrationFsm states around synthesis/playback:
```typescript
deps.narrationFsm.enqueue({ text, mode: 'narrate-everything', voice, speed });
// ... after synthesis+playback complete:
deps.narrationFsm.startProcessing();
// ... after audioReady:
deps.narrationFsm.audioReady();
// ... after playback done:
deps.narrationFsm.complete();
```

**Step 3: Register stopNarration command in extension.ts**
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('openspace-voice.stopNarration', () => {
    if (narrationFsm.state === 'playing') {
      narrationFsm.pause();
      vscode.window.showInformationMessage('Narration paused.');
    } else {
      vscode.window.showInformationMessage('No narration is currently playing.');
    }
  })
);
```

**Step 4: Remove `void narrationFsm` from deactivate()**

**Step 5: Pass narrationFsm to registerReadAloudCommand()**
```typescript
registerReadAloudCommand(context, { ttsAdapter, sessionFsm, narrationFsm });
```

**Step 6: Verify TypeScript**
```
cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice/openspace-voice-vscode
npx tsc --noEmit 2>&1 | head -30
```

**Step 7: Commit**
```
git add openspace-voice-vscode/src/extension.ts openspace-voice-vscode/src/commands/read-aloud.ts
git commit -m "feat(vscode-voice): implement stopNarration, wire narrationFsm (M-1, L-3)"
```

---

### Task 8: M-2 — Forward cancellation token to synthesize()

**Files:**
- Modify: `openspace-voice-vscode/src/commands/read-aloud.ts`
- Possibly: `packages/voice-core/src/index.ts` (export CancellationToken)

**Step 1: Check if CancellationToken is exported from voice-core**
```
grep 'CancellationToken' /Users/Shared/dev/theia-openspace/.worktrees/feature-voice/packages/voice-core/src/index.ts
```

If not, add: `export type { CancellationToken } from './providers/stt-provider.interface';`

**Step 2: Update read-aloud.ts withProgress callback**
```typescript
import type { CancellationToken } from '@openspace-ai/voice-core';

async (_progress, vsToken) => {
  let cancelled = false;
  const coreToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested(handler: () => void) {
      vsToken.onCancellationRequested(() => { cancelled = true; handler(); });
    },
  };
  try {
    const result = await deps.ttsAdapter.synthesize({ text, language, voice, speed }, coreToken);
    if (cancelled) return;
    await playPcmAudio(result.audio, result.sampleRate ?? 24000);
  } catch (err) {
    if (!cancelled) {
      vscode.window.showErrorMessage(`Read aloud failed: ${(err as Error).message}`);
    }
  }
}
```

**Step 3: Verify TypeScript**

**Step 4: Commit**
```
git add openspace-voice-vscode/src/commands/read-aloud.ts packages/voice-core/src/index.ts
git commit -m "fix(vscode-voice): forward cancellation token to synthesize() (M-2)"
```

---

### Task 9: M-3 — Fix PowerShell path quoting

**Files:**
- Modify: `openspace-voice-vscode/src/audio/playback.ts`

**Step 1: Escape single quotes**
```typescript
case 'win32': {
  const escaped = filePath.replace(/'/g, "''");
  cmd = 'powershell';
  args = ['-c', `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`];
  break;
}
```

**Step 2: Verify TypeScript, commit**
```
git add openspace-voice-vscode/src/audio/playback.ts
git commit -m "fix(vscode-voice): escape single quotes in Windows PowerShell audio path (M-3)"
```

---

### Task 10: M-4 — Add whisperModel VS Code setting (adapter already has modelFile param from Task 2)

**Files:**
- Modify: `openspace-voice-vscode/package.json`
- Modify: `openspace-voice-vscode/src/extension.ts`
- Modify: `openspace-voice-vscode/README.md`

**Step 1: Add setting to package.json contributes.configuration.properties**
```json
"openspace-voice.whisperModel": {
  "type": "string",
  "default": "ggml-base.en.bin",
  "description": "Whisper GGML model filename (e.g. ggml-base.en.bin for English-only, ggml-medium.bin for multilingual)"
}
```

**Step 2: Read it in extension.ts activate()**
```typescript
const whisperModel = config.get<string>('whisperModel') ?? 'ggml-base.en.bin';
sttAdapter = new WhisperCppAdapter(whisperPath, whisperModelFolder, whisperModel);
```

**Step 3: Add whisperModel to README.md config table**

**Step 4: Verify TypeScript, run voice-core tests, commit**
```
git add openspace-voice-vscode/package.json openspace-voice-vscode/src/extension.ts openspace-voice-vscode/README.md
git commit -m "feat(vscode-voice): add whisperModel config setting (M-4 UI)"
```

---

### Task 11: L-5 + L-6 + L-7 — Package cleanup and dead code removal

**Files:**
- Modify: `packages/voice-core/package.json`
- Create: `packages/voice-core/.npmignore`
- Modify: `openspace-voice-vscode/package.json`
- Modify: `packages/voice-core/src/fsm/narration-fsm.ts`

**L-5: Add src/ to voice-core files**
```json
"files": ["lib/**", "src/**"]
```
Create `packages/voice-core/.npmignore`:
```
src/**/*.spec.ts
```

**L-6: Add repository field to vscode package.json**
```json
"repository": {
  "type": "git",
  "url": "https://github.com/openspace-ai/theia-openspace"
}
```

**L-7: Remove dead 'queued:enqueue' transition from voice-core narration-fsm.ts**
Remove: `'queued:enqueue': 'queued',` from TRANSITIONS

**Step: Run voice-core tests**
```
yarn workspace @openspace-ai/voice-core run test
```

**Step: Commit**
```
git add packages/voice-core/package.json packages/voice-core/.npmignore openspace-voice-vscode/package.json packages/voice-core/src/fsm/narration-fsm.ts
git commit -m "chore: add src/ to files, repository field, remove dead queued:enqueue (L-5, L-6, L-7)"
```

---

### Task 12: Testing Gaps — NarrationFsm + wav stereo tests

**Files:**
- Modify: `packages/voice-core/src/fsm/narration-fsm.spec.ts`
- Modify: `packages/voice-core/src/utils/wav.spec.ts`

**Add NarrationFsm tests:**

```typescript
// pause() when not playing
it('throws VoiceFsmError on pause() when idle', () => {
  const fsm = new NarrationFsm();
  assert.throws(() => fsm.pause(), (err: Error) => err instanceof VoiceFsmError);
});

it('throws VoiceFsmError on pause() when queued', () => {
  const fsm = new NarrationFsm();
  fsm.enqueue({ text: 'x', mode: 'narrate-everything', voice: 'af_sarah', speed: 1 });
  assert.strictEqual(fsm.state, 'queued');
  assert.throws(() => fsm.pause(), (err: Error) => err instanceof VoiceFsmError);
});

// enqueue() while playing, complete() returns next
it('complete() returns next queued item after playing', () => {
  const fsm = new NarrationFsm();
  const req1 = { text: 'first', mode: 'narrate-everything' as const, voice: 'af_sarah', speed: 1 };
  const req2 = { text: 'second', mode: 'narrate-everything' as const, voice: 'af_sarah', speed: 1 };
  fsm.enqueue(req1);
  fsm.startProcessing();
  fsm.audioReady();
  assert.strictEqual(fsm.state, 'playing');
  fsm.enqueue(req2);
  const next = fsm.complete();
  assert.ok(next, 'complete() should return next queued item');
  assert.strictEqual(next.text, 'second');
});
```

**Add wav stereo test:**

```typescript
it('encodes stereo (channels=2) with correct blockAlign and byteRate', () => {
  const pcm = new Uint8Array(8);
  const buf = buildWavBuffer(pcm, 44100, 2);
  const view = new DataView(buf.buffer);
  assert.strictEqual(view.getUint16(22, true), 2, 'numChannels');
  assert.strictEqual(view.getUint16(32, true), 4, 'blockAlign = 2ch * 2 bytes');
  assert.strictEqual(view.getUint32(28, true), 176400, 'byteRate = 44100 * 4');
});
```

**Step: Run tests**
```
yarn workspace @openspace-ai/voice-core run test
```
Expected: 42+ passing

**Step: Commit**
```
git add packages/voice-core/src/fsm/narration-fsm.spec.ts packages/voice-core/src/utils/wav.spec.ts
git commit -m "test(voice-core): NarrationFsm gap tests, stereo WAV test"
```

---

### Task 13: INFRA-1 + Documentation alignment + Final verification

**Step 1: Add INFRA-1 note to implementation plan**

Add a section at the bottom of `docs/plans/2026-02-20-openspace-voice-implementation-plan.md`:

```markdown
## Infrastructure Notes

### Worktree node_modules (INFRA-1)
The feature-voice worktree has its own 1.1 GB node_modules (gitignored).
This is expected: the voice branch adds kokoro-js, node-record-lpcm16, @vscode/vsce, etc.
CI must run `yarn install` from the worktree root before building.
```

**Step 2: Final build + test verification**
```
yarn workspace @openspace-ai/voice-core run test
yarn workspace @openspace-ai/voice-core run build
yarn workspace openspace-voice tsc --noEmit
```

**Step 3: Commit**
```
git add docs/plans/2026-02-20-openspace-voice-implementation-plan.md
git commit -m "docs: document worktree node_modules strategy (INFRA-1)"
```
