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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { Disposable } from '@theia/core/lib/common/disposable';
import { ILogger } from '@theia/core/lib/common/logger';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
    OpenCodeService,
    Project,
    Session,
    Message,
    MessagePart,
    MessagePartInput,
    ProviderWithModels,
    PermissionNotification
} from '../common/opencode-protocol';
import * as SDKTypes from '../common/opencode-sdk-types';
import * as fs from 'fs';
import * as path from './browser-path';
import { waitForHub as waitForHubFn } from './hub-readiness';
import type { SessionNotificationService } from './notification-service';

/**
 * Streaming update event data for incremental message updates.
 */
export interface StreamingUpdate {
    messageId: string;
    delta: string;
    isDone: boolean;
}

/**
 * SessionService Symbol for DI binding.
 */
export const SessionService = Symbol('SessionService');

/**
 * SessionService interface - frontend state management for OpenSpace sessions.
 * 
 * Responsibilities:
 * - Track active project, session, and messages
 * - Coordinate between UI widgets and backend OpenCodeProxy via RPC
 * - Handle optimistic updates for message sending
 * - Emit events for reactive UI consumption
 * - Persist state to localStorage
 */
export interface SessionService extends Disposable {
    // State (readonly properties)
    readonly activeProject: Project | undefined;
    readonly activeSession: Session | undefined;
    readonly activeModel: string | undefined;
    readonly messages: Message[];
    readonly isLoading: boolean;
    readonly lastError: string | undefined;
    readonly isStreaming: boolean;
    readonly streamingMessageId: string | undefined;
    readonly currentStreamingStatus: string;
    /** Server-authoritative session status (busy/idle/retry). Spans the full agent turn. */
    readonly sessionStatus: SDKTypes.SessionStatus;

    // Events
    readonly onActiveProjectChanged: Event<Project | undefined>;
    readonly onActiveSessionChanged: Event<Session | undefined>;
    readonly onActiveModelChanged: Event<string | undefined>;
    readonly onMessagesChanged: Event<Message[]>;
    readonly onMessageStreaming: Event<StreamingUpdate>;
    readonly onIsLoadingChanged: Event<boolean>;
    readonly onErrorChanged: Event<string | undefined>;
    readonly onIsStreamingChanged: Event<boolean>;
    readonly onStreamingStatusChanged: Event<string>;
    readonly onSessionStatusChanged: Event<SDKTypes.SessionStatus>;

    // Operations
    setActiveProject(projectId: string): Promise<void>;
    setActiveSession(sessionId: string): Promise<void>;
    setActiveModel(model: string): void;
    createSession(title?: string): Promise<Session>;
    sendMessage(parts: MessagePartInput[], model?: { providerID: string; modelID: string }): Promise<void>;
    abort(): Promise<void>;
     getSessions(): Promise<Session[]>;
    searchSessions(query: string): Promise<Session[]>;
    loadMoreSessions(): Promise<Session[]>;
    readonly hasMoreSessions: boolean;
    loadOlderMessages(): Promise<void>;
    readonly hasOlderMessages: boolean;
    getAvailableModels(): Promise<ProviderWithModels[]>;
    deleteSession(sessionId: string): Promise<void>;
    archiveSession(sessionId: string): Promise<void>;
    renameSession(sessionId: string, title: string): Promise<void>;
    shareSession(sessionId: string): Promise<Session>;
    unshareSession(sessionId: string): Promise<void>;
    forkSession(messageId?: string): Promise<void>;
    revertSession(): Promise<void>;
    unrevertSession(): Promise<void>;
    compactSession(): Promise<void>;
    renameSession(sessionId: string, title: string): Promise<void>;
    autoSelectProjectByWorkspace(workspacePath: string): Promise<boolean>;


    // State update methods (for SyncService integration)
    appendMessage(message: Message): void;
    updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStreamingMessageParts(messageId: string, toolParts: any[]): void;
    replaceMessage(messageId: string, message: Message): void;
    fetchMessageFromBackend(messageId: string): Promise<Message | undefined>;
    notifySessionChanged(session: Session): void;
    notifySessionDeleted(sessionId: string): void;
    notifySessionError(sessionId: string, errorMessage: string): void;
    /** Remove a message from the in-memory list when a message.removed SSE is received. */
    notifyMessageRemoved(sessionId: string, messageId: string): void;
    /** Remove a part from a message when a message.part.removed SSE is received. */
    notifyPartRemoved(sessionId: string, messageId: string, partId: string): void;
    /** Update session status from server-authoritative SSE event. */
    updateSessionStatus(status: SDKTypes.SessionStatus, sessionId?: string): void;
    /** Get the current status for any session by ID. */
    getSessionStatus(sessionId: string): SDKTypes.SessionStatus | undefined;
    /** Get the last error message for any session by ID (from session.error SSE). */
    getSessionError(sessionId: string): string | undefined;
    applyPartDelta(messageId: string, partId: string, field: string, delta: string): void;
    /** Clear accumulated text/reasoning on all parts of a streaming message. Called before SSE reconnect replay. */
    clearStreamingPartText(messageId: string): void;
    /** Reload messages for the active session (used after compaction). */
    reloadMessages(): Promise<void>;
    /** Fetch the last 5 messages of any session for hover preview (read-only, no state change). */
    getMessagesForPreview(sessionId: string): Promise<Message[]>;

    // Question state
    readonly pendingQuestions: SDKTypes.QuestionRequest[];
    readonly onQuestionChanged: Event<SDKTypes.QuestionRequest[]>;

    // Todo state
    readonly todos: Array<{ id: string; description: string; status: string }>;
    readonly onTodosChanged: Event<Array<{ id: string; description: string; status: string }>>;

