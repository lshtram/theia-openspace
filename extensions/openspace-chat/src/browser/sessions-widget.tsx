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
import * as ReactDOM from '@theia/core/shared/react-dom';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { MessageService } from '@theia/core/lib/common/message-service';
import { SessionService } from 'openspace-core/lib/browser/session-service';
import { Session } from 'openspace-core/lib/common/opencode-protocol';

interface ExtendedSession extends Session {
    parentID?: string;
    time: Session['time'] & { archived?: number };
}
import { SessionNotificationService } from 'openspace-core/lib/browser/notification-service';
import { SessionHoverPreview } from './session-hover-preview';

/** Formats a timestamp as a relative time string (e.g. "2h ago"). */
function relativeTime(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 60_000) { return 'now'; }
    if (diff < 3_600_000) { return `${Math.floor(diff / 60_000)}m`; }
    if (diff < 86_400_000) { return `${Math.floor(diff / 3_600_000)}h`; }
    return `${Math.floor(diff / 86_400_000)}d`;
}

/** Shimmer skeleton shown while sessions are loading. */
function SessionSkeleton(): React.ReactElement {
    return (
        <div className="sessions-skeleton" aria-busy="true" aria-label="Loading sessions">
            {[80, 60, 75, 50].map((w, i) => (
                <div key={i} className="session-skeleton-item" style={{ width: `${w}%` }} />
            ))}
        </div>
    );
}

interface SessionsViewProps {
    sessionService: SessionService;
    messageService: MessageService;
    notificationService: SessionNotificationService;
}

