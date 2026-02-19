// extensions/openspace-voice/src/node/tts/kokoro-adapter.ts
import type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from '../../common/voice-providers';

// Lazy-loaded kokoro model (optional runtime dependency)
let kokoroModel: import('kokoro-js').KokoroTTS | null = null;
let kokoroLoading = false;
let kokoroLoadError: Error | null = null;

async function getKokoroModel(): Promise<import('kokoro-js').KokoroTTS> {
  if (kokoroModel) return kokoroModel;
  if (kokoroLoadError) throw kokoroLoadError;
  if (kokoroLoading) {
    while (kokoroLoading) await new Promise(r => setTimeout(r, 100));
    if (kokoroLoadError) throw kokoroLoadError;
    return kokoroModel!;
  }
  kokoroLoading = true;
  try {
    const { KokoroTTS } = await import('kokoro-js');
    kokoroModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
    });
    kokoroLoading = false;
    return kokoroModel!;
  } catch (err) {
    kokoroLoadError = err as Error;
    kokoroLoading = false;
    throw err;
  }
}

export class KokoroAdapter implements TtsProvider {
  readonly kind = 'tts' as const;
  readonly id = 'kokoro';

  async isAvailable(): Promise<boolean> {
    try {
      await import('kokoro-js');
      return true;
    } catch {
      return false;
    }
  }

  async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
    const model = await getKokoroModel();
    const voice = request.voice ?? 'af_sarah';
    const audio = await model.generate(request.text, { voice });

    let audioBytes: Uint8Array;
    const audioData = audio?.data;
    if (audioData instanceof Float32Array) {
      const int16 = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        int16[i] = Math.max(-1, Math.min(1, audioData[i])) * 32767;
      }
      audioBytes = new Uint8Array(int16.buffer);
    } else if (audioData instanceof Uint8Array) {
      audioBytes = audioData;
    } else {
      audioBytes = new Uint8Array(0);
    }

    return { audio: audioBytes };
  }
}
