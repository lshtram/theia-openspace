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
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ILogger } from '@theia/core/lib/common/logger';
import { PaneService, PaneStateSnapshot } from './pane-service';
import { OpenCodeSyncService, OpenCodeSyncServiceImpl } from './opencode-sync-service';
import { SessionService } from './session-service';

/**
 * Command result structure for feedback mechanism.
 */
export interface CommandResult {
    cmd: string;
    args: unknown;
    success: boolean;
    output?: unknown;
    error?: string;
    executionTime: number;
    timestamp: string;
}

/**
 * OpenSpaceBridgeContribution - Frontend service that bridges Theia and the OpenSpace Hub.
 *
 * Responsibilities:
 * 1. On startup: register this browser frontend as the MCP command bridge with the Hub.
 * 2. Subscribe to pane state changes and publish snapshots to Hub.
 *
 * Architecture: Phase T3 (MCP Agent Control)
 * - Bridge Registration: POST /openspace/register-bridge
 * - State Publishing: POST /openspace/state
 *
 * Graceful Degradation:
 * - Service functions even if Hub is unavailable at startup.
 * - Errors are logged but do not block the application.
 */
@injectable()
export class OpenSpaceBridgeContribution implements FrontendApplicationContribution {

    @inject(PaneService)
    private readonly paneService!: PaneService;

    @inject(OpenCodeSyncService)
    private readonly syncService!: OpenCodeSyncServiceImpl;

    @inject(SessionService)
    private readonly sessionService!: SessionService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    private readonly hubBaseUrl = window.location.origin; // Use current origin (Theia port)
    
    // Throttling for state publishing (max 1 POST per second)
    private lastPublishTime = 0;
    private readonly throttleDelay = 1000; // 1 second

    /**
     * Called when the frontend application starts.
     * Registers the browser as the command bridge with the Hub.
     */
    async onStart(): Promise<void> {
        this.logger.info('[BridgeContribution] Starting...');
        
        // Wire SessionService → SyncService (breaks circular DI dependency)
        this.syncService.setSessionService(this.sessionService);
        
        // Register this browser as the MCP command bridge
        await this.registerBridge();
        
        // Subscribe to pane state changes
        this.subscribeToPaneState();
    }

    /**
     * Called when the frontend application stops.
     * Cleans up resources.
     */
    onStop(): void {
        this.logger.info('[BridgeContribution] Stopping...');
        // Note: SSE connection removed in Architecture B1
    }

    /**
     * Register this browser frontend as the MCP command bridge with the Hub.
     * The Hub uses this registration to know the browser is ready to receive commands.
     */
    private async registerBridge(): Promise<void> {
        try {
            const response = await fetch(`${this.hubBaseUrl}/openspace/register-bridge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timestamp: new Date().toISOString() })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.logger.info('[BridgeContribution] Registered as MCP command bridge');
        } catch (error: any) {
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.logger.warn('[BridgeContribution] Warning: Hub not available, bridge not registered');
            } else {
                this.logger.error('[BridgeContribution] Error registering bridge:', error);
            }
        }
    }

    // NOTE: publishPaneState() method deferred to Phase 2
    // Future implementation will:
    // - Collect pane state from ApplicationShell
    // - Build PaneStateSnapshot
    // - POST to http://localhost:3001/openspace/state
    // - Support system prompt generation with IDE context

    /**
     * Subscribe to PaneService layout changes and publish state to Hub.
     * 
     * Implementation:
     * 1. Subscribe to onPaneLayoutChanged event
     * 2. On each change, call publishState with throttling
     */
    private subscribeToPaneState(): void {
        this.logger.info('[BridgeContribution] Subscribing to pane state changes...');
        
        this.paneService.onPaneLayoutChanged((snapshot: PaneStateSnapshot) => {
            this.publishState(snapshot);
        });
    }

    /**
     * Publish pane state snapshot to Hub with throttling.
     * 
     * Throttling:
     * - Max 1 POST per second to avoid flooding
     * - Uses Date.now() for timing
     * - Skips publish if within throttle window
     * 
     * Error Handling:
     * - Hub unavailable: logs warning, continues
     * - Network error: logs error, continues
     * - Doesn't block subsequent attempts
     * 
     * @param state Pane state snapshot to publish
     */
    private async publishState(state: PaneStateSnapshot): Promise<void> {
        const now = Date.now();
        
        // Throttle: skip if within throttle window
        if (now - this.lastPublishTime < this.throttleDelay) {
            return;
        }
        
        this.lastPublishTime = now;
        
        try {
            const response = await fetch(`${this.hubBaseUrl}/openspace/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.logger.debug(`[BridgeContribution] Published pane state: ${state.panes.length} panes`);
        } catch (error: any) {
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.logger.warn('[BridgeContribution] Warning: Hub not available, state not published');
            } else {
                this.logger.error('[BridgeContribution] Error publishing state:', error);
            }
        }
    }
}
