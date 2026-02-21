// extensions/openspace-voice/src/browser/narration-fsm.ts
import {
  validateNarrationTransition,
  type NarrationState,
} from '../common/voice-fsm';
import type { NarrationMode } from '../common/voice-policy';

export interface NarrationRequest {
  text: string;
  mode: NarrationMode;
  voice: string;
  speed: number;
}

export interface NarrationFsmOptions {
  narrateEndpoint: string;
  utteranceBaseUrl: string;
  onPlaybackComplete?: () => void;
  onError?: (err: Error) => void;
}

export class NarrationFsm {
  private _state: NarrationState = 'idle';
  private audioCtx: AudioContext | null = null;
  private queue: NarrationRequest[] = [];

  constructor(private readonly options: NarrationFsmOptions) {}

  get state(): NarrationState { return this._state; }

  enqueue(request: NarrationRequest): void {
    if (this._state === 'idle') {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
      // Start processing asynchronously so callers see 'queued' state
      Promise.resolve().then(() => this.drainLoop(request)).catch((err) => {
        this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
        this.options.onError?.(err as Error);
      });
    } else {
      this.queue.push(request);
    }
  }

  pause(): void {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'pause' });
    this.audioCtx?.suspend();
  }

  resume(): void {
    this._state = validateNarrationTransition({ from: this._state, trigger: 'resume' });
    this.audioCtx?.resume();
  }

  stop(): void {
    this.queue = [];
    this.audioCtx?.close();
    this.audioCtx = null;
    this._state = 'idle';
  }

  // M-6: Iterative drain loop replaces recursive processQueue() to avoid stack growth
  private async drainLoop(first: NarrationRequest): Promise<void> {
    let current: NarrationRequest | undefined = first;
    while (current) {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'startProcessing' });
      try {
        await this.fetchAndPlay(current);
        this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
        this.options.onPlaybackComplete?.();
      } catch (err) {
        // M-7: Use validateNarrationTransition (not direct assignment) for error transitions
        this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
        this.options.onError?.(err as Error);
        return;
      }
      current = this.queue.shift();
      if (current) {
        // More items to process -- transition back to queued before next iteration
        this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
      }
    }
  }

  private async fetchAndPlay(request: NarrationRequest): Promise<void> {
    const response = await fetch(this.options.narrateEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) throw new Error(`Narrate endpoint returned ${response.status}`);
    const result = await response.json() as {
      segments: Array<{ type: string; audioBase64?: string; utteranceId?: string }>;
    };

    this._state = validateNarrationTransition({ from: this._state, trigger: 'audioReady' });

    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    for (const segment of result.segments) {
      if (segment.type === 'speech' && segment.audioBase64) {
        const bytes = Uint8Array.from(atob(segment.audioBase64), (c) => c.charCodeAt(0));
        await this.playAudioBuffer(bytes);
      } else if (segment.type === 'utterance' && segment.utteranceId) {
        await this.playUtterance(segment.utteranceId);
      }
    }
  }

  private async playAudioBuffer(pcmBytes: Uint8Array): Promise<void> {
    if (!this.audioCtx) return;
    const int16 = new Int16Array(pcmBytes.buffer);
    const float32 = new Float32Array(int16.length);
    // L-4: Correct Int16->Float32 conversion uses / 32768 (not / 32767)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);

    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }

  private async playUtterance(utteranceId: string): Promise<void> {
    const url = `${this.options.utteranceBaseUrl}/${utteranceId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      if (!this.audioCtx) return;
      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    } catch {
      // ignore utterance playback errors
    }
  }
}
