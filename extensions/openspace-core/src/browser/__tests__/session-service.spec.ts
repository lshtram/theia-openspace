/* eslint-disable @typescript-eslint/no-explicit-any */
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from '../../test-utils/assertions';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { SessionServiceImpl } from '../session-service';
import { OpenCodeService, Project, Session } from '../../common/opencode-protocol';
import { buildProject, buildSession } from '../../test-utils/fixture-builders';

describe('SessionService', () => {
    let sessionService: SessionServiceImpl;
    let mockOpenCodeService: sinon.SinonStubbedInstance<OpenCodeService>;

    const mockProject: Project = buildProject();
    const mockSession: Session = buildSession({ id: 'session-1' });
    const mockSession2: Session = buildSession({ id: 'session-2', title: 'Test Session 2' });

    beforeEach(() => {
        // Create mock OpenCodeService
        mockOpenCodeService = {
            getProjects: sinon.stub(),
            getSession: sinon.stub(),
            getSessions: sinon.stub(),
            createSession: sinon.stub(),
            deleteSession: sinon.stub(),
            getMessages: sinon.stub(),
            createMessage: sinon.stub(),
            abortSession: sinon.stub(),
            connectToProject: sinon.stub().resolves()
        } as any;

        // Mock localStorage
        const storage: { [key: string]: string } = {};
        sinon.stub(window.localStorage, 'getItem').callsFake((key: string) => storage[key] || null);
        sinon.stub(window.localStorage, 'setItem').callsFake((key: string, value: string) => {
            storage[key] = value;
        });
        sinon.stub(window.localStorage, 'removeItem').callsFake((key: string) => {
            delete storage[key];
        });

        // Create SessionService instance
        sessionService = new SessionServiceImpl();
        (sessionService as any).openCodeService = mockOpenCodeService;
        (sessionService as any).logger = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getSessions()', () => {
        it('should return empty array when no active project', async () => {
            // No active project set
            const result = await sessionService.getSessions();
            
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(0);
            expect(mockOpenCodeService.getSessions.called).to.be.false;
        });

        it('should return all sessions from OpenCodeService when active project exists', async () => {
            // Set up active project
            mockOpenCodeService.getProjects.resolves([mockProject]);
            await sessionService.setActiveProject('proj-1');
            
            // Mock getSessions response
            mockOpenCodeService.getSessions.resolves([mockSession, mockSession2]);
            
            // Call getSessions
            const result = await sessionService.getSessions();
            
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(2);
            expect(result[0].id).to.equal('session-1');
            expect(result[1].id).to.equal('session-2');
            expect(mockOpenCodeService.getSessions.calledOnceWith('proj-1')).to.be.true;
        });

        it('should return empty array and log error on RPC failure', async () => {
            // Set up active project
            mockOpenCodeService.getProjects.resolves([mockProject]);
            await sessionService.setActiveProject('proj-1');
            
            // Mock getSessions to reject
            mockOpenCodeService.getSessions.rejects(new Error('Network error'));
            
            // Call getSessions
            const result = await sessionService.getSessions();
            
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(0);
            expect(sessionService.lastError).to.equal('Network error');
        });

        it('should handle empty session list gracefully', async () => {
            // Set up active project
            mockOpenCodeService.getProjects.resolves([mockProject]);
            await sessionService.setActiveProject('proj-1');
            
            // Mock getSessions response with empty array
            mockOpenCodeService.getSessions.resolves([]);
            
            // Call getSessions
            const result = await sessionService.getSessions();
            
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(0);
        });
    });

    describe('deleteSession()', () => {
        beforeEach(async () => {
            // Set up active project and session
            mockOpenCodeService.getProjects.resolves([mockProject]);
            mockOpenCodeService.getSession.resolves(mockSession);
            mockOpenCodeService.getMessages.resolves([]);
            
            await sessionService.setActiveProject('proj-1');
            await sessionService.setActiveSession('session-1');
        });

        it('should delete specified session via OpenCodeService', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            await sessionService.deleteSession('session-2');
            
            expect(mockOpenCodeService.deleteSession.calledOnceWith('proj-1', 'session-2')).to.be.true;
        });

        it('should clear activeSession if deleting active session', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            expect(sessionService.activeSession?.id).to.equal('session-1');
            
            await sessionService.deleteSession('session-1');
            
            expect(sessionService.activeSession).to.be.undefined;
            expect(sessionService.messages).to.have.lengthOf(0);
        });

        it('should emit onActiveSessionChanged event when deleting active session', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            const eventSpy = sinon.spy();
            sessionService.onActiveSessionChanged(eventSpy);
            
            await sessionService.deleteSession('session-1');
            
            expect(eventSpy.calledOnce).to.be.true;
            expect(eventSpy.calledWith(undefined)).to.be.true;
        });

        it('should emit onMessagesChanged event when deleting active session', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            const eventSpy = sinon.spy();
            sessionService.onMessagesChanged(eventSpy);
            
            await sessionService.deleteSession('session-1');
            
            // Should emit empty messages array
            expect(eventSpy.calledOnce).to.be.true;
            expect(eventSpy.calledWith([])).to.be.true;
        });

        it('should remove session ID from localStorage when deleting active session', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            // Session ID should be in localStorage initially
            expect(window.localStorage.getItem('openspace.activeSessionId')).to.not.be.null;
            
            await sessionService.deleteSession('session-1');
            
            // Session ID should be removed after delete
            expect(window.localStorage.getItem('openspace.activeSessionId')).to.be.null;
        });

        it('should NOT clear activeSession if deleting non-active session', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            expect(sessionService.activeSession?.id).to.equal('session-1');
            
            await sessionService.deleteSession('session-2');
            
            expect(sessionService.activeSession?.id).to.equal('session-1');
        });

        it('should throw error if no active project', async () => {
            // Create new service without project
            const newService = new SessionServiceImpl();
            (newService as any).openCodeService = mockOpenCodeService;
            (newService as any).logger = {
                info: sinon.stub(),
                warn: sinon.stub(),
                error: sinon.stub(),
                debug: sinon.stub(),
            };
            
            try {
                await newService.deleteSession('session-1');
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.equal('No active project');
            }
        });

        it('should handle RPC errors gracefully', async () => {
            mockOpenCodeService.deleteSession.rejects(new Error('Backend error'));
            
            try {
                await sessionService.deleteSession('session-1');
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.equal('Backend error');
                expect(sessionService.lastError).to.equal('Backend error');
            }
        });

        it('should emit onIsLoadingChanged events during operation', async () => {
            mockOpenCodeService.deleteSession.resolves();
            
            const loadingEvents: boolean[] = [];
            sessionService.onIsLoadingChanged(loading => loadingEvents.push(loading));
            
            await sessionService.deleteSession('session-2');
            
            expect(loadingEvents).to.deep.equal([true, false]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle deleting non-existent session', async () => {
            mockOpenCodeService.getProjects.resolves([mockProject]);
            await sessionService.setActiveProject('proj-1');
            
            mockOpenCodeService.deleteSession.rejects(new Error('Session not found'));
            
            try {
                await sessionService.deleteSession('non-existent');
                expect.fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).to.equal('Session not found');
            }
        });

        it('should handle race condition - multiple rapid getSessions calls', async () => {
            mockOpenCodeService.getProjects.resolves([mockProject]);
            await sessionService.setActiveProject('proj-1');
            
            mockOpenCodeService.getSessions.resolves([mockSession]);
            
            // Call getSessions multiple times rapidly
            const promises = [
                sessionService.getSessions(),
                sessionService.getSessions(),
                sessionService.getSessions()
            ];
            
            const results = await Promise.all(promises);
            
            // All should succeed
            results.forEach(result => {
                expect(result).to.have.lengthOf(1);
            });
        });

        it('should handle race condition - delete while another operation in progress', async () => {
            mockOpenCodeService.getProjects.resolves([mockProject]);
            mockOpenCodeService.getSession.resolves(mockSession);
            mockOpenCodeService.getMessages.resolves([]);
            mockOpenCodeService.deleteSession.resolves();
            
            await sessionService.setActiveProject('proj-1');
            await sessionService.setActiveSession('session-1');
            
            // Start getSessions (slow)
            const slowGetSessions = sinon.stub();
            mockOpenCodeService.getSessions.callsFake(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                slowGetSessions();
                return [mockSession];
            });
            
            // Fire getSessions and deleteSession in parallel
            const getSessionsPromise = sessionService.getSessions();
            await sessionService.deleteSession('session-1');
            
            await getSessionsPromise;
            
            // Both operations should complete
            expect(slowGetSessions.called).to.be.true;
            expect(sessionService.activeSession).to.be.undefined;
        });

        it('should handle network errors with proper error state', async () => {
            mockOpenCodeService.getProjects.resolves([mockProject]);
            await sessionService.setActiveProject('proj-1');
            
            mockOpenCodeService.getSessions.rejects(new Error('Connection timeout'));
            
            const result = await sessionService.getSessions();
            
            expect(result).to.be.empty;
            expect(sessionService.lastError).to.equal('Connection timeout');
        });
    });

    describe('UUID format for IDs (T3-6)', () => {
        it('should use UUID format (not Date.now) for optimistic message part IDs', () => {
            const src = fs.readFileSync(
                path.join(__dirname, '../session-service.ts'),
                'utf-8'
            );
            // Should NOT use Date.now() for temp-part IDs
            expect(src).not.to.match(/id.*temp-part.*Date\.now/);
            // Should use crypto.randomUUID()
            expect(src).to.match(/temp-part.*randomUUID|randomUUID.*temp-part/);
        });
    });

    describe('createSession() hub readiness gate', () => {
        let waitForHubStub: sinon.SinonStub;

        beforeEach(() => {
            mockOpenCodeService.getProjects.resolves([mockProject]);
            mockOpenCodeService.createSession.resolves(mockSession);
            mockOpenCodeService.getSession.resolves(mockSession);
            mockOpenCodeService.getMessages.resolves([]);
            // Stub the protected waitForHub wrapper on the prototype
            waitForHubStub = sinon.stub(
                Object.getPrototypeOf(sessionService),
                'waitForHub'
            );
        });

        it('awaits hub readiness before creating a session', async () => {
            waitForHubStub.resolves();
            await sessionService.setActiveProject('proj-1');
            await sessionService.createSession('test');
            expect(waitForHubStub.calledOnce).to.be.true;
            expect(mockOpenCodeService.createSession.calledOnce).to.be.true;
        });

        it('propagates HubNotReadyError and does not call createSession', async () => {
            waitForHubStub.rejects(new Error('Hub not ready after 20 attempts'));
            await sessionService.setActiveProject('proj-1');

            let thrown: Error | undefined;
            try {
                await sessionService.createSession('test');
            } catch (e) {
                thrown = e as Error;
            }

            expect(thrown).to.exist;
            expect(thrown!.message).to.include('Hub not ready');
            expect(mockOpenCodeService.createSession.called).to.be.false;
        });
    });

    describe('init() hub readiness gate on session restore', () => {
        let waitForHubStub: sinon.SinonStub;

        beforeEach(() => {
            mockOpenCodeService.getProjects.resolves([mockProject]);
            mockOpenCodeService.getSession.resolves(mockSession);
            mockOpenCodeService.getMessages.resolves([]);
            waitForHubStub = sinon.stub(
                Object.getPrototypeOf(sessionService),
                'waitForHub'
            );
            // Seed localStorage with saved IDs via the already-stubbed setItem
            window.localStorage.setItem('openspace.activeProjectId', 'proj-1');
            window.localStorage.setItem('openspace.activeSessionId', 'session-1');
        });

        it('restores session when hub is ready', async () => {
            waitForHubStub.resolves();
            (sessionService as any).init();
            // Let the async init() fire
            await new Promise(r => setTimeout(r, 50));
            expect(waitForHubStub.calledOnce).to.be.true;
            expect(sessionService.activeSession?.id).to.equal('session-1');
        });

        it('skips session restore and logs warning when hub is not ready', async () => {
            waitForHubStub.rejects(new Error('Hub not ready after 20 attempts'));
            (sessionService as any).init();
            await new Promise(r => setTimeout(r, 50));
            expect(waitForHubStub.calledOnce).to.be.true;
            // Session should NOT be restored
            expect(sessionService.activeSession).to.be.undefined;
        });
    });
});

