// extensions/openspace-voice/src/common/text-cleanup.ts

/**
 * Clean text for TTS narration by stripping markdown, code, URLs, etc.
 * Produces plain spoken-language text.
 */
export function cleanTextForTts(text: string): string {
  let result = text;

  // Strip fenced code blocks (``` ... ```)
  result = result.replace(/```[\s\S]*?```/g, '');

  // Strip markdown links [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Strip URLs
  result = result.replace(/https?:\/\/[^\s)]+/g, '');

  // Strip inline code
  result = result.replace(/`([^`]*)`/g, '$1');

  // Strip markdown headers (## etc.)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Strip bold/italic markers
  result = result.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1');
  result = result.replace(/_{1,3}(.*?)_{1,3}/g, '$1');

  // Strip bullet markers
  result = result.replace(/^[-*+]\s+/gm, '');

  // Strip emoji (Unicode emoji presentation + extended pictographic + variation selectors)
  result = result.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');

  // Collapse multiple whitespace (but preserve single newlines)
  result = result.replace(/[^\S\n]+/g, ' ');

  // Collapse multiple newlines into a single newline
  result = result.replace(/\n{2,}/g, '\n');

  return result.trim();
}
