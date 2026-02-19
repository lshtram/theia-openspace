/********************************************************************************
 * Copyright (C) 2024 OpenSpace contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 ********************************************************************************/

import * as React from '@theia/core/shared/react';
import { Message, MessagePart } from 'openspace-core/lib/common/opencode-protocol';

/**
 * Props for the MessageBubble component.
 */
export interface MessageBubbleProps {
    /** The message to display */
    message: Message;
    /** Whether this is a user message (true) or assistant message (false) */
    isUser: boolean;
    /** Whether this message is currently streaming */
    isStreaming?: boolean;
    /** Additional streaming text to append (for assistant messages) */
    streamingText?: string;
    /** Whether this is the first message in a group from the same sender */
    isFirstInGroup?: boolean;
    /** Whether this is the last message in a group from the same sender */
    isLastInGroup?: boolean;
}

/**
 * Render a single message part based on its type.
 * SDK Part types: text, tool, reasoning, step-start, step-finish, file,
 * agent, snapshot, patch, retry, compaction, subtask.
 */
function renderPart(part: MessagePart, index: number): React.ReactNode {
    switch (part.type) {
        case 'text':
            return renderTextPart(part, index);
        case 'tool':
            return renderToolPart(part, index);
        case 'reasoning':
            return renderReasoningPart(part, index);
        case 'step-start':
            return renderStepStartPart(part, index);
        case 'step-finish':
            return renderStepFinishPart(part, index);
        case 'file':
            return renderFilePart(part, index);
        default:
            return renderFallbackPart(part, index);
    }
}

/** Render text part — preserves whitespace, code blocks rendered as <pre>. */
function renderTextPart(part: any, index: number): React.ReactNode {
    const text: string = part.text || '';
    if (!text) {
        return null;
    }
    return (
        <div key={`text-${index}`} className="part-text">
            {text}
        </div>
    );
}

const BASH_TOOL_NAMES = /^(bash|execute|run_command|run|shell|cmd|terminal)$/i;

