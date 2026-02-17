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
 * Extract text content from message parts.
 */
function extractTextFromParts(parts: MessagePart[]): string {
    return parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map(part => part.text)
        .join('');
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(date: Date | string | number | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * MessageBubble - Individual message component with distinct user/assistant styling.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isUser,
    isStreaming = false,
    streamingText = '',
    isFirstInGroup = true,
    isLastInGroup = true,
}) => {
    const baseText = extractTextFromParts(message.parts);
    const displayText = streamingText ? baseText + streamingText : baseText;
    const timestamp = formatTimestamp(message.metadata?.timestamp as string | number);

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
                                <span className="message-bubble-icon">👤</span>
                                You
                            </>
                        ) : (
                            <>
                                <span className="message-bubble-icon">🤖</span>
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
                {displayText || '\u00A0'}
                {isStreaming && (
                    <span className="message-streaming-cursor" aria-hidden="true">
                        ▋
                    </span>
                )}
            </div>
        </article>
    );
};

export default MessageBubble;
