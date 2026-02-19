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
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { ILogger } from '@theia/core/lib/common/logger';
import { Tldraw, Editor } from 'tldraw';
import 'tldraw/tldraw.css';

export interface WhiteboardData {
    schema: { version: number };
    records: WhiteboardRecord[];
}

export interface WhiteboardRecord {
    id: string;
    type: string;
    [key: string]: unknown;
}

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
    protected editorRef: Editor | undefined;

    // Expose URI for findByUri comparison
    public uri: string = '';

    @inject(ILogger)
    protected readonly logger!: ILogger;

    constructor() {
        super();
        this.id = WhiteboardWidget.ID;
        this.title.label = WhiteboardWidget.LABEL;
        this.title.caption = WhiteboardWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-paint-brush';
        this.addClass('openspace-whiteboard-widget');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    setData(data: WhiteboardData, filePath?: string): void {
        this.whiteboardData = data;
        this.currentFilePath = filePath;
        this.update();
    }

    getData(): WhiteboardData {
        return this.whiteboardData;
    }

    loadFromJson(json: string): void {
        try {
            const data = JSON.parse(json) as WhiteboardData;
            this.whiteboardData = data;
            this.update();
        } catch (err) {
            this.logger.error('[WhiteboardWidget] Failed to parse whiteboard JSON:', err);
            this.whiteboardData = { schema: { version: 1 }, records: [] };
        }
    }

    toJson(): string {
        return JSON.stringify(this.whiteboardData, null, 2);
    }

    setFilePath(path: string): void {
        this.currentFilePath = path;
    }

    getFilePath(): string | undefined {
        return this.currentFilePath;
    }

    setAutoSave(enabled: boolean): void {
        this.autoSaveEnabled = enabled;
    }

    isAutoSaveEnabled(): boolean {
        return this.autoSaveEnabled;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.logger.info('[WhiteboardWidget] Attached');
    }

    protected onBeforeDetach(msg: Message): void {
        this.editorRef = undefined;
        super.onBeforeDetach(msg);
    }

    protected handleDataChange(data: WhiteboardData): void {
        this.whiteboardData = data;
        if (this.autoSaveEnabled && this.currentFilePath) {
            this.logger.info('[WhiteboardWidget] Auto-saving to:', this.currentFilePath);
        }
    }

    protected handleMount(editor: Editor): void {
        this.editorRef = editor;
        this.logger.info('[WhiteboardWidget] tldraw editor mounted');

        // Listen for store changes and sync to whiteboardData
        editor.store.listen(() => {
            const records = editor.store.allRecords() as unknown as WhiteboardRecord[];
            this.handleDataChange({
                schema: { version: 1 },
                records
            });
        }, { scope: 'document', source: 'user' });
    }

    protected render(): React.ReactNode {
        return (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <Tldraw
                    onMount={(editor: Editor) => this.handleMount(editor)}
                />
            </div>
        );
    }
}

/**
 * Utility functions for whiteboard data manipulation
 */
export class WhiteboardUtils {
    static createEmpty(): WhiteboardData {
        return { schema: { version: 1 }, records: [] };
    }

    static validate(data: unknown): data is WhiteboardData {
        if (!data || typeof data !== 'object') return false;
        const d = data as WhiteboardData;
        if (!d.schema || typeof d.schema.version !== 'number') return false;
        if (!Array.isArray(d.records)) return false;
        return true;
    }

    static addShape(data: WhiteboardData, shape: WhiteboardRecord): WhiteboardData {
        return { ...data, records: [...data.records, shape] };
    }

    static removeShape(data: WhiteboardData, shapeId: string): WhiteboardData {
        return { ...data, records: data.records.filter(r => r.id !== shapeId) };
    }

    static updateShape(data: WhiteboardData, shapeId: string, updates: Partial<WhiteboardRecord>): WhiteboardData {
        return {
            ...data,
            records: data.records.map(r => r.id === shapeId ? { ...r, ...updates } : r)
        };
    }
}
