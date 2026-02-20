// Public API surface of @openspace-ai/voice-core

// Types
export type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult, CancellationToken } from './providers/stt-provider.interface';
export type { TtsProvider, TtsSynthesisRequest, TtsSynthesisResult } from './providers/tts-provider.interface';
export type { VoicePolicy, NarrationMode, AudioState, AudioTrigger, NarrationState, NarrationTrigger, SessionState, SessionTrigger } from './fsm/types';
export { DEFAULT_VOICE_POLICY, NARRATION_MODES, VoiceFsmError } from './fsm/types';

// Adapters
export { WhisperCppAdapter } from './adapters/whisper-cpp.adapter';
export type { SpawnFn } from './adapters/whisper-cpp.adapter';
export { KokoroAdapter } from './adapters/kokoro.adapter';

// FSMs
export { SessionFsm } from './fsm/session-fsm';
export { AudioFsm } from './fsm/audio-fsm';
export { NarrationFsm } from './fsm/narration-fsm';
export type { NarrationRequest } from './fsm/narration-fsm';

// Utilities
export { buildWavBuffer } from './utils/wav';
