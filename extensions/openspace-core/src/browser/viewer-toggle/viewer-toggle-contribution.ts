// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { OpenerService, open as openUri } from '@theia/core/lib/browser/opener-service';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { Widget } from '@theia/core/lib/browser/widgets/widget';
import { ViewerToggleService } from './viewer-toggle-service';
import { attachTabDblClickToggle } from '../tab-dblclick-toggle';

/**
 * Watches widget additions in the shell. For every newly added navigatable
 * widget that (a) has a viewer handler for its URI and (b) does not manage
 * its own internal toggle (i.e. no `toggleMode` method), attaches a
 * double-click listener on the tab label that flips the toggle state and
 * re-opens the file via the opener service.
 */
@injectable()
export class ViewerToggleContribution implements FrontendApplicationContribution {

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(ViewerToggleService)
    protected readonly toggleService!: ViewerToggleService;

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    onStart(): void {
        this.shell.onDidAddWidget(widget => this.handleAddedWidget(widget));
    }

    protected async handleAddedWidget(widget: Widget): Promise<void> {
        // Only handle navigatable widgets (i.e., widgets associated with a URI)
        const uri = NavigatableWidget.getUri(widget);
        if (!uri) {
            return;
        }

        // Skip widgets that manage their own internal toggle (e.g. MarkdownViewerWidget).
        // Duck-type check: if the widget has a toggleMode method, it handles itself.
        if (typeof (widget as { toggleMode?: () => void }).toggleMode === 'function') {
            return;
        }

        // Check if this URI has a viewer handler — only attach for toggleable files.
        const canToggle = await this.toggleService.canToggle(uri);
        if (!canToggle) {
            return;
        }

        // Attach tab dblclick toggle. On double-click: flip state then re-open.
        const disposable = attachTabDblClickToggle(
            widget.node,
            () => widget.title.label,
            () => {
                this.toggleService.toggle(uri);
                openUri(this.openerService, uri).catch((err: unknown) => {
                    console.error('[ViewerToggleContribution] Failed to re-open after toggle:', err);
                });
            },
        );

        // Dispose the listener when the widget is detached.
        (widget as { toDisposeOnDetach?: Disposable[] }).toDisposeOnDetach?.push(disposable);
    }
}
