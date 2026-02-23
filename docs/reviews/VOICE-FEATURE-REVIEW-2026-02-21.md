# Voice Feature — Consolidated Code Review

**Date:** 2026-02-21
**Scope:** `feature-voice` git worktree
**Reviewed packages:**
- `packages/voice-core/` — shared `@openspace-ai/voice-core` npm package
- `openspace-voice-vscode/` — VS Code Marketplace extension
- `extensions/openspace-voice/` — Theia/OpenSpace bundled extension

**Previous reviews:**
- `VOICE-FEATURE-REVIEW-2026-02-20.md` — initial plan review (all 5 blockers now fixed)
- This document supersedes that review; findings below reflect the actual implemented code.

---

## Repository / Infrastructure Finding

### INFRA-1: Worktree has a duplicate `node_modules` (1.1 GB)

**Severity:** Operational — not a bug, but 2 GB of disk used where ~800 MB is expected

```
/Users/Shared/dev/theia-openspace/node_modules           813 MB  (main project)
/Users/Shared/dev/theia-openspace/.worktrees/feature-voice/node_modules  1.1 GB
```

The feature-voice worktree ran `npm install` independently, producing its own full `node_modules`. Git worktrees share history but have separate working directories, so `npm install` in the worktree creates an entirely separate package tree. The 1.1 GB is ~300 MB larger than the main tree, consistent with the new voice dependencies (`node-record-lpcm16`, `play-sound`, `kokoro-js`, `@vscode/vsce`).

`node_modules/` is correctly gitignored so it will not be committed. This is a disk/CI concern only.

**Options:**
1. **Symlink:** `ln -s ../../node_modules /path/to/worktree/node_modules` — only works if the two dependency trees are compatible (risky).
2. **Accept:** Since the voice branch adds new packages, a separate install is the safe path. Note it in the worktree README so developers know why it's large.
3. **npm workspaces at root:** Declare `packages/voice-core` and `openspace-voice-vscode` in the root `package.json` `workspaces` field. `npm install` from the root then hoists all packages to one `node_modules`.

**Root cause of the 9.4 MB file listing:** An Explore agent ran `find` without excluding `node_modules`, enumerating all ~50,000 files in the worktree's `node_modules`. This is a process failure in the agent tooling, not a project bug.

---

## Critical Issues (Blockers)

### C-1: `require()` fails on ESM-only `kokoro-js` — TTS is completely non-functional

**File:** `packages/voice-core/src/adapters/kokoro.adapter.ts`, lines 26 and 79
**Impact:** `isAvailable()` always returns `false`; `synthesize()` always throws

```typescript
// isAvailable() — line 26
require('kokoro-js');

// getModel() — line 79
// Comment says: "kokoro-js is ESM-only, use require() in CommonJS context"
const kokoroModule = require('kokoro-js') as { KokoroTTS: KokoroTTSConstructor };
```

The comment is self-contradicting. In Node.js 18–22 (standard, no flags), `require()` on an ESM-only module throws `ERR_REQUIRE_ESM`. Consequences:

- `isAvailable()` catches the error and returns `false` → extension always warns "Missing dependencies: kokoro-js" even when it is installed.
- `getModel()` throws on every call → every `synthesize()` call fails.
- Result: TTS is 100% broken regardless of whether `kokoro-js` is installed.

The `@xenova/transformers` / `kokoro-js` family publishes ESM-only builds. `require()` cannot load them in standard Node.js.

**Fix:** Replace every `require('kokoro-js')` with `await import('kokoro-js')`:

```typescript
// isAvailable()
async isAvailable(): Promise<boolean> {
  try { await import('kokoro-js'); return true; }
  catch { return false; }
}

// getModel()
const { KokoroTTS } = await import('kokoro-js');
```

This also requires the voice-core `tsconfig.json` to use `"module": "node16"` or `"moduleResolution": "bundler"` so TypeScript accepts dynamic `import()` in a CommonJS output context. The VS Code extension bundler (webpack/esbuild) must be configured to handle the ESM import boundary.

---

### C-2: Theia `AudioFsm` sends WebM audio; backend writes it into a WAV container treating it as raw PCM

