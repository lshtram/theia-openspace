# openspace-voice Extension Design

**Date:** 2026-02-20
**Status:** Approved (revised after review)
**Author:** OpenSpace Team

## Overview

Design for a cross-platform voice extension (STT + TTS) that works in both VS Code and Theia, with a shared core package and platform-specific wrappers.

## Goals

1. Publish a VS Code extension to the Marketplace for general use
2. Bundle the same core with Theia-OpenSpace for full AI narration integration
3. Provide configurable keybindings (user can customize push-to-talk trigger)

---

## Package Architecture

```
packages/voice-core/            # @openspace-ai/voice-core — shared, Node.js only, no UI
extensions/openspace-voice/     # Theia extension — bundled with OpenSpace (existing)
openspace-voice-vscode/         # VS Code extension — published to Marketplace
```

Root `package.json` declares npm workspaces:

```json
{
  "workspaces": ["packages/voice-core", "openspace-voice-vscode", "extensions/*"]
}
```

---

## @openspace-ai/voice-core

### Purpose

Platform-agnostic voice processing core. **No VS Code, Theia, browser, or Web API imports.** Pure Node.js TypeScript.

### Required Fields (package.json)

```json
{
  "name": "@openspace-ai/voice-core",
  "version": "1.0.0",
  "license": "MIT",
  "engines": { "node": ">=18" },
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib/**", "src/**"],
  "optionalDependencies": { "kokoro-js": "^1.x" }
}
```

### Public Exports (index.ts)

```typescript
// Types
export type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult } from './providers/stt-provider.interface';
export type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from './providers/tts-provider.interface';
export type { VoicePolicy, NarrationMode } from './fsm/types';
export { DEFAULT_VOICE_POLICY } from './fsm/types';
export { VoiceFsmError } from './fsm/types';

// Adapters
export { WhisperCppAdapter } from './adapters/whisper-cpp.adapter';
export { KokoroAdapter } from './adapters/kokoro.adapter';

// FSMs
export { SessionFsm } from './fsm/session-fsm';
export { AudioFsm } from './fsm/audio-fsm';
export { NarrationFsm } from './fsm/narration-fsm';

// Utils
export { buildWavBuffer } from './utils/wav';
```

### Audio I/O Contract

`SttTranscriptionRequest` carries a `sampleRate` field so adapters know how to build a WAV header:

```typescript
export interface SttTranscriptionRequest {
  audio: Uint8Array;    // raw 16-bit PCM samples
  sampleRate: number;   // e.g. 16000
  language: string;
}
```

### WhisperCppAdapter — Node.js Only

- Writes audio to a temp WAV file (44-byte RIFF header via `buildWavBuffer`)
- Passes the file path as a positional argument to whisper.cpp
- Cleans up the temp file in a `finally` block
- `isAvailable()` uses `--help` (not `--version` — unsupported by whisper.cpp CLI)
- Handles `proc.stdin` errors explicitly
- Accepts an optional `CancellationToken`-compatible abort signal

### KokoroAdapter — Node.js Only

- Model is stored as an instance variable (not module-level singleton)
- Exposes `dispose()` to release model reference
- `Float32 → Int16` conversion uses `Math.round` and full scale: `Math.max(-32768, Math.min(32767, Math.round(f * 32768)))`

### FSM Types — fully type-safe

Transition tables use `Partial<Record<`${State}:${Trigger}`, State>>` to catch typos at compile time.

`VoicePolicy`, `NarrationMode`, `VoiceFsmError`, and all state/trigger union types are defined in `types.ts` and exported from `index.ts`.

### NarrationFsm — Queue Drain

`complete()` drains the queue correctly:
- If queue is non-empty → stays in `'queued'` and returns the next request
- If queue is empty → transitions to `'idle'`

---

## openspace-voice-vscode

### Purpose

VS Code extension published to the Marketplace. Provides STT dictation and TTS read aloud.

### Audio I/O — Node.js Approach

VS Code extensions run in a **Node.js extension host**, not a browser. Web APIs (`navigator`, `AudioContext`, `MediaRecorder`) are unavailable. All audio I/O uses Node.js:

**Recording (STT):**
- `node-record-lpcm16` npm package (wraps `sox`/`arecord`/`afplay` as subprocess)
- Captures 16-bit PCM at 16 kHz mono

**Playback (TTS):**
- Write synthesized PCM to temp WAV file
- Play via platform command:
  - macOS: `afplay <file>`
  - Linux: `aplay <file>`
  - Windows: `powershell -c "(New-Object Media.SoundPlayer '<file>').PlaySync()"`
- Or use `play-sound` npm package for cross-platform detection

### Features

| Feature | Implementation |
|---------|---------------|
| Push-to-talk dictation | Configurable keybinding (default: `Ctrl+Alt+V`, Mac: `Cmd+Alt+V`) |
| Read aloud selected text | `openspace-voice.readAloud` — right-click context menu |
| Narration playback queue | `NarrationFsm` from voice-core |
| Configure settings | `openspace-voice.configure` opens VS Code settings |
| Installation detection | Dialog: auto-install / manual / already installed |
| Progress feedback | `vscode.window.withProgress` during synthesis |

### Keybinding Configuration

**Default:** `Ctrl+Alt+V` (Windows/Linux), `Cmd+Alt+V` (macOS)

VS Code keybindings **cannot distinguish left vs. right modifier keys** — this is a VS Code platform limitation. There is no way to bind "right Cmd only". Users who want a single-key ergonomic binding should customize via `keybindings.json`.

