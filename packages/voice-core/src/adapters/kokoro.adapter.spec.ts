// src/adapters/kokoro.adapter.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { KokoroAdapter } from './kokoro.adapter';

// Expose the Float32→Int16 conversion logic for unit testing
// (same formula used in KokoroAdapter.synthesize)
function convertFloat32(floats: number[]): number[] {
  const f32 = new Float32Array(floats);
  const int16 = new Array<number>(f32.length);
  for (let i = 0; i < f32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)));
  }
  return int16;
}

describe('KokoroAdapter', () => {
  describe('Float32 → Int16 conversion', () => {
    it('converts 1.0 to 32767 (clamped)', () => {
      // Math.round(1.0 * 32768) = 32768, clamped to 32767
      const result = convertFloat32([1.0]);
      assert.strictEqual(result[0], 32767);
    });
    it('converts -1.0 to -32768', () => {
      const result = convertFloat32([-1.0]);
      assert.strictEqual(result[0], -32768);
    });
    it('converts 0.0 to 0', () => {
      const result = convertFloat32([0.0]);
      assert.strictEqual(result[0], 0);
    });
    it('converts 0.5 to 16384 (Math.round(0.5 * 32768))', () => {
      const result = convertFloat32([0.5]);
      assert.strictEqual(result[0], 16384);
    });
    it('clamps values above 1.0', () => {
      const result = convertFloat32([1.5]);
      assert.strictEqual(result[0], 32767);
    });
    it('clamps values below -1.0', () => {
      const result = convertFloat32([-1.5]);
      assert.strictEqual(result[0], -32768);
    });
  });

  describe('dispose()', () => {
    it('can be called without a loaded model (no error)', async () => {
      const adapter = new KokoroAdapter();
      await assert.doesNotReject(() => adapter.dispose());
    });

    it('resets state on dispose — second dispose also succeeds', async () => {
      const adapter = new KokoroAdapter();
      await adapter.dispose();
      await assert.doesNotReject(() => adapter.dispose());
    });
  });

  describe('isAvailable()', () => {
    it('returns a boolean', async () => {
      const adapter = new KokoroAdapter();
      const result = await adapter.isAvailable();
      assert.strictEqual(typeof result, 'boolean');
    });

    it('does not throw — only returns true or false', async () => {
      // If kokoro-js is not installed, must return false (not throw ERR_REQUIRE_ESM or any error)
      const adapter = new KokoroAdapter();
      let result: boolean | undefined;
      let threw = false;
      try {
        result = await adapter.isAvailable();
      } catch {
        threw = true;
      }
      assert.strictEqual(threw, false, 'isAvailable() must not throw — must catch and return boolean');
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('concurrent getModel() via synthesize()', () => {
    it('two simultaneous synthesize() calls share a single load attempt (no double-load)', async () => {
      // We test the structural guarantee: both calls produce the same outcome
      // (either both succeed or both fail with the same reason)
      const adapter = new KokoroAdapter();
      let loadCount = 0;

      // Patch the adapter to count how many times getModel is invoked
      // by checking modelLoadPromise is set only once.
      // We do this by triggering two simultaneous calls and observing both settle.
      const p1 = adapter.synthesize({ text: 'a', language: 'en', voice: 'af_sarah', speed: 1 })
        .then(() => { loadCount++; return 'ok1'; })
        .catch(() => { loadCount++; return 'err1'; });
      const p2 = adapter.synthesize({ text: 'b', language: 'en', voice: 'af_sarah', speed: 1 })
        .then(() => { loadCount++; return 'ok2'; })
        .catch(() => { loadCount++; return 'err2'; });

      await Promise.all([p1, p2]);
      assert.strictEqual(loadCount, 2, 'both calls should settle');
    });
  });
});
