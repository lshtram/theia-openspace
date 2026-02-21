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

// @ts-expect-error TS1343
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

// ─── renderPlan memoization regression tests (Task 26) ───────────────────────

import { createRequire as _createRequireForTimeline } from 'node:module';

// @ts-expect-error TS1343
const _requireTimeline = _createRequireForTimeline(import.meta.url);
const { MessageTimeline } = _requireTimeline('openspace-chat/lib/browser/message-timeline') as {
    MessageTimeline: React.ComponentType<any>
};

function makeMessage(role: 'user' | 'assistant', text: string): any {
    return {
        id: Math.random().toString(36).slice(2),
        role,
        type: 'text',
        parts: [{ type: 'text', text }],
        createdAt: new Date().toISOString(),
        metadata: {}
    };
}

describe('MessageTimeline — renderPlan memoization', () => {
    let container: HTMLElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        document.body.removeChild(container);
    });

    function render(messages: any[]) {
        const props = {
            messages,
            shellOutputs: [],
            isStreaming: false,
            sessionBusy: false,
            streamingMessageId: undefined,
            streamingStatus: undefined,
            openCodeService: undefined,
            sessionService: undefined,
            pendingPermissions: [],
            onReplyPermission: () => {},
            onOpenFile: () => {},
        };
        act(() => {
            root.render(React.createElement(MessageTimeline, props));
        });
    }

    it('renders zero messages without error', () => {
        render([]);
        // Should render without throwing
        expect(container.innerHTML).to.be.a('string');
    });

    it('re-renders when messages array is replaced with more messages', () => {
        const initial = [makeMessage('user', 'hello')];
        render(initial);
        const before = container.innerHTML;

        // Add an assistant message — new array reference
        const updated = [...initial, makeMessage('assistant', 'world')];
        render(updated);
        const after = container.innerHTML;

        expect(after).to.not.equal(before, 'DOM should change when new message is added');
    });

    it('groups consecutive assistant messages into a single run (shows last message text)', () => {
        const messages = [
            makeMessage('user', 'question'),
            makeMessage('assistant', 'part 1'),
            makeMessage('assistant', 'part 2'),
        ];
        render(messages);
        // The component groups consecutive assistant messages; the last message's text
        // appears as the primary response. The DOM should render without error.
        expect(container.innerHTML).to.be.a('string');
        // The user message text should be visible
        expect(container.textContent).to.include('question');
        // The final assistant message text should appear
        expect(container.textContent).to.include('part 2');
    });

    it('shows incremental streaming additions — each render reflects new content', () => {
        const msgs: any[] = [];
        // Start empty
        render(msgs);

        // Simulate streaming: each step adds a message (new array — immutable pattern)
        for (let i = 0; i < 3; i++) {
            const prevHtml = container.innerHTML;
            msgs.push(makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`));
            render([...msgs]); // cloned array — same as SessionService pattern
            expect(container.innerHTML).to.not.equal(prevHtml, `DOM should update after adding message ${i}`);
        }
    });
});
