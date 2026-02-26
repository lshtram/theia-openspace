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

import { injectable, inject } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { ILogger } from '@theia/core/lib/common/logger';
import { Disposable } from '@theia/core/lib/common/disposable';
import { OpenCodeService, Project, Session } from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';

export const SessionLifecycleService = Symbol('SessionLifecycleService');

/**
 * Manages project/session state, session CRUD, session list pagination,
 * session statuses, and session-level notifications from SSE.
 */
@injectable()
export class SessionLifecycleServiceImpl implements Disposable {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    // ── State ──

    private _activeProject: Project | undefined;
    private _activeSession: Session | undefined;
    private _sessionStatuses = new Map<string, SDKTypes.SessionStatus>();
    private _sessionErrors = new Map<string, string>();
    private _sessionLoadLimit: number = 20;
    private _sessionCursor: number = 0;
    private _hasMoreSessions = false;
    sessionLoadAbortController?: AbortController;

    // ── Emitters ──

    private readonly onActiveProjectChangedEmitter = new Emitter<Project | undefined>();
    readonly onActiveProjectChanged: Event<Project | undefined> = this.onActiveProjectChangedEmitter.event;

    private readonly onActiveSessionChangedEmitter = new Emitter<Session | undefined>();
    readonly onActiveSessionChanged: Event<Session | undefined> = this.onActiveSessionChangedEmitter.event;

    private readonly onSessionStatusChangedEmitter = new Emitter<SDKTypes.SessionStatus>();
    readonly onSessionStatusChanged: Event<SDKTypes.SessionStatus> = this.onSessionStatusChangedEmitter.event;

    // ── Getters ──

    get activeProject(): Project | undefined { return this._activeProject; }
    get activeSession(): Session | undefined { return this._activeSession; }
    get hasMoreSessions(): boolean { return this._hasMoreSessions; }

    // ── Setters (used by facade) ──

    setActiveProjectDirect(project: Project | undefined): void {
        this._activeProject = project;
        this.onActiveProjectChangedEmitter.fire(project);
    }

    setActiveSessionDirect(session: Session | undefined): void {
        this._activeSession = session;
        this.onActiveSessionChangedEmitter.fire(session);
    }

    // ── Project management ──

