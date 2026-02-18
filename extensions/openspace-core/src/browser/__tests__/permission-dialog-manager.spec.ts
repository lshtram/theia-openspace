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

import { expect } from 'chai';
import * as sinon from 'sinon';
import { PermissionDialogManager } from '../permission-dialog-manager';
import { PermissionNotification, OpenCodeService } from '../../common/opencode-protocol';

/**
 * Unit tests for PermissionDialogManager.
 * 
 * Test Coverage:
 * - Permission request queueing and processing
 * - Grant/Deny actions
 * - Timeout behavior (60-second auto-deny)
 * - Queue management (FIFO order)
 * - State management (current request, queue, isOpen)
 * - Event emission for UI updates
 */
describe('PermissionDialogManager', () => {
    let manager: PermissionDialogManager;
    let mockOpenCodeService: sinon.SinonStubbedInstance<OpenCodeService>;
    let clock: sinon.SinonFakeTimers;

    const createMockPermissionEvent = (overrides?: Partial<PermissionNotification>): PermissionNotification => ({
        type: 'requested',
        sessionId: 'session-1',
        projectId: 'proj-1',
        permissionId: 'perm-123',
        permission: {
            id: 'perm-123',
            type: 'file_write',
            message: 'Agent oracle_a3f7 wants to write to /workspace/test.ts',
            status: 'pending'
        },
        ...overrides
    });

    beforeEach(() => {
        // Create mock OpenCodeService
        mockOpenCodeService = {
            grantPermission: sinon.stub().resolves({} as any)
        } as any;

        // Use Sinon fake timers for timeout tests
        clock = sinon.useFakeTimers();

        // Create manager instance
        manager = new PermissionDialogManager(mockOpenCodeService);
    });

    afterEach(() => {
        manager.dispose();
        clock.restore();
        sinon.restore();
    });

    describe('Initialization', () => {
        it('should initialize with empty state', () => {
            expect(manager.isOpen).to.be.false;
            expect(manager.currentRequest).to.be.null;
            expect(manager.queueLength).to.equal(0);
        });

        it('should not be open when no requests exist', () => {
            expect(manager.isOpen).to.be.false;
        });
    });

    describe('Request Processing', () => {
        it('should open dialog when permission event received', () => {
            const event = createMockPermissionEvent();
            
            manager.handlePermissionEvent(event);

            expect(manager.isOpen).to.be.true;
            expect(manager.currentRequest).to.not.be.null;
            expect(manager.currentRequest?.permissionId).to.equal('perm-123');
        });

        it('should display agent ID from permission event', () => {
            const event = createMockPermissionEvent();
            
            manager.handlePermissionEvent(event);

            const currentReq = manager.currentRequest;
            expect(currentReq).to.not.be.null;
            expect(currentReq?.permission?.message).to.include('oracle_a3f7');
        });

        it('should display action type from permission event', () => {
            const event = createMockPermissionEvent({
                permission: {
                    id: 'perm-123',
                    type: 'command_execute',
                    message: 'Execute npm test',
                    status: 'pending'
                }
            });
            
            manager.handlePermissionEvent(event);

            expect(manager.currentRequest?.permission?.type).to.equal('command_execute');
        });

        it('should display action details (permission message)', () => {
            const event = createMockPermissionEvent({
                permission: {
                    id: 'perm-123',
                    type: 'file_write',
                    message: 'Write to /workspace/config.json',
                    status: 'pending'
                }
            });
            
            manager.handlePermissionEvent(event);

            expect(manager.currentRequest?.permission?.message).to.equal('Write to /workspace/config.json');
        });
    });

    describe('Grant Action', () => {
        it('should call grantPermission with correct arguments when granted', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            await manager.grant();

            expect(mockOpenCodeService.grantPermission.calledOnce).to.be.true;
            expect(mockOpenCodeService.grantPermission.calledWith('proj-1', 'session-1', 'perm-123')).to.be.true;
        });

        it('should close dialog after grant when queue is empty', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            await manager.grant();

            expect(manager.isOpen).to.be.false;
            expect(manager.currentRequest).to.be.null;
        });

        it('should emit state change event after grant', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            const stateChangeListener = sinon.stub();
            manager.onStateChange(stateChangeListener);

            await manager.grant();

            expect(stateChangeListener.calledOnce).to.be.true;
        });
    });

    describe('Deny Action', () => {
        it('should NOT call grantPermission when denied', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            await manager.deny();

            expect(mockOpenCodeService.grantPermission.called).to.be.false;
        });

        it('should close dialog after deny when queue is empty', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            await manager.deny();

            expect(manager.isOpen).to.be.false;
            expect(manager.currentRequest).to.be.null;
        });

        it('should emit state change event after deny', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            const stateChangeListener = sinon.stub();
            manager.onStateChange(stateChangeListener);

            await manager.deny();

            expect(stateChangeListener.calledOnce).to.be.true;
        });
    });

    describe('Queue Management', () => {
        it('should queue multiple permission requests (FIFO order)', () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });
            const event3 = createMockPermissionEvent({ permissionId: 'perm-3' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);
            manager.handlePermissionEvent(event3);

            expect(manager.isOpen).to.be.true;
            expect(manager.currentRequest?.permissionId).to.equal('perm-1');
            expect(manager.queueLength).to.equal(2); // event2 and event3 queued
        });

        it('should process queue in FIFO order after grant', async () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });
            const event3 = createMockPermissionEvent({ permissionId: 'perm-3' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);
            manager.handlePermissionEvent(event3);

            // Grant first request
            await manager.grant();
            expect(manager.currentRequest?.permissionId).to.equal('perm-2');
            expect(manager.queueLength).to.equal(1); // only event3 queued now

            // Grant second request
            await manager.grant();
            expect(manager.currentRequest?.permissionId).to.equal('perm-3');
            expect(manager.queueLength).to.equal(0);

            // Grant third request
            await manager.grant();
            expect(manager.isOpen).to.be.false;
            expect(manager.currentRequest).to.be.null;
        });

        it('should process queue in FIFO order after deny', async () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);

            // Deny first request
            await manager.deny();
            expect(manager.currentRequest?.permissionId).to.equal('perm-2');
            expect(manager.queueLength).to.equal(0);
        });

        it('should return queue position correctly (1-indexed)', () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });
            const event3 = createMockPermissionEvent({ permissionId: 'perm-3' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);
            manager.handlePermissionEvent(event3);

            expect(manager.currentPosition).to.equal(1);
            expect(manager.totalRequests).to.equal(3);
        });

        it('should move to next queued request after timeout', async () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);

            // Advance time by 60 seconds (trigger timeout)
            await clock.tickAsync(60000);

            expect(manager.currentRequest?.permissionId).to.equal('perm-2');
            expect(manager.queueLength).to.equal(0);
        });
    });

    describe('Timeout Handling', () => {
        it('should auto-deny after 60 seconds if no user response', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            expect(manager.isOpen).to.be.true;

            // Advance time by 60 seconds
            await clock.tickAsync(60000);

            expect(mockOpenCodeService.grantPermission.called).to.be.false;
            expect(manager.isOpen).to.be.false;
        });

        it('should emit state change event after timeout', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            const stateChangeListener = sinon.stub();
            manager.onStateChange(stateChangeListener);

            // Advance time by 60 seconds
            await clock.tickAsync(60000);

            expect(stateChangeListener.calledOnce).to.be.true;
        });

        it('should cancel timeout if user responds before 60 seconds', async () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            // Advance time by 30 seconds (halfway)
            await clock.tickAsync(30000);

            // User clicks Grant
            await manager.grant();
            expect(mockOpenCodeService.grantPermission.calledOnce).to.be.true;

            // Advance time by another 40 seconds (total 70, past timeout threshold)
            await clock.tickAsync(40000);

            // Verify permission was granted only once (not auto-denied)
            expect(mockOpenCodeService.grantPermission.calledOnce).to.be.true;
            expect(manager.isOpen).to.be.false;
        });

        it('should start new timeout for each queued request', async () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);

            // Grant first request after 30 seconds
            await clock.tickAsync(30000);
            await manager.grant();
            expect(manager.currentRequest?.permissionId).to.equal('perm-2');

            // Second request should have its own 60-second timeout
            await clock.tickAsync(30000); // Total 60 since first request, but only 30 for second
            expect(manager.isOpen).to.be.true; // Still open

            await clock.tickAsync(30000); // Now 60 seconds for second request
            expect(manager.isOpen).to.be.false; // Timed out
        });
    });

    describe('State Management', () => {
        it('should provide current request details', () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            expect(manager.currentRequest).to.not.be.null;
            expect(manager.currentRequest?.permissionId).to.equal('perm-123');
            expect(manager.currentRequest?.permission?.type).to.equal('file_write');
        });

        it('should provide queue length', () => {
            const event1 = createMockPermissionEvent({ permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ permissionId: 'perm-2' });

            manager.handlePermissionEvent(event1);
            expect(manager.queueLength).to.equal(0);

            manager.handlePermissionEvent(event2);
            expect(manager.queueLength).to.equal(1);
        });

        it('should provide isOpen status', () => {
            expect(manager.isOpen).to.be.false;

            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);
            expect(manager.isOpen).to.be.true;
        });

        it('should emit state change events on all state modifications', async () => {
            const stateChangeListener = sinon.stub();
            manager.onStateChange(stateChangeListener);

            const event = createMockPermissionEvent();
            
            // Event 1: handlePermissionEvent
            manager.handlePermissionEvent(event);
            expect(stateChangeListener.callCount).to.equal(1);

            // Event 2: grant
            await manager.grant();
            expect(stateChangeListener.callCount).to.equal(2);
        });
    });

    describe('Disposal', () => {
        it('should clear timeout on disposal', () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            manager.dispose();

            // Advance time past timeout
            clock.tick(70000);

            // Should not auto-deny after disposal
            expect(mockOpenCodeService.grantPermission.called).to.be.false;
        });

        it('should clear state on disposal', () => {
            const event = createMockPermissionEvent();
            manager.handlePermissionEvent(event);

            manager.dispose();

            expect(manager.isOpen).to.be.false;
            expect(manager.currentRequest).to.be.null;
            expect(manager.queueLength).to.equal(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle grant when no current request exists (defensive)', async () => {
            await manager.grant();
            expect(mockOpenCodeService.grantPermission.called).to.be.false;
        });

        it('should handle deny when no current request exists (defensive)', async () => {
            await manager.deny();
            // Should not throw
        });

        it('should ignore duplicate permission events with same ID', () => {
            const event = createMockPermissionEvent();
            
            manager.handlePermissionEvent(event);
            manager.handlePermissionEvent(event); // Duplicate

            expect(manager.queueLength).to.equal(0); // Not queued twice
        });

        it('should handle permission events from different sessions', () => {
            const event1 = createMockPermissionEvent({ sessionId: 'session-1', permissionId: 'perm-1' });
            const event2 = createMockPermissionEvent({ sessionId: 'session-2', permissionId: 'perm-2' });

            manager.handlePermissionEvent(event1);
            manager.handlePermissionEvent(event2);

            // Both should be processed (no session filtering in manager)
            expect(manager.queueLength).to.equal(1);
        });
    });
});
