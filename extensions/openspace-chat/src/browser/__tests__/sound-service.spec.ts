/**
 * Unit tests for SoundService.
 */

import { expect } from 'chai';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { SoundService } = _require('openspace-chat/lib/browser/sound-service') as {
    SoundService: new () => { setEnabled(e: boolean): void; play(event: string): void };
};

describe('SoundService', () => {
    it('can be instantiated without error', () => {
        const svc = new SoundService();
        expect(svc).to.be.instanceOf(SoundService);
    });

    it('does not throw when play() is called with sounds disabled', () => {
        const svc = new SoundService();
        svc.setEnabled(false);
        expect(() => svc.play('turn-complete')).to.not.throw();
    });

    it('does not throw when play() is called for error event with sounds disabled', () => {
        const svc = new SoundService();
        svc.setEnabled(false);
        expect(() => svc.play('error')).to.not.throw();
    });

    it('does not throw when play() is called for permission event with sounds disabled', () => {
        const svc = new SoundService();
        svc.setEnabled(false);
        expect(() => svc.play('permission')).to.not.throw();
    });

    it('setEnabled(true) then setEnabled(false) disables sounds', () => {
        const svc = new SoundService();
        svc.setEnabled(true);
        svc.setEnabled(false);
        // Should not throw (AudioContext unavailable in test env, but enabled=false anyway)
        expect(() => svc.play('turn-complete')).to.not.throw();
    });
});
