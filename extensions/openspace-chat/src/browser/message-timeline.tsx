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
import { Message, OpenCodeService, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import type { SessionService } from 'openspace-core/lib/browser/session-service';
import { MessageBubble } from './message-bubble';

/**
 * Props for the MessageTimeline component.
 */
export interface MessageTimelineProps {
    /** Array of messages to display */
    messages: Message[];
    /** Whether a message is currently streaming */
    isStreaming: boolean;
    /** ID of the message currently being streamed, if any */
    streamingMessageId?: string;
    /** OpenCode service — needed for fetching child session data (task tools) */
    openCodeService?: OpenCodeService;
    /** Session service — needed for active project ID (task tools) */
    sessionService?: SessionService;
    /** Pending permission requests — matched by callID to tool parts */
    pendingPermissions?: PermissionNotification[];
    /** Callback to reply to a permission request */
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
    /** Callback to open a file in the editor when a file path subtitle is clicked */
    onOpenFile?: (filePath: string) => void;
}

/**
 * TextShimmer - Per-character shimmer animation (following opencode web client).
 * Each character gets a staggered animation delay for a sweeping shimmer effect.
 */
const TextShimmer: React.FC<{ text: string }> = ({ text }) => (
    <div className="text-shimmer" aria-live="polite" aria-label="Assistant is thinking">
        {text.split('').map((char, i) => (
            <span
                key={i}
                className="text-shimmer-char"
                style={{ animationDelay: `${i * 45}ms` }}
            >
                {char}
            </span>
        ))}
    </div>
);

/**
 * Scroll threshold (pixels from bottom) to consider "scrolled up".
 */
const SCROLLED_UP_THRESHOLD = 50;

/**
 * Window (ms) after a programmatic scroll during which scroll events are ignored.
 */
const PROGRAMMATIC_SCROLL_WINDOW = 250;

/**
 * MessageTimeline - Container for message list with smart scroll behavior.
 *
 * Improvements over previous version:
 * - No streamingData prop (text lives in message.parts only)
 * - Character shimmer "Thinking" indicator instead of bouncing dots
 * - Wheel event detection for user scroll-up (avoids false positives)
 * - Programmatic scroll window to prevent auto-scroll interference
 */
export const MessageTimeline: React.FC<MessageTimelineProps> = ({
    messages,
    isStreaming,
    streamingMessageId,
    openCodeService,
    sessionService,
    pendingPermissions,
    onReplyPermission,
    onOpenFile,
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const bottomSentinelRef = React.useRef<HTMLDivElement>(null);
    const [isScrolledUp, setIsScrolledUp] = React.useState(false);
    const [hasNewMessages, setHasNewMessages] = React.useState(false);
    const lastMessageCountRef = React.useRef(messages.length);
    const userScrolledUpRef = React.useRef(false);
    const lastProgrammaticScrollRef = React.useRef(0);

    /**
     * Scroll to bottom programmatically.
     * Marks the scroll as programmatic so the wheel handler doesn't flag it as user scroll.
     */
    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        const sentinel = bottomSentinelRef.current;
        if (!sentinel) return;

        lastProgrammaticScrollRef.current = Date.now();
        requestAnimationFrame(() => {
            sentinel.scrollIntoView({ behavior, block: 'end' });
            setHasNewMessages(false);
            setIsScrolledUp(false);
            userScrolledUpRef.current = false;
        });
    }, []);

    /**
     * Detect user scrolling up via wheel events.
     * Only wheel with deltaY < 0 (scrolling up) counts as user-initiated.
     * This avoids false positives from content reflows and programmatic scrolls.
     */
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY < 0) {
                // User scrolled up
                userScrolledUpRef.current = true;
                setIsScrolledUp(true);
            }
        };

        const handleScroll = () => {
            // Ignore programmatic scrolls (within the window)
            if (Date.now() - lastProgrammaticScrollRef.current < PROGRAMMATIC_SCROLL_WINDOW) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            if (distanceFromBottom <= SCROLLED_UP_THRESHOLD) {
                // User scrolled back to bottom — re-enable auto-scroll
                if (userScrolledUpRef.current) {
                    userScrolledUpRef.current = false;
                    setIsScrolledUp(false);
                    setHasNewMessages(false);
                }
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: true });
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Auto-scroll on new messages
    React.useEffect(() => {
        const messageCountChanged = messages.length !== lastMessageCountRef.current;
        lastMessageCountRef.current = messages.length;

        if (messageCountChanged) {
            if (!userScrolledUpRef.current) {
                const timer = setTimeout(() => scrollToBottom('smooth'), 50);
                return () => clearTimeout(timer);
            } else {
                setHasNewMessages(true);
            }
        }
        return undefined;
    }, [messages.length, scrollToBottom]);

    // Auto-scroll during streaming — use ResizeObserver on content for efficient detection
    React.useEffect(() => {
        if (!isStreaming || userScrolledUpRef.current) return;

        const content = containerRef.current?.querySelector('.message-timeline-content');
        if (!content) return;

        const observer = new ResizeObserver(() => {
            if (!userScrolledUpRef.current) {
                lastProgrammaticScrollRef.current = Date.now();
                bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
            }
        });

        observer.observe(content);
        return () => observer.disconnect();
    }, [isStreaming]);

    // Scroll to bottom on initial mount
    React.useEffect(() => {
        bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
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
                        <div className="message-timeline-empty">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32" style={{ opacity: 0.3 }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                            <div className="message-timeline-empty-title">Start a conversation</div>
                            <div className="message-timeline-empty-hint">Type a message below, or attach a file with @</div>
                        </div>
                    ) : (
                        messages.map((message, index) => {
                            const isUser = message.role === 'user';
                            const isMessageStreaming = isStreaming && streamingMessageId === message.id;
                            const { isFirst, isLast } = getMessageGroupInfo(index);

                            return (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isUser={isUser}
                                    isStreaming={isMessageStreaming}
                                    isFirstInGroup={isFirst}
                                    isLastInGroup={isLast}
                                    openCodeService={openCodeService}
                                    sessionService={sessionService}
                                    pendingPermissions={pendingPermissions}
                                    onReplyPermission={onReplyPermission}
                                    onOpenFile={onOpenFile}
                                />
                            );
                        })
                    )}
                    {/* Character shimmer "Thinking" indicator — shown when streaming but no response parts yet */}
                    {isStreaming && !streamingMessageId && (
                        <TextShimmer text="Thinking" />
                    )}
                    {/* Sentinel element - scroll target */}
                    <div ref={bottomSentinelRef} className="message-timeline-bottom-sentinel" aria-hidden="true" />
                </div>
            </div>

            {/* Scroll-to-bottom floating button */}
            <button
                type="button"
                className={`scroll-to-bottom-btn ${isScrolledUp ? 'visible' : ''}`}
                onClick={() => scrollToBottom('smooth')}
                aria-label="Scroll to bottom"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <path d="M12 5v14"/>
                    <path d="m19 12-7 7-7-7"/>
                </svg>
            </button>

            {/* New messages indicator */}
            {hasNewMessages && isScrolledUp && (
                <button
                    type="button"
                    className="new-messages-indicator"
                    onClick={() => scrollToBottom('smooth')}
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
