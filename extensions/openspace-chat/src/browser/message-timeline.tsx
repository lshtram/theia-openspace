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
import { Message } from 'openspace-core/lib/common/opencode-protocol';
import { MessageBubble } from './message-bubble';

/**
 * Props for the MessageTimeline component.
 */
export interface MessageTimelineProps {
    /** Array of messages to display */
    messages: Message[];
    /** Map of message IDs to streaming text content */
    streamingData: Map<string, string>;
    /** Whether a message is currently streaming */
    isStreaming: boolean;
    /** ID of the message currently being streamed, if any */
    streamingMessageId?: string;
}

/**
 * Scroll threshold (pixels from bottom) for auto-scroll behavior.
 * If within this threshold, auto-scroll is enabled.
 */
const AUTO_SCROLL_THRESHOLD = 50;

/**
 * Scroll threshold (pixels from bottom) to consider "scrolled up".
 * Beyond this, we consider the user has intentionally scrolled up.
 */
const SCROLLED_UP_THRESHOLD = 100;

/**
 * MessageTimeline - Container for message list with smart scroll behavior.
 */
export const MessageTimeline: React.FC<MessageTimelineProps> = ({
    messages,
    streamingData,
    isStreaming,
    streamingMessageId,
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const bottomSentinelRef = React.useRef<HTMLDivElement>(null);
    const [isScrolledUp, setIsScrolledUp] = React.useState(false);
    const [hasNewMessages, setHasNewMessages] = React.useState(false);
    const lastMessageCountRef = React.useRef(messages.length);
    const isUserScrollingRef = React.useRef(false);
    const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    /**
     * Check scroll position and update state.
     */
    const checkScrollPosition = React.useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        const wasScrolledUp = isScrolledUp;
        const nowScrolledUp = distanceFromBottom > SCROLLED_UP_THRESHOLD;

        setIsScrolledUp(nowScrolledUp);

        // If user scrolled to bottom, clear the new messages indicator
        if (wasScrolledUp && !nowScrolledUp) {
            setHasNewMessages(false);
        }
    }, [isScrolledUp]);

    /**
     * Handle scroll events with debouncing to detect user scrolling.
     */
    const handleScroll = React.useCallback(() => {
        isUserScrollingRef.current = true;

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Set a timeout to mark scrolling as finished
        scrollTimeoutRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
        }, 150);

        checkScrollPosition();
    }, [checkScrollPosition]);

    /**
     * Smooth scroll to bottom of the timeline.
     * Uses sentinel element scrollIntoView for reliable cross-layout behaviour.
     */
    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        // Use requestAnimationFrame to ensure DOM is updated before scrolling
        requestAnimationFrame(() => {
            sentinel.scrollIntoView({ behavior, block: 'end' });
            setHasNewMessages(false);
            setIsScrolledUp(false);
        });
    }, []);

    /**
     * Handle click on "New messages" indicator.
     */
    const handleNewMessagesClick = React.useCallback(() => {
        scrollToBottom('smooth');
    }, [scrollToBottom]);

    // Set up scroll event listener
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [handleScroll]);

    // Auto-scroll logic for new messages
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const messageCountChanged = messages.length !== lastMessageCountRef.current;
        lastMessageCountRef.current = messages.length;

        if (messageCountChanged) {
            if (!isUserScrollingRef.current) {
                // Always scroll to show new message — user sent it or agent replied.
                const timer = setTimeout(() => {
                    scrollToBottom('smooth');
                }, 50);
                return () => clearTimeout(timer);
            } else {
                // User is actively scrolling; show indicator instead.
                setHasNewMessages(true);
            }
        }
        return undefined;
    }, [messages, scrollToBottom]);

    // Auto-scroll during streaming — fire after paint so scrollHeight is current
    React.useEffect(() => {
        if (!isStreaming || isUserScrollingRef.current) return;
        const rafId = requestAnimationFrame(() => {
            bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
        return () => cancelAnimationFrame(rafId);
    }, [streamingData, isStreaming]);

    // Scroll to bottom on initial mount so the most recent messages are visible
    React.useEffect(() => {
        bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        // Only run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Determine message groups
    const getMessageGroupInfo = (index: number): { isFirst: boolean; isLast: boolean } => {
        const currentMessage = messages[index];
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

        const isFirst = !prevMessage || prevMessage.role !== currentMessage.role;
        const isLast = !nextMessage || nextMessage.role !== currentMessage.role;

        return { isFirst, isLast };
    };

    return (
        <div className="message-timeline">
            <div
                ref={containerRef}
                className="message-timeline-scroll-container"
                role="log"
                aria-live="polite"
                aria-atomic="false"
                aria-label="Message timeline"
            >
                <div className="message-timeline-content">
                    {messages.length === 0 ? (
                        /* Empty state — rendered inside the scroll container so the
                           container and sentinel are always present in the DOM */
                        <div className="message-timeline-empty-content">
                            <div className="message-timeline-empty-icon">💬</div>
                            <p className="message-timeline-empty-title">No messages yet</p>
                            <p className="message-timeline-empty-hint">
                                Type a message below to start the conversation
                            </p>
                        </div>
                    ) : (
                        messages.map((message, index) => {
                            const isUser = message.role === 'user';
                            const streamingText = streamingData.get(message.id);
                            const isMessageStreaming = isStreaming &&
                                streamingMessageId === message.id;
                            const { isFirst, isLast } = getMessageGroupInfo(index);

                            return (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isUser={isUser}
                                    isStreaming={isMessageStreaming}
                                    streamingText={streamingText}
                                    isFirstInGroup={isFirst}
                                    isLastInGroup={isLast}
                                />
                            );
                        })
                    )}
                    {/* Sentinel element - scroll target for auto-scroll, always rendered */}
                    <div ref={bottomSentinelRef} className="message-timeline-bottom-sentinel" aria-hidden="true" />
                </div>
            </div>

            {/* New messages indicator */}
            {hasNewMessages && isScrolledUp && (
                <button
                    type="button"
                    className="new-messages-indicator"
                    onClick={handleNewMessagesClick}
                    aria-label="Scroll to new messages"
                >
                    <span className="new-messages-icon">↓</span>
                    <span className="new-messages-text">New messages</span>
                </button>
            )}
        </div>
    );
};

export default MessageTimeline;
