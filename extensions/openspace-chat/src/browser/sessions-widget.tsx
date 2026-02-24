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
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { MessageService } from '@theia/core/lib/common/message-service';
import { SessionService } from 'openspace-core/lib/browser/session-service';
import { Session } from 'openspace-core/lib/common/opencode-protocol';

/** Formats a timestamp as a relative time string (e.g. "2h ago"). */
function relativeTime(ms: number): string {
    const diff = Date.now() - ms;
    if (diff < 60_000) { return 'now'; }
    if (diff < 3_600_000) { return `${Math.floor(diff / 60_000)}m`; }
    if (diff < 86_400_000) { return `${Math.floor(diff / 3_600_000)}h`; }
    return `${Math.floor(diff / 86_400_000)}d`;
}

interface SessionsViewProps {
    sessionService: SessionService;
    messageService: MessageService;
}

const SessionsView: React.FC<SessionsViewProps> = ({ sessionService, messageService }) => {
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showArchived, setShowArchived] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
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
        await sessionService.loadMoreSessions();
        await load();
    };

    React.useEffect(() => {
        load();
        const d1 = sessionService.onActiveSessionChanged(() => load());
        const d2 = sessionService.onActiveProjectChanged(() => load());
        return () => { d1.dispose(); d2.dispose(); };
    }, [sessionService, load]);

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

    const handleDelete = async (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        const action = await messageService.warn(`Delete "${session.title}"?`, 'Delete', 'Cancel');
        if (action !== 'Delete') { return; }
        try {
            await sessionService.deleteSession(session.id);
            await load();
        } catch (err) {
            messageService.error(`Failed to delete session: ${err}`);
        }
    };

    const active = sessionService.activeSession;

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
            {isLoading && (
                <div className="sessions-widget-loading">
                    <svg className="sessions-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                </div>
            )}
            {!isLoading && sessions.length === 0 && (
                <div className="sessions-widget-empty">No sessions yet</div>
            )}
            <div className="sessions-widget-list">
                {sessions
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter(s => showArchived ? true : !(s.time as any)?.archived)
                    .map(session => (
                    <div
                        key={session.id}
                        className={`sessions-widget-item ${session.id === active?.id ? 'active' : ''}${(session as any).parentID ? ' session-child session-forked' : ''}`}
                        data-parent-id={(session as any).parentID ?? undefined}
                        onClick={() => handleSwitch(session.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') { handleSwitch(session.id); } }}
                        title={session.title}
                        style={(session as any).parentID ? { paddingLeft: '24px' } : undefined}
                    >
                        <span className="sessions-widget-item-title">
                            {session.title}
                            {(() => {
                                const status = sessionService.getSessionStatus(session.id);
                                if (!status || status.type === 'idle') { return null; }
                                return (
                                    <span className={`session-status-badge session-status-${status.type}`}>
                                        {status.type === 'busy' ? '●' : '↺'}
                                    </span>
                                );
                            })()}
                        </span>
                        <div className="sessions-widget-item-actions">
                            <span className="sessions-widget-item-time">
                                {session.time?.created ? relativeTime(session.time.created) : ''}
                            </span>
                            <button
                                type="button"
                                className="sessions-widget-delete sessions-icon-btn"
                                onClick={(e) => handleDelete(session, e)}
                                title="Delete session"
                                aria-label="Delete session"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
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