    async setActiveProject(projectId: string): Promise<void> {
        this.logger.info(`[SessionLifecycle] Operation: setActiveProject(${projectId})`);

        const projects = await this.openCodeService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Project not found: ${projectId}`);
        }

        this._activeProject = project;
        window.localStorage.setItem('openspace.activeProjectId', projectId);
        this.onActiveProjectChangedEmitter.fire(project);
        this.logger.debug(`[SessionLifecycle] State: project=${project.id} (${project.worktree})`);

        // Connect SSE for the project's directory
        if (project.worktree) {
            try {
                await this.openCodeService.connectToProject(project.worktree);
                this.logger.debug(`[SessionLifecycle] SSE connected for directory: ${project.worktree}`);
            } catch (sseError) {
                this.logger.warn('[SessionLifecycle] Failed to connect SSE (non-fatal):', sseError);
            }
        }

        // Hydrate session statuses from server on project switch
        try {
            const statuses = await this.openCodeService.getSessionStatuses(project.id);
            for (const { sessionId, status } of statuses) {
                this._sessionStatuses.set(sessionId, status);
            }
            this.logger.debug(`[SessionLifecycle] Hydrated ${statuses.length} session statuses`);
        } catch (e) {
            this.logger.warn(`[SessionLifecycle] Could not hydrate session statuses: ${e}`);
        }

        // Clear active session if it belonged to a different project
        if (this._activeSession && this._activeSession.projectID !== projectId) {
            this.logger.debug('[SessionLifecycle] Clearing session from different project');
            this._activeSession = undefined;
            window.localStorage.removeItem('openspace.activeSessionId');
            this.onActiveSessionChangedEmitter.fire(undefined);
        }
    }

    async autoSelectProjectByWorkspace(workspacePath: string): Promise<boolean> {
        this.logger.info(`[SessionLifecycle] Auto-selecting project for workspace: ${workspacePath}`);
        if (!workspacePath) { return false; }

        try {
            const projects = await this.openCodeService.getProjects();
            const matchingProject = projects.find(p => {
                const projectPath = p.worktree;
                if (!projectPath) return false;
                return workspacePath.includes(projectPath) || projectPath.includes(workspacePath);
            });

            if (matchingProject) {
                this.logger.info(`[SessionLifecycle] Found matching project: ${matchingProject.id}`);
                await this.setActiveProject(matchingProject.id);
                return true;
            } else {
                this.logger.info(`[SessionLifecycle] No match — registering: ${workspacePath}`);
                const newProject = await this.openCodeService.initProject(workspacePath);
                await this.setActiveProject(newProject.id);
                return true;
            }
        } catch (error) {
            this.logger.error('[SessionLifecycle] Error auto-selecting project:', error);
            return false;
        }
    }

    // ── Session CRUD ──

    async getSessions(): Promise<Session[]> {
        if (!this._activeProject) { return []; }
        const PAGE_SIZE = 20;
        this._sessionLoadLimit = PAGE_SIZE;
        const sessions = await this.openCodeService.getSessions(this._activeProject.id, { limit: PAGE_SIZE });
        this._hasMoreSessions = sessions.length === PAGE_SIZE;
        this._sessionCursor = sessions.length;
        this.logger.debug(`[SessionLifecycle] Found ${sessions.length} sessions`);
        return sessions;
    }

    async loadMoreSessions(): Promise<Session[]> {
        if (!this._hasMoreSessions || !this._activeProject) { return []; }
        try {
            const PAGE_SIZE = 20;
            this._sessionLoadLimit += PAGE_SIZE;
            const all = await this.openCodeService.getSessions(this._activeProject.id, {
                limit: this._sessionLoadLimit
            });
            this._hasMoreSessions = all.length === this._sessionLoadLimit;
            const newItems = all.slice(this._sessionCursor);
            this._sessionCursor = all.length;
            this.logger.debug(`[SessionLifecycle] Loaded ${newItems.length} more sessions`);
            return newItems;
        } catch (error) {
            this.logger.warn(`[SessionLifecycle] loadMoreSessions error: ${error}`);
            return [];
        }
    }

    async searchSessions(query: string): Promise<Session[]> {
        if (!this._activeProject) { return []; }
        try {
            return await this.openCodeService.getSessions(this._activeProject.id, { search: query, limit: 50 });
        } catch { return []; }
    }

    async deleteSession(sessionId: string): Promise<void> {
        if (!this._activeProject) { throw new Error('No active project'); }
        this.logger.info(`[SessionLifecycle] Operation: deleteSession(${sessionId})`);

        let allSessions: Session[] = [];
        try {
            allSessions = (await this.openCodeService.getSessions(this._activeProject.id, {})) ?? [];
        } catch { /* fall back to deleting only the target */ }
        const toDelete = [sessionId, ...this.findDescendantSessionIds(allSessions, sessionId)];
        this.logger.debug(`[SessionLifecycle] Cascade deleting ${toDelete.length} session(s)`);

        await Promise.all(toDelete.map(id => this.openCodeService.deleteSession(this._activeProject!.id, id)));

        if (this._activeSession?.id === sessionId) {
            this._activeSession = undefined;
            window.localStorage.removeItem('openspace.activeSessionId');
            this.onActiveSessionChangedEmitter.fire(undefined);
        }
    }

    async archiveSession(sessionId: string): Promise<void> {
        if (!this._activeProject) { throw new Error('No active project'); }
        this.logger.info(`[SessionLifecycle] Operation: archiveSession(${sessionId})`);
        await this.openCodeService.archiveSession(this._activeProject.id, sessionId);
        if (this._activeSession?.id === sessionId) {
            this._activeSession = undefined;
            window.localStorage.removeItem('openspace.activeSessionId');
            this.onActiveSessionChangedEmitter.fire(undefined);
        }
    }

    async renameSession(sessionId: string, title: string): Promise<void> {
        if (!this._activeProject) { throw new Error('No active project'); }
        this.logger.info(`[SessionLifecycle] Operation: renameSession(${sessionId})`);
        const updated = await this.openCodeService.renameSession(this._activeProject.id, sessionId, title);
        if (this._activeSession?.id === sessionId) {
            this._activeSession = updated;
            this.onActiveSessionChangedEmitter.fire(updated);
        } else {
            this.onActiveSessionChangedEmitter.fire(this._activeSession);
        }
    }

    async shareSession(sessionId: string): Promise<Session> {
        if (!this._activeProject) { throw new Error('No active project'); }
        const updated = await this.openCodeService.shareSession(this._activeProject.id, sessionId);
        if (this._activeSession?.id === sessionId) {
            this._activeSession = updated;
            this.onActiveSessionChangedEmitter.fire(updated);
        }
        return updated;
    }

    async unshareSession(sessionId: string): Promise<void> {
        if (!this._activeProject) { throw new Error('No active project'); }
        await this.openCodeService.unshareSession(this._activeProject.id, sessionId);
        if (this._activeSession?.id === sessionId) {
            const updated = { ...this._activeSession, share: undefined } as Session;
            this._activeSession = updated;
            this.onActiveSessionChangedEmitter.fire(updated);
        }
    }

    async forkSession(messageId?: string): Promise<Session> {
        if (!this._activeSession || !this._activeProject) { throw new Error('No active session'); }
        this.logger.info(`[SessionLifecycle] Operation: forkSession(${this._activeSession.id})`);
        return this.openCodeService.forkSession(this._activeProject.id, this._activeSession.id, messageId);
    }

    async revertSession(): Promise<Session> {
        if (!this._activeSession || !this._activeProject) { throw new Error('No active session'); }
        this.logger.info(`[SessionLifecycle] Operation: revertSession(${this._activeSession.id})`);
        return this.openCodeService.revertSession(this._activeProject.id, this._activeSession.id);
    }

    async unrevertSession(): Promise<Session> {
        if (!this._activeSession || !this._activeProject) { throw new Error('No active session'); }
        this.logger.info(`[SessionLifecycle] Operation: unrevertSession(${this._activeSession.id})`);
        return this.openCodeService.unrevertSession(this._activeProject.id, this._activeSession.id);
    }

    async compactSession(): Promise<void> {
        if (!this._activeSession || !this._activeProject) { return; }
        this.logger.info(`[SessionLifecycle] Operation: compactSession(${this._activeSession.id})`);
        await this.openCodeService.compactSession(this._activeProject.id, this._activeSession.id);
    }

    // ── Session notifications (from SyncService) ──

    notifySessionChanged(session: Session): void {
        if (this._activeSession?.id !== session.id) { return; }
        this._activeSession = session;
        this.onActiveSessionChangedEmitter.fire(session);
    }

    notifySessionDeleted(sessionId: string): void {
        if (this._activeSession?.id !== sessionId) { return; }
        this._activeSession = undefined;
        this._sessionStatuses.delete(sessionId);
        window.localStorage.removeItem('openspace.activeSessionId');
        this.onActiveSessionChangedEmitter.fire(undefined);
    }

    notifySessionError(sessionId: string, errorMessage: string): void {
        this._sessionErrors.set(sessionId, errorMessage);
    }

    // ── Session status ──

    updateSessionStatus(status: SDKTypes.SessionStatus, sessionId?: string): void {
        const id = sessionId ?? this._activeSession?.id;
        if (!id) { return; }
        this.logger.debug(`[SessionLifecycle] Session status [${id}]: ${status.type}`);
        this._sessionStatuses.set(id, status);
        if (status.type === 'busy' || status.type === 'idle') {
            this._sessionErrors.delete(id);
        }
        this.onSessionStatusChangedEmitter.fire(status);
    }

    getSessionStatus(sessionId: string): SDKTypes.SessionStatus | undefined {
        return this._sessionStatuses.get(sessionId);
    }

    getSessionStatusForActive(): SDKTypes.SessionStatus {
        return this._sessionStatuses.get(this._activeSession?.id ?? '') ?? { type: 'idle' };
    }

    getSessionError(sessionId: string): string | undefined {
        return this._sessionErrors.get(sessionId);
    }

    // ── Internal helpers ──

    private findDescendantSessionIds(allSessions: Session[], rootId: string): string[] {
        const children = allSessions
            .filter(s => (s as unknown as { parentID?: string }).parentID === rootId)
            .map(s => s.id);
        return [...children, ...children.flatMap(c => this.findDescendantSessionIds(allSessions, c))];
    }

    dispose(): void {
        this.sessionLoadAbortController?.abort();
        this.onActiveProjectChangedEmitter.dispose();
        this.onActiveSessionChangedEmitter.dispose();
        this.onSessionStatusChangedEmitter.dispose();
    }
}
