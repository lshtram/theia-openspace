// extensions/openspace-voice/src/common/voice-providers.ts

export interface SttTranscriptionRequest {
  audio: Uint8Array;
  language: string;
  streaming?: boolean;  // reserved for future streaming STT
}

export interface SttTranscriptionResult {
  text: string;
}

export interface SttProvider {
  readonly kind: 'stt';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  transcribe(request: SttTranscriptionRequest): Promise<SttTranscriptionResult>;
}

export interface TtsSynthesisRequest {
  text: string;
  language: string;
  speed?: number;
  voice?: string;
  streaming?: boolean;  // reserved for future streaming TTS
}

export interface TtsSynthesisResult {
  audio: Uint8Array;  // WAV PCM
}

export interface TtsProvider {
  readonly kind: 'tts';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult>;
}
