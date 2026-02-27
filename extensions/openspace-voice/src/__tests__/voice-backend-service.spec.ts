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

describe('VoiceBackendService streaming', () => {
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

  it('narrateTextStreaming with narrate-off calls onChunk with done:true immediately', async () => {
    const doneChunks: Array<{ seq: number; done: boolean }> = [];
    await service.narrateTextStreaming(
      { text: 'hello', mode: 'narrate-off', voice: 'af_sarah', speed: 1.0 },
      (chunk) => doneChunks.push(chunk),
    );
    assert.equal(doneChunks.length, 1);
    assert.isTrue(doneChunks[0].done);
    assert.equal(doneChunks[0].seq, -1);
  });

  it('narrateTextStreaming yields one chunk per sentence', async () => {
    const received: Array<{ seq: number; audioBase64?: string; done: boolean }> = [];
    await service.narrateTextStreaming(
      { text: 'First sentence. Second sentence.', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 },
      (chunk) => received.push(chunk),
    );
    // 2 sentences + 1 done marker
    assert.equal(received.length, 3);
    assert.isFalse(received[0].done);
    assert.equal(received[0].seq, 0);
    assert.isString(received[0].audioBase64);
    assert.isFalse(received[1].done);
    assert.equal(received[1].seq, 1);
    assert.isTrue(received[2].done);
    assert.equal(received[2].seq, -1);
  });

  it('narrateTextStreaming sends cleaned text to TTS per sentence', async () => {
    const synthesized: string[] = [];
    const captureTts: TtsProvider = {
      kind: 'tts', id: 'capture',
      isAvailable: async () => true,
      synthesize: async (req) => { synthesized.push(req.text); return { audio: new Uint8Array([1, 2, 3]), sampleRate: 24000 }; },
      dispose: async () => {},
    };
    const svc = new VoiceBackendService({ sttProvider: mockStt, ttsProvider: captureTts });
    await svc.narrateTextStreaming(
      { text: '**Bold sentence.** Normal sentence.', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 },
      () => {},
    );
    // Should have synthesized cleaned text fragments
    assert.isAbove(synthesized.length, 0);
    synthesized.forEach(s => {
      assert.notInclude(s, '**', 'bold markers should be stripped');
    });
  });

  it('narrateTextStreaming returns empty for all-code text', async () => {
    const received: Array<{ done: boolean }> = [];
    await service.narrateTextStreaming(
      { text: '```js\nconsole.log("x");\n```', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 },
      (chunk) => received.push(chunk),
    );
    assert.equal(received.length, 1);
    assert.isTrue(received[0].done);
  });
});
