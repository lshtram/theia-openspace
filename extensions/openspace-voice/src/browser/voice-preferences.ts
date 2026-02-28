// extensions/openspace-voice/src/browser/voice-preferences.ts
import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';
import { SUPPORTED_VOICES } from '../common/voice-policy';

export const VoicePreferenceKeys = {
  ENABLED:              'openspace.voice.enabled'            as const,
  NARRATION_MODE:       'openspace.voice.narrationMode'      as const,
  VOICE:                'openspace.voice.voice'              as const,
  SPEED:                'openspace.voice.speed'              as const,
  LANGUAGE:             'openspace.voice.language'           as const,
  AUTO_DETECT_LANGUAGE: 'openspace.voice.autoDetectLanguage' as const,
};

export const VoicePreferenceSchema: PreferenceSchema = {
  properties: {
    [VoicePreferenceKeys.ENABLED]: {
      type: 'boolean',
      default: true,
      description: 'Enable voice input and narration.',
    },
    [VoicePreferenceKeys.NARRATION_MODE]: {
      type: 'string',
      enum: ['narrate-off', 'narrate-everything', 'narrate-summary'],
      default: 'narrate-everything',
      description: 'How assistant replies are narrated. "narrate-off" disables narration; "narrate-everything" reads replies in full; "narrate-summary" speaks a one-sentence summary.',
    },
    [VoicePreferenceKeys.VOICE]: {
      type: 'string',
      enum: [...SUPPORTED_VOICES],
      default: 'af_sarah',
      description: 'Kokoro TTS voice ID.',
    },
    [VoicePreferenceKeys.SPEED]: {
      type: 'number',
      default: 1.0,
      minimum: 0.5,
      maximum: 2.0,
      description: 'TTS playback speed (0.5 – 2.0).',
    },
    [VoicePreferenceKeys.LANGUAGE]: {
      type: 'string',
      default: 'en-US',
      description: 'BCP-47 language code for speech recognition (e.g. "en-US", "fr-FR").',
    },
    [VoicePreferenceKeys.AUTO_DETECT_LANGUAGE]: {
      type: 'boolean',
      default: false,
      description: 'When enabled, Whisper automatically detects the spoken language.',
    },
  },
};
