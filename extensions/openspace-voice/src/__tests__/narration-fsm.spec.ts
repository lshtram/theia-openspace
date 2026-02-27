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
      assert.deepEqual(modeChanges, ['idle']);
      done();
    }, 50);
  });

  it('stop() while fetching aborts cleanly — no onError, state becomes idle', (done) => {
    let errorCalled = false;
    let abortSignal: AbortSignal | undefined;

    const origFetch = globalThis.fetch;
    // Stub fetch: hang until aborted
    (globalThis as unknown as Record<string, unknown>).fetch = (_url: string, opts?: RequestInit) => {
      abortSignal = opts?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }
      });
    };

    const fsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
      onError: () => { errorCalled = true; },
    });

    fsm.enqueue({ text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });

    // Wait one tick so drainLoop has started and fetch is in flight
    setTimeout(() => {
      try {
        fsm.stop(); // aborts the fetch
        setTimeout(() => {
          try {
            assert.equal(fsm.state, 'idle');
            assert.isFalse(errorCalled);
            assert.isDefined(abortSignal, 'fetch should have received an AbortSignal');
            assert.isTrue(abortSignal!.aborted, 'signal should be aborted after stop()');
            done();
          } finally {
            (globalThis as unknown as Record<string, unknown>).fetch = origFetch;
          }
        }, 50);
      } catch (e) {
        (globalThis as unknown as Record<string, unknown>).fetch = origFetch;
        done(e);
      }
    }, 10);
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
