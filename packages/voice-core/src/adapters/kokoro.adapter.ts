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
  private modelLoading = false;
  private modelLoadError: Error | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('kokoro-js');
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
      audioBytes = audioData;
    } else {
      audioBytes = new Uint8Array(0);
    }

    return { audio: audioBytes, sampleRate: 24000 };
  }

  async dispose(): Promise<void> {
    this.model = null;
    this.modelLoadError = null;
  }

  private async getModel(): Promise<KokoroTTSInstance> {
    if (this.model) return this.model;
    if (this.modelLoadError) throw this.modelLoadError;
    if (this.modelLoading) {
      // Poll until loading completes
      while (this.modelLoading) await new Promise(r => setTimeout(r, 100));
      if (this.modelLoadError) throw this.modelLoadError;
      return this.model!;
    }

    this.modelLoading = true;
    try {
      // kokoro-js is ESM-only, use require() in CommonJS context
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const kokoroModule = require('kokoro-js') as { KokoroTTS: KokoroTTSConstructor };
      this.model = await kokoroModule.KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        { dtype: 'q8', device: 'cpu' }
      );
      return this.model!;
    } catch (err) {
      this.modelLoadError = err as Error;
      throw err;
    } finally {
      this.modelLoading = false;
    }
  }
}
