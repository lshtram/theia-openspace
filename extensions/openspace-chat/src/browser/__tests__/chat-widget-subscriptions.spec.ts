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
 * Unit tests for ChatWidget subscription churn (Bug H3)
 *
 * Verifies that event subscriptions (onActiveProjectChanged, onActiveSessionChanged,
 * onMessagesChanged, etc.) are registered exactly once per mount and are NOT
 * re-registered when unrelated state changes (e.g. toggling the session dropdown,
 * receiving new messages, or streaming status changes).
 *
 * Also verifies that subscriptions are properly disposed on unmount, and that
 * re-subscriptions only occur when actual dependencies change (sessionService ref).
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// Load compiled ChatComponent — avoids tsx/decorator issues in ts-node
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS1343 — file runs as ESM at test time despite module:commonjs in tsconfig
const _require = createRequire(import.meta.url);
const { ChatComponent } = _require('openspace-chat/lib/browser/chat-widget/chat-widget') as {
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
        onSessionStatusChanged: sinon.stub().returns({ dispose: sinon.stub() }),
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
        renameSession: sinon.stub().resolves(),
        shareSession: sinon.stub().resolves('https://share.example.com/session'),
        unshareSession: sinon.stub().resolves(),
        forkSession: sinon.stub().resolves(undefined),
         compactSession: sinon.stub().resolves(),
         revertSession: sinon.stub().resolves(),
         unrevertSession: sinon.stub().resolves(),
         getSessionError: sinon.stub().returns(undefined),
         getMessagesForPreview: sinon.stub().resolves([]),
         getMcpStatus: sinon.stub().resolves(undefined),
         ...overrides,
     };
}

const mockMessageService = {
    error: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
};

const mockPreferenceService = {
    get: sinon.stub().returns([]),
    onPreferenceChanged: sinon.stub().returns({ dispose: sinon.stub() }),
};

const mockCommandService = {
    executeCommand: sinon.stub().resolves(),
};

interface RenderResult {
    container: HTMLElement;
    root: Root;
    unmount: () => void;
}

