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
import { SessionService, sessionDisplayTitle } from 'openspace-core/lib/browser/session-service/session-service';
import { Session, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import { OPENSPACE_RENAME_SESSION_EVENT } from '../chat-view-contribution';
import { ModelSelector } from '../model-selector';

export interface ChatHeaderBarProps {
    showSessionList: boolean;
    sessions: Session[];
    activeSession: Session | undefined;
    sessionService: SessionService;
    isLoadingSessions: boolean;
    sessionLoadError: string | undefined;
    isStreaming: boolean;
    pendingPermissions: PermissionNotification[];
    onLoadSessions: () => void;
    onSessionSwitch: (sessionId: string) => void;
    onNewSession: () => void;
    onDeleteSession: () => void;
    onForkSession: () => void;
    onRevertSession: () => void;
    onCompactSession: () => void;
    onShareSession: () => void;
    onUnshareSession: () => void;
    onRenameSession: (title: string) => Promise<void>;
    onNavigateToParent: (parentId: string) => void;
    onToggleDropdown: () => void;
    enabledModels: string[];
    onManageModels: () => void;
}

export const ChatHeaderBar: React.FC<ChatHeaderBarProps> = ({
    showSessionList,
    sessions,
    activeSession,
    sessionService,
    isLoadingSessions,
    sessionLoadError,
    isStreaming,
    pendingPermissions,
    onLoadSessions,
    onSessionSwitch,
    onNewSession,
    onDeleteSession,
    onForkSession,
    onRevertSession,
    onCompactSession,
    onShareSession,
    onUnshareSession,
    onRenameSession,
    onNavigateToParent,
    onToggleDropdown,
    enabledModels,
    onManageModels
}) => {
    const [showMenu, setShowMenu] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [copyFeedback, setCopyFeedback] = React.useState(false);
    const [titleEdit, setTitleEdit] = React.useState<{ draft: string; editing: boolean; saving: boolean }>({
        draft: '',
        editing: false,
        saving: false
    });
    const titleInputRef = React.useRef<HTMLInputElement>(null);

    const startTitleEdit = React.useCallback(() => {
        if (!activeSession) { return; }
        setTitleEdit({ draft: activeSession.title ?? '', editing: true, saving: false });
        requestAnimationFrame(() => titleInputRef.current?.select());
    }, [activeSession]);

    const saveTitleEdit = React.useCallback(async () => {
        const draft = titleEdit.draft.trim();
        if (!draft || !activeSession) {
            setTitleEdit(t => ({ ...t, editing: false, saving: false }));
            return;
        }
        setTitleEdit(t => ({ ...t, saving: true }));
        try {
            await onRenameSession(draft);
        } finally {
            setTitleEdit({ draft: '', editing: false, saving: false });
        }
    }, [titleEdit.draft, activeSession, onRenameSession]);

    const cancelTitleEdit = React.useCallback(() => {
        setTitleEdit({ draft: '', editing: false, saving: false });
    }, []);

    React.useEffect(() => {
        if (!showMenu) return;
        const handleOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [showMenu]);

    // Listen for the keyboard-shortcut rename event (Mod+Shift+N) dispatched by ChatCommandContribution
    React.useEffect(() => {
        const handler = () => { if (activeSession) { startTitleEdit(); } };
        document.addEventListener(OPENSPACE_RENAME_SESSION_EVENT, handler);
        return () => document.removeEventListener(OPENSPACE_RENAME_SESSION_EVENT, handler);
    }, [activeSession, startTitleEdit]);

    return (
        <div className="chat-header-bar session-header">
            {/* Session title — clicking opens dropdown; double-click edits inline */}
            <div className="session-selector">
                {/* Back button for forked sessions */}
                {(activeSession as unknown as { parentID?: string } | undefined)?.parentID && (
                    <button
                        type="button"
                        className="oc-icon-btn back-to-parent"
                        onClick={() => onNavigateToParent((activeSession as unknown as { parentID: string }).parentID)}
                        title="Go to parent session"
                        aria-label="Go to parent session"
                    >
                        ←
                    </button>
                )}
                {titleEdit.editing ? (
                    <input
                        ref={titleInputRef}
                        type="text"
                        className="session-title-input"
                        value={titleEdit.draft}
                        disabled={titleEdit.saving}
                        onChange={e => setTitleEdit(t => ({ ...t, draft: e.target.value }))}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); saveTitleEdit(); }
                            if (e.key === 'Escape') { e.preventDefault(); cancelTitleEdit(); }
                        }}
                        onBlur={saveTitleEdit}
                        aria-label="Session title"
                    />
                ) : (
                    <button
                        type="button"
                         className={`chat-header-title oc-icon-btn session-dropdown-button ${activeSession ? '' : 'no-session'}`}
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 6px', borderRadius: 3, textAlign: 'left' }}
                        onClick={onToggleDropdown}
                        onDoubleClick={startTitleEdit}
                        data-test-sessions-count={sessions.length}
                        aria-haspopup="listbox"
                        aria-expanded={showSessionList}
                        title={activeSession ? sessionDisplayTitle(activeSession) : 'No Session'}
                    >
                        {activeSession ? sessionDisplayTitle(activeSession) : 'No Session'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10" style={{ marginLeft: 4, flexShrink: 0, opacity: 0.5 }} aria-hidden="true">
                            <path d="m6 9 6 6 6-6"/>
                        </svg>
                    </button>
                )}
                {/* P2-E: Session summary diff badge */}
                {(() => {
                    const summary = (activeSession as unknown as { summary?: { additions: number; deletions: number; files: number } } | undefined)?.summary;
                    if (!summary) return null;
                    return (
                        <span className="session-summary-badge" title={`${summary.files} file(s) changed`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                            <span style={{ color: '#4caf50' }}>+{summary.additions}</span>
                            <span style={{ color: '#f44336' }}>-{summary.deletions}</span>
                        </span>
                    );
                })()}

                {showSessionList && (
                    <div className="session-list-dropdown" role="listbox" aria-label="Session list">
                        {!sessionService.activeProject && (
                            <div style={{ padding: '8px 12px', fontSize: 12, color: '#858585' }}>
                                No project selected
                            </div>
                        )}
                        {sessionService.activeProject && isLoadingSessions && (
                            <div className="session-list-loading" style={{ padding: '8px 12px', fontSize: 12, color: '#858585', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                                Loading...
                            </div>
                        )}
                        {sessionService.activeProject && sessionLoadError && (
                            <div style={{ padding: '8px 12px', fontSize: 12, color: '#f14c4c' }}>
                                {sessionLoadError}
                                <button type="button" className="retry-button" onClick={onLoadSessions} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#007acc', cursor: 'pointer', fontSize: 12 }}>Retry</button>
                            </div>
                        )}
                        {sessionService.activeProject && !isLoadingSessions && !sessionLoadError && sessions.length === 0 && (
                            <div style={{ padding: '8px 12px', fontSize: 12, color: '#858585' }}>No sessions yet.</div>
                        )}
                        {sessionService.activeProject && !isLoadingSessions && !sessionLoadError && sessions.map(session => {
                            const isActive = session.id === activeSession?.id;
                            // Status indicator: spinner if active+streaming, yellow dot if active+permissions, red dot if error, dash otherwise
                            let statusIndicator: React.ReactNode;
                            if (isActive && isStreaming) {
                                statusIndicator = (
                                    <svg className="session-status-spinner oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-label="Working">
                                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                    </svg>
                                );
                            } else if (isActive && pendingPermissions.length > 0) {
                                statusIndicator = <span className="session-status-dot permissions" aria-label="Permissions pending" />;
                            } else if (sessionService.getSessionError(session.id)) {
                                statusIndicator = <span className="session-status-dot error" aria-label="Session error" />;
                            } else {
                                statusIndicator = <span className="session-status-dash" aria-label="Idle" />;
                            }
                            return (
                                <div
                                    key={session.id}
                                    className={`session-list-item ${isActive ? 'active' : ''}`}
                                    onClick={() => onSessionSwitch(session.id)}
                                    role="option"
                                    tabIndex={0}
                                    aria-selected={isActive}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { onSessionSwitch(session.id); } }}
                                >
                                    <span className="session-status-indicator">{statusIndicator}</span>
                                    <span className="session-list-item-title">{sessionDisplayTitle(session)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Model selector pill */}
            <ModelSelector sessionService={sessionService} enabledModels={enabledModels} onManageModels={onManageModels} />

            {/* New session */}
            <button
                type="button"
                className="oc-icon-btn new-session-button"
                onClick={onNewSession}
                title="New session"
                aria-label="New session"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>

            {/* Delete session — only visible when a session is active */}
            {activeSession && (
                <button
                    type="button"
                    className="oc-icon-btn delete-session-button"
                    onClick={onDeleteSession}
                    title="Delete session"
                    aria-label="Delete session"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                </button>
            )}

            {/* More actions (…) button with dropdown */}
            <div style={{ position: 'relative' }} ref={menuRef}>
                <button
                    type="button"
                    className="oc-icon-btn"
                    onClick={() => setShowMenu(m => !m)}
                    title="More actions"
                    aria-label="More actions"
                    aria-haspopup="true"
                    aria-expanded={showMenu}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                    </svg>
                </button>
                {showMenu && (
                    <div className="chat-header-menu" role="menu">
                        <button
                            type="button"
                            className="chat-header-menu-item rename-session-button"
                            data-testid="rename-session-button"
                            role="menuitem"
                            disabled={!activeSession}
                            onClick={() => { setShowMenu(false); startTitleEdit(); }}
                        >
                            Rename session
                        </button>
                        <button
                            type="button"
                            className="chat-header-menu-item fork-session-button"
                            data-testid="fork-session-button"
                            role="menuitem"
                            disabled={!activeSession}
                            onClick={() => { setShowMenu(false); onForkSession(); }}
                        >
                            Fork session
                        </button>
                        <button
                            type="button"
                            className="chat-header-menu-item revert-session-button"
                            data-testid="revert-session-button"
                            role="menuitem"
                            disabled={!activeSession}
                            onClick={() => { setShowMenu(false); onRevertSession(); }}
                        >
                            {(activeSession as unknown as { revert?: unknown } | undefined)?.revert ? 'Unrevert session' : 'Revert session'}
                        </button>
                        <button
                            type="button"
                            className="chat-header-menu-item compact-session-button"
                            data-testid="compact-session-button"
                            role="menuitem"
                            disabled={!activeSession}
                            onClick={() => { setShowMenu(false); onCompactSession(); }}
                        >
                            Compact session
                        </button>
                        {activeSession && !(activeSession as unknown as { share?: { url: string } }).share?.url && (
                            <button
                                type="button"
                                className="chat-header-menu-item share-session-button"
                                data-testid="share-session-button"
                                role="menuitem"
                                onClick={() => { setShowMenu(false); onShareSession(); }}
                            >
                                Share session
                            </button>
                        )}
                        {activeSession && (activeSession as unknown as { share?: { url: string } }).share?.url && (
                            <>
                                <button
                                    type="button"
                                    className="chat-header-menu-item copy-share-url-button"
                                    data-testid="copy-share-url-button"
                                    role="menuitem"
                                    onClick={() => {
                                        const url = (activeSession as unknown as { share: { url: string } }).share.url;
                                        navigator.clipboard.writeText(url).then(() => {
                                            setCopyFeedback(true);
                                            setTimeout(() => setCopyFeedback(false), 2000);
                                        }).catch(() => undefined);
                                        setShowMenu(false);
                                    }}
                                >
                                    {copyFeedback ? 'Copied!' : 'Copy share URL'}
                                </button>
                                <button
                                    type="button"
                                    className="chat-header-menu-item unshare-session-button"
                                    data-testid="unshare-session-button"
                                    role="menuitem"
                                    onClick={() => { setShowMenu(false); onUnshareSession(); }}
                                >
                                    Unshare session
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            className="chat-header-menu-item"
                            role="menuitem"
                            disabled={!activeSession}
                            onClick={() => { setShowMenu(false); onDeleteSession(); }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                            Delete session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
