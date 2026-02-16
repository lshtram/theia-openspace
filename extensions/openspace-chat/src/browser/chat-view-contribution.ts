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
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { ChatWidget } from './chat-widget';

/**
 * View contribution for the Chat widget.
 * Registers the widget in the left panel and opens it on startup.
 */
@injectable()
export class ChatViewContribution extends AbstractViewContribution<ChatWidget> implements FrontendApplicationContribution {

    constructor() {
        super({
            widgetId: ChatWidget.ID,
            widgetName: ChatWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 100
            },
            toggleCommandId: 'openspace-chat:toggle'
        });
    }

    /**
     * Called when the application starts.
     * Opens the chat widget by default.
     */
    async onStart(app: FrontendApplication): Promise<void> {
        // Open chat widget on startup
        this.openView({ activate: false, reveal: true });
    }
}