describe('isStreaming hysteresis', () => {
    function createTestService(): SessionServiceImpl {
        const service = new SessionServiceImpl();
        (service as any).openCodeService = {
            getProjects: sinon.stub(),
            getSession: sinon.stub(),
            getSessions: sinon.stub(),
            createSession: sinon.stub(),
            deleteSession: sinon.stub(),
            getMessages: sinon.stub(),
            createMessage: sinon.stub(),
            abortSession: sinon.stub(),
            connectToProject: sinon.stub().resolves()
        };
        (service as any).logger = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };
        return service;
    }

    afterEach(() => {
        sinon.restore();
    });

    it('does not immediately set isStreaming=false when isDone arrives', () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        expect(service.isStreaming).to.equal(true);
        service.updateStreamingMessage('msg1', '', true);  // isDone=true
        // Should NOT be false yet (within hysteresis window)
        expect(service.isStreaming).to.equal(true);
    });

    it('fires isStreaming=false after hysteresis window when no new activity', async () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        service.updateStreamingMessage('msg1', '', true);  // isDone=true
        // Wait for hysteresis (600ms > 500ms window)
        await new Promise(r => setTimeout(r, 600));
        expect(service.isStreaming).to.equal(false);
    });

    it('cancels the hysteresis timer when new streaming activity arrives', async () => {
        const service = createTestService();
        service.updateStreamingMessage('msg1', 'hello', false);
        service.updateStreamingMessage('msg1', '', true);  // isDone=true on msg1
        // New message starts within 500ms window:
        service.updateStreamingMessage('msg2', 'world', false);
        await new Promise(r => setTimeout(r, 600));
        // Should still be streaming (msg2 is active)
        expect(service.isStreaming).to.equal(true);
    });
});

