// src/audio/playback.ts
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { buildWavBuffer } from '@openspace-ai/voice-core';

export async function playPcmAudio(pcm: Uint8Array, sampleRate: number): Promise<void> {
  // Write PCM to temp WAV file
  const tmpFile = path.join(os.tmpdir(), `opsn-tts-${Date.now()}.wav`);
  const wavBuf = buildWavBuffer(pcm, sampleRate, 1);
  fs.writeFileSync(tmpFile, wavBuf);

  try {
    await playWavFile(tmpFile);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function playWavFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string;
    let args: string[];

    switch (process.platform) {
      case 'darwin':
        cmd = 'afplay';
        args = [filePath];
        break;
      case 'win32':
        cmd = 'powershell';
        const escaped = filePath.replace(/'/g, "''");
        args = ['-c', `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`];
        break;
      default: // linux
        cmd = 'aplay';
        args = [filePath];
        break;
    }

    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('error', (err) => reject(new Error(`Audio playback failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`Audio player exited with code ${code}`));
      else resolve();
    });
  });
}
