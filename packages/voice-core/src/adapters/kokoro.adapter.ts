// src/adapters/kokoro.adapter.ts
import type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from '../providers/tts-provider.interface';
import type { CancellationToken } from '../providers/stt-provider.interface';

// Minimal type for KokoroTTS to avoid hard dependency on kokoro-js types at compile time
interface KokoroTTSInstance {
  generate(text: string, options: { voice: string }): Promise<{ data: Float32Array | Uint8Array } | null>;
}

interface KokoroTTSConstructor {
  from_pretrained(modelId: string, options: { dtype: string; device: string }): Promise<KokoroTTSInstance>;
}

export class KokoroAdapter implements TtsProvider {
  readonly kind = 'tts' as const;
  readonly id = 'kokoro';

  // Instance variable — not module-level singleton — so dispose() can release it
  private model: KokoroTTSInstance | null = null;
  private modelLoadPromise: Promise<KokoroTTSInstance> | null = null;
  private modelLoadError: Error | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      await import('kokoro-js' as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      return true;
    } catch {
      return false;
    }
  }

  async synthesize(
    request: TtsSynthesisRequest,
    _token?: CancellationToken,
  ): Promise<TtsSynthesisResult> {
    const model = await this.getModel();
    const voice = request.voice ?? 'af_sarah';
    const audio = await model.generate(request.text, { voice });

    let audioBytes: Uint8Array;
    const audioData = audio?.data;

    if (audioData instanceof Float32Array) {
      const int16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        // Correct scale: full negative range is -32768, positive clamped to 32767
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32768)));
      }
      audioBytes = new Uint8Array(int16.buffer);
    } else if (audioData instanceof Uint8Array) {
      // M-8: unexpected format — log warning; we cannot safely convert without knowing source format
      console.warn('[KokoroAdapter] unexpected Uint8Array audio output — check kokoro-js version');
      audioBytes = audioData;
    } else {
      audioBytes = new Uint8Array(0);
    }

    return { audio: audioBytes, sampleRate: 24000 };
  }

  async dispose(): Promise<void> {
    this.model = null;
    this.modelLoadError = null;
    this.modelLoadPromise = null;
  }

  // L-1: Share the loading Promise so concurrent callers reuse it instead of spin-polling
  private getModel(): Promise<KokoroTTSInstance> {
    if (this.model) return Promise.resolve(this.model);
    if (this.modelLoadError) return Promise.reject(this.modelLoadError);
    if (!this.modelLoadPromise) {
      this.modelLoadPromise = (async () => {
        // C-1: kokoro-js is ESM-only — must use dynamic import(), not require()
        const kokoroModule = await import('kokoro-js' as any) as { KokoroTTS: KokoroTTSConstructor };  // eslint-disable-line @typescript-eslint/no-explicit-any
        const { KokoroTTS } = kokoroModule;
        this.model = await KokoroTTS.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          { dtype: 'q8', device: 'cpu' }
        );
        return this.model!;
      })().catch((err: Error) => {
        this.modelLoadError = err;
        this.modelLoadPromise = null;
        throw err;
      });
    }
    return this.modelLoadPromise;
  }
}
