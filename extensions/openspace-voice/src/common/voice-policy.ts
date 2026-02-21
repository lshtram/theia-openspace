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
  speed: number;
  voice: string;
  language: string;
  autoDetectLanguage: boolean;
  narrationPrompts: NarrationPrompts;
}

export const DEFAULT_VOICE_POLICY: VoicePolicy = {
  enabled: true,
  narrationMode: 'narrate-off',
  speed: 1.0,
  voice: 'af_sarah',
  language: 'en-US',
  autoDetectLanguage: false,
  narrationPrompts: DEFAULT_NARRATION_PROMPTS,
};

export const SUPPORTED_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'tr-TR', name: 'Turkish' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'sv-SE', name: 'Swedish' },
  { code: 'da-DK', name: 'Danish' },
  { code: 'fi-FI', name: 'Finnish' },
  { code: 'no-NO', name: 'Norwegian' },
  { code: 'cs-CZ', name: 'Czech' },
  { code: 'el-GR', name: 'Greek' },
  { code: 'he-IL', name: 'Hebrew' },
  { code: 'th-TH', name: 'Thai' },
  { code: 'vi-VN', name: 'Vietnamese' },
  { code: 'id-ID', name: 'Indonesian' },
  { code: 'ms-MY', name: 'Malay' },
  { code: 'uk-UA', name: 'Ukrainian' },
  { code: 'ro-RO', name: 'Romanian' },
  { code: 'hu-HU', name: 'Hungarian' },
].sort((a, b) => a.name.localeCompare(b.name));

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
