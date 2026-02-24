// src/fsm/audio-fsm.spec.ts
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { AudioFsm } from './audio-fsm';
import { VoiceFsmError } from './types';

describe('AudioFsm', () => {
  it('starts idle', () => expect(new AudioFsm().state).to.equal('idle'));
  it('idle → listening → processing → idle', () => {
    const fsm = new AudioFsm();
    fsm.startCapture();
    expect(fsm.state).to.equal('listening');
    fsm.stopCapture();
    expect(fsm.state).to.equal('processing');
    fsm.transcriptReady();
    expect(fsm.state).to.equal('idle');
  });
  it('processing → error → idle via reset()', () => {
    const fsm = new AudioFsm();
    fsm.startCapture();
    fsm.stopCapture();
    fsm.error();
    expect(fsm.state).to.equal('error');
    fsm.reset();
    expect(fsm.state).to.equal('idle');
  });
  it('throws VoiceFsmError on invalid transition', () => {
    expect(() => new AudioFsm().stopCapture()).to.throw(VoiceFsmError);
  });
});
