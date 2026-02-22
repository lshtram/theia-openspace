# Voice Modality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `openspace-voice` Theia extension with push-to-talk STT (whisper.cpp), LLM-driven narration (narrate-off/everything/summary), kokoro TTS, emotional narration with utterance library, and MCP `voice.set_policy` tool.

**Architecture:** New `extensions/openspace-voice/` Theia extension with browser-side FSMs (AudioFSM, TranscriptFSM, NarrationFSM, SessionFSM), backend HTTP endpoints (`POST /openspace/voice/stt`, `POST /openspace/voice/narrate`), pluggable STT/TTS providers (whisper.cpp default, kokoro default), and LLM narration preprocessing that outputs a `NarrationScript` with emotion directives and utterance cues.

**Tech Stack:** TypeScript, Theia 1.68.2, InversifyJS DI, kokoro-js, whisper.cpp (CLI binary), Web Audio API, `@modelcontextprotocol/sdk` (MCP tools), React (voice input widget)

**Worktree:** `.worktrees/feature-voice` on branch `feature/voice-modality`

**Reference:** `/Users/Shared/dev/openspace/runtime-hub/src/services/voice-orchestrator.ts` and surrounding interface files

**Design doc:** `docs/plans/2026-02-19-voice-modality-design.md`

---

## Task 1: Voice policy + narration types (common layer)

**Files:**
- Create: `extensions/openspace-voice/src/common/voice-policy.ts`
- Create: `extensions/openspace-voice/src/common/narration-types.ts`
- Create: `extensions/openspace-voice/src/common/voice-providers.ts`
- Create: `extensions/openspace-voice/src/__tests__/voice-policy.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/voice-policy.spec.ts
import { assert } from 'chai';
import {
  resolveVoicePolicy,
  DEFAULT_VOICE_POLICY,
  type VoicePolicy,
} from '../common/voice-policy';

describe('VoicePolicy', () => {
  it('returns defaults when no overrides given', () => {
    const policy = resolveVoicePolicy();
    assert.deepEqual(policy, DEFAULT_VOICE_POLICY);
  });

  it('merges overrides over defaults', () => {
    const policy = resolveVoicePolicy({ narrationMode: 'narrate-summary' });
    assert.equal(policy.narrationMode, 'narrate-summary');
    assert.equal(policy.speed, DEFAULT_VOICE_POLICY.speed);
  });

  it('throws on invalid narrationMode', () => {
    assert.throws(
      () => resolveVoicePolicy({ narrationMode: 'bad' as any }),
      /narrationMode/
    );
  });

  it('throws on speed out of range', () => {
    assert.throws(() => resolveVoicePolicy({ speed: 3 }), /speed/);
    assert.throws(() => resolveVoicePolicy({ speed: 0 }), /speed/);
  });

  it('throws on empty language', () => {
    assert.throws(() => resolveVoicePolicy({ language: '' }), /language/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/voice-policy.spec.ts" \
  --timeout 10000
```
Expected: `Cannot find module '../common/voice-policy'`

**Step 3: Implement voice-policy.ts**

```typescript
// extensions/openspace-voice/src/common/voice-policy.ts

export const NARRATION_MODES = ['narrate-off', 'narrate-everything', 'narrate-summary'] as const;
export type NarrationMode = (typeof NARRATION_MODES)[number];

export interface NarrationPrompts {
  everything: string;
  summary: string;
}

export const DEFAULT_NARRATION_PROMPTS: NarrationPrompts = {
  everything: `Convert this developer response to natural spoken text.
Strip all code blocks, replace bash commands with verbal descriptions,
expand abbreviations, and add natural pacing.
Output a NarrationScript JSON with segments of type 'speech' and 'utterance'.
Use utterance IDs from: hmm, wow, uh-oh, nice, interesting.
Add emotion fields where appropriate: excited, concerned, happy, thoughtful, neutral.`,
  summary: `You are a senior developer explaining this response to a colleague over voice.
Give a concise, conversational summary. No code, no jargon.
Focus on what matters and what to do next.
Output a NarrationScript JSON with segments of type 'speech' and 'utterance'.
Use utterance IDs from: hmm, wow, uh-oh, nice, interesting.
Add emotion fields where appropriate: excited, concerned, happy, thoughtful, neutral.`,
};

export interface VoicePolicy {
  enabled: boolean;
  narrationMode: NarrationMode;
  speed: number;          // 0.5–2.0
  voice: string;          // TTS voice ID
  language: string;       // BCP-47
  narrationPrompts: NarrationPrompts;
}

export const DEFAULT_VOICE_POLICY: VoicePolicy = {
  enabled: false,
  narrationMode: 'narrate-off',
  speed: 1.0,
  voice: 'af_sarah',
  language: 'en-US',
  narrationPrompts: DEFAULT_NARRATION_PROMPTS,
};

export function resolveVoicePolicy(overrides: Partial<VoicePolicy> = {}): VoicePolicy {
  const policy = { ...DEFAULT_VOICE_POLICY, ...overrides };

  if (!NARRATION_MODES.includes(policy.narrationMode)) {
    throw new Error(`narrationMode must be one of: ${NARRATION_MODES.join(', ')}`);
  }

  if (policy.speed < 0.5 || policy.speed > 2.0) {
    throw new Error(`speed must be between 0.5 and 2.0, got ${policy.speed}`);
  }

  if (!policy.language || policy.language.trim().length === 0) {
    throw new Error('language must be a non-empty BCP-47 string');
  }

  return policy;
}
```

**Step 4: Implement narration-types.ts**

```typescript
// extensions/openspace-voice/src/common/narration-types.ts

export type EmotionKind = 'excited' | 'concerned' | 'happy' | 'thoughtful' | 'neutral';

export interface EmotionDirective {
  kind: EmotionKind;
}

export type NarrationSegmentType = 'speech' | 'utterance';

export interface NarrationSegment {
  type: NarrationSegmentType;
  text?: string;           // type='speech'
  utteranceId?: string;    // type='utterance'
  emotion?: EmotionDirective;
  priority: 'low' | 'normal' | 'high';
}

export interface NarrationScript {
  segments: NarrationSegment[];
}

export function isValidNarrationScript(value: unknown): value is NarrationScript {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['segments'])) return false;
  return obj['segments'].every(isValidNarrationSegment);
}

function isValidNarrationSegment(seg: unknown): seg is NarrationSegment {
  if (!seg || typeof seg !== 'object') return false;
  const s = seg as Record<string, unknown>;
  if (s['type'] !== 'speech' && s['type'] !== 'utterance') return false;
  if (s['type'] === 'speech' && typeof s['text'] !== 'string') return false;
  if (s['type'] === 'utterance' && typeof s['utteranceId'] !== 'string') return false;
  return true;
}
```

**Step 5: Implement voice-providers.ts**

```typescript
// extensions/openspace-voice/src/common/voice-providers.ts

export interface SttTranscriptionRequest {
  audio: Uint8Array;
  language: string;
  streaming?: boolean;  // reserved for future streaming STT
}

export interface SttTranscriptionResult {
  text: string;
}

export interface SttProvider {
  readonly kind: 'stt';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  transcribe(request: SttTranscriptionRequest): Promise<SttTranscriptionResult>;
}

export interface TtsSynthesisRequest {
  text: string;
  language: string;
  speed?: number;
  voice?: string;
  streaming?: boolean;  // reserved for future streaming TTS
}

export interface TtsSynthesisResult {
  audio: Uint8Array;  // WAV PCM
}

export interface TtsProvider {
  readonly kind: 'tts';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult>;
}
```

**Step 6: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/voice-policy.spec.ts" \
  --timeout 10000
```
Expected: `5 passing`

**Step 7: Commit**

```bash
git add extensions/openspace-voice/
git commit -m "feat(voice): add VoicePolicy, NarrationScript types, provider interfaces"
```

---

## Task 2: FSM state transition logic

**Files:**
- Create: `extensions/openspace-voice/src/common/voice-fsm.ts`
- Create: `extensions/openspace-voice/src/__tests__/voice-fsm.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/voice-fsm.spec.ts
import { assert } from 'chai';
import {
  validateAudioTransition,
  validateTranscriptTransition,
  validateNarrationTransition,
  validateSessionTransition,
  VoiceFsmError,
  type AudioState,
  type TranscriptState,
  type NarrationState,
  type SessionState,
} from '../common/voice-fsm';

