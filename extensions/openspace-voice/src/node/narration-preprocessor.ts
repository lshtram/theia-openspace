// extensions/openspace-voice/src/node/narration-preprocessor.ts
import type { NarrationMode, NarrationPrompts } from '../common/voice-policy';
import { DEFAULT_NARRATION_PROMPTS } from '../common/voice-policy';
import { isValidNarrationScript, type NarrationScript } from '../common/narration-types';

export type LlmCaller = (prompt: string, text: string) => Promise<string>;

export interface NarrationPreprocessorOptions {
  llmCaller: LlmCaller;
  prompts?: Partial<NarrationPrompts>;
}

export interface NarrationRequest {
  text: string;
  mode: NarrationMode;
}

export class NarrationPreprocessor {
  private readonly llmCaller: LlmCaller;
  private readonly prompts: NarrationPrompts;

  constructor(options: NarrationPreprocessorOptions) {
    this.llmCaller = options.llmCaller;
    this.prompts = {
      everything: options.prompts?.everything ?? DEFAULT_NARRATION_PROMPTS.everything,
      summary: options.prompts?.summary ?? DEFAULT_NARRATION_PROMPTS.summary,
    };
  }

  async process(request: NarrationRequest): Promise<NarrationScript> {
    if (request.mode === 'narrate-off') {
      return { segments: [] };
    }

    const prompt = request.mode === 'narrate-everything'
      ? this.prompts.everything
      : this.prompts.summary;

    try {
      const raw = await this.llmCaller(prompt, request.text);

      // Extract JSON from potential markdown code block
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/) ?? null;
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

      const parsed: unknown = JSON.parse(jsonStr);
      if (isValidNarrationScript(parsed)) {
        return parsed;
      }
      throw new Error('Invalid NarrationScript structure');
    } catch (err) {
      // Graceful fallback: return raw text as a single speech segment
      console.warn('[NarrationPreprocessor] LLM preprocessing failed, falling back to raw text:', err);
      return {
        segments: [{
          type: 'speech',
          text: request.text,
          priority: 'normal',
        }],
      };
    }
  }
}
