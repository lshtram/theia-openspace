// src/fsm/narration-fsm.ts
import type { NarrationState, NarrationTrigger, NarrationMode } from './types';
import { VoiceFsmError } from './types';

type TransitionTable = Partial<Record<`${NarrationState}:${NarrationTrigger}`, NarrationState>>;

const TRANSITIONS: TransitionTable = {
  'idle:enqueue': 'queued',
  'queued:enqueue': 'queued',         // additional items while queued
  'queued:startProcessing': 'processing',
  'processing:audioReady': 'playing',
  'playing:pause': 'paused',
  'paused:resume': 'playing',
};

export interface NarrationRequest {
  text: string;
  mode: NarrationMode;
  voice: string;
  speed: number;
}

export class NarrationFsm {
  private _state: NarrationState = 'idle';
  private readonly queue: NarrationRequest[] = [];

  get state(): NarrationState { return this._state; }

  enqueue(request: NarrationRequest): void {
    if (request.mode === 'narrate-off') return;
    if (this._state === 'idle') {
      this._state = this.transition('enqueue');
      this.queue.push(request);
    } else {
      // Already queued/processing/playing/paused — just add to backlog
      this.queue.push(request);
    }
  }

  startProcessing(): void { this._state = this.transition('startProcessing'); }
  audioReady(): void { this._state = this.transition('audioReady'); }
  pause(): void { this._state = this.transition('pause'); }
  resume(): void { this._state = this.transition('resume'); }

  /** Marks current item done. Returns next request if any, or undefined if queue is empty. */
  complete(): NarrationRequest | undefined {
    // Remove the item that just finished
    this.queue.shift();
    const next = this.queue[0];
    if (next) {
      this._state = 'queued';  // more work to do
    } else {
      this._state = 'idle';
    }
    return next;
  }

  private transition(trigger: NarrationTrigger): NarrationState {
    const key = `${this._state}:${trigger}` as `${NarrationState}:${NarrationTrigger}`;
    const next = TRANSITIONS[key];
    if (next === undefined) throw new VoiceFsmError('narration', this._state, trigger);
    return next;
  }
}
