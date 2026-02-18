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
import { OpenHandler, WidgetManager } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { PresentationWidget } from './presentation-widget';

/**
 * Priority for the presentation open handler.
 * Higher than default editor priority (typically 100).
 */
const PRESENTATION_HANDLER_PRIORITY = 200;

/**
 * File extension for presentation files.
 */
const DECK_EXTENSION = '.deck.md';

/**
 * OpenHandler implementation for .deck.md presentation files.
 * When a user double-clicks a .deck.md file, this handler intercepts
 * the open request and displays the content in a PresentationWidget
 * instead of a text editor.
 */
@injectable()
export class PresentationOpenHandler implements OpenHandler {

    readonly id = 'openspace-presentation-open-handler';

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(FileService)
    protected readonly fileService!: FileService;

    /**
     * Check if this handler can handle the given URI.
     * @param uri The URI to check
     * @returns Priority 200 for .deck.md files, 0 otherwise
     */
    canHandle(uri: URI): number {
        const path = uri.path.toString();
        // Check if the path ends with .deck.md
        if (path.endsWith(DECK_EXTENSION)) {
            return PRESENTATION_HANDLER_PRIORITY;
        }
        return 0;
    }

    /**
     * Open a presentation widget with the content from the given URI.
     * @param uri The URI of the .deck.md file to open
     * @returns Promise resolving to the opened widget
     */
    async open(uri: URI): Promise<PresentationWidget> {
        const widget = await this.widgetManager.getOrCreateWidget(
            PresentationWidget.ID,
            { uri: uri.toString() }
        ) as PresentationWidget;

        // T2-22: Store URI on widget for findByUri comparison
        widget.uri = uri.toString();

        // Read file content and set it on the widget
        try {
            const content = await this.readFileContent(uri);
            widget.setContent(content);
        } catch (error) {
            console.error('[PresentationOpenHandler] Failed to load file content:', error);
            widget.setContent('# Error\n\nFailed to load presentation content.');
        }

        return widget;
    }

    /**
     * Find an existing widget for the given URI.
     * T2-22: Compare widget URI against requested URI
     * @param uri The URI to search for
     * @returns The widget if found, undefined otherwise
     */
    async findByUri(uri: URI): Promise<PresentationWidget | undefined> {
        const widgets = await this.widgetManager.getWidgets(PresentationWidget.ID);
        return widgets.find(w => {
            const widget = w as PresentationWidget;
            // T2-22: Compare URIs properly
            return widget.uri === uri.toString();
        }) as PresentationWidget | undefined;
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
