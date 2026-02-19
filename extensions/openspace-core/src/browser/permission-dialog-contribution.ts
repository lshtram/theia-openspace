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
import { ILogger } from '@theia/core/lib/common/logger';
import * as React from '@theia/core/shared/react';
import { createRoot } from '@theia/core/shared/react-dom/client';
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

    @inject(ILogger)
    protected readonly logger!: ILogger;

    private manager: PermissionDialogManager | null = null;
    private dialogContainer: HTMLElement | null = null;
    private permissionEventDisposable: Disposable | null = null;
    private root: any | null = null;

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
        this.manager = new PermissionDialogManager(this.openCodeService, this.logger);

        // Subscribe to permission events from sync service
        this.subscribeToPermissionEvents();

        // Render dialog component into DOM
        this.renderDialog(app);

        // Expose test helper (E2E test support)
        this.exposeTestHelper();

        this.logger.debug('[PermissionDialogContribution] Permission dialog system initialized');
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

        this.logger.debug('[PermissionDialogContribution] Subscribed to permission events');
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

        // Render React component
        const element = React.createElement(PermissionDialog, { manager: this.manager });
        this.root = createRoot(this.dialogContainer);
        this.root.render(element);

        this.logger.debug('[PermissionDialogContribution] Dialog component rendered');
    }

    /**
     * Expose test helper for E2E tests.
     * T2-15: Only exposed in test/development mode, not production.
     */
    private exposeTestHelper(): void {
        // T2-15: Guard with environment check - always expose in dev/test, check NODE_ENV in prod
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let isDevMode = true;
        
        // Check if we're in production mode
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof process !== 'undefined' && typeof (process as any).env !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nodeEnv = (process as any).env.NODE_ENV;
            if (nodeEnv === 'production') {
                isDevMode = false;
            }
        }
        
        if (isDevMode) {
            // Use Object.assign to MERGE into existing __openspace_test__ (preserve SyncService hooks)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof (window as any).__openspace_test__ === 'undefined') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).__openspace_test__ = {};
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.assign((window as any).__openspace_test__, {
                injectPermissionEvent: (event: any) => {
                    if (this.manager) {
                        this.manager.handlePermissionEvent(event);
                    }
                }
            });
            this.logger.info('[PermissionDialogContribution] Test helper exposed on window.__openspace_test__');
        }
    }

    /**
     * Called when frontend application stops.
     * Delegates to dispose for cleanup.
     */
    onStop(): void {
        this.dispose();
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

        // Unmount React component
        if (this.root) {
            this.root.unmount();
            this.root = null;
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

        this.logger.debug('[PermissionDialogContribution] Permission dialog system disposed');
    }
}
