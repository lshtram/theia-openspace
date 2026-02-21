// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import type * as SDKTypes from 'openspace-core/lib/common/opencode-sdk-types';

export interface QuestionDockProps {
    question: SDKTypes.QuestionRequest;
    onAnswer: (requestId: string, answers: SDKTypes.QuestionAnswer[]) => void;
    onReject: (requestId: string) => void;
}

/**
 * QuestionDock — renders above PromptInput when the opencode server asks the user
 * a question (e.g., the Question tool).
 *
 * Single question (1 question, non-multiple):
 *  - Show question text + option buttons (click = immediate submit)
 *  - "Type your own answer" opens a text input
 *  - "Dismiss" rejects
 *
 * Multi-question (>1 question, or multiple=true):
 *  - Tab bar with each question's header + "Confirm" tab
 *  - Clicking options selects/toggles; navigation via Next
 *  - Confirm tab reviews answers, Submit button finalises
 *  - "Dismiss" always visible
 */
export const QuestionDock: React.FC<QuestionDockProps> = ({ question, onAnswer, onReject }) => {
    const questions = question.questions;

    // Guard: if no questions, render nothing
    if (questions.length === 0) {
        return null;
    }

    const isMultiFlow = questions.length > 1 || questions.some(q => q.multiple);

    if (isMultiFlow) {
        return <MultiQuestionDock question={question} onAnswer={onAnswer} onReject={onReject} />;
    }
    return <SingleQuestionDock question={question} onAnswer={onAnswer} onReject={onReject} />;
};

// ─── Single question flow ───────────────────────────────────────────────────

