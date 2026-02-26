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
import type { OpenCodeService, MessageWithParts } from 'openspace-core/lib/common/opencode-protocol';
import type { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { getToolInfo, isFilePath } from './tool-constants';

const CHILD_SESSION_POLL_MS = 2000;

/** Task tool block — always expanded, fetches child session data, renders child tools inline. */
export const TaskToolBlock: React.FC<{
    part: any;
    openCodeService?: OpenCodeService;
    sessionService?: SessionService;
    onOpenFile?: (filePath: string) => void;
}> = ({ part, openCodeService, sessionService, onOpenFile }) => {
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';
    const isError = stateStr === 'error';

    const { icon: iconSvg, name: displayName, subtitle } = getToolInfo(part);

    const childSessionId: string | undefined =
        state?.metadata?.sessionId as string | undefined;

    const [childToolParts, setChildToolParts] = React.useState<any[]>([]);
    const [isInitialLoading, setIsInitialLoading] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const prevCountRef = React.useRef(0);
    const fetchInFlightRef = React.useRef(false);

    const fetchChildTools = React.useCallback(async () => {
        if (!childSessionId || !openCodeService) return;
        const projectId = sessionService?.activeProject?.id;
        if (!projectId) return;
        if (fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            const messagesWithParts: MessageWithParts[] = await openCodeService.getMessages(projectId, childSessionId);
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
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[TaskToolBlock] Error fetching child session:', err);
            }
        } finally {
            fetchInFlightRef.current = false;
        }
    }, [childSessionId, openCodeService, sessionService]);

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
            <div className="part-tool-header" style={{ cursor: 'default' }}>
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
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                                        {info.icon}
                                    </svg>
                                )}
                            </span>
                            <span className={childIsRunning ? 'part-task-tool-item-title oc-shimmer' : 'part-task-tool-item-title'}>
                                {info.name}
                            </span>
                            {info.subtitle && (
                                onOpenFile && isFilePath(info.subtitle) ? (
                                    <button
                                        type="button"
                                        className="part-task-tool-item-subtitle part-tool-file-link"
                                        onClick={e => { e.stopPropagation(); onOpenFile(info.subtitle); }}
                                        title={`Open ${info.subtitle}`}
                                    >
                                        {info.subtitle}
                                    </button>
                                ) : (
                                    <span className="part-task-tool-item-subtitle" title={info.subtitle}>
                                        {info.subtitle}
                                    </span>
                                )
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** TodoWrite tool block — always expanded checklist with completion count. */
export const TodoToolBlock: React.FC<{ part: any }> = ({ part }) => {
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';

    const metadata = state?.metadata;
    const input = typeof state === 'object' && state !== null && 'input' in state ? state.input : undefined;
    const todos: Array<{ content: string; status: string; priority?: string }> =
        (Array.isArray(metadata?.todos) ? metadata.todos :
         Array.isArray((input as any)?.todos) ? (input as any).todos : []);

    const completedCount = todos.filter(t => t.status === 'completed').length;
    const subtitle = todos.length > 0 ? `${completedCount}/${todos.length}` : '';

    const checklistIcon = <><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>;

    return (
        <div className="part-tool part-todo-tool" data-expanded="true" data-state={stateStr}>
            <div className="part-tool-header" style={{ cursor: 'default' }}>
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            {checklistIcon}
                        </svg>
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