**File:** `extensions/openspace-voice/src/browser/audio-fsm.ts`, lines 47–58
**Impact:** All STT transcription in Theia produces garbage output or whisper.cpp errors

```typescript
// Browser: MediaRecorder produces compressed WebM/Opus
const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
const arrayBuffer = await audioBlob.arrayBuffer();
const audio = new Uint8Array(arrayBuffer);  // ← WebM container bytes

await fetch(this.options.sttEndpoint, {
  headers: { 'Content-Type': 'application/octet-stream' },
  body: audio,  // ← WebM sent as opaque bytes
});
```

The backend receives these bytes, passes them to `WhisperCppAdapter.transcribe()`, which calls `buildWavBuffer(audio, 16000, 1)`. This prepends a valid 44-byte WAV header to the WebM container bytes and writes the result as a `.wav` file. whisper.cpp then reads a file whose header says "16-bit PCM at 16 kHz" but whose payload is WebM-encoded Opus audio. whisper.cpp will either:
- Reject the file with a format error
- Attempt to decode and produce nonsensical transcription

**Fix (browser-side decode — preferred):**

```typescript
// In AudioFsm.stopCapture(), after MediaRecorder stops:
const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
const arrayBuffer = await audioBlob.arrayBuffer();

// Decode compressed audio → raw Float32 PCM
const audioCtx = new AudioContext({ sampleRate: 16000 });
const decoded = await audioCtx.decodeAudioData(arrayBuffer);
audioCtx.close();

// Extract mono channel as Int16
const f32 = decoded.getChannelData(0);
const int16 = new Int16Array(f32.length);
for (let i = 0; i < f32.length; i++) {
  int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)));
}

// Send raw PCM with sample rate metadata
await fetch(this.options.sttEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'audio/raw',
    'X-Voice-Language': this.options.language,
    'X-Sample-Rate': '16000',
  },
  body: new Uint8Array(int16.buffer),
});
```

The backend's `SttTranscriptionRequest.sampleRate` field already exists for this purpose.

---

## High Issues

### H-1: `throw err` inside EventEmitter `error` listener — uncaught exception crashes the extension host

**File:** `openspace-voice-vscode/src/commands/dictation.ts`, lines 41–43

```typescript
recorder.stream().on('error', (err: Error) => {
  throw err;  // ← NOT caught by the surrounding async try/catch
});
```

In Node.js, throwing inside an `EventEmitter` listener does not propagate to any enclosing `try/catch` — it becomes an uncaught exception on the event loop. In VS Code's extension host this either:
- Crashes the host process (surface: "Extension host terminated unexpectedly")
- Or fires as an `uncaughtException` event, bypassing the command's error handling entirely

The recorder is not stopped, the FSM stays in `'listening'`, and the user sees no `showErrorMessage` — the recording is silently stuck.

**Fix:** Signal the outer async flow explicitly:

```typescript
let recordingError: Error | null = null;
const stream = recorder.stream();
stream.on('data', (chunk: Buffer) => pcmChunks.push(chunk));
stream.on('error', (err: Error) => {
  recordingError = err;
  try { recorder.stop(); } catch { /* ignore */ }
});

// Show recording UI, wait for Stop
await vscode.window.showInformationMessage('Recording… Click Stop when done', { modal: false }, 'Stop');
recorder.stop();

if (recordingError) throw recordingError;  // now caught by outer try/catch
```

---

### H-2: `recorder.stream()` called twice — `data` and `error` on potentially different stream objects

**File:** `openspace-voice-vscode/src/commands/dictation.ts`, lines 40–43

```typescript
recorder.stream().on('data', (chunk: Buffer) => pcmChunks.push(chunk));
recorder.stream().on('error', (err: Error) => { throw err; });
```

`stream()` is a method call. If `node-record-lpcm16`'s implementation constructs or wraps a new `Readable` each time, these are two separate objects. Data chunks go to the first; errors go to the second. The error listener on the second stream is also the `throw err` path described in H-1.

**Fix:** Call `stream()` exactly once:

```typescript
const stream = recorder.stream();
stream.on('data', (chunk: Buffer) => pcmChunks.push(chunk));
stream.on('error', (err: Error) => { /* ... */ });
```

---

### H-3: `whisper-cpp.adapter.ts` — `--output-txt tmpFile` writes a file, not stdout; stdout has log/progress text

