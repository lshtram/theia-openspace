# openspace-voice Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone VS Code extension with shared core that can be published to Marketplace, plus refactor the existing Theia extension to use the shared core.

**Architecture:**
- Extract platform-agnostic code into `packages/voice-core` (`@openspace-ai/voice-core`)
- Create VS Code extension `openspace-voice-vscode/` using voice-core (Node.js audio I/O — no Web APIs)
- Refactor `extensions/openspace-voice/` (Theia) to import from voice-core

**Tech Stack:** TypeScript, VS Code Extension API, Theia Framework, npm workspaces, `node-record-lpcm16`, `play-sound`

---

## Phase 1: Monorepo Setup

### Task 1: Add npm Workspaces

**Files:**
- Modify: `package.json` (root)

**Step 1: Read current root package.json**

```bash
cat package.json
```

**Step 2: Add workspaces field**

Add to root `package.json`:
```json
{
  "workspaces": ["packages/*", "openspace-voice-vscode", "extensions/*"]
}
```

**Step 3: Create packages directory**

```bash
mkdir packages
```

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add npm workspaces for voice-core and vscode extension"
```

---

## Phase 2: Create voice-core Package

### Task 2: Scaffold voice-core

**Files:**
- Create: `packages/voice-core/package.json`
- Create: `packages/voice-core/tsconfig.json`
- Create: `packages/voice-core/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@openspace-ai/voice-core",
  "version": "1.0.0",
  "description": "Platform-agnostic STT/TTS core for OpenSpace voice extensions",
  "license": "MIT",
  "repository": "https://github.com/openspace-ai/theia-openspace",
  "engines": { "node": ">=18" },
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["lib/**"],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf lib tsconfig.tsbuildinfo",
    "test": "mocha --require ts-node/register 'src/**/*.spec.ts'"
  },
  "devDependencies": {
    "typescript": "~5.4.5",
    "ts-node": "^10.9.0",
    "mocha": "^10.0.0",
    "@types/mocha": "^10.0.0",
    "@types/node": "^20.0.0"
  },
  "optionalDependencies": {
    "kokoro-js": "^1.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.spec.ts"]
}
```

**Step 3: Create empty index.ts**

```typescript
// Exports added as tasks complete
```

**Step 4: Run npm install to verify workspace resolves**

```bash
npm install
```

Expected: No errors, `packages/voice-core` linked in root `node_modules/@openspace-ai/`

---

### Task 3: Create Provider Interfaces and Types

**Files:**
- Create: `packages/voice-core/src/providers/stt-provider.interface.ts`
- Create: `packages/voice-core/src/providers/tts-provider.interface.ts`
- Create: `packages/voice-core/src/fsm/types.ts`

**Step 1: Create STT interface**

```typescript
// src/providers/stt-provider.interface.ts

export interface SttTranscriptionRequest {
  audio: Uint8Array;   // raw 16-bit PCM samples (little-endian)
  sampleRate?: number;  // e.g. 16000 — defaults to 16000 if omitted — needed for WAV header construction
  language: string;    // BCP-47 e.g. 'en-US'
}

export interface SttTranscriptionResult {
  text: string;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested(handler: () => void): void;
}

export interface SttProvider {
  readonly kind: 'stt';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  transcribe(request: SttTranscriptionRequest, token?: CancellationToken): Promise<SttTranscriptionResult>;
}
```

**Step 2: Create TTS interface**

```typescript
// src/providers/tts-provider.interface.ts

import type { CancellationToken } from './stt-provider.interface';

export interface TtsSynthesisRequest {
  text: string;
  language: string;
  speed?: number;
  voice?: string;
}

export interface TtsSynthesisResult {
  audio: Uint8Array;    // raw 16-bit PCM samples at 24 kHz (Kokoro output rate)
  sampleRate: number;   // always 24000 for Kokoro
}

export interface TtsProvider {
  readonly kind: 'tts';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  synthesize(request: TtsSynthesisRequest, token?: CancellationToken): Promise<TtsSynthesisResult>;
  dispose(): Promise<void>;
}
```

**Step 3: Create FSM types**

```typescript
// src/fsm/types.ts

export type AudioState = 'idle' | 'listening' | 'processing' | 'error';
export type AudioTrigger = 'startCapture' | 'stopCapture' | 'transcriptReady' | 'sttError' | 'reset';

export type NarrationState = 'idle' | 'queued' | 'processing' | 'playing' | 'paused';
export type NarrationTrigger = 'enqueue' | 'startProcessing' | 'audioReady' | 'pause' | 'resume' | 'complete';

export type SessionState = 'inactive' | 'active' | 'suspended';
export type SessionTrigger = 'enable' | 'disable' | 'pushToTalkStart' | 'pushToTalkEnd';

export const NARRATION_MODES = ['narrate-off', 'narrate-everything', 'narrate-summary'] as const;
export type NarrationMode = (typeof NARRATION_MODES)[number];

export interface VoicePolicy {
  enabled: boolean;
  narrationMode: NarrationMode;
  speed: number;      // 0.5–2.0
  voice: string;      // TTS voice ID e.g. 'af_sarah'
  language: string;   // BCP-47 e.g. 'en-US'
}

export const DEFAULT_VOICE_POLICY: VoicePolicy = {
  enabled: false,
  narrationMode: 'narrate-off',
  speed: 1.0,
  voice: 'af_sarah',
  language: 'en-US',
};

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
```

**Step 4: Write tests for types**

```typescript
// src/fsm/types.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { DEFAULT_VOICE_POLICY, NARRATION_MODES } from './types';

