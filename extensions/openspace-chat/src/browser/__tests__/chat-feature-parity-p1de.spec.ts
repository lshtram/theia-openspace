/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P1-D and P1-E.
 *
 * P1-D: Token / cost display per turn — TurnGroup renders a .turn-cost-bar
 *       after streaming ends when the message contains step-finish parts with
 *       token/cost data.
 *
 * P1-E: Context usage indicator — ChatFooter renders a .context-usage element
 *       showing token count when tokenUsage prop is provided.
 *
 * Imports compiled lib for React components (tsx/decorator-safe pattern).
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);

const { MessageBubble, TurnGroup } = _require('openspace-chat/lib/browser/message-bubble/message-bubble') as {
    MessageBubble: React.FC<any>;
    TurnGroup: React.FC<any>;
};

const { ChatComponent } = _require('openspace-chat/lib/browser/chat-widget/chat-widget') as {
    ChatComponent: React.FC<any>;
};

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStepFinishPart(tokens: { input: number; output: number }, cost: number): any {
    return {
        type: 'step-finish',
        tokens: { input: tokens.input, output: tokens.output },
        cost,
    };
}

function makeTextPart(text: string): any { return { type: 'text', text }; }

function makeMessage(role: 'user' | 'assistant', parts: any[], overrides: any = {}): any {
    return {
        id: `msg-${Math.random().toString(36).slice(2)}`,
        role,
        parts,
        time: { created: new Date().toISOString() },
        metadata: {},
        ...overrides,
    };
}

function mountBubble(props: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(React.createElement(MessageBubble, props)); });
    return {
        container,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

function makeSession(overrides: any = {}): any {
    return {
        id: 'session-1', projectID: 'proj-1', title: 'Session', version: '1',
        time: { created: Date.now(), updated: Date.now() }, directory: '/test',
        ...overrides,
    };
}

function makeMockSessionService(overrides: Partial<any> = {}): any {
    return {
        activeProject: { id: 'proj-1', worktree: '/test', time: { created: Date.now() } },
        activeSession: makeSession(),
        activeModel: undefined, messages: [], isLoading: false, lastError: undefined,
        isStreaming: false,
        getSessions: sinon.stub().resolves([makeSession()]),
        createSession: sinon.stub().resolves(makeSession()),
        setActiveSession: sinon.stub().resolves(),
        setActiveModel: sinon.stub(),
        deleteSession: sinon.stub().resolves(),
        sendMessage: sinon.stub().resolves(),
        renameSession: sinon.stub().resolves(),
        autoSelectProjectByWorkspace: sinon.stub().resolves(false),
        getAvailableModels: sinon.stub().resolves([]),
        abort: sinon.stub().resolves(),
        appendMessage: sinon.stub(), updateStreamingMessage: sinon.stub(),
        replaceMessage: sinon.stub(), notifySessionChanged: sinon.stub(),
        notifySessionDeleted: sinon.stub(), dispose: sinon.stub(),
        onActiveProjectChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onActiveSessionChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onActiveModelChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onMessagesChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onMessageStreaming: sinon.stub().returns({ dispose: sinon.stub() }),
        onIsLoadingChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onErrorChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onIsStreamingChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onStreamingStatusChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onQuestionChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        onPermissionChanged: sinon.stub().returns({ dispose: sinon.stub() }),
        pendingQuestions: [], pendingPermissions: [],
        streamingMessageId: undefined, currentStreamingStatus: '',
        sessionStatus: undefined,
        todos: [],
        answerQuestion: sinon.stub().resolves(), rejectQuestion: sinon.stub().resolves(),
        replyPermission: sinon.stub().resolves(),
        shareSession: sinon.stub().resolves('https://share.example.com/session'),
        unshareSession: sinon.stub().resolves(),
        forkSession: sinon.stub().resolves(undefined),
        compactSession: sinon.stub().resolves(),
        revertSession: sinon.stub().resolves(),
        unrevertSession: sinon.stub().resolves(),
         getSessionError: sinon.stub().returns(undefined),
         getMessagesForPreview: sinon.stub().resolves([]),
         onSessionStatusChanged: sinon.stub().returns({ dispose: sinon.stub() }),
         getMcpStatus: sinon.stub().resolves(undefined),
         ...overrides,
     };
}

// ─── P1-D: Token / Cost Display Per Turn ─────────────────────────────────────

describe('P1-D: Token / cost display per turn', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders .turn-cost-bar for completed assistant turn with cost data', () => {
        const msg = makeMessage('assistant', [
            makeTextPart('The answer is 42.'),
            makeStepFinishPart({ input: 120, output: 30 }, 0.0042),
        ]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });
        expect(container.querySelector('.turn-cost-bar')).to.not.be.null;
        unmount();
    });

    it('does NOT render .turn-cost-bar while turn is streaming', () => {
        const msg = makeMessage('assistant', [
            makeTextPart('Partial…'),
            makeStepFinishPart({ input: 10, output: 5 }, 0.001),
        ]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: true });
        expect(container.querySelector('.turn-cost-bar')).to.be.null;
        unmount();
    });

    it('does NOT render .turn-cost-bar when cost is zero (free/unknown model)', () => {
        const msg = makeMessage('assistant', [
            makeTextPart('Free model response.'),
            makeStepFinishPart({ input: 50, output: 20 }, 0),
        ]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });
        expect(container.querySelector('.turn-cost-bar')).to.be.null;
        unmount();
    });

    it('does NOT render .turn-cost-bar on user messages', () => {
        const msg = makeMessage('user', [makeTextPart('My question')]);
        const { container, unmount } = mountBubble({ message: msg, isUser: true, isStreaming: false });
        expect(container.querySelector('.turn-cost-bar')).to.be.null;
        unmount();
    });

    it('shows input and output token counts in .turn-cost-bar', () => {
        const msg = makeMessage('assistant', [
            makeTextPart('Response text.'),
            makeStepFinishPart({ input: 1234, output: 567 }, 0.0099),
        ]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });
        const bar = container.querySelector('.turn-cost-bar');
        expect(bar).to.not.be.null;
        const text = bar!.textContent ?? '';
        expect(text).to.include('1234');
        expect(text).to.include('567');
        unmount();
    });

    it('shows formatted cost in .turn-cost-bar', () => {
        const msg = makeMessage('assistant', [
            makeTextPart('Response text.'),
            makeStepFinishPart({ input: 100, output: 50 }, 0.0042),
        ]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });
        const bar = container.querySelector('.turn-cost-bar');
        expect(bar!.textContent).to.include('$');
        unmount();
    });
});

