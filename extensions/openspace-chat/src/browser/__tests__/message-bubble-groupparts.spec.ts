/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for groupParts / formatElapsed (indirectly), TurnGroup behavior,
 * MessageBubble dual-level separation, and memo comparison.
 *
 * Internal functions (groupParts, formatElapsed) are not exported so they are
 * tested indirectly through rendered DOM output.
 */

import { expect } from 'chai';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { MessageBubble, TurnGroup } = _require('openspace-chat/lib/browser/message-bubble/message-bubble') as {
    MessageBubble: React.NamedExoticComponent<any> & { compare?: (prev: any, next: any) => boolean };
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

function mount(props: any): { container: HTMLElement; root: ReturnType<typeof createRoot>; unmount: () => void; rerender: (p: any) => void } {
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

function mountTurnGroup(props: any, children?: React.ReactNode): { container: HTMLElement; root: ReturnType<typeof createRoot>; unmount: () => void } {
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

// ─── groupParts (tested indirectly through MessageBubble rendering) ───────────

describe('groupParts (indirect via MessageBubble)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('1: returns empty array for empty parts — no tool or text elements rendered', () => {
        const msg = makeMessage('assistant', []);
        const { container, unmount } = mount({ message: msg, isUser: false });
        // No part-tool, no part-text, no context-group
        expect(container.querySelector('.part-tool')).to.be.null;
        expect(container.querySelector('.part-context-group')).to.be.null;
        // The message-bubble-content should exist but be empty of parts
        const content = container.querySelector('.message-bubble-content');
        expect(content).to.not.be.null;
        unmount();
    });

    it('2: returns single entries for non-context tools (e.g., text and edit)', () => {
        // text + edit = no intermediate parts separation because both are non-context,
        // but edit IS a tool so it triggers hasIntermediateParts → TurnGroup.
        // To test non-context tools rendered as singles, use isStreaming=true to expand TurnGroup.
        const msg = makeMessage('assistant', [
            makeToolPart('edit', { status: 'completed', input: { filePath: '/a.ts', oldString: 'a', newString: 'b' } }),
            makeTextPart('Done editing.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
        // edit should render as a regular .part-tool, NOT as .part-context-group
        expect(container.querySelector('.part-context-group')).to.be.null;
        expect(container.querySelector('.part-tool')).to.not.be.null;
        unmount();
    });

    it('3: groups consecutive context tools into a single context-group', () => {
        const msg = makeMessage('assistant', [
            makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            makeToolPart('grep', { status: 'completed', input: { pattern: 'TODO' } }),
            makeToolPart('glob', { status: 'completed', input: { pattern: '*.ts' } }),
            makeTextPart('Here is the answer.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
        const contextGroups = container.querySelectorAll('.part-context-group');
        expect(contextGroups.length).to.equal(1);
        // The grouped context label should mention 3 tools
        const groupName = container.querySelector('.part-context-group .part-tool-name');
        expect(groupName).to.not.be.null;
        expect(groupName!.textContent).to.include('3 tools');
        unmount();
    });

    it('4: single context tool renders as single (individual ToolBlock), not context-group', () => {
        const msg = makeMessage('assistant', [
            makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            makeTextPart('Found it.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
        // Single context tool → should be type:'single', rendered as regular .part-tool
        expect(container.querySelector('.part-context-group')).to.be.null;
        expect(container.querySelector('.part-tool')).to.not.be.null;
        unmount();
    });

    it('5: mixed parts — text, 3 reads, edit, 2 greps — produces correct grouping', () => {
        // text(0), read(1), read(2), read(3), edit(4), grep(5), grep(6), text(7)
        // The MessageBubble separates: intermediate = text(0) + read(1..3) + edit(4) + grep(5..6), final = text(7)
        // groupParts on intermediate:
        //   text(0) → single
        //   read(1), read(2), read(3) → context-group (3 tools)
        //   edit(4) → single
        //   grep(5), grep(6) → context-group (2 tools)
        const msg = makeMessage('assistant', [
            makeTextPart('Let me search.'),
            makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            makeToolPart('read', { status: 'completed', input: { filePath: '/b.ts' } }),
            makeToolPart('read', { status: 'completed', input: { filePath: '/c.ts' } }),
            makeToolPart('edit', { status: 'completed', input: { filePath: '/d.ts', oldString: 'x', newString: 'y' } }),
            makeToolPart('grep', { status: 'completed', input: { pattern: 'foo' } }),
            makeToolPart('grep', { status: 'completed', input: { pattern: 'bar' } }),
            makeTextPart('All done.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
        const contextGroups = container.querySelectorAll('.part-context-group');
        // Two separate context groups: 3 reads, then 2 greps
        expect(contextGroups.length).to.equal(2);

        // First group: 3 reads
        const firstGroupName = contextGroups[0].querySelector('.part-tool-name');
        expect(firstGroupName!.textContent).to.include('3 tools');

        // Second group: 2 greps
        const secondGroupName = contextGroups[1].querySelector('.part-tool-name');
        expect(secondGroupName!.textContent).to.include('2 tools');

        // The final text "All done." should be outside the TurnGroup
        // (the last text part is rendered separately by MessageBubble)
        const textContent = container.textContent || '';
        expect(textContent).to.include('All done.');
        unmount();
    });

    it('6: context tools interrupted by non-context tool create separate groups', () => {
        const msg = makeMessage('assistant', [
            makeToolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            makeToolPart('grep', { status: 'completed', input: { pattern: 'x' } }),
            makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
            makeToolPart('glob', { status: 'completed', input: { pattern: '*.ts' } }),
            makeToolPart('find', { status: 'completed', input: { path: '/' } }),
            makeTextPart('Result.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
        const contextGroups = container.querySelectorAll('.part-context-group');
        // First group: read + grep (2 tools), then bash breaks it,
        // second group: glob + find (2 tools)
        expect(contextGroups.length).to.equal(2);

        const firstGroupName = contextGroups[0].querySelector('.part-tool-name');
        expect(firstGroupName!.textContent).to.include('2 tools');

        const secondGroupName = contextGroups[1].querySelector('.part-tool-name');
        expect(secondGroupName!.textContent).to.include('2 tools');
        unmount();
    });
});

// ─── formatElapsed (tested indirectly through TurnGroup rendered duration) ────

describe('formatElapsed (indirect via TurnGroup)', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('7: 0 seconds — no duration element rendered (durationSecs <= 0 guard)', () => {
        // formatElapsed(0) returns "0s", but TurnGroup only renders duration when
        // durationSecs > 0. So durationSecs=0 means no .turn-group-duration element.
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 0,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration).to.be.null;
        unmount();
    });

    it('8: 45 seconds → "45s"', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 45,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration).to.not.be.null;
        expect(duration!.textContent).to.include('45s');
        unmount();
    });

    it('9: 60 seconds → "1m 0s"', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 60,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration).to.not.be.null;
        expect(duration!.textContent).to.include('1m 0s');
        unmount();
    });

    it('10: 125 seconds → "2m 5s"', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 125,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration).to.not.be.null;
        expect(duration!.textContent).to.include('2m 5s');
        unmount();
    });
});

// ─── TurnGroup component ──────────────────────────────────────────────────────

describe('TurnGroup component', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('11: streaming renders with streaming class and status text', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: true, durationSecs: 0, streamingStatus: 'Analyzing code',
        });
        expect(container.querySelector('.turn-group-streaming')).to.not.be.null;
        const status = container.querySelector('.turn-group-activity-phrase');
        expect(status).to.not.be.null;
        expect(status!.textContent!.trim().length).to.be.greaterThan(0);
        // Children should be visible in the streaming content area
        expect(container.querySelector('.turn-group-streaming-content')).to.not.be.null;
        expect(container.textContent).to.include('test content');
        unmount();
    });

    it('12: not streaming renders collapsed by default (showExpanded starts false)', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 5,
        });
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;
        expect(container.querySelector('.turn-group-open')).to.be.null;
        // Body should NOT be in the DOM when collapsed
        expect(container.querySelector('.turn-group-body')).to.be.null;
        unmount();
    });

    it('13: clicking header when collapsed toggles to expanded', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 5,
        });
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;

        const header = container.querySelector('.turn-group-header') as HTMLButtonElement;
        act(() => { header.click(); });

        expect(container.querySelector('.turn-group-open')).to.not.be.null;
        expect(container.querySelector('.turn-group-closed')).to.be.null;
        // Body should now be visible
        expect(container.querySelector('.turn-group-body')).to.not.be.null;
        expect(container.textContent).to.include('test content');

        // Click again to collapse
        act(() => { header.click(); });
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;
        expect(container.querySelector('.turn-group-body')).to.be.null;
        unmount();
    });

    it('14: shows "Show steps" label when collapsed, "Hide steps" when expanded', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 10,
        });
        const label = container.querySelector('.turn-group-label');
        expect(label).to.not.be.null;
        expect(label!.textContent).to.equal('Show steps');

        const header = container.querySelector('.turn-group-header') as HTMLButtonElement;
        act(() => { header.click(); });
        expect(label!.textContent).to.equal('Hide steps');
        unmount();
    });

    it('15: shows elapsed duration when durationSecs > 0', () => {
        const { container, unmount } = mountTurnGroup({
            isStreaming: false, durationSecs: 32,
        });
        const duration = container.querySelector('.turn-group-duration');
        expect(duration).to.not.be.null;
        expect(duration!.textContent).to.include('32s');
        unmount();
    });

    it('16: shows streaming status text (e.g., "Thinking") when streaming', () => {
        // Default status is "Thinking" when streamingStatus is not provided
        const { container, unmount } = mountTurnGroup({
            isStreaming: true, durationSecs: 0,
        });
        const status = container.querySelector('.turn-group-activity-phrase');
        expect(status).to.not.be.null;
        expect(status!.textContent!.trim().length).to.be.greaterThan(0);
        unmount();
    });
});

