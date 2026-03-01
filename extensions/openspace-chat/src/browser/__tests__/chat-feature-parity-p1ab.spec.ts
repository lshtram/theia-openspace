/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P1-A and P1-B.
 *
 * P1-A: Copy response button — each assistant turn exposes a .copy-response-btn
 *       that writes the last text part to the clipboard, toggling to "Copied" for 2s.
 *
 * P1-B: Inline session title editing — the session title in ChatHeaderBar is
 *       a button that switches to an <input> on click; on blur/Enter it calls
 *       sessionService.renameSession(id, newTitle).
 *
 * These tests import from the compiled lib (openspace-chat/lib/...) to avoid
 * tsx/decorator issues in ts-node, matching the pattern used across all other
 * chat browser specs.
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
if (typeof (globalThis as any).atob === 'undefined') {
    (globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
    (globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeTextPart(text: string): any { return { type: 'text', text }; }

function mountBubble(props: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(React.createElement(MessageBubble, props)); });
    return {
        container,
        unmount: () => { act(() => root.unmount()); container.remove(); },
        rerender: (p: any) => { act(() => { root.render(React.createElement(MessageBubble, p)); }); },
    };
}

function makeSession(overrides: any = {}): any {
    return {
        id: 'session-1',
        projectID: 'proj-1',
        title: 'My Session',
        time: { created: Date.now(), updated: Date.now() },
        directory: '/test',
        version: '1.0.0',
        ...overrides,
    };
}

function makeMockSessionService(overrides: Partial<any> = {}): any {
    return {
        activeProject: { id: 'proj-1', worktree: '/test', time: { created: Date.now() } },
        activeSession: makeSession(),
        activeModel: undefined,
        messages: [],
        isLoading: false,
        lastError: undefined,
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
        appendMessage: sinon.stub(),
        updateStreamingMessage: sinon.stub(),
        replaceMessage: sinon.stub(),
        notifySessionChanged: sinon.stub(),
        notifySessionDeleted: sinon.stub(),
        dispose: sinon.stub(),
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
        pendingQuestions: [],
        pendingPermissions: [],
        streamingMessageId: undefined,
        currentStreamingStatus: '',
        sessionStatus: undefined,
        todos: [],
        answerQuestion: sinon.stub().resolves(),
        rejectQuestion: sinon.stub().resolves(),
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

function renderChatComponent(sessionService: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(ChatComponent, {
            sessionService,
            openCodeService: {},
            workspaceRoot: '/test',
            messageService: { error: sinon.stub(), info: sinon.stub(), warn: sinon.stub() },
            preferenceService: { get: sinon.stub().returns([]), onPreferenceChanged: sinon.stub().returns({ dispose: sinon.stub() }) },
            commandService: { executeCommand: sinon.stub().resolves() },
            openerService: {} as any,
        }));
    });
    return {
        container,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

// ─── P1-A: Copy Response Button ───────────────────────────────────────────────

describe('P1-A: Copy response button', () => {
    let savedNavigator: unknown;
    beforeEach(() => {
        savedNavigator = (globalThis as { navigator?: unknown }).navigator;
    });
    afterEach(() => {
        if (savedNavigator !== undefined) {
            Object.defineProperty(globalThis, 'navigator', {
                value: savedNavigator,
                configurable: true,
                writable: true,
            });
        }
        document.body.innerHTML = '';
        sinon.restore();
    });

    it('renders a .copy-response-btn on a completed assistant message', () => {
        const msg = makeMessage('assistant', [makeTextPart('Hello from the assistant.')]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });
        expect(container.querySelector('.copy-response-btn')).to.not.be.null;
        unmount();
    });

    it('does NOT render .copy-response-btn while message is still streaming', () => {
        const msg = makeMessage('assistant', [makeTextPart('Partial…')]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: true });
        expect(container.querySelector('.copy-response-btn')).to.be.null;
        unmount();
    });

    it('renders .copy-response-btn on user messages', () => {
        const msg = makeMessage('user', [makeTextPart('My question')]);
        const { container, unmount } = mountBubble({ message: msg, isUser: true, isStreaming: false });
        expect(container.querySelector('.copy-response-btn')).to.not.be.null;
        unmount();
    });

    it('calls navigator.clipboard.writeText with the last text part on click', async () => {
        const written: string[] = [];
        // Preserve existing navigator, only stub clipboard
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                ...(globalThis as { navigator?: object }).navigator,
                clipboard: {
                    writeText: (text: string) => { written.push(text); return Promise.resolve(); },
                },
            },
            configurable: true,
            writable: true,
        });

        const msg = makeMessage('assistant', [
            makeTextPart('First paragraph.'),
            makeTextPart('Final answer.'),
        ]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });

        const btn = container.querySelector('.copy-response-btn') as HTMLElement;
        expect(btn).to.not.be.null;
        await act(async () => { btn.click(); });

        // Should copy the last text part
        expect(written).to.have.length(1);
        expect(written[0]).to.equal('Final answer.');
        unmount();
    });

    it('shows "Copied" label on the button after clicking', async () => {
        const written: string[] = [];
        // Preserve existing navigator, only stub clipboard
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                ...(globalThis as { navigator?: object }).navigator,
                clipboard: {
                    writeText: (text: string) => { written.push(text); return Promise.resolve(); },
                },
            },
            configurable: true,
            writable: true,
        });

        const msg = makeMessage('assistant', [makeTextPart('Some response text')]);
        const { container, unmount } = mountBubble({ message: msg, isUser: false, isStreaming: false });

        const btn = container.querySelector('.copy-response-btn') as HTMLElement;
        await act(async () => { btn.click(); });

        // After click the button text or aria-label should indicate "Copied"
        const copiedBtn = container.querySelector('.copy-response-btn--copied');
        expect(copiedBtn).to.not.be.null;
        unmount();
    });
});