**File:** `packages/voice-core/src/adapters/whisper-cpp.adapter.ts`, line 46

```typescript
const proc = this.spawnFn(
  this.binaryPath,
  ['--language', request.language,
   '-m', path.join(this.modelFolder, 'ggml-base.en.bin'),
   '--output-txt', tmpFile],    // ← problem here
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
// ...
const text = Buffer.concat(stdout).toString('utf8').trim();  // ← reading stdout
resolve({ text });
```

In whisper.cpp, `--output-txt` (or `-otxt`) enables text-format output **to a file**. When a filename follows, whisper creates `<prefix>.txt` on disk (e.g., `/tmp/whisper-123.wav.txt`). Stdout in this mode contains timestamped progress/log lines like:

```
whisper_init_from_file_with_params_no_state: loading model from '...'
[00:00:00.000 --> 00:00:03.000]  hello world
```

The code reads stdout and returns all of that as the transcript text.

**Additionally:** The positional audio file argument is missing. The correct invocation format is:
```
whisper -m model.bin [options] audio.wav
```
With `--output-txt` as a flag and `tmpFile` as the positional audio argument. In the current code, `tmpFile` follows `--output-txt` and may be parsed as the output prefix, not the audio input.

**Fix — write to file and read back:**

```typescript
const outPrefix = tmpFile.replace(/\.wav$/, '');
const outTxtFile = outPrefix + '.txt';

const proc = this.spawnFn(
  this.binaryPath,
  [
    '-m', path.join(this.modelFolder, this.modelFile),
    '--language', request.language,
    '-otxt',           // enable text output
    '-of', outPrefix,  // output filename prefix (creates outPrefix.txt)
    tmpFile,           // positional: input audio file
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },  // only stderr for error detection
);

proc.on('close', (code) => {
  if (code !== 0) {
    const errText = Buffer.concat(stderr).toString('utf8').trim();
    reject(new Error(`whisper.cpp exited ${code}: ${errText}`));
    return;
  }
  try {
    const text = fs.readFileSync(outTxtFile, 'utf8').trim();
    resolve({ text });
  } catch (readErr) {
    reject(new Error(`whisper.cpp output file not found: ${readErr}`));
  } finally {
    try { fs.unlinkSync(outTxtFile); } catch { /* ignore */ }
  }
});
```

Note: The exact flags (`-otxt`, `-of`) vary by whisper.cpp version. This should be validated against the minimum supported version and documented.

---

## Medium Issues

### M-1: `openspace-voice.stopNarration` declared in manifest but never registered

**File:** `openspace-voice-vscode/package.json` line 37 + `src/extension.ts`

The manifest declares a fourth command:
```json
{ "command": "openspace-voice.stopNarration", "title": "Voice: Stop Narration" }
```

Only three commands are registered in `extension.ts`: `startDictation`, `readAloud`, `configure`. Invoking "Voice: Stop Narration" from the Command Palette shows:
> `command 'openspace-voice.stopNarration' not found`

Either implement it (wire to `narrationFsm.pause()` or abort playback) or remove it from `contributes.commands`.

---

### M-2: Cancellation token not forwarded to `synthesize()` — Cancel button has no effect on in-progress synthesis

**File:** `openspace-voice-vscode/src/commands/read-aloud.ts`, lines 39–50

```typescript
await vscode.window.withProgress(
  { ..., cancellable: true },
  async (_progress, token) => {
    const result = await deps.ttsAdapter.synthesize({ text, language, voice, speed });
    // ↑ token is not passed; synthesis runs regardless of cancellation
    if (token.isCancellationRequested) return;  // only cancels playback, not synthesis
    await playPcmAudio(result.audio, result.sampleRate ?? 24000);
  }
);
```

VS Code shows a Cancel button during progress. User clicks it → `token.isCancellationRequested = true` → but `synthesize()` is still running and will block for several seconds until complete. The perceived UX is: "Cancel does nothing."

**Fix:** Wrap the VS Code token and pass it to the adapter:

