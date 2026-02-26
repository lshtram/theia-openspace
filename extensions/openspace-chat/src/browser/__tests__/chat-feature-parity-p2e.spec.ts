/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P2-E: Session Summary Badge.
 *
 * The ChatHeaderBar should show a small `+N -M` badge next to the session
 * name when the active session has a `summary` property with additions and
 * deletions counts.
 *
 * Imports compiled ChatComponent from lib.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { ChatComponent } = _require('openspace-chat/lib/browser/chat-widget') as {
    ChatComponent: React.FC<any>;
};

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: any = {}): any {
    return {
        id: 'session-1', projectID: 'proj-1', title: 'My Session', version: '1',
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
        ...overrides,
    };
}

function renderChat(sessionService: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(ChatComponent, {
            sessionService, openCodeService: {}, workspaceRoot: '/test',
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

// ─── P2-E: Session Summary Badge ─────────────────────────────────────────────

describe('P2-E: Session summary badge in ChatHeaderBar', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders a .session-summary-badge when session has summary data', async () => {
        const svc = makeMockSessionService({
            activeSession: makeSession({
                summary: { additions: 42, deletions: 7, files: 3 },
            }),
        });
        const { container, unmount } = renderChat(svc);
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        expect(container.querySelector('.session-summary-badge')).to.not.be.null;
        unmount();
    });

    it('does NOT render .session-summary-badge when session has no summary', async () => {
        const svc = makeMockSessionService({
            activeSession: makeSession({ summary: undefined }),
        });
        const { container, unmount } = renderChat(svc);
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        expect(container.querySelector('.session-summary-badge')).to.be.null;
        unmount();
    });

    it('shows +N additions in the badge', async () => {
        const svc = makeMockSessionService({
            activeSession: makeSession({
                summary: { additions: 42, deletions: 7, files: 3 },
            }),
        });
        const { container, unmount } = renderChat(svc);
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const badge = container.querySelector('.session-summary-badge');
        expect(badge!.textContent).to.include('42');
        unmount();
    });

    it('shows -N deletions in the badge', async () => {
        const svc = makeMockSessionService({
            activeSession: makeSession({
                summary: { additions: 42, deletions: 7, files: 3 },
            }),
        });
        const { container, unmount } = renderChat(svc);
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });

        const badge = container.querySelector('.session-summary-badge');
        expect(badge!.textContent).to.include('7');
        unmount();
    });
});
