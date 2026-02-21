// extensions/openspace-voice/src/browser/voice-text-processor.ts

const VOCABULARY_STORAGE_KEY = 'openspace-voice-vocabulary';

export interface VocabularyEntry {
  from: string;
  to: string;
}

export interface VoiceTextProcessorOptions {
  vocabulary?: VocabularyEntry[];
}

export class VoiceTextProcessor {
  private vocabulary: VocabularyEntry[] = [];

  constructor(options: VoiceTextProcessorOptions = {}) {
    this.vocabulary = options.vocabulary || [];
  }

  loadVocabulary(): void {
    try {
      const stored = localStorage.getItem(VOCABULARY_STORAGE_KEY);
      if (stored) {
        this.vocabulary = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[VoiceText] Failed to load vocabulary:', e);
      this.vocabulary = [];
    }
  }

  saveVocabulary(): void {
    try {
      localStorage.setItem(VOCABULARY_STORAGE_KEY, JSON.stringify(this.vocabulary));
    } catch (e) {
      console.warn('[VoiceText] Failed to save vocabulary:', e);
    }
  }

  getVocabulary(): VocabularyEntry[] {
    return [...this.vocabulary];
  }

  setVocabulary(entries: VocabularyEntry[]): void {
    this.vocabulary = entries;
    this.saveVocabulary();
  }

  addEntry(from: string, to: string): void {
    const existing = this.vocabulary.findIndex(e => e.from === from);
    if (existing >= 0) {
      this.vocabulary[existing].to = to;
    } else {
      this.vocabulary.push({ from, to });
    }
    this.saveVocabulary();
  }

  removeEntry(from: string): void {
    this.vocabulary = this.vocabulary.filter(e => e.from !== from);
    this.saveVocabulary();
  }

  process(text: string): string {
    let result = text;

    // 1. Fix double spaces
    result = result.replace(/  +/g, ' ');

    // 2. Ensure single space after punctuation
    result = result.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2');

    // 3. Fix space before punctuation
    result = result.replace(/ ([.,!?;:])/g, '$1');

    // 4. Apply vocabulary replacements (longest first to avoid partial replacements)
    const sortedVocab = [...this.vocabulary].sort((a, b) => b.from.length - a.from.length);
    for (const entry of sortedVocab) {
      if (entry.from && entry.to) {
        const regex = new RegExp(this.escapeRegex(entry.from), 'gi');
        result = result.replace(regex, entry.to);
      }
    }

    return result.trim();
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
