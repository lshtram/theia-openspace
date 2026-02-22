// src/fsm/types.ts

export type AudioState = 'idle' | 'listening' | 'processing' | 'error';
export type AudioTrigger = 'startCapture' | 'stopCapture' | 'transcriptReady' | 'sttError' | 'reset';

export type NarrationState = 'idle' | 'queued' | 'processing' | 'playing' | 'paused';
export type NarrationTrigger = 'enqueue' | 'startProcessing' | 'audioReady' | 'pause' | 'resume' | 'complete' | 'error';

export type SessionState = 'inactive' | 'active' | 'suspended';
export type SessionTrigger = 'enable' | 'disable' | 'pushToTalkStart' | 'pushToTalkEnd';

export const NARRATION_MODES = ['narrate-off', 'narrate-everything', 'narrate-summary'] as const;
export type NarrationMode = (typeof NARRATION_MODES)[number];

export interface VoicePolicy {
  enabled: boolean;
  narrationMode: NarrationMode;
  speed: number;      // 0.5–2.0
  voice: string;      // TTS voice ID e.g. 'af_sarah'
  language: string;   // BCP-47 e.g. 'en-US'
}

export const DEFAULT_VOICE_POLICY: VoicePolicy = {
  enabled: false,
  narrationMode: 'narrate-off',
  speed: 1.0,
  voice: 'af_sarah',
  language: 'en-US',
};

export class VoiceFsmError extends Error {
  constructor(
    public readonly fsm: string,
    public readonly from: string,
    public readonly trigger: string,
  ) {
    super(`VoiceFSM[${fsm}]: invalid transition ${from}:${trigger}`);
    this.name = 'VoiceFsmError';
  }
}
