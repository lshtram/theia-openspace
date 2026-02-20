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
 * Unit tests for ChatWidget Session Auto-Load Fix
 *
 * Tests render real React component behaviour using jsdom + React 18 createRoot.
 * Covers:
 *  - Sessions load on mount (initial getSessions call)
 *  - Sessions reload when onActiveProjectChanged fires
 *  - Loading state (isLoadingSessions) while getSessions is in-flight
 *  - Error state displayed when getSessions rejects
 *  - Retry button clears error and reloads
 *  - All event listeners are disposed on unmount
 *
 * Imports from compiled lib to avoid ts-node tsx + inversify decorator issues.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

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
    name: 'Test Project',
    worktree: '/test',
    time: { created: Date.now() },
};

const mockSessions = [
    {
        id: 'sess-1',
        projectID: 'proj-1',
        title: 'Session 1',
        time: { created: Date.now(), updated: Date.now() },
        directory: '/test',
        version: '1.0.0',
    },
    {
        id: 'sess-2',
        projectID: 'proj-1',
        title: 'Session 2',
        time: { created: Date.now(), updated: Date.now() },
        directory: '/test',
        version: '1.0.0',
    },
];

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
        createSession: sinon.stub().resolves(mockSessions[0]),
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
        ...overrides,
    };
}

