/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for MessageBubble and TurnGroup components (message-bubble.tsx).
 * Loaded from compiled lib to avoid tsx/decorator issues in ts-node.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { MessageBubble, TurnGroup } = _require('openspace-chat/lib/browser/message-bubble') as {
    MessageBubble: React.FC<any>;
    TurnGroup: React.FC<any>;
};

// Polyfill atob/btoa in jsdom if not present
if (typeof (globalThis as any).atob === 'undefined') {
    (globalThis as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
    (globalThis as any).btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}

// Polyfill scrollIntoView — not implemented in jsdom
if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
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

function makeTextPart(text: string): any {
    return { type: 'text', text };
}

function makeToolPart(tool: string, state: any = {}, overrides: any = {}): any {
    return {
        type: 'tool',
        tool,
        state,
        id: `tool-${Math.random().toString(36).slice(2)}`,
        ...overrides,
    };
}

function makeReasoningPart(text: string): any {
    return { type: 'reasoning', text };
}

function makeFilePart(filename: string): any {
    return { type: 'file', filename };
}

function mount(props: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(MessageBubble, props));
    });
    return {
        container,
        root,
        unmount: () => { act(() => root.unmount()); container.remove(); },
        rerender: (newProps: any) => {
            act(() => { root.render(React.createElement(MessageBubble, newProps)); });
        },
    };
}