// ─── MessageBubble dual-level separation ──────────────────────────────────────

describe('MessageBubble dual-level separation', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('17: assistant message with only text parts — no TurnGroup, all text shown flat', () => {
        const msg = makeMessage('assistant', [
            makeTextPart('First paragraph.'),
            makeTextPart('Second paragraph.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: false });
        // No TurnGroup because there are no intermediate parts (no tool/reasoning)
        expect(container.querySelector('.turn-group')).to.be.null;
        // Both text parts should be visible
        expect(container.textContent).to.include('First paragraph.');
        expect(container.textContent).to.include('Second paragraph.');
        unmount();
    });

    it('18: assistant message with tool + text — tool goes in TurnGroup, last text outside', () => {
        const msg = makeMessage('assistant', [
            makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
            makeTextPart('Here is the result.'),
        ]);
        // isStreaming=false so TurnGroup renders collapsed
        const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: false });
        // TurnGroup should exist (wrapping the tool part)
        expect(container.querySelector('.turn-group')).to.not.be.null;
        // The final text should be outside the TurnGroup and visible
        expect(container.textContent).to.include('Here is the result.');
        // The TurnGroup should be collapsed, so the tool body is NOT visible
        expect(container.querySelector('.turn-group-closed')).to.not.be.null;
        unmount();
    });

    it('19: isIntermediateStep=true renders flat without article or inner TurnGroup', () => {
        const msg = makeMessage('assistant', [
            makeToolPart('bash', { status: 'completed', input: { command: 'ls' } }),
            makeTextPart('Intermediate result.'),
        ]);
        const { container, unmount } = mount({
            message: msg, isUser: false, isIntermediateStep: true,
        });
        // Should render .message-bubble-intermediate, NOT an <article>
        expect(container.querySelector('.message-bubble-intermediate')).to.not.be.null;
        expect(container.querySelector('article.message-bubble')).to.be.null;
        // No inner TurnGroup
        expect(container.querySelector('.turn-group')).to.be.null;
        // Tool part should be directly visible (flat rendering)
        expect(container.querySelector('.part-tool')).to.not.be.null;
        // Text should also be present
        expect(container.textContent).to.include('Intermediate result.');
        unmount();
    });

    it('20: user message — never has TurnGroup, renders all parts flat', () => {
        const msg = makeMessage('user', [
            makeTextPart('Please help me with this.'),
        ]);
        const { container, unmount } = mount({ message: msg, isUser: true });
        // No TurnGroup for user messages
        expect(container.querySelector('.turn-group')).to.be.null;
        // Text visible
        expect(container.textContent).to.include('Please help me with this.');
        unmount();
    });
});