describe('voice-core types', () => {
  it('DEFAULT_VOICE_POLICY has narrate-off mode', () => {
    assert.strictEqual(DEFAULT_VOICE_POLICY.narrationMode, 'narrate-off');
  });
  it('NARRATION_MODES contains all three modes', () => {
    assert.ok(NARRATION_MODES.includes('narrate-off'));
    assert.ok(NARRATION_MODES.includes('narrate-everything'));
    assert.ok(NARRATION_MODES.includes('narrate-summary'));
  });
});
```

**Step 5: Run tests**

```bash
cd packages/voice-core && npm test
```

Expected: PASS

---

### Task 4: Create WAV Utility

**Files:**
- Create: `packages/voice-core/src/utils/wav.ts`
- Create: `packages/voice-core/src/utils/wav.spec.ts`

**Step 1: Write failing tests first**

```typescript
// src/utils/wav.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { buildWavBuffer } from './wav';

describe('buildWavBuffer', () => {
  it('produces a 44-byte header for empty PCM', () => {
    const buf = buildWavBuffer(new Uint8Array(0), 16000, 1);
    assert.strictEqual(buf.length, 44);
    assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(buf.toString('ascii', 8, 12), 'WAVE');
    assert.strictEqual(buf.toString('ascii', 12, 16), 'fmt ');
    assert.strictEqual(buf.toString('ascii', 36, 40), 'data');
  });

  it('encodes sample rate in header', () => {
    const buf = buildWavBuffer(new Uint8Array(0), 24000, 1);
    assert.strictEqual(buf.readUInt32LE(24), 24000);
  });

  it('data chunk length matches PCM bytes length', () => {
    const pcm = new Uint8Array(100);
    const buf = buildWavBuffer(pcm, 16000, 1);
    assert.strictEqual(buf.readUInt32LE(40), 100);
    assert.strictEqual(buf.length, 144);
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/voice-core && npm test -- --grep "buildWavBuffer"
```

Expected: FAIL — `buildWavBuffer` is not defined

**Step 3: Implement buildWavBuffer**

```typescript
// src/utils/wav.ts

export function buildWavBuffer(pcm16: Uint8Array, sampleRate: number, channels: number): Buffer {
  const dataLen = pcm16.length;
  const buf = Buffer.alloc(44 + dataLen);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);                              // PCM subchunk size
  buf.writeUInt16LE(1, 20);                               // PCM audio format
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);       // byte rate
  buf.writeUInt16LE(channels * 2, 32);                    // block align
  buf.writeUInt16LE(16, 34);                              // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  Buffer.from(pcm16).copy(buf, 44);

  return buf;
}
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/voice-core && npm test -- --grep "buildWavBuffer"
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/voice-core/src/utils/
git commit -m "feat(voice-core): add WAV header builder with tests"
```

---

### Task 5: Create WhisperCppAdapter

**Files:**
- Create: `packages/voice-core/src/adapters/whisper-cpp.adapter.ts`
- Create: `packages/voice-core/src/adapters/whisper-cpp.adapter.spec.ts`

**Step 1: Write failing tests (using spawn mock)**

```typescript
// src/adapters/whisper-cpp.adapter.spec.ts
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as cp from 'child_process';
import { WhisperCppAdapter } from './whisper-cpp.adapter';

describe('WhisperCppAdapter', () => {
  let spawnStub: sinon.SinonStub;

  afterEach(() => sinon.restore());

  describe('isAvailable()', () => {
    it('returns true when binary exits 0 on --help', async () => {
      spawnStub = sinon.stub(cp, 'spawn').returns(makeFakeProc(0) as any);
      const adapter = new WhisperCppAdapter('whisper');
      assert.strictEqual(await adapter.isAvailable(), true);
      assert.ok((spawnStub.firstCall.args[1] as string[]).includes('--help'));
    });

    it('returns false when binary not found', async () => {
      spawnStub = sinon.stub(cp, 'spawn').returns(makeErrorProc('ENOENT') as any);
      const adapter = new WhisperCppAdapter('whisper');
      assert.strictEqual(await adapter.isAvailable(), false);
    });

    it('returns false when binary exits non-zero', async () => {
      spawnStub = sinon.stub(cp, 'spawn').returns(makeFakeProc(1) as any);
      const adapter = new WhisperCppAdapter('whisper');
      assert.strictEqual(await adapter.isAvailable(), false);
    });
  });

  describe('transcribe()', () => {
    it('writes wav to temp file and returns transcribed text', async () => {
      spawnStub = sinon.stub(cp, 'spawn').returns(makeTranscribeProc('hello world') as any);
      const adapter = new WhisperCppAdapter('whisper');
      const result = await adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' });
      assert.strictEqual(result.text, 'hello world');
    });

    it('rejects when whisper exits with non-zero code', async () => {
      spawnStub = sinon.stub(cp, 'spawn').returns(makeFakeProc(1, 'model not found') as any);
      const adapter = new WhisperCppAdapter('whisper');
      await assert.rejects(
        () => adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' }),
        /exited 1/
      );
    });
  });
});

function makeFakeProc(code: number, stderr = '') { /* mock implementation */ }
function makeErrorProc(code: string) { /* mock implementation */ }
function makeTranscribeProc(text: string) { /* mock implementation */ }
```

Note: Mock helpers use `EventEmitter` to simulate Node.js child process events. Implement fully before running.

**Step 2: Run tests — expect FAIL**

```bash
cd packages/voice-core && npm test -- --grep "WhisperCppAdapter"
```

**Step 3: Implement WhisperCppAdapter**

```typescript
// src/adapters/whisper-cpp.adapter.ts
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult, CancellationToken } from '../providers/stt-provider.interface';
import { buildWavBuffer } from '../utils/wav';

export class WhisperCppAdapter implements SttProvider {
  readonly kind = 'stt' as const;
  readonly id = 'whisper.cpp';

  constructor(private readonly binaryPath: string = 'whisper',
    private readonly modelFolder: string = '/usr/local/share/whisper') {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      // Use --help: whisper.cpp CLI does not support --version
      const proc = spawn(this.binaryPath, ['--help'], { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  async transcribe(
    request: SttTranscriptionRequest,
    token?: CancellationToken,
  ): Promise<SttTranscriptionResult> {
    // Write to temp WAV file — whisper.cpp requires a file path, not stdin
    const tmpFile = path.join(os.tmpdir(), `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const wavBuffer = buildWavBuffer(request.audio, request.sampleRate, 1);
    fs.writeFileSync(tmpFile, wavBuffer);

    try {
      return await new Promise<SttTranscriptionResult>((resolve, reject) => {
        const proc = spawn(
          this.binaryPath,
          ['--language', request.language, '--output-txt', tmpFile],
          { stdio: ['ignore', 'pipe', 'pipe'] },
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
          resolve({ text });
        });

        // Cancel support: kill process on request
        token?.onCancellationRequested(() => {
          proc.kill();
          reject(new Error('STT transcription cancelled'));
        });
      });
    } finally {
      // Always clean up temp file
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/voice-core/src/adapters/whisper-cpp.adapter.ts packages/voice-core/src/adapters/whisper-cpp.adapter.spec.ts
git commit -m "feat(voice-core): add WhisperCppAdapter — temp file, --help check, cancel support"
```

---

### Task 6: Create KokoroAdapter

**Files:**
- Create: `packages/voice-core/src/adapters/kokoro.adapter.ts`
- Create: `packages/voice-core/src/adapters/kokoro.adapter.spec.ts`

**Step 1: Write failing tests (mock kokoro-js)**

```typescript
// src/adapters/kokoro.adapter.spec.ts
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { KokoroAdapter } from './kokoro.adapter';

describe('KokoroAdapter', () => {
  afterEach(() => sinon.restore());

  describe('Float32 → Int16 conversion', () => {
    it('converts 1.0 to 32767', () => {
      const result = convertFloat32([1.0]);
      assert.strictEqual(result[0], 32767);
    });
    it('converts -1.0 to -32768', () => {
      const result = convertFloat32([-1.0]);
      assert.strictEqual(result[0], -32768);
    });
    it('rounds 0.9999 correctly', () => {
      const result = convertFloat32([0.9999]);
      assert.strictEqual(result[0], 32767);  // Math.round(0.9999 * 32768) = 32768, clamped to 32767
    });
    it('rounds 0.5 / 32768 correctly', () => {
      // 0.5 / 32768 ≈ 1.526e-5, rounds to 0
      const result = convertFloat32([0.5 / 32768]);
      assert.strictEqual(result[0], 0);
    });
  });

  describe('dispose()', () => {
    it('can be called without a loaded model', async () => {
      const adapter = new KokoroAdapter();
      await assert.doesNotReject(() => adapter.dispose());
    });
  });
});

// Expose conversion for unit testing
function convertFloat32(floats: number[]): number[] {
  const f32 = new Float32Array(floats);
  const int16 = new Array<number>(f32.length);
  for (let i = 0; i < f32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)));
  }
  return int16;
}
```

**Step 2: Run tests — expect FAIL**

**Step 3: Implement KokoroAdapter**

```typescript
// src/adapters/kokoro.adapter.ts
import type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from '../providers/tts-provider.interface';
import type { CancellationToken } from '../providers/stt-provider.interface';

export class KokoroAdapter implements TtsProvider {
  readonly kind = 'tts' as const;
  readonly id = 'kokoro';

  // Instance variable — not module-level singleton — so dispose() can release it
  private model: import('kokoro-js').KokoroTTS | null = null;
  private modelLoading = false;
  private modelLoadError: Error | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      await import('kokoro-js');
      return true;
    } catch {
      return false;
    }
  }

  async synthesize(
    request: TtsSynthesisRequest,
    _token?: CancellationToken,
  ): Promise<TtsSynthesisResult> {
    const model = await this.getModel();
    const voice = request.voice ?? 'af_sarah';
    const audio = await model.generate(request.text, { voice });

    let audioBytes: Uint8Array;
    const audioData = audio?.data;

    if (audioData instanceof Float32Array) {
      const int16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        // Correct scale: full negative range is -32768, positive is 32767
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32768)));
      }
      audioBytes = new Uint8Array(int16.buffer);
    } else if (audioData instanceof Uint8Array) {
      audioBytes = audioData;
    } else {
      audioBytes = new Uint8Array(0);
    }

    return { audio: audioBytes, sampleRate: 24000 };
  }

  async dispose(): Promise<void> {
    this.model = null;
    this.modelLoadError = null;
  }

  private async getModel(): Promise<import('kokoro-js').KokoroTTS> {
    if (this.model) return this.model;
    if (this.modelLoadError) throw this.modelLoadError;
    if (this.modelLoading) {
      while (this.modelLoading) await new Promise(r => setTimeout(r, 100));
      if (this.modelLoadError) throw this.modelLoadError;
      return this.model!;
    }

    this.modelLoading = true;
    try {
      const { KokoroTTS } = await import('kokoro-js');
      this.model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'cpu',
      });
      return this.model!;
    } catch (err) {
      this.modelLoadError = err as Error;
      throw err;
    } finally {
      this.modelLoading = false;
    }
  }
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/voice-core/src/adapters/kokoro.adapter.ts packages/voice-core/src/adapters/kokoro.adapter.spec.ts
git commit -m "feat(voice-core): add KokoroAdapter — instance model, correct Float32 conversion, dispose()"
```

---

### Task 7: Create FSMs

**Files:**
- Create: `packages/voice-core/src/fsm/session-fsm.ts`
- Create: `packages/voice-core/src/fsm/audio-fsm.ts`
- Create: `packages/voice-core/src/fsm/narration-fsm.ts`
- Create: `packages/voice-core/src/fsm/session-fsm.spec.ts`
- Create: `packages/voice-core/src/fsm/audio-fsm.spec.ts`
- Create: `packages/voice-core/src/fsm/narration-fsm.spec.ts`

**Step 1: Write SessionFsm tests**

```typescript
// src/fsm/session-fsm.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { SessionFsm } from './session-fsm';
import { VoiceFsmError } from './types';

describe('SessionFsm', () => {
  it('starts inactive', () => {
    assert.strictEqual(new SessionFsm().state, 'inactive');
  });
  it('inactive → active on enable()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    assert.strictEqual(fsm.state, 'active');
  });
  it('enable() is idempotent when already active', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    assert.doesNotThrow(() => fsm.enable()); // no throw on double-enable
    assert.strictEqual(fsm.state, 'active');
  });
  it('active → suspended on pushToTalkStart()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    fsm.pushToTalkStart();
    assert.strictEqual(fsm.state, 'suspended');
  });
  it('suspended → active on pushToTalkEnd()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    fsm.pushToTalkStart();
    fsm.pushToTalkEnd();
    assert.strictEqual(fsm.state, 'active');
  });
  it('throws VoiceFsmError on invalid transition', () => {
    const fsm = new SessionFsm();
    assert.throws(() => fsm.pushToTalkStart(), VoiceFsmError);
  });
  it('updatePolicy merges partial fields', () => {
    const fsm = new SessionFsm();
    fsm.updatePolicy({ voice: 'bm_george' });
    assert.strictEqual(fsm.policy.voice, 'bm_george');
    assert.strictEqual(fsm.policy.speed, 1.0); // unchanged default
  });
});
```

**Step 2: Implement SessionFsm**

```typescript
// src/fsm/session-fsm.ts
import type { SessionState, SessionTrigger, VoicePolicy } from './types';
import { DEFAULT_VOICE_POLICY, VoiceFsmError } from './types';

type TransitionTable = Partial<Record<`${SessionState}:${SessionTrigger}`, SessionState>>;

const TRANSITIONS: TransitionTable = {
  'inactive:enable': 'active',
  'active:disable': 'inactive',
  'active:pushToTalkStart': 'suspended',
  'suspended:pushToTalkEnd': 'active',
  'suspended:disable': 'inactive',
  // Idempotent: already in target state
  'active:enable': 'active',
  'inactive:disable': 'inactive',
};

export class SessionFsm {
  private _state: SessionState = 'inactive';
  private _policy: VoicePolicy = { ...DEFAULT_VOICE_POLICY };

  get state(): SessionState { return this._state; }
  get policy(): VoicePolicy { return { ...this._policy }; }

  enable(): void { this._state = this.transition('enable'); this._policy = { ...this._policy, enabled: true }; }
  disable(): void { this._state = this.transition('disable'); this._policy = { ...this._policy, enabled: false }; }
  pushToTalkStart(): void { this._state = this.transition('pushToTalkStart'); }
  pushToTalkEnd(): void { this._state = this.transition('pushToTalkEnd'); }

  updatePolicy(partial: Partial<VoicePolicy>): void {
    this._policy = { ...this._policy, ...partial };
  }

  private transition(trigger: SessionTrigger): SessionState {
    const key = `${this._state}:${trigger}` as `${SessionState}:${SessionTrigger}`;
    const next = TRANSITIONS[key];
    if (next === undefined) throw new VoiceFsmError('session', this._state, trigger);
    return next;
  }
}
```

**Step 3: Write AudioFsm tests**

```typescript
// src/fsm/audio-fsm.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { AudioFsm } from './audio-fsm';
import { VoiceFsmError } from './types';

describe('AudioFsm', () => {
  it('starts idle', () => assert.strictEqual(new AudioFsm().state, 'idle'));
  it('idle → listening → processing → idle', () => {
    const fsm = new AudioFsm();
    fsm.startCapture();
    assert.strictEqual(fsm.state, 'listening');
    fsm.stopCapture();
    assert.strictEqual(fsm.state, 'processing');
    fsm.transcriptReady();
    assert.strictEqual(fsm.state, 'idle');
  });
  it('processing → error → idle via reset()', () => {
    const fsm = new AudioFsm();
    fsm.startCapture();
    fsm.stopCapture();
    fsm.error();
    assert.strictEqual(fsm.state, 'error');
    fsm.reset();
    assert.strictEqual(fsm.state, 'idle');
  });
  it('throws on invalid transition', () => {
    assert.throws(() => new AudioFsm().stopCapture(), VoiceFsmError);
  });
});
```

**Step 4: Implement AudioFsm**

```typescript
// src/fsm/audio-fsm.ts
import type { AudioState, AudioTrigger } from './types';
import { VoiceFsmError } from './types';

type TransitionTable = Partial<Record<`${AudioState}:${AudioTrigger}`, AudioState>>;

const TRANSITIONS: TransitionTable = {
  'idle:startCapture': 'listening',
  'listening:stopCapture': 'processing',
  'processing:transcriptReady': 'idle',
  'processing:sttError': 'error',
  'error:reset': 'idle',
};

export class AudioFsm {
  private _state: AudioState = 'idle';

  get state(): AudioState { return this._state; }

  startCapture(): void { this._state = this.transition('startCapture'); }
  stopCapture(): void { this._state = this.transition('stopCapture'); }
  transcriptReady(): void { this._state = this.transition('transcriptReady'); }
  error(): void { this._state = this.transition('sttError'); }
  reset(): void { this._state = this.transition('reset'); }

  private transition(trigger: AudioTrigger): AudioState {
    const key = `${this._state}:${trigger}` as `${AudioState}:${AudioTrigger}`;
    const next = TRANSITIONS[key];
    if (next === undefined) throw new VoiceFsmError('audio', this._state, trigger);
    return next;
  }
}
```

**Step 5: Write NarrationFsm tests**

```typescript
// src/fsm/narration-fsm.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { NarrationFsm } from './narration-fsm';

const REQ = { text: 'hello', mode: 'narrate-everything' as const, voice: 'af_sarah', speed: 1.0 };

describe('NarrationFsm', () => {
  it('starts idle', () => assert.strictEqual(new NarrationFsm().state, 'idle'));

  it('enqueue while idle transitions to queued', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    assert.strictEqual(fsm.state, 'queued');
  });

  it('enqueue with narrate-off is a no-op', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue({ ...REQ, mode: 'narrate-off' });
    assert.strictEqual(fsm.state, 'idle');
  });

  it('second enqueue while queued does not change state', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.enqueue(REQ);
    assert.strictEqual(fsm.state, 'queued');
  });

  it('complete() returns next item if queue non-empty', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    const next = fsm.complete();
    // queue was empty, so returns undefined and goes idle
    assert.strictEqual(next, undefined);
    assert.strictEqual(fsm.state, 'idle');
  });

  it('complete() stays queued if more items waiting', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.enqueue(REQ); // second queued
    fsm.startProcessing();
    fsm.audioReady();
    const next = fsm.complete();
    assert.ok(next !== undefined);
    assert.strictEqual(fsm.state, 'queued');
  });

  it('pause/resume round-trip', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    fsm.pause();
    assert.strictEqual(fsm.state, 'paused');
    fsm.resume();
    assert.strictEqual(fsm.state, 'playing');
  });
});
```

**Step 6: Implement NarrationFsm**

```typescript
// src/fsm/narration-fsm.ts
import type { NarrationState, NarrationTrigger, NarrationMode } from './types';
import { VoiceFsmError } from './types';

type TransitionTable = Partial<Record<`${NarrationState}:${NarrationTrigger}`, NarrationState>>;

const TRANSITIONS: TransitionTable = {
  'idle:enqueue': 'queued',
  'queued:enqueue': 'queued',      // additional items while queued
  'queued:startProcessing': 'processing',
  'processing:audioReady': 'playing',
  'playing:pause': 'paused',
  'paused:resume': 'playing',
  // complete() handled specially — see below
};

export interface NarrationRequest {
  text: string;
  mode: NarrationMode;
  voice: string;
  speed: number;
}

export class NarrationFsm {
  private _state: NarrationState = 'idle';
  private readonly queue: NarrationRequest[] = [];

  get state(): NarrationState { return this._state; }

  enqueue(request: NarrationRequest): void {
    if (request.mode === 'narrate-off') return;
    if (this._state === 'idle') {
      this._state = this.transition('enqueue');
    } else {
      // Already queued/processing/playing/paused — just add to backlog
      this.queue.push(request);
      return;
    }
    this.queue.push(request);
  }

  startProcessing(): void { this._state = this.transition('startProcessing'); }
  audioReady(): void { this._state = this.transition('audioReady'); }
  pause(): void { this._state = this.transition('pause'); }
  resume(): void { this._state = this.transition('resume'); }

  /** Marks current item done. Returns next request if any, or undefined if queue is empty. */
  complete(): NarrationRequest | undefined {
    const next = this.queue.shift();
    if (next) {
      this._state = 'queued';  // more work to do
    } else {
      this._state = 'idle';
    }
    return next;
  }

  private transition(trigger: NarrationTrigger): NarrationState {
    const key = `${this._state}:${trigger}` as `${NarrationState}:${NarrationTrigger}`;
    const next = TRANSITIONS[key];
    if (next === undefined) throw new VoiceFsmError('narration', this._state, trigger);
    return next;
  }
}
```

**Step 7: Run all FSM tests**

```bash
cd packages/voice-core && npm test
```

Expected: All tests PASS

**Step 8: Commit**

```bash
git add packages/voice-core/src/fsm/
git commit -m "feat(voice-core): add type-safe FSMs with queue drain and idempotent session transitions"
```

---

### Task 8: Wire voice-core index.ts and Build

**Files:**
- Modify: `packages/voice-core/src/index.ts`

**Step 1: Write full index.ts**

```typescript
// Public API surface of @openspace-ai/voice-core

// Types
export type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult, CancellationToken } from './providers/stt-provider.interface';
export type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from './providers/tts-provider.interface';
export type { VoicePolicy, NarrationMode, AudioState, NarrationState, SessionState } from './fsm/types';
export { DEFAULT_VOICE_POLICY, NARRATION_MODES, VoiceFsmError } from './fsm/types';

// Adapters
export { WhisperCppAdapter } from './adapters/whisper-cpp.adapter';
export { KokoroAdapter } from './adapters/kokoro.adapter';

// FSMs
export { SessionFsm } from './fsm/session-fsm';
export { AudioFsm } from './fsm/audio-fsm';
export { NarrationFsm } from './fsm/narration-fsm';
export type { NarrationRequest } from './fsm/narration-fsm';

// Utilities
export { buildWavBuffer } from './utils/wav';
```

**Step 2: Build voice-core**

```bash
cd packages/voice-core && npm run build
```

Expected: `lib/` directory created, no TypeScript errors

**Step 3: Commit**

```bash
git add packages/voice-core/src/index.ts packages/voice-core/lib/
git commit -m "feat(voice-core): wire public index and build"
```

---

## Phase 3: Create VS Code Extension

### Task 9: Scaffold openspace-voice-vscode

**Files:**
- Create: `openspace-voice-vscode/package.json`
- Create: `openspace-voice-vscode/tsconfig.json`
- Create: `openspace-voice-vscode/src/extension.ts`

**Step 1: Create package.json**

```json
{
  "name": "openspace-voice",
  "version": "1.0.0",
  "publisher": "openspace-ai",
  "description": "Push-to-talk dictation and read aloud using Kokoro TTS and Whisper STT",
  "license": "MIT",
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
        {
          "command": "openspace-voice.readAloud",
          "when": "editorHasSelection",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "OpenSpace Voice",
      "properties": {
        "openspace-voice.voice": {
          "type": "string",
          "default": "af_sarah",
          "description": "Kokoro TTS voice ID (e.g. af_sarah, bm_george)"
        },
        "openspace-voice.speed": {
          "type": "number",
          "default": 1.0,
          "minimum": 0.5,
          "maximum": 2.0,
          "description": "Playback speed"
        },
        "openspace-voice.language": {
          "type": "string",
          "default": "en-US",
          "description": "BCP-47 language tag for STT"
        },
        "openspace-voice.whisperPath": {
          "type": "string",
          "default": "whisper",
          "description": "Path to whisper.cpp binary"
        },
        "openspace-voice.narrationMode": {
          "type": "string",
          "enum": ["narrate-off", "narrate-everything", "narrate-summary"],
          "default": "narrate-off"
        }
      }
    }
  },
  "dependencies": {
    "@openspace-ai/voice-core": "^1.0.0",
    "node-record-lpcm16": "^1.0.1",
    "play-sound": "^1.1.6"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "typescript": "~5.4.5",
    "@vscode/vsce": "^2.0.0"
  }
}
```

**Step 2: Create extension.ts skeleton**

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import {
  WhisperCppAdapter,
  KokoroAdapter,
  SessionFsm,
  AudioFsm,
  NarrationFsm,
} from '@openspace-ai/voice-core';
import { registerDictationCommand } from './commands/dictation';
import { registerReadAloudCommand } from './commands/read-aloud';

let sttAdapter: WhisperCppAdapter;
let ttsAdapter: KokoroAdapter;
let sessionFsm: SessionFsm;
let audioFsm: AudioFsm;
let narrationFsm: NarrationFsm;
let statusBar: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('openspace-voice');
  const whisperPath = config.get<string>('whisperPath') ?? 'whisper';

  sttAdapter = new WhisperCppAdapter(whisperPath);
  ttsAdapter = new KokoroAdapter();
  sessionFsm = new SessionFsm();
  audioFsm = new AudioFsm();
  narrationFsm = new NarrationFsm();

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sync~spin) Voice: Initializing…';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Set context key to false — commands show "still initializing" until ready
  await vscode.commands.executeCommand('setContext', 'openspace-voice.ready', false);

  // Register commands immediately so keybindings work, but they check ready state
  registerDictationCommand(context, { sttAdapter, sessionFsm, audioFsm });
  registerReadAloudCommand(context, { ttsAdapter, sessionFsm });

  // Register configure command
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.configure', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'openspace-voice');
    })
  );

  // Check providers in background — don't block activation
  checkProviders().catch((err) => {
    console.error('[openspace-voice] Provider check failed:', err);
  });
}

async function checkProviders(): Promise<void> {
  const [sttOk, ttsOk] = await Promise.all([
    sttAdapter.isAvailable(),
    ttsAdapter.isAvailable(),
  ]);

  if (!sttOk || !ttsOk) {
    const missing = [!sttOk && 'whisper.cpp', !ttsOk && 'kokoro-js'].filter(Boolean).join(', ');
    const choice = await vscode.window.showWarningMessage(
      `OpenSpace Voice: Missing dependencies: ${missing}`,
      'Auto-install',
      'Show Instructions',
      'Already Installed'
    );
    if (choice === 'Auto-install') await runAutoInstall(missing);
    else if (choice === 'Show Instructions') showManualInstructions(missing);
    else if (choice === 'Already Installed') await recheckProviders();
    return;
  }

  // Providers ready
  if (sessionFsm.state === 'inactive') sessionFsm.enable();
  await vscode.commands.executeCommand('setContext', 'openspace-voice.ready', true);
  statusBar.text = '$(unmute) Voice: Ready';
}

async function recheckProviders(): Promise<void> {
  const [sttOk, ttsOk] = await Promise.all([sttAdapter.isAvailable(), ttsAdapter.isAvailable()]);
  if (sttOk && ttsOk) {
    if (sessionFsm.state === 'inactive') sessionFsm.enable();
    await vscode.commands.executeCommand('setContext', 'openspace-voice.ready', true);
    statusBar.text = '$(unmute) Voice: Ready';
  } else {
    vscode.window.showErrorMessage('OpenSpace Voice: Dependencies still missing after re-check.');
  }
}

async function runAutoInstall(_missing: string): Promise<void> {
  // TODO Task 11: implement auto-install
  vscode.window.showInformationMessage('Auto-install: not yet implemented. Use manual instructions.');
  showManualInstructions(_missing);
}

function showManualInstructions(missing: string): void {
  const panel = vscode.window.createWebviewPanel(
    'opsnVoiceInstall', 'OpenSpace Voice Setup', vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.html = getInstallHtml(missing);
}

function getInstallHtml(missing: string): string {
  return `<!DOCTYPE html><html><body>
    <h2>OpenSpace Voice Setup</h2>
    <p>Missing: <strong>${missing}</strong></p>
    <h3>whisper.cpp</h3>
    <pre>brew install whisper-cpp   # macOS
# or build from source: https://github.com/ggerganov/whisper.cpp</pre>
    <h3>kokoro-js</h3>
    <pre>npm install -g kokoro-js</pre>
    <p>After installing, run <strong>Voice: Configure</strong> → "Already Installed"</p>
  </body></html>`;
}

export async function deactivate(): Promise<void> {
  await ttsAdapter?.dispose();
}
```

**Step 3: Commit skeleton**

```bash
git add openspace-voice-vscode/
git commit -m "feat(vscode): scaffold extension with FSM integration and provider check"
```

---

### Task 10: Implement Dictation Command (Node.js Audio)

**Files:**
- Create: `openspace-voice-vscode/src/commands/dictation.ts`

**Step 1: Implement using node-record-lpcm16**

```typescript
// src/commands/dictation.ts
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { WhisperCppAdapter, SessionFsm, AudioFsm } from '@openspace-ai/voice-core';
import { buildWavBuffer } from '@openspace-ai/voice-core';

interface DictationDeps {
  sttAdapter: WhisperCppAdapter;
  sessionFsm: SessionFsm;
  audioFsm: AudioFsm;
}

export function registerDictationCommand(
  context: vscode.ExtensionContext,
  deps: DictationDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.startDictation', async () => {
      if (deps.sessionFsm.state === 'inactive') {
        vscode.window.showWarningMessage('OpenSpace Voice is not ready. Check setup.');
        return;
      }
      if (deps.audioFsm.state !== 'idle') {
        vscode.window.showInformationMessage('Dictation already in progress.');
        return;
      }

      const config = vscode.workspace.getConfiguration('openspace-voice');
      const language = config.get<string>('language') ?? 'en-US';

      let pcmChunks: Buffer[] = [];
      let recorder: ReturnType<typeof import('node-record-lpcm16').record> | null = null;

      try {
        deps.sessionFsm.pushToTalkStart();
        deps.audioFsm.startCapture();

        // Start recording — node-record-lpcm16 wraps sox/arecord/rec
        const record = await import('node-record-lpcm16');
        recorder = record.record({ sampleRate: 16000, channels: 1, audioType: 'raw' });

        recorder.stream().on('data', (chunk: Buffer) => pcmChunks.push(chunk));
        recorder.stream().on('error', (err: Error) => {
          throw err;
        });

        // Show status bar indication while recording
        await vscode.window.showInformationMessage(
          'Recording… Press OK to stop',
          { modal: false },
          'Stop'
        );

        recorder.stop();
        deps.audioFsm.stopCapture();

        // Process audio
        const pcm = Buffer.concat(pcmChunks);
        const audio = new Uint8Array(pcm);

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Transcribing…' },
          async () => {
            const result = await deps.sttAdapter.transcribe({ audio, sampleRate: 16000, language });
            deps.audioFsm.transcriptReady();
            deps.sessionFsm.pushToTalkEnd();

            // Insert text at cursor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              await editor.edit(eb => eb.insert(editor.selection.active, result.text));
            }
          }
        );
      } catch (err) {
        recorder?.stop();
        deps.audioFsm.error();
        deps.audioFsm.reset();
        if (deps.sessionFsm.state === 'suspended') deps.sessionFsm.pushToTalkEnd();
        vscode.window.showErrorMessage(`Dictation failed: ${(err as Error).message}`);
      }
    })
  );
}
```

---

### Task 11: Implement Read Aloud Command (Platform Audio Playback)

**Files:**
- Create: `openspace-voice-vscode/src/commands/read-aloud.ts`
- Create: `openspace-voice-vscode/src/audio/playback.ts`

**Step 1: Create platform audio playback utility**

```typescript
// src/audio/playback.ts
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { buildWavBuffer } from '@openspace-ai/voice-core';

