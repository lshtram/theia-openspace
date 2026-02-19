// extensions/openspace-voice/src/common/voice-fsm.ts

export type AudioState = 'idle' | 'listening' | 'processing' | 'error';
export type AudioTrigger = 'startCapture' | 'stopCapture' | 'transcriptReady' | 'sttError' | 'reset';

export type TranscriptState = 'empty' | 'interim' | 'final' | 'editable' | 'sent';
export type TranscriptTrigger = 'interimChunk' | 'finalize' | 'enableEdit' | 'submit' | 'cancel' | 'newUtterance';

export type NarrationState = 'idle' | 'queued' | 'processing' | 'playing' | 'paused';
export type NarrationTrigger = 'enqueue' | 'startProcessing' | 'audioReady' | 'pause' | 'resume' | 'complete';

export type SessionState = 'inactive' | 'active' | 'suspended';
export type SessionTrigger = 'enable' | 'disable' | 'pushToTalkStart' | 'pushToTalkEnd';

export class VoiceFsmError extends Error {
  constructor(
    public readonly fsm: string,
    public readonly from: string,
    public readonly trigger: string,
  ) {
    super(`VoiceFSM[${fsm}]: invalid transition ${from}:${trigger}`);
    this.name = 'VoiceFsmError';
  }
}

function fail(fsm: string, from: string, trigger: string): never {
  throw new VoiceFsmError(fsm, from, trigger);
}

export function validateAudioTransition(req: { from: AudioState; trigger: AudioTrigger }): AudioState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'idle:startCapture': return 'listening';
    case 'listening:stopCapture': return 'processing';
    case 'processing:transcriptReady': return 'idle';
    case 'processing:sttError': return 'error';
    case 'error:reset': return 'idle';
    default: return fail('audio', from, trigger);
  }
}

export interface TranscriptTransitionRequest {
  from: TranscriptState;
  trigger: TranscriptTrigger;
  textPresent?: boolean;
}

export function validateTranscriptTransition(req: TranscriptTransitionRequest): TranscriptState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'empty:interimChunk':
    case 'interim:interimChunk':
      if (!req.textPresent) return fail('transcript', from, trigger);
      return 'interim';
    case 'interim:finalize': return 'final';
    case 'final:enableEdit': return 'editable';
    case 'editable:submit': return 'sent';
    case 'editable:cancel': return 'final';
    case 'sent:newUtterance': return 'interim';
    default: return fail('transcript', from, trigger);
  }
}

export function validateNarrationTransition(req: { from: NarrationState; trigger: NarrationTrigger }): NarrationState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'idle:enqueue': return 'queued';
    case 'queued:startProcessing': return 'processing';
    case 'processing:audioReady': return 'playing';
    case 'playing:pause': return 'paused';
    case 'paused:resume': return 'playing';
    case 'playing:complete': return 'idle';
    default: return fail('narration', from, trigger);
  }
}

export function validateSessionTransition(req: { from: SessionState; trigger: SessionTrigger }): SessionState {
  const { from, trigger } = req;
  switch (`${from}:${trigger}`) {
    case 'inactive:enable': return 'active';
    case 'active:disable': return 'inactive';
    case 'active:pushToTalkStart': return 'suspended';
    case 'suspended:pushToTalkEnd': return 'active';
    case 'suspended:disable': return 'inactive';
    default: return fail('session', from, trigger);
  }
}
