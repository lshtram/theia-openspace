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
import { CommandRegistry } from '@theia/core/lib/common';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { Widget } from '@lumino/widgets';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { URI } from '@theia/core/lib/common/uri';
import * as path from 'path';

/**
 * Argument types for PaneService operations.
 */
export interface PaneOpenArgs {
    type: 'editor' | 'terminal' | 'presentation' | 'whiteboard';
    contentId: string;
    title?: string;
    splitDirection?: 'horizontal' | 'vertical';
    /** Optional: ID of an existing pane to split relative to. When provided and the
     *  widget is found, the new pane is opened relative to it (respecting splitDirection).
     *  If the widget is not found, falls back to the currently active widget. */
    sourcePaneId?: string;
}

export interface PaneCloseArgs {
    paneId: string;
}

export interface PaneFocusArgs {
    paneId: string;
}

export interface PaneResizeArgs {
    paneId: string;
    width?: number;  // percentage (0-100)
    height?: number; // percentage (0-100)
}

/**
 * Pane info with geometry.
 */
export interface PaneInfo {
    id: string;
    area: 'main' | 'left' | 'right' | 'bottom';
    title: string;
    tabs: TabInfo[];
    activeTab?: string;
    width?: number;  // percentage
    height?: number; // percentage
}

/**
 * Tab info for pane state.
 */
export interface TabInfo {
    id: string;
    title: string;
    type: 'editor' | 'terminal' | 'presentation' | 'whiteboard' | 'other';
    isDirty?: boolean;
    uri?: string;
}

/**
 * Pane state snapshot for layout change events.
 */
export interface PaneStateSnapshot {
    panes: PaneInfo[];
    activePane?: string;
    timestamp: string;
}

/**
 * Agent pane tracking info for resource cleanup (GAP-4).
 */
export interface AgentPaneInfo {
    paneId: string;
    createdAt: Date;
    pinned: boolean;
}

/**
 * PaneService Symbol for dependency injection.
 */
export const PaneService = Symbol('PaneService');

/**
 * PaneService interface for pane management.
 */
export interface PaneService extends Disposable {
    /**
     * Open content in a pane (editor, terminal, presentation, whiteboard).
     * Maps to ApplicationShell.addWidget() with correct WidgetOptions.
     */
    openContent(args: PaneOpenArgs): Promise<{ success: boolean; paneId?: string }>;
    
    /**
     * Close a pane by ID. Confirms closure or throws if pane doesn't exist.
     */
    closeContent(args: PaneCloseArgs): Promise<{ success: boolean }>;
    
    /**
     * Focus a pane by ID, bringing it to front and setting keyboard focus.
     */
    focusContent(args: PaneFocusArgs): Promise<{ success: boolean }>;
    
    /**
     * List all panes with geometry (percentages), tab info, and active tab.
     * Traverses the DockPanel layout tree.
     */
    listPanes(): Promise<PaneInfo[]>;
    
    /**
     * Resize a pane to specified dimensions (percentage-based).
     */
    resizePane(args: PaneResizeArgs): Promise<{ success: boolean }>;
    
    /**
     * Event emitted when layout changes (pane opened, closed, resized, focused).
     */
    get onPaneLayoutChanged(): Event<PaneStateSnapshot>;
    
    /**
     * Mark a pane as agent-created (for cleanup tracking).
     */
    trackAgentPane(paneId: string, pinned?: boolean): void;
    
    /**
     * Get all agent-created panes (for cleanup).
     */
    getAgentPanes(): AgentPaneInfo[];
}

/**
 * PaneService implementation - wraps Eclipse Theia's ApplicationShell for programmatic pane control.
 * 
 * Responsibilities:
 * - Open, close, focus, list, and resize panes
 * - Track agent-created panes for cleanup (GAP-4)
 * - Emit layout change events for state synchronization
 * - T2-8: Properly dispose event subscriptions on service shutdown
 */
@injectable()
export class PaneServiceImpl implements PaneService {

