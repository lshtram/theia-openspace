/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for useLatchedBool hook (message-timeline.tsx).
 * Loaded from compiled lib; uses fake timers to control delay.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-ignore TS1343
const _require = createRequire(import.meta.url);
const { useLatchedBool } = _require('openspace-chat/lib/browser/message-timeline') as {
    useLatchedBool: (value: boolean, delayMs: number) => boolean
};

// ─── Test harness component ───────────────────────────────────────────────────

interface HarnessProps {
    value: boolean;
    delayMs: number;
    onRender: (latched: boolean) => void;
}

function LatchHarness({ value, delayMs, onRender }: HarnessProps) {
    const latched = useLatchedBool(value, delayMs);
    onRender(latched);
    return null;
}

function mount(initialValue: boolean, delayMs: number): {
    container: HTMLElement;
    root: ReturnType<typeof createRoot>;
    rendered: boolean[];
    rerender: (value: boolean) => void;
} {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const rendered: boolean[] = [];
    const root = createRoot(container);

    function doRender(value: boolean) {
        act(() => {
            root.render(
                React.createElement(LatchHarness, {
                    value,
                    delayMs,
                    onRender: (latched: boolean) => rendered.push(latched)
                })
            );
        });
    }

    doRender(initialValue);

    return {
        container,
        root,
        rendered,
        rerender: doRender,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useLatchedBool', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        clock.restore();
        document.body.innerHTML = '';
    });

    it('reflects initial true value immediately', () => {
        const { rendered } = mount(true, 500);
        const last = rendered[rendered.length - 1];
        expect(last).to.equal(true);
    });

    it('reflects initial false value immediately', () => {
        const { rendered } = mount(false, 500);
        const last = rendered[rendered.length - 1];
        expect(last).to.equal(false);
    });

    it('latches true immediately when value goes true', () => {
        const { rendered, rerender } = mount(false, 500);
        rerender(true);
        const last = rendered[rendered.length - 1];
        expect(last).to.equal(true);
    });

    it('stays true before delay expires when value goes false', () => {
        const { rendered, rerender } = mount(true, 500);
        rerender(false);
        // Before the delay, latched should still be true
        act(() => { clock.tick(100); });
        const last = rendered[rendered.length - 1];
        expect(last).to.equal(true);
    });

    it('propagates false after delay expires', () => {
        const { rendered, rerender } = mount(true, 500);
        rerender(false);
        act(() => { clock.tick(600); });
        const last = rendered[rendered.length - 1];
        expect(last).to.equal(false);
    });

    it('cancels pending collapse if value goes true again before delay', () => {
        const { rendered, rerender } = mount(true, 500);
        rerender(false);
        act(() => { clock.tick(200); }); // halfway through delay
        rerender(true);                   // goes true again — cancel the timer
        act(() => { clock.tick(400); }); // past original deadline
        const last = rendered[rendered.length - 1];
        expect(last).to.equal(true); // should remain true
    });
});
