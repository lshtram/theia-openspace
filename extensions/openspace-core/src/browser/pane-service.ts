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
import { ILogger } from '@theia/core/lib/common/logger';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { Widget } from '@lumino/widgets';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidgetOptions } from '@theia/terminal/lib/browser/base/terminal-widget';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { URI } from '@theia/core/lib/common/uri';
import * as path from './browser-path';

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
    x?: number;      // percentage
    y?: number;      // percentage
    width?: number;  // percentage
    height?: number; // percentage
}

interface PersistedPaneStructure {
    paneId: string;
    area: 'main' | 'left' | 'right' | 'bottom';
    title: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    activeTab?: string;
}

interface PersistedLayoutStructure {
    panes: PersistedPaneStructure[];
    activePane?: string;
    persistedAt: string;
}

interface PersistedPaneContent {
    paneId: string;
    activeTab?: string;
    tabs: TabInfo[];
}

interface PersistedLayoutContent {
    panes: PersistedPaneContent[];
    persistedAt: string;
}

interface RestorePersistedLayoutOptions {
    restoreContent?: boolean;
}

interface ReorderTabArgs {
    paneId: string;
    tabId: string;
    targetIndex: number;
}

interface MoveTabArgs {
    sourcePaneId: string;
    targetPaneId: string;
    tabId: string;
    targetIndex?: number;
}

interface NamedLayoutEntry {
    structure: PersistedLayoutStructure;
    content: PersistedLayoutContent;
    savedAt: string;
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
    private static readonly LAYOUT_STRUCTURE_KEY = 'openspace.pane.layout.structure';
    private static readonly LAYOUT_CONTENT_KEY = 'openspace.pane.layout.content';
    private static readonly NAMED_LAYOUTS_KEY = 'openspace.pane.namedLayouts';

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

    @inject(ILogger)
    protected readonly logger!: ILogger;

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
        this.logger.info('[PaneService] Initializing...');

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

