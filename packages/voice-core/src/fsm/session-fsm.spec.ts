// src/fsm/session-fsm.spec.ts
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { SessionFsm } from './session-fsm';
import { VoiceFsmError } from './types';

describe('SessionFsm', () => {
  it('starts inactive', () => {
    expect(new SessionFsm().state).to.equal('inactive');
  });
  it('inactive → active on enable()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    expect(fsm.state).to.equal('active');
  });
  it('enable() is idempotent when already active', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    expect(() => fsm.enable()).to.not.throw(); // no throw on double-enable
    expect(fsm.state).to.equal('active');
  });
  it('active → suspended on pushToTalkStart()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    fsm.pushToTalkStart();
    expect(fsm.state).to.equal('suspended');
  });
  it('suspended → active on pushToTalkEnd()', () => {
    const fsm = new SessionFsm();
    fsm.enable();
    fsm.pushToTalkStart();
    fsm.pushToTalkEnd();
    expect(fsm.state).to.equal('active');
  });
  it('throws VoiceFsmError on invalid transition', () => {
    const fsm = new SessionFsm();
    expect(() => fsm.pushToTalkStart()).to.throw(VoiceFsmError);
  });
  it('updatePolicy merges partial fields', () => {
    const fsm = new SessionFsm();
    fsm.updatePolicy({ voice: 'bm_george' });
    expect(fsm.policy.voice).to.equal('bm_george');
    expect(fsm.policy.speed).to.equal(1.0); // unchanged default
  });
});
