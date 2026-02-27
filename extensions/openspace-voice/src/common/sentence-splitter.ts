// extensions/openspace-voice/src/common/sentence-splitter.ts

/**
 * Split plain text into individual sentences for incremental TTS synthesis.
 *
 * Strategy:
 * - Split on [.!?] followed by whitespace or end-of-string (keeps punctuation with sentence)
 * - Split on newlines (each line is a separate unit)
 * - Filter out empty/whitespace-only fragments
 *
 * This is intentionally simple — TTS quality doesn't depend on perfect sentence
 * boundary detection, and false splits only add a tiny synthesis overhead.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  // The regex keeps the punctuation with the sentence (positive lookbehind).
  // Also split on newlines.
  const raw = text
    .split(/(?<=[.!?])\s+|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // If no splits occurred (e.g., no punctuation), return the whole text as one sentence
  if (raw.length === 0) return [];
  return raw;
}
