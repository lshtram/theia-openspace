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

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { SessionServiceImpl } from '../session-service';
import { OpenCodeService, Project, Session } from '../../common/opencode-protocol';

describe('SessionService', () => {
    let sessionService: SessionServiceImpl;
    let mockOpenCodeService: sinon.SinonStubbedInstance<OpenCodeService>;

    const mockProject: Project = {
        id: 'proj-1',
        worktree: '/test/project',
        time: {
            created: Date.now()
        }
    };

    const mockSession: Session = {
        id: 'session-1',
        projectID: 'proj-1',
        title: 'Test Session',
        time: {
            created: Date.now(),
            updated: Date.now()
        },
        directory: '/test',
        version: '1.0.0'
    };

    const mockSession2: Session = {
        id: 'session-2',
        projectID: 'proj-1',
        title: 'Test Session 2',
        time: {
            created: Date.now(),
            updated: Date.now()
        },
        directory: '/test',
        version: '1.0.0'
    };

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