describe('sendMessage() SSE-first message delivery', () => {
    function createTestService(): SessionServiceImpl {
        const service = new SessionServiceImpl();
        (service as any).openCodeService = {
            getProjects: sinon.stub(),
            getSession: sinon.stub(),
            getSessions: sinon.stub(),
            createSession: sinon.stub(),
            deleteSession: sinon.stub(),
            getMessages: sinon.stub(),
            createMessage: sinon.stub(),
            abortSession: sinon.stub(),
            connectToProject: sinon.stub().resolves()
        };
        (service as any).logger = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };
        return service;
    }

    afterEach(() => {
        sinon.restore();
    });

    it('does not immediately push the assistant message from RPC result', async () => {
        const service = createTestService();
        const mockOpenCodeService = (service as any).openCodeService;
        (service as any)._activeProject = { id: 'proj-1' };
        (service as any)._activeSession = { id: 'sess-1' };

        // Mock createMessage to return a result with an assistant message
        mockOpenCodeService.createMessage = sinon.stub().resolves({
            info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
            parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
        });

        await service.sendMessage([{ type: 'text', text: 'hi' }]);

        // The assistant message should NOT be in _messages immediately after sendMessage resolves.
        const assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
        expect(assistantMessages.length).to.equal(0);

        // Clean up the pending fallback timer
        const timer = (service as any)._rpcFallbackTimer;
        if (timer) {
            clearTimeout(timer);
            (service as any)._rpcFallbackTimer = undefined;
        }
    });

    it('uses RPC result as fallback if SSE has not delivered the message after timeout', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const service = createTestService();
            const mockOpenCodeService = (service as any).openCodeService;
            (service as any)._activeProject = { id: 'proj-1' };
            (service as any)._activeSession = { id: 'sess-1' };

            mockOpenCodeService.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });

            await service.sendMessage([{ type: 'text', text: 'hi' }]);

            // No assistant message yet
            let assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(0);

            // Advance past the fallback timeout (5 seconds)
            clock.tick(5100);

            // Now the fallback should have inserted the message
            assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
            expect(assistantMessages[0].id).to.equal('msg-final');
        } finally {
            clock.restore();
        }
    });

    it('does NOT use RPC fallback if SSE already delivered the message', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const service = createTestService();
            const mockOCS = (service as any).openCodeService;
            (service as any)._activeProject = { id: 'proj-1' };
            (service as any)._activeSession = { id: 'sess-1' };

            mockOCS.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });

            await service.sendMessage([{ type: 'text', text: 'hi' }]);

            // Simulate SSE delivering the message before the fallback fires
            service.appendMessage({
                id: 'msg-final',
                sessionID: 'sess-1',
                role: 'assistant',
                time: { created: Date.now() },
                parts: [{ type: 'text', text: 'hello from SSE' }]
            } as any);

            // Advance past the fallback timeout
            clock.tick(5100);

            // Should still be exactly one assistant message (the SSE one)
            const assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
        } finally {
            clock.restore();
        }
    });

    it('cancels RPC fallback timer on abort', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const service = createTestService();
            const mockOCS = (service as any).openCodeService;
            (service as any)._activeProject = { id: 'proj-1' };
            (service as any)._activeSession = { id: 'sess-1' };

            mockOCS.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });
            mockOCS.abortSession = sinon.stub().resolves();

            await service.sendMessage([{ type: 'text', text: 'hi' }]);

            // Abort before the fallback timer fires
            await service.abort();

            // Advance past the fallback timeout
            clock.tick(5100);

            // No assistant message should have been inserted
            const assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(0);
        } finally {
            clock.restore();
        }
    });
});

