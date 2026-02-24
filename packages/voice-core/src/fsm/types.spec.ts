// src/fsm/types.spec.ts
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { DEFAULT_VOICE_POLICY, NARRATION_MODES } from './types';

describe('voice-core types', () => {
  it('DEFAULT_VOICE_POLICY has narrate-off mode', () => {
    expect(DEFAULT_VOICE_POLICY.narrationMode).to.equal('narrate-off');
  });
  it('NARRATION_MODES contains all three modes', () => {
    expect(NARRATION_MODES.includes('narrate-off')).to.equal(true);
    expect(NARRATION_MODES.includes('narrate-everything')).to.equal(true);
    expect(NARRATION_MODES.includes('narrate-summary')).to.equal(true);
  });
});
