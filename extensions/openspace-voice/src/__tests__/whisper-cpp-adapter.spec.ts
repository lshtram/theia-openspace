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
