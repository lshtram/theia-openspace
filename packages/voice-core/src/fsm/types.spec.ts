// src/fsm/types.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { DEFAULT_VOICE_POLICY, NARRATION_MODES } from './types';

describe('voice-core types', () => {
  it('DEFAULT_VOICE_POLICY has narrate-off mode', () => {
    assert.strictEqual(DEFAULT_VOICE_POLICY.narrationMode, 'narrate-off');
  });
  it('NARRATION_MODES contains all three modes', () => {
    assert.ok(NARRATION_MODES.includes('narrate-off'));
    assert.ok(NARRATION_MODES.includes('narrate-everything'));
    assert.ok(NARRATION_MODES.includes('narrate-summary'));
  });
});
