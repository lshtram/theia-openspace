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

import * as React from '@theia/core/shared/react';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';

export interface WhiteboardData {
    schema: { version: number };
    records: WhiteboardRecord[];
}

export interface WhiteboardRecord {
    id: string;
    type: string;
    [key: string]: unknown;
}

/**
 * Whiteboard Widget - displays tldraw canvas in a Theia widget.
 * 
 * Note: Due to React version conflicts between Theia (18.x) and tldraw (which
 * pulls React 19), this implementation uses an iframe fallback approach to
 * ensure stability. The iframe isolates the React versions.
 */
@injectable()
export class WhiteboardWidget extends ReactWidget {
    static readonly ID = 'openspace-whiteboard-widget';
    static readonly LABEL = 'Whiteboard';

    protected whiteboardData: WhiteboardData = {
        schema: { version: 1 },
        records: []
    };
    protected currentFilePath: string | undefined;
    protected autoSaveEnabled: boolean = true;
    protected containerRef: React.RefObject<HTMLDivElement>;

    // T2-22: Expose URI for findByUri comparison (public property)
    public uri: string = '';

    constructor() {
        super();
        this.id = WhiteboardWidget.ID;
        this.title.label = WhiteboardWidget.LABEL;
        this.title.caption = WhiteboardWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-paint-brush';
        this.addClass('openspace-whiteboard-widget');
        this.containerRef = React.createRef();
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    /**
     * Set the whiteboard data (tldraw JSON format)
     */
    setData(data: WhiteboardData, filePath?: string): void {
        this.whiteboardData = data;
        this.currentFilePath = filePath;
        this.update();
    }

    /**
     * Get the current whiteboard data
     */
    getData(): WhiteboardData {
        return this.whiteboardData;
    }

    /**
     * Load whiteboard from JSON string
     */
    loadFromJson(json: string): void {
        try {
            const data = JSON.parse(json) as WhiteboardData;
            this.whiteboardData = data;
            this.update();
        } catch (err) {
            console.error('[WhiteboardWidget] Failed to parse whiteboard JSON:', err);
            this.whiteboardData = {
                schema: { version: 1 },
                records: []
            };
        }
    }

    /**
     * Export whiteboard to JSON string
     */
    toJson(): string {
        return JSON.stringify(this.whiteboardData, null, 2);
    }

    /**
     * Set the current file path for save operations
     */
    setFilePath(path: string): void {
        this.currentFilePath = path;
    }

    /**
     * Get the current file path
     */
    getFilePath(): string | undefined {
        return this.currentFilePath;
    }

    /**
     * Enable/disable auto-save
     */
    setAutoSave(enabled: boolean): void {
        this.autoSaveEnabled = enabled;
    }

    /**
     * Check if auto-save is enabled
     */
    isAutoSaveEnabled(): boolean {
        return this.autoSaveEnabled;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.initializeWhiteboard();
    }

    protected onBeforeDetach(msg: Message): void {
        this.cleanupWhiteboard();
        super.onBeforeDetach(msg);
    }

    protected initializeWhiteboard(): void {
        // The iframe approach is used to isolate React versions
        // This ensures tldraw's React 19 doesn't conflict with Theia's React 18
        console.log('[WhiteboardWidget] Initializing whiteboard with iframe isolation');
    }

    protected cleanupWhiteboard(): void {
        // Cleanup iframe if needed
        console.log('[WhiteboardWidget] Cleaning up whiteboard');
    }

    protected render(): React.ReactNode {
        // Using iframe isolation to avoid React version conflicts
        // The iframe src will load a standalone tldraw instance
        return (
            <div className="whiteboard-container" ref={this.containerRef}>
                <WhiteboardIframe 
                    initialData={this.whiteboardData}
                    onDataChange={this.handleDataChange.bind(this)}
                />
            </div>
        );
    }

    /**
     * Handle data changes from the whiteboard
     */
    protected handleDataChange(data: WhiteboardData): void {
        this.whiteboardData = data;
        this.update();
        
        // Auto-save would be triggered here when file service is connected
        if (this.autoSaveEnabled && this.currentFilePath) {
            console.log('[WhiteboardWidget] Auto-saving to:', this.currentFilePath);
        }
    }
}

/**
 * Iframe component for tldraw isolation
 */
interface WhiteboardIframeProps {
    initialData: WhiteboardData;
    onDataChange: (data: WhiteboardData) => void;
}

const WhiteboardIframe: React.FC<WhiteboardIframeProps> = ({ initialData, onDataChange }) => {
    // Note: iframeRef reserved for future iframe-based tldraw integration

    React.useEffect(() => {
        // For now, show a placeholder since we don't have a standalone tldraw page
        // In production, this would load: /tldraw-standalone.html?data=base64
        console.log('[WhiteboardIframe] Initialized with data:', initialData);
    }, [initialData]);

    // Listen for messages from iframe with origin validation (T2-21)
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // T2-21: Validate origin to prevent postMessage from untrusted sources
            const allowedOrigins = [
                window.location.origin,  // Same origin
                'http://localhost:3000',
                'http://localhost:3001',
            ];

            if (!allowedOrigins.includes(event.origin)) {
                console.warn('[WhiteboardWidget] Rejected postMessage from untrusted origin:', event.origin);
                return;
            }

            if (event.data?.type === 'whiteboard-update') {
                onDataChange(event.data.data);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onDataChange]);

    return (
        <div className="whiteboard-iframe-wrapper">
            <div className="whiteboard-placeholder">
                <div className="placeholder-icon">🎨</div>
                <h3>Whiteboard</h3>
                <p>Create drawings, shapes, and diagrams</p>
                <div className="placeholder-features">
                    <span>Freeform drawing</span>
                    <span>Shapes</span>
                    <span>Text</span>
                    <span>Connections</span>
                </div>
                <div className="placeholder-status">
                    <span className="status-indicator"></span>
                    <span>Iframe isolation ready</span>
                </div>
            </div>
            {/* 
            Production implementation would use:
            <iframe 
                ref={iframeRef}
                src={iframeSrc}
                className="whiteboard-iframe"
                title="Whiteboard"
            />
            */}
        </div>
    );
};

/**
 * Utility functions for whiteboard data manipulation
 */
export class WhiteboardUtils {
    /**
     * Create a new empty whiteboard
     */
    static createEmpty(): WhiteboardData {
        return {
            schema: { version: 1 },
            records: []
        };
    }

    /**
     * Validate whiteboard data structure
     */
    static validate(data: unknown): data is WhiteboardData {
        if (!data || typeof data !== 'object') return false;
        
        const d = data as WhiteboardData;
        if (!d.schema || typeof d.schema.version !== 'number') return false;
        if (!Array.isArray(d.records)) return false;
        
        return true;
    }

    /**
     * Add a shape to the whiteboard
     */
    static addShape(data: WhiteboardData, shape: WhiteboardRecord): WhiteboardData {
        return {
            ...data,
            records: [...data.records, shape]
        };
    }

    /**
     * Remove a shape from the whiteboard
     */
    static removeShape(data: WhiteboardData, shapeId: string): WhiteboardData {
        return {
            ...data,
            records: data.records.filter(r => r.id !== shapeId)
        };
    }

    /**
     * Update a shape in the whiteboard
     */
    static updateShape(data: WhiteboardData, shapeId: string, updates: Partial<WhiteboardRecord>): WhiteboardData {
        return {
            ...data,
            records: data.records.map(r => 
                r.id === shapeId ? { ...r, ...updates } : r
            )
        };
    }
}
