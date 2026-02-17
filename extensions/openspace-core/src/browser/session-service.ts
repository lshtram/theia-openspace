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
import {
    OpenCodeService,
    Project,
    Session,
    Message,
    MessagePart,
    ProviderWithModels
} from '../common/opencode-protocol';

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

    // Events
    readonly onActiveProjectChanged: Event<Project | undefined>;
    readonly onActiveSessionChanged: Event<Session | undefined>;
    readonly onActiveModelChanged: Event<string | undefined>;
    readonly onMessagesChanged: Event<Message[]>;
    readonly onMessageStreaming: Event<StreamingUpdate>;
    readonly onIsLoadingChanged: Event<boolean>;
    readonly onErrorChanged: Event<string | undefined>;
    readonly onIsStreamingChanged: Event<boolean>;

    // Operations
    setActiveProject(projectId: string): Promise<void>;
    setActiveSession(sessionId: string): Promise<void>;
    setActiveModel(model: string): void;
    createSession(title?: string): Promise<Session>;
    sendMessage(parts: MessagePart[], model?: { providerID: string; modelID: string }): Promise<void>;
    abort(): Promise<void>;
    getSessions(): Promise<Session[]>;
    getAvailableModels(): Promise<ProviderWithModels[]>;
    deleteSession(sessionId: string): Promise<void>;

    // State update methods (for SyncService integration)
    appendMessage(message: Message): void;
    updateStreamingMessage(messageId: string, delta: string, isDone: boolean): void;
    replaceMessage(messageId: string, message: Message): void;
    notifySessionChanged(session: Session): void;
    notifySessionDeleted(sessionId: string): void;
}

/**
 * SessionService implementation.
 */
@injectable()
export class SessionServiceImpl implements SessionService {

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    // Private state
    private _activeProject: Project | undefined;
    private _activeSession: Session | undefined;
    private _activeModel: string | undefined;
    private _messages: Message[] = [];
    private _isLoading = false;
    private _lastError: string | undefined;
    private _isStreaming = false;
    private sessionLoadAbortController?: AbortController;

    // Emitters
    private readonly onActiveProjectChangedEmitter = new Emitter<Project | undefined>();
    private readonly onActiveSessionChangedEmitter = new Emitter<Session | undefined>();
    private readonly onActiveModelChangedEmitter = new Emitter<string | undefined>();
    private readonly onMessagesChangedEmitter = new Emitter<Message[]>();
    private readonly onMessageStreamingEmitter = new Emitter<StreamingUpdate>();
    private readonly onIsLoadingChangedEmitter = new Emitter<boolean>();
    private readonly onErrorChangedEmitter = new Emitter<string | undefined>();
    private readonly onIsStreamingChangedEmitter = new Emitter<boolean>();

    // Public event properties
    readonly onActiveProjectChanged = this.onActiveProjectChangedEmitter.event;
    readonly onActiveSessionChanged = this.onActiveSessionChangedEmitter.event;
    readonly onActiveModelChanged = this.onActiveModelChangedEmitter.event;
    readonly onMessagesChanged = this.onMessagesChangedEmitter.event;
    readonly onMessageStreaming = this.onMessageStreamingEmitter.event;
    readonly onIsLoadingChanged = this.onIsLoadingChangedEmitter.event;
    readonly onErrorChanged = this.onErrorChangedEmitter.event;
    readonly onIsStreamingChanged = this.onIsStreamingChangedEmitter.event;

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

    get isLoading(): boolean {
        return this._isLoading;
    }

    get lastError(): string | undefined {
        return this._lastError;
    }

    get isStreaming(): boolean {
        return this._isStreaming;
    }

