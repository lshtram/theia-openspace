// src/utils/wav.ts

export function buildWavBuffer(pcm16: Uint8Array, sampleRate: number, channels: number): Buffer {
  const dataLen = pcm16.length;
  const buf = Buffer.alloc(44 + dataLen);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);                              // PCM subchunk size
  buf.writeUInt16LE(1, 20);                               // PCM audio format
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);       // byte rate
  buf.writeUInt16LE(channels * 2, 32);                    // block align
  buf.writeUInt16LE(16, 34);                              // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  Buffer.from(pcm16).copy(buf, 44);

  return buf;
}
