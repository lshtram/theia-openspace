// extensions/openspace-voice/src/common/narration-types.ts

export type EmotionKind = 'excited' | 'concerned' | 'happy' | 'thoughtful' | 'neutral';

export interface EmotionDirective {
  kind: EmotionKind;
}

export type NarrationSegmentType = 'speech' | 'utterance';

export interface NarrationSegment {
  type: NarrationSegmentType;
  text?: string;           // type='speech'
  utteranceId?: string;    // type='utterance'
  emotion?: EmotionDirective;
  priority: 'low' | 'normal' | 'high';
}

export interface NarrationScript {
  segments: NarrationSegment[];
}

export function isValidNarrationScript(value: unknown): value is NarrationScript {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['segments'])) return false;
  return obj['segments'].every(isValidNarrationSegment);
}

function isValidNarrationSegment(seg: unknown): seg is NarrationSegment {
  if (!seg || typeof seg !== 'object') return false;
  const s = seg as Record<string, unknown>;
  if (s['type'] !== 'speech' && s['type'] !== 'utterance') return false;
  if (s['type'] === 'speech' && typeof s['text'] !== 'string') return false;
  if (s['type'] === 'utterance' && typeof s['utteranceId'] !== 'string') return false;
  return true;
}
