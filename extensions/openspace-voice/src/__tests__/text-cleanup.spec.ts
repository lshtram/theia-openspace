// extensions/openspace-voice/src/__tests__/text-cleanup.spec.ts
import { assert } from 'chai';
import { cleanTextForTts } from '../common/text-cleanup';

describe('cleanTextForTts', () => {
  it('strips fenced code blocks', () => {
    const input = 'Before\n```js\nconsole.log("hi");\n```\nAfter';
    assert.equal(cleanTextForTts(input), 'Before\nAfter');
  });

  it('strips inline code', () => {
    assert.equal(cleanTextForTts('Run `npm install` now'), 'Run npm install now');
  });

  it('strips markdown bold and italic', () => {
    assert.equal(cleanTextForTts('This is **bold** and *italic*'), 'This is bold and italic');
  });

  it('strips markdown headers', () => {
    assert.equal(cleanTextForTts('## Section Title\nContent'), 'Section Title\nContent');
  });

  it('strips URLs', () => {
    assert.equal(cleanTextForTts('Visit https://example.com/path for more'), 'Visit for more');
  });

  it('collapses multiple whitespace', () => {
    assert.equal(cleanTextForTts('too   many    spaces'), 'too many spaces');
  });

  it('trims leading/trailing whitespace', () => {
    assert.equal(cleanTextForTts('  hello world  '), 'hello world');
  });

  it('handles empty input', () => {
    assert.equal(cleanTextForTts(''), '');
  });

  it('strips markdown links but keeps text', () => {
    assert.equal(cleanTextForTts('Click [here](https://example.com) now'), 'Click here now');
  });

  it('strips bullet markers', () => {
    assert.equal(cleanTextForTts('- item one\n- item two'), 'item one\nitem two');
  });

  it('strips emoji characters', () => {
    assert.equal(cleanTextForTts('Great work! 🎉 Let me check 🚀'), 'Great work! Let me check');
  });

  it('strips emoji with surrounding text intact', () => {
    assert.equal(cleanTextForTts('Hello 👋 world'), 'Hello world');
  });

  it('does not strip copyright or trademark symbols', () => {
    assert.equal(cleanTextForTts('Licensed © 2024 and ™ pending'), 'Licensed © 2024 and ™ pending');
  });
});
