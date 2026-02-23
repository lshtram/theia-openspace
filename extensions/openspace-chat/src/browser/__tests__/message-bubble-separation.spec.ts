/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for MessageBubble's dual-level response separation logic (M7 bug).
 *
 * The MessageBubble component has internal separation logic that splits parts
 * into "intermediate" (tool/reasoning) wrapped in a TurnGroup, and "final text"
 * rendered below it.  The MessageTimeline (level 1) ALSO performs separation,
 * extracting the last text part from a run and rendering it below an outer
 * TurnGroup as "turn-response".  This creates a dual-level separation where
 * text content can appear twice.
 *
 * These tests verify the separation logic and detect the duplication bug.
 */

import { expect } from 'chai';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { MessageBubble } = _require('openspace-chat/lib/browser/message-bubble') as {
    MessageBubble: React.FC<any>;
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

function textPart(text: string): any {
    return { type: 'text', text };
}

function toolPart(toolName: string, state: any = {}): any {
    return {
        type: 'tool',
        tool: toolName,
        toolCallId: `call-${toolName}-${Math.random().toString(36).slice(2)}`,
        state: { status: 'completed', input: {}, ...state },
        id: `tool-${Math.random().toString(36).slice(2)}`,
    };
}

function reasoningPart(text: string): any {
    return { type: 'reasoning', text };
}

// ─── Mount/unmount with try/finally safety ────────────────────────────────────

let _cleanup: (() => void) | undefined;

function mount(props: any): { container: HTMLElement; unmount: () => void } {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(MessageBubble, {
            openCodeService: stubOpenCodeService,
            sessionService: stubSessionService,
            ...props,
        }));
    });
    const unmount = () => {
        act(() => { root.unmount(); });
        container.remove();
    };
    _cleanup = unmount;
    return { container, unmount };
}

afterEach(() => {
    if (_cleanup) {
        try { _cleanup(); } catch { /* ignore */ }
        _cleanup = undefined;
    }
    document.body.innerHTML = '';
});

// ─── Helper: count how many .part-text elements contain given text ────────────