```typescript
async (_progress, vsToken) => {
  let cancelled = false;
  const coreToken: CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested(h) {
      vsToken.onCancellationRequested(() => { cancelled = true; h(); });
    },
  };
  const result = await deps.ttsAdapter.synthesize({ text, language, voice, speed }, coreToken);
  if (cancelled) return;
  await playPcmAudio(result.audio, result.sampleRate ?? 24000);
}
```

Note: `KokoroAdapter.synthesize()` accepts `_token` (with underscore — currently unused). Kokoro's ONNX inference cannot be interrupted mid-call, but passing the token allows at least preventing playback from starting and enables future cancellation support.

---

### M-3: Windows playback — single quotes in path break PowerShell command

**File:** `openspace-voice-vscode/src/audio/playback.ts`, lines 32–34

```typescript
args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
```

If the Windows username contains a single quote (e.g., `O'Brien`), `os.tmpdir()` returns a path with `'`, breaking the PowerShell syntax. Result: playback always fails silently for those users.

**Fix:**
```typescript
const escaped = filePath.replace(/'/g, "''");  // PowerShell single-quote escape
args = ['-c', `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`];
```

Or use double-quoted string in PowerShell and escape `$` and `"`:
```typescript
const escaped = filePath.replace(/"/g, '`"');
args = ['-c', `(New-Object Media.SoundPlayer "${escaped}").PlaySync()`];
```

---

### M-4: Model filename hardcoded to `ggml-base.en.bin` — non-English STT silently fails

**File:** `packages/voice-core/src/adapters/whisper-cpp.adapter.ts`, line 46

```typescript
'-m', path.join(this.modelFolder, 'ggml-base.en.bin'),
```

`ggml-base.en.bin` is an **English-only** Whisper model. If the user sets `openspace-voice.language` to any non-English locale, whisper.cpp processes the audio through an English-only model and produces poor or nonsensical output. No error is thrown.

**Fix:** Add a `modelFile` constructor parameter and corresponding VS Code setting:

```typescript
constructor(
  private readonly binaryPath = 'whisper',
  private readonly modelFolder = '/usr/local/share/whisper',
  private readonly modelFile = 'ggml-base.en.bin',  // ← add
  private readonly spawnFn: SpawnFn = spawn,
) {}
```

And in `package.json`:
```json
"openspace-voice.whisperModel": {
  "type": "string",
  "default": "ggml-base.en.bin",
  "description": "Whisper model filename (e.g. ggml-base.en.bin for English-only, ggml-medium.bin for multilingual)"
}
```

---

### M-5: `VoiceHubContribution` — `voiceService` is `undefined` during async provider initialization

**File:** `extensions/openspace-voice/src/node/voice-hub-contribution.ts`, lines 99–133

```typescript
configure(app: Application): void {
  this.initVoiceService();   // ← void; Promise runs in background
  app.post('/openspace/voice/stt', async (req, res) => {
    const result = await this.voiceService.transcribeSpeech(...)  // ← voiceService may be undefined
  });
}

