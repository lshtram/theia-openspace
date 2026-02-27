// extensions/openspace-voice/src/node/voice-backend-service.ts
import type { NarrationMode } from '@openspace-ai/voice-core';
import type { SttProvider, TtsProvider } from '@openspace-ai/voice-core';
import { cleanTextForTts } from '../common/text-cleanup';
import { splitIntoSentences } from '../common/sentence-splitter';

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

export interface NarrateStreamChunk {
  seq: number;            // -1 for the final done marker
  audioBase64?: string;   // present for non-done chunks
  done: boolean;
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

  /**
   * Streaming variant of narrateText.
   *
   * Splits cleaned text into sentences, synthesizes each with Kokoro,
   * and calls onChunk immediately as each finishes — enabling the browser
   * to start playing the first sentence while later sentences are still
   * being synthesized.
   *
   * Final call: onChunk({ seq: -1, done: true })
   */
  async narrateTextStreaming(
    request: NarrateTextRequest,
    onChunk: (chunk: NarrateStreamChunk) => void,
  ): Promise<void> {
    if (request.mode === 'narrate-off') {
      onChunk({ seq: -1, done: true });
      return;
    }

    const cleaned = cleanTextForTts(request.text);
    if (!cleaned) {
      onChunk({ seq: -1, done: true });
      return;
    }

    const sentences = splitIntoSentences(cleaned);
    if (sentences.length === 0) {
      onChunk({ seq: -1, done: true });
      return;
    }

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (!sentence.trim()) continue;

      const ttsResult = await this.ttsProvider.synthesize({
        text: sentence,
        language: 'en-US',
        speed: request.speed,
        voice: request.voice,
      });

      onChunk({
        seq: i,
        audioBase64: Buffer.from(ttsResult.audio).toString('base64'),
        done: false,
      });
    }

    onChunk({ seq: -1, done: true });
  }
}
