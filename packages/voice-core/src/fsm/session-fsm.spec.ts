// src/fsm/session-fsm.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { SessionFsm } from './session-fsm';
import { VoiceFsmError } from './types';

describe('SessionFsm', () => {
  it('starts inactive', () => {
    assert.strictEqual(new SessionFsm().state, 'inactive');
  });
  it('inactive → active on enable()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    assert.strictEqual(fsm.state, 'active');
  });
  it('enable() is idempotent when already active', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    assert.doesNotThrow(() => fsm.enable()); // no throw on double-enable
    assert.strictEqual(fsm.state, 'active');
  });
  it('active → suspended on pushToTalkStart()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    fsm.pushToTalkStart();
    assert.strictEqual(fsm.state, 'suspended');
  });
  it('suspended → active on pushToTalkEnd()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    fsm.pushToTalkStart();
    fsm.pushToTalkEnd();
    assert.strictEqual(fsm.state, 'active');
  });
  it('throws VoiceFsmError on invalid transition', () => {
    const fsm = new SessionFsm();
    assert.throws(() => fsm.pushToTalkStart(), VoiceFsmError);
  });
  it('updatePolicy merges partial fields', () => {
    const fsm = new SessionFsm();
    fsm.updatePolicy({ voice: 'bm_george' });
    assert.strictEqual(fsm.policy.voice, 'bm_george');
    assert.strictEqual(fsm.policy.speed, 1.0); // unchanged default
  });
});
