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

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, WidgetManager, ApplicationShell } from '@theia/core/lib/browser';
import { ILogger } from '@theia/core/lib/common/logger';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WhiteboardWidget } from './whiteboard-widget';

/**
 * Priority for the whiteboard open handler.
 * Higher than default editor priority (typically 100).
 */
const WHITEBOARD_HANDLER_PRIORITY = 200;

/**
 * File extension for whiteboard files.
 */
const WHITEBOARD_EXTENSION = '.whiteboard.json';

/**
 * OpenHandler implementation for .whiteboard.json whiteboard files.
 * When a user double-clicks a .whiteboard.json file, this handler intercepts
 * the open request and displays the content in a WhiteboardWidget
 * instead of a text editor.
 */
@injectable()
export class WhiteboardOpenHandler implements OpenHandler {

    readonly id = 'openspace-whiteboard-open-handler';

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    /**
     * Check if this handler can handle the given URI.
     * @param uri The URI to check
     * @returns Priority 200 for .whiteboard.json files, 0 otherwise
     */
    canHandle(uri: URI): number {
        const path = uri.path.toString();
        // Check if the path ends with .whiteboard.json
        if (path.endsWith(WHITEBOARD_EXTENSION)) {
            return WHITEBOARD_HANDLER_PRIORITY;
        }
        return 0;
    }

    /**
     * Open a whiteboard widget with the content from the given URI.
     * @param uri The URI of the .whiteboard.json file to open
     * @returns Promise resolving to the opened widget
     */
    async open(uri: URI): Promise<WhiteboardWidget> {
        const widget = await this.widgetManager.getOrCreateWidget(
            WhiteboardWidget.ID,
            { uri: uri.toString() }
        ) as WhiteboardWidget;

        // T2-22: Store URI on widget for findByUri comparison
        widget.uri = uri.toString();

        // Set tab title from filename (strip .whiteboard.json extension)
        const base = uri.path.base;
        widget.title.label = base.endsWith('.whiteboard.json') ? base.slice(0, -'.whiteboard.json'.length) : base;
        widget.title.caption = widget.title.label;

        // Read file content and set it on the widget
        try {
            const content = await this.readFileContent(uri);
            widget.loadFromJson(content);
            widget.setFilePath(uri.toString());
        } catch (error) {
            this.logger.error('[WhiteboardOpenHandler] Failed to load file content:', error);
            // Load empty whiteboard on error
            widget.loadFromJson(JSON.stringify({
                schema: { version: 1 },
                records: []
            }));
        }

        // Add to the main shell area and activate (reveal) it
        if (!widget.isAttached) {
            this.shell.addWidget(widget, { area: 'main' });
        }
        this.shell.activateWidget(widget.id);

        return widget;
    }

    /**
     * Find an existing widget for the given URI.
     * T2-22: Compare widget URI against requested URI
     * @param uri The URI to search for
     * @returns The widget if found, undefined otherwise
     */
    async findByUri(uri: URI): Promise<WhiteboardWidget | undefined> {
        const widgets = await this.widgetManager.getWidgets(WhiteboardWidget.ID);
        return widgets.find(w => {
            const widget = w as WhiteboardWidget;
            // T2-22: Compare URIs properly
            return widget.uri === uri.toString();
        }) as WhiteboardWidget | undefined;
    }

    /**
     * Read the content of a file from the filesystem.
     * @param uri The URI of the file to read
     * @returns The file content as a string
     */
    protected async readFileContent(uri: URI): Promise<string> {
        const stat = await this.fileService.resolve(uri);
        if (!stat.isFile) {
            throw new Error('Not a file');
        }
        const contentResult = await this.fileService.read(uri);
        return contentResult.value;
    }
}
