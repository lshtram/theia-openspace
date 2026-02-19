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
