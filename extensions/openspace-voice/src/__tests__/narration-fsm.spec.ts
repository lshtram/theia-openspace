// extensions/openspace-voice/src/__tests__/narration-fsm.spec.ts
import { assert } from 'chai';
import { NarrationFsm } from '../browser/narration-fsm';

describe('NarrationFsm (state transitions only)', () => {
  let fsm: NarrationFsm;
  const mockNarrateEndpoint = '/openspace/voice/narrate';

  beforeEach(() => {
    fsm = new NarrationFsm({
      narrateEndpoint: mockNarrateEndpoint,
      utteranceBaseUrl: '/openspace/voice/utterances',
    });
  });

  it('starts idle', () => {
    assert.equal(fsm.state, 'idle');
  });

  it('enqueue transitions to queued', () => {
    fsm.enqueue({ text: 'hello', mode: 'narrate-off', voice: 'af_sarah', speed: 1.0 });
    assert.equal(fsm.state, 'queued');
  });

  it('pause/resume only valid when playing', () => {
    assert.throws(() => fsm.pause()); // can't pause when idle
  });
});
