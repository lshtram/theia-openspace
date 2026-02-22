// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, OpenerService, OpenerOptions } from '@theia/core/lib/browser';
import { ViewerToggleService } from './viewer-toggle-service';

/**
 * Priority sits between specific viewers (200) and the default text editor (100).
 * When a file has a viewer handler, this handler intercepts opens and routes them
 * based on the current toggle state: 'preview' → viewer, 'edit' → text editor.
 */
const HANDLER_PRIORITY = 150;
const HANDLER_ID = 'openspace-viewer-toggle-open-handler';

@injectable()
export class ViewerToggleOpenHandler implements OpenHandler {

    readonly id = HANDLER_ID;

    @inject(ViewerToggleService)
    protected readonly toggleService!: ViewerToggleService;

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    async canHandle(uri: URI): Promise<number> {
        const can = await this.toggleService.canToggle(uri);
        return can ? HANDLER_PRIORITY : 0;
    }

    async open(uri: URI, options?: OpenerOptions): Promise<object | undefined> {
        const state = this.toggleService.getToggleState(uri);

        if (state === 'edit') {
            // Delegate to text editor: find the first handler that isn't a viewer
            // and isn't self.
            const handlers = await this.openerService.getOpeners(uri);
            const editorHandler = handlers.find(h =>
                h.id !== HANDLER_ID &&
                !/viewer/i.test(h.id)
            );
            if (editorHandler) {
                return editorHandler.open(uri, options);
            }
            // Fallback: let Theia's default opener handle it (skip this handler)
            return undefined;
        }

        // state === 'preview': delegate to the viewer handler
        const handlers = await this.openerService.getOpeners(uri);
        const viewerHandler = handlers.find(h =>
            h.id !== HANDLER_ID &&
            /viewer/i.test(h.id)
        );
        if (viewerHandler) {
            return viewerHandler.open(uri, options);
        }

        return undefined;
    }
}
