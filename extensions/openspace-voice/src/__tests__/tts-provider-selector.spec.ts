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
