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
import { SessionService, StreamingUpdate } from 'openspace-core/lib/browser/session-service';
import { Message, MessagePart, Session, OpenCodeService } from 'openspace-core/lib/common/opencode-protocol';
import { PromptInput } from './prompt-input/prompt-input';
import { ModelSelector } from './model-selector';

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
    }

    protected render(): React.ReactNode {
        return <ChatComponent sessionService={this.sessionService} openCodeService={this.openCodeService} />;
    }
}

interface ChatComponentProps {
    sessionService: SessionService;
    openCodeService: OpenCodeService;
}

/**
 * React component for chat interface.
 */
const ChatComponent: React.FC<ChatComponentProps> = ({ sessionService, openCodeService }) => {
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [showSessionList, setShowSessionList] = React.useState(false);
    const [streamingData, setStreamingData] = React.useState<Map<string, string>>(new Map());
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
    const [sessionLoadError, setSessionLoadError] = React.useState<string | undefined>();
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
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



    // Auto-scroll to bottom on new messages
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingData]);

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
    const handleNewSession = React.useCallback(async () => {
        if (!sessionService.activeProject) {
            alert('No project selected. Please open a project first.');
            return;
        }
        try {
            const title = `Session ${new Date().toLocaleString()}`;
            await sessionService.createSession(title);
            await loadSessions();
            setShowSessionList(false);
        } catch (error) {
            console.error('[ChatWidget] Error creating session:', error);
            alert(`Failed to create session: ${error}`);
        }
    }, [sessionService, loadSessions]);

    // Handle session switch
    const handleSessionSwitch = React.useCallback(async (sessionId: string) => {
        try {
            await sessionService.setActiveSession(sessionId);
            setShowSessionList(false);
        } catch (error) {
            console.error('[ChatWidget] Error switching session:', error);
            alert(`Failed to switch session: ${error}`);
        }
    }, [sessionService]);

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
            alert(`Failed to delete session: ${error}`);
        }
    }, [sessionService, loadSessions]);

    // Handle send message (updated for multi-part input and model selection)
    const handleSend = React.useCallback(async (parts: MessagePart[]) => {
        if (parts.length === 0) {
            return;
        }

        try {
            // Add model metadata to first text part if model is selected
            let partsToSend = parts;
            const model = sessionService.activeModel;
            if (model && parts[0]?.type === 'text') {
                const [providerID, modelID] = model.split('/');
                partsToSend = [
                    {
                        ...parts[0],
                        metadata: {
                            ...(parts[0].metadata || {}),
                            providerID,
                            modelID
                        }
                    },
                    ...parts.slice(1)
                ];
            }

            await sessionService.sendMessage(partsToSend);
        } catch (error) {
            console.error('[ChatWidget] Error sending message:', error);
            // TODO: Show error to user
        }
    }, [sessionService]);

    // handleKeyDown removed - now handled by PromptInput component

    // Render message text from parts
    const renderMessageText = (message: Message): string => {
        return (message.parts || [])
            .filter(part => part.type === 'text')
            .map(part => (part as { text: string }).text)
            .join('');
    };

    // Check if session is active
    const hasActiveSession = sessionService.activeSession !== undefined;
    const activeSession = sessionService.activeSession;

    // Session Header component
    const SessionHeader: React.FC = () => {
        return (
            <div className="session-header" data-test-show-list={showSessionList.toString()}>
                <div className="session-selector">
                    <button 
                        type="button"
                        className="session-dropdown-button session-header-button"
                        onClick={() => {
                            console.log('[ChatWidget] Toggle dropdown, current state:', showSessionList, 'sessions:', sessions.length);
                            setShowSessionList(!showSessionList);
                        }}
                        data-test-sessions-count={sessions.length}
                    >
                        {activeSession ? activeSession.title : 'No Session'}
                        <span className="dropdown-icon">▼</span>
                    </button>
                    
                    {showSessionList && (
                        <div className="session-list-dropdown">
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
                                        onClick={loadSessions}
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
                                    onClick={() => handleSessionSwitch(session.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleSessionSwitch(session.id);
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                >
                                    {session.title}
                                    {session.id === activeSession?.id && <span className="active-indicator">●</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <button 
                    type="button"
                    className="new-session-button"
                    onClick={handleNewSession}
                    title={sessionService.activeProject ? "Create new session" : "No project selected"}
                >
                    + New
                </button>
                
                {activeSession && (
                    <button 
                        type="button"
                        className="delete-session-button"
                        onClick={handleDeleteSession}
                        title="Delete current session"
                    >
                        🗑️
                    </button>
                )}
            </div>
        );
    };



    return (
        <div className="chat-container">
            <div className="chat-active">
                <SessionHeader />
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
                        <div className="chat-messages">{messages.length === 0 ? (
                                <div className="chat-empty">
                                    <p>No messages yet</p>
                                    <p className="chat-hint">Type a message below to get started</p>
                                </div>
                            ) : (
                                messages.map(message => {
                                    const messageText = renderMessageText(message);
                                    const streamingText = streamingData.get(message.id);
                                    const displayText = streamingText ? messageText + streamingText : messageText;

                                    return (
                                        <div key={message.id} className={`chat-message chat-message-${message.role}`}>
                                            <div className="chat-message-role">
                                                {message.role === 'user' ? 'You' : 'Assistant'}
                                            </div>
                                            <div className="chat-message-content">
                                                {displayText}
                                                {streamingText && <span className="chat-streaming-indicator">▋</span>}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        {/* Multi-part Prompt Input (Task 2.1) */}
                        <PromptInput
                            onSend={handleSend}
                            disabled={isStreaming}
                            placeholder="Type your message, @mention files/agents, or attach images..."
                        />
                    </>
                )}
            </div>
        </div>
    );
};
