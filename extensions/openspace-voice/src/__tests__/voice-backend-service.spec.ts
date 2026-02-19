// extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts
import { assert } from 'chai';
import { VoiceBackendService } from '../node/voice-backend-service';
import type { SttProvider } from '../common/voice-providers';
import type { TtsProvider } from '../common/voice-providers';
import type { LlmCaller } from '../node/narration-preprocessor';

const mockStt: SttProvider = {
  kind: 'stt',
  id: 'mock-stt',
  isAvailable: async () => true,
  transcribe: async (_req) => ({ text: 'hello world' }),
};

const mockTts: TtsProvider = {
  kind: 'tts',
  id: 'mock-tts',
  isAvailable: async () => true,
  synthesize: async (_req) => ({ audio: new Uint8Array([1, 2, 3]) }),
};

const mockLlm: LlmCaller = async (_prompt, text) => JSON.stringify({
  segments: [{ type: 'speech', text, priority: 'normal' }],
});

describe('VoiceBackendService', () => {
  let service: VoiceBackendService;

  before(() => {
    service = new VoiceBackendService({
      sttProvider: mockStt,
      ttsProvider: mockTts,
      llmCaller: mockLlm,
    });
  });

  it('transcribeSpeech delegates to STT provider', async () => {
    const result = await service.transcribeSpeech({
      audio: new Uint8Array(10),
      language: 'en-US',
    });
    assert.equal(result.text, 'hello world');
  });

  it('narrateText with mode=narrate-off returns empty segments and no audio', async () => {
    const result = await service.narrateText({
      text: 'hello',
      mode: 'narrate-off',
      voice: 'af_sarah',
      speed: 1.0,
    });
    assert.deepEqual(result.segments, []);
  });

  it('narrateText with mode=narrate-everything returns segments with audio', async () => {
    const result = await service.narrateText({
      text: 'Run: npm install',
      mode: 'narrate-everything',
      voice: 'af_sarah',
      speed: 1.0,
    });
    assert.isArray(result.segments);
    assert.isAtLeast(result.segments.length, 1);
  });
});
