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

  it('stop() while queued returns to idle without calling onError', (done) => {
    let errorCalled = false;
    let modeChanges: string[] = [];
    const fsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
      onError: () => { errorCalled = true; },
      onModeChange: (m) => { modeChanges.push(m); },
    });
    fsm.enqueue({ text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });
    // stop immediately before drain loop can do anything
    fsm.stop();
    // Give drain loop a tick to settle
    setTimeout(() => {
      assert.equal(fsm.state, 'idle');
      assert.isFalse(errorCalled);
      done();
    }, 50);
  });

  it('stop() transitions state to idle synchronously', () => {
    const fsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
    });
    fsm.enqueue({ text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });
    fsm.stop();
    assert.equal(fsm.state, 'idle');
  });
});
