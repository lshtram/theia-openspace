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

import { Emitter, Event, Disposable } from '@theia/core';
import { PermissionNotification, OpenCodeService } from '../common/opencode-protocol';

/**
 * PermissionDialogManager manages the state and logic for the permission dialog system.
 * 
 * Responsibilities:
 * - Queue incoming permission requests (FIFO)
 * - Manage current request and dialog open/close state
 * - Handle grant/deny actions with backend integration
 * - Implement 60-second timeout auto-deny
 * - Emit state change events for UI updates
 * 
 * Design:
 * - Pure TypeScript (no React) for testability
 * - Singleton lifecycle (one manager per application)
 * - All state mutations emit change events
 */
export class PermissionDialogManager implements Disposable {
    private readonly stateChangeEmitter = new Emitter<void>();
    private readonly requestQueue: PermissionNotification[] = [];
    private current: PermissionNotification | null = null;
    private timeoutHandle: NodeJS.Timeout | null = null;
    private processedIds = new Set<string>(); // Prevent duplicate processing

    /**
     * Timeout duration in milliseconds (60 seconds).
     */
    private readonly TIMEOUT_MS = 60000;

    constructor(
        private readonly openCodeService: OpenCodeService
    ) {}

    /**
     * Event fired whenever dialog state changes (open/close, current request, queue).
     */
    get onStateChange(): Event<void> {
        return this.stateChangeEmitter.event;
    }

    /**
     * Whether the dialog is currently open.
     */
    get isOpen(): boolean {
        return this.current !== null;
    }

    /**
     * The current permission request being displayed (null if dialog closed).
     */
    get currentRequest(): PermissionNotification | null {
        return this.current;
    }

    /**
     * Number of requests queued (not including current request).
     */
    get queueLength(): number {
        return this.requestQueue.length;
    }

    /**
     * Current position in queue (1-indexed). Returns 1 if showing first request.
     */
    get currentPosition(): number {
        return 1; // Current request is always position 1
    }

    /**
     * Total number of requests (current + queued).
     */
    get totalRequests(): number {
        return this.current ? 1 + this.requestQueue.length : 0;
    }

    /**
     * Handle incoming permission event.
     * 
     * If no request is currently being displayed, show it immediately.
     * Otherwise, add to queue.
     * 
     * @param event - Permission event notification
     */
    handlePermissionEvent(event: PermissionNotification): void {
        // Ignore non-requested events
        if (event.type !== 'requested') {
            return;
        }

        // Prevent duplicate processing
        const permId = event.permissionId;
        if (!permId || this.processedIds.has(permId)) {
            return;
        }

        this.processedIds.add(permId);

        if (this.current === null) {
            // No current request, show immediately
            this.showRequest(event);
        } else {
            // Queue request
            this.requestQueue.push(event);
            this.emitStateChange();
        }
    }

    /**
     * Grant the current permission request.
     * Calls backend grantPermission API and moves to next queued request.
     */
    async grant(): Promise<void> {
        if (!this.current) {
            // Defensive: no current request
            return;
        }

        const { projectId, sessionId, permissionId } = this.current;

        if (!projectId || !sessionId || !permissionId) {
            console.warn('[PermissionDialogManager] Missing required fields for grant');
            await this.processNextRequest();
            return;
        }

        try {
            // Call backend to grant permission
            await this.openCodeService.grantPermission(projectId, sessionId, permissionId);
            console.debug(`[PermissionDialogManager] Permission granted: ${permissionId}`);
        } catch (error) {
            console.error('[PermissionDialogManager] Error granting permission:', error);
        } finally {
            // Always move to next request
            await this.processNextRequest();
        }
    }

    /**
     * Deny the current permission request.
     * Does NOT call backend (denial is implicit - no grant).
     * Moves to next queued request.
     */
    async deny(): Promise<void> {
        if (!this.current) {
            // Defensive: no current request
            return;
        }

        console.debug(`[PermissionDialogManager] Permission denied: ${this.current.permissionId}`);
        
        // Denial is implicit (backend times out if no grant received)
        await this.processNextRequest();
    }

    /**
     * Dispose manager and clean up resources.
     */
    dispose(): void {
        this.clearTimeout();
        this.current = null;
        this.requestQueue.length = 0;
        this.processedIds.clear();
        this.stateChangeEmitter.dispose();
    }

    /**
     * Show a permission request (set as current and start timeout).
     */
    private showRequest(event: PermissionNotification): void {
        this.current = event;
        this.startTimeout();
        this.emitStateChange();
    }

    /**
     * Process the next queued request, or close dialog if queue is empty.
     */
    private async processNextRequest(): Promise<void> {
        this.clearTimeout();

        if (this.requestQueue.length > 0) {
            // Dequeue next request (FIFO)
            const nextRequest = this.requestQueue.shift()!;
            this.showRequest(nextRequest);
        } else {
            // No more requests, close dialog
            this.current = null;
            this.emitStateChange();
        }
    }

    /**
     * Start 60-second timeout for current request.
     * Auto-denies and moves to next request after timeout.
     */
    private startTimeout(): void {
        this.clearTimeout();

        this.timeoutHandle = setTimeout(() => {
            console.warn(`[PermissionDialogManager] Permission request timed out: ${this.current?.permissionId}`);
            this.deny(); // Auto-deny on timeout
        }, this.TIMEOUT_MS);
    }

    /**
     * Clear active timeout.
     */
    private clearTimeout(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
    }

    /**
     * Emit state change event to notify listeners.
     */
    private emitStateChange(): void {
        this.stateChangeEmitter.fire();
    }
}
