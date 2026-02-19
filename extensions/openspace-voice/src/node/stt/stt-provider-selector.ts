// extensions/openspace-voice/src/node/stt/stt-provider-selector.ts
import type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult } from '../../common/voice-providers';
import { WhisperCppAdapter } from './whisper-cpp-adapter';

// Fallback: pass-through stub (returns placeholder text)
class BrowserNativeSttStub implements SttProvider {
  readonly kind = 'stt' as const;
  readonly id = 'browser-native-stub';
  async isAvailable(): Promise<boolean> { return true; }
  async transcribe(_request: SttTranscriptionRequest): Promise<SttTranscriptionResult> {
    return { text: '[audio] transcription unavailable (whisper.cpp not found)' };
  }
}

export interface SttProviderSelectorOptions {
  whisperBinaryPath?: string;
  forceFallback?: boolean;
}

export class SttProviderSelector {
  private readonly options: SttProviderSelectorOptions;

  constructor(options: SttProviderSelectorOptions = {}) {
    this.options = options;
  }

  async selectProvider(): Promise<SttProvider> {
    if (this.options.forceFallback) {
      return new BrowserNativeSttStub();
    }

    const whisper = new WhisperCppAdapter(this.options.whisperBinaryPath);
    const available = await whisper.isAvailable();
    if (available) {
      return whisper;
    }

    console.warn('[VoiceBackend] whisper.cpp not found, falling back to stub STT');
    return new BrowserNativeSttStub();
  }
}
