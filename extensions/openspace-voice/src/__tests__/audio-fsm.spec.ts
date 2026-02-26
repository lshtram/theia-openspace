// extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts
import { assert } from 'chai';
import { AudioFsm } from '../browser/audio-fsm';

interface MockStream {
    getTracks: () => Array<{ stop: () => void }>;
}

// Mock navigator.mediaDevices for jsdom (navigator is read-only, must use Object.defineProperty).
// jsdom defines userAgent and platform as prototype getters, not own enumerable properties —
// spread alone misses them. Read them explicitly before overriding so transitive deps
// (@lumino/domutils reads platform, react-dom reads userAgent) don't see undefined.
const mockStream: MockStream = { getTracks: () => [{ stop: () => {} }] };
const _origNavigator = (global as { navigator?: { userAgent?: string; platform?: string } }).navigator || {};
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: _origNavigator.userAgent,
    platform: _origNavigator.platform,
    mediaDevices: {
      getUserMedia: async (_constraints: unknown) => mockStream,
    },
  },
  configurable: true,
  writable: true,
});

// Mock MediaRecorder for jsdom (not available in jsdom)
class MockMediaRecorder {
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {}
  stop() { setTimeout(() => this.onstop && this.onstop(), 0); }
}
(global as unknown as { MediaRecorder?: typeof MockMediaRecorder }).MediaRecorder = MockMediaRecorder;

describe('AudioFsm (state transitions only — no real mic)', () => {
  let fsm: AudioFsm;
  let transcriptEvents: string[];

  beforeEach(() => {
    transcriptEvents = [];
    fsm = new AudioFsm({
      sttEndpoint: '/openspace/voice/stt',
      language: 'en-US',
      autoDetectLanguage: false,
      onTranscript: (text) => transcriptEvents.push(text),
    });
  });

  it('starts in idle state', () => {
    assert.equal(fsm.state, 'idle');
  });

  it('startCapture → listening (with mock stream)', async () => {
    await fsm.startCapture();
    assert.equal(fsm.state, 'listening');
  });

  it('cannot start from non-idle state', async () => {
    await fsm.startCapture();
    try {
      await fsm.startCapture();
      assert.fail('should have thrown');
    } catch (err: unknown) {
      assert.instanceOf(err, Error);
    }
  });
});