/** Collapsible tool call block. Detects bash and renders terminal style. */
const ToolBlock: React.FC<{ part: any; index?: number }> = ({ part }) => {
    const [expanded, setExpanded] = React.useState(false);
    const name: string = part.tool || 'tool';
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running';
    const isError = stateStr === 'error';
    const isBash = BASH_TOOL_NAMES.test(name);

    // Extract input/output — SDK: state.input and state.output for completed state
    const input = (typeof state === 'object' && state !== null && 'input' in state)
        ? (state as { input?: unknown }).input
        : undefined;
    const output = (typeof state === 'object' && state !== null && 'output' in state)
        ? state.output
        : (part.output ?? undefined);

    if (isBash) {
        const cmd: string = typeof input === 'string' ? input :
            (input && typeof input === 'object' ? ((input as { command?: string }).command ?? JSON.stringify(input, null, 2)) : '');
        const bashOutput: string = typeof output === 'string' ? output :
            (output ? JSON.stringify(output, null, 2) : '');
        return (
            <div className="part-tool part-tool-bash" data-state={stateStr}>
                <div className="part-tool-header">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                    </svg>
                    <span style={{ fontWeight: 600, color: '#ccc', fontFamily: 'var(--theia-code-font-family, monospace)' }}>
                        {cmd || name}
                    </span>
                    {isRunning && (
                        <svg className="oc-spin" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    )}
                </div>
                {cmd && cmd !== name && (
                    <div className="part-tool-cmd">{cmd}</div>
                )}
                {/* TODO: strip ANSI escape codes from bashOutput (raw codes from shell commands will display literally) */}
                {bashOutput && <div className="part-tool-bash-output">{bashOutput}</div>}
            </div>
        );
    }

    const hasBody = !!(input || output);

    return (
        <div className="part-tool" data-expanded={expanded ? 'true' : 'false'} data-state={stateStr}>
            <div className="part-tool-header" onClick={() => hasBody && setExpanded(e => !e)}>
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : isError ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M20 6 9 17l-5-5"/>
                        </svg>
                    )}
                </span>
                <span className={isRunning ? 'part-tool-name oc-shimmer' : 'part-tool-name'}>{name}</span>
                {hasBody && (
                    <svg className="part-tool-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                )}
            </div>
            {hasBody && (
                <div className="part-tool-body">
                    {input && (
                        <pre className="part-tool-io part-tool-input">
                            {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
                        </pre>
                    )}
                    {output && (
                        <pre className="part-tool-io part-tool-output">
                            {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

/** Render tool part — minimalist collapsible. Bash tools get terminal style. */
function renderToolPart(part: any, index: number): React.ReactNode {
    return <ToolBlock key={part.id || `tool-${index}`} part={part} index={index} />;
}

/** Collapsible reasoning block. Collapsed by default. Shows shimmer when no text yet (streaming). */
const ReasoningBlock: React.FC<{ part: any }> = ({ part }) => {
    const [expanded, setExpanded] = React.useState(false);
    const text: string = part.text || part.reasoning || '';
    const isStreaming = !text;
    return (
        <div className="part-reasoning" data-expanded={expanded ? 'true' : 'false'}>
            <div
                className="part-reasoning-header"
                onClick={() => text && setExpanded(e => !e)}
                aria-expanded={expanded}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' && text) { setExpanded(x => !x); } }}
            >
                <svg className="part-reasoning-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
                <span className={isStreaming ? 'part-reasoning-label oc-shimmer' : 'part-reasoning-label'}>
                    {isStreaming ? 'Thinking...' : 'Thinking Process'}
                </span>
            </div>
            {text && (
                <div className="part-reasoning-body">{text}</div>
            )}
        </div>
    );
};

/** Render reasoning part — collapsible side-line block. */
function renderReasoningPart(part: any, index: number): React.ReactNode {
    return <ReasoningBlock key={`reasoning-${index}`} part={part} />;
}

/** Render step-start part — subtle inline breadcrumb with SVG chevron. */
function renderStepStartPart(part: any, index: number): React.ReactNode {
    const name: string = part.name || 'Step';
    return (
        <div key={`step-start-${index}`} className="part-step part-step-start">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10" aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
            </svg>
            <span className="part-step-label">{name}</span>
        </div>
    );
}

/** Render step-finish part — subtle inline breadcrumb with checkmark. */
function renderStepFinishPart(_part: any, index: number): React.ReactNode {
    return (
        <div key={`step-finish-${index}`} className="part-step part-step-finish">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10" aria-hidden="true">
                <path d="M20 6 9 17l-5-5"/>
            </svg>
            <span className="part-step-label">done</span>
        </div>
    );
}

/** Render file part — pill with file SVG icon. */
function renderFilePart(part: any, index: number): React.ReactNode {
    const filePath: string = part.filename || part.file || part.url || 'unknown';
    return (
        <div key={`file-${index}`} className="part-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="part-file-path">{filePath}</span>
        </div>
    );
}

/** Render fallback for unhandled part types — small pill chip. */
function renderFallbackPart(part: MessagePart, index: number): React.ReactNode {
    return (
        <span key={`other-${index}`} className="part-fallback">
            {part.type}
        </span>
    );
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(date: Date | string | number | undefined): string {
    if (!date) { return ''; }
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * MessageBubble - Individual message component with distinct user/assistant styling.
 * Renders all SDK Part types (text, tool, reasoning, step-start/finish, file, etc.).
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isUser,
    isStreaming = false,
    streamingText = '',
    isFirstInGroup = true,
    isLastInGroup = true,
}) => {
    const parts = message.parts || [];
    // SDK messages use time.created (number timestamp in ms)
    const timestamp = message.time?.created ? formatTimestamp(message.time.created) : '';

    // Check if there are any renderable parts (non-empty)
    const hasParts = parts.length > 0;

    return (
        <article
            className={[
                'message-bubble',
                isUser ? 'message-bubble-user' : 'message-bubble-assistant',
                isStreaming ? 'message-bubble-streaming' : '',
                isFirstInGroup ? 'message-bubble-first' : '',
                isLastInGroup ? 'message-bubble-last' : '',
            ].join(' ')}
            data-message-id={message.id}
            data-message-role={message.role}
            aria-label={`${isUser ? 'User' : 'Assistant'} message`}
        >
            {/* Only show assistant header — no header for user messages */}
            {isFirstInGroup && !isUser && (
                <div className="message-bubble-header">
                    <span className="message-bubble-role">
                        <svg className="message-bubble-role-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                        </svg>
                        Assistant
                    </span>
                    {timestamp && (
                        <span className="message-bubble-timestamp">{timestamp}</span>
                    )}
                </div>
            )}
            <div className="message-bubble-content">
                {hasParts
                    ? parts.map((part, i) => renderPart(part, i))
                    : '\u00A0'
                }
                {streamingText && (
                    <div className="part-text">{streamingText}</div>
                )}
                {isStreaming && (
                    <span className="message-streaming-cursor" aria-hidden="true">
                        &#x258B;
                    </span>
                )}
            </div>
        </article>
    );
};

export default MessageBubble;
