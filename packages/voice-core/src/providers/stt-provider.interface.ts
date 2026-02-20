// src/providers/stt-provider.interface.ts

export interface SttTranscriptionRequest {
  audio: Uint8Array;         // raw 16-bit PCM samples (little-endian)
  sampleRate?: number;       // e.g. 16000 — defaults to 16000 if omitted
  language: string;          // BCP-47 e.g. 'en-US'
}

export interface SttTranscriptionResult {
  text: string;
}

export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested(handler: () => void): void;
}

export interface SttProvider {
  readonly kind: 'stt';
  readonly id: string;
  isAvailable(): Promise<boolean>;
  transcribe(request: SttTranscriptionRequest, token?: CancellationToken): Promise<SttTranscriptionResult>;
}
