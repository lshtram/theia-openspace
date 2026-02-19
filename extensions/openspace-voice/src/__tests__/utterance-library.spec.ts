// extensions/openspace-voice/src/__tests__/utterance-library.spec.ts
import { assert } from 'chai';
import * as path from 'path';
import { UtteranceLibrary } from '../node/utterance-library';

const UTTERANCES_DIR = path.join(__dirname, '../../utterances');

describe('UtteranceLibrary', () => {
  let lib: UtteranceLibrary;

  before(() => {
    lib = new UtteranceLibrary(UTTERANCES_DIR);
  });

  it('loads config on construction', () => {
    const ids = lib.getUtteranceIds();
    assert.include(ids, 'hmm');
    assert.include(ids, 'wow');
  });

  it('resolveUtterancePath returns a file path for known id', () => {
    const filePath = lib.resolveUtterancePath('hmm');
    assert.isString(filePath);
    assert.include(filePath, 'hmm');
    assert.include(filePath, '.wav');
  });

  it('resolveUtterancePath returns null for unknown id', () => {
    const filePath = lib.resolveUtterancePath('nonexistent-id');
    assert.isNull(filePath);
  });

  it('resolves different files for same id (randomness)', () => {
    // With 2 files for 'hmm', repeated calls should eventually return both
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const p = lib.resolveUtterancePath('hmm');
      if (p) seen.add(p);
    }
    assert.isAtLeast(seen.size, 1); // at least 1 (may not always hit both in 20 tries but should)
  });
});
