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
import { ExtractableWidget } from '@theia/core/lib/browser/widgets/extractable-widget';
import { Disposable } from '@theia/core/lib/common/disposable';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Message as LuminoMessage } from '@lumino/messaging';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { SessionService, StreamingUpdate } from 'openspace-core/lib/browser/session-service';
import { Message, MessagePartInput, Session, OpenCodeService } from 'openspace-core/lib/common/opencode-protocol';
import { PromptInput } from './prompt-input/prompt-input';
import { ModelSelector } from './model-selector';
import { MessageTimeline } from './message-timeline';
import type { MessagePart as PromptMessagePart } from './prompt-input/types';

/**
 * Chat Widget - displays messages from active session and allows sending new messages.
 */
@injectable()
export class ChatWidget extends ReactWidget implements ExtractableWidget {
    static readonly ID = 'openspace-chat-widget';
    static readonly LABEL = 'Chat';

    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    constructor() {
        super();
        this.id = ChatWidget.ID;
        this.title.label = ChatWidget.LABEL;
        this.title.caption = ChatWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-comments';
        this.addClass('openspace-chat-widget');
    }

    // ExtractableWidget — allows the user to pop the chat into a floating OS window
    readonly isExtractable: boolean = true;
    secondaryWindow: Window | undefined = undefined;

    @postConstruct()
    protected init(): void {
        this.update();
        // T3-9: If workspace not yet available at mount time, wait for it async
        this.workspaceService.roots.then(roots => {
            if (roots.length > 0) {
                this.update();
            }
        });
    }

    protected override onAfterAttach(msg: LuminoMessage): void {
        super.onAfterAttach(msg);
        // T3-9: Re-render when workspace changes (resolves asynchronously after attach)
        const listener = this.workspaceService.onWorkspaceChanged(() => {
            this.update();
        });
        this.toDisposeOnDetach.push(Disposable.create(() => listener.dispose()));
    }

    /**
     * Handle widget activation - focus the input element
     */
    protected onActivateRequest(msg: LuminoMessage): void {
        super.onActivateRequest(msg);
        // Focus will be handled by the React component
        // The widget itself doesn't need to do anything special
    }

    // T3-9: Get workspace root path
    protected getWorkspaceRoot(): string {
        const roots = this.workspaceService.tryGetRoots();
        if (roots.length > 0) {
            return roots[0].resource.path.toString();
        }
        return '';
    }

    protected render(): React.ReactNode {
        return <ChatComponent 
            sessionService={this.sessionService} 
            openCodeService={this.openCodeService}
            workspaceRoot={this.getWorkspaceRoot()}
            messageService={this.messageService}
        />;
    }
}

interface ChatComponentProps {
    sessionService: SessionService;
    openCodeService: OpenCodeService;
    workspaceRoot: string;
    messageService: MessageService;
}

// T7: ChatHeaderBar — unified single-bar header replacing the 2-bar layout
interface ChatHeaderBarProps {
    showSessionList: boolean;
    sessions: Session[];
    activeSession: Session | undefined;
    sessionService: SessionService;
    isLoadingSessions: boolean;
    sessionLoadError: string | undefined;
    onLoadSessions: () => void;
    onSessionSwitch: (sessionId: string) => void;
    onNewSession: () => void;
    onDeleteSession: () => void;
    onToggleDropdown: () => void;
}

