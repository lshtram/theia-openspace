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

  it('encodes stereo (channels=2) with correct blockAlign and byteRate', () => {
    const pcm = new Uint8Array(8);
    const buf = buildWavBuffer(pcm, 44100, 2);
    const view = new DataView(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    assert.strictEqual(view.getUint16(22, true), 2, 'numChannels should be 2');
    assert.strictEqual(view.getUint16(32, true), 4, 'blockAlign = 2 channels * 2 bytes = 4');
    assert.strictEqual(view.getUint32(28, true), 176400, 'byteRate = 44100 * 4 = 176400');
  });
