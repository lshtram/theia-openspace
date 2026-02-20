// src/fsm/session-fsm.ts
import type { SessionState, SessionTrigger, VoicePolicy } from './types';
import { DEFAULT_VOICE_POLICY, VoiceFsmError } from './types';

type TransitionTable = Partial<Record<`${SessionState}:${SessionTrigger}`, SessionState>>;

const TRANSITIONS: TransitionTable = {
  'inactive:enable': 'active',
  'active:disable': 'inactive',
  'active:pushToTalkStart': 'suspended',
  'suspended:pushToTalkEnd': 'active',
  'suspended:disable': 'inactive',
  // Idempotent: already in target state
  'active:enable': 'active',
  'inactive:disable': 'inactive',
};

export class SessionFsm {
  private _state: SessionState = 'inactive';
  private _policy: VoicePolicy = { ...DEFAULT_VOICE_POLICY };

  get state(): SessionState { return this._state; }
  get policy(): VoicePolicy { return { ...this._policy }; }

  enable(): void {
    this._state = this.transition('enable');
    this._policy = { ...this._policy, enabled: true };
  }
  disable(): void {
    this._state = this.transition('disable');
    this._policy = { ...this._policy, enabled: false };
  }
  pushToTalkStart(): void { this._state = this.transition('pushToTalkStart'); }
  pushToTalkEnd(): void { this._state = this.transition('pushToTalkEnd'); }

  updatePolicy(partial: Partial<VoicePolicy>): void {
    this._policy = { ...this._policy, ...partial };
  }

  private transition(trigger: SessionTrigger): SessionState {
    const key = `${this._state}:${trigger}` as `${SessionState}:${SessionTrigger}`;
    const next = TRANSITIONS[key];
    if (next === undefined) throw new VoiceFsmError('session', this._state, trigger);
    return next;
  }
}
