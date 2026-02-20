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
  });

  describe('isAvailable()', () => {
    it('returns a boolean', async () => {
      const adapter = new KokoroAdapter();
      const result = await adapter.isAvailable();
      assert.strictEqual(typeof result, 'boolean');
    });
  });
});
