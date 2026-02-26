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
import { MessageService } from '@theia/core/lib/common/message-service';
import { OpenerService, open as openWithOpener } from '@theia/core/lib/browser';
import { URI } from '@theia/core/lib/common/uri';
import { SessionService, sessionDisplayTitle } from 'openspace-core/lib/browser/session-service/session-service';
import { Session } from 'openspace-core/lib/common/opencode-protocol';

export interface SessionActions {
    loadSessions: () => Promise<void>;
    sessions: Session[];
    isLoadingSessions: boolean;
    sessionLoadError: string | undefined;
    showSessionList: boolean;
    setShowSessionList: (v: boolean) => void;
    handleNewSession: () => Promise<void>;
    handleSessionSwitch: (sessionId: string) => Promise<void>;
    handleDeleteSession: () => Promise<void>;
    handleForkSession: () => Promise<void>;
    handleRenameSession: (title: string) => Promise<void>;
    handleNavigateToParent: (parentId: string) => Promise<void>;
    handleRevertSession: () => Promise<void>;
    handleCompactSession: () => Promise<void>;
    handleShareSession: () => Promise<void>;
    handleUnshareSession: () => Promise<void>;
    handleReplyPermission: (requestId: string, reply: 'once' | 'always' | 'reject') => Promise<void>;
    handleOpenFile: (filePath: string) => void;
    handleToggleDropdown: () => void;
}

/**
 * Session CRUD actions and session list state.
 */
export function useSessionActions(
    sessionService: SessionService,
    messageService: MessageService,
    openerService: OpenerService,
    workspaceRoot: string,
): SessionActions {
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [showSessionList, setShowSessionList] = React.useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
    const [sessionLoadError, setSessionLoadError] = React.useState<string | undefined>();

    const loadSessions = React.useCallback(async () => {
        setIsLoadingSessions(true);
        setSessionLoadError(undefined);
        const startTime = Date.now();
        try {
            const result = await sessionService.getSessions();
            setSessions(result);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error loading sessions:', error);
            }
            setSessionLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            const elapsed = Date.now() - startTime;
            const delay = Math.max(0, 100 - elapsed);
            setTimeout(() => setIsLoadingSessions(false), delay);
        }
    }, [sessionService]);

    // Close dropdown on outside click
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.session-selector')) {
                setShowSessionList(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleNewSession = React.useCallback(async () => {
        try {
            const title = `Session ${new Date().toLocaleString()}`;
            await sessionService.createSession(title);
            await loadSessions();
            setShowSessionList(false);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error creating session:', error);
            }
            messageService.error(`Failed to create session: ${error}`);
        }
    }, [sessionService, loadSessions, messageService]);

    const handleSessionSwitch = React.useCallback(async (sessionId: string) => {
        try {
            await sessionService.setActiveSession(sessionId);
            setShowSessionList(false);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error switching session:', error);
            }
            messageService.error(`Failed to switch session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleDeleteSession = React.useCallback(async () => {
        const activeSession = sessionService.activeSession;
        if (!activeSession) return;

        const countDescendants = (parentId: string): number => {
            const children = sessions.filter(s => (s as unknown as { parentID?: string }).parentID === parentId);
            return children.length + children.reduce((acc, c) => acc + countDescendants(c.id), 0);
        };
        const childCount = countDescendants(activeSession.id);
        const confirmMsg = childCount > 0
            ? `Delete session "${sessionDisplayTitle(activeSession)}" and ${childCount} child session${childCount === 1 ? '' : 's'}?`
            : `Delete session "${sessionDisplayTitle(activeSession)}"?`;

        const action = await messageService.warn(confirmMsg, 'Delete', 'Cancel');
        if (action !== 'Delete') return;

        try {
            await sessionService.deleteSession(activeSession.id);
            await loadSessions();
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error deleting session:', error);
            }
            messageService.error(`Failed to delete session: ${error}`);
        }
    }, [sessionService, loadSessions, messageService, sessions]);

    const handleForkSession = React.useCallback(async () => {
        try {
            await sessionService.forkSession();
        } catch (error) {
            messageService.error(`Failed to fork session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleRenameSession = React.useCallback(async (title: string) => {
        const active = sessionService.activeSession;
        if (!active) { return; }
        try {
            await sessionService.renameSession(active.id, title);
        } catch (error) {
            messageService.error(`Failed to rename session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleNavigateToParent = React.useCallback(async (parentId: string) => {
        try {
            await sessionService.setActiveSession(parentId);
        } catch (error) {
            messageService.error(`Failed to navigate to parent session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleRevertSession = React.useCallback(async () => {
        try {
            const active = sessionService.activeSession;
            if (!active) { return; }
            if ((active as unknown as { revert?: unknown }).revert) {
                await sessionService.unrevertSession();
            } else {
                await sessionService.revertSession();
            }
        } catch (error) {
            messageService.error(`Failed to revert session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleCompactSession = React.useCallback(async () => {
        try {
            await sessionService.compactSession();
        } catch (error) {
            messageService.error(`Failed to compact session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleShareSession = React.useCallback(async () => {
        const active = sessionService.activeSession;
        if (!active) { return; }
        try {
            const updated = await sessionService.shareSession(active.id);
            const shareUrl = (updated as unknown as { share?: { url: string } }).share?.url;
            if (shareUrl) {
                navigator.clipboard.writeText(shareUrl).catch(() => undefined);
                messageService.info('Session shared — URL copied to clipboard');
            }
        } catch (error) {
            messageService.error(`Failed to share session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleUnshareSession = React.useCallback(async () => {
        const active = sessionService.activeSession;
        if (!active) { return; }
        try {
            await sessionService.unshareSession(active.id);
            messageService.info('Session unshared');
        } catch (error) {
            messageService.error(`Failed to unshare session: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleReplyPermission = React.useCallback(async (requestId: string, reply: 'once' | 'always' | 'reject') => {
        try {
            await sessionService.replyPermission(requestId, reply);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error replying to permission:', error);
            }
            messageService.error(`Failed to reply to permission: ${error}`);
        }
    }, [sessionService, messageService]);

    const handleOpenFile = React.useCallback((filePath: string) => {
        try {
            let resolvedPath = filePath;
            if (workspaceRoot) {
                if (filePath.startsWith('/')) {
                    resolvedPath = workspaceRoot + filePath;
                } else if (/^[A-Za-z]:[/\\]/.test(filePath)) {
                    resolvedPath = filePath;
                } else {
                    resolvedPath = workspaceRoot + '/' + filePath;
                }
            }
            const uri = new URI(resolvedPath);
            openWithOpener(openerService, uri);
        } catch (e) {
            console.error('[ChatWidget] Failed to open file:', filePath, e);
            messageService.warn(`Could not open file: ${filePath}`);
        }
    }, [workspaceRoot, openerService, messageService]);

    const handleToggleDropdown = React.useCallback(() => {
        setShowSessionList(prev => !prev);
    }, []);

    return {
        loadSessions,
        sessions,
        isLoadingSessions,
        sessionLoadError,
        showSessionList,
        setShowSessionList,
        handleNewSession,
        handleSessionSwitch,
        handleDeleteSession,
        handleForkSession,
        handleRenameSession,
        handleNavigateToParent,
        handleRevertSession,
        handleCompactSession,
        handleShareSession,
        handleUnshareSession,
        handleReplyPermission,
        handleOpenFile,
        handleToggleDropdown,
    };
}