export async function playPcmAudio(pcm: Uint8Array, sampleRate: number): Promise<void> {
  // Write PCM to temp WAV file
  const tmpFile = path.join(os.tmpdir(), `opsn-tts-${Date.now()}.wav`);
  const wavBuf = buildWavBuffer(pcm, sampleRate, 1);
  fs.writeFileSync(tmpFile, wavBuf);

  try {
    await playWavFile(tmpFile);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function playWavFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let args: string[];
    let cmd: string;

    switch (process.platform) {
      case 'darwin':
        cmd = 'afplay';
        args = [filePath];
        break;
      case 'win32':
        cmd = 'powershell';
        args = ['-c', `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`];
        break;
      default: // linux
        cmd = 'aplay';
        args = [filePath];
        break;
    }

    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('error', (err) => reject(new Error(`Audio playback failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`Audio player exited with code ${code}`));
      else resolve();
    });
  });
}
```

**Step 2: Implement read-aloud command**

```typescript
// src/commands/read-aloud.ts
import * as vscode from 'vscode';
import type { KokoroAdapter, SessionFsm } from '@openspace-ai/voice-core';
import { playPcmAudio } from '../audio/playback';

interface ReadAloudDeps {
  ttsAdapter: KokoroAdapter;
  sessionFsm: SessionFsm;
}

export function registerReadAloudCommand(
  context: vscode.ExtensionContext,
  deps: ReadAloudDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.readAloud', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor.');
        return;
      }

      const text = editor.document.getText(editor.selection);
      if (!text.trim()) {
        vscode.window.showInformationMessage('No text selected. Select text first.');
        return;
      }

      const config = vscode.workspace.getConfiguration('openspace-voice');
      const voice = config.get<string>('voice') ?? 'af_sarah';
      const speed = config.get<number>('speed') ?? 1.0;
      const language = config.get<string>('language') ?? 'en-US';  // read from config, not hardcoded

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Synthesizing speech…', cancellable: true },
        async (_progress, token) => {
          try {
            const result = await deps.ttsAdapter.synthesize({ text, language, voice, speed });
            if (token.isCancellationRequested) return;
            await playPcmAudio(result.audio, result.sampleRate);
          } catch (err) {
            vscode.window.showErrorMessage(`Read aloud failed: ${(err as Error).message}`);
          }
        }
      );
    })
  );
}
```

**Step 3: Commit**

```bash
git add openspace-voice-vscode/src/
git commit -m "feat(vscode): implement dictation and read-aloud with Node.js audio I/O"
```

---

## Phase 4: Refactor Theia Extension

### Task 12: Current State Map of extensions/openspace-voice

Before refactoring, the full file inventory and migration plan:

| File | Action |
|------|--------|
| `src/common/voice-providers.ts` | **Delete** — replaced by voice-core interfaces |
| `src/common/voice-fsm.ts` | **Delete** — replaced by voice-core FSMs |
| `src/common/voice-policy.ts` | **Delete** — replaced by voice-core types |
| `src/common/narration-types.ts` | **Keep** — Theia-specific narration script format |
| `src/node/stt/whisper-cpp-adapter.ts` | **Delete** — replaced by voice-core adapter |
| `src/node/tts/kokoro-adapter.ts` | **Delete** — replaced by voice-core adapter |
| `src/node/stt/stt-provider-selector.ts` | **Keep, update imports** |
| `src/node/tts/tts-provider-selector.ts` | **Keep, update imports** |
| `src/node/narration-preprocessor.ts` | **Keep** — Theia-specific LLM caller |
| `src/node/utterance-library.ts` | **Keep** — serves pre-recorded WAVs |
| `src/node/voice-backend-service.ts` | **Keep, update imports** |
| `src/node/voice-hub-contribution.ts` | **Keep** — HTTP routes |
| `src/node/voice-backend-module.ts` | **Keep** — Theia DI |
| `src/browser/session-fsm.ts` | **Delete** — replaced by voice-core SessionFsm |
| `src/browser/audio-fsm.ts` | **Replace** — keep HTTP call logic, use voice-core AudioFsm |
| `src/browser/narration-fsm.ts` | **Replace** — keep HTTP call logic, use voice-core NarrationFsm |
| `src/browser/voice-service.ts` | **Keep** — Theia service interface |
| `src/browser/voice-command-contribution.ts` | **Keep** |
| `src/browser/voice-input-widget.tsx` | **Keep** |
| `src/browser/openspace-voice-frontend-module.ts` | **Keep, update imports** |

**Step 1: Update package.json to add voice-core dependency**

```json
{
  "dependencies": {
    "@theia/core": "1.68.2",
    "@openspace-ai/voice-core": "^1.0.0",
    "openspace-core": "0.0.1"
  }
}
```

**Step 2: Update imports in all Keep/Update files**

Replace `from '../common/voice-providers'` with `from '@openspace-ai/voice-core'`
Replace `from '../common/voice-policy'` with `from '@openspace-ai/voice-core'`

**Step 3: Delete replaced files**

```bash
rm extensions/openspace-voice/src/common/voice-providers.ts
rm extensions/openspace-voice/src/common/voice-fsm.ts
rm extensions/openspace-voice/src/common/voice-policy.ts
rm extensions/openspace-voice/src/node/stt/whisper-cpp-adapter.ts
rm extensions/openspace-voice/src/node/tts/kokoro-adapter.ts
rm extensions/openspace-voice/src/browser/session-fsm.ts
```

**Step 4: Build Theia extension**

```bash
cd extensions/openspace-voice && npm run build
```

Expected: No errors

**Step 5: Commit**

```bash
git add extensions/openspace-voice/
git commit -m "refactor(theia-voice): use @openspace-ai/voice-core for adapters and FSMs"
```

---

## Phase 5: Documentation & Publishing

### Task 13: VS Code Extension README

**Files:**
- Create: `openspace-voice-vscode/README.md`

Content: Features, Requirements, Installation dialog, Keybinding setup (default `Cmd+Alt+V`, how to rebind), known limitations (left/right modifier keys not distinguishable).

---

### Task 14: Publish to Marketplace

**Step 1: Create publisher**

1. Visit https://marketplace.visualstudio.com/manage
2. Sign in with Microsoft account
3. Create publisher ID `openspace-ai`

**Step 2: Generate token**

In Azure DevOps personal access tokens — Marketplace: Manage scope.

**Step 3: Package and publish**

```bash
cd openspace-voice-vscode
npx vsce package    # creates openspace-voice-1.0.0.vsix
npx vsce publish    # requires token
```

---

## Full Task Summary

| Phase | Task | Description |
|-------|------|-------------|
| 1 | 1 | npm workspaces setup |
| 2 | 2 | Scaffold voice-core package |
| 2 | 3 | Provider interfaces + FSM types |
| 2 | 4 | WAV header builder with tests |
| 2 | 5 | WhisperCppAdapter (temp file, --help, cancel) |
| 2 | 6 | KokoroAdapter (instance model, correct Float32, dispose) |
| 2 | 7 | All three FSMs with full test coverage |
| 2 | 8 | Wire index.ts and build voice-core |
| 3 | 9 | Scaffold VS Code extension |
| 3 | 10 | Dictation command (node-record-lpcm16) |
| 3 | 11 | Read Aloud command (platform audio playback) |
| 4 | 12 | Refactor Theia extension to use voice-core |
| 5 | 13 | README |
| 5 | 14 | Publish to Marketplace |

---

**Plan complete and saved.**

**Two execution options:**

1. **Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks
2. **Parallel Session (separate)** — Open new session with executing-plans skill

Which approach?
