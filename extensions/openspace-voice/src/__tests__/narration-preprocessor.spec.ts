// extensions/openspace-voice/src/__tests__/narration-preprocessor.spec.ts
import { assert } from 'chai';
import { NarrationPreprocessor, type LlmCaller } from '../node/narration-preprocessor';
import type { NarrationScript } from '../common/narration-types';

const SAMPLE_SCRIPT: NarrationScript = {
  segments: [
    { type: 'utterance', utteranceId: 'hmm', priority: 'normal' },
    { type: 'speech', text: 'Here is what happened.', priority: 'normal', emotion: { kind: 'thoughtful' } },
  ],
};

const mockLlm: LlmCaller = async (_prompt: string, _text: string): Promise<string> => {
  return JSON.stringify(SAMPLE_SCRIPT);
};

describe('NarrationPreprocessor', () => {
  let preprocessor: NarrationPreprocessor;

  before(() => {
    preprocessor = new NarrationPreprocessor({
      llmCaller: mockLlm,
    });
  });

  it('narrate-off returns empty segments', async () => {
    const result = await preprocessor.process({ text: 'hello', mode: 'narrate-off' });
    assert.deepEqual(result.segments, []);
  });

  it('narrate-everything calls LLM and returns NarrationScript', async () => {
    const result = await preprocessor.process({ text: 'Run: rm -rf /tmp', mode: 'narrate-everything' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.segments[0].type, 'utterance');
    assert.equal(result.segments[1].type, 'speech');
  });

  it('narrate-summary calls LLM and returns NarrationScript', async () => {
    const result = await preprocessor.process({ text: 'Long agent response...', mode: 'narrate-summary' });
    assert.isArray(result.segments);
  });

  it('falls back to raw speech segment when LLM returns invalid JSON', async () => {
    const badLlm: LlmCaller = async () => 'not json';
    const p = new NarrationPreprocessor({ llmCaller: badLlm });
    const result = await p.process({ text: 'hello world', mode: 'narrate-everything' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].type, 'speech');
    assert.equal(result.segments[0].text, 'hello world');
  });
});
