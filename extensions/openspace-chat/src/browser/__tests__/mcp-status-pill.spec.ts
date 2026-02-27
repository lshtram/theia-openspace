/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for McpStatusPill and McpStatusDropdown in ChatHeaderBar.
 *
 * Tests verify that when an `mcpStatus` prop is passed to ChatHeaderBar:
 * - A .mcp-status-pill element is rendered
 * - The pill shows connected server count
 * - No pill renders when mcpStatus is undefined
 * - Clicking the pill opens a .mcp-status-dropdown
 * - The dropdown lists each server by name
 *
 * Tests load from compiled lib (openspace-chat/lib/...) to avoid
 * tsx/decorator issues in ts-node.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);

const { ChatHeaderBar } = _require('openspace-chat/lib/browser/chat-widget/chat-header-bar') as {
    ChatHeaderBar: React.FC<any>;
};

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const MCP_STATUS_WITH_SERVERS = {
    'openspace-hub': { type: 'connected', tools: [] },
    'tavily': { type: 'connected', tools: [] },
    'broken-server': { type: 'failed', error: 'timeout' },
};

function makeMinimalProps(overrides: any = {}): any {
    const sessionService = makeMockSessionService();
    return {
        showSessionList: false,
        sessions: [],
        activeSession: makeSession(),
        sessionService,
        isLoadingSessions: false,
        sessionLoadError: undefined,
        isStreaming: false,
        pendingPermissions: [],
        onLoadSessions: sinon.stub(),
        onSessionSwitch: sinon.stub(),
        onNewSession: sinon.stub(),
        onDeleteSession: sinon.stub(),
        onForkSession: sinon.stub(),
        onRevertSession: sinon.stub(),
        onCompactSession: sinon.stub(),
        onShareSession: sinon.stub(),
        onUnshareSession: sinon.stub(),
        onRenameSession: sinon.stub().resolves(),
        onNavigateToParent: sinon.stub(),
        onToggleDropdown: sinon.stub(),
        enabledModels: [],
        onManageModels: sinon.stub(),
        ...overrides,
    };
}

function mountHeaderBar(props: any): { container: HTMLDivElement; unmount: () => void } {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(React.createElement(ChatHeaderBar, props)); });
    return {
        container,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

// ─── McpStatusPill Tests ───────────────────────────────────────────────────────

describe('McpStatusPill', () => {
    it('renders .mcp-status-pill when mcpStatus is provided', () => {
        const { container, unmount } = mountHeaderBar(makeMinimalProps({ mcpStatus: MCP_STATUS_WITH_SERVERS }));
        try {
            const pill = container.querySelector('.mcp-status-pill');
            expect(pill).to.not.equal(null, 'Expected .mcp-status-pill to be rendered');
        } finally {
            unmount();
        }
    });

    it('shows connected server count in the pill', () => {
        const { container, unmount } = mountHeaderBar(makeMinimalProps({ mcpStatus: MCP_STATUS_WITH_SERVERS }));
        try {
            const pill = container.querySelector('.mcp-status-pill');
            expect(pill).to.not.equal(null);
            // 2 out of 3 servers are 'connected'
            expect(pill!.textContent).to.include('2');
        } finally {
            unmount();
        }
    });

    it('does NOT render .mcp-status-pill when mcpStatus is undefined', () => {
        const { container, unmount } = mountHeaderBar(makeMinimalProps({ mcpStatus: undefined }));
        try {
            const pill = container.querySelector('.mcp-status-pill');
            expect(pill).to.equal(null, 'Expected no .mcp-status-pill when mcpStatus is undefined');
        } finally {
            unmount();
        }
    });

    it('opens .mcp-status-dropdown on pill click', () => {
        const { container, unmount } = mountHeaderBar(makeMinimalProps({ mcpStatus: MCP_STATUS_WITH_SERVERS }));
        try {
            const pill = container.querySelector('.mcp-status-pill') as HTMLElement;
            expect(pill).to.not.equal(null);
            // Dropdown should not be visible before click
            expect(container.querySelector('.mcp-status-dropdown')).to.equal(null);
            act(() => { pill.click(); });
            expect(container.querySelector('.mcp-status-dropdown')).to.not.equal(null, 'Expected .mcp-status-dropdown after click');
        } finally {
            unmount();
        }
    });

    it('lists each server by name in the dropdown', () => {
        const { container, unmount } = mountHeaderBar(makeMinimalProps({ mcpStatus: MCP_STATUS_WITH_SERVERS }));
        try {
            const pill = container.querySelector('.mcp-status-pill') as HTMLElement;
            act(() => { pill.click(); });
            const dropdown = container.querySelector('.mcp-status-dropdown');
            expect(dropdown).to.not.equal(null);
            expect(dropdown!.textContent).to.include('openspace-hub');
            expect(dropdown!.textContent).to.include('tavily');
            expect(dropdown!.textContent).to.include('broken-server');
        } finally {
            unmount();
        }
    });
});
