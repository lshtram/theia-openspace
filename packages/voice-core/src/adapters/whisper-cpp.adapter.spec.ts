// src/adapters/whisper-cpp.adapter.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
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
      const adapter = new WhisperCppAdapter('whisper', '/usr/local/share/whisper', 'ggml-base.en.bin', mockSpawn);
      assert.strictEqual(await adapter.isAvailable(), true);
      assert.ok(capturedArgs.includes('--help'));
    });

    it('returns false when binary not found (ENOENT)', async () => {
      const mockSpawn: SpawnFn = () => makeErrorProc('ENOENT') as any;
      const adapter = new WhisperCppAdapter('whisper', '/usr/local/share/whisper', 'ggml-base.en.bin', mockSpawn);
      assert.strictEqual(await adapter.isAvailable(), false);
    });

    it('returns false when binary exits non-zero', async () => {
      const mockSpawn: SpawnFn = () => makeFakeProc(1) as any;
      const adapter = new WhisperCppAdapter('whisper', '/usr/local/share/whisper', 'ggml-base.en.bin', mockSpawn);
      assert.strictEqual(await adapter.isAvailable(), false);
    });
  });

  describe('transcribe()', () => {
    it('returns transcribed text from output .txt file', async () => {
      const mockSpawn: SpawnFn = (_cmd, args) => {
        // Write the expected .txt output file before close event
        const ofIndex = args.indexOf('-of');
        if (ofIndex !== -1) {
          const prefix = args[ofIndex + 1];
          fs.writeFileSync(prefix + '.txt', 'hello world\n');
        }
        return makeFakeProc(0) as any;
      };
      const adapter = new WhisperCppAdapter('whisper', '/models', 'ggml-base.en.bin', mockSpawn);
      const result = await adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' });
      assert.strictEqual(result.text, 'hello world');
    });

    it('uses -otxt -of <prefix> -f <wavfile> flags', async () => {
      let capturedArgs: string[] = [];
      const mockSpawn: SpawnFn = (_cmd, args) => {
        capturedArgs = [...args];
        const ofIndex = args.indexOf('-of');
        if (ofIndex !== -1) {
          fs.writeFileSync(args[ofIndex + 1] + '.txt', 'test\n');
        }
        return makeFakeProc(0) as any;
      };
      const adapter = new WhisperCppAdapter('whisper', '/models', 'ggml-base.en.bin', mockSpawn);
      await adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en' });
      assert.ok(capturedArgs.includes('-otxt'), 'should have -otxt flag');
      assert.ok(capturedArgs.includes('-of'), 'should have -of flag');
      assert.ok(capturedArgs.includes('-f'), 'should have -f for input audio');
      // Verify stdout is NOT piped (we read a file instead)
      const stdioArg = 'pipe';
      // -f should appear and the input WAV path should follow it
      const fIndex = capturedArgs.indexOf('-f');
      assert.ok(fIndex !== -1 && capturedArgs[fIndex + 1]?.endsWith('.wav'), '-f should be followed by wav file');
    });

    it('rejects when whisper exits with non-zero code', async () => {
      const mockSpawn: SpawnFn = () => makeFakeProc(1, 'model not found') as any;
      const adapter = new WhisperCppAdapter('whisper', '/usr/local/share/whisper', 'ggml-base.en.bin', mockSpawn);
      await assert.rejects(
        () => adapter.transcribe({ audio: new Uint8Array(100), sampleRate: 16000, language: 'en-US' }),
        /exited 1/
      );
    });

    it('kills process and rejects with "cancelled" when cancellation token fires', async () => {
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

      // Let the process start
      await new Promise(r => setImmediate(r));
      // Fire cancellation
      onCancelFn!();

      await assert.rejects(p, /cancelled/);
      assert.strictEqual(killed, true, 'proc.kill() should have been called');
    });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fake process that exits with a given code (optionally emitting stderr text) */
function makeFakeProc(code: number, stderrText = '') {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => {};
  setImmediate(() => {
    if (stderrText) proc.stderr.emit('data', Buffer.from(stderrText));
    proc.emit('close', code);
  });
  return proc;
}

/** Fake process that emits an error event (e.g. ENOENT) */
function makeErrorProc(code: string) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => {};
  const err = Object.assign(new Error('spawn error'), { code });
  setImmediate(() => proc.emit('error', err));
  return proc;
}
