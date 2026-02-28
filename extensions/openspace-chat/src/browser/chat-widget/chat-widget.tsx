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
import { OpenerService } from '@theia/core/lib/browser';
import { CommandService } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { Message as LuminoMessage } from '@lumino/messaging';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { AgentInfo, Message, OpenCodeService, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import { PromptInput } from '../prompt-input/prompt-input';
import { MessageTimeline } from '../message-timeline';
import { QuestionDock } from '../question-dock';
import { TodoPanel } from '../todo-panel';
import { SessionViewStore } from '../session-view-store';
import { ChatHeaderBar } from './chat-header-bar';
import { useSessionSubscriptions } from './use-session-subscriptions';
import { useSessionActions } from './use-session-actions';
import { useMessageQueue } from './use-message-queue';
import { useShellExecution } from './use-shell-execution';
import type { ShellOutput } from './use-shell-execution';
import { useModelPreference } from './use-model-preference';

// Re-export ShellOutput so consumers that imported it from './chat-widget' keep working
export type { ShellOutput };

interface ChatComponentProps {
    sessionService: SessionService;
    openCodeService: OpenCodeService;
    workspaceRoot: string;
    messageService: MessageService;
    openerService: OpenerService;
    commandService: CommandService;
    preferenceService: PreferenceService;
    viewStore?: SessionViewStore;
}

// ─── PermissionDock ──────────────────────────────────────────────────────────

/**
 * PermissionDock — renders above PromptInput when the agent requests a permission
 * that has no associated tool call (orphan permissions: doom-loop, task-tool, etc.).
 * Permissions linked to a specific tool call (callID set) are shown inline in the
 * tool card by tool-call-renderer.tsx.
 */
const PermissionDock: React.FC<{
    permissions: PermissionNotification[];
    onReply: (requestId: string, reply: 'once' | 'always' | 'reject') => void;
}> = ({ permissions, onReply }) => {
    const orphans = permissions.filter(p => !p.callID);
    if (orphans.length === 0) return null;
    return (
        <div className="permission-dock">
            {orphans.map(perm => {
                const permId = perm.permissionId || '';
                const metaCommand = perm.metadata?.command as string | undefined;
                const metaFilePath = perm.metadata?.filePath as string | undefined;
                const detail = metaCommand || metaFilePath || (perm.patterns && perm.patterns.length > 0 ? perm.patterns.join(', ') : undefined);
                return (
                    <div key={permId} className="permission-dock-item">
                        <span className="permission-dock-message">
                            {perm.title || perm.permission?.message || 'Permission required'}
                        </span>
                        {detail && (
                            <span className="permission-dock-detail" title={detail}>{detail}</span>
                        )}
                        <span className="permission-dock-actions">
                            <button type="button" className="part-tool-permission-btn part-tool-permission-btn-deny"
                                onClick={() => onReply(permId, 'reject')}>Deny</button>
                            <button type="button" className="part-tool-permission-btn part-tool-permission-btn-always"
                                onClick={() => onReply(permId, 'always')}>Allow Always</button>
                            <button type="button" className="part-tool-permission-btn part-tool-permission-btn-once"
                                onClick={() => onReply(permId, 'once')}>Allow Once</button>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── ChatWidget ───────────────────────────────────────────────────────────────

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

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    @inject(PreferenceService)
    protected readonly preferenceService!: PreferenceService;

    @inject(SessionViewStore)
    protected readonly viewStore!: SessionViewStore;

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
            openerService={this.openerService}
            commandService={this.commandService}
            preferenceService={this.preferenceService}
            viewStore={this.viewStore}
        />;
    }
}

/** Status bar shown below the prompt input with streaming state and token usage. */
const ChatFooter: React.FC<{ isStreaming: boolean; sessionBusy: boolean; streamingStatus: string; contextUsage?: { input: number; output: number; contextLimit?: number } | null }> = ({ isStreaming, sessionBusy, streamingStatus, contextUsage }) => {
    const active = isStreaming || sessionBusy;
    const totalTokens = contextUsage ? contextUsage.input + contextUsage.output : 0;
    const warningThreshold = contextUsage?.contextLimit ? contextUsage.contextLimit * 0.8 : Infinity;
    const isWarning = contextUsage && totalTokens > warningThreshold;
    return (
        <div className="chat-footer-bar">
            <div className="chat-footer-status">
                <div className={`status-dot ${active ? 'streaming' : 'connected'}`} />
                <span>{active ? (streamingStatus || 'Thinking') : 'Ready'}</span>
            </div>
            {contextUsage && totalTokens > 0 && (
                <div className={`context-usage${isWarning ? ' context-usage--warning' : ''}`} title="Context token usage">
                    {totalTokens.toLocaleString()} tokens
                </div>
            )}
        </div>
    );
};

/**
 * React component for chat interface.
 * T3-9: Added workspaceRoot prop
 * T3-10: Added messageService prop for dialogs
 * Exported for unit testing.
 */
export const ChatComponent: React.FC<ChatComponentProps> = ({ sessionService, openCodeService, workspaceRoot, messageService, openerService, commandService, preferenceService, viewStore }) => {
    // Task 23: Ref to always access latest messages in stable callbacks without stale closure.
    const messagesRef = React.useRef<Message[]>([]);

    // Hooks for decomposed concerns
    const { enabledModels, handleManageModels } = useModelPreference(preferenceService, commandService, sessionService);

    const sessionActions = useSessionActions(sessionService, messageService, openerService, workspaceRoot);

    const subscriptions = useSessionSubscriptions(sessionService, sessionActions.loadSessions);
    messagesRef.current = subscriptions.messages;

    const { queuedCount, handleSend, handleCommand, handleBuiltinCommand } = useMessageQueue(sessionService, openCodeService, subscriptions.isStreaming);
    const { shellOutputs, handleShellCommand } = useShellExecution(openCodeService, workspaceRoot, messagesRef);

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
                        sessionActions.loadSessions();
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

    const hasActiveSession = sessionService.activeSession !== undefined;
    const activeSession = sessionService.activeSession;

    // P1-E: Compute context usage from the last assistant message's step-finish parts
    const contextUsage = React.useMemo(() => {
        if (subscriptions.isStreaming) return null;
        const lastAssistant = [...subscriptions.messages].reverse().find(m => m.role === 'assistant');
        if (!lastAssistant) return null;
        const stepFinish = (lastAssistant.parts ?? []).filter((p: any) => p.type === 'step-finish');
        if (stepFinish.length === 0) return null;
        let totalInput = 0, totalOutput = 0, contextLimit: number | undefined;
        for (const p of stepFinish) {
            totalInput += (p as any).tokens?.input || 0;
            totalOutput += (p as any).tokens?.output || 0;
            if ((p as any).contextLimit) contextLimit = (p as any).contextLimit;
        }
        return totalInput + totalOutput > 0 ? { input: totalInput, output: totalOutput, contextLimit } : null;
    }, [subscriptions.messages, subscriptions.isStreaming]);

    const [mcpStatus, setMcpStatus] = React.useState<Record<string, unknown> | undefined>(undefined);
    React.useEffect(() => {
        setMcpStatus(undefined);
        if (subscriptions.activeSessionId) {
            sessionService.getMcpStatus()
                .then(v => { setMcpStatus(v); })
                .catch(() => { setMcpStatus(undefined); });
        }
    }, [subscriptions.activeSessionId]);

    // ─── Agent selector state ─────────────────────────────────────────────
    const [agents, setAgents] = React.useState<AgentInfo[]>([]);
    const [selectedAgent, setSelectedAgent] = React.useState<AgentInfo | null>(null);
    React.useEffect(() => {
        openCodeService.listAgents?.()
            .then((list: AgentInfo[]) => setAgents(list ?? []))
            .catch(() => setAgents([]));
    }, [openCodeService]);

    // Wrap handleSend to prepend the selected agent as an AgentPart
    const handleSendWithAgent = React.useCallback(async (parts: Parameters<typeof handleSend>[0]) => {
        if (selectedAgent) {
            return handleSend([{ type: 'agent', name: selectedAgent.name }, ...parts]);
        }
        return handleSend(parts);
    }, [handleSend, selectedAgent]);

    return (
        <div className="chat-container">
            <div className="chat-active">
                <ChatHeaderBar
                    showSessionList={sessionActions.showSessionList}
                    sessions={sessionActions.sessions}
                    activeSession={activeSession}
                    sessionService={sessionService}
                    isLoadingSessions={sessionActions.isLoadingSessions}
                    sessionLoadError={sessionActions.sessionLoadError}
                    isStreaming={subscriptions.isStreaming}
                    pendingPermissions={subscriptions.pendingPermissions}
                    onLoadSessions={sessionActions.loadSessions}
                    onSessionSwitch={sessionActions.handleSessionSwitch}
                    onNewSession={sessionActions.handleNewSession}
                    onDeleteSession={sessionActions.handleDeleteSession}
                    onForkSession={sessionActions.handleForkSession}
                    onRevertSession={sessionActions.handleRevertSession}
                    onCompactSession={sessionActions.handleCompactSession}
                    onShareSession={sessionActions.handleShareSession}
                    onUnshareSession={sessionActions.handleUnshareSession}
                    onRenameSession={sessionActions.handleRenameSession}
                    onNavigateToParent={sessionActions.handleNavigateToParent}
                    onToggleDropdown={sessionActions.handleToggleDropdown}
                     enabledModels={enabledModels}
                     onManageModels={handleManageModels}
                     mcpStatus={mcpStatus}
                 />
                {!hasActiveSession ? (
                    <div className="chat-no-session">
                        <p>No active session</p>
                        <p className="chat-hint">Select a session above or create a new one to start chatting</p>
                    </div>
                ) : (
                    <>
                        <MessageTimeline
                            messages={subscriptions.messages}
                            shellOutputs={shellOutputs}
                            isStreaming={subscriptions.isStreaming}
                            sessionBusy={subscriptions.sessionBusy}
                            streamingMessageId={subscriptions.streamingMessageId}
                            streamingStatus={subscriptions.streamingStatus}
                            openCodeService={openCodeService}
                            sessionService={sessionService}
                            pendingPermissions={subscriptions.pendingPermissions}
                            onReplyPermission={sessionActions.handleReplyPermission}
                            onOpenFile={sessionActions.handleOpenFile}
                            sessionId={activeSession?.id}
                            viewStore={viewStore}
                        />

                        {/* QuestionDock — shown when the server asks a question */}
                        {subscriptions.pendingQuestions.length > 0 && (
                            <QuestionDock
                                question={subscriptions.pendingQuestions[0]}
                                onAnswer={async (requestId, answers) => {
                                    try {
                                        await sessionService.answerQuestion(requestId, answers);
                                    } catch (error) {
                                        messageService.error(`Failed to answer question: ${error}`);
                                    }
                                }}
                                onReject={async requestId => {
                                    try {
                                        await sessionService.rejectQuestion(requestId);
                                    } catch (error) {
                                        messageService.error(`Failed to dismiss question: ${error}`);
                                    }
                                }}
                            />
                        )}

                        {/* PermissionDock — shown for orphan permissions (no callID / not linked to a tool card) */}
                        <PermissionDock
                            permissions={subscriptions.pendingPermissions}
                            onReply={async (requestId, reply) => {
                                try {
                                    await sessionActions.handleReplyPermission(requestId, reply);
                                } catch (error) {
                                    messageService.error(`Failed to reply to permission: ${error}`);
                                }
                            }}
                        />

                        {/* Session error from SSE session.error event */}
                        {subscriptions.sessionError && (
                            <div className="session-error" data-testid="session-error">
                                <span className="session-error-icon">⚠</span>
                                <span className="session-error-message">{subscriptions.sessionError}</span>
                                <button
                                    className="session-error-dismiss"
                                    aria-label="Dismiss error"
                                    onClick={() => subscriptions.setSessionError(undefined)}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {subscriptions.retryStatus && (
                            <div className="session-retry" data-testid="session-retry">
                                <span className="retry-icon">↻</span>
                                <span className="retry-message">{subscriptions.retryStatus.message}</span>
                                <span className="retry-countdown">
                                    (retry in {Math.max(0, Math.round((subscriptions.retryStatus.next - Date.now()) / 1000))}s,
                                    attempt {subscriptions.retryStatus.attempt})
                                </span>
                            </div>
                        )}

                        {/* Live todo panel — shows current todo state from todo.updated SSE */}
                        <TodoPanel todos={sessionService.todos} />

                        {/* Multi-part Prompt Input (Task 2.1) */}
                        <PromptInput
                            onSend={handleSendWithAgent}
                            onCommand={handleCommand}
                            onBuiltinCommand={handleBuiltinCommand}
                            onShellCommand={handleShellCommand}
                            onStop={() => sessionService.abort()}
                            isStreaming={subscriptions.isStreaming || subscriptions.sessionBusy}
                            disabled={subscriptions.pendingQuestions.length > 0}
                            placeholder={subscriptions.pendingQuestions.length > 0 ? 'Answer the question above to continue...' : queuedCount > 0 ? `${queuedCount} message${queuedCount > 1 ? 's' : ''} queued — send more...` : 'Type your message, @mention files/agents, or attach images...'}
                            workspaceRoot={workspaceRoot}
                            openCodeService={openCodeService}
                            sessionId={activeSession?.id}
                            agentSelectorAgents={agents}
                            agentSelectorSelected={selectedAgent}
                            onAgentSelect={setSelectedAgent}
                        />
                        <ChatFooter isStreaming={subscriptions.isStreaming} sessionBusy={subscriptions.sessionBusy} streamingStatus={subscriptions.streamingStatus} contextUsage={contextUsage} />
                    </>
                )}
            </div>
        </div>
    );
};
