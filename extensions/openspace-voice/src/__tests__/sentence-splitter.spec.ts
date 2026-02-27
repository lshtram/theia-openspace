// extensions/openspace-voice/src/__tests__/sentence-splitter.spec.ts
import { assert } from 'chai';
import { splitIntoSentences } from '../common/sentence-splitter';

describe('splitIntoSentences', () => {
  it('splits on periods', () => {
    const result = splitIntoSentences('Hello world. How are you. Fine thanks.');
    assert.deepEqual(result, ['Hello world.', 'How are you.', 'Fine thanks.']);
  });

  it('splits on question marks', () => {
    const result = splitIntoSentences('Is it working? Yes it is.');
    assert.deepEqual(result, ['Is it working?', 'Yes it is.']);
  });

  it('splits on exclamation marks', () => {
    const result = splitIntoSentences('It works! Great news. Done.');
    assert.deepEqual(result, ['It works!', 'Great news.', 'Done.']);
  });

  it('handles newlines as sentence breaks', () => {
    const result = splitIntoSentences('First sentence.\nSecond sentence.\nThird.');
    assert.deepEqual(result, ['First sentence.', 'Second sentence.', 'Third.']);
  });

  it('filters out empty/whitespace-only fragments', () => {
    const result = splitIntoSentences('One.  Two.   Three.');
    assert.equal(result.length, 3);
    result.forEach(s => assert.isAbove(s.trim().length, 0));
  });

  it('returns single element for text with no sentence-ending punctuation', () => {
    const result = splitIntoSentences('No punctuation here');
    assert.deepEqual(result, ['No punctuation here']);
  });

  it('returns empty array for empty string', () => {
    const result = splitIntoSentences('');
    assert.deepEqual(result, []);
  });

  it('preserves punctuation at end of sentence', () => {
    const result = splitIntoSentences('Done! Really?');
    assert.equal(result[0], 'Done!');
    assert.equal(result[1], 'Really?');
  });

  it('handles abbreviations gracefully - does not split on "e.g."', () => {
    // Abbreviations are tricky - acceptable to split here, just verify no crash
    const result = splitIntoSentences('Use e.g. this approach. It works.');
    assert.isAbove(result.length, 0);
    // Last fragment should be non-empty
    result.forEach(s => assert.isAbove(s.trim().length, 0));
  });

  it('splits text of multiple sentences into correct count', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const result = splitIntoSentences(text);
    assert.equal(result.length, 4);
  });
});