const SessionsView: React.FC<SessionsViewProps> = ({ sessionService, messageService, notificationService }) => {
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showArchived, setShowArchived] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | undefined>(undefined);
    const [editDraft, setEditDraft] = React.useState('');
    const [isSavingTitle, setIsSavingTitle] = React.useState(false);
    const [unseenRevision, setUnseenRevision] = React.useState(0);
    /** Hover preview state: sessionId being hovered, and the DOM rect for positioning */
    const [hoverPreview, setHoverPreview] = React.useState<{ sessionId: string; rect: DOMRect } | null>(null);
    const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const load = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const s = await sessionService.getSessions();
            setSessions(s);
            setHasMore(sessionService.hasMoreSessions ?? false);
        } catch (e) {
            messageService.error(`Failed to load sessions: ${e}`);
        } finally {
            setIsLoading(false);
        }
    }, [sessionService, messageService]);

    const handleSearch = React.useCallback((query: string) => {
        if (searchTimerRef.current) { clearTimeout(searchTimerRef.current); }
        searchTimerRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                if (query.trim()) {
                    const results = await sessionService.searchSessions(query.trim());
                    setSessions(results);
                    setHasMore(false);
                } else {
                    await load();
                }
            } catch (e) {
                messageService.error(`Search failed: ${e}`);
            } finally {
                setIsLoading(false);
            }
        }, 250);
    }, [sessionService, messageService, load]);

    const handleLoadMore = async () => {
        const more = await sessionService.loadMoreSessions();
        setSessions(prev => [...prev, ...more]);
        setHasMore(sessionService.hasMoreSessions ?? false);
    };

    React.useEffect(() => {
        load();
        const d1 = sessionService.onActiveSessionChanged(() => load());
        const d2 = sessionService.onActiveProjectChanged(() => load());
        return () => { d1.dispose(); d2.dispose(); };
    }, [sessionService, load]);

    // Re-render when unseen counts change
    React.useEffect(() => {
        const d = notificationService.onUnseenChanged(() => setUnseenRevision(v => v + 1));
        return () => d.dispose();
    }, [notificationService]);

    const handleHoverEnter = (sessionId: string, e: React.MouseEvent<HTMLDivElement>) => {
        if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); }
        const rect = e.currentTarget.getBoundingClientRect();
        hoverTimerRef.current = setTimeout(() => {
            setHoverPreview({ sessionId, rect });
        }, 1000);
    };

    const handleHoverLeave = () => {
        if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); }
        setHoverPreview(null);
    };

    const handleNew = async () => {
        try {
            await sessionService.createSession(`Session ${new Date().toLocaleString()}`);
            await load();
        } catch (e) {
            messageService.error(`Failed to create session: ${e}`);
        }
    };

    const handleSwitch = async (id: string) => {
        try {
            await sessionService.setActiveSession(id);
        } catch (e) {
            messageService.error(`Failed to switch session: ${e}`);
        }
    };

    const handleArchive = async (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        const action = await messageService.warn(`Archive "${session.title}"?`, 'Archive', 'Cancel');
        if (action !== 'Archive') { return; }
        try {
            await sessionService.archiveSession(session.id);
            await load();
        } catch (err) {
            messageService.error(`Failed to archive session: ${err}`);
        }
    };

    const startRename = (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditDraft(session.title);
    };

    const saveRename = async (sessionId: string) => {
        if (!editDraft.trim() || isSavingTitle) { return; }
        setIsSavingTitle(true);
        try {
            await sessionService.renameSession(sessionId, editDraft.trim());
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: editDraft.trim() } : s));
        } catch (e) {
            messageService.error(`Failed to rename session: ${e}`);
        } finally {
            setIsSavingTitle(false);
            setEditingId(undefined);
        }
    };

    const cancelRename = () => {
        setEditingId(undefined);
        setEditDraft('');
    };

    const active = sessionService.activeSession;
    // Suppress unused variable warning for unseenRevision — it triggers re-renders
    void unseenRevision;

    return (
        <div className="sessions-widget">
            <div className="sessions-widget-toolbar">
                <span className="sessions-widget-title">SESSIONS</span>
                <button
                    type="button"
                    className="sessions-icon-btn show-archived-toggle"
                    data-testid="show-archived-toggle"
                    onClick={() => setShowArchived(v => !v)}
                    title={showArchived ? 'Hide archived' : 'Show archived'}
                    aria-label={showArchived ? 'Hide archived sessions' : 'Show archived sessions'}
                    aria-pressed={showArchived}
                >
                    {showArchived ? '●' : '○'}
                </button>
                <button
                    type="button"
                    className="sessions-widget-new-btn sessions-icon-btn"
                    onClick={handleNew}
                    title="New session"
                    aria-label="New session"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>
            </div>
            <div className="sessions-widget-search">
                <input
                    type="text"
                    className="sessions-search-input"
                    data-testid="session-search"
                    placeholder="Search sessions…"
                    value={searchQuery}
                    onChange={e => {
                        setSearchQuery(e.target.value);
                        handleSearch(e.target.value);
                    }}
                    aria-label="Search sessions"
                />
            </div>
            {isLoading && <SessionSkeleton />}
            {!isLoading && sessions.length === 0 && (
                <div className="sessions-widget-empty">No sessions yet</div>
            )}
            <div className="sessions-widget-list">
                {sessions
                    .filter(s => showArchived ? true : !(s as ExtendedSession).time?.archived)
                    .map(session => {
                    const extSession = session as ExtendedSession;
                    return (
                    <div
                        key={session.id}
                        className={`sessions-widget-item ${session.id === active?.id ? 'active' : ''}${extSession.parentID ? ' session-child session-forked' : ''}`}
                        data-session-id={session.id}
                        data-parent-id={extSession.parentID ?? undefined}
                        onClick={() => { if (editingId !== session.id) { handleSwitch(session.id); } }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' && editingId !== session.id) { handleSwitch(session.id); } }}
                        title={editingId === session.id ? undefined : session.title}
                        style={extSession.parentID ? { paddingLeft: '24px' } : undefined}
                        onMouseEnter={(e) => handleHoverEnter(session.id, e)}
                        onMouseLeave={handleHoverLeave}
                    >
                        <span className="sessions-widget-item-title" onDoubleClick={(e) => startRename(session, e)}>
                            {editingId === session.id ? (
                                <input
                                    className="sessions-title-input"
                                    value={editDraft}
                                    disabled={isSavingTitle}
                                    autoFocus
                                    onChange={e => setEditDraft(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') { e.preventDefault(); saveRename(session.id); }
                                        else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                                    }}
                                    onBlur={() => saveRename(session.id)}
                                    onClick={e => e.stopPropagation()}
                                    aria-label="Edit session title"
                                />
                            ) : (
                                session.title
                            )}
                            {editingId !== session.id && (() => {
                                const status = sessionService.getSessionStatus(session.id);
                                const hasError = !!sessionService.getSessionError(session.id);
                                if (hasError) {
                                    return <span className="session-status-dot error" aria-label="Session error" />;
                                }
                                if (!status || status.type === 'idle') { return null; }
                                return (
                                    <span className={`session-status-badge session-status-${status.type}`}>
                                        {status.type === 'busy' ? '●' : '↺'}
                                    </span>
                                );
                            })()}
                            {editingId !== session.id && session.id !== active?.id && (() => {
                                const unseen = notificationService.getUnseenCount(session.id);
                                return unseen > 0 ? (
                                    <span className="session-unseen-dot" aria-label={`${unseen} unseen message${unseen > 1 ? 's' : ''}`} />
                                ) : null;
                            })()}
                        </span>
                        <div className="sessions-widget-item-actions">
                            {session.summary && (session.summary.additions > 0 || session.summary.deletions > 0) && (
                                <span className="session-diff-badge" aria-label={`${session.summary.additions} additions, ${session.summary.deletions} deletions`}>
                                    {session.summary.additions > 0 && <span className="session-diff-add">+{session.summary.additions}</span>}
                                    {session.summary.deletions > 0 && <span className="session-diff-del">-{session.summary.deletions}</span>}
                                </span>
                            )}
                            <span className="sessions-widget-item-time">
                                {session.time?.created ? relativeTime(session.time.created) : ''}
                            </span>
                            <button
                                type="button"
                                className="sessions-widget-archive sessions-icon-btn"
                                onClick={(e) => handleArchive(session, e)}
                                title="Archive session"
                                aria-label="Archive session"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                );})}
            </div>
            {hasMore && !searchQuery && (
                <button
                    type="button"
                    className="load-more-sessions"
                    data-testid="load-more-sessions"
                    onClick={handleLoadMore}
                >
                    Load more sessions
                </button>
            )}
            {hoverPreview && ReactDOM.createPortal(
                <SessionHoverPreview
                    sessionId={hoverPreview.sessionId}
                    sessionService={sessionService}
                    anchorRect={hoverPreview.rect}
                />,
                document.body
            )}
        </div>
    );
};

@injectable()
export class SessionsWidget extends ReactWidget {
    static readonly ID = 'openspace-sessions-widget';
    static readonly LABEL = 'Sessions';

    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(SessionNotificationService)
    protected readonly notificationService!: SessionNotificationService;

    constructor() {
        super();
        this.id = SessionsWidget.ID;
        this.title.label = SessionsWidget.LABEL;
        this.title.caption = SessionsWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-list';
        this.addClass('openspace-sessions-widget');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    protected render(): React.ReactNode {
        return (
            <SessionsView
                sessionService={this.sessionService}
                messageService={this.messageService}
                notificationService={this.notificationService}
            />
        );
    }
}

@injectable()
export class SessionsWidgetContribution extends AbstractViewContribution<SessionsWidget> {
    constructor() {
        super({
            widgetId: SessionsWidget.ID,
            widgetName: SessionsWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 501,
            }
        });
    }

    async onStart(_app: FrontendApplication): Promise<void> {
        await this.openView({ activate: false, reveal: true });
    }
}
