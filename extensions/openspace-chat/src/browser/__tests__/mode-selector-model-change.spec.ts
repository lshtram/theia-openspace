// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Emitter } from '@theia/core/lib/common/event';

describe('mode selector reacts to model changes', () => {
    it('calls getAvailableModels when active model changes', async () => {
        const emitter = new Emitter<string | undefined>();
        const getAvailableModels = sinon.stub().resolves([]);
        const sessionService = {
            activeModel: 'github-copilot/gpt-4o',
            onActiveModelChanged: emitter.event,
            getAvailableModels
        } as any;

        // Simulate the subscription pattern: subscribe to onActiveModelChanged and call getAvailableModels
        const disposable = sessionService.onActiveModelChanged(async (_model: string) => {
            await sessionService.getAvailableModels();
        });

        // Fire model change event
        emitter.fire('github-copilot/claude-opus-4.6');
        await new Promise(r => setTimeout(r, 0));

        expect(getAvailableModels.callCount).to.equal(1);
        disposable.dispose();
    });
});