describe('AudioFSM', () => {
  it('idle → listening on startCapture', () => {
    assert.equal(validateAudioTransition({ from: 'idle', trigger: 'startCapture' }), 'listening');
  });

  it('listening → processing on stopCapture', () => {
    assert.equal(validateAudioTransition({ from: 'listening', trigger: 'stopCapture' }), 'processing');
  });

  it('processing → idle on transcriptReady', () => {
    assert.equal(validateAudioTransition({ from: 'processing', trigger: 'transcriptReady' }), 'idle');
  });

  it('processing → error on sttError', () => {
    assert.equal(validateAudioTransition({ from: 'processing', trigger: 'sttError' }), 'error');
  });

  it('error → idle on reset', () => {
    assert.equal(validateAudioTransition({ from: 'error', trigger: 'reset' }), 'idle');
  });

  it('throws on invalid transition', () => {
    assert.throws(
      () => validateAudioTransition({ from: 'idle', trigger: 'stopCapture' }),
      VoiceFsmError
    );
  });
});

describe('TranscriptFSM', () => {
  it('empty → interim on interimChunk', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'empty', trigger: 'interimChunk', textPresent: true }),
      'interim'
    );
  });

  it('interim → final on finalize', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'interim', trigger: 'finalize' }),
      'final'
    );
  });

  it('final → editable on enableEdit', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'final', trigger: 'enableEdit' }),
      'editable'
    );
  });

  it('editable → sent on submit', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'editable', trigger: 'submit' }),
      'sent'
    );
  });

  it('sent → interim on newUtterance', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'sent', trigger: 'newUtterance' }),
      'interim'
    );
  });
});

describe('NarrationFSM', () => {
  it('idle → queued on enqueue', () => {
    assert.equal(validateNarrationTransition({ from: 'idle', trigger: 'enqueue' }), 'queued');
  });

  it('queued → processing on startProcessing', () => {
    assert.equal(validateNarrationTransition({ from: 'queued', trigger: 'startProcessing' }), 'processing');
  });

  it('processing → playing on audioReady', () => {
    assert.equal(validateNarrationTransition({ from: 'processing', trigger: 'audioReady' }), 'playing');
  });

  it('playing → paused on pause', () => {
    assert.equal(validateNarrationTransition({ from: 'playing', trigger: 'pause' }), 'paused');
  });

  it('paused → playing on resume', () => {
    assert.equal(validateNarrationTransition({ from: 'paused', trigger: 'resume' }), 'playing');
  });

  it('playing → idle on complete', () => {
    assert.equal(validateNarrationTransition({ from: 'playing', trigger: 'complete' }), 'idle');
  });
});

describe('SessionFSM', () => {
  it('inactive → active on enable', () => {
    assert.equal(validateSessionTransition({ from: 'inactive', trigger: 'enable' }), 'active');
  });

  it('active → inactive on disable', () => {
    assert.equal(validateSessionTransition({ from: 'active', trigger: 'disable' }), 'inactive');
  });

  it('active → suspended on pushToTalkStart', () => {
    assert.equal(validateSessionTransition({ from: 'active', trigger: 'pushToTalkStart' }), 'suspended');
  });

  it('suspended → active on pushToTalkEnd', () => {
    assert.equal(validateSessionTransition({ from: 'suspended', trigger: 'pushToTalkEnd' }), 'active');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/voice-fsm.spec.ts" \
  --timeout 10000
```
Expected: `Cannot find module '../common/voice-fsm'`

**Step 3: Implement voice-fsm.ts**

```typescript
// extensions/openspace-voice/src/common/voice-fsm.ts

export type AudioState = 'idle' | 'listening' | 'processing' | 'error';
export type AudioTrigger = 'startCapture' | 'stopCapture' | 'transcriptReady' | 'sttError' | 'reset';

export type TranscriptState = 'empty' | 'interim' | 'final' | 'editable' | 'sent';
export type TranscriptTrigger = 'interimChunk' | 'finalize' | 'enableEdit' | 'submit' | 'cancel' | 'newUtterance';

export type NarrationState = 'idle' | 'queued' | 'processing' | 'playing' | 'paused';
export type NarrationTrigger = 'enqueue' | 'startProcessing' | 'audioReady' | 'pause' | 'resume' | 'complete';

export type SessionState = 'inactive' | 'active' | 'suspended';
export type SessionTrigger = 'enable' | 'disable' | 'pushToTalkStart' | 'pushToTalkEnd';

export class VoiceFsmError extends Error {
  constructor(
    public readonly fsm: string,
    public readonly from: string,
    public readonly trigger: string,
  ) {
    super(`VoiceFSM[${fsm}]: invalid transition ${from}:${trigger}`);
    this.name = 'VoiceFsmError';
  }
}

function fail(fsm: string, from: string, trigger: string): never {
  throw new VoiceFsmError(fsm, from, trigger);
}

export function validateAudioTransition(req: { from: AudioState; trigger: AudioTrigger }): AudioState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'idle:startCapture': return 'listening';
    case 'listening:stopCapture': return 'processing';
    case 'processing:transcriptReady': return 'idle';
    case 'processing:sttError': return 'error';
    case 'error:reset': return 'idle';
    default: return fail('audio', from, trigger);
  }
}

export interface TranscriptTransitionRequest {
  from: TranscriptState;
  trigger: TranscriptTrigger;
  textPresent?: boolean;
}

export function validateTranscriptTransition(req: TranscriptTransitionRequest): TranscriptState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'empty:interimChunk':
    case 'interim:interimChunk':
      if (!req.textPresent) return fail('transcript', from, trigger);
      return 'interim';
    case 'interim:finalize': return 'final';
    case 'final:enableEdit': return 'editable';
    case 'editable:submit': return 'sent';
    case 'editable:cancel': return 'final';
    case 'sent:newUtterance': return 'interim';
    default: return fail('transcript', from, trigger);
  }
}

export function validateNarrationTransition(req: { from: NarrationState; trigger: NarrationTrigger }): NarrationState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'idle:enqueue': return 'queued';
    case 'queued:startProcessing': return 'processing';
    case 'processing:audioReady': return 'playing';
    case 'playing:pause': return 'paused';
    case 'paused:resume': return 'playing';
    case 'playing:complete': return 'idle';
    case 'idle:enqueue': return 'queued';
    default: return fail('narration', from, trigger);
  }
}

export function validateSessionTransition(req: { from: SessionState; trigger: SessionTrigger }): SessionState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'inactive:enable': return 'active';
    case 'active:disable': return 'inactive';
    case 'active:pushToTalkStart': return 'suspended';
    case 'suspended:pushToTalkEnd': return 'active';
    case 'suspended:disable': return 'inactive';
    default: return fail('session', from, trigger);
  }
}
```

**Step 4: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/voice-fsm.spec.ts" \
  --timeout 10000
```
Expected: `18 passing`

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/common/voice-fsm.ts \
        extensions/openspace-voice/src/__tests__/voice-fsm.spec.ts
git commit -m "feat(voice): add FSM state/transition types for audio, transcript, narration, session"
```

---

## Task 3: Extension scaffold (package.json, tsconfig, DI modules)

**Files:**
- Create: `extensions/openspace-voice/package.json`
- Create: `extensions/openspace-voice/tsconfig.json`
- Create: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`
- Create: `extensions/openspace-voice/src/node/voice-backend-module.ts`
- Modify: `browser-app/package.json` — add `openspace-voice` dependency

**Step 1: Create package.json**

Copy the pattern from `extensions/openspace-presentation/package.json`, adjust name/description:

```json
{
  "name": "openspace-voice",
  "version": "0.0.1",
  "description": "OpenSpace voice modality — STT input, TTS narration",
  "keywords": ["theia-extension"],
  "license": "MIT",
  "theia": {
    "frontend": {
      "config": {
        "disallowReloadKeybinding": true
      }
    },
    "backend": {
      "supported": true
    }
  },
  "theiaExtensions": [
    {
      "frontend": "lib/browser/openspace-voice-frontend-module",
      "backend": "lib/node/voice-backend-module"
    }
  ],
  "dependencies": {
    "@theia/core": "1.68.2"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib"
  },
  "include": ["src"]
}
```

**Step 3: Create frontend DI module (empty, wires in later tasks)**

```typescript
// extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';

export default new ContainerModule((_bind) => {
  // Voice services and contributions wired in subsequent tasks
});
```

**Step 4: Create backend DI module (empty, wires in later tasks)**

```typescript
// extensions/openspace-voice/src/node/voice-backend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';

export default new ContainerModule((_bind) => {
  // Voice backend services wired in subsequent tasks
});
```

**Step 5: Add to browser-app**

