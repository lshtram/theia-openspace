// extensions/openspace-voice/src/__tests__/audio-fsm.spec.ts
import { assert } from 'chai';
import { AudioFsm } from '../browser/audio-fsm';

// Mock navigator.mediaDevices for jsdom (navigator is read-only, must use Object.defineProperty)
const mockStream = { getTracks: () => [{ stop: () => {} }] } as any;
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: async (_constraints: any) => mockStream,
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
(global as any).MediaRecorder = MockMediaRecorder;

describe('AudioFsm (state transitions only — no real mic)', () => {
  let fsm: AudioFsm;
  let transcriptEvents: string[];

  beforeEach(() => {
    transcriptEvents = [];
    fsm = new AudioFsm({
      sttEndpoint: '/openspace/voice/stt',
      language: 'en-US',
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
    } catch (err: any) {
      assert.instanceOf(err, Error);
    }
  });
});