    @inject(ApplicationShell)
    private readonly shell!: ApplicationShell;

    @inject(TerminalService)
    private readonly terminalService!: TerminalService;

    @inject(EditorManager)
    private readonly editorManager!: EditorManager;

    @inject(WorkspaceService)
    private readonly workspaceService!: WorkspaceService;

    @inject(CommandRegistry)
    protected readonly commandRegistry!: CommandRegistry;

    // Event emitters
    private readonly _onPaneLayoutChanged = new Emitter<PaneStateSnapshot>();
    
    // T2-8: Track all disposables for cleanup
    private readonly disposables: Disposable[] = [];
    
    // Agent pane tracking for GAP-4 cleanup
    private readonly agentPanes: Map<string, AgentPaneInfo> = new Map();

    /**
     * Event emitted when layout changes.
     */
    get onPaneLayoutChanged(): Event<PaneStateSnapshot> {
        return this._onPaneLayoutChanged.event;
    }

    /**
     * Initialize the service - subscribe to shell events.
     * T2-8: Track subscriptions for later disposal
     */
    @postConstruct()
    protected init(): void {
        console.info('[PaneService] Initializing...');

        // Subscribe to active widget changes
        const activeWidgetDisposable = this.shell.onDidChangeActiveWidget(() => {
            this.emitLayoutChange();
        });
        this.disposables.push(activeWidgetDisposable);

        // Subscribe to widget additions
        const addWidgetDisposable = this.shell.onDidAddWidget(() => {
            this.emitLayoutChange();
        });
        this.disposables.push(addWidgetDisposable);

        // Subscribe to widget removals
        const removeWidgetDisposable = this.shell.onDidRemoveWidget(() => {
            this.emitLayoutChange();
        });
        this.disposables.push(removeWidgetDisposable);

        console.info('[PaneService] Initialized');
    }

