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
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommandService } from '@theia/core/lib/common';

/**
 * Layout contribution for OpenSpace.
 * Sets up the default application layout on first launch (no saved layout).
 *
 * Layout:
 *  - Left panel:   File Navigator (contributed by @theia/navigator)
 *  - Right panel:  Chat widget (contributed by ChatViewContribution)
 *  - Bottom panel: Terminal (opened here via CommandService)
 *  - Main area:    Empty (ready for editors)
 */
@injectable()
export class LayoutContribution implements FrontendApplicationContribution {

    @inject(CommandService)
    protected readonly commandService!: CommandService;

    /**
     * Called only on fresh launch (no saved layout in StorageService).
     * Opens the terminal in the bottom panel.
     *
     * Note: File Navigator is opened by @theia/navigator's own initializeLayout.
     * Note: Chat widget is opened by ChatViewContribution.initializeLayout.
     */
    async initializeLayout(app: FrontendApplication): Promise<void> {
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