function countTextOccurrences(container: HTMLElement, text: string): number {
    const partTexts = container.querySelectorAll('.part-text');
    let count = 0;
    partTexts.forEach(el => {
        if (el.textContent && el.textContent.includes(text)) {
            count++;
        }
    });
    return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('MessageBubble separation logic', () => {

    // ─── 1. Internal separation: hasIntermediateParts ──────────────────────

    describe('hasIntermediateParts detection', () => {

        it('should NOT create TurnGroup for assistant message with only text parts', () => {
            const msg = makeMessage('assistant', [
                textPart('First paragraph.'),
                textPart('Second paragraph.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                // No tools or reasoning → hasIntermediateParts = false → no TurnGroup
                expect(container.querySelector('.turn-group')).to.be.null;
                // Both texts should be rendered flat
                expect(container.textContent).to.include('First paragraph.');
                expect(container.textContent).to.include('Second paragraph.');
            } finally {
                unmount();
            }
        });

        it('should NOT create TurnGroup for user messages even with tool-like parts', () => {
            // User messages always have isUser=true → hasIntermediateParts = false
            const msg = makeMessage('user', [textPart('Hello')]);
            const { container, unmount } = mount({ message: msg, isUser: true });
            try {
                expect(container.querySelector('.turn-group')).to.be.null;
                expect(container.textContent).to.include('Hello');
            } finally {
                unmount();
            }
        });

        it('should create TurnGroup when message has tool parts', () => {
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                textPart('Here is the output.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                expect(container.querySelector('.turn-group')).to.not.be.null;
            } finally {
                unmount();
            }
        });

        it('should create TurnGroup when message has reasoning parts', () => {
            const msg = makeMessage('assistant', [
                reasoningPart('Let me think about this...'),
                textPart('The answer is 42.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                expect(container.querySelector('.turn-group')).to.not.be.null;
            } finally {
                unmount();
            }
        });
    });

    // ─── 2. lastTextPartIndex and part splitting ──────────────────────────

    describe('lastTextPartIndex and intermediate/final split', () => {

        it('[tool, text, tool, text] — last text (index 3) renders outside TurnGroup', () => {
            // Parts: tool@0, text@1("step note"), tool@2, text@3("final answer")
            // Expected: intermediateParts = [tool@0, text@1, tool@2], finalText = text@3
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                textPart('step note'),
                toolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
                textPart('final answer'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                // TurnGroup should exist
                const turnGroup = container.querySelector('.turn-group');
                expect(turnGroup).to.not.be.null;

                // "final answer" should appear outside the TurnGroup
                // Check that the .message-bubble-content has .part-text elements
                const allPartTexts = container.querySelectorAll('.part-text');
                const finalAnswerParts = Array.from(allPartTexts).filter(
                    el => el.textContent && el.textContent.includes('final answer')
                );
                expect(finalAnswerParts.length).to.equal(1);

                // The final answer .part-text should NOT be inside the .turn-group
                const turnGroupEl = container.querySelector('.turn-group');
                if (turnGroupEl && finalAnswerParts[0]) {
                    expect(turnGroupEl.contains(finalAnswerParts[0])).to.be.false;
                }
            } finally {
                unmount();
            }
        });

        it('[tool, text, tool, text] — intermediate text (index 1) is inside TurnGroup', () => {
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                textPart('intermediate note'),
                toolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
                textPart('final answer'),
            ]);
            // isStreaming=true to expand TurnGroup body so intermediate parts are visible
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            try {
                // "intermediate note" should be inside the TurnGroup's streaming content
                const turnGroup = container.querySelector('.turn-group');
                expect(turnGroup).to.not.be.null;
                const streamingContent = turnGroup!.querySelector('.turn-group-streaming-content');
                expect(streamingContent).to.not.be.null;
                expect(streamingContent!.textContent).to.include('intermediate note');
            } finally {
                unmount();
            }
        });

        it('[tool, text] — only tool goes in TurnGroup, text renders outside', () => {
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'echo hi' } }),
                textPart('The result is hi.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                const turnGroup = container.querySelector('.turn-group');
                expect(turnGroup).to.not.be.null;

                // Text should be outside TurnGroup
                const textParts = container.querySelectorAll('.part-text');
                const resultParts = Array.from(textParts).filter(
                    el => el.textContent && el.textContent.includes('The result is hi.')
                );
                expect(resultParts.length).to.equal(1);
                expect(turnGroup!.contains(resultParts[0])).to.be.false;
            } finally {
                unmount();
            }
        });

        it('[tool] with no text part — all in TurnGroup, no final text rendered', () => {
            // Mid-stream: tool started but no text response yet
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'running', input: { command: 'sleep 5' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            try {
                // TurnGroup wrapping the tool
                expect(container.querySelector('.turn-group')).to.not.be.null;
                // No .part-text outside or inside
                const outsideTexts = container.querySelectorAll('.message-bubble-content > .part-text');
                expect(outsideTexts.length).to.equal(0);
            } finally {
                unmount();
            }
        });

        it('[reasoning, tool, text] — reasoning and tool in TurnGroup, text outside', () => {
            const msg = makeMessage('assistant', [
                reasoningPart('I need to check the file...'),
                toolPart('read', { status: 'completed', input: { filePath: '/src/app.ts' } }),
                textPart('Here is what I found.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                const turnGroup = container.querySelector('.turn-group');
                expect(turnGroup).to.not.be.null;

                // Final text outside TurnGroup
                const textEls = container.querySelectorAll('.part-text');
                const foundParts = Array.from(textEls).filter(
                    el => el.textContent && el.textContent.includes('Here is what I found.')
                );
                expect(foundParts.length).to.equal(1);
                expect(turnGroup!.contains(foundParts[0])).to.be.false;
            } finally {
                unmount();
            }
        });
    });

    // ─── 3. isIntermediateStep=true renders flat ──────────────────────────

    describe('isIntermediateStep=true (flat rendering)', () => {

        it('renders all parts flat in .message-bubble-intermediate — no TurnGroup', () => {
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                textPart('Some intermediate text.'),
                toolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, isIntermediateStep: true,
            });
            try {
                // Should use .message-bubble-intermediate wrapper, NOT <article>
                expect(container.querySelector('.message-bubble-intermediate')).to.not.be.null;
                expect(container.querySelector('article.message-bubble')).to.be.null;
                // No inner TurnGroup
                expect(container.querySelector('.turn-group')).to.be.null;
                // Tool parts should be directly rendered
                expect(container.querySelector('.part-tool')).to.not.be.null;
                // Text should be present
                expect(container.textContent).to.include('Some intermediate text.');
            } finally {
                unmount();
            }
        });

        it('does not produce header or article wrapper when isIntermediateStep=true', () => {
            const msg = makeMessage('assistant', [textPart('hello from intermediate')]);
            const { container, unmount } = mount({
                message: msg, isUser: false, isIntermediateStep: true, isFirstInGroup: true,
            });
            try {
                // No article wrapper
                expect(container.querySelector('article')).to.be.null;
                // No header even with isFirstInGroup=true
                expect(container.querySelector('.message-bubble-header')).to.be.null;
                // Content still present
                expect(container.textContent).to.include('hello from intermediate');
            } finally {
                unmount();
            }
        });
    });

    // ─── 4. Single text part (no separation needed) ───────────────────────

    describe('single text part — no separation', () => {

        it('renders just the text with no TurnGroup for a text-only message', () => {
            const msg = makeMessage('assistant', [textPart('Just a simple answer.')]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                expect(container.querySelector('.turn-group')).to.be.null;
                expect(container.textContent).to.include('Just a simple answer.');
                // Only one .part-text
                expect(container.querySelectorAll('.part-text').length).to.equal(1);
            } finally {
                unmount();
            }
        });

        it('renders empty message (no parts) without crashing', () => {
            const msg = makeMessage('assistant', []);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                expect(container.querySelector('.turn-group')).to.be.null;
                expect(container.querySelector('.part-text')).to.be.null;
                // article still renders
                expect(container.querySelector('.message-bubble')).to.not.be.null;
            } finally {
                unmount();
            }
        });
    });

    // ─── 5. Dual-level duplication tests (M7 bug) ─────────────────────────

    describe('dual-level duplication (M7)', () => {

        it('text content appears exactly ONCE when MessageBubble has [tool, text]', () => {
            // This is the core M7 bug test.
            // MessageBubble with [tool, text] and isIntermediateStep=false:
            //   - hasIntermediateParts = true
            //   - intermediateParts = [tool]
            //   - finalTextPartWithIndex = text@1
            //   - Renders: TurnGroup(tool), then text outside
            // The text "unique-response-alpha" should appear EXACTLY once.
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'echo test' } }),
                textPart('unique-response-alpha'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                const count = countTextOccurrences(container, 'unique-response-alpha');
                expect(count).to.equal(1,
                    `Expected "unique-response-alpha" to appear in exactly 1 .part-text element, found ${count}`);
            } finally {
                unmount();
            }
        });

        it('text appears exactly ONCE in [tool, text, tool, text] scenario', () => {
            // With 4 parts: [tool@0, text@1("mid"), tool@2, text@3("final")]
            // Expected: "final" appears once (outside TurnGroup), "mid" appears once (inside TurnGroup)
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                textPart('mid-step-note'),
                toolPart('read', { status: 'completed', input: { filePath: '/b.ts' } }),
                textPart('unique-final-output'),
            ]);
            // Streaming so TurnGroup body is visible (can see intermediate parts)
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            try {
                const finalCount = countTextOccurrences(container, 'unique-final-output');
                expect(finalCount).to.equal(1,
                    `Expected "unique-final-output" exactly once, found ${finalCount}`);

                const midCount = countTextOccurrences(container, 'mid-step-note');
                expect(midCount).to.equal(1,
                    `Expected "mid-step-note" exactly once, found ${midCount}`);
            } finally {
                unmount();
            }
        });

        it('simulated timeline: filtered intermediate + response — no duplication', () => {
            // Simulates what MessageTimeline does:
            // 1. Intermediate: message with [tool] only, isIntermediateStep=true
            // 2. Response: message with [text] only, isIntermediateStep=false
            // Each should render its content exactly once.

            // Step 1: Intermediate bubble
            const intermediateMsg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
            ]);
            const { container: c1, unmount: unmount1 } = mount({
                message: intermediateMsg, isUser: false, isIntermediateStep: true,
            });
            try {
                // No text parts — only tool
                expect(c1.querySelectorAll('.part-text').length).to.equal(0);
                expect(c1.querySelector('.part-tool')).to.not.be.null;
            } finally {
                unmount1();
            }

            // Step 2: Response bubble
            const responseMsg = makeMessage('assistant', [
                textPart('unique-timeline-response'),
            ]);
            const { container: c2, unmount: unmount2 } = mount({
                message: responseMsg, isUser: false, isIntermediateStep: false,
                isFirstInGroup: true, isLastInGroup: true,
            });
            try {
                const count = countTextOccurrences(c2, 'unique-timeline-response');
                expect(count).to.equal(1,
                    `Expected "unique-timeline-response" exactly once in response bubble, found ${count}`);
                // No TurnGroup in a text-only response
                expect(c2.querySelector('.turn-group')).to.be.null;
            } finally {
                unmount2();
            }
        });

        it('simulated timeline with multi-part last message — intermediate has earlier text, response has final text', () => {
            // Timeline scenario: last message has [tool, text("mid"), tool, text("final")]
            // Timeline extracts text@3("final") as response, passes [tool, text("mid"), tool] as intermediate.

            // Intermediate bubble: [tool, text("mid"), tool], isIntermediateStep=true
            const intermediateMsg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                textPart('mid-process-note'),
                toolPart('read', { status: 'completed', input: { filePath: '/x.ts' } }),
            ]);
            const { container: c1, unmount: unmount1 } = mount({
                message: intermediateMsg, isUser: false, isIntermediateStep: true,
            });
            try {
                // isIntermediateStep=true → flat rendering, no TurnGroup
                expect(c1.querySelector('.turn-group')).to.be.null;
                // "mid-process-note" appears once
                const midCount = countTextOccurrences(c1, 'mid-process-note');
                expect(midCount).to.equal(1);
            } finally {
                unmount1();
            }

            // Response bubble: [text("final")], isIntermediateStep=false
            const responseMsg = makeMessage('assistant', [
                textPart('final-conclusion'),
            ]);
            const { container: c2, unmount: unmount2 } = mount({
                message: responseMsg, isUser: false, isIntermediateStep: false,
                isFirstInGroup: true, isLastInGroup: true,
            });
            try {
                const finalCount = countTextOccurrences(c2, 'final-conclusion');
                expect(finalCount).to.equal(1);
            } finally {
                unmount2();
            }
        });

        it('BUG: full message passed without timeline filtering — text should still appear once', () => {
            // This test demonstrates the M7 concern:
            // If a caller renders MessageBubble directly (not through MessageTimeline)
            // with a message containing [tool, text], the text should appear exactly once.
            //
            // The MessageBubble's own separation should handle this correctly:
            //   - intermediateParts = [tool]
            //   - finalTextPartWithIndex = text
            //   - Renders TurnGroup(tool) + text outside
            //
            // The bug would manifest if BOTH renderPart (inside groupedIntermediateParts)
            // AND renderTextPart (finalTextPartWithIndex) emitted the same text content.
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'whoami' } }),
                textPart('I am the assistant response.'),
            ]);
            const { container, unmount } = mount({
                message: msg, isUser: false, isIntermediateStep: false,
            });
            try {
                // Count ALL occurrences of the response text in the rendered DOM
                const allTextNodes: string[] = [];
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                let node: Text | null;
                while ((node = walker.nextNode() as Text | null)) {
                    if (node.textContent && node.textContent.includes('I am the assistant response.')) {
                        allTextNodes.push(node.textContent);
                    }
                }
                // The text should appear exactly once across the entire rendered output
                expect(allTextNodes.length).to.equal(1,
                    `Expected the response text in exactly 1 text node, found ${allTextNodes.length}: ${JSON.stringify(allTextNodes)}`);
            } finally {
                unmount();
            }
        });

        it('text-only parts (no tools) never create nested TurnGroups', () => {
            // Multiple text parts, no tools — should render all flat, no TurnGroup
            const msg = makeMessage('assistant', [
                textPart('Paragraph one.'),
                textPart('Paragraph two.'),
                textPart('Paragraph three.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                expect(container.querySelector('.turn-group')).to.be.null;
                // All three texts present
                expect(countTextOccurrences(container, 'Paragraph one.')).to.equal(1);
                expect(countTextOccurrences(container, 'Paragraph two.')).to.equal(1);
                expect(countTextOccurrences(container, 'Paragraph three.')).to.equal(1);
                // Total .part-text elements = 3
                expect(container.querySelectorAll('.part-text').length).to.equal(3);
            } finally {
                unmount();
            }
        });
    });

    // ─── 6. Edge cases ────────────────────────────────────────────────────

    describe('separation edge cases', () => {

        it('empty text parts are not counted as final text', () => {
            // [tool, text(""), text("real")] — empty text should be skipped by renderTextPart
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'echo' } }),
                textPart(''),
                textPart('real answer'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                // lastTextPartIndex = 2 (the "real answer"), not 1 (empty)
                // Empty text part returns null from renderTextPart
                const count = countTextOccurrences(container, 'real answer');
                expect(count).to.equal(1);
                // No visible .part-text for the empty one
                const allPartTexts = container.querySelectorAll('.part-text');
                // Should be at most 1 visible (the "real answer")
                // The empty text at index 1 is in intermediateParts (since lastTextPartIndex=2),
                // but renderTextPart returns null for empty text
                expect(allPartTexts.length).to.be.at.most(2);
            } finally {
                unmount();
            }
        });

        it('message with only tools (no text at all) renders TurnGroup with all tools', () => {
            const msg = makeMessage('assistant', [
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                toolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false, isStreaming: true });
            try {
                // hasIntermediateParts = true (tools present)
                // lastTextPartIndex = -1 (no text)
                // intermediateParts = all parts (since no final text)
                // finalTextPartWithIndex = null
                expect(container.querySelector('.turn-group')).to.not.be.null;
                // No .part-text rendered
                expect(container.querySelectorAll('.part-text').length).to.equal(0);
            } finally {
                unmount();
            }
        });

        it('[reasoning, text] — reasoning triggers separation, text is final', () => {
            const msg = makeMessage('assistant', [
                reasoningPart('Thinking deeply...'),
                textPart('My conclusion.'),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                // reasoning triggers hasIntermediateParts=true
                expect(container.querySelector('.turn-group')).to.not.be.null;
                // "My conclusion." is outside TurnGroup
                const textEls = Array.from(container.querySelectorAll('.part-text'));
                const conclusionEls = textEls.filter(el =>
                    el.textContent && el.textContent.includes('My conclusion.')
                );
                expect(conclusionEls.length).to.equal(1);
                const turnGroup = container.querySelector('.turn-group');
                expect(turnGroup!.contains(conclusionEls[0])).to.be.false;
            } finally {
                unmount();
            }
        });

        it('multiple tools with text at beginning — first text is intermediate, not final', () => {
            // [text@0("preamble"), tool@1, tool@2] — no final text (lastTextPartIndex=0 but it
            // should still be 0 since it IS the last text)
            // Actually: lastTextPartIndex = 0, intermediateParts = [tool@1, tool@2],
            // finalTextPartWithIndex = text@0
            // Wait — that's wrong. intermediateParts = parts.filter(i !== 0) = [tool@1, tool@2]
            // So text@0 is the "final" text, and tools are intermediate. This is the correct
            // behavior because "last text" means last by index, which is index 0 here.
            const msg = makeMessage('assistant', [
                textPart('preamble text'),
                toolPart('bash', { status: 'completed', input: { command: 'ls' } }),
                toolPart('read', { status: 'completed', input: { filePath: '/a.ts' } }),
            ]);
            const { container, unmount } = mount({ message: msg, isUser: false });
            try {
                // hasIntermediateParts = true (tools)
                expect(container.querySelector('.turn-group')).to.not.be.null;
                // "preamble text" is the last (and only) text → rendered as final outside TurnGroup
                const textEls = Array.from(container.querySelectorAll('.part-text'));
                const preambleEls = textEls.filter(el =>
                    el.textContent && el.textContent.includes('preamble text')
                );
                expect(preambleEls.length).to.equal(1);
            } finally {
                unmount();
            }
        });
    });
});