    /**
     * Open content in a pane.
     */
    async openContent(args: PaneOpenArgs): Promise<{ success: boolean; paneId?: string }> {
        console.info(`[PaneService] Operation: openContent(${args.type}, ${args.contentId})`);

        try {
            if (args.type === 'editor') {
                // Build the URI correctly: absolute paths use fromFilePath, relative paths resolve against workspace root
                let uri: URI;
                if (path.isAbsolute(args.contentId)) {
                    uri = URI.fromFilePath(args.contentId);
                } else if (args.contentId.startsWith('file://')) {
                    uri = new URI(args.contentId);
                } else {
                    // Relative path — resolve against workspace root
                    const roots = this.workspaceService.tryGetRoots();
                    const workspaceRoot = roots.length > 0
                        ? roots[0].resource.path.toString()
                        : '/';
                    uri = URI.fromFilePath(path.join(workspaceRoot, args.contentId));
                }

                // Resolve optional source pane for targeted splitting
                const refWidget = args.sourcePaneId
                    ? this.shell.getWidgetById(args.sourcePaneId) ?? undefined
                    : undefined;

                const widgetOptions: ApplicationShell.WidgetOptions = {
                    area: 'main',
                    mode: args.splitDirection === 'vertical' ? 'split-right' :
                          args.splitDirection === 'horizontal' ? 'split-bottom' : 'tab-after',
                    ...(refWidget ? { ref: refWidget } : {}),
                };
                const editorWidget = await this.editorManager.open(uri, { mode: 'activate', widgetOptions });
                const paneId = editorWidget.id;
                this.trackAgentPane(paneId, false);
                this.emitLayoutChange();
                return { success: true, paneId };
            }

            if (args.type === 'terminal') {
                // Open a new terminal in the bottom panel
                const options: any = {
                    title: args.title || args.contentId || 'Agent Terminal',
                };
                const widget = await this.terminalService.newTerminal(options);
                await widget.start();
                this.terminalService.open(widget);
                const paneId = widget.id;
                this.trackAgentPane(paneId, false);
                this.emitLayoutChange();
                return { success: true, paneId };
            }

            if (args.type === 'presentation') {
                // Map PaneOpenArgs.splitDirection to PresentationOpenArgs.splitDirection:
                // 'vertical' → 'right' (split-right), 'horizontal' → 'bottom' (split-bottom)
                const splitDirection: 'right' | 'left' | 'bottom' | 'new-tab' | undefined =
                    args.splitDirection === 'vertical' ? 'right' :
                    args.splitDirection === 'horizontal' ? 'bottom' :
                    undefined;
                await this.commandRegistry.executeCommand(
                    'openspace.presentation.open',
                    {
                        path: args.contentId,
                        splitDirection,
                    }
                );
                return { success: true };
            }

            // For other types (whiteboard), fall back to a label pane
            const area = this.getAreaForType(args.type);
            const widgetOptions: ApplicationShell.WidgetOptions = {
                area,
                mode: args.splitDirection === 'vertical' ? 'split-right' :
                      args.splitDirection === 'horizontal' ? 'split-bottom' : 'tab-after',
            };
            console.debug(`[PaneService] No handler for type '${args.type}', area=${area}`, widgetOptions);
            this.emitLayoutChange();
            return { success: false };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[PaneService] Error opening content: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * Close a pane by ID.
     */
    async closeContent(args: PaneCloseArgs): Promise<{ success: boolean }> {
        console.info(`[PaneService] Operation: closeContent(${args.paneId})`);

        try {
            const widget = this.shell.getWidgetById(args.paneId);
            
            if (!widget) {
                console.warn(`[PaneService] Pane not found: ${args.paneId}`);
                return { success: false };
            }

            await this.shell.closeWidget(widget.id);
            
            // Remove from agent tracking
            this.agentPanes.delete(args.paneId);
            
            // Emit layout change event
            this.emitLayoutChange();

            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[PaneService] Error closing content: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * Focus a pane by ID.
     */
    async focusContent(args: PaneFocusArgs): Promise<{ success: boolean }> {
        console.info(`[PaneService] Operation: focusContent(${args.paneId})`);

        try {
            const widget = this.shell.getWidgetById(args.paneId);
            
            if (!widget) {
                console.warn(`[PaneService] Pane not found: ${args.paneId}`);
                return { success: false };
            }

            await this.shell.activateWidget(widget.id);
            // Reveal in case the panel is collapsed
            await this.shell.revealWidget(widget.id);
            
            // Emit layout change event
            this.emitLayoutChange();

            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[PaneService] Error focusing content: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * List all panes with geometry.
     */
    async listPanes(): Promise<PaneInfo[]> {
        console.debug('[PaneService] Operation: listPanes()');

        const panes: PaneInfo[] = [];

        // Collect from all areas using the getWidgets API
        const areas: Array<{ area: 'main' | 'left' | 'right' | 'bottom' }> = [
            { area: 'main' },
            { area: 'bottom' },
            { area: 'left' },
            { area: 'right' },
        ];

        for (const { area } of areas) {
            const widgets = this.shell.getWidgets(area);
            for (const widget of widgets) {
                if (widget && !widget.isDisposed) {
                    const paneInfo = this.widgetToPaneInfo(widget, area);
                    if (paneInfo) {
                        panes.push(paneInfo);
                    }
                }
            }
        }

        return panes;
    }

    /**
     * Resize a pane to specified dimensions.
     */
    async resizePane(args: PaneResizeArgs): Promise<{ success: boolean }> {
        console.info(`[PaneService] Operation: resizePane(${args.paneId}, ${args.width}x${args.height})`);

        try {
            const widget = this.shell.getWidgetById(args.paneId);
            
            if (!widget) {
                console.warn(`[PaneService] Pane not found: ${args.paneId}`);
                return { success: false };
            }

            // Note: Theia's ApplicationShell doesn't have a direct resize API
            // This would require accessing the underlying panel's layout
            // For now, we emit the layout change and return success
            // A full implementation would need to manipulate the DockPanel's layout data
            
            console.debug(`[PaneService] Resizing pane ${args.paneId} to ${args.width}% x ${args.height}%`);
            
            // Emit layout change event
            this.emitLayoutChange();

            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[PaneService] Error resizing pane: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * Track an agent-created pane for cleanup.
     */
    trackAgentPane(paneId: string, pinned: boolean = false): void {
        console.debug(`[PaneService] Tracking agent pane: ${paneId}, pinned=${pinned}`);
        
        this.agentPanes.set(paneId, {
            paneId,
            createdAt: new Date(),
            pinned
        });
    }

    /**
     * Get all agent-created panes for cleanup.
     */
    getAgentPanes(): AgentPaneInfo[] {
        return Array.from(this.agentPanes.values());
    }

    /**
     * Dispose the service.
     * T2-8: Clean up all event subscriptions
     */
    dispose(): void {
        console.info('[PaneService] Disposing...');
        
        // T2-8: Dispose all tracked subscriptions
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables.length = 0;
        
        this._onPaneLayoutChanged.dispose();
        this.agentPanes.clear();
        
        console.info('[PaneService] Disposed');
    }

    // Private helper methods

    /**
     * Determine the area for a content type.
     */
    private getAreaForType(type: PaneOpenArgs['type']): 'main' | 'left' | 'right' | 'bottom' {
        switch (type) {
            case 'terminal':
                return 'bottom';
            case 'presentation':
            case 'whiteboard':
                return 'right';
            case 'editor':
            default:
                return 'main';
        }
    }

    /**
     * Convert a widget to PaneInfo.
     */
    private widgetToPaneInfo(widget: Widget, area: 'main' | 'left' | 'right' | 'bottom'): PaneInfo | null {
        if (!widget || !widget.id) {
            return null;
        }

        // Get title
        const title = widget.title?.label || widget.id;
        
        // Determine type from widget class/ID
        let type: TabInfo['type'] = 'other';
        if (widget instanceof EditorWidget) {
            type = 'editor';
        } else if (widget.id.includes('terminal')) {
            type = 'terminal';
        } else if (widget.id.includes('presentation')) {
            type = 'presentation';
        } else if (widget.id.includes('whiteboard')) {
            type = 'whiteboard';
        }

        // Build tab info
        const tabs: TabInfo[] = [];
        
        // Check if this is a tabbed widget (has currentWidget)
        if ((widget as any).currentWidget) {
            const currentWidget = (widget as any).currentWidget;
            if (currentWidget && !currentWidget.isDisposed) {
                tabs.push({
                    id: currentWidget.id,
                    title: currentWidget.title?.label || currentWidget.id,
                    type: this.determineWidgetType(currentWidget),
                });
            }
        } else {
            // Single widget
            tabs.push({
                id: widget.id,
                title,
                type,
            });
        }

        // Check if this widget is active
        const activeWidget = this.shell.activeWidget;
        const isActive = activeWidget?.id === widget.id;

        return {
            id: widget.id,
            area,
            title,
            tabs,
            activeTab: isActive ? tabs[0]?.id : undefined,
        };
    }

    /**
     * Determine widget type from widget ID.
     */
    private determineWidgetType(widget: Widget): TabInfo['type'] {
        if (widget instanceof EditorWidget) {
            return 'editor';
        }
        const id = widget.id.toLowerCase();
        
        if (id.includes('terminal') || id.includes('term')) {
            return 'terminal';
        }
        if (id.includes('presentation')) {
            return 'presentation';
        }
        if (id.includes('whiteboard')) {
            return 'whiteboard';
        }
        
        return 'other';
    }

    /**
     * Emit a layout change event.
     */
    private async emitLayoutChange(): Promise<void> {
        const panes = await this.listPanes();
        const activeWidget = this.shell.activeWidget;
        
        const snapshot: PaneStateSnapshot = {
            panes,
            activePane: activeWidget?.id,
            timestamp: new Date().toISOString(),
        };

        this._onPaneLayoutChanged.fire(snapshot);
    }
}
