// extensions/openspace-voice/src/node/utterance-library.ts
import * as fs from 'fs';
import * as path from 'path';

type UtteranceConfig = Record<string, string[]>;

export class UtteranceLibrary {
  private readonly config: UtteranceConfig;

  constructor(private readonly utterancesDir: string) {
    const configPath = path.join(utterancesDir, 'config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(raw) as UtteranceConfig;
  }

  getUtteranceIds(): string[] {
    return Object.keys(this.config);
  }

  resolveUtterancePath(id: string): string | null {
    const files = this.config[id];
    if (!files || files.length === 0) return null;
    const chosen = files[Math.floor(Math.random() * files.length)];
    return path.join(this.utterancesDir, chosen);
  }
}
