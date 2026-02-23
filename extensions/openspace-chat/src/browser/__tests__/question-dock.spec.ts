/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for QuestionDock component (question-dock.tsx).
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
const { QuestionDock } = _require('openspace-chat/lib/browser/question-dock') as {
    QuestionDock: React.FC<any>
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<any> = {}): any {
    return {
        id: 'q-1',
        questions: [
            {
                question: 'Pick a color',
                header: 'Color',
                options: [
                    { label: 'Red', description: 'Warm color' },
                    { label: 'Blue', description: 'Cool color' },
                ],
                multiple: false,
                custom: undefined,
            },
        ],
        ...overrides,
    };
}

function makeMultiQuestion(): any {
    return {
        id: 'mq-1',
        questions: [
            {
                question: 'Pick a color',
                header: 'Color',
                options: [
                    { label: 'Red' },
                    { label: 'Blue' },
                    { label: 'Green' },
                ],
                multiple: false,
            },
            {
                question: 'Pick sizes',
                header: 'Size',
                options: [
                    { label: 'S' },
                    { label: 'M' },
                    { label: 'L' },
                ],
                multiple: true,
            },
        ],
    };
}

function mount(question: any, onAnswer = sinon.stub(), onReject = sinon.stub()) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
        root.render(React.createElement(QuestionDock, { question, onAnswer, onReject }));
    });
    return {
        container,
        root,
        onAnswer,
        onReject,
        unmount: () => { act(() => root.unmount()); container.remove(); },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuestionDock', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    // ─── Guard clause ─────────────────────────────────────────────────────────

    describe('Guard clause', () => {
        it('renders nothing when questions array is empty', () => {
            const { container, unmount } = mount({ id: 'q-empty', questions: [] });
            expect(container.querySelector('.qdock')).to.be.null;
            unmount();
        });
    });

    // ─── Single question flow ─────────────────────────────────────────────────

    describe('Single question flow', () => {
        it('renders question text', () => {
            const { container, unmount } = mount(makeQuestion());
            const text = container.querySelector('.qdock-question-text');
            expect(text).to.not.be.null;
            expect(text!.textContent).to.equal('Pick a color');
            unmount();
        });

        it('renders option buttons', () => {
            const { container, unmount } = mount(makeQuestion());
            const btns = container.querySelectorAll('.qdock-option-btn');
            expect(btns.length).to.equal(2);
            unmount();
        });

        it('shows option labels', () => {
            const { container, unmount } = mount(makeQuestion());
            const labels = container.querySelectorAll('.qdock-option-label');
            expect(labels[0].textContent).to.equal('Red');
            expect(labels[1].textContent).to.equal('Blue');
            unmount();
        });

        it('shows option descriptions', () => {
            const { container, unmount } = mount(makeQuestion());
            const descs = container.querySelectorAll('.qdock-option-desc');
            expect(descs.length).to.equal(2);
            expect(descs[0].textContent).to.equal('Warm color');
            expect(descs[1].textContent).to.equal('Cool color');
            unmount();
        });

        it('calls onAnswer with selected label when option clicked', () => {
            const onAnswer = sinon.stub();
            const { container, unmount } = mount(makeQuestion(), onAnswer);
            const btns = container.querySelectorAll('.qdock-option-btn');
            act(() => { (btns[0] as HTMLButtonElement).click(); });
            expect(onAnswer.calledOnce).to.be.true;
            expect(onAnswer.firstCall.args[0]).to.equal('q-1');
            expect(onAnswer.firstCall.args[1]).to.deep.equal([['Red']]);
            unmount();
        });

        it('calls onReject when Dismiss is clicked', () => {
            const onReject = sinon.stub();
            const { container, unmount } = mount(makeQuestion(), sinon.stub(), onReject);
            const dismiss = container.querySelector('.qdock-dismiss') as HTMLButtonElement;
            act(() => { dismiss.click(); });
            expect(onReject.calledOnce).to.be.true;
            expect(onReject.firstCall.args[0]).to.equal('q-1');
            unmount();
        });

        it('shows "Type your own answer" toggle', () => {
            const { container, unmount } = mount(makeQuestion());
            const toggle = container.querySelector('.qdock-custom-toggle');
            expect(toggle).to.not.be.null;
            expect(toggle!.textContent).to.include('Type your own answer');
            unmount();
        });

        it('shows custom input when toggle is clicked', () => {
            const { container, unmount } = mount(makeQuestion());
            expect(container.querySelector('.qdock-custom-input')).to.be.null;
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });
            expect(container.querySelector('.qdock-custom-input')).to.not.be.null;
            unmount();
        });

        it('submit button is disabled when custom input is empty', () => {
            const { container, unmount } = mount(makeQuestion());
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });
            const submitBtn = container.querySelector('.qdock-btn-accent') as HTMLButtonElement;
            expect(submitBtn.disabled).to.be.true;
            unmount();
        });

        it('submits custom value via onAnswer', () => {
            const onAnswer = sinon.stub();
            const { container, unmount } = mount(makeQuestion(), onAnswer);
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });

            const input = container.querySelector('.qdock-custom-input') as HTMLInputElement;
            act(() => {
                // Simulate typing
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                nativeInputValueSetter.call(input, 'Purple');
                input.dispatchEvent(new window.Event('input', { bubbles: true }));
            });

            // After typing, submit button should be enabled — click it
            const submitBtn = container.querySelector('.qdock-btn-accent') as HTMLButtonElement;
            act(() => { submitBtn.click(); });

            expect(onAnswer.calledOnce).to.be.true;
            expect(onAnswer.firstCall.args[1]).to.deep.equal([['Purple']]);
            unmount();
        });

        it('pressing Escape in custom input hides it', () => {
            const { container, unmount } = mount(makeQuestion());
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });
            expect(container.querySelector('.qdock-custom-input')).to.not.be.null;

            const input = container.querySelector('.qdock-custom-input') as HTMLInputElement;
            act(() => {
                input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            });
            expect(container.querySelector('.qdock-custom-input')).to.be.null;
            unmount();
        });

        it('Cancel button hides custom input', () => {
            const { container, unmount } = mount(makeQuestion());
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });
            expect(container.querySelector('.qdock-custom-input')).to.not.be.null;

            const cancelBtn = container.querySelector('.qdock-btn-ghost') as HTMLButtonElement;
            act(() => { cancelBtn.click(); });
            expect(container.querySelector('.qdock-custom-input')).to.be.null;
            unmount();
        });

        it('hides custom toggle when custom === false', () => {
            const q = makeQuestion();
            q.questions[0].custom = false;
            const { container, unmount } = mount(q);
            expect(container.querySelector('.qdock-custom-toggle')).to.be.null;
            unmount();
        });

        it('pressing Enter in custom input submits the value', () => {
            const onAnswer = sinon.stub();
            const { container, unmount } = mount(makeQuestion(), onAnswer);
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });

            const input = container.querySelector('.qdock-custom-input') as HTMLInputElement;
            act(() => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                nativeInputValueSetter.call(input, 'Orange');
                input.dispatchEvent(new window.Event('input', { bubbles: true }));
            });
            act(() => {
                input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            });

            expect(onAnswer.calledOnce).to.be.true;
            expect(onAnswer.firstCall.args[1]).to.deep.equal([['Orange']]);
            unmount();
        });

        it('does not submit when custom input is whitespace-only', () => {
            const onAnswer = sinon.stub();
            const { container, unmount } = mount(makeQuestion(), onAnswer);
            act(() => { (container.querySelector('.qdock-custom-toggle') as HTMLButtonElement).click(); });

            const input = container.querySelector('.qdock-custom-input') as HTMLInputElement;
            act(() => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                nativeInputValueSetter.call(input, '   ');
                input.dispatchEvent(new window.Event('input', { bubbles: true }));
            });
            act(() => {
                input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            });

            expect(onAnswer.called).to.be.false;
            unmount();
        });
    });

    // ─── Multi-question flow ──────────────────────────────────────────────────

    describe('Multi-question flow', () => {
        it('renders tab bar with question tabs + Confirm tab', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            // 2 question tabs + 1 confirm tab = 3
            expect(tabs.length).to.equal(3);
            expect(tabs[0].textContent).to.equal('Color');
            expect(tabs[1].textContent).to.equal('Size');
            expect(tabs[2].textContent).to.equal('Confirm');
            unmount();
        });

        it('first tab is active by default', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            expect(tabs[0].classList.contains('active')).to.be.true;
            expect(tabs[1].classList.contains('active')).to.be.false;
            unmount();
        });

        it('clicking a tab switches active tab', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            act(() => { (tabs[1] as HTMLButtonElement).click(); });
            expect(tabs[1].classList.contains('active')).to.be.true;
            expect(tabs[0].classList.contains('active')).to.be.false;
            unmount();
        });

        it('shows question options for the active tab', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const labels = container.querySelectorAll('.qdock-option-label');
            const labelTexts = Array.from(labels).map(l => l.textContent);
            expect(labelTexts).to.include('Red');
            expect(labelTexts).to.include('Blue');
            expect(labelTexts).to.include('Green');
            unmount();
        });

        it('single-select option auto-advances after 150ms', () => {
            const clock = sinon.useFakeTimers();
            try {
                const { container, unmount } = mount(makeMultiQuestion());
                const tabs = container.querySelectorAll('.qdock-tab');
                // Start on tab 0 (Color, single-select)
                expect(tabs[0].classList.contains('active')).to.be.true;

                // Click an option
                const optionBtns = container.querySelectorAll('.qdock-option-btn');
                act(() => { (optionBtns[0] as HTMLButtonElement).click(); });

                // Before 150ms, still on tab 0
                act(() => { clock.tick(100); });
                // Tab index tracking is internal — check that after 150ms it moves
                act(() => { clock.tick(60); });

                // After 150ms, should have advanced to tab 1
                const updatedTabs = container.querySelectorAll('.qdock-tab');
                expect(updatedTabs[1].classList.contains('active')).to.be.true;
                unmount();
            } finally {
                clock.restore();
            }
        });

        it('multiple-select options toggle selection', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            // Go to tab 1 (Size, multiple-select)
            act(() => { (tabs[1] as HTMLButtonElement).click(); });

            const optionBtns = container.querySelectorAll('.qdock-option-btn');
            // Click S
            act(() => { (optionBtns[0] as HTMLButtonElement).click(); });
            expect(optionBtns[0].classList.contains('selected')).to.be.true;

            // Click M
            act(() => { (optionBtns[1] as HTMLButtonElement).click(); });
            expect(optionBtns[1].classList.contains('selected')).to.be.true;

            // Toggle S off
            act(() => { (optionBtns[0] as HTMLButtonElement).click(); });
            expect(optionBtns[0].classList.contains('selected')).to.be.false;
            unmount();
        });

        it('shows checkbox characters for multiple-select options', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            act(() => { (tabs[1] as HTMLButtonElement).click(); });

            const checkboxes = container.querySelectorAll('.qdock-checkbox');
            expect(checkboxes.length).to.be.greaterThan(0);
            // All unchecked initially (☐ = \u2610)
            expect(checkboxes[0].textContent).to.equal('\u2610');
            unmount();
        });

        it('shows Next button for multiple-select questions', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            act(() => { (tabs[1] as HTMLButtonElement).click(); });

            const accentBtns = container.querySelectorAll('.qdock-btn-accent');
            const nextBtn = Array.from(accentBtns).find(b => b.textContent === 'Review' || b.textContent === 'Next');
            expect(nextBtn).to.not.be.undefined;
            unmount();
        });

        it('Next button is disabled when no options selected', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            act(() => { (tabs[1] as HTMLButtonElement).click(); });

            const accentBtns = container.querySelectorAll('.qdock-btn-accent');
            const nextBtn = Array.from(accentBtns).find(b =>
                b.textContent === 'Review' || b.textContent === 'Next'
            ) as HTMLButtonElement;
            expect(nextBtn.disabled).to.be.true;
            unmount();
        });

        it('shows "Review" on last question tab instead of "Next"', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            // Tab 1 is the last question (before Confirm), and it's multiple-select
            act(() => { (tabs[1] as HTMLButtonElement).click(); });

            const accentBtns = container.querySelectorAll('.qdock-btn-accent');
            const reviewBtn = Array.from(accentBtns).find(b => b.textContent === 'Review');
            expect(reviewBtn).to.not.be.undefined;
            unmount();
        });

        it('Confirm tab shows "Review & Submit" header', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            const tabs = container.querySelectorAll('.qdock-tab');
            // Navigate to Confirm tab
            act(() => { (tabs[2] as HTMLButtonElement).click(); });

            const headerText = container.querySelector('.qdock-question-text');
            expect(headerText?.textContent).to.equal('Review & Submit');
            unmount();
        });

        it('Confirm tab shows answers grouped by question header', () => {
            const clock = sinon.useFakeTimers();
            try {
                const { container, unmount } = mount(makeMultiQuestion());
                // Answer first question (single-select — auto-advances)
                const optionBtns = container.querySelectorAll('.qdock-option-btn');
                act(() => { (optionBtns[0] as HTMLButtonElement).click(); });
                act(() => { clock.tick(200); }); // past auto-advance

                // Navigate to Confirm tab
                const tabs = container.querySelectorAll('.qdock-tab');
                act(() => { (tabs[2] as HTMLButtonElement).click(); });

                const confirmItems = container.querySelectorAll('.qdock-confirm-item');
                expect(confirmItems.length).to.equal(2); // 2 questions

                const headers = container.querySelectorAll('.qdock-confirm-header');
                expect(headers[0].textContent).to.include('Color');
                expect(headers[1].textContent).to.include('Size');

                const answers = container.querySelectorAll('.qdock-confirm-answer');
                expect(answers[0].textContent).to.include('Red');
                unmount();
            } finally {
                clock.restore();
            }
        });

        it('Confirm tab Submit calls onAnswer with collected answers', () => {
            const clock = sinon.useFakeTimers();
            try {
                const onAnswer = sinon.stub();
                const { container, unmount } = mount(makeMultiQuestion(), onAnswer);
                // Answer first question
                const optionBtns = container.querySelectorAll('.qdock-option-btn');
                act(() => { (optionBtns[0] as HTMLButtonElement).click(); });
                act(() => { clock.tick(200); });

                // Navigate to Confirm tab and submit
                const tabs = container.querySelectorAll('.qdock-tab');
                act(() => { (tabs[2] as HTMLButtonElement).click(); });

                const submitBtn = container.querySelector('.qdock-confirm .qdock-btn-accent') as HTMLButtonElement;
                act(() => { submitBtn.click(); });

                expect(onAnswer.calledOnce).to.be.true;
                expect(onAnswer.firstCall.args[0]).to.equal('mq-1');
                // answers is array of arrays: [['Red'], []] (first answered, second empty)
                expect(onAnswer.firstCall.args[1][0]).to.deep.equal(['Red']);
                unmount();
            } finally {
                clock.restore();
            }
        });

        it('Dismiss button calls onReject in multi-flow', () => {
            const onReject = sinon.stub();
            const { container, unmount } = mount(makeMultiQuestion(), sinon.stub(), onReject);
            const dismiss = container.querySelector('.qdock-dismiss') as HTMLButtonElement;
            act(() => { dismiss.click(); });
            expect(onReject.calledOnce).to.be.true;
            expect(onReject.firstCall.args[0]).to.equal('mq-1');
            unmount();
        });

        it('answered tabs get .answered class', () => {
            const clock = sinon.useFakeTimers();
            try {
                const { container, unmount } = mount(makeMultiQuestion());
                const tabs = container.querySelectorAll('.qdock-tab');
                expect(tabs[0].classList.contains('answered')).to.be.false;

                // Answer first question
                const optionBtns = container.querySelectorAll('.qdock-option-btn');
                act(() => { (optionBtns[0] as HTMLButtonElement).click(); });
                act(() => { clock.tick(200); }); // past auto-advance

                const updatedTabs = container.querySelectorAll('.qdock-tab');
                expect(updatedTabs[0].classList.contains('answered')).to.be.true;
                unmount();
            } finally {
                clock.restore();
            }
        });

        it('routes to multi-flow when single question has multiple=true', () => {
            const q = {
                id: 'q-multi-single',
                questions: [{
                    question: 'Pick colors',
                    header: 'Colors',
                    options: [{ label: 'Red' }, { label: 'Blue' }],
                    multiple: true,
                }],
            };
            const { container, unmount } = mount(q);
            // Multi-flow has tab bar
            const tabs = container.querySelectorAll('.qdock-tab');
            expect(tabs.length).to.be.greaterThan(0);
            unmount();
        });

        // BUG H2: Confirm tab Submit should be disabled when all answers are empty.
        // The source code on line 419-425 has NO disabled prop on the Submit button,
        // so this test documents the bug and is expected to FAIL.
        it('Confirm tab Submit button should be disabled when all answers are empty', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            // Navigate directly to Confirm tab without answering anything
            const tabs = container.querySelectorAll('.qdock-tab');
            act(() => { (tabs[2] as HTMLButtonElement).click(); });

            const submitBtn = container.querySelector('.qdock-confirm .qdock-btn-accent') as HTMLButtonElement;
            // BUG: This assertion will FAIL because the Submit button has no `disabled` guard.
            // Compare with SingleQuestionDock which has disabled={!customValue.trim()} (line 147).
            expect(submitBtn.disabled).to.be.true;
            unmount();
        });

        it('custom answer in multi-flow adds to selected answers', () => {
            const clock = sinon.useFakeTimers();
            try {
                const onAnswer = sinon.stub();
                const { container, unmount } = mount(makeMultiQuestion(), onAnswer);
                // Go to tab 1 (Size, multiple-select)
                const tabs = container.querySelectorAll('.qdock-tab');
                act(() => { (tabs[1] as HTMLButtonElement).click(); });

                // Open custom input
                const customToggle = container.querySelector('.qdock-custom-toggle') as HTMLButtonElement;
                act(() => { customToggle.click(); });

                // Type a custom answer
                const input = container.querySelector('.qdock-custom-input') as HTMLInputElement;
                act(() => {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                    nativeInputValueSetter.call(input, 'XL');
                    input.dispatchEvent(new window.Event('input', { bubbles: true }));
                });

                // Click Add button
                const addBtn = Array.from(container.querySelectorAll('.qdock-btn-accent')).find(
                    b => b.textContent === 'Add'
                ) as HTMLButtonElement;
                act(() => { addBtn.click(); });

                // Custom input should be hidden after adding
                expect(container.querySelector('.qdock-custom-input')).to.be.null;

                // Navigate to Confirm tab and check the custom answer is included
                const updatedTabs = container.querySelectorAll('.qdock-tab');
                act(() => { (updatedTabs[2] as HTMLButtonElement).click(); });

                const confirmAnswers = container.querySelectorAll('.qdock-confirm-answer');
                expect(confirmAnswers[1].textContent).to.include('XL');
                unmount();
            } finally {
                clock.restore();
            }
        });

        it('tab navigation allows going back to a previous question after auto-advance', () => {
            const clock = sinon.useFakeTimers();
            try {
                const { container, unmount } = mount(makeMultiQuestion());

                // Answer first question (single-select — auto-advances to tab 1)
                const optionBtns = container.querySelectorAll('.qdock-option-btn');
                act(() => { (optionBtns[0] as HTMLButtonElement).click(); });
                act(() => { clock.tick(200); }); // past auto-advance

                // Verify we're on tab 1
                const tabs = container.querySelectorAll('.qdock-tab');
                expect(tabs[1].classList.contains('active')).to.be.true;

                // Go back to tab 0
                act(() => { (tabs[0] as HTMLButtonElement).click(); });
                expect(tabs[0].classList.contains('active')).to.be.true;

                // The previously selected answer should still be reflected
                const updatedBtns = container.querySelectorAll('.qdock-option-btn');
                expect(updatedBtns[0].classList.contains('selected')).to.be.true;
                unmount();
            } finally {
                clock.restore();
            }
        });

        it('Confirm tab shows "No answer" for unanswered questions', () => {
            const { container, unmount } = mount(makeMultiQuestion());
            // Go directly to Confirm tab without answering anything
            const tabs = container.querySelectorAll('.qdock-tab');
            act(() => { (tabs[2] as HTMLButtonElement).click(); });

            const confirmAnswers = container.querySelectorAll('.qdock-confirm-answer');
            expect(confirmAnswers.length).to.equal(2);
            expect(confirmAnswers[0].textContent).to.include('No answer');
            expect(confirmAnswers[1].textContent).to.include('No answer');
            unmount();
        });
    });
});
