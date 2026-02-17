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

/**
 * THROWAWAY SPIKE: Whiteboard Widget Proof-of-Concept
 * 
 * This file is a temporary spike to validate tldraw integration.
 * It will be replaced by the real implementation in Phase 4.4.
 * 
 * Date: 2026-02-17
 * Purpose: Validate tldraw renders inside Theia ReactWidget
 */

import * as React from '@theia/core/shared/react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';

/**
 * Whiteboard Widget - Proof of Concept
 * Tests tldraw integration with Theia ReactWidget
 */
@injectable()
export class WhiteboardWidget extends ReactWidget {
    static readonly ID = 'openspace-whiteboard-widget';
    static readonly LABEL = 'Whiteboard';

    constructor() {
        super();
        this.id = WhiteboardWidget.ID;
        this.title.label = WhiteboardWidget.LABEL;
        this.title.caption = WhiteboardWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-pencil-square';
        this.addClass('openspace-whiteboard-widget');
    }

    @postConstruct()
    protected init(): void {
        this.update();
        console.log('[WhiteboardWidget] Widget initialized');
    }

    protected render(): React.ReactNode {
        return (
            <div className="whiteboard-container" style={{ width: '100%', height: '100%' }}>
                <Tldraw 
                    hideUi={false}
                />
            </div>
        );
    }
}
