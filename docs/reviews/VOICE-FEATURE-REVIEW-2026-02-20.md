# Voice Feature Review — Design & Implementation Plan

**Date:** 2026-02-20
**Reviewer:** Code Review
**Files reviewed:**
- `.worktrees/feature-voice/docs/plans/2026-02-20-openspace-voice-extension-design.md`
- `.worktrees/feature-voice/docs/plans/2026-02-20-openspace-voice-implementation-plan.md`

---

## Overview

The feature-voice branch introduces a cross-platform voice (STT + TTS) subsystem with three packages:

| Package | Target | Distribution |
|---------|--------|-------------|
| `@openspace-ai/voice-core` | Node.js (no UI) | npm |
| `openspace-voice-vscode` | VS Code extension host | Marketplace |
| `openspace-voice-theia` | Theia browser/node | Bundled |

The design is directionally sound. However there are **five critical bugs** that would prevent the VS Code extension from functioning at all, a **logic bug** in the NarrationFsm queue, and a range of architectural and testing gaps documented below.

---

## Critical Issues (Blocker)

### C-1: `navigator.mediaDevices.getUserMedia` does not exist in VS Code

**File:** Implementation Plan, Task 7, `startDictation()`
**Severity:** Blocker — the extension will crash at runtime

```typescript
// THIS WILL THROW: ReferenceError: navigator is not defined
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

VS Code extensions run in a **Node.js** extension host process, not a browser. `navigator`, `window`, `AudioContext`, and all Web APIs are undefined. This call will throw `ReferenceError: navigator is not defined` on the first dictation attempt.

**Fix:** Use a cross-platform native audio capture library:
- `node-record-lpcm16` (npm) — wraps `sox`/`arecord`/`afplay`
- `portaudio` bindings (`naudiodon`)
- Or invoke `sox`/`ffmpeg` as a child process the same way whisper.cpp is spawned

---

### C-2: Web Audio API (`AudioContext`) does not exist in VS Code

**File:** Implementation Plan, Task 8, comment "Implement audio playback using Web Audio API"
**Severity:** Blocker — TTS playback has no implementation path

Task 8 synthesizes audio but the proposed playback mechanism — Web Audio API — is equally unavailable in the Node.js extension host. `playAudio(result.audio)` is called but never defined. The plan says to "implement using Web Audio API" which is impossible.

**Fix:** Use platform-specific audio playback:
```typescript
// macOS: spawn('afplay', [tmpWavFile])
// Linux: spawn('aplay', [tmpWavFile])
// Windows: spawn('powershell', ['-c', `(New-Object Media.SoundPlayer "${tmpWavFile}").PlaySync()`])
```
Or use `play-sound` npm package which handles the platform detection. Either way, TTS output must be written to a temp WAV file (see C-4).

---

### C-3: `whisper.cpp` does not read audio from stdin

**File:** Implementation Plan, Task 2, `WhisperCppAdapter.transcribe()`
**Severity:** Blocker — transcription will never complete

```typescript
proc.stdin.write(Buffer.from(request.audio));
proc.stdin.end();
```

The standard `whisper.cpp` CLI binary (`main` or `whisper-cli`) requires a **WAV file path** as a positional argument. It does not read from stdin. The process will either hang (waiting for a file argument), or exit with an error, and the `Promise` will either reject or hang forever.

**Fix:** Write audio bytes to a temp file, pass the path as argument, clean up after:
```typescript
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

async transcribe(request: SttTranscriptionRequest): Promise<SttTranscriptionResult> {
  const tmpFile = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
  fs.writeFileSync(tmpFile, buildWavBuffer(request.audio));  // see C-4
  try {
    return await new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, ['--language', request.language, '--output-txt', tmpFile]);
      // ...
    });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}
