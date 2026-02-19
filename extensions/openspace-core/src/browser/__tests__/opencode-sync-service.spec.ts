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
 * T2-15: Test hooks must be guarded by NODE_ENV check.
 *
 * Behavioural runtime tests: instantiate OpenCodeSyncServiceImpl, call
 * setSessionService(), and assert that window.__openspace_test__ is only
 * populated in non-production environments.
 */

import { expect } from 'chai';
import { OpenCodeSyncServiceImpl } from '../opencode-sync-service';
import { SessionService } from '../session-service';

/**
 * Build a minimal stub SessionService. Only onActiveSessionChanged needs to
 * be present because setSessionService() subscribes to that event.
 */
function makeSessionServiceStub(): SessionService {
    return {
        onActiveSessionChanged: () => ({ dispose: () => undefined }),
        // SessionService extends Disposable; provide a no-op
        dispose: () => undefined,
    } as unknown as SessionService;
}

describe('OpenCodeSyncService - Test Hook Security (T2-15)', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        originalNodeEnv = process.env.NODE_ENV;
        // Clean up any previously set test hook
        if (typeof window !== 'undefined') {
            delete (window as any).__openspace_test__;
        }
    });

    afterEach(() => {
        // Always restore NODE_ENV regardless of what the test did
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
        // Clean up any test hook left behind
        if (typeof window !== 'undefined') {
            delete (window as any).__openspace_test__;
        }
    });

    it('should NOT expose window.__openspace_test__ when NODE_ENV is production', () => {
        process.env.NODE_ENV = 'production';

        const service = new OpenCodeSyncServiceImpl();
        (service as any).logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
        service.setSessionService(makeSessionServiceStub());

        expect((window as any).__openspace_test__).to.be.undefined;
    });

    it('should expose window.__openspace_test__ when NODE_ENV is not production', () => {
        process.env.NODE_ENV = 'test';

        const service = new OpenCodeSyncServiceImpl();
        (service as any).logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
        service.setSessionService(makeSessionServiceStub());

        expect((window as any).__openspace_test__).to.not.be.undefined;
        expect(typeof (window as any).__openspace_test__.triggerAgentCommand).to.equal('function');
        expect(typeof (window as any).__openspace_test__.getLastDispatchedCommand).to.equal('function');
        expect(typeof (window as any).__openspace_test__.injectMessageEvent).to.equal('function');
    });
});