function mountTurnGroup(props: any, children?: React.ReactNode) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(TurnGroup, props, children || React.createElement('div', null, 'test content')));
    });
    return {
        container,
        root,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MessageBubble', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ─── Basic rendering ──────────────────────────────────────────────────────

    describe('Basic rendering', () => {
        it('renders user message with .message-bubble-user class', () => {
            const msg = makeMessage('user', [makeTextPart('hello')]);
            const { container, unmount } = mount({ message: msg, isUser: true });
            expect(container.querySelector('.message-bubble-user')).to.not.be.null;
            unmount();
        });

        it('renders assistant message with .message-bubble-assistant class', () => {
            const msg = makeMessage('assistant', [makeTextPart('hi')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            expect(container.querySelector('.message-bubble-assistant')).to.not.be.null;
            unmount();
        });

        it('shows streaming cursor when isStreaming=true', () => {
            const msg = makeMessage('assistant', [makeTextPart('streaming...')]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            expect(container.querySelector('.message-streaming-cursor')).to.not.be.null;
            unmount();
        });

        it('does not show streaming cursor when isStreaming=false', () => {
            const msg = makeMessage('assistant', [makeTextPart('done')]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: false });
            expect(container.querySelector('.message-streaming-cursor')).to.be.null;
            unmount();
        });

        it('shows Assistant header when isFirstInGroup=true and not user', () => {
            const msg = makeMessage('assistant', [makeTextPart('hello')]);
            const { container, unmount } = mount({ message: msg, isUser: false, isFirstInGroup: true });
            const header = container.querySelector('.message-bubble-header');
            expect(header).to.not.be.null;
            expect(header!.textContent).to.include('Assistant');
            unmount();
        });

        it('does not show header when isFirstInGroup=false', () => {
            const msg = makeMessage('assistant', [makeTextPart('hello')]);
            const { container, unmount } = mount({ message: msg, isUser: false, isFirstInGroup: false });
            expect(container.querySelector('.message-bubble-header')).to.be.null;
            unmount();
        });

        it('does not show header for user messages', () => {
            const msg = makeMessage('user', [makeTextPart('hello')]);
            const { container, unmount } = mount({ message: msg, isUser: true, isFirstInGroup: true });
            expect(container.querySelector('.message-bubble-header')).to.be.null;
            unmount();
        });

        it('applies .message-bubble-first and .message-bubble-last classes', () => {
            const msg = makeMessage('user', [makeTextPart('hello')]);
            const { container, unmount } = mount({
                message: msg, isUser: true, isFirstInGroup: true, isLastInGroup: true,
            });
            const article = container.querySelector('.message-bubble');
            expect(article!.classList.contains('message-bubble-first')).to.be.true;
            expect(article!.classList.contains('message-bubble-last')).to.be.true;
            unmount();
        });

        it('sets data-message-id and data-message-role attributes', () => {
            const msg = makeMessage('user', [makeTextPart('hi')], { id: 'test-id-123' });
            const { container, unmount } = mount({ message: msg, isUser: true });
            const article = container.querySelector('.message-bubble');
            expect(article!.getAttribute('data-message-id')).to.equal('test-id-123');
            expect(article!.getAttribute('data-message-role')).to.equal('user');
            unmount();
        });

        it('has correct aria-label for user message', () => {
            const msg = makeMessage('user', [makeTextPart('hi')]);
            const { container, unmount } = mount({ message: msg, isUser: true });
            const article = container.querySelector('.message-bubble');
            expect(article!.getAttribute('aria-label')).to.equal('User message');
            unmount();
        });

        it('has correct aria-label for assistant message', () => {
            const msg = makeMessage('assistant', [makeTextPart('hi')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            const article = container.querySelector('.message-bubble');
            expect(article!.getAttribute('aria-label')).to.equal('Assistant message');
            unmount();
        });
    });

    // ─── Text parts ───────────────────────────────────────────────────────────

    describe('Text parts', () => {
        it('renders plain text content', () => {
            const msg = makeMessage('assistant', [makeTextPart('Hello world')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            expect(container.textContent).to.include('Hello world');
            unmount();
        });

        it('skips empty text parts', () => {
            const msg = makeMessage('assistant', [makeTextPart('')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            const textParts = container.querySelectorAll('.part-text');
            expect(textParts.length).to.equal(0);
            unmount();
        });

        it('renders markdown in text parts', () => {
            const msg = makeMessage('assistant', [makeTextPart('**bold text**')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            const strong = container.querySelector('strong');
            expect(strong).to.not.be.null;
            expect(strong!.textContent).to.include('bold text');
            unmount();
        });
    });

    // ─── Tool parts ───────────────────────────────────────────────────────────

    describe('Tool parts', () => {
        it('renders tool header with tool name', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const name = container.querySelector('.part-tool-name');
            expect(name).to.not.be.null;
            expect(name!.textContent).to.equal('Shell');
            unmount();
        });

        it('shows subtitle for bash tool', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'completed', input: { command: 'ls -la' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const subtitle = container.querySelector('.part-tool-subtitle');
            expect(subtitle).to.not.be.null;
            expect(subtitle!.textContent).to.include('ls -la');
            unmount();
        });

        it('shows "Read" as display name for read tool', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/src/app.ts' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const name = container.querySelector('.part-tool-name');
            expect(name!.textContent).to.equal('Read');
            unmount();
        });

        it('tool block is collapsed by default', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'completed', input: { command: 'ls' }, output: 'file.txt' }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            expect(container.querySelector('.part-tool-body')).to.be.null;
            unmount();
        });

        it('clicking tool header expands body', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'completed', input: { command: 'ls' }, output: 'file.txt' }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const header = container.querySelector('.part-tool-header') as HTMLElement;
            act(() => { header.click(); });
            expect(container.querySelector('.part-tool-body')).to.not.be.null;
            unmount();
        });

        it('running tool shows spinner icon', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'running', input: { command: 'sleep 5' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            expect(container.querySelector('.oc-spin')).to.not.be.null;
            unmount();
        });

        it('error tool shows error icon', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'error', input: { command: 'fail' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            expect(container.querySelector('.part-tool-error-icon')).to.not.be.null;
            unmount();
        });

        it('edit tool shows diff badge with additions and deletions', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('edit', {
                    status: 'completed',
                    input: {
                        filePath: '/src/app.ts',
                        oldString: 'const x = 1;',
                        newString: 'const x = 2;\nconst y = 3;',
                    },
                }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const badge = container.querySelector('.part-tool-diff-badge');
            expect(badge).to.not.be.null;
            const additions = container.querySelector('.diff-additions');
            expect(additions).to.not.be.null;
            unmount();
        });

        it('edit tool shows filename and directory', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('edit', {
                    status: 'completed',
                    input: {
                        filePath: '/src/utils/helpers.ts',
                        oldString: 'a',
                        newString: 'b',
                    },
                }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const filename = container.querySelector('.part-tool-filename');
            expect(filename).to.not.be.null;
            expect(filename!.textContent).to.equal('helpers.ts');
            const dir = container.querySelector('.part-tool-directory');
            expect(dir).to.not.be.null;
            expect(dir!.textContent).to.equal('/src/utils');
            unmount();
        });
    });

    // ─── Context tool grouping ────────────────────────────────────────────────

    describe('Context tool grouping', () => {
        it('groups multiple consecutive context tools into a single .part-context-group', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
                makeToolPart('grep', { status: 'completed', input: { pattern: 'foo' } }),
                makeToolPart('glob', { status: 'completed', input: { pattern: '*.ts' } }),
                makeTextPart('done'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const contextGroups = container.querySelectorAll('.part-context-group');
            expect(contextGroups.length).to.equal(1);
            unmount();
        });

        it('single context tool renders as individual ToolBlock', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
                makeTextPart('found it'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            // Single context tool should NOT be in a context-group
            expect(container.querySelector('.part-context-group')).to.be.null;
            // It should render as a regular part-tool
            expect(container.querySelector('.part-tool')).to.not.be.null;
            unmount();
        });

        it('non-context tools break the grouping', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
                makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                makeToolPart('grep', { status: 'completed', input: { pattern: 'foo' } }),
                makeTextPart('text'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            // read + bash break the group, then grep is alone → no context group
            expect(container.querySelector('.part-context-group')).to.be.null;
            unmount();
        });

        it('context group shows completed count label', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
                makeToolPart('grep', { status: 'completed', input: { pattern: 'foo' } }),
                makeTextPart('done'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const groupName = container.querySelector('.part-context-group .part-tool-name');
            expect(groupName).to.not.be.null;
            expect(groupName!.textContent).to.include('Gathered context');
            expect(groupName!.textContent).to.include('2 tools');
            unmount();
        });

        it('context group shows "Gathering context..." when running', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'running', input: { filePath: '/a.ts' } }),
                makeToolPart('grep', { status: 'pending', input: { pattern: 'foo' } }),
                makeTextPart('done'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const groupName = container.querySelector('.part-context-group .part-tool-name');
            expect(groupName!.textContent).to.include('Gathering context');
            unmount();
        });
    });

    // ─── Reasoning parts ──────────────────────────────────────────────────────

    describe('Reasoning parts', () => {
        it('renders reasoning text in .part-reasoning-inline', () => {
            const msg = makeMessage('assistant', [
                makeReasoningPart('Let me think about this...'),
                makeTextPart('Here is my answer.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const reasoning = container.querySelector('.part-reasoning-inline');
            expect(reasoning).to.not.be.null;
            expect(reasoning!.textContent).to.include('Let me think about this');
            unmount();
        });

        it('empty reasoning returns null (no element rendered)', () => {
            const msg = makeMessage('assistant', [
                makeReasoningPart(''),
                makeTextPart('answer'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            expect(container.querySelector('.part-reasoning-inline')).to.be.null;
            unmount();
        });
    });

    // ─── File parts ───────────────────────────────────────────────────────────

    describe('File parts', () => {
        it('renders file pill with filename in .part-file', () => {
            const msg = makeMessage('assistant', [makeFilePart('report.pdf')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            const filePart = container.querySelector('.part-file');
            expect(filePart).to.not.be.null;
            expect(filePart!.textContent).to.include('report.pdf');
            unmount();
        });
    });

    // ─── Permission prompts ───────────────────────────────────────────────────

    describe('Permission prompts', () => {
        it('shows permission prompt when pendingPermissions has matching callID', () => {
            const toolPart = makeToolPart('bash', { status: 'running', input: { command: 'rm -rf /' } }, { callID: 'call-123' });
            const msg = makeMessage('assistant', [toolPart]);
            const perms = [{
                callID: 'call-123',
                permissionId: 'perm-1',
                title: 'Allow shell command?',
                permission: { message: 'Dangerous command' },
            }];
            const { container, unmount } = mount({
                message: msg, isUser: false, isStreaming: true,
                pendingPermissions: perms,
                onReplyPermission: sinon.stub(),
            });
            const prompt = container.querySelector('.part-tool-permission-prompt');
            expect(prompt).to.not.be.null;
            expect(prompt!.textContent).to.include('Allow shell command?');
            unmount();
        });

        it('shows Allow Once / Allow Always / Deny buttons', () => {
            const toolPart = makeToolPart('bash', { status: 'running' }, { callID: 'call-456' });
            const msg = makeMessage('assistant', [toolPart]);
            const perms = [{
                callID: 'call-456',
                permissionId: 'perm-2',
                title: 'Permit?',
            }];
            const { container, unmount } = mount({
                message: msg, isUser: false, isStreaming: true,
                pendingPermissions: perms,
                onReplyPermission: sinon.stub(),
            });
            const btns = container.querySelectorAll('.part-tool-permission-btn');
            expect(btns.length).to.equal(3);
            const texts = Array.from(btns).map(b => b.textContent);
            expect(texts).to.include('Allow Once');
            expect(texts).to.include('Allow Always');
            expect(texts).to.include('Deny');
            unmount();
        });

        it('clicking Allow Once calls onReplyPermission with "once"', () => {
            const onReply = sinon.stub();
            const toolPart = makeToolPart('bash', { status: 'running' }, { callID: 'call-789' });
            const msg = makeMessage('assistant', [toolPart]);
            const perms = [{ callID: 'call-789', permissionId: 'perm-3', title: 'Allow?' }];
            const { container, unmount } = mount({
                message: msg, isUser: false, isStreaming: true,
                pendingPermissions: perms,
                onReplyPermission: onReply,
            });
            const onceBtn = container.querySelector('.part-tool-permission-btn-once') as HTMLButtonElement;
            act(() => { onceBtn.click(); });
            expect(onReply.calledOnce).to.be.true;
            expect(onReply.firstCall.args).to.deep.equal(['perm-3', 'once']);
            unmount();
        });

        it('clicking Allow Always calls onReplyPermission with "always"', () => {
            const onReply = sinon.stub();
            const toolPart = makeToolPart('bash', { status: 'running' }, { callID: 'call-a' });
            const msg = makeMessage('assistant', [toolPart]);
            const perms = [{ callID: 'call-a', permissionId: 'perm-4', title: 'Allow?' }];
            const { container, unmount } = mount({
                message: msg, isUser: false, isStreaming: true,
                pendingPermissions: perms,
                onReplyPermission: onReply,
            });
            const alwaysBtn = container.querySelector('.part-tool-permission-btn-always') as HTMLButtonElement;
            act(() => { alwaysBtn.click(); });
            expect(onReply.calledOnce).to.be.true;
            expect(onReply.firstCall.args).to.deep.equal(['perm-4', 'always']);
            unmount();
        });

        it('clicking Deny calls onReplyPermission with "reject"', () => {
            const onReply = sinon.stub();
            const toolPart = makeToolPart('bash', { status: 'running' }, { callID: 'call-b' });
            const msg = makeMessage('assistant', [toolPart]);
            const perms = [{ callID: 'call-b', permissionId: 'perm-5', title: 'Allow?' }];
            const { container, unmount } = mount({
                message: msg, isUser: false, isStreaming: true,
                pendingPermissions: perms,
                onReplyPermission: onReply,
            });
            const denyBtn = container.querySelector('.part-tool-permission-btn-deny') as HTMLButtonElement;
            act(() => { denyBtn.click(); });
            expect(onReply.calledOnce).to.be.true;
            expect(onReply.firstCall.args).to.deep.equal(['perm-5', 'reject']);
            unmount();
        });

        it('no permission prompt when no matching callID', () => {
            const toolPart = makeToolPart('bash', { status: 'running' }, { callID: 'call-xyz' });
            const msg = makeMessage('assistant', [toolPart]);
            const perms = [{ callID: 'call-OTHER', permissionId: 'perm-6', title: 'Different' }];
            const { container, unmount } = mount({
                message: msg, isUser: false, isStreaming: true,
                pendingPermissions: perms,
                onReplyPermission: sinon.stub(),
            });
            expect(container.querySelector('.part-tool-permission-prompt')).to.be.null;
            unmount();
        });
    });

    // ─── Retry banner ─────────────────────────────────────────────────────────

    describe('Retry banner', () => {
        it('shows retry banner with message text when retryInfo provided', () => {
            const msg = makeMessage('assistant', [makeTextPart('response')]);
            const { container, unmount } = mount({
                message: msg,
                isUser: false,
                retryInfo: { message: 'Rate limited', attempt: 1, next: Date.now() + 5000 },
            });
            const banner = container.querySelector('.part-retry-banner');
            expect(banner).to.not.be.null;
            expect(banner!.textContent).to.include('Rate limited');
            unmount();
        });

        it('shows attempt number', () => {
            const msg = makeMessage('assistant', [makeTextPart('response')]);
            const { container, unmount } = mount({
                message: msg,
                isUser: false,
                retryInfo: { message: 'Error', attempt: 3, next: Date.now() + 5000 },
            });
            const attempt = container.querySelector('.part-retry-attempt');
            expect(attempt).to.not.be.null;
            expect(attempt!.textContent).to.include('#3');
            unmount();
        });

        it('truncates long error messages to 60 chars', () => {
            const longMsg = 'A'.repeat(80);
            const msg = makeMessage('assistant', [makeTextPart('response')]);
            const { container, unmount } = mount({
                message: msg,
                isUser: false,
                retryInfo: { message: longMsg, attempt: 1, next: Date.now() + 5000 },
            });
            const retryMessage = container.querySelector('.part-retry-message');
            expect(retryMessage!.textContent!.length).to.be.at.most(63); // 60 + "..."
            expect(retryMessage!.textContent).to.include('...');
            unmount();
        });
    });

    // ─── Intermediate step mode ───────────────────────────────────────────────

    describe('Intermediate step mode', () => {
        it('renders .message-bubble-intermediate (no article wrapper) when isIntermediateStep=true', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, isIntermediateStep: true,
            });
            expect(container.querySelector('.message-bubble-intermediate')).to.not.be.null;
            expect(container.querySelector('article.message-bubble')).to.be.null;
            unmount();
        });

        it('renders all parts flat, no TurnGroup, when isIntermediateStep=true', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                makeTextPart('result'),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, isIntermediateStep: true,
            });
            // Should have tool block visible directly
            expect(container.querySelector('.part-tool')).to.not.be.null;
            // No TurnGroup wrappers
            expect(container.querySelector('.turn-group')).to.be.null;
            unmount();
        });
    });

    // ─── File link click (onOpenFile) ─────────────────────────────────────────

    describe('File link click (onOpenFile)', () => {
        it('renders clickable button for file path subtitle when onOpenFile provided', () => {
            const onOpenFile = sinon.stub();
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/src/app.ts' } }),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, onOpenFile, isStreaming: true,
            });
            const fileLink = container.querySelector('.part-tool-file-link');
            expect(fileLink).to.not.be.null;
            expect(fileLink!.textContent).to.include('/src/app.ts');
            unmount();
        });

        it('calls onOpenFile with path when file link is clicked', () => {
            const onOpenFile = sinon.stub();
            const msg = makeMessage('assistant', [
                makeToolPart('read', { status: 'completed', input: { filePath: '/src/app.ts' } }),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, onOpenFile, isStreaming: true,
            });
            const fileLink = container.querySelector('.part-tool-file-link') as HTMLButtonElement;
            act(() => { fileLink.click(); });
            expect(onOpenFile.calledOnce).to.be.true;
            expect(onOpenFile.firstCall.args[0]).to.equal('/src/app.ts');
            unmount();
        });

        it('renders plain span for non-file-path subtitle', () => {
            const onOpenFile = sinon.stub();
            const msg = makeMessage('assistant', [
                makeToolPart('grep', { status: 'completed', input: { pattern: 'foo bar baz' } }),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, onOpenFile, isStreaming: true,
            });
            // "foo bar baz" has spaces, so it's not a file path → should be a span, not a button
            expect(container.querySelector('.part-tool-file-link')).to.be.null;
            const subtitle = container.querySelector('.part-tool-subtitle');
            expect(subtitle).to.not.be.null;
            expect(subtitle!.tagName.toLowerCase()).to.equal('span');
            unmount();
        });
    });

    // ─── Write tool diff display ──────────────────────────────────────────────

    describe('Write tool', () => {
        it('shows all lines as additions for write tool', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('write', {
                    status: 'completed',
                    input: { filePath: '/new-file.ts', content: 'line1\nline2\nline3' },
                }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const badge = container.querySelector('.part-tool-diff-badge');
            expect(badge).to.not.be.null;
            const additions = container.querySelector('.diff-additions');
            expect(additions!.textContent).to.equal('+3');
            // No deletions for write
            const deletions = container.querySelector('.diff-deletions');
            expect(deletions).to.be.null;
            unmount();
        });
    });

    // ─── TodoWrite tool ───────────────────────────────────────────────────────

    describe('TodoWrite tool', () => {
        it('renders todo checklist', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('todowrite', {
                    status: 'completed',
                    metadata: {
                        todos: [
                            { content: 'Fix bug', status: 'completed' },
                            { content: 'Write tests', status: 'pending' },
                        ],
                    },
                }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const todoItems = container.querySelectorAll('.part-todo-item');
            expect(todoItems.length).to.equal(2);
            expect(todoItems[0].textContent).to.include('Fix bug');
            expect(todoItems[1].textContent).to.include('Write tests');
            unmount();
        });

        it('shows completion count subtitle', () => {
            const msg = makeMessage('assistant', [
                makeToolPart('todowrite', {
                    status: 'completed',
                    metadata: {
                        todos: [
                            { content: 'Task A', status: 'completed' },
                            { content: 'Task B', status: 'completed' },
                            { content: 'Task C', status: 'pending' },
                        ],
                    },
                }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            const subtitle = container.querySelector('.part-todo-tool .part-tool-subtitle');
            expect(subtitle).to.not.be.null;
            expect(subtitle!.textContent).to.equal('2/3');
            unmount();
        });
    });
});

// ─── TurnGroup ────────────────────────────────────────────────────────────────

describe('TurnGroup', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('renders .turn-group-streaming class while streaming', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: true, durationSecs: 0,
        });
        expect(container.querySelector('.turn-group-streaming')).to.not.be.null;
        unmount();
    });

    it('shows streaming status text', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: true, durationSecs: 0, streamingStatus: 'Searching...',
        });
        const status = container.querySelector('.turn-group-status');
        expect(status).to.not.be.null;
        expect(status!.textContent).to.equal('Searching...');
        unmount();
    });

    it('shows default "Thinking" when no streamingStatus', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: true, durationSecs: 0,
        });
        const status = container.querySelector('.turn-group-status');
        expect(status!.textContent).to.equal('Thinking');
        unmount();
    });

    it('renders collapsed state after completion', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 5,
        });
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;
        unmount();
    });

    it('clicking header toggles expanded state', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 5,
        });
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;

        const header = container.querySelector('.turn-group-header') as HTMLButtonElement;
        act(() => { header.click(); });
        expect(container.querySelector('.turn-group-open')).to.not.be.null;
        expect(container.querySelector('.turn-group-closed')).to.be.null;

        act(() => { header.click(); });
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;
        unmount();
    });

    it('shows "Show steps" when collapsed, "Hide steps" when expanded', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 5,
        });
        const label = container.querySelector('.turn-group-label');
        expect(label!.textContent).to.equal('Show steps');

        const header = container.querySelector('.turn-group-header') as HTMLButtonElement;
        act(() => { header.click(); });
        expect(label!.textContent).to.equal('Hide steps');
        unmount();
    });

    it('shows duration when durationSecs > 0', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 15,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration).to.not.be.null;
        expect(duration!.textContent).to.include('15s');
        unmount();
    });

    it('formats duration with minutes for durationSecs >= 60', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 75,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration!.textContent).to.include('1m 15s');
        unmount();
    });

    it('renders children in body', () => {
        const child = React.createElement('span', { className: 'test-child' }, 'child content');
        const { container, unmount } = mountTurnGroup(
            { isStreaming: true, durationSecs: 0 },
            child,
        );
        expect(container.querySelector('.test-child')).to.not.be.null;
        expect(container.textContent).to.include('child content');
        unmount();
    });
});
