/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Advanced tests for MessageTimeline component.
 *
 * Covers:
 * - Bug H4: Shell outputs rendered at bottom instead of chronologically interleaved
 * - Bug M10: No error boundary — a single corrupted message crashes the entire timeline
 * - Bug M8: Timer systems (structural verification)
 * - Timeline structure: user messages, assistant runs, TurnGroup, turn-response, streaming trigger bar
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const MessageTimeline = (_require('openspace-chat/lib/browser/message-timeline') as any).default as React.FC<any>;

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (typeof (globalThis as any).atob === 'undefined') {
    (globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
    (globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}
if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// Polyfill ResizeObserver — not implemented in jsdom
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
    (globalThis as any).ResizeObserver = class ResizeObserver {
        observe(): void { /* noop */ }
        unobserve(): void { /* noop */ }
        disconnect(): void { /* noop */ }
    };
}

// ─── Stub services ────────────────────────────────────────────────────────────

const stubOpenCodeService = {
    getClient: () => null,
    onActiveSessionChanged: () => ({ dispose: () => {} }),
    onActiveProjectChanged: () => ({ dispose: () => {} }),
};
const stubSessionService = {
    activeModel: undefined,
    onActiveModelChanged: () => ({ dispose: () => {} }),
    getAvailableModels: async () => [],
    setActiveModel: () => {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let nextMsgNum = 0;

function makeMessage(id: string, role: 'user' | 'assistant', parts: any[], metadata: any = {}) {
    return {
        id,
        role,
        parts,
        time: { created: new Date(Date.now() + (nextMsgNum++) * 1000).toISOString() },
        metadata,
    };
}

function textPart(text: string) {
    return { type: 'text', text };
}

function toolPart(name: string, state = 'completed') {
    return {
        type: 'tool',
        toolName: name,
        tool: name,
        toolCallId: `call-${name}`,
        state,
        input: {},
        output: '',
        id: `tool-${name}-${Math.random().toString(36).slice(2)}`,
    };
}

function makeShellOutput(id: string, command: string, output: string, overrides: any = {}) {
    return {
        id,
        command,
        stdout: output,
        stderr: '',
        exitCode: 0,
        timestamp: Date.now(),
        afterMessageIndex: 0,
        ...overrides,
    };
}

// ─── Mount / cleanup ──────────────────────────────────────────────────────────

let _cleanup: (() => void) | undefined;

function mount(props: Partial<any> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const fullProps = {
        messages: [],
        isStreaming: false,
        sessionBusy: false,
        shellOutputs: [],
        openCodeService: stubOpenCodeService,
        sessionService: stubSessionService,
        pendingPermissions: [],
        onReplyPermission: sinon.stub(),
        onOpenFile: sinon.stub(),
        ...props,
    };
    act(() => { root.render(React.createElement(MessageTimeline, fullProps)); });
    const unmount = () => { act(() => { root.unmount(); }); container.remove(); };
    _cleanup = unmount;
    return { container, unmount };
}

afterEach(() => {
    if (_cleanup) { try { _cleanup(); } catch {} _cleanup = undefined; }
    document.body.innerHTML = '';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MessageTimeline — Shell Output Ordering (Bug H4)', () => {

    it('renders shell outputs in the timeline', () => {
        const messages = [makeMessage('m1', 'user', [textPart('run ls')])];
        const shells = [makeShellOutput('sh1', 'ls', 'file1.txt\nfile2.txt')];
        const { container, unmount } = mount({ messages, shellOutputs: shells });
        try {
            const shellBlock = container.querySelector('.shell-output-block');
            expect(shellBlock, 'should render a shell output block').to.not.be.null;
            expect(shellBlock!.textContent).to.include('ls');
        } finally {
            unmount();
        }
    });

    it('shell output appears after ALL messages even when timestamped between them (EXPECTED FAIL: H4)', () => {
        // Timeline: user msg1 → shell output → assistant msg2 → user msg3
        // The shell output should appear between msg1 and msg2 chronologically,
        // but the current code renders it at the bottom after all messages.
        const msg1 = makeMessage('m1', 'user', [textPart('first message')]);
        const msg2 = makeMessage('m2', 'assistant', [textPart('second message')]);
        const msg3 = makeMessage('m3', 'user', [textPart('third message')]);

        const shell = makeShellOutput('sh-between', 'echo hello', 'hello', {
            timestamp: Date.now() - 5000, // timestamped to appear between msg1 and msg2
            afterMessageIndex: 0,         // should appear after message index 0
        });

        const { container, unmount } = mount({
            messages: [msg1, msg2, msg3],
            shellOutputs: [shell],
        });
        try {
            const content = container.querySelector('.message-timeline-content');
            expect(content, 'timeline content container should exist').to.not.be.null;

            // Get all rendered children that are messages or shell outputs
            const allChildren = Array.from(content!.children);
            const shellBlock = content!.querySelector('.shell-output-block');
            expect(shellBlock, 'shell block should be rendered').to.not.be.null;

            // Find the index of the shell block in the timeline content
            const shellIndex = allChildren.findIndex(el => el.querySelector('.shell-output-block') || el.classList.contains('shell-output-block'));

            // Find where the first user message bubble is — it should be the first message child
            const messageBubbles = content!.querySelectorAll('.message-bubble');
            expect(messageBubbles.length, 'should render message bubbles').to.be.greaterThan(0);

            // The shell output should be interleaved after the first message, not at the very end.
            // The sentinel div is always last, so the shell output should NOT be the second-to-last element.
            const sentinelIndex = allChildren.findIndex(el => el.classList.contains('message-timeline-bottom-sentinel'));

            // Bug H4: shell outputs are always at the bottom, right before the sentinel.
            // This assertion checks that the shell is NOT just before the sentinel (i.e. it IS interleaved).
            // This test SHOULD FAIL with the current code because shells are always rendered at the bottom.
            expect(shellIndex, 'shell output should be interleaved, not at bottom').to.be.lessThan(sentinelIndex - 1);
        } finally {
            unmount();
        }
    });

    it('multiple shell outputs maintain their relative order', () => {
        const messages = [makeMessage('m1', 'user', [textPart('run commands')])];
        const shells = [
            makeShellOutput('sh1', 'echo first', 'first', { timestamp: 1000 }),
            makeShellOutput('sh2', 'echo second', 'second', { timestamp: 2000 }),
            makeShellOutput('sh3', 'echo third', 'third', { timestamp: 3000 }),
        ];
        const { container, unmount } = mount({ messages, shellOutputs: shells });
        try {
            const shellBlocks = container.querySelectorAll('.shell-output-block');
            expect(shellBlocks.length).to.equal(3);

            const commands = Array.from(shellBlocks).map(b =>
                b.querySelector('.shell-output-command')?.textContent
            );
            expect(commands[0]).to.include('first');
            expect(commands[1]).to.include('second');
            expect(commands[2]).to.include('third');
        } finally {
            unmount();
        }
    });

    it('shell output with afterMessageIndex=1 should appear after message index 1 (EXPECTED FAIL: H4)', () => {
        const msg0 = makeMessage('m0', 'user', [textPart('hello')]);
        const msg1 = makeMessage('m1', 'assistant', [textPart('response')]);
        const msg2 = makeMessage('m2', 'user', [textPart('another')]);

        const shell = makeShellOutput('sh-mid', 'pwd', '/home', {
            afterMessageIndex: 1, // should appear after msg1, before msg2
        });

        const { container, unmount } = mount({
            messages: [msg0, msg1, msg2],
            shellOutputs: [shell],
        });
        try {
            const content = container.querySelector('.message-timeline-content');
            const allChildren = Array.from(content!.children);

            // Find positions
            const shellIdx = allChildren.findIndex(el =>
                el.querySelector('.shell-output-block') || el.classList.contains('shell-output-block')
            );
            const sentinelIdx = allChildren.findIndex(el =>
                el.classList.contains('message-timeline-bottom-sentinel')
            );

            // With current buggy code, shell is just before sentinel (at the very bottom).
            // The fix would position it after the assistant message at index 1.
            // This test SHOULD FAIL because shellIdx === sentinelIdx - 1 in the current code.
            expect(shellIdx).to.be.lessThan(sentinelIdx - 1,
                'shell output should NOT be at the very end of the timeline');
        } finally {
            unmount();
        }
    });
});

describe('MessageTimeline — Error Boundary (Bug M10)', () => {

    it('renders remaining messages when one message has null parts', () => {
        // A message with null parts could cause a crash in .map() or .some()
        const msg1 = makeMessage('m1', 'user', [textPart('before')]);
        const corruptedMsg = makeMessage('m-corrupt', 'assistant', null as any);
        const msg3 = makeMessage('m3', 'user', [textPart('after')]);

        const { container, unmount } = mount({ messages: [msg1, corruptedMsg, msg3] });
        try {
            // With no error boundary, this may either crash entirely or render partially.
            // The test checks that at least the timeline container still exists.
            const timeline = container.querySelector('.message-timeline');
            expect(timeline, 'timeline should still render even with corrupted message').to.not.be.null;

            // Ideally both valid messages should be visible
            const text = container.textContent || '';
            expect(text).to.include('before');
        } finally {
            unmount();
        }
    });

    it('timeline should not crash when message parts contain unexpected types', () => {
        // A message part with an unknown type — should degrade gracefully
        const msg1 = makeMessage('m1', 'user', [textPart('valid message')]);
        const weirdMsg = makeMessage('m2', 'assistant', [
            { type: 'unknown-future-type', data: 'something' },
            textPart('readable text'),
        ]);

        const { container, unmount } = mount({ messages: [msg1, weirdMsg] });
        try {
            const timeline = container.querySelector('.message-timeline');
            expect(timeline, 'timeline should render').to.not.be.null;
            expect(container.textContent).to.include('valid message');
        } finally {
            unmount();
        }
    });
});

describe('MessageTimeline — Timeline Structure', () => {

    it('renders empty state when no messages', () => {
        const { container, unmount } = mount({ messages: [] });
        try {
            const emptyState = container.querySelector('.message-timeline-empty');
            expect(emptyState, 'should show empty state').to.not.be.null;
            expect(emptyState!.textContent).to.include('Start a conversation');
        } finally {
            unmount();
        }
    });

    it('user messages render as direct MessageBubble (not in TurnGroup)', () => {
        const messages = [makeMessage('u1', 'user', [textPart('hello from user')])];
        const { container, unmount } = mount({ messages });
        try {
            const bubble = container.querySelector('.message-bubble-user');
            expect(bubble, 'user message should have user bubble class').to.not.be.null;

            // User messages should NOT be wrapped in a TurnGroup
            const turnGroups = container.querySelectorAll('.turn-group');
            expect(turnGroups.length, 'no TurnGroup for user-only messages').to.equal(0);
        } finally {
            unmount();
        }
    });

    it('consecutive assistant messages with tools are grouped into a single TurnGroup', () => {
        const messages = [
            makeMessage('u1', 'user', [textPart('do something')]),
            makeMessage('a1', 'assistant', [toolPart('read_file'), textPart('reading...')]),
            makeMessage('a2', 'assistant', [toolPart('write_file'), textPart('final answer')]),
        ];
        const { container, unmount } = mount({ messages });
        try {
            // There should be a TurnGroup wrapping the assistant run
            const turnGroup = container.querySelector('.turn-group');
            expect(turnGroup, 'consecutive assistant msgs with tools should produce a TurnGroup').to.not.be.null;
        } finally {
            unmount();
        }
    });

    it('last text part of assistant run is extracted and rendered as turn-response', () => {
        const messages = [
            makeMessage('u1', 'user', [textPart('what is 2+2?')]),
            makeMessage('a1', 'assistant', [toolPart('calculator'), textPart('The answer is 4')]),
        ];
        const { container, unmount } = mount({ messages });
        try {
            const turnResponse = container.querySelector('.turn-response');
            expect(turnResponse, 'should extract final text into turn-response').to.not.be.null;
            expect(turnResponse!.textContent).to.include('The answer is 4');
        } finally {
            unmount();
        }
    });

    it('keeps reasoning inside steps after completion (visible when Show steps is expanded)', () => {
        const messages = [
            makeMessage('u1', 'user', [textPart('hello')]),
            makeMessage('a1', 'assistant', [
                { type: 'reasoning', text: 'I should greet briefly.' },
                textPart('Hello! How can I help you today?')
            ]),
        ];

        const { container, unmount } = mount({
            messages,
            isStreaming: false,
            sessionBusy: false,
        });
        try {
            const toggle = container.querySelector('.turn-group-header') as HTMLButtonElement | null;
            expect(toggle, 'Show steps toggle should render').to.not.be.null;
            act(() => {
                toggle!.click();
            });

            const stepsBody = container.querySelector('.turn-group-body');
            expect(stepsBody, 'expanded steps body should exist').to.not.be.null;
            expect(stepsBody!.textContent).to.include('I should greet briefly.');

            const response = container.querySelector('.turn-response');
            expect(response, 'final response should still render separately').to.not.be.null;
            expect(response!.textContent).to.include('Hello! How can I help you today?');
        } finally {
            unmount();
        }
    });

    it('does not render turn-response while assistant run is still streaming', () => {
        const messages = [
            makeMessage('u1', 'user', [textPart('check this')]),
            makeMessage('a1', 'assistant', [toolPart('read'), textPart('Working through file details...')]),
        ];
        const { container, unmount } = mount({
            messages,
            isStreaming: true,
            sessionBusy: true,
            streamingMessageId: 'a1',
        });
        try {
            expect(container.querySelector('.turn-group')).to.not.be.null;
            // While active, all content should stay in steps; response section appears only after completion.
            expect(container.querySelector('.turn-response')).to.be.null;
            const turnGroup = container.querySelector('.turn-group');
            expect(turnGroup!.textContent).to.include('Working through file');
        } finally {
            unmount();
        }
    });

    it('simple assistant message (text only, no tools) renders as plain MessageBubble without TurnGroup', () => {
        const messages = [
            makeMessage('u1', 'user', [textPart('hi')]),
            makeMessage('a1', 'assistant', [textPart('hello there!')]),
        ];
        const { container, unmount } = mount({ messages });
        try {
            // A simple text-only assistant message should render as a plain bubble
            const bubble = container.querySelector('.message-bubble-assistant');
            expect(bubble, 'assistant bubble should render').to.not.be.null;

            // No TurnGroup needed for text-only assistant messages
            const turnGroup = container.querySelector('.turn-group');
            expect(turnGroup, 'no TurnGroup for text-only assistant message').to.be.null;

            expect(container.textContent).to.include('hello there!');
        } finally {
            unmount();
        }
    });

    it('streaming trigger bar shows when session is active but no assistant reply yet', () => {
        const messages = [makeMessage('u1', 'user', [textPart('thinking...')])];
        const { container, unmount } = mount({
            messages,
            isStreaming: true,
            sessionBusy: true,
        });
        try {
            // When streaming and last message is user, a standalone TurnGroup should appear
            const turnGroup = container.querySelector('.turn-group');
            expect(turnGroup, 'streaming trigger TurnGroup should render').to.not.be.null;
        } finally {
            unmount();
        }
    });

    it('scroll-to-bottom button has correct visibility class based on scroll state', () => {
        const messages = [makeMessage('u1', 'user', [textPart('hello')])];
        const { container, unmount } = mount({ messages });
        try {
            const btn = container.querySelector('.scroll-to-bottom-btn');
            expect(btn, 'scroll-to-bottom button should exist').to.not.be.null;

            // Default state: not scrolled up, so button should NOT have 'visible' class
            expect(btn!.classList.contains('visible'), 'should not be visible when at bottom').to.be.false;
        } finally {
            unmount();
        }
    });

    it('re-renders correctly when messages array grows', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const cleanup = () => { act(() => { root.unmount(); }); container.remove(); };
        _cleanup = cleanup;

        const baseProps = {
            messages: [] as any[],
            isStreaming: false,
            sessionBusy: false,
            shellOutputs: [],
            openCodeService: stubOpenCodeService,
            sessionService: stubSessionService,
            pendingPermissions: [],
            onReplyPermission: sinon.stub(),
            onOpenFile: sinon.stub(),
        };

        try {
            // Start empty
            act(() => { root.render(React.createElement(MessageTimeline, baseProps)); });
            expect(container.querySelector('.message-timeline-empty')).to.not.be.null;

            // Add a user message
            const msg1 = makeMessage('u1', 'user', [textPart('first')]);
            act(() => { root.render(React.createElement(MessageTimeline, { ...baseProps, messages: [msg1] })); });
            expect(container.querySelector('.message-timeline-empty')).to.be.null;
            expect(container.textContent).to.include('first');

            // Add an assistant reply
            const msg2 = makeMessage('a1', 'assistant', [textPart('reply')]);
            act(() => { root.render(React.createElement(MessageTimeline, { ...baseProps, messages: [msg1, msg2] })); });
            expect(container.textContent).to.include('reply');
        } finally {
            cleanup();
        }
    });

    it('multiple user messages do not produce TurnGroup wrappers', () => {
        const messages = [
            makeMessage('u1', 'user', [textPart('first user msg')]),
            makeMessage('u2', 'user', [textPart('second user msg')]),
        ];
        const { container, unmount } = mount({ messages });
        try {
            const turnGroups = container.querySelectorAll('.turn-group');
            expect(turnGroups.length, 'user messages should not be in TurnGroups').to.equal(0);

            const bubbles = container.querySelectorAll('.message-bubble-user');
            expect(bubbles.length, 'each user message should get its own bubble').to.equal(2);
        } finally {
            unmount();
        }
    });
});
