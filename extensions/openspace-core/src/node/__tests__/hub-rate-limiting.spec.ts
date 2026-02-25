// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Issue 7: No rate limiting on Hub endpoints.
 *
 * Failure mode: a compromised or misbehaving browser tab can flood the Hub
 * with unlimited requests, degrading or crashing the IDE. There is currently
 * no in-process protection at all.
 *
 * Fix: export a RateLimiter class from hub.ts and wire it as the first
 * middleware on every route.
 *
 * These tests will fail until RateLimiter is exported from hub.ts.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';

// This import will fail until RateLimiter is exported from hub.ts
import { RateLimiter } from '../hub';

describe('RateLimiter (Issue 7)', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
    });

    it('allows requests up to the per-second limit', () => {
        const limiter = new RateLimiter(5);
        for (let i = 0; i < 5; i++) {
            expect(limiter.isAllowed('127.0.0.1'), `request ${i + 1} should be allowed`).to.be.true;
        }
    });

    it('blocks the request that exceeds the per-second limit', () => {
        const limiter = new RateLimiter(5);
        for (let i = 0; i < 5; i++) { limiter.isAllowed('127.0.0.1'); }
        expect(limiter.isAllowed('127.0.0.1'), '6th request should be blocked').to.be.false;
    });

    it('resets the counter after the 1-second window elapses', () => {
        const limiter = new RateLimiter(5);
        for (let i = 0; i < 5; i++) { limiter.isAllowed('127.0.0.1'); }

        // Exactly at 1000ms the window has expired
        clock.tick(1001);

        expect(limiter.isAllowed('127.0.0.1'), 'first request in new window should be allowed').to.be.true;
    });

    it('tracks different IPs independently', () => {
        const limiter = new RateLimiter(3);
        for (let i = 0; i < 3; i++) { limiter.isAllowed('10.0.0.1'); }

        // 10.0.0.1 is at its limit, but 10.0.0.2 has a fresh counter
        expect(limiter.isAllowed('10.0.0.1'), '10.0.0.1 should be blocked').to.be.false;
        expect(limiter.isAllowed('10.0.0.2'), '10.0.0.2 should still be allowed').to.be.true;
    });

    it('cleanup() removes stale entries older than 60 seconds', () => {
        const limiter = new RateLimiter(5);
        limiter.isAllowed('192.168.1.1');

        clock.tick(61_000);
        limiter.cleanup();

        // Internal map should be empty after cleanup
        expect((limiter as RateLimiter & { counters: Map<string, { count: number; windowStart: number }> }).counters.size, 'stale entries should be removed').to.equal(0);
    });

    it('cleanup() preserves entries that are still within the 60-second window', () => {
        const limiter = new RateLimiter(5);
        limiter.isAllowed('192.168.1.1');

        clock.tick(30_000); // only 30s — not yet stale
        limiter.cleanup();

        expect((limiter as RateLimiter & { counters: Map<string, { count: number; windowStart: number }> }).counters.size, 'recent entry should be preserved').to.equal(1);
    });

    it('uses a sensible default limit when none is provided', () => {
        const limiter = new RateLimiter(); // default constructor
        // Should allow at least 1 request (sanity check the default exists)
        expect(limiter.isAllowed('127.0.0.1')).to.be.true;
    });
});
