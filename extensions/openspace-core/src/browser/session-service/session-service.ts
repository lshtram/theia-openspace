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
import { ILogger } from '@theia/core/lib/common/logger';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
    OpenCodeService, Session, Message, MessagePartInput, ProviderWithModels, PermissionNotification
} from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';
import { waitForHub as waitForHubFn } from '../hub-readiness';
import type { SessionNotificationService } from '../notification-service';
import { SessionService } from './types';
import { StreamingStateService, StreamingStateServiceImpl } from './streaming-state';
import { MessageStoreService, MessageStoreServiceImpl } from './message-store';
import { SessionLifecycleService, SessionLifecycleServiceImpl } from './session-lifecycle';
import { InteractionService, InteractionServiceImpl } from './interaction-handlers';
import { ModelPreferenceService, ModelPreferenceServiceImpl } from './model-preference';

// Re-export types so consumers can import from this module
export { SessionService, sessionDisplayTitle } from './types';
export { StreamingUpdate, StreamingStateService } from './streaming-state';
export { MessageStoreService } from './message-store';
export { SessionLifecycleService } from './session-lifecycle';
export { InteractionService } from './interaction-handlers';
export { ModelPreferenceService } from './model-preference';

/** SessionService facade — orchestrates sub-services and owns cross-cutting concerns. */
@injectable()
export class SessionServiceImpl implements SessionService {
    @inject(OpenCodeService) protected readonly openCodeService!: OpenCodeService;
    @inject(ILogger) protected readonly logger!: ILogger;
    @inject(MessageService) protected readonly messageService!: MessageService;
    @inject(StreamingStateService) protected readonly streamingState!: StreamingStateServiceImpl;
    @inject(MessageStoreService) protected readonly messageStore!: MessageStoreServiceImpl;
    @inject(SessionLifecycleService) protected readonly lifecycle!: SessionLifecycleServiceImpl;
    @inject(InteractionService) protected readonly interactions!: InteractionServiceImpl;
    @inject(ModelPreferenceService) protected readonly modelPref!: ModelPreferenceServiceImpl;

    private _loadingCounter = 0;
    private _lastError: string | undefined;
    private _notificationService: SessionNotificationService | undefined;
    private readonly onIsLoadingChangedEmitter = new Emitter<boolean>();
    private readonly onErrorChangedEmitter = new Emitter<string | undefined>();

    // ── Delegated events ──
    get onActiveProjectChanged() { return this.lifecycle.onActiveProjectChanged; }
    get onActiveSessionChanged() { return this.lifecycle.onActiveSessionChanged; }
    get onActiveModelChanged() { return this.modelPref.onActiveModelChanged; }
    get onMessagesChanged() { return this.messageStore.onMessagesChanged; }
    get onMessageStreaming() { return this.streamingState.onMessageStreaming; }
    get onIsLoadingChanged(): Event<boolean> { return this.onIsLoadingChangedEmitter.event; }
    get onErrorChanged(): Event<string | undefined> { return this.onErrorChangedEmitter.event; }
    get onIsStreamingChanged() { return this.streamingState.onIsStreamingChanged; }
    get onStreamingStatusChanged() { return this.streamingState.onStreamingStatusChanged; }
    get onSessionStatusChanged() { return this.lifecycle.onSessionStatusChanged; }
    get onQuestionChanged() { return this.interactions.onQuestionChanged; }
    get onPermissionChanged() { return this.interactions.onPermissionChanged; }
    get onTodosChanged() { return this.interactions.onTodosChanged; }

    // ── Delegated getters ──
    get activeProject() { return this.lifecycle.activeProject; }
    get activeSession() { return this.lifecycle.activeSession; }
    get activeModel() { return this.modelPref.activeModel; }
    get messages() { return this.messageStore.messages; }
    get isLoading() { return this._loadingCounter > 0; }
    get lastError() { return this._lastError; }
    get isStreaming() { return this.streamingState.isStreaming; }
    get streamingMessageId() { return this.streamingState.streamingMessageId; }
    get currentStreamingStatus() { return this.streamingState.currentStreamingStatus; }
    get sessionStatus() { return this.lifecycle.getSessionStatusForActive(); }
    get pendingQuestions() { return this.interactions.pendingQuestions; }
    get pendingPermissions() { return this.interactions.pendingPermissions; }
    get todos() { return this.interactions.todos; }
    get hasMoreSessions() { return this.lifecycle.hasMoreSessions; }
    get hasOlderMessages() { return this.messageStore.hasOlderMessages; }