The default keybinding is defined in the extension manifest and fully rebindable:

```json
"keybindings": [
  {
    "command": "openspace-voice.startDictation",
    "key": "ctrl+alt+v",
    "mac": "cmd+alt+v",
    "when": "editorTextFocus || terminalFocus"
  }
]
```

Users can override in `keybindings.json` with any combination they prefer.

### Extension Manifest

```json
{
  "name": "openspace-voice",
  "version": "1.0.0",
  "publisher": "openspace-ai",
  "description": "Voice STT/TTS with Kokoro and Whisper",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other", "Accessibility"],
  "main": "./lib/extension",
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "keybindings": [
      {
        "command": "openspace-voice.startDictation",
        "key": "ctrl+alt+v",
        "mac": "cmd+alt+v",
        "when": "editorTextFocus || terminalFocus"
      }
    ],
    "commands": [
      { "command": "openspace-voice.startDictation", "title": "Voice: Start Dictation" },
      { "command": "openspace-voice.readAloud", "title": "Voice: Read Aloud" },
      { "command": "openspace-voice.stopNarration", "title": "Voice: Stop Narration" },
      { "command": "openspace-voice.configure", "title": "Voice: Configure" }
    ],
    "menus": {
      "editor/context": [
        { "command": "openspace-voice.readAloud", "when": "editorHasSelection", "group": "navigation" }
      ]
    },
    "configuration": {
      "properties": {
        "openspace-voice.voice": { "type": "string", "default": "af_sarah", "description": "TTS voice ID" },
        "openspace-voice.speed": { "type": "number", "default": 1.0, "minimum": 0.5, "maximum": 2.0 },
        "openspace-voice.language": { "type": "string", "default": "en-US", "description": "BCP-47 language tag" },
        "openspace-voice.whisperPath": { "type": "string", "default": "whisper", "description": "Path to whisper.cpp binary" },
        "openspace-voice.narrationMode": { "type": "string", "enum": ["narrate-off", "narrate-everything", "narrate-summary"], "default": "narrate-off" }
      }
    }
  }
}
```

Note: `activationEvents: ["onStartupFinished"]` ensures the extension activates on workspace open so previously-saved session state is restored, not only on first command invocation.

### Activation and Race Condition Prevention

During `activate()`:

1. Register all commands immediately
2. Set VS Code context key `openspace-voice.ready = false`
3. Show status bar item "Voice: Initializing…"
4. Run `checkProviders()` async
5. On completion: set `openspace-voice.ready = true`, update status bar

Commands use `"when": "openspace-voice.ready"` where appropriate, or show a gentle "still initializing" message if invoked early.

### Error Recovery

| Failure | Recovery |
|---------|----------|
| Kokoro model download fails | Show error with retry button; partial downloads are deleted before retry |
| whisper.cpp crashes mid-transcription | `audioFsm.error()` → `audioFsm.reset()`, show message, allow retry |
| Microphone permission denied | Detect `NotAllowedError` from `node-record-lpcm16`; show OS-specific instructions |
| Audio device unplugged mid-dictation | Stream error event → FSM reset → user message |
| Binary not found on PATH | Trigger installation dialog |

---

## openspace-voice (Theia Extension)

### Name Consistency

The existing Theia extension lives at `extensions/openspace-voice/` and is named `openspace-voice`. It is **not** renamed. It is refactored in Phase 3 to import adapters and FSMs from `@openspace-ai/voice-core` rather than duplicating them.

### Theia-Specific Additions (Kept)

| File | Role |
|------|------|
| `voice-hub-contribution.ts` | HTTP routes (`/openspace/voice/stt`, `/narrate`, `/utterances`) |
| `voice-backend-service.ts` | Orchestrates STT + TTS + LLM preprocessing |
| `narration-preprocessor.ts` | LLM-based narration script generation |
| `utterance-library.ts` | Serves pre-recorded utterance WAV files |
| `openspace-voice-frontend-module.ts` | Theia DI bindings, SessionService hooks |
| `voice-input-widget.tsx` | Theia React push-to-talk widget |
| `voice-command-contribution.ts` | Theia command/keybinding registrations |

### Not Published

Bundled with Theia-OpenSpace build only. Not submitted to the VS Code Marketplace.

---

## Deployment

### Marketplace Publishing

1. Create publisher `openspace-ai` on marketplace.visualstudio.com
2. Run `vsce package` to validate — fix any warnings before `vsce publish`
3. Public URL: `https://marketplace.visualstudio.com/items?itemName=openspace-ai.openspace-voice`

### Theia Bundling

- Build `packages/voice-core` first (workspace dependency)
- `extensions/openspace-voice` imports from `@openspace-ai/voice-core`
- Included in OpenSpace Theia application build as before

---

## Feature Summary

| Feature | Standalone VS Code | Theia-OpenSpace |
|---------|-------------------|-----------------|
| STT (Whisper.cpp) | ✅ | ✅ |
| TTS (Kokoro) | ✅ | ✅ |
| Push-to-talk dictation | ✅ | ✅ |
| Read aloud selected text | ✅ | ✅ |
| Narration playback queue | ✅ | ✅ |
| Pause/resume narration | ✅ | ✅ |
| AI response narration | ❌ | ✅ |
| Chat transcript injection | ❌ | ✅ |
| Session service hooks | ❌ | ✅ |
| LLM narration preprocessing | ❌ | ✅ |
| Pre-recorded utterances | ❌ | ✅ |
