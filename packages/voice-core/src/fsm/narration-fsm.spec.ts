// src/fsm/narration-fsm.spec.ts
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { NarrationFsm, type NarrationRequest } from './narration-fsm';

const REQ: NarrationRequest = { text: 'hello', mode: 'narrate-everything', voice: 'af_sarah', speed: 1.0 };

describe('NarrationFsm', () => {
  it('starts idle', () => expect(new NarrationFsm().state).to.equal('idle'));

  it('enqueue while idle transitions to queued', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    expect(fsm.state).to.equal('queued');
  });

  it('enqueue with narrate-off is a no-op', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue({ ...REQ, mode: 'narrate-off' });
    expect(fsm.state).to.equal('idle');
  });

  it('second enqueue while queued does not change state', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.enqueue(REQ);
    expect(fsm.state).to.equal('queued');
  });

  it('complete() returns undefined and goes idle when queue is empty', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    const next = fsm.complete();
    expect(next).to.equal(undefined);
    expect(fsm.state).to.equal('idle');
  });

  it('complete() returns next item and stays queued if more items waiting', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.enqueue(REQ); // second queued
    fsm.startProcessing();
    fsm.audioReady();
    const next = fsm.complete();
    expect(next).to.not.equal(undefined);
    expect(fsm.state).to.equal('queued');
  });

  it('pause/resume round-trip', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    fsm.pause();
    expect(fsm.state).to.equal('paused');
    fsm.resume();
    expect(fsm.state).to.equal('playing');
  });

  // Task 12: gap tests
  it('throws VoiceFsmError on pause() when idle', () => {
    const fsm = new NarrationFsm();
    expect(() => fsm.pause()).to.throw();
  });

  it('throws VoiceFsmError on pause() when queued', () => {
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    expect(fsm.state).to.equal('queued');
    expect(() => fsm.pause()).to.throw();
  });

  it('enqueue() while playing and complete() returns that next item', () => {
    const req2: NarrationRequest = { text: 'second', mode: 'narrate-everything', voice: 'af_sarah', speed: 1 };
    const fsm = new NarrationFsm();
    fsm.enqueue(REQ);
    fsm.startProcessing();
    fsm.audioReady();
    expect(fsm.state).to.equal('playing');
    fsm.enqueue(req2);
    const next = fsm.complete();
    expect(next, 'complete() should return next queued item').to.not.equal(undefined);
    expect(next?.text).to.equal('second');
    expect(fsm.state).to.equal('queued');
  });
});