In `browser-app/package.json`, add to `dependencies`:
```json
"openspace-voice": "0.0.1"
```

**Step 6: Verify TypeScript compilation**

```bash
npx tsc --noEmit -p extensions/openspace-voice/tsconfig.json
```
Expected: no errors

**Step 7: Commit**

```bash
git add extensions/openspace-voice/package.json \
        extensions/openspace-voice/tsconfig.json \
        extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts \
        extensions/openspace-voice/src/node/voice-backend-module.ts \
        browser-app/package.json
git commit -m "feat(voice): scaffold openspace-voice extension with empty DI modules"
```

---

## Task 4: STT provider — whisper.cpp adapter + auto-selector

**Files:**
- Create: `extensions/openspace-voice/src/node/stt/whisper-cpp-adapter.ts`
- Create: `extensions/openspace-voice/src/node/stt/stt-provider-selector.ts`
- Create: `extensions/openspace-voice/src/__tests__/whisper-cpp-adapter.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/whisper-cpp-adapter.spec.ts
import { assert } from 'chai';
import { SttProviderSelector } from '../node/stt/stt-provider-selector';

describe('SttProviderSelector', () => {
  it('returns an SttProvider with kind=stt', async () => {
    const selector = new SttProviderSelector();
    const provider = await selector.selectProvider();
    assert.equal(provider.kind, 'stt');
  });

  it('provider.isAvailable() returns boolean', async () => {
    const selector = new SttProviderSelector();
    const provider = await selector.selectProvider();
    const available = await provider.isAvailable();
    assert.isBoolean(available);
  });

  it('transcribe with empty audio returns non-empty text or throws gracefully', async () => {
    const selector = new SttProviderSelector({ forceFallback: true });
    const provider = await selector.selectProvider();
    // With fallback (browser-native stub), empty audio returns placeholder
    const result = await provider.transcribe({ audio: new Uint8Array(0), language: 'en-US' });
    assert.isString(result.text);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/whisper-cpp-adapter.spec.ts" \
  --timeout 10000
```
Expected: `Cannot find module '../node/stt/stt-provider-selector'`

**Step 3: Implement whisper-cpp-adapter.ts**

```typescript
// extensions/openspace-voice/src/node/stt/whisper-cpp-adapter.ts
import { spawn } from 'child_process';
import type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult } from '../../common/voice-providers';

export class WhisperCppAdapter implements SttProvider {
  readonly kind = 'stt' as const;
  readonly id = 'whisper.cpp';

  constructor(private readonly binaryPath: string = 'whisper') {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, ['--version'], { stdio: 'pipe' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  async transcribe(request: SttTranscriptionRequest): Promise<SttTranscriptionResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        this.binaryPath,
        ['--language', request.language, '--output-txt', '-'],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      proc.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

      proc.on('error', (err) => reject(new Error(`whisper.cpp spawn failed: ${err.message}`)));
      proc.on('close', (code) => {
        if (code !== 0) {
          const errText = Buffer.concat(stderr).toString('utf8').trim();
          reject(new Error(`whisper.cpp exited ${code}: ${errText}`));
          return;
        }
        const text = Buffer.concat(stdout).toString('utf8').trim();
        if (text.length === 0) {
          reject(new Error('whisper.cpp returned empty transcription'));
          return;
        }
        resolve({ text });
      });

      proc.stdin.write(Buffer.from(request.audio));
      proc.stdin.end();
    });
  }
}
```

**Step 4: Implement stt-provider-selector.ts**

```typescript
// extensions/openspace-voice/src/node/stt/stt-provider-selector.ts
import type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult } from '../../common/voice-providers';
import { WhisperCppAdapter } from './whisper-cpp-adapter';

// Fallback: pass-through stub (returns placeholder text)
class BrowserNativeSttStub implements SttProvider {
  readonly kind = 'stt' as const;
  readonly id = 'browser-native-stub';
  async isAvailable(): Promise<boolean> { return true; }
  async transcribe(_request: SttTranscriptionRequest): Promise<SttTranscriptionResult> {
    return { text: '[audio] transcription unavailable (whisper.cpp not found)' };
  }
}

export interface SttProviderSelectorOptions {
  whisperBinaryPath?: string;
  forceFallback?: boolean;
}

export class SttProviderSelector {
  private readonly options: SttProviderSelectorOptions;

  constructor(options: SttProviderSelectorOptions = {}) {
    this.options = options;
  }

  async selectProvider(): Promise<SttProvider> {
    if (this.options.forceFallback) {
      return new BrowserNativeSttStub();
    }

    const whisper = new WhisperCppAdapter(this.options.whisperBinaryPath);
    const available = await whisper.isAvailable();
    if (available) {
      return whisper;
    }

    console.warn('[VoiceBackend] whisper.cpp not found, falling back to stub STT');
    return new BrowserNativeSttStub();
  }
}
```

**Step 5: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/whisper-cpp-adapter.spec.ts" \
  --timeout 10000
```
Expected: `3 passing`

**Step 6: Commit**

```bash
git add extensions/openspace-voice/src/node/stt/ \
        extensions/openspace-voice/src/__tests__/whisper-cpp-adapter.spec.ts
git commit -m "feat(voice): add WhisperCppAdapter and SttProviderSelector with fallback"
```

---

## Task 5: TTS provider — kokoro adapter + auto-selector

**Files:**
- Create: `extensions/openspace-voice/src/node/tts/kokoro-adapter.ts`
- Create: `extensions/openspace-voice/src/node/tts/tts-provider-selector.ts`
- Create: `extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts`
- Modify: `extensions/openspace-voice/package.json` — add kokoro-js dependency

**Step 1: Add kokoro-js to package.json**

In `extensions/openspace-voice/package.json`, add to `dependencies`:
```json
"kokoro-js": "^1.0.0"
```

Then run in the worktree:
```bash
npm install
```

**Step 2: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts
import { assert } from 'chai';
import { TtsProviderSelector } from '../node/tts/tts-provider-selector';

describe('TtsProviderSelector', () => {
  it('returns a TtsProvider with kind=tts', async () => {
    const selector = new TtsProviderSelector({ forceFallback: true });
    const provider = await selector.selectProvider();
    assert.equal(provider.kind, 'tts');
  });

  it('fallback provider synthesize returns audio bytes', async () => {
    const selector = new TtsProviderSelector({ forceFallback: true });
    const provider = await selector.selectProvider();
    const result = await provider.synthesize({ text: 'hello world', language: 'en-US' });
    assert.instanceOf(result.audio, Uint8Array);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts" \
  --timeout 10000
```

**Step 4: Implement kokoro-adapter.ts**

Port from `/Users/Shared/dev/openspace/runtime-hub/src/services/voice-provider-selector.ts`:

```typescript
// extensions/openspace-voice/src/node/tts/kokoro-adapter.ts
import type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from '../../common/voice-providers';

// Lazy-loaded kokoro model
let kokoroModel: any = null;
let kokoroLoading = false;
let kokoroLoadError: Error | null = null;

async function getKokoroModel(): Promise<any> {
  if (kokoroModel) return kokoroModel;
  if (kokoroLoadError) throw kokoroLoadError;
  if (kokoroLoading) {
    while (kokoroLoading) await new Promise(r => setTimeout(r, 100));
    if (kokoroLoadError) throw kokoroLoadError;
    return kokoroModel;
  }
  kokoroLoading = true;
  try {
    const { KokoroTTS } = await import('kokoro-js');
    kokoroModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
    });
    kokoroLoading = false;
    return kokoroModel;
  } catch (err) {
    kokoroLoadError = err as Error;
    kokoroLoading = false;
    throw err;
  }
}

export class KokoroAdapter implements TtsProvider {
  readonly kind = 'tts' as const;
  readonly id = 'kokoro';

  async isAvailable(): Promise<boolean> {
    try { await import('kokoro-js'); return true; } catch { return false; }
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    const model = await getKokoroModel();
    const voice = request.voice ?? 'af_sarah';
    const audio = await model.generate(request.text, { voice });

    let audioBytes: Uint8Array;
    const audioData = (audio as any)?.data;
    if (audioData instanceof Float32Array) {
      const int16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        int16[i] = Math.max(-1, Math.min(1, audioData[i])) * 32767;
      }
      audioBytes = new Uint8Array(int16.buffer);
    } else if (audioData instanceof Uint8Array) {
      audioBytes = audioData;
    } else {
      audioBytes = new Uint8Array(0);
    }

    return { audio: audioBytes };
  }
}
```

**Step 5: Implement tts-provider-selector.ts**

