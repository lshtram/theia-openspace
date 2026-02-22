// extensions/openspace-voice/src/browser/voice-service.ts
import type { VoicePolicy } from '../common/voice-policy';
import type { SessionState } from '../common/voice-fsm';

export const VoiceService = Symbol('VoiceService');

export interface VoiceService {
  readonly sessionState: SessionState;
  readonly policy: VoicePolicy;
  enable(): void;
  disable(): void;
  startPushToTalk(): void;
  stopPushToTalk(): Promise<void>;  // triggers STT transcription
  updatePolicy(partial: Partial<VoicePolicy>): void;
  onTranscript: (handler: (text: string) => void) => void;
}
