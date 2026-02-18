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

import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { ChatWidget } from './chat-widget';

/**
 * Command ID for toggling the OpenSpace chat widget.
 */
export const OPENSPACE_CHAT_TOGGLE_COMMAND_ID = 'openspace-chat:toggle';

/**
 * View contribution for the Chat widget.
 * Registers the widget in the main panel and opens it on startup.
 */
@injectable()
export class ChatViewContribution extends AbstractViewContribution<ChatWidget> {

    constructor() {
        super({
            widgetId: ChatWidget.ID,
            widgetName: ChatWidget.LABEL,
            defaultWidgetOptions: {
                area: 'main'
            },
            toggleCommandId: OPENSPACE_CHAT_TOGGLE_COMMAND_ID
        });
    }

    /**
     * Called when the application starts.
     * Ensures the chat widget is in the main area and opens it.
     */
    async onStart(app: FrontendApplication): Promise<void> {
        console.debug('[ChatViewContribution] onStart called, opening chat widget');
        // Open chat widget on startup — defaultWidgetOptions has area:'main'
        // so first-time placement goes to main area.
        // If stale layout stored it in 'left', we detect and move it after shell is ready.
        await this.openView({ activate: false, reveal: true });
        const shell = app.shell as ApplicationShell;
        const widget = this.tryGetWidget();
        if (widget) {
            const currentArea = shell.getAreaFor(widget);
            if (currentArea && currentArea !== 'main') {
                console.debug(`[ChatViewContribution] Widget in '${currentArea}', moving to 'main'`);
                await shell.closeWidget(ChatWidget.ID);
                await shell.addWidget(widget, { area: 'main' });
                await shell.revealWidget(ChatWidget.ID);
            }
        }
    }
}