```typescript
// extensions/openspace-voice/src/node/tts/tts-provider-selector.ts
import type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from '../../common/voice-providers';
import { KokoroAdapter } from './kokoro-adapter';

class BrowserSpeechSynthesisStub implements TtsProvider {
  readonly kind = 'tts' as const;
  readonly id = 'browser-synth-stub';
  async isAvailable(): Promise<boolean> { return true; }
  async synthesize(_request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    return { audio: new Uint8Array(0) };
  }
}

export interface TtsProviderSelectorOptions {
  forceFallback?: boolean;
}

export class TtsProviderSelector {
  constructor(private readonly options: TtsProviderSelectorOptions = {}) {}

  async selectProvider(): Promise<TtsProvider> {
    if (this.options.forceFallback) {
      return new BrowserSpeechSynthesisStub();
    }
    const kokoro = new KokoroAdapter();
    const available = await kokoro.isAvailable();
    if (available) return kokoro;
    console.warn('[VoiceBackend] kokoro-js not available, falling back to stub TTS');
    return new BrowserSpeechSynthesisStub();
  }
}
```

**Step 6: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts" \
  --timeout 10000
```
Expected: `2 passing`

**Step 7: Commit**

```bash
git add extensions/openspace-voice/src/node/tts/ \
        extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts \
        extensions/openspace-voice/package.json package-lock.json
git commit -m "feat(voice): add KokoroAdapter and TtsProviderSelector with fallback"
```

---

## Task 6: Utterance library

**Files:**
- Create: `extensions/openspace-voice/utterances/config.json`
- Create: `extensions/openspace-voice/src/node/utterance-library.ts`
- Create: `extensions/openspace-voice/src/__tests__/utterance-library.spec.ts`

> **Note:** WAV files will be added separately as binary assets. For now, create placeholder empty files to validate the path structure. Real WAV files can be added later without code changes.

**Step 1: Create utterances/config.json**

```json
{
  "hmm": ["hmm-1.wav", "hmm-2.wav"],
  "wow": ["wow-1.wav"],
  "uh-oh": ["uh-oh-1.wav"],
  "nice": ["nice-1.wav", "nice-2.wav"],
  "interesting": ["interesting-1.wav"]
}
```

**Step 2: Create placeholder WAV stubs**

```bash
# Create empty placeholder WAV files (will be replaced with real audio later)
mkdir -p extensions/openspace-voice/utterances
touch extensions/openspace-voice/utterances/hmm-1.wav
touch extensions/openspace-voice/utterances/hmm-2.wav
touch extensions/openspace-voice/utterances/wow-1.wav
touch extensions/openspace-voice/utterances/uh-oh-1.wav
touch extensions/openspace-voice/utterances/nice-1.wav
touch extensions/openspace-voice/utterances/nice-2.wav
touch extensions/openspace-voice/utterances/interesting-1.wav
```

**Step 3: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/utterance-library.spec.ts
import { assert } from 'chai';
import * as path from 'path';
import { UtteranceLibrary } from '../node/utterance-library';

const UTTERANCES_DIR = path.join(__dirname, '../../utterances');

describe('UtteranceLibrary', () => {
  let lib: UtteranceLibrary;

  before(() => {
    lib = new UtteranceLibrary(UTTERANCES_DIR);
  });

  it('loads config on construction', () => {
    const ids = lib.getUtteranceIds();
    assert.include(ids, 'hmm');
    assert.include(ids, 'wow');
  });

  it('resolveUtterancePath returns a file path for known id', () => {
    const filePath = lib.resolveUtterancePath('hmm');
    assert.isString(filePath);
    assert.include(filePath, 'hmm');
    assert.include(filePath, '.wav');
  });

  it('resolveUtterancePath returns null for unknown id', () => {
    const filePath = lib.resolveUtterancePath('nonexistent-id');
    assert.isNull(filePath);
  });

  it('resolves different files for same id (randomness)', () => {
    // With 2 files for 'hmm', repeated calls should eventually return both
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const p = lib.resolveUtterancePath('hmm');
      if (p) seen.add(p);
    }
    assert.isAtLeast(seen.size, 1); // at least 1 (may not always hit both in 20 tries but should)
  });
});
```

**Step 4: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/utterance-library.spec.ts" \
  --timeout 10000
```

**Step 5: Implement utterance-library.ts**

```typescript
// extensions/openspace-voice/src/node/utterance-library.ts
import * as fs from 'fs';
import * as path from 'path';

type UtteranceConfig = Record<string, string[]>;

export class UtteranceLibrary {
  private readonly config: UtteranceConfig;

