import * as sinon from 'sinon';

export interface FakeClockHandle {
    clock: sinon.SinonFakeTimers;
    tick: (ms: number) => Promise<void>;
    restore: () => void;
}

export function createFakeClock(now?: number): FakeClockHandle {
    const clock = sinon.useFakeTimers(now ? { now } : undefined);

    return {
        clock,
        tick: async (ms: number) => {
            await clock.tickAsync(ms);
        },
        restore: () => {
            if ((clock as unknown as { restore?: () => void }).restore) {
                clock.restore();
            }
        },
    };
}
