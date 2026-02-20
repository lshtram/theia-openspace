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
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { ChatWidget } from './chat-widget';

/**
 * Command ID for toggling the OpenSpace chat widget.
 */
export const OPENSPACE_CHAT_TOGGLE_COMMAND_ID = 'openspace-chat:toggle';

/**
 * View contribution for the Chat widget.
 * Registers the widget in the right sidebar and opens it on startup.
 */
@injectable()
export class ChatViewContribution extends AbstractViewContribution<ChatWidget> {

    constructor() {
        super({
            widgetId: ChatWidget.ID,
            widgetName: ChatWidget.LABEL,
            defaultWidgetOptions: {
                area: 'right',
                rank: 500
            },
            toggleCommandId: OPENSPACE_CHAT_TOGGLE_COMMAND_ID
        });
    }

    /**
     * Called when the application starts.
     * Opens the chat widget in the right sidebar.
     */
    async onStart(_app: FrontendApplication): Promise<void> {
        console.debug('[ChatViewContribution] onStart called, opening chat widget');
        await this.openView({ activate: false, reveal: true });
    }
}