    /**
     * Initialize the service - restore state from localStorage.
     */
    @postConstruct()
    protected init(): void {
        console.info('[SessionService] Initializing...');

        const projectId = window.localStorage.getItem('openspace.activeProjectId');
        const sessionId = window.localStorage.getItem('openspace.activeSessionId');

        // Restore project first, then session (sequential, not parallel)
        (async () => {
            if (projectId) {
                try {
                    await this.setActiveProject(projectId);
                    console.debug(`[SessionService] Restored project: ${projectId}`);
                } catch (err) {
                    console.warn('[SessionService] Failed to restore project:', err);
                }
            }

            // Only restore session if project was loaded successfully
            if (sessionId && this._activeProject) {
                try {
                    await this.setActiveSession(sessionId);
                    console.debug(`[SessionService] Restored session: ${sessionId}`);
                } catch (err) {
                    console.warn('[SessionService] Failed to restore session:', err);
                }
            }

            console.info(`[SessionService] Initialized with project=${this._activeProject?.id || 'none'}, session=${this._activeSession?.id || 'none'}`);
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
        console.info(`[SessionService] Operation: setActiveProject(${projectId})`);

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // Set loading state
        this._isLoading = true;
        this.onIsLoadingChangedEmitter.fire(true);

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

            console.debug(`[SessionService] State: project=${project.id} (${project.name})`);

            // Clear active session if it belonged to a different project
            if (this._activeSession && this._activeSession.projectId !== projectId) {
                console.debug(`[SessionService] Clearing session from different project`);
                this._activeSession = undefined;
                this._messages = [];
                window.localStorage.removeItem('openspace.activeSessionId');
                this.onActiveSessionChangedEmitter.fire(undefined);
                this.onMessagesChangedEmitter.fire([]);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            this._isLoading = false;
            this.onIsLoadingChangedEmitter.fire(false);
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
        console.info(`[SessionService] Operation: setActiveSession(${sessionId})`);

        // Cancel any in-flight session load operation
        this.sessionLoadAbortController?.abort();
        this.sessionLoadAbortController = new AbortController();
        const signal = this.sessionLoadAbortController.signal;

        // Require active project
        if (!this._activeProject) {
            const errorMsg = 'No active project. Call setActiveProject() first.';
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // Set loading state
        this._isLoading = true;
        this.onIsLoadingChangedEmitter.fire(true);

        try {
            // Fetch session
            const session = await this.openCodeService.getSession(this._activeProject.id, sessionId);
            
            // Check if this operation was cancelled while waiting for RPC
            if (signal.aborted) {
                console.debug(`[SessionService] Session load cancelled (stale operation for ${sessionId})`);
                return; // Ignore stale response
            }

            // Clear messages from previous session BEFORE updating session
            this._messages = [];
            this.onMessagesChangedEmitter.fire([...this._messages]);
            console.debug('[SessionService] State: messages cleared');

            // Update active session
            this._activeSession = session;
            this.onActiveSessionChangedEmitter.fire(session);
            console.debug(`[SessionService] State: activeSession=${session.id}`);

            // Persist to localStorage
            window.localStorage.setItem('openspace.activeSessionId', sessionId);

            // Load messages for the new session
            await this.loadMessages();
            
        } catch (error: any) {
            console.error('[SessionService] Error in setActiveSession:', error);
            this._lastError = error.message || String(error);
            this.onErrorChangedEmitter.fire(this._lastError);
            throw error;
        } finally {
            this._isLoading = false;
            this.onIsLoadingChangedEmitter.fire(false);
        }
    }

    /**
     * Set the active model for the current session.
     * Model format: "provider/model" (e.g., "anthropic/claude-sonnet-4-5")
     * 
     * @param model - Model ID in provider/model format
     */
    setActiveModel(model: string): void {
        console.info(`[SessionService] Operation: setActiveModel(${model})`);
        this._activeModel = model;
        this.onActiveModelChangedEmitter.fire(model);
        console.debug(`[SessionService] State: activeModel=${model}`);
    }

    /**
     * Get available models from the OpenCode server.
     * Uses the active project's directory if available.
     * 
     * @returns Array of providers with their models
     */
    async getAvailableModels(): Promise<ProviderWithModels[]> {
        console.info('[SessionService] Operation: getAvailableModels()');
        
        try {
            const directory = this._activeProject?.path;
            const providers = await this.openCodeService.getAvailableModels(directory);
            console.debug(`[SessionService] Found ${providers.length} providers`);
            return providers;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error fetching models: ${errorMsg}`);
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
        console.info(`[SessionService] Operation: createSession(${title || 'untitled'})`);

        // If no active project, try to auto-select the first available project
        if (!this._activeProject) {
            console.debug('[SessionService] No active project, fetching available projects...');
            try {
                const projects = await this.openCodeService.getProjects();
                if (projects.length > 0) {
                    console.debug(`[SessionService] Auto-selecting first project: ${projects[0].id}`);
                    await this.setActiveProject(projects[0].id);
                } else {
                    const errorMsg = 'No projects available on OpenCode server';
                    console.error(`[SessionService] Error: ${errorMsg}`);
                    this._lastError = errorMsg;
                    this.onErrorChangedEmitter.fire(errorMsg);
                    throw new Error(errorMsg);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[SessionService] Error getting projects: ${errorMsg}`);
                this._lastError = errorMsg;
                this.onErrorChangedEmitter.fire(errorMsg);
                throw new Error(`No active project: ${errorMsg}`);
            }
        }

        // Require active project
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // Set loading state
        this._isLoading = true;
        this.onIsLoadingChangedEmitter.fire(true);

        try {
            // Create session via backend
            const session = await this.openCodeService.createSession(this._activeProject.id, { title });

            console.debug(`[SessionService] Created session: ${session.id}`);

            // Set as active session
            await this.setActiveSession(session.id);

            return session;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            this._isLoading = false;
            this.onIsLoadingChangedEmitter.fire(false);
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
    async sendMessage(parts: MessagePart[], model?: { providerID: string; modelID: string }): Promise<void> {
        console.info(`[SessionService] Operation: sendMessage(${parts.length} parts, model: ${model ? `${model.providerID}/${model.modelID}` : 'none'})`);

        // Require active project and session
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        if (!this._activeSession) {
            const errorMsg = 'No active session';
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        // Clear previous error
        this._lastError = undefined;
        this.onErrorChangedEmitter.fire(undefined);

        // Create optimistic message
        const optimisticMsg: Message = {
            id: `temp-${Date.now()}`,
            sessionId: this._activeSession.id,
            role: 'user',
            parts,
            metadata: { optimistic: true, ...(model && { model }) }
        };

        // Add optimistic message immediately (UI updates)
        this._messages.push(optimisticMsg);
        this.onMessagesChangedEmitter.fire([...this._messages]);

        console.debug(`[SessionService] Added optimistic message: ${optimisticMsg.id}`);

        // Set streaming state
        this._isStreaming = true;
        this.onIsStreamingChangedEmitter.fire(true);

        try {
            // Call backend to create message
            // Model is passed as top-level parameter (not in message metadata)
            const result = await this.openCodeService.createMessage(
                this._activeProject.id,
                this._activeSession.id,
                { parts },
                model
            );

            // Replace optimistic message ID with real ID (if server returns updated user message)
            // Then ADD the assistant response as a new message
            // Note: OpenCode API returns { info: Message, parts: MessagePart[] } - need to combine them
            const assistantMessage: Message = {
                ...result.info,
                parts: result.parts || []
            };
            
            const index = this._messages.findIndex(m => m.id === optimisticMsg.id);
            if (index >= 0) {
                // Update the user message with real ID from server (if available)
                // The result.info is the ASSISTANT message, not the user message
                const updatedUserMessage = { ...this._messages[index] };
                // Keep the optimistic message as-is (or update ID if server provides it)
                this._messages[index] = updatedUserMessage;
                
                // Add the assistant message as a NEW message (with parts!)
                this._messages.push(assistantMessage);
                this.onMessagesChangedEmitter.fire([...this._messages]);
                console.debug(`[SessionService] Added assistant message: ${assistantMessage.id} with ${assistantMessage.parts.length} parts`);
            } else {
                // Optimistic message not found (shouldn't happen, but handle gracefully)
                console.warn(`[SessionService] Optimistic message not found for replacement: ${optimisticMsg.id}`);
                this._messages.push(assistantMessage);
                this.onMessagesChangedEmitter.fire([...this._messages]);
            }

            console.debug(`[SessionService] State: messages=${this._messages.length}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error: ${errorMsg}`);

            // Rollback optimistic message on error
            this._messages = this._messages.filter(m => m.id !== optimisticMsg.id);
            this.onMessagesChangedEmitter.fire([...this._messages]);

            console.debug(`[SessionService] Rolled back optimistic message: ${optimisticMsg.id}`);

            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            this._isStreaming = false;
            this.onIsStreamingChangedEmitter.fire(false);
        }
    }

    /**
     * Abort the current streaming message.
     * Requires active project and session to be set.
     * 
     * @throws Error if no active project or session
     */
    async abort(): Promise<void> {
        console.info(`[SessionService] Operation: abort()`);

        // Require active project and session
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        if (!this._activeSession) {
            const errorMsg = 'No active session';
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            // Call backend to abort session
            await this.openCodeService.abortSession(this._activeProject.id, this._activeSession.id);

            console.debug(`[SessionService] Aborted session: ${this._activeSession.id}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            // Always clear streaming state
            this._isStreaming = false;
            this.onIsStreamingChangedEmitter.fire(false);
        }
    }

    /**
     * Get all sessions for the active project.
     * 
     * @returns Array of sessions, or empty array if no active project or error
     */
    async getSessions(): Promise<Session[]> {
        console.info('[SessionService] Operation: getSessions()');
        
        if (!this._activeProject) {
            // No active project is normal on startup - don't log as warning
            return [];
        }
        
        try {
            const sessions = await this.openCodeService.getSessions(this._activeProject.id);
            console.debug(`[SessionService] Found ${sessions.length} sessions`);
            return sessions;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error fetching sessions: ${errorMsg}`);
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
        console.info(`[SessionService] Operation: deleteSession(${sessionId})`);
        
        if (!this._activeProject) {
            const errorMsg = 'No active project';
            console.error(`[SessionService] Error: ${errorMsg}`);
            throw new Error(errorMsg);
        }
        
        this._isLoading = true;
        this.onIsLoadingChangedEmitter.fire(true);
        
        try {
            // Delete via backend
            await this.openCodeService.deleteSession(this._activeProject.id, sessionId);
            
            console.debug(`[SessionService] Deleted session: ${sessionId}`);
            
            // If deleted session was active, clear active session
            if (this._activeSession?.id === sessionId) {
                this._activeSession = undefined;
                this._messages = [];
                window.localStorage.removeItem('openspace.activeSessionId');
                this.onActiveSessionChangedEmitter.fire(undefined);
                this.onMessagesChangedEmitter.fire([]);
                console.debug('[SessionService] Cleared active session (was deleted)');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            throw error;
        } finally {
            this._isLoading = false;
            this.onIsLoadingChangedEmitter.fire(false);
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

        console.debug(`[SessionService] Loading messages for session: ${this._activeSession.id}`);

        this._isLoading = true;
        this.onIsLoadingChangedEmitter.fire(true);

        try {
            // Fetch messages from backend
            const messagesWithParts = await this.openCodeService.getMessages(
                this._activeProject.id,
                this._activeSession.id
            );

            // Convert MessageWithParts[] to Message[] (extract info)
            this._messages = messagesWithParts.map(m => m.info);
            this.onMessagesChangedEmitter.fire([...this._messages]);

            console.debug(`[SessionService] Loaded ${this._messages.length} messages`);
            console.debug(`[SessionService] State: messages=${this._messages.length}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[SessionService] Error loading messages: ${errorMsg}`);
            this._lastError = errorMsg;
            this.onErrorChangedEmitter.fire(errorMsg);
            // Don't throw - loading messages is not critical enough to fail the session change
        } finally {
            this._isLoading = false;
            this.onIsLoadingChangedEmitter.fire(false);
        }
    }

    /**
     * Append a new message to the messages array (for external events like message.created).
     * Prevents duplicate messages by checking ID.
     * 
     * @param message - Message to append
     */
    appendMessage(message: Message): void {
        console.debug(`[SessionService] Appending message: ${message.id}`);

        // Check if message already exists (prevent duplicates)
        const exists = this._messages.some(m => m.id === message.id);
        if (exists) {
            console.warn(`[SessionService] Message already exists: ${message.id}`);
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
        console.debug(`[SessionService] Streaming update: ${messageId}, isDone=${isDone}`);

        // Fire streaming event for incremental updates
        if (!isDone) {
            this.onMessageStreamingEmitter.fire({ messageId, delta, isDone });
        }

        // Find message in array
        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            console.warn(`[SessionService] Streaming message not found: ${messageId}`);
            return;
        }

        // Append delta to the last text part
        const message = this._messages[index];
        const parts = [...message.parts];

        if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
            // Append to existing text part
            const lastPart = parts[parts.length - 1] as import('../common/opencode-protocol').TextMessagePart;
            parts[parts.length - 1] = { type: 'text', text: lastPart.text + delta };
        } else {
            // Create new text part
            parts.push({ type: 'text', text: delta });
        }

        // Update message with new parts
        this._messages[index] = { ...message, parts };
        this.onMessagesChangedEmitter.fire([...this._messages]);

        // Fire completion event
        if (isDone) {
            this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: true });
            this._isStreaming = false;
            this.onIsStreamingChangedEmitter.fire(false);
        }
    }

    /**
     * Replace an existing message (for message.completed events).
     * 
     * @param messageId - ID of the message to replace
     * @param message - New message to replace with
     */
    replaceMessage(messageId: string, message: Message): void {
        console.debug(`[SessionService] Replacing message: ${messageId}`);

        const index = this._messages.findIndex(m => m.id === messageId);
        if (index < 0) {
            console.warn(`[SessionService] Message not found for replacement: ${messageId}`);
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
        console.debug(`[SessionService] External session update: ${session.id}`);

        // Only update if this is the active session
        if (this._activeSession?.id !== session.id) {
            console.debug('[SessionService] Ignoring update for non-active session');
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
        console.debug(`[SessionService] External session deletion: ${sessionId}`);

        // Only clear if this is the active session
        if (this._activeSession?.id !== sessionId) {
            console.debug('[SessionService] Ignoring deletion of non-active session');
            return;
        }

        this._activeSession = undefined;
        this._messages = [];
        window.localStorage.removeItem('openspace.activeSessionId');
        this.onActiveSessionChangedEmitter.fire(undefined);
        this.onMessagesChangedEmitter.fire([]);
    }

    /**
     * Dispose the service - cleanup emitters and state.
     */
    dispose(): void {
        console.info('[SessionService] Disposing...');

        // Cancel any in-flight operations
        this.sessionLoadAbortController?.abort();

        // Dispose all emitters
        this.onActiveProjectChangedEmitter.dispose();
        this.onActiveSessionChangedEmitter.dispose();
        this.onMessagesChangedEmitter.dispose();
        this.onMessageStreamingEmitter.dispose();
        this.onIsLoadingChangedEmitter.dispose();
        this.onErrorChangedEmitter.dispose();
        this.onIsStreamingChangedEmitter.dispose();

        // Clear state
        this._activeProject = undefined;
        this._activeSession = undefined;
        this._messages = [];
        this._isLoading = false;
        this._lastError = undefined;
        this._isStreaming = false;

        console.info('[SessionService] Disposed');
    }
}
