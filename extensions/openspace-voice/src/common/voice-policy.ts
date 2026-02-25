// extensions/openspace-voice/src/common/voice-policy.ts
// Theia-specific policy: extends voice-core's VoicePolicy with narrationPrompts field.

export { NARRATION_MODES } from '@openspace-ai/voice-core';
export type { NarrationMode } from '@openspace-ai/voice-core';

export interface NarrationPrompts {
  everything: string;
  summary: string;
}

export const DEFAULT_NARRATION_PROMPTS: NarrationPrompts = {
  everything: `You are converting a developer response to natural spoken text for voice narration.
Instructions:
- Strip all code blocks and technical syntax
- Replace bash commands with brief verbal descriptions (e.g., "run the build command")
- Expand abbreviations (e.g., "API" becomes "the API", "config" becomes "configuration")
- Add natural pacing with brief pauses indicated by commas
- Keep it conversational but concise
- Do NOT summarize - read the key points only

Output ONLY a NarrationScript JSON object with this structure:
{
  "segments": [
    {"type": "speech", "text": "spoken text here", "priority": "normal|high|low"},
    {"type": "utterance", "utteranceId": "hmm|wow|uh-oh|nice|interesting", "emotion": {"kind": "excited|concerned|happy|thoughtful|neutral"}}
  ]
}
Use utterance sparingly (max 1-2 per response) to sound natural.`,
  summary: `You are a senior developer giving a quick verbal update to a colleague.
The response you received contains technical information. Your goal is to:
- Summarize in 1-3 sentences what happened or what was done
- Skip all code, file paths, and technical details
- Focus on the "so what" - the outcome or next step
- Sound like you're talking, not writing

Example: "Alright, so I fixed that authentication bug. Should be working now. Let me know if you see any issues."

Output ONLY a NarrationScript JSON:
{
  "segments": [
    {"type": "speech", "text": "summary text", "priority": "normal"},
    {"type": "utterance", "utteranceId": "hmm|wow|nice", "emotion": {"kind": "happy|thoughtful|neutral"}}
  ]
}
Keep it brief - 15 words or fewer.`,
};

export const SUPPORTED_VOICES = [
  'af_sarah',
  'am_adam',
  'af_bella',
  'af_nicole',
  'am_michael',
  'bf_emma',
  'bm_george',
] as const;

export type SupportedVoiceId = typeof SUPPORTED_VOICES[number];

export interface VoicePolicy {
  enabled: boolean;
  narrationMode: import('@openspace-ai/voice-core').NarrationMode;
  speed: number;
  voice: SupportedVoiceId | string;
  language: string;
  autoDetectLanguage: boolean;
  narrationPrompts: NarrationPrompts;
}

export const DEFAULT_VOICE_POLICY: VoicePolicy = {
  enabled: true,
  narrationMode: 'narrate-everything',
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

  if (!policy.voice || policy.voice.trim().length === 0) {
    throw new Error('voice cannot be empty');
  }

  if (!SUPPORTED_VOICES.includes(policy.voice as SupportedVoiceId)) {
    throw new Error(`voice must be one of: ${SUPPORTED_VOICES.join(', ')}`);
  }

  return policy;
}
