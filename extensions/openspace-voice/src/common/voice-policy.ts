// extensions/openspace-voice/src/common/voice-policy.ts
// Theia-specific policy: extends voice-core's VoicePolicy with narrationPrompts field.

export { NARRATION_MODES } from '@openspace-ai/voice-core';
export type { NarrationMode } from '@openspace-ai/voice-core';

export interface NarrationPrompts {
  everything: string;
  summary: string;
}

export const DEFAULT_NARRATION_PROMPTS: NarrationPrompts = {
  everything: `Convert this developer response to natural spoken text.
Strip all code blocks, replace bash commands with verbal descriptions,
expand abbreviations, and add natural pacing.
Output a NarrationScript JSON with segments of type 'speech' and 'utterance'.
Use utterance IDs from: hmm, wow, uh-oh, nice, interesting.
Add emotion fields where appropriate: excited, concerned, happy, thoughtful, neutral.`,
  summary: `You are a senior developer explaining this response to a colleague over voice.
Give a concise, conversational summary. No code, no jargon.
Focus on what matters and what to do next.
Output a NarrationScript JSON with segments of type 'speech' and 'utterance'.
Use utterance IDs from: hmm, wow, uh-oh, nice, interesting.
Add emotion fields where appropriate: excited, concerned, happy, thoughtful, neutral.`,
};

export interface VoicePolicy {
  enabled: boolean;
  narrationMode: import('@openspace-ai/voice-core').NarrationMode;
  speed: number;          // 0.5–2.0
  voice: string;          // TTS voice ID
  language: string;       // BCP-47
  narrationPrompts: NarrationPrompts;
}

export const DEFAULT_VOICE_POLICY: VoicePolicy = {
  enabled: false,
  narrationMode: 'narrate-off',
  speed: 1.0,
  voice: 'af_sarah',
  language: 'en-US',
  narrationPrompts: DEFAULT_NARRATION_PROMPTS,
};

export function resolveVoicePolicy(overrides: Partial<VoicePolicy> = {}): VoicePolicy {
  const policy = { ...DEFAULT_VOICE_POLICY, ...overrides };

  const NARRATION_MODES = ['narrate-off', 'narrate-everything', 'narrate-summary'] as const;
  if (!NARRATION_MODES.includes(policy.narrationMode)) {
    throw new Error(`narrationMode must be one of: ${NARRATION_MODES.join(', ')}`);
  }

  if (policy.speed < 0.5 || policy.speed > 2.0) {
    throw new Error(`speed must be between 0.5 and 2.0, got ${policy.speed}`);
  }

  if (!policy.language || policy.language.trim().length === 0) {
    throw new Error('language must be a non-empty BCP-47 string');
  }

  return policy;
}
