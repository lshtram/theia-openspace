// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, WidgetManager, ApplicationShell, OpenerOptions } from '@theia/core/lib/browser';
import { ILogger } from '@theia/core/lib/common/logger';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MarkdownViewerWidget } from './markdown-viewer-widget';

const HANDLER_PRIORITY = 200;
const MD_EXTENSIONS = ['.md', '.markdown', '.mdown'];
const DECK_SUFFIX = '.deck.md';

@injectable()
export class MarkdownViewerOpenHandler implements OpenHandler {

    readonly id = 'openspace-markdown-viewer-open-handler';

    private readonly splitCounters = new Map<string, number>();

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    canHandle(uri: URI): number {
        const path = uri.path.toString();
        if (path.endsWith(DECK_SUFFIX)) {
            return 0;
        }
        const matched = MD_EXTENSIONS.some(ext => path.endsWith(ext));
        return matched ? HANDLER_PRIORITY : 0;
    }

    async open(uri: URI, options?: OpenerOptions & {
        widgetOptions?: ApplicationShell.WidgetOptions;
        forceNewWidget?: boolean;
    }): Promise<MarkdownViewerWidget> {
        // When forcing a new widget (e.g. split), use a counter suffix so
        // WidgetManager.getOrCreateWidget sees a unique key and creates a
        // fresh instance rather than returning the existing one.
        let widgetOptions: ApplicationShell.WidgetOptions;
        let factoryOptions: { uri: string; counter?: number };
        if (options?.forceNewWidget) {
            const uriStr = uri.toString();
            const counter = (this.splitCounters.get(uriStr) ?? 0) + 1;
            this.splitCounters.set(uriStr, counter);
            factoryOptions = { uri: uriStr, counter };
            widgetOptions = options.widgetOptions ?? { area: 'main' };
        } else {
            factoryOptions = { uri: uri.toString() };
            widgetOptions = options?.widgetOptions ?? { area: 'main' };
        }

        const widget = await this.widgetManager.getOrCreateWidget(
            MarkdownViewerWidget.ID,
            factoryOptions
        ) as MarkdownViewerWidget;

        widget.uri = uri.toString();
        widget.title.label = uri.path.base;

        try {
            const content = await this.readFileContent(uri);
            widget.setContent(content);
        } catch (error) {
            this.logger.error('[MarkdownViewerOpenHandler] Failed to load file:', error);
            widget.setContent('# Error\n\nFailed to load file content.');
        }

        if (!widget.isAttached) {
            await this.shell.addWidget(widget, widgetOptions);
        }
        await this.shell.activateWidget(widget.id);

        return widget;
    }

    async findByUri(uri: URI): Promise<MarkdownViewerWidget | undefined> {
        const widgets = this.widgetManager.getWidgets(MarkdownViewerWidget.ID);
        return widgets.find(w => (w as MarkdownViewerWidget).uri === uri.toString()) as
            MarkdownViewerWidget | undefined;
    }

    protected async readFileContent(uri: URI): Promise<string> {
        const stat = await this.fileService.resolve(uri);
        if (!stat.isFile) { throw new Error('Not a file'); }
        const result = await this.fileService.read(uri);
        return result.value;
    }
}