const SingleQuestionDock: React.FC<QuestionDockProps> = ({ question, onAnswer, onReject }) => {
    const info = question.questions[0];
    const [showCustomInput, setShowCustomInput] = React.useState(false);
    const [customValue, setCustomValue] = React.useState('');
    const customInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (showCustomInput && customInputRef.current) {
            customInputRef.current.focus();
        }
    }, [showCustomInput]);

    const handlePickOption = (label: string) => {
        onAnswer(question.id, [[label]]);
    };

    const handleCustomSubmit = () => {
        const trimmed = customValue.trim();
        if (trimmed) {
            onAnswer(question.id, [[trimmed]]);
        }
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCustomSubmit();
        }
        if (e.key === 'Escape') {
            setShowCustomInput(false);
            setCustomValue('');
        }
    };

    return (
        <div className="qdock">
            <div className="qdock-header">
                <span className="qdock-question-text">{info.question}</span>
                <button
                    type="button"
                    className="qdock-dismiss"
                    onClick={() => onReject(question.id)}
                    title="Dismiss question"
                >
                    Dismiss
                </button>
            </div>
            <div className="qdock-options">
                {info.options.map(opt => (
                    <button
                        key={opt.label}
                        type="button"
                        className="qdock-option-btn"
                        onClick={() => handlePickOption(opt.label)}
                        title={opt.description}
                    >
                        <span className="qdock-option-label">{opt.label}</span>
                        {opt.description && (
                            <span className="qdock-option-desc">{opt.description}</span>
                        )}
                    </button>
                ))}
            </div>
            {info.custom !== false && (
                <>
                    {!showCustomInput ? (
                        <button
                            type="button"
                            className="qdock-custom-toggle"
                            onClick={() => setShowCustomInput(true)}
                        >
                            Type your own answer
                        </button>
                    ) : (
                        <div className="qdock-custom-input-row">
                            <input
                                ref={customInputRef}
                                type="text"
                                className="qdock-custom-input"
                                value={customValue}
                                onChange={e => setCustomValue(e.target.value)}
                                onKeyDown={handleCustomKeyDown}
                                placeholder="Type your answer..."
                            />
                            <button
                                type="button"
                                className="qdock-btn-accent"
                                onClick={handleCustomSubmit}
                                disabled={!customValue.trim()}
                            >
                                Submit
                            </button>
                            <button
                                type="button"
                                className="qdock-btn-ghost"
                                onClick={() => { setShowCustomInput(false); setCustomValue(''); }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ─── Multi-question flow ────────────────────────────────────────────────────

const MultiQuestionDock: React.FC<QuestionDockProps> = ({ question, onAnswer, onReject }) => {
    const questions = question.questions;
    const tabCount = questions.length + 1; // +1 for Confirm tab
    const [activeTab, setActiveTab] = React.useState(0);
    // answers[i] = array of selected labels for question i
    const [answers, setAnswers] = React.useState<string[][]>(() => questions.map(() => []));
    // Custom input state per question
    const [customInputVisible, setCustomInputVisible] = React.useState<boolean[]>(() => questions.map(() => false));
    const [customValues, setCustomValues] = React.useState<string[]>(() => questions.map(() => ''));
    const customInputRef = React.useRef<HTMLInputElement>(null);
    // Track pending auto-advance timers for cleanup on unmount
    const pendingTimersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

    // Cleanup timers on unmount to avoid setState on unmounted component
    React.useEffect(() => {
        return () => {
            pendingTimersRef.current.forEach(clearTimeout);
        };
    }, []);

    React.useEffect(() => {
        if (activeTab < questions.length && customInputVisible[activeTab] && customInputRef.current) {
            customInputRef.current.focus();
        }
    }, [customInputVisible, activeTab, questions.length]);

    const isConfirmTab = activeTab === questions.length;
    const currentInfo = !isConfirmTab ? questions[activeTab] : undefined;
    const isLastQuestion = activeTab === questions.length - 1;

    const toggleOption = (questionIdx: number, label: string) => {
        setAnswers(prev => {
            const next = prev.map(a => [...a]);
            const info = questions[questionIdx];
            if (info.multiple) {
                // Toggle
                const idx = next[questionIdx].indexOf(label);
                if (idx >= 0) {
                    next[questionIdx].splice(idx, 1);
                } else {
                    next[questionIdx].push(label);
                }
            } else {
                // Single select — set and auto-advance
                next[questionIdx] = [label];
            }
            return next;
        });
    };

    const handleSingleSelect = (questionIdx: number, label: string) => {
        toggleOption(questionIdx, label);
        // Auto-advance to next tab after a brief delay for visual feedback
        if (!questions[questionIdx].multiple) {
            const timer = setTimeout(() => {
                setActiveTab(prev => Math.min(prev + 1, tabCount - 1));
            }, 150);
            pendingTimersRef.current.push(timer);
        }
    };

    const handleNext = () => {
        setActiveTab(prev => Math.min(prev + 1, tabCount - 1));
    };

    const handleSubmit = () => {
        onAnswer(question.id, answers);
    };

    const handleCustomSubmitMulti = (questionIdx: number) => {
        const trimmed = customValues[questionIdx]?.trim();
        if (!trimmed) return;
        setAnswers(prev => {
            const next = prev.map(a => [...a]);
            const info = questions[questionIdx];
            if (info.multiple) {
                if (!next[questionIdx].includes(trimmed)) {
                    next[questionIdx].push(trimmed);
                }
            } else {
                next[questionIdx] = [trimmed];
            }
            return next;
        });
        setCustomValues(prev => { const n = [...prev]; n[questionIdx] = ''; return n; });
        setCustomInputVisible(prev => { const n = [...prev]; n[questionIdx] = false; return n; });
        // Auto-advance for single-select custom answers
        if (!questions[questionIdx].multiple) {
            const timer = setTimeout(() => {
                setActiveTab(prev => Math.min(prev + 1, tabCount - 1));
            }, 150);
            pendingTimersRef.current.push(timer);
        }
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent, questionIdx: number) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCustomSubmitMulti(questionIdx);
        }
        if (e.key === 'Escape') {
            setCustomInputVisible(prev => { const n = [...prev]; n[questionIdx] = false; return n; });
            setCustomValues(prev => { const n = [...prev]; n[questionIdx] = ''; return n; });
        }
    };

    const hasAnswer = (idx: number) => answers[idx].length > 0;

    return (
        <div className="qdock">
            <div className="qdock-header">
                <span className="qdock-question-text">
                    {isConfirmTab ? 'Review & Submit' : currentInfo!.question}
                </span>
                <button
                    type="button"
                    className="qdock-dismiss"
                    onClick={() => onReject(question.id)}
                    title="Dismiss question"
                >
                    Dismiss
                </button>
            </div>

            {/* Tab bar */}
            <div className="qdock-tabs">
                {questions.map((q, i) => (
                    <button
                        key={i}
                        type="button"
                        className={`qdock-tab ${activeTab === i ? 'active' : ''} ${hasAnswer(i) ? 'answered' : ''}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {q.header}
                    </button>
                ))}
                <button
                    type="button"
                    className={`qdock-tab qdock-tab-confirm ${activeTab === questions.length ? 'active' : ''}`}
                    onClick={() => setActiveTab(questions.length)}
                >
                    Confirm
                </button>
            </div>

            {/* Tab content */}
            {!isConfirmTab && currentInfo && (
                <>
                    <div className="qdock-options">
                        {currentInfo.options.map(opt => {
                            const isSelected = answers[activeTab].includes(opt.label);
                            return (
                                <button
                                    key={opt.label}
                                    type="button"
                                    className={`qdock-option-btn ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                        if (currentInfo.multiple) {
                                            toggleOption(activeTab, opt.label);
                                        } else {
                                            handleSingleSelect(activeTab, opt.label);
                                        }
                                    }}
                                    title={opt.description}
                                >
                                    {currentInfo.multiple && (
                                        <span className="qdock-checkbox">{isSelected ? '\u2611' : '\u2610'}</span>
                                    )}
                                    <span className="qdock-option-label">{opt.label}</span>
                                    {opt.description && (
                                        <span className="qdock-option-desc">{opt.description}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {currentInfo.custom !== false && (
                        <>
                            {!customInputVisible[activeTab] ? (
                                <button
                                    type="button"
                                    className="qdock-custom-toggle"
                                    onClick={() => setCustomInputVisible(prev => { const n = [...prev]; n[activeTab] = true; return n; })}
                                >
                                    Type your own answer
                                </button>
                            ) : (
                                <div className="qdock-custom-input-row">
                                    <input
                                        ref={customInputRef}
                                        type="text"
                                        className="qdock-custom-input"
                                        value={customValues[activeTab] || ''}
                                        onChange={e => setCustomValues(prev => { const n = [...prev]; n[activeTab] = e.target.value; return n; })}
                                        onKeyDown={e => handleCustomKeyDown(e, activeTab)}
                                        placeholder="Type your answer..."
                                    />
                                    <button
                                        type="button"
                                        className="qdock-btn-accent"
                                        onClick={() => handleCustomSubmitMulti(activeTab)}
                                        disabled={!customValues[activeTab]?.trim()}
                                    >
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        className="qdock-btn-ghost"
                                        onClick={() => {
                                            setCustomInputVisible(prev => { const n = [...prev]; n[activeTab] = false; return n; });
                                            setCustomValues(prev => { const n = [...prev]; n[activeTab] = ''; return n; });
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Next button for multiple-select questions */}
                    {currentInfo.multiple && (
                        <div className="qdock-actions">
                            <button
                                type="button"
                                className="qdock-btn-accent"
                                onClick={handleNext}
                                disabled={answers[activeTab].length === 0}
                            >
                                {isLastQuestion ? 'Review' : 'Next'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Confirm tab */}
            {isConfirmTab && (
                <div className="qdock-confirm">
                    <div className="qdock-confirm-review">
                        {questions.map((q, i) => (
                            <div key={i} className="qdock-confirm-item">
                                <span className="qdock-confirm-header">{q.header}:</span>
                                <span className="qdock-confirm-answer">
                                    {answers[i].length > 0 ? answers[i].join(', ') : <em>No answer</em>}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="qdock-actions">
                        <button
                            type="button"
                            className="qdock-btn-accent"
                            onClick={handleSubmit}
                        >
                            Submit
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
