// extensions/openspace-voice/src/node/tts/tts-provider-selector.ts
import type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from '@openspace-ai/voice-core';
import { KokoroAdapter } from '@openspace-ai/voice-core';

class BrowserSpeechSynthesisStub implements TtsProvider {
  readonly kind = 'tts' as const;
  readonly id = 'browser-synth-stub';
  async isAvailable(): Promise<boolean> { return true; }
  async synthesize(_request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    return { audio: new Uint8Array(0), sampleRate: 24000 };
  }
  async dispose(): Promise<void> { /* no-op */ }
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
