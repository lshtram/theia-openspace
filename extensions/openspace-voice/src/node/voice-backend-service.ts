// extensions/openspace-voice/src/node/voice-backend-service.ts
import type { NarrationMode } from '@openspace-ai/voice-core';
import type { SttProvider, TtsProvider } from '@openspace-ai/voice-core';
import { cleanTextForTts } from '../common/text-cleanup';

export interface TranscribeSpeechRequest {
  audio: Uint8Array;
  language: string;
  sampleRate?: number;
}

export interface TranscribeSpeechResult {
  text: string;
}

export interface NarrateTextRequest {
  text: string;
  mode: NarrationMode;
  voice: string;
  speed: number;
}

export interface NarrateSegmentResult {
  type: 'speech' | 'utterance';
  audioBase64?: string;   // base64-encoded WAV for type='speech'
  utteranceId?: string;   // for type='utterance'
  emotion?: { kind: string };
}

export interface NarrateTextResult {
  segments: NarrateSegmentResult[];
}

export interface VoiceBackendServiceOptions {
  sttProvider: SttProvider;
  ttsProvider: TtsProvider;
}

export class VoiceBackendService {
  private readonly sttProvider: SttProvider;
  private readonly ttsProvider: TtsProvider;

  constructor(options: VoiceBackendServiceOptions) {
    this.sttProvider = options.sttProvider;
    this.ttsProvider = options.ttsProvider;
  }

  async transcribeSpeech(request: TranscribeSpeechRequest): Promise<TranscribeSpeechResult> {
    return this.sttProvider.transcribe({ audio: request.audio, language: request.language, sampleRate: request.sampleRate });
  }

  async narrateText(request: NarrateTextRequest): Promise<NarrateTextResult> {
    if (request.mode === 'narrate-off') {
      return { segments: [] };
    }

    const cleaned = cleanTextForTts(request.text);
    if (!cleaned) {
      return { segments: [] };
    }

    const ttsResult = await this.ttsProvider.synthesize({
      text: cleaned,
      language: 'en-US',
      speed: request.speed,
      voice: request.voice,
    });

    return {
      segments: [{
        type: 'speech',
        audioBase64: Buffer.from(ttsResult.audio).toString('base64'),
      }],
    };
  }
}