private initVoiceService(): void {
  Promise.all([sttSelector.selectProvider(), ttsSelector.selectProvider()])
    .then(([stt, tts]) => { this.voiceService = new VoiceBackendService(...); })
```

HTTP routes are registered synchronously; provider selection (`isAvailable()` probes) is async. If a browser request arrives during the few hundred milliseconds before `Promise.all` resolves, `this.voiceService` is `undefined` and the handler throws `TypeError: Cannot read properties of undefined`.

The error-stub fallback in `.catch()` mitigates total failure, but the race window between `configure()` returning and the `.then()` running is still unguarded.

**Fix:** Keep a readiness Promise and await it in each handler:

```typescript
private readyPromise: Promise<void> = Promise.resolve();

private initVoiceService(): void {
  this.readyPromise = Promise.all([...]).then(([stt, tts]) => {
    this.voiceService = new VoiceBackendService({ sttProvider: stt, ttsProvider: tts, ... });
  }).catch((err) => {
    console.error('[VoiceHub] Provider init failed, using stubs:', err);
    this.voiceService = /* stubs */;
  });
}

// In each handler:
await this.readyPromise;
const result = await this.voiceService.transcribeSpeech(...);
```

**Secondary issue:** `VoiceHubContribution` constructs `SttProviderSelector` and `TtsProviderSelector` directly via `new`. These should be injected through Theia's DI container (`@inject()`) for testability and lifecycle management, consistent with every other contribution in the codebase.

---

### M-6: Theia `NarrationFsm` — recursive `processQueue()` risks stack overflow

**File:** `extensions/openspace-voice/src/browser/narration-fsm.ts`, lines 87–92

```typescript
if (this.queue.length > 0) {
  const next = this.queue.shift()!;
  this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
  await this.processQueue(next);   // ← tail recursion via async
}
```

Each completed narration item calls `processQueue()` on the next. In practice for voice sessions this is a small queue, but for a session with many short AI response segments or a stress test, this could exhaust the call stack. Async `await` does not eliminate stack frames in V8's async stack traces.

**Fix:** Replace with an iterative while loop:

```typescript
private async processDrainLoop(first: NarrationRequest): Promise<void> {
  let current: NarrationRequest | undefined = first;
  while (current) {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'startProcessing' });
    await this.fetchAndPlay(current);
    this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
    this.options.onPlaybackComplete?.();
    current = this.queue.shift();
    if (current) {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
    }
  }
}
```

---

### M-7: Theia `NarrationFsm` — error handler bypasses FSM with direct state assignment

**File:** `extensions/openspace-voice/src/browser/narration-fsm.ts`, line 94

```typescript
} catch (err) {
  this._state = 'idle';  // ← direct assignment, bypasses validateNarrationTransition
  this.options.onError?.(err as Error);
}
```

Everywhere else in the class, state changes go through `validateNarrationTransition()`. This direct assignment skips the validator, violating the FSM contract. It also means there's no `'processing:error'` or `'playing:error'` transition defined — if you tried to use the validator it would throw `VoiceFsmError`.

**Fix:** Add error transitions to `voice-fsm.ts`:
```typescript
'processing:error': 'idle',
'playing:error': 'idle',
'queued:error': 'idle',
```
And use them:
```typescript
} catch (err) {
  this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
  this.options.onError?.(err as Error);
}
```

---

### M-8: `KokoroAdapter.synthesize()` — `Uint8Array` branch returns raw float32 bytes mislabelled as int16

**File:** `packages/voice-core/src/adapters/kokoro.adapter.ts`, lines 51–53

```typescript
} else if (audioData instanceof Uint8Array) {
  audioBytes = audioData;   // ← returned as-is
}
```

`TtsSynthesisResult.audio` is documented as "raw 16-bit PCM samples." If Kokoro's `generate()` returns a `Uint8Array` view of a `Float32Array` buffer (which can happen if the library's internal format changes), returning it as-is gives 4 bytes per sample instead of 2, and the `playPcmAudio()` caller will misinterpret the data.

This branch needs explicit handling: either convert from Float32 if that's what it is, or throw if an unexpected format is returned. At minimum, add a warning log.

---

## Low Issues

### L-1: `KokoroAdapter.getModel()` — 100 ms spin-wait polling anti-pattern

**File:** `packages/voice-core/src/adapters/kokoro.adapter.ts`, lines 69–72

```typescript
while (this.modelLoading) await new Promise(r => setTimeout(r, 100));
```

Concurrent callers of `synthesize()` poll every 100 ms while the model loads (which takes several seconds on CPU). This creates unnecessary timer pressure and up to 100 ms extra latency per concurrent caller.

**Fix:** Share the loading Promise:
```typescript
private modelLoadPromise: Promise<KokoroTTSInstance> | null = null;

