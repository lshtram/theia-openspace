// src/utils/wav.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { buildWavBuffer } from './wav';

describe('buildWavBuffer', () => {
  it('produces a 44-byte header for empty PCM', () => {
    const buf = buildWavBuffer(new Uint8Array(0), 16000, 1);
    assert.strictEqual(buf.length, 44);
    assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(buf.toString('ascii', 8, 12), 'WAVE');
    assert.strictEqual(buf.toString('ascii', 12, 16), 'fmt ');
    assert.strictEqual(buf.toString('ascii', 36, 40), 'data');
  });

  it('encodes sample rate in header', () => {
    const buf = buildWavBuffer(new Uint8Array(0), 24000, 1);
    assert.strictEqual(buf.readUInt32LE(24), 24000);
  });

  it('data chunk length matches PCM bytes length', () => {
    const pcm = new Uint8Array(100);
    const buf = buildWavBuffer(pcm, 16000, 1);
    assert.strictEqual(buf.readUInt32LE(40), 100);
    assert.strictEqual(buf.length, 144);
  });
});
