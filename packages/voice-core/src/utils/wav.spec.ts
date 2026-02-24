// src/utils/wav.spec.ts
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { buildWavBuffer } from './wav';

describe('buildWavBuffer', () => {
  it('produces a 44-byte header for empty PCM', () => {
    const buf = buildWavBuffer(new Uint8Array(0), 16000, 1);
    expect(buf.length).to.equal(44);
    expect(buf.toString('ascii', 0, 4)).to.equal('RIFF');
    expect(buf.toString('ascii', 8, 12)).to.equal('WAVE');
    expect(buf.toString('ascii', 12, 16)).to.equal('fmt ');
    expect(buf.toString('ascii', 36, 40)).to.equal('data');
  });

  it('encodes sample rate in header', () => {
    const buf = buildWavBuffer(new Uint8Array(0), 24000, 1);
    expect(buf.readUInt32LE(24)).to.equal(24000);
  });

  it('data chunk length matches PCM bytes length', () => {
    const pcm = new Uint8Array(100);
    const buf = buildWavBuffer(pcm, 16000, 1);
    expect(buf.readUInt32LE(40)).to.equal(100);
    expect(buf.length).to.equal(144);
  });
});

  it('encodes stereo (channels=2) with correct blockAlign and byteRate', () => {
    const pcm = new Uint8Array(8);
    const buf = buildWavBuffer(pcm, 44100, 2);
    const view = new DataView(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(view.getUint16(22, true), 'numChannels should be 2').to.equal(2);
    expect(view.getUint16(32, true), 'blockAlign = 2 channels * 2 bytes = 4').to.equal(4);
    expect(view.getUint32(28, true), 'byteRate = 44100 * 4 = 176400').to.equal(176400);
  });
