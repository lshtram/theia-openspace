# Voice Modality Design

**Date:** 2026-02-19
**Status:** Approved

---

## Goal

Implement the voice modality for theia-openspace as a new `openspace-voice` Theia extension. The feature enables:

1. **Voice input (STT):** Push-to-talk microphone capture → whisper.cpp transcription → transcript injected into chat input → user reviews and sends
2. **Voice output (TTS):** Agent responses narrated via kokoro local TTS engine with LLM-driven preprocessing for natural speech, emotional directives, and non-verbal utterances
3. **Narration modes:** `narrate-off` / `narrate-everything` / `narrate-summary` — user and agent configurable
4. **Emotional narration:** LLM preprocessing annotates emotion + inserts utterance cues; data-driven utterance library (multiple WAVs per emotion ID)

Phase T3 (MCP Agent Control System) is **complete** as of 2026-02-18. Voice is unblocked.

---

## Architecture Overview

```
┌─────────────────── Theia Frontend (Browser) ──────────────────────────┐
│                                                                         │
│  Chat Input UI                                                          │
│  ┌─────────────────────────────────┐                                   │
│  │  [type here...]        [🎤] [▶] │  ← mic button + voice status      │
│  └─────────────────────────────────┘                                   │
│          │ push-to-talk (hold key)                                      │
│          ▼                                                              │
│  AudioFSM                                                               │
│  idle → listening → processing → idle | error                          │
│  navigator.mediaDevices.getUserMedia() → MediaRecorder → audio buffer  │
│          │                                                              │
│          │ POST /openspace/voice/stt (audio buffer)                    │
│          ▼                                                              │
│  TranscriptFSM: empty → interim → final → editable → sent             │
│  Transcript injected into chat input field                             │
│  User reviews → presses Enter → agent responds                         │
│                                                                         │
│  Agent text → NarrationFSM                                             │
│  idle → queued → processing → playing → paused → idle                 │
│  (subscribes to SessionService.onMessageStreaming)                     │
│          │                                                              │
│          │ POST /openspace/voice/narrate (text + mode + sessionId)     │
│          ▼                                                              │
│  Backend returns NarrationResult → Web Audio API playback             │
│  Utterance segments play inline from /voice/utterances/ WAV files     │
│                                                                         │
│  SessionFSM: inactive → active → suspended                            │
│  Coordinates AudioFSM + NarrationFSM. Holds policy.                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────── Theia Backend (Node.js) ────────────────────────────┐
│                                                                         │
│  POST /openspace/voice/stt                                             │
│    → SttProvider (pluggable; default whisper.cpp, fallback browser)    │
│    → { text: string }                                                   │
│                                                                         │
│  POST /openspace/voice/narrate                                         │
│    → NarrationPreprocessor                                              │
│      mode=narrate-off    → { segments: [] }                            │
│      mode=narrate-everything → LLM: convert to speakable prose         │
│      mode=narrate-summary   → LLM: conversational dev-to-dev summary   │
│      LLM output: NarrationScript (segments with emotion + utterances)  │
│    → TtsProvider (pluggable; default kokoro, fallback browser synth)   │
│    → { segments: [{ type, audioBase64?, utteranceId? }] }              │
│                                                                         │
│  MCP tool: voice.set_policy → SessionFSM.updatePolicy()                │
│                                                                         │
│  GET /openspace/voice/utterances/:id → serves WAV files                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## FSM Design

### AudioFSM (browser-side, input)

States: `idle → listening → processing → idle | error`

| Trigger | From | To | Notes |
|---|---|---|---|
| startCapture | idle | listening | push-to-talk keydown; getUserMedia() + MediaRecorder.start() |
| stopCapture | listening | processing | push-to-talk keyup; MediaRecorder.stop() → send buffer to /voice/stt |
| transcriptReady | processing | idle | transcript emitted → inject into chat input |
| error | processing | error | STT call failed |
| bargeIn | listening | listening | already recording; no-op |

**Streaming future path:** `stopCapture` becomes `commitChunk` + `finalize`. Interim transcripts show in the chat input while still recording.

### TranscriptFSM (browser-side)

States: `empty → interim → final → editable → sent`

`transcriptMode` is always `edit-before-send` (user reviews before sending). The transcript is injected into the Theia chat input field. TranscriptFSM tracks the text state; it does not manage the DOM directly.

### NarrationFSM (browser-side, output)

States: `idle → queued → processing → playing → paused → idle`

- Subscribes to `SessionService.onMessageStreaming` → accumulates chunks → enqueues on message complete
- Priority queue: `{ text, priority: 'low' | 'normal' | 'high', id }`
- On dequeue: calls `POST /openspace/voice/narrate` → receives `NarrationResult` (segments)
- Plays segments sequentially: `speech` segments via Web Audio API, `utterance` segments via WAV file playback
- `pause()` / `resume()` on barge-in (push-to-talk keydown while playing)

**Streaming future path:** Endpoint supports chunked transfer → NarrationFSM enters `playing` on first chunk while backend processes the rest.

### SessionFSM (browser-side, coordinator)

States: `inactive → active → suspended`

- `inactive`: voice disabled
- `active`: voice enabled; AudioFSM and NarrationFSM operational
- `suspended`: push-to-talk in progress (NarrationFSM paused)

Policy: `{ enabled, narrationMode, speed, voice, narrationPrompts: { everything, summary } }`

---

## Extension Structure

```
extensions/openspace-voice/
  src/
    browser/
      audio-fsm.ts                       # AudioFSM + MediaRecorder
      transcript-fsm.ts                  # TranscriptFSM
      narration-fsm.ts                   # NarrationFSM + priority queue + Web Audio
      session-fsm.ts                     # SessionFSM + policy management
      voice-service.ts                   # VoiceService interface (injectable)
      voice-command-contribution.ts      # Theia CommandContribution (keybindings)
      voice-input-widget.tsx             # Mic button + status injected into chat input
      openspace-voice-frontend-module.ts
    common/
      voice-policy.ts                    # VoiceSessionPolicy + narration modes
      voice-providers.ts                 # SttProvider / TtsProvider interfaces (streaming-aware)
      narration-types.ts                 # NarrationScript, NarrationSegment, EmotionDirective
    node/
      voice-backend-module.ts
      voice-backend-service.ts           # Express routes: /voice/stt, /voice/narrate
      stt/
        whisper-cpp-adapter.ts           # Calls whisper.cpp binary
        stt-provider-selector.ts         # Auto-detects: whisper.cpp → browser-native
      tts/
        kokoro-adapter.ts                # kokoro-js ONNX (local model)
        tts-provider-selector.ts         # Auto-detects: kokoro → browser SpeechSynthesis
      narration-preprocessor.ts          # LLM pass; outputs NarrationScript
    __tests__/
      audio-fsm.spec.ts
      transcript-fsm.spec.ts
      narration-fsm.spec.ts
      session-fsm.spec.ts
      voice-policy.spec.ts
      narration-preprocessor.spec.ts     # mock LLM
  utterances/
    config.json                          # { "hmm": ["hmm-1.wav", "hmm-2.wav"], "wow": [...] }
    hmm-1.wav
    hmm-2.wav
    (etc.)
  package.json
  tsconfig.json
