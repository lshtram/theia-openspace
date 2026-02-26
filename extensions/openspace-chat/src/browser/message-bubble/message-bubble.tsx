/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { Message, MessagePart, OpenCodeService, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import type { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { pickPhrase, statusToCategory } from '../streaming-vocab';
import { renderPart, renderTextPart } from './content-part-renderer';
import { ContextToolGroup, CONTEXT_TOOL_NAMES } from './tool-call-renderer';
import { RetryBanner, CopyButton, CostBar } from './message-actions';

// ─── Public types ───────────────────────────────────────────────────────────

export interface MessageBubbleProps {
    message: Message;
    isUser: boolean;
    isStreaming?: boolean;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    openCodeService?: OpenCodeService;
    sessionService?: SessionService;
    pendingPermissions?: PermissionNotification[];
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
    retryInfo?: { message: string; attempt: number; next: number };
    onOpenFile?: (filePath: string) => void;
    isIntermediateStep?: boolean;
}

export interface TurnGroupProps {
    isStreaming: boolean;
    durationSecs: number;
    streamingStatus?: string;
    children: React.ReactNode;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatElapsed(secs: number): string {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
}

function formatTimestamp(date: Date | string | number | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Group consecutive context tool parts into arrays for grouped rendering.
 * Non-context parts are returned individually.
 */
function groupParts(parts: MessagePart[]): Array<
    { type: 'single'; part: MessagePart; index: number } |
    { type: 'context-group'; parts: MessagePart[] }
> {
    const result: Array<
        { type: 'single'; part: MessagePart; index: number } |
        { type: 'context-group'; parts: MessagePart[] }
    > = [];
    let contextBuffer: MessagePart[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isContextTool = part.type === 'tool' && CONTEXT_TOOL_NAMES.test((part as any).tool || '');
        if (isContextTool) {
            contextBuffer.push(part);
        } else {
            if (contextBuffer.length > 0) {
                if (contextBuffer.length === 1) {
                    result.push({ type: 'single', part: contextBuffer[0], index: parts.indexOf(contextBuffer[0]) });
                } else {
                    result.push({ type: 'context-group', parts: [...contextBuffer] });
                }
                contextBuffer = [];
            }
            result.push({ type: 'single', part, index: i });
        }
    }
    if (contextBuffer.length > 0) {
        if (contextBuffer.length === 1) {
            result.push({ type: 'single', part: contextBuffer[0], index: parts.indexOf(contextBuffer[0]) });
        } else {
            result.push({ type: 'context-group', parts: [...contextBuffer] });
        }
    }
    return result;
}

// ─── TurnGroup ──────────────────────────────────────────────────────────────

export const TurnGroup: React.FC<TurnGroupProps> = ({ isStreaming, durationSecs, streamingStatus, children }) => {
    const [showExpanded, setShowExpanded] = React.useState(isStreaming);
    const wasStreamingRef = React.useRef(isStreaming);

    const category = statusToCategory(streamingStatus || '');
    const [phraseIndex, setPhraseIndex] = React.useState(() => Math.floor(Math.random() * 10));
    const prevCategoryRef = React.useRef(category);
    const shimmerThemeRef = React.useRef(`oc-theme-${Math.floor(Math.random() * 10)}`);

    React.useEffect(() => {
        if (prevCategoryRef.current !== category) {
            prevCategoryRef.current = category;
            setPhraseIndex(Math.floor(Math.random() * 10));
        }
    }, [category]);

    const displayPhrase = pickPhrase(category, phraseIndex);

    const streamStartRef = React.useRef<number>(Date.now());
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        if (isStreaming) {
            wasStreamingRef.current = true;
            setShowExpanded(true);
        } else if (wasStreamingRef.current) {
            wasStreamingRef.current = false;
            setShowExpanded(false);
        }
    }, [isStreaming]);

    React.useEffect(() => {
        if (!isStreaming) return;
        streamStartRef.current = Date.now();
        setElapsed(0);
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - streamStartRef.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isStreaming]);

    if (isStreaming) {
        return (
            <div className="turn-group turn-group-streaming">
                <div className="turn-group-streaming-content">
                    <div className="turn-group-sidebar" />
                    <div className="turn-group-body">{children}</div>
                </div>
                <div className="turn-group-activity-bar" aria-live="polite" aria-atomic="true">
                    <span className="turn-group-activity-icon" aria-hidden="true" />
                    <span className={`turn-group-activity-phrase ${shimmerThemeRef.current}`}>{displayPhrase}</span>
                    {elapsed > 0 && <span className="turn-group-duration">· {formatElapsed(elapsed)}</span>}
                </div>
            </div>
        );
    }

    return (
        <div className={`turn-group ${showExpanded ? 'turn-group-open' : 'turn-group-closed'}`}>
            <button
                type="button"
                className="turn-group-header"
                onClick={() => setShowExpanded(v => !v)}
                aria-expanded={showExpanded}
            >
                <svg
                    className={`turn-group-chevron ${showExpanded ? 'expanded' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    width="12" height="12" aria-hidden="true"
                >
                    <path d="m9 18 6-6-6-6"/>
                </svg>
                <span className="turn-group-label">{showExpanded ? 'Hide steps' : 'Show steps'}</span>
                {durationSecs > 0 && <span className="turn-group-duration">· {formatElapsed(durationSecs)}</span>}
            </button>
            {showExpanded && (
                <div className="turn-group-sidebar-wrap">
                    <div className="turn-group-sidebar" />
                    <div className="turn-group-body">{children}</div>
                </div>
            )}
        </div>
    );
};

// ─── Grouped parts rendering helper ─────────────────────────────────────────

function renderGroupedParts(
    grouped: ReturnType<typeof groupParts>,
    openCodeService?: OpenCodeService,
    sessionService?: SessionService,
    pendingPermissions?: PermissionNotification[],
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void,
    onOpenFile?: (filePath: string) => void
): React.ReactNode[] {
    return grouped.map((group, gi) => {
        if (group.type === 'context-group') {
            return <ContextToolGroup key={`ctx-group-${gi}`} parts={group.parts} />;
        }
        return renderPart(group.part, group.index, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile);
    });
}

// ─── MessageBubbleInner ─────────────────────────────────────────────────────

const MessageBubbleInner: React.FC<MessageBubbleProps> = ({
    message, isUser, isStreaming = false, isFirstInGroup = true, isLastInGroup = true,
    openCodeService, sessionService, pendingPermissions, onReplyPermission,
    retryInfo, onOpenFile, isIntermediateStep = false,
}) => {
    const rawParts = message.parts || [];
    const hideReasoning = !isStreaming && !isIntermediateStep;
    const parts = React.useMemo(
        () => hideReasoning ? rawParts.filter(p => p.type !== 'reasoning') : rawParts,
        [rawParts, hideReasoning]
    );
    const timestamp = message.time?.created ? formatTimestamp(message.time.created) : '';

    // ── Elapsed timer ────────────────────────────────────────────────
    const created = message.time?.created;
    const completed = (message.time as any)?.completed;
    const createdMs = created ? (typeof created === 'number' ? created : new Date(created).getTime()) : 0;
    const completedMs = completed ? (typeof completed === 'number' ? completed : new Date(completed).getTime()) : 0;
    const timerShouldRun = !isUser && !!createdMs && !completedMs && isStreaming;

    const [now, setNow] = React.useState(Date.now());
    React.useEffect(() => {
        if (!timerShouldRun) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [timerShouldRun]);

    const elapsedSecs = React.useMemo(() => {
        if (!createdMs) return 0;
        if (completedMs) return Math.max(0, Math.floor((completedMs - createdMs) / 1000));
        if (timerShouldRun) return Math.max(0, Math.floor((now - createdMs) / 1000));
        return 0;
    }, [createdMs, completedMs, timerShouldRun, now]);

    // ── Part separation ──────────────────────────────────────────────
    const hasIntermediateParts = React.useMemo(
        () => !isUser && parts.some(p => p.type === 'tool' || p.type === 'reasoning'),
        [isUser, parts]
    );
    const lastTextPartIndex = React.useMemo(() => {
        if (!hasIntermediateParts) return -1;
        let idx = -1;
        parts.forEach((p, i) => { if (p.type === 'text') idx = i; });
        return idx;
    }, [hasIntermediateParts, parts]);

    const intermediateParts = React.useMemo(() => {
        if (!hasIntermediateParts) return [];
        if (lastTextPartIndex < 0) return [...parts];
        return parts.filter((_, i) => i !== lastTextPartIndex);
    }, [hasIntermediateParts, parts, lastTextPartIndex]);

    const finalTextPartWithIndex = React.useMemo(() => {
        if (!hasIntermediateParts || lastTextPartIndex < 0) return null;
        return { part: parts[lastTextPartIndex], index: lastTextPartIndex };
    }, [hasIntermediateParts, parts, lastTextPartIndex]);

    const groupedIntermediateParts = React.useMemo(
        () => hasIntermediateParts ? groupParts(intermediateParts) : [],
        [hasIntermediateParts, intermediateParts]
    );
    const groupedAllParts = React.useMemo(
        () => !hasIntermediateParts ? groupParts(parts) : [],
        [hasIntermediateParts, parts]
    );
    const intermediateGrouped = React.useMemo(
        () => isIntermediateStep ? groupParts(parts) : [],
        [isIntermediateStep, parts]
    );

    // ── Cost bar ─────────────────────────────────────────────────────
    const stepFinishParts = React.useMemo(
        () => !isUser && !isStreaming ? parts.filter(p => p.type === 'step-finish') : [],
        [isUser, isStreaming, parts]
    );
    const costBarData = React.useMemo(() => {
        if (stepFinishParts.length === 0) return null;
        let totalInput = 0, totalOutput = 0, totalCost = 0;
        for (const p of stepFinishParts) {
            totalInput += (p as any).tokens?.input || 0;
            totalOutput += (p as any).tokens?.output || 0;
            totalCost += (p as any).cost || 0;
        }
        if (totalCost <= 0) return null;
        return { input: totalInput, output: totalOutput, cost: totalCost };
    }, [stepFinishParts]);

    // ── Intermediate step rendering ──────────────────────────────────
    if (isIntermediateStep) {
        return (
            <div className="message-bubble-intermediate">
                {renderGroupedParts(intermediateGrouped, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile)}
            </div>
        );
    }

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
            {isFirstInGroup && !isUser && (
                <div className="message-bubble-header">
                    <span className="message-bubble-role">
                        <svg className="message-bubble-role-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                        </svg>
                        Assistant
                    </span>
                    {timerShouldRun || elapsedSecs > 0 ? (
                        <span className="message-bubble-timestamp message-bubble-elapsed">{formatElapsed(elapsedSecs)}</span>
                    ) : (
                        !timerShouldRun && timestamp && <span className="message-bubble-timestamp">{timestamp}</span>
                    )}
                </div>
            )}
            <div className="message-bubble-content">
                {hasIntermediateParts ? (
                    <>
                        {groupedIntermediateParts.length > 0 && (
                            lastTextPartIndex >= 0 || isStreaming ? (
                                <TurnGroup isStreaming={isStreaming} durationSecs={0}>
                                    {renderGroupedParts(groupedIntermediateParts, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile)}
                                </TurnGroup>
                            ) : (
                                renderGroupedParts(groupedIntermediateParts, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile)
                            )
                        )}
                        {finalTextPartWithIndex && renderTextPart(finalTextPartWithIndex.part, finalTextPartWithIndex.index)}
                    </>
                ) : (
                    renderGroupedParts(groupedAllParts, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile)
                )}
                {retryInfo && <RetryBanner retryInfo={retryInfo} />}
                {isStreaming && <span className="message-streaming-cursor" aria-hidden="true">&#x258B;</span>}
                {(!isUser && !isStreaming && (parts.some(p => p.type === 'text') || costBarData)) && (
                    <div className="message-bubble-footer">
                        {costBarData && <CostBar costBarData={costBarData} />}
                        <CopyButton parts={parts} isUser={isUser} isStreaming={isStreaming} />
                    </div>
                )}
            </div>
        </article>
    );
};

// ─── Memoized export ────────────────────────────────────────────────────────

export const MessageBubble = React.memo(MessageBubbleInner, (prev, next) => {
    if (prev.isStreaming !== next.isStreaming) return false;
    if (next.isStreaming) return false;
    if (prev.message !== next.message) return false;
    if (prev.isUser !== next.isUser) return false;
    if (prev.isFirstInGroup !== next.isFirstInGroup) return false;
    if (prev.isLastInGroup !== next.isLastInGroup) return false;
    if (prev.openCodeService !== next.openCodeService) return false;
    if (prev.sessionService !== next.sessionService) return false;
    if (prev.pendingPermissions?.length !== next.pendingPermissions?.length) return false;
    if (prev.pendingPermissions && next.pendingPermissions) {
        for (let i = 0; i < prev.pendingPermissions.length; i++) {
            if (prev.pendingPermissions[i] !== next.pendingPermissions[i]) return false;
        }
    }
    if (prev.onReplyPermission !== next.onReplyPermission) return false;
    if (prev.retryInfo !== next.retryInfo) return false;
    if (prev.onOpenFile !== next.onOpenFile) return false;
    if (prev.isIntermediateStep !== next.isIntermediateStep) return false;
    return true;
});

export default MessageBubble;
