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
import { Message, MessagePart, OpenCodeService, MessageWithParts, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import type { SessionService } from 'openspace-core/lib/browser/session-service';
import { renderMarkdown } from './markdown-renderer';

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
    /** Whether this is the first message in a group from the same sender */
    isFirstInGroup?: boolean;
    /** Whether this is the last message in a group from the same sender */
    isLastInGroup?: boolean;
    /** OpenCode service — needed for fetching child session data (task tools) */
    openCodeService?: OpenCodeService;
    /** Session service — needed for active project ID (task tools) */
    sessionService?: SessionService;
    /** Pending permission requests — matched by callID to tool parts */
    pendingPermissions?: PermissionNotification[];
    /** Callback to reply to a permission request */
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
    /** Retry information for the current session (only shown on last assistant message) */
    retryInfo?: {
        message: string;
        attempt: number;
        next: number; // Unix timestamp (ms) of next retry
    };
}

// ─── Context tool names (grouped into "Gathered context" collapsible) ────────
const CONTEXT_TOOL_NAMES = /^(read|glob|grep|list|list_files|search|find|rg|ripgrep)$/i;

// Matches bash tool variants including Anthropic versioned names (e.g. bash_20250124)
const BASH_TOOL_NAMES = /^(bash|bash_\d+|execute|run_command|run|shell|cmd|terminal)$/i;

// Matches task/subagent tool names
const TASK_TOOL_NAMES = /^(task|Task)$/;

/**
 * Render a single message part based on its type.
 */
function renderPart(
    part: MessagePart,
    index: number,
    openCodeService?: OpenCodeService,
    sessionService?: SessionService,
    pendingPermissions?: PermissionNotification[],
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void
): React.ReactNode {
    switch (part.type) {
        case 'text':
            return renderTextPart(part, index);
        case 'tool':
            return renderToolPart(part, index, openCodeService, sessionService, pendingPermissions, onReplyPermission);
        case 'reasoning':
            return renderReasoningPart(part, index);
        case 'step-start':
        case 'step-finish':
            return null;
        case 'file':
            return renderFilePart(part, index);
        default:
            return renderFallbackPart(part, index);
    }
}

/** Render text part with markdown rendering. */
function renderTextPart(part: any, index: number): React.ReactNode {
    const text: string = part.text || '';
    if (!text) return null;
    return (
        <div key={`text-${index}`} className="part-text">
            {renderMarkdown(text)}
        </div>
    );
}

/** Map tool name → display info (icon SVG path, display name, subtitle extractor). */
function getToolInfo(part: any): { icon: string; name: string; subtitle: string } {
    const toolName: string = part.tool || 'tool';
    const state = part.state;
    const input = typeof state === 'object' && state !== null && 'input' in state ? state.input : undefined;

    // Icon SVG paths (24x24 viewBox, stroke-based)
    const icons: Record<string, string> = {
        console: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
        glasses: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-4 0"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.4-2-3-2"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
        task: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
        window: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
        mcp: '<circle cx="12" cy="12" r="3"/><path d="M12 3v6"/><path d="M12 15v6"/><path d="m3 12 6 0"/><path d="m15 12 6 0"/>',
    };

    let iconKey = 'mcp';
    let displayName = toolName;
    let subtitle = '';

    if (BASH_TOOL_NAMES.test(toolName)) {
        iconKey = 'console';
        displayName = 'Shell';
        const desc = typeof input === 'object' && input !== null ? (input as any).description : undefined;
        subtitle = desc || (typeof input === 'string' ? input : (typeof input === 'object' && input !== null ? (input as any).command || '' : ''));
    } else if (/^(read|Read)$/.test(toolName)) {
        iconKey = 'glasses';
        displayName = 'Read';
        subtitle = typeof input === 'object' && input !== null ? (input as any).filePath || (input as any).path || '' : '';
    } else if (/^(grep|Grep|glob|Glob|rg|ripgrep|search|find|list|list_files|ripgrep_search|ripgrep_advanced-search|ripgrep_count-matches|ripgrep_list-files)$/i.test(toolName)) {
        iconKey = 'search';
        displayName = toolName.charAt(0).toUpperCase() + toolName.slice(1).replace(/_/g, ' ');
        subtitle = typeof input === 'object' && input !== null ? (input as any).pattern || (input as any).query || '' : '';
    } else if (/^(edit|Edit|write|Write)$/.test(toolName)) {
        iconKey = 'code';
        displayName = toolName.charAt(0).toUpperCase() + toolName.slice(1);
        subtitle = typeof input === 'object' && input !== null ? (input as any).filePath || (input as any).path || '' : '';
    } else if (/^(task|Task)$/.test(toolName)) {
        iconKey = 'task';
        displayName = 'Task';
        subtitle = typeof input === 'object' && input !== null ? (input as any).description || '' : '';
    } else if (/^(webfetch|WebFetch|web_fetch)$/i.test(toolName)) {
        iconKey = 'window';
        displayName = 'Web Fetch';
        subtitle = typeof input === 'object' && input !== null ? (input as any).url || '' : '';
    } else if (/^(todowrite|TodoWrite|todo_write)$/i.test(toolName)) {
        iconKey = 'task';
        displayName = 'Todo';
    }

    const iconSvg = icons[iconKey] || icons.mcp;
    return { icon: iconSvg, name: displayName, subtitle };
}

