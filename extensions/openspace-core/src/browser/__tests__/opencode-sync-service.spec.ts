/* eslint-disable @typescript-eslint/no-explicit-any */
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

const SESSION_ID = 'test-session-id';

/**
 * Build a minimal stub SessionService. Only onActiveSessionChanged needs to
 * be present because setSessionService() subscribes to that event.
 */
function makeSessionServiceStub(sessionId = SESSION_ID): SessionService & { updateSessionStatusCalled: number } {
    const stub = {
        onActiveSessionChanged: () => ({ dispose: () => undefined }),
        dispose: () => undefined,
        activeSession: { id: sessionId } as any,
        updateSessionStatus: () => { stub.updateSessionStatusCalled++; },
        updateSessionStatusCalled: 0,
    } as unknown as SessionService & { updateSessionStatusCalled: number };
    return stub;
}

function makeService(): OpenCodeSyncServiceImpl {
    const service = new OpenCodeSyncServiceImpl();
    (service as any).logger = {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    };
    (service as any).commandRegistry = { getCommand: () => undefined, executeCommand: () => undefined };
    return service;
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

        const service = makeService();
        service.setSessionService(makeSessionServiceStub());

        expect((window as any).__openspace_test__).to.be.undefined;
    });

    it('should expose window.__openspace_test__ when NODE_ENV is not production', () => {
        process.env.NODE_ENV = 'test';

        const service = makeService();
        service.setSessionService(makeSessionServiceStub());

        expect((window as any).__openspace_test__).to.not.be.undefined;
        expect(typeof (window as any).__openspace_test__.triggerAgentCommand).to.equal('function');
        expect(typeof (window as any).__openspace_test__.getLastDispatchedCommand).to.equal('function');
        expect(typeof (window as any).__openspace_test__.injectMessageEvent).to.equal('function');
    });
});

describe('OpenCodeSyncService - Event buffering during DI init race (Bug A)', () => {

    it('buffers status_changed events arriving before setSessionService() and processes them after wiring', () => {
        const service = makeService();

        // Simulate SSE event arriving before setSessionService() is called
        // (the DI race condition: new connection, events arrive before BridgeContribution.onStart fires)
        service.onSessionEvent({
            type: 'status_changed',
            sessionId: SESSION_ID,
            sessionStatus: { type: 'busy' },
        } as any);

        // At this point, with the current (broken) implementation, the event is swallowed.
        // After the fix, it should be queued.

        const stub = makeSessionServiceStub();
        service.setSessionService(stub);

        // After wiring, the buffered event should have been drained and processed
        expect(stub.updateSessionStatusCalled).to.equal(1);
    });

});