    // ── Loading / error helpers ──
    private incrementLoading(): void { if (++this._loadingCounter === 1) { this.onIsLoadingChangedEmitter.fire(true); } }
    private decrementLoading(): void {
        this._loadingCounter = Math.max(0, this._loadingCounter - 1);
        if (this._loadingCounter === 0) { this.onIsLoadingChangedEmitter.fire(false); }
    }
    private setError(msg: string): Error { this._lastError = msg; this.onErrorChangedEmitter.fire(msg); return new Error(msg); }
    private clearError(): void { this._lastError = undefined; this.onErrorChangedEmitter.fire(undefined); }
    private captureError(error: unknown): void {
        const msg = error instanceof Error ? error.message : String(error);
        this._lastError = msg; this.onErrorChangedEmitter.fire(msg);
    }
    private async withLoading<T>(fn: () => Promise<T>): Promise<T> {
        this.clearError(); this.incrementLoading();
        try { return await fn(); } catch (e) { this.captureError(e); throw e; } finally { this.decrementLoading(); }
    }
    private async getMcpConfig(): Promise<Record<string, unknown> | undefined> {
        try {
            const wt = this.lifecycle.activeProject?.worktree;
            if (!wt) {
                this.logger.warn('[SessionService] No worktree available for MCP config');
                return undefined;
            }
            return await this.openCodeService.getMcpConfig(wt);
        } catch (error) {
            this.logger.error('[SessionService] Error reading MCP config: ' + (error instanceof Error ? error.message : String(error)));
            return undefined;
        }
    }

    /** Testability seam — tests stub this to avoid real hub polling. */
    protected waitForHub(): Promise<void> {
        return waitForHubFn(`${window.location.origin}/mcp`, { maxAttempts: 20, intervalMs: 500 });
    }

    // ── Init ──
    @postConstruct()
    protected init(): void {
        this.logger.info('[SessionService] Initializing...');
        const projectId = window.localStorage.getItem('openspace.activeProjectId');
        const sessionId = window.localStorage.getItem('openspace.activeSessionId');
        (async () => {
            if (projectId) {
                try { await this.setActiveProject(projectId); }
                catch (e) { this.logger.warn('[SessionService] Failed to restore project:', e); }
            }
            if (sessionId && this.lifecycle.activeProject) {
                try { await this.waitForHub(); }
                catch (e) { this.logger.warn('[SessionService] Hub not ready — skipping session restore.', e); return; }
                try { await this.setActiveSession(sessionId); } catch (e) {
                    this.logger.warn('[SessionService] Failed to restore session:', e);
                    window.localStorage.removeItem('openspace.activeSessionId');
                    this.messageService.warn('Previous session could not be restored.', 'OK').catch(() => {});
                }
            }
            this.logger.info(`[SessionService] Initialized: project=${this.lifecycle.activeProject?.id || 'none'}, session=${this.lifecycle.activeSession?.id || 'none'}`);
        })();
    }

    // ── Project ──
    async setActiveProject(projectId: string): Promise<void> {
        return this.withLoading(async () => {
            await this.lifecycle.setActiveProject(projectId);
            if (!this.lifecycle.activeSession) { this.messageStore.clear(); }
        });
    }
    async autoSelectProjectByWorkspace(ws: string): Promise<boolean> { return this.lifecycle.autoSelectProjectByWorkspace(ws); }

