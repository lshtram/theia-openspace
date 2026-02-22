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
import { URI } from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { Tldraw, Editor, TLStoreSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';

import { WhiteboardData, WhiteboardRecord, WhiteboardUtils } from './whiteboard-types';
export { WhiteboardData, WhiteboardRecord, WhiteboardUtils };

@injectable()
export class WhiteboardWidget extends ReactWidget {
    static readonly ID = 'openspace-whiteboard-widget';
    static readonly LABEL = 'Whiteboard';

    /**
     * The pending snapshot to load. Set by loadFromJson() before the React
     * render cycle, then consumed by render() as the <Tldraw snapshot> prop
     * and by handleMount() if the editor is already live.
     */
    protected pendingSnapshot: TLStoreSnapshot | undefined;

    /**
     * Whether a zoomToFit should be triggered the next time the widget is activated
     * (becomes visible). zoomToFit has no effect on a hidden/off-screen canvas.
     */
    protected pendingZoomToFit: boolean = false;

    /**
     * The last snapshot saved to disk. Updated on every store change via
     * editor.getSnapshot().document — the native tldraw serialization format.
     */
    protected savedSnapshot: TLStoreSnapshot | undefined;

    protected currentFilePath: string | undefined;
    protected autoSaveEnabled: boolean = true;
    protected editorRef: Editor | undefined;

    /** Debounce timer for auto-save writes. */
    protected autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

    // Expose URI for findByUri comparison
    public uri: string = '';

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(FileService)
    protected readonly fileService!: FileService;

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

    // WhiteboardData is a tldraw-free approximation of TLStoreSnapshot;
    // structurally compatible at runtime — cast avoids tldraw import in whiteboard-types.ts
    setData(data: WhiteboardData, filePath?: string): void {
        this.pendingSnapshot = data as unknown as TLStoreSnapshot;
        this.savedSnapshot = data as unknown as TLStoreSnapshot;
        this.currentFilePath = filePath;
        if (this.editorRef) {
            // Editor already mounted — apply immediately.
            this.editorRef.loadSnapshot(data as unknown as TLStoreSnapshot);
            this.pendingZoomToFit = true;
        } else {
            // Editor not yet mounted — snapshot will be passed as the prop.
            this.update();
        }
    }

    getData(): WhiteboardData | undefined {
        return this.savedSnapshot as unknown as WhiteboardData | undefined;
    }

    /**
     * Parse a JSON string from a .whiteboard file and stage it for loading.
     *
     * Accepts two formats:
     *   1. Native tldraw TLStoreSnapshot: { store: {…}, schema: {…} }
     *      (produced by editor.getSnapshot().document — the correct format)
     *   2. Legacy array format: { schema: { version: number }, records: […] }
     *      (the old broken format; we silently ignore it and open a blank canvas)
     */
    loadFromJson(json: string): void {
        try {
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === 'object' && 'store' in parsed && 'schema' in parsed) {
                // Native TLStoreSnapshot format — use directly.
                this.pendingSnapshot = parsed as TLStoreSnapshot;
                this.savedSnapshot = this.pendingSnapshot;
            } else {
                // Legacy or unknown format — open blank canvas but log a warning.
                this.logger.warn('[WhiteboardWidget] Unknown whiteboard format; opening blank canvas.');
                this.pendingSnapshot = undefined;
                this.savedSnapshot = undefined;
            }
        } catch (err) {
            this.logger.error('[WhiteboardWidget] Failed to parse whiteboard JSON:', err);
            this.pendingSnapshot = undefined;
            this.savedSnapshot = undefined;
        }

        if (this.editorRef && this.pendingSnapshot) {
            // Editor already mounted — apply immediately and clear pending.
            this.editorRef.loadSnapshot(this.pendingSnapshot);
            this.pendingSnapshot = undefined;
            this.pendingZoomToFit = true;
        } else {
            // Not yet mounted — snapshot will be passed as the <Tldraw snapshot> prop.
            this.update();
        }
    }

    toJson(): string {
        return JSON.stringify(this.savedSnapshot ?? {}, null, 2);
    }

    /**
     * Create a shape via the live tldraw editor.
     * `shapePartial` must be a valid tldraw `TLShapePartial` (type + props).
     * Returns the id of the created shape, or undefined if the editor is not mounted.
     */
    createShape(shapePartial: Record<string, unknown>): string | undefined {
        if (!this.editorRef) {
            this.logger.warn('[WhiteboardWidget] createShape: editor not mounted');
            return undefined;
        }
        // tldraw's createShape accepts a TLShapePartial — type is required, id is optional
        this.editorRef.createShape(shapePartial as Parameters<Editor['createShape']>[0]);
        // Explicitly trigger auto-save — store listener may not fire for programmatic changes
        this.handleDataChange();
        // Return the id from the partial (caller must supply a shape: prefix id)
        return shapePartial['id'] as string | undefined;
    }

    /**
     * Update a shape via the live tldraw editor.
     * `patch` must be a partial update compatible with `editor.updateShape()`.
     */
    updateShapeById(shapeId: string, patch: Record<string, unknown>): boolean {
        if (!this.editorRef) {
            this.logger.warn('[WhiteboardWidget] updateShapeById: editor not mounted');
            return false;
        }
        this.editorRef.updateShape({ id: shapeId, ...patch } as Parameters<Editor['updateShape']>[0]);
        // Explicitly trigger auto-save
        this.handleDataChange();
        return true;
    }

    /**
     * Delete a shape via the live tldraw editor.
     */
    deleteShapeById(shapeId: string): boolean {
        if (!this.editorRef) {
            this.logger.warn('[WhiteboardWidget] deleteShapeById: editor not mounted');
            return false;
        }
        // TLShapeId is a branded string — cast via unknown to satisfy the overload
        this.editorRef.deleteShape(shapeId as unknown as Parameters<Editor['deleteShape']>[0]);
        // Explicitly trigger auto-save
        this.handleDataChange();
        return true;
    }

    /**
     * Create multiple shapes in a single operation.
     * Returns the list of created shape IDs.
     */
    batchCreateShapes(shapePartials: Record<string, unknown>[]): string[] {
        if (!this.editorRef) {
            this.logger.warn('[WhiteboardWidget] batchCreateShapes: editor not mounted');
            return [];
        }
        const ids: string[] = [];
        for (const partial of shapePartials) {
            this.editorRef.createShape(partial as Parameters<Editor['createShape']>[0]);
            if (partial['id']) ids.push(partial['id'] as string);
        }
        this.handleDataChange();
        return ids;
    }

    /**
     * Delete all existing shapes and create a new set atomically.
     * Returns { clearedCount, shapeIds }.
     */
    replaceAllShapes(shapePartials: Record<string, unknown>[]): { clearedCount: number; shapeIds: string[] } {
        if (!this.editorRef) {
            this.logger.warn('[WhiteboardWidget] replaceAllShapes: editor not mounted');
            return { clearedCount: 0, shapeIds: [] };
        }
        // Get all current shape IDs to count them
        const existing = this.editorRef.getCurrentPageShapes();
        const clearedCount = existing.length;
        // Delete all existing shapes
        if (clearedCount > 0) {
            this.editorRef.selectAll();
            this.editorRef.deleteShapes(this.editorRef.getSelectedShapeIds());
        }
        // Create new shapes
        const shapeIds: string[] = [];
        for (const partial of shapePartials) {
            this.editorRef.createShape(partial as Parameters<Editor['createShape']>[0]);
            if (partial['id']) shapeIds.push(partial['id'] as string);
        }
        this.handleDataChange();
        return { clearedCount, shapeIds };
    }

    /**
     * Find shapes on the current page, optionally filtered by label substring,
     * shape type, or a metadata tag stored in shape.meta.tag.
     * Returns compact shape summaries (no richText blobs).
     */
    findShapes(opts: {
        label?: string;
        type?: string;
        tag?: string;
        limit?: number;
    }): Array<{ id: string; type: string; x: number; y: number; width: number; height: number; label: string }> {
        if (!this.editorRef) {
            this.logger.warn('[WhiteboardWidget] findShapes: editor not mounted');
            return [];
        }
        const limit = opts.limit ?? 50;
        const shapes = this.editorRef.getCurrentPageShapes();
        const results: Array<{ id: string; type: string; x: number; y: number; width: number; height: number; label: string }> = [];

        for (const shape of shapes) {
            if (opts.type && shape.type !== opts.type) continue;
            if (opts.tag) {
                const meta = shape.meta as Record<string, unknown> | undefined;
                if (!meta || meta['tag'] !== opts.tag) continue;
            }

            // Extract plain text label from richText if present
            const props = shape.props as Record<string, unknown> | undefined;
            let label = '';
            if (props) {
                const rt = props['richText'] as { content?: Array<{ content?: Array<{ text?: string }> }> } | undefined;
                if (rt?.content) {
                    label = rt.content
                        .flatMap(p => p.content ?? [])
                        .map(t => t.text ?? '')
                        .join('');
                }
            }

            if (opts.label && !label.toLowerCase().includes(opts.label.toLowerCase())) continue;

            results.push({
                id: shape.id,
                type: shape.type,
                x: shape.x,
                y: shape.y,
                width: (props?.['w'] as number) ?? 0,
                height: (props?.['h'] as number) ?? 0,
                label,
            });

            if (results.length >= limit) break;
        }

        return results;
    }

    /**
     * Returns whether the tldraw editor is currently mounted and ready.
     */
    isEditorReady(): boolean {
        return !!this.editorRef;
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

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        // Perform any deferred zoomToFit now that the widget is visible.
        if (this.pendingZoomToFit && this.editorRef) {
            this.pendingZoomToFit = false;
            setTimeout(() => {
                try { this.editorRef!.zoomToFit({ animation: { duration: 300 } }); } catch (_) { /* ignore */ }
            }, 50);
        }
    }

    protected onBeforeDetach(msg: Message): void {
        if (this.autoSaveTimer !== undefined) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = undefined;
        }
        this.editorRef = undefined;
        super.onBeforeDetach(msg);
    }

    protected handleDataChange(): void {
        if (!this.editorRef) { return; }
        // Capture the latest store state using tldraw's native serialisation.
        this.savedSnapshot = this.editorRef.getSnapshot().document;
        if (this.autoSaveEnabled && this.currentFilePath) {
            // Debounce: wait 1 s of inactivity before writing to disk.
            if (this.autoSaveTimer !== undefined) {
                clearTimeout(this.autoSaveTimer);
            }
            this.autoSaveTimer = setTimeout(() => {
                this.autoSaveTimer = undefined;
                this.persistToDisk();
            }, 1000);
        }
    }

    protected persistToDisk(): void {
        if (!this.currentFilePath || !this.savedSnapshot) { return; }
        const content = JSON.stringify(this.savedSnapshot, null, 2);
        // Normalise to a file:// URI — currentFilePath may be a raw POSIX path
        // (e.g. /Users/…) or already a URI string (file:///Users/…).
        const uri = this.currentFilePath.startsWith('file://')
            ? new URI(this.currentFilePath)
            : URI.fromFilePath(this.currentFilePath);
        this.fileService.write(uri, content).then(() => {
            this.logger.info('[WhiteboardWidget] Auto-saved to:', this.currentFilePath);
        }).catch((err: unknown) => {
            this.logger.error('[WhiteboardWidget] Auto-save failed:', err);
        });
    }

    protected handleMount(editor: Editor): void {
        this.editorRef = editor;
        this.logger.info('[WhiteboardWidget] tldraw editor mounted');

        // If a snapshot was staged before the editor mounted, load it now and clear.
        if (this.pendingSnapshot) {
            try {
                editor.loadSnapshot(this.pendingSnapshot);
                this.pendingZoomToFit = true;
            } catch (err) {
                this.logger.error('[WhiteboardWidget] loadSnapshot failed:', err);
            }
            this.pendingSnapshot = undefined;
        }

        // Listen for store changes and sync to savedSnapshot.
        editor.store.listen(() => {
            this.handleDataChange();
        }, { scope: 'document', source: 'user' });
    }

    protected render(): React.ReactNode {
        // Pass any pending snapshot as the tldraw <Tldraw snapshot> prop so that
        // tldraw applies it before its first paint, avoiding a blank flash.
        // Once the editor is mounted, handleMount() clears pendingSnapshot.
        return (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <Tldraw
                    snapshot={this.pendingSnapshot}
                    onMount={(editor: Editor) => this.handleMount(editor)}
                />
            </div>
        );
    }
}


