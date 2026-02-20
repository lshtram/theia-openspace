// extensions/openspace-voice/src/node/voice-backend-service.ts
import type { NarrationMode } from '@openspace-ai/voice-core';
import type { SttProvider, TtsProvider } from '@openspace-ai/voice-core';
import { NarrationPreprocessor, type LlmCaller } from './narration-preprocessor';

export interface TranscribeSpeechRequest {
  audio: Uint8Array;
  language: string;
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
  llmCaller: LlmCaller;
  narrationPrompts?: { everything?: string; summary?: string };
}

export class VoiceBackendService {
  private readonly sttProvider: SttProvider;
  private readonly ttsProvider: TtsProvider;
  private readonly narrationPreprocessor: NarrationPreprocessor;

  constructor(options: VoiceBackendServiceOptions) {
    this.sttProvider = options.sttProvider;
    this.ttsProvider = options.ttsProvider;
    this.narrationPreprocessor = new NarrationPreprocessor({
      llmCaller: options.llmCaller,
      prompts: options.narrationPrompts,
    });
  }

  async transcribeSpeech(request: TranscribeSpeechRequest): Promise<TranscribeSpeechResult> {
    return this.sttProvider.transcribe({ audio: request.audio, language: request.language });
  }

  async narrateText(request: NarrateTextRequest): Promise<NarrateTextResult> {
    const script = await this.narrationPreprocessor.process({
      text: request.text,
      mode: request.mode,
    });

    if (script.segments.length === 0) {
      return { segments: [] };
    }

    const results: NarrateSegmentResult[] = [];
    for (const segment of script.segments) {
      if (segment.type === 'utterance') {
        results.push({
          type: 'utterance',
          utteranceId: segment.utteranceId,
          emotion: segment.emotion,
        });
      } else if (segment.type === 'speech' && segment.text) {
        const ttsResult = await this.ttsProvider.synthesize({
          text: segment.text,
          language: 'en-US',
          speed: request.speed,
          voice: request.voice,
        });
        results.push({
          type: 'speech',
          audioBase64: Buffer.from(ttsResult.audio).toString('base64'),
          emotion: segment.emotion,
        });
      }
    }

    return { segments: results };
  }
}
