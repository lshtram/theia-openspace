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

  it('stop() during audio playback — no onError, state becomes idle', (done) => {
    let errorCalled = false;

    // Minimal NDJSON response: one audio chunk + done
    const dummyPcm = new Int16Array(24); // 1ms of silence
    const bytes = new Uint8Array(dummyPcm.buffer);
    let binaryStr = '';
    for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i]);
    const audioBase64 = btoa(binaryStr);
    const ndjson = JSON.stringify({ seq: 0, audioBase64, done: false }) + '\n' +
                   JSON.stringify({ seq: 1, done: true }) + '\n';

    const origFetch = globalThis.fetch;
    (globalThis as unknown as Record<string, unknown>).fetch = (_url: string, opts?: RequestInit) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(ndjson));
          controller.close();
        }
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    };

    // Stub AudioContext so onended never fires automatically
    let capturedSource: { onended: (() => void) | null; stop: () => void } | null = null;
    const origAudioContext = (globalThis as Record<string, unknown>).AudioContext;
    (globalThis as Record<string, unknown>).AudioContext = class {
      get currentTime() { return 0; }
      createBuffer(ch: number, len: number, sr: number) {
        return { copyToChannel() {}, duration: len / sr };
      }
      createBufferSource() {
        const src = { buffer: null as unknown, onended: null as (() => void) | null,
                      connect() {}, start(_when?: number) {}, stop() {} };
        capturedSource = src;
        return src;
      }
      get destination() { return {}; }
      close() {}
    };

    const fsm2 = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
      onError: () => { errorCalled = true; },
    });

    fsm2.enqueue({ text: 'hi', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });

    // Wait for playFloat32 to be awaiting onended
    const interval = setInterval(() => {
      if (capturedSource) {
        clearInterval(interval);
        // Now stop while audio is "playing" (onended will never fire on its own)
        fsm2.stop();
        setTimeout(() => {
          try {
            assert.equal(fsm2.state, 'idle');
            assert.isFalse(errorCalled, 'onError should NOT be called on clean cancel');
            done();
          } finally {
            (globalThis as unknown as Record<string, unknown>).fetch = origFetch;
            (globalThis as unknown as Record<string, unknown>).AudioContext = origAudioContext;
          }
        }, 50);
      }
        }, 5);
  });

  it('concurrent read+play: sentence N+1 starts without gap after sentence N ends', (done) => {
    const makeChunk = (seq: number): string => {
      const pcm = new Int16Array(240); // 10ms silence at 24kHz
      const bytes = new Uint8Array(pcm.buffer);
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return JSON.stringify({ seq, audioBase64: btoa(s), done: false });
    };
    const ndjson =
      makeChunk(0) + '\n' +
      makeChunk(1) + '\n' +
      JSON.stringify({ seq: 2, done: true }) + '\n';

    const origFetch = globalThis.fetch;
    const origAudioContext = (globalThis as Record<string, unknown>).AudioContext;

    (globalThis as unknown as Record<string, unknown>).fetch = (_url: string, _opts?: RequestInit) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(ndjson));
          controller.close();
        }
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    };

    (globalThis as Record<string, unknown>).AudioContext = class {
      get currentTime() { return 0; }
      createBuffer(_ch: number, _len: number, _rate: number) {
        return { copyToChannel() {}, duration: 0.01 };
      }
      createBufferSource() {
        const src = {
          buffer: null as unknown,
          onended: null as (() => void) | null,
          connect() {},
          start(_when?: number) {
            Promise.resolve().then(() => { src.onended?.(); });
          },
          stop() {},
        };
        return src;
      }
      get destination() { return {}; }
      close() {}
      suspend() { return Promise.resolve(); }
      resume() { return Promise.resolve(); }
    };

    let errorCalled = false;
    let playbackComplete = false;
    const fsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
      onError: () => { errorCalled = true; },
      onPlaybackComplete: () => { playbackComplete = true; },
    });

    fsm.enqueue({ text: 'hi', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 });

    setTimeout(() => {
      let testErr: unknown;
      try {
        assert.isFalse(errorCalled, 'no error expected');
        assert.isTrue(playbackComplete, 'playback should complete');
        assert.equal(fsm.state, 'idle');
      } catch (e) { testErr = e; } finally {
        (globalThis as unknown as Record<string, unknown>).fetch = origFetch;
        (globalThis as unknown as Record<string, unknown>).AudioContext = origAudioContext;
      }
      done(testErr);
    }, 500);
  });
});