```

---

## Narration Pipeline

### NarrationScript Format

The LLM preprocessing step outputs structured JSON:

```typescript
interface NarrationScript {
  segments: NarrationSegment[];
}

interface NarrationSegment {
  type: 'speech' | 'utterance';
  text?: string;                  // type='speech': the speakable text
  utteranceId?: string;           // type='utterance': key into utterances/config.json
  emotion?: EmotionDirective;     // optional emotion hint for TTS
  priority: 'low' | 'normal' | 'high';
}

type EmotionDirective =
  | { kind: 'excited' }
  | { kind: 'concerned' }
  | { kind: 'happy' }
  | { kind: 'thoughtful' }
  | { kind: 'neutral' };
```

### Narration Modes

| Mode | LLM Prompt | Output |
|---|---|---|
| `narrate-everything` | "Convert this developer response to natural spoken text. Strip all code blocks, replace bash commands with verbal descriptions, expand abbreviations, add natural pacing. Output NarrationScript JSON." | Complete NarrationScript |
| `narrate-summary` | "You are a senior developer explaining this response to a colleague over voice. Give a concise, conversational summary. No code, no jargon. Include emotion and utterance cues. Output NarrationScript JSON." | Summary NarrationScript |
| `narrate-off` | (no LLM call) | `{ segments: [] }` |

**LLM prompts are user-configurable** — stored in voice settings, editable via the settings panel (one textarea per mode), with restore-defaults.

### Emotion Rendering

- If TTS provider supports emotion directives (future): pass `EmotionDirective` as a synthesis hint
- For current kokoro: map emotion to speed adjustment (excited +10%, concerned −5%, thoughtful +100ms pause prefix)

### Utterance Library

`utterances/config.json`:
```json
{
  "hmm": ["hmm-1.wav", "hmm-2.wav", "hmm-3.wav"],
  "wow": ["wow-1.wav", "wow-2.wav"],
  "uh-oh": ["uh-oh-1.wav"],
  "nice": ["nice-1.wav", "nice-2.wav"],
  "interesting": ["interesting-1.wav"]
}
```

- At runtime, a random file is selected from the list for each utterance ID → avoids repetition
- User can extend: add WAV files + update `config.json`
- The LLM prompt references utterance IDs by name; the library defines what those names mean

---

## Provider Interfaces (Streaming-Aware)

```typescript
// common/voice-providers.ts