describe('sendMessage() RPC fallback empty-parts safety net', () => {
    function createTestService(): SessionServiceImpl {
        const service = new SessionServiceImpl();
        (service as any).openCodeService = {
            getProjects: sinon.stub(),
            getSession: sinon.stub(),
            getSessions: sinon.stub(),
            createSession: sinon.stub(),
            deleteSession: sinon.stub(),
            getMessages: sinon.stub(),
            getMessage: sinon.stub(),
            createMessage: sinon.stub(),
            abortSession: sinon.stub(),
            connectToProject: sinon.stub().resolves()
        };
        (service as any).logger = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };
        return service;
    }

    afterEach(() => {
        sinon.restore();
    });

    it('fetches full message via getMessage when RPC result has empty parts', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const service = createTestService();
            const mockOCS = (service as any).openCodeService;
            (service as any)._activeProject = { id: 'proj-1' };
            (service as any)._activeSession = { id: 'sess-1' };

            // createMessage returns empty parts (as observed in the bug)
            mockOCS.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: []
            });

            // getMessage returns the full message with parts
            mockOCS.getMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello world', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });

            await service.sendMessage([{ type: 'text', text: 'hi' }]);

            // Advance past the fallback timeout
            clock.tick(5100);

            // Allow the async getMessage call to resolve
            await clock.tickAsync(0);

            // The fallback should have fetched from getMessage and inserted with parts
            const assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
            expect(assistantMessages[0].parts).to.have.lengthOf(1);
            expect((assistantMessages[0].parts![0] as any).text).to.equal('hello world');

            // getMessage should have been called
            expect(mockOCS.getMessage.calledOnce).to.be.true;
        } finally {
            clock.restore();
        }
    });

    it('does NOT call getMessage when RPC result already has parts', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const service = createTestService();
            const mockOCS = (service as any).openCodeService;
            (service as any)._activeProject = { id: 'proj-1' };
            (service as any)._activeSession = { id: 'sess-1' };

            // createMessage returns populated parts
            mockOCS.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: [{ type: 'text', text: 'hello', id: 'p1', sessionID: 'sess-1', messageID: 'msg-final' }]
            });

            mockOCS.getMessage = sinon.stub();

            await service.sendMessage([{ type: 'text', text: 'hi' }]);

            // Advance past the fallback timeout
            clock.tick(5100);

            // getMessage should NOT have been called
            expect(mockOCS.getMessage.called).to.be.false;

            // Message should be inserted directly from createMessage result
            const assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
            expect((assistantMessages[0].parts![0] as any).text).to.equal('hello');
        } finally {
            clock.restore();
        }
    });

    it('falls back to empty-parts message if getMessage also fails', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const service = createTestService();
            const mockOCS = (service as any).openCodeService;
            (service as any)._activeProject = { id: 'proj-1' };
            (service as any)._activeSession = { id: 'sess-1' };

            // createMessage returns empty parts
            mockOCS.createMessage = sinon.stub().resolves({
                info: { id: 'msg-final', sessionID: 'sess-1', role: 'assistant', time: { created: Date.now() } },
                parts: []
            });

            // getMessage also fails
            mockOCS.getMessage = sinon.stub().rejects(new Error('Network error'));

            await service.sendMessage([{ type: 'text', text: 'hi' }]);

            // Advance past the fallback timeout
            clock.tick(5100);

            // Allow the async getMessage rejection to resolve
            await clock.tickAsync(0);

            // Should still insert the message (with empty parts) as last resort
            const assistantMessages = service.messages.filter((m: any) => m.role === 'assistant');
            expect(assistantMessages.length).to.equal(1);
            expect(assistantMessages[0].id).to.equal('msg-final');
        } finally {
            clock.restore();
        }
    });
});