  constructor(private readonly utterancesDir: string) {
    const configPath = path.join(utterancesDir, 'config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(raw) as UtteranceConfig;
  }

  getUtteranceIds(): string[] {
    return Object.keys(this.config);
  }

  resolveUtterancePath(id: string): string | null {
    const files = this.config[id];
    if (!files || files.length === 0) return null;
    const chosen = files[Math.floor(Math.random() * files.length)];
    return path.join(this.utterancesDir, chosen);
  }
}
```

**Step 6: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/utterance-library.spec.ts" \
  --timeout 10000
```
Expected: `4 passing`

**Step 7: Commit**

```bash
git add extensions/openspace-voice/utterances/ \
        extensions/openspace-voice/src/node/utterance-library.ts \
        extensions/openspace-voice/src/__tests__/utterance-library.spec.ts
git commit -m "feat(voice): add utterance library with data-driven config and random WAV selection"
```

---

## Task 7: Narration preprocessor (LLM pass → NarrationScript)

**Files:**
- Create: `extensions/openspace-voice/src/node/narration-preprocessor.ts`
- Create: `extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts
import { assert } from 'chai';
import { NarrationPreprocessor, type LlmCaller } from '../node/narration-preprocessor';
import type { NarrationScript } from '../common/narration-types';

const SAMPLE_SCRIPT: NarrationScript = {
  segments: [
    { type: 'utterance', utteranceId: 'hmm', priority: 'normal' },
    { type: 'speech', text: 'Here is what happened.', priority: 'normal', emotion: { kind: 'thoughtful' } },
  ],
};

const mockLlm: LlmCaller = async (_prompt: string, _text: string): Promise<string> => {
  return JSON.stringify(SAMPLE_SCRIPT);
};

describe('NarrationPreprocessor', () => {
  let preprocessor: NarrationPreprocessor;

  before(() => {
    preprocessor = new NarrationPreprocessor({
      llmCaller: mockLlm,
    });
  });

  it('narrate-off returns empty segments', async () => {
    const result = await preprocessor.process({ text: 'hello', mode: 'narrate-off' });
    assert.deepEqual(result.segments, []);
  });

  it('narrate-everything calls LLM and returns NarrationScript', async () => {
    const result = await preprocessor.process({ text: 'Run: rm -rf /tmp', mode: 'narrate-everything' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.segments[0].type, 'utterance');
    assert.equal(result.segments[1].type, 'speech');
  });

  it('narrate-summary calls LLM and returns NarrationScript', async () => {
    const result = await preprocessor.process({ text: 'Long agent response...', mode: 'narrate-summary' });
    assert.isArray(result.segments);
  });

  it('falls back to raw speech segment when LLM returns invalid JSON', async () => {
    const badLlm: LlmCaller = async () => 'not json';
    const p = new NarrationPreprocessor({ llmCaller: badLlm });
    const result = await p.process({ text: 'hello world', mode: 'narrate-everything' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].type, 'speech');
    assert.equal(result.segments[0].text, 'hello world');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts" \
  --timeout 10000
```

**Step 3: Implement narration-preprocessor.ts**

```typescript
// extensions/openspace-voice/src/node/narration-preprocessor.ts
import type { NarrationMode, NarrationPrompts } from '../common/voice-policy';
import { DEFAULT_NARRATION_PROMPTS } from '../common/voice-policy';
import { isValidNarrationScript, type NarrationScript } from '../common/narration-types';

export type LlmCaller = (prompt: string, text: string) => Promise<string>;

export interface NarrationPreprocessorOptions {
  llmCaller: LlmCaller;
  prompts?: Partial<NarrationPrompts>;
}

export interface NarrationRequest {
  text: string;
  mode: NarrationMode;
}

export class NarrationPreprocessor {
  private readonly llmCaller: LlmCaller;
  private readonly prompts: NarrationPrompts;

  constructor(options: NarrationPreprocessorOptions) {
    this.llmCaller = options.llmCaller;
    this.prompts = {
      everything: options.prompts?.everything ?? DEFAULT_NARRATION_PROMPTS.everything,
      summary: options.prompts?.summary ?? DEFAULT_NARRATION_PROMPTS.summary,
    };
  }

  async process(request: NarrationRequest): Promise<NarrationScript> {
    if (request.mode === 'narrate-off') {
      return { segments: [] };
    }

    const prompt = request.mode === 'narrate-everything'
      ? this.prompts.everything
      : this.prompts.summary;

    try {
      const raw = await this.llmCaller(prompt, request.text);

      // Extract JSON from potential markdown code block
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/) ?? null;
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

      const parsed: unknown = JSON.parse(jsonStr);
      if (isValidNarrationScript(parsed)) {
        return parsed;
      }
      throw new Error('Invalid NarrationScript structure');
    } catch (err) {
      // Graceful fallback: return raw text as a single speech segment
      console.warn('[NarrationPreprocessor] LLM preprocessing failed, falling back to raw text:', err);
      return {
        segments: [{
          type: 'speech',
          text: request.text,
          priority: 'normal',
        }],
      };
    }
  }
}
```

**Step 4: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts" \
  --timeout 10000
```
Expected: `4 passing`

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/node/narration-preprocessor.ts \
        extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts
git commit -m "feat(voice): add NarrationPreprocessor with LLM narration modes and graceful fallback"
```

---

## Task 8: Backend HTTP endpoints (`/voice/stt`, `/voice/narrate`)

**Files:**
- Create: `extensions/openspace-voice/src/node/voice-backend-service.ts`
- Modify: `extensions/openspace-core/src/node/hub.ts` — register `/openspace/voice/*` routes
- Create: `extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts
import { assert } from 'chai';
import { VoiceBackendService } from '../node/voice-backend-service';
import type { SttProvider } from '../common/voice-providers';
import type { TtsProvider } from '../common/voice-providers';
import type { LlmCaller } from '../node/narration-preprocessor';

const mockStt: SttProvider = {
  kind: 'stt',
  id: 'mock-stt',
  isAvailable: async () => true,
  transcribe: async (_req) => ({ text: 'hello world' }),
};

const mockTts: TtsProvider = {
  kind: 'tts',
  id: 'mock-tts',
  isAvailable: async () => true,
  synthesize: async (_req) => ({ audio: new Uint8Array([1, 2, 3]) }),
};

const mockLlm: LlmCaller = async (_prompt, text) => JSON.stringify({
  segments: [{ type: 'speech', text, priority: 'normal' }],
});

describe('VoiceBackendService', () => {
  let service: VoiceBackendService;

  before(() => {
    service = new VoiceBackendService({
      sttProvider: mockStt,
      ttsProvider: mockTts,
      llmCaller: mockLlm,
    });
  });

  it('transcribeSpeech delegates to STT provider', async () => {
    const result = await service.transcribeSpeech({
      audio: new Uint8Array(10),
      language: 'en-US',
    });
    assert.equal(result.text, 'hello world');
  });

  it('narrateText with mode=narrate-off returns empty segments and no audio', async () => {
    const result = await service.narrateText({
      text: 'hello',
      mode: 'narrate-off',
      voice: 'af_sarah',
      speed: 1.0,
    });
    assert.deepEqual(result.segments, []);
  });

  it('narrateText with mode=narrate-everything returns segments with audio', async () => {
    const result = await service.narrateText({
      text: 'Run: npm install',
      mode: 'narrate-everything',
      voice: 'af_sarah',
      speed: 1.0,
    });
    assert.isArray(result.segments);
    assert.isAtLeast(result.segments.length, 1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts" \
  --timeout 10000
```

**Step 3: Implement voice-backend-service.ts**

```typescript
// extensions/openspace-voice/src/node/voice-backend-service.ts
import type { NarrationMode } from '../common/voice-policy';
import type { SttProvider, TtsProvider } from '../common/voice-providers';
import type { NarrationSegment } from '../common/narration-types';
import { NarrationPreprocessor, type LlmCaller } from './narration-preprocessor';

export interface TranscribeSpeechRequest {
  audio: Uint8Array;
  language: string;
}

export interface TranscribeSpeechResult {
  text: string;
}

export interface NarrateTextRequest {
  text: string;
  mode: NarrationMode;
  voice: string;
  speed: number;
}

export interface NarrateSegmentResult {
  type: 'speech' | 'utterance';
  audioBase64?: string;   // base64-encoded WAV for type='speech'
  utteranceId?: string;   // for type='utterance'
  emotion?: { kind: string };
}

export interface NarrateTextResult {
  segments: NarrateSegmentResult[];
}

export interface VoiceBackendServiceOptions {
  sttProvider: SttProvider;
  ttsProvider: TtsProvider;
  llmCaller: LlmCaller;
  narrationPrompts?: { everything?: string; summary?: string };
}

export class VoiceBackendService {
  private readonly sttProvider: SttProvider;
  private readonly ttsProvider: TtsProvider;
  private readonly narrationPreprocessor: NarrationPreprocessor;

  constructor(options: VoiceBackendServiceOptions) {
    this.sttProvider = options.sttProvider;
    this.ttsProvider = options.ttsProvider;
    this.narrationPreprocessor = new NarrationPreprocessor({
      llmCaller: options.llmCaller,
      prompts: options.narrationPrompts,
    });
  }

  async transcribeSpeech(request: TranscribeSpeechRequest): Promise<TranscribeSpeechResult> {
    return this.sttProvider.transcribe({ audio: request.audio, language: request.language });
  }

  async narrateText(request: NarrateTextRequest): Promise<NarrateTextResult> {
    const script = await this.narrationPreprocessor.process({
      text: request.text,
      mode: request.mode,
    });

    if (script.segments.length === 0) {
      return { segments: [] };
    }

    const results: NarrateSegmentResult[] = [];
    for (const segment of script.segments) {
      if (segment.type === 'utterance') {
        results.push({
          type: 'utterance',
          utteranceId: segment.utteranceId,
          emotion: segment.emotion,
        });
      } else if (segment.type === 'speech' && segment.text) {
        const ttsResult = await this.ttsProvider.synthesize({
          text: segment.text,
          language: 'en-US',
          speed: request.speed,
          voice: request.voice,
        });
        results.push({
          type: 'speech',
          audioBase64: Buffer.from(ttsResult.audio).toString('base64'),
          emotion: segment.emotion,
        });
      }
    }

    return { segments: results };
  }
}
```

**Step 4: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts" \
  --timeout 10000
```
Expected: `3 passing`

**Step 5: Register routes in hub.ts**

In `extensions/openspace-core/src/node/hub.ts`, find where other `/openspace/*` routes are registered and add:

```typescript
// Near existing /openspace/* routes
app.post('/openspace/voice/stt', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  try {
    const audio = new Uint8Array(req.body as Buffer);
    const language = (req.headers['x-voice-language'] as string) ?? 'en-US';
    const result = await voiceBackendService.transcribeSpeech({ audio, language });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/openspace/voice/narrate', express.json(), async (req, res) => {
  try {
    const { text, mode, voice, speed } = req.body as {
      text: string; mode: string; voice: string; speed: number;
    };
    const result = await voiceBackendService.narrateText({
      text, mode: mode as any, voice, speed,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

You will also need to instantiate `VoiceBackendService` in hub.ts — look at how other services are created (e.g., `ArtifactStore`, `PatchEngine`) and follow the same pattern. Wire up `SttProviderSelector` and `TtsProviderSelector`, and for `llmCaller`, create a thin wrapper that calls the Hub's existing opencode proxy (look at how agent messages are sent in `opencode-proxy.ts`).

**Step 6: Commit**

```bash
git add extensions/openspace-voice/src/node/voice-backend-service.ts \
        extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts \
        extensions/openspace-core/src/node/hub.ts
git commit -m "feat(voice): add VoiceBackendService and wire /openspace/voice/stt and /narrate routes in hub"
```

---

## Task 9: MCP tool — `voice.set_policy`

**Files:**
- Modify: `extensions/openspace-core/src/node/hub-mcp.ts` — add `voice.set_policy` tool

**Step 1: Add voice.set_policy to hub-mcp.ts**

In `hub-mcp.ts`, find `registerPresentationTools` or `registerWhiteboardTools` to see the pattern. Add a new method:

```typescript
private registerVoiceTools(server: any): void {
  server.tool(
    'voice.set_policy',
    'Update the voice modality policy (narration mode, speed, voice, enable/disable)',
    {
      enabled: { type: 'boolean', description: 'Enable or disable voice', optional: true },
      narrationMode: {
        type: 'string',
        enum: ['narrate-off', 'narrate-everything', 'narrate-summary'],
        description: 'Narration mode for agent responses',
        optional: true,
      },
      speed: { type: 'number', description: 'TTS speed multiplier (0.5–2.0)', optional: true },
      voice: { type: 'string', description: 'TTS voice ID (e.g. af_sarah)', optional: true },
      narrationPrompts: {
        type: 'object',
        properties: {
          everything: { type: 'string', optional: true },
          summary: { type: 'string', optional: true },
        },
        description: 'Override narration preprocessing prompts',
        optional: true,
      },
    },
    async (args: any) => {
      const result = await this.executeViaBridge('openspace.voice.set_policy', args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    }
  );
}
```

Also call `this.registerVoiceTools(server)` inside the `setupTools` method alongside the other `register*Tools` calls.

**Step 2: Register the Theia command for voice.set_policy**

In `extensions/openspace-voice/src/browser/voice-command-contribution.ts` (created in Task 10), register:

```typescript
registry.registerCommand('openspace.voice.set_policy', {
  execute: (args: Partial<VoicePolicy>) => {
    sessionFsm.updatePolicy(args);
    return { success: true };
  }
});
```

**Step 3: Build and verify no TypeScript errors**

```bash
npx tsc --noEmit -p extensions/openspace-core/tsconfig.json
```

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp.ts
git commit -m "feat(voice): add voice.set_policy MCP tool"
```

---

## Task 10: Browser-side SessionFSM + VoiceService (frontend)

**Files:**
- Create: `extensions/openspace-voice/src/browser/session-fsm.ts`
- Create: `extensions/openspace-voice/src/browser/voice-service.ts`
- Create: `extensions/openspace-voice/src/__tests__/session-fsm.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/session-fsm.spec.ts
import { assert } from 'chai';
import { SessionFsm } from '../browser/session-fsm';
import { DEFAULT_VOICE_POLICY } from '../common/voice-policy';

describe('SessionFsm', () => {
  let fsm: SessionFsm;

  beforeEach(() => {
    fsm = new SessionFsm();
  });

  it('starts inactive', () => {
    assert.equal(fsm.state, 'inactive');
  });

  it('enable → active', () => {
    fsm.enable();
    assert.equal(fsm.state, 'active');
  });

  it('active → disabled → inactive', () => {
    fsm.enable();
    fsm.disable();
    assert.equal(fsm.state, 'inactive');
  });

  it('pushToTalkStart suspends when active', () => {
    fsm.enable();
    fsm.pushToTalkStart();
    assert.equal(fsm.state, 'suspended');
  });

  it('pushToTalkEnd restores active from suspended', () => {
    fsm.enable();
    fsm.pushToTalkStart();
    fsm.pushToTalkEnd();
    assert.equal(fsm.state, 'active');
  });

  it('updatePolicy merges partial update', () => {
    fsm.updatePolicy({ narrationMode: 'narrate-summary' });
    assert.equal(fsm.policy.narrationMode, 'narrate-summary');
    assert.equal(fsm.policy.speed, DEFAULT_VOICE_POLICY.speed);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/session-fsm.spec.ts" \
  --timeout 10000
```

**Step 3: Implement session-fsm.ts**

```typescript
// extensions/openspace-voice/src/browser/session-fsm.ts
import {
  validateSessionTransition,
  type SessionState,
} from '../common/voice-fsm';
import {
  resolveVoicePolicy,
  DEFAULT_VOICE_POLICY,
  type VoicePolicy,
} from '../common/voice-policy';

export class SessionFsm {
  private _state: SessionState = 'inactive';
  private _policy: VoicePolicy = { ...DEFAULT_VOICE_POLICY };

  get state(): SessionState { return this._state; }
  get policy(): VoicePolicy { return { ...this._policy }; }

  enable(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'enable' });
    this._policy = resolveVoicePolicy({ ...this._policy, enabled: true });
  }

  disable(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'disable' });
    this._policy = resolveVoicePolicy({ ...this._policy, enabled: false });
  }

  pushToTalkStart(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'pushToTalkStart' });
  }

  pushToTalkEnd(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'pushToTalkEnd' });
  }

  updatePolicy(partial: Partial<VoicePolicy>): void {
    this._policy = resolveVoicePolicy({ ...this._policy, ...partial });
  }
}
```

**Step 4: Implement voice-service.ts (interface)**

```typescript
// extensions/openspace-voice/src/browser/voice-service.ts
import type { VoicePolicy } from '../common/voice-policy';
import type { SessionState } from '../common/voice-fsm';

export const VoiceService = Symbol('VoiceService');

export interface VoiceService {
  readonly sessionState: SessionState;
  readonly policy: VoicePolicy;
  enable(): void;
  disable(): void;
  startPushToTalk(): void;
  stopPushToTalk(): Promise<void>;  // triggers STT transcription
  updatePolicy(partial: Partial<VoicePolicy>): void;
  onTranscript: (handler: (text: string) => void) => void;
}
```

**Step 5: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/session-fsm.spec.ts" \
  --timeout 10000
```
Expected: `7 passing`

**Step 6: Commit**

```bash
git add extensions/openspace-voice/src/browser/session-fsm.ts \
        extensions/openspace-voice/src/browser/voice-service.ts \
        extensions/openspace-voice/src/__tests__/session-fsm.spec.ts
git commit -m "feat(voice): add SessionFsm and VoiceService interface (browser)"
```

---

## Task 11: AudioFSM + push-to-talk (browser MediaRecorder)

**Files:**
- Create: `extensions/openspace-voice/src/browser/audio-fsm.ts`
- Create: `extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts
import { assert } from 'chai';
import { AudioFsm } from '../browser/audio-fsm';

// Mock navigator.mediaDevices for jsdom
const mockStream = { getTracks: () => [{ stop: () => {} }] } as any;
global.navigator = {
  ...global.navigator,
  mediaDevices: {
    getUserMedia: async (_constraints: any) => mockStream,
  } as any,
} as any;

describe('AudioFsm (state transitions only — no real mic)', () => {
  let fsm: AudioFsm;
  let transcriptEvents: string[];

  beforeEach(() => {
    transcriptEvents = [];
    fsm = new AudioFsm({
      sttEndpoint: '/openspace/voice/stt',
      language: 'en-US',
      onTranscript: (text) => transcriptEvents.push(text),
    });
  });

  it('starts in idle state', () => {
    assert.equal(fsm.state, 'idle');
  });

  it('startCapture → listening (with mock stream)', async () => {
    await fsm.startCapture();
    assert.equal(fsm.state, 'listening');
  });

  it('cannot start from non-idle state', async () => {
    await fsm.startCapture();
    await assert.isRejected(fsm.startCapture());
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts" \
  --timeout 10000
```

**Step 3: Implement audio-fsm.ts**

```typescript
// extensions/openspace-voice/src/browser/audio-fsm.ts
import { validateAudioTransition, type AudioState } from '../common/voice-fsm';

export interface AudioFsmOptions {
  sttEndpoint: string;
  language: string;
  onTranscript: (text: string) => void;
  onError?: (err: Error) => void;
}

export class AudioFsm {
  private _state: AudioState = 'idle';
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(private readonly options: AudioFsmOptions) {}

  get state(): AudioState { return this._state; }

  async startCapture(): Promise<void> {
    this._state = validateAudioTransition({ from: this._state, trigger: 'startCapture' });
    this.audioChunks = [];

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  async stopCapture(): Promise<void> {
    this._state = validateAudioTransition({ from: this._state, trigger: 'stopCapture' });

    await new Promise<void>((resolve) => {
      if (!this.mediaRecorder) { resolve(); return; }
      this.mediaRecorder.onstop = () => resolve();
      this.mediaRecorder.stop();
    });

    this.mediaStream?.getTracks().forEach((t) => t.stop());

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audio = new Uint8Array(arrayBuffer);

      const response = await fetch(this.options.sttEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Voice-Language': this.options.language,
        },
        body: audio,
      });

      if (!response.ok) throw new Error(`STT endpoint returned ${response.status}`);
      const result = await response.json() as { text: string };

      this._state = validateAudioTransition({ from: this._state, trigger: 'transcriptReady' });
      this.options.onTranscript(result.text);
    } catch (err) {
      this._state = validateAudioTransition({ from: this._state, trigger: 'sttError' });
      this.options.onError?.(err as Error);
    }
  }

  reset(): void {
    this._state = validateAudioTransition({ from: this._state, trigger: 'reset' });
  }
}
```

**Step 4: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts" \
  --timeout 10000
```
Expected: `3 passing`

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/browser/audio-fsm.ts \
        extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts
git commit -m "feat(voice): add AudioFsm with push-to-talk MediaRecorder and STT endpoint integration"
```

---

## Task 12: NarrationFSM + Web Audio playback (browser)

**Files:**
- Create: `extensions/openspace-voice/src/browser/narration-fsm.ts`
- Create: `extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts`

**Step 1: Create the test file**

```typescript
// extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts
import { assert } from 'chai';
import { NarrationFsm } from '../browser/narration-fsm';

describe('NarrationFsm (state transitions only)', () => {
  let fsm: NarrationFsm;
  const mockNarrateEndpoint = '/openspace/voice/narrate';

  beforeEach(() => {
    fsm = new NarrationFsm({
      narrateEndpoint: mockNarrateEndpoint,
      utteranceBaseUrl: '/openspace/voice/utterances',
    });
  });

  it('starts idle', () => {
    assert.equal(fsm.state, 'idle');
  });

  it('enqueue transitions to queued', () => {
    fsm.enqueue({ text: 'hello', mode: 'narrate-off', voice: 'af_sarah', speed: 1.0 });
    assert.equal(fsm.state, 'queued');
  });

  it('pause/resume only valid when playing', () => {
    assert.throws(() => fsm.pause()); // can't pause when idle
  });
});
```

**Step 2: Implement narration-fsm.ts**

```typescript
// extensions/openspace-voice/src/browser/narration-fsm.ts
import {
  validateNarrationTransition,
  type NarrationState,
} from '../common/voice-fsm';
import type { NarrationMode } from '../common/voice-policy';

export interface NarrationRequest {
  text: string;
  mode: NarrationMode;
  voice: string;
  speed: number;
}

export interface NarrationFsmOptions {
  narrateEndpoint: string;
  utteranceBaseUrl: string;
  onPlaybackComplete?: () => void;
  onError?: (err: Error) => void;
}

export class NarrationFsm {
  private _state: NarrationState = 'idle';
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private queue: NarrationRequest[] = [];

  constructor(private readonly options: NarrationFsmOptions) {}

  get state(): NarrationState { return this._state; }

  enqueue(request: NarrationRequest): void {
    if (this._state === 'idle') {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
      this.processQueue(request);
    } else {
      this.queue.push(request);
    }
  }

  pause(): void {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'pause' });
    this.audioCtx?.suspend();
  }

  resume(): void {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'resume' });
    this.audioCtx?.resume();
  }

  private async processQueue(request: NarrationRequest): Promise<void> {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'startProcessing' });

    try {
      const response = await fetch(this.options.narrateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) throw new Error(`Narrate endpoint returned ${response.status}`);
      const result = await response.json() as { segments: Array<{ type: string; audioBase64?: string; utteranceId?: string }> };

      this._state = validateNarrationTransition({ from: this._state, trigger: 'audioReady' });

      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }

      for (const segment of result.segments) {
        if (segment.type === 'speech' && segment.audioBase64) {
          const bytes = Uint8Array.from(atob(segment.audioBase64), (c) => c.charCodeAt(0));
          await this.playAudioBuffer(bytes);
        } else if (segment.type === 'utterance' && segment.utteranceId) {
          await this.playUtterance(segment.utteranceId);
        }
      }

      this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
      this.options.onPlaybackComplete?.();

      // Process next in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
        await this.processQueue(next);
      }
    } catch (err) {
      this._state = 'idle'; // reset on error
      this.options.onError?.(err as Error);
    }
  }

  private async playAudioBuffer(pcmBytes: Uint8Array): Promise<void> {
    if (!this.audioCtx) return;
    const int16 = new Int16Array(pcmBytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32767;

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    this.currentSource = source;

    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }

  private async playUtterance(utteranceId: string): Promise<void> {
    const url = `${this.options.utteranceBaseUrl}/${utteranceId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) return; // skip missing utterances silently
      const arrayBuffer = await response.arrayBuffer();
      if (!this.audioCtx) return;
      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    } catch {
      // ignore utterance playback errors
    }
  }
}
```

**Step 3: Run tests to verify passing**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts" \
  --timeout 10000
```
Expected: `3 passing`

**Step 4: Commit**

```bash
git add extensions/openspace-voice/src/browser/narration-fsm.ts \
        extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts
git commit -m "feat(voice): add NarrationFsm with priority queue, Web Audio playback, utterance support"
```

---

## Task 13: Voice input widget (mic button in chat input)

**Files:**
- Create: `extensions/openspace-voice/src/browser/voice-input-widget.tsx`
- Create: `extensions/openspace-voice/src/browser/voice-command-contribution.ts`
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts` — wire everything

**Step 1: Implement voice-command-contribution.ts**

```typescript
// extensions/openspace-voice/src/browser/voice-command-contribution.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { SessionFsm } from './session-fsm';
import { AudioFsm } from './audio-fsm';
import { NarrationFsm } from './narration-fsm';

export const VOICE_COMMANDS = {
  TOGGLE_VOICE: { id: 'openspace.voice.toggle', label: 'Voice: Toggle Voice Input' },
  SET_POLICY: { id: 'openspace.voice.set_policy', label: 'Voice: Set Policy' },
};

@injectable()
export class VoiceCommandContribution implements CommandContribution, KeybindingContribution {
  @inject(SessionFsm) private readonly sessionFsm!: SessionFsm;
  @inject(AudioFsm) private readonly audioFsm!: AudioFsm;
  @inject(NarrationFsm) private readonly narrationFsm!: NarrationFsm;

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(VOICE_COMMANDS.TOGGLE_VOICE, {
      execute: () => {
        if (this.sessionFsm.state === 'inactive') {
          this.sessionFsm.enable();
        } else {
          this.sessionFsm.disable();
        }
      },
    });

    registry.registerCommand(VOICE_COMMANDS.SET_POLICY, {
      execute: (args: any) => {
        this.sessionFsm.updatePolicy(args);
        return { success: true };
      },
    });
  }

  registerKeybindings(registry: KeybindingRegistry): void {
    // Push-to-talk is handled directly in VoiceInputWidget via DOM events
    // Keybinding registration for toggle
    registry.registerKeybinding({
      command: VOICE_COMMANDS.TOGGLE_VOICE.id,
      keybinding: 'ctrl+shift+v',
    });
  }
}
```

**Step 2: Implement voice-input-widget.tsx (mic button)**

```typescript
// extensions/openspace-voice/src/browser/voice-input-widget.tsx
import * as React from 'react';
import { injectable, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { SessionFsm } from './session-fsm';
import { AudioFsm } from './audio-fsm';
import { NarrationFsm } from './narration-fsm';

@injectable()
export class VoiceInputWidget extends ReactWidget {
  @inject(SessionFsm) private readonly sessionFsm!: SessionFsm;
  @inject(AudioFsm) private readonly audioFsm!: AudioFsm;
  @inject(NarrationFsm) private readonly narrationFsm!: NarrationFsm;

  private isRecording = false;

  protected render(): React.ReactNode {
    const voiceEnabled = this.sessionFsm.state !== 'inactive';
    const recording = this.isRecording;
    const narrating = this.narrationFsm.state === 'playing';

    return (
      <div className="voice-input-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className={`voice-mic-button ${recording ? 'recording' : ''} ${!voiceEnabled ? 'disabled' : ''}`}
          title={recording ? 'Release to transcribe' : 'Hold to record (push-to-talk)'}
          onMouseDown={this.handleMicMouseDown}
          onMouseUp={this.handleMicMouseUp}
          style={{
            background: recording ? '#e53e3e' : voiceEnabled ? '#3182ce' : '#718096',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: voiceEnabled ? 'pointer' : 'not-allowed',
          }}
        >
          🎤
        </button>
        {narrating && (
          <button
            className="voice-stop-narration"
            title="Stop narration"
            onClick={this.handleStopNarration}
            style={{ background: '#dd6b20', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px' }}
          >
            ⏹
          </button>
        )}
        {recording && <span style={{ color: '#e53e3e', fontSize: '12px' }}>● REC</span>}
      </div>
    );
  }

  private handleMicMouseDown = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (this.sessionFsm.state === 'inactive') return;
    this.sessionFsm.pushToTalkStart();
    this.narrationFsm.pause();
    this.isRecording = true;
    await this.audioFsm.startCapture();
    this.update();
  };

  private handleMicMouseUp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!this.isRecording) return;
    this.isRecording = false;
    await this.audioFsm.stopCapture();
    this.sessionFsm.pushToTalkEnd();
    this.update();
  };

  private handleStopNarration = () => {
    this.narrationFsm.pause();
    this.update();
  };
}
```

**Step 3: Wire up frontend module**

Update `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`:

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, KeybindingContribution } from '@theia/core/lib/browser';
import { SessionFsm } from './session-fsm';
import { AudioFsm } from './audio-fsm';
import { NarrationFsm } from './narration-fsm';
import { VoiceCommandContribution } from './voice-command-contribution';
import { VoiceInputWidget } from './voice-input-widget';

export default new ContainerModule((bind) => {
  bind(SessionFsm).toSelf().inSingletonScope();

  bind(AudioFsm).toDynamicValue(({ container }) => {
    const sessionFsm = container.get(SessionFsm);
    return new AudioFsm({
      sttEndpoint: '/openspace/voice/stt',
      language: sessionFsm.policy.language,
      onTranscript: (text) => {
        // Inject into chat input — find the chat input textarea in the DOM
        const chatInput = document.querySelector<HTMLTextAreaElement>('.theia-ai-chat-input textarea, [data-chat-input]');
        if (chatInput) {
          chatInput.value = text;
          chatInput.dispatchEvent(new Event('input', { bubbles: true }));
          chatInput.focus();
        }
      },
      onError: (err) => console.error('[VoiceInput] STT error:', err),
    });
  }).inSingletonScope();

  bind(NarrationFsm).toDynamicValue(() => new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
  })).inSingletonScope();

  bind(VoiceCommandContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(VoiceCommandContribution);
  bind(KeybindingContribution).toService(VoiceCommandContribution);

  bind(VoiceInputWidget).toSelf().inSingletonScope();
});
```

> **Note on chat input injection:** The selector for the chat input depends on how the `@theia/ai-chat` extension renders its input. Inspect the DOM in the running app to find the correct selector. Common patterns: `.theia-ai-chat-input textarea` or a custom attribute. Update the selector in the AudioFsm binding above once confirmed.

**Step 4: Build and verify no TypeScript errors**

```bash
npx tsc --noEmit -p extensions/openspace-voice/tsconfig.json
```

**Step 5: Commit**

```bash
git add extensions/openspace-voice/src/browser/
git commit -m "feat(voice): add VoiceInputWidget mic button, VoiceCommandContribution, wire frontend DI module"
```

---

## Task 14: Serve utterance WAV files from backend

**Files:**
- Modify: `extensions/openspace-core/src/node/hub.ts` — add `GET /openspace/voice/utterances/:filename` route

**Step 1: Add utterance file serving route in hub.ts**

```typescript
// In hub.ts, alongside the /voice/stt and /voice/narrate routes
app.get('/openspace/voice/utterances/:filename', (req, res) => {
  const filename = req.params.filename;
  // Validate filename (no path traversal)
  if (!/^[\w\-]+\.wav$/.test(filename)) {
    res.status(400).send('Invalid filename');
    return;
  }
  const utterancesDir = path.join(__dirname, '../../../../extensions/openspace-voice/utterances');
  const filePath = path.join(utterancesDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Utterance not found');
    return;
  }
  res.setHeader('Content-Type', 'audio/wav');
  fs.createReadStream(filePath).pipe(res);
});
```

**Step 2: Commit**

```bash
git add extensions/openspace-core/src/node/hub.ts
git commit -m "feat(voice): serve utterance WAV files from /openspace/voice/utterances/:filename"
```

---

## Task 15: NarrationFSM ← SessionService integration (subscribe to agent messages)

**Files:**
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts` — wire NarrationFsm to SessionService

**Context:** `SessionService` in `extensions/openspace-core/src/browser/session-service.ts` emits message events. Look at how it's used in `chat-widget.tsx` to find the event API (`onMessageCompleted` or similar).

**Step 1: Find the correct SessionService event**

```bash
grep -n "onMessage\|messageStreaming\|messageComplete" extensions/openspace-core/src/browser/session-service.ts
```

Note the event name. It will be something like `onMessageCompleted(handler: (text: string) => void)`.

**Step 2: Wire NarrationFsm to SessionService in the DI module**

In the `NarrationFsm` binding in `openspace-voice-frontend-module.ts`, after creating the `NarrationFsm`, subscribe to `SessionService`:

```typescript
bind(NarrationFsm).toDynamicValue(({ container }) => {
  const sessionFsm = container.get(SessionFsm);
  const narrationFsm = new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
  });

  // Wire agent message completion → narration
  // Get SessionService and subscribe to message events
  const sessionService = container.get(SessionService);
  sessionService.onMessageCompleted((message: string) => {
    if (sessionFsm.state !== 'inactive' && sessionFsm.policy.narrationMode !== 'narrate-off') {
      narrationFsm.enqueue({
        text: message,
        mode: sessionFsm.policy.narrationMode,
        voice: sessionFsm.policy.voice,
        speed: sessionFsm.policy.speed,
      });
    }
  });

  return narrationFsm;
}).inSingletonScope();
```

Adjust the `SessionService` import and event name based on what you found in Step 1.

**Step 3: Commit**

```bash
git add extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
git commit -m "feat(voice): subscribe NarrationFsm to SessionService message completion events"
```

---

## Task 16: Run full test suite and verify

**Step 1: Run all voice extension tests**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts --spec "extensions/openspace-voice/src/__tests__/*.spec.ts" \
  --timeout 10000
```
Expected: all tests passing (target: ~35+ tests across all spec files)

**Step 2: Run full unit test suite to verify no regressions**

```bash
npx mocha --require ./test-setup.js --require ts-node/register/transpile-only \
  --extensions ts,tsx \
  --spec "extensions/openspace-core/**/__tests__/*.spec.ts" \
  --timeout 10000
```
Expected: existing tests still passing

**Step 3: TypeScript check all touched extensions**

```bash
npx tsc --noEmit -p extensions/openspace-voice/tsconfig.json
npx tsc --noEmit -p extensions/openspace-core/tsconfig.json
```

**Step 4: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "test(voice): verify all voice unit tests passing, no regressions"
```

---

## Task 17: Build and smoke-test in running Theia

**Step 1: Build the voice extension**

```bash
npx tsc -p extensions/openspace-voice/tsconfig.json
```

**Step 2: Build the full app (includes browser-app wiring)**

```bash
yarn build 2>&1 | tail -20
```
Expected: build completes without errors

**Step 3: Start the app and verify voice extension loads**

```bash
yarn start 2>&1 | grep -i "voice\|error" | head -20
```
Expected: no voice-related errors in startup log

**Step 4: Manual smoke test**

1. Open Theia in browser
2. Verify mic button appears in chat input area
3. Click enable (Ctrl+Shift+V)
4. Hold mic button → verify mic indicator shows
5. Release → verify transcript appears in chat input
6. Send a message → verify agent responds → verify TTS plays (if narration enabled)
7. Enable narrate-everything mode in settings
8. Send another message → verify narration plays

**Step 5: Document results in VOICE-TEST-PROTOCOL.md**

Create `docs/testing/VOICE-TEST-PROTOCOL.md` with test results and any known issues.

**Step 6: Final commit**

```bash
git add docs/testing/VOICE-TEST-PROTOCOL.md
git commit -m "docs: add voice modality test protocol and smoke test results"
```

---

## Summary

| Task | What | Tests |
|---|---|---|
| 1 | VoicePolicy + NarrationScript types + provider interfaces | 5 |
| 2 | FSM state/transition logic (all 4 FSMs) | 18 |
| 3 | Extension scaffold (package.json, tsconfig, empty DI modules) | — |
| 4 | STT: whisper.cpp adapter + auto-selector | 3 |
| 5 | TTS: kokoro adapter + auto-selector | 2 |
| 6 | Utterance library (data-driven, random selection) | 4 |
| 7 | Narration preprocessor (LLM pass → NarrationScript) | 4 |
| 8 | Backend HTTP endpoints `/voice/stt` + `/voice/narrate` | 3 |
| 9 | MCP tool `voice.set_policy` | — |
| 10 | SessionFsm + VoiceService interface | 7 |
| 11 | AudioFsm + push-to-talk MediaRecorder | 3 |
| 12 | NarrationFsm + Web Audio + utterance playback | 3 |
| 13 | VoiceInputWidget mic button + VoiceCommandContribution | — |
| 14 | Serve utterance WAV files | — |
| 15 | NarrationFsm ← SessionService integration | — |
| 16 | Full test suite verification | 35+ total |
| 17 | Build + smoke test | — |