    // ── setActiveSession (orchestration) ──
    async setActiveSession(sessionId: string): Promise<void> {
        this.logger.info(`[SessionService] setActiveSession(${sessionId})`);
        if (this.lifecycle.activeSession?.id !== sessionId && this.streamingState.isStreaming) {
            this.streamingState.clearLocalStreamingState();
        }
        this.lifecycle.sessionLoadAbortController?.abort();
        this.lifecycle.sessionLoadAbortController = new AbortController();
        const signal = this.lifecycle.sessionLoadAbortController.signal;
        if (!this.lifecycle.activeProject) { throw this.setError('No active project. Call setActiveProject() first.'); }
        this.clearError(); this.incrementLoading();
        try {
            const session = await this.openCodeService.getSession(this.lifecycle.activeProject.id, sessionId);
            if (signal.aborted) { return; }
            this.messageStore.clear();
            this.interactions.clearAll();
            this.lifecycle.setActiveSessionDirect(session);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sm = (session as any).model as { providerID?: string; modelID?: string } | undefined;
            if (sm?.providerID && sm?.modelID) { this.modelPref.setActiveModel(`${sm.providerID}/${sm.modelID}`); }
            window.localStorage.setItem('openspace.activeSessionId', sessionId);
            this._notificationService?.markSeen(sessionId);
            if (session.directory) {
                try { await this.openCodeService.connectToProject(session.directory); }
                catch (e) { this.logger.warn('[SessionService] Failed to reconnect SSE:', e); }
            }
            await this.loadMessages();
            if (signal.aborted) { return; }
            const cached = this.lifecycle.getSessionStatus(sessionId);
            if (cached) { this.lifecycle.updateSessionStatus(cached, sessionId); }
            await this.interactions.loadPendingQuestions(this.lifecycle.activeProject.id, sessionId);
        } catch (error: unknown) {
            const err = error as Error;
            if (err.message?.includes('Session not found')) {
                window.localStorage.removeItem('openspace.activeSessionId');
                this.lifecycle.setActiveSessionDirect(undefined);
                this.messageStore.clear();
            }
            this.captureError(error); throw error;
        } finally { this.decrementLoading(); }
    }

    // ── Model ──
    setActiveModel(model: string): void { this.modelPref.setActiveModel(model); }
    async getAvailableModels(): Promise<ProviderWithModels[]> {
        try { return await this.modelPref.getAvailableModels(this.lifecycle.activeProject?.worktree); }
        catch (e) { this.captureError(e); return []; }
    }

    // ── createSession (orchestration) ──
    async createSession(title?: string): Promise<Session> {
        if (!this.lifecycle.activeProject) {
            try {
                const projects = await this.openCodeService.getProjects();
                if (projects.length > 0) { await this.setActiveProject(projects[0].id); }
                else { throw new Error('No projects available'); }
            } catch (e) { throw this.setError(`No active project: ${e instanceof Error ? e.message : e}`); }
        }
        if (!this.lifecycle.activeProject) { throw this.setError('No active project'); }
        return this.withLoading(async () => {
            await this.waitForHub();
            const mcpConfig = await this.getMcpConfig();
            const session = await this.openCodeService.createSession(this.lifecycle.activeProject!.id, { title, mcp: mcpConfig });
            try { await this.openCodeService.initSession(this.lifecycle.activeProject!.id, session.id); }
            catch (e) { this.logger.warn(`[SessionService] Session init failed (non-fatal): ${e}`); }
            await this.setActiveSession(session.id);
            return session;
        });
    }

