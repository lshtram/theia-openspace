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
import {
    OpenCodeService,
    Project,
    Session,
    Message,
    MessagePartInput,
    ProviderWithModels,
    PermissionNotification
} from '../common/opencode-protocol';
import * as SDKTypes from '../common/opencode-sdk-types';

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
    getAvailableModels(): Promise<ProviderWithModels[]>;
    deleteSession(sessionId: string): Promise<void>;
    autoSelectProjectByWorkspace(workspacePath: string): Promise<boolean>;

    // State update methods (for SyncService integration)
    appendMessage(message: Message): void;
    updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStreamingMessageParts(messageId: string, toolParts: any[]): void;
    replaceMessage(messageId: string, message: Message): void;
    notifySessionChanged(session: Session): void;
    notifySessionDeleted(sessionId: string): void;
    /** Update session status from server-authoritative SSE event. */
    updateSessionStatus(status: SDKTypes.SessionStatus): void;
    applyPartDelta(messageId: string, partId: string, field: string, delta: string): void;

    // Question state
    readonly pendingQuestions: SDKTypes.QuestionRequest[];
    readonly onQuestionChanged: Event<SDKTypes.QuestionRequest[]>;

    // Question operations
    addPendingQuestion(question: SDKTypes.QuestionRequest): void;
    removePendingQuestion(requestId: string): void;
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

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

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
    private _sessionStatus: SDKTypes.SessionStatus = { type: 'idle' };

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
        return this._sessionStatus;
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
     * Initialize the service - restore state from localStorage.
     */
    @postConstruct()
    protected init(): void {
        this.logger.info('[SessionService] Initializing...');

        const projectId = window.localStorage.getItem('openspace.activeProjectId');
        const sessionId = window.localStorage.getItem('openspace.activeSessionId');

        // Restore project first, then session (sequential, not parallel)
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
                try {
                    await this.setActiveSession(sessionId);
                    this.logger.debug(`[SessionService] Restored session: ${sessionId}`);
                } catch (err) {
                    this.logger.warn('[SessionService] Failed to restore session:', err);
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

            // Persist to localStorage
            window.localStorage.setItem('openspace.activeSessionId', sessionId);

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

            // Load any pending questions that were created before the SSE connection
            // (e.g., questions from a previous server session that are still unanswered)
            await this.loadPendingQuestions(sessionId);
            
        } catch (error: unknown) {
            const err = error as Error;
            this.logger.error('[SessionService] Error in setActiveSession:', error);
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
            // Create session via backend
            const session = await this.openCodeService.createSession(this._activeProject.id, { title });

            this.logger.debug(`[SessionService] Created session: ${session.id}`);

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

            // The RPC call returns the final assistant message (info + parts).
            // SSE events (message.part.updated → partial, message.updated → completed) may have
            // already added/updated this message via appendMessage() / replaceMessage().
            // To avoid duplicates we only push the assistant message if it isn't in the array yet.
            const assistantMessage: Message = {
                ...result.info,
                parts: result.parts || []
            };

            const assistantExists = this._messages.some(m => m.id === assistantMessage.id);
            if (assistantExists) {
                // SSE already handled this message (streamed parts via message.part.updated
                // and completed via message.updated). The RPC result typically has parts: []
                // because parts arrive via SSE, not the REST response. Only replace if the
                // RPC result actually carries parts; otherwise we'd wipe SSE-streamed content.
                const rpcHasParts = (result.parts || []).length > 0;
                if (rpcHasParts) {
                    this.replaceMessage(assistantMessage.id, assistantMessage);
                    this.logger.debug(`[SessionService] Updated existing assistant message via RPC result: ${assistantMessage.id} (${result.parts!.length} parts)`);
                } else {
                    this.logger.debug(`[SessionService] Skipping replaceMessage for ${assistantMessage.id}: RPC result has empty parts, SSE already populated content`);
                }
            } else {
                // SSE hasn't arrived yet (or was very fast) — append the assistant message
                this._messages.push(assistantMessage);
                this.onMessagesChangedEmitter.fire([...this._messages]);
                const partsCount = assistantMessage.parts?.length || 0;
                this.logger.debug(`[SessionService] Added assistant message from RPC: ${assistantMessage.id} with ${partsCount} parts`);
            }

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
            const sessions = await this.openCodeService.getSessions(this._activeProject.id);
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
            // Delete via backend
            await this.openCodeService.deleteSession(this._activeProject.id, sessionId);
            
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
     * Load messages for the active session.
     * Private method called automatically when session changes.
     */
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
                this._activeSession.id
            );

            // Convert MessageWithParts[] to Message[] (combine info + parts)
            this._messages = messagesWithParts.map(m => ({
                ...m.info,
                parts: m.parts || []
            }));
            this.onMessagesChangedEmitter.fire([...this._messages]);

            this.logger.debug(`[SessionService] Loaded ${this._messages.length} messages`);
            this.logger.debug(`[SessionService] State: messages=${this._messages.length}`);
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

        this._messages.push(message);
        this.onMessagesChangedEmitter.fire([...this._messages]);
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
        window.localStorage.removeItem('openspace.activeSessionId');
        this.onActiveSessionChangedEmitter.fire(undefined);
        this.onMessagesChangedEmitter.fire([]);
    }

    /**
     * Update session status from server-authoritative SSE event.
     * This is the definitive busy/idle signal that spans the entire agent turn,
     * including gaps between tool rounds.
     */
    updateSessionStatus(status: SDKTypes.SessionStatus): void {
        this.logger.debug(`[SessionService] Session status: ${status.type}`);
        this._sessionStatus = status;
        this.onSessionStatusChangedEmitter.fire(status);
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
        const partIndex = parts.findIndex(p => (p as any).id === partId);
        if (partIndex >= 0) {
            // Append delta to existing part's field
            const part = { ...parts[partIndex] } as any;
            part[field] = (part[field] || '') + delta;
            parts[partIndex] = part;
        } else {
            // Part doesn't exist yet — create a stub
            const newPart: any = {
                id: partId,
                sessionID: message.sessionID,
                messageID: messageId,
                type: field === 'reasoning' ? 'reasoning' : 'text',
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
                    return this.toolNameToStatus(part.tool || '');
                }
                if (part.type === 'text') {
                    return 'Thinking';
                }
            }
        }
        return 'Considering next steps';
    }

    private toolNameToStatus(toolName: string): string {
        const name = toolName.toLowerCase();
        if (/^(bash|shell)$/.test(name)) return 'Running commands';
        if (/^task$/.test(name)) return 'Delegating work';
        if (/^(todowrite|todoread|todo_write|todo_read)$/.test(name)) return 'Planning next steps';
        if (/^read$/.test(name)) return 'Gathering context';
        if (/^(list|grep|glob|find|ripgrep|ripgrep_search|ripgrep_advanced-search|ripgrep_count-matches|ripgrep_list-files)$/.test(name)) return 'Searching the codebase';
        if (/^(webfetch|web_fetch)$/.test(name)) return 'Searching the web';
        if (/^(edit|write)$/.test(name)) return 'Making edits';
        return 'Considering next steps';
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
        this.onQuestionChangedEmitter.dispose();
        this.onPermissionChangedEmitter.dispose();

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