```

---

### C-4: No WAV header — raw PCM bytes cannot be processed by whisper.cpp

**File:** Implementation Plan, Task 3, `KokoroAdapter.synthesize()` + Task 2 `WhisperCppAdapter.transcribe()`
**Severity:** Blocker — audio data is uninterpretable without a header

`SttTranscriptionRequest.audio` is a `Uint8Array` of raw PCM samples, and `TtsSynthesisResult.audio` is similarly headerless raw PCM. Whisper.cpp expects a WAV file (44-byte RIFF header declaring sample rate, channels, bit depth). Without the header, whisper.cpp will either reject the file or misinterpret the data.

**Fix:** Add a WAV header builder in `voice-core`:

```typescript
// voice-core/src/utils/wav.ts
export function buildWavBuffer(pcm16: Uint8Array, sampleRate = 16000, channels = 1): Buffer {
  const dataLen = pcm16.length;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // subchunk1 size
  buf.writeUInt16LE(1, 20);       // PCM format
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  buf.writeUInt16LE(channels * 2, 32);              // block align
  buf.writeUInt16LE(16, 34);      // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  Buffer.from(pcm16).copy(buf, 44);
  return buf;
}
```

The `SttTranscriptionRequest.audio` interface should also declare its sample rate so adapters know how to build the header:
```typescript
export interface SttTranscriptionRequest {
  audio: Uint8Array;
  sampleRate: number;   // add this
  language: string;
}
```

---

### C-5: `whisper.cpp` CLI does not support `--version`

**File:** Implementation Plan, Task 2, `WhisperCppAdapter.isAvailable()`
**Severity:** Critical — availability detection always returns `false`

```typescript
const proc = spawn(this.binaryPath, ['--version'], { stdio: 'pipe' });
proc.on('close', (code) => resolve(code === 0));
```

The whisper.cpp CLI binary (`main`) does not implement a `--version` flag. It exits with a non-zero code on unrecognized flags, causing `isAvailable()` to always return `false`. The extension will always warn "Some voice providers are not available" even when whisper.cpp is properly installed.

**Fix:** Use `--help` (exits 0) or check for binary existence:
```typescript
async isAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(this.binaryPath, ['--help'], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}
```

---

## High Issues

### H-1: NarrationFsm queue logic bug — items queued in non-idle states are never consumed

**File:** Implementation Plan, Task 4, `NarrationFsm`
**Severity:** High — narration silently stalls

```typescript
enqueue(request: NarrationRequest): void {
  if (request.mode === 'narrate-off') return;
  if (this._state === 'idle') {           // ← only transitions when idle
    this._state = this.transition(this._state, 'enqueue');
  }
  this.queue.push(request);               // ← always pushes
}
```

When `_state !== 'idle'` (e.g., already `'queued'` or `'processing'`), the item is pushed to `this.queue` but no state transition occurs. There is also **no `dequeue()` or `next()` method**, so the queue is write-only from the outside. The state machine has no mechanism to drain the queue after `complete()` returns to `'idle'`.

**Additionally:** `complete()` always transitions to `'idle'`, even if items are waiting in the queue. The correct behavior is: if queue is non-empty after a `complete()`, transition to `'queued'` and return the next item.

**Fix:**
```typescript
dequeue(): NarrationRequest | undefined {
  return this.queue.shift();
}

complete(): NarrationRequest | undefined {
  const next = this.queue.shift();
  if (next) {
    this._state = 'queued';   // stay in queued if more work
  } else {
    this._state = 'idle';
  }
  return next;
}
```

---

### H-2: `kokoroModel` singleton is never released — memory leak on extension deactivate

**File:** Implementation Plan, Task 3, `kokoro.adapter.ts`
**Severity:** High — Kokoro ONNX model (~80-300MB) stays loaded indefinitely

```typescript
let kokoroModel: import('kokoro-js').KokoroTTS | null = null;

async function getKokoroModel(): Promise<import('kokoro-js').KokoroTTS> {
  if (kokoroModel) return kokoroModel;
  // ...loads model...
}
```

`deactivate()` in `extension.ts` is empty:
```typescript
export function deactivate() {}
```

When VS Code unloads the extension (e.g., user disables it), the model object remains in Node.js heap because `kokoroModel` still holds the reference. The `KokoroAdapter` instance in `extension.ts` has no `dispose()` method.

**Additionally:** `kokoroModel` is module-level, not accessible from `extension.ts`, so even if `deactivate()` tried to clean up, it can't reach the variable.

**Fix:** Make `KokoroAdapter` disposable and expose cleanup:
```typescript
export class KokoroAdapter implements TtsProvider {
  private model: KokoroTTS | null = null;

