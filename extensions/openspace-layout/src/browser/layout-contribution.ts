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

import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution, ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { CommandService } from '@theia/core/lib/common';

/**
 * Layout contribution for OpenSpace.
 * Sets up the default application layout on first launch (no saved layout).
 *
 * Layout:
 *  - Left panel:   File Navigator + Extensions (VSX registry)
 *  - Right panel:  OpenSpace Chat widget
 *  - Bottom panel: Terminal
 *  - Main area:    Empty (ready for editors)
 */
@injectable()
export class LayoutContribution implements FrontendApplicationContribution {

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    /**
     * Called on every application start (saved layout or not).
     * Ensures our key views are always visible regardless of persisted state.
     *
     * - Extensions panel: @theia/vsx-registry only opens it in initializeLayout
     *   (skipped when a saved layout exists), so we open/reveal it here to
     *   guarantee it appears in the left activity bar on every launch.
     * - Theia's built-in AI Chat (@theia/ai-chat-ui) is intentionally NOT
     *   opened here. It registers itself in the right panel but we suppress
     *   auto-open so our OpenSpace Chat widget owns the right panel.
     *   It can still be opened manually via View menu if needed.
     */
    async onStart(_app: FrontendApplication): Promise<void> {
        // Reveal (or create) the VSX Extensions view container in the left panel.
        // Using getOrCreateWidget + shell.addWidget is idempotent — it won't
        // close the view if it's already open (unlike the toggle command).
        try {
            const widget = await this.widgetManager.getOrCreateWidget('vsx-extensions-view-container');
            if (!widget.isAttached) {
                this.shell.addWidget(widget, { area: 'left', rank: 500 });
            }
            this.shell.revealWidget('vsx-extensions-view-container');
        } catch (e) {
            console.debug('[LayoutContribution] Extensions view not available:', e);
        }
    }

    /**
     * Called only on fresh launch (no saved layout in StorageService).
     * Opens the terminal in the bottom panel.
     *
     * Note: File Navigator is opened by @theia/navigator's own initializeLayout.
     * Note: Chat widget is opened by ChatViewContribution.onStart.
     */
    async initializeLayout(_app: FrontendApplication): Promise<void> {
        console.debug('[LayoutContribution] Setting up default layout');

        // Open terminal in the bottom panel on first launch.
        // Uses CommandService to avoid a hard dependency on @theia/terminal.
        try {
            await this.commandService.executeCommand('terminal:new');
        } catch (e) {
            console.debug('[LayoutContribution] Terminal not available:', e);
        }
    }
}
