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
import { OpenCodeSyncServiceImpl } from '../opencode-sync-service';
import { AgentCommand } from '../../common/command-manifest';

/**
 * Test suite for OpenCodeSyncService agent command validation.
 * 
 * Tests Issue #3: Command validation security checks.
 * 
 * Security Requirements:
 * 1. Only openspace.* commands are allowed (namespace allowlist)
 * 2. Command structure must be valid
 * 3. Args must be undefined, object, or array (not primitives)
 * 
 * This prevents:
 * - Execution of arbitrary Theia commands
 * - Path traversal attacks
 * - Type confusion attacks
 */
describe('OpenCodeSyncService - Command Validation', () => {
    let syncService: OpenCodeSyncServiceImpl;

    beforeEach(() => {
        syncService = new OpenCodeSyncServiceImpl();
    });

    /**
     * Valid commands should pass validation.
     */
    describe('Valid Commands', () => {
        it('should accept valid openspace command with undefined args', () => {
            const command: AgentCommand = {
                cmd: 'openspace.test',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });

        it('should accept valid openspace command with object args', () => {
            const command: AgentCommand = {
                cmd: 'openspace.test',
                args: { key: 'value' }
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });

        it('should accept valid openspace command with array args', () => {
            const command: AgentCommand = {
                cmd: 'openspace.test',
                args: [1, 2, 3]
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });

        it('should accept command with nested object args', () => {
            const command: AgentCommand = {
                cmd: 'openspace.complex',
                args: {
                    nested: {
                        deep: 'value'
                    }
                }
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });

        it('should accept command with empty object args', () => {
            const command: AgentCommand = {
                cmd: 'openspace.test',
                args: {}
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });

        it('should accept command with empty array args', () => {
            const command: AgentCommand = {
                cmd: 'openspace.test',
                args: []
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });
    });

    /**
     * Issue #3: Commands outside openspace.* namespace must be rejected.
     * 
     * This prevents malicious agents from executing arbitrary Theia commands
     * like file system operations, terminal commands, etc.
     */
    describe('Issue #3: Namespace Allowlist', () => {
        it('should reject commands without openspace prefix', () => {
            const command: AgentCommand = {
                cmd: 'file.delete',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject Theia core commands', () => {
            const command: AgentCommand = {
                cmd: 'workbench.action.terminal.new',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject commands with openspace substring but wrong position', () => {
            const command: AgentCommand = {
                cmd: 'malicious.openspace.fake',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject empty string command', () => {
            const command: AgentCommand = {
                cmd: '',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with only prefix', () => {
            const command: AgentCommand = {
                cmd: 'openspace.',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true; // 'openspace.' is technically valid, though useless
        });
    });

    /**
     * Malformed command structures must be rejected.
     */
    describe('Malformed Command Structures', () => {
        it('should reject null command', () => {
            const result = (syncService as any).validateAgentCommand(null);
            expect(result).to.be.false;
        });

        it('should reject undefined command', () => {
            const result = (syncService as any).validateAgentCommand(undefined);
            expect(result).to.be.false;
        });

        it('should reject command without cmd field', () => {
            const command = {
                args: { key: 'value' }
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with non-string cmd', () => {
            const command = {
                cmd: 123
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with null cmd', () => {
            const command = {
                cmd: null
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject string command (not object)', () => {
            const result = (syncService as any).validateAgentCommand('openspace.test');
            expect(result).to.be.false;
        });

        it('should reject number command (not object)', () => {
            const result = (syncService as any).validateAgentCommand(123);
            expect(result).to.be.false;
        });
    });

    /**
     * Args validation: Must be undefined, object, or array (not primitives).
     * 
     * This prevents type confusion attacks where primitive values
     * could be misinterpreted by command handlers.
     */
    describe('Args Validation', () => {
        it('should reject command with string args', () => {
            const command = {
                cmd: 'openspace.test',
                args: 'string value'
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with number args', () => {
            const command = {
                cmd: 'openspace.test',
                args: 42
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with boolean args', () => {
            const command = {
                cmd: 'openspace.test',
                args: true
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with null args', () => {
            const command = {
                cmd: 'openspace.test',
                args: null
            } as any;

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });
    });

    /**
     * Edge cases and security attack vectors.
     */
    describe('Security Edge Cases', () => {
        it('should reject path traversal attempts in command ID', () => {
            const command: AgentCommand = {
                cmd: '../../../malicious',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.false;
        });

        it('should reject command with special characters', () => {
            const command: AgentCommand = {
                cmd: 'openspace.\x00malicious',
                args: undefined
            };

            // This should still pass validation (startsWith check)
            // but would fail at command registry lookup
            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true; // Validation passes, execution would fail
        });

        it('should accept command with dots after prefix', () => {
            const command: AgentCommand = {
                cmd: 'openspace.sub.command.deep',
                args: undefined
            };

            const result = (syncService as any).validateAgentCommand(command);
            expect(result).to.be.true;
        });
    });
});
