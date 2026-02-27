// extensions/openspace-voice/src/__tests__/ndjson-stream.spec.ts
import { assert } from 'chai';
import { parseNdjsonLines } from '../browser/narration-fsm';

describe('parseNdjsonLines', () => {
  it('parses multiple complete lines', () => {
    const input = '{"seq":0,"done":false}\n{"seq":1,"done":false}\n{"seq":-1,"done":true}\n';
    const result = parseNdjsonLines(input);
    assert.equal(result.length, 3);
    assert.equal(result[0].seq, 0);
    assert.isFalse(result[0].done);
    assert.equal(result[2].seq, -1);
    assert.isTrue(result[2].done);
  });

  it('handles partial last line gracefully (returns only complete lines)', () => {
    const input = '{"seq":0,"done":false}\n{"seq":1,"done":fals';
    const result = parseNdjsonLines(input);
    assert.equal(result.length, 1);
    assert.equal(result[0].seq, 0);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseNdjsonLines(''), []);
  });

  it('ignores empty lines', () => {
    const input = '{"seq":0,"done":false}\n\n{"seq":-1,"done":true}\n';
    const result = parseNdjsonLines(input);
    assert.equal(result.length, 2);
  });
});
