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
      const audio = new Uint8Array(arrayBuffer);

      const response = await fetch(this.options.sttEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Voice-Language': this.options.language,
        },
        body: audio,
      });

      if (!response.ok) throw new Error(`STT endpoint returned ${response.status}`);
      const result = await response.json() as { text: string };

      this._state = validateAudioTransition({ from: this._state, trigger: 'transcriptReady' });
      this.options.onTranscript(result.text);
    } catch (err) {
      this._state = validateAudioTransition({ from: this._state, trigger: 'sttError' });
      this.options.onError?.(err as Error);
    }
  }

  reset(): void {
    this._state = validateAudioTransition({ from: this._state, trigger: 'reset' });
  }
}