  async dispose(): Promise<void> {
    this.model = null;
  }
}

// extension.ts
export async function deactivate() {
  await ttsAdapter.dispose();
}
```

---

### H-3: FSM transitions use `Record<string, string>` — typos not caught by TypeScript

**File:** Implementation Plan, Task 4 — all three FSM `transition()` methods
**Severity:** High — silent bugs at runtime, no compile-time safety

```typescript
const transitions: Record<string, string> = {
  'inactive:enable': 'active',     // ← value is 'string', not 'SessionState'
  ...
};
return transitions[key] as SessionState;  // ← unsafe cast
```

If a transition value has a typo (e.g., `'acitve'`), TypeScript accepts it. The cast `as SessionState` silences the error. The FSM silently produces an invalid state string that will match no subsequent transitions and then throw opaquely.

**Fix:** Type the transition tables properly:
```typescript
// SessionFsm
const transitions: Partial<Record<`${SessionState}:${SessionTrigger}`, SessionState>> = {
  'inactive:enable': 'active',
  ...
};
```
This makes both keys and values fully type-checked.

---

### H-4: `SessionFsm.enable()` / `disable()` throw on redundant calls — callers don't catch

**File:** Implementation Plan, Task 4 `session-fsm.ts` + Task 6 `extension.ts`
**Severity:** High — uncaught exception crashes the extension

`enable()` in state `'active'` or `'suspended'` throws `VoiceFsmError` because neither `'active:enable'` nor `'suspended:enable'` is in the transition table. In `checkProviders()` (Task 6):

```typescript
} else {
  sessionFsm.enable();  // ← no try/catch; throws if called twice
  vscode.window.showInformationMessage('OpenSpace Voice: Ready');
}
```

If `checkProviders()` is somehow called twice (e.g., on a config change), the second call throws an uncaught `VoiceFsmError`, visible to the user as an unhandled extension error.

**Fix:** Either guard the call or add idempotent transitions:
```typescript
if (sessionFsm.state === 'inactive') sessionFsm.enable();
```

---

### H-5: Race condition — dictation attempted before `checkProviders()` resolves

**File:** Implementation Plan, Task 6, `activate()`
**Severity:** High — false "not enabled" warning for power users

```typescript
export function activate(context: vscode.ExtensionContext) {
  // ...
  checkProviders();    // ← not awaited; runs in background
  registerCommands(context);  // ← commands registered immediately
}
```

`checkProviders()` is async and makes two `isAvailable()` calls. The `startDictation` command is registered immediately. If the user presses `Ctrl+Shift+V` in the first few hundred milliseconds after activation, `sessionFsm.policy.enabled` is still `false` and they see "Voice is not enabled. Run Voice: Configure first."

**Fix:** Show a "Voice: Initializing..." status bar item during the check, or guard commands with a `'when': 'openspace-voice.ready'` context key that is set via `vscode.commands.executeCommand('setContext', ...)` after the check completes.

---

### H-6: `proc.stdin.write` errors are not handled

**File:** Implementation Plan, Task 2, `WhisperCppAdapter.transcribe()`
**Severity:** High — silent unhandled error in production (once C-3 is fixed)

```typescript
proc.stdin.write(Buffer.from(request.audio));  // ← error goes nowhere
proc.stdin.end();
```

If the spawned process dies before stdin is written (e.g., binary not found, missing model), `proc.stdin` emits an `'error'` event that is not handled. In Node.js, an unhandled `'error'` event on a stream throws and can crash the extension host.

**Fix:**
```typescript
proc.stdin.on('error', (err) => reject(new Error(`stdin write failed: ${err.message}`)));
proc.stdin.write(Buffer.from(request.audio), (writeErr) => {
  if (writeErr) reject(writeErr);
  else proc.stdin.end();
});
```

---

## Medium Issues

### M-1: Float32 → Int16 conversion is incorrect (truncation, not rounding; wrong scale)

**File:** Implementation Plan, Task 3, `KokoroAdapter.synthesize()`

```typescript
int16[i] = Math.max(-1, Math.min(1, audioData[i])) * 32767;
```

Two issues:
1. **Scale:** Full-scale positive is `32767` but full-scale negative is `-32768`. Using `* 32767` means `-1.0` maps to `-32767`, leaving the floor sample value `(-32768)` unreachable. Should use `* 32768` then clamp to `[-32768, 32767]`.
2. **Truncation:** Assignment to `Int16Array` truncates the float toward zero, not rounds. A value like `0.9999 * 32767 = 32766.9...` becomes `32766` instead of `32767`. Should use `Math.round()`.

**Fix:**
```typescript
int16[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32768)));
```

---

### M-2: `readAloud` hardcodes `language: 'en-US'` — ignores user config

**File:** Implementation Plan, Task 8, `readAloud()`

```typescript
const result = await ttsAdapter.synthesize({
  text,
  language: 'en-US',    // ← hardcoded; ignores 'openspace-voice.language' setting
  voice,
  speed,
});
```

The config retrieval fetches `voice` and `speed` from settings but not `language`. The `openspace-voice.language` setting is defined in the extension manifest but never read.

**Fix:**
```typescript
const language = config.get<string>('language') ?? 'en-US';
```

---

### M-3: `readAloud` / synthesis provides no progress feedback

**File:** Implementation Plan, Task 8, `readAloud()`

Kokoro synthesis of a long paragraph can take 2–10 seconds (CPU, no GPU). The command returns no progress indicator. Users will see nothing happen and may invoke the command multiple times.

**Fix:**
```typescript
await vscode.window.withProgress(
  { location: vscode.ProgressLocation.Notification, title: 'Synthesizing speech...' },
  async () => {
    const result = await ttsAdapter.synthesize({ text, language, voice, speed });
    await playAudio(result.audio);
  }
);
```

---

### M-4: No monorepo workspace configuration — local `voice-core` cannot be referenced

**File:** Implementation Plan, Tasks 1–6

The plan creates `voice-core/` and `openspace-voice-vscode/` as directories but doesn't mention npm workspaces. During development, `openspace-voice-vscode` needs `@openspace-ai/voice-core` but cannot resolve it unless:
- The root `package.json` declares `"workspaces": ["voice-core", "openspace-voice-vscode"]`, or
- `npm link` is used, or
- `voice-core` is published to a registry first

Without workspace setup, Task 9's `npm install` will fail because `@openspace-ai/voice-core` is not on the registry yet.

**Fix:** Add to root `package.json`:
```json
{
  "workspaces": ["voice-core", "openspace-voice-vscode", "extensions/*"]
}
```

---

### M-5: `voice-core/package.json` missing required fields for npm publishing

**File:** Implementation Plan, Task 1, `voice-core/package.json`

The package.json is missing:
- `"files"`: Without this, `npm publish` includes everything (src files, spec files, tsconfig). Should be `["lib/**", "src/**"]`.
- `"engines"`: `{ "node": ">=18" }` — required to declare minimum Node.js version (Kokoro ONNX requires Node ≥ 18).
- `"license"`: Required for npm publish.
- `"repository"`: Strongly recommended.
- `"devDependencies"`: `typescript`, `ts-node`, `mocha`, etc. are missing from the manifest.
- `"peerDependencies"` or `"optionalDependencies"`: `kokoro-js` is dynamically imported but should be declared as optional since it's a large ML package.

---

### M-6: `openspace-voice-vscode/package.json` missing `"engines"` — Marketplace will reject

**File:** Implementation Plan, Task 6, VS Code extension `package.json`

The `engines` field is **required** by the VS Code Marketplace:
```json
{
  "engines": { "vscode": "^1.85.0" }
}
```

Without it, `vsce package` emits a warning and Marketplace submission may fail. Also missing: `categories`, `icon`, `license`, `homepage`, `repository`.

---

### M-7: `Ctrl+Shift+V` conflicts with system paste shortcut on Linux

**File:** Design Document, Keybinding Configuration section

`Ctrl+Shift+V` is "Paste" in many Linux terminal applications and clipboard managers (e.g., GNOME Terminal, Konsole, Tilix). When VS Code is focused this specific conflict won't apply (VS Code intercepts it), but the design document suggests this as the Linux default while acknowledging the ergonomic issue. The "right Ctrl" alternative is also not implementable — VS Code keybindings **do not distinguish left/right modifier keys**.

**Recommendation:** Use `Ctrl+Alt+V` or `Ctrl+Shift+Space` as a safer default, or clearly document in the README that the user should rebind via `keybindings.json`.

---

### M-8: No cancellation support for in-progress STT/TTS operations

**File:** Both documents
**Severity:** Medium — poor UX for long operations

Neither the adapters nor the extension commands support cancellation. A user who starts dictating and changes their mind has no way to cancel. The whisper.cpp process will continue running. For long TTS synthesis, there's no abort path.

**Fix:** Accept a `CancellationToken` in the adapter interfaces:
```typescript
export interface SttProvider {
  transcribe(request: SttTranscriptionRequest, token?: CancellationToken): Promise<SttTranscriptionResult>;
}
```
And kill the child process on cancellation:
```typescript
token?.onCancellationRequested(() => { proc.kill(); reject(new Error('cancelled')); });
```

---

### M-9: Phase 3 (Theia refactor) is underspecified

**File:** Implementation Plan, Task 10

Task 10 says "Refactor openspace-voice to use voice-core" but provides no current file inventory. The list of Theia-specific files to keep is speculative. Without knowing what `extensions/openspace-voice/` currently contains (the worktree appears to have an existing implementation), this task cannot be estimated or safely executed.

**Recommendation:** Add a "Current state" section showing the existing file tree and explicitly mapping each file to: delete / replace with voice-core import / keep as-is / migrate.

---

## Low Issues / Code Quality

### L-1: Task 2 test has no assertion — it can never fail

**File:** Implementation Plan, Task 2, `whisper-cpp.adapter.spec.ts`

```typescript
it('should return true when whisper is installed', async () => {
  const available = await adapter.isAvailable();
  // Will fail if whisper not installed - expected for now
  // ← NO expect() call; 'available' is assigned but never checked
});
```

The comment says "Will fail if whisper not installed" but the test never fails regardless — `available` is computed and discarded. This test provides zero coverage value.

**Fix:** Either add the assertion or mark as a conditional skip:
```typescript
it('should return true when whisper is installed', async () => {
  const available = await adapter.isAvailable();
  expect(available).toBe(true);  // skip this test if whisper not on PATH
});
```
Or better: use a mock for `spawn` so the test is self-contained and doesn't require a real whisper.cpp installation.

---

### L-2: `VoicePolicy` defined in two places creates coupling

**File:** Implementation Plan, Task 4, `session-fsm.ts` + Design Document Types section

`VoicePolicy` is defined inline in `session-fsm.ts` rather than in `types.ts`. Callers who need the `VoicePolicy` type must import from `session-fsm`, which also pulls in `DEFAULT_VOICE_POLICY` and the FSM class. This defeats the purpose of a dedicated types file.

**Fix:** Move `VoicePolicy` and `DEFAULT_VOICE_POLICY` to `types.ts` (alongside `AudioState`, `NarrationState`, etc.) and import in `session-fsm.ts`.

---

### L-3: `NarrationMode` is not independently exported

**File:** Implementation Plan, Task 4 + Design Document

The design doc shows `export type NarrationMode = 'narrate-off' | 'narrate-everything' | 'narrate-summary'`. In the implementation, this union is inlined inside `VoicePolicy.narrationMode` and `NarrationRequest.mode`. Consumers (e.g., the Theia `NarrationPreprocessor`) need to reference this type by name. Without a named export, they must use `VoicePolicy['narrationMode']` which is awkward.

---

### L-4: `activationEvents` inconsistency between design doc and implementation plan

**File:** Design Document vs. Implementation Plan, Task 6

Design doc:
```json
"activationEvents": ["onCommand:openspace-voice.configure"]
```

Implementation plan:
```json
"activationEvents": [
  "onCommand:openspace-voice.configure",
  "onCommand:openspace-voice.startDictation",
  "onCommand:openspace-voice.readAloud"
]
```

**Note:** Since VS Code 1.74, command activation events are auto-inferred from `contributes.commands`, making this moot. But the documents should be consistent. Additionally, the extension should activate on workspace open if the user had previously enabled voice, not just on command invocation — otherwise the FSM state is lost across sessions.

---

### L-5: `dictationKeybindingMac` setting in design doc is absent from implementation plan

**File:** Design Document, Keybinding Configuration section

The design doc defines:
```json
"openspace-voice.dictationKeybinding": "ctrl+shift+v",
"openspace-voice.dictationKeybindingMac": "cmd+shift+v"
```

The implementation plan's `package.json` (Task 6) only has `openspace-voice.dictationKeybinding`. The Mac-specific setting is dropped. The keybinding manifest already uses `"mac": "cmd+shift+v"`, so the setting may be redundant, but the inconsistency should be resolved explicitly.

---

### L-6: `VoiceFsmError` not exported from `index.ts`

**File:** Implementation Plan, Task 4, `types.ts`

`VoiceFsmError` is thrown by all FSMs but is only declared in `types.ts`. If a consumer catches it with `instanceof VoiceFsmError`, they must import from `@openspace-ai/voice-core/src/fsm/types` — a private path. It should be included in the package's public `index.ts` exports.

---

### L-7: No `"test"` script in `voice-core/package.json`

**File:** Implementation Plan, Task 1, `voice-core/package.json`

The `scripts` section only has `"build"` and `"clean"`. Task 5 says `npm test` but no test runner is configured. The package needs:
```json
"scripts": {
  "build": "tsc",
  "clean": "rm -rf lib tsconfig.tsbuildinfo",
  "test": "mocha --require ts-node/register 'src/**/*.spec.ts'"
}
```
And devDependencies for `mocha`, `ts-node`, `@types/mocha`, `@types/node`.

---

### L-8: Package naming — directory name differs from package name

**File:** Implementation Plan, Task 1

Directory is `voice-core/` but package name is `@openspace-ai/voice-core`. This is intentional but may confuse workspace tooling. The convention in this monorepo (per existing `extensions/openspace-core/`) is for directory names to match the unscoped package name. Consider renaming directory to `packages/voice-core/` to clearly separate it from Theia extensions.

---

### L-9: `startDictation` leaves FSM in `listening` state on error (once C-1 is fixed)

**File:** Implementation Plan, Task 7, `startDictation()`

```typescript
sessionFsm.pushToTalkStart();
audioFsm.startCapture();          // ← FSM now in 'listening'
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });  // ← throws
// audioFsm is stuck in 'listening' — can't start new dictation
```

If audio capture fails after the FSM transitions to `'listening'`, there's no `audioFsm.error()` call in the catch path. The user can never dictate again without reloading the extension.

**Fix:** Wrap in try/catch and reset the FSM:
```typescript
try {
  // ... capture logic
} catch (err) {
  audioFsm.error();      // → 'error'
  audioFsm.reset();      // → 'idle'
  sessionFsm.pushToTalkEnd();
  vscode.window.showErrorMessage(`Dictation failed: ${err.message}`);
}
```

---

## Testing Gaps

| Area | Current Coverage | Gap |
|------|-----------------|-----|
| `WhisperCppAdapter` | 1 test, no assertions, requires real binary | Mock `child_process.spawn`; test timeout, error, and success paths |
| `KokoroAdapter` | None planned | Mock `kokoro-js` dynamic import; test synthesize Float32→Int16 conversion |
| `SessionFsm` | None planned | All valid/invalid transitions; policy update; state getters |
| `AudioFsm` | None planned | All valid/invalid transitions; error + reset path |
| `NarrationFsm` | None planned | Queue drain after complete; enqueue while non-idle; mode=narrate-off guard |
| VS Code extension | Manual F5 only | `@vscode/test-electron` for command registration; activation/deactivation; config reading |
| `isAvailable()` calls | None | Mock spawn to test both true/false paths without requiring installed binaries |

The "Write test, export from index.ts" instruction for Tasks 3, 4, and 5 is a placeholder. No test code is shown for the Kokoro adapter, FSMs, or voice-core build. These must all be written before the feature is considered complete.

---

## Design Document — Additional Notes

### D-1: "Right Ctrl/Cmd key" is not achievable in VS Code keybindings

The design doc states:
> **Alternative:** Right `Ctrl` or right `Cmd` key on macOS (more ergonomic)

VS Code's keybinding system does not distinguish left/right modifier keys. This is a VS Code limitation and cannot be implemented. The note should be removed or replaced with a realistic ergonomic alternative.

### D-2: Theia features table references `openspace-voice-theia` but plan calls it `openspace-voice`

Design doc Summary table lists "openspace-voice-theia" as the Theia component, but Task 10 of the implementation plan calls the existing extension `extensions/openspace-voice`. These should be named consistently throughout both documents.

### D-3: No error recovery strategy defined

The design doc describes installation detection (auto-install / manual / already installed) but doesn't describe what happens when:
- Kokoro model download fails mid-stream (partial download)
- Whisper.cpp crashes during transcription
- Microphone permission is denied at the OS level
- Audio device is unplugged during dictation

These recovery paths should be included in the design before implementation.

---

## Summary

| ID | Severity | Area | Issue |
|----|----------|------|-------|
| C-1 | **Blocker** | VS Code | `navigator.mediaDevices` unavailable in extension host |
| C-2 | **Blocker** | VS Code | Web Audio API unavailable in extension host — no playback impl |
| C-3 | **Blocker** | WhisperCpp | whisper.cpp CLI doesn't read from stdin |
| C-4 | **Blocker** | Audio | No WAV header — raw PCM unprocessable |
| C-5 | **Critical** | WhisperCpp | `--version` flag not supported — isAvailable always false |
| H-1 | High | NarrationFsm | Queue items never consumed; `complete()` doesn't drain queue |
| H-2 | High | KokoroAdapter | Module-level singleton never released; memory leak |
| H-3 | High | All FSMs | `Record<string, string>` transition tables — typos not caught |
| H-4 | High | SessionFsm | Redundant `enable()`/`disable()` throws; callers don't catch |
| H-5 | High | extension.ts | Race condition: dictation before availability check completes |
| H-6 | High | WhisperCpp | `proc.stdin` error event unhandled |
| M-1 | Medium | KokoroAdapter | Float32→Int16 wrong scale and truncation instead of rounding |
| M-2 | Medium | VS Code | `readAloud` ignores `language` setting (hardcodes `en-US`) |
| M-3 | Medium | VS Code | No progress indicator for synthesis (2–10s operation) |
| M-4 | Medium | Monorepo | No npm workspace config — local voice-core can't be referenced |
| M-5 | Medium | voice-core | package.json missing `files`, `engines`, `license`, `devDeps` |
| M-6 | Medium | VS Code | Extension `package.json` missing `engines` — Marketplace rejects |
| M-7 | Medium | Design | `Ctrl+Shift+V` conflicts; right-Ctrl alternative not implementable |
| M-8 | Medium | Both | No cancellation support for STT/TTS operations |
| M-9 | Medium | Phase 3 | Theia refactor task severely underspecified |
| L-1 | Low | Tests | Task 2 test has no assertions — can never fail |
| L-2 | Low | Types | `VoicePolicy` in `session-fsm.ts` instead of `types.ts` |
| L-3 | Low | Types | `NarrationMode` not independently exported |
| L-4 | Low | Design | `activationEvents` inconsistency between design doc and impl plan |
| L-5 | Low | Design | `dictationKeybindingMac` setting dropped in impl plan |
| L-6 | Low | voice-core | `VoiceFsmError` not exported from `index.ts` |
| L-7 | Low | voice-core | No `"test"` script in `package.json` |
| L-8 | Low | Structure | Directory name doesn't match scoped package name |
| L-9 | Low | extension.ts | FSM stuck in `listening` state after audio capture error |
| D-1 | Note | Design | Right-Ctrl/Cmd not achievable in VS Code keybindings |
| D-2 | Note | Design | Theia extension naming inconsistency across documents |
| D-3 | Note | Design | No error recovery strategy for common failure modes |

**Bottom line:** The architecture (three-package split, adapter pattern, FSMs, Node.js-only core) is the right approach. The critical blockers (C-1 through C-5) are all audio I/O issues stemming from confusion between browser APIs and Node.js APIs. Fixing these requires replacing `navigator.mediaDevices`, `Web Audio API`, and the stdin-based whisper.cpp invocation with proper Node.js equivalents. The FSM queue bug (H-1) must also be fixed before narration can work end-to-end.