    // Question operations
    addPendingQuestion(question: SDKTypes.QuestionRequest): void;
    removePendingQuestion(requestId: string): void;
    /** Update the live todo list when a todo.updated SSE event is received. */
    updateTodos(todos: Array<{ id: string; description: string; status: string }>): void;
    answerQuestion(requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<void>;
    rejectQuestion(requestId: string): Promise<void>;

    // Permission state
    readonly pendingPermissions: PermissionNotification[];
    readonly onPermissionChanged: Event<PermissionNotification[]>;

    // Permission operations
    addPendingPermission(permission: PermissionNotification): void;
    removePendingPermission(permissionId: string): void;
    replyPermission(requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void>;
}

/**
 * SessionService implementation.
 * T2-11: Uses counter instead of boolean for isLoading to support nesting.
 */
@injectable()
export class SessionServiceImpl implements SessionService {

    private readonly HUB_MCP_URL = 'http://localhost:3000/mcp';
    private readonly HUB_READINESS_ATTEMPTS = 20;
    private readonly HUB_READINESS_INTERVAL_MS = 500;

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    // Private state
    private _activeProject: Project | undefined;
    private _activeSession: Session | undefined;
    private _activeModel: string | undefined;
    private _messages: Message[] = [];
    // T2-11: Use counter instead of boolean for nested loading support
    private _loadingCounter = 0;
    private _lastError: string | undefined;
    private _isStreaming = false;
    private _streamingMessageId: string | undefined;
    private _pendingQuestions: SDKTypes.QuestionRequest[] = [];
    private _pendingPermissions: PermissionNotification[] = [];
    private sessionLoadAbortController?: AbortController;
    private _currentStreamingStatus = '';
    private _lastStatusChangeTime = 0;
    private _statusChangeTimeout: ReturnType<typeof setTimeout> | undefined;
    private _streamingDoneTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly STREAMING_DONE_DELAY_MS = 500;
    private readonly RPC_FALLBACK_DELAY_MS = 5000;
    private _rpcFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    private _sessionStatuses = new Map<string, SDKTypes.SessionStatus>();
    private _sessionErrors = new Map<string, string>();
    /** Optional notification service — wired lazily via setNotificationService() to avoid DI cycles. */
    private _notificationService: SessionNotificationService | undefined;
    // _sessionLoadLimit: grows by PAGE_SIZE each time "Load More" is clicked.
    // The OpenCode API does not support offset pagination (start= is ignored),
    // so we re-fetch with a larger limit and deduplicate by id client-side.
    private _sessionLoadLimit: number = 20;
    private _sessionCursor: number = 0;
    private _hasMoreSessions = false;
    private _messageLoadCursor: string | undefined = undefined;
    private _hasOlderMessages = false;
    private _todos: Array<{ id: string; description: string; status: string }> = [];

    // Emitters
    private readonly onActiveProjectChangedEmitter = new Emitter<Project | undefined>();
    private readonly onActiveSessionChangedEmitter = new Emitter<Session | undefined>();
    private readonly onActiveModelChangedEmitter = new Emitter<string | undefined>();
    private readonly onMessagesChangedEmitter = new Emitter<Message[]>();
    private readonly onMessageStreamingEmitter = new Emitter<StreamingUpdate>();
    private readonly onIsLoadingChangedEmitter = new Emitter<boolean>();
    private readonly onErrorChangedEmitter = new Emitter<string | undefined>();
    private readonly onIsStreamingChangedEmitter = new Emitter<boolean>();
    private readonly onStreamingStatusChangedEmitter = new Emitter<string>();
    private readonly onSessionStatusChangedEmitter = new Emitter<SDKTypes.SessionStatus>();
    private readonly onQuestionChangedEmitter = new Emitter<SDKTypes.QuestionRequest[]>();
    private readonly onPermissionChangedEmitter = new Emitter<PermissionNotification[]>();
    private readonly onTodosChangedEmitter = new Emitter<Array<{ id: string; description: string; status: string }>>();

    // Public event properties
    readonly onActiveProjectChanged = this.onActiveProjectChangedEmitter.event;
    readonly onActiveSessionChanged = this.onActiveSessionChangedEmitter.event;
    readonly onActiveModelChanged = this.onActiveModelChangedEmitter.event;
    readonly onMessagesChanged = this.onMessagesChangedEmitter.event;
    readonly onMessageStreaming = this.onMessageStreamingEmitter.event;
    readonly onIsLoadingChanged = this.onIsLoadingChangedEmitter.event;
    readonly onErrorChanged = this.onErrorChangedEmitter.event;
    readonly onIsStreamingChanged = this.onIsStreamingChangedEmitter.event;
    readonly onStreamingStatusChanged = this.onStreamingStatusChangedEmitter.event;
    readonly onSessionStatusChanged = this.onSessionStatusChangedEmitter.event;
    readonly onQuestionChanged = this.onQuestionChangedEmitter.event;
    readonly onPermissionChanged = this.onPermissionChangedEmitter.event;
    readonly onTodosChanged = this.onTodosChangedEmitter.event;

    // Getters for readonly properties
    get activeProject(): Project | undefined {
        return this._activeProject;
    }

    get activeSession(): Session | undefined {
        return this._activeSession;
    }

    get activeModel(): string | undefined {
        return this._activeModel;
    }

    get messages(): Message[] {
        return this._messages;
    }

    // T2-11: isLoading returns true if counter > 0 (supports nested operations)
    get isLoading(): boolean {
        return this._loadingCounter > 0;
    }

    get lastError(): string | undefined {
        return this._lastError;
    }

    get isStreaming(): boolean {
        return this._isStreaming;
    }

    get streamingMessageId(): string | undefined {
        return this._streamingMessageId;
    }

    get currentStreamingStatus(): string {
        return this._currentStreamingStatus;
    }

    get sessionStatus(): SDKTypes.SessionStatus {
        return this._sessionStatuses.get(this._activeSession?.id ?? '') ?? { type: 'idle' };
    }

    get pendingQuestions(): SDKTypes.QuestionRequest[] {
        return this._pendingQuestions;
    }

    get pendingPermissions(): PermissionNotification[] {
        return this._pendingPermissions;
    }

    // T2-11: Increment loading counter
    private incrementLoading(): void {
        this._loadingCounter++;
        if (this._loadingCounter === 1) {
            this.onIsLoadingChangedEmitter.fire(true);
        }
    }

    // T2-11: Decrement loading counter
    private decrementLoading(): void {
        this._loadingCounter = Math.max(0, this._loadingCounter - 1);
        if (this._loadingCounter === 0) {
            this.onIsLoadingChangedEmitter.fire(false);
        }
    }

    /**
     * Read MCP config from opencode.json in the project worktree.
     */
    private getMcpConfig(): Record<string, unknown> | undefined {
        try {
            const worktree = this._activeProject?.worktree;
            if (!worktree) {
                this.logger.warn('[SessionService] No worktree available for MCP config');
                return undefined;
            }
            // In browser bundles, Node fs may be unavailable/polyfilled.
            // MCP config is optional, so gracefully skip when fs APIs are missing.
            if (typeof (fs as { existsSync?: unknown }).existsSync !== 'function' || typeof (fs as { readFileSync?: unknown }).readFileSync !== 'function') {
                this.logger.debug('[SessionService] Skipping MCP config read: fs APIs unavailable in browser runtime');
                return undefined;
            }
            const configPath = path.join(worktree, 'opencode.json');
            if (!fs.existsSync(configPath)) {
                this.logger.warn('[SessionService] opencode.json not found at: ' + configPath);
                return undefined;
            }
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            if (config.mcp) {
                this.logger.info('[SessionService] Found MCP config in opencode.json');
                return config.mcp as Record<string, unknown>;
            }
            this.logger.warn('[SessionService] No mcp section in opencode.json');
            return undefined;
        } catch (error) {
            this.logger.error('[SessionService] Error reading MCP config: ' + (error instanceof Error ? error.message : String(error)));
            return undefined;
        }
    }

    /**
     * Protected wrapper around waitForHub so tests can stub it.
     */
    protected async waitForHub(): Promise<void> {
        await waitForHubFn(this.HUB_MCP_URL, {
            maxAttempts: this.HUB_READINESS_ATTEMPTS,
            intervalMs: this.HUB_READINESS_INTERVAL_MS,
        });
    }

    /**
     * Initialize the service - restore state from localStorage.
     */
    @postConstruct()
    protected init(): void {
        this.logger.info('[SessionService] Initializing...');

        const projectId = window.localStorage.getItem('openspace.activeProjectId');
        const sessionId = window.localStorage.getItem('openspace.activeSessionId');

        (async () => {
            if (projectId) {
                try {
                    await this.setActiveProject(projectId);
                    this.logger.debug(`[SessionService] Restored project: ${projectId}`);
                } catch (err) {
                    this.logger.warn('[SessionService] Failed to restore project:', err);
                }
            }

            // Only restore session if project was loaded successfully
            if (sessionId && this._activeProject) {
                // Gate on hub readiness — a session restored before the Hub is up
                // will have no MCP tools available to the agent.
                try {
                    await this.waitForHub();
                } catch (err) {
                    this.logger.warn(
                        '[SessionService] Hub not ready during session restore — ' +
                        'skipping session restore to avoid tool-less session. ' +
                        'Create a new session once the IDE is fully loaded.',
                        err
                    );
                    // Do not restore the stale session
                    this.logger.info(`[SessionService] Initialized with project=${this._activeProject?.id || 'none'}, session=none`);
                    return;
                }

                try {
                    await this.setActiveSession(sessionId);
                    this.logger.debug(`[SessionService] Restored session: ${sessionId}`);
                } catch (err) {
                    this.logger.warn('[SessionService] Failed to restore session:', err);
                    // Persisted session may be stale (deleted in backend). Avoid repeated restore errors.
                    window.localStorage.removeItem('openspace.activeSessionId');
                    // Notify the user — they may need to start a new session manually.
                    this.messageService.warn(
                        'Previous session could not be restored. You may need to start a new session.',
                        'OK'
                    ).catch(() => { /* ignore notification errors */ });
                }
            }

            this.logger.info(`[SessionService] Initialized with project=${this._activeProject?.id || 'none'}, session=${this._activeSession?.id || 'none'}`);
        })();
    }

    /**
     * Set active project by ID.
     * Verifies project exists, updates state, emits event, and persists to localStorage.
     * Clears active session if it belonged to a different project.
     * 
     * @param projectId - Project ID to set as active
     * @throws Error if project not found
     */
    async setActiveProject(projectId: string): Promise<void> {
        this.logger.info(`[SessionService] Operation: setActiveProject(${projectId})`);

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // T2-11: Set loading state using counter
        this.incrementLoading();

        try {
            // Verify project exists by fetching all projects
            const projects = await this.openCodeService.getProjects();
            const project = projects.find(p => p.id === projectId);

            if (!project) {
                throw new Error(`Project not found: ${projectId}`);
            }

            // Update state
            this._activeProject = project;
            window.localStorage.setItem('openspace.activeProjectId', projectId);
            this.onActiveProjectChangedEmitter.fire(project);

            this.logger.debug(`[SessionService] State: project=${project.id} (${project.worktree})`);

            // Connect SSE for the project's directory
            if (project.worktree) {
                try {
                    await this.openCodeService.connectToProject(project.worktree);
                    this.logger.debug(`[SessionService] SSE connected for directory: ${project.worktree}`);
                } catch (sseError) {
                    this.logger.warn('[SessionService] Failed to connect SSE (non-fatal):', sseError);
                }
            }

            // Hydrate session statuses from server on project switch
            try {
                const statuses = await this.openCodeService.getSessionStatuses(project.id);
                for (const { sessionId, status } of statuses) {
                    this._sessionStatuses.set(sessionId, status);
                }
                this.logger.debug(`[SessionService] Hydrated ${statuses.length} session statuses`);
            } catch (e) {
                this.logger.warn(`[SessionService] Could not hydrate session statuses: ${e}`);
            }

            // Clear active session if it belonged to a different project
            if (this._activeSession && this._activeSession.projectID !== projectId) {
                this.logger.debug(`[SessionService] Clearing session from different project`);
                this._activeSession = undefined;
                this._messages = [];
                window.localStorage.removeItem('openspace.activeSessionId');
                this.onActiveSessionChangedEmitter.fire(undefined);
                this.onMessagesChangedEmitter.fire([]);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            // T2-11: Clear loading state using counter
            this.decrementLoading();
        }
    }

    /**
     * Auto-select project based on workspace path.
     * Finds the project whose path matches or contains the workspace path.
     * 
     * @param workspacePath - The workspace root path
     * @returns true if a project was selected, false otherwise
     */
    async autoSelectProjectByWorkspace(workspacePath: string): Promise<boolean> {
        this.logger.info(`[SessionService] Auto-selecting project for workspace: ${workspacePath}`);
        
        if (!workspacePath) {
            this.logger.warn('[SessionService] No workspace path provided');
            return false;
        }

        try {
            const projects = await this.openCodeService.getProjects();
            
            // Find project that matches the workspace path
            // SDK Project uses 'worktree' field
            const matchingProject = projects.find(p => {
                const projectPath = p.worktree;
                if (!projectPath) return false;
                // Check if project path matches or contains workspace path
                return workspacePath.includes(projectPath) || projectPath.includes(workspacePath);
            });

            if (matchingProject) {
                this.logger.info(`[SessionService] Found matching project: ${matchingProject.id} (${matchingProject.worktree})`);
                await this.setActiveProject(matchingProject.id);
                return true;
            } else {
                // No existing project matches — register the workspace as a new project
                this.logger.info(`[SessionService] No existing project matches workspace. Registering: ${workspacePath}`);
                this.logger.debug('[SessionService] Available projects:', projects.map(p => ({ id: p.id, worktree: p.worktree })));
                const newProject = await this.openCodeService.initProject(workspacePath);
                this.logger.info(`[SessionService] Registered new project: ${newProject.id} (${newProject.worktree})`);
                await this.setActiveProject(newProject.id);
                return true;
            }
        } catch (error) {
            this.logger.error('[SessionService] Error auto-selecting project:', error);
            return false;
        }
    }

    /**
     * Set active session by ID.
     * Requires active project to be set, verifies session exists, loads messages.
     * 
     * @param sessionId - Session ID to set as active
     * @throws Error if no active project or session not found
     */
    async setActiveSession(sessionId: string): Promise<void> {
        this.logger.info(`[SessionService] Operation: setActiveSession(${sessionId})`);

        // Do NOT abort in-progress prompts on session switch.
        // Let the backend task continue running. When the user switches back,
        // loadMessages() will fetch the complete history including any new
        // messages produced by the background task.
        // The user can explicitly abort via the Stop button if they want to cancel.
        if (this._activeSession && this._activeSession.id !== sessionId && this._isStreaming) {
            this.logger.debug(`[SessionService] Session ${this._activeSession.id} is streaming; leaving it running in background`);
            // Clear local streaming state since we're switching away — the UI for
            // the new session should not show streaming indicators from the old session.
            this._streamingMessageId = undefined;
            if (this._streamingDoneTimer) {
                clearTimeout(this._streamingDoneTimer);
                this._streamingDoneTimer = undefined;
            }
            this._isStreaming = false;
            this.onIsStreamingChangedEmitter.fire(false);
            this.resetStreamingStatus();
        }

        // Cancel any in-flight session load operation
        this.sessionLoadAbortController?.abort();
        this.sessionLoadAbortController = new AbortController();
        const signal = this.sessionLoadAbortController.signal;

        // Require active project
        if (!this._activeProject) {
            const errorMsg = 'No active project. Call setActiveProject() first.';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // T2-11: Set loading state using counter
        this.incrementLoading();

        try {
            // Fetch session
            const session = await this.openCodeService.getSession(this._activeProject.id, sessionId);
            
            // Check if this operation was cancelled while waiting for RPC
            if (signal.aborted) {
                this.logger.debug(`[SessionService] Session load cancelled (stale operation for ${sessionId})`);
                return; // Ignore stale response
            }

            // Clear messages from previous session BEFORE updating session
            this._messages = [];
            this._pendingQuestions = [];
            this._pendingPermissions = [];
            this.onQuestionChangedEmitter.fire([]);
            this.onPermissionChangedEmitter.fire([]);
            this.onMessagesChangedEmitter.fire([...this._messages]);
            this.logger.debug('[SessionService] State: messages cleared');

            // Update active session
            this._activeSession = session;
            this.onActiveSessionChangedEmitter.fire(session);
            this.logger.debug(`[SessionService] State: activeSession=${session.id}`);

            // BUG-4: Restore the model that was used in this session
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sessionModel = (session as any).model as { providerID?: string; modelID?: string } | undefined;
            if (sessionModel?.providerID && sessionModel?.modelID) {
                const modelId = `${sessionModel.providerID}/${sessionModel.modelID}`;
                this.setActiveModel(modelId);
                this.logger.debug(`[SessionService] Restored model from session: ${modelId}`);
            }

            // Persist to localStorage
            window.localStorage.setItem('openspace.activeSessionId', sessionId);

            // Mark this session as seen (clears blue unseen dot)
            this._notificationService?.markSeen(sessionId);

            // Reconnect SSE to the session's actual directory (may differ from project worktree)
            if (session.directory) {
                try {
                    await this.openCodeService.connectToProject(session.directory);
                    this.logger.debug(`[SessionService] SSE reconnected for session directory: ${session.directory}`);
                } catch (sseError) {
                    this.logger.warn('[SessionService] Failed to reconnect SSE for session (non-fatal):', sseError);
                }
            }

            // Load messages for the new session
            await this.loadMessages();
            if (signal.aborted) { return; }

            // Restore session status for the UI — if this session was running in the
            // background, the cached status in _sessionStatuses tells the UI to show
            // busy/streaming indicators.
            const cachedStatus = this._sessionStatuses.get(sessionId);
            if (cachedStatus) {
                this.onSessionStatusChangedEmitter.fire(cachedStatus);
            }

            // Load any pending questions that were created before the SSE connection
            // (e.g., questions from a previous server session that are still unanswered)
            await this.loadPendingQuestions(sessionId);
            
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error('[SessionService] Error in setActiveSession:', error);
            // If the persisted session no longer exists on the backend, clear stale local state
            // so we don't keep retrying it on subsequent loads.
            if (err.message?.includes('Session not found')) {
                this.logger.warn(`[SessionService] Clearing stale session ID from localStorage: ${sessionId}`);
                window.localStorage.removeItem('openspace.activeSessionId');
                this._activeSession = undefined;
                this._messages = [];
                this.onActiveSessionChangedEmitter.fire(undefined);
                this.onMessagesChangedEmitter.fire([]);
            }
            this._lastError = err.message || String(error);
            this.onErrorChangedEmitter.fire(this._lastError);
            throw error;
        } finally {
            // T2-11: Clear loading state using counter
            this.decrementLoading();
        }
    }

    /**
     * Set the active model for the current session.
     * Model format: "provider/model" (e.g., "anthropic/claude-sonnet-4-5")
     * 
     * @param model - Model ID in provider/model format
     */
    setActiveModel(model: string): void {
        this.logger.info(`[SessionService] Operation: setActiveModel(${model})`);
        this._activeModel = model;
        this.onActiveModelChangedEmitter.fire(model);
        this.logger.debug(`[SessionService] State: activeModel=${model}`);
    }

    /**
     * Get available models from the OpenCode server.
     * Uses the active project's directory if available.
     * 
     * @returns Array of providers with their models
     */
    async getAvailableModels(): Promise<ProviderWithModels[]> {
        this.logger.info('[SessionService] Operation: getAvailableModels()');
        
        try {
            const directory = this._activeProject?.worktree;
            const providers = await this.openCodeService.getAvailableModels(directory);
            this.logger.debug(`[SessionService] Found ${providers.length} providers`);
            return providers;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error fetching models: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            return [];
        }
    }

    /**
     * Create a new session and set it as active.
     * Requires active project to be set.
     * 
     * @param title - Optional session title
     * @returns Created session
     * @throws Error if no active project
     */
    async createSession(title?: string): Promise<Session> {
        this.logger.info(`[SessionService] Operation: createSession(${title || 'untitled'})`);

        // If no active project, try to auto-select the first available project
        if (!this._activeProject) {
            this.logger.debug('[SessionService] No active project, fetching available projects...');
            try {
                const projects = await this.openCodeService.getProjects();
                if (projects.length > 0) {
                    this.logger.debug(`[SessionService] Auto-selecting first project: ${projects[0].id}`);
                    await this.setActiveProject(projects[0].id);
                } else {
                    const errorMsg = 'No projects available on OpenCode server';
                    this.logger.error(`[SessionService] Error: ${errorMsg}`);
                    this._lastError = errorMsg;
                    this.onErrorChangedEmitter.fire(errorMsg);
                    throw new Error(errorMsg);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.logger.error(`[SessionService] Error getting projects: ${errorMsg}`);
                this._lastError = errorMsg;
                this.onErrorChangedEmitter.fire(errorMsg);
                throw new Error(`No active project: ${errorMsg}`);
            }
        }

        // Require active project
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // T2-11: Set loading state using counter
        this.incrementLoading();

        try {
            // Gate on hub readiness before creating a session that needs MCP tools
            this.logger.info('[SessionService] Waiting for Hub MCP server to be ready...');
            await this.waitForHub();
            this.logger.info('[SessionService] Hub is ready, proceeding with session creation');

            // Create session via backend
            const mcpConfig = this.getMcpConfig();
            this.logger.info('[SessionService] MCP config: ' + (mcpConfig ? 'found' : 'not found'));
            const session = await this.openCodeService.createSession(this._activeProject.id, { title, mcp: mcpConfig });

            this.logger.debug(`[SessionService] Created session: ${session.id}`);

            // Call init to run the INIT command (sets up git tracking, etc.)
            try {
                await this.openCodeService.initSession(this._activeProject.id, session.id);
                this.logger.debug(`[SessionService] Session initialized: ${session.id}`);
            } catch (initError) {
                // Init failure is non-fatal — session can still be used
                this.logger.warn(`[SessionService] Session init failed (non-fatal): ${initError}`);
            }

            // Set as active session
            await this.setActiveSession(session.id);

            return session;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            // T2-11: Clear loading state using counter
            this.decrementLoading();
        }
    }

    /**
     * Send a message to the active session with optimistic updates.
     * Requires active project and session to be set.
     * 
     * Flow:
     * 1. Create optimistic message with temp ID
     * 2. Add to messages array and fire event (UI updates immediately)
     * 3. Call backend API
     * 4. Replace optimistic message with server response
     * 5. On error, rollback optimistic message
     * 
     * @param parts - Message parts (text, file, image, etc.)
     * @throws Error if no active project or session
     */
    async sendMessage(parts: MessagePartInput[], model?: { providerID: string; modelID: string }): Promise<void> {
        this.logger.info(`[SessionService] Operation: sendMessage(${parts.length} parts, model: ${model ? `${model.providerID}/${model.modelID}` : 'none'})`);

        // Require active project and session
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        if (!this._activeSession) {
            const errorMsg = 'No active session';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // Create optimistic message (SDK UserMessage type)
        // Note: parts are input types (without IDs), server will return full Part types
        // T3-6: Use crypto.randomUUID() instead of Date.now() to avoid ID collisions
        const optimisticMsg: Message = {
            id: `temp-${crypto.randomUUID()}`,
            sessionID: this._activeSession.id,
            role: 'user',
            time: {
                created: Date.now()
            },
            agent: model?.providerID || 'unknown',
            model: {
                providerID: model?.providerID || 'unknown',
                modelID: model?.modelID || 'unknown'
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parts: parts as any // Input parts will be converted to full parts by server
        } as Message;

        // Add optimistic message immediately (UI updates)
        this._messages.push(optimisticMsg);
        this.onMessagesChangedEmitter.fire([...this._messages]);

        this.logger.debug(`[SessionService] Added optimistic message: ${optimisticMsg.id}`);

        // Set streaming state
        this._isStreaming = true;
        this.onIsStreamingChangedEmitter.fire(true);

        try {
            // Call backend to create message
            // Model is passed as top-level parameter (not in message metadata)
            // Note: parts are input types, server accepts them and returns full Part types
            const result = await this.openCodeService.createMessage(
                this._activeProject.id,
                this._activeSession.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { parts: parts as any },
                model
            );

            // SSE is the single authoritative channel for assistant message delivery.
            // The RPC result is used only as a timeout-based fallback in case SSE fails
            // to deliver the message (e.g. SSE disconnected during the turn).
            const assistantMessage: Message = {
                ...result.info,
                parts: result.parts || []
            };

            // Cancel any previous fallback timer (shouldn't exist, but be safe)
            if (this._rpcFallbackTimer) {
                clearTimeout(this._rpcFallbackTimer);
                this._rpcFallbackTimer = undefined;
            }

            // Start a fallback timer: if SSE hasn't delivered this message within
            // RPC_FALLBACK_DELAY_MS, insert it from the RPC result.
            this._rpcFallbackTimer = setTimeout(() => {
                this._rpcFallbackTimer = undefined;
                const alreadyExists = this._messages.some(m => m.id === assistantMessage.id);
                if (!alreadyExists) {
                    // If the RPC result has empty parts (common when SSE missed streaming events),
                    // fetch the full message from the REST API as a safety net.
                    if (!assistantMessage.parts || assistantMessage.parts.length === 0) {
                        this.logger.info(`[SessionService] SSE fallback: RPC result has empty parts, fetching full message: ${assistantMessage.id}`);
                        this.fetchAndInsertFallbackMessage(assistantMessage);
                    } else {
                        this.logger.info(`[SessionService] SSE fallback: inserting assistant message from RPC result: ${assistantMessage.id}`);
                        this.appendMessage(assistantMessage);
                    }
                } else {
                    this.logger.debug(`[SessionService] SSE fallback: message already delivered by SSE: ${assistantMessage.id}`);
                }
            }, this.RPC_FALLBACK_DELAY_MS);

            this.logger.debug(`[SessionService] RPC returned assistant message ${assistantMessage.id}, waiting for SSE delivery (fallback in ${this.RPC_FALLBACK_DELAY_MS}ms)`);

            this.logger.debug(`[SessionService] State: messages=${this._messages.length}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error: ${errorMsg}`);

            // Rollback optimistic message on error
            this._messages = this._messages.filter(m => m.id !== optimisticMsg.id);
            this.onMessagesChangedEmitter.fire([...this._messages]);

            this.logger.debug(`[SessionService] Rolled back optimistic message: ${optimisticMsg.id}`);

            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            // The RPC promise resolves when the HTTP response arrives, but SSE streaming
            // continues for the actual assistant turn. Do NOT unconditionally kill streaming
            // here — let SSE events (message.completed → updateStreamingMessage(id,'',true))
            // handle the transition via the 500ms hysteresis timer.
            //
            // We only force-stop streaming if no SSE activity is ongoing (no pending done
            // timer and no active streaming message). This handles the edge case where the
            // RPC itself failed before any SSE events arrived.
            if (!this._streamingDoneTimer && !this._streamingMessageId) {
                this._isStreaming = false;
                this.onIsStreamingChangedEmitter.fire(false);
                this.resetStreamingStatus();
            }
        }
    }

    /**
     * Fetch the full message from the REST API and insert it as a fallback.
     * Used when the RPC createMessage result has empty parts (SSE missed streaming events).
     * If the fetch fails, inserts the original message as a last resort.
     */
    private async fetchAndInsertFallbackMessage(fallbackMessage: Message): Promise<void> {
        try {
            if (this._activeProject && this._activeSession) {
                const fullMsg = await this.openCodeService.getMessage(
                    this._activeProject.id,
                    this._activeSession.id,
                    fallbackMessage.id
                );
                const messageWithParts: Message = {
                    ...fullMsg.info,
                    parts: fullMsg.parts || []
                };
                // Check again — SSE may have delivered it while we were fetching
                if (!this._messages.some(m => m.id === fallbackMessage.id)) {
                    this.logger.info(`[SessionService] SSE fallback: inserting full message from getMessage: ${fallbackMessage.id} (${messageWithParts.parts?.length || 0} parts)`);
                    this.appendMessage(messageWithParts);
                }
            }
        } catch (error) {
            this.logger.warn(`[SessionService] SSE fallback: getMessage failed, inserting original: ${error}`);
            if (!this._messages.some(m => m.id === fallbackMessage.id)) {
                this.appendMessage(fallbackMessage);
            }
        }
    }

    /**
     * Abort the current streaming message.
     * Requires active project and session to be set.
     * 
     * @throws Error if no active project or session
     */
    async abort(): Promise<void> {
        this.logger.info(`[SessionService] Operation: abort()`);

        // Require active project and session
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        if (!this._activeSession) {
            const errorMsg = 'No active session';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            // Call backend to abort session
            await this.openCodeService.abortSession(this._activeProject.id, this._activeSession.id);

            this.logger.debug(`[SessionService] Aborted session: ${this._activeSession.id}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            // Cancel RPC fallback timer on abort
            if (this._rpcFallbackTimer) {
                clearTimeout(this._rpcFallbackTimer);
                this._rpcFallbackTimer = undefined;
            }
            // Always clear streaming state
            this._streamingMessageId = undefined;
            if (this._streamingDoneTimer) {
                clearTimeout(this._streamingDoneTimer);
                this._streamingDoneTimer = undefined;
            }
            this._isStreaming = false;
            this.onIsStreamingChangedEmitter.fire(false);
            this.resetStreamingStatus();
        }
    }

    /**
     * Get all sessions for the active project.
     * 
     * @returns Array of sessions, or empty array if no active project or error
     */
    async getSessions(): Promise<Session[]> {
        this.logger.info('[SessionService] Operation: getSessions()');
        
        if (!this._activeProject) {
            // No active project is normal on startup - don't log as warning
            return [];
        }
        
        try {
            const PAGE_SIZE = 20;
            this._sessionLoadLimit = PAGE_SIZE;  // reset limit on fresh load
            const sessions = await this.openCodeService.getSessions(this._activeProject.id, { limit: PAGE_SIZE });
            this._hasMoreSessions = sessions.length === PAGE_SIZE;
            this._sessionCursor = sessions.length;
            this.logger.debug(`[SessionService] Found ${sessions.length} sessions`);
            return sessions;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error fetching sessions: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            return [];
        }
    }

    get hasMoreSessions(): boolean {
        return this._hasMoreSessions;
    }

    get hasOlderMessages(): boolean {
        return this._hasOlderMessages;
    }

    async loadOlderMessages(): Promise<void> {
        if (!this._hasOlderMessages || !this._activeSession || !this._activeProject) { return; }
        try {
            const older = await this.openCodeService.getMessages(
                this._activeProject.id, this._activeSession.id, 400, this._messageLoadCursor
            );
            const olderMapped = older.map(m => ({ ...m.info, parts: m.parts ?? [] }));
            this._messages = [...olderMapped, ...this._messages];
            this._messageLoadCursor = older[0]?.info?.time?.created?.toString();
            this._hasOlderMessages = older.length === 400;
            this.onMessagesChangedEmitter.fire([...this._messages]);
        } catch (error) {
            this.logger.warn(`[SessionService] loadOlderMessages error: ${error}`);
        }
    }

    async searchSessions(query: string): Promise<Session[]> {
        if (!this._activeProject) { return []; }
        try {
            return await this.openCodeService.getSessions(this._activeProject.id, { search: query, limit: 50 });
        } catch {
            return [];
        }
    }

    async loadMoreSessions(): Promise<Session[]> {
        if (!this._hasMoreSessions || !this._activeProject) { return []; }
        try {
            const PAGE_SIZE = 20;
            // The OpenCode API ignores the `start` offset param — it always returns
            // from the newest session.  Work around this by fetching a larger batch
            // (currentLimit + PAGE_SIZE) and returning only the NEW tail slice.
            this._sessionLoadLimit += PAGE_SIZE;
            const all = await this.openCodeService.getSessions(this._activeProject.id, {
                limit: this._sessionLoadLimit
            });
            this._hasMoreSessions = all.length === this._sessionLoadLimit;
            const newItems = all.slice(this._sessionCursor);
            this._sessionCursor = all.length;
            this.logger.debug(`[SessionService] Loaded ${newItems.length} more sessions (total fetched: ${all.length})`);
            return newItems;
        } catch (error) {
            this.logger.warn(`[SessionService] loadMoreSessions error: ${error}`);
            return [];
        }
    }

    async forkSession(messageId?: string): Promise<void> {
        if (!this._activeSession || !this._activeProject) { return; }
        this.logger.info(`[SessionService] Operation: forkSession(${this._activeSession.id})`);
        const forked = await this.openCodeService.forkSession(this._activeProject.id, this._activeSession.id, messageId);
        await this.setActiveSession(forked.id);
    }

    async revertSession(): Promise<void> {
        if (!this._activeSession || !this._activeProject) { return; }
        this.logger.info(`[SessionService] Operation: revertSession(${this._activeSession.id})`);
        const updated = await this.openCodeService.revertSession(this._activeProject.id, this._activeSession.id);
        this.notifySessionChanged(updated);
    }

    async unrevertSession(): Promise<void> {
        if (!this._activeSession || !this._activeProject) { return; }
        this.logger.info(`[SessionService] Operation: unrevertSession(${this._activeSession.id})`);
        const updated = await this.openCodeService.unrevertSession(this._activeProject.id, this._activeSession.id);
        this.notifySessionChanged(updated);
    }

    async compactSession(): Promise<void> {
        if (!this._activeSession || !this._activeProject) { return; }
        this.logger.info(`[SessionService] Operation: compactSession(${this._activeSession.id})`);
        await this.openCodeService.compactSession(this._activeProject.id, this._activeSession.id);
        // session.compacted SSE will refresh the message list
    }

    async renameSession(sessionId: string, title: string): Promise<void> {
        if (!this._activeProject) { return; }
        this.logger.info(`[SessionService] Operation: renameSession(${sessionId}, ${title})`);
        const updated = await this.openCodeService.renameSession(this._activeProject.id, sessionId, title);
        this.notifySessionChanged(updated);
    }

    /**
     * Delete a session.
     * If the deleted session was active, clears active session and messages.
     * 
     * @param sessionId - ID of the session to delete
     * @throws Error if no active project
     */
     async deleteSession(sessionId: string): Promise<void> {
         this.logger.info(`[SessionService] Operation: deleteSession(${sessionId})`);
         
         if (!this._activeProject) {
             const errorMsg = 'No active project';
             this.logger.error(`[SessionService] Error: ${errorMsg}`);
             throw new Error(errorMsg);
         }
         
         // T2-11: Set loading state using counter
         this.incrementLoading();
         
         try {
             // Build list of IDs to delete: target + all descendants
             // Fetch current session list to find children
              let allSessions: Session[] = [];
              try {
                  allSessions = (await this.openCodeService.getSessions(this._activeProject.id, {})) ?? [];
              } catch {
                  // If we can't fetch sessions, fall back to deleting only the target
              }
             const toDelete = [sessionId, ...this.findDescendantSessionIds(allSessions, sessionId)];
             this.logger.debug(`[SessionService] Cascade deleting ${toDelete.length} session(s): ${toDelete.join(', ')}`);

             await Promise.all(toDelete.map(id => this.openCodeService.deleteSession(this._activeProject!.id, id)));
             
             this.logger.debug(`[SessionService] Deleted session: ${sessionId}`);
             
             // If deleted session was active, clear active session
             if (this._activeSession?.id === sessionId) {
                 this._activeSession = undefined;
                 this._messages = [];
                 window.localStorage.removeItem('openspace.activeSessionId');
                 this.onActiveSessionChangedEmitter.fire(undefined);
                 this.onMessagesChangedEmitter.fire([]);
                 this.logger.debug('[SessionService] Cleared active session (was deleted)');
             }
         } catch (error) {
             const errorMsg = error instanceof Error ? error.message : String(error);
             this.logger.error(`[SessionService] Error: ${errorMsg}`);
             this._lastError = errorMsg;
             this.onErrorChangedEmitter.fire(errorMsg);
             throw error;
         } finally {
             // T2-11: Clear loading state using counter
             this.decrementLoading();
         }
     }

    /**
     * Returns all descendant session IDs (children, grandchildren, etc.) via DFS.
     */
    private findDescendantSessionIds(allSessions: Session[], rootId: string): string[] {
        const children = allSessions
            .filter(s => (s as unknown as { parentID?: string }).parentID === rootId)
            .map(s => s.id);
        return [...children, ...children.flatMap(c => this.findDescendantSessionIds(allSessions, c))];
    }

    async archiveSession(sessionId: string): Promise<void> {
        this.logger.info(`[SessionService] Operation: archiveSession(${sessionId})`);

        if (!this._activeProject) {
            const errorMsg = 'No active project';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        this.incrementLoading();

        try {
            await this.openCodeService.archiveSession(this._activeProject.id, sessionId);
            this.logger.debug(`[SessionService] Archived session: ${sessionId}`);

            // If archived session was active, clear active session
            if (this._activeSession?.id === sessionId) {
                this._activeSession = undefined;
                this._messages = [];
                window.localStorage.removeItem('openspace.activeSessionId');
                this.onActiveSessionChangedEmitter.fire(undefined);
                this.onMessagesChangedEmitter.fire([]);
                this.logger.debug('[SessionService] Cleared active session (was archived)');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            this.decrementLoading();
        }
    }

    /**
     * Rename a session (update its title).
     * Fires onActiveSessionChangedEmitter after updating.
     *
     * @param sessionId - ID of the session to rename
     * @param title - New title
     * @throws Error if no active project
     */
    async renameSession(sessionId: string, title: string): Promise<void> {
        this.logger.info(`[SessionService] Operation: renameSession(${sessionId}, "${title}")`);

        if (!this._activeProject) {
            const errorMsg = 'No active project';
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        this.incrementLoading();

        try {
            const updated = await this.openCodeService.renameSession(this._activeProject.id, sessionId, title);
            this.logger.debug(`[SessionService] Renamed session: ${sessionId}`);

            // Reflect the rename in the active session cache
            if (this._activeSession?.id === sessionId) {
                this._activeSession = updated;
                this.onActiveSessionChangedEmitter.fire(updated);
            } else {
                // Fire a generic event so session lists can refresh
                this.onActiveSessionChangedEmitter.fire(this._activeSession);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            this.decrementLoading();
        }
    }

    async shareSession(sessionId: string): Promise<Session> {
        this.logger.info(`[SessionService] Operation: shareSession(${sessionId})`);
        if (!this._activeProject) { throw new Error('No active project'); }
        this.incrementLoading();
        try {
            const updated = await this.openCodeService.shareSession(this._activeProject.id, sessionId);
            if (this._activeSession?.id === sessionId) {
                this._activeSession = updated;
                this.onActiveSessionChangedEmitter.fire(updated);
            }
            return updated;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] shareSession error: ${errorMsg}`);
            throw error;
        } finally {
            this.decrementLoading();
        }
    }

    async unshareSession(sessionId: string): Promise<void> {
        this.logger.info(`[SessionService] Operation: unshareSession(${sessionId})`);
        if (!this._activeProject) { throw new Error('No active project'); }
        this.incrementLoading();
        try {
            await this.openCodeService.unshareSession(this._activeProject.id, sessionId);
            if (this._activeSession?.id === sessionId) {
                const updated = { ...this._activeSession, share: undefined } as Session;
                this._activeSession = updated;
                this.onActiveSessionChangedEmitter.fire(updated);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] unshareSession error: ${errorMsg}`);
            throw error;
        } finally {
            this.decrementLoading();
        }
    }

    /**
     * Load messages for the active session.
     * Private method called automatically when session changes.
     */
    async reloadMessages(): Promise<void> {
        return this.loadMessages();
    }

    /**
     * Fetch the last 5 messages for any session (for hover preview).
     * Does NOT change active session or message state.
     */
    async getMessagesForPreview(sessionId: string): Promise<Message[]> {
        if (!this._activeProject) { return []; }
        try {
            const msgs = await this.openCodeService.getMessages(this._activeProject.id, sessionId, 5);
            return msgs.map(m => ({ ...m.info, parts: m.parts ?? [] }));
        } catch {
            return [];
        }
    }

    private async loadMessages(): Promise<void> {
        if (!this._activeSession || !this._activeProject) {
            return;
        }

        this.logger.debug(`[SessionService] Loading messages for session: ${this._activeSession.id}`);

        // T2-11: Set loading state using counter
        this.incrementLoading();

        try {
            // Fetch messages from backend
            const messagesWithParts = await this.openCodeService.getMessages(
                this._activeProject.id,
                this._activeSession.id,
                400
            );

            // Convert MessageWithParts[] to Message[] (combine info + parts)
            this._messages = messagesWithParts.map(m => ({
                ...m.info,
                parts: m.parts || []
            }));
            // Track whether there might be older messages beyond this page
            this._hasOlderMessages = messagesWithParts.length === 400;
            this._messageLoadCursor = messagesWithParts[0]?.info?.id;
            this.onMessagesChangedEmitter.fire([...this._messages]);

            this.logger.debug(`[SessionService] Loaded ${this._messages.length} messages`);
            this.logger.debug(`[SessionService] State: messages=${this._messages.length}`);

            // BUG-4 (revised): Restore active model from the most recent assistant message.
            // The session list API does not include a model field; the model is stored on
            // individual assistant message info objects as providerID + modelID.
            // Always restore on session switch (don't gate on !this._activeModel) so that
            // switching between sessions that used different models updates the selector.
            for (let i = this._messages.length - 1; i >= 0; i--) {
                const msg = this._messages[i] as Message & { providerID?: string; modelID?: string };
                if (msg.role === 'assistant' && msg.providerID && msg.modelID) {
                    const restored = `${msg.providerID}/${msg.modelID}`;
                    this.setActiveModel(restored);
                    this.logger.debug(`[SessionService] Restored model from messages: ${restored}`);
                    break;
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error loading messages: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            // Don't throw - loading messages is not critical enough to fail the session change
        } finally {
            // T2-11: Clear loading state using counter
            this.decrementLoading();
        }
    }

    /**
     * Load pending questions for a session from the REST API.
     * This handles questions that were created before the SSE connection was established
     * (e.g., from a previous server session that are still awaiting an answer).
     *
     * @param sessionId - The session ID to load pending questions for
     */
    private async loadPendingQuestions(sessionId: string): Promise<void> {
        if (!this._activeProject) {
            return;
        }
        try {
            const questions = await this.openCodeService.listPendingQuestions(this._activeProject.id, sessionId);
            if (questions.length > 0) {
                this.logger.info(`[SessionService] Loaded ${questions.length} pending question(s) for session ${sessionId}`);
                for (const q of questions) {
                    this.addPendingQuestion(q);
                }
            }
        } catch (error) {
            // Non-fatal: if listing questions fails, we fall back to SSE-only delivery
            this.logger.warn('[SessionService] Failed to load pending questions (non-fatal):', error);
        }
    }

    /**
     * Append a new message to the messages array (for external events like message.created).
     * Prevents duplicate messages by checking ID.
     * 
     * @param message - Message to append
     */
    appendMessage(message: Message): void {
        this.logger.debug(`[SessionService] Appending message: ${message.id}`);

        // Check if message already exists (prevent duplicates)
        const exists = this._messages.some(m => m.id === message.id);
        if (exists) {
            this.logger.debug(`[SessionService] appendMessage: skipping duplicate: ${message.id}`);
            return;
        }

        // If SSE is delivering an assistant message, cancel the RPC fallback timer.
        // SSE is the authoritative channel — once it delivers anything, no fallback needed.
        if (message.role === 'assistant' && this._rpcFallbackTimer) {
            clearTimeout(this._rpcFallbackTimer);
            this._rpcFallbackTimer = undefined;
            this.logger.debug(`[SessionService] Cancelled RPC fallback timer: SSE delivered assistant message ${message.id}`);
        }

        this._messages.push(message);
        this.onMessagesChangedEmitter.fire([...this._messages]);

        // Increment unseen count for background sessions (non-active)
        if (message.sessionID && message.sessionID !== this._activeSession?.id && this._notificationService) {
            this._notificationService.incrementUnseen(message.sessionID);
        }
    }

    /**
     * Update a streaming message with incremental text delta.
     * Fires streaming events for UI updates and appends delta to the last text part.
     * 
     * @param messageId - ID of the message to update
     * @param delta - Text delta to append
     * @param isDone - Whether streaming is complete
     */
    updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void {
        // SSE completed delivery — cancel RPC fallback timer if running
        if (this._rpcFallbackTimer) {
            clearTimeout(this._rpcFallbackTimer);
            this._rpcFallbackTimer = undefined;
            this.logger.debug(`[SessionService] Cancelled RPC fallback timer: SSE completed message ${messageId}`);
        }

        this.logger.debug(`[SessionService] Streaming update: ${messageId}, isDone=${isDone}`);

        // Track which message is streaming
        if (!isDone) {
            this._streamingMessageId = messageId;
            // Cancel any pending done timer when new streaming activity arrives
            if (this._streamingDoneTimer) {
                clearTimeout(this._streamingDoneTimer);
                this._streamingDoneTimer = undefined;
            }
            if (!this._isStreaming) {
                this._isStreaming = true;
                this.onIsStreamingChangedEmitter.fire(true);
            }
            // Update dynamic streaming status
            this.updateStreamingStatus(this._messages);
        }

        // Fire streaming event for incremental updates
        if (!isDone) {
            this.onMessageStreamingEmitter.fire({ messageId, delta, isDone });
        }

        // Only modify parts if there's actual text delta to append.
        // Empty deltas are used purely for streaming state tracking.
        if (delta) {
            // Find message in array
            const index = this._messages.findIndex(m => m.id === messageId);
            if (index < 0) {
                this.logger.warn(`[SessionService] Streaming message not found: ${messageId}`);
            } else {
                // Append delta to the last text part
                const message = this._messages[index];
                const parts = [...(message.parts || [])];

                if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
                    // Append to existing text part
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const lastPart = parts[parts.length - 1] as any;
                    if ('text' in lastPart) {
                        parts[parts.length - 1] = { ...lastPart, text: lastPart.text + delta };
                    }
                } else {
                    // Create new text part (with required SDK fields if available)
                    parts.push({ 
                        type: 'text', 
                        text: delta,
                        id: `temp-part-${crypto.randomUUID()}`,
                        sessionID: message.sessionID,
                        messageID: message.id
                    } as unknown as NonNullable<Message['parts']>[0]);
                }

                // Update message with new parts
                this._messages[index] = { ...message, parts };
                this.onMessagesChangedEmitter.fire([...this._messages]);
            }
        }

        // Fire completion event
        if (isDone) {
            this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: true });
            this._streamingMessageId = undefined;
            // Don't set isStreaming=false immediately — wait STREAMING_DONE_DELAY_MS
            // to avoid flicker when a new message starts right after this one completes.
            if (this._streamingDoneTimer) {
                clearTimeout(this._streamingDoneTimer);
            }
            this._streamingDoneTimer = setTimeout(() => {
                this._streamingDoneTimer = undefined;
                this._isStreaming = false;
                this.onIsStreamingChangedEmitter.fire(false);
                this.resetStreamingStatus();
            }, this.STREAMING_DONE_DELAY_MS);
        }
    }

    /**
     * Upsert tool parts into a streaming message's parts array.
     * Called when message.part.updated SSE events carry tool parts (not text deltas).
     * Fires onMessagesChanged to trigger React re-render.
     *
     * @param messageId - ID of the message to update
     * @param toolParts - Array of tool parts to upsert (matched by part.id)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStreamingMessageParts(messageId: string, toolParts: any[]): void {
        if (!toolParts || toolParts.length === 0) return;

        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            this.logger.warn(`[SessionService] updateStreamingMessageParts: message not found: ${messageId}`);
            return;
        }

        const message = this._messages[index];
        const parts = [...(message.parts || [])];

        for (const incoming of toolParts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingIndex = parts.findIndex(p => (p as any).id === incoming.id);
            if (existingIndex >= 0) {
                // Replace existing part with updated state
                parts[existingIndex] = incoming;
            } else {
                // Insert tool part before the last text part (if any), otherwise append
                const lastTextIndex = parts.reduce((acc, p, i) => p.type === 'text' ? i : acc, -1);
                if (lastTextIndex >= 0) {
                    parts.splice(lastTextIndex, 0, incoming);
                } else {
                    parts.push(incoming);
                }
            }
        }

        this._messages[index] = { ...message, parts };
        this.onMessagesChangedEmitter.fire([...this._messages]);
        // Notify streaming subscribers so ChatComponent's streamingMessageId reflects tool-only messages
        this.onMessageStreamingEmitter.fire({ messageId, delta: '', isDone: false });
        // Update dynamic streaming status based on latest tool parts
        this.updateStreamingStatus(this._messages);
        this.logger.debug(`[SessionService] Tool parts upserted for message: ${messageId}, count=${toolParts.length}`);
    }

    /**
     * Replace an existing message (for message.completed events).
     * 
     * @param messageId - ID of the message to replace
     * @param message - New message to replace with
     */
    replaceMessage(messageId: string, message: Message): void {
        this.logger.debug(`[SessionService] Replacing message: ${messageId}`);

        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            this.logger.warn(`[SessionService] Message not found for replacement: ${messageId}`);
            return;
        }

        this._messages[index] = message;
        this.onMessagesChangedEmitter.fire([...this._messages]);
    }

    async fetchMessageFromBackend(messageId: string): Promise<Message | undefined> {
        if (!this._activeProject || !this._activeSession) {
            return undefined;
        }

        try {
            const fullMessage = await this.openCodeService.getMessage(
                this._activeProject.id,
                this._activeSession.id,
                messageId
            );
            return {
                ...fullMessage.info,
                parts: fullMessage.parts || []
            } as Message;
        } catch (error) {
            this.logger.debug(`[SessionService] fetchMessageFromBackend failed for ${messageId}: ${error}`);
            return undefined;
        }
    }

    /**
     * Update active session from external event (backend SSE).
     * Only updates if this is the currently active session.
     * 
     * @param session - Updated session data
     */
    notifySessionChanged(session: Session): void {
        this.logger.debug(`[SessionService] External session update: ${session.id}`);

        // Only update if this is the active session
        if (this._activeSession?.id !== session.id) {
            this.logger.debug('[SessionService] Ignoring update for non-active session');
            return;
        }

        this._activeSession = session;
        this.onActiveSessionChangedEmitter.fire(session);
    }

    /**
     * Clear active session if it was deleted externally.
     * Only clears if this is the currently active session.
     * 
     * @param sessionId - ID of the deleted session
     */
    notifySessionDeleted(sessionId: string): void {
        this.logger.debug(`[SessionService] External session deletion: ${sessionId}`);

        // Only clear if this is the active session
        if (this._activeSession?.id !== sessionId) {
            this.logger.debug('[SessionService] Ignoring deletion of non-active session');
            return;
        }

        this._activeSession = undefined;
        this._messages = [];
        this._sessionStatuses.delete(sessionId);
        window.localStorage.removeItem('openspace.activeSessionId');
        this.onActiveSessionChangedEmitter.fire(undefined);
        this.onMessagesChangedEmitter.fire([]);
    }

    /**
     * Called by SyncService when a session.error SSE event is received.
     * Sets the error state so the UI can display it.
     */
    notifySessionError(sessionId: string, errorMessage: string): void {
        this._sessionErrors.set(sessionId, errorMessage);
        if (this._activeSession?.id !== sessionId) { return; }
        this._lastError = errorMessage;
        this.onErrorChangedEmitter.fire(errorMessage);
        this.logger.warn(`[SessionService] Session error: ${errorMessage}`);
    }

    /**
     * Called by SyncService when a message.removed SSE event is received.
     * Removes the message from the in-memory list.
     */
    notifyMessageRemoved(sessionId: string, messageId: string): void {
        if (this._activeSession?.id !== sessionId) { return; }
        this._messages = this._messages.filter(m => m.id !== messageId);
        this.onMessagesChangedEmitter.fire([...this._messages]);
        this.logger.debug(`[SessionService] Message removed: ${messageId}`);
    }

    /**
     * Called by SyncService when a message.part.removed SSE event is received.
     * Removes the specific part from the message.
     */
    notifyPartRemoved(sessionId: string, messageId: string, partId: string): void {
        if (this._activeSession?.id !== sessionId) { return; }
        this._messages = this._messages.map(m => {
            if (m.id !== messageId) { return m; }
            return { ...m, parts: (m.parts ?? []).filter(p => p.id !== partId) };
        });
        this.onMessagesChangedEmitter.fire([...this._messages]);
        this.logger.debug(`[SessionService] Part removed: ${partId} from message ${messageId}`);
    }

    /**
     * Update session status from server-authoritative SSE event.
     * This is the definitive busy/idle signal that spans the entire agent turn,
     * including gaps between tool rounds.
     */
    updateSessionStatus(status: SDKTypes.SessionStatus, sessionId?: string): void {
        const id = sessionId ?? this._activeSession?.id;
        if (!id) { return; }
        this.logger.debug(`[SessionService] Session status [${id}]: ${status.type}`);
        this._sessionStatuses.set(id, status);
        // Clear error dot when a new turn starts (busy) or session returns to idle
        if (status.type === 'busy' || status.type === 'idle') {
            this._sessionErrors.delete(id);
        }
        this.onSessionStatusChangedEmitter.fire(status);
    }

    getSessionStatus(sessionId: string): SDKTypes.SessionStatus | undefined {
        return this._sessionStatuses.get(sessionId);
    }

    getSessionError(sessionId: string): string | undefined {
        return this._sessionErrors.get(sessionId);
    }

    /**
     * Apply a field-level delta to a specific part in a message.
     * This is the high-frequency streaming path — called once per token.
     *
     * Finds the part by partID and appends delta to the specified field.
     * If the part doesn't exist yet, creates a text part stub.
     *
     * @param messageId - Message containing the part
     * @param partId - Part to update
     * @param field - Field name to append to (e.g., 'text', 'reasoning')
     * @param delta - String to append
     */
    applyPartDelta(messageId: string, partId: string, field: string, delta: string): void {
        // SSE is actively streaming — cancel RPC fallback timer if running
        if (this._rpcFallbackTimer) {
            clearTimeout(this._rpcFallbackTimer);
            this._rpcFallbackTimer = undefined;
            this.logger.debug(`[SessionService] Cancelled RPC fallback timer: SSE streaming active for message ${messageId}`);
        }

        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            this.logger.warn(`[SessionService] applyPartDelta: message not found: ${messageId}`);
            return;
        }

        // Track streaming state
        this._streamingMessageId = messageId;
        // Cancel any pending done timer when new streaming activity arrives
        if (this._streamingDoneTimer) {
            clearTimeout(this._streamingDoneTimer);
            this._streamingDoneTimer = undefined;
        }
        if (!this._isStreaming) {
            this._isStreaming = true;
            this.onIsStreamingChangedEmitter.fire(true);
        }

        const message = this._messages[index];
        const parts = [...(message.parts || [])];

        // Find existing part by ID
        const partIndex = parts.findIndex(p => (p as { id?: string }).id === partId);
        if (partIndex >= 0) {
            // Append delta to existing part's field
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const part = { ...parts[partIndex] } as any;
            part[field] = (part[field] || '') + delta;
            parts[partIndex] = part;
        } else {
            // Part doesn't exist yet — create a stub.
            // Infer the correct part type from the field being streamed:
            //   'reasoning' field         → reasoning part
            //   'input' or 'output' field → tool part (tool call args or result streaming)
            //   anything else             → text part (default)
            const inferredType =
                field === 'reasoning'                    ? 'reasoning' :
                field === 'input' || field === 'output'  ? 'tool'      : 'text';
            const newPart: any = {
                id: partId,
                sessionID: message.sessionID,
                messageID: messageId,
                type: inferredType,
                [field]: delta
            };
            parts.push(newPart);
        }

        // Update message in-place then fire change
        this._messages[index] = { ...message, parts };
        this.onMessagesChangedEmitter.fire([...this._messages]);
        this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: false });
        // Update dynamic streaming status
        this.updateStreamingStatus(this._messages);
    }

    /**
     * Clear accumulated text/reasoning on all parts of a streaming message.
     *
     * Called before SSE reconnect replay so that replayed deltas don't
     * append on top of already-accumulated text (which would cause N× duplication).
     */
    clearStreamingPartText(messageId: string): void {
        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            return;
        }

        const message = this._messages[index];
        const parts = (message.parts || []).map((p: MessagePart) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const copy = { ...p } as any;
            if (copy.text !== undefined) {
                copy.text = '';
            }
            if (copy.reasoning !== undefined) {
                copy.reasoning = '';
            }
            return copy;
        });

        this._messages[index] = { ...message, parts };
        this.onMessagesChangedEmitter.fire([...this._messages]);
    }

    // =========================================================================
    // Streaming Status Methods
    // =========================================================================

    private computeStreamingStatus(messages: Message[]): string {
        // Find the last assistant message
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role !== 'assistant') continue;
            if (!msg.parts || msg.parts.length === 0) continue;
            // Find the last tool part in the message
            for (let j = msg.parts.length - 1; j >= 0; j--) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const part = msg.parts[j] as any;
                if (part.type === 'tool') {
                    return this.toolNameToCategory(part.tool || '');
                }
                if (part.type === 'reasoning') {
                    return 'reasoning';
                }
                if (part.type === 'text') {
                    return 'thinking';
                }
            }
        }
        return 'idle';
    }

    /**
     * Maps a tool name to a StreamingCategory key.
     * These keys are consumed by the streaming-vocab module in the browser
     * extension which resolves them to display phrases.
     */
    private toolNameToCategory(toolName: string): string {
        const name = toolName.toLowerCase();
        if (/^(bash|bash_\d+|execute|run_command|run|shell|cmd|terminal)$/.test(name)) return 'bash';
        if (/^task$/.test(name)) return 'task';
        if (/^(todowrite|todoread|todo_write|todo_read)$/.test(name)) return 'todo';
        if (/^read$/.test(name)) return 'read';
        if (/^(list|list_files|grep|glob|find|rg|ripgrep|ripgrep_search|ripgrep_advanced-search|ripgrep_count-matches|ripgrep_list-files|search)$/.test(name)) return 'search';
        if (/^(webfetch|web_fetch)$/.test(name)) return 'webfetch';
        if (/^(edit|write)$/.test(name)) return 'edit';
        return 'mcp';
    }

    private updateStreamingStatus(messages: Message[]): void {
        const newStatus = this.computeStreamingStatus(messages);
        if (newStatus === this._currentStreamingStatus) return;

        const now = Date.now();
        const elapsed = now - this._lastStatusChangeTime;
        const MIN_STATUS_INTERVAL = 2500;

        if (elapsed >= MIN_STATUS_INTERVAL) {
            this._currentStreamingStatus = newStatus;
            this._lastStatusChangeTime = now;
            this.onStreamingStatusChangedEmitter.fire(newStatus);
            if (this._statusChangeTimeout) {
                clearTimeout(this._statusChangeTimeout);
                this._statusChangeTimeout = undefined;
            }
        } else {
            if (this._statusChangeTimeout) clearTimeout(this._statusChangeTimeout);
            this._statusChangeTimeout = setTimeout(() => {
                const latestStatus = this.computeStreamingStatus(this._messages);
                this._currentStreamingStatus = latestStatus;
                this._lastStatusChangeTime = Date.now();
                this.onStreamingStatusChangedEmitter.fire(latestStatus);
                this._statusChangeTimeout = undefined;
            }, MIN_STATUS_INTERVAL - elapsed);
        }
    }

    private resetStreamingStatus(): void {
        this._currentStreamingStatus = '';
        this._lastStatusChangeTime = 0;
        if (this._statusChangeTimeout) {
            clearTimeout(this._statusChangeTimeout);
            this._statusChangeTimeout = undefined;
        }
        this.onStreamingStatusChangedEmitter.fire('');
    }

    // =========================================================================
    // Question Methods
    // =========================================================================

    addPendingQuestion(question: SDKTypes.QuestionRequest): void {
        this.logger.debug(`[SessionService] Adding pending question: ${question.id}`);
        // Replace existing or add new
        const existingIndex = this._pendingQuestions.findIndex(q => q.id === question.id);
        if (existingIndex >= 0) {
            this._pendingQuestions[existingIndex] = question;
        } else {
            this._pendingQuestions.push(question);
        }
        this.onQuestionChangedEmitter.fire([...this._pendingQuestions]);
    }

    removePendingQuestion(requestId: string): void {
        this.logger.debug(`[SessionService] Removing pending question: ${requestId}`);
        this._pendingQuestions = this._pendingQuestions.filter(q => q.id !== requestId);
        this.onQuestionChangedEmitter.fire([...this._pendingQuestions]);
    }

    get todos(): Array<{ id: string; description: string; status: string }> {
        return this._todos;
    }

    updateTodos(todos: Array<{ id: string; description: string; status: string }>): void {
        this._todos = todos;
        this.onTodosChangedEmitter.fire([...this._todos]);
    }

    async answerQuestion(requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<void> {
        this.logger.info(`[SessionService] Operation: answerQuestion(${requestId})`);
        if (!this._activeProject) {
            throw new Error('No active project');
        }
        try {
            await this.openCodeService.answerQuestion(this._activeProject.id, requestId, answers);
            // Remove from pending (SSE event will also remove it, but do it eagerly)
            this.removePendingQuestion(requestId);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error answering question: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        }
    }

    async rejectQuestion(requestId: string): Promise<void> {
        this.logger.info(`[SessionService] Operation: rejectQuestion(${requestId})`);
        if (!this._activeProject) {
            throw new Error('No active project');
        }
        try {
            await this.openCodeService.rejectQuestion(this._activeProject.id, requestId);
            // Remove from pending (SSE event will also remove it, but do it eagerly)
            this.removePendingQuestion(requestId);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error rejecting question: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        }
    }

    // =========================================================================
    // Permission Methods
    // =========================================================================

    addPendingPermission(permission: PermissionNotification): void {
        this.logger.debug(`[SessionService] Adding pending permission: ${permission.permissionId}`);
        // Replace existing or add new
        const existingIndex = this._pendingPermissions.findIndex(p => p.permissionId === permission.permissionId);
        if (existingIndex >= 0) {
            this._pendingPermissions[existingIndex] = permission;
        } else {
            this._pendingPermissions.push(permission);
        }
        this.onPermissionChangedEmitter.fire([...this._pendingPermissions]);
    }

    removePendingPermission(permissionId: string): void {
        this.logger.debug(`[SessionService] Removing pending permission: ${permissionId}`);
        this._pendingPermissions = this._pendingPermissions.filter(p => p.permissionId !== permissionId);
        this.onPermissionChangedEmitter.fire([...this._pendingPermissions]);
    }

    async replyPermission(requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> {
        this.logger.info(`[SessionService] Operation: replyPermission(${requestId}, ${reply})`);
        if (!this._activeProject) {
            throw new Error('No active project');
        }
        try {
            await this.openCodeService.replyPermission(this._activeProject.id, requestId, reply);
            // Remove from pending (SSE event will also remove it, but do it eagerly)
            this.removePendingPermission(requestId);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[SessionService] Error replying to permission: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        }
    }

    /**
     * Lazily wire the notification service (avoids DI cycles).
     * Called from the frontend module via queueMicrotask wiring.
     */
    setNotificationService(svc: SessionNotificationService): void {
        this._notificationService = svc;
    }

    /**
     * Dispose the service - cleanup emitters and state.
     */
    dispose(): void {
        this.logger.info('[SessionService] Disposing...');

        // Cancel any in-flight operations
        this.sessionLoadAbortController?.abort();
        if (this._statusChangeTimeout) {
            clearTimeout(this._statusChangeTimeout);
            this._statusChangeTimeout = undefined;
        }
        if (this._streamingDoneTimer) {
            clearTimeout(this._streamingDoneTimer);
            this._streamingDoneTimer = undefined;
        }
        if (this._rpcFallbackTimer) {
            clearTimeout(this._rpcFallbackTimer);
            this._rpcFallbackTimer = undefined;
        }

        // Dispose all emitters
        // T3-4: Also dispose onActiveModelChangedEmitter
        this.onActiveProjectChangedEmitter.dispose();
        this.onActiveSessionChangedEmitter.dispose();
        this.onActiveModelChangedEmitter.dispose();
        this.onMessagesChangedEmitter.dispose();
        this.onMessageStreamingEmitter.dispose();
        this.onIsLoadingChangedEmitter.dispose();
        this.onErrorChangedEmitter.dispose();
        this.onIsStreamingChangedEmitter.dispose();
        this.onStreamingStatusChangedEmitter.dispose();
        this.onSessionStatusChangedEmitter.dispose();
        this.onQuestionChangedEmitter.dispose();
        this.onPermissionChangedEmitter.dispose();
        this.onTodosChangedEmitter.dispose();

        // Clear state
        this._activeProject = undefined;
        this._activeSession = undefined;
        this._messages = [];
        // T2-11: Reset loading counter
        this._loadingCounter = 0;
        this._lastError = undefined;
        this._isStreaming = false;

        this.logger.info('[SessionService] Disposed');
    }
}
