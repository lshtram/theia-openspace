// src/fsm/audio-fsm.ts
import type { AudioState, AudioTrigger } from './types';
import { VoiceFsmError } from './types';

type TransitionTable = Partial<Record<`${AudioState}:${AudioTrigger}`, AudioState>>;

const TRANSITIONS: TransitionTable = {
  'idle:startCapture': 'listening',
  'listening:stopCapture': 'processing',
  'processing:transcriptReady': 'idle',
  'processing:sttError': 'error',
  'error:reset': 'idle',
};

export class AudioFsm {
  private _state: AudioState = 'idle';

  get state(): AudioState { return this._state; }

  startCapture(): void { this._state = this.transition('startCapture'); }
  stopCapture(): void { this._state = this.transition('stopCapture'); }
  transcriptReady(): void { this._state = this.transition('transcriptReady'); }
  error(): void { this._state = this.transition('sttError'); }
  reset(): void { this._state = this.transition('reset'); }

  private transition(trigger: AudioTrigger): AudioState {
    const key = `${this._state}:${trigger}` as `${AudioState}:${AudioTrigger}`;
    const next = TRANSITIONS[key];
    if (next === undefined) throw new VoiceFsmError('audio', this._state, trigger);
    return next;
  }
}
