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
        if (this._state !== 'idle') {
          this._state = validateNarrationTransition({ from: this._state, trigger: 'error' });
        }
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
    if (this._state !== 'queued') return; // stop() fired before microtask ran
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
        // stop() may have fired during audio playback — state is already idle
        if (this._state === 'idle') return;
        this._state = validateNarrationTransition({ from: this._state, trigger: 'complete' });
        this.options.onPlaybackComplete?.();
        this.options.onModeChange?.('idle');
        console.log('[Voice] Narration complete');
      } catch (err) {
        const isAbort = (err instanceof Error && err.name === 'AbortError') ||
                        (err instanceof DOMException && err.name === 'AbortError');
        if (isAbort) {
          // Clean cancel — stop() already set state to idle and called onModeChange
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

    // seq-ordered pending buffers: seq -> Float32Array
    const pending = new Map<number, Float32Array>();
    let nextPlaySeq = 0;
    let streamDone = false;
    let streamError: Error | null = null;

    // Notify mechanism: player waits on this when pending is empty but stream isn't done yet.
    // Reader resolves it each time a new chunk arrives.
    let notifyPlayer!: () => void;
    const makeNotify = (): Promise<void> =>
      new Promise<void>(resolve => { notifyPlayer = resolve; });
    let playerWait = makeNotify();

    const readerLoop = async (): Promise<void> => {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let leftover = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = leftover + decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          leftover = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            let chunk: { seq: number; audioBase64?: string; done: boolean; error?: string };
            try { chunk = JSON.parse(line); } catch { continue; }
            if (chunk.done) { streamDone = true; notifyPlayer(); return; }
            if (chunk.error) {
              streamError = new Error(`TTS server error: ${chunk.error}`);
              streamDone = true;
              notifyPlayer();
              return;
            }
            if (chunk.audioBase64) {
              const bytes = Uint8Array.from(atob(chunk.audioBase64), c => c.charCodeAt(0));
              const int16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(int16.length);
              // L-4: Correct Int16->Float32 conversion uses / 32768 (not / 32767)
              for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
              pending.set(chunk.seq, float32);
            }
            // Wake player after each chunk so it can start playing without waiting for the next read
            notifyPlayer();
            playerWait = makeNotify();
          }
        }
      } finally {
        // Always signal player to unblock, even if reader exits early (abort, error, or done)
        streamDone = true;
        notifyPlayer();
      }
    };

    const playerLoop = async (): Promise<void> => {
      while (true) {
        const waitPromise = playerWait; // snapshot before draining
        // Play all in-order chunks currently buffered
        while (pending.has(nextPlaySeq)) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const float32 = pending.get(nextPlaySeq)!;
          pending.delete(nextPlaySeq);
          nextPlaySeq++;
          await this.playFloat32(float32, signal);
        }
        // Exit when stream is complete and no more chunks to play
        if (streamDone && !pending.has(nextPlaySeq)) break;
        // Wait for reader to notify us a new chunk arrived
        await waitPromise;
      }
      if (streamError) throw streamError;
    };

    const [readerResult, playerResult] = await Promise.allSettled([readerLoop(), playerLoop()]);
    const firstError = (playerResult.status === 'rejected' ? playerResult.reason : null)
                    ?? (readerResult.status === 'rejected' ? readerResult.reason : null);
    if (firstError) throw firstError as Error;
    this.options.onEmotionChange?.(null);
  }

  private async playFloat32(float32: Float32Array, signal?: AbortSignal): Promise<void> {
    if (!this.audioCtx) return;
    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      signal?.addEventListener('abort', () => { source.stop(); resolve(); });
      source.start();
    });
  }

}
