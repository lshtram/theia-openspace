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
import { Emitter, Event } from '@theia/core/lib/common/event';
import { ILogger } from '@theia/core/lib/common/logger';
import { Disposable } from '@theia/core/lib/common/disposable';
import { OpenCodeService, ProviderWithModels } from '../../common/opencode-protocol';

export const ModelPreferenceService = Symbol('ModelPreferenceService');

/**
 * Manages model selection and the active model preference.
 */
@injectable()
export class ModelPreferenceServiceImpl implements Disposable {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    private _activeModel: string | undefined;

    private readonly onActiveModelChangedEmitter = new Emitter<string | undefined>();
    readonly onActiveModelChanged: Event<string | undefined> = this.onActiveModelChangedEmitter.event;

    get activeModel(): string | undefined {
        return this._activeModel;
    }

    /**
     * Set the active model for the current session.
     * Model format: "provider/model" (e.g., "anthropic/claude-sonnet-4-5")
     */
    setActiveModel(model: string): void {
        this.logger.info(`[ModelPreference] Operation: setActiveModel(${model})`);
        this._activeModel = model;
        this.onActiveModelChangedEmitter.fire(model);
        this.logger.debug(`[ModelPreference] State: activeModel=${model}`);
    }

    /**
     * Get available models from the OpenCode server.
     * Uses the provided directory for context if available.
     */
    async getAvailableModels(directory?: string): Promise<ProviderWithModels[]> {
        this.logger.info('[ModelPreference] Operation: getAvailableModels()');
        try {
            const providers = await this.openCodeService.getAvailableModels(directory);
            this.logger.debug(`[ModelPreference] Found ${providers.length} providers`);
            return providers;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`[ModelPreference] Error fetching models: ${errorMsg}`);
            return [];
        }
    }

    /** Reset state (used during dispose). */
    reset(): void {
        this._activeModel = undefined;
    }

    dispose(): void {
        this.onActiveModelChangedEmitter.dispose();
    }
}