function renderComponent(sessionService: any, workspaceRoot = ''): RenderResult {
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
            preferenceService: mockPreferenceService,
            commandService: mockCommandService,
            openerService: {} as any,
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
 */
async function flushTimers(): Promise<void> {
    await flushAsync();
    await act(async () => {
        await new Promise(r => setTimeout(r, 150));
    });
    await flushAsync();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatWidget - Subscription Churn (Bug H3)', () => {

    afterEach(() => {
        sinon.restore();
    });

    // ─── Subscription Stability ───────────────────────────────────────────────

    describe('Subscription stability across renders', () => {
        it('should subscribe to onActiveProjectChanged exactly once on mount', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
            });

            const { unmount } = renderComponent(sessionService);

            try {
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(1);
            } finally {
                unmount();
            }
        });

        it('should subscribe to onActiveSessionChanged exactly once on mount', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
            });

            const { unmount } = renderComponent(sessionService);

            try {
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(1);
            } finally {
                unmount();
            }
        });

        it('should NOT re-subscribe to events when toggling the session dropdown', async () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const { container, unmount } = renderComponent(sessionService);

            try {
                // Record call counts after initial mount
                const projectCallsAfterMount = sessionService.onActiveProjectChanged.callCount;
                const sessionCallsAfterMount = sessionService.onActiveSessionChanged.callCount;
                const messagesCallsAfterMount = sessionService.onMessagesChanged.callCount;
                const streamingCallsAfterMount = sessionService.onIsStreamingChanged.callCount;

                // Toggle session dropdown open
                const btn = container.querySelector('.session-dropdown-button') as HTMLButtonElement;
                act(() => { btn.click(); });

                await flushAsync();

                // Toggle session dropdown closed
                act(() => { btn.click(); });

                await flushAsync();

                // Subscription counts should NOT have increased
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(projectCallsAfterMount);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(sessionCallsAfterMount);
                expect(sessionService.onMessagesChanged.callCount).to.equal(messagesCallsAfterMount);
                expect(sessionService.onIsStreamingChanged.callCount).to.equal(streamingCallsAfterMount);
            } finally {
                unmount();
            }
        });

        it('should NOT re-subscribe to events when messages change', async () => {
            let messagesCallback: ((msgs: any[]) => void) | undefined;
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                onMessagesChanged: sinon.stub().callsFake((cb: (msgs: any[]) => void) => {
                    messagesCallback = cb;
                    return { dispose: sinon.stub() };
                }),
            });

            const { unmount } = renderComponent(sessionService);

            try {
                const projectCallsAfterMount = sessionService.onActiveProjectChanged.callCount;
                const sessionCallsAfterMount = sessionService.onActiveSessionChanged.callCount;

                // Simulate receiving new messages
                if (messagesCallback) {
                    await act(async () => {
                        messagesCallback!([{ id: 'msg-1', role: 'user', content: [{ type: 'text', text: 'hello' }] }]);
                    });
                }

                // Event subscriptions should NOT have been re-created
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(projectCallsAfterMount);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(sessionCallsAfterMount);
            } finally {
                unmount();
            }
        });

        it('should NOT re-subscribe to events when streaming status changes', async () => {
            let streamingStatusCallback: ((status: string) => void) | undefined;
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                onStreamingStatusChanged: sinon.stub().callsFake((cb: (s: string) => void) => {
                    streamingStatusCallback = cb;
                    return { dispose: sinon.stub() };
                }),
            });

            const { unmount } = renderComponent(sessionService);

            try {
                const projectCallsAfterMount = sessionService.onActiveProjectChanged.callCount;
                const sessionCallsAfterMount = sessionService.onActiveSessionChanged.callCount;

                // Simulate streaming status change
                if (streamingStatusCallback) {
                    await act(async () => {
                        streamingStatusCallback!('Thinking...');
                    });
                    await act(async () => {
                        streamingStatusCallback!('Writing code...');
                    });
                }

                // No re-subscriptions
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(projectCallsAfterMount);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(sessionCallsAfterMount);
            } finally {
                unmount();
            }
        });
    });

    // ─── Subscription Count ──────────────────────────────────────────────────

    describe('Subscription count per mount', () => {
        it('should call each core event registration function exactly once per mount', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
            });

            const { unmount } = renderComponent(sessionService);

            try {
                // The main subscription useEffect ([sessionService, loadSessions]) subscribes once
                expect(sessionService.onMessagesChanged.callCount).to.equal(1);
                expect(sessionService.onIsStreamingChanged.callCount).to.equal(1);
                expect(sessionService.onStreamingStatusChanged.callCount).to.equal(1);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(1);
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(1);
                expect(sessionService.onQuestionChanged.callCount).to.equal(1);
                expect(sessionService.onPermissionChanged.callCount).to.equal(1);
            } finally {
                unmount();
            }
        });

        it('should subscribe to onActiveModelChanged at least once per mount', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
            });

            const { unmount } = renderComponent(sessionService);

            try {
                // onActiveModelChanged is in its own useEffect with [sessionService] deps.
                // It should be called at least once; if it's called more than once,
                // that indicates the effect is re-running due to dependency instability.
                expect(sessionService.onActiveModelChanged.callCount).to.be.at.least(1);
            } finally {
                unmount();
            }
        });

        it('should not double-register listeners on re-render with same props', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
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
                    messageService: mockMessageService,
                    preferenceService: mockPreferenceService,
                    commandService: mockCommandService,
                    openerService: {} as any,
                }));
            });

            try {
                const countAfterFirstRender = sessionService.onActiveProjectChanged.callCount;

                // Force a re-render with identical props
                act(() => {
                    root.render(React.createElement(ChatComponent, {
                        sessionService,
                        openCodeService: {},
                        workspaceRoot: '',
                        messageService: mockMessageService,
                        preferenceService: mockPreferenceService,
                        commandService: mockCommandService,
                        openerService: {} as any,
                    }));
                });

                // Since sessionService ref is the same, useEffect should NOT re-run
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(countAfterFirstRender);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(countAfterFirstRender);
                expect(sessionService.onMessagesChanged.callCount).to.equal(countAfterFirstRender);
            } finally {
                act(() => root.unmount());
                container.remove();
            }
        });
    });

    // ─── Cleanup on Unmount ──────────────────────────────────────────────────

    describe('Cleanup on unmount', () => {
        it('should dispose all subscriptions when component unmounts', () => {
            const disposeStubs = {
                messages: sinon.stub(),
                streamingState: sinon.stub(),
                streamingStatus: sinon.stub(),
                sessionStatus: sinon.stub(),
                session: sinon.stub(),
                project: sinon.stub(),
                question: sinon.stub(),
                permission: sinon.stub(),
                modelChanged: sinon.stub(),
            };

            const sessionService = createMockSessionService({
                onMessagesChanged: sinon.stub().returns({ dispose: disposeStubs.messages }),
                onIsStreamingChanged: sinon.stub().returns({ dispose: disposeStubs.streamingState }),
                onStreamingStatusChanged: sinon.stub().returns({ dispose: disposeStubs.streamingStatus }),
                onSessionStatusChanged: sinon.stub().returns({ dispose: disposeStubs.sessionStatus }),
                onActiveSessionChanged: sinon.stub().returns({ dispose: disposeStubs.session }),
                onActiveProjectChanged: sinon.stub().returns({ dispose: disposeStubs.project }),
                onQuestionChanged: sinon.stub().returns({ dispose: disposeStubs.question }),
                onPermissionChanged: sinon.stub().returns({ dispose: disposeStubs.permission }),
                onActiveModelChanged: sinon.stub().returns({ dispose: disposeStubs.modelChanged }),
            });

            const { unmount } = renderComponent(sessionService);
            unmount();

            // Core subscription disposables from the main useEffect must all be called
            expect(disposeStubs.messages.called).to.be.true;
            expect(disposeStubs.streamingState.called).to.be.true;
            expect(disposeStubs.streamingStatus.called).to.be.true;
            expect(disposeStubs.session.called).to.be.true;
            expect(disposeStubs.project.called).to.be.true;
            expect(disposeStubs.question.called).to.be.true;
            expect(disposeStubs.permission.called).to.be.true;
            // Model changed has its own useEffect cleanup
            expect(disposeStubs.modelChanged.called).to.be.true;
        });

        it('should dispose subscriptions before creating new ones if dependencies change', () => {
            const disposeStubsFirst = {
                messages: sinon.stub(),
                project: sinon.stub(),
                session: sinon.stub(),
            };

            const firstSessionService = createMockSessionService({
                onMessagesChanged: sinon.stub().returns({ dispose: disposeStubsFirst.messages }),
                onActiveProjectChanged: sinon.stub().returns({ dispose: disposeStubsFirst.project }),
                onActiveSessionChanged: sinon.stub().returns({ dispose: disposeStubsFirst.session }),
            });

            const secondSessionService = createMockSessionService();

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService: firstSessionService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: mockMessageService,
                    preferenceService: mockPreferenceService,
                    commandService: mockCommandService,
                    openerService: {} as any,
                }));
            });

            try {
                // Switch to a different sessionService instance — triggers useEffect cleanup + re-subscribe
                act(() => {
                    root.render(React.createElement(ChatComponent, {
                        sessionService: secondSessionService,
                        openCodeService: {},
                        workspaceRoot: '',
                        messageService: mockMessageService,
                        preferenceService: mockPreferenceService,
                        commandService: mockCommandService,
                        openerService: {} as any,
                    }));
                });

                // First service's subscriptions should have been disposed
                expect(disposeStubsFirst.messages.calledOnce).to.be.true;
                expect(disposeStubsFirst.project.calledOnce).to.be.true;
                expect(disposeStubsFirst.session.calledOnce).to.be.true;

                // Second service should have gotten new subscriptions
                expect(secondSessionService.onMessagesChanged.calledOnce).to.be.true;
                expect(secondSessionService.onActiveProjectChanged.calledOnce).to.be.true;
                expect(secondSessionService.onActiveSessionChanged.calledOnce).to.be.true;
            } finally {
                act(() => root.unmount());
                container.remove();
            }
        });
    });

    // ─── Re-subscription on Relevant Changes Only ────────────────────────────

    describe('Re-subscription on relevant changes only', () => {
        it('should re-subscribe when sessionService instance changes', () => {
            const firstService = createMockSessionService();
            const secondService = createMockSessionService();

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService: firstService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: mockMessageService,
                    preferenceService: mockPreferenceService,
                    commandService: mockCommandService,
                    openerService: {} as any,
                }));
            });

            try {
                expect(firstService.onActiveProjectChanged.callCount).to.equal(1);
                expect(secondService.onActiveProjectChanged.callCount).to.equal(0);

                // Swap sessionService → new dependency, should trigger re-subscribe
                act(() => {
                    root.render(React.createElement(ChatComponent, {
                        sessionService: secondService,
                        openCodeService: {},
                        workspaceRoot: '',
                        messageService: mockMessageService,
                        preferenceService: mockPreferenceService,
                        commandService: mockCommandService,
                        openerService: {} as any,
                    }));
                });

                expect(secondService.onActiveProjectChanged.callCount).to.equal(1);
                expect(secondService.onActiveSessionChanged.callCount).to.equal(1);
                expect(secondService.onMessagesChanged.callCount).to.equal(1);
            } finally {
                act(() => root.unmount());
                container.remove();
            }
        });

        it('should NOT re-subscribe when only workspaceRoot changes', () => {
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
            });

            const container = document.createElement('div');
            document.body.appendChild(container);
            let root: Root;

            act(() => {
                root = createRoot(container);
                root.render(React.createElement(ChatComponent, {
                    sessionService,
                    openCodeService: {},
                    workspaceRoot: '/workspace-a',
                    messageService: mockMessageService,
                    preferenceService: mockPreferenceService,
                    commandService: mockCommandService,
                    openerService: {} as any,
                }));
            });

            try {
                const callsAfterMount = sessionService.onActiveProjectChanged.callCount;

                // Change workspaceRoot — this is NOT a dependency of the subscription useEffect
                act(() => {
                    root.render(React.createElement(ChatComponent, {
                        sessionService,
                        openCodeService: {},
                        workspaceRoot: '/workspace-b',
                        messageService: mockMessageService,
                        preferenceService: mockPreferenceService,
                        commandService: mockCommandService,
                        openerService: {} as any,
                    }));
                });

                // Subscription count should remain the same
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(callsAfterMount);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(callsAfterMount);
            } finally {
                act(() => root.unmount());
                container.remove();
            }
        });
    });

    // ─── loadSessions stability ─────────────────────────────────────────────

    describe('loadSessions callback stability', () => {
        it('should use a stable loadSessions reference across renders', async () => {
            // If loadSessions is recreated on every render, it would cause
            // the subscription useEffect to re-run (since loadSessions is a dep).
            // We verify stability by checking that subscriptions are not re-created.
            const sessionService = createMockSessionService({
                activeProject: mockProject,
                activeSession: mockSession1,
                getSessions: sinon.stub().resolves([mockSession1]),
            });

            const { container, unmount } = renderComponent(sessionService);

            try {
                const initialProjectCalls = sessionService.onActiveProjectChanged.callCount;
                const initialSessionCalls = sessionService.onActiveSessionChanged.callCount;

                // Trigger multiple state changes that cause re-renders but should NOT
                // destabilize loadSessions or the subscription useEffect
                const btn = container.querySelector('.session-dropdown-button') as HTMLButtonElement;

                // Open dropdown
                act(() => { btn.click(); });
                await flushAsync();

                // Close dropdown
                act(() => { btn.click(); });
                await flushAsync();

                // Open again
                act(() => { btn.click(); });
                await flushAsync();

                // Subscription registrations should remain at the initial count
                expect(sessionService.onActiveProjectChanged.callCount).to.equal(initialProjectCalls);
                expect(sessionService.onActiveSessionChanged.callCount).to.equal(initialSessionCalls);
            } finally {
                unmount();
            }
        });

        it('should call getSessions exactly once on mount when no events fire', async () => {
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({
                getSessions,
                activeProject: mockProject,
            });

            const { unmount } = renderComponent(sessionService);

            try {
                await flushTimers();

                // getSessions is called once via loadSessions() in the subscription useEffect
                expect(getSessions.callCount).to.equal(1);
            } finally {
                unmount();
            }
        });
    });
});
