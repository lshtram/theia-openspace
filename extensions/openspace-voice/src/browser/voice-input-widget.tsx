// extensions/openspace-voice/src/browser/voice-input-widget.tsx
import * as React from '@theia/core/shared/react';
import { injectable, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { SessionFsm } from './session-fsm';
import { AudioFsm } from './audio-fsm';
import { NarrationFsm } from './narration-fsm';

@injectable()
export class VoiceInputWidget extends ReactWidget {
  @inject(SessionFsm) private readonly sessionFsm!: SessionFsm;
  @inject(AudioFsm) private readonly audioFsm!: AudioFsm;
  @inject(NarrationFsm) private readonly narrationFsm!: NarrationFsm;

  private isRecording = false;

  protected render(): React.ReactNode {
    const voiceEnabled = this.sessionFsm.state !== 'inactive';
    const recording = this.isRecording;
    const narrating = this.narrationFsm.state === 'playing';

    return (
      <div className="voice-input-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className={`voice-mic-button ${recording ? 'recording' : ''} ${!voiceEnabled ? 'disabled' : ''}`}
          title={recording ? 'Release to transcribe' : 'Hold to record (push-to-talk)'}
          onMouseDown={this.handleMicMouseDown}
          onMouseUp={this.handleMicMouseUp}
          style={{
            background: recording ? '#e53e3e' : voiceEnabled ? '#3182ce' : '#718096',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: voiceEnabled ? 'pointer' : 'not-allowed',
          }}
        >
          {'\uD83C\uDFA4'}
        </button>
        {narrating && (
          <button
            className="voice-stop-narration"
            title="Stop narration"
            onClick={this.handleStopNarration}
            style={{ background: '#dd6b20', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px' }}
          >
            {'\u23F9'}
          </button>
        )}
        {recording && <span style={{ color: '#e53e3e', fontSize: '12px' }}>{'● REC'}</span>}
      </div>
    );
  }

  private handleMicMouseDown = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (this.sessionFsm.state === 'inactive') return;
    this.sessionFsm.pushToTalkStart();
    if (this.narrationFsm.state === 'playing') {
      this.narrationFsm.pause();
    }
    this.isRecording = true;
    await this.audioFsm.startCapture();
    this.update();
  };

  private handleMicMouseUp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!this.isRecording) return;
    this.isRecording = false;
    await this.audioFsm.stopCapture();
    this.sessionFsm.pushToTalkEnd();
    this.update();
  };

  private handleStopNarration = () => {
    this.narrationFsm.pause();
    this.update();
  };
}