export interface SttTranscriptionRequest {
  audio: Uint8Array;
  language: string;
  streaming?: boolean;         // future: true = incremental chunks
}

export interface SttProvider {
  readonly kind: 'stt';
  readonly id: string;
  isAvailable(): boolean;
  transcribe(request: SttTranscriptionRequest): Promise<SttTranscriptionResult>;
  // Future: transcribeStream(request): AsyncIterable<SttTranscriptionChunk>
}

export interface TtsSynthesisRequest {
  text: string;
  language: string;
  speed?: number;
  voice?: string;
  emotion?: EmotionDirective;
  streaming?: boolean;         // future: true = chunked audio response
}

export interface TtsProvider {
  readonly kind: 'tts';
  readonly id: string;
  isAvailable(): boolean;
  synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult>;
  // Future: synthesizeStream(request): AsyncIterable<TtsSynthesisChunk>
}
```

---

## Settings & MCP Tool

### Voice Settings Panel (`openspace-settings` extension)

- Voice enable/disable toggle
- Narration mode selector: `narrate-off` | `narrate-everything` | `narrate-summary`
- Speed slider: 0.5x–2.0x
- Voice selector (kokoro voices: `af_sarah`, `am_adam`, etc.)
- Push-to-talk keybinding config
- **Narration prompts** (collapsible, one textarea per mode + restore-defaults button)

### MCP Tool: `voice.set_policy`

```typescript
{
  name: 'voice.set_policy',
  parameters: {
    enabled?: boolean,
    narrationMode?: 'narrate-off' | 'narrate-everything' | 'narrate-summary',
    speed?: number,         // 0.5–2.0
    voice?: string,
    narrationPrompts?: {
      everything?: string,
      summary?: string
    }
  }
}
```

Registered in `hub-mcp.ts` alongside existing MCP tools. Agent can call this to switch modes mid-conversation.

---

## Error Handling

| Error | Behavior |
|---|---|
| `whisper.cpp` binary not found | Fall back to browser-native STT; notify user in voice widget |
| `kokoro` model load fails | Fall back to browser SpeechSynthesis; notify user |
| LLM narration call fails | Fall back to raw text → TTS (degrade gracefully) |
| Mic permission denied | Inline error in voice input widget with link to browser settings |
| `/voice/stt` network error | Retry indicator in voice widget; show error after N retries |
| Push-to-talk while narrating | Pause narration immediately; resume after transcript sent |

---

## Testing Strategy

| Test type | Coverage |
|---|---|
| Unit: FSM transitions | AudioFSM, TranscriptFSM, NarrationFSM, SessionFSM — all state transitions |
| Unit: policy validation | `voice-policy.ts` — resolvePolicy, validation edge cases |
| Unit: narration preprocessor | Mock LLM; verify prompt construction and NarrationScript parsing |
| Unit: utterance selection | Random selection from multi-WAV config; fallback for unknown IDs |
| Integration: STT path | Push-to-talk → mock whisper.cpp → transcript injected in input |
| Integration: narration path | Mock agent message → NarrationFSM → mock TTS → segments queued |
| Manual: full round-trip | STT → agent response → TTS narration with utterances |

---

## Implementation Tasks

See `docs/plans/2026-02-19-voice-modality-implementation.md` (generated by writing-plans skill).

Rough task breakdown mirrors the T6.1–T6.6 structure from WORKPLAN.md with extensions for:
- NarrationScript + emotional narration design
- Utterance library
- Configurable narration prompts
- Streaming-aware provider interfaces

---

## What Already Exists (Reference)

The reference implementation at `/Users/Shared/dev/openspace/runtime-hub/src/services/` contains:
- `voice-orchestrator.ts` — 3-FSM orchestrator (port and adapt)
- `voice-fsm.ts` — FSM state/transition types (port directly)
- `voice-policy.ts` — policy interface (extend with narrationMode + narrationPrompts)
- `voice-providers.ts` — provider interfaces (extend with streaming flag)
- `voice-provider-selector.ts` — whisper.cpp + kokoro adapters (port directly)
- `voice-narration.ts` — narration strategy (extend with NarrationScript format)
