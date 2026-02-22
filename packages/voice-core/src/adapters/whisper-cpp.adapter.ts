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
    private readonly modelFolder: string = '/usr/local/share/whisper',
    private readonly modelFile: string = 'ggml-base.en.bin',  // M-4: configurable model filename
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

    // H-3: whisper.cpp writes transcript to a .txt file, not stdout.
    // Use: -otxt flag + -of <prefix> for output, -f <wavfile> for input.
    const outPrefix = tmpFile.replace(/\.wav$/, '');
    const outTxtFile = outPrefix + '.txt';

    try {
      return await new Promise<SttTranscriptionResult>((resolve, reject) => {
        // L-2: settled guard prevents double-reject on cancellation
        let settled = false;
        const settle = (fn: () => void): void => {
          if (!settled) { settled = true; fn(); }
        };

        const proc = this.spawnFn(
          this.binaryPath,
          [
            '-m', path.join(this.modelFolder, this.modelFile),
            '--language', request.language,
            '-otxt',        // enable text output to file
            '-of', outPrefix,  // output file prefix (creates outPrefix.txt)
            '-f', tmpFile,  // input audio file
          ],
          { stdio: ['ignore', 'ignore', 'pipe'] },  // only stderr for error detection
        );

        const stderr: Buffer[] = [];
        proc.stderr!.on('data', (chunk: Buffer) => stderr.push(chunk));

        proc.on('error', (err) => settle(() => reject(new Error(`whisper.cpp spawn failed: ${err.message}`))));
        proc.on('close', (code) => {
          if (code !== 0) {
            const errText = Buffer.concat(stderr).toString('utf8').trim();
            settle(() => reject(new Error(`whisper.cpp exited ${code}: ${errText}`)));
            return;
          }
          try {
            const text = fs.readFileSync(outTxtFile, 'utf8').trim();
            settle(() => resolve({ text }));
          } catch (readErr) {
            settle(() => reject(new Error(`whisper.cpp output file not found: ${readErr}`)));
          } finally {
            try { fs.unlinkSync(outTxtFile); } catch { /* ignore */ }
          }
        });

        // Cancel support: kill process on request
        token?.onCancellationRequested(() => {
          proc.kill();
          settle(() => reject(new Error('STT transcription cancelled')));
        });
      });
    } finally {
      // Always clean up temp WAV file
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}
