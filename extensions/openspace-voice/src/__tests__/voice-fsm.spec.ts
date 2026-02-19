// extensions/openspace-voice/src/__tests__/voice-fsm.spec.ts
import { assert } from 'chai';
import {
  validateAudioTransition,
  validateTranscriptTransition,
  validateNarrationTransition,
  validateSessionTransition,
  VoiceFsmError,
  type AudioState,
  type TranscriptState,
  type NarrationState,
  type SessionState,
} from '../common/voice-fsm';

describe('AudioFSM', () => {
  it('idle → listening on startCapture', () => {
    assert.equal(validateAudioTransition({ from: 'idle', trigger: 'startCapture' }), 'listening');
  });

  it('listening → processing on stopCapture', () => {
    assert.equal(validateAudioTransition({ from: 'listening', trigger: 'stopCapture' }), 'processing');
  });

  it('processing → idle on transcriptReady', () => {
    assert.equal(validateAudioTransition({ from: 'processing', trigger: 'transcriptReady' }), 'idle');
  });

  it('processing → error on sttError', () => {
    assert.equal(validateAudioTransition({ from: 'processing', trigger: 'sttError' }), 'error');
  });

  it('error → idle on reset', () => {
    assert.equal(validateAudioTransition({ from: 'error', trigger: 'reset' }), 'idle');
  });

  it('throws on invalid transition', () => {
    assert.throws(
      () => validateAudioTransition({ from: 'idle', trigger: 'stopCapture' }),
      VoiceFsmError
    );
  });
});

describe('TranscriptFSM', () => {
  it('empty → interim on interimChunk', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'empty', trigger: 'interimChunk', textPresent: true }),
      'interim'
    );
  });

  it('interim → final on finalize', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'interim', trigger: 'finalize' }),
      'final'
    );
  });

  it('final → editable on enableEdit', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'final', trigger: 'enableEdit' }),
      'editable'
    );
  });

  it('editable → sent on submit', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'editable', trigger: 'submit' }),
      'sent'
    );
  });

  it('sent → interim on newUtterance', () => {
    assert.equal(
      validateTranscriptTransition({ from: 'sent', trigger: 'newUtterance' }),
      'interim'
    );
  });
});

describe('NarrationFSM', () => {
  it('idle → queued on enqueue', () => {
    assert.equal(validateNarrationTransition({ from: 'idle', trigger: 'enqueue' }), 'queued');
  });

  it('queued → processing on startProcessing', () => {
    assert.equal(validateNarrationTransition({ from: 'queued', trigger: 'startProcessing' }), 'processing');
  });

  it('processing → playing on audioReady', () => {
    assert.equal(validateNarrationTransition({ from: 'processing', trigger: 'audioReady' }), 'playing');
  });

  it('playing → paused on pause', () => {
    assert.equal(validateNarrationTransition({ from: 'playing', trigger: 'pause' }), 'paused');
  });

  it('paused → playing on resume', () => {
    assert.equal(validateNarrationTransition({ from: 'paused', trigger: 'resume' }), 'playing');
  });

  it('playing → idle on complete', () => {
    assert.equal(validateNarrationTransition({ from: 'playing', trigger: 'complete' }), 'idle');
  });
});

describe('SessionFSM', () => {
  it('inactive → active on enable', () => {
    assert.equal(validateSessionTransition({ from: 'inactive', trigger: 'enable' }), 'active');
  });

  it('active → inactive on disable', () => {
    assert.equal(validateSessionTransition({ from: 'active', trigger: 'disable' }), 'inactive');
  });

  it('active → suspended on pushToTalkStart', () => {
    assert.equal(validateSessionTransition({ from: 'active', trigger: 'pushToTalkStart' }), 'suspended');
  });

  it('suspended → active on pushToTalkEnd', () => {
    assert.equal(validateSessionTransition({ from: 'suspended', trigger: 'pushToTalkEnd' }), 'active');
  });
});
