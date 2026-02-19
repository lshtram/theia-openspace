// extensions/openspace-voice/src/node/stt/whisper-cpp-adapter.ts
import { spawn } from 'child_process';
import type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult } from '../../common/voice-providers';

export class WhisperCppAdapter implements SttProvider {
  readonly kind = 'stt' as const;
  readonly id = 'whisper.cpp';

  constructor(private readonly binaryPath: string = 'whisper') {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, ['--version'], { stdio: 'pipe' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  async transcribe(request: SttTranscriptionRequest): Promise<SttTranscriptionResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        this.binaryPath,
        ['--language', request.language, '--output-txt', '-'],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];

      proc.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

      proc.on('error', (err) => reject(new Error(`whisper.cpp spawn failed: ${err.message}`)));
      proc.on('close', (code) => {
        if (code !== 0) {
          const errText = Buffer.concat(stderr).toString('utf8').trim();
          reject(new Error(`whisper.cpp exited ${code}: ${errText}`));
          return;
        }
        const text = Buffer.concat(stdout).toString('utf8').trim();
        if (text.length === 0) {
          reject(new Error('whisper.cpp returned empty transcription'));
          return;
        }
        resolve({ text });
      });

      proc.stdin.write(Buffer.from(request.audio));
      proc.stdin.end();
    });
  }
}
