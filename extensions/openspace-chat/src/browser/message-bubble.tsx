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

/** Render tool part — shows tool name, input, and output in a collapsible block. */
function renderToolPart(part: any, index: number): React.ReactNode {
    const name: string = part.name || part.tool || 'tool';
    const state: string = part.state || '';
    const stateLabel = state === 'running' ? ' (running...)' : state === 'error' ? ' (error)' : '';
    return (
        <details key={`tool-${index}`} className="part-tool">
            <summary className="part-tool-summary">
                <span className="part-tool-icon">{'>'}</span>
                <span className="part-tool-name">{name}</span>
                {stateLabel && <span className="part-tool-state">{stateLabel}</span>}
            </summary>
            {part.input && (
                <pre className="part-tool-io part-tool-input">{typeof part.input === 'string' ? part.input : JSON.stringify(part.input, null, 2)}</pre>
            )}
            {part.output && (
                <pre className="part-tool-io part-tool-output">{typeof part.output === 'string' ? part.output : JSON.stringify(part.output, null, 2)}</pre>
            )}
        </details>
    );
}

/** Render reasoning part — italic/dimmed thinking indicator. */
function renderReasoningPart(part: any, index: number): React.ReactNode {
    const text: string = part.text || part.reasoning || '';
    return (
        <div key={`reasoning-${index}`} className="part-reasoning">
            <span className="part-reasoning-label">Thinking</span>
            {text && <div className="part-reasoning-text">{text}</div>}
        </div>
    );
}

/** Render step-start part — progress indicator for a named step. */
function renderStepStartPart(part: any, index: number): React.ReactNode {
    const name: string = part.name || 'Step';
    return (
        <div key={`step-start-${index}`} className="part-step part-step-start">
            <span className="part-step-icon">{'>'}</span>
            <span className="part-step-label">{name}</span>
        </div>
    );
}

/** Render step-finish part — completion indicator. */
function renderStepFinishPart(part: any, index: number): React.ReactNode {
    return (
        <div key={`step-finish-${index}`} className="part-step part-step-finish">
            <span className="part-step-icon">{'>'}</span>
            <span className="part-step-label">Step completed</span>
        </div>
    );
}

/** Render file part — file path as a clickable-looking reference. */
function renderFilePart(part: any, index: number): React.ReactNode {
    const filePath: string = part.filename || part.file || part.url || 'unknown file';
    return (
        <div key={`file-${index}`} className="part-file">
            <span className="part-file-icon">F</span>
            <span className="part-file-path">{filePath}</span>
        </div>
    );
}

/** Render fallback for unhandled part types — small info badge. */
function renderFallbackPart(part: MessagePart, index: number): React.ReactNode {
    return (
        <div key={`other-${index}`} className="part-fallback">
            <span className="part-fallback-type">{part.type}</span>
        </div>
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
            {isFirstInGroup && (
                <div className="message-bubble-header">
                    <span className="message-bubble-role">
                        {isUser ? (
                            <>
                                <span className="message-bubble-icon">&#x1F464;</span>
                                You
                            </>
                        ) : (
                            <>
                                <span className="message-bubble-icon">&#x1F916;</span>
                                Assistant
                            </>
                        )}
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