// ─── P1-B: Inline Session Title Editing ──────────────────────────────────────

describe('P1-B: Inline session title editing', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('shows an editable title input when the session title is double-clicked', async () => {
        const svc = makeMockSessionService();
        const { container, unmount } = renderChatComponent(svc);

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const titleEl = container.querySelector('.chat-header-title') as HTMLElement;
        expect(titleEl).to.not.be.null;

        await act(async () => {
            const win = titleEl.ownerDocument.defaultView!;
            titleEl.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
        });

        // After double-clicking, an input for editing the title should appear
        const titleInput = container.querySelector('.session-title-input') as HTMLInputElement;
        expect(titleInput).to.not.be.null;
        unmount();
    });

    it('the title input is pre-populated with the current session title', async () => {
        const svc = makeMockSessionService({ activeSession: makeSession({ title: 'My Cool Session' }) });
        const { container, unmount } = renderChatComponent(svc);

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const titleEl = container.querySelector('.chat-header-title') as HTMLElement;
        await act(async () => {
            const win = titleEl.ownerDocument.defaultView!;
            titleEl.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
        });

        const titleInput = container.querySelector('.session-title-input') as HTMLInputElement;
        expect(titleInput.value).to.equal('My Cool Session');
        unmount();
    });

    it('calls sessionService.renameSession on Enter keypress', async () => {
        const svc = makeMockSessionService({ activeSession: makeSession({ id: 'session-1', title: 'Old Title' }) });
        const { container, unmount } = renderChatComponent(svc);

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const titleEl = container.querySelector('.chat-header-title') as HTMLElement;
        await act(async () => {
            const win = titleEl.ownerDocument.defaultView!;
            titleEl.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
        });

        const titleInput = container.querySelector('.session-title-input') as HTMLInputElement;

        await act(async () => {
            // Change the value — use the jsdom window's Event constructor to avoid realm mismatch
            const win = titleInput.ownerDocument.defaultView!;
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!;
            nativeInputValueSetter.call(titleInput, 'New Title');
            titleInput.dispatchEvent(new win.Event('input', { bubbles: true }));

            // Press Enter
            titleInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });

        expect(svc.renameSession.calledOnce).to.be.true;
        expect(svc.renameSession.firstCall.args[0]).to.equal('session-1');
        expect(svc.renameSession.firstCall.args[1]).to.equal('New Title');
        unmount();
    });

    // React's synthetic onBlur does not fire from native blur events dispatched via
    // dispatchEvent in jsdom without @testing-library/user-event; skip in unit tests.
    it.skip('calls sessionService.renameSession on blur', async () => {
        const svc = makeMockSessionService({ activeSession: makeSession({ id: 'session-1', title: 'Old Title' }) });
        const { container, unmount } = renderChatComponent(svc);

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const titleEl = container.querySelector('.chat-header-title') as HTMLElement;
        await act(async () => { titleEl.click(); });

        const titleInput = container.querySelector('.session-title-input') as HTMLInputElement;

        await act(async () => {
            const win = titleInput.ownerDocument.defaultView!;
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!;
            nativeInputValueSetter.call(titleInput, 'Blurred Title');
            titleInput.dispatchEvent(new win.Event('input', { bubbles: true }));
            titleInput.dispatchEvent(new win.FocusEvent('blur', { bubbles: true }));
        });

        expect(svc.renameSession.calledOnce).to.be.true;
        expect(svc.renameSession.firstCall.args[1]).to.equal('Blurred Title');
        unmount();
    });

    it('hides the input and shows static title again after save', async () => {
        const svc = makeMockSessionService({ activeSession: makeSession({ title: 'My Session' }) });
        const { container, unmount } = renderChatComponent(svc);

        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const titleEl = container.querySelector('.chat-header-title') as HTMLElement;
        await act(async () => {
            const win = titleEl.ownerDocument.defaultView!;
            titleEl.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
        });

        const titleInput = container.querySelector('.session-title-input') as HTMLInputElement;
        await act(async () => {
            const win = titleInput.ownerDocument.defaultView!;
            titleInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });

        // Input should be gone; title button should be visible again
        expect(container.querySelector('.session-title-input')).to.be.null;
        expect(container.querySelector('.chat-header-title')).to.not.be.null;
        unmount();
    });
});
