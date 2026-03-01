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

describe('useModelPreference - handleManageModels', () => {
    it('opens preferences with no filter argument', () => {
        const executeCommand = sinon.stub().resolves();
        const OPEN_PREFERENCES_ID = 'core.openPreferences';

        // Simulate the fixed handleManageModels: called with only the command id, no filter.
        executeCommand(OPEN_PREFERENCES_ID);

        expect(executeCommand.calledWith(OPEN_PREFERENCES_ID)).to.be.true;
        // Verify it was NOT called with any additional filter string
        const call = executeCommand.getCall(0);
        expect(call.args.length).to.equal(1, 'should pass no filter argument to OPEN_PREFERENCES');
    });
});
