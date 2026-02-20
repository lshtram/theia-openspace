// src/adapters/whisper-cpp.adapter.spec.ts
import { describe, it, afterEach } from 'mocha';
import * as assert from 'assert';
import { EventEmitter } from 'events';
import { WhisperCppAdapter, type SpawnFn } from './whisper-cpp.adapter';

describe('WhisperCppAdapter', () => {
  describe('isAvailable()', () => {
    it('returns true when binary exits 0 on --help', async () => {
      let capturedArgs: string[] = [];
      const mockSpawn: SpawnFn = (_cmd, args) => {
        capturedArgs = args;
        return makeFakeProc(0) as any;
      };
      const adapter = new WhisperCppAdapter('whisper', mockSpawn);
      assert.strictEqual(await adapter.isAvailable(), true);
      assert.ok(capturedArgs.includes('--help'));
    });

    it('returns false when binary not found (ENOENT)', async () => {
      const mockSpawn: SpawnFn = () => makeErrorProc('ENOENT') as any;
      const adapter = new WhisperCppAdapter('whisper', mockSpawn);
      assert.strictEqual(await adapter.isAvailable(), false);
    });

    it('returns false when binary exits non-zero', async () => {
      const mockSpawn: SpawnFn = () => makeFakeProc(1) as any;
      const adapter = new WhisperCppAdapter('whisper', mockSpawn);
      assert.strictEqual(await adapter.isAvailable(), false);
    });
  });

  describe('transcribe()', () => {
    it('returns transcribed text from stdout', async () => {
      const mockSpawn: SpawnFn = () => makeTranscribeProc('hello world') as any;
      const adapter = new WhisperCppAdapter('whisper', mockSpawn);
      const result = await adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' });
      assert.strictEqual(result.text, 'hello world');
    });

    it('rejects when whisper exits with non-zero code', async () => {
      const mockSpawn: SpawnFn = () => makeFakeProc(1, 'model not found') as any;
      const adapter = new WhisperCppAdapter('whisper', mockSpawn);
      await assert.rejects(
        () => adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' }),
        /exited 1/
      );
    });
  });
});

// Helper: fake process that exits with a given code
function makeFakeProc(code: number, stderr = '') {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => {};
  setImmediate(() => {
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', code);
  });
  return proc;
}

// Helper: fake process that emits an error (e.g. ENOENT)
function makeErrorProc(code: string) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => {};
  const err = Object.assign(new Error('spawn error'), { code });
  setImmediate(() => proc.emit('error', err));
  return proc;
}

// Helper: fake process that outputs transcription text
function makeTranscribeProc(text: string) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => {};
  setImmediate(() => {
    proc.stdout.emit('data', Buffer.from(text));
    proc.emit('close', 0);
  });
  return proc;
}