/** Compute a simple line-based diff between old and new text. */
function computeSimpleDiff(oldText: string, newText: string): { lines: Array<{ type: 'add' | 'del' | 'ctx'; text: string }>; additions: number; deletions: number } {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const lines: Array<{ type: 'add' | 'del' | 'ctx'; text: string }> = [];
    let additions = 0;
    let deletions = 0;

    // Too large — show as full replacement
    if (oldLines.length + newLines.length > 2000) {
        for (const l of oldLines) { lines.push({ type: 'del', text: l }); deletions++; }
        for (const l of newLines) { lines.push({ type: 'add', text: l }); additions++; }
        return { lines, additions, deletions };
    }

    // Myers-like simple diff using LCS
    const lcs = computeLCS(oldLines, newLines);
    let oi = 0, ni = 0, li = 0;
    while (oi < oldLines.length || ni < newLines.length) {
        if (li < lcs.length && oi < oldLines.length && ni < newLines.length && oldLines[oi] === lcs[li] && newLines[ni] === lcs[li]) {
            lines.push({ type: 'ctx', text: oldLines[oi] });
            oi++; ni++; li++;
        } else if (li < lcs.length && ni < newLines.length && newLines[ni] === lcs[li]) {
            lines.push({ type: 'del', text: oldLines[oi] }); deletions++; oi++;
        } else if (li < lcs.length && oi < oldLines.length && oldLines[oi] === lcs[li]) {
            lines.push({ type: 'add', text: newLines[ni] }); additions++; ni++;
        } else if (oi < oldLines.length && (li >= lcs.length || oldLines[oi] !== lcs[li])) {
            lines.push({ type: 'del', text: oldLines[oi] }); deletions++; oi++;
        } else if (ni < newLines.length) {
            lines.push({ type: 'add', text: newLines[ni] }); additions++; ni++;
        }
    }
    return { lines, additions, deletions };
}

function computeLCS(a: string[], b: string[]): string[] {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; }
            else { dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]); }
        }
    }
    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) { result.unshift(a[i - 1]); i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) { i--; }
        else { j--; }
    }
    return result;
}