    // ── sendMessage (orchestration) ──
    async sendMessage(parts: MessagePartInput[], model?: { providerID: string; modelID: string }): Promise<void> {
        if (!this.lifecycle.activeProject) { throw this.setError('No active project'); }
        if (!this.lifecycle.activeSession) { throw this.setError('No active session'); }
        this.clearError();
        const optimistic = {
            id: `temp-${crypto.randomUUID()}`, sessionID: this.lifecycle.activeSession.id,
            role: 'user', time: { created: Date.now() },
            agent: model?.providerID || 'unknown',
            model: { providerID: model?.providerID || 'unknown', modelID: model?.modelID || 'unknown' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parts: parts as any
        } as Message;
        this.messageStore.pushMessage(optimistic);
        this.streamingState.setStreaming(true);
        try {
            const result = await this.openCodeService.createMessage(
                this.lifecycle.activeProject.id, this.lifecycle.activeSession.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { parts: parts as any }, model);
            const assistantMsg: Message = { ...result.info, parts: result.parts || [] };
            const projId = this.lifecycle.activeProject.id;
            const sessId = this.lifecycle.activeSession.id;
            this.streamingState.startRpcFallback(() => {
                const signalDone = (): void => {
                    // Signal streaming completion so listeners (e.g. voice narration)
                    // know the response is ready, even when SSE events were not received
                    // (e.g. session ID mismatch between UI and OpenCode backend).
                    this.streamingState.updateStreamingMessage(assistantMsg.id, '', true);
                };
                if (!this.messageStore.hasMessage(assistantMsg.id)) {
                    if (!assistantMsg.parts?.length) {
                        this.messageStore.fetchAndInsertFallback(projId, sessId, assistantMsg).then(signalDone, signalDone);
                    } else {
                        this.appendMessage(assistantMsg);
                        signalDone();
                    }
                } else {
                    signalDone();
                }
            });
        } catch (e) { this.messageStore.removeMessage(optimistic.id); this.captureError(e); throw e; }
        finally { this.streamingState.stopIfIdle(); }
    }

    // ── abort ──
    async abort(): Promise<void> {
        if (!this.lifecycle.activeProject) { throw this.setError('No active project'); }
        if (!this.lifecycle.activeSession) { throw this.setError('No active session'); }
        try { await this.openCodeService.abortSession(this.lifecycle.activeProject.id, this.lifecycle.activeSession.id); }
        catch (e) { this.captureError(e); throw e; } finally { this.streamingState.abortStreaming(); }
    }

    // ── Session CRUD delegation ──
    async getSessions(): Promise<Session[]> {
        try {
            const sessions = await this.lifecycle.getSessions();
            // Prune notification counts for sessions that no longer exist
            if (this._notificationService) {
                this._notificationService.pruneStaleEntries(new Set(sessions.map(s => s.id)));
            }
            return sessions;
        } catch (e) { this.captureError(e); return []; }
    }
    async searchSessions(q: string): Promise<Session[]> { return this.lifecycle.searchSessions(q); }
    async loadMoreSessions(): Promise<Session[]> { return this.lifecycle.loadMoreSessions(); }
    async deleteSession(sid: string): Promise<void> {
        return this.withLoading(async () => { await this.lifecycle.deleteSession(sid); if (!this.lifecycle.activeSession) { this.messageStore.clear(); } });
    }
    async archiveSession(sid: string): Promise<void> {
        return this.withLoading(async () => { await this.lifecycle.archiveSession(sid); if (!this.lifecycle.activeSession) { this.messageStore.clear(); } });
    }
    async renameSession(sid: string, title: string): Promise<void> { return this.withLoading(() => this.lifecycle.renameSession(sid, title)); }
    async shareSession(sid: string): Promise<Session> { return this.withLoading(() => this.lifecycle.shareSession(sid)); }
    async unshareSession(sid: string): Promise<void> { return this.withLoading(() => this.lifecycle.unshareSession(sid)); }
    async forkSession(mid?: string): Promise<void> { await this.setActiveSession((await this.lifecycle.forkSession(mid)).id); }
    async revertSession(): Promise<void> { this.lifecycle.notifySessionChanged(await this.lifecycle.revertSession()); }
    async unrevertSession(): Promise<void> { this.lifecycle.notifySessionChanged(await this.lifecycle.unrevertSession()); }
    async compactSession(): Promise<void> { await this.lifecycle.compactSession(); }

    // ── Message delegation ──
    appendMessage(message: Message): void {
        if (message.role === 'assistant') { this.streamingState.cancelRpcFallback(); }
        this.messageStore.appendMessage(message);
        if (message.sessionID && message.sessionID !== this.lifecycle.activeSession?.id) {
            this._notificationService?.incrementUnseen(message.sessionID);
        }
    }
    updateStreamingMessage(mid: string, delta: string, done: boolean): void { this.streamingState.updateStreamingMessage(mid, delta, done); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateStreamingMessageParts(mid: string, parts: any[]): void { this.streamingState.updateStreamingMessageParts(mid, parts); }
    replaceMessage(mid: string, msg: Message): void { this.messageStore.replaceMessage(mid, msg); }
    async fetchMessageFromBackend(mid: string): Promise<Message | undefined> {
        const p = this.lifecycle.activeProject, s = this.lifecycle.activeSession;
        return (p && s) ? this.messageStore.fetchMessageFromBackend(p.id, s.id, mid) : undefined;
    }
    async loadOlderMessages(): Promise<void> {
        const p = this.lifecycle.activeProject, s = this.lifecycle.activeSession;
        if (p && s) { await this.messageStore.loadOlderMessages(p.id, s.id); }
    }
    async reloadMessages(): Promise<void> { return this.loadMessages(); }
    async getMessagesForPreview(sid: string): Promise<Message[]> {
        return this.lifecycle.activeProject ? this.messageStore.getMessagesForPreview(this.lifecycle.activeProject.id, sid) : [];
    }
    notifyMessageRemoved(sid: string, mid: string): void { this.messageStore.notifyMessageRemoved(sid, this.lifecycle.activeSession?.id, mid); }
    notifyPartRemoved(sid: string, mid: string, pid: string): void { this.messageStore.notifyPartRemoved(sid, this.lifecycle.activeSession?.id, mid, pid); }
    applyPartDelta(mid: string, pid: string, field: string, delta: string): void { this.streamingState.applyPartDelta(mid, pid, field, delta); }
    clearStreamingPartText(mid: string): void { this.streamingState.clearStreamingPartText(mid); }

    // ── Session notification delegation ──
    notifySessionChanged(session: Session): void { this.lifecycle.notifySessionChanged(session); }
    notifySessionDeleted(sid: string): void { this.lifecycle.notifySessionDeleted(sid); if (!this.lifecycle.activeSession) { this.messageStore.clear(); } }
    notifySessionError(sid: string, msg: string): void {
        this.lifecycle.notifySessionError(sid, msg);
        if (this.lifecycle.activeSession?.id === sid) { this._lastError = msg; this.onErrorChangedEmitter.fire(msg); }
    }
    updateSessionStatus(status: SDKTypes.SessionStatus, sid?: string): void { this.lifecycle.updateSessionStatus(status, sid); }
    getSessionStatus(sid: string): SDKTypes.SessionStatus | undefined { return this.lifecycle.getSessionStatus(sid); }
    getSessionError(sid: string): string | undefined { return this.lifecycle.getSessionError(sid); }

    // ── Interaction delegation ──
    addPendingQuestion(q: SDKTypes.QuestionRequest): void { this.interactions.addPendingQuestion(q); }
    removePendingQuestion(id: string): void { this.interactions.removePendingQuestion(id); }
    updateTodos(t: Array<{ id: string; description: string; status: string }>): void { this.interactions.updateTodos(t); }
    async answerQuestion(rid: string, answers: SDKTypes.QuestionAnswer[]): Promise<void> {
        if (!this.lifecycle.activeProject) { throw new Error('No active project'); }
        try { await this.interactions.answerQuestion(this.lifecycle.activeProject.id, rid, answers); }
        catch (e) { this.captureError(e); throw e; }
    }
    async rejectQuestion(rid: string): Promise<void> {
        if (!this.lifecycle.activeProject) { throw new Error('No active project'); }
        try { await this.interactions.rejectQuestion(this.lifecycle.activeProject.id, rid); }
        catch (e) { this.captureError(e); throw e; }
    }
    addPendingPermission(p: PermissionNotification): void { this.interactions.addPendingPermission(p); }
    removePendingPermission(id: string): void { this.interactions.removePendingPermission(id); }
    async replyPermission(rid: string, reply: 'once' | 'always' | 'reject'): Promise<void> {
        if (!this.lifecycle.activeProject) { throw new Error('No active project'); }
        try { await this.interactions.replyPermission(this.lifecycle.activeProject.id, rid, reply); }
        catch (e) { this.captureError(e); throw e; }
    }

    // ── Notification wiring ──
    setNotificationService(svc: SessionNotificationService): void { this._notificationService = svc; }
    incrementUnseenForSession(sid: string): void { this._notificationService?.incrementUnseen(sid); }

    // ── Private ──
    private async loadMessages(): Promise<void> {
        const p = this.lifecycle.activeProject, s = this.lifecycle.activeSession;
        if (!p || !s) { return; }
        this.incrementLoading();
        try {
            const msgs = await this.messageStore.loadMessages(p.id, s.id);
            for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i] as Message & { providerID?: string; modelID?: string };
                if (m.role === 'assistant' && m.providerID && m.modelID) { this.modelPref.setActiveModel(`${m.providerID}/${m.modelID}`); break; }
            }
        } catch (e) { this.captureError(e); } finally { this.decrementLoading(); }
    }

    dispose(): void {
        this.streamingState.dispose(); this.messageStore.dispose();
        this.lifecycle.dispose(); this.interactions.dispose(); this.modelPref.dispose();
        this.onIsLoadingChangedEmitter.dispose(); this.onErrorChangedEmitter.dispose();
        this._loadingCounter = 0; this._lastError = undefined;
    }
}
