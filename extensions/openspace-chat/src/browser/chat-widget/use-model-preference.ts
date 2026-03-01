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

import * as React from '@theia/core/shared/react';
import { CommandService } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { CommonCommands } from '@theia/core/lib/browser/common-frontend-contribution';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';

export interface ModelPreferenceState {
    enabledModels: string[];
    handleManageModels: () => void;
}

/**
 * Enabled-models preference state and subscription.
 */
export function useModelPreference(
    preferenceService: PreferenceService,
    commandService: CommandService,
    sessionService: SessionService,
): ModelPreferenceState {
    const [enabledModels, setEnabledModels] = React.useState<string[]>(
        preferenceService.get<string[]>('openspace.models.enabled', []) ?? []
    );

    React.useEffect(() => {
        const disposable = preferenceService.onPreferenceChanged(change => {
            if (change.preferenceName === 'openspace.models.enabled') {
                setEnabledModels(preferenceService.get<string[]>('openspace.models.enabled', []) ?? []);
            }
        });
        return () => disposable.dispose();
    }, [preferenceService]);

    const handleManageModels = React.useCallback(() => {
        commandService.executeCommand(CommonCommands.OPEN_PREFERENCES.id, 'openspace.models');
    }, [commandService]);

    // Subscribe to model changes (debug logging)
    React.useEffect(() => {
        const disposable = sessionService.onActiveModelChanged(model => {
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[ChatWidget] Active model changed:', model);
            }
        });
        return () => disposable.dispose();
    }, [sessionService]);

    return { enabledModels, handleManageModels };
}