const mockMessageService = {
    error: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
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
 * Must be called when you need sessions/loading state fully settled.
 */
async function flushTimers(): Promise<void> {
    await flushAsync();
    await act(async () => {
        await new Promise(r => setTimeout(r, 150));
    });
    await flushAsync();
}

/** Open the session dropdown */
function openDropdown(container: HTMLElement): void {
    act(() => {
        (container.querySelector('.session-dropdown-button') as HTMLButtonElement)?.click();
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatWidget - Session Auto-Load Fix', () => {

    afterEach(() => {
        sinon.restore();
    });

    // ─── Primary Fix: Subscribe to Project Changes ─────────────────────────────

    describe('Primary Fix: Subscribe to Project Changes', () => {
        it('should call getSessions on initial mount', () => {
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({ getSessions });

            const { unmount } = renderComponent(sessionService);

            expect(getSessions.called).to.be.true;

            unmount();
        });

        it('should reload sessions when onActiveProjectChanged fires', async () => {
            let projectChangedCallback: ((project: any) => void) | undefined;
            const getSessions = sinon.stub().resolves([]);

            const sessionService = createMockSessionService({
                getSessions,
                onActiveProjectChanged: sinon.stub().callsFake((cb: (p: any) => void) => {
                    projectChangedCallback = cb;
                    return { dispose: sinon.stub() };
                }),
            });

            const { unmount } = renderComponent(sessionService);

            const callCountAfterMount = getSessions.callCount;
            expect(callCountAfterMount).to.be.greaterThan(0);

            // Simulate project load event firing
            sessionService.activeProject = mockProject;
            getSessions.resolves(mockSessions);

            if (projectChangedCallback) {
                await act(async () => {
                    projectChangedCallback!(mockProject);
                    await Promise.resolve();
                });
            }

            // getSessions should have been called again after project changed
            expect(getSessions.callCount).to.be.greaterThan(callCountAfterMount);

            unmount();
        });

        it('should reload sessions when onActiveSessionChanged fires', async () => {
            let sessionChangedCallback: (() => void) | undefined;
            const getSessions = sinon.stub().resolves([]);

            const sessionService = createMockSessionService({
                getSessions,
                onActiveSessionChanged: sinon.stub().callsFake((cb: () => void) => {
                    sessionChangedCallback = cb;
                    return { dispose: sinon.stub() };
                }),
            });

            const { unmount } = renderComponent(sessionService);

            const callCountAfterMount = getSessions.callCount;

            // Simulate session changed event
            if (sessionChangedCallback) {
                await act(async () => {
                    sessionChangedCallback!();
                    await Promise.resolve();
                });
            }

            // getSessions should have been called again
            expect(getSessions.callCount).to.be.greaterThan(callCountAfterMount);

            unmount();
        });

        it('should display loaded sessions in dropdown after project change', async () => {
            let projectChangedCallback: ((project: any) => void) | undefined;
            const getSessions = sinon.stub().resolves([]);

            const sessionService = createMockSessionService({
                getSessions,
                activeProject: mockProject,
                onActiveProjectChanged: sinon.stub().callsFake((cb: (p: any) => void) => {
                    projectChangedCallback = cb;
                    return { dispose: sinon.stub() };
                }),
            });

            const { container, unmount } = renderComponent(sessionService);

            // Simulate project change with sessions
            getSessions.resolves(mockSessions);

            if (projectChangedCallback) {
                await act(async () => {
                    projectChangedCallback!(mockProject);
                });
                await flushTimers();
            }

            // Open dropdown to verify sessions are shown
            openDropdown(container);

            const items = container.querySelectorAll('.session-list-item');
            expect(items.length).to.be.greaterThan(0);

            unmount();
        });
    });

    // ─── Secondary Fix: Loading State Management ───────────────────────────────

    describe('Secondary Fix: Loading State Management', () => {
        it('should show loading indicator while sessions are being fetched', async () => {
            let resolveGetSessions: (v: any[]) => void;
            const slowGetSessions = sinon.stub().returns(
                new Promise<any[]>(resolve => { resolveGetSessions = resolve; })
            );

            const sessionService = createMockSessionService({
                getSessions: slowGetSessions,
                // activeProject required for loading indicator to show in dropdown
                activeProject: mockProject,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Open dropdown so loading indicator is visible
            openDropdown(container);

            // While getSessions is pending, loading indicator should be visible
            const loadingEl = container.querySelector('.session-list-loading');
            expect(loadingEl).to.not.be.null;

            // Resolve the promise and flush
            await act(async () => {
                resolveGetSessions!([]);
                await Promise.resolve();
            });

            unmount();
        });

        it('should hide loading indicator after sessions load', async () => {
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({
                getSessions,
                activeProject: mockProject,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Open dropdown
            openDropdown(container);

            // Wait past the 100ms minimum display delay
            await flushTimers();

            const loadingEl = container.querySelector('.session-list-loading');
            expect(loadingEl).to.be.null;

            unmount();
        });
    });

    // ─── Tertiary Fix: Error State Management ─────────────────────────────────

    describe('Tertiary Fix: Error State Management', () => {
        it('should show error message when getSessions fails', async () => {
            const getSessions = sinon.stub().rejects(new Error('Network error'));
            const sessionService = createMockSessionService({
                getSessions,
                activeProject: mockProject,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Flush rejection and state update
            await flushAsync();

            // Open dropdown to see error
            openDropdown(container);

            expect(container.innerHTML).to.include('Network error');

            unmount();
        });

        it('should show retry button when getSessions fails', async () => {
            const getSessions = sinon.stub().rejects(new Error('Backend unavailable'));
            const sessionService = createMockSessionService({
                getSessions,
                activeProject: mockProject,
            });

            const { container, unmount } = renderComponent(sessionService);

            await flushAsync();
            openDropdown(container);

            // The retry button has class "retry-button"
            const retryBtn = container.querySelector('.retry-button');
            expect(retryBtn).to.not.be.null;

            unmount();
        });

        it('should clear error and reload sessions on retry', async () => {
            const getSessions = sinon.stub()
                .onFirstCall().rejects(new Error('Timeout'))
                .onSecondCall().resolves(mockSessions);

            const sessionService = createMockSessionService({
                getSessions,
                activeProject: mockProject,
            });

            const { container, unmount } = renderComponent(sessionService);

            // Flush first failure
            await flushAsync();
            openDropdown(container);

            // Should show error
            expect(container.innerHTML).to.include('Timeout');

            // Click retry button
            const retryBtn = container.querySelector('.retry-button') as HTMLButtonElement;
            if (retryBtn) {
                await act(async () => {
                    retryBtn.click();
                    await Promise.resolve();
                    await Promise.resolve();
                });

                // Error should be cleared after retry
                expect(container.innerHTML).to.not.include('Timeout');
                expect(getSessions.callCount).to.be.greaterThan(1);
            }

            unmount();
        });
    });

    // ─── Event Listener Cleanup ────────────────────────────────────────────────

    describe('Event Listener Cleanup', () => {
        it('should register all required event listeners on mount', () => {
            const sessionService = createMockSessionService();
            const { unmount } = renderComponent(sessionService);

            expect(sessionService.onMessagesChanged.called).to.be.true;
            expect(sessionService.onMessageStreaming.called).to.be.true;
            expect(sessionService.onIsStreamingChanged.called).to.be.true;
            expect(sessionService.onActiveSessionChanged.called).to.be.true;
            expect(sessionService.onActiveProjectChanged.called).to.be.true;

            unmount();
        });

        it('should dispose all event listeners on unmount', () => {
            const disposeStubs = {
                messages: sinon.stub(),
                streaming: sinon.stub(),
                streamingState: sinon.stub(),
                session: sinon.stub(),
                project: sinon.stub(),
            };

            const sessionService = createMockSessionService({
                onMessagesChanged: sinon.stub().returns({ dispose: disposeStubs.messages }),
                onMessageStreaming: sinon.stub().returns({ dispose: disposeStubs.streaming }),
                onIsStreamingChanged: sinon.stub().returns({ dispose: disposeStubs.streamingState }),
                onActiveSessionChanged: sinon.stub().returns({ dispose: disposeStubs.session }),
                onActiveProjectChanged: sinon.stub().returns({ dispose: disposeStubs.project }),
            });

            const { unmount } = renderComponent(sessionService);
            unmount();

            expect(disposeStubs.messages.calledOnce).to.be.true;
            expect(disposeStubs.streaming.calledOnce).to.be.true;
            expect(disposeStubs.streamingState.calledOnce).to.be.true;
            expect(disposeStubs.session.calledOnce).to.be.true;
            expect(disposeStubs.project.calledOnce).to.be.true;
        });

        it('should not leak listeners across re-renders', () => {
            const sessionService = createMockSessionService();
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
                }));
            });

            const initialCallCount = sessionService.onMessagesChanged.callCount;

            // Re-render with same sessionService — should not double-register
            act(() => {
                root.render(React.createElement(ChatComponent, {
                    sessionService,
                    openCodeService: {},
                    workspaceRoot: '',
                    messageService: mockMessageService,
                }));
            });

            // callCount should not increase significantly (same sessionService ref)
            expect(sessionService.onMessagesChanged.callCount).to.equal(initialCallCount);

            act(() => root.unmount());
            container.remove();
        });
    });

    // ─── Integration: Full Lifecycle ───────────────────────────────────────────

    describe('Integration: Full Lifecycle', () => {
        it('should handle complete flow: mount → project load → sessions load → unmount', async () => {
            let projectChangedCallback: ((project: any) => void) | undefined;

            const disposeProject = sinon.stub();
            const getSessions = sinon.stub().resolves([]);
            const sessionService = createMockSessionService({
                getSessions,
                activeProject: undefined,
                onActiveProjectChanged: sinon.stub().callsFake((cb: (p: any) => void) => {
                    projectChangedCallback = cb;
                    return { dispose: disposeProject };
                }),
            });

            const { container, unmount } = renderComponent(sessionService);

            // 1. Initial mount → getSessions called
            expect(getSessions.called).to.be.true;

            // 2. Simulate project becoming active
            sessionService.activeProject = mockProject;
            getSessions.resolves(mockSessions);

            if (projectChangedCallback) {
                await act(async () => {
                    projectChangedCallback!(mockProject);
                    await Promise.resolve();
                });
            }

            await flushTimers();

            // 3. Open dropdown — sessions should be present
            openDropdown(container);

            const items = container.querySelectorAll('.session-list-item');
            expect(items.length).to.be.greaterThan(0);

            // 4. Unmount → listeners disposed
            unmount();
            expect(disposeProject.called).to.be.true;
        });
    });
});
