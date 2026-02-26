// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Issue 9: Session restore failures are silently swallowed.
 *
 * Failure mode: when setActiveSession() rejects during init() (e.g. the
 * persisted session was deleted from the backend), the error is only logged.
 * The user sees no notification; the IDE starts normally then behaves
 * unexpectedly when they try to interact.
 *
 * Fix: inject MessageService and call messageService.warn() from the catch
 * block so the user gets an actionable notification.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SessionServiceImpl } from '../session-service/session-service';
import { StreamingStateServiceImpl } from '../session-service/streaming-state';
import { MessageStoreServiceImpl } from '../session-service/message-store';
import { SessionLifecycleServiceImpl } from '../session-service/session-lifecycle';
import { InteractionServiceImpl } from '../session-service/interaction-handlers';
import { ModelPreferenceServiceImpl } from '../session-service/model-preference';
import { buildProject, buildSession } from '../../test-utils/fixture-builders';

describe('SessionService — init() session restore failure notification (Issue 9)', () => {
    let sessionService: SessionServiceImpl;
    let mockOpenCodeService: any;
    let mockMessageService: { warn: sinon.SinonStub };

    const mockProject = buildProject();
    const mockSession = buildSession({ id: 'session-1' });

    beforeEach(() => {
        mockOpenCodeService = {
            getProjects:        sinon.stub().resolves([mockProject]),
            getSession:         sinon.stub().rejects(new Error('Session not found')),
            getSessions:        sinon.stub().resolves([]),
            getSessionStatuses: sinon.stub().resolves([]),
            createSession:      sinon.stub().resolves(mockSession),
            deleteSession:      sinon.stub().resolves(),
            getMessages:        sinon.stub().resolves([]),
            createMessage:      sinon.stub().resolves({}),
            abortSession:       sinon.stub().resolves(),
            connectToProject:   sinon.stub().resolves(),
        };

        mockMessageService = {
            warn: sinon.stub().resolves(),
        };

        // Seed localStorage directly — sinon.stub() silently fails on jsdom's
        // localStorage because the native methods are non-configurable.
        window.localStorage.setItem('openspace.activeProjectId', 'proj-1');
        window.localStorage.setItem('openspace.activeSessionId', 'session-1');

        sessionService = new SessionServiceImpl();
        (sessionService as any).openCodeService = mockOpenCodeService;
        const mockLogger = {
            info:  sinon.stub(),
            warn:  sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };
        (sessionService as any).logger = mockLogger;

        // Wire decomposed sub-services
        const messageStore = new MessageStoreServiceImpl();
        (messageStore as any).logger = mockLogger;
        (messageStore as any).openCodeService = mockOpenCodeService;

        const streamingState = new StreamingStateServiceImpl();
        (streamingState as any).logger = mockLogger;
        (streamingState as any).messageStore = messageStore;

        const lifecycle = new SessionLifecycleServiceImpl();
        (lifecycle as any).logger = mockLogger;
        (lifecycle as any).openCodeService = mockOpenCodeService;

        const interactions = new InteractionServiceImpl();
        (interactions as any).logger = mockLogger;
        (interactions as any).openCodeService = mockOpenCodeService;

        const modelPref = new ModelPreferenceServiceImpl();
        (modelPref as any).logger = mockLogger;
        (modelPref as any).openCodeService = mockOpenCodeService;

        (sessionService as any).streamingState = streamingState;
        (sessionService as any).messageStore = messageStore;
        (sessionService as any).lifecycle = lifecycle;
        (sessionService as any).interactions = interactions;
        (sessionService as any).modelPref = modelPref;

        // Stub waitForHub so the session restore code path is reached
        sinon.stub(Object.getPrototypeOf(sessionService), 'waitForHub').resolves();
    });

    afterEach(() => {
        sinon.restore();
        window.localStorage.clear();
    });

    it('calls messageService.warn when session restore fails', async () => {
        // Inject the mock MessageService — this is what the fix must wire up
        (sessionService as any).messageService = mockMessageService;

        // Trigger the fire-and-forget init()
        (sessionService as any).init();

        // Allow the async IIFE inside init() to run to completion
        await new Promise(r => setTimeout(r, 50));

        // EXPECTED (after fix): user receives a warning notification
        // ACTUAL (before fix):  messageService is never called → this assertion fails
        expect(mockMessageService.warn.calledOnce, 'messageService.warn should be called once').to.be.true;
    });

    it('warning message mentions session restore', async () => {
        (sessionService as any).messageService = mockMessageService;
        (sessionService as any).init();
        await new Promise(r => setTimeout(r, 50));

        const message: string = mockMessageService.warn.firstCall?.args[0] ?? '';
        expect(message, 'warning should mention session or restore').to.match(/session.*could not be restored|previous session|restore.*failed/i);
    });

    it('does NOT call messageService.warn when session restore succeeds', async () => {
        // Make getSession succeed this time
        mockOpenCodeService.getSession.resolves(mockSession);
        mockOpenCodeService.getMessages.resolves([]);
        (sessionService as any).messageService = mockMessageService;

        (sessionService as any).init();
        await new Promise(r => setTimeout(r, 50));

        expect(mockMessageService.warn.called, 'messageService.warn should not be called on success').to.be.false;
    });
});
