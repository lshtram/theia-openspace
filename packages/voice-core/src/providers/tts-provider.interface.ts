// src/providers/tts-provider.interface.ts

import type { CancellationToken } from './stt-provider.interface';

export interface TtsSynthesisRequest {
  text: string;
  language: string;
  speed?: number;
  voice?: string;
}

export interface TtsSynthesisResult {
  audio: Uint8Array;    // raw 16-bit PCM samples at 24 kHz (Kokoro output rate)
  sampleRate?: number;  // 24000 for Kokoro; optional for backward compatibility
}

export interface TtsProvider {
  readonly kind: 'tts';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  synthesize(request: TtsSynthesisRequest, token?: CancellationToken): Promise<TtsSynthesisResult>;
  dispose(): Promise<void>;
}
