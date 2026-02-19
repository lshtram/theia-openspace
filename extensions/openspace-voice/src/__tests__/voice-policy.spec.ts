// extensions/openspace-voice/src/__tests__/voice-policy.spec.ts
import { assert } from 'chai';
import {
  resolveVoicePolicy,
  DEFAULT_VOICE_POLICY,
} from '../common/voice-policy';

describe('VoicePolicy', () => {
  it('returns defaults when no overrides given', () => {
    const policy = resolveVoicePolicy();
    assert.deepEqual(policy, DEFAULT_VOICE_POLICY);
  });

  it('merges overrides over defaults', () => {
    const policy = resolveVoicePolicy({ narrationMode: 'narrate-summary' });
    assert.equal(policy.narrationMode, 'narrate-summary');
    assert.equal(policy.speed, DEFAULT_VOICE_POLICY.speed);
  });

  it('throws on invalid narrationMode', () => {
    assert.throws(
      () => resolveVoicePolicy({ narrationMode: 'bad' as any }),
      /narrationMode/
    );
  });

  it('throws on speed out of range', () => {
    assert.throws(() => resolveVoicePolicy({ speed: 3 }), /speed/);
    assert.throws(() => resolveVoicePolicy({ speed: 0 }), /speed/);
  });

  it('throws on empty language', () => {
    assert.throws(() => resolveVoicePolicy({ language: '' }), /language/);
  });
});
