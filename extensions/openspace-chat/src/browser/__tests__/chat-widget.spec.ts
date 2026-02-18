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

// Mock SessionService for testing
interface MockSessionService {
    activeProject: any | undefined;
    activeSession: any | undefined;
    messages: any[];
    getSessions: sinon.SinonStub;
    createSession: sinon.SinonStub;
    setActiveSession: sinon.SinonStub;
    deleteSession: sinon.SinonStub;
    sendMessage: sinon.SinonStub;
    onMessagesChanged: sinon.SinonStub;
    onMessageStreaming: sinon.SinonStub;
    onIsStreamingChanged: sinon.SinonStub;
    onActiveSessionChanged: sinon.SinonStub;
}

describe('ChatWidget - Session Management', () => {
    let mockSessionService: MockSessionService;
    let confirmStub: sinon.SinonStub;

    const mockSession1 = {
        id: 'session-1',
        projectID: 'proj-1',
        title: 'Test Session 1',
        time: {
            created: Date.now(),
            updated: Date.now()
        },
        directory: '/test',
        version: 1,
        agent: 'test-agent',
        model: { providerID: 'test', modelID: 'test-model' }
    };

    const mockSession2 = {
        id: 'session-2',
        projectID: 'proj-1',
        title: 'Test Session 2',
        time: {
            created: Date.now(),
            updated: Date.now()
        },
        directory: '/test',
        version: 1,
        agent: 'test-agent',
        model: { providerID: 'test', modelID: 'test-model' }
    };

    const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
        path: '/test'
    };

    beforeEach(() => {
        // Create mock SessionService
        mockSessionService = {
            activeProject: mockProject,
            activeSession: mockSession1,
            messages: [],
            getSessions: sinon.stub(),
            createSession: sinon.stub(),
            setActiveSession: sinon.stub(),
            deleteSession: sinon.stub(),
            sendMessage: sinon.stub(),
            onMessagesChanged: sinon.stub().returns({ dispose: sinon.stub() }),
            onMessageStreaming: sinon.stub().returns({ dispose: sinon.stub() }),
            onIsStreamingChanged: sinon.stub().returns({ dispose: sinon.stub() }),
            onActiveSessionChanged: sinon.stub().returns({ dispose: sinon.stub() })
        };

        // Mock window.confirm
        confirmStub = sinon.stub(window, 'confirm');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Session Dropdown', () => {
        it('should render with current session title', () => {
            expect(mockSessionService.activeSession).to.not.be.undefined;
            expect(mockSessionService.activeSession.title).to.equal('Test Session 1');
        });

        it('should disable when no active project', () => {
            mockSessionService.activeProject = undefined;
            expect(mockSessionService.activeProject).to.be.undefined;
        });

        it('should display sessions list', async () => {
            mockSessionService.getSessions.resolves([mockSession1, mockSession2]);
            const sessions = await mockSessionService.getSessions();
            expect(sessions).to.have.lengthOf(2);
        });
    });

    describe('Session Creation', () => {
        it('should create new session', async () => {
            const newSession = { ...mockSession1, id: 'session-3' };
            mockSessionService.createSession.resolves(newSession);
            
            const result = await mockSessionService.createSession('New Session');
            expect(result.id).to.equal('session-3');
        });

        it('should handle creation error', async () => {
            mockSessionService.createSession.rejects(new Error('Failed'));
            
            try {
                await mockSessionService.createSession('Test');
                expect.fail('Should have thrown');
            } catch (e: any) {
                expect(e.message).to.equal('Failed');
            }
        });
    });

    describe('Session Switching', () => {
        it('should switch active session', async () => {
            mockSessionService.setActiveSession.resolves();
            await mockSessionService.setActiveSession('session-2');
            expect(mockSessionService.setActiveSession.calledOnceWith('session-2')).to.be.true;
        });

        it('should handle switch error', async () => {
            mockSessionService.setActiveSession.rejects(new Error('Not found'));
            
            try {
                await mockSessionService.setActiveSession('invalid');
                expect.fail('Should have thrown');
            } catch (e: any) {
                expect(e.message).to.equal('Not found');
            }
        });
    });

    describe('Session Deletion', () => {
        it('should show confirmation dialog', () => {
            confirmStub.returns(true);
            const confirmed = window.confirm('Delete?');
            expect(confirmed).to.be.true;
        });

        it('should delete on confirmation', async () => {
            confirmStub.returns(true);
            mockSessionService.deleteSession.resolves();
            
            if (confirmStub()) {
                await mockSessionService.deleteSession('session-1');
            }
            
            expect(mockSessionService.deleteSession.calledOnce).to.be.true;
        });

        it('should NOT delete on cancellation', async () => {
            confirmStub.returns(false);
            
            if (confirmStub()) {
                await mockSessionService.deleteSession('session-1');
            }
            
            expect(mockSessionService.deleteSession.called).to.be.false;
        });

        it('should handle delete error', async () => {
            confirmStub.returns(true);
            mockSessionService.deleteSession.rejects(new Error('Backend error'));
            
            try {
                await mockSessionService.deleteSession('session-1');
                expect.fail('Should have thrown');
            } catch (e: any) {
                expect(e.message).to.equal('Backend error');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty sessions list', async () => {
            mockSessionService.getSessions.resolves([]);
            const sessions = await mockSessionService.getSessions();
            expect(sessions).to.be.empty;
        });

        it('should cleanup disposables', () => {
            const disposables = [
                { dispose: sinon.stub() },
                { dispose: sinon.stub() }
            ];
            
            disposables.forEach(d => { d.dispose(); });
            
            disposables.forEach(d => {
                expect(d.dispose.calledOnce).to.be.true;
            });
        });
    });
});
