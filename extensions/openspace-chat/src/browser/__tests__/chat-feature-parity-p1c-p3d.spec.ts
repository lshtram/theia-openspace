/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P1-C and P3-D.
 *
 * P1-C: PromptSessionStore — persists prompt text per session with 20-entry LRU.
 * P3-D: ScrollPositionStore — persists scroll position per session with 50-entry LRU.
 *
 * Both are pure in-memory stores (no DI), so we import directly from TypeScript source.
 */

import { expect } from 'chai';
import { PromptSessionStore } from '../prompt-session-store';
import { ScrollPositionStore } from '../scroll-position-store';

// ─── P1-C: PromptSessionStore ─────────────────────────────────────────────────

describe('P1-C: PromptSessionStore', () => {

    it('stores and restores prompt text for a session', () => {
        const store = new PromptSessionStore();
        store.save('session-1', { text: 'hello world' });
        const restored = store.restore('session-1');
        expect(restored).to.not.be.undefined;
        expect(restored!.text).to.equal('hello world');
    });

    it('returns undefined for an unknown session', () => {
        const store = new PromptSessionStore();
        expect(store.restore('nonexistent')).to.be.undefined;
    });

    it('overwrites an existing entry for the same session', () => {
        const store = new PromptSessionStore();
        store.save('session-1', { text: 'first' });
        store.save('session-1', { text: 'second' });
        expect(store.restore('session-1')!.text).to.equal('second');
    });

    it('evicts the oldest entry when more than 20 sessions are stored (LRU cap)', () => {
        const store = new PromptSessionStore();
        // Fill 20 entries (session-1 is LRU, session-20 is MRU)
        for (let i = 1; i <= 20; i++) {
            store.save(`session-${i}`, { text: `prompt ${i}` });
        }
        // Add a 21st entry — the LRU (session-1) should be evicted
        store.save('session-21', { text: 'prompt 21' });
        expect(store.restore('session-1')).to.be.undefined;
        expect(store.restore('session-21')!.text).to.equal('prompt 21');
    });

    it('promoting a session on read keeps it from being evicted (LRU behaviour)', () => {
        const store = new PromptSessionStore();
        for (let i = 1; i <= 20; i++) {
            store.save(`session-${i}`, { text: `prompt ${i}` });
        }
        // Access session-1 to move it to most-recently-used position
        store.restore('session-1');

        // Add session-21 — session-2 should now be evicted instead of session-1
        store.save('session-21', { text: 'prompt 21' });
        expect(store.restore('session-1')).to.not.be.undefined;
        expect(store.restore('session-2')).to.be.undefined;
    });
});

// ─── P3-D: ScrollPositionStore ────────────────────────────────────────────────

describe('P3-D: ScrollPositionStore', () => {

    it('saves and retrieves scroll position for a session', () => {
        const store = new ScrollPositionStore();
        store.save('session-1', 450);
        expect(store.get('session-1')).to.equal(450);
    });

    it('returns undefined for an unknown session', () => {
        const store = new ScrollPositionStore();
        expect(store.get('unknown')).to.be.undefined;
    });

    it('overwrites an existing position for the same session', () => {
        const store = new ScrollPositionStore();
        store.save('session-1', 100);
        store.save('session-1', 999);
        expect(store.get('session-1')).to.equal(999);
    });

    it('evicts the oldest entry when more than 50 sessions are stored (LRU cap)', () => {
        const store = new ScrollPositionStore();
        for (let i = 1; i <= 50; i++) {
            store.save(`session-${i}`, i * 10);
        }
        expect(store.get('session-1')).to.equal(10);

        // 51st entry evicts session-1
        store.save('session-51', 510);
        expect(store.get('session-1')).to.be.undefined;
        expect(store.get('session-51')).to.equal(510);
    });
});