describe('applyPartDelta SSE reconnect duplication', () => {
    function createTestService(): SessionServiceImpl {
        const service = new SessionServiceImpl();
        (service as any).openCodeService = {
            getProjects: sinon.stub(),
            getSession: sinon.stub(),
            getSessions: sinon.stub(),
            createSession: sinon.stub(),
            deleteSession: sinon.stub(),
            getMessages: sinon.stub(),
            createMessage: sinon.stub(),
            abortSession: sinon.stub(),
            connectToProject: sinon.stub().resolves()
        };
        (service as any).logger = {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            debug: sinon.stub(),
        };
        return service;
    }

    afterEach(() => {
        sinon.restore();
    });

    it('applyPartDelta accumulates text correctly on first pass', () => {
        const service = createTestService();
        // Seed a message
        service.appendMessage({
            id: 'msg-1', sessionID: 'sess-1', role: 'assistant',
            time: { created: Date.now() }, parts: []
        } as any);

        // Apply deltas for text part
        service.applyPartDelta('msg-1', 'part-1', 'text', 'Hello ');
        service.applyPartDelta('msg-1', 'part-1', 'text', 'world!');

        const msg = service.messages.find(m => m.id === 'msg-1')!;
        const part = msg.parts!.find((p: any) => p.id === 'part-1') as any;
        expect(part.text).to.equal('Hello world!');
    });

    it('BUG: replayed deltas cause text duplication without clearStreamingPartText', () => {
        const service = createTestService();
        // Seed a message
        service.appendMessage({
            id: 'msg-1', sessionID: 'sess-1', role: 'assistant',
            time: { created: Date.now() }, parts: []
        } as any);

        // First pass: original SSE connection delivers deltas
        service.applyPartDelta('msg-1', 'part-1', 'text', 'Hello ');
        service.applyPartDelta('msg-1', 'part-1', 'text', 'world!');

        // Verify text after first pass
        let msg = service.messages.find(m => m.id === 'msg-1')!;
        let part = (msg.parts! as any[]).find(p => p.id === 'part-1');
        expect(part.text).to.equal('Hello world!');

        // SSE reconnect: server replays ALL deltas from the beginning.
        // Without clearing, text will be "Hello world!Hello world!" (2x duplication).
        // With clearStreamingPartText, text is reset first, then replayed correctly.
        service.clearStreamingPartText('msg-1');

        // Replayed deltas (same as original)
        service.applyPartDelta('msg-1', 'part-1', 'text', 'Hello ');
        service.applyPartDelta('msg-1', 'part-1', 'text', 'world!');

        msg = service.messages.find(m => m.id === 'msg-1')!;
        part = (msg.parts! as any[]).find(p => p.id === 'part-1');
        expect(part.text).to.equal('Hello world!');
    });

    it('clearStreamingPartText resets reasoning fields too', () => {
        const service = createTestService();
        service.appendMessage({
            id: 'msg-1', sessionID: 'sess-1', role: 'assistant',
            time: { created: Date.now() }, parts: []
        } as any);

        // Accumulate reasoning
        service.applyPartDelta('msg-1', 'part-r', 'reasoning', 'Thinking...');

        let msg = service.messages.find(m => m.id === 'msg-1')!;
        let part = (msg.parts! as any[]).find(p => p.id === 'part-r');
        expect(part.reasoning).to.equal('Thinking...');

        // Clear and replay
        service.clearStreamingPartText('msg-1');

        service.applyPartDelta('msg-1', 'part-r', 'reasoning', 'Thinking...');

        msg = service.messages.find(m => m.id === 'msg-1')!;
        part = (msg.parts! as any[]).find(p => p.id === 'part-r');
        expect(part.reasoning).to.equal('Thinking...');
    });

    it('clearStreamingPartText preserves tool parts (non-text/reasoning)', () => {
        const service = createTestService();
        service.appendMessage({
            id: 'msg-1', sessionID: 'sess-1', role: 'assistant',
            time: { created: Date.now() },
            parts: [
                { type: 'tool', id: 'tool-1', tool: 'bash', state: { status: 'completed' } },
            ]
        } as any);

        // Add text via delta
        service.applyPartDelta('msg-1', 'part-1', 'text', 'Result: ');

        // Clear streaming text — tool parts should remain untouched
        service.clearStreamingPartText('msg-1');

        const msg = service.messages.find(m => m.id === 'msg-1')!;
        const toolPart = (msg.parts! as any[]).find(p => p.id === 'tool-1');
        expect(toolPart).to.exist;
        expect(toolPart.type).to.equal('tool');
        expect(toolPart.tool).to.equal('bash');

        // Text part should have its text field cleared
        const textPart = (msg.parts! as any[]).find(p => p.id === 'part-1');
        expect(textPart).to.exist;
        expect(textPart.text).to.equal('');
    });

    it('clearStreamingPartText is a no-op for unknown message ID', () => {
        const service = createTestService();
        // Should not throw
        service.clearStreamingPartText('nonexistent-msg');
    });

    it('5x duplication scenario — clear prevents repeated accumulation', () => {
        const service = createTestService();
        service.appendMessage({
            id: 'msg-1', sessionID: 'sess-1', role: 'assistant',
            time: { created: Date.now() }, parts: []
        } as any);

        const deltas = ['The ', 'answer ', 'is ', '42.'];

        // First connection
        for (const d of deltas) {
            service.applyPartDelta('msg-1', 'part-1', 'text', d);
        }
        let msg = service.messages.find(m => m.id === 'msg-1')!;
        let part = (msg.parts! as any[]).find(p => p.id === 'part-1');
        expect(part.text).to.equal('The answer is 42.');

        // Simulate 4 reconnects (each replays all deltas)
        for (let reconnect = 0; reconnect < 4; reconnect++) {
            service.clearStreamingPartText('msg-1');
            for (const d of deltas) {
                service.applyPartDelta('msg-1', 'part-1', 'text', d);
            }
        }

        msg = service.messages.find(m => m.id === 'msg-1')!;
        part = (msg.parts! as any[]).find(p => p.id === 'part-1');
        // With clearStreamingPartText, the text is rebuilt each time — no duplication
        expect(part.text).to.equal('The answer is 42.');
    });
});
