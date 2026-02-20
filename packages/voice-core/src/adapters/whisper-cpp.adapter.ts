// src/adapters/whisper-cpp.adapter.ts
import { spawn, type SpawnOptions } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { SttProvider, SttTranscriptionRequest, SttTranscriptionResult, CancellationToken } from '../providers/stt-provider.interface';
import { buildWavBuffer } from '../utils/wav';

export type SpawnFn = (cmd: string, args: string[], opts: SpawnOptions) => ReturnType<typeof spawn>;

export class WhisperCppAdapter implements SttProvider {
  readonly kind = 'stt' as const;
  readonly id = 'whisper.cpp';

  constructor(
    private readonly binaryPath: string = 'whisper',
    private readonly spawnFn: SpawnFn = spawn,
  ) {}

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      // Use --help: whisper.cpp CLI does not support --version
      const proc = this.spawnFn(this.binaryPath, ['--help'], { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  async transcribe(
    request: SttTranscriptionRequest,
    token?: CancellationToken,
  ): Promise<SttTranscriptionResult> {
    // Write to temp WAV file — whisper.cpp requires a file path, not stdin
    const tmpFile = path.join(
      os.tmpdir(),
      `whisper-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`
    );
    const wavBuffer = buildWavBuffer(request.audio, request.sampleRate ?? 16000, 1);
    fs.writeFileSync(tmpFile, wavBuffer);

    try {
      return await new Promise<SttTranscriptionResult>((resolve, reject) => {
        const proc = this.spawnFn(
          this.binaryPath,
          ['--language', request.language, '--output-txt', tmpFile],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];

        proc.stdout!.on('data', (chunk: Buffer) => stdout.push(chunk));
        proc.stderr!.on('data', (chunk: Buffer) => stderr.push(chunk));

        proc.on('error', (err) => reject(new Error(`whisper.cpp spawn failed: ${err.message}`)));
        proc.on('close', (code) => {
          if (code !== 0) {
            const errText = Buffer.concat(stderr).toString('utf8').trim();
            reject(new Error(`whisper.cpp exited ${code}: ${errText}`));
            return;
          }
          const text = Buffer.concat(stdout).toString('utf8').trim();
          resolve({ text });
        });

        // Cancel support: kill process on request
        token?.onCancellationRequested(() => {
          proc.kill();
          reject(new Error('STT transcription cancelled'));
        });
      });
    } finally {
      // Always clean up temp file
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}
