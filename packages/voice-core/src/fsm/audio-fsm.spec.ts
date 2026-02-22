// src/fsm/audio-fsm.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { AudioFsm } from './audio-fsm';
import { VoiceFsmError } from './types';

describe('AudioFsm', () => {
  it('starts idle', () => assert.strictEqual(new AudioFsm().state, 'idle'));
  it('idle → listening → processing → idle', () => {
    const fsm = new AudioFsm();
    fsm.startCapture();
    assert.strictEqual(fsm.state, 'listening');
    fsm.stopCapture();
    assert.strictEqual(fsm.state, 'processing');
    fsm.transcriptReady();
    assert.strictEqual(fsm.state, 'idle');
  });
  it('processing → error → idle via reset()', () => {
    const fsm = new AudioFsm();
    fsm.startCapture();
    fsm.stopCapture();
    fsm.error();
    assert.strictEqual(fsm.state, 'error');
    fsm.reset();
    assert.strictEqual(fsm.state, 'idle');
  });
  it('throws VoiceFsmError on invalid transition', () => {
    assert.throws(() => new AudioFsm().stopCapture(), VoiceFsmError);
  });
});