// ─── MessageBubble memo comparison ────────────────────────────────────────────

describe('MessageBubble memo comparison', () => {
    // React.memo stores the comparison function. We extract it to test directly.
    // React.memo(component, compareFn) → the compareFn is accessible as .compare on the memo object.
    // The compare function returns true to skip re-render, false to re-render.

    // Access the compare function from the memo wrapper
    const memoCompare: ((prev: any, next: any) => boolean) | undefined =
        (MessageBubble as any).compare;

    // If compare is not directly accessible, we test through rendering behavior
    // by checking that React.memo is applied.

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('21: returns true (skip re-render) when all props are the same', () => {
        if (memoCompare) {
            const msg = makeMessage('assistant', [makeTextPart('hi')]);
            const props = {
                message: msg,
                isUser: false,
                isStreaming: false,
                isFirstInGroup: true,
                isLastInGroup: true,
            };
            expect(memoCompare(props, props)).to.be.true;
        } else {
            // Verify memo behavior through rendering: same props should not cause
            // noticeable re-render issues
            const msg = makeMessage('assistant', [makeTextPart('hi')]);
            const props = {
                message: msg,
                isUser: false,
                isStreaming: false,
                isFirstInGroup: true,
                isLastInGroup: true,
            };
            const { container, rerender, unmount } = mount(props);
            const articleBefore = container.querySelector('.message-bubble');
            rerender(props);
            const articleAfter = container.querySelector('.message-bubble');
            // Same DOM node means memo prevented re-mount
            expect(articleBefore).to.equal(articleAfter);
            unmount();
        }
    });

    it('22: returns false (re-render) when isStreaming changes', () => {
        if (memoCompare) {
            const msg = makeMessage('assistant', [makeTextPart('hi')]);
            const prev = { message: msg, isUser: false, isStreaming: false };
            const next = { message: msg, isUser: false, isStreaming: true };
            expect(memoCompare(prev, next)).to.be.false;
        } else {
            // Test that changing isStreaming causes visual update
            const msg = makeMessage('assistant', [makeTextPart('hi')]);
            const { container, rerender, unmount } = mount({
                message: msg, isUser: false, isStreaming: false,
            });
            expect(container.querySelector('.message-streaming-cursor')).to.be.null;
            rerender({ message: msg, isUser: false, isStreaming: true });
            expect(container.querySelector('.message-streaming-cursor')).to.not.be.null;
            unmount();
        }
    });

    it('23: returns false (re-render) when message reference changes', () => {
        if (memoCompare) {
            const msg1 = makeMessage('assistant', [makeTextPart('hi')]);
            const msg2 = makeMessage('assistant', [makeTextPart('hi')]);
            const prev = { message: msg1, isUser: false, isStreaming: false };
            const next = { message: msg2, isUser: false, isStreaming: false };
            expect(memoCompare(prev, next)).to.be.false;
        } else {
            // Test that a new message object causes the content to update
            const msg1 = makeMessage('assistant', [makeTextPart('original')]);
            const msg2 = makeMessage('assistant', [makeTextPart('updated')]);
            const { container, rerender, unmount } = mount({
                message: msg1, isUser: false, isStreaming: false,
            });
            expect(container.textContent).to.include('original');
            rerender({ message: msg2, isUser: false, isStreaming: false });
            expect(container.textContent).to.include('updated');
            unmount();
        }
    });
});
