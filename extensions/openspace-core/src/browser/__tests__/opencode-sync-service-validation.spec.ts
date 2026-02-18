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
 * Phase T3: Command validation is now inline in executeAndReport().
 *
 * In Phase T3 the explicit validateAgentCommand() helper was removed.
 * Security enforcement is done inline:
 *   - Commands must be non-empty strings starting with 'openspace.'
 *   - All other commands are silently dropped before CommandRegistry dispatch.
 *
 * These tests verify the security behaviour via the observable side-effect:
 * _lastDispatchedCommand is only set when a command passes the security check
 * AND exists in CommandRegistry.  For commands that are rejected by the security
 * gate, _lastDispatchedCommand stays null.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { OpenCodeSyncServiceImpl } from '../opencode-sync-service';
import { AgentCommand } from '../../common/command-manifest';
import { CommandRegistry } from '@theia/core/lib/common/command';

/**
 * Build a minimal stub CommandRegistry that pretends every command exists.
 */
function makeCommandRegistry(existingIds: string[] = []): sinon.SinonStubbedInstance<CommandRegistry> {
    const stub = {
        getCommand: sinon.stub().callsFake((id: string) =>
            existingIds.includes(id) ? { id } : undefined
        ),
        executeCommand: sinon.stub().resolves(undefined),
        commands: [],
    } as unknown as sinon.SinonStubbedInstance<CommandRegistry>;
    return stub;
}

describe('OpenCodeSyncService - Command Security Gate (T3)', () => {
    let syncService: OpenCodeSyncServiceImpl;
    let commandRegistry: sinon.SinonStubbedInstance<CommandRegistry>;

    beforeEach(() => {
        syncService = new OpenCodeSyncServiceImpl();
        // Register a known openspace command so security-passing tests can also dispatch
        commandRegistry = makeCommandRegistry(['openspace.test', 'openspace.sub.command.deep']);
        (syncService as any).commandRegistry = commandRegistry;
    });

    afterEach(() => {
        sinon.restore();
    });

    // ------------------------------------------------------------------
    // Helper: wait for executeAndReport to finish
    // ------------------------------------------------------------------
    async function dispatchAndWait(command: AgentCommand): Promise<void> {
        syncService.onAgentCommand(command);
        // onAgentCommand is fire-and-forget; yield the microtask queue
        await new Promise(resolve => setImmediate(resolve));
    }

    // ------------------------------------------------------------------
    // Valid commands — should reach CommandRegistry
    // ------------------------------------------------------------------
    describe('Valid commands pass the security gate', () => {
        it('should dispatch valid openspace command', async () => {
            await dispatchAndWait({ cmd: 'openspace.test', args: undefined });
            expect(commandRegistry.executeCommand.calledOnce).to.be.true;
        });

        it('should dispatch command with object args', async () => {
            await dispatchAndWait({ cmd: 'openspace.test', args: { key: 'value' } });
            expect(commandRegistry.executeCommand.calledOnce).to.be.true;
        });

        it('should dispatch command with array args', async () => {
            await dispatchAndWait({ cmd: 'openspace.test', args: [1, 2, 3] });
            expect(commandRegistry.executeCommand.calledOnce).to.be.true;
        });

        it('should dispatch command with deeply nested subcommand', async () => {
            await dispatchAndWait({ cmd: 'openspace.sub.command.deep', args: undefined });
            expect(commandRegistry.executeCommand.calledOnce).to.be.true;
        });
    });

    // ------------------------------------------------------------------
    // Invalid commands — should be silently dropped before CommandRegistry
    // ------------------------------------------------------------------
    describe('Invalid commands are blocked by the security gate', () => {
        it('should block command without openspace prefix', async () => {
            await dispatchAndWait({ cmd: 'file.delete', args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block Theia core commands', async () => {
            await dispatchAndWait({ cmd: 'workbench.action.terminal.new', args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block commands where openspace is not a prefix', async () => {
            await dispatchAndWait({ cmd: 'malicious.openspace.fake', args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block empty string command', async () => {
            await dispatchAndWait({ cmd: '', args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block null cmd', async () => {
            await dispatchAndWait({ cmd: null as any, args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block undefined cmd', async () => {
            await dispatchAndWait({ cmd: undefined as any, args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block non-string cmd (number)', async () => {
            await dispatchAndWait({ cmd: 123 as any, args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });

        it('should block path traversal attempts', async () => {
            await dispatchAndWait({ cmd: '../../../malicious', args: undefined });
            expect(commandRegistry.executeCommand.called).to.be.false;
        });
    });
});