/** Collapsible tool card — matches OpenCode's BasicTool pattern. */
const ToolBlock: React.FC<{
    part: any;
    index?: number;
    pendingPermissions?: PermissionNotification[];
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
}> = ({ part, pendingPermissions, onReplyPermission }) => {
    const [expanded, setExpanded] = React.useState(false);
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';
    const isError = stateStr === 'error';
    const isBash = BASH_TOOL_NAMES.test(part.tool || '');

    const { icon: iconSvg, name: displayName, subtitle } = getToolInfo(part);

    // Extract input/output for expanded body
    const input = (typeof state === 'object' && state !== null && 'input' in state)
        ? (state as { input?: unknown }).input : undefined;
    const output = (typeof state === 'object' && state !== null && 'output' in state)
        ? state.output : (part.output ?? undefined);

    // Detect edit/write tools
    const isEdit = /^(edit|Edit)$/.test(part.tool || '');
    const isWrite = /^(write|Write)$/.test(part.tool || '');
    const isEditOrWrite = isEdit || isWrite;

    // For edit/write: extract file info and compute diff
    let editFileName = '';
    let editDirectory = '';
    let editFilePath = '';
    let diffResult: { lines: Array<{ type: 'add' | 'del' | 'ctx'; text: string }>; additions: number; deletions: number } | null = null;

    if (isEditOrWrite && typeof input === 'object' && input !== null) {
        editFilePath = (input as any).filePath || (input as any).path || '';
        const lastSlash = editFilePath.lastIndexOf('/');
        editFileName = lastSlash >= 0 ? editFilePath.slice(lastSlash + 1) : editFilePath;
        editDirectory = lastSlash >= 0 ? editFilePath.slice(0, lastSlash) : '';

        if (isEdit) {
            const oldStr = (input as any).oldString || '';
            const newStr = (input as any).newString || '';
            if (oldStr || newStr) {
                diffResult = computeSimpleDiff(oldStr, newStr);
            }
        } else if (isWrite) {
            const content = (input as any).content || '';
            if (content) {
                const contentLines = content.split('\n');
                diffResult = {
                    lines: contentLines.map((l: string) => ({ type: 'add' as const, text: l })),
                    additions: contentLines.length,
                    deletions: 0
                };
            }
        }
    }

    const hasBody = !!(input || output || diffResult);

    // Bash: show command + output in body
    const bashCmd: string = isBash ? (
        typeof input === 'string' ? input :
        (input && typeof input === 'object' ? ((input as any).command ?? '') : '')
    ) : '';
    const bashOutput: string = isBash ? (
        typeof output === 'string' ? output :
        (output ? JSON.stringify(output, null, 2) : '')
    ) : '';

    return (
        <div
            className={`part-tool ${isBash ? 'part-tool-bash' : ''}${isEditOrWrite ? ' part-tool-edit' : ''}`}
            data-expanded={expanded ? 'true' : 'false'}
            data-state={stateStr}
        >
            <div
                className="part-tool-header"
                onClick={() => !isRunning && (hasBody || isBash) && setExpanded(e => !e)}
                style={{ cursor: isRunning ? 'default' : ((hasBody || isBash) ? 'pointer' : 'default') }}
            >
                {/* Tool icon */}
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
                            dangerouslySetInnerHTML={{ __html: iconSvg }}
                        />
                    )}
                </span>

                {/* Tool name + subtitle (structured for edit/write, generic for others) */}
                <span className={isRunning ? 'part-tool-name oc-shimmer' : 'part-tool-name'}>
                    {displayName}
                </span>
                {isEditOrWrite && editFileName ? (
                    <>
                        <span className="part-tool-filename">{editFileName}</span>
                        {editDirectory && (
                            <span className="part-tool-directory" title={editFilePath}>{editDirectory}</span>
                        )}
                    </>
                ) : (
                    subtitle && (
                        <span className="part-tool-subtitle" title={subtitle}>
                            {subtitle}
                        </span>
                    )
                )}

                {/* Status indicators + diff badge + chevron */}
                <span className="part-tool-trailing">
                    {isEditOrWrite && diffResult && (diffResult.additions > 0 || diffResult.deletions > 0) && (
                        <span className="part-tool-diff-badge">
                            {diffResult.additions > 0 && <span className="diff-additions">+{diffResult.additions}</span>}
                            {diffResult.deletions > 0 && <span className="diff-deletions">-{diffResult.deletions}</span>}
                        </span>
                    )}
                    {isError && (
                        <svg className="part-tool-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    )}
                    {(hasBody || isBash) && !isRunning && (
                        <svg className="part-tool-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                            <path d="m9 18 6-6-6-6"/>
                        </svg>
                    )}
                </span>
            </div>

            {/* Expanded body */}
            {expanded && !isRunning && (
                <div className={isEditOrWrite && diffResult ? 'part-tool-body part-tool-diff-body' : 'part-tool-body'}>
                    {isEditOrWrite && diffResult ? (
                        <div className="part-tool-diff">
                            {diffResult.lines.map((line, idx) => (
                                <div key={idx} className={`diff-line diff-line-${line.type}`}>
                                    <span className="diff-line-indicator">
                                        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                                    </span>
                                    <span className="diff-line-text">{line.text || '\u00a0'}</span>
                                </div>
                            ))}
                        </div>
                    ) : isBash ? (
                        <>
                            {bashCmd && <pre className="part-tool-io part-tool-input">{bashCmd}</pre>}
                            {bashOutput && <pre className="part-tool-io part-tool-output">{bashOutput}</pre>}
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            )}

            {/* Inline permission prompt — matched by callID */}
            {(() => {
                if (!pendingPermissions || !onReplyPermission) return null;
                const callID = part.callID;
                if (!callID) return null;
                const matched = pendingPermissions.find(p => p.callID === callID);
                if (!matched) return null;
                const permId = matched.permissionId || '';
                return (
                    <div className="part-tool-permission-prompt">
                        <span className="part-tool-permission-message">
                            {matched.title || matched.permission?.message || 'Permission required'}
                        </span>
                        {matched.patterns && matched.patterns.length > 0 && (
                            <span className="part-tool-permission-patterns" title={matched.patterns.join(', ')}>
                                {matched.patterns.join(', ')}
                            </span>
                        )}
                        <span className="part-tool-permission-actions">
                            <button
                                type="button"
                                className="part-tool-permission-btn part-tool-permission-btn-deny"
                                onClick={() => onReplyPermission(permId, 'reject')}
                            >
                                Deny
                            </button>
                            <button
                                type="button"
                                className="part-tool-permission-btn part-tool-permission-btn-always"
                                onClick={() => onReplyPermission(permId, 'always')}
                            >
                                Allow Always
                            </button>
                            <button
                                type="button"
                                className="part-tool-permission-btn part-tool-permission-btn-once"
                                onClick={() => onReplyPermission(permId, 'once')}
                            >
                                Allow Once
                            </button>
                        </span>
                    </div>
                );
            })()}
        </div>
    );
};

/** Task tool block — always expanded, fetches child session data, renders child tools inline. */
const CHILD_SESSION_POLL_MS = 2000;

const TaskToolBlock: React.FC<{
    part: any;
    openCodeService?: OpenCodeService;
    sessionService?: SessionService;
}> = ({ part, openCodeService, sessionService }) => {
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';
    const isError = stateStr === 'error';

    const { icon: iconSvg, name: displayName, subtitle } = getToolInfo(part);

    // Extract child session ID from tool metadata
    const childSessionId: string | undefined =
        state?.metadata?.sessionId as string | undefined;

    const [childToolParts, setChildToolParts] = React.useState<any[]>([]);
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const prevCountRef = React.useRef(0);
    const fetchInFlightRef = React.useRef(false);

    // Read projectId at call time to avoid stale closure on sessionService
    const fetchChildTools = React.useCallback(async () => {
        if (!childSessionId || !openCodeService) return;
        const projectId = sessionService?.activeProject?.id;
        if (!projectId) return;
        if (fetchInFlightRef.current) return; // skip if previous fetch still running
        fetchInFlightRef.current = true;
        try {
            const messagesWithParts: MessageWithParts[] = await openCodeService.getMessages(projectId, childSessionId);
            // Collect all tool parts from assistant messages
            const toolParts: any[] = [];
            for (const mwp of messagesWithParts) {
                if (mwp.info.role !== 'assistant') continue;
                for (const p of mwp.parts) {
                    if (p.type === 'tool') {
                        toolParts.push(p);
                    }
                }
            }
            setChildToolParts(toolParts);
        } catch (err) {
            // Silently handle — child session may not exist yet
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[TaskToolBlock] Error fetching child session:', err);
            }
        } finally {
            fetchInFlightRef.current = false;
        }
    }, [childSessionId, openCodeService, sessionService]);

    // Initial fetch + polling while running
    React.useEffect(() => {
        if (!childSessionId) return;
        let cancelled = false;
        setIsInitialLoading(true);
        fetchChildTools().finally(() => {
            if (!cancelled) setIsInitialLoading(false);
        });

        if (!isRunning) return;

        const interval = setInterval(() => {
            fetchChildTools();
        }, CHILD_SESSION_POLL_MS);

        return () => { cancelled = true; clearInterval(interval); };
    }, [childSessionId, isRunning, fetchChildTools]);

    // Auto-scroll to bottom when new child tool parts appear
    React.useEffect(() => {
        if (childToolParts.length > prevCountRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        prevCountRef.current = childToolParts.length;
    }, [childToolParts.length]);

    return (
        <div
            className="part-tool part-task-tool"
            data-expanded="true"
            data-state={stateStr}
        >
            {/* Header — same as ToolBlock but no chevron, no click toggle */}
            <div className="part-tool-header" style={{ cursor: 'default' }}>
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
                            dangerouslySetInnerHTML={{ __html: iconSvg }}
                        />
                    )}
                </span>
                <span className={isRunning ? 'part-tool-name oc-shimmer' : 'part-tool-name'}>
                    {displayName}
                </span>
                {subtitle && (
                    <span className="part-tool-subtitle" title={subtitle}>
                        {subtitle}
                    </span>
                )}
                <span className="part-tool-trailing">
                    {isError && (
                        <svg className="part-tool-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    )}
                </span>
            </div>

            {/* Body — always visible, shows child tool parts */}
            <div className="part-tool-body part-task-tool-body" ref={scrollRef}>
                {isInitialLoading && childToolParts.length === 0 && (
                    <div className="part-task-tool-loading">
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        <span>Loading child session...</span>
                    </div>
                )}
                {childToolParts.length === 0 && !isInitialLoading && !childSessionId && !isRunning && (
                    <div className="part-task-tool-empty">No child session</div>
                )}
                {childToolParts.map((childPart, i) => {
                    const info = getToolInfo(childPart);
                    const childState = childPart.state;
                    const childStatus = typeof childState === 'string' ? childState :
                        (childState && typeof childState === 'object' ? (childState.status || 'completed') : 'completed');
                    const childIsRunning = childStatus === 'running' || childStatus === 'pending';
                    return (
                        <div key={childPart.id || `child-tool-${i}`} className="part-task-tool-item">
                            <span className="part-task-tool-item-icon" aria-hidden="true">
                                {childIsRunning ? (
                                    <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"
                                        dangerouslySetInnerHTML={{ __html: info.icon }}
                                    />
                                )}
                            </span>
                            <span className={childIsRunning ? 'part-task-tool-item-title oc-shimmer' : 'part-task-tool-item-title'}>
                                {info.name}
                            </span>
                            {info.subtitle && (
                                <span className="part-task-tool-item-subtitle" title={info.subtitle}>
                                    {info.subtitle}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** TodoWrite tool block — always expanded checklist with completion count. */
const TodoToolBlock: React.FC<{ part: any }> = ({ part }) => {
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';

    // Extract todos from metadata or input
    const metadata = state?.metadata;
    const input = typeof state === 'object' && state !== null && 'input' in state ? state.input : undefined;
    const todos: Array<{ content: string; status: string; priority?: string }> =
        (Array.isArray(metadata?.todos) ? metadata.todos :
         Array.isArray((input as any)?.todos) ? (input as any).todos : []);

    const completedCount = todos.filter(t => t.status === 'completed').length;
    const subtitle = todos.length > 0 ? `${completedCount}/${todos.length}` : '';

    // Checklist icon SVG
    const checklistIcon = '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>';

    return (
        <div className="part-tool part-todo-tool" data-expanded="true" data-state={stateStr}>
            <div className="part-tool-header" style={{ cursor: 'default' }}>
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
                            dangerouslySetInnerHTML={{ __html: checklistIcon }}
                        />
                    )}
                </span>
                <span className={isRunning ? 'part-tool-name oc-shimmer' : 'part-tool-name'}>
                    Todo
                </span>
                {subtitle && (
                    <span className="part-tool-subtitle">{subtitle}</span>
                )}
            </div>

            {todos.length > 0 && (
                <div className="part-todo-body">
                    {todos.map((todo, i) => (
                        <label key={i} className="part-todo-item" data-completed={todo.status === 'completed' ? 'true' : 'false'}>
                            <input
                                type="checkbox"
                                checked={todo.status === 'completed'}
                                readOnly
                                className="part-todo-checkbox"
                            />
                            <span className="part-todo-content">{todo.content}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Grouped context tools display — multiple read/grep/glob tools collapsed into one block. */
const ContextToolGroup: React.FC<{ parts: any[] }> = ({ parts }) => {
    const [expanded, setExpanded] = React.useState(false);
    const completedCount = parts.filter(p => {
        const s = p.state;
        const status = typeof s === 'string' ? s : (s && typeof s === 'object' ? (s.status || s.type || 'completed') : 'completed');
        return status === 'completed';
    }).length;
    const isAnyRunning = parts.some(p => {
        const s = p.state;
        const status = typeof s === 'string' ? s : (s && typeof s === 'object' ? (s.status || s.type || 'completed') : 'completed');
        return status === 'running' || status === 'pending';
    });

    return (
        <div className="part-tool part-context-group" data-expanded={expanded ? 'true' : 'false'}>
            <div
                className="part-tool-header"
                onClick={() => !isAnyRunning && setExpanded(e => !e)}
                style={{ cursor: isAnyRunning ? 'default' : 'pointer' }}
            >
                <span className="part-tool-icon" aria-hidden="true">
                    {isAnyRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M20 6 9 17l-5-5"/>
                        </svg>
                    )}
                </span>
                <span className={isAnyRunning ? 'part-tool-name oc-shimmer' : 'part-tool-name'}>
                    {isAnyRunning ? 'Gathering context...' : `Gathered context (${completedCount} tool${completedCount !== 1 ? 's' : ''})`}
                </span>
                {!isAnyRunning && (
                    <svg className="part-tool-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                )}
            </div>
            {expanded && !isAnyRunning && (
                <div className="part-tool-body">
                    {parts.map((p, i) => (
                        <div key={p.id || `ctx-${i}`} className="part-context-item">
                            <span className="part-context-item-name">{p.tool || 'tool'}</span>
                            {p.state?.input && (
                                <pre className="part-tool-io part-tool-input">
                                    {typeof p.state.input === 'string' ? p.state.input : JSON.stringify(p.state.input, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Render tool part — route to individual, task, or context group. */
function renderToolPart(
    part: any,
    index: number,
    openCodeService?: OpenCodeService,
    sessionService?: SessionService,
    pendingPermissions?: PermissionNotification[],
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void
): React.ReactNode {
    // TodoWrite tool → always-expanded checklist
    if (/^(todowrite|TodoWrite|todo_write)$/i.test(part.tool || '')) {
        return <TodoToolBlock key={part.id || `tool-${index}`} part={part} />;
    }
    // Task tool → always-expanded TaskToolBlock with child session rendering
    if (TASK_TOOL_NAMES.test(part.tool || '')) {
        return <TaskToolBlock key={part.id || `tool-${index}`} part={part} openCodeService={openCodeService} sessionService={sessionService} />;
    }
    // Individual rendering — grouping is done at the message level
    return <ToolBlock key={part.id || `tool-${index}`} part={part} index={index} pendingPermissions={pendingPermissions} onReplyPermission={onReplyPermission} />;
}

/** Collapsible reasoning block. Collapsed by default. Shows shimmer when no text yet. */
const ReasoningBlock: React.FC<{ part: any }> = ({ part }) => {
    const [expanded, setExpanded] = React.useState(false);
    const text: string = part.text || part.reasoning || '';
    const hasNoText = !text;
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
                <span className={hasNoText ? 'part-reasoning-label oc-shimmer' : 'part-reasoning-label'}>
                    {hasNoText ? 'Thinking...' : 'Thinking Process'}
                </span>
            </div>
            {text && (
                <div className="part-reasoning-body">{text}</div>
            )}
        </div>
    );
};

function renderReasoningPart(part: any, index: number): React.ReactNode {
    return <ReasoningBlock key={`reasoning-${index}`} part={part} />;
}

/** Render file part — pill with file icon. */
function renderFilePart(part: any, index: number): React.ReactNode {
    const filePath: string = part.filename || part.file || part.url || 'unknown';
    return (
        <div key={`file-${index}`} className="part-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>{filePath}</span>
        </div>
    );
}

/** Render fallback for unhandled part types. */
function renderFallbackPart(part: MessagePart, index: number): React.ReactNode {
    return (
        <span key={`other-${index}`} className="part-fallback">
            {part.type}
        </span>
    );
}

/** Retry banner — shows error message, countdown, and attempt number. */
const RetryBanner: React.FC<{ retryInfo: { message: string; attempt: number; next: number } }> = ({ retryInfo }) => {
    const [secondsLeft, setSecondsLeft] = React.useState(() =>
        Math.max(0, Math.round((retryInfo.next - Date.now()) / 1000))
    );

    React.useEffect(() => {
        const update = () => {
            setSecondsLeft(Math.max(0, Math.round((retryInfo.next - Date.now()) / 1000)));
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [retryInfo.next]);

    // Truncate error message to 60 chars
    const msg = retryInfo.message.length > 60
        ? retryInfo.message.slice(0, 60) + '...'
        : retryInfo.message;

    return (
        <div className="part-retry-banner">
            <span className="part-retry-message">{msg}</span>
            <span className="part-retry-countdown">
                · Retrying{secondsLeft > 0 ? ` in ${secondsLeft}s` : ''}
            </span>
            <span className="part-retry-attempt">(#{retryInfo.attempt})</span>
        </div>
    );
};

/**
 * Format elapsed time for display.
 * Uses server timestamps: message.time.completed - message.time.created
 * During streaming, uses current time as end.
 */
function formatElapsed(secs: number): string {
    if (secs < 60) {
        return `${secs}s`;
    }
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
}

function formatTimestamp(date: Date | string | number | undefined): string {
    if (!date) { return ''; }
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Group consecutive context tool parts into arrays for grouped rendering.
 * Non-context parts are returned individually.
 */
function groupParts(parts: MessagePart[]): Array<{ type: 'single'; part: MessagePart; index: number } | { type: 'context-group'; parts: MessagePart[] }> {
    const result: Array<{ type: 'single'; part: MessagePart; index: number } | { type: 'context-group'; parts: MessagePart[] }> = [];
    let contextBuffer: MessagePart[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isContextTool = part.type === 'tool' && CONTEXT_TOOL_NAMES.test((part as any).tool || '');

        if (isContextTool) {
            contextBuffer.push(part);
        } else {
            // Flush any accumulated context tools
            if (contextBuffer.length > 0) {
                if (contextBuffer.length === 1) {
                    // Single context tool — render normally
                    result.push({ type: 'single', part: contextBuffer[0], index: parts.indexOf(contextBuffer[0]) });
                } else {
                    result.push({ type: 'context-group', parts: [...contextBuffer] });
                }
                contextBuffer = [];
            }
            result.push({ type: 'single', part, index: i });
        }
    }

    // Flush remaining
    if (contextBuffer.length > 0) {
        if (contextBuffer.length === 1) {
            result.push({ type: 'single', part: contextBuffer[0], index: parts.indexOf(contextBuffer[0]) });
        } else {
            result.push({ type: 'context-group', parts: [...contextBuffer] });
        }
    }

    return result;
}

/**
 * MessageBubble - Individual message component with distinct user/assistant styling.
 * Renders all SDK Part types inline (text, tool, reasoning, file, etc.).
 * 
 * Design principles (following opencode web client):
 * - Single source of truth: text lives in message.parts only (no separate streamingData)
 * - All parts rendered inline, always (no "Show Steps" toggle)
 * - Context tools (read, glob, grep) grouped into "Gathered context" collapsible
 * - Timer uses server timestamps (message.time.created / .completed)
 * - Memoized to prevent unnecessary re-renders during streaming
 */
const MessageBubbleInner: React.FC<MessageBubbleProps> = ({
    message,
    isUser,
    isStreaming = false,
    isFirstInGroup = true,
    isLastInGroup = true,
    openCodeService,
    sessionService,
    pendingPermissions,
    onReplyPermission,
    retryInfo,
}) => {
    const parts = message.parts || [];
    const timestamp = message.time?.created ? formatTimestamp(message.time.created) : '';

    // ── Elapsed timer using server timestamps ─────────────────────────
    // Driven entirely by message timestamps, NOT the isStreaming prop.
    // If time.created exists but time.completed does NOT → timer runs.
    // This prevents flicker when streamingMessageId goes undefined between SSE events.
    const created = message.time?.created;
    const completed = (message.time as any)?.completed;
    const createdMs = created ? (typeof created === 'number' ? created : new Date(created).getTime()) : 0;
    const completedMs = completed ? (typeof completed === 'number' ? completed : new Date(completed).getTime()) : 0;
    const timerShouldRun = !isUser && !!createdMs && !completedMs;

    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        if (!timerShouldRun) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [timerShouldRun]);

    const elapsedSecs = React.useMemo(() => {
        if (!createdMs) return 0;
        if (completedMs) {
            // After completion — static value from server timestamps
            return Math.max(0, Math.floor((completedMs - createdMs) / 1000));
        }
        if (timerShouldRun) {
            // During streaming — live counter (driven by timestamps, not prop)
            return Math.max(0, Math.floor((now - createdMs) / 1000));
        }
        return 0;
    }, [createdMs, completedMs, timerShouldRun, now]);
    // ─────────────────────────────────────────────────────────────────

    // Group parts for context tool grouping only (no steps segmentation)
    const groupedParts = React.useMemo(() => groupParts(parts), [parts]);

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
            {/* Assistant header with elapsed timer */}
            {isFirstInGroup && !isUser && (
                <div className="message-bubble-header">
                    <span className="message-bubble-role">
                        <svg className="message-bubble-role-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                        </svg>
                        Assistant
                    </span>
                    {timerShouldRun || elapsedSecs > 0 ? (
                        <span className="message-bubble-timestamp message-bubble-elapsed">
                            {formatElapsed(elapsedSecs)}
                        </span>
                    ) : (
                        !timerShouldRun && timestamp && <span className="message-bubble-timestamp">{timestamp}</span>
                    )}
                </div>
            )}
            <div className="message-bubble-content">
                {groupedParts.map((group, gi) => {
                    if (group.type === 'context-group') {
                        return <ContextToolGroup key={`ctx-group-${gi}`} parts={group.parts} />;
                    }
                    return renderPart(group.part, group.index, openCodeService, sessionService, pendingPermissions, onReplyPermission);
                })}
                {/* Retry banner — shown when session is retrying */}
                {retryInfo && <RetryBanner retryInfo={retryInfo} />}
                {/* Streaming cursor */}
                {isStreaming && <span className="message-streaming-cursor" aria-hidden="true">&#x258B;</span>}
            </div>
        </article>
    );
};

/**
 * Memoized MessageBubble — only re-renders when props actually change.
 * During streaming, only the actively streaming message re-renders on each tick.
 */
export const MessageBubble = React.memo(MessageBubbleInner, (prev, next) => {
    // Always re-render if streaming state changes
    if (prev.isStreaming !== next.isStreaming) return false;
    // Always re-render the streaming message (parts are mutating)
    if (next.isStreaming) return false;
    // For non-streaming messages, check if anything meaningful changed
    if (prev.message !== next.message) return false;
    if (prev.isUser !== next.isUser) return false;
    if (prev.isFirstInGroup !== next.isFirstInGroup) return false;
    if (prev.isLastInGroup !== next.isLastInGroup) return false;
    // Service references are DI singletons and rarely change, but check for correctness
    if (prev.openCodeService !== next.openCodeService) return false;
    if (prev.sessionService !== next.sessionService) return false;
    // Re-render when pending permissions change (inline permission prompts)
    // Shallow comparison: same length + same items by reference avoids needless re-renders
    // when the array is a new reference but contents haven't changed.
    if (prev.pendingPermissions?.length !== next.pendingPermissions?.length) return false;
    if (prev.pendingPermissions && next.pendingPermissions) {
        for (let i = 0; i < prev.pendingPermissions.length; i++) {
            if (prev.pendingPermissions[i] !== next.pendingPermissions[i]) return false;
        }
    }
    if (prev.onReplyPermission !== next.onReplyPermission) return false;
    // Re-render when retry info changes
    if (prev.retryInfo !== next.retryInfo) return false;
    // No changes — skip re-render
    return true;
});

export default MessageBubble;