        this.logger.info('[PaneService] Initialized');
    }

    /**
     * Open content in a pane.
     */
    async openContent(args: PaneOpenArgs): Promise<{ success: boolean; paneId?: string }> {
        this.logger.info(`[PaneService] Operation: openContent(${args.type}, ${args.contentId})`);

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

                const uriString = uri.toString();
                const canonicalEditorId = `code-editor-opener:${uriString}:1`;
                const legacyEditorId = `code-editor-opener:${uriString}`;
                const existingEditor = this.shell.getWidgetById(canonicalEditorId)
                    ?? this.shell.getWidgetById(legacyEditorId);

                if (existingEditor) {
                    await this.shell.activateWidget(existingEditor.id);
                    await this.shell.revealWidget(existingEditor.id);
                    this.trackAgentPane(existingEditor.id, false);
                    this.emitLayoutChange();
                    return { success: true, paneId: existingEditor.id };
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
                const options: TerminalWidgetOptions = {
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

            if (args.type === 'whiteboard') {
                const isBlank = !args.contentId || args.contentId === '__blank__';
                await this.commandRegistry.executeCommand(
                    'openspace.whiteboard.open',
                    isBlank ? undefined : { path: args.contentId }
                );
                this.emitLayoutChange();
                return { success: true };
            }

            // Unknown type — no handler
            this.logger.warn(`[PaneService] No handler for type '${args.type}'`);
            return { success: false };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[PaneService] Error opening content: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * Close a pane by ID.
     */
    async closeContent(args: PaneCloseArgs): Promise<{ success: boolean }> {
        this.logger.info(`[PaneService] Operation: closeContent(${args.paneId})`);

        try {
            const widget = this.shell.getWidgetById(args.paneId);
            
            if (!widget) {
                this.logger.warn(`[PaneService] Pane not found: ${args.paneId}`);
                return { success: false };
            }

            if (this.isWidgetDirty(widget)) {
                const confirmed = typeof window?.confirm === 'function'
                    ? window.confirm('This tab has unsaved changes. Close without saving?')
                    : true;
                if (!confirmed) {
                    this.logger.info(`[PaneService] Close cancelled for dirty pane: ${args.paneId}`);
                    return { success: false };
                }
            }

            await this.shell.closeWidget(widget.id);
            
            // Remove from agent tracking
            this.agentPanes.delete(args.paneId);
            
            // Emit layout change event
            this.emitLayoutChange();

            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[PaneService] Error closing content: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * Focus a pane by ID.
     */
    async focusContent(args: PaneFocusArgs): Promise<{ success: boolean }> {
        this.logger.info(`[PaneService] Operation: focusContent(${args.paneId})`);

        try {
            const widget = this.shell.getWidgetById(args.paneId);
            
            if (!widget) {
                this.logger.warn(`[PaneService] Pane not found: ${args.paneId}`);
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
            this.logger.error(`[PaneService] Error focusing content: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * List all panes with geometry.
     */
    async listPanes(): Promise<PaneInfo[]> {
        this.logger.debug('[PaneService] Operation: listPanes()');

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
        this.logger.info(`[PaneService] Operation: resizePane(${args.paneId}, ${args.width}x${args.height})`);

        try {
            const widget = this.shell.getWidgetById(args.paneId);
            
            if (!widget) {
                this.logger.warn(`[PaneService] Pane not found: ${args.paneId}`);
                return { success: false };
            }

            // Task 17: Theia's ApplicationShell doesn't expose a direct resize API.
            // Return a clear error instead of silently pretending to succeed.
            this.logger.warn(`[PaneService] resizePane: resize is not implemented — Theia ApplicationShell has no direct resize API`);
            return { success: false, error: 'resizePane is not implemented' } as { success: boolean };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[PaneService] Error resizing pane: ${errorMsg}`);
            return { success: false };
        }
    }

    /**
     * Track an agent-created pane for cleanup.
     */
    trackAgentPane(paneId: string, pinned: boolean = false): void {
        this.logger.debug(`[PaneService] Tracking agent pane: ${paneId}, pinned=${pinned}`);
        
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

    async restorePersistedLayout(options: RestorePersistedLayoutOptions = {}): Promise<{ success: boolean; restoredStructure: boolean; restoredContent: boolean }> {
        const restoreContent = options.restoreContent === true;

        try {
            const structureRaw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_STRUCTURE_KEY);
            if (!structureRaw) {
                return { success: true, restoredStructure: false, restoredContent: false };
            }

            const structure = JSON.parse(structureRaw) as PersistedLayoutStructure;
            await this.applyPersistedLayoutStructure(structure);

            if (!restoreContent) {
                return { success: true, restoredStructure: true, restoredContent: false };
            }

            const contentRaw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_CONTENT_KEY);
            if (!contentRaw) {
                this.logger.warn('[PaneService] No persisted pane content found; preserving restored layout with placeholders');
                return { success: true, restoredStructure: true, restoredContent: false };
            }

            const content = JSON.parse(contentRaw) as PersistedLayoutContent;
            await this.restorePersistedContent(content);
            return { success: true, restoredStructure: true, restoredContent: true };
        } catch (error) {
            this.logger.error('[PaneService] Failed to restore persisted pane layout:', error);
            return { success: false, restoredStructure: false, restoredContent: false };
        }
    }

    async saveNamedLayout(name: string): Promise<{ success: boolean }> {
        const trimmed = name.trim();
        if (!trimmed) {
            return { success: false };
        }

        await this.emitLayoutChange();

        let structureRaw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_STRUCTURE_KEY);
        let contentRaw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_CONTENT_KEY);

        if (!structureRaw || !contentRaw) {
            const panes = await this.listPanes();
            const now = new Date().toISOString();
            const snapshot: PaneStateSnapshot = {
                panes,
                activePane: this.shell.activeWidget?.id,
                timestamp: now,
            };
            this.persistLayoutSnapshot(snapshot);
            structureRaw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_STRUCTURE_KEY);
            contentRaw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_CONTENT_KEY);
        }

        if (!structureRaw || !contentRaw) {
            return { success: false };
        }

        try {
            const layouts = this.loadNamedLayouts();
            layouts[trimmed] = {
                structure: JSON.parse(structureRaw) as PersistedLayoutStructure,
                content: JSON.parse(contentRaw) as PersistedLayoutContent,
                savedAt: new Date().toISOString(),
            };
            window.localStorage.setItem(PaneServiceImpl.NAMED_LAYOUTS_KEY, JSON.stringify(layouts));
            return { success: true };
        } catch (error) {
            this.logger.error(`[PaneService] Failed to save named layout '${trimmed}':`, error);
            return { success: false };
        }
    }

    listNamedLayouts(): string[] {
        return Object.keys(this.loadNamedLayouts()).sort();
    }

    async restoreNamedLayout(name: string, options: RestorePersistedLayoutOptions = {}): Promise<{ success: boolean; restoredStructure?: boolean; restoredContent?: boolean }> {
        const trimmed = name.trim();
        if (!trimmed) {
            return { success: false };
        }

        const layouts = this.loadNamedLayouts();
        const selected = layouts[trimmed];
        if (!selected) {
            return { success: false };
        }

        window.localStorage.setItem(PaneServiceImpl.LAYOUT_STRUCTURE_KEY, JSON.stringify(selected.structure));
        window.localStorage.setItem(PaneServiceImpl.LAYOUT_CONTENT_KEY, JSON.stringify(selected.content));
        return this.restorePersistedLayout(options);
    }

    async reorderTab(args: ReorderTabArgs): Promise<{ success: boolean }> {
        const content = this.readPersistedLayoutContent();
        if (!content) {
            return { success: false };
        }

        const pane = content.panes.find(entry => entry.paneId === args.paneId);
        if (!pane) {
            return { success: false };
        }

        const fromIndex = pane.tabs.findIndex(tab => tab.id === args.tabId);
        if (fromIndex < 0) {
            return { success: false };
        }

        const boundedIndex = Math.max(0, Math.min(args.targetIndex, pane.tabs.length - 1));
        const [tab] = pane.tabs.splice(fromIndex, 1);
        pane.tabs.splice(boundedIndex, 0, tab);
        this.writePersistedLayoutContent(content);
        return { success: true };
    }

    async moveTab(args: MoveTabArgs): Promise<{ success: boolean }> {
        const content = this.readPersistedLayoutContent();
        if (!content) {
            return { success: false };
        }

        const source = content.panes.find(entry => entry.paneId === args.sourcePaneId);
        const target = content.panes.find(entry => entry.paneId === args.targetPaneId);
        if (!source || !target) {
            return { success: false };
        }

        const fromIndex = source.tabs.findIndex(tab => tab.id === args.tabId);
        if (fromIndex < 0) {
            return { success: false };
        }

        const [tab] = source.tabs.splice(fromIndex, 1);
        const targetIndex = args.targetIndex ?? target.tabs.length;
        const boundedIndex = Math.max(0, Math.min(targetIndex, target.tabs.length));
        target.tabs.splice(boundedIndex, 0, tab);

        if (source.activeTab === args.tabId) {
            source.activeTab = source.tabs[0]?.id;
        }
        target.activeTab = tab.id;

        this.writePersistedLayoutContent(content);
        return { success: true };
    }

    /**
     * Dispose the service.
     * T2-8: Clean up all event subscriptions
     */
    dispose(): void {
        this.logger.info('[PaneService] Disposing...');
        
        // T2-8: Dispose all tracked subscriptions
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables.length = 0;
        
        this._onPaneLayoutChanged.dispose();
        this.agentPanes.clear();
        
        this.logger.info('[PaneService] Disposed');
    }

    // Private helper methods

    /**
     * Determine the area for a content type.
     */
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
        const tabbedWidget = widget as Widget & { currentWidget?: Widget };
        if (tabbedWidget.currentWidget) {
            const currentWidget = tabbedWidget.currentWidget;
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

        const geometry = this.extractGeometry(widget);

        return {
            id: widget.id,
            area,
            title,
            tabs,
            activeTab: isActive ? tabs[0]?.id : undefined,
            ...geometry,
        };
    }

    private extractGeometry(widget: Widget): Partial<PaneInfo> {
        const node = (widget as unknown as { node?: { getBoundingClientRect?: () => DOMRect } }).node;
        const rect = node?.getBoundingClientRect?.();
        if (!rect) {
            return {};
        }

        const viewportWidth = window?.innerWidth || 0;
        const viewportHeight = window?.innerHeight || 0;
        if (viewportWidth <= 0 || viewportHeight <= 0) {
            return {};
        }

        return {
            x: (rect.x / viewportWidth) * 100,
            y: (rect.y / viewportHeight) * 100,
            width: (rect.width / viewportWidth) * 100,
            height: (rect.height / viewportHeight) * 100,
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

    private isWidgetDirty(widget: Widget): boolean {
        const candidate = widget as Widget & { isDirty?: boolean; saveable?: { dirty?: boolean } };
        return candidate.isDirty === true || candidate.saveable?.dirty === true;
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

        this.persistLayoutSnapshot(snapshot);

        this._onPaneLayoutChanged.fire(snapshot);
    }

    private persistLayoutSnapshot(snapshot: PaneStateSnapshot): void {
        try {
            const structure: PersistedLayoutStructure = {
                panes: snapshot.panes.map(pane => ({
                    paneId: pane.id,
                    area: pane.area,
                    title: pane.title,
                    x: pane.x,
                    y: pane.y,
                    width: pane.width,
                    height: pane.height,
                    activeTab: pane.activeTab,
                })),
                activePane: snapshot.activePane,
                persistedAt: snapshot.timestamp,
            };

            const content: PersistedLayoutContent = {
                panes: snapshot.panes.map(pane => ({
                    paneId: pane.id,
                    activeTab: pane.activeTab,
                    tabs: pane.tabs,
                })),
                persistedAt: snapshot.timestamp,
            };

            window.localStorage.setItem(PaneServiceImpl.LAYOUT_STRUCTURE_KEY, JSON.stringify(structure));
            window.localStorage.setItem(PaneServiceImpl.LAYOUT_CONTENT_KEY, JSON.stringify(content));
        } catch (error) {
            this.logger.warn('[PaneService] Failed to persist pane layout snapshot:', error);
        }
    }

    private async applyPersistedLayoutStructure(structure: PersistedLayoutStructure): Promise<void> {
        if (!structure.activePane) {
            return;
        }

        const activeWidget = this.shell.getWidgetById(structure.activePane);
        if (!activeWidget) {
            this.logger.warn(`[PaneService] Restored active pane '${structure.activePane}' not found; preserving current layout`);
            return;
        }

        await this.shell.activateWidget(activeWidget.id);
        await this.shell.revealWidget(activeWidget.id);
    }

    private async restorePersistedContent(content: PersistedLayoutContent): Promise<void> {
        for (const pane of content.panes) {
            for (const tab of pane.tabs) {
                if (tab.type !== 'editor' || !tab.uri) {
                    continue;
                }

                try {
                    await this.openContent({ type: 'editor', contentId: tab.uri });
                } catch (error) {
                    this.logger.warn(`[PaneService] Unable to restore tab '${tab.title}' (${tab.uri}); preserving pane placeholder`, error);
                }
            }
        }
    }

    private loadNamedLayouts(): Record<string, NamedLayoutEntry> {
        const raw = window.localStorage.getItem(PaneServiceImpl.NAMED_LAYOUTS_KEY);
        if (!raw) {
            return {};
        }

        try {
            const parsed = JSON.parse(raw) as Record<string, NamedLayoutEntry>;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    private readPersistedLayoutContent(): PersistedLayoutContent | undefined {
        const raw = window.localStorage.getItem(PaneServiceImpl.LAYOUT_CONTENT_KEY);
        if (!raw) {
            return undefined;
        }
        try {
            return JSON.parse(raw) as PersistedLayoutContent;
        } catch {
            return undefined;
        }
    }

    private writePersistedLayoutContent(content: PersistedLayoutContent): void {
        window.localStorage.setItem(PaneServiceImpl.LAYOUT_CONTENT_KEY, JSON.stringify({
            ...content,
            persistedAt: new Date().toISOString(),
        }));
    }
}