// ─── P1-E: Context Usage Indicator in Footer ─────────────────────────────────

describe('P1-E: Context usage indicator in ChatFooter', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders .context-usage element in ChatComponent when last message has token data', async () => {
        const msgWithTokens = makeMessage('assistant', [
            makeTextPart('Response'),
            makeStepFinishPart({ input: 8000, output: 200 }, 0.01),
        ]);

        const svc = makeMockSessionService({ messages: [msgWithTokens], isStreaming: false });

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ChatComponent, {
                sessionService: svc, openCodeService: {}, workspaceRoot: '/test',
                messageService: { error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() },
                preferenceService: { get: sinon.stub().returns([]), onPreferenceChanged: sinon.stub().returns({ dispose: sinon.stub() }) },
                commandService: { executeCommand: sinon.stub().resolves() },
                openerService: {} as any,
            }));
        });

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        expect(container.querySelector('.context-usage')).to.not.be.null;

        act(() => root.unmount());
        container.remove();
    });

    it('the .context-usage element shows a token count', async () => {
        const msgWithTokens = makeMessage('assistant', [
            makeTextPart('Response'),
            makeStepFinishPart({ input: 8000, output: 200 }, 0.01),
        ]);

        const svc = makeMockSessionService({ messages: [msgWithTokens], isStreaming: false });

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ChatComponent, {
                sessionService: svc, openCodeService: {}, workspaceRoot: '/test',
                messageService: { error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() },
                preferenceService: { get: sinon.stub().returns([]), onPreferenceChanged: sinon.stub().returns({ dispose: sinon.stub() }) },
                commandService: { executeCommand: sinon.stub().resolves() },
                openerService: {} as any,
            }));
        });

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const el = container.querySelector('.context-usage');
        const text = el?.textContent ?? '';
        // Should show some token count (8000 in or 8200 total)
        expect(text).to.match(/\d+/);

        act(() => root.unmount());
        container.remove();
    });

    it('applies warning class when token usage exceeds 80% of context limit', async () => {
        // 85,000 / 100,000 = 85% — should trigger warning
        const msgHighUsage = makeMessage('assistant', [
            makeTextPart('Response'),
            // We need a way to communicate context limit — for now test that
            // when input tokens are high relative to a threshold the warning class appears.
            // The implementation should use a known model context limit or a default.
            { ...makeStepFinishPart({ input: 85000, output: 500 }, 0.05), contextLimit: 100000 },
        ]);

        const svc = makeMockSessionService({ messages: [msgHighUsage], isStreaming: false });

        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => {
            root.render(React.createElement(ChatComponent, {
                sessionService: svc, openCodeService: {}, workspaceRoot: '/test',
                messageService: { error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() },
                preferenceService: { get: sinon.stub().returns([]), onPreferenceChanged: sinon.stub().returns({ dispose: sinon.stub() }) },
                commandService: { executeCommand: sinon.stub().resolves() },
                openerService: {} as any,
            }));
        });

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        expect(container.querySelector('.context-usage--warning')).to.not.be.null;

        act(() => root.unmount());
        container.remove();
    });
});
