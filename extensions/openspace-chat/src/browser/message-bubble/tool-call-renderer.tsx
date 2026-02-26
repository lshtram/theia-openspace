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
import type { OpenCodeService, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import type { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { computeSimpleDiff, computeSplitDiff } from '../diff-utils';
import { TaskToolBlock, TodoToolBlock } from './task-tool-block';
import {
    BASH_TOOL_NAMES, TASK_TOOL_NAMES, EDIT_TOOL_NAMES, WRITE_TOOL_NAMES,
    isFilePath, getToolInfo,
} from './tool-constants';

// Re-export CONTEXT_TOOL_NAMES for use by the facade's groupParts function
export { CONTEXT_TOOL_NAMES } from './tool-constants';

/** Collapsible tool card — matches OpenCode's BasicTool pattern. */
export const ToolBlock: React.FC<{
    part: any;
    index?: number;
    pendingPermissions?: PermissionNotification[];
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
    onOpenFile?: (filePath: string) => void;
}> = ({ part, pendingPermissions, onReplyPermission, onOpenFile }) => {
    const [expanded, setExpanded] = React.useState(false);
    const [diffMode, setDiffMode] = React.useState<'unified' | 'split'>('unified');
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';
    const isError = stateStr === 'error';
    const isBash = BASH_TOOL_NAMES.test(part.tool || '');

    const { icon: iconSvg, name: displayName, subtitle } = getToolInfo(part);

    const input = (typeof state === 'object' && state !== null && 'input' in state)
        ? (state as { input?: unknown }).input : undefined;
    const output = (typeof state === 'object' && state !== null && 'output' in state)
        ? state.output : (part.output ?? undefined);

    const isEdit = EDIT_TOOL_NAMES.test(part.tool || '');
    const isWrite = WRITE_TOOL_NAMES.test(part.tool || '');
    const isEditOrWrite = isEdit || isWrite;

    let editFileName = '';
    let editDirectory = '';
    let editFilePath = '';

    if (isEditOrWrite && typeof input === 'object' && input !== null) {
        editFilePath = (input as any).filePath || (input as any).path || '';
        const lastSlash = editFilePath.lastIndexOf('/');
        editFileName = lastSlash >= 0 ? editFilePath.slice(lastSlash + 1) : editFilePath;
        editDirectory = lastSlash >= 0 ? editFilePath.slice(0, lastSlash) : '';
    }

    const diffResult = React.useMemo(() => {
        if (!isEditOrWrite || typeof input !== 'object' || input === null) {
            if (WRITE_TOOL_NAMES.test(part.tool || '') && typeof output === 'string') {
                try {
                    const parsed = JSON.parse(output);
                    if (parsed && typeof parsed.old === 'string' && typeof parsed.new === 'string') {
                        return computeSimpleDiff(parsed.old, parsed.new);
                    }
                } catch { /* not JSON */ }
            }
            return null;
        }
        if (isEdit) {
            const oldStr = (input as any).oldString || '';
            const newStr = (input as any).newString || '';
            if (oldStr || newStr) {
                return computeSimpleDiff(oldStr, newStr);
            }
        } else if (isWrite) {
            if (typeof output === 'string') {
                try {
                    const parsed = JSON.parse(output);
                    if (parsed && typeof parsed.old === 'string' && typeof parsed.new === 'string') {
                        return computeSimpleDiff(parsed.old, parsed.new);
                    }
                } catch { /* not JSON */ }
            }
            const content = (input as any).content || '';
            if (content) {
                const contentLines = content.split('\n');
                return {
                    lines: contentLines.map((l: string) => ({ type: 'add' as const, text: l })),
                    additions: contentLines.length,
                    deletions: 0
                };
            }
        }
        return null;
    }, [isEditOrWrite, isEdit, isWrite, input, output, part.tool]);

    const hasBody = !!(input || output || diffResult);

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
                className="part-tool-header tool-block-header"
                onClick={() => !isRunning && (hasBody || isBash) && setExpanded(e => !e)}
                style={{ cursor: isRunning ? 'default' : ((hasBody || isBash) ? 'pointer' : 'default') }}
            >
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            {iconSvg}
                        </svg>
                    )}
                </span>
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
                        onOpenFile && isFilePath(subtitle) ? (
                            <button
                                type="button"
                                className="part-tool-subtitle part-tool-file-link"
                                onClick={e => { e.stopPropagation(); onOpenFile(subtitle); }}
                                title={`Open ${subtitle}`}
                            >
                                {subtitle}
                            </button>
                        ) : (
                            <span className="part-tool-subtitle" title={subtitle}>
                                {subtitle}
                            </span>
                        )
                    )
                )}
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

            {expanded && !isRunning && (
                <div className={isEditOrWrite && diffResult ? 'part-tool-body part-tool-diff-body' : 'part-tool-body'}>
                    {isEditOrWrite && diffResult ? (
                        <>
                            <button
                                type="button"
                                className="diff-style-toggle"
                                onClick={() => setDiffMode(m => m === 'unified' ? 'split' : 'unified')}
                            >
                                {diffMode === 'unified' ? 'Split' : 'Unified'}
                            </button>
                            {diffMode === 'unified' ? (
                                <div className="diff-view--unified part-tool-diff">
                                    {diffResult.lines.map((line: { type: 'add' | 'del' | 'ctx'; text: string }, idx: number) => (
                                        <div key={idx} className={`diff-line diff-line-${line.type}`}>
                                            <span className="diff-line-indicator">
                                                {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                                            </span>
                                            <span className="diff-line-text">{line.text || '\u00a0'}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="diff-view--split part-tool-diff">
                                    {computeSplitDiff(
                                        (() => {
                                            if (isEdit) return (input as any)?.oldString || '';
                                            if (typeof output === 'string') { try { const p = JSON.parse(output); if (p?.old) return p.old; } catch {} }
                                            return '';
                                        })(),
                                        (() => {
                                            if (isEdit) return (input as any)?.newString || '';
                                            if (typeof output === 'string') { try { const p = JSON.parse(output); if (p?.new) return p.new; } catch {} }
                                            return (input as any)?.content || '';
                                        })()
                                    ).map((row: any, idx: number) => (
                                        <div key={idx} className="diff-split-row">
                                            <div className={`diff-split-cell diff-split-left${row.left ? ` diff-line-${row.left.type}` : ''}`}>
                                                {row.left && <><span className="diff-line-no">{row.left.lineNo}</span><span className="diff-line-text">{row.left.text || '\u00a0'}</span></>}
                                            </div>
                                            <div className={`diff-split-cell diff-split-right${row.right ? ` diff-line-${row.right.type}` : ''}`}>
                                                {row.right && <><span className="diff-line-no">{row.right.lineNo}</span><span className="diff-line-text">{row.right.text || '\u00a0'}</span></>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
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

/** Grouped context tools display — multiple read/grep/glob tools collapsed into one block. */
export const ContextToolGroup: React.FC<{ parts: any[] }> = ({ parts }) => {
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
export function renderToolPart(
    part: any,
    index: number,
    openCodeService?: OpenCodeService,
    sessionService?: SessionService,
    pendingPermissions?: PermissionNotification[],
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void,
    onOpenFile?: (filePath: string) => void
): React.ReactNode {
    if (/^(todowrite|TodoWrite|todo_write)$/i.test(part.tool || '')) {
        return <TodoToolBlock key={part.id || `tool-${index}`} part={part} />;
    }
    if (TASK_TOOL_NAMES.test(part.tool || '')) {
        return <TaskToolBlock key={part.id || `tool-${index}`} part={part} openCodeService={openCodeService} sessionService={sessionService} onOpenFile={onOpenFile} />;
    }
    return <ToolBlock key={part.id || `tool-${index}`} part={part} index={index} pendingPermissions={pendingPermissions} onReplyPermission={onReplyPermission} onOpenFile={onOpenFile} />;
}
