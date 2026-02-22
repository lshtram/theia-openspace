// extensions/openspace-voice/src/browser/audio-fsm.ts
import { validateAudioTransition, type AudioState } from '../common/voice-fsm';

export interface AudioFsmOptions {
  sttEndpoint: string;
  language: string;
  autoDetectLanguage: boolean;
  onTranscript: (text: string) => void;
  onError?: (err: Error) => void;
  onVolumeData?: (data: Uint8Array) => void;
}

export class AudioFsm {
  private _state: AudioState = 'idle';
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  // Live-monitor analyser (separate AudioContext from the decode one)
  private analyserCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;

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

    // Set up live volume analyser if consumer wants it
    if (this.options.onVolumeData) {
      this.analyserCtx = new AudioContext();
      const source = this.analyserCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.analyserCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      const buf = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(buf);
        this.options.onVolumeData!(buf);
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }
  }

  async stopCapture(): Promise<void> {
    this._state = validateAudioTransition({ from: this._state, trigger: 'stopCapture' });

    // Stop the volume analyser loop first
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.analyserCtx) {
      this.analyserCtx.close();
      this.analyserCtx = null;
      this.analyser = null;
    }

    await new Promise<void>((resolve) => {
      if (!this.mediaRecorder) { resolve(); return; }
      this.mediaRecorder.onstop = () => resolve();
      this.mediaRecorder.stop();
    });

    this.mediaStream?.getTracks().forEach((t) => t.stop());

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      let decoded: AudioBuffer;
      try {
        decoded = await audioCtx.decodeAudioData(arrayBuffer);
      } finally {
        audioCtx.close();
      }

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
          'X-Auto-Detect-Language': String(this.options.autoDetectLanguage),
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
      this._state = validateAudioTransition({ from: this._state, trigger: 'reset' });
    }
  }

  reset(): void {
    this._state = validateAudioTransition({ from: this._state, trigger: 'reset' });
  }
}
