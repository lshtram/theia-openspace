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
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { Disposable } from '@theia/core';
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { OpenCodeService } from '../common/opencode-protocol';
import { OpenCodeSyncService } from './opencode-sync-service';
import { PermissionDialogManager } from './permission-dialog-manager';
import { PermissionDialog } from './permission-dialog';
import './style/permission-dialog.css';

/**
 * PermissionDialogContribution integrates the permission dialog system into Theia.
 * 
 * Responsibilities:
 * - Create and manage PermissionDialogManager singleton
 * - Subscribe to permission events from OpenCodeSyncService
 * - Render PermissionDialog React component into DOM
 * - Clean up on disposal
 * 
 * Lifecycle:
 * - onStart: Create manager, subscribe to events, render component
 * - onStop: Dispose manager, unmount component
 */
@injectable()
export class PermissionDialogContribution implements FrontendApplicationContribution, Disposable {

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    @inject(OpenCodeSyncService)
    protected readonly syncService!: OpenCodeSyncService;

    private manager: PermissionDialogManager | null = null;
    private dialogContainer: HTMLElement | null = null;
    private reactRoot: ReactDOM.Root | null = null;
    private permissionEventDisposable: Disposable | null = null;

    @postConstruct()
    protected init(): void {
        // Initialization happens in onStart
    }

    /**
     * Called when frontend application starts.
     * Sets up permission dialog system.
     */
    onStart(app: FrontendApplication): void {
        // Create manager
        this.manager = new PermissionDialogManager(this.openCodeService);

        // Subscribe to permission events from sync service
        this.subscribeToPermissionEvents();

        // Render dialog component into DOM
        this.renderDialog(app);

        console.debug('[PermissionDialogContribution] Permission dialog system initialized');
    }

    /**
     * Subscribe to permission events from OpenCodeSyncService.
     * Forward events to manager for processing.
     */
    private subscribeToPermissionEvents(): void {
        if (!this.manager) {
            return;
        }

        // Subscribe to permission requested events
        this.permissionEventDisposable = this.syncService.onPermissionRequested((event) => {
            if (this.manager) {
                this.manager.handlePermissionEvent(event);
            }
        });

        console.debug('[PermissionDialogContribution] Subscribed to permission events');
    }

    /**
     * Render PermissionDialog component into DOM.
     * Creates a container div and appends to document body.
     */
    private renderDialog(app: FrontendApplication): void {
        if (!this.manager) {
            return;
        }

        // Create container for dialog
        this.dialogContainer = document.createElement('div');
        this.dialogContainer.id = 'openspace-permission-dialog-root';
        document.body.appendChild(this.dialogContainer);

        // Render React component (React 18 API)
        const element = React.createElement(PermissionDialog, { manager: this.manager });
        this.reactRoot = ReactDOM.createRoot(this.dialogContainer);
        this.reactRoot.render(element);

        console.debug('[PermissionDialogContribution] Dialog component rendered');
    }

    /**
     * Dispose contribution and clean up resources.
     */
    dispose(): void {
        // Dispose manager
        if (this.manager) {
            this.manager.dispose();
            this.manager = null;
        }

        // Unmount React component (React 18 API)
        if (this.reactRoot) {
            this.reactRoot.unmount();
            this.reactRoot = null;
        }

        if (this.dialogContainer) {
            document.body.removeChild(this.dialogContainer);
            this.dialogContainer = null;
        }

        // Dispose event subscription
        if (this.permissionEventDisposable) {
            this.permissionEventDisposable.dispose();
            this.permissionEventDisposable = null;
        }

        console.debug('[PermissionDialogContribution] Permission dialog system disposed');
    }
}
