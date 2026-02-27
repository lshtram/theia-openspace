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
    const policy = this.sessionFsm.policy;
    const modeLabel = this.getModeLabel(policy.narrationMode);

    return (
      <div className="voice-input-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px' }}>
        <button
          className={`voice-mic-button ${recording ? 'recording' : ''} ${!voiceEnabled ? 'disabled' : ''}`}
          title={recording ? 'Release to transcribe' : 'Hold to record (push-to-talk)'}
          onMouseDown={this.handleMicMouseDown}
          onMouseUp={this.handleMicMouseUp}
          onMouseLeave={this.handleMicMouseLeave}
          style={{
            background: recording ? '#e53e3e' : voiceEnabled ? '#3182ce' : '#718096',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: voiceEnabled ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: recording ? '0 0 12px rgba(229, 62, 62, 0.6)' : '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          {recording ? '\u25CF' : '\uD83C\uDFA4'}
        </button>
        {narrating && (
          <button
            className="voice-stop-narration"
            title="Stop narration"
            onClick={this.handleStopNarration}
            style={{
              background: '#dd6b20',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            {'\u23F9'}
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {recording && (
            <span style={{ color: '#e53e3e', fontSize: '11px', fontWeight: 600, animation: 'pulse 1s infinite' }}>
              {'\u25CF REC'}
            </span>
          )}
          {narrating && (
            <span style={{ color: '#68d391', fontSize: '11px', fontWeight: 600 }}>
              {'\u25B6 Speaking'}
            </span>
          )}
          {voiceEnabled && !recording && !narrating && (
            <span style={{ color: '#a0aec0', fontSize: '10px' }}>
              {modeLabel}
            </span>
          )}
          {!voiceEnabled && (
            <span style={{ color: '#718096', fontSize: '10px' }}>
              Voice Off
            </span>
          )}
        </div>
      </div>
    );
  }

  private getModeLabel(mode: string): string {
    switch (mode) {
      case 'narrate-everything': return 'Narrate All';
      case 'narrate-summary': return 'Narrate Summary';
      case 'narrate-off': return 'Mic Only';
      default: return mode;
    }
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

  private handleMicMouseLeave = async () => {
    if (!this.isRecording) return;
    this.isRecording = false;
    await this.audioFsm.stopCapture();
    this.sessionFsm.pushToTalkEnd();
    this.update();
  };

  private handleStopNarration = () => {
    this.narrationFsm.stop();
    this.update();
  };
}
