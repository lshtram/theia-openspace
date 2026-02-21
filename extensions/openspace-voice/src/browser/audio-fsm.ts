// extensions/openspace-voice/src/browser/audio-fsm.ts
import { validateAudioTransition, type AudioState } from '../common/voice-fsm';

export interface AudioFsmOptions {
  sttEndpoint: string;
  language: string;
  onTranscript: (text: string) => void;
  onError?: (err: Error) => void;
}

export class AudioFsm {
  private _state: AudioState = 'idle';
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(private readonly options: AudioFsmOptions) {}

  get state(): AudioState { return this._state; }

  async startCapture(): Promise<void> {
    this._state = validateAudioTransition({ from: this._state, trigger: 'startCapture' });
    this.audioChunks = [];

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  async stopCapture(): Promise<void> {
    this._state = validateAudioTransition({ from: this._state, trigger: 'stopCapture' });

    await new Promise<void>((resolve) => {
      if (!this.mediaRecorder) { resolve(); return; }
      this.mediaRecorder.onstop = () => resolve();
      this.mediaRecorder.stop();
    });

    this.mediaStream?.getTracks().forEach((t) => t.stop());

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();

      // C-2: MediaRecorder produces compressed WebM/Opus audio.
      // Decode to raw Float32 PCM at 16 kHz before sending to the STT backend.
      // whisper.cpp requires raw PCM — sending WebM bytes into a WAV container produces garbage.
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      let decoded: AudioBuffer;
      try {
        decoded = await audioCtx.decodeAudioData(arrayBuffer);
      } finally {
        // Always close the AudioContext to free resources
        audioCtx.close();
      }

      // Convert mono Float32 → Int16 PCM
      const f32 = decoded.getChannelData(0);
      const int16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32768)));
      }

      const response = await fetch(this.options.sttEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/raw',
          'X-Voice-Language': this.options.language,
          'X-Sample-Rate': '16000',
        },
        body: new Uint8Array(int16.buffer),
      });

      if (!response.ok) throw new Error(`STT endpoint returned ${response.status}`);
      const result = await response.json() as { text: string };

      this._state = validateAudioTransition({ from: this._state, trigger: 'transcriptReady' });
      this.options.onTranscript(result.text);
    } catch (err) {
      this._state = validateAudioTransition({ from: this._state, trigger: 'sttError' });
      this.options.onError?.(err as Error);
      // Auto-reset to idle so the next capture attempt doesn't hit error:startCapture
      this._state = validateAudioTransition({ from: this._state, trigger: 'reset' });
    }
  }

  reset(): void {
    this._state = validateAudioTransition({ from: this._state, trigger: 'reset' });
  }
}
