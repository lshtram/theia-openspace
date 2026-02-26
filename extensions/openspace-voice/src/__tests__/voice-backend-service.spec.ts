// extensions/openspace-voice/src/__tests__/voice-backend-service.spec.ts
import { assert } from 'chai';
import { VoiceBackendService } from '../node/voice-backend-service';
import type { SttProvider } from '@openspace-ai/voice-core';
import type { TtsProvider } from '@openspace-ai/voice-core';

const mockStt: SttProvider = {
  kind: 'stt',
  id: 'mock-stt',
  isAvailable: async () => true,
  transcribe: async (_req) => ({ text: 'hello world' }),
};

let lastSynthesizedText = '';
const mockTts: TtsProvider = {
  kind: 'tts',
  id: 'mock-tts',
  isAvailable: async () => true,
  synthesize: async (req) => {
    lastSynthesizedText = req.text;
    return { audio: new Uint8Array([1, 2, 3]), sampleRate: 24000 };
  },
  dispose: async () => { /* no-op */ },
};

describe('VoiceBackendService', () => {
  let service: VoiceBackendService;

  before(() => {
    service = new VoiceBackendService({
      sttProvider: mockStt,
      ttsProvider: mockTts,
    });
  });

  beforeEach(() => {
    lastSynthesizedText = '';
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

  it('narrateText strips markdown before sending to TTS', async () => {
    const result = await service.narrateText({
      text: 'This is **bold** and `code`',
      mode: 'narrate-everything',
      voice: 'af_sarah',
      speed: 1.0,
    });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].type, 'speech');
    assert.isString(result.segments[0].audioBase64);
    // Verify the text sent to TTS was cleaned
    assert.equal(lastSynthesizedText, 'This is bold and code');
  });

  it('narrateText returns empty segments when text is only code blocks', async () => {
    const result = await service.narrateText({
      text: '```js\nconsole.log("hi");\n```',
      mode: 'narrate-everything',
      voice: 'af_sarah',
      speed: 1.0,
    });
    assert.deepEqual(result.segments, []);
  });
});