private getModel(): Promise<KokoroTTSInstance> {
  if (this.model) return Promise.resolve(this.model);
  if (!this.modelLoadPromise) {
    this.modelLoadPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js');
      this.model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
      return this.model;
    })().catch(err => {
      this.modelLoadError = err;
      this.modelLoadPromise = null;
      throw err;
    });
  }
  return this.modelLoadPromise;
}
```

---

### L-2: `whisper-cpp.adapter.ts` — `reject()` called twice on cancellation

**File:** `packages/voice-core/src/adapters/whisper-cpp.adapter.ts`, lines 57–71

When the cancellation token fires: `proc.kill()` is called, then `reject()` with "cancelled". The process then emits `close` with exit code `-2`, triggering a second `reject()` with "exited -2". Promises silently ignore the second rejection, so there's no functional bug — but the error message seen by the caller depends on which `reject()` wins (the first one always wins for Promise, so "cancelled" is correct). A settled guard makes the intent explicit:

```typescript
let settled = false;
const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
token?.onCancellationRequested(() => { proc.kill(); settle(() => reject(new Error('STT cancelled'))); });
proc.on('close', (code) => settle(() => { /* normal resolution */ }));
```

---

### L-3: `extension.ts` — `void narrationFsm` suppression hack

**File:** `openspace-voice-vscode/src/extension.ts`, lines 17, 29, 121–122

```typescript
let narrationFsm: NarrationFsm;
narrationFsm = new NarrationFsm();
// In deactivate():
void narrationFsm;  // suppress unused variable warning
```

`narrationFsm` is fully initialized but never used. The `void` idiom is unusual and confusing. If the VS Code extension does not yet support narration control (only `stopNarration` is even declared, not implemented), remove the FSM. Add it back with `stopNarration` implementation.

---

### L-4: Theia `narration-fsm.ts` — `playAudioBuffer` uses `/ 32767` not `/ 32768`

**File:** `extensions/openspace-voice/src/browser/narration-fsm.ts`, line 103

```typescript
for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32767;
```

The inverse of the correct encoder (`int16 = Math.round(f32 * 32768)`) is `f32 = int16 / 32768`. Using `/ 32767` means a sample value of `-32768` maps to `-1.0003...`, slightly outside the `[-1.0, 1.0]` range that `AudioContext` expects. Potential subtle clipping artefact.

**Fix:** `float32[i] = int16[i] / 32768`

---

### L-5: `voice-core` — source files excluded from published package; source-map debugging broken

**File:** `packages/voice-core/package.json`, line 10

```json
"files": ["lib/**"]
```

`tsconfig.json` has `"sourceMap": true` and `"declarationMap": true`. The generated `.js.map` and `.d.ts.map` files in `lib/` are included, but they reference `../src/` paths that are not in the package. Consumers debugging into voice-core see compiled JS, not the original TypeScript.

**Fix:** Add `"src/**"` to `files`. Use `.npmignore` to exclude `*.spec.ts` from the published source:
```json
"files": ["lib/**", "src/**"]
```

---

### L-6: `openspace-voice-vscode/package.json` — missing `repository` and `icon`

The VS Code extension manifest is missing:
- `"repository"`: Links the Marketplace listing to source (used by `vsce` and npm audit)
- `"icon"`: A 128×128 PNG is strongly recommended for Marketplace visibility; without it the listing shows a generic placeholder

---

### L-7: `NarrationFsm` (both) — `'queued:enqueue'` transition is dead code

**Files:** `packages/voice-core/src/fsm/narration-fsm.ts` and `extensions/openspace-voice/src/browser/narration-fsm.ts`

The transition table includes:
```typescript
'queued:enqueue': 'queued',
```

But the `enqueue()` method only calls `transition()` / `validateNarrationTransition()` when `_state === 'idle'`. For all other states it pushes directly to the queue without going through the transition function. The `'queued:enqueue'` entry is never invoked. This is a consistency issue: the table declares a valid transition that the implementation never exercises, creating confusion about what the table is authoritative for.

---

## Testing Gaps

The new test suites are genuinely good — mock-based, assertion-complete, covering error paths. Remaining gaps:

| Gap | Priority | Description |
|-----|----------|-------------|
| `WhisperCppAdapter.transcribe()` cancellation | High | No test verifying `proc.kill()` is called and promise rejects with "cancelled" |
| Concurrent `getModel()` | Medium | Two simultaneous `synthesize()` calls; only one model load should start |
| `AudioFsm` — double `startCapture()` | Medium | Should throw `VoiceFsmError`, not start a second recorder |
| `NarrationFsm.pause()` while not `playing` | Medium | Should throw `VoiceFsmError` |
| `NarrationFsm.enqueue()` while `playing` | Medium | Item in queue; `complete()` returns it |
| `buildWavBuffer` — stereo (channels=2) | Low | Block align and byte rate depend on channel count |
| VS Code commands | High | `dictation.ts` and `read-aloud.ts` have zero unit tests; H-1, H-2, M-2 cannot be caught by CI without them |

---

## Summary Table — All Issues

| ID | Sev | File | Issue |
|----|-----|------|-------|
| INFRA-1 | Operational | worktree | Duplicate 1.1 GB `node_modules`; ~2 GB total disk use |
| C-1 | **Blocker** | `kokoro.adapter.ts` | `require()` on ESM-only `kokoro-js` — TTS never works; use `await import()` |
| C-2 | **Blocker** | `audio-fsm.ts` (Theia) | MediaRecorder WebM bytes sent as raw PCM to STT — transcription always garbage |
| H-1 | High | `dictation.ts` | `throw err` in EventEmitter listener = uncaught exception, not caught by try/catch |
| H-2 | High | `dictation.ts` | `recorder.stream()` called twice — data/error on potentially different objects |
| H-3 | High | `whisper-cpp.adapter.ts` | `--output-txt tmpFile` creates a disk file; stdout has log text, not transcript |
| M-1 | Medium | `extension.ts` | `stopNarration` command in manifest, never registered — "command not found" in palette |
| M-2 | Medium | `read-aloud.ts` | Cancellation token not forwarded to `synthesize()` — Cancel button cosmetic only |
| M-3 | Medium | `playback.ts` | Windows PowerShell: single quote in path breaks command (e.g. username `O'Brien`) |
| M-4 | Medium | `whisper-cpp.adapter.ts` | Model hardcoded `ggml-base.en.bin` — non-English STT silently produces garbage |
| M-5 | Medium | `voice-hub-contribution.ts` | `voiceService` undefined during async init race; DI not used for selectors |
| M-6 | Medium | `narration-fsm.ts` (Theia) | Recursive `processQueue()` — stack overflow risk on large queues |
| M-7 | Medium | `narration-fsm.ts` (Theia) | Error handler assigns `_state = 'idle'` directly, bypassing FSM validator |
| M-8 | Medium | `kokoro.adapter.ts` | `Uint8Array` audio branch returned as-is may mislabel float32 bytes as int16 |
| L-1 | Low | `kokoro.adapter.ts` | Spin-wait 100ms polling during concurrent model load — share the load Promise |
| L-2 | Low | `whisper-cpp.adapter.ts` | `reject()` called twice on cancellation — harmless but add settled guard |
| L-3 | Low | `extension.ts` | `void narrationFsm` hack — remove unused FSM or implement `stopNarration` |
| L-4 | Low | `narration-fsm.ts` (Theia) | `/ 32767` should be `/ 32768` in Int16→Float32 back-conversion |
| L-5 | Low | `voice-core/package.json` | `src/**` not in `files` — source-map debugging broken for package consumers |
| L-6 | Low | `vscode/package.json` | Missing `repository` and `icon` fields |
| L-7 | Low | Both `narration-fsm.ts` | `'queued:enqueue'` transition entry is dead code — never called through transition fn |

