// extensions/openspace-voice/src/__tests__/tts-provider-selector.spec.ts
import { assert } from 'chai';
import { TtsProviderSelector } from '../node/tts/tts-provider-selector';
import { KokoroAdapter } from '@openspace-ai/voice-core/lib/adapters/kokoro.adapter';

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

  it('isAvailable() returns false when kokoro-js cannot be resolved', async () => {
    // Simulate kokoro-js not installed by stubbing Module._resolveFilename to throw
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module');
    const originalResolveFilename = Module._resolveFilename;
    Module._resolveFilename = (request: string, ...args: unknown[]) => {
      if (request === 'kokoro-js') {
        const err: NodeJS.ErrnoException = new Error(`Cannot find module 'kokoro-js'`);
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }
      return originalResolveFilename.call(Module, request, ...args);
    };

    try {
      // Create a fresh adapter (cache is per-instance, so new instance probes fresh)
      const kokoro = new KokoroAdapter();
      const available = await kokoro.isAvailable();
      assert.isFalse(available, 'isAvailable() should return false when kokoro-js is not resolvable');
    } finally {
      Module._resolveFilename = originalResolveFilename;
    }
  });
});