const ChatHeaderBar: React.FC<ChatHeaderBarProps> = ({
    showSessionList,
    sessions,
    activeSession,
    sessionService,
    isLoadingSessions,
    sessionLoadError,
    onLoadSessions,
    onSessionSwitch,
    onNewSession,
    onDeleteSession,
    onToggleDropdown
}) => {
    const [showMenu, setShowMenu] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

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

    return (
        <div className="chat-header-bar session-header">
            {/* Session title — clicking opens dropdown */}
            <div className="session-selector">
                <button
                    type="button"
                     className={`chat-header-title oc-icon-btn session-dropdown-button ${activeSession ? '' : 'no-session'}`}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 6px', borderRadius: 3, textAlign: 'left' }}
                    onClick={onToggleDropdown}
                    data-test-sessions-count={sessions.length}
                    aria-haspopup="listbox"
                    aria-expanded={showSessionList}
                    title={activeSession?.title ?? 'No Session'}
                >
                    {activeSession ? activeSession.title : 'No Session'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10" style={{ marginLeft: 4, flexShrink: 0, opacity: 0.5 }} aria-hidden="true">
                        <path d="m6 9 6 6 6-6"/>
                    </svg>
                </button>

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
                        {sessionService.activeProject && !isLoadingSessions && !sessionLoadError && sessions.map(session => (
                            <div
                                key={session.id}
                                className={`session-list-item ${session.id === activeSession?.id ? 'active' : ''}`}
                                onClick={() => onSessionSwitch(session.id)}
                                role="option"
                                tabIndex={0}
                                aria-selected={session.id === activeSession?.id}
                                onKeyDown={(e) => { if (e.key === 'Enter') { onSessionSwitch(session.id); } }}
                            >
                                <span className="session-list-item-title">{session.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Model selector pill */}
            <ModelSelector sessionService={sessionService} />

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
                        {activeSession && (
                            <button
                                type="button"
                                className="chat-header-menu-item"
                                role="menuitem"
                                onClick={() => { setShowMenu(false); onDeleteSession(); }}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                                Delete session
                            </button>
                        )}
                        {!activeSession && (
                            <div className="chat-header-menu-empty">No actions</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatFooter: React.FC<{ isStreaming: boolean }> = ({ isStreaming }) => (
    <div className="chat-footer-bar">
        <div className="chat-footer-status">
            <div className={`status-dot ${isStreaming ? 'streaming' : 'connected'}`} />
            <span>{isStreaming ? 'Generating...' : 'Ready'}</span>
        </div>
    </div>
);

/**
 * React component for chat interface.
 * T3-9: Added workspaceRoot prop
 * T3-10: Added messageService prop for dialogs
 * Exported for unit testing.
 */
export const ChatComponent: React.FC<ChatComponentProps> = ({ sessionService, openCodeService: _openCodeService, workspaceRoot, messageService }) => {
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [showSessionList, setShowSessionList] = React.useState(false);
    const [streamingData, setStreamingData] = React.useState<Map<string, string>>(new Map());
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
    const [sessionLoadError, setSessionLoadError] = React.useState<string | undefined>();
    const [queuedCount, setQueuedCount] = React.useState(0);
    const messageQueueRef = React.useRef<PromptMessagePart[][]>([]);
    const isSendingRef = React.useRef(false);
    const disposablesRef = React.useRef<Disposable[]>([]);

    // Subscribe to model changes
    React.useEffect(() => {
        const disposable = sessionService.onActiveModelChanged(model => {
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[ChatWidget] Active model changed:', model);
            }
        });
        return () => disposable.dispose();
    }, [sessionService]);

    // Load sessions
    const loadSessions = React.useCallback(async () => {
        setIsLoadingSessions(true);
        setSessionLoadError(undefined);
        const startTime = Date.now();
        try {
            const sessions = await sessionService.getSessions();
            setSessions(sessions);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error loading sessions:', error);
            }
            setSessionLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            // Minimum display time to prevent flicker
            const elapsed = Date.now() - startTime;
            const delay = Math.max(0, 100 - elapsed);
            setTimeout(() => setIsLoadingSessions(false), delay);
        }
    }, [sessionService]);

    // Auto-select project based on workspace on initial load (run only once)
    const hasAutoSelectedRef = React.useRef(false);
    React.useEffect(() => {
        if (workspaceRoot && !sessionService.activeProject && !hasAutoSelectedRef.current) {
            hasAutoSelectedRef.current = true;
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[ChatWidget] Auto-selecting project for workspace:', workspaceRoot);
            }
            sessionService.autoSelectProjectByWorkspace(workspaceRoot)
                .then(success => {
                    if (success) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.debug('[ChatWidget] Project auto-selected successfully');
                        }
                        loadSessions();
                    } else {
                        if (process.env.NODE_ENV !== 'production') {
                            console.warn('[ChatWidget] Could not auto-select project for workspace:', workspaceRoot);
                        }
                    }
                })
                .catch(err => {
                    if (process.env.NODE_ENV !== 'production') {
                        console.error('[ChatWidget] Error auto-selecting project:', err);
                    }
                });
        }
    }, [workspaceRoot]); // Only depend on workspaceRoot

    // Subscribe to message updates and load sessions
    React.useEffect(() => {
        // Initial data
        setMessages([...sessionService.messages]);
        loadSessions();

        // Subscribe to message changes
        const messagesDisposable = sessionService.onMessagesChanged(msgs => {
            setMessages([...msgs]);
        });

        // Subscribe to streaming updates
        const streamingDisposable = sessionService.onMessageStreaming((update: StreamingUpdate) => {
            setStreamingData(prev => {
                const next = new Map(prev);
                const current = next.get(update.messageId) || '';
                next.set(update.messageId, current + update.delta);
                return next;
            });

            if (update.isDone) {
                // Clear streaming data when complete
                setStreamingData(prev => {
                    const next = new Map(prev);
                    next.delete(update.messageId);
                    return next;
                });
            }
        });

        // Subscribe to streaming state
        const streamingStateDisposable = sessionService.onIsStreamingChanged(streaming => {
            setIsStreaming(streaming);
        });

        // Subscribe to session changes to reload list
        const sessionChangedDisposable = sessionService.onActiveSessionChanged(() => {
            loadSessions();
        });

        // Subscribe to project changes to reload list (FIX: Race condition)
        const projectChangedDisposable = sessionService.onActiveProjectChanged(() => {
            loadSessions();
        });

        // Store disposables for cleanup
        disposablesRef.current = [
            messagesDisposable,
            streamingDisposable,
            streamingStateDisposable,
            sessionChangedDisposable,
            projectChangedDisposable
        ];

        return () => {
            disposablesRef.current.forEach(d => { d.dispose(); });
            disposablesRef.current = [];
        };
    }, [sessionService, loadSessions]);

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

    // Handle new session
    // T3-10: Use MessageService instead of alert()
    // Note: createSession() will auto-select a project if none is active
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

    // Handle session switch
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

    // Handle delete session
    const handleDeleteSession = React.useCallback(async () => {
        const activeSession = sessionService.activeSession;
        if (!activeSession) return;
        
        const action = await messageService.warn(
            `Delete session "${activeSession.title}"?`,
            'Delete', 'Cancel'
        );
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
    }, [sessionService, loadSessions, messageService]);

    // Handle send message (updated for multi-part input and model selection)
    // Messages are queued if streaming is active, and drained sequentially.
    const sendPartsNow = React.useCallback(async (parts: PromptMessagePart[]) => {
        const activeModel = sessionService.activeModel;
        const model = activeModel ? (() => {
            const [providerPart, ...modelParts] = activeModel.split('/');
            const modelPart = modelParts.join('/');
            return { providerID: providerPart, modelID: modelPart };
        })() : undefined;

        if (process.env.NODE_ENV !== 'production') {
            console.log('[ChatWidget] Sending message with model:', model || 'default');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await sessionService.sendMessage(parts as any as MessagePartInput[], model);
    }, [sessionService]);

    const drainQueue = React.useCallback(async () => {
        if (isSendingRef.current) return;
        while (messageQueueRef.current.length > 0) {
            isSendingRef.current = true;
            const next = messageQueueRef.current.shift()!;
            setQueuedCount(messageQueueRef.current.length);
            try {
                await sendPartsNow(next);
            } catch (error) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[ChatWidget] Error sending queued message:', error);
                }
            }
        }
        isSendingRef.current = false;
    }, [sendPartsNow]);

    // When streaming ends, drain any queued messages
    React.useEffect(() => {
        if (!isStreaming) {
            drainQueue();
        }
    }, [isStreaming, drainQueue]);

    const handleSend = React.useCallback(async (parts: PromptMessagePart[]) => {
        if (parts.length === 0) return;

        if (isStreaming || isSendingRef.current) {
            // Queue for later — input stays enabled so user can keep typing
            messageQueueRef.current.push(parts);
            setQueuedCount(messageQueueRef.current.length);
            return;
        }

        try {
            await sendPartsNow(parts);
        } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[ChatWidget] Error sending message:', error);
            }
        }
    }, [sessionService, isStreaming, sendPartsNow]);

    // handleKeyDown removed - now handled by PromptInput component

    // Check if session is active
    const hasActiveSession = sessionService.activeSession !== undefined;
    const activeSession = sessionService.activeSession;

    // Toggle session dropdown
    const handleToggleDropdown = React.useCallback(() => {
        setShowSessionList(prev => !prev);
    }, []);

    // T7: Use unified ChatHeaderBar
    return (
        <div className="chat-container">
            <div className="chat-active">
                <ChatHeaderBar
                    showSessionList={showSessionList}
                    sessions={sessions}
                    activeSession={activeSession}
                    sessionService={sessionService}
                    isLoadingSessions={isLoadingSessions}
                    sessionLoadError={sessionLoadError}
                    onLoadSessions={loadSessions}
                    onSessionSwitch={handleSessionSwitch}
                    onNewSession={handleNewSession}
                    onDeleteSession={handleDeleteSession}
                    onToggleDropdown={handleToggleDropdown}
                />
                {!hasActiveSession ? (
                    <div className="chat-no-session">
                        <p>No active session</p>
                        <p className="chat-hint">Select a session above or create a new one to start chatting</p>
                    </div>
                ) : (
                    <>
                        <MessageTimeline
                            messages={messages}
                            streamingData={streamingData}
                            isStreaming={isStreaming}
                            streamingMessageId={isStreaming ? streamingData.keys().next().value : undefined}
                        />
                        
                        {/* Multi-part Prompt Input (Task 2.1) */}
                        <PromptInput
                            onSend={handleSend}
                            onStop={() => sessionService.abort()}
                            isStreaming={isStreaming}
                            disabled={false}
                            placeholder={queuedCount > 0 ? `${queuedCount} message${queuedCount > 1 ? 's' : ''} queued — send more...` : 'Type your message, @mention files/agents, or attach images...'}
                            workspaceRoot={workspaceRoot}
                        />
                        <ChatFooter isStreaming={isStreaming} />
                    </>
                )}
            </div>
        </div>
    );
};
