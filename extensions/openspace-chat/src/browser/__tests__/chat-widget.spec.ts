/* eslint-disable @typescript-eslint/no-explicit-any */
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Unit tests for ChatWidget / ChatComponent
 *
 * Tests render real React component behaviour using jsdom + React 18 createRoot.
 * Imports are done via the compiled lib to avoid ts-node's inability to handle
 * .tsx files with JSX + inversify decorators in this test environment.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// Derive __dirname from import.meta.url (works in ESM at runtime)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS1343
const __dirname_chat = path.dirname(new URL(import.meta.url).pathname);

// Load compiled ChatComponent — avoids tsx/decorator issues in ts-node
// createRequire(import.meta.url) works in both ESM (runtime) and CJS (ts-node) contexts.
// ts-ignore: import.meta.url is valid at runtime (mocha loads this as ESM), but TS
// rejects it under module:commonjs. The cast suppresses the compile error.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS1343 — file runs as ESM at test time despite module:commonjs in tsconfig
const _require = createRequire(import.meta.url);
const { ChatComponent } = _require('openspace-chat/lib/browser/chat-widget') as {
    ChatComponent: React.FC<any>
};

// Polyfill scrollIntoView — not implemented in jsdom
if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockProject = {
    id: 'proj-1',
    worktree: '/test',
    time: { created: Date.now() },
};

const mockSession1 = {
    id: 'session-1',
    projectID: 'proj-1',
    title: 'Test Session 1',
    time: { created: Date.now(), updated: Date.now() },
    directory: '/test',
    version: '1.0.0',
};

const mockSession2 = {
    id: 'session-2',
    projectID: 'proj-1',
    title: 'Test Session 2',
    time: { created: Date.now(), updated: Date.now() },
    directory: '/test',
    version: '1.0.0',
};

function createMockSessionService(overrides: Partial<any> = {}): any {
    return {
        activeProject: undefined,
        activeSession: undefined,
        activeModel: undefined,
        messages: [],
        isLoading: false,
        lastError: undefined,
        isStreaming: false,
        getSessions: sinon.stub().resolves([]),
        createSession: sinon.stub().resolves(mockSession1),
        setActiveSession: sinon.stub().resolves(),
        setActiveModel: sinon.stub(),
        deleteSession: sinon.stub().resolves(),
        sendMessage: sinon.stub().resolves(),
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
        answerQuestion: sinon.stub().resolves(),
        rejectQuestion: sinon.stub().resolves(),
        replyPermission: sinon.stub().resolves(),
        ...overrides,
    };
}

const mockMessageService = {
    error: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
};

function renderComponent(sessionService: any, workspaceRoot = ''): {
    container: HTMLElement;
    root: Root;
    unmount: () => void;
} {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root;

    act(() => {
        root = createRoot(container);
        root.render(React.createElement(ChatComponent, {
            sessionService,
            openCodeService: {},
            workspaceRoot,
            messageService: mockMessageService,
        }));
    });

    return {
        container,
        root: root!,
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        },
    };
}

