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
import { Disposable } from '@theia/core/lib/common/disposable';
import { MessageService } from '@theia/core/lib/common/message-service';
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
export class ChatWidget extends ReactWidget {
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

    protected override onAfterAttach(msg: any): void {
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
    protected onActivateRequest(msg: any): void {
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

// T2-13: SessionHeader moved to module scope to prevent recreation on every render
interface SessionHeaderProps {
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

const SessionHeader: React.FC<SessionHeaderProps> = ({
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
    return (
        <div className="session-header" data-test-show-list={showSessionList.toString()}>
            <div className="session-selector">
                <button 
                    type="button"
                    className="session-dropdown-button session-header-button"
                    onClick={onToggleDropdown}
                    data-test-sessions-count={sessions.length}
                    aria-label="Select session"
                    aria-haspopup="listbox"
                    aria-expanded={showSessionList}
                >
                    {activeSession ? activeSession.title : 'No Session'}
                    <span className="dropdown-icon" aria-hidden="true">▼</span>
                </button>
                
                {showSessionList && (
                    <div className="session-list-dropdown" role="listbox" aria-label="Session list">
                        {!sessionService.activeProject && (
                            <div className="session-list-empty">
                                <span>⚠️</span> No project selected. Please open a project to see sessions.
                            </div>
                        )}
                        {sessionService.activeProject && isLoadingSessions && (
                            <div className="session-list-loading">
                                <span className="spinner">⏳</span> Loading sessions...
                            </div>
                        )}
                        {sessionService.activeProject && sessionLoadError && (
                            <div className="session-list-error">
                                <div className="error-message">
                                    <span className="error-icon">⚠️</span> {sessionLoadError}
                                </div>
                                <button 
                                    type="button"
                                    className="retry-button" 
                                    onClick={onLoadSessions}
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                        {sessionService.activeProject && !isLoadingSessions && !sessionLoadError && sessions.length === 0 && (
                            <div className="session-list-empty">No sessions yet. Click + to create one.</div>
                        )}
                        {sessionService.activeProject && !isLoadingSessions && !sessionLoadError && sessions.map(session => (
                            <div 
                                key={session.id}
                                className={`session-list-item ${session.id === activeSession?.id ? 'active' : ''}`}
                                onClick={() => onSessionSwitch(session.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSessionSwitch(session.id);
                                    }
                                }}
                                role="option"
                                tabIndex={0}
                                aria-selected={session.id === activeSession?.id}
                            >
                                {session.title}
                                {session.id === activeSession?.id && <span className="active-indicator"> ●</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <button 
                type="button"
                className="new-session-button"
                onClick={onNewSession}
                title={sessionService.activeProject ? "Create new session" : "No project selected"}
            >
                + New
            </button>
            
            {activeSession && (
                <button 
                    type="button"
                    className="delete-session-button"
                    onClick={onDeleteSession}
                    title="Delete current session"
                >
                    🗑️
                </button>
            )}
        </div>
    );
};

/**
 * React component for chat interface.
 * T3-9: Added workspaceRoot prop
 * T3-10: Added messageService prop for dialogs
 */
const ChatComponent: React.FC<ChatComponentProps> = ({ sessionService, openCodeService, workspaceRoot, messageService }) => {
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [showSessionList, setShowSessionList] = React.useState(false);
    const [streamingData, setStreamingData] = React.useState<Map<string, string>>(new Map());
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
    const [sessionLoadError, setSessionLoadError] = React.useState<string | undefined>();
    const disposablesRef = React.useRef<Disposable[]>([]);

    // Subscribe to model changes
    React.useEffect(() => {
        const disposable = sessionService.onActiveModelChanged(model => {
            console.debug('[ChatWidget] Active model changed:', model);
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
            console.error('[ChatWidget] Error loading sessions:', error);
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
            console.debug('[ChatWidget] Auto-selecting project for workspace:', workspaceRoot);
            sessionService.autoSelectProjectByWorkspace(workspaceRoot)
                .then(success => {
                    if (success) {
                        console.debug('[ChatWidget] Project auto-selected successfully');
                        loadSessions();
                    } else {
                        console.warn('[ChatWidget] Could not auto-select project for workspace:', workspaceRoot);
                    }
                })
                .catch(err => {
                    console.error('[ChatWidget] Error auto-selecting project:', err);
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
            console.error('[ChatWidget] Error creating session:', error);
            messageService.error(`Failed to create session: ${error}`);
        }
    }, [sessionService, loadSessions, messageService]);

    // Handle session switch
    const handleSessionSwitch = React.useCallback(async (sessionId: string) => {
        try {
            await sessionService.setActiveSession(sessionId);
            setShowSessionList(false);
        } catch (error) {
            console.error('[ChatWidget] Error switching session:', error);
            messageService.error(`Failed to switch session: ${error}`);
        }
    }, [sessionService, messageService]);

    // Handle delete session
    const handleDeleteSession = React.useCallback(async () => {
        const activeSession = sessionService.activeSession;
        if (!activeSession) return;
        
        const confirmed = confirm(`Delete session "${activeSession.title}"?`);
        if (!confirmed) return;
        
        try {
            await sessionService.deleteSession(activeSession.id);
            await loadSessions();
        } catch (error) {
            console.error('[ChatWidget] Error deleting session:', error);
            messageService.error(`Failed to delete session: ${error}`);
        }
    }, [sessionService, loadSessions, messageService]);

    // Handle send message (updated for multi-part input and model selection)
    const handleSend = React.useCallback(async (parts: PromptMessagePart[]) => {
        if (parts.length === 0) {
            return;
        }

        try {
            // Get selected model and pass it separately (not in parts metadata)
            // OpenCode API expects model as top-level parameter: { providerID, modelID }
            // T3-12: Handle multi-slash model IDs correctly (e.g., "provider/model/version")
            const activeModel = sessionService.activeModel;
            const model = activeModel ? (() => {
                const parts = activeModel.split('/');
                const providerID = parts[0];
                const modelID = parts.slice(1).join('/');
                return { providerID, modelID };
            })() : undefined;

            console.log('[ChatWidget] Sending message with model:', model || 'default');
            // PromptInput MessagePart types are compatible with MessagePartInput
            await sessionService.sendMessage(parts as any as MessagePartInput[], model);
        } catch (error) {
            console.error('[ChatWidget] Error sending message:', error);
            // TODO: Show error to user
        }
    }, [sessionService]);

    // handleKeyDown removed - now handled by PromptInput component

    // Check if session is active
    const hasActiveSession = sessionService.activeSession !== undefined;
    const activeSession = sessionService.activeSession;

    // Toggle session dropdown
    const handleToggleDropdown = React.useCallback(() => {
        setShowSessionList(prev => !prev);
    }, []);

    // T2-13: Use module-level SessionHeader with props
    return (
        <div className="chat-container">
            <div className="chat-active">
                <SessionHeader 
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
                        <div className="chat-header-secondary">
                            <ModelSelector sessionService={sessionService} />
                        </div>
                        <MessageTimeline
                            messages={messages}
                            streamingData={streamingData}
                            isStreaming={isStreaming}
                            streamingMessageId={isStreaming ? streamingData.keys().next().value : undefined}
                        />
                        
                        {/* Multi-part Prompt Input (Task 2.1) */}
                        <PromptInput
                            onSend={handleSend}
                            disabled={isStreaming}
                            placeholder="Type your message, @mention files/agents, or attach images..."
                            workspaceRoot={workspaceRoot}
                        />
                    </>
                )}
            </div>
        </div>
    );
};
