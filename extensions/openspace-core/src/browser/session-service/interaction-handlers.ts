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
import { OpenCodeService, PermissionNotification } from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';

export const InteractionService = Symbol('InteractionService');

export type TodoItem = { id: string; description: string; status: string };

/**
 * Manages questions, permissions, and todo interactions.
 */
@injectable()
export class InteractionServiceImpl implements Disposable {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    private _pendingQuestions: SDKTypes.QuestionRequest[] = [];
    private _pendingPermissions: PermissionNotification[] = [];
    private _todos: TodoItem[] = [];

    private readonly onQuestionChangedEmitter = new Emitter<SDKTypes.QuestionRequest[]>();
    readonly onQuestionChanged: Event<SDKTypes.QuestionRequest[]> = this.onQuestionChangedEmitter.event;

    private readonly onPermissionChangedEmitter = new Emitter<PermissionNotification[]>();
    readonly onPermissionChanged: Event<PermissionNotification[]> = this.onPermissionChangedEmitter.event;

    private readonly onTodosChangedEmitter = new Emitter<TodoItem[]>();
    readonly onTodosChanged: Event<TodoItem[]> = this.onTodosChangedEmitter.event;

    get pendingQuestions(): SDKTypes.QuestionRequest[] {
        return this._pendingQuestions;
    }

    get pendingPermissions(): PermissionNotification[] {
        return this._pendingPermissions;
    }

    get todos(): TodoItem[] {
        return this._todos;
    }

    // ── Question methods ──

    addPendingQuestion(question: SDKTypes.QuestionRequest): void {
        this.logger.debug(`[Interaction] Adding pending question: ${question.id}`);
        const existingIndex = this._pendingQuestions.findIndex(q => q.id === question.id);
        if (existingIndex >= 0) {
            this._pendingQuestions[existingIndex] = question;
        } else {
            this._pendingQuestions.push(question);
        }
        this.onQuestionChangedEmitter.fire([...this._pendingQuestions]);
    }

    removePendingQuestion(requestId: string): void {
        this.logger.debug(`[Interaction] Removing pending question: ${requestId}`);
        this._pendingQuestions = this._pendingQuestions.filter(q => q.id !== requestId);
        this.onQuestionChangedEmitter.fire([...this._pendingQuestions]);
    }

    /**
     * Load pending questions for a session from the REST API.
     * Handles questions created before the SSE connection was established.
     */
    async loadPendingQuestions(projectId: string, sessionId: string): Promise<void> {
        try {
            const questions = await this.openCodeService.listPendingQuestions(projectId, sessionId);
            if (questions.length > 0) {
                this.logger.info(`[Interaction] Loaded ${questions.length} pending question(s) for session ${sessionId}`);
                for (const q of questions) {
                    this.addPendingQuestion(q);
                }
            }
        } catch (error) {
            this.logger.warn('[Interaction] Failed to load pending questions (non-fatal):', error);
        }
    }

    async answerQuestion(projectId: string, requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<void> {
        this.logger.info(`[Interaction] Operation: answerQuestion(${requestId})`);
        await this.openCodeService.answerQuestion(projectId, requestId, answers);
        this.removePendingQuestion(requestId);
    }

    async rejectQuestion(projectId: string, requestId: string): Promise<void> {
        this.logger.info(`[Interaction] Operation: rejectQuestion(${requestId})`);
        await this.openCodeService.rejectQuestion(projectId, requestId);
        this.removePendingQuestion(requestId);
    }

    // ── Todo methods ──

    updateTodos(todos: TodoItem[]): void {
        this._todos = todos;
        this.onTodosChangedEmitter.fire([...this._todos]);
    }

    // ── Permission methods ──

    addPendingPermission(permission: PermissionNotification): void {
        this.logger.debug(`[Interaction] Adding pending permission: ${permission.permissionId}`);
        const existingIndex = this._pendingPermissions.findIndex(p => p.permissionId === permission.permissionId);
        if (existingIndex >= 0) {
            this._pendingPermissions[existingIndex] = permission;
        } else {
            this._pendingPermissions.push(permission);
        }
        this.onPermissionChangedEmitter.fire([...this._pendingPermissions]);
    }

    removePendingPermission(permissionId: string): void {
        this.logger.debug(`[Interaction] Removing pending permission: ${permissionId}`);
        this._pendingPermissions = this._pendingPermissions.filter(p => p.permissionId !== permissionId);
        this.onPermissionChangedEmitter.fire([...this._pendingPermissions]);
    }

    async replyPermission(projectId: string, requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> {
        this.logger.info(`[Interaction] Operation: replyPermission(${requestId}, ${reply})`);
        await this.openCodeService.replyPermission(projectId, requestId, reply);
        this.removePendingPermission(requestId);
    }

    /** Clear all pending state (used on session switch). */
    clearAll(): void {
        this._pendingQuestions = [];
        this._pendingPermissions = [];
        this.onQuestionChangedEmitter.fire([]);
        this.onPermissionChangedEmitter.fire([]);
    }

    dispose(): void {
        this.onQuestionChangedEmitter.dispose();
        this.onPermissionChangedEmitter.dispose();
        this.onTodosChangedEmitter.dispose();
    }
}
