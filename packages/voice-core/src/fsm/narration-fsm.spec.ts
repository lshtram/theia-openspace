// src/fsm/narration-fsm.spec.ts
import { describe, it } from 'mocha';
import * as assert from 'assert';
import { NarrationFsm, type NarrationRequest } from './narration-fsm';

const REQ: NarrationRequest = { text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 };

describe('NarrationFsm', () => {
  it('starts idle', () => assert.strictEqual(new NarrationFsm().state, 'idle'));

  it('enqueue while idle transitions to queued', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    assert.strictEqual(fsm.state, 'queued');
  });

  it('enqueue with narrate-off is a no-op', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue({ ...REQ, mode: 'narrate-off' });
    assert.strictEqual(fsm.state, 'idle');
  });

  it('second enqueue while queued does not change state', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.enqueue(REQ);
    assert.strictEqual(fsm.state, 'queued');
  });

  it('complete() returns undefined and goes idle when queue is empty', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    const next = fsm.complete();
    assert.strictEqual(next, undefined);
    assert.strictEqual(fsm.state, 'idle');
  });

  it('complete() returns next item and stays queued if more items waiting', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.enqueue(REQ); // second queued
    fsm.startProcessing();
    fsm.audioReady();
    const next = fsm.complete();
    assert.ok(next !== undefined);
    assert.strictEqual(fsm.state, 'queued');
  });

  it('pause/resume round-trip', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    fsm.pause();
    assert.strictEqual(fsm.state, 'paused');
    fsm.resume();
    assert.strictEqual(fsm.state, 'playing');
  });

  // Task 12: gap tests
  it('throws VoiceFsmError on pause() when idle', () => {
    const fsm = new NarrationFsm();
    assert.throws(() => fsm.pause(), (err: unknown) => err instanceof Error && err.constructor.name === 'VoiceFsmError');
  });

  it('throws VoiceFsmError on pause() when queued', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    assert.strictEqual(fsm.state, 'queued');
    assert.throws(() => fsm.pause(), (err: unknown) => err instanceof Error && err.constructor.name === 'VoiceFsmError');
  });

  it('enqueue() while playing and complete() returns that next item', () => {
    const req2: NarrationRequest = { text: 'second', mode: 'narrate-everything', voice: 'af_sarah', speed: 1 };
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    assert.strictEqual(fsm.state, 'playing');
    fsm.enqueue(req2);
    const next = fsm.complete();
    assert.ok(next !== undefined, 'complete() should return next queued item');
    assert.strictEqual(next.text, 'second');
    assert.strictEqual(fsm.state, 'queued');
  });
});
