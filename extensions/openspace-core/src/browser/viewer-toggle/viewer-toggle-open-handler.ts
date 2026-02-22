// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable, named } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, OpenerOptions } from '@theia/core/lib/browser';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';
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

    /**
     * Inject ContributionProvider<OpenHandler> directly rather than OpenerService.
     *
     * OpenerService.getOpeners() calls canHandle() on all handlers including this one,
     * which would cause infinite recursion: canHandle → canToggle → getOpeners → canHandle.
     * By iterating contributions directly and skipping self, we break the cycle.
     */
    @inject(ContributionProvider) @named(OpenHandler)
    protected readonly handlersProvider!: ContributionProvider<OpenHandler>;

    async canHandle(uri: URI): Promise<number> {
        const can = await this.toggleService.canToggle(uri);
        return can ? HANDLER_PRIORITY : 0;
    }

    async open(uri: URI, options?: OpenerOptions): Promise<object | undefined> {
        const state = this.toggleService.getToggleState(uri);
        const handlers = this.handlersProvider.getContributions();

        if (state === 'edit') {
            // Delegate to the first non-viewer, non-self handler (i.e. text editor).
            for (const h of handlers) {
                if (h.id === HANDLER_ID || /viewer/i.test(h.id)) { continue; }
                const priority = await h.canHandle(uri, options);
                if (priority > 0) {
                    return h.open(uri, options);
                }
            }
            return undefined;
        }

        // state === 'preview': delegate to the highest-priority viewer handler.
        for (const h of handlers) {
            if (h.id === HANDLER_ID || !/viewer/i.test(h.id)) { continue; }
            const priority = await h.canHandle(uri, options);
            if (priority > 0) {
                return h.open(uri, options);
            }
        }

        return undefined;
    }
}