---

## Recommended Fix Order for the Coding Agent

**Sprint 1 — Make the feature functional end-to-end:**
1. **C-1** — Replace `require('kokoro-js')` with `await import('kokoro-js')` in `kokoro.adapter.ts`
2. **C-2** — Decode WebM to raw PCM in `AudioFsm.stopCapture()` before sending to `/voice/stt`
3. **H-3** — Fix whisper.cpp CLI invocation: use `-otxt -of <prefix> <audio.wav>` and read the output `.txt` file

**Sprint 2 — Fix reliability and safety:**
4. **H-1** — Replace `throw err` in EventEmitter listener with error signal variable
5. **H-2** — Call `recorder.stream()` once; assign to local variable
6. **M-5** — Add `readyPromise` gate in `VoiceHubContribution`; inject selectors via DI

**Sprint 3 — Polish and completeness:**
7. **M-1** — Implement or remove `stopNarration` command
8. **M-2** — Forward cancellation token to `synthesize()`
9. **M-3** — Fix PowerShell path quoting for Windows
10. **M-4** — Make model filename configurable; expose `whisperModel` setting
11. **M-6** — Replace recursive `processQueue` with iterative drain loop
12. **M-7** — Add error transitions to FSM; use validator in catch block
13. **L-1 through L-7** — Low-priority cleanup in any order

**INFRA-1** — Decide on worktree `node_modules` strategy; document in worktree README regardless.
