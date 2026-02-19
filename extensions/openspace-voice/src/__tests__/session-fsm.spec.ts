// extensions/openspace-voice/src/__tests__/session-fsm.spec.ts
import { assert } from 'chai';
import { SessionFsm } from '../browser/session-fsm';
import { DEFAULT_VOICE_POLICY } from '../common/voice-policy';

describe('SessionFsm', () => {
  let fsm: SessionFsm;

  beforeEach(() => {
    fsm = new SessionFsm();
  });

  it('starts inactive', () => {
    assert.equal(fsm.state, 'inactive');
  });

  it('enable → active', () => {
    fsm.enable();
    assert.equal(fsm.state, 'active');
  });

  it('active → disabled → inactive', () => {
    fsm.enable();
    fsm.disable();
    assert.equal(fsm.state, 'inactive');
  });

  it('pushToTalkStart suspends when active', () => {
    fsm.enable();
    fsm.pushToTalkStart();
    assert.equal(fsm.state, 'suspended');
  });

  it('pushToTalkEnd restores active from suspended', () => {
    fsm.enable();
    fsm.pushToTalkStart();
    fsm.pushToTalkEnd();
    assert.equal(fsm.state, 'active');
  });

  it('updatePolicy merges partial update', () => {
    fsm.updatePolicy({ narrationMode: 'narrate-summary' });
    assert.equal(fsm.policy.narrationMode, 'narrate-summary');
    assert.equal(fsm.policy.speed, DEFAULT_VOICE_POLICY.speed);
  });

  it('policy is immutable copy', () => {
    const p1 = fsm.policy;
    fsm.updatePolicy({ speed: 1.5 });
    const p2 = fsm.policy;
    assert.equal(p1.speed, DEFAULT_VOICE_POLICY.speed);
    assert.equal(p2.speed, 1.5);
  });
});