/** Helper to flush async React state updates (microtasks only) */
async function flushAsync(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

/**
 * Wait past the 100ms minimum-display-time setTimeout in loadSessions.
 * Must be called after flushAsync() when you need sessions/loading state settled.
 */
async function flushTimers(): Promise<void> {
    await flushAsync();
    await act(async () => {
        await new Promise(r => setTimeout(r, 150));
    });
    await flushAsync();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatWidget - Session Management', () => {
    let originalConfirm: typeof window.confirm;

    beforeEach(() => {
        // Save original confirm
        originalConfirm = (global as any).confirm;
    });

    afterEach(() => {
        // Restore confirm
        (global as any).confirm = originalConfirm;
        sinon.restore();
    });

    // ─── Session Dropdown ──────────────────────────────────────────────────────

    describe('Session Dropdown', () => {
        it('should render session dropdown button with current session title', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const { container, unmount } = renderComponent(sessionService);

            const btn = container.querySelector('.session-dropdown-button');
            expect(btn).to.not.be.null;
            expect(btn!.textContent).to.include('Test Session 1');

            unmount();
        });

        it('should render "No Session" when no active session', () => {
            const sessionService = createMockSessionService({
                activeSession: undefined,
            });

            const { container, unmount } = renderComponent(sessionService);

            const btn = container.querySelector('.session-dropdown-button');
            expect(btn).to.not.be.null;
            expect(btn!.textContent).to.include('No Session');

            unmount();
        });

        it('should show no-active-session message when no session is set', () => {
            const sessionService = createMockSessionService({
                activeSession: undefined,
            });

            const { container, unmount } = renderComponent(sessionService);

            expect(container.innerHTML).to.include('No active session');

            unmount();
        });

        it('should toggle session dropdown on button click', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const { container, unmount } = renderComponent(sessionService);

            const btn = container.querySelector('.session-dropdown-button') as HTMLButtonElement;
            expect(btn.getAttribute('aria-expanded')).to.equal('false');

            act(() => { btn.click(); });

            expect(btn.getAttribute('aria-expanded')).to.equal('true');
            const dropdown = container.querySelector('.session-list-dropdown');
            expect(dropdown).to.not.be.null;

            unmount();
        });

        it('should load sessions when dropdown is opened', () => {
            const getSessions = sinon.stub().resolves([mockSession1, mockSession2]);
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                getSessions,
            });

            const { container, unmount } = renderComponent(sessionService);

            // getSessions is called on mount (initial load)
            expect(getSessions.called).to.be.true;

            act(() => {
                const btn = container.querySelector('.session-dropdown-button') as HTMLButtonElement;
                btn.click();
            });

            const dropdown = container.querySelector('.session-list-dropdown');
            expect(dropdown).to.not.be.null;

            unmount();
        });

        it('should display sessions list in dropdown', async () => {
            const getSessions = sinon.stub().resolves([mockSession1, mockSession2]);
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                getSessions,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Wait for initial getSessions to resolve and for the 100ms minimum-display-time timer
            await flushTimers();

            // Open dropdown
            act(() => {
                (container.querySelector('.session-dropdown-button') as HTMLButtonElement).click();
            });

            // Sessions should now be in the rendered dropdown
            const items = container.querySelectorAll('.session-list-item');
            expect(items.length).to.equal(2);
            expect(items[0].textContent).to.include('Test Session 1');
            expect(items[1].textContent).to.include('Test Session 2');

            unmount();
        });

        it('should show "No sessions yet" when project is set but no sessions exist', async () => {
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: undefined,
                getSessions,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Wait for initial getSessions to resolve and for the 100ms minimum-display-time timer
            await flushTimers();

            // Open dropdown
            act(() => {
                (container.querySelector('.session-dropdown-button') as HTMLButtonElement).click();
            });

            expect(container.innerHTML).to.include('No sessions yet');

            unmount();
        });

        it('should show "No project selected" warning in dropdown when no project', async () => {
            const sessionService = createMockSessionService({
                activeProject: undefined,
                activeSession: undefined,
            });

            const { container, unmount } = renderComponent(sessionService);

            act(() => {
                (container.querySelector('.session-dropdown-button') as HTMLButtonElement).click();
            });

            await flushAsync();

            expect(container.innerHTML).to.include('No project selected');

            unmount();
        });
    });

    // ─── Session Creation ──────────────────────────────────────────────────────

    describe('Session Creation', () => {
        it('should call createSession when "+ New" button is clicked', async () => {
            const createSession = sinon.stub().resolves({ ...mockSession1, id: 'session-new' });
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                createSession,
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const { container, unmount } = renderComponent(sessionService);

            const newBtn = container.querySelector('.new-session-button') as HTMLButtonElement;
            expect(newBtn).to.not.be.null;

            await act(async () => { newBtn.click(); });

            expect(createSession.calledOnce).to.be.true;

            unmount();
        });

        it('should show error via messageService when createSession fails', async () => {
            const errorStub = sinon.stub();
            const msgSvc = { error: errorStub, info: sinon.stub(), warn: sinon.stub() };
            const createSession = sinon.stub().rejects(new Error('Create failed'));
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                createSession,
            });

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: msgSvc,
                }));
            });

            const newBtn = container.querySelector('.new-session-button') as HTMLButtonElement;
            await act(async () => { newBtn.click(); });

            expect(errorStub.calledOnce).to.be.true;
            expect(errorStub.firstCall.args[0]).to.include('Failed to create session');

            act(() => root!.unmount());
            document.body.removeChild(container);
        });
    });

    // ─── Session Switching ────────────────────────────────────────────────────

    describe('Session Switching', () => {
        it('should call setActiveSession when a session item is clicked', async () => {
            const setActiveSession = sinon.stub().resolves();
            const getSessions = sinon.stub().resolves([mockSession1, mockSession2]);
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                setActiveSession,
                getSessions,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Wait for initial getSessions to resolve
            await flushAsync();

            // Open dropdown
            act(() => {
                (container.querySelector('.session-dropdown-button') as HTMLButtonElement).click();
            });

            const items = container.querySelectorAll('.session-list-item');
            if (items.length >= 2) {
                await act(async () => {
                    (items[1] as HTMLElement).click();
                });
                expect(setActiveSession.calledWith('session-2')).to.be.true;
            }

            unmount();
        });

        it('should close dropdown after switching session', async () => {
            const setActiveSession = sinon.stub().resolves();
            const getSessions = sinon.stub().resolves([mockSession1, mockSession2]);
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                setActiveSession,
                getSessions,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Wait for initial getSessions
            await flushAsync();

            const btn = container.querySelector('.session-dropdown-button') as HTMLButtonElement;
            act(() => { btn.click(); });

            const items = container.querySelectorAll('.session-list-item');
            if (items.length >= 2) {
                await act(async () => {
                    (items[1] as HTMLElement).click();
                });
                expect(btn.getAttribute('aria-expanded')).to.equal('false');
            }

            unmount();
        });
    });

    // ─── Session Deletion ──────────────────────────────────────────────────────

    describe('Session Deletion', () => {
        it('should show delete button only when a session is active', () => {
            const withSession = createMockSessionService({
                activeSession: mockSession1,
                activeProject: mockProject,
            });
            const { container: c1, unmount: u1 } = renderComponent(withSession);
            expect(c1.querySelector('.delete-session-button')).to.not.be.null;
            u1();

            const noSession = createMockSessionService({ activeSession: undefined });
            const { container: c2, unmount: u2 } = renderComponent(noSession);
            expect(c2.querySelector('.delete-session-button')).to.be.null;
            u2();
        });

        it('should call deleteSession after confirm dialog', async () => {
            // Mock messageService.warn to return 'Delete' (user confirmed)
            const warnStub = sinon.stub().resolves('Delete');
            const deleteSession = sinon.stub().resolves();
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                deleteSession,
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;
            const msgSvc = { error: sinon.stub(), info: sinon.stub(), warn: warnStub };

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: msgSvc,
                }));
            });

            const deleteBtn = container.querySelector('.delete-session-button') as HTMLButtonElement;
            await act(async () => { deleteBtn.click(); });

            // warnStub was called (confirmation dialog shown)
            expect(warnStub.called).to.be.true;
            // deleteSession was called after confirmation
            expect(deleteSession.calledOnce).to.be.true;
            expect(deleteSession.calledWith('session-1')).to.be.true;

            act(() => root.unmount());
            container.remove();
        });

        it('should NOT call deleteSession when confirm is cancelled', async () => {
            // Mock messageService.warn to return 'Cancel' (user cancelled)
            const warnStub = sinon.stub().resolves('Cancel');
            const deleteSession = sinon.stub().resolves();
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                deleteSession,
            });

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;
            const msgSvc = { error: sinon.stub(), info: sinon.stub(), warn: warnStub };

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: msgSvc,
                }));
            });

            const deleteBtn = container.querySelector('.delete-session-button') as HTMLButtonElement;
            await act(async () => { deleteBtn.click(); });

            expect(deleteSession.called).to.be.false;

            act(() => root.unmount());
            container.remove();
        });

        it('should show error via messageService when deleteSession fails', async () => {
            const errorStub = sinon.stub();
            // warn resolves to 'Delete' so the deletion proceeds and hits the error
            const msgSvc = { error: errorStub, info: sinon.stub(), warn: sinon.stub().resolves('Delete') };
            const deleteSession = sinon.stub().rejects(new Error('Delete failed'));
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                deleteSession,
            });

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: msgSvc,
                }));
            });

            const deleteBtn = container.querySelector('.delete-session-button') as HTMLButtonElement;
            await act(async () => { deleteBtn.click(); });

            expect(errorStub.calledOnce).to.be.true;
            expect(errorStub.firstCall.args[0]).to.include('Failed to delete session');

            act(() => root!.unmount());
            document.body.removeChild(container);
        });
    });

    // ─── Active Session View ───────────────────────────────────────────────────

    describe('Active Session View', () => {
        it('should render prompt input and model selector when session is active', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                activeModel: 'anthropic/claude-3-5',
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const { container, unmount } = renderComponent(sessionService);

            // PromptInput renders .prompt-input-container; ModelSelector renders .model-selector
            expect(container.querySelector('.prompt-input-container')).to.not.be.null;
            expect(container.querySelector('.model-selector')).to.not.be.null;
            expect(container.querySelector('.message-timeline')).to.not.be.null;

            unmount();
        });

        it('should hide prompt input when no session is active', () => {
            const sessionService = createMockSessionService({ activeSession: undefined });
            const { container, unmount } = renderComponent(sessionService);

            expect(container.querySelector('.prompt-input-container')).to.be.null;

            unmount();
        });

        it('should show hint text when no session is active', () => {
            const sessionService = createMockSessionService({ activeSession: undefined });
            const { container, unmount } = renderComponent(sessionService);

            expect(container.innerHTML).to.include('Select a session above or create a new one');

            unmount();
        });
    });

    // ─── Event Listener Subscriptions ─────────────────────────────────────────

    describe('Edge Cases', () => {
        it('should call getSessions on initial mount', () => {
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({ getSessions });

            const { unmount } = renderComponent(sessionService);

            expect(getSessions.called).to.be.true;

            unmount();
        });

         it('should register all required event listeners on mount', () => {
            const sessionService = createMockSessionService();
            const { unmount } = renderComponent(sessionService);

            expect(sessionService.onMessagesChanged.called).to.be.true;
            expect(sessionService.onIsStreamingChanged.called).to.be.true;
            expect(sessionService.onStreamingStatusChanged.called).to.be.true;
            expect(sessionService.onActiveSessionChanged.called).to.be.true;
            expect(sessionService.onActiveProjectChanged.called).to.be.true;
            expect(sessionService.onQuestionChanged.called).to.be.true;
            expect(sessionService.onPermissionChanged.called).to.be.true;

            unmount();
        });

        it('should dispose all event listeners on unmount', () => {
            const disposeStubs = {
                messages: sinon.stub(),
                streamingState: sinon.stub(),
                streamingStatus: sinon.stub(),
                session: sinon.stub(),
                project: sinon.stub(),
                question: sinon.stub(),
                permission: sinon.stub(),
            };

            const sessionService = createMockSessionService({
                onMessagesChanged: sinon.stub().returns({ dispose: disposeStubs.messages }),
                onIsStreamingChanged: sinon.stub().returns({ dispose: disposeStubs.streamingState }),
                onStreamingStatusChanged: sinon.stub().returns({ dispose: disposeStubs.streamingStatus }),
                onActiveSessionChanged: sinon.stub().returns({ dispose: disposeStubs.session }),
                onActiveProjectChanged: sinon.stub().returns({ dispose: disposeStubs.project }),
                onQuestionChanged: sinon.stub().returns({ dispose: disposeStubs.question }),
                onPermissionChanged: sinon.stub().returns({ dispose: disposeStubs.permission }),
            });

            const { unmount } = renderComponent(sessionService);
            unmount();

            expect(disposeStubs.messages.calledOnce).to.be.true;
            expect(disposeStubs.streamingState.calledOnce).to.be.true;
            expect(disposeStubs.streamingStatus.calledOnce).to.be.true;
            expect(disposeStubs.session.calledOnce).to.be.true;
            expect(disposeStubs.project.calledOnce).to.be.true;
            expect(disposeStubs.question.calledOnce).to.be.true;
            expect(disposeStubs.permission.calledOnce).to.be.true;
        });

        it('should handle empty sessions list gracefully', async () => {
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                getSessions,
            });

            const { container, unmount } = renderComponent(sessionService);

            act(() => {
                (container.querySelector('.session-dropdown-button') as HTMLButtonElement).click();
            });

            await flushAsync();

            expect(container.querySelector('.session-list-dropdown')).to.not.be.null;

            unmount();
        });
    });
});

describe('ChatWidget - MessageService for delete confirmation (T3-10)', () => {
    it('should use messageService.warn for delete session confirmation, not window.confirm', () => {
        const src = fs.readFileSync(
            path.join(__dirname_chat, '../chat-widget.tsx'),
            'utf-8'
        );
        // Must NOT use window.confirm
        expect(src).not.to.include('window.confirm');
        expect(src).not.to.match(/\bconfirm\s*\(/);
        // Must use messageService.warn
        expect(src).to.include('messageService.warn');
    });
});

describe('ModelSelector - multi-slash model ID parsing (T3-12)', () => {
    it('should parse multi-slash model IDs correctly', () => {
        const src = fs.readFileSync(
            path.join(__dirname_chat, '../model-selector.tsx'),
            'utf-8'
        );
        // Must NOT use destructuring that drops extra slashes
        expect(src).not.to.match(/const\s*\[providerId,\s*modelId\]\s*=.*split\('\/'\)/);
        // Must use rest spread + join to preserve multi-slash model IDs
        expect(src).to.match(/\.\.\.\s*modelParts.*join\('\/'\)/s);
    });
});
