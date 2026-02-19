// extensions/openspace-voice/src/browser/session-fsm.ts
import {
  validateSessionTransition,
  type SessionState,
} from '../common/voice-fsm';
import {
  resolveVoicePolicy,
  DEFAULT_VOICE_POLICY,
  type VoicePolicy,
} from '../common/voice-policy';

export class SessionFsm {
  private _state: SessionState = 'inactive';
  private _policy: VoicePolicy = { ...DEFAULT_VOICE_POLICY };

  get state(): SessionState { return this._state; }
  get policy(): VoicePolicy { return { ...this._policy }; }

  enable(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'enable' });
    this._policy = resolveVoicePolicy({ ...this._policy, enabled: true });
  }

  disable(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'disable' });
    this._policy = resolveVoicePolicy({ ...this._policy, enabled: false });
  }

  pushToTalkStart(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'pushToTalkStart' });
  }

  pushToTalkEnd(): void {
    this._state = validateSessionTransition({ from: this._state, trigger: 'pushToTalkEnd' });
  }

  updatePolicy(partial: Partial<VoicePolicy>): void {
    this._policy = resolveVoicePolicy({ ...this._policy, ...partial });
  }
}
