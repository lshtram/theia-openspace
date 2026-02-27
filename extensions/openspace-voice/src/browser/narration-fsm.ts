// extensions/openspace-voice/src/browser/narration-fsm.ts
import {
  validateNarrationTransition,
  type NarrationState,
} from '../common/voice-fsm';
import type { NarrationMode } from '../common/voice-policy';
import type { EmotionKind } from '../common/narration-types';

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
  onEmotionChange?: (emotion: EmotionKind | null) => void;
  onModeChange?: (mode: 'idle' | 'waiting' | 'speaking') => void;
}

/**
 * Parse complete NDJSON lines from a text chunk.
 * Returns only fully-parseable lines; partial last lines are ignored.
 */
export function parseNdjsonLines(text: string): Array<{ seq: number; audioBase64?: string; done: boolean; error?: string }> {
  return text
    .split('\n')
    .filter(line => line.trim().length > 0)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as { seq: number; audioBase64?: string; done: boolean; error?: string }];
      } catch {
        return [];
      }
    });
}

export class NarrationFsm {
  private _state: NarrationState = 'idle';
  private audioCtx: AudioContext | null = null;
  private queue: NarrationRequest[] = [];
  private _abortController: AbortController | null = null;

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
    this._abortController?.abort();
    this._abortController = null;
    this.queue = [];
    this.audioCtx?.close();
    this.audioCtx = null;
    this._state = 'idle';
    this.options.onModeChange?.('idle');
  }

  // M-6: Iterative drain loop replaces recursive processQueue() to avoid stack growth
  private async drainLoop(first: NarrationRequest): Promise<void> {
    this._abortController = new AbortController();
    const { signal } = this._abortController;
    let current: NarrationRequest | undefined = first;
    console.log('[Voice] drainLoop started, mode:', current?.mode);
    while (current) {
      this._state = validateNarrationTransition({ from: this._state, trigger: 'startProcessing' });
      this.options.onModeChange?.('waiting');
      console.log('[Voice] Waiting for TTS...');
      try {
        await this.fetchAndPlay(current, signal);
        this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
        this.options.onPlaybackComplete?.();
        this.options.onModeChange?.('idle');
        console.log('[Voice] Narration complete');
      } catch (err) {
        const isAbort = (err instanceof Error && err.name === 'AbortError') ||
                        (err instanceof DOMException && err.name === 'AbortError');
        if (isAbort) {
          // Clean cancel — state already set to idle by stop()
          this.options.onModeChange?.('idle');
          console.log('[Voice] Narration cancelled');
          return;
        }
        // M-7: Use validateNarrationTransition (not direct assignment) for error transitions
        this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
        this.options.onError?.(err as Error);
        this.options.onModeChange?.('idle');
        console.error('[Voice] Narration error:', err);
        return;
      }
      current = this.queue.shift();
      if (current) {
        // More items to process -- transition back to queued before next iteration
        this._state = validateNarrationTransition({ from: this._state, trigger: 'enqueue' });
      }
    }
  }

  private async fetchAndPlay(request: NarrationRequest, signal: AbortSignal): Promise<void> {
    console.log('[Voice] fetchAndPlay (streaming) - text:', request.text.substring(0, 100));

    const response = await fetch(this.options.narrateEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) throw new Error(`Narrate endpoint returned ${response.status}`);
    if (!response.body) throw new Error('No response body for streaming narrate');

    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }

    this._state = validateNarrationTransition({ from: this._state, trigger: 'audioReady' });
    this.options.onModeChange?.('speaking');

    // Ordered play queue: chunks may be decoded before the previous one finishes playing.
    // We process them strictly in seq order.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let leftover = '';
    // seq-ordered pending buffers: seq -> Float32Array
    const pending = new Map<number, Float32Array>();
    let nextSeq = 0;
    let streamDone = false;

    const playPending = async (): Promise<void> => {
      while (pending.has(nextSeq)) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const float32 = pending.get(nextSeq)!;
        pending.delete(nextSeq);
        nextSeq++;
        await this.playFloat32(float32);
      }
    };

    while (!streamDone) {
      const { value, done } = await reader.read();
      if (done) break;

      const text = leftover + decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      // Last element may be partial — save for next iteration
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk: { seq: number; audioBase64?: string; done: boolean; error?: string };
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }

        if (chunk.done) {
          streamDone = true;
          break;
        }

        if (chunk.error) {
          throw new Error(`TTS server error: ${chunk.error}`);
        }

        if (chunk.audioBase64) {
          // Decode PCM immediately (off the main render path)
          const bytes = Uint8Array.from(atob(chunk.audioBase64), c => c.charCodeAt(0));
          const int16 = new Int16Array(bytes.buffer);
          const float32 = new Float32Array(int16.length);
          // L-4: Correct Int16->Float32 conversion uses / 32768 (not / 32767)
          for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
          pending.set(chunk.seq, float32);
        }

        // Play any chunks that are now in order
        await playPending();
      }

      // After processing this read batch, drain any in-order pending chunks
      await playPending();
    }

    // Drain any remaining chunks that arrived out of order
    await playPending();

    this.options.onEmotionChange?.(null);
  }

  private async playFloat32(float32: Float32Array): Promise<void> {
    if (!this.audioCtx) return;
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

}
