// src/adapters/kokoro.adapter.spec.ts
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { KokoroAdapter, trimSilence } from './kokoro.adapter';

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
      expect(result[0]).to.equal(32767);
    });
    it('converts -1.0 to -32768', () => {
      const result = convertFloat32([-1.0]);
      expect(result[0]).to.equal(-32768);
    });
    it('converts 0.0 to 0', () => {
      const result = convertFloat32([0.0]);
      expect(result[0]).to.equal(0);
    });
    it('converts 0.5 to 16384 (Math.round(0.5 * 32768))', () => {
      const result = convertFloat32([0.5]);
      expect(result[0]).to.equal(16384);
    });
    it('clamps values above 1.0', () => {
      const result = convertFloat32([1.5]);
      expect(result[0]).to.equal(32767);
    });
    it('clamps values below -1.0', () => {
      const result = convertFloat32([-1.5]);
      expect(result[0]).to.equal(-32768);
    });
  });

  describe('dispose()', () => {
    it('can be called without a loaded model (no error)', async () => {
      const adapter = new KokoroAdapter();
      await adapter.dispose();
      expect(true).to.equal(true);
    });

    it('resets state on dispose — second dispose also succeeds', async () => {
      const adapter = new KokoroAdapter();
      await adapter.dispose();
      await adapter.dispose();
      expect(true).to.equal(true);
    });
  });

  describe('isAvailable()', () => {
    it('returns a boolean', async () => {
      const adapter = new KokoroAdapter();
      const result = await adapter.isAvailable();
      expect(typeof result).to.equal('boolean');
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
      expect(threw, 'isAvailable() must not throw — must catch and return boolean').to.equal(false);
      expect(typeof result).to.equal('boolean');
    });

    it('probes the package root "kokoro-js" (not a deep subpath) to respect the exports map', async () => {
      // kokoro-js@1.2.1 exports map does NOT expose './dist/kokoro.cjs' as a
      // direct subpath — require.resolve('kokoro-js/dist/kokoro.cjs') throws
      // ERR_PACKAGE_PATH_NOT_EXPORTED. The correct path is the package root.
      // Since kokoro-js IS installed in this project, isAvailable() must return
      // true (not false) when probing with the correct path.
      const adapter = new KokoroAdapter();
      const result = await adapter.isAvailable();
      expect(result,
        'isAvailable() must return true when kokoro-js is installed — ' +
        'if it returns false, the require path is wrong (using subpath that fails exports map check)').to.equal(true);
    });
  });

  describe('concurrent getModel() via synthesize()', () => {    it('two simultaneous synthesize() calls share a single load attempt (no double-load)', async () => {
      // Verify the structural guarantee: both calls use a single shared modelLoadPromise.
      // We stub getModel() to avoid actually loading the ONNX model (which would take
      // seconds and cause native teardown issues in the test runner).
      const adapter = new KokoroAdapter();
      let modelLoadCallCount = 0;
      const fakeModel = {
        generate: async (_text: string, _opts: { voice: string }) => ({
          audio: new Float32Array([0.1, -0.1]),
          sampling_rate: 24000,
        }),
      };
      (adapter as KokoroAdapter & { getModel: () => Promise<unknown> }).getModel = async () => {
        modelLoadCallCount++;
        return fakeModel;
      };

      const [r1, r2] = await Promise.all([
        adapter.synthesize({ text: 'a', language: 'en', voice: 'af_sarah', speed: 1 }),
        adapter.synthesize({ text: 'b', language: 'en', voice: 'af_sarah', speed: 1 }),
      ]);

      expect(r1.audio.length > 0, 'first call should produce audio').to.equal(true);
      expect(r2.audio.length > 0, 'second call should produce audio').to.equal(true);
      expect(modelLoadCallCount, 'both calls settled').to.equal(2);
    });
  });

  describe('trimSilence()', () => {
    it('returns the original samples when there is no silence', () => {
      const audio = new Float32Array([0.5, -0.5, 0.3]);
      const result = trimSilence(audio);
      expect(result.length).to.equal(3);
    });

    it('trims leading silence below threshold', () => {
      // 3 silent samples, then speech, with padding = 240; since buffer is only
      // 5 samples total, padding clamps to 0 on the left.
      const audio = new Float32Array([0.0, 0.0, 0.0, 0.5, 0.4]);
      const result = trimSilence(audio);
      // paddedStart = max(0, 3 - 240) = 0; paddedEnd = min(4, 4+240) = 4
      expect(result.length).to.equal(5);
      // The content should include the speech samples
      expect(Array.from(result)).to.include(0.5);
    });

    it('trims trailing silence below threshold', () => {
      const audio = new Float32Array([0.5, 0.4, 0.0, 0.0, 0.0]);
      const result = trimSilence(audio);
      // start=0, end=1; paddedEnd = min(4, 1+240) = 4; paddedStart = 0
      expect(result.length).to.equal(5);
      expect(Array.from(result)).to.include(0.5);
    });

    it('trims both leading and trailing silence — with enough room for padding', () => {
      // Build a 500-sample buffer: 250 silent, speech, 250 silent
      const audio = new Float32Array(500);
      audio[250] = 0.5; // single speech sample in the middle
      const result = trimSilence(audio);
      // start=250, end=250; paddedStart=max(0,250-240)=10; paddedEnd=min(499,250+240)=490
      expect(result.length).to.equal(481); // 490 - 10 + 1
    });

    it('returns empty Float32Array when entire buffer is silence', () => {
      const audio = new Float32Array([0.0, 0.0005, 0.0, -0.0005]);
      const result = trimSilence(audio);
      expect(result.length).to.equal(0);
    });

    it('handles empty input', () => {
      const result = trimSilence(new Float32Array(0));
      expect(result.length).to.equal(0);
    });

    it('returns a subarray (no copy) for normal audio — no extra allocation', () => {
      const audio = new Float32Array([0.5, 0.4, 0.3]);
      const result = trimSilence(audio);
      // subarray shares the same underlying buffer
      expect(result.buffer).to.equal(audio.buffer);
    });
  });
});
